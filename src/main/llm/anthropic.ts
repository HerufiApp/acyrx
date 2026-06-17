import Anthropic from '@anthropic-ai/sdk'
import type { LLMProvider, RunTurnParams, TurnResult, AgentMessage, ToolSpec } from './types'

type MessageParam = Anthropic.MessageParam
type Tool = Anthropic.Tool
type ContentBlockParam = Anthropic.ContentBlockParam

let client: Anthropic | null = null
let clientKey: string | null = null

function getClient(apiKey: string): Anthropic {
  if (!client || clientKey !== apiKey) {
    client = new Anthropic({ apiKey })
    clientKey = apiKey
  }
  return client
}

function toTool(spec: ToolSpec): Tool {
  return {
    name: spec.name,
    description: spec.description,
    input_schema: {
      type: 'object',
      properties: spec.parameters.properties,
      required: spec.parameters.required
    }
  }
}

function toMessages(messages: AgentMessage[]): MessageParam[] {
  return messages.map((m): MessageParam => {
    if (m.role === 'user') return { role: 'user', content: m.text }
    if (m.role === 'assistant') {
      const content: ContentBlockParam[] = []
      if (m.text) content.push({ type: 'text', text: m.text })
      for (const tc of m.toolCalls) {
        content.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.args })
      }
      return { role: 'assistant', content: content.length ? content : [{ type: 'text', text: '…' }] }
    }
    return {
      role: 'user',
      content: m.results.map((r) => ({
        type: 'tool_result' as const,
        tool_use_id: r.id,
        content: r.output
      }))
    }
  })
}

export const anthropicProvider: LLMProvider = {
  id: 'anthropic',
  async runTurn(params: RunTurnParams): Promise<TurnResult> {
    const anthropic = getClient(params.apiKey)
    const stream = anthropic.messages.stream({
      model: params.model,
      max_tokens: 8192,
      system: params.system,
      messages: toMessages(params.messages),
      tools: params.tools.map(toTool)
    })

    const onAbort = (): void => stream.abort()
    params.signal.addEventListener('abort', onAbort, { once: true })
    stream.on('text', (delta) => params.onText(delta))

    try {
      const final = await stream.finalMessage()
      let text = ''
      const toolCalls: TurnResult['toolCalls'] = []
      for (const block of final.content) {
        if (block.type === 'text') text += block.text
        else if (block.type === 'tool_use') {
          toolCalls.push({
            id: block.id,
            name: block.name,
            args: (block.input ?? {}) as Record<string, unknown>
          })
        }
      }
      return {
        text,
        toolCalls,
        usage: {
          inputTokens: final.usage.input_tokens ?? 0,
          outputTokens: final.usage.output_tokens ?? 0
        }
      }
    } catch (e) {
      if (params.signal.aborted) return { text: '', toolCalls: [], usage: { inputTokens: 0, outputTokens: 0 } }
      throw e
    } finally {
      params.signal.removeEventListener('abort', onAbort)
    }
  }
}
