import { DiffEditor } from '@monaco-editor/react'
import type { PendingEdit } from '../store'
import { useStore } from '../store'

export default function DiffView({ edit }: { edit: PendingEdit }): JSX.Element {
  const { openFile } = useStore()

  const resolve = async (accept: boolean): Promise<void> => {
    await window.codex.resolveEdit({ id: edit.id, accept })
    if (accept) {
      // Optimistically show the accepted result in a tab.
      openFile({
        path: edit.path,
        content: edit.newContent,
        original: edit.newContent,
        dirty: false
      })
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border bg-[#332b00] px-3 text-xs">
        <span className="font-semibold text-yellow-200">
          Agent proposes {edit.tool === 'write_file' ? 'writing' : 'editing'}
        </span>
        <span className="truncate opacity-80">{edit.path}</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => resolve(true)}
            className="rounded bg-green-700 px-3 py-1 text-white hover:bg-green-600"
            title="Accept (⌘/Ctrl+Enter)"
          >
            Accept
          </button>
          <button
            onClick={() => resolve(false)}
            className="rounded bg-red-800 px-3 py-1 text-white hover:bg-red-700"
            title="Reject (Esc)"
          >
            Reject
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <DiffEditor
          height="100%"
          theme="vs-dark"
          original={edit.oldContent}
          modified={edit.newContent}
          options={{
            readOnly: true,
            renderSideBySide: true,
            fontSize: 13,
            minimap: { enabled: false },
            automaticLayout: true,
            scrollBeyondLastLine: false
          }}
        />
      </div>
    </div>
  )
}
