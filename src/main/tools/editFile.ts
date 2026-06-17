import { promises as fs } from 'fs'
import { resolveInProject, toRelative } from './paths'
import { createApproval } from '../agent/approvals'
import { emitAgent } from '../projectState'
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
  const secondIdx = original.indexOf(args.old_str, firstIdx + args.old_str.length)
  if (secondIdx !== -1) {
    throw new Error(
      `old_str matches multiple locations in ${rel}. Include more surrounding context so it is unique.`
    )
  }

  // Function replacer avoids special "$" patterns being interpreted in new_str.
  const updated = original.replace(args.old_str, () => args.new_str)

  const { id, promise } = createApproval()
  emitAgent({
    type: 'edit-proposed',
    id,
    tool: 'edit_file',
    path: rel,
    oldContent: original,
    newContent: updated
  })

  const accepted = await promise
  emitAgent({ type: 'edit-resolved', id, accepted })

  if (!accepted) {
    return 'The user REJECTED this change. The file was NOT modified. Do not retry the same change; consider an alternative or ask the user.'
  }

  await fs.writeFile(abs, updated, 'utf-8')
  return `Applied edit to ${rel}.`
}
