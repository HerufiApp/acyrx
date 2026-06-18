import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { loadEnv } from './env'

// Load .env before anything reads process.env (keys, builtin keys, etc.).
loadEnv()

import { registerIpc } from './ipc'
import { setMainWindow } from './projectState'
import { stopWatcher } from './watcher'
import { restoreSession } from './auth'

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 940,
    minHeight: 600,
    backgroundColor: '#1e1e1e',
    title: 'Acyrx',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true
    }
  })

  setMainWindow(win)

  // Open external links in the user's browser, never in-app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.whenReady().then(async () => {
  registerIpc()
  // Restore a persisted Supabase session before the window queries auth state,
  // so a returning user isn't briefly shown the sign-in screen.
  await restoreSession()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  stopWatcher()
  if (process.platform !== 'darwin') app.quit()
})
