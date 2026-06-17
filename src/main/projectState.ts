import { BrowserWindow } from 'electron'
import type { ProjectInfo, AgentEvent, FsChange, TerminalData } from '@shared/types'
import { IPC } from '@shared/types'

/**
 * Central main-process state: the currently open project and the main window,
 * plus typed helpers for emitting streamed events to the renderer.
 */

let project: ProjectInfo | null = null
let mainWindow: BrowserWindow | null = null

export function setMainWindow(w: BrowserWindow): void {
  mainWindow = w
}

export function getProject(): ProjectInfo | null {
  return project
}

export function setProject(p: ProjectInfo | null): void {
  project = p
}

export function getProjectRoot(): string | null {
  return project?.root ?? null
}

export function emitAgent(e: AgentEvent): void {
  mainWindow?.webContents.send(IPC.evtAgent, e)
}

export function emitFsChange(c: FsChange): void {
  mainWindow?.webContents.send(IPC.evtFsChange, c)
}

export function emitTerminal(d: TerminalData): void {
  mainWindow?.webContents.send(IPC.evtTerminal, d)
}

export function emitProjectChanged(p: ProjectInfo | null): void {
  mainWindow?.webContents.send(IPC.evtProjectChanged, p)
}
