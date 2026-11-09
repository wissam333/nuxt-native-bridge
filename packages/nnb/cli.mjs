// nnb — nuxt-native-bridge CLI. argv dispatch only; logic lives in commands.mjs.
// Usage: nnb <command> <target> [--flags]. See help for the current Phase 0 set.
import { devElectron, buildElectron, buildAndroid, sync, doctor } from './commands.mjs'

const [cmd, target, ...flags] = process.argv.slice(2)
const opts = {
  port: Number(flags.find(f => f?.startsWith('--port='))?.slice('--port='.length)) || undefined,
  installer: flags.includes('--installer'),
}

const HELP = `nnb — nuxt-native-bridge CLI (Phase 0)

  nnb dev electron           Nuxt dev server (HMR) inside the Electron shell
  nnb build electron [--installer]   static UI build → www sync → Forge package
                             (--installer adds the Squirrel installer pass)
  nnb build android          cap sync + gradlew assembleDebug → APK
  nnb sync                   cap sync only
  nnb doctor                 environment & project checks

Run inside the app directory (the Nuxt app using nuxt-native-bridge).
`

export function main() {
  const combo = `${cmd ?? ''} ${target ?? ''}`.trim()
  const has = (...words) => words.every(w => combo.includes(w))

  if (has('dev', 'electron')) {
    devElectron(opts)
  }
  else if (has('build', 'electron')) {
    buildElectron(opts)
  }
  else if (has('build', 'android')) {
    buildAndroid(opts)
  }
  else if (cmd === 'sync') {
    sync()
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
