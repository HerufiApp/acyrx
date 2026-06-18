import { useEffect } from 'react'
import { useStore } from './store'
import Toolbar from './components/Toolbar'
import Sidebar from './components/Sidebar'
import EditorPane from './components/EditorPane'
import ChatPanel from './components/ChatPanel'
import TerminalPanel from './components/TerminalPanel'
import SettingsPage from './components/SettingsPage'
import AuthGate from './components/AuthGate'
import CloneModal from './components/CloneModal'
import PublishModal from './components/PublishModal'
import DiffViewerModal from './components/DiffViewerModal'
import ResizeHandle from './components/ResizeHandle'

export default function App(): JSX.Element {
  const {
    sidebarVisible,
    terminalVisible,
    settingsOpen,
    cloneOpen,
    publishOpen,
    auth,
    setAuth,
    setSettings,
    setProject,
    applyAgentEvent,
    toggleSidebar,
    toggleTerminal,
    setSettingsOpen,
    sidebarWidth,
    chatWidth,
    terminalHeight,
    nudgeSidebarWidth,
    nudgeChatWidth,
    nudgeTerminalHeight
  } = useStore()

  // Bootstrap auth + settings + project, subscribe to agent events.
  useEffect(() => {
    void window.codex.getAuth().then(setAuth)
    void window.codex.getSettings().then(setSettings)
    void window.codex.getProject().then(setProject)
    const offAgent = window.codex.onAgentEvent(applyAgentEvent)
    const offProject = window.codex.onProjectChanged(setProject)
    const offAuth = window.codex.onAuthChanged(setAuth)
    return () => {
      offAgent()
      offProject()
      offAuth()
    }
  }, [])

  // Global keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key === 'b') {
        e.preventDefault()
        toggleSidebar()
      } else if (mod && e.key === 'j') {
        e.preventDefault()
        toggleTerminal()
      } else if (mod && e.key === ',') {
        e.preventDefault()
        setSettingsOpen(true)
      } else if (mod && e.key === 's') {
        e.preventDefault()
        void saveActive()
      } else if (mod && e.key === 'Enter' && useStore.getState().pendingEdits.length > 0) {
        e.preventDefault()
        const edit = useStore.getState().pendingEdits[0]
        void window.codex.resolveEdit({ id: edit.id, accept: true })
      } else if (e.key === 'Escape' && useStore.getState().settingsOpen) {
        e.preventDefault()
        setSettingsOpen(false)
      } else if (e.key === 'Escape' && useStore.getState().pendingEdits.length > 0) {
        e.preventDefault()
        const edit = useStore.getState().pendingEdits[0]
        void window.codex.resolveEdit({ id: edit.id, accept: false })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="flex h-full w-full flex-col bg-bg text-[#d4d4d4]">
      <Toolbar />
      <div className="relative flex min-h-0 flex-1">
        {settingsOpen && <SettingsPage />}
        {sidebarVisible && (
          <>
            <div className="shrink-0 bg-bg-alt" style={{ width: sidebarWidth }}>
              <Sidebar />
            </div>
            <ResizeHandle orientation="vertical" onResize={nudgeSidebarWidth} />
          </>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1">
            <EditorPane />
          </div>
          {terminalVisible && (
            <>
              <ResizeHandle
                orientation="horizontal"
                onResize={(d) => nudgeTerminalHeight(-d)}
              />
              <div className="shrink-0" style={{ height: terminalHeight }}>
                <TerminalPanel />
              </div>
            </>
          )}
        </div>
        <ResizeHandle orientation="vertical" onResize={(d) => nudgeChatWidth(-d)} />
        <div className="flex shrink-0 flex-col bg-bg-alt" style={{ width: chatWidth }}>
          <ChatPanel />
        </div>
      </div>
      {cloneOpen && <CloneModal />}
      {publishOpen && <PublishModal />}
      <DiffViewerModal />
      {auth?.configured && !auth.user && <AuthGate />}
    </div>
  )
}

async function saveActive(): Promise<void> {
  const { openFiles, activePath, markSaved } = useStore.getState()
  if (!activePath) return
  const file = openFiles.find((f) => f.path === activePath)
  if (!file || !file.dirty) return
  await window.codex.saveFile({ path: file.path, content: file.content })
  markSaved(file.path)
}
