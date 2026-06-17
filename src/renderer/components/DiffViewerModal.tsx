import { useStore } from '../store'

function lineClass(l: string): string {
  if (l.startsWith('+') && !l.startsWith('+++')) return 'text-green-400'
  if (l.startsWith('-') && !l.startsWith('---')) return 'text-red-400'
  if (l.startsWith('@@')) return 'text-cyan-400'
  if (l.startsWith('diff ') || l.startsWith('index ') || l.startsWith('+++') || l.startsWith('---'))
    return 'opacity-50'
  if (l.startsWith('#')) return 'text-yellow-300'
  return ''
}

export default function DiffViewerModal(): JSX.Element | null {
  const { diffViewer, closeDiffViewer } = useStore()
  if (!diffViewer) return null
  const lines = diffViewer.diff.split('\n')

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={closeDiffViewer}
    >
      <div
        className="flex h-[80vh] w-[80vw] flex-col rounded-lg border border-border bg-bg-alt shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex h-9 shrink-0 items-center justify-between border-b border-border px-3 text-xs">
          <span className="truncate font-semibold text-white">{diffViewer.title}</span>
          <button className="opacity-70 hover:opacity-100" onClick={closeDiffViewer}>
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-3 font-mono text-[12px] leading-relaxed">
          {lines.map((l, i) => (
            <div key={i} className={lineClass(l)} style={{ whiteSpace: 'pre-wrap' }}>
              {l === '' ? ' ' : l}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
