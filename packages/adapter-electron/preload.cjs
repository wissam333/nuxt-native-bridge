// CJS preload, sandbox-compatible (audit 9.1/5): sandbox:true restricts the
// preload's require allowlist — contextBridge and ipcRenderer are both on it.
// Exposes exactly the spec §6.2 surface: target/os info, window controls, exit.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('nnb', {
  target: 'electron',
  platform: process.platform,
  // "Ask me first" seam for the module's useNativeApp().exit() on electron.
  exit: () => ipcRenderer.invoke('nnb:app:exit'),
  window: {
    close: () => ipcRenderer.invoke('nnb:window', 'close'),
    minimize: () => ipcRenderer.invoke('nnb:window', 'minimize'),
    maximizeOrRestore: () => ipcRenderer.invoke('nnb:window', 'maximizeOrRestore'),
  },
})
