import { create } from 'zustand'
import type { Settings, ProjectInfo, DirEntry, AgentEvent, AuthState } from '@shared/types'

/* ---------------- chat model ---------------- */

export type ChatItem =
  | { kind: 'user'; id: string; text: string }
  | { kind: 'agent'; id: string; text: string }
  | {
      kind: 'tool'
      id: string
      name: string
      args: Record<string, unknown>
      status: 'running' | 'ok' | 'error'
      summary?: string
    }
  | { kind: 'notice'; id: string; text: string; tone: 'error' | 'info' }

export interface EditorFile {
  path: string
  content: string
  original: string
  dirty: boolean
}

export interface PendingEdit {
  id: string
  tool: 'write_file' | 'edit_file'
  path: string
  oldContent: string
  newContent: string
}

export interface PendingCommand {
  id: string
  command: string
  reason: string
}

let counter = 0
const uid = (): string => `r${Date.now()}-${counter++}`

interface AppState {
  /* auth */
  auth: AuthState | null

  /* settings / project */
  settings: Settings | null
  project: ProjectInfo | null

  /* explorer (lazy): dir path -> children, plus expanded set */
  children: Record<string, DirEntry[]>
  expanded: Set<string>

  /* editor */
  openFiles: EditorFile[]
  activePath: string | null

  /* approvals */
  pendingEdits: PendingEdit[]
  pendingCommands: PendingCommand[]

  /* chat */
  messages: ChatItem[]
  currentAgentTextId: string | null
  agentRunning: boolean

  /* ui */
  sidebarVisible: boolean
  terminalVisible: boolean
  settingsOpen: boolean
  cloneOpen: boolean
  publishOpen: boolean
  sidebarView: 'explorer' | 'git'
  diffViewer: { title: string; diff: string } | null

  /* agent run extras */
  lastCheckpoint: { id: string; fileCount: number } | null
  usage: { inputTokens: number; outputTokens: number; costUsd: number }

  /* panel sizes (px) */
  sidebarWidth: number
  chatWidth: number
  terminalHeight: number

  /* actions */
  setAuth: (a: AuthState) => void
  setSettings: (s: Settings) => void
  setProject: (p: ProjectInfo | null) => void
  setChildren: (path: string, entries: DirEntry[]) => void
  toggleExpanded: (path: string, expanded: boolean) => void

  openFile: (file: EditorFile) => void
  closeFile: (path: string) => void
  setActive: (path: string | null) => void
  updateFileContent: (path: string, content: string) => void
  markSaved: (path: string) => void
  reloadFile: (path: string, content: string) => void

  addUserMessage: (text: string) => void
  applyAgentEvent: (e: AgentEvent) => void
  shiftPendingEdit: () => void
  shiftPendingCommand: () => void

  toggleSidebar: () => void
  toggleTerminal: (v?: boolean) => void
  setSettingsOpen: (v: boolean) => void
  setCloneOpen: (v: boolean) => void
  setPublishOpen: (v: boolean) => void
  setSidebarView: (v: 'explorer' | 'git') => void
  openDiffViewer: (title: string, diff: string) => void
  closeDiffViewer: () => void
  clearCheckpoint: () => void
  nudgeSidebarWidth: (delta: number) => void
  nudgeChatWidth: (delta: number) => void
  nudgeTerminalHeight: (delta: number) => void
}

const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v))

export const useStore = create<AppState>((set, get) => ({
  auth: null,
  settings: null,
  project: null,

  children: {},
  expanded: new Set<string>(),

  openFiles: [],
  activePath: null,

  pendingEdits: [],
  pendingCommands: [],

  messages: [],
  currentAgentTextId: null,
  agentRunning: false,

  sidebarVisible: true,
  terminalVisible: true,
  settingsOpen: false,
  cloneOpen: false,
  publishOpen: false,
  sidebarView: 'explorer',
  diffViewer: null,

  lastCheckpoint: null,
  usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 },

  sidebarWidth: 240,
  chatWidth: 384,
  terminalHeight: 224,

  setAuth: (a) => set({ auth: a }),
  setSettings: (s) => set({ settings: s }),
  setProject: (p) =>
    set({
      project: p,
      children: {},
      expanded: new Set<string>(),
      openFiles: [],
      activePath: null,
      messages: [],
      pendingEdits: [],
      pendingCommands: [],
      lastCheckpoint: null,
      usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 }
    }),

  setChildren: (path, entries) =>
    set((st) => ({ children: { ...st.children, [path]: entries } })),

  toggleExpanded: (path, expanded) =>
    set((st) => {
      const next = new Set(st.expanded)
      if (expanded) next.add(path)
      else next.delete(path)
      return { expanded: next }
    }),

  openFile: (file) =>
    set((st) => {
      const exists = st.openFiles.find((f) => f.path === file.path)
      const openFiles = exists
        ? st.openFiles.map((f) => (f.path === file.path ? file : f))
        : [...st.openFiles, file]
      return { openFiles, activePath: file.path }
    }),

  closeFile: (path) =>
    set((st) => {
      const openFiles = st.openFiles.filter((f) => f.path !== path)
      let activePath = st.activePath
      if (activePath === path) {
        activePath = openFiles.length ? openFiles[openFiles.length - 1].path : null
      }
      return { openFiles, activePath }
    }),

  setActive: (path) => set({ activePath: path }),

  updateFileContent: (path, content) =>
    set((st) => ({
      openFiles: st.openFiles.map((f) =>
        f.path === path ? { ...f, content, dirty: content !== f.original } : f
      )
    })),

  markSaved: (path) =>
    set((st) => ({
      openFiles: st.openFiles.map((f) =>
        f.path === path ? { ...f, original: f.content, dirty: false } : f
      )
    })),

  reloadFile: (path, content) =>
    set((st) => ({
      openFiles: st.openFiles.map((f) =>
        f.path === path ? { ...f, content, original: content, dirty: false } : f
      )
    })),

  addUserMessage: (text) =>
    set((st) => ({
      messages: [...st.messages, { kind: 'user', id: uid(), text }],
      currentAgentTextId: null
    })),

  applyAgentEvent: (e) => {
    const st = get()
    switch (e.type) {
      case 'turn-start':
        set({ agentRunning: true, currentAgentTextId: null })
        break

      case 'text-delta': {
        let id = st.currentAgentTextId
        if (!id) {
          id = uid()
          set({
            currentAgentTextId: id,
            messages: [...st.messages, { kind: 'agent', id, text: e.text }]
          })
        } else {
          set({
            messages: st.messages.map((m) =>
              m.id === id && m.kind === 'agent' ? { ...m, text: m.text + e.text } : m
            )
          })
        }
        break
      }

      case 'tool-call':
        set({
          currentAgentTextId: null,
          messages: [
            ...st.messages,
            { kind: 'tool', id: e.id, name: e.name, args: e.args, status: 'running' }
          ]
        })
        break

      case 'tool-result':
        set({
          messages: st.messages.map((m) =>
            m.kind === 'tool' && m.id === e.id
              ? { ...m, status: e.ok ? 'ok' : 'error', summary: e.summary }
              : m
          )
        })
        break

      case 'edit-proposed':
        set({
          pendingEdits: [
            ...st.pendingEdits,
            {
              id: e.id,
              tool: e.tool,
              path: e.path,
              oldContent: e.oldContent,
              newContent: e.newContent
            }
          ]
        })
        break

      case 'edit-resolved':
        set({ pendingEdits: st.pendingEdits.filter((p) => p.id !== e.id) })
        break

      case 'command-confirm':
        set({
          pendingCommands: [
            ...st.pendingCommands,
            { id: e.id, command: e.command, reason: e.reason }
          ]
        })
        break

      case 'command-resolved':
        set({ pendingCommands: st.pendingCommands.filter((p) => p.id !== e.id) })
        break

      case 'usage':
        set((s) => ({
          usage: {
            inputTokens: s.usage.inputTokens + e.inputTokens,
            outputTokens: s.usage.outputTokens + e.outputTokens,
            costUsd: s.usage.costUsd + e.costUsd
          }
        }))
        break

      case 'checkpoint':
        set({ lastCheckpoint: { id: e.id, fileCount: e.fileCount } })
        break

      case 'turn-done':
      case 'cancelled':
        set({ agentRunning: false, currentAgentTextId: null })
        if (e.type === 'cancelled') {
          set((s) => ({
            messages: [
              ...s.messages,
              { kind: 'notice', id: uid(), text: 'Cancelled.', tone: 'info' }
            ]
          }))
        }
        break

      case 'error':
        set((s) => ({
          agentRunning: false,
          messages: [
            ...s.messages,
            { kind: 'notice', id: uid(), text: e.message, tone: 'error' }
          ]
        }))
        break
    }
  },

  shiftPendingEdit: () => set((st) => ({ pendingEdits: st.pendingEdits.slice(1) })),
  shiftPendingCommand: () => set((st) => ({ pendingCommands: st.pendingCommands.slice(1) })),

  toggleSidebar: () => set((st) => ({ sidebarVisible: !st.sidebarVisible })),
  toggleTerminal: (v) => set((st) => ({ terminalVisible: v ?? !st.terminalVisible })),
  setSettingsOpen: (v) => set({ settingsOpen: v }),
  setCloneOpen: (v) => set({ cloneOpen: v }),
  setPublishOpen: (v) => set({ publishOpen: v }),
  setSidebarView: (v) => set({ sidebarView: v }),
  openDiffViewer: (title, diff) => set({ diffViewer: { title, diff } }),
  closeDiffViewer: () => set({ diffViewer: null }),
  clearCheckpoint: () => set({ lastCheckpoint: null }),
  nudgeSidebarWidth: (delta) =>
    set((s) => ({ sidebarWidth: clamp(s.sidebarWidth + delta, 140, 560) })),
  nudgeChatWidth: (delta) =>
    set((s) => ({ chatWidth: clamp(s.chatWidth + delta, 280, 720) })),
  nudgeTerminalHeight: (delta) =>
    set((s) => ({ terminalHeight: clamp(s.terminalHeight + delta, 80, 600) }))
}))
