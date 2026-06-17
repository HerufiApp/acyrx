import { useStore } from '../store'
import FileExplorer from './FileExplorer'
import GitPanel from './GitPanel'

export default function Sidebar(): JSX.Element {
  const { sidebarView, setSidebarView } = useStore()

  const tab = (active: boolean): string =>
    `rounded px-2 py-0.5 ${active ? 'bg-bg-hover text-white' : 'opacity-60 hover:opacity-100'}`

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-border px-2 text-[11px] font-semibold uppercase tracking-wide">
        <button className={tab(sidebarView === 'explorer')} onClick={() => setSidebarView('explorer')}>
          Explorer
        </button>
        <button className={tab(sidebarView === 'git')} onClick={() => setSidebarView('git')}>
          Source Control
        </button>
      </div>
      <div className="min-h-0 flex-1">
        {sidebarView === 'explorer' ? <FileExplorer /> : <GitPanel />}
      </div>
    </div>
  )
}
