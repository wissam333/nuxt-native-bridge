<p align="center">
  <img src="docs/assets/banner.jpg" alt="nuxt-native-bridge — one Nuxt codebase → website, desktop, Android" width="100%" />
</p>

<h1 align="center">nuxt-native-bridge <em>(nnb)</em></h1>

<p align="center">
  <strong>One Nuxt codebase. Three native destinations.</strong><br/>
  Write your app once — nnb ships it as a <strong>website</strong>, a <strong>desktop app</strong> (Electron),
  and an <strong>Android app</strong> (Capacitor) with real native behavior: splash, safe areas,
  back button, status bar, theming.
</p>

---

## Why

Frameworks made "write once" easy for the *web*. But the moment your product needs a desktop
or mobile build, you're usually dragged into maintaining three divergent codebases — or shipping
a webview-in-a-box that feels nothing like a native app.

**nnb** is the bridge (literally — see the icon): one Nuxt 4 codebase, one config block, and a
small CLI that wires each native shell for you. The Nuxt module flips per-target behavior
(`NUXT_TARGET=web|electron|android`), the adapters own the native plumbing, and your app code
stays ordinary Nuxt.

```ts
// nuxt.config.ts — the only contract you learn
nativeBridge: {
  app: { id: 'com.example.app', name: 'My App' },
  brand: { color: '#0D8A8F' },
  icons: { source: 'public/icon.jpg' },
  android: { splash: { hideOn: 'mounted', fade: 300 } },
  backButton: { exitRoutes: ['/'] },
}
```

## Quick start

> The CLI isn't on npm yet — clone and run it locally (Node 24, pnpm).

```bash
git clone https://github.com/wissam333/nuxt-native-bridge.git
cd nuxt-native-bridge
pnpm install

# or scaffold a fresh app for all three targets:
node packages/nnb/cli.mjs init
```

Run the demo app (`packages/nuxt-native-bridge/playground`):

```bash
cd packages/nuxt-native-bridge/playground

node ../../nnb/cli.mjs dev web          # website
node ../../nnb/cli.mjs dev electron     # desktop shell with HMR

$env:NUXT_TARGET='android'; npx nuxt generate          # android build
node ../../nnb/cli.mjs build android    # → app-debug.apk (no Android Studio needed)
```

## The CLI

| Command | What it does |
| --- | --- |
| `nnb init` | Scaffolds a Nuxt app for all three targets (config, deps, Capacitor shell, Electron main, native files) |
| `nnb dev web \| electron` | Dev server; Electron opens inside the hardened shell with real HMR |
| `nnb build electron [--installer]` | Packaged desktop app (+ Squirrel installer) with fuses hardened |
| `nnb build android` | Generate → sync → Gradle → `app-debug.apk` (mirror pins for hostile networks included) |
| `nnb sync` | Regenerates the native files nnb owns — idempotent, preserves everything you authored |
| `nnb icons` | Web/desktop icons + Android mipmaps + splash logo from one config block |
| `nnb doctor` | 7-check environment audit (Node, JDK, SDK, Gradle, mirrors,…) |

## Layout

```
packages/
  nuxt-native-bridge/   the Nuxt module (target switch, boot script, runtime:
                        useNativeApp, useNativeSafeArea, useApiBase, base css)
    playground/         the demo app + its android/ electron shells
  adapter-electron/     hardened Electron shell: app:// protocol, sandbox, CSP,
                        window-state, single-instance, fuses + smoke probe
  adapter-capacitor/    shared Android bridge library: NnbBridgeActivity (splash
                        ownership, NnbInsetsPlugin, launch themes)
  nnb/                  the CLI (zero-dep except jiti + sharp)
docs/                   plan, progress ledger, compatibility matrix
```

## Status

- **Phase 1 — complete and device-verified.** Init, sync, splash ownership, safe-area insets,
  apiBase, dev/build/smoke pipelines, the `nnb` CLI — verified end-to-end on a Xiaomi
  (Android 16, MIUI/HyperOS): real splash behavior, real insets from the device cutout,
  theme-following dark mode. The device batch surfaced **seven real defects — all fixed and
  re-verified** (full record: [`docs/nnb-plan.md`](docs/nnb-plan.md) §7).
- Tests: module vitest 13/13 · CLI node:test 26/26 · lint clean.
- **Next:** Phase 2 module work — keyboard, theme (`useNativeTheme`), viewport — then adapter
  hardening and docs ([plan](docs/nnb-phase1-plan.md)).

## Docs

| Doc | What's inside |
| --- | --- |
| [`docs/nnb-plan.md`](docs/nnb-plan.md) | The working plan + full progress ledger (§7) |
| [`docs/nnb-phase1-plan.md`](docs/nnb-phase1-plan.md) | Phase 1 task breakdown (T1–T9) with gates |
| [`docs/compatibility.md`](docs/compatibility.md) | Tested versions: Nuxt 4.x, Capacitor 8.x, Electron/Forge, JDK 21, targetSdk 36 |
| [`nuxt-native-bridge Full Specification and Roadmap.md`](./nuxt-native-bridge%20Full%20Specification%20and%20Roadmap.md) | The full product spec |

---

<p align="center">
  <sub>Name decision (2026-11-09): package stays <strong>nuxt-native-bridge</strong> (descriptive, searchable,
  npm-verified free); the brand lives in the tagline and the <code>nnb</code> CLI name.</sub>
</p>
