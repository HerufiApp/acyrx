import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import {
  IPC,
  type CodexApi,
  type AgentEvent,
  type FsChange,
  type TerminalData,
  type ProjectInfo,
  type ReadFileResult,
  type SaveFileRequest,
  type Settings,
  type DirEntry,
  type Provider,
  type ResolveEditRequest,
  type ResolveCommandRequest,
  type InlineEditRequest,
  type GitStatus,
  type GitDiffRequest,
  type GitCommitRequest
} from '@shared/types'

function subscribe<T>(channel: string, cb: (payload: T) => void): () => void {
  const listener = (_e: IpcRendererEvent, payload: T): void => cb(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: CodexApi = {
  getSettings: (): Promise<Settings> => ipcRenderer.invoke(IPC.settingsGet),
  setProvider: (provider: Provider): Promise<Settings> =>
    ipcRenderer.invoke(IPC.settingsSetProvider, provider),
  setModel: (provider: Provider, model: string): Promise<Settings> =>
    ipcRenderer.invoke(IPC.settingsSetModel, { provider, model }),
  setUserKey: (provider: Provider, key: string): Promise<Settings> =>
    ipcRenderer.invoke(IPC.settingsSetUserKey, { provider, key }),

  openFolder: (): Promise<ProjectInfo | null> => ipcRenderer.invoke(IPC.dialogOpenFolder),
  getProject: (): Promise<ProjectInfo | null> => ipcRenderer.invoke(IPC.projectGet),
  readFile: (path: string): Promise<ReadFileResult> => ipcRenderer.invoke(IPC.fsReadFile, path),
  listDir: (path?: string): Promise<DirEntry[]> => ipcRenderer.invoke(IPC.fsListDir, path),
  listFiles: (): Promise<string[]> => ipcRenderer.invoke(IPC.fsListFiles),
  saveFile: (req: SaveFileRequest): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke(IPC.fsSaveFile, req),

  sendMessage: (message: string): Promise<void> =>
    ipcRenderer.invoke(IPC.agentSend, { message }),
  cancel: (): Promise<void> => ipcRenderer.invoke(IPC.agentCancel),
  resolveEdit: (req: ResolveEditRequest): Promise<void> =>
    ipcRenderer.invoke(IPC.agentResolveEdit, req),
  resolveCommand: (req: ResolveCommandRequest): Promise<void> =>
    ipcRenderer.invoke(IPC.agentResolveCommand, req),
  undoCheckpoint: (id: string): Promise<{ restored: number }> =>
    ipcRenderer.invoke(IPC.agentUndoCheckpoint, id),
  inlineEdit: (req: InlineEditRequest): Promise<void> =>
    ipcRenderer.invoke(IPC.agentInlineEdit, req),

  gitStatus: (): Promise<GitStatus> => ipcRenderer.invoke(IPC.gitStatus),
  gitDiff: (req: GitDiffRequest): Promise<string> => ipcRenderer.invoke(IPC.gitDiff, req),
  gitStage: (path: string): Promise<void> => ipcRenderer.invoke(IPC.gitStage, path),
  gitUnstage: (path: string): Promise<void> => ipcRenderer.invoke(IPC.gitUnstage, path),
  gitCommit: (req: GitCommitRequest): Promise<{ ok: boolean; output: string }> =>
    ipcRenderer.invoke(IPC.gitCommit, req),
  gitGenerateMessage: (): Promise<string> => ipcRenderer.invoke(IPC.gitGenerateMessage),
  gitExplain: (): Promise<string> => ipcRenderer.invoke(IPC.gitExplain),

  onAgentEvent: (cb: (e: AgentEvent) => void) => subscribe(IPC.evtAgent, cb),
  onFsChange: (cb: (c: FsChange) => void) => subscribe(IPC.evtFsChange, cb),
  onTerminalData: (cb: (d: TerminalData) => void) => subscribe(IPC.evtTerminal, cb),
  onProjectChanged: (cb: (p: ProjectInfo | null) => void) =>
    subscribe(IPC.evtProjectChanged, cb)
}

contextBridge.exposeInMainWorld('codex', api)
