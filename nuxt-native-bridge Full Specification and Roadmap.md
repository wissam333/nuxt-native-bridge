# nuxt-native-bridge: Full Specification and Roadmap

One Nuxt codebase, shipped as a website, a desktop app (Electron), and an Android app (Capacitor), with fast setup and good developer experience. Open source. Derived from a real starter project (Arselha) and a full audit of its native code.

## 1. Vision and principles

- **Fast and easy:** zero-config dev, guided release. A developer runs one init command and can start all three targets in minutes. Signing, SDKs and store setup are guided by `nnb doctor`, not promised away.
- **One config block:** Nuxt, Electron and Capacitor behavior is controlled from a single `nativeBridge` block in `nuxt.config.ts`.
- **Isomorphic composables:** write app logic once; it adapts to web, desktop and Android. APIs are capability-based (`isSupported`), never silent no-ops.
- **Thin committed native files, logic in the package:** generated native files are a few lines that import from the package, so upgrading the package upgrades behavior without re-scaffolding. They are also the eject path: users can edit them freely.
- **Wrap existing tools, do not rebuild them:** Electron Forge, Capacitor CLI and plugins, sharp, the Gradle wrapper.
- **Backend-agnostic:** works with any backend (Supabase, REST, a deployed Nitro server). Nothing in the module assumes one.

## 2. Scope

**In scope (v1):** Web, Electron (Windows, macOS, Linux), Capacitor Android.

**Out of scope:**

- Offline-first features, storage bridge, local DB, sync, network monitor (explicitly dropped).
- Push notifications, biometrics, app lock/PIN, toasts and modal UI (app-level; they shaped the lifecycle API only).
- iOS (not in v1; the adapter design leaves room for it later).
- Page transition styles (optional separate package later).

## 3. Key architectural decisions

1. **Electron loads the app through a custom `app://` protocol** with an SPA fallback (any path without an extension returns `index.html`) and history-mode routing. No `baseURL: './'` and no hash mode needed. Capacitor uses `https://localhost`, which gives the same result.
2. **Electron is its own package** inside the project (`electron/` with its own `package.json`), so Electron dependencies stay isolated from the Nuxt root.
3. **Forge is the packager** (not electron-builder), because it is the official packager and matches the starter.
4. **Native folders are committed** (`android/`, `electron/`); the runtime lives in the package. `capacitor.config.json` and the Electron config are generated from `nativeBridge` on every `nnb` command and gitignored.
5. **Runtime platform detection in v0.1:** one `nuxt generate` feeds both Electron and Android; the module detects the platform at runtime. Per-target bundles are a later optimization.
6. **Nuxt 4 first.** Baseline: Nuxt 4.5, Electron 39, Forge 7, Capacitor 8, JDK 21, Android compileSdk/targetSdk 36, minSdk 24. Published as a compatibility table.
7. **No Nitro server in native builds.** The module exposes an optional `apiBase` and applies it to `$fetch` on native targets; docs include a CORS checklist.
8. **Android HTTP:** `CapacitorHttp.enabled: true` by default, so CORS is a non-issue on Android. On Electron the origin is `app://.`; backends with strict CORS must allow it (documented).
9. **Maven mirrors via a Gradle init script** passed by the CLI (`gradlew -I nnb-mirrors.gradle`), never by editing committed Gradle files. This helps developers on networks where Google's repository is unreachable.
10. **Config-driven viewport:** the module injects `viewport-fit=cover`; `user-scalable=no` is off by default (accessibility) and configurable.

## 4. Repository layout

```
packages/
  nuxt-native-bridge/        Nuxt module: config, build hooks, composables, base CSS, early-boot script
  adapter-electron/          main process, protocol server, secure window, preload, updater
  adapter-capacitor/         lifecycle plugin, theme/splash, Android library (NnbBridgeActivity, plugins)
  cli/                       nnb init | dev | build | sync | icons | doctor
  transitions/ (optional)    Flutter-style page transitions, later
playground/                  the Arselha starter, extracted
docs/                        Nuxt Content site
```

User project after `nnb init`:

```
nuxt.config.ts               nativeBridge block
electron/                    package.json, main.ts (few lines), preload.cts, forge.config.cjs
android/                     committed; MainActivity extends NnbBridgeActivity
.nnb/                        generated config (gitignored)
```

## 5. Config shape

```ts
nativeBridge: {
  app: { id: "com.example.app", name: "My App", version: "1.0.0" },
  brand: { color: "#0D8A8F" },            // single source: splash, nav bar, icon plate, notification color
  targets: ["web", "electron", "android"],
  apiBase: process.env.API_BASE,           // optional, applied on native targets
  baseStyles: true,                        // safe-area tokens, native resets
  electron: {
    window: { width: 1200, height: 800, minWidth: 900, minHeight: 600, frame: true },
    singleInstance: true,
    rememberWindowState: true,
    csp: "default"
  },
  android: {
    splash: { hideOn: "mounted", fade: 300, failsafe: 8000, light: "#0D8A8F", dark: "#0B1416" },
    mavenMirrors: ["https://maven.aliyun.com/repository/google"],
    permissions: ["CAMERA"],
    allowBackup: false,
    edgeToEdge: "auto"
  },
  backButton: { exitRoutes: ["/", "/dashboard/analysis"] },
  keyboard: { hideOnScroll: true, armDelay: 250, focusoutDelay: 120 },
  selection: { lockOnAndroid: true, allow: "input, textarea, [contenteditable], [data-selectable]" },
  viewport: { userScalable: true },
  icons: {
    source: "public/square-logo.png",
    android: { glyph: "public/3.png", background: ["#139CAE", "#0C6271"], glyphFraction: 0.5 },
    splash: "public/4.png"
  }
}
```

## 6. Package features

### 6.1 nuxt-native-bridge (module)

- **Build target switch:** `NUXT_TARGET=web|electron|android` sets SSR and preset for native targets; web stays untouched.
- **Early-boot head script (single owner):** sets `data-nnb-target` (`web`, `electron`, `android`) and `data-nnb-os` on `<html>`, plus safe-area minimums. Replaces the duplicated `capacitor-native` class logic.
- **Base CSS layer (opt-in):** `--app-safe-area-top/bottom` tokens built as `max(env(safe-area-inset-*), var(--safe-area-*-min))`; tap-highlight, touch-callout and overscroll resets; `html, body { height: 100dvh }` for native shells; text-selection lock scoped to Android only, with an allow-list (inputs, `[data-selectable]`).
- **Server-dependent module guard:** warns and fixes at build time: `@nuxt/image` provider `ipx` is switched to `none` on native targets; `@nuxt/icon` is forced to `fallbackToApi: false` with a client bundle.
- **Viewport meta injection** with `viewport-fit=cover`.
- **`apiBase` support** for `$fetch` on native targets.

### 6.2 adapter-electron

- `app://` protocol with SPA fallback, privileged scheme (`secure`, `standard`, `supportFetchAPI`, `corsEnabled`).
- Hardened handler: resolved path must stay inside the public directory; `decodeURIComponent` on the path.
- Content served from inside the asar through `fs` so the integrity fuses cover the UI (verify in Phase 1).
- Explicit dev/prod switch through an env var set by `nnb dev electron`; no file-existence guessing.
- Secure defaults: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` with a CJS preload exposing only `{ target: "electron", os }` via `contextBridge`.
- Window state persistence (size, position, maximized), single-instance lock, `will-navigate` and `setWindowOpenHandler` guards (external links open in the system browser), CSP header.
- Custom titlebar hooks: minimize, maximize, close, drag regions.
- Forge config generated from `nativeBridge`: Squirrel, zip and deb makers, fuses (RunAsNode off, cookie encryption on, asar integrity, OnlyLoadAppFromAsar), auto-unpack natives.
- Cross-platform copy step replaces `xcopy`.
- Later: auto-update through GitHub Releases, tray and menus, multi-window.

### 6.3 adapter-capacitor

- **Lifecycle plugin (one place for all listeners):** splash hide, back button, app state, keyboard; every listener handle is stored and removed on dispose (no HMR stacking).
- **Splash:** `launchAutoHide: false`; the module hides it on app mount with a configurable fade and failsafe.
- **Theme-aware splash and status bar:** `ThemePrefs` plugin persists `theme_dark` natively so `MainActivity` picks the right launch theme before the window exists; `useNativeTheme()` keeps status bar style and prefs in sync. Light and dark launch themes are generated from `brand` and `splash` config.
- **Android library:** `NnbBridgeActivity` (theme selection, edge-to-edge, contrast flags) shipped in the package. The user's `MainActivity` is a few lines that extend it. No dead `onPermissionRequest`.
- **Safe area:** real native insets when available, configurable fallbacks only when they read 0.
- **FileSave plugin (hardened):** internal `getCacheDir()` only, always shared through `FileProvider` (module adds the `cache-path` entry), filename reduced with `new File(name).getName()`, try-with-resources, cleanup after share and on startup.
- **Manifest sync:** `nativeBridge.android.permissions` writes between marker comments; `allowBackup="false"` and `dataExtractionRules` scaffolded.
- **`nnb sync`:** wraps `cap sync` so it is no longer a manual step.

### 6.4 cli

| Command | Purpose |
| --- | --- |
| `nnb init` | Scaffold `electron/`, `android/`, config block; install deps |
| `nnb dev web\|electron\|android` | Electron: starts `nuxt dev`, waits for the port, launches Electron with dev env var (real HMR). Android: live reload over LAN |
| `nnb build electron\|android` | Icons, `nuxt generate`, copy, then Forge make or Gradle assemble (APK/AAB), cross-platform |
| `nnb sync` | Wraps `cap sync` |
| `nnb icons` | Parametrized icon generator (see 6.5) |
| `nnb doctor` | Environment and project checks (see 6.6) |

### 6.5 Icon and splash generator

Generalized from the starter's sharp script. Inputs come from config (no hardcoded colors or paths):

- Web and desktop: `icon.png` (512), `icon-192x192.png`, favicon PNG, `.ico`, small badge; add `.icns` for macOS.
- Android: legacy, round and adaptive foreground and background mipmaps for all densities; glyph scaled to a configurable fraction of the canvas; programmatic gradient or flat background; circle mask for round icons.
- Splash logo drawables; no `splash.png` that collides with `splash.xml`.

### 6.6 `nnb doctor`

- Detects JDK (21), sets `JAVA_HOME` itself (no hardcoded path in `gradle.properties`), Android SDK, keystore and signing config.
- Permission audit: maps each manifest permission to the plugin or config that needs it and flags orphans.
- Server-dependency check (ipx, icon API, anything needing Nitro at runtime).
- Version check against the compatibility table.

## 7. Composables (capability-based API)

| Composable | Provides |
| --- | --- |
| `useNativePlatform()` | `{ target, os, isElectron, isAndroid, isNative }`, replaces every `globalThis.Capacitor?.isNativePlatform?.()` check |
| `useNativeApp()` | `onExitRequested(cb)`, `onResume(cb)`, `onPause(cb)`, `exit()`, `runExternal(fn)` |
| `useBackButton()` | Handler stack (`pushHandler`, `popHandler`) plus the global Android listener: top handler, then router back, then exit request on `exitRoutes` |
| `useNativeSafeArea()` | Reactive insets and the CSS variables |
| `useNativeTheme()` | `isDark`, `set(dark)`; syncs status bar style, native prefs and splash theme |
| `useNativeKeyboard()` | `hide()`, optional hide-on-scroll |
| `useNativeWindow()` | Desktop only: minimize, maximize, close, fullscreen; `isSupported: false` elsewhere |
| `useNativeFile()` | `share(blob, name)`, `save(blob, name)`: FileProvider share and document picker on Android, `showSaveDialog` on Electron, download link on web |
| `useNativeUpdater()` | Later phase |

Example of the starter's `app.vue` after migration:

```ts
const { onExitRequested, onResume, exit } = useNativeApp()
onExitRequested(() => (showExitModal.value = true))
onResume(() => { if (hasPin.value && !isAuthRoute.value) lock() })
// share/file flows:
await runExternal(() => Share.share({ ... }))
```

`runExternal` suppresses the next resume event, replacing the starter's `fileDialogOpen` and `shareDialogOpen` flags and its global click listener (which was never removed).

## 8. Security defaults

- Electron: context isolation, no Node integration, sandbox on, CJS preload exposing only a platform flag, fuses on, UI served from asar, path traversal guard, navigation and window-open guards, CSP.
- Android: `allowBackup="false"` and data extraction rules, cleartext off, minimal declared permissions, FileProvider for all file sharing, filename sanitization, no blanket WebView permission grants.
- Packaging notes in docs: code signing and notarization are required for auto-update and are guided, not automated.

## 9. Audit findings and how the module fixes each

### 9.1 Electron

1. **Dev/prod decided by file existence** (`!fs.existsSync(public/index.html)`). After any `nuxt generate`, `electron-forge start` loads the stale static build; no HMR; a stale `.output` silently overrides dev. Fix: explicit env var from `nnb dev electron`.
2. **`xcopy` in scripts is Windows-only.** Fix: Node copy step in `nnb build`.
3. **UI files live outside the asar** (`app.asar.unpacked/public_nuxt`), so asar integrity fuses do not cover them. Fix: serve from asar via `fs`.
4. **Protocol handler:** no check that the resolved path stays inside `publicDir`; no `decodeURIComponent`, so filenames with spaces break. Fix: hardened handler.
5. **`sandbox: false` plus `.mjs` preload** for a preload that exposes one boolean. Fix: CJS preload, `sandbox: true`.
6. **Missing desktop basics:** single-instance lock, window state persistence, navigation guards (external links open inside the app today), CSP. Fix: built in.
7. **`loadWindow` passes a `#route` hash** although the app uses history routing, so it is effectively unused. Fix: module routes through the protocol only.
8. **No auto-update.** Fix: roadmap Phase 3 (Forge/Squirrel with GitHub Releases).
9. **CORS on `app://`.** Strict backends must allow the origin. Fix: docs checklist; Android is covered by `CapacitorHttp`.

### 9.2 Android build and project

10. **`gradle.properties` hardcodes a Windows JDK path.** Machine-specific; should not be committed. Fix: `nnb doctor` sets `JAVA_HOME`.
11. **Maven mirrors patched into committed `build.gradle`.** Fix: Gradle init script via the CLI.
12. **`cap sync` is a manual step.** Fix: `nnb sync` and `nnb build android`.
13. **Brand color `#0D8A8F` hardcoded in four places** (`styles.xml`, `capacitor.config.ts`, icon script, generated `ic_launcher_background.xml`). Fix: single `brand.color`.
14. **Permissions declared with no matching plugin:** fine and coarse location, `RECEIVE_BOOT_COMPLETED`, `READ_MEDIA_IMAGES` are likely unused (FCM does not need boot; the system file picker needs no storage permission). Unused sensitive permissions invite Play review questions. Fix: `nnb doctor` permission audit (app-level cleanup also recommended).
15. **`allowBackup="true"` in a money app.** Session data in WebView storage can be backed up off-device. Fix: `allowBackup="false"` plus `dataExtractionRules`.

### 9.3 Android runtime and native code

16. **Dead `onPermissionRequest` in `MainActivity`.** It is not an override (that method belongs to `WebChromeClient`); camera works through Capacitor's own client plus the manifest permission. If someone "fixed" it, it would grant every web permission blindly. Fix: removed from scaffolded `MainActivity`.
17. **Edge-to-edge configured in three places** (`MainActivity` `setDecorFitsSystemWindows(false)`, `StatusBar.setOverlaysWebView`, CSS tokens). Fix: one native path in `NnbBridgeActivity`, one CSS path; `android.edgeToEdge: "manual"` as an escape hatch. Verify on device.
18. **`AppTheme.NoActionBar` has no dark variant** while both launch themes do, so after the splash a dark-mode user can see a light window background; its `navigationBarColor` is likely ignored with targetSdk 36 edge-to-edge. Fix: generate light and dark themes from config; verify on device.
19. **Splash hides at a fixed 2 seconds** (`launchAutoHide: true`, `launchShowDuration: 2000`) regardless of readiness, so the manual `SplashScreen.hide()` and 8s failsafe in `app.vue` never take effect on a slow cold start (blank WebView frame shows). Fix: `launchAutoHide: false`, module owns the hide.
20. **Safe-area fallback is a guessed 32px/16px**, written twice (head script and `useStatusBar`, guarded so they do not conflict). Fix: real native insets first, configurable fallbacks, one writer.
21. **`useStatusBar` style mapping looks inverted** against Capacitor's docs (`isDark ? Style.Light : Style.Dark`). The starter may be correct on Capacitor 8; verify on device. Fix: `useNativeTheme()` hides the mapping.
22. **`catch {}` everywhere swallows real native failures** (a missing plugin looks like running on web). Fix: check the platform first; let real errors surface.
23. **Back button uses Capacitor's `canGoBack`** (WebView history), not Vue Router state, and has no concept of root routes, so back can walk history into the login page. Fix: router state plus `exitRoutes`.
24. **Listeners never removed** (backButton, appStateChange, keyboard, scroll, focusout, global click): they stack under HMR and one back press can fire several handlers. Fix: store handles, remove on dispose.
25. **Keyboard module:** undocumented magic numbers (250 ms, 120 ms). Fix: config defaults. The hide-on-scroll behavior itself is kept as an option.
26. **Platform detection duplicated** in the head script, navbar and several composables. Fix: `useNativePlatform()` and `data-nnb-target`.

### 9.4 FileSave plugin

27. **Invoices written to `getExternalCacheDir()`** with a `file://` URI. On Android 7 to 10 other apps with storage permission can read it; the files are invoices and receipts. Fix: internal cache plus FileProvider.
28. **`fileName` not sanitized** (`new File(cacheDir, fileName)` accepts `../`). Fix: `new File(name).getName()`.
29. **No cleanup;** files accumulate. Fix: delete after share, sweep on startup.
30. **`FileOutputStream` not closed on error.** Fix: try-with-resources.

### 9.5 Web and Nuxt

31. **`image.provider: "ipx"` needs a server.** `<NuxtImg>` breaks in static native builds. Fix: switch to `none` on native; doctor warns.
32. **`@nuxt/icon` API fallback needs a server.** The starter already set `fallbackToApi: false` and a client bundle; the module enforces it.
33. **`body { user-select: none }` applies everywhere,** including web and desktop, so users cannot copy account numbers or references. Fix: scope to Android; allow-list inputs and `[data-selectable]`.
34. **Platform CSS class covers only Capacitor.** Fix: `data-nnb-target` and `data-nnb-os` on `<html>`.
35. **`viewport` uses `user-scalable=no`.** Hurts accessibility. Fix: configurable, zoom allowed by default.
36. **`nitro.preset: static` and `ssr: false` apply to every target** including web. Fix: per-target switch (web keeps its normal setup unless the app opts into SPA).

### 9.6 App-level items (not module work, fix in the starter)

37. `document.documentElement.lang` is set to `"en"` unconditionally in `app.vue`; use `locale.value` (affects screen readers and font selection for Arabic).
38. `AppModal` watches `modelValue` without `immediate: true`, so a dialog that mounts already open never registers its back handler.
39. Remove unused permissions (item 14) and the dead `onPermissionRequest` from the app.
40. Swap the 32px head-script fallback and duplicate `useStatusBar` logic for the module once available.

### 9.7 Starter features that become module features

- `app://` protocol handler and privileged scheme
- Theme-aware native splash (`MainActivity` reads `theme_dark` before window creation; `ThemePrefsPlugin` writes it)
- Safe-area tokens and native resets
- `useBackButton` handler stack
- Splash hide with fade and failsafe
- Keyboard hide-on-scroll
- `FileSavePlugin` (hardened) as `useNativeFile()`
- Icon generator with adaptive icons, round masks, ICO and splash
- Cross-platform build chain (`make:electron`)
- Maven mirrors support

## 10. Roadmap

### Phase 0: Extract (1 to 2 weeks)

1. Create the monorepo; move the starter in as `playground/`.
2. Extract `adapter-electron` first (protocol, secure window, explicit dev/prod). Fixes items 1 to 7.
3. Extract `useNativePlatform`, `useBackButton`, the early-boot script and base CSS.
4. Extract and parametrize the icon generator.
5. Build `nnb dev|build` for Electron and Android, plus `nnb doctor`.

**Acceptance:** the playground builds web, Electron and Android using only the module and a `nativeBridge` block, with no native hacks left in app code.

### Phase 1: v0.1 core

- Target switch and path fixes, `nnb init` and `nnb dev` for all three targets
- Hardened Electron adapter, asar serving verified, secure preload
- `useNativePlatform`, `useBackButton`, `useNativeApp`, `useNativeSafeArea`
- Splash owned by the module; `NnbBridgeActivity`; theme-aware splash
- `apiBase` support

### Phase 2: v0.2 polish

- Window state, single instance, titlebar hooks, navigation guards, CSP
- `useNativeTheme`, `useNativeKeyboard`, deep links
- Android live reload over LAN
- `useNativeFile` (share and save)
- Manifest permission sync

### Phase 3: v0.3 release pipeline

- `nnb build` producing `.exe`, `.deb`/zip, `.dmg`/zip, `.apk`, `.aab`
- `nnb icons` including `.icns`
- Auto-update through GitHub Releases
- `nnb doctor` complete (signing, keystore, permission audit)
- GitHub Actions template building all targets

### Phase 4: later

Tray and menus, multi-window, iOS adapter, optional `transitions` package, per-target bundles, Nuxt version matrix growth.

## 11. Verify on a real device in Phase 1

- Serving the UI from inside the asar with `net.fetch` or `fs` and fuses enabled.
- Status bar style mapping on Capacitor 8 Android.
- Edge-to-edge behavior and real inset values on targetSdk 36; whether Capacitor's own inset handling replaces the manual calls.
- Whether `android:navigationBarColor` has any effect.
- Back button behavior with Vue Router state versus `canGoBack`.

## 12. Open-source hygiene

- The playground doubles as the e2e test: CI builds each target and smoke-tests it.
- Docs site on Nuxt Content; the main page is "Convert my existing Nuxt app".
- Compatibility table pinned from day one (Nuxt, Electron, Forge, Capacitor, JDK, Android SDK levels).
- Maintenance risk is managed by wrapping existing tools and keeping native files thin.

## 13. Risks

- Release setup (signing, notarization, keystores, SDKs) cannot be fully automated; the promise is zero-config dev and guided release.
- Tracking Nuxt, Electron and Capacitor majors is ongoing work; the compatibility table and CI matrix are the mitigation.
- Some starter assumptions (asar serving, status bar mapping, edge-to-edge) need device verification before being locked in.

## 14. Files from the starter still unseen

None of these block Phase 0: the app-lock and notification composables, `useTheme`, and the Android `file_paths.xml`. They only affect small details.

## 15. Building it as a Nuxt module

Decision: the product is a **Nuxt module** (`nuxt-native-bridge`) plus a **CLI package** (`nnb`). A starter template is a later add-on built from the playground.

### 15.1 Rules of Nuxt modules

- A module runs at **build time only**. `src/module.ts` changes config and registers things; code that runs inside the user's app lives in `src/runtime/`.
- Use `@nuxt/kit` helpers (`defineNuxtModule`, `createResolver`, `addImportsDir`, `addPlugin`) instead of manual alternatives.
- Never import `@nuxt/kit` from runtime code.
- Auto-imports do not work in module files (including the playground while developing the module). In `src/runtime/` import explicitly, for example `import { useRuntimeConfig } from '#imports'`.
- Options live under a config key (`nativeBridge`) declared through `meta.configKey` and `defaults`.
- Declare compatibility in `meta.compatibility` (`nuxt: ">=4.0.0"`).
- `@nuxt/module-builder` builds the module with zero configuration; `prepack` produces `dist/`.
- The module can only change the Nuxt side. Electron, Android, icons and `doctor` live in other workspace packages.

### 15.2 Exact setup steps

1. Create the workspace:

```bash
mkdir nuxt-native-bridge-repo && cd nuxt-native-bridge-repo
mkdir packages && cd packages
npm create nuxt -- -t module nuxt-native-bridge
```

2. At the repo root add `pnpm-workspace.yaml` with `packages: ["packages/*"]`.
3. Inside `packages/nuxt-native-bridge` run `pnpm install`, `pnpm run dev:prepare`, then `pnpm run dev` (starts the playground).
4. Starter layout: `src/module.ts` (build-time), `src/runtime/` (shipped to user apps), `playground/` (test app), scripts `dev`, `dev:prepare`, `lint`, `test`, `prepack`, `release`.
5. Write `src/module.ts` (shape below).
6. Add the first runtime files (15.4).
7. Point the playground at the module: `modules: ["../src/module"]` and a `nativeBridge` block.
8. Run `pnpm run lint`, `pnpm run test`, then `pnpm run release`. Check the package name is free on npm before the first publish.

### 15.3 `src/module.ts` shape

```ts
import { defineNuxtModule, createResolver, addImportsDir, addPlugin } from "@nuxt/kit"

export interface ModuleOptions {
  app: { id: string; name: string }
  brand: { color: string }
  baseStyles: boolean
  apiBase?: string
}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: "nuxt-native-bridge",
    configKey: "nativeBridge",
    compatibility: { nuxt: ">=4.0.0" },
  },
  defaults: {
    app: { id: "com.example.app", name: "My App" },
    brand: { color: "#0D8A8F" },
    baseStyles: true,
  },
  setup(options, nuxt) {
    const resolver = createResolver(import.meta.url)
    const target = process.env.NUXT_TARGET || "web"

    if (target !== "web") {
      nuxt.options.ssr = false
      nuxt.options.nitro.preset = "static"
    }

    nuxt.options.runtimeConfig.public.nativeBridge = { ...options, target }

    nuxt.options.app.head.script ||= []
    nuxt.options.app.head.script.push({
      innerHTML: `document.documentElement.dataset.nnbTarget=${JSON.stringify(target)}`,
    })

    if (options.baseStyles) {
      nuxt.options.css.push(resolver.resolve("./runtime/base.css"))
    }

    addImportsDir(resolver.resolve("./runtime/composables"))
    addPlugin({ src: resolver.resolve("./runtime/plugin.client"), mode: "client" })
  },
})
```

### 15.4 First runtime files

- `src/runtime/base.css`: safe-area tokens and native resets (from the starter's `main.scss`).
- `src/runtime/plugin.client.ts`: lifecycle plugin (splash hide, back button, app state), with listener cleanup.
- `src/runtime/composables/useNativePlatform.ts`
- `src/runtime/composables/useBackButton.ts` (from the starter's handler stack)

### 15.5 What lives outside the module

```
packages/nuxt-native-bridge   the module (this section)
packages/adapter-electron     protocol server, secure window, Forge config (Phase 0, step 2)
packages/adapter-capacitor    lifecycle plugin native side, Android library
packages/cli                  nnb init | dev | build | sync | icons | doctor (Phase 0, step 5)
```

Order of work: build the module package first with the Arselha code as the playground, then add `adapter-electron`, then the CLI.
