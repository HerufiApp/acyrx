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

const PROVIDER_GLYPH: Record<Provider, string> = {
  gemini: '✦',
  anthropic: '◈',
  openai: '✸'
}

const PROVIDER_DESC: Record<Provider, string> = {
  gemini: 'Google Gemini models',
  anthropic: 'Claude models by Anthropic',
  openai: 'GPT models by OpenAI'
}

type Section = 'models' | 'keys' | 'github' | 'about'

const SECTIONS: { id: Section; label: string; icon: string }[] = [
  { id: 'models', label: 'Models', icon: '◇' },
  { id: 'keys', label: 'API Keys', icon: '⚷' },
  { id: 'github', label: 'GitHub', icon: '◈' },
  { id: 'about', label: 'About', icon: 'ⓘ' }
]

export default function SettingsPage(): JSX.Element {
  const { settings, setSettings, setSettingsOpen } = useStore()
  const [section, setSection] = useState<Section>('models')
  const [provider, setProvider] = useState<Provider>(settings?.provider ?? 'gemini')
  const [model, setModel] = useState(settings?.model ?? MODELS[provider][0])
  const [keys, setKeys] = useState<Record<Provider, string>>({
    gemini: '',
    anthropic: '',
    openai: ''
  })
  const [githubToken, setGithubToken] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const close = (): void => setSettingsOpen(false)

  const dirty =
    provider !== settings?.provider ||
    model !== settings?.model ||
    githubToken.trim().length > 0 ||
    PROVIDERS.some((p) => keys[p].trim().length > 0)

  const save = async (): Promise<void> => {
    setSaving(true)
    let updated = settings ?? undefined
    for (const p of PROVIDERS) {
      if (keys[p].trim()) updated = await window.codex.setUserKey(p, keys[p].trim())
    }
    if (githubToken.trim()) updated = await window.codex.setGithubToken(githubToken.trim())
    updated = await window.codex.setModel(provider, model)
    updated = await window.codex.setProvider(provider)
    if (updated) setSettings(updated)
    setKeys({ gemini: '', anthropic: '', openai: '' })
    setGithubToken('')
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-bg">
      {/* page header */}
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-5">
        <button
          onClick={close}
          className="flex h-7 w-7 items-center justify-center rounded-md text-txt-dim hover:bg-bg-hover hover:text-txt"
          title="Back (Esc)"
        >
          ←
        </button>
        <h1 className="text-sm font-semibold text-white">Settings</h1>
        <span className="text-txt-faint">·</span>
        <span className="text-xs text-txt-dim">Configure providers, models and keys</span>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* nav rail */}
        <nav className="flex w-52 shrink-0 flex-col gap-0.5 border-r border-border bg-bg-alt p-3">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] transition-colors ${
                section === s.id
                  ? 'bg-bg-hover text-txt'
                  : 'text-txt-dim hover:bg-bg-panel hover:text-txt'
              }`}
            >
              <span className={section === s.id ? 'text-accent' : 'text-txt-faint'}>{s.icon}</span>
              {s.label}
            </button>
          ))}
        </nav>

        {/* content */}
        <div className="min-w-0 flex-1 overflow-auto">
          <div className="mx-auto max-w-2xl px-8 py-8">
            {section === 'models' && (
              <>
                <SectionHeader
                  title="Active provider"
                  desc="Choose which AI provider powers the agent."
                />
                <div className="mb-8 grid grid-cols-3 gap-3">
                  {PROVIDERS.map((p) => {
                    const active = provider === p
                    return (
                      <button
                        key={p}
                        onClick={() => {
                          setProvider(p)
                          setModel(settings?.models[p] ?? MODELS[p][0])
                        }}
                        className={`flex flex-col items-start gap-2 rounded-xl border p-3.5 text-left transition-all ${
                          active
                            ? 'border-accent bg-accent-subtle shadow-[0_0_0_1px_rgba(77,124,254,0.4)]'
                            : 'border-border bg-bg-panel hover:border-txt-faint'
                        }`}
                      >
                        <span
                          className={`flex h-8 w-8 items-center justify-center rounded-lg text-base ${
                            active ? 'bg-accent text-white' : 'bg-bg-hover text-txt-dim'
                          }`}
                        >
                          {PROVIDER_GLYPH[p]}
                        </span>
                        <span className="text-[13px] font-medium text-txt">
                          {PROVIDER_LABELS[p]}
                        </span>
                        <span className="text-[11px] leading-snug text-txt-faint">
                          {PROVIDER_DESC[p]}
                        </span>
                      </button>
                    )
                  })}
                </div>

                <SectionHeader
                  title={`Model · ${PROVIDER_LABELS[provider]}`}
                  desc="The specific model used for this provider."
                />
                <div className="mb-2 flex flex-col gap-2">
                  {MODELS[provider].map((m) => {
                    const active = model === m
                    return (
                      <button
                        key={m}
                        onClick={() => setModel(m)}
                        className={`flex items-center gap-3 rounded-lg border px-3.5 py-2.5 text-left transition-colors ${
                          active
                            ? 'border-accent bg-accent-subtle'
                            : 'border-border bg-bg-panel hover:border-txt-faint'
                        }`}
                      >
                        <span
                          className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                            active ? 'border-accent' : 'border-txt-faint'
                          }`}
                        >
                          {active && <span className="h-2 w-2 rounded-full bg-accent" />}
                        </span>
                        <span className="font-mono text-[13px] text-txt">{m}</span>
                      </button>
                    )
                  })}
                </div>
              </>
            )}

            {section === 'keys' && (
              <>
                <SectionHeader
                  title="API Keys"
                  desc="Bring your own keys. Stored encrypted via the OS keychain — never exposed to the renderer."
                />
                <div className="flex flex-col gap-4">
                  {PROVIDERS.map((p) => {
                    const status = settings?.providers[p]
                    const ours = OURS_PROVIDERS.includes(p)
                    const none = status?.keySource === 'none'
                    return (
                      <div
                        key={p}
                        className="rounded-xl border border-border bg-bg-panel p-4"
                      >
                        <div className="mb-2.5 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-bg-hover text-xs text-txt-dim">
                              {PROVIDER_GLYPH[p]}
                            </span>
                            <span className="text-[13px] font-medium text-txt">
                              {PROVIDER_LABELS[p]}
                            </span>
                          </div>
                          {status && (
                            <span
                              className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] ${
                                none
                                  ? 'bg-yellow-500/15 text-yellow-300'
                                  : 'bg-green-500/15 text-green-300'
                              }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  none ? 'bg-yellow-400' : 'bg-green-400'
                                }`}
                              />
                              {SOURCE_LABEL[status.keySource]}
                            </span>
                          )}
                        </div>
                        {status?.userFromEnv ? (
                          <div className="rounded-lg border border-border bg-bg px-3 py-2 text-xs text-txt-dim">
                            Using key from environment variable.
                          </div>
                        ) : (
                          <input
                            type="password"
                            value={keys[p]}
                            onChange={(e) => setKeys((k) => ({ ...k, [p]: e.target.value }))}
                            placeholder={
                              status?.hasUserKey
                                ? '•••••••• (leave blank to keep current)'
                                : ours
                                  ? 'Paste your key, or leave blank to use the built-in key'
                                  : 'Paste your key (required)'
                            }
                            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-[13px] text-txt outline-none transition-colors focus:border-accent focus:shadow-[0_0_0_1px_rgba(77,124,254,0.35)]"
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {section === 'github' && (
              <>
                <SectionHeader
                  title="GitHub"
                  desc="Connect a token to clone, push, pull and publish private repositories."
                />
                <div className="rounded-xl border border-border bg-bg-panel p-4">
                  <div className="mb-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-bg-hover text-xs text-txt-dim">
                        ◈
                      </span>
                      <span className="text-[13px] font-medium text-txt">Personal access token</span>
                    </div>
                    <span
                      className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] ${
                        settings?.hasGithubToken
                          ? 'bg-green-500/15 text-green-300'
                          : 'bg-yellow-500/15 text-yellow-300'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          settings?.hasGithubToken ? 'bg-green-400' : 'bg-yellow-400'
                        }`}
                      />
                      {settings?.hasGithubToken ? 'Connected' : 'Not connected'}
                    </span>
                  </div>
                  <input
                    type="password"
                    value={githubToken}
                    onChange={(e) => setGithubToken(e.target.value)}
                    placeholder={
                      settings?.hasGithubToken
                        ? '•••••••• (leave blank to keep current)'
                        : 'ghp_… or github_pat_…'
                    }
                    className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-[13px] text-txt outline-none transition-colors focus:border-accent focus:shadow-[0_0_0_1px_rgba(77,124,254,0.35)]"
                  />
                </div>
                <p className="mt-3 text-xs leading-relaxed text-txt-faint">
                  Create a token at{' '}
                  <span className="font-mono text-txt-dim">github.com/settings/tokens</span> with the{' '}
                  <span className="font-mono text-txt-dim">repo</span> scope. It&apos;s stored
                  encrypted via the OS keychain and sent only to github.com. The{' '}
                  <span className="font-mono text-txt-dim">GITHUB_TOKEN</span> environment variable is
                  used as a fallback.
                </p>
              </>
            )}

            {section === 'about' && (
              <>
                <SectionHeader title="About Acyrx" desc="An agentic desktop coding assistant." />
                <div className="flex items-center gap-3 rounded-xl border border-border bg-bg-panel p-4">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-hover text-lg text-white">
                    ✦
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-white">Acyrx</div>
                    <div className="text-xs text-txt-dim">
                      Version 0.1.0 · Gemini · Claude · OpenAI
                    </div>
                  </div>
                </div>
                <p className="mt-4 text-xs leading-relaxed text-txt-faint">
                  Keys are stored encrypted on disk via the OS keychain and never sent to the
                  renderer. Built-in keys (Gemini, Claude) are used only when you don&apos;t provide
                  your own.
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* sticky save bar */}
      <div className="flex h-14 shrink-0 items-center justify-end gap-3 border-t border-border bg-bg-alt px-6">
        {saved && <span className="text-xs text-green-400">✓ Saved</span>}
        <button
          onClick={close}
          className="rounded-lg border border-border px-4 py-1.5 text-xs text-txt-dim hover:bg-bg-hover hover:text-txt"
        >
          {dirty ? 'Cancel' : 'Close'}
        </button>
        <button
          onClick={save}
          disabled={saving || !dirty}
          className="rounded-lg bg-accent px-5 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-accent-hover disabled:opacity-30"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}

function SectionHeader({ title, desc }: { title: string; desc: string }): JSX.Element {
  return (
    <div className="mb-4">
      <h2 className="text-[13px] font-semibold text-txt">{title}</h2>
      <p className="mt-0.5 text-xs text-txt-faint">{desc}</p>
    </div>
  )
}
