import { useState } from 'react'
import type { ChatItem } from '../store'

type ToolItem = Extract<ChatItem, { kind: 'tool' }>

function shortArg(item: ToolItem): string {
  const a = item.args
  if (typeof a.path === 'string') return a.path
  if (typeof a.command === 'string') return a.command
  if (typeof a.pattern === 'string') return a.pattern
  return ''
}

const STATUS_ICON: Record<ToolItem['status'], string> = {
  running: '…',
  ok: '✓',
  error: '✕'
}

export default function ToolCallCard({ item }: { item: ToolItem }): JSX.Element {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-lg border border-border bg-bg-panel text-[12px]">
      <div
        className="flex cursor-pointer items-center gap-2 px-2.5 py-1.5"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="text-txt-faint">{open ? '▾' : '▸'}</span>
        <span className="font-mono font-medium text-accent">{item.name}</span>
        <span className="truncate font-mono text-txt-dim">{shortArg(item)}</span>
        <span
          className={`ml-auto flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
            item.status === 'error'
              ? 'bg-red-500/15 text-red-400'
              : item.status === 'ok'
                ? 'bg-green-500/15 text-green-400'
                : 'text-txt-faint'
          }`}
        >
          {STATUS_ICON[item.status]}
        </span>
      </div>
      {open && (
        <div className="space-y-2 border-t border-border p-2.5">
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-wide text-txt-faint">Arguments</div>
            <pre className="overflow-auto rounded-md bg-black/30 p-2 font-mono text-[11px]">
              {JSON.stringify(item.args, null, 2)}
            </pre>
          </div>
          {item.summary && (
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wide text-txt-faint">Result</div>
              <pre className="overflow-auto whitespace-pre-wrap rounded-md bg-black/30 p-2 font-mono text-[11px]">
                {item.summary}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
