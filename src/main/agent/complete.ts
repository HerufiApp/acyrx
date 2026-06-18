import { getProvider } from '../llm'
import { getActiveProvider, getActiveModel, getApiKey } from '../settings'
import { requireAuth } from '../auth'

/**
 * Single-shot, tool-less completion using the active provider. Used for
 * generating commit messages, explaining diffs, and inline (Cmd+K) edits.
 */
export async function completeOnce(system: string, user: string): Promise<string> {
  requireAuth()
  const provider = await getActiveProvider()
  const model = await getActiveModel()
  const apiKey = await getApiKey(provider)
  if (!apiKey) throw new Error('No API key configured for the active provider.')

  const res = await getProvider(provider).runTurn({
    apiKey,
    model,
    system,
    messages: [{ role: 'user', text: user }],
    tools: [],
    signal: new AbortController().signal,
    onText: () => {}
  })
  return res.text.trim()
}
