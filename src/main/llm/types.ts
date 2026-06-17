import type { Provider } from '@shared/types'

/**
 * Provider-agnostic conversation + tool model. The agent loop speaks only this
 * language; each provider adapter converts to/from its own wire format.
 */

export interface ToolCall {
  id: string
  name: string
  args: Record<string, unknown>
}

export interface ToolResult {
  id: string
  name: string
  output: string
}

export type AgentMessage =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string; toolCalls: ToolCall[] }
  | { role: 'tool'; results: ToolResult[] }

export interface ToolSpec {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, { type: string; description: string }>
    required?: string[]
  }
}

export interface RunTurnParams {
  apiKey: string
  model: string
  system: string
  messages: AgentMessage[]
  tools: ToolSpec[]
  signal: AbortSignal
  onText: (delta: string) => void
}

export interface Usage {
  inputTokens: number
  outputTokens: number
}

export interface TurnResult {
  text: string
  toolCalls: ToolCall[]
  usage: Usage
}

export interface LLMProvider {
  readonly id: Provider
  runTurn(params: RunTurnParams): Promise<TurnResult>
}
