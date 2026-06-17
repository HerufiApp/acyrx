import { randomUUID } from 'crypto'
import { getProvider, toolSpecs, type AgentMessage, type ToolResult } from '../llm'
import { runTool, type ToolContext } from '../tools'
import { emitAgent, getProject } from '../projectState'
import { getApiKey, getActiveProvider, getActiveModel } from '../settings'
import { rejectAllApprovals } from './approvals'
import { PROVIDER_LABELS, type ToolName } from '@shared/types'

const MAX_ITERATIONS = 50

let history: AgentMessage[] = []
let running = false
let abortController: AbortController | null = null

/** Clear conversation history (called when a new project is opened). */
export function resetConversation(): void {
  history = []
}

export function cancelAgent(): void {
  abortController?.abort()
  rejectAllApprovals()
}

function buildSystemInstruction(): string {
  const proj = getProject()
  const root = proj ? `"${proj.name}" at ${proj.root}` : '(no folder open)'
  return [
    'You are Acyrx, an expert AI software engineer embedded in a desktop IDE.',
    `The user has opened the project ${root}.`,
    '',
    'You can use tools to read, search, write, and edit files, and to run shell commands.',
    'Work autonomously: break the task into steps and keep calling tools until it is fully done.',
    '',
    'Guidelines:',
    '- Before editing a file, read it first so your edits match its exact current contents.',
    '- Prefer edit_file for small targeted changes; use write_file for new files or full rewrites.',
    '- All file edits and destructive commands require the user to approve them; if the user',
    '  rejects a change, do not blindly retry — adapt or ask.',
    '- Use relative paths from the project root. Never touch files outside the project.',
    '- Keep chat responses concise; explain what you did and why, not step-by-step narration.',
    '- When the task is complete, give a short summary and stop calling tools.'
  ].join('\n')
}

export async function sendMessage(message: string): Promise<void> {
  if (running) {
    emitAgent({ type: 'error', message: 'The agent is already working. Cancel it first.' })
    return
  }
  if (!getProject()) {
    emitAgent({ type: 'error', message: 'Open a project folder before chatting with the agent.' })
    return
  }

  const provider = await getActiveProvider()
  const model = await getActiveModel()
  const apiKey = await getApiKey(provider)
  if (!apiKey) {
    emitAgent({
      type: 'error',
      message: `No API key available for ${PROVIDER_LABELS[provider]}. Open Settings (Cmd/Ctrl+,) to add one.`
    })
    return
  }

  running = true
  abortController = new AbortController()
  const signal = abortController.signal
  const ctx: ToolContext = { signal }
  const impl = getProvider(provider)

  history.push({ role: 'user', text: message })
  emitAgent({ type: 'turn-start' })

  try {
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      if (signal.aborted) {
        emitAgent({ type: 'cancelled' })
        return
      }

      const result = await impl.runTurn({
        apiKey,
        model,
        system: buildSystemInstruction(),
        messages: history,
        tools: toolSpecs,
        signal,
        onText: (delta) => emitAgent({ type: 'text-delta', text: delta })
      })

      history.push({ role: 'assistant', text: result.text, toolCalls: result.toolCalls })

      if (signal.aborted) {
        emitAgent({ type: 'cancelled' })
        return
      }

      if (result.toolCalls.length === 0) {
        emitAgent({ type: 'turn-done' })
        return
      }

      const results: ToolResult[] = []
      for (const tc of result.toolCalls) {
        if (signal.aborted) break
        const name = tc.name as ToolName
        emitAgent({ type: 'tool-call', id: tc.id, name, args: tc.args })

        let ok = true
        let output: string
        try {
          output = await runTool(name, tc.args, ctx)
          if (output.startsWith('The user REJECTED') || output.startsWith('The user declined')) {
            ok = false
          }
        } catch (e) {
          ok = false
          output = `Error: ${(e as Error).message}`
        }

        emitAgent({ type: 'tool-result', id: tc.id, ok, summary: summarize(output) })
        results.push({ id: tc.id, name: tc.name, output })
      }

      history.push({ role: 'tool', results })

      if (i === MAX_ITERATIONS - 1) {
        emitAgent({
          type: 'error',
          message: `Stopped after ${MAX_ITERATIONS} tool iterations to avoid an infinite loop.`
        })
        emitAgent({ type: 'turn-done' })
      }
    }
  } catch (e) {
    emitAgent({ type: 'error', message: (e as Error).message })
  } finally {
    running = false
    abortController = null
  }
}

function summarize(s: string): string {
  const first = s.split('\n')[0]
  return first.length > 140 ? first.slice(0, 140) + '…' : first
}
