/**
 * Isolated preload: window chrome and the macOS dock bounce reach the page.
 * @module @deepseek-ai/dsh-desktop/preload
 */

import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('dshDesktop', {
  minimize: () => { ipcRenderer.send('dsh-desktop:minimize') },
  maximize: () => { ipcRenderer.send('dsh-desktop:maximize') },
  close: () => { ipcRenderer.send('dsh-desktop:close') },
  notifyCompleted: () => { ipcRenderer.send('dsh-desktop:notify-completed') },
})
