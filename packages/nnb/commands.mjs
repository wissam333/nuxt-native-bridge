// nnb commands. Every command prints what it does; failures exit non-zero.
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import {
  electronEnv, fail, findAdapterDir, findJava, killTree, log, readAppConfig,
  resolveElectronPath, run, syncDir, waitPort,
} from './lib.mjs'
import { buildIcons } from './icons.mjs'

const appDir = () => process.cwd()

// ---------------------------------------------------------------------------
// nnb dev electron — nuxt dev (target electron) + shell pointed at the HMR
// server. Real HMR in a desktop window (spec §6.4; audit 9.1/1's "no stale
// static override in dev").
// ---------------------------------------------------------------------------
export async function devElectron(opts = {}) {
  const port = opts.port || 3000
  const adapterDir = findAdapterDir()
  const electronExe = resolveElectronPath(adapterDir)
  if (!electronExe) fail('cannot resolve the electron binary — install workspace deps first')

  log(`starting Nuxt dev server (port ${port}, target electron)…`)
  const server = spawn('npx', ['nuxt', 'dev', '--port', String(port)], {
    cwd: appDir(),
    env: { ...process.env, NUXT_TARGET: 'electron' },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })

  const devUrl = `http://localhost:${port}/`
  if (!(await waitPort(port))) {
    killTree(server)
    fail(`dev server did not listen on ${port} within 120s`)
  }
  log(`dev server ready — launching the shell at ${devUrl}`)

  const shell = spawn(electronExe, [adapterDir], {
    env: { ...process.env, NNB_DEV_URL: devUrl },
    stdio: 'inherit',
  })
  // Either side exiting ends the pair; the shell's code is the CLI's result.
  shell.on('exit', (code) => {
    killTree(server)
    process.exitCode = code ?? 1
  })
  server.on('exit', () => {
    log('dev server stopped — closing shell')
    killTree(shell)
  })
  // Parent's stdin stays open so the user can Ctrl+C; children get signal and
  // die, which unblocks the exit pair above.
}

// ---------------------------------------------------------------------------
// nnb build electron — generate → sync UI → Forge package/make (cross-platform).
// --installer adds the Squirrel installer pass (slower).
// ---------------------------------------------------------------------------
export async function buildElectron(opts = {}) {
  const cfg = await readAppConfig(appDir())
  const adapterDir = findAdapterDir()

  // 1. Static SPA generation for the desktop target (module forces ssr:false).
  process.env.NUXT_TARGET = 'electron'
  await run('npx', ['nuxt', 'generate'], { cwd: appDir() })

  // 2. UI into the adapter's www/ (rides inside app.asar; audit 9.1/3).
  const src = path.join(appDir(), '.output', 'public')
  if (!fs.existsSync(path.join(src, 'index.html'))) fail(`no .output/public build found in ${appDir()}`)
  const www = path.join(adapterDir, 'www')
  syncDir(src, www)
  log(`UI synced → ${www}`)

  // 3. Identity from nativeBridge (spec: "Forge config derived from config").
  const env = {
    ...process.env,
    ...(cfg.appName ? { NNB_APP_NAME: cfg.appName } : {}),
    ...(cfg.appName ? { NNB_EXECUTABLE: cfg.appName.toLowerCase().replace(/[^a-z0-9]/g, '') } : {}),
    ...(fs.existsSync(path.join(appDir(), 'public', 'favicon.ico')) ? { NNB_ICON: path.join(appDir(), 'public', 'favicon.ico') } : {}),
  }

  // 4. package (runnable app, fast) by default, make (installer) with --installer.
  // The CLI owns the electron mirror env (Forge re-fetches SHASUMS at packaging).
  await run('npx', ['electron-forge', opts.installer ? 'make' : 'package'], { cwd: adapterDir, env: { ...env, ...electronEnv() } })

  // 5. Point at the artifacts.
  const outDir = path.join(adapterDir, 'out')
  if (opts.installer) {
    for (const dir of ['squirrel.windows', 'zip', 'deb']) {
      const d = path.join(outDir, 'make', dir)
      if (fs.existsSync(d)) log(`installer artifacts: ${d}`)
    }
  }
  else {
    // Forge names the dir `${name}-${platform}-${arch}` — find by suffix.
    const match = fs.readdirSync(outDir).find(d => d.endsWith(`-${process.platform}-${process.arch}`))
    log(`app built: ${match ? path.join(outDir, match) : outDir}${path.sep}`)
  }
}

// ---------------------------------------------------------------------------
// nnb sync / nnb build android — cap sync, then Gradle run with doctor-figured
// JAVA_HOME (no hardcoded paths; spec §6.6).
// ---------------------------------------------------------------------------
export async function sync() {
  await run('npx', ['cap', 'sync', 'android'], { cwd: appDir() })
}

// ---------------------------------------------------------------------------
// nnb icons — parameterized generator (spec §6.5); reads nativeBridge.icons
// (and brand.color as audit-13 plate source), writes web/verify + android
// mipmaps when a shell exists.
// ---------------------------------------------------------------------------
export async function icons() {
  const cfg = await readAppConfig(appDir())
  const icons = cfg.config.nativeBridge?.icons
  if (!icons?.source) fail('nativeBridge.icons.source missing from nuxt.config.ts (spec §5)')
  await buildIcons(appDir(), icons, cfg.config.nativeBridge?.brand?.color)
}

export async function buildAndroid() {
  await sync()

  const androidDir = path.join(appDir(), 'android')
  if (!fs.existsSync(androidDir)) fail(`no android/ project in ${appDir()}`)

  const java = findJava()
  if (!java) fail('no JDK found — run `nnb doctor` for detected candidates')
  log(`JAVA: ${java.home}`)

  await run('gradlew.bat', ['assembleDebug'], {
    cwd: androidDir,
    shell: true,
    env: {
      ...process.env,
      JAVA_HOME: java.home,
      PATH: `${path.join(java.home, 'bin')}${path.delimiter}${process.env.PATH}`,
    },
  })
  const apk = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')
  if (fs.existsSync(apk)) log(`APK: ${apk}`)
}

// ---------------------------------------------------------------------------
// nnb doctor — environment & project checks (spec §6.6, Phase 0 slice).
// Non-destructive: detects and reports; never writes config files.
// ---------------------------------------------------------------------------
export async function doctor() {
  const checks = []
  const row = (ok, name, detail) => checks.push({ ok, name, detail })

  const semver = (a, b) => a[0] > b[0] || (a[0] === b[0] && a[1] >= b[1])
  const nodeVer = process.versions.node.split('.').map(Number)
  row(semver(nodeVer, [20, 19]), 'node', `v${process.versions.node} (needs ≥20.19)`)

  const adapterDir = findAdapterDir()
  const electronExe = resolveElectronPath(adapterDir)
  row(Boolean(electronExe), 'electron adapter', electronExe ? adapterDir : 'binary missing — run pnpm install in the workspace')

  const cfg = await readAppConfig(appDir())
  row(Boolean(cfg.appId), 'nativeBridge config', cfg.appId
    ? `${cfg.appId} (${cfg.appName})`
    : 'nativeBridge.app missing from nuxt.config.ts')
  row(fs.existsSync(path.join(appDir(), 'node_modules', 'nuxt-native-bridge')), 'module installed', 'node_modules/nuxt-native-bridge')

  const java = findJava()
  row(Boolean(java), 'JDK', java ? java.home : 'none of: JAVA_HOME, Android Studio JBR, Program Files\\Java, ~/.jdks')

  const sdkRaw = fs.existsSync(path.join(appDir(), 'android', 'local.properties'))
    // java properties escape `:` and `\` — unescape before using (C\:\Users)
    ? (fs.readFileSync(path.join(appDir(), 'android', 'local.properties'), 'utf8').match(/^sdk\.dir=(.*)$/m)?.[1] ?? '').replace(/\\\\/g, '\\').replace(/\\:/g, ':')
    : process.env.ANDROID_HOME || firstExisting([
      'C:\\Android\\Sdk',
      `${process.env.LOCALAPPDATA ?? ''}\\Android\\Sdk`,
    ])
  const sdkTrim = (sdkRaw || '').trim()
  row(fs.existsSync(sdkTrim || '/nonexistent'), 'Android SDK', sdkTrim || 'not found (ANDROID_HOME or android/local.properties)')

  const hasAndroid = fs.existsSync(path.join(appDir(), 'android', 'gradlew.bat'))
  row(hasAndroid, 'android project', hasAndroid ? 'gradlew present' : 'android/gradlew.bat missing')

  const w = Math.max(...checks.map(c => c.name.length))
  for (const c of checks) console.log(`${c.ok ? '✔' : '✖'}  ${c.name.padEnd(w)}  ${c.detail}`)
  const failed = checks.filter(c => !c.ok).length
  if (failed > 0) {
    log(`${failed} check${failed === 1 ? '' : 's'} failed — fix the ✖ rows above`)
    process.exitCode = 1
  }
  else {
    log('environment looks good')
  }
}

function firstExisting(paths) {
  return paths.find(p => p && fs.existsSync(p)) ?? ''
}
