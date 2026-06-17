import { promises as fs } from 'fs'
import { resolveInProject, toRelative } from './paths'
import type { ToolCallArgs } from '@shared/types'

const IGNORE = new Set(['.git', 'node_modules', '.DS_Store'])

export async function listDir(args: ToolCallArgs['list_dir']): Promise<string> {
  const abs = resolveInProject(args.path || '.')
  const entries = await fs.readdir(abs, { withFileTypes: true })
  const lines = entries
    .filter((e) => !IGNORE.has(e.name))
    .sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))

  const rel = toRelative(abs) || '.'
  if (lines.length === 0) return `${rel} is empty.`
  return `Contents of ${rel}:\n` + lines.join('\n')
}
