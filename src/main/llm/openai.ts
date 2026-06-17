import OpenAI from 'openai'
import type { LLMProvider, RunTurnParams, TurnResult, AgentMessage, ToolSpec } from './types'

type ChatCompletionMessageParam = OpenAI.ChatCompletionMessageParam
type ChatCompletionTool = OpenAI.ChatCompletionTool

let client: OpenAI | null = null
let clientKey: string | null = null

function getClient(apiKey: string): OpenAI {
  if (!client || clientKey !== apiKey) {
    client = new OpenAI({ apiKey })
    clientKey = apiKey
  }
  return client
}

function toTool(spec: ToolSpec): ChatCompletionTool {
  return {
    type: 'function',
    function: {
      name: spec.name,
      description: spec.description,
      parameters: spec.parameters as Record<string, unknown>
    }
  }
}

function toMessages(system: string, messages: AgentMessage[]): ChatCompletionMessageParam[] {
  const out: ChatCompletionMessageParam[] = [{ role: 'system', content: system }]
  for (const m of messages) {
    if (m.role === 'user') {
      out.push({ role: 'user', content: m.text })
    } else if (m.role === 'assistant') {
      out.push({
        role: 'assistant',
        content: m.text || null,
        tool_calls: m.toolCalls.length
          ? m.toolCalls.map((tc) => ({
              id: tc.id,
              type: 'function' as const,
              function: { name: tc.name, arguments: JSON.stringify(tc.args) }
            }))
          : undefined
      })
    } else {
      for (const r of m.results) {
        out.push({ role: 'tool', tool_call_id: r.id, content: r.output })
      }
    }
  }
  return out
}

export const openaiProvider: LLMProvider = {
  id: 'openai',
  async runTurn(params: RunTurnParams): Promise<TurnResult> {
    const openai = getClient(params.apiKey)
    const stream = await openai.chat.completions.create(
      {
        model: params.model,
        messages: toMessages(params.system, params.messages),
        tools: params.tools.map(toTool),
        stream: true
      },
      { signal: params.signal }
    )

    let text = ''
    const acc: Record<number, { id: string; name: string; args: string }> = {}

    for await (const chunk of stream) {
      if (params.signal.aborted) break
      const delta = chunk.choices[0]?.delta
      if (!delta) continue
      if (delta.content) {
        text += delta.content
        params.onText(delta.content)
      }
      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const i = tc.index
          acc[i] ??= { id: '', name: '', args: '' }
          if (tc.id) acc[i].id = tc.id
          if (tc.function?.name) acc[i].name += tc.function.name
          if (tc.function?.arguments) acc[i].args += tc.function.arguments
        }
      }
    }

    const toolCalls: TurnResult['toolCalls'] = Object.values(acc)
      .filter((a) => a.name)
      .map((a) => ({
        id: a.id,
        name: a.name,
        args: a.args ? safeParse(a.args) : {}
      }))

    return { text, toolCalls }
  }
}

function safeParse(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s) as Record<string, unknown>
  } catch {
    return {}
  }
}
