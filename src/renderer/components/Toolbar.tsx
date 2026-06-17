import { useStore } from '../store'
import { PROVIDER_LABELS } from '@shared/types'

export default function Toolbar(): JSX.Element {
  const { project, settings, setProject, toggleSidebar, toggleTerminal, setSettingsOpen } =
    useStore()

  const openFolder = async (): Promise<void> => {
    const info = await window.codex.openFolder()
    if (info) setProject(info)
  }

  const current = settings ? settings.providers[settings.provider] : undefined

  return (
    <div className="flex h-9 shrink-0 items-center gap-3 border-b border-border bg-bg-panel px-3 text-xs">
      <span className="font-semibold tracking-wide text-white">Acyrx</span>
      <button
        onClick={openFolder}
        className="rounded bg-accent px-2 py-0.5 text-white hover:bg-accent-hover"
      >
        Open Folder
      </button>
      <span className="truncate opacity-70">{project ? project.name : 'No folder open'}</span>

      <div className="ml-auto flex items-center gap-3">
        <span className="opacity-50">
          {settings ? `${PROVIDER_LABELS[settings.provider]} · ${settings.model}` : ''}
        </span>
        {current?.keySource === 'none' && (
          <span className="rounded bg-yellow-900/60 px-1.5 py-0.5 text-yellow-200">
            No API key
          </span>
        )}
        <button className="opacity-70 hover:opacity-100" title="Toggle sidebar (⌘/Ctrl+B)" onClick={toggleSidebar}>
          ▥
        </button>
        <button className="opacity-70 hover:opacity-100" title="Toggle terminal (⌘/Ctrl+J)" onClick={() => toggleTerminal()}>
          ▤
        </button>
        <button className="opacity-70 hover:opacity-100" title="Settings (⌘/Ctrl+,)" onClick={() => setSettingsOpen(true)}>
          ⚙
        </button>
      </div>
    </div>
  )
}
