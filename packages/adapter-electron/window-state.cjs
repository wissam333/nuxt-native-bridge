// Window bounds persistence (spec §6.2). Stored in userData so it survives
// updates. The file is user-writable, so every value is validated on load.
const fs = require('node:fs')
const path = require('node:path')

const FILE = 'nnb-window-state.json'

function finite(n) {
  return typeof n === 'number' && Number.isFinite(n)
}

function loadWindowState(userDataDir) {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(userDataDir, FILE), 'utf8'))
    const b = raw?.bounds
    return {
      bounds: b && finite(b.width) && finite(b.height)
        ? {
            width: b.width,
            height: b.height,
            ...(finite(b.x) && finite(b.y) ? { x: b.x, y: b.y } : {}),
          }
        : undefined,
      maximized: raw.maximized === true,
      fullscreen: raw.fullscreen === true,
    }
  }
  catch {
    return {} // absent or corrupt state = defaults
  }
}

// shortcut: x/y are not validated against visible monitors — multi-monitor
// users will get their real position back, invalid values fall back to the
// system default; upgrade if on-screen clamping is ever reported broken.
function saveWindowState(win, userDataDir) {
  if (!win || win.isDestroyed()) return
  const b = win.isMaximized() || win.isMinimized() ? win.getNormalBounds() : win.getBounds()
  const value = {
    bounds: { x: b.x, y: b.y, width: b.width, height: b.height },
    maximized: win.isMaximized(),
    fullscreen: win.isFullScreen(),
  }
  try {
    fs.writeFileSync(path.join(userDataDir, FILE), JSON.stringify(value))
  }
  catch {
    // best effort — losing window state is acceptable
  }
}

module.exports = { loadWindowState, saveWindowState }
