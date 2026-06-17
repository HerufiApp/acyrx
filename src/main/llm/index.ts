import type { Provider } from '@shared/types'
import type { LLMProvider } from './types'
import { geminiProvider } from './gemini'
import { anthropicProvider } from './anthropic'
import { openaiProvider } from './openai'

const providers: Record<Provider, LLMProvider> = {
  gemini: geminiProvider,
  anthropic: anthropicProvider,
  openai: openaiProvider
}

export function getProvider(id: Provider): LLMProvider {
  return providers[id]
}

export { toolSpecs } from './toolSpecs'
export type { AgentMessage, ToolCall, ToolResult } from './types'
