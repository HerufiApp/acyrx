import {
  GoogleGenAI,
  Type,
  type Content,
  type Part,
  type FunctionDeclaration,
  type Schema
} from '@google/genai'
import { randomUUID } from 'crypto'
import type { LLMProvider, RunTurnParams, TurnResult, AgentMessage, ToolSpec } from './types'

let client: GoogleGenAI | null = null
let clientKey: string | null = null

function getClient(apiKey: string): GoogleGenAI {
  if (!client || clientKey !== apiKey) {
    client = new GoogleGenAI({ apiKey })
    clientKey = apiKey
  }
  return client
}

const TYPE_MAP: Record<string, Type> = {
  object: Type.OBJECT,
  string: Type.STRING,
  number: Type.NUMBER,
  integer: Type.INTEGER,
  boolean: Type.BOOLEAN,
  array: Type.ARRAY
}

function toDeclaration(spec: ToolSpec): FunctionDeclaration {
  const properties: Record<string, Schema> = {}
  for (const [key, prop] of Object.entries(spec.parameters.properties ?? {})) {
    properties[key] = { type: TYPE_MAP[prop.type ?? ''] ?? Type.STRING, description: prop.description }
  }
  return {
    name: spec.name,
    description: spec.description,
    parameters: {
      type: Type.OBJECT,
      properties,
      required: spec.parameters.required
    }
  }
}

function toContents(messages: AgentMessage[]): Content[] {
  return messages.map((m): Content => {
    if (m.role === 'user') return { role: 'user', parts: [{ text: m.text }] }
    if (m.role === 'assistant') {
      const parts: Part[] = []
      if (m.text) parts.push({ text: m.text })
      for (const tc of m.toolCalls) parts.push({ functionCall: { id: tc.id, name: tc.name, args: tc.args } })
      return { role: 'model', parts: parts.length ? parts : [{ text: '' }] }
    }
    return {
      role: 'user',
      parts: m.results.map((r) => ({
        functionResponse: { id: r.id, name: r.name, response: { result: r.output } }
      }))
    }
  })
}

export const geminiProvider: LLMProvider = {
  id: 'gemini',
  async runTurn(params: RunTurnParams): Promise<TurnResult> {
    const ai = getClient(params.apiKey)
    const stream = await ai.models.generateContentStream({
      model: params.model,
      contents: toContents(params.messages),
      config: {
        systemInstruction: params.system,
        tools: [{ functionDeclarations: params.tools.map(toDeclaration) }]
      }
    })

    let text = ''
    let inputTokens = 0
    let outputTokens = 0
    const toolCalls: TurnResult['toolCalls'] = []
    for await (const chunk of stream) {
      if (params.signal.aborted) break
      const delta = chunk.text
      if (delta) {
        text += delta
        params.onText(delta)
      }
      const calls = chunk.functionCalls
      if (calls) {
        for (const fc of calls) {
          toolCalls.push({
            id: fc.id ?? randomUUID(),
            name: fc.name ?? '',
            args: (fc.args ?? {}) as Record<string, unknown>
          })
        }
      }
      const usage = chunk.usageMetadata
      if (usage) {
        inputTokens = usage.promptTokenCount ?? inputTokens
        outputTokens = usage.candidatesTokenCount ?? outputTokens
      }
    }
    return { text, toolCalls, usage: { inputTokens, outputTokens } }
  }
}
