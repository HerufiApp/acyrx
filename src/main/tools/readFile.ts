import { promises as fs } from 'fs'
import { resolveInProject, toRelative } from './paths'
import type { ToolCallArgs } from '@shared/types'

const MAX_CHARS = 200_000

export async function readFile(args: ToolCallArgs['read_file']): Promise<string> {
  const abs = resolveInProject(args.path)
  const data = await fs.readFile(abs, 'utf-8')
  if (data.length > MAX_CHARS) {
    return (
      data.slice(0, MAX_CHARS) +
      `\n\n[...truncated: ${toRelative(abs)} is ${data.length} characters total]`
    )
  }
  return data
}
