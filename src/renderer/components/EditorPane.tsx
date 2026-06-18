import { useEffect, useRef, useState } from 'react'
import Editor from '@monaco-editor/react'
import { useStore } from '../store'
import DiffView from './DiffView'
import logoUrl from '../assets/acyrx2.webp'

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

interface InlineState {
  start: number
  end: number
  fullText: string
}

export default function EditorPane(): JSX.Element {
  const { openFiles, activePath, setActive, closeFile, updateFileContent, reloadFile, pendingEdits } =
    useStore()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null)
  const [inline, setInline] = useState<InlineState | null>(null)
  const [instruction, setInstruction] = useState('')

  useEffect(() => {
    const off = window.codex.onFsChange((change) => {
      const st = useStore.getState()
      const open = st.openFiles.find((f) => f.path === change.path)
      if (!open) return
      if (change.event === 'unlink') st.closeFile(change.path)
      else if (change.event === 'change' && !open.dirty)
        void window.codex.readFile(change.path).then((res) => reloadFile(change.path, res.content))
    })
    return off
  }, [])

  const active = openFiles.find((f) => f.path === activePath)
  const pending = pendingEdits[0]

  const openInline = (): void => {
    const ed = editorRef.current
    if (!ed) return
    const model = ed.getModel()
    let sel = ed.getSelection()
    if (!model || !sel) return
    if (sel.isEmpty()) {
      const line = sel.startLineNumber
      sel = {
        getStartPosition: () => ({ lineNumber: line, column: 1 }),
        getEndPosition: () => ({ lineNumber: line, column: model.getLineMaxColumn(line) })
      }
    }
    const start = model.getOffsetAt(sel.getStartPosition())
    const end = model.getOffsetAt(sel.getEndPosition())
    setInstruction('')
    setInline({ start, end, fullText: model.getValue() })
  }

  const submitInline = async (): Promise<void> => {
    if (!inline || !active || !instruction.trim()) return
    const req = { path: active.path, ...inline, instruction: instruction.trim() }
    setInline(null)
    setInstruction('')
    await window.codex.inlineEdit(req)
  }

  return (
    <div className="flex h-full flex-col bg-bg">
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

      <div className="relative min-h-0 flex-1">
        {inline && (
          <div className="absolute left-1/2 top-2 z-10 w-[80%] -translate-x-1/2 rounded-md border border-accent bg-bg-alt p-2 shadow-lg">
            <div className="mb-1 text-[11px] opacity-60">Inline edit — describe the change (Enter to submit, Esc to cancel)</div>
            <input
              autoFocus
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void submitInline()
                } else if (e.key === 'Escape') {
                  setInline(null)
                }
              }}
              placeholder="e.g. add error handling and JSDoc"
              className="w-full rounded border border-border bg-bg p-1.5 text-[13px] outline-none focus:border-accent"
            />
          </div>
        )}
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
            onMount={(editor, monaco) => {
              editorRef.current = editor
              editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, openInline)
            }}
            options={{
              fontSize: 13,
              minimap: { enabled: true },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2
            }}
          />
        ) : (
          <div className="flex h-full select-none flex-col items-center justify-center gap-7 bg-bg">
            <img
              src={logoUrl}
              alt="Acyrx"
              draggable={false}
              width={128}
              height={128}
              className="h-32 w-32 opacity-90 [filter:drop-shadow(0_10px_30px_rgba(168,85,247,0.55))_drop-shadow(0_2px_8px_rgba(0,0,0,0.6))]"
            />
            <div className="text-center">
              <div className="text-base font-semibold tracking-tight text-txt-dim">Acyrx</div>
              <div className="mt-1 text-xs text-txt-faint">
                Select a file to start editing — press ⌘/Ctrl+K on a selection for inline edit
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
