import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import ChatMessage from './ChatMessage'
import ToolCallCard from './ToolCallCard'

export default function ChatPanel(): JSX.Element {
  const { messages, agentRunning, addUserMessage, pendingCommands, project } = useStore()
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages, pendingCommands])

  const send = (): void => {
    const text = input.trim()
    if (!text) return
    addUserMessage(text)
    void window.codex.sendMessage(text)
    setInput('')
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-9 shrink-0 items-center border-b border-border px-3 text-[11px] font-semibold uppercase tracking-wide opacity-60">
        Chat
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-auto p-3">
        {messages.length === 0 && (
          <div className="text-xs opacity-40">
            Ask the agent to build, edit, or explain code. It can read, write, search files and run
            commands.
          </div>
        )}
        {messages.map((m) =>
          m.kind === 'tool' ? (
            <ToolCallCard key={m.id} item={m} />
          ) : (
            <ChatMessage key={m.id} item={m} />
          )
        )}
      </div>

      {/* destructive command confirmations */}
      {pendingCommands.map((c) => (
        <div key={c.id} className="border-t border-border bg-[#3a1f1f] p-3 text-xs">
          <div className="mb-1 font-semibold text-red-200">Confirm command</div>
          <div className="mb-2 opacity-70">{c.reason}</div>
          <code className="mb-2 block whitespace-pre-wrap rounded bg-black/40 p-2 font-mono">
            {c.command}
          </code>
          <div className="flex gap-2">
            <button
              onClick={() => window.codex.resolveCommand({ id: c.id, accept: true })}
              className="rounded bg-green-700 px-3 py-1 text-white hover:bg-green-600"
            >
              Run
            </button>
            <button
              onClick={() => window.codex.resolveCommand({ id: c.id, accept: false })}
              className="rounded bg-red-800 px-3 py-1 text-white hover:bg-red-700"
            >
              Decline
            </button>
          </div>
        </div>
      ))}

      <div className="shrink-0 border-t border-border p-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          rows={3}
          placeholder={
            project ? 'Ask Acyrx to do something… (Enter to send, Shift+Enter for newline)' : 'Open a folder first…'
          }
          className="w-full resize-none rounded border border-border bg-bg p-2 text-[13px] text-[#d4d4d4] outline-none focus:border-accent"
        />
        <div className="mt-1 flex items-center justify-between">
          <span className="text-[11px] opacity-40">
            {agentRunning ? 'Agent is working…' : ''}
          </span>
          {agentRunning ? (
            <button
              onClick={() => window.codex.cancel()}
              className="rounded bg-red-800 px-3 py-1 text-xs text-white hover:bg-red-700"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={send}
              disabled={!input.trim()}
              className="rounded bg-accent px-4 py-1 text-xs text-white hover:bg-accent-hover disabled:opacity-40"
            >
              Send
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
