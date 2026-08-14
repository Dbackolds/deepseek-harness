/**
 * Electron main process: one frameless window around a local `dsh web` Host.
 * @module @deepseek-ai/dsh-desktop/main
 */

import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startWebHost, stopWebHost, type StartedHost } from './host.ts'
import { loadingPage, titlebarInjectScript } from './titlebar.ts'

const WINDOW_TITLE = 'DeepSeek Harness'
const PRELOAD = fileURLToPath(new URL('./preload.js', import.meta.url))

/** Last successful workspace directory, kept next to Electron's userData. */
function workspaceMemoryPath(): string {
  return join(app.getPath('userData'), 'workspace.json')
}

/** Restore the directory the previous window used as `dsh web` cwd. */
function readRememberedWorkspace(): string | undefined {
  try {
    const parsed: unknown = JSON.parse(readFileSync(workspaceMemoryPath(), 'utf8'))
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined
    const cwd = (parsed as { cwd?: unknown }).cwd
    return typeof cwd === 'string' && existsSync(cwd) ? cwd : undefined
  } catch {
    return undefined
  }
}

/** Persist the directory this window used as `dsh web` cwd. */
function rememberWorkspace(cwd: string): void {
  mkdirSync(app.getPath('userData'), { recursive: true })
  writeFileSync(workspaceMemoryPath(), `${JSON.stringify({ cwd })}\n`)
}

/** Extra `dsh web` flags forwarded by `dsh desktop` through the environment. */
function extraWebArgs(): string[] {
  const raw = process.env.DSH_DESKTOP_WEB_ARGS
  if (raw === undefined || raw === '') return []
  const parsed: unknown = JSON.parse(raw)
  if (!Array.isArray(parsed) || parsed.some(item => typeof item !== 'string')) {
    throw new Error('dsh desktop: DSH_DESKTOP_WEB_ARGS must be a JSON string array')
  }
  return parsed
}

function createWindow(): BrowserWindow {
  return new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    title: WINDOW_TITLE,
    backgroundColor: '#151517',
    frame: false,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
}

function bindWindowChrome(window: BrowserWindow): void {
  ipcMain.on('dsh-desktop:minimize', () => { window.minimize() })
  ipcMain.on('dsh-desktop:maximize', () => {
    if (window.isMaximized()) window.unmaximize()
    else window.maximize()
  })
  ipcMain.on('dsh-desktop:close', () => { window.close() })
}

function attachTitlebar(window: BrowserWindow): void {
  window.webContents.on('did-finish-load', () => {
    void window.webContents.executeJavaScript(titlebarInjectScript())
  })
}

function fenceNavigation(window: BrowserWindow, origin: string): void {
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(origin)) return { action: 'allow' }
    void shell.openExternal(url)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith(origin) || url.startsWith('data:')) return
    event.preventDefault()
    void shell.openExternal(url)
  })
}

let host: StartedHost | undefined

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const window = BrowserWindow.getAllWindows()[0]
    if (window === undefined) return
    if (window.isMinimized()) window.restore()
    window.focus()
  })

  void app.whenReady().then(async () => {
    const window = createWindow()
    bindWindowChrome(window)
    attachTitlebar(window)
    await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(loadingPage())}`)
    window.show()
    const cwd = readRememberedWorkspace()
      ?? (process.env.INIT_CWD !== undefined && existsSync(process.env.INIT_CWD) ? process.env.INIT_CWD : undefined)
      ?? process.cwd()
    try {
      host = await startWebHost({ cwd, extraArgs: extraWebArgs() })
      rememberWorkspace(cwd)
      fenceNavigation(window, host.ready.href)
      await window.loadURL(host.ready.href)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(
        loadingPage().replace('正在启动 DeepSeek Harness…', message),
      )}`)
    }
  })

  app.on('window-all-closed', () => {
    if (host !== undefined) stopWebHost(host.child)
    app.quit()
  })

  app.on('before-quit', () => {
    if (host !== undefined) stopWebHost(host.child)
  })
}
