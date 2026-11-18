# @nnb/cli

The `nnb` command line tool for [nuxt-native-bridge](https://www.npmjs.com/package/nuxt-native-bridge):
scaffold a Nuxt app once, then ship it as a website, a desktop app (Electron) and an
Android app (Capacitor) from the same codebase.

```bash
pnpm dlx @nnb/cli init          # scaffold: config, deps, Electron shell, Android project
pnpm dev                        # website stays your normal Nuxt dev server
pnpm exec nnb build electron    # packaged desktop app (fuses hardened)
pnpm exec nnb build android     # generate + sync + Gradle, one command, APK out
```

Full tutorial, per-target guides and specs: [github.com/wissam333/nuxt-native-bridge](https://github.com/wissam333/nuxt-native-bridge).

## Commands

| Command | What it does |
| --- | --- |
| `nnb init` | Scaffolds a Nuxt app for all three targets: `nativeBridge` config block, deps, Capacitor Android project, hardened Electron shell, native theme/splash files, `doctor` check |
| `nnb dev web \| electron` | Dev server; the Electron variant opens inside the hardened shell with real HMR |
| `nnb build electron [--installer]` | Packaged desktop app (+ Squirrel installer), Electron fuses hardened |
| `nnb build android` | Generates the android-target web assets, syncs the native shell, runs Gradle, reports the APK path |
| `nnb sync` | Regenerates the native files nnb owns; idempotent, preserves everything you authored |
| `nnb icons` | Web/desktop icons + Android mipmaps + splash logo from `nativeBridge.icons`. Asks for a logo path when that block is missing, or inserts it commented out |
| `nnb doctor` | 7-check environment audit: Node, electron adapter, `nativeBridge` config, module install, JDK, Android SDK, android project |

## Notes

- Requires Node 20.19+. npm and pnpm both work for every target; commands above show
  pnpm and `npx nnb ...` is equivalent. Android builds need JDK 21 and the Android
  SDK; `nnb doctor` tells you exactly what is missing.
- `init` is idempotent: re-running it keeps your edits and only fills in what is
  missing.
- Every command runs from your app directory; the CLI resolves the Nuxt module and
  the Electron adapter from your app's `node_modules`.

## Troubleshooting

- Windows says "An Application Control policy has blocked this file" when the desktop window should open: Smart App Control is on and refuses the unsigned `electron.exe`. Turn Smart App Control off (Windows Security > App & browser control > Smart App Control; this is one-way, re-enabling needs a Windows reset) or run the desktop build on another machine. Web and Android targets are unaffected.

MIT license.
