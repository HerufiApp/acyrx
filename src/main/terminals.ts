import os from 'os'
import * as pty from 'node-pty'
import { IPC } from '@shared/types'
import { getMainWindow, getProjectRoot } from './projectState'

/**
 * Interactive PTY terminals. Each tab in the renderer's terminal panel owns a
 * real pseudo-terminal running the user's shell — input, output, and resize are
 * routed by a renderer-generated id, so the user can type into them and open as
 * many as they like (VS Code-style).
 */

const terminals = new Map<string, pty.IPty>()

function defaultShell(): string {
  if (process.platform === 'win32') return process.env.COMSPEC || 'powershell.exe'
  return process.env.SHELL || 'bash'
}

export function createTerminal(id: string, cols: number, rows: number): void {
  if (terminals.has(id)) return

  const cwd = getProjectRoot() ?? os.homedir()
  const proc = pty.spawn(defaultShell(), [], {
    name: 'xterm-color',
    cols: cols > 0 ? cols : 80,
    rows: rows > 0 ? rows : 24,
    cwd,
    env: process.env as Record<string, string>
  })
  terminals.set(id, proc)

  proc.onData((data) => {
    getMainWindow()?.webContents.send(IPC.evtPtyData, { id, data })
  })

  proc.onExit(({ exitCode }) => {
    terminals.delete(id)
    getMainWindow()?.webContents.send(IPC.evtPtyExit, { id, exitCode })
  })
}

export function writeTerminal(id: string, data: string): void {
  terminals.get(id)?.write(data)
}

export function resizeTerminal(id: string, cols: number, rows: number): void {
  if (cols <= 0 || rows <= 0) return
  try {
    terminals.get(id)?.resize(cols, rows)
  } catch {
    /* shell may have just exited */
  }
}

export function killTerminal(id: string): void {
  const proc = terminals.get(id)
  if (!proc) return
  terminals.delete(id)
  try {
    proc.kill()
  } catch {
    /* already gone */
  }
}

export function killAllTerminals(): void {
  for (const proc of terminals.values()) {
    try {
      proc.kill()
    } catch {
      /* already gone */
    }
  }
  terminals.clear()
}
