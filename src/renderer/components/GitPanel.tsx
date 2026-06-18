import { useEffect, useState, useCallback } from 'react'
import { useStore } from '../store'
import type { GitStatus, GitFileChange, GitBranches } from '@shared/types'

export default function GitPanel(): JSX.Element {
  const { project, openDiffViewer, setCloneOpen, setPublishOpen } = useStore()
  const [status, setStatus] = useState<GitStatus | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null)

  const refresh = useCallback(async (): Promise<void> => {
    if (!project) return setStatus(null)
    setStatus(await window.codex.gitStatus())
  }, [project?.root])

  useEffect(() => {
    void refresh()
  }, [project?.root])

  useEffect(() => {
    const off = window.codex.onFsChange(() => void refresh())
    return off
  }, [refresh])

  const flash = (text: string, ok: boolean): void => {
    setToast({ text, ok })
    setTimeout(() => setToast(null), 4000)
  }

  /** Run a remote op with busy-state + toast, then refresh. */
  const runOp = async (
    label: string,
    op: () => Promise<{ ok: boolean; output: string }>
  ): Promise<void> => {
    setBusy(true)
    try {
      const res = await op()
      flash(res.output ? `${label}: ${res.output.split('\n')[0]}` : label, res.ok)
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  if (!project) return <div className="p-3 text-xs text-txt-dim">Open a folder first.</div>
  if (!status) return <div className="p-3 text-xs text-txt-dim">Loading…</div>

  /* ---- not a git repository ---- */
  if (!status.isRepo) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-bg-panel text-txt-dim">
          ⎇
        </span>
        <p className="text-xs text-txt-faint">This folder is not a Git repository.</p>
        <button
          onClick={() => void runOp('Initialized repository', () => window.codex.gitInit())}
          disabled={busy}
          className="w-44 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-40"
        >
          Initialize repository
        </button>
        <button
          onClick={() => setCloneOpen(true)}
          className="w-44 rounded-lg border border-border px-3 py-1.5 text-xs text-txt-dim hover:bg-bg-hover hover:text-txt"
        >
          Clone a repository
        </button>
        {toast && <Toast toast={toast} />}
      </div>
    )
  }

  const staged = status.changes.filter((c) => c.staged)
  const unstaged = status.changes.filter((c) => !c.staged)

  const viewFile = async (c: GitFileChange): Promise<void> => {
    const diff =
      c.status === '??'
        ? `(untracked) ${c.path}`
        : await window.codex.gitDiff({ path: c.path, staged: c.staged })
    openDiffViewer(c.path, diff)
  }

  const viewAll = async (): Promise<void> => {
    const [u, s] = await Promise.all([
      window.codex.gitDiff({ staged: false }),
      window.codex.gitDiff({ staged: true })
    ])
    openDiffViewer('All changes', `# Staged\n${s}\n\n# Unstaged\n${u}`)
  }

  const explain = async (): Promise<void> => {
    openDiffViewer('Explaining changes…', 'Thinking…')
    openDiffViewer('Explanation of changes', await window.codex.gitExplain())
  }

  const generate = async (): Promise<void> => {
    setBusy(true)
    try {
      const msg = await window.codex.gitGenerateMessage()
      if (msg) setMessage(msg)
    } finally {
      setBusy(false)
    }
  }

  const commit = async (): Promise<void> => {
    if (!message.trim()) return
    setBusy(true)
    try {
      const res = await window.codex.gitCommit({ message: message.trim(), all: true })
      if (res.ok) setMessage('')
      flash(res.output.split('\n')[0] || 'Committed.', res.ok)
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const Row = ({ c }: { c: GitFileChange }): JSX.Element => (
    <div className="group flex items-center gap-1 px-2 py-0.5 text-[12px] hover:bg-bg-hover">
      <span
        className={`w-4 text-center ${c.status === '??' ? 'text-green-400' : c.status === 'D' ? 'text-red-400' : 'text-yellow-400'}`}
      >
        {c.status === '??' ? 'U' : c.status}
      </span>
      <span
        className="min-w-0 flex-1 cursor-pointer truncate text-txt-dim"
        title={c.path}
        onClick={() => viewFile(c)}
      >
        {c.path}
      </span>
      {c.staged ? (
        <button
          className="text-txt-faint opacity-0 hover:text-txt group-hover:opacity-100"
          title="Unstage"
          onClick={() => window.codex.gitUnstage(c.path).then(refresh)}
        >
          −
        </button>
      ) : (
        <button
          className="text-txt-faint opacity-0 hover:text-txt group-hover:opacity-100"
          title="Stage"
          onClick={() => window.codex.gitStage(c.path).then(refresh)}
        >
          +
        </button>
      )}
    </div>
  )

  return (
    <div className="flex h-full flex-col">
      {/* branch + remote operations */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-2 py-1.5">
        <BranchSwitcher status={status} busy={busy} runOp={runOp} />
        <div className="flex items-center gap-0.5">
          <OpButton title="Fetch" disabled={busy} onClick={() => runOp('Fetch', window.codex.gitFetch)}>
            ↧
          </OpButton>
          <OpButton
            title="Pull"
            disabled={busy}
            badge={status.behind || undefined}
            onClick={() => runOp('Pull', window.codex.gitPull)}
          >
            ↓
          </OpButton>
          {status.remoteUrl ? (
            <OpButton
              title={status.hasUpstream ? 'Push' : 'Publish branch'}
              disabled={busy}
              badge={status.ahead || undefined}
              highlight={status.ahead > 0 || !status.hasUpstream}
              onClick={() => runOp('Push', window.codex.gitPush)}
            >
              ↑
            </OpButton>
          ) : (
            <button
              onClick={() => setPublishOpen(true)}
              className="rounded-md bg-accent px-2 py-0.5 text-[11px] font-medium text-white hover:bg-accent-hover"
              title="Publish to GitHub"
            >
              Publish
            </button>
          )}
          <OpButton title="Refresh" disabled={busy} onClick={refresh}>
            ↻
          </OpButton>
        </div>
      </div>

      <div className="flex items-center gap-3 px-3 py-1 text-[11px] text-txt-faint">
        <button className="hover:text-txt" onClick={viewAll}>
          View all
        </button>
        <button className="hover:text-txt" onClick={explain}>
          Explain
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {staged.length > 0 && (
          <>
            <div className="px-2 pt-2 text-[10px] uppercase tracking-wide text-txt-faint">Staged</div>
            {staged.map((c) => (
              <Row key={'s' + c.path} c={c} />
            ))}
          </>
        )}
        <div className="px-2 pt-2 text-[10px] uppercase tracking-wide text-txt-faint">Changes</div>
        {unstaged.length === 0 && staged.length === 0 ? (
          <div className="px-3 py-2 text-xs text-txt-faint">No changes.</div>
        ) : (
          unstaged.map((c) => <Row key={'u' + c.path} c={c} />)
        )}
      </div>

      {toast && (
        <div className="px-2 pb-1">
          <Toast toast={toast} />
        </div>
      )}

      <div className="shrink-0 border-t border-border p-2">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={2}
          placeholder="Commit message"
          className="w-full resize-none rounded-lg border border-border bg-bg p-2 text-[12px] text-txt outline-none focus:border-accent"
        />
        <div className="mt-1 flex gap-2">
          <button
            onClick={generate}
            disabled={busy}
            className="flex-1 rounded-lg border border-border px-2 py-1 text-[11px] text-txt-dim hover:bg-bg-hover hover:text-txt disabled:opacity-40"
          >
            Generate
          </button>
          <button
            onClick={commit}
            disabled={busy || !message.trim()}
            className="flex-1 rounded-lg bg-accent px-2 py-1 text-[11px] font-medium text-white hover:bg-accent-hover disabled:opacity-40"
          >
            Commit all
          </button>
        </div>
      </div>
    </div>
  )
}

function OpButton({
  children,
  title,
  onClick,
  disabled,
  badge,
  highlight
}: {
  children: React.ReactNode
  title: string
  onClick: () => void
  disabled?: boolean
  badge?: number
  highlight?: boolean
}): JSX.Element {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`relative flex h-6 min-w-[24px] items-center justify-center rounded-md px-1 text-sm disabled:opacity-40 ${
        highlight ? 'text-accent hover:bg-bg-hover' : 'text-txt-dim hover:bg-bg-hover hover:text-txt'
      }`}
    >
      {children}
      {badge !== undefined && (
        <span className="ml-0.5 text-[10px] font-medium tabular-nums">{badge}</span>
      )}
    </button>
  )
}

function Toast({ toast }: { toast: { text: string; ok: boolean } }): JSX.Element {
  return (
    <div
      className={`truncate rounded-md px-2 py-1 text-[11px] ${
        toast.ok ? 'bg-green-500/10 text-green-300' : 'bg-red-500/10 text-red-300'
      }`}
      title={toast.text}
    >
      {toast.text}
    </div>
  )
}

function BranchSwitcher({
  status,
  busy,
  runOp
}: {
  status: GitStatus
  busy: boolean
  runOp: (label: string, op: () => Promise<{ ok: boolean; output: string }>) => Promise<void>
}): JSX.Element {
  const [open, setOpen] = useState(false)
  const [branches, setBranches] = useState<GitBranches | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')

  const toggle = async (): Promise<void> => {
    const next = !open
    setOpen(next)
    if (next) setBranches(await window.codex.gitBranches())
  }

  const checkout = async (branch: string): Promise<void> => {
    setOpen(false)
    await runOp(`Switched to ${branch}`, () => window.codex.gitCheckout(branch))
  }

  const create = async (): Promise<void> => {
    const name = newName.trim()
    if (!name) return
    setCreating(false)
    setNewName('')
    setOpen(false)
    await runOp(`Created ${name}`, () => window.codex.gitCreateBranch(name))
  }

  return (
    <div className="relative">
      <button
        onClick={toggle}
        disabled={busy}
        className="flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[12px] text-txt hover:bg-bg-hover disabled:opacity-40"
        title="Switch branch"
      >
        <span className="text-txt-dim">⎇</span>
        <span className="max-w-[120px] truncate font-medium">{status.branch}</span>
        <span className="text-[9px] text-txt-faint">▾</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-20 mt-1 w-60 rounded-lg border border-border bg-bg-elevated p-1 shadow-pop">
            <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-txt-faint">
              Local branches
            </div>
            <div className="max-h-52 overflow-auto">
              {(branches?.local ?? []).map((b) => (
                <button
                  key={b}
                  onClick={() => checkout(b)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[12px] text-txt-dim hover:bg-bg-hover hover:text-txt"
                >
                  <span className={b === status.branch ? 'text-accent' : 'opacity-0'}>✓</span>
                  <span className="truncate">{b}</span>
                </button>
              ))}
              {branches && branches.local.length === 0 && (
                <div className="px-2 py-1 text-[11px] text-txt-faint">No branches yet.</div>
              )}
            </div>
            <div className="my-1 border-t border-border" />
            {creating ? (
              <div className="flex items-center gap-1 p-1">
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void create()
                    if (e.key === 'Escape') setCreating(false)
                  }}
                  placeholder="new-branch-name"
                  className="min-w-0 flex-1 rounded-md border border-border bg-bg px-2 py-1 text-[12px] text-txt outline-none focus:border-accent"
                />
                <button
                  onClick={create}
                  className="rounded-md bg-accent px-2 py-1 text-[11px] text-white hover:bg-accent-hover"
                >
                  Create
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[12px] text-txt-dim hover:bg-bg-hover hover:text-txt"
              >
                <span className="text-accent">+</span> Create new branch…
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
