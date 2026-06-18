import { useStore } from '../store'
import FileExplorer from './FileExplorer'
import GitPanel from './GitPanel'

export default function Sidebar(): JSX.Element {
  const { sidebarView, setSidebarView } = useStore()

  const tab = (active: boolean): string =>
    `rounded-md px-2.5 py-1 transition-colors ${
      active ? 'bg-bg-hover text-txt shadow-sm' : 'text-txt-dim hover:text-txt'
    }`

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-10 shrink-0 items-center gap-1 border-b border-border px-2 text-[11px] font-medium tracking-wide">
        <div className="flex items-center gap-1 rounded-lg bg-bg-panel p-0.5">
          <button className={tab(sidebarView === 'explorer')} onClick={() => setSidebarView('explorer')}>
            Explorer
          </button>
          <button className={tab(sidebarView === 'git')} onClick={() => setSidebarView('git')}>
            Source Control
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        {sidebarView === 'explorer' ? <FileExplorer /> : <GitPanel />}
      </div>
    </div>
  )
}
