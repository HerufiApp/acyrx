import { promises as fs } from 'fs'
import { resolveInProject, toRelative } from './paths'
import { proposeEdit } from '../edits'
import type { ToolCallArgs } from '@shared/types'

/**
 * Create a new file or overwrite an existing one. Approval-gated: shows a diff
 * and waits for the user's accept/reject decision.
 */
export async function writeFile(args: ToolCallArgs['write_file']): Promise<string> {
  const abs = resolveInProject(args.path)
  let oldContent = ''
  let existed = true
  try {
    oldContent = await fs.readFile(abs, 'utf-8')
  } catch {
    existed = false
    oldContent = ''
  }

  const accepted = await proposeEdit({
    tool: 'write_file',
    relPath: toRelative(abs),
    absPath: abs,
    oldContent,
    newContent: args.content,
    existed
  })

  if (!accepted) {
    return 'The user REJECTED this change. The file was NOT modified. Do not retry the same change; consider an alternative or ask the user.'
  }
  return `Wrote ${args.content.length} characters to ${toRelative(abs)}.`
}
