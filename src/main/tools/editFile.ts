import { promises as fs } from 'fs'
import { resolveInProject, toRelative } from './paths'
import { proposeEdit } from '../edits'
import type { ToolCallArgs } from '@shared/types'

/**
 * Targeted edit: replace an exact, unique occurrence of old_str with new_str.
 * Approval-gated like write_file.
 */
export async function editFile(args: ToolCallArgs['edit_file']): Promise<string> {
  const abs = resolveInProject(args.path)
  const rel = toRelative(abs)
  const original = await fs.readFile(abs, 'utf-8')

  const firstIdx = original.indexOf(args.old_str)
  if (firstIdx === -1) {
    throw new Error(
      `old_str was not found in ${rel}. Read the file to get its exact current contents, then retry.`
    )
  }
  if (original.indexOf(args.old_str, firstIdx + args.old_str.length) !== -1) {
    throw new Error(
      `old_str matches multiple locations in ${rel}. Include more surrounding context so it is unique.`
    )
  }

  const updated = original.replace(args.old_str, () => args.new_str)

  const accepted = await proposeEdit({
    tool: 'edit_file',
    relPath: rel,
    absPath: abs,
    oldContent: original,
    newContent: updated,
    existed: true
  })

  if (!accepted) {
    return 'The user REJECTED this change. The file was NOT modified. Do not retry the same change; consider an alternative or ask the user.'
  }
  return `Applied edit to ${rel}.`
}
