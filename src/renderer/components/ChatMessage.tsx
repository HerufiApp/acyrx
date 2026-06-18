import type { ChatItem } from '../store'

export default function ChatMessage({ item }: { item: ChatItem }): JSX.Element | null {
  if (item.kind === 'user') {
    return (
      <div className="rounded-xl border border-accent/30 bg-accent-subtle px-3 py-2">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-accent">You</div>
        <div className="chat-prose text-[13px] text-txt">{item.text}</div>
      </div>
    )
  }

  if (item.kind === 'agent') {
    return (
      <div className="px-1 py-1">
        <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-txt-faint">
          <span className="text-accent">✦</span> Acyrx
        </div>
        <div className="chat-prose text-[13px] text-txt">{item.text}</div>
      </div>
    )
  }

  if (item.kind === 'notice') {
    return (
      <div
        className={`rounded-lg px-3 py-2 text-[12px] ${
          item.tone === 'error'
            ? 'bg-red-500/10 text-red-300'
            : 'bg-bg-panel text-txt-dim'
        }`}
      >
        {item.text}
      </div>
    )
  }

  return null
}
