// nnb commands. Every command prints what it does; failures exit non-zero.
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import {
  electronEnv, fail, findAdapterDir, findJava, killTree, log, readAppConfig,
  resolveElectronPath, run, syncDir, waitPort,
} from './lib.mjs'
import { buildIcons } from './icons.mjs'
import { askLogoPath, hexColor, renderIconsPatch, resolveLogo, wireAndroid } from './init.mjs'
import { nativeSync } from './native-sync.mjs'

const appDir = () => process.cwd()

// ---------------------------------------------------------------------------
// nnb dev electron — nuxt dev (target electron) + shell pointed at the HMR
// server. Real HMR in a desktop window (spec §6.4; audit 9.1/1's "no stale
// static override in dev").
// ---------------------------------------------------------------------------
export async function devElectron(opts = {}) {
  const port = opts.port || 3000
  const adapterDir = findAdapterDir(appDir())
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
  shell.on('error', (err) => {
    killTree(server)
    fail(`cannot launch Electron (${err.code ?? err.message}) — if Windows Smart App Control is on, it blocks unsigned electron.exe; turn Smart App Control off or run the desktop build on another machine`)
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
// nnb dev web — plain web dev server, no NUXT_TARGET in the child env.
// ---------------------------------------------------------------------------
export async function devWeb(opts = {}) {
  const port = opts.port || 3000
  // Plan T6: NUXT_TARGET may leak from a caller's shell — `dev web` is always
  // target-less so the app keeps its own web config (audit item 36).
  const cleanEnv = { ...process.env }
  delete cleanEnv.NUXT_TARGET
  log(`starting Nuxt dev server (port ${port}, web target)…`)
  const server = spawn('npx', ['nuxt', 'dev', '--port', String(port)], {
    cwd: appDir(),
    env: cleanEnv,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })

  const devUrl = `http://localhost:${port}/`
  if (!(await waitPort(port))) {
    killTree(server)
    fail(`dev server did not listen on ${port} within 120s`)
  }
  log(`dev server ready — ${devUrl}`)

  // Same smoke contract as the packaged electron app (spec §11-1): the page
  // must come up carrying the expected marker. TCP listen ≠ HTTP ready —
  // Nitro builds AFTER the port opens, so retry until served or timeout.
  if (process.env.NNB_SMOKE) {
    const expected = process.env.NNB_SMOKE_EXPECT || 'nnb-smoke'
    const deadline = Date.now() + 30_000
    let served = false
    while (Date.now() < deadline && !served) {
      try {
        const html = await (await fetch(devUrl)).text()
        served = html.includes(expected)
      }
      catch { /* warmup: connection refused or empty — retry */ }
      if (!served) await new Promise(r => setTimeout(r, 1000))
    }
    log(served ? 'smoke ok' : `smoke failed: expected ${JSON.stringify(expected)} in the served page`)
    process.exitCode = served ? 0 : 1
    killTree(server)
    return
  }

  // Stays in the foreground for the user; Ctrl+C ends it.
  server.on('exit', () => log('dev server stopped'))
}

// ---------------------------------------------------------------------------
// nnb build electron — generate → sync UI → Forge package/make (cross-platform).
// --installer adds the Squirrel installer pass (slower).
// ---------------------------------------------------------------------------
export async function buildElectron(opts = {}) {
  const cfg = await readAppConfig(appDir())
  const adapterDir = findAdapterDir(appDir())

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
  // Forge's pnpm system check runs `pnpm config get node-linker` with the
  // adapter as its project root — inside node_modules, where pnpm config
  // discovery stops at the nearest package.json and the app's own settings are
  // unreachable. pnpm 12 reads these settings only from pnpm-workspace.yaml,
  // so write one next to the adapter's package.json (npm tarballs cannot ship
  // it; the app-level .npmrc covers pnpm versions that still read .npmrc).
  fs.writeFileSync(path.join(adapterDir, 'pnpm-workspace.yaml'), 'nodeLinker: hoisted\n')
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
async function ensureWebAssets(dir) {
  const index = path.join(dir, '.output', 'public', 'index.html')
  if (fs.existsSync(index)) return
  log('no .output/public/index.html, generating the Android web assets first')
  await run('npx', ['nuxt', 'generate'], {
    cwd: dir,
    env: { ...process.env, NUXT_TARGET: 'android' },
  })
  if (!fs.existsSync(index)) {
    fail('nuxt generate finished without .output/public/index.html, check the Nuxt build output')
  }
}

export async function sync() {
  const dir = appDir()
  if (!fs.existsSync(path.join(dir, 'android'))) fail(`no android/ project in ${dir}, run \`nnb init\` first`)
  const cfg = await readAppConfig(dir)
  // Cap sync only copies an existing build; a stale or missing .output/public
  // is the usual "must contain an index.html" failure. Generate first.
  await ensureWebAssets(dir)
  // Repair shells created before nnb (or by plain Capacitor): assets/,
  // :nnb-bridge, MainActivity, SDK path and build-tools pin.
  wireAndroid(dir, cfg.appId || 'com.example.app')
  await run('npx', ['cap', 'sync', 'android'], { cwd: dir })
  // Config-derived native files (themes, manifest, mirrors) after cap sync.
  nativeSync(dir, cfg.config.nativeBridge)
}

// ---------------------------------------------------------------------------
// nnb icons — parameterized generator (spec §6.5); reads nativeBridge.icons
// (and brand.color as audit-13 plate source), writes web/verify + android
// mipmaps when a shell exists.
// ---------------------------------------------------------------------------
export async function icons() {
  const dir = appDir()
  const cfg = await readAppConfig(dir)
  const existing = cfg.config.nativeBridge?.icons
  const brand = cfg.config.nativeBridge?.brand?.color
  if (existing?.source) {
    await buildIcons(dir, existing, brand)
    return
  }

  // No live icons.source: ask for a logo, or leave the shape commented.
  const typed = await askLogoPath()
  const resolved = resolveLogo(dir, typed)
  if (resolved.note) log(resolved.note)
  const color = hexColor(brand)
  const file = path.join(dir, 'nuxt.config.ts')
  const before = fs.readFileSync(file, 'utf8')
  const after = renderIconsPatch(before, { logo: resolved.logo, brand: color, commentedPath: resolved.commentedPath })
  if (after !== before) {
    fs.writeFileSync(file, after)
    log('nuxt.config.ts: wrote nativeBridge.icons')
  }
  if (!resolved.logo) {
    if (after === before && !before.includes('nativeBridge')) {
      fail('nativeBridge block missing from nuxt.config.ts — run `nnb init` first')
    }
    fail('commented icons example is in nuxt.config.ts — point source, glyph and splash at your logo, then run `nnb icons` again')
  }
  await buildIcons(dir, {
    source: resolved.logo,
    android: { glyph: resolved.logo, background: color },
    splash: resolved.logo,
  }, color)
}

export async function buildAndroid() {
  const androidDir = path.join(appDir(), 'android')
  if (!fs.existsSync(androidDir)) fail(`no android/ project in ${appDir()}`)

  // One command builds the native app: generate the web assets for the android
  // target first (Capacitor copies .output/public into the shell).
  await run('npx', ['nuxt', 'generate'], {
    cwd: appDir(),
    env: { ...process.env, NUXT_TARGET: 'android' },
  })
  await sync()

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

  const adapterDir = findAdapterDir(appDir())
  const electronExe = resolveElectronPath(adapterDir)
  row(Boolean(electronExe), 'electron adapter', electronExe ? adapterDir : 'binary missing — run npm install (or pnpm install) in the app')

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
