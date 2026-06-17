import * as git from '../git'
import type { ToolCallArgs } from '@shared/types'

export async function gitStatusTool(): Promise<string> {
  const s = await git.status()
  if (!s.isRepo) return 'This project is not a git repository.'
  if (s.changes.length === 0) return `On branch ${s.branch}. Working tree clean.`
  const lines = s.changes.map((c) => `${c.staged ? 'staged  ' : 'unstaged'} ${c.status} ${c.path}`)
  return `On branch ${s.branch}:\n${lines.join('\n')}`
}

export async function gitDiffTool(args: ToolCallArgs['git_diff']): Promise<string> {
  const d = await git.diff({ staged: args.staged, path: args.path })
  return d.length > 100_000 ? d.slice(0, 100_000) + '\n[...diff truncated]' : d
}

export async function gitCommitTool(args: ToolCallArgs['git_commit']): Promise<string> {
  if (!args.message?.trim()) throw new Error('A commit message is required.')
  const r = await git.commit(args.message, args.all)
  return r.ok ? `Committed successfully:\n${r.output}` : `Commit failed:\n${r.output}`
}
