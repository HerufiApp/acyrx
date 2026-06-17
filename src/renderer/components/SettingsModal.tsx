import { useState } from 'react'
import { useStore } from '../store'
import {
  MODELS,
  PROVIDER_LABELS,
  OURS_PROVIDERS,
  type Provider,
  type KeySource
} from '@shared/types'

const PROVIDERS: Provider[] = ['gemini', 'anthropic', 'openai']

const SOURCE_LABEL: Record<KeySource, string> = {
  user: 'Using your key',
  ours: 'Using built-in key',
  none: 'No key configured'
}

export default function SettingsModal(): JSX.Element {
  const { settings, setSettings, setSettingsOpen } = useStore()
  const [provider, setProvider] = useState<Provider>(settings?.provider ?? 'gemini')
  const [model, setModel] = useState(settings?.model ?? MODELS[provider][0])
  const [keys, setKeys] = useState<Record<Provider, string>>({
    gemini: '',
    anthropic: '',
    openai: ''
  })
  const [saving, setSaving] = useState(false)

  const close = (): void => setSettingsOpen(false)

  const save = async (): Promise<void> => {
    setSaving(true)
    let updated = settings ?? undefined
    // Persist any pasted keys first.
    for (const p of PROVIDERS) {
      if (keys[p].trim()) updated = await window.codex.setUserKey(p, keys[p].trim())
    }
    updated = await window.codex.setModel(provider, model)
    updated = await window.codex.setProvider(provider)
    if (updated) setSettings(updated)
    setSaving(false)
    close()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={close}>
      <div
        className="max-h-[90vh] w-[520px] overflow-auto rounded-lg border border-border bg-bg-alt p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 text-sm font-semibold text-white">Settings</div>

        {/* active provider */}
        <label className="mb-1 block text-xs opacity-70">Active provider</label>
        <select
          value={provider}
          onChange={(e) => {
            const p = e.target.value as Provider
            setProvider(p)
            setModel(settings?.models[p] ?? MODELS[p][0])
          }}
          className="mb-3 w-full rounded border border-border bg-bg p-2 text-[13px] outline-none focus:border-accent"
        >
          {PROVIDERS.map((p) => (
            <option key={p} value={p}>
              {PROVIDER_LABELS[p]}
            </option>
          ))}
        </select>

        {/* model for active provider */}
        <label className="mb-1 block text-xs opacity-70">Model ({PROVIDER_LABELS[provider]})</label>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="mb-5 w-full rounded border border-border bg-bg p-2 text-[13px] outline-none focus:border-accent"
        >
          {MODELS[provider].map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        {/* API keys */}
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide opacity-50">
          API Keys
        </div>
        {PROVIDERS.map((p) => {
          const status = settings?.providers[p]
          const ours = OURS_PROVIDERS.includes(p)
          return (
            <div key={p} className="mb-3">
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs opacity-70">{PROVIDER_LABELS[p]}</label>
                {status && (
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] ${
                      status.keySource === 'none'
                        ? 'bg-yellow-900/60 text-yellow-200'
                        : 'bg-green-900/50 text-green-200'
                    }`}
                  >
                    {SOURCE_LABEL[status.keySource]}
                  </span>
                )}
              </div>
              {status?.userFromEnv ? (
                <div className="rounded border border-border bg-bg p-2 text-xs opacity-70">
                  Using key from environment variable.
                </div>
              ) : (
                <input
                  type="password"
                  value={keys[p]}
                  onChange={(e) => setKeys((k) => ({ ...k, [p]: e.target.value }))}
                  placeholder={
                    status?.hasUserKey
                      ? '•••••••• (leave blank to keep)'
                      : ours
                        ? 'Paste your key, or leave blank to use the built-in key'
                        : 'Paste your key (required)'
                  }
                  className="w-full rounded border border-border bg-bg p-2 text-[13px] outline-none focus:border-accent"
                />
              )}
            </div>
          )
        })}

        <div className="mb-4 text-[11px] opacity-40">
          Keys are stored encrypted on disk via the OS keychain and never sent to the renderer.
          Built-in keys (Gemini, Claude) are used only when you don't provide your own.
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={close}
            className="rounded border border-border px-3 py-1 text-xs hover:bg-bg-hover"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded bg-accent px-4 py-1 text-xs text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
