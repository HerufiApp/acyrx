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
    <div className="rounded-md border border-border bg-bg-panel text-[12px]">
      <div
        className="flex cursor-pointer items-center gap-2 px-2 py-1"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="opacity-50">{open ? '▾' : '▸'}</span>
        <span className="font-mono text-accent">{item.name}</span>
        <span className="truncate font-mono opacity-60">{shortArg(item)}</span>
        <span
          className={`ml-auto ${
            item.status === 'error'
              ? 'text-red-400'
              : item.status === 'ok'
                ? 'text-green-400'
                : 'opacity-50'
          }`}
        >
          {STATUS_ICON[item.status]}
        </span>
      </div>
      {open && (
        <div className="space-y-2 border-t border-border p-2">
          <div>
            <div className="mb-1 text-[10px] uppercase opacity-40">Arguments</div>
            <pre className="overflow-auto rounded bg-black/30 p-2 font-mono text-[11px]">
              {JSON.stringify(item.args, null, 2)}
            </pre>
          </div>
          {item.summary && (
            <div>
              <div className="mb-1 text-[10px] uppercase opacity-40">Result</div>
              <pre className="overflow-auto whitespace-pre-wrap rounded bg-black/30 p-2 font-mono text-[11px]">
                {item.summary}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
