// NNB adapter-electron main process.
// Hardened per spec §6.2 / audit 9.1 items 1–7:
//   1 explicit NNB_UI_DIR (no file-existence guessing)
//   3 UI served from inside the asar through fs
//   4 app:// handler with decodeURIComponent + resolved-path containment
//   5 CJS preload + sandbox:true
//   6 single-instance, window state, navigation guards, CSP
//   7 plain app://./ entry, no hash routing

const { app, BrowserWindow, shell, protocol, ipcMain, net } = require('electron')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { resolveUiPath } = require('./ui-router.cjs')
const { loadWindowState, saveWindowState } = require('./window-state.cjs')

// Squirrel Windows installer hooks (install/update/uninstall) must exit early.
if (require('electron-squirrel-startup')) app.quit()

const APP_NAME = process.env.NNB_APP_NAME || 'Nnb App'

// `nnb dev electron` runs `nuxt dev` and sets this; the window then loads the
// HMR server directly instead of the static app:// bundle (spec §6.4).
const DEV_URL = process.env.NNB_DEV_URL || ''

// Must run before app ready: app:// gets standard/secure semantics so the SPA
// can use history routing, fetch and XHR against its own origin (spec §3.1).
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: { secure: true, standard: true, supportFetchAPI: true, corsEnabled: true },
  },
])

// Sent with every protocol response. 'unsafe-inline' covers Nuxt's early boot
// script until the module stamps nonces; apps override via NNB_CSP.
const CSP = process.env.NNB_CSP
  || 'default-src \'self\'; script-src \'self\' \'unsafe-inline\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data: blob:; font-src \'self\' data:; connect-src \'self\' https: http: ws: wss:'

function resolveUiRoot() {
  if (process.env.NNB_UI_DIR) return path.resolve(process.env.NNB_UI_DIR)
  if (app.isPackaged) return path.join(app.getAppPath(), 'www')
  console.error('[nnb] dev run without NNB_UI_DIR — point it at the built Nuxt output or use `nnb dev electron`')
  return null
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) app.quit()

let mainWindow = null
let quitting = false

function focusExisting() {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
}

function createWindow() {
  const state = loadWindowState(app.getPath('userData'))
  mainWindow = new BrowserWindow({
    width: state.bounds?.width ?? 1200,
    height: state.bounds?.height ?? 800,
    x: state.bounds?.x,
    y: state.bounds?.y,
    minWidth: 900,
    minHeight: 600,
    title: APP_NAME,
    fullscreen: state.fullscreen,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  })
  if (state.maximized) mainWindow.maximize()

  mainWindow.on('close', () => saveWindowState(mainWindow, app.getPath('userData')))
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // No in-app popups; external links go to the system browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  // History-API navigations never hit this; only real navigations do, and
  // they may only stay on our origin (app:// static, or the dev server URL).
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (url.startsWith(DEV_URL || 'app://')) return
    e.preventDefault()
    if (/^https?:/i.test(url)) void shell.openExternal(url)
  })

  if (process.env.NNB_SMOKE) attachSmoke(mainWindow)

  // Dev: the HMR server from `nnb dev electron`; else the static UI via app://.
  // Not awaited: smoke must subscribe before did-finish-load can fire.
  void mainWindow.loadURL(DEV_URL || 'app://./')
}

// Audit 9.1/4 lives in ui-router.cjs (unit-tested); this handler composes it
// with asar-aware fetching (fs works through asar, so the integrity fuses
// cover the UI) and stamps the CSP on every response.
function registerAppProtocol(uiRoot) {
  protocol.handle('app', async (request) => {
    const resolved = resolveUiPath(request.url, uiRoot)
    if (!resolved) return new Response('not found', { status: 404 })
    try {
      const res = await net.fetch(pathToFileURL(resolved.filePath).toString())
      const headers = new Headers(res.headers)
      headers.set('Content-Security-Policy', CSP)
      return new Response(res.body, { status: res.status, headers })
    }
    catch {
      return new Response('not found', { status: 404 }) // no fs path leaks
    }
  })
}

// Spec §6.2 custom titlebar hooks + the exit seam for useNativeApp().exit().
ipcMain.handle('nnb:window', (_event, action) => {
  if (!mainWindow) return
  if (action === 'minimize') mainWindow.minimize()
  else if (action === 'maximizeOrRestore') mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize()
  else if (action === 'close') mainWindow.close()
})
ipcMain.handle('nnb:app:exit', () => {
  quitting = true
  app.quit()
})

app.on('second-instance', () => {
  focusExisting()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' || quitting) app.quit()
})

app.on('before-quit', () => {
  quitting = true
})

app.whenReady().then(() => {
  if (DEV_URL) {
    // Dev HMR mode: no static UI source required, protocol left unregistered.
    createWindow()
    return
  }
  const uiRoot = resolveUiRoot()
  if (!uiRoot) {
    app.exit(1)
    return
  }
  registerAppProtocol(uiRoot)
  createWindow()
})

// Best-effort verdicts on stdout; the runner asserts on the exit code, which
// is deterministic. Exits 0 only when the served page reports the marker.
function attachSmoke(win) {
  const expected = process.env.NNB_SMOKE_EXPECT || 'nnb-smoke'
  const fail = (msg) => {
    console.log(`[nnb] smoke failed: ${msg}`)
    app.exit(1)
  }
  const timer = setTimeout(() => fail('timeout'), 8000)

  win.webContents.once('did-finish-load', () => {
    setTimeout(() => {
      clearTimeout(timer)
      win.webContents.executeJavaScript('document.title')
        .then((title) => {
          const ok = title === expected
          console.log(ok ? '[nnb] smoke ok' : `[nnb] smoke failed: title=${JSON.stringify(title)} expected=${JSON.stringify(expected)}`)
          app.exit(ok ? 0 : 1)
        })
        .catch(err => fail(String(err)))
    }, 300)
  })
}
