import { app } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import type { SessionMeta, SessionLoadResult } from '@shared/types'

/**
 * Lightweight, file-based chat session store. Each session is a JSON file
 * under userData/sessions/<id>.json holding its metadata and transcript.
 * The renderer drives saving; main just persists and lists.
 */

interface StoredSession {
  meta: SessionMeta
  transcript: unknown[]
}

let activeId: string | null = null

function dir(): string {
  return join(app.getPath('userData'), 'sessions')
}

function file(id: string): string {
  return join(dir(), `${id}.json`)
}

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

async function readSession(id: string): Promise<StoredSession | null> {
  try {
    const raw = await fs.readFile(file(id), 'utf-8')
    return JSON.parse(raw) as StoredSession
  } catch {
    return null
  }
}

async function writeSession(s: StoredSession): Promise<void> {
  await fs.mkdir(dir(), { recursive: true })
  await fs.writeFile(file(s.meta.id), JSON.stringify(s, null, 2), 'utf-8')
}

export async function list(): Promise<SessionMeta[]> {
  let names: string[]
  try {
    names = await fs.readdir(dir())
  } catch {
    return []
  }
  const metas: SessionMeta[] = []
  for (const name of names) {
    if (!name.endsWith('.json')) continue
    const s = await readSession(name.slice(0, -'.json'.length))
    if (s) metas.push(s.meta)
  }
  return metas.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function create(): Promise<SessionLoadResult> {
  const id = newId()
  const session: StoredSession = {
    meta: { id, name: 'New Chat', updatedAt: Date.now(), messageCount: 0 },
    transcript: []
  }
  await writeSession(session)
  activeId = id
  return session
}

export async function load(id: string): Promise<SessionLoadResult> {
  const s = await readSession(id)
  if (!s) return create()
  activeId = id
  return s
}

export async function rename(id: string, name: string): Promise<SessionMeta[]> {
  const s = await readSession(id)
  if (s) {
    s.meta.name = name
    await writeSession(s)
  }
  return list()
}

export async function remove(id: string): Promise<SessionMeta[]> {
  try {
    await fs.unlink(file(id))
  } catch {
    /* already gone */
  }
  if (activeId === id) activeId = null
  return list()
}

/** Persist the transcript of the active session, creating one if needed. */
export async function saveTranscript(transcript: unknown[]): Promise<void> {
  if (!activeId) {
    const created = await create()
    activeId = created.meta.id
  }
  const s = (await readSession(activeId)) ?? {
    meta: { id: activeId, name: 'New Chat', updatedAt: Date.now(), messageCount: 0 },
    transcript: []
  }
  s.transcript = transcript
  s.meta.updatedAt = Date.now()
  s.meta.messageCount = transcript.length
  await writeSession(s)
}
