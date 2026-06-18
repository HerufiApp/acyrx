import { useState } from 'react'
import { useStore } from '../store'

/**
 * Full-screen sign-in gate shown when Supabase auth is configured and no user
 * is signed in. The AI features are also enforced in the main process, so this
 * is the front door rather than the only lock.
 */
export default function AuthGate(): JSX.Element {
  const { auth, setAuth } = useStore()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const configured = auth?.configured ?? false

  const submit = async (): Promise<void> => {
    if (!email.trim() || !password) return
    setBusy(true)
    setError('')
    setNotice('')
    const creds = { email: email.trim(), password }
    try {
      const res =
        mode === 'signin'
          ? await window.codex.authSignIn(creds)
          : await window.codex.authSignUp(creds)
      if (res.ok && res.state) {
        setAuth(res.state)
      } else if (mode === 'signup' && res.error?.toLowerCase().includes('confirm')) {
        // Sign-up that needs email confirmation reports a non-error message.
        setNotice(res.error)
      } else {
        setError(res.error ?? 'Authentication failed.')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Authentication failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-bg">
      <div className="w-[400px] rounded-2xl border border-border bg-bg-alt p-7 shadow-pop">
        <div className="mb-5 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-hover text-lg text-white">
            ✦
          </span>
          <div>
            <h1 className="text-sm font-semibold text-white">
              {mode === 'signin' ? 'Sign in to Acyrx' : 'Create your account'}
            </h1>
            <p className="text-xs text-txt-faint">Authentication is required to use the AI.</p>
          </div>
        </div>

        {!configured ? (
          <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs leading-relaxed text-yellow-200">
            Supabase isn&apos;t configured. Set{' '}
            <span className="font-mono">SUPABASE_URL</span> and{' '}
            <span className="font-mono">SUPABASE_ANON_KEY</span> in your{' '}
            <span className="font-mono">.env</span>, then restart the app.
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2.5">
              <input
                autoFocus
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void submit()}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-[13px] text-txt outline-none transition-colors focus:border-accent focus:shadow-[0_0_0_1px_rgba(77,124,254,0.35)]"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void submit()}
                placeholder="Password"
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-[13px] text-txt outline-none transition-colors focus:border-accent focus:shadow-[0_0_0_1px_rgba(77,124,254,0.35)]"
              />
            </div>

            {error && (
              <div className="mt-3 rounded-lg bg-red-500/10 p-2.5 text-[11px] text-red-300">
                {error}
              </div>
            )}
            {notice && (
              <div className="mt-3 rounded-lg bg-green-500/10 p-2.5 text-[11px] text-green-300">
                {notice}
              </div>
            )}

            <button
              onClick={submit}
              disabled={busy || !email.trim() || !password}
              className="mt-4 w-full rounded-lg bg-accent px-5 py-2 text-xs font-medium text-white shadow-sm transition-colors hover:bg-accent-hover disabled:opacity-30"
            >
              {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Sign up'}
            </button>

            <button
              onClick={() => {
                setMode((m) => (m === 'signin' ? 'signup' : 'signin'))
                setError('')
                setNotice('')
              }}
              className="mt-3 w-full text-center text-[11px] text-txt-dim hover:text-txt"
            >
              {mode === 'signin'
                ? "Don't have an account? Sign up"
                : 'Already have an account? Sign in'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
