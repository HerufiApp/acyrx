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
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-3 text-[11px]">
        <span className="flex items-center gap-2 font-medium tracking-wide text-txt-dim">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          Chat
        </span>
        {(usage.inputTokens > 0 || usage.outputTokens > 0) && (
          <span className="font-mono text-txt-faint" title="Session token usage (estimated cost)">
            ▲{usage.inputTokens} ▼{usage.outputTokens} {cost}
          </span>
        )}
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-auto p-3">
        {messages.length === 0 && (
          <div className="mt-6 flex flex-col items-center gap-2 text-center text-txt-faint">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-bg-panel text-base">
              ✦
            </span>
            <p className="max-w-[220px] text-xs leading-relaxed">
              Ask Acyrx to build, edit, or explain code. Type <code className="text-accent">@</code>{' '}
              to attach files or folders to the context.
            </p>
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

      <div className="relative shrink-0 p-3">
        {mention && matches.length > 0 && (
          <div className="absolute bottom-full left-3 right-3 mb-2 max-h-56 overflow-auto rounded-lg border border-border bg-bg-elevated p-1 shadow-pop">
            {matches.map((f, i) => (
              <div
                key={f}
                onMouseDown={(e) => {
                  e.preventDefault()
                  acceptMention(f)
                }}
                className={`cursor-pointer truncate rounded-md px-2 py-1 font-mono text-[12px] ${
                  i === mention.index ? 'bg-accent text-white' : 'text-txt-dim hover:bg-bg-hover'
                }`}
              >
                {f}
              </div>
            ))}
          </div>
        )}
        <div className="focus-accent rounded-xl border border-border bg-bg-panel p-2 transition-shadow">
          <textarea
            ref={taRef}
            value={input}
            onChange={onChange}
            onKeyDown={onKeyDown}
            rows={3}
            placeholder={
              project
                ? 'Ask Acyrx anything…  @ to attach files'
                : 'Open a folder first…'
            }
            className="w-full resize-none bg-transparent px-1 text-[13px] leading-relaxed text-txt outline-none placeholder:text-txt-faint"
          />
          <div className="mt-1 flex items-center justify-between px-1">
            <span className="flex items-center gap-1.5 text-[11px] text-txt-faint">
              {agentRunning && (
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
              )}
              {agentRunning ? 'Agent is working…' : 'Enter to send · Shift+Enter for newline'}
            </span>
            {agentRunning ? (
              <button
                onClick={() => window.codex.cancel()}
                className="rounded-lg bg-red-500/90 px-3 py-1 text-xs font-medium text-white hover:bg-red-500"
              >
                Stop
              </button>
            ) : (
              <button
                onClick={send}
                disabled={!input.trim()}
                className="rounded-lg bg-accent px-4 py-1 text-xs font-medium text-white shadow-sm transition-colors hover:bg-accent-hover disabled:opacity-30"
              >
                Send
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
