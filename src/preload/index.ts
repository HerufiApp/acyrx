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
  type GitCommitRequest,
  type GitBranches,
  type GitOpResult,
  type GitCloneRequest,
  type GitCloneResult,
  type CreateRepoRequest,
  type McpServerConfig,
  type SessionMeta,
  type SessionLoadResult,
  type CompleteCodeRequest,
  type AttachedImage,
  type AuthState,
  type AuthResult,
  type AuthCredentials,
  type TerminalCreateRequest,
  type TerminalInput,
  type TerminalResize,
  type PtyData,
  type PtyExit
} from '@shared/types'

function subscribe<T>(channel: string, cb: (payload: T) => void): () => void {
  const listener = (_e: IpcRendererEvent, payload: T): void => cb(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: CodexApi = {
  getAuth: (): Promise<AuthState> => ipcRenderer.invoke(IPC.authGet),
  authSignIn: (creds: AuthCredentials): Promise<AuthResult> =>
    ipcRenderer.invoke(IPC.authSignIn, creds),
  authSignUp: (creds: AuthCredentials): Promise<AuthResult> =>
    ipcRenderer.invoke(IPC.authSignUp, creds),
  authSignOut: (): Promise<AuthState> => ipcRenderer.invoke(IPC.authSignOut),
  onAuthChanged: (cb: (s: AuthState) => void) => subscribe(IPC.evtAuthChanged, cb),

  getSettings: (): Promise<Settings> => ipcRenderer.invoke(IPC.settingsGet),
  setProvider: (provider: Provider): Promise<Settings> =>
    ipcRenderer.invoke(IPC.settingsSetProvider, provider),
  setModel: (provider: Provider, model: string): Promise<Settings> =>
    ipcRenderer.invoke(IPC.settingsSetModel, { provider, model }),
  setUserKey: (provider: Provider, key: string): Promise<Settings> =>
    ipcRenderer.invoke(IPC.settingsSetUserKey, { provider, key }),
  setMcpServers: (servers: McpServerConfig[]): Promise<Settings> =>
    ipcRenderer.invoke(IPC.settingsSetMcpServers, servers),
  setTavilyKey: (key: string): Promise<Settings> =>
    ipcRenderer.invoke(IPC.settingsSetTavilyKey, key),
  setGithubToken: (token: string): Promise<Settings> =>
    ipcRenderer.invoke(IPC.settingsSetGithubToken, token),
  setAutocomplete: (enabled: boolean): Promise<Settings> =>
    ipcRenderer.invoke(IPC.settingsSetAutocomplete, enabled),
  mcpReconnect: (): Promise<Settings> => ipcRenderer.invoke(IPC.mcpReconnect),

  sessionsList: (): Promise<SessionMeta[]> => ipcRenderer.invoke(IPC.sessionsList),
  sessionNew: (): Promise<SessionLoadResult> => ipcRenderer.invoke(IPC.sessionNew),
  sessionLoad: (id: string): Promise<SessionLoadResult> =>
    ipcRenderer.invoke(IPC.sessionLoad, id),
  sessionRename: (id: string, name: string): Promise<SessionMeta[]> =>
    ipcRenderer.invoke(IPC.sessionRename, { id, name }),
  sessionDelete: (id: string): Promise<SessionMeta[]> =>
    ipcRenderer.invoke(IPC.sessionDelete, id),
  saveTranscript: (transcript: unknown[]): Promise<void> =>
    ipcRenderer.invoke(IPC.sessionSaveTranscript, transcript),

  openFolder: (): Promise<ProjectInfo | null> => ipcRenderer.invoke(IPC.dialogOpenFolder),
  getProject: (): Promise<ProjectInfo | null> => ipcRenderer.invoke(IPC.projectGet),
  readFile: (path: string): Promise<ReadFileResult> => ipcRenderer.invoke(IPC.fsReadFile, path),
  listDir: (path?: string): Promise<DirEntry[]> => ipcRenderer.invoke(IPC.fsListDir, path),
  listFiles: (): Promise<string[]> => ipcRenderer.invoke(IPC.fsListFiles),
  saveFile: (req: SaveFileRequest): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke(IPC.fsSaveFile, req),

  sendMessage: (message: string, images?: AttachedImage[]): Promise<void> =>
    ipcRenderer.invoke(IPC.agentSend, { message, images }),
  cancel: (): Promise<void> => ipcRenderer.invoke(IPC.agentCancel),
  resolveEdit: (req: ResolveEditRequest): Promise<void> =>
    ipcRenderer.invoke(IPC.agentResolveEdit, req),
  resolveCommand: (req: ResolveCommandRequest): Promise<void> =>
    ipcRenderer.invoke(IPC.agentResolveCommand, req),
  undoCheckpoint: (id: string): Promise<{ restored: number }> =>
    ipcRenderer.invoke(IPC.agentUndoCheckpoint, id),
  inlineEdit: (req: InlineEditRequest): Promise<void> =>
    ipcRenderer.invoke(IPC.agentInlineEdit, req),
  completeCode: (req: CompleteCodeRequest): Promise<string> =>
    ipcRenderer.invoke(IPC.agentCompleteCode, req),

  gitStatus: (): Promise<GitStatus> => ipcRenderer.invoke(IPC.gitStatus),
  gitDiff: (req: GitDiffRequest): Promise<string> => ipcRenderer.invoke(IPC.gitDiff, req),
  gitStage: (path: string): Promise<void> => ipcRenderer.invoke(IPC.gitStage, path),
  gitUnstage: (path: string): Promise<void> => ipcRenderer.invoke(IPC.gitUnstage, path),
  gitCommit: (req: GitCommitRequest): Promise<{ ok: boolean; output: string }> =>
    ipcRenderer.invoke(IPC.gitCommit, req),
  gitGenerateMessage: (): Promise<string> => ipcRenderer.invoke(IPC.gitGenerateMessage),
  gitExplain: (): Promise<string> => ipcRenderer.invoke(IPC.gitExplain),
  gitPush: (): Promise<GitOpResult> => ipcRenderer.invoke(IPC.gitPush),
  gitPull: (): Promise<GitOpResult> => ipcRenderer.invoke(IPC.gitPull),
  gitFetch: (): Promise<GitOpResult> => ipcRenderer.invoke(IPC.gitFetch),
  gitClone: (req: GitCloneRequest): Promise<GitCloneResult> =>
    ipcRenderer.invoke(IPC.gitClone, req),
  gitInit: (): Promise<GitOpResult> => ipcRenderer.invoke(IPC.gitInit),
  gitBranches: (): Promise<GitBranches> => ipcRenderer.invoke(IPC.gitBranches),
  gitCheckout: (branch: string): Promise<GitOpResult> =>
    ipcRenderer.invoke(IPC.gitCheckout, branch),
  gitCreateBranch: (name: string): Promise<GitOpResult> =>
    ipcRenderer.invoke(IPC.gitCreateBranch, name),
  gitSetRemote: (url: string): Promise<GitOpResult> => ipcRenderer.invoke(IPC.gitSetRemote, url),
  githubCreateRepo: (req: CreateRepoRequest): Promise<GitOpResult> =>
    ipcRenderer.invoke(IPC.githubCreateRepo, req),

  terminalCreate: (req: TerminalCreateRequest): Promise<void> =>
    ipcRenderer.invoke(IPC.terminalCreate, req),
  terminalInput: (input: TerminalInput): void => ipcRenderer.send(IPC.terminalInput, input),
  terminalResize: (resize: TerminalResize): void => ipcRenderer.send(IPC.terminalResize, resize),
  terminalKill: (id: string): void => ipcRenderer.send(IPC.terminalKill, id),

  onAgentEvent: (cb: (e: AgentEvent) => void) => subscribe(IPC.evtAgent, cb),
  onFsChange: (cb: (c: FsChange) => void) => subscribe(IPC.evtFsChange, cb),
  onTerminalData: (cb: (d: TerminalData) => void) => subscribe(IPC.evtTerminal, cb),
  onPtyData: (cb: (d: PtyData) => void) => subscribe(IPC.evtPtyData, cb),
  onPtyExit: (cb: (e: PtyExit) => void) => subscribe(IPC.evtPtyExit, cb),
  onProjectChanged: (cb: (p: ProjectInfo | null) => void) =>
    subscribe(IPC.evtProjectChanged, cb)
}

contextBridge.exposeInMainWorld('codex', api)
