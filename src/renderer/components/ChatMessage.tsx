import type { ChatItem } from '../store'

export default function ChatMessage({ item }: { item: ChatItem }): JSX.Element | null {
  if (item.kind === 'user') {
    return (
      <div className="rounded-md bg-accent/20 p-2">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide opacity-50">You</div>
        <div className="chat-prose text-[13px]">{item.text}</div>
      </div>
    )
  }

  if (item.kind === 'agent') {
    return (
      <div className="rounded-md bg-bg-panel p-2">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide opacity-50">
          Acyrx
        </div>
        <div className="chat-prose text-[13px]">{item.text}</div>
      </div>
    )
  }

  if (item.kind === 'notice') {
    return (
      <div
        className={`rounded-md p-2 text-[12px] ${
          item.tone === 'error' ? 'bg-red-900/40 text-red-200' : 'bg-white/5 opacity-70'
        }`}
      >
        {item.text}
      </div>
    )
  }

  return null
}
