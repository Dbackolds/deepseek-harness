/**
 * Electron main process: one frameless window around a local `dsh web` Host.
 * @module @deepseek-ai/dsh-desktop/main
 */

import { app, BrowserWindow, ipcMain, nativeImage, shell } from 'electron'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startWebHost, stopWebHost, type StartedHost } from './host.ts'
import { APP_USER_MODEL_ID, desktopIconPath } from './icon.ts'
import { windowsShortcutPath, windowsShortcutSpec } from './shortcut.ts'
import { TITLEBAR_HEIGHT_PX, loadingPage, titlebarInjectScript } from './titlebar.ts'

const WINDOW_TITLE = 'DeepSeek Harness'
const PRELOAD = fileURLToPath(new URL('./preload.js', import.meta.url))

/** Last successful workspace and Node path, kept next to Electron's userData. */
function workspaceMemoryPath(): string {
  return join(app.getPath('userData'), 'workspace.json')
}

interface LaunchMemory {
  cwd?: string
  node?: string
}

/** Restore the previous window's `dsh web` cwd and Node executable. */
function readLaunchMemory(): LaunchMemory {
  try {
    const parsed: unknown = JSON.parse(readFileSync(workspaceMemoryPath(), 'utf8'))
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const record = parsed as { cwd?: unknown; node?: unknown }
    return {
      ...typeof record.cwd === 'string' && existsSync(record.cwd) ? { cwd: record.cwd } : {},
      ...typeof record.node === 'string' && existsSync(record.node) ? { node: record.node } : {},
    }
  } catch {
    return {}
  }
}

/** Persist the directory and Node path this window used. */
function rememberLaunch(cwd: string, node: string): void {
  mkdirSync(app.getPath('userData'), { recursive: true })
  writeFileSync(workspaceMemoryPath(), `${JSON.stringify({ cwd, node })}\n`)
}

/** Working directory for the Host spawned beside this window. */
function resolveWorkspace(memory: LaunchMemory): string {
  return memory.cwd
    ?? (process.env.INIT_CWD !== undefined && existsSync(process.env.INIT_CWD) ? process.env.INIT_CWD : undefined)
    ?? process.cwd()
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
    icon: nativeImage.createFromPath(desktopIconPath()),
    backgroundColor: '#151517',
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#151517',
      symbolColor: '#ececf1',
      height: TITLEBAR_HEIGHT_PX,
    },
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

if (process.platform === 'win32') app.setAppUserModelId(APP_USER_MODEL_ID)

function publishWindowsShortcut(): void {
  const desktopRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..')
  const shortcut = windowsShortcutPath(join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs'))
  if (existsSync(shortcut)) return
  const spec = windowsShortcutSpec({ electronPath: process.execPath, desktopRoot })
  if (!shell.writeShortcutLink(shortcut, 'create', spec)) {
    console.error(`dsh desktop: could not write Start menu shortcut at ${shortcut}`)
  }
}

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

  const memory = readLaunchMemory()
  const cwd = resolveWorkspace(memory)
  // Start the Host before Chromium is ready so plugin boot overlaps window creation.
  const hostReady = startWebHost({
    cwd,
    extraArgs: extraWebArgs(),
    ...memory.node === undefined ? {} : { nodePath: memory.node },
  })

  void app.whenReady().then(async () => {
    if (process.platform === 'win32') publishWindowsShortcut()
    const window = createWindow()
    bindWindowChrome(window)
    attachTitlebar(window)
    void window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(loadingPage())}`)
    window.show()
    try {
      host = await hostReady
      rememberLaunch(cwd, host.child.spawnfile)
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
