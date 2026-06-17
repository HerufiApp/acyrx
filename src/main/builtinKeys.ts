import type { Provider } from '@shared/types'

/**
 * Built-in ("ours") API keys. These ship BLANK. To let users run without their
 * own key, provide a value via environment variable when launching/packaging:
 *   ACYRX_GEMINI_KEY=...   ACYRX_ANTHROPIC_KEY=...
 * (or hard-code a string below). OpenAI is intentionally omitted — it is
 * user-supplied only.
 */
const BUILTIN: Partial<Record<Provider, string>> = {
  gemini: process.env.ACYRX_GEMINI_KEY ?? '',
  anthropic: process.env.ACYRX_ANTHROPIC_KEY ?? ''
}

export function oursKey(provider: Provider): string | null {
  const k = BUILTIN[provider]
  return k && k.trim() ? k.trim() : null
}
