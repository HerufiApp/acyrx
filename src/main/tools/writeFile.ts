import { promises as fs } from 'fs'
import { dirname } from 'path'
import { resolveInProject, toRelative } from './paths'
import { createApproval } from '../agent/approvals'
import { emitAgent } from '../projectState'
import type { ToolCallArgs } from '@shared/types'

/**
 * Create or overwrite a file. Approval-gated: emits an `edit-proposed` event
 * with a before/after view and waits for the user's accept/reject decision.
 */
export async function writeFile(args: ToolCallArgs['write_file']): Promise<string> {
  const abs = resolveInProject(args.path)

  let oldContent = ''
  try {
    oldContent = await fs.readFile(abs, 'utf-8')
  } catch {
    oldContent = ''
  }

  const { id, promise } = createApproval()
  emitAgent({
    type: 'edit-proposed',
    id,
    tool: 'write_file',
    path: toRelative(abs),
    oldContent,
    newContent: args.content
  })

  const accepted = await promise
  emitAgent({ type: 'edit-resolved', id, accepted })

  if (!accepted) {
    return 'The user REJECTED this change. The file was NOT modified. Do not retry the same change; consider an alternative or ask the user.'
  }

  await fs.mkdir(dirname(abs), { recursive: true })
  await fs.writeFile(abs, args.content, 'utf-8')
  return `Wrote ${args.content.length} characters to ${toRelative(abs)}.`
}
