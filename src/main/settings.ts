import { app, safeStorage } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import type {
  Settings,
  Provider,
  ProviderStatus,
  KeySource,
  McpServerConfig,
  McpServerStatus
} from '@shared/types'
import { DEFAULT_MODELS } from '@shared/types'
import { oursKey } from './builtinKeys'

const PROVIDERS: Provider[] = ['gemini', 'anthropic', 'openai']

const ENV_VARS: Record<Provider, string> = {
  gemini: 'GEMINI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY'
}

interface StoredSettings {
  provider: Provider
  models: Record<Provider, string>
  /** Base64 of the encrypted (or obfuscated) pasted key, per provider. */
  userKeys: Partial<Record<Provider, string>>
  encrypted: boolean
  /** Configured MCP servers. */
  mcpServers: McpServerConfig[]
  /** Base64 of the encrypted (or obfuscated) Tavily key, if set. */
  tavilyKey?: string
  /** Inline tab-autocomplete enabled. */
  autocomplete: boolean
}

let cache: StoredSettings | null = null

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

function defaults(): StoredSettings {
  return {
    provider: 'gemini',
    models: { ...DEFAULT_MODELS },
    userKeys: {},
    encrypted: false,
    mcpServers: [],
    autocomplete: true
  }
}

async function load(): Promise<StoredSettings> {
  if (cache) return cache
  try {
    const raw = await fs.readFile(settingsPath(), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<StoredSettings>
    cache = {
      provider: parsed.provider ?? 'gemini',
      models: { ...DEFAULT_MODELS, ...(parsed.models ?? {}) },
      userKeys: parsed.userKeys ?? {},
      encrypted: parsed.encrypted ?? false,
      mcpServers: parsed.mcpServers ?? [],
      tavilyKey: parsed.tavilyKey,
      autocomplete: parsed.autocomplete ?? true
    }
  } catch {
    cache = defaults()
  }
  return cache
}

async function persist(s: StoredSettings): Promise<void> {
  cache = s
  await fs.writeFile(settingsPath(), JSON.stringify(s, null, 2), 'utf-8')
}

function envKey(provider: Provider): string | null {
  return process.env[ENV_VARS[provider]]?.trim() || null
}

function decodePasted(s: StoredSettings, provider: Provider): string | null {
  const stored = s.userKeys[provider]
  if (!stored) return null
  try {
    const buf = Buffer.from(stored, 'base64')
    if (s.encrypted && safeStorage.isEncryptionAvailable()) return safeStorage.decryptString(buf)
    return buf.toString('utf-8')
  } catch {
    return null
  }
}

function statusFor(s: StoredSettings, provider: Provider): ProviderStatus {
  const pasted = Boolean(s.userKeys[provider])
  const env = Boolean(envKey(provider))
  const hasUserKey = pasted || env
  const oursAvailable = oursKey(provider) !== null
  const keySource: KeySource = hasUserKey ? 'user' : oursAvailable ? 'ours' : 'none'
  return { hasUserKey, userFromEnv: !pasted && env, oursAvailable, keySource }
}

/** Live MCP status is owned by the MCP runtime; until that exists, report none. */
function mcpStatus(s: StoredSettings): McpServerStatus[] {
  return s.mcpServers.map((srv) => ({
    id: srv.id,
    name: srv.name,
    connected: false,
    toolCount: 0
  }))
}

export async function getSettings(): Promise<Settings> {
  const s = await load()
  const providers = {} as Record<Provider, ProviderStatus>
  for (const p of PROVIDERS) providers[p] = statusFor(s, p)
  return {
    provider: s.provider,
    model: s.models[s.provider],
    models: s.models,
    providers,
    mcpServers: s.mcpServers,
    mcpStatus: mcpStatus(s),
    hasTavilyKey: Boolean(s.tavilyKey) || Boolean(process.env.TAVILY_API_KEY?.trim()),
    autocomplete: s.autocomplete
  }
}

export async function setProvider(provider: Provider): Promise<Settings> {
  const s = await load()
  await persist({ ...s, provider })
  return getSettings()
}

export async function setModel(provider: Provider, model: string): Promise<Settings> {
  const s = await load()
  await persist({ ...s, models: { ...s.models, [provider]: model } })
  return getSettings()
}

export async function setUserKey(provider: Provider, key: string): Promise<Settings> {
  const s = await load()
  const userKeys = { ...s.userKeys }
  const trimmed = key.trim()
  let encrypted = s.encrypted
  if (!trimmed) {
    delete userKeys[provider]
  } else if (safeStorage.isEncryptionAvailable()) {
    userKeys[provider] = safeStorage.encryptString(trimmed).toString('base64')
    encrypted = true
  } else {
    userKeys[provider] = Buffer.from(trimmed, 'utf-8').toString('base64')
    // Keep flag as-is; mixed states are handled per-key on decode.
  }
  await persist({ ...s, userKeys, encrypted })
  return getSettings()
}

export async function setMcpServers(servers: McpServerConfig[]): Promise<Settings> {
  const s = await load()
  await persist({ ...s, mcpServers: servers })
  return getSettings()
}

export async function setTavilyKey(key: string): Promise<Settings> {
  const s = await load()
  const trimmed = key.trim()
  let tavilyKey: string | undefined
  let encrypted = s.encrypted
  if (!trimmed) {
    tavilyKey = undefined
  } else if (safeStorage.isEncryptionAvailable()) {
    tavilyKey = safeStorage.encryptString(trimmed).toString('base64')
    encrypted = true
  } else {
    tavilyKey = Buffer.from(trimmed, 'utf-8').toString('base64')
  }
  await persist({ ...s, tavilyKey, encrypted })
  return getSettings()
}

export async function setAutocomplete(enabled: boolean): Promise<Settings> {
  const s = await load()
  await persist({ ...s, autocomplete: enabled })
  return getSettings()
}

/** Reconnect MCP servers. No MCP runtime yet, so this just re-reports status. */
export async function reconnectMcp(): Promise<Settings> {
  return getSettings()
}

/* --------- resolution used by the agent loop (main only) --------- */

export async function getActiveProvider(): Promise<Provider> {
  return (await load()).provider
}

export async function getActiveModel(): Promise<string> {
  const s = await load()
  return s.models[s.provider]
}

/** Resolve the key to use for a provider: pasted -> env -> ours. */
export async function getApiKey(provider: Provider): Promise<string | null> {
  const s = await load()
  return decodePasted(s, provider) ?? envKey(provider) ?? oursKey(provider)
}

/** Resolve the Tavily key: stored -> env. */
export async function getTavilyKey(): Promise<string | null> {
  const s = await load()
  if (s.tavilyKey) {
    try {
      const buf = Buffer.from(s.tavilyKey, 'base64')
      if (s.encrypted && safeStorage.isEncryptionAvailable()) return safeStorage.decryptString(buf)
      return buf.toString('utf-8')
    } catch {
      /* fall through to env */
    }
  }
  return process.env.TAVILY_API_KEY?.trim() || null
}
