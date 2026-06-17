import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import ChatMessage from './ChatMessage'
import ToolCallCard from './ToolCallCard'

export default function ChatPanel(): JSX.Element {
  const {
    messages,
    agentRunning,
    addUserMessage,
    pendingCommands,
    project,
    usage,
    lastCheckpoint,
    clearCheckpoint
  } = useStore()
  const [input, setInput] = useState('')
  const [files, setFiles] = useState<string[]>([])
  const [mention, setMention] = useState<{ query: string; index: number } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages, pendingCommands])

  useEffect(() => {
    if (project) void window.codex.listFiles().then(setFiles)
    else setFiles([])
  }, [project?.root])

  const matches = mention
    ? files.filter((f) => f.toLowerCase().includes(mention.query.toLowerCase())).slice(0, 8)
    : []

  const updateMention = (value: string, caret: number): void => {
    const before = value.slice(0, caret)
    const m = before.match(/(?:^|\s)@([^\s]*)$/)
    setMention(m ? { query: m[1], index: 0 } : null)
  }

  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    setInput(e.target.value)
    updateMention(e.target.value, e.target.selectionStart ?? e.target.value.length)
  }

  const acceptMention = (path: string): void => {
    const ta = taRef.current
    const caret = ta?.selectionStart ?? input.length
    const before = input.slice(0, caret)
    const at = before.lastIndexOf('@')
    const next = before.slice(0, at) + '@' + path + ' ' + input.slice(caret)
    setInput(next)
    setMention(null)
    requestAnimationFrame(() => ta?.focus())
  }

  const send = (): void => {
    const text = input.trim()
    if (!text) return
    addUserMessage(text)
    void window.codex.sendMessage(text)
    setInput('')
    setMention(null)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (mention && matches.length) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setMention({ ...mention, index: (mention.index + 1) % matches.length })
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setMention({ ...mention, index: (mention.index - 1 + matches.length) % matches.length })
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        acceptMention(matches[mention.index])
        return
      }
      if (e.key === 'Escape') {
        setMention(null)
        return
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const undo = async (): Promise<void> => {
    if (!lastCheckpoint) return
    await window.codex.undoCheckpoint(lastCheckpoint.id)
    clearCheckpoint()
  }

  const cost = usage.costUsd > 0 ? `≈$${usage.costUsd.toFixed(4)}` : ''

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-border px-3 text-[11px]">
        <span className="font-semibold uppercase tracking-wide opacity-60">Chat</span>
        {(usage.inputTokens > 0 || usage.outputTokens > 0) && (
          <span className="opacity-50" title="Session token usage (estimated cost)">
            ▲{usage.inputTokens} ▼{usage.outputTokens} {cost}
          </span>
        )}
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-auto p-3">
        {messages.length === 0 && (
          <div className="text-xs opacity-40">
            Ask the agent to build, edit, or explain code. Type <code>@</code> to attach files or
            folders to the context.
          </div>
        )}
        {messages.map((m) =>
          m.kind === 'tool' ? <ToolCallCard key={m.id} item={m} /> : <ChatMessage key={m.id} item={m} />
        )}
      </div>

      {lastCheckpoint && !agentRunning && (
        <div className="flex items-center justify-between border-t border-border bg-white/5 px-3 py-1.5 text-xs">
          <span className="opacity-70">Last run changed {lastCheckpoint.fileCount} file(s)</span>
          <button onClick={undo} className="rounded bg-red-800 px-2 py-0.5 text-white hover:bg-red-700">
            Undo run
          </button>
        </div>
      )}

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

      <div className="relative shrink-0 border-t border-border p-2">
        {mention && matches.length > 0 && (
          <div className="absolute bottom-full left-2 right-2 mb-1 max-h-56 overflow-auto rounded border border-border bg-bg-alt shadow-lg">
            {matches.map((f, i) => (
              <div
                key={f}
                onMouseDown={(e) => {
                  e.preventDefault()
                  acceptMention(f)
                }}
                className={`cursor-pointer truncate px-2 py-1 font-mono text-[12px] ${
                  i === mention.index ? 'bg-accent text-white' : 'hover:bg-bg-hover'
                }`}
              >
                {f}
              </div>
            ))}
          </div>
        )}
        <textarea
          ref={taRef}
          value={input}
          onChange={onChange}
          onKeyDown={onKeyDown}
          rows={3}
          placeholder={
            project
              ? 'Ask Acyrx… (Enter to send, Shift+Enter newline, @ to attach files)'
              : 'Open a folder first…'
          }
          className="w-full resize-none rounded border border-border bg-bg p-2 text-[13px] text-[#d4d4d4] outline-none focus:border-accent"
        />
        <div className="mt-1 flex items-center justify-between">
          <span className="text-[11px] opacity-40">{agentRunning ? 'Agent is working…' : ''}</span>
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
