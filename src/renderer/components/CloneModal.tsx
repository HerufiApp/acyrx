import { useState } from 'react'
import { useStore } from '../store'

export default function CloneModal(): JSX.Element {
  const { setCloneOpen, setProject } = useStore()
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const close = (): void => setCloneOpen(false)

  const clone = async (): Promise<void> => {
    const trimmed = url.trim()
    if (!trimmed) return
    setBusy(true)
    setError('')
    try {
      const res = await window.codex.gitClone({ url: trimmed })
      if (res.ok && res.project) {
        setProject(res.project)
        close()
      } else if (res.output !== 'Cancelled.') {
        setError(res.output || 'Clone failed.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={close}
    >
      <div
        className="w-[480px] rounded-xl border border-border bg-bg-alt p-5 shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-bg-panel text-accent">
            ⎘
          </span>
          <h2 className="text-sm font-semibold text-white">Clone a repository</h2>
        </div>
        <p className="mb-4 text-xs text-txt-faint">
          Paste a Git URL. You&apos;ll choose a destination folder, then it opens automatically.
        </p>

        <input
          autoFocus
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void clone()}
          placeholder="https://github.com/owner/repo.git"
          className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-[13px] text-txt outline-none transition-colors focus:border-accent focus:shadow-[0_0_0_1px_rgba(77,124,254,0.35)]"
        />

        {error && (
          <pre className="mt-3 max-h-32 overflow-auto whitespace-pre-wrap rounded-lg bg-red-500/10 p-2.5 text-[11px] text-red-300">
            {error}
          </pre>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={close}
            className="rounded-lg border border-border px-4 py-1.5 text-xs text-txt-dim hover:bg-bg-hover hover:text-txt"
          >
            Cancel
          </button>
          <button
            onClick={clone}
            disabled={busy || !url.trim()}
            className="rounded-lg bg-accent px-5 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-accent-hover disabled:opacity-30"
          >
            {busy ? 'Cloning…' : 'Clone'}
          </button>
        </div>
      </div>
    </div>
  )
}
