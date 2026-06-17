/**
 * Rough USD pricing per 1M tokens [input, output]. Estimates only — adjust as
 * provider pricing changes. Unknown models cost 0 (shown as ≈$0.00).
 */
const PRICES: Record<string, [number, number]> = {
  'gemini-2.5-pro': [1.25, 10],
  'gemini-2.5-flash': [0.3, 2.5],
  'gemini-2.0-flash': [0.1, 0.4],
  'claude-opus-4-8': [5, 25],
  'claude-sonnet-4-6': [3, 15],
  'claude-haiku-4-5-20251001': [1, 5],
  'gpt-4o': [2.5, 10],
  'gpt-4o-mini': [0.15, 0.6],
  'gpt-4.1': [2, 8]
}

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICES[model]
  if (!p) return 0
  return (inputTokens / 1_000_000) * p[0] + (outputTokens / 1_000_000) * p[1]
}
