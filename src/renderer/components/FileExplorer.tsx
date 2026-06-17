import { useEffect } from 'react'
import { useStore } from '../store'
import type { DirEntry } from '@shared/types'

const ROOT = ''

export default function FileExplorer(): JSX.Element {
  const { project, children, setChildren, setProject } = useStore()

  const openFolder = async (): Promise<void> => {
    const info = await window.codex.openFolder()
    if (info) setProject(info)
  }

  const loadDir = async (path: string): Promise<void> => {
    const entries = await window.codex.listDir(path || undefined)
    setChildren(path, entries)
  }

  // Load root when a project opens; refresh on filesystem changes.
  useEffect(() => {
    if (project) void loadDir(ROOT)
  }, [project?.root])

  useEffect(() => {
    const off = window.codex.onFsChange((change) => {
      const slash = change.path.lastIndexOf('/')
      const parent = slash === -1 ? ROOT : change.path.slice(0, slash)
      // Refresh the parent dir if it is currently loaded.
      if (parent in useStore.getState().children || parent === ROOT) {
        void loadDir(parent)
      }
    })
    return off
  }, [])

  if (!project) {
    return (
      <div className="flex flex-col gap-3 p-3 text-xs opacity-80">
        <span className="opacity-60">No folder open.</span>
        <button
          onClick={openFolder}
          className="rounded bg-accent px-3 py-1.5 text-white hover:bg-accent-hover"
        >
          Open Folder
        </button>
      </div>
    )
  }

  const roots = children[ROOT] ?? []

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-7 items-center px-3 text-[11px] font-semibold uppercase tracking-wide opacity-60">
        Explorer
      </div>
      <div className="min-h-0 flex-1 overflow-auto pb-2">
        {roots.map((entry) => (
          <TreeNode key={entry.path} entry={entry} depth={0} loadDir={loadDir} />
        ))}
      </div>
    </div>
  )
}

function TreeNode({
  entry,
  depth,
  loadDir
}: {
  entry: DirEntry
  depth: number
  loadDir: (p: string) => Promise<void>
}): JSX.Element {
  const { expanded, toggleExpanded, children, openFile, activePath } = useStore()
  const isOpen = expanded.has(entry.path)
  const isActive = activePath === entry.path

  const onClick = async (): Promise<void> => {
    if (entry.type === 'directory') {
      const next = !isOpen
      toggleExpanded(entry.path, next)
      if (next && !(entry.path in children)) await loadDir(entry.path)
    } else {
      const res = await window.codex.readFile(entry.path)
      openFile({ path: entry.path, content: res.content, original: res.content, dirty: false })
    }
  }

  const kids = children[entry.path] ?? []

  return (
    <div>
      <div
        onClick={onClick}
        className={`flex cursor-pointer items-center gap-1 py-0.5 pr-2 text-[13px] hover:bg-bg-hover ${
          isActive ? 'bg-bg-hover' : ''
        }`}
        style={{ paddingLeft: 8 + depth * 12 }}
        title={entry.path}
      >
        <span className="w-3 text-center opacity-60">
          {entry.type === 'directory' ? (isOpen ? '▾' : '▸') : ''}
        </span>
        <span className="opacity-80">{entry.type === 'directory' ? '📁' : '📄'}</span>
        <span className="truncate">{entry.name}</span>
      </div>
      {entry.type === 'directory' &&
        isOpen &&
        kids.map((child) => (
          <TreeNode key={child.path} entry={child} depth={depth + 1} loadDir={loadDir} />
        ))}
    </div>
  )
}
