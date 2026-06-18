import { useStore } from '../store'
import { PROVIDER_LABELS } from '@shared/types'

export default function Toolbar(): JSX.Element {
  const { project, settings, auth, setAuth, setProject, toggleSidebar, toggleTerminal, setSettingsOpen, setCloneOpen } =
    useStore()

  const openFolder = async (): Promise<void> => {
    const info = await window.codex.openFolder()
    if (info) setProject(info)
  }

  const signOut = async (): Promise<void> => {
    setAuth(await window.codex.authSignOut())
  }

  const current = settings ? settings.providers[settings.provider] : undefined

  const iconBtn =
    'flex h-6 w-6 items-center justify-center rounded-md text-txt-dim hover:bg-bg-hover hover:text-txt'

  return (
    <div className="flex h-10 shrink-0 items-center gap-3 border-b border-border bg-bg-alt px-3 text-xs">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-[3px] bg-gradient-to-br from-accent to-accent-hover" />
        <span className="font-semibold tracking-tight text-white">Acyrx</span>
      </div>

      <span className="text-txt-faint">/</span>
      <button
        onClick={openFolder}
        className="rounded-md px-2 py-1 text-txt-dim hover:bg-bg-hover hover:text-txt"
        title="Open a folder"
      >
        {project ? (
          <span className="truncate text-txt">{project.name}</span>
        ) : (
          'Open Folder…'
        )}
      </button>
      <button
        onClick={() => setCloneOpen(true)}
        className="rounded-md px-2 py-1 text-txt-dim hover:bg-bg-hover hover:text-txt"
        title="Clone a Git repository"
      >
        Clone…
      </button>

      <div className="ml-auto flex items-center gap-2">
        {settings && (
          <span className="rounded-md border border-border bg-bg-panel px-2 py-1 text-[11px] text-txt-dim">
            {PROVIDER_LABELS[settings.provider]} · {settings.model}
          </span>
        )}
        {current?.keySource === 'none' && (
          <span className="rounded-md bg-yellow-500/15 px-2 py-1 text-[11px] text-yellow-300">
            No API key
          </span>
        )}
        {auth?.user && (
          <>
            <span
              className="max-w-[160px] truncate rounded-md border border-border bg-bg-panel px-2 py-1 text-[11px] text-txt-dim"
              title={auth.user.email ?? 'Signed in'}
            >
              {auth.user.email ?? 'Signed in'}
            </span>
            <button
              onClick={signOut}
              className="rounded-md px-2 py-1 text-[11px] text-txt-dim hover:bg-bg-hover hover:text-txt"
              title="Sign out"
            >
              Sign out
            </button>
          </>
        )}
        <div className="mx-1 h-4 w-px bg-border" />
        <button className={iconBtn} title="Toggle sidebar (⌘/Ctrl+B)" onClick={toggleSidebar}>
          ▥
        </button>
        <button className={iconBtn} title="Toggle terminal (⌘/Ctrl+J)" onClick={() => toggleTerminal()}>
          ▤
        </button>
        <button className={iconBtn} title="Settings (⌘/Ctrl+,)" onClick={() => setSettingsOpen(true)}>
          ⚙
        </button>
      </div>
    </div>
  )
}
