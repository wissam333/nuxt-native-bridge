#!/usr/bin/env node
// nnb — nuxt-native-bridge CLI. argv dispatch only; logic lives in commands.mjs.
// Usage: nnb <command> <target> [--flags]. See help for the current Phase 0 set.
import { devElectron, devWeb, buildElectron, buildAndroid, sync, icons, doctor } from './commands.mjs'
import { init } from './init.mjs'

const [cmd, target, ...flags] = process.argv.slice(2)
const opts = {
  port: Number(flags.find(f => f?.startsWith('--port='))?.slice('--port='.length)) || undefined,
  installer: flags.includes('--installer'),
}

const HELP = `nnb — nuxt-native-bridge CLI (Phase 0)

  nnb dev web                Nuxt dev server for the plain web target (no
                             NUXT_TARGET in the child env)
  nnb dev electron           Nuxt dev server (HMR) inside the Electron shell
  nnb build electron [--installer]   static UI build → www sync → Forge package
                             (--installer adds the Squirrel installer pass)
  nnb build android          generate static UI + cap sync + gradlew assembleDebug
                             → APK
  nnb sync                   cap sync only
  nnb icons                  generate web/desktop icons + android mipmaps from
                             nuxt.config.ts nativeBridge.icons (spec §6.5)
  nnb init                   scaffold nativeBridge wiring for all three targets
                             (run inside a Nuxt app; prompts for id/name)
  nnb doctor                 environment & project checks

Run inside the app directory (the Nuxt app using nuxt-native-bridge).
`

export function main() {
  const combo = `${cmd ?? ''} ${target ?? ''}`.trim()
  const has = (...words) => words.every(w => combo.includes(w))

  if (has('dev', 'electron')) {
    return devElectron(opts)
  }
  else if (has('dev', 'web')) {
    return devWeb(opts)
  }
  else if (has('build', 'electron')) {
    return buildElectron(opts)
  }
  else if (has('build', 'android')) {
    return buildAndroid(opts)
  }
  if (cmd === 'init') {
    init()
  }
  else if (cmd === 'sync') {
    sync()
  }
  else if (cmd === 'icons') {
    icons()
  }
  else if (cmd === 'doctor') {
    doctor()
  }
  else {
    console.log(HELP)
    if (cmd) process.exit(1)
  }
}

main()
