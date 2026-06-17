import { spawn } from 'child_process'
import { getProjectRoot } from './projectState'
import type { GitStatus, GitFileChange } from '@shared/types'

interface GitResult {
  code: number
  stdout: string
  stderr: string
}

function run(args: string[], cwd: string): Promise<GitResult> {
  return new Promise((resolve) => {
    const child = spawn('git', args, { cwd })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (b) => (stdout += b.toString()))
    child.stderr.on('data', (b) => (stderr += b.toString()))
    child.on('error', (e) => resolve({ code: -1, stdout, stderr: stderr + e.message }))
    child.on('close', (code) => resolve({ code: code ?? -1, stdout, stderr }))
  })
}

function root(): string {
  const r = getProjectRoot()
  if (!r) throw new Error('No project folder is open.')
  return r
}

function stripRename(f: string): string {
  const idx = f.indexOf(' -> ')
  return idx === -1 ? f : f.slice(idx + 4)
}

export async function isRepo(): Promise<boolean> {
  const r = getProjectRoot()
  if (!r) return false
  const res = await run(['rev-parse', '--is-inside-work-tree'], r)
  return res.code === 0 && res.stdout.trim() === 'true'
}

export async function status(): Promise<GitStatus> {
  const r = root()
  if (!(await isRepo())) return { isRepo: false, branch: '', changes: [] }
  const res = await run(['status', '--porcelain', '-b'], r)
  const changes: GitFileChange[] = []
  let branch = ''
  for (const line of res.stdout.split('\n')) {
    if (!line) continue
    if (line.startsWith('## ')) {
      branch = line.slice(3).split('...')[0].split(' ')[0]
      continue
    }
    const x = line[0]
    const y = line[1]
    const file = stripRename(line.slice(3))
    if (x === '?' && y === '?') {
      changes.push({ path: file, status: '??', staged: false })
      continue
    }
    if (x !== ' ' && x !== '?') changes.push({ path: file, status: x, staged: true })
    if (y !== ' ' && y !== '?') changes.push({ path: file, status: y, staged: false })
  }
  return { isRepo: true, branch: branch || '(detached)', changes }
}

export async function diff(opts: { staged?: boolean; path?: string }): Promise<string> {
  const args = ['--no-pager', 'diff', '--no-color']
  if (opts.staged) args.push('--cached')
  if (opts.path) args.push('--', opts.path)
  const res = await run(args, root())
  return res.stdout || (opts.path ? `(no diff for ${opts.path})` : '(no changes)')
}

/** All working-tree changes vs HEAD, plus a list of untracked files. */
export async function diffAll(): Promise<string> {
  const r = root()
  const res = await run(['--no-pager', 'diff', '--no-color', 'HEAD'], r)
  let out = res.code === 0 ? res.stdout : ''
  const unt = await run(['ls-files', '--others', '--exclude-standard'], r)
  const untracked = unt.stdout.split('\n').filter(Boolean)
  if (untracked.length) {
    out += `\n\n# Untracked files (not yet added):\n` + untracked.map((f) => `+ ${f}`).join('\n')
  }
  return out.trim() || '(no changes)'
}

export async function stage(path: string): Promise<void> {
  await run(['add', '--', path], root())
}

export async function unstage(path: string): Promise<void> {
  await run(['reset', '-q', 'HEAD', '--', path], root())
}

export async function commit(message: string, all?: boolean): Promise<{ ok: boolean; output: string }> {
  const r = root()
  if (all) await run(['add', '-A'], r)
  const res = await run(['commit', '-m', message], r)
  return { ok: res.code === 0, output: (res.stdout + res.stderr).trim() }
}
