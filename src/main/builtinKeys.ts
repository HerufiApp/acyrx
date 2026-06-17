import type { Provider } from "@shared/types";

/**
 * Built-in ("ours") API keys. These ship BLANK. To let users run without their
 * own key, provide a value via environment variable when launching/packaging:
 *   ACYRX_GEMINI_KEY=...
 *   ACYRX_ANTHROPIC_KEY=...
 * (or hard-code a string below). OpenAI is intentionally omitted — it is
 * user-supplied only.
 */
const BUILTIN_ENV: Partial<Record<Provider, string>> = {
  gemini: "ACYRX_GEMINI_KEY",
  anthropic: "ACYRX_ANTHROPIC_KEY",
};

export function oursKey(provider: Provider): string | null {
  const envVar = BUILTIN_ENV[provider];
  // Read lazily so a key loaded from .env at startup is picked up.
  const k = envVar ? process.env[envVar] : undefined;
  return k && k.trim() ? k.trim() : null;
}
