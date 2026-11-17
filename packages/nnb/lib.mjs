// Shared CLI helpers. Plain Node APIs only (deps: jiti for TS config reading).
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { createJiti } from 'jiti'

export const log = msg => console.log(`[nnb] ${msg}`)
export const fail = (msg) => {
  console.error(`[nnb] ✖ ${msg}`)
  process.exit(1)
}

// Android SDK discovery (same order doctor reports): ANDROID_HOME, then the
// common Windows locations. Returns null when none exists.
export function findSdk() {
  const candidates = [
    process.env.ANDROID_HOME,
    'C:\\Android\\Sdk',
    path.join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk'),
  ].filter(Boolean)
  return candidates.find(dir => fs.existsSync(dir)) || null
}

// Inherits stdio so tool output streams to the user (nuxt, forge, gradle).
export function run(cmd, args, opts = {}) {
  log(`$ ${cmd} ${args.join(' ')}${opts.cwd ? ` (in ${path.basename(opts.cwd)}/)` : ''}`)
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32', ...opts })
    child.on('error', reject)
    child.on('exit', code => (code === 0 ? resolve(code) : reject(new Error(`${cmd} exited with ${code}`))))
  })
}

export function killTree(child) {
  if (!child || child.exitCode !== null) return
  if (process.platform === 'win32') {
    spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
  }
  else {
    child.kill('SIGTERM')
  }
}

// Audit 9.1/2: cross-platform copy replacing `xcopy` chains. The destination
// is emptied first — stale generated files flipping between runs is how the
// old shell ended up "serving the wrong app".
export function syncDir(src, dest) {
  fs.rmSync(dest, { recursive: true, force: true })
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.cpSync(src, dest, { recursive: true })
}

// TCP-level readiness: no HTTP needed — `nuxt dev` binds the port when ready.
// Nuxt binds one loopback stack only (often ::1 on Windows), so a client that
// resolves `localhost` either way must be able to reach it: probe both.
function tcpProbe(host, port) {
  return new Promise((resolve) => {
    const s = net.connect({ host, port, timeout: 1500 })
    s.once('connect', () => {
      s.end()
      resolve(true)
    })
    s.once('error', () => resolve(false))
    s.once('timeout', () => {
      s.destroy()
      resolve(false)
    })
  })
}

export async function waitPort(port, seconds = 120) {
  for (let i = 0; i < seconds; i++) {
    const ok = (await tcpProbe('::1', port)) || (await tcpProbe('127.0.0.1', port))
    if (ok) return true
    await new Promise(r => setTimeout(r, 1000))
  }
  return false
}

// Reads the app's nuxt.config.ts (TypeScript → real object) for app identity.
// Spec §6.4: commands derive from the same config the Nuxt module uses.
export async function readAppConfig(appDir) {
  // `defineNuxtConfig` is a Nuxt auto-global; plain Node evaluation needs it.
  if (!globalThis.defineNuxtConfig) globalThis.defineNuxtConfig = cfg => cfg
  const file = path.join(appDir, 'nuxt.config.ts')
  if (!fs.existsSync(file)) fail(`no nuxt.config.ts in ${appDir}`)
  // fsCache off: jiti's on-disk cache can serve a pre-patch module when init
  // rewrites nuxt.config.ts and re-reads within the same mtime tick (found by
  // the published-flow scratch gate — splash config read as undefined).
  const jiti = createJiti(import.meta.url, { fsCache: false, moduleCache: false })
  const mod = await jiti(file)
  const cfg = mod.default ?? {}
  return {
    appId: cfg.nativeBridge?.app?.id,
    appName: cfg.nativeBridge?.app?.name,
    config: cfg,
  }
}

export function findAdapterDir(appDir) {
  const fromEnv = process.env.NNB_ELECTRON_ADAPTER
  if (fromEnv) return path.resolve(fromEnv)
  // Published flow: the app devDeps @nnb/adapter-electron (installed by
  // `nnb init`), so the adapter resolves from the app's node_modules.
  if (appDir) {
    for (const name of ['@nnb/adapter-electron', 'adapter-electron']) {
      try {
        const req = createRequire(pathToFileURL(path.join(appDir, 'package.json')))
        return path.dirname(req.resolve(`${name}/package.json`))
      }
      catch { /* not installed here — try the next source */ }
    }
  }
  // Monorepo flow: workspace sibling of the CLI package (playground dev).
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'adapter-electron')
}

// `require('electron')` under plain Node is the binary path; resolving it
// through the adapter dir means the CLI never needs its own electron dep.
export function resolveElectronPath(adapterDir) {
  try {
    const req = createRequire(pathToFileURL(path.join(adapterDir, 'package.json')))
    return req('electron')
  }
  catch {
    return null
  }
}

// CLI-owned electron mirror (spec ruling: commit-time .npmrc hacks retire when
// `nnb` exists). Override with ELECTRON_MIRROR for other regions.
export const ELECTRON_MIRROR = process.env.ELECTRON_MIRROR || 'https://npmmirror.com/mirrors/electron/'

export function electronEnv() {
  return {
    ELECTRON_MIRROR: ELECTRON_MIRROR,
    npm_config_electron_mirror: ELECTRON_MIRROR,
  }
}

function javaExe(home) {
  return process.platform === 'win32' ? path.join(home, 'bin', 'java.exe') : path.join(home, 'bin', 'java')
}

// JDK discovery for Gradle. Order: JAVA_HOME → Android Studio JBR → Program
// Files\Java\jdk* (newest) → ~/.jdks/* (JetBrains). No writes anywhere.
export function findJava() {
  const g = (dir) => {
    try {
      return fs.readdirSync(dir).filter(name => name.startsWith('jdk')).map(name => path.join(dir, name)).sort().toReversed()
    }
    catch {
      return []
    }
  }
  const candidates = [
    ...(process.env.JAVA_HOME ? [process.env.JAVA_HOME] : []),
    'C:\\Program Files\\Android\\Android Studio\\jbr',
    ...g('C:\\Program Files\\Java'),
    ...g(path.join(os.homedir(), '.jdks')),
  ]
  for (const home of candidates) {
    if (fs.existsSync(javaExe(home))) return { home, bin: javaExe(home) }
  }
  return null
}
