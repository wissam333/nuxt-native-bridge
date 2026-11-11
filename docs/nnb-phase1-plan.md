# nnb Phase 1 (v0.1 core) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship v0.1 — the playground's Android shell becomes thin files over an `adapter-capacitor` package; the module owns splash, theme, safe area and apiBase; `nnb init` and `nnb dev` cover all three targets.

**Architecture:** Same shape as adapter-electron: a workspace package ships the native logic (`packages/adapter-capacitor/`), the app commits only thin native files (few-line `MainActivity`, config-driven themes). The Nuxt module (`src/module.ts` + `src/runtime/`) owns all JS-side behavior; the CLI (`packages/nnb`) generates config-derived native files during `nnb sync` and scaffolds apps in `nnb init`.

**Tech stack:** Nuxt module (`@nuxt/kit`), Capacitor 8 plugins (`@capacitor/app`, `@capacitor/splash-screen`, `@capacitor/status-bar`), plain Java for the Android library (matches Capacitor's own plugin sources — no Kotlin toolchain), Node CLI, `node --test`.

**Spec:** `../nuxt-native-bridge Full Specification and Roadmap.md` (§5 config, §6.3 adapter-capacitor, §7 composables, §8 security, audit 9.2/9.3 items 10-26, §10 Phase 1, §11 device verification).

**Out of scope here:** Phase 2/3 items (keyboard composable, deep links, LAN reload, FileSave, `.icns`, auto-update, CI) — sequenced at the end of this document, each gets its own plan when reached.

## Global Constraints

- Android library language: **Java** (no Kotlin toolchain; Capacitor plugin sources are Java).
- `MainActivity` in app code stays a **few lines that extend `NnbBridgeActivity`** — thin committed files are the eject path (spec §1/§6.3).
- Generated native files are written **between marker comments** and idempotent (re-running produces byte-identical files).
- `allowBackup="false"` + `dataExtractionRules` scaffolded (audit 15); manifest permissions only inside markers (audit 14).
- Brand color single source: `nativeBridge.brand.color` → themes, launcher background, capacitor config (audit 13).
- Edge-to-edge: **one native path** in `NnbBridgeActivity`, one CSS path; escape hatch `android.edgeToEdge: "manual"` (audit 17).
- Splash: Capacitor `launchAutoHide: false`; module hides on mount with `fade` and `failsafe` (audit 19).
- Electron adapter stays untouched: CJS `main.cjs`, sandboxed CJS preload, UI from asar; never import `@capacitor/app` in the Electron path.
- `nnb` runtime deps stay `jiti` + `sharp`; adapters are separate workspace packages.
- Spec config values verbatim (§5): `splash: { hideOn: "mounted", fade: 300, failsafe: 8000, light: "#0D8A8F", dark: "#0B1416" }`; theme palette from `brand.color` + splash `light`/`dark`.
- Spec deviation (recorded when done): maven mirrors go via `settings.gradle` markers + `nativeBridge.android.mavenMirrors` (working solution) instead of a Gradle init script (audit 11's letter).

## Review Focus

Input classes the spec implies but unit tests won't run — each pinned where the code lives; device-only checks batched in Task 9:

1. **System-dark cold start**: launch theme must be dark *before any window exists* → pinned by T2's generated `values-night/themes.xml` test.
2. **ThemePrefs says dark, system is light**: `MainActivity` must consult prefs *before* `super.onCreate` → code-position asserted in T2 (no unit test possible for JVM lifecycle; device check in T9).
3. **`apiBase` unset / web target**: no fetch rewrite, composable returns `undefined` → pinned by T5's test.
4. **Splash failsafe when mount never happens** (JS error, slow bundle): timer still hides the splash → pinned by T3's pure `computeSplashPlan` test + failsafe wiring.
5. **Double `nnb sync`**: second run byte-identical (markers not duplicated, manifest not corrupted) → pinned by T2's idempotency test.

---

### Task 1: `packages/adapter-capacitor` skeleton + `NnbBridgeActivity` + thin MainActivity

**Files:**
- Create: `packages/adapter-capacitor/package.json` (private, workspace)
- Create: `packages/adapter-capacitor/android/build.gradle` (`com.android.library`, compileSdk/minSdk/targetSdk matching playground's current values)
- Create: `packages/adapter-capacitor/android/src/main/java/com/nnb/bridge/NnbBridgeActivity.java`
- Create: `packages/adapter-capacitor/android/src/main/AndroidManifest.xml` (library manifest, empty)
- Modify: `packages/nuxt-native-bridge/playground/android/settings.gradle` — add `include ':nnb-bridge'` pointing at `../../../../adapter-capacitor/android` (same 4-up pattern as capacitor.settings.gradle) **inside markers**
- Modify: `packages/nuxt-native-bridge/playground/android/app/build.gradle` — `implementation project(':nnb-bridge')` inside markers
- Rewrite: `packages/nuxt-native-bridge/playground/android/app/src/main/java/.../MainActivity.java` — extends `NnbBridgeActivity`, no `onPermissionRequest` (audit 16), no `setDecorFitsSystemWindows` (audit 17: one native path)

**Interfaces:**
- Produces: `com.nnb.bridge.NnbBridgeActivity extends BridgeActivity` — public methods `onCreate()` (reads `ThemePrefs` **before** `super.onCreate`, applies `AppCompatDelegate.setDefaultNightMode`, sets edge-to-edge + contrast flags) and `getBridge()` visibility as Capacitor requires. Later tasks (T3 splash theme, T9 device) consume the theme classes T2 generates.
- Consumes: Capacitor `BridgeActivity` from `@capacitor/android` (declared in the library's build.gradle as `implementation project(':capacitor-android')` dependency chain via app).

- [ ] **Step 1: Rewrite playground `MainActivity` first** (thin, failing until the library exists — compiles are the test)

- [ ] **Step 2: Implement `NnbBridgeActivity`** — `onCreate` order: read prefs → night mode → `super.onCreate()` → edge-to-edge flags. No body beyond that; theme resources come from the app (T2).

- [ ] **Step 3: Gate** — `node D:\...\packages\nnb\cli.mjs build android` from playground → `BUILD SUCCESSFUL`, APK fresh.

- [ ] **Step 4: Commit** — `feat: adapter-capacitor library skeleton with NnbBridgeActivity; playground MainActivity goes thin`

### Task 2: Config-driven launch themes + manifest/native file sync in `nnb sync`

**Files:**
- Modify: `packages/nnb/native-sync.mjs` (new) — generation logic, exported pure helpers for tests
- Modify: `packages/nnb/commands.mjs` — `sync()` calls `nativeSync(appDir, cfg)` after `cap sync`
- Modify: `packages/nuxt-native-bridge/playground/nuxt.config.ts` — add `android: { splash: { hideOn: 'mounted', fade: 300, failsafe: 8000, light: '#0D8A8F', dark: '#0B1416' }, mavenMirrors: ['https://maven.aliyun.com/repository/google'] }`
- Modify (generated): `playground/android/app/src/main/res/values/styles.xml`, `values-night/styles.xml`, `AndroidManifest.xml` (permissions block between `<!-- nnb:permissions -->` markers, `allowBackup="false"`, `dataExtractionRules` file), `settings.gradle` (mirror markers from Task 1)

**Interfaces:**
- Produces: `nativeSync(appDir, cfg)` — cfg = same object `readAppConfig()` returns (`{ appId, appName, config }`). Pure helpers exported for tests: `renderThemes({ brand, splash })` → `{ lightXml, darkXml }`, `renderManifestPatch(manifest, permissions)` → string.
- Consumes: `readAppConfig()` from `lib.mjs`.

- [ ] **Step 1: Failing tests** (`packages/nnb/test/native-sync.test.mjs`): (a) `renderThemes` emits `AppTheme.NoActionBar` **light and dark** variants with `splash.light`/`splash.dark` window backgrounds and `brand.color` status-bar color (audit 18: dark variant exists); (b) `renderManifestPatch` inserts permissions between markers and **removes** stale marker content first; (c) idempotency: `renderManifestPatch(renderManifestPatch(m), p)` === `renderManifestPatch(m, p)`.

- [ ] **Step 2: Run** `pnpm -C packages/nnb test` → new tests FAIL (module missing).

- [ ] **Step 3: Implement** `native-sync.mjs` with those exact helpers + `nativeSync()` writer (markers, mtime-preserving skip if identical).

- [ ] **Step 4: Run** tests → PASS. **Gate:** `nnb sync` twice from playground → second run writes "0 files changed"; `gradlew assembleDebug` green.

- [ ] **Step 5: Commit** — `feat: config-driven themes + manifest/dataExtractionRules generation in nnb sync`

### Task 3: Splash owned by the module

**Files:**
- Create: `packages/nuxt-native-bridge/src/runtime/composables/useNativeSplash.ts` (not required as public API if plugin covers it — see step 1; create only if the plugin needs a shared helper)
- Modify: `packages/nuxt-native-bridge/src/runtime/plugin.client.ts` — after mount: `SplashScreen.hide({ fadeDuration: splash.fade })` guarded to `android` target, with `setTimeout(splash.failsafe)` failsafe registered at plugin setup (before mount, audit 19)
- Modify: `packages/nuxt-native-bridge/playground/capacitor.config.ts` — `launchAutoHide: false`, drop `launchShowDuration`
- Cleanup: remove any manual splash-hide/failsafe from playground `app/` (starter leftovers)

**Interfaces:**
- Produces: `computeSplashPlan(splashConfig)` — pure: returns `{ hideOnMounted: boolean, fade: number, failsafe: number }` with spec defaults `{ hideOn: 'mounted', fade: 300, failsafe: 8000 }` and clamps non-positive values to defaults. Used by the plugin.
- Consumes: `runtimeConfig.public.nativeBridge.android.splash`.

- [ ] **Step 1: Failing test** `packages/nuxt-native-bridge/test/splash.test.mjs`: `computeSplashPlan()` defaults; `computeSplashPlan({ fade: 0 })` → defaults; `computeSplashPlan({ fade: 500, failsafe: 12000 })` → passthrough.

- [ ] **Step 2: Run** module tests → FAIL. **Step 3: Implement** helper + plugin wiring (register failsafe at plugin *setup*, hide on `app:mounted`/`app:suspended` guard). **Step 4:** tests PASS.

- [ ] **Gate:** `nnb build android` green; grep proves zero `SplashScreen.hide` / `launchShowDuration` in playground app code.

- [ ] **Step 5: Commit** — `feat: module owns splash hide (fade + failsafe), autoHide off`

### Task 4: `useNativeSafeArea()` — real insets, CSS variables

**Files:**
- Create: `packages/adapter-capacitor/android/src/main/java/com/nnb/bridge/NnbInsetsPlugin.java` — `@CapacitorPlugin(name = "NnbInsets")`, method `getInsets()` returning `{ top, bottom }` from `WindowInsets` (real values; 0 when edge-to-edge off)
- Create: `packages/nuxt-native-bridge/src/runtime/composables/useNativeSafeArea.ts` — reactive `{ top, bottom }`; android target: plugin call → sets `--nnb-inset-top/bottom` on `:root` (one writer, audit 20); web/electron: `isSupported: false`, CSS vars keep `env() max()` fallback from `base.css`
- Modify: `src/module.ts` — register the new composable dir (already via `addImportsDir`)

**Interfaces:**
- Produces: `useNativeSafeArea(): { insets: Ref<{top:number,bottom:number}>, isSupported: boolean }`.
- Consumes: `NnbInsets` plugin (only when `data-nnb-target=android`).

- [ ] **Step 1: Failing test** — composable picks plugin path only on android target (mock window in node --test via `globalThis` injection used by existing module tests' pattern); web target returns `isSupported:false` untouched.

- [ ] **Step 2-4:** implement, PASS, `nnb build android` + `nnb build electron` green.

- [ ] **Step 5: Commit** — `feat: useNativeSafeArea with native insets plugin; CSS token fallback stays`

### Task 5: `apiBase` support

**Files:**
- Modify: `packages/nuxt-native-bridge/src/module.ts` — `ModuleOptions.apiBase?: string` (spec §5 `apiBase: process.env.API_BASE`), forwarded in the existing `runtimeConfig.public.nativeBridge` spread (no new writer)
- Create: `packages/nuxt-native-bridge/src/runtime/composables/useNativeApiBase.ts` — `useNativeApiBase(): string | undefined` (undefined on web)

**Interfaces:**
- Produces: `useNativeApiBase()` — apps do `$fetch(cfg.apiBase + path)` or set their own baseURL; the module only carries the value. No fetch interception (spec doesn't pin one; lazy).

- [ ] **Step 1: Failing test** — web target → `undefined` even when `apiBase` set; android target → value (Review Focus #3).

- [ ] **Step 2-4:** implement, PASS. **Gate:** `NUXT_TARGET=android nuxt build` artifact contains the value.

- [ ] **Step 5: Commit** — `feat: apiBase carried to runtime config on native targets`

### Task 6: `nnb dev web` + Electron asar/fuses verification gate

**Files:**
- Modify: `packages/nnb/commands.mjs` — `devWeb()`: spawn `nuxt dev` **without** `NUXT_TARGET` in env (delete it — it may leak from a caller's shell)
- Modify: `packages/nnb/cli.mjs` — dispatch `dev web` + help line

**Interfaces:** none new.

- [ ] **Step 1:** implement dispatch (one branch). **Step 2:** gate A — `nnb dev web` from playground + `NNB_SMOKE=1` + `NNB_SMOKE_EXPECT=NNB Playground` → `smoke ok` (port-wait probe reuses existing `waitPort`).
- [ ] **Step 3:** gate B (spec §11-1) — run the **packaged** Electron app (`out/NNB Playground-win32-x64/nnbplayground.exe`) with `NNB_SMOKE=1` → `smoke ok` proves asar-served UI boots; read fuses with `@electron/fuses` (CLI or node API, per its README) and assert `run_asar`/`enable_node_cli` state matches forge config in the output.

- [ ] **Step 4: Commit** — `feat: nnb dev web; asar+fuses verification gate for packaged electron`

### Task 7: `nnb init`

**Files:**
- Create: `packages/nnb/init.mjs` — scaffold logic; `commands.mjs` dispatch `init`
- Consumes: `readAppConfig`, `run`, `syncDir`, `electronEnv`; T2's `nativeSync`

Behavior (pinned, minimal):
- [ ] **Step 1:** read `nuxt.config.ts` via jiti; if `nativeBridge` missing → insert a marker-based block (`app.id/name` required, prompts via plain readline for the two values; everything else defaults).
- [ ] **Step 2:** deps: add `nuxt-native-bridge` + `@capacitor/core @capacitor/cli @capacitor/app @capacitor/splash-screen @capacitor/status-bar` (workspace-local dev flows; registry publish comes with Phase 3 — comment says so).
- [ ] **Step 3:** write `capacitor.config.ts` (thin: appId, appName, `webDir: '.output/public'`, `SplashScreen.launchAutoHide: false`, `backgroundColor` from `brand.color` — audit 13).
- [ ] **Step 4:** `cap add android` when no `android/` exists → overwrite `MainActivity` with the thin file; write `settings.gradle` mirror markers from `android.mavenMirrors`; run `nativeSync`.
- [ ] **Step 5:** electron: write thin `electron/main.cjs` (loads `adapter-electron` via `NNB_*` env defaults from config) + add `adapter-electron` dep (workspace-local until publish).
- [ ] **Step 6:** run `nnb icons` + `nnb doctor` and print the doctor table.

- [ ] **Gate:** on a throwaway copy of a minimal Nuxt app → `nnb init` → all three gates green (`nnb dev web` smoke, `nnb build electron` package, `nnb build android` APK). One-time e2e; throwaway dir gitignored/`%TEMP%`.

- [ ] **Step 7: Commit** — `feat: nnb init scaffolds thin native files for all three targets`

### Task 8: Ledger, README, compat table stub

- [ ] **Step 1:** `docs/nnb-plan.md` — Phase-1 rulings appended per task (one paragraph each, gate results).
- [ ] **Step 2:** `docs/compatibility.md` — stub table pinned: Nuxt 4.x, Electron/Forge current, Capacitor 8.x, JDK 21, targetSdk 36 (spec §12 "pinned from day one").
- [ ] **Step 3:** root README status → Phase 1 done. Commit + push.

### Task 9: §11 device verification batch (needs a real device — user-assisted)

Not executable in this environment; gate for T2/T3/T4 claims:
- [ ] Splash hide timing on slow cold start (no blank frame — audit 19)
- [ ] ThemePrefs dark override + system-dark cold start (audit 18/22)
- [ ] Real inset values on targetSdk 36 vs Capacitor's own handling (audit 17/20)
- [ ] Status bar style mapping on Capacitor 8 (audit 21 — confirm or flip)
- [ ] Back button: router state vs `canGoBack` (audit 23)

Record results in `docs/nnb-plan.md`; findings may amend Phase 2's `useNativeTheme` plan.

---

## Phase 2 (v0.2 polish) — sequenced steps, own plan when reached

1. `useNativeTheme()` (`isDark`, `set(dark)` → ThemePrefs + status bar style; audit 21 mapping verified by T9) — gate: unit + device item.
2. `useNativeKeyboard()` — `hide()`, `hideOnScroll`, `armDelay: 250`, `focusoutDelay: 120` as config defaults not magic numbers (audit 25); listener handles stored/removed (audit 24).
3. Back button hardening: router-state stack above `canGoBack`, `exitRoutes` → exit request (audit 23); gate: unit test with a fake router.
4. Deep links (assetlinks.json guidance + `App` listener).
5. Android LAN live reload (`nnb dev android` → host binding + `cap.config.server.url`).
6. `useNativeFile()` — hardened FileSave plugin (audit 27-30: internal cache dir, `File.getName()`, try-with-resources, FileProvider + `cache-path`, cleanup after share + startup sweep).
7. Manifest permission sync driver + `nnb doctor` permission audit (audit 14).
8. Titlebar hooks, `.icns`.

## Phase 3 (v0.3 release pipeline) — sequenced steps, own plan when reached

1. Release signing flow: guided keystore setup (unblocks the `docs/android-release.md` pending policy), `nnb build android --release` producing `.aab` + signed `.apk`.
2. macOS: `.dmg` maker + `.icns` (completes `nnb icons`).
3. Auto-update via GitHub Releases (`useNativeUpdater`, Electron `update-electron-app` path; requires signed builds — spec §8).
4. `nnb doctor` complete: signing, keystore, permission audit results, version check against `docs/compatibility.md`.
5. GitHub Actions template: CI builds web + electron + android and smoke-tests each (§12; the playground is the e2e).

## Phase 4 — later (tracked in spec only)

Tray/menus, multi-window, iOS adapter, `transitions`, per-target bundles, Nuxt version matrix.
