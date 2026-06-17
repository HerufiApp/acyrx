import { promises as fs } from 'fs'
import { dirname } from 'path'
import { createApproval } from './agent/approvals'
import { emitAgent } from './projectState'
import { recordChange } from './checkpoint'

/**
 * Propose a file change to the user (inline diff + Accept/Reject), and on accept
 * record it in the active checkpoint and write it to disk. Shared by the
 * write_file / edit_file tools and by inline (Cmd+K) edits.
 */
export async function proposeEdit(opts: {
  tool: 'write_file' | 'edit_file'
  relPath: string
  absPath: string
  oldContent: string
  newContent: string
  existed: boolean
}): Promise<boolean> {
  const { id, promise } = createApproval()
  emitAgent({
    type: 'edit-proposed',
    id,
    tool: opts.tool,
    path: opts.relPath,
    oldContent: opts.oldContent,
    newContent: opts.newContent
  })
  const accepted = await promise
  emitAgent({ type: 'edit-resolved', id, accepted })
  if (!accepted) return false

  recordChange(opts.relPath, opts.existed ? opts.oldContent : null)
  await fs.mkdir(dirname(opts.absPath), { recursive: true })
  await fs.writeFile(opts.absPath, opts.newContent, 'utf-8')
  return true
}
