import { useState } from 'react'
import { useStore } from '../store'

export default function PublishModal(): JSX.Element {
  const { setPublishOpen, setSettingsOpen, project, settings } = useStore()
  const [name, setName] = useState(project?.name ?? '')
  const [description, setDescription] = useState('')
  const [isPrivate, setIsPrivate] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const close = (): void => setPublishOpen(false)
  const hasToken = settings?.hasGithubToken ?? false

  const publish = async (): Promise<void> => {
    const trimmed = name.trim()
    if (!trimmed) return
    setBusy(true)
    setError('')
    try {
      const res = await window.codex.githubCreateRepo({
        name: trimmed,
        description: description.trim() || undefined,
        private: isPrivate,
        push: true
      })
      if (res.ok) close()
      else setError(res.output || 'Failed to publish.')
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
            ◈
          </span>
          <h2 className="text-sm font-semibold text-white">Publish to GitHub</h2>
        </div>
        <p className="mb-4 text-xs text-txt-faint">
          Creates a new repository on your GitHub account and pushes the current project.
        </p>

        {!hasToken ? (
          <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-200">
            A GitHub token is required.{' '}
            <button
              className="font-medium text-accent hover:underline"
              onClick={() => {
                close()
                setSettingsOpen(true)
              }}
            >
              Add one in Settings → GitHub
            </button>
            .
          </div>
        ) : (
          <>
            <label className="mb-1 block text-[11px] text-txt-dim">Repository name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-project"
              className="mb-3 w-full rounded-lg border border-border bg-bg px-3 py-2 text-[13px] text-txt outline-none focus:border-accent focus:shadow-[0_0_0_1px_rgba(77,124,254,0.35)]"
            />
            <label className="mb-1 block text-[11px] text-txt-dim">Description (optional)</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A short description"
              className="mb-3 w-full rounded-lg border border-border bg-bg px-3 py-2 text-[13px] text-txt outline-none focus:border-accent focus:shadow-[0_0_0_1px_rgba(77,124,254,0.35)]"
            />
            <div className="flex gap-2">
              {[
                { v: true, label: 'Private', icon: '🔒' },
                { v: false, label: 'Public', icon: '🌐' }
              ].map((o) => (
                <button
                  key={o.label}
                  onClick={() => setIsPrivate(o.v)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition-colors ${
                    isPrivate === o.v
                      ? 'border-accent bg-accent-subtle text-txt'
                      : 'border-border bg-bg-panel text-txt-dim hover:border-txt-faint'
                  }`}
                >
                  <span>{o.icon}</span> {o.label}
                </button>
              ))}
            </div>
          </>
        )}

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
            onClick={publish}
            disabled={busy || !hasToken || !name.trim()}
            className="rounded-lg bg-accent px-5 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-accent-hover disabled:opacity-30"
          >
            {busy ? 'Publishing…' : 'Create & push'}
          </button>
        </div>
      </div>
    </div>
  )
}
