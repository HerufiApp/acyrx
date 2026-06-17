import { randomUUID } from 'crypto'

/**
 * Registry of pending human-in-the-loop approvals (file edits, destructive
 * commands). A tool creates an approval and awaits its promise; the renderer
 * resolves it via IPC (accept/reject).
 */

type Resolver = (accepted: boolean) => void

const pending = new Map<string, Resolver>()

export function createApproval(): { id: string; promise: Promise<boolean> } {
  const id = randomUUID()
  const promise = new Promise<boolean>((res) => pending.set(id, res))
  return { id, promise }
}

export function resolveApproval(id: string, accepted: boolean): void {
  const r = pending.get(id)
  if (r) {
    pending.delete(id)
    r(accepted)
  }
}

/** Reject everything still pending (used on cancel). */
export function rejectAllApprovals(): void {
  for (const [id, r] of pending) {
    pending.delete(id)
    r(false)
  }
}
