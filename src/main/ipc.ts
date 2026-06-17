import { ipcMain, dialog, BrowserWindow } from 'electron'
import { promises as fs } from 'fs'
import { basename, join } from 'path'
import {
  IPC,
  type DirEntry,
  type ProjectInfo,
  type ReadFileResult,
  type SaveFileRequest,
  type SendMessageRequest,
  type ResolveEditRequest,
  type ResolveCommandRequest,
  type SetModelRequest,
  type SetUserKeyRequest,
  type Provider,
  type GitStatus,
  type GitDiffRequest,
  type GitCommitRequest,
  type InlineEditRequest
} from '@shared/types'
import { getSettings, setProvider, setModel, setUserKey } from './settings'
import { getProject, setProject, getProjectRoot, emitProjectChanged } from './projectState'
import { resolveInProject, toRelative } from './tools/paths'
import { startWatcher } from './watcher'
import { sendMessage, cancelAgent, resetConversation } from './agent/loop'
import { resolveApproval } from './agent/approvals'
import { undoCheckpoint } from './checkpoint'
import { proposeEdit } from './edits'
import { completeOnce } from './agent/complete'
import * as git from './git'

const EXPLORER_IGNORE = new Set(['.git', '.DS_Store'])
const WALK_IGNORE = new Set(['.git', 'node_modules', 'dist', 'out', 'release', '.cache'])

async function listProjectFiles(): Promise<string[]> {
  const root = getProjectRoot()
  if (!root) return []
  const out: string[] = []
  const MAX = 4000
  async function walk(rel: string): Promise<void> {
    if (out.length >= MAX) return
    const abs = rel ? resolveInProject(rel) : root!
    let entries
    try {
      entries = await fs.readdir(abs, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (out.length >= MAX) return
      if (WALK_IGNORE.has(e.name)) continue
      const childRel = rel ? `${rel}/${e.name}` : e.name
      if (e.isDirectory()) await walk(childRel)
      else out.push(childRel)
    }
  }
  await walk('')
  return out.sort()
}

function stripFences(s: string): string {
  const m = s.match(/^```[a-zA-Z0-9]*\n([\s\S]*?)\n```$/)
  return m ? m[1] : s
}

export function registerIpc(): void {
  /* ---------------- settings ---------------- */
  ipcMain.handle(IPC.settingsGet, () => getSettings())
  ipcMain.handle(IPC.settingsSetProvider, (_e, provider: Provider) => setProvider(provider))
  ipcMain.handle(IPC.settingsSetModel, (_e, req: SetModelRequest) => setModel(req.provider, req.model))
  ipcMain.handle(IPC.settingsSetUserKey, (_e, req: SetUserKeyRequest) =>
    setUserKey(req.provider, req.key)
  )

  /* ---------------- project / dialog ---------------- */
  ipcMain.handle(IPC.dialogOpenFolder, async (): Promise<ProjectInfo | null> => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const res = await dialog.showOpenDialog(win, {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Open Project Folder'
    })
    if (res.canceled || !res.filePaths[0]) return null
    const root = res.filePaths[0]
    const info: ProjectInfo = { root, name: basename(root) }
    setProject(info)
    resetConversation()
    startWatcher(root)
    emitProjectChanged(info)
    return info
  })

  ipcMain.handle(IPC.projectGet, (): ProjectInfo | null => getProject())

  /* ---------------- filesystem (renderer-facing) ---------------- */
  ipcMain.handle(IPC.fsListDir, async (_e, relPath?: string): Promise<DirEntry[]> => {
    const abs = resolveInProject(relPath || '.')
    const entries = await fs.readdir(abs, { withFileTypes: true })
    return entries
      .filter((e) => !EXPLORER_IGNORE.has(e.name))
      .map((e) => ({
        name: e.name,
        path: toRelative(join(abs, e.name)),
        type: e.isDirectory() ? ('directory' as const) : ('file' as const)
      }))
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
        return a.name.localeCompare(b.name)
      })
  })

  ipcMain.handle(IPC.fsReadFile, async (_e, relPath: string): Promise<ReadFileResult> => {
    const abs = resolveInProject(relPath)
    const content = await fs.readFile(abs, 'utf-8')
    return { path: relPath, content }
  })

  ipcMain.handle(IPC.fsSaveFile, async (_e, req: SaveFileRequest): Promise<{ ok: boolean }> => {
    const abs = resolveInProject(req.path)
    await fs.writeFile(abs, req.content, 'utf-8')
    return { ok: true }
  })

  ipcMain.handle(IPC.fsListFiles, (): Promise<string[]> => listProjectFiles())

  /* ---------------- agent ---------------- */
  ipcMain.handle(IPC.agentSend, (_e, req: SendMessageRequest): void => {
    void sendMessage(req.message)
  })
  ipcMain.handle(IPC.agentCancel, (): void => cancelAgent())
  ipcMain.handle(IPC.agentResolveEdit, (_e, req: ResolveEditRequest): void => {
    resolveApproval(req.id, req.accept)
  })
  ipcMain.handle(IPC.agentResolveCommand, (_e, req: ResolveCommandRequest): void => {
    resolveApproval(req.id, req.accept)
  })
  ipcMain.handle(IPC.agentUndoCheckpoint, (_e, id: string) => undoCheckpoint(id))

  ipcMain.handle(IPC.agentInlineEdit, async (_e, req: InlineEditRequest): Promise<void> => {
    const selected = req.fullText.slice(req.start, req.end)
    const system =
      'You are a precise code editor. Rewrite ONLY the selected code according to the instruction. ' +
      'Output ONLY the replacement code — no explanation, no markdown fences.'
    const user = `File: ${req.path}\nInstruction: ${req.instruction}\n\nSelected code:\n${selected}\n\nFull file for context:\n${req.fullText}`
    const replacement = stripFences(await completeOnce(system, user))
    const newFull = req.fullText.slice(0, req.start) + replacement + req.fullText.slice(req.end)
    const abs = resolveInProject(req.path)
    await proposeEdit({
      tool: 'edit_file',
      relPath: req.path,
      absPath: abs,
      oldContent: req.fullText,
      newContent: newFull,
      existed: true
    })
  })

  /* ---------------- git ---------------- */
  ipcMain.handle(IPC.gitStatus, (): Promise<GitStatus> => git.status())
  ipcMain.handle(IPC.gitDiff, (_e, req: GitDiffRequest): Promise<string> => git.diff(req))
  ipcMain.handle(IPC.gitStage, (_e, path: string): Promise<void> => git.stage(path))
  ipcMain.handle(IPC.gitUnstage, (_e, path: string): Promise<void> => git.unstage(path))
  ipcMain.handle(IPC.gitCommit, (_e, req: GitCommitRequest) => git.commit(req.message, req.all))

  ipcMain.handle(IPC.gitGenerateMessage, async (): Promise<string> => {
    const staged = await git.diff({ staged: true })
    const diff = staged && !staged.startsWith('(no') ? staged : await git.diffAll()
    if (!diff || diff === '(no changes)') return ''
    const system =
      'Write a concise git commit message for the diff. Use Conventional Commits style ' +
      '(e.g. "feat: ..."). First line under 72 chars; add a short body only if useful. No fences.'
    return stripFences(await completeOnce(system, diff.slice(0, 60_000)))
  })

  ipcMain.handle(IPC.gitExplain, async (): Promise<string> => {
    const diff = await git.diffAll()
    if (!diff || diff === '(no changes)') return 'There are no changes to explain.'
    const system = 'Explain what this diff changes and why, clearly and concisely, as a short review.'
    return completeOnce(system, diff.slice(0, 60_000))
  })
}
