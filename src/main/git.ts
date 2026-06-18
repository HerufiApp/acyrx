import { spawn } from 'child_process'
import { getProjectRoot } from './projectState'
import { getGithubToken } from './settings'
import type { GitStatus, GitFileChange, GitBranches, GitOpResult } from '@shared/types'

interface GitResult {
  code: number
  stdout: string
  stderr: string
}

function run(args: string[], cwd: string): Promise<GitResult> {
  return new Promise((resolve) => {
    // GIT_TERMINAL_PROMPT=0 makes auth failures error out instead of hanging
    // on a username/password prompt (there is no tty in the Electron main process).
    const child = spawn('git', args, {
      cwd,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (b) => (stdout += b.toString()))
    child.stderr.on('data', (b) => (stderr += b.toString()))
    child.on('error', (e) => resolve({ code: -1, stdout, stderr: stderr + e.message }))
    child.on('close', (code) => resolve({ code: code ?? -1, stdout, stderr }))
  })
}

/**
 * Build the leading `-c` config args that inject a GitHub token as an HTTP
 * Authorization header, scoped to github.com so it never leaks to other hosts.
 * This is the same mechanism GitHub Actions uses for HTTPS auth.
 */
async function authArgs(): Promise<string[]> {
  const token = await getGithubToken()
  if (!token) return []
  const basic = Buffer.from(`x-access-token:${token}`).toString('base64')
  return [
    '-c',
    `http.https://github.com/.extraheader=AUTHORIZATION: basic ${basic}`
  ]
}

/** Run a git command that talks to a remote, injecting GitHub auth when available. */
async function runRemote(args: string[], cwd: string): Promise<GitResult> {
  const auth = await authArgs()
  return run([...auth, ...args], cwd)
}

const outOf = (r: GitResult): string => (r.stdout + r.stderr).trim()

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
  if (!(await isRepo()))
    return { isRepo: false, branch: '', changes: [], ahead: 0, behind: 0, hasUpstream: false, remoteUrl: null }
  const res = await run(['status', '--porcelain', '-b'], r)
  const changes: GitFileChange[] = []
  let branch = ''
  let ahead = 0
  let behind = 0
  let hasUpstream = false
  for (const line of res.stdout.split('\n')) {
    if (!line) continue
    if (line.startsWith('## ')) {
      const info = line.slice(3)
      branch = info.split('...')[0].split(' ')[0]
      hasUpstream = info.includes('...')
      const ab = info.match(/\[(.*)\]/)
      if (ab) {
        const a = ab[1].match(/ahead (\d+)/)
        const b = ab[1].match(/behind (\d+)/)
        if (a) ahead = Number(a[1])
        if (b) behind = Number(b[1])
      }
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
  return {
    isRepo: true,
    branch: branch || '(detached)',
    changes,
    ahead,
    behind,
    hasUpstream,
    remoteUrl: await remoteUrl()
  }
}

export async function remoteUrl(): Promise<string | null> {
  const res = await run(['remote', 'get-url', 'origin'], root())
  return res.code === 0 ? res.stdout.trim() || null : null
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

export async function commit(message: string, all?: boolean): Promise<GitOpResult> {
  const r = root()
  if (all) await run(['add', '-A'], r)
  const res = await run(['commit', '-m', message], r)
  return { ok: res.code === 0, output: outOf(res) || 'Nothing to commit.' }
}

/* ------------------------------------------------------------------ */
/* Remote operations                                                   */
/* ------------------------------------------------------------------ */

export async function init(): Promise<GitOpResult> {
  const res = await run(['init'], root())
  return { ok: res.code === 0, output: outOf(res) }
}

export async function fetch(): Promise<GitOpResult> {
  const res = await runRemote(['fetch', '--all', '--prune'], root())
  return { ok: res.code === 0, output: outOf(res) || 'Fetched.' }
}

export async function pull(): Promise<GitOpResult> {
  const res = await runRemote(['pull', '--no-edit'], root())
  return { ok: res.code === 0, output: outOf(res) || 'Already up to date.' }
}

/** Push the current branch, setting the upstream automatically on first push. */
export async function push(): Promise<GitOpResult> {
  const r = root()
  const st = await status()
  if (!st.hasUpstream) {
    const res = await runRemote(['push', '-u', 'origin', 'HEAD'], r)
    return { ok: res.code === 0, output: outOf(res) || 'Published branch.' }
  }
  const res = await runRemote(['push'], r)
  return { ok: res.code === 0, output: outOf(res) || 'Pushed.' }
}

export async function branches(): Promise<GitBranches> {
  const r = root()
  if (!(await isRepo())) return { current: '', local: [], remote: [] }
  const cur = await run(['rev-parse', '--abbrev-ref', 'HEAD'], r)
  const loc = await run(['branch', '--format=%(refname:short)'], r)
  const rem = await run(['branch', '-r', '--format=%(refname:short)'], r)
  const clean = (s: string): string[] =>
    s.split('\n').map((l) => l.trim()).filter((l) => l && !l.includes('HEAD ->'))
  return {
    current: cur.stdout.trim(),
    local: clean(loc.stdout),
    remote: clean(rem.stdout)
  }
}

export async function checkout(branch: string): Promise<GitOpResult> {
  const res = await run(['checkout', branch], root())
  return { ok: res.code === 0, output: outOf(res) }
}

export async function createBranch(name: string): Promise<GitOpResult> {
  const res = await run(['checkout', '-b', name], root())
  return { ok: res.code === 0, output: outOf(res) }
}

export async function setRemote(url: string): Promise<GitOpResult> {
  const r = root()
  const exists = await remoteUrl()
  const args = exists ? ['remote', 'set-url', 'origin', url] : ['remote', 'add', 'origin', url]
  const res = await run(args, r)
  return { ok: res.code === 0, output: outOf(res) || 'Remote updated.' }
}

/** Clone a repository into `parentDir`. Returns the absolute path of the new repo. */
export async function clone(
  url: string,
  parentDir: string
): Promise<{ ok: boolean; output: string; dir: string | null }> {
  const res = await runRemote(['clone', '--progress', url], parentDir)
  if (res.code !== 0) return { ok: false, output: outOf(res), dir: null }
  // Derive the repo folder name from the URL (git's default behaviour).
  const name = url.replace(/\/$/, '').split('/').pop()!.replace(/\.git$/, '')
  return { ok: true, output: outOf(res) || `Cloned ${name}.`, dir: `${parentDir}/${name}` }
}
