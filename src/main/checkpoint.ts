import { promises as fs } from 'fs'
import { randomUUID } from 'crypto'
import { resolveInProject } from './tools/paths'

/**
 * Workspace checkpoint for a single agent run. Before each accepted file change
 * during a run we record the file's prior content (or null if it was newly
 * created), so the entire run can be rolled back in one click.
 */

interface Change {
  relPath: string
  before: string | null
}

let active: Map<string, Change> | null = null
let last: { id: string; changes: Change[] } | null = null

export function startCheckpoint(): void {
  active = new Map()
}

export function recordChange(relPath: string, before: string | null): void {
  if (!active) return
  if (!active.has(relPath)) active.set(relPath, { relPath, before })
}

export function finalizeCheckpoint(): { id: string; fileCount: number } | null {
  if (!active || active.size === 0) {
    active = null
    return null
  }
  const id = randomUUID()
  last = { id, changes: [...active.values()] }
  active = null
  return { id, fileCount: last.changes.length }
}

export async function undoCheckpoint(id: string): Promise<{ restored: number }> {
  if (!last || last.id !== id) return { restored: 0 }
  let restored = 0
  for (const c of last.changes) {
    try {
      const abs = resolveInProject(c.relPath)
      if (c.before === null) await fs.rm(abs, { force: true })
      else await fs.writeFile(abs, c.before, 'utf-8')
      restored++
    } catch {
      /* ignore individual failures */
    }
  }
  last = null
  return { restored }
}
