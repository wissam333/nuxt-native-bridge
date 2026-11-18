<p align="center">
  <img src="docs/assets/banner.jpg" alt="nuxt-native-bridge: one Nuxt codebase → website, desktop, Android" width="100%" />
</p>

<h1 align="center">nuxt-native-bridge <em>(nnb)</em></h1>

<p align="center">
  <strong>One Nuxt codebase. Three native destinations.</strong><br/>
  Write your app once: nnb ships it as a <strong>website</strong>, a <strong>desktop app</strong> (Electron),
  and an <strong>Android app</strong> (Capacitor) with real native behavior: splash, safe areas,
  back button, status bar, theming.
</p>

---

## Why

Frameworks made "write once" easy for the *web*. But the moment your product needs a desktop
or mobile build, you're usually dragged into maintaining three divergent codebases, or shipping
a webview-in-a-box that feels nothing like a native app.

**nnb** is the bridge (literally, see the icon): one Nuxt 4 codebase, one config block, and a
small CLI that wires each native shell for you. The Nuxt module flips per-target behavior
(`NUXT_TARGET=web|electron|android`), the adapters own the native plumbing, and your app code
stays ordinary Nuxt.

```ts
// nuxt.config.ts: the only contract you learn
nativeBridge: {
  app: { id: 'com.example.app', name: 'My App' },
  brand: { color: '#0D8A8F' },
  icons: { source: 'public/icon.jpg' },
  android: { splash: { hideOn: 'mounted', fade: 300 } },
  backButton: { exitRoutes: ['/'] },
}
```

## Tutorial: one app → web, desktop, Android

> nnb ships as three npm packages: the `nuxt-native-bridge` module, the `@nnb/cli`
> tool and the `@nnb/adapter-electron` shell. One command scaffolds your app for all
> three targets. Node 20+ and pnpm recommended.

### 0 · Prerequisites

| Target | Needs |
| --- | --- |
| Web | Node 20+, pnpm |
| Desktop (Electron) | nothing extra (mirror pins included) |
| Android | JDK 21 + Android SDK + `adb` (no Android Studio needed) |

`nnb doctor` (run at the end of init) reports exactly what's missing.

### 1 · Create your app

```bash
pnpm create nuxt my-app     # pick pnpm when asked
cd my-app
pnpm dlx @nnb/cli init
```

`init` prompts for your **package id** (`com.you.myapp`) and **app name**, adds the
npm packages (`nuxt-native-bridge`, Capacitor, the `@nnb` toolchain), then wires all
three targets: the `nativeBridge` config block, the Capacitor Android shell, the
hardened Electron main, the native theme/splash files, and a `nnb doctor` check at
the end. Afterwards the app has its own copy of the CLI: run everything below with
`pnpm exec nnb ...`.

### 2 · The only contract: `nativeBridge` in `nuxt.config.ts`

```ts
nativeBridge: {
  app: { id: 'com.you.myapp', name: 'My App' },
  brand: { color: '#0D8A8F' },
  apiBase: 'https://api.example.com',   // carried to native targets only
  icons: {
    source: 'public/icon.jpg',          // web/desktop icons + favicons
    android: { glyph: 'public/glyph.png', background: ['#16211F', '#0A1311'] },
    splash: 'public/glyph.png',         // splash logo
  },
  android: { splash: { hideOn: 'mounted', fade: 300 } },
  backButton: { exitRoutes: ['/'] },    // routes where system back shows an exit modal
}
```

Changed branding? `pnpm exec nnb icons` regenerates everything from this block.

### 3 · Website

Your normal dev server. nnb does not change web:

```bash
pnpm dev             # same as ever; http://localhost:3000
```

(`pnpm exec nnb dev web` is an optional wrapper with a smoke check.)

### 4 · Desktop

```bash
pnpm exec nnb dev electron          # dev shell with real HMR
pnpm exec nnb build electron        # packaged app in the adapter's out/
pnpm exec nnb build electron --installer   # + Squirrel installer
```

### 5 · Android

```bash
pnpm exec nnb build android
```

One command: generates the android-target web assets, syncs the native shell, runs Gradle.

→ `android/app/build/outputs/apk/debug/app-debug.apk`, install with
`adb install -r <apk>` (some vendors, e.g. MIUI/HyperOS, pop an on-phone
confirmation dialog you must accept).

Two device quirks worth knowing: the cold-start splash follows the **system** dark mode
(Android 12+ resolves it before your code runs), and splash/launcher **icon caches only
refresh on a versionCode bump** in `android/app/build.gradle`.

### 6 · Native powers in your app code

| Composable | What it gives you |
| --- | --- |
| `useNativePlatform()` | `'web' \| 'electron' \| 'android'`, branch when needed |
| `useSafeArea()` | real device insets as CSS vars + refs (camera cutouts, gesture bars) |
| `useApiBase()` | your `apiBase` on native targets, `undefined` on web |
| `useNativeApp()` | `exit()` and app-state events (back button, exit modal) |

Splash, theming, safe-area padding, and back-button handling come for free; most apps
write zero platform code.

### Try the demo

The playground (`packages/nuxt-native-bridge/playground`) is a working example of all of
the above: dark-mode toggle, camera-cutout layout, keyboard demo, exit modal.

### From the clone (contributors)

```bash
git clone https://github.com/wissam333/nuxt-native-bridge.git nnb
cd nnb && pnpm install          # wires CLI + Nuxt module + both adapters
```

An app created inside the clone keeps working via relative-path wiring
(`node ../../packages/nnb/cli.mjs init` from the app dir); the demo lives in
`packages/nuxt-native-bridge/playground`.

## The CLI

| Command | What it does |
| --- | --- |
| `nnb init` | Scaffolds a Nuxt app for all three targets (config, deps, Capacitor shell, Electron main, native files) |
| `nnb dev web \| electron` | Dev server; Electron opens inside the hardened shell with real HMR |
| `nnb build electron [--installer]` | Packaged desktop app (+ Squirrel installer) with fuses hardened |
| `nnb build android` | Generate → sync → Gradle → `app-debug.apk` (mirror pins for hostile networks included) |
| `nnb sync` | Regenerates the native files nnb owns; idempotent, preserves everything you authored |
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

- **Phase 1: complete and device-verified.** Init, sync, splash ownership, safe-area insets,
  apiBase, dev/build/smoke pipelines, the `nnb` CLI, verified end-to-end on a Xiaomi
  (Android 16, MIUI/HyperOS): real splash behavior, real insets from the device cutout,
  theme-following dark mode. The device batch surfaced **seven real defects, all fixed and
  re-verified** (full record: [`docs/nnb-plan.md`](docs/nnb-plan.md) §7).
- Tests: module vitest 13/13 · CLI node:test 27/27 · lint clean.
- **Next:** Phase 2 module work (keyboard, theme (`useNativeTheme`), viewport), then adapter
  hardening and docs ([plan](docs/nnb-phase1-plan.md)).

## Docs

| Doc | What's inside |
| --- | --- |
| [`docs/nnb-plan.md`](docs/nnb-plan.md) | The working plan + full progress ledger (§7) |
| [`docs/nnb-phase1-plan.md`](docs/nnb-phase1-plan.md) | Phase 1 task breakdown (T1–T9) with gates |
| [`docs/compatibility.md`](docs/compatibility.md) | Tested versions: Nuxt 4.x, Capacitor 8.x, Electron/Forge, JDK 21, targetSdk 36 |
| [`nuxt-native-bridge Full Specification and Roadmap.md`](./nuxt-native-bridge%20Full%20Specification%20and%20Roadmap.md) | The full product spec |
