import { useEffect } from 'react'
import Editor from '@monaco-editor/react'
import { useStore } from '../store'
import DiffView from './DiffView'

const EXT_LANG: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  json: 'json',
  css: 'css',
  scss: 'scss',
  less: 'less',
  html: 'html',
  md: 'markdown',
  py: 'python',
  go: 'go',
  rs: 'rust',
  java: 'java',
  c: 'c',
  cpp: 'cpp',
  h: 'cpp',
  cs: 'csharp',
  rb: 'ruby',
  php: 'php',
  sh: 'shell',
  yml: 'yaml',
  yaml: 'yaml',
  toml: 'ini',
  sql: 'sql',
  xml: 'xml'
}

function langFor(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  return EXT_LANG[ext] ?? 'plaintext'
}

export default function EditorPane(): JSX.Element {
  const {
    openFiles,
    activePath,
    setActive,
    closeFile,
    updateFileContent,
    reloadFile,
    pendingEdits
  } = useStore()

  // Keep open, non-dirty files in sync with on-disk changes (e.g. agent edits).
  useEffect(() => {
    const off = window.codex.onFsChange((change) => {
      const st = useStore.getState()
      const open = st.openFiles.find((f) => f.path === change.path)
      if (!open) return
      if (change.event === 'unlink') {
        st.closeFile(change.path)
      } else if (change.event === 'change' && !open.dirty) {
        void window.codex.readFile(change.path).then((res) => reloadFile(change.path, res.content))
      }
    })
    return off
  }, [])

  const active = openFiles.find((f) => f.path === activePath)
  const pending = pendingEdits[0]

  return (
    <div className="flex h-full flex-col bg-bg">
      {/* tab bar */}
      <div className="flex h-8 shrink-0 items-center overflow-x-auto border-b border-border bg-bg-panel">
        {openFiles.map((f) => (
          <div
            key={f.path}
            onClick={() => setActive(f.path)}
            className={`flex h-full cursor-pointer items-center gap-2 border-r border-border px-3 text-[12px] ${
              f.path === activePath ? 'bg-bg text-white' : 'opacity-70 hover:opacity-100'
            }`}
            title={f.path}
          >
            <span>{f.path.split('/').pop()}</span>
            {f.dirty && <span className="text-yellow-300">●</span>}
            <span
              className="opacity-50 hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation()
                closeFile(f.path)
              }}
            >
              ✕
            </span>
          </div>
        ))}
      </div>

      {/* body */}
      <div className="min-h-0 flex-1">
        {pending ? (
          <DiffView edit={pending} />
        ) : active ? (
          <Editor
            height="100%"
            theme="vs-dark"
            path={active.path}
            language={langFor(active.path)}
            value={active.content}
            onChange={(v) => updateFileContent(active.path, v ?? '')}
            options={{
              fontSize: 13,
              minimap: { enabled: true },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm opacity-40">
            Select a file to start editing
          </div>
        )}
      </div>
    </div>
  )
}
