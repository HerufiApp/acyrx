/**
 * Shared type contract between main, preload, and renderer.
 * This is the single source of truth for the IPC surface.
 */

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

export type Provider = 'gemini' | 'anthropic' | 'openai'

export const PROVIDER_LABELS: Record<Provider, string> = {
  gemini: 'Google Gemini',
  anthropic: 'Anthropic Claude',
  openai: 'OpenAI'
}

export const MODELS: Record<Provider, string[]> = {
  gemini: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
  anthropic: ['claude-opus-4-8', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1']
}

export const DEFAULT_MODELS: Record<Provider, string> = {
  gemini: 'gemini-2.5-pro',
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-4o'
}

/** Providers for which the app can ship a built-in ("ours") key. OpenAI is user-only. */
export const OURS_PROVIDERS: Provider[] = ['gemini', 'anthropic']

export type KeySource = 'user' | 'ours' | 'none'

export interface ProviderStatus {
  /** A user-supplied key (pasted, or via env var) is configured. */
  hasUserKey: boolean
  /** The user key comes from an environment variable. */
  userFromEnv: boolean
  /** A built-in ("ours") key is available for this provider. */
  oursAvailable: boolean
  /** Which key will actually be used: the pasted/own key wins, else ours. */
  keySource: KeySource
}

export interface Settings {
  /** Active provider used by the agent. */
  provider: Provider
  /** Model for the active provider. */
  model: string
  /** Selected model per provider. */
  models: Record<Provider, string>
  /** Key status per provider (key values never leave main). */
  providers: Record<Provider, ProviderStatus>
}

/* ------------------------------------------------------------------ */
/* Filesystem                                                          */
/* ------------------------------------------------------------------ */

export interface DirEntry {
  name: string
  /** Path relative to the project root, using forward slashes. */
  path: string
  type: 'file' | 'directory'
  size?: number
}

export interface ProjectInfo {
  root: string
  name: string
}

export type FsChangeEvent = 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir'

export interface FsChange {
  event: FsChangeEvent
  /** Path relative to the project root. */
  path: string
}

/* ------------------------------------------------------------------ */
/* Tools                                                               */
/* ------------------------------------------------------------------ */

export type ToolName =
  | 'read_file'
  | 'write_file'
  | 'edit_file'
  | 'list_dir'
  | 'run_command'
  | 'search'
  | 'git_status'
  | 'git_diff'
  | 'git_commit'

export interface ToolCallArgs {
  read_file: { path: string }
  write_file: { path: string; content: string }
  edit_file: { path: string; old_str: string; new_str: string }
  list_dir: { path?: string }
  run_command: { command: string }
  search: { pattern: string }
  git_status: Record<string, never>
  git_diff: { staged?: boolean; path?: string }
  git_commit: { message: string; all?: boolean }
}

/* ------------------------------------------------------------------ */
/* Git                                                                 */
/* ------------------------------------------------------------------ */

export interface GitFileChange {
  /** Path relative to the project root. */
  path: string
  /** Short status code, e.g. "M", "A", "D", "R", "??". */
  status: string
  staged: boolean
}

export interface GitStatus {
  isRepo: boolean
  branch: string
  changes: GitFileChange[]
}

/* ------------------------------------------------------------------ */
/* Agent streaming events (main -> renderer)                           */
/* ------------------------------------------------------------------ */

export type AgentEvent =
  | { type: 'turn-start' }
  | { type: 'text-delta'; text: string }
  | { type: 'tool-call'; id: string; name: ToolName; args: Record<string, unknown> }
  | { type: 'tool-result'; id: string; ok: boolean; summary: string }
  | {
      type: 'edit-proposed'
      id: string
      tool: 'write_file' | 'edit_file'
      path: string
      oldContent: string
      newContent: string
    }
  | { type: 'edit-resolved'; id: string; accepted: boolean }
  | { type: 'command-confirm'; id: string; command: string; reason: string }
  | { type: 'command-resolved'; id: string; accepted: boolean }
  | {
      type: 'usage'
      provider: Provider
      model: string
      inputTokens: number
      outputTokens: number
      costUsd: number
    }
  | { type: 'checkpoint'; id: string; fileCount: number }
  | { type: 'turn-done' }
  | { type: 'cancelled' }
  | { type: 'error'; message: string }

/* ------------------------------------------------------------------ */
/* Terminal stream (main -> renderer)                                  */
/* ------------------------------------------------------------------ */

export interface TerminalData {
  /** Raw chunk of output (may contain ANSI codes / newlines). */
  data: string
  stream: 'stdout' | 'stderr' | 'system'
}

/* ------------------------------------------------------------------ */
/* IPC channel names                                                   */
/* ------------------------------------------------------------------ */

export const IPC = {
  // invoke (renderer -> main, request/response)
  settingsGet: 'settings:get',
  settingsSetProvider: 'settings:setProvider',
  settingsSetModel: 'settings:setModel',
  settingsSetUserKey: 'settings:setUserKey',
  dialogOpenFolder: 'dialog:openFolder',
  projectGet: 'project:get',
  fsReadFile: 'fs:readFile',
  fsListDir: 'fs:listDir',
  fsListFiles: 'fs:listFiles',
  fsSaveFile: 'fs:saveFile',
  agentSend: 'agent:send',
  agentCancel: 'agent:cancel',
  agentResolveEdit: 'agent:resolveEdit',
  agentResolveCommand: 'agent:resolveCommand',
  agentUndoCheckpoint: 'agent:undoCheckpoint',
  agentInlineEdit: 'agent:inlineEdit',
  gitStatus: 'git:status',
  gitDiff: 'git:diff',
  gitStage: 'git:stage',
  gitUnstage: 'git:unstage',
  gitCommit: 'git:commit',
  gitGenerateMessage: 'git:generateMessage',
  gitExplain: 'git:explain',
  // send (main -> renderer, streaming)
  evtAgent: 'evt:agent',
  evtFsChange: 'evt:fsChange',
  evtTerminal: 'evt:terminal',
  evtProjectChanged: 'evt:projectChanged'
} as const

/* ------------------------------------------------------------------ */
/* Request / response payloads                                         */
/* ------------------------------------------------------------------ */

export interface ReadFileResult {
  path: string
  content: string
}

export interface SaveFileRequest {
  path: string
  content: string
}

export interface SendMessageRequest {
  message: string
}

export interface SetModelRequest {
  provider: Provider
  model: string
}

export interface SetUserKeyRequest {
  provider: Provider
  key: string
}

export interface ResolveEditRequest {
  id: string
  accept: boolean
}

export interface ResolveCommandRequest {
  id: string
  accept: boolean
}

export interface InlineEditRequest {
  path: string
  /** Full current contents of the file (editor buffer). */
  fullText: string
  /** Character offsets of the selection within fullText. */
  start: number
  end: number
  instruction: string
}

export interface GitDiffRequest {
  path?: string
  staged?: boolean
}

export interface GitCommitRequest {
  message: string
  all?: boolean
}

/* ------------------------------------------------------------------ */
/* The API exposed on window.codex by the preload bridge               */
/* ------------------------------------------------------------------ */

export interface CodexApi {
  // settings
  getSettings(): Promise<Settings>
  setProvider(provider: Provider): Promise<Settings>
  setModel(provider: Provider, model: string): Promise<Settings>
  setUserKey(provider: Provider, key: string): Promise<Settings>
  // project / fs
  openFolder(): Promise<ProjectInfo | null>
  getProject(): Promise<ProjectInfo | null>
  readFile(path: string): Promise<ReadFileResult>
  listDir(path?: string): Promise<DirEntry[]>
  listFiles(): Promise<string[]>
  saveFile(req: SaveFileRequest): Promise<{ ok: boolean }>
  // agent
  sendMessage(message: string): Promise<void>
  cancel(): Promise<void>
  resolveEdit(req: ResolveEditRequest): Promise<void>
  resolveCommand(req: ResolveCommandRequest): Promise<void>
  undoCheckpoint(id: string): Promise<{ restored: number }>
  inlineEdit(req: InlineEditRequest): Promise<void>
  // git
  gitStatus(): Promise<GitStatus>
  gitDiff(req: GitDiffRequest): Promise<string>
  gitStage(path: string): Promise<void>
  gitUnstage(path: string): Promise<void>
  gitCommit(req: GitCommitRequest): Promise<{ ok: boolean; output: string }>
  gitGenerateMessage(): Promise<string>
  gitExplain(): Promise<string>
  // subscriptions (return an unsubscribe fn)
  onAgentEvent(cb: (e: AgentEvent) => void): () => void
  onFsChange(cb: (c: FsChange) => void): () => void
  onTerminalData(cb: (d: TerminalData) => void): () => void
  onProjectChanged(cb: (p: ProjectInfo | null) => void): () => void
}
