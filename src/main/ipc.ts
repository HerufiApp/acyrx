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
  type Provider
} from '@shared/types'
import { getSettings, setProvider, setModel, setUserKey } from './settings'
import { getProject, setProject, emitProjectChanged } from './projectState'
import { resolveInProject, toRelative } from './tools/paths'
import { startWatcher } from './watcher'
import { sendMessage, cancelAgent, resetConversation } from './agent/loop'
import { resolveApproval } from './agent/approvals'

const EXPLORER_IGNORE = new Set(['.git', '.DS_Store'])

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
}
