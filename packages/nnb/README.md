# @nnb/cli

The `nnb` command-line tool: dev, build and doctor commands for web, Electron and
Android targets of [nuxt-native-bridge](https://www.npmjs.com/package/nuxt-native-bridge).

```bash
pnpm dlx @nnb/cli init    # scaffold your Nuxt app for all three targets
pnpm exec nnb dev web     # then: website, desktop, Android
```

Full tutorial: [github.com/wissam333/nuxt-native-bridge](https://github.com/wissam333/nuxt-native-bridge).

| Command | What it does |
| --- | --- |
| `nnb init` | Scaffolds a Nuxt app for all three targets (config, deps, Capacitor shell, Electron main, native files) |
| `nnb dev web \| electron` | Dev server; Electron opens inside the hardened shell with real HMR |
| `nnb build electron [--installer]` | Packaged desktop app (+ Squirrel installer), fuses hardened |
| `nnb build android` | Generate → sync → Gradle → `app-debug.apk` (mirror pins for hostile networks included) |
| `nnb sync` | Regenerates the native files nnb owns; idempotent, preserves everything you authored |
| `nnb icons` | Web/desktop icons + Android mipmaps + splash logo from one config block |
| `nnb doctor` | 7-check environment audit (Node, JDK, SDK, Gradle, mirrors, …) |

MIT license.
