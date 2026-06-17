import { useEffect, useState, useCallback } from 'react'
import { useStore } from '../store'
import type { GitStatus, GitFileChange } from '@shared/types'

export default function GitPanel(): JSX.Element {
  const { project, openDiffViewer } = useStore()
  const [status, setStatus] = useState<GitStatus | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

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

  if (!project) return <div className="p-3 text-xs opacity-50">Open a folder first.</div>
  if (!status) return <div className="p-3 text-xs opacity-50">Loading…</div>
  if (!status.isRepo)
    return <div className="p-3 text-xs opacity-60">This folder is not a git repository.</div>

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
    openDiffViewer(
      'All changes',
      `# Staged\n${s}\n\n# Unstaged\n${u}`
    )
  }

  const explain = async (): Promise<void> => {
    openDiffViewer('Explaining changes…', 'Thinking…')
    const text = await window.codex.gitExplain()
    openDiffViewer('Explanation of changes', text)
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
      <span className="min-w-0 flex-1 cursor-pointer truncate" title={c.path} onClick={() => viewFile(c)}>
        {c.path}
      </span>
      {c.staged ? (
        <button
          className="opacity-0 group-hover:opacity-100"
          title="Unstage"
          onClick={() => window.codex.gitUnstage(c.path).then(refresh)}
        >
          −
        </button>
      ) : (
        <button
          className="opacity-0 group-hover:opacity-100"
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
      <div className="flex items-center justify-between px-3 py-1 text-[11px] opacity-70">
        <span>⎇ {status.branch}</span>
        <div className="flex gap-2">
          <button className="hover:text-white" onClick={viewAll}>
            View all
          </button>
          <button className="hover:text-white" onClick={explain}>
            Explain
          </button>
          <button className="hover:text-white" onClick={refresh}>
            ↻
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {staged.length > 0 && (
          <>
            <div className="px-2 pt-2 text-[10px] uppercase opacity-40">Staged</div>
            {staged.map((c) => (
              <Row key={'s' + c.path} c={c} />
            ))}
          </>
        )}
        <div className="px-2 pt-2 text-[10px] uppercase opacity-40">Changes</div>
        {unstaged.length === 0 && staged.length === 0 ? (
          <div className="px-3 py-2 text-xs opacity-50">No changes.</div>
        ) : (
          unstaged.map((c) => <Row key={'u' + c.path} c={c} />)
        )}
      </div>

      <div className="shrink-0 border-t border-border p-2">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={2}
          placeholder="Commit message"
          className="w-full resize-none rounded border border-border bg-bg p-2 text-[12px] outline-none focus:border-accent"
        />
        <div className="mt-1 flex gap-2">
          <button
            onClick={generate}
            disabled={busy}
            className="flex-1 rounded border border-border px-2 py-1 text-[11px] hover:bg-bg-hover disabled:opacity-40"
          >
            Generate
          </button>
          <button
            onClick={commit}
            disabled={busy || !message.trim()}
            className="flex-1 rounded bg-accent px-2 py-1 text-[11px] text-white hover:bg-accent-hover disabled:opacity-40"
          >
            Commit all
          </button>
        </div>
      </div>
    </div>
  )
}
