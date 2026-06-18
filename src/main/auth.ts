import { app, safeStorage } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import { createClient, type SupabaseClient, type Session } from '@supabase/supabase-js'
import WS from 'ws'
import { IPC, type AuthState, type AuthResult } from '@shared/types'
import { getMainWindow } from './projectState'

/**
 * Supabase-backed authentication for the main process.
 *
 * The client lives in main (not the renderer) so that access to the AI
 * features can be gated authoritatively at the IPC boundary — a compromised
 * or modified renderer cannot bypass the check.
 *
 * Configuration comes from the environment (loaded from `.env` by env.ts):
 *
 *   SUPABASE_URL=https://xxxxx.supabase.co
 *   SUPABASE_ANON_KEY=eyJ...
 *
 * The session (access + refresh tokens) is persisted to userData, encrypted
 * via the OS keychain when available, so the user stays signed in across
 * restarts.
 */

let client: SupabaseClient | null = null
let session: Session | null = null

// Read lazily: env vars are populated by loadEnv() at startup, which may run
// after this module is first imported (ES import hoisting).
function supabaseUrl(): string {
  return process.env.SUPABASE_URL?.trim() || ''
}

function supabaseAnonKey(): string {
  return process.env.SUPABASE_ANON_KEY?.trim() || ''
}

function isConfigured(): boolean {
  return Boolean(supabaseUrl() && supabaseAnonKey())
}

function getClient(): SupabaseClient {
  if (!client) {
    // supabase-js eagerly constructs a Realtime client, which needs a global
    // WebSocket. Electron's Node 20 main process has none, so createClient
    // would throw — even though we only use auth. Polyfill it with `ws`.
    const g = globalThis as { WebSocket?: unknown }
    if (typeof g.WebSocket === 'undefined') g.WebSocket = WS
    client = createClient(supabaseUrl(), supabaseAnonKey(), {
      auth: {
        persistSession: false,
        autoRefreshToken: true,
        detectSessionInUrl: false
      }
    })
  }
  return client
}

function sessionPath(): string {
  return join(app.getPath('userData'), 'auth.json')
}

async function persistSession(s: Session | null): Promise<void> {
  session = s
  try {
    if (!s) {
      await fs.rm(sessionPath(), { force: true })
      return
    }
    const payload = JSON.stringify({ access_token: s.access_token, refresh_token: s.refresh_token })
    const data = safeStorage.isEncryptionAvailable()
      ? safeStorage.encryptString(payload).toString('base64')
      : Buffer.from(payload, 'utf-8').toString('base64')
    await fs.writeFile(sessionPath(), JSON.stringify({ encrypted: safeStorage.isEncryptionAvailable(), data }), 'utf-8')
  } catch {
    /* best-effort persistence */
  }
}

function emitChanged(): void {
  getMainWindow()?.webContents.send(IPC.evtAuthChanged, getAuthState())
}

/** Restore a persisted session on startup (best-effort, refreshes tokens). */
export async function restoreSession(): Promise<void> {
  if (!isConfigured()) return
  let stored: { encrypted: boolean; data: string }
  try {
    stored = JSON.parse(await fs.readFile(sessionPath(), 'utf-8'))
  } catch {
    return
  }
  let payload: string
  try {
    const buf = Buffer.from(stored.data, 'base64')
    payload = stored.encrypted && safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(buf)
      : buf.toString('utf-8')
  } catch {
    return
  }
  try {
    const { access_token, refresh_token } = JSON.parse(payload)
    const { data, error } = await getClient().auth.setSession({ access_token, refresh_token })
    if (error || !data.session) {
      await persistSession(null)
      return
    }
    await persistSession(data.session)
  } catch {
    await persistSession(null)
  }
}

export function getAuthState(): AuthState {
  return {
    configured: isConfigured(),
    user: session?.user ? { id: session.user.id, email: session.user.email ?? null } : null
  }
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  if (!isConfigured()) return { ok: false, error: 'Authentication is not configured.' }
  const { data, error } = await getClient().auth.signInWithPassword({ email, password })
  if (error || !data.session) return { ok: false, error: error?.message ?? 'Sign-in failed.' }
  await persistSession(data.session)
  emitChanged()
  return { ok: true, state: getAuthState() }
}

export async function signUp(email: string, password: string): Promise<AuthResult> {
  if (!isConfigured()) return { ok: false, error: 'Authentication is not configured.' }
  const { data, error } = await getClient().auth.signUp({ email, password })
  if (error) return { ok: false, error: error.message }
  if (!data.session) {
    // Email confirmation is required before a session is issued.
    return { ok: false, error: 'Check your email to confirm your account, then sign in.' }
  }
  await persistSession(data.session)
  emitChanged()
  return { ok: true, state: getAuthState() }
}

export async function signOut(): Promise<AuthState> {
  try {
    if (session) await getClient().auth.signOut()
  } catch {
    /* ignore network errors on sign-out */
  }
  await persistSession(null)
  emitChanged()
  return getAuthState()
}

/** True when auth is either not required (unconfigured) or the user is signed in. */
export function isAuthenticated(): boolean {
  return !isConfigured() || Boolean(session?.user)
}

/** Throw if AI features should be blocked for the current auth state. */
export function requireAuth(): void {
  if (!isAuthenticated()) {
    throw new Error('You must sign in to use the AI features.')
  }
}
