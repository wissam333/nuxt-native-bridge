# nnb plan — this repo → the spec

Source of truth: `nuxt-native-bridge Full Specification and Roadmap.md` in the repo root.
This file answers one question: **what is this repo today, and what work remains here.**

## 1. What this repo is now

A copy of the Arselha wallet starter, cleaned on 2026-11-08 into the nnb **playground**.
It is not yet the monorepo from spec §4 (`packages/nuxt-native-bridge`, `adapter-*`, `cli`);
that restructure is Phase 0 work, done here without moving the app elsewhere.

## 2. Cleanup record (what was removed, and what was kept)

Removed (wallet/business app code — recoverable from git history):

- `app/pages` (59), `app/components` (58), `app/middleware`, `app/plugins` (supabase, z-auth,
  toast, fancybox, force-latin-digits), `app/config`, `app/utils`, extra layouts.
- `app/composables`: only the 4 native ones were kept
  (`useBackButton`, `useStatusBar`, `useKeyboard`, `useTheme`).
- `i18n/`, `supabase/`, `screens/`, root `assets/`, `.output/`, `dist/`, `.nuxt/`.
- Backend & legacy docs: `PROJECT_INSTRUCTIONS.md`, `SETUP.md`, `BUILD_PLAN.md`,
  `PLAN-barq-cash-api.md`, `MULTI_WALLET_REMAINING.md`, `ADDITIONAL_FIXES.md`,
  `SECURITY-INCIDENT-REPORT-2026-10-09.md`, `RLS_POLICIES.md`, `update.md`, the two SQL files,
  the two `*-api-test.html` files, `wrangler.jsonc`, `supabase_logs (3).json`,
  `docs/superpowers/`, `docs/PLAYSTORE-HIDDEN-FEATURES.md`.
- `public/`: `Arselha.apk`, `KYC/`, `notify/`, `firebase-messaging-sw.js`.
- `.env` (old Supabase keys — nothing references them anymore).

Dependencies trimmed to what the playground needs: Nuxt + `@nuxt/icon` + `@nuxt/image`,
Capacitor core set (app, keyboard, share, splash-screen, status-bar, android, cli), icon sets.
`sharp` moved to devDependencies (the icon generator imports it). Dropped firebase, jspdf,
html2canvas, chart.js, vue-chartjs, qrcode, uuid, vee-validate, vueuse, i18n, fonts, supabase-js,
native-biometric, haptics, network, push-notifications, fancyapps.
The two generated Capacitor gradle files (`capacitor.settings.gradle`,
`app/capacitor.build.gradle`) were edited to match, so `gradlew` still resolves.

Kept: everything listed in `README.md` (the raw-material table).

## 3. Playground app (current shape)

- `app/app.vue` — thin shell with the native hooks the module will own: splash hide +
  8s failsafe, back-button handler stack → router back → exit modal, keyboard setup,
  theme + status-bar sync. No supabase, no app-lock, no toast, no i18n.
- `app/pages/index.vue` — platform facts, theme palette demo, link to demo page.
- `app/pages/kbd.vue` — keyboard hide-on-scroll inputs + back-handler stack demo.
- `app/layouts/default.vue` — header with dark toggle.
- Demo styles are plain utility classes in the pages/components (the "real" tokens come
  from `main.scss`).

## 4. Phase 0 checklist (spec §10), mapped to this repo

1. **[done]** Clean the starter → playground (this cleanup).
2. **Extract `adapter-electron`** from `my-app/`:
   - explicit dev/prod env var instead of `fs.existsSync` (§9.1 / 1);
   - hardened `app://` handler (path stays inside publicDir, `decodeURIComponent`) (§9.1 / 4);
   - serve UI from inside the asar via `fs` (§9.1 / 3);
   - CJS preload + `sandbox: true` (§9.1 / 5).
3. **Module skeleton** (`packages/nuxt-native-bridge` per spec §15): `src/module.ts` shape from
   §15.3, `runtime/base.css` from `app/assets/scss/main.scss`, `runtime/composables/`
   (`useNativePlatform`, `useBackButton`), `plugin.client.ts` lifecycle (splash/back/appState,
   listener cleanup). Remove the early-boot head script and the 4 composables from the
   playground once the module takes over (audit items 23-26, 34, 40).
4. **`nnb dev|build`** from `scripts/` + `my-app/` (Node copy already replaces xcopy) +
   `nnb doctor` (starts by checking JDK/SDK, killing the hardcoded `JAVA_HOME` in
   `android/gradle.properties` when committing the module, §9.2 / 10).
5. **Icon generator parametrization** from `scripts/generate-icons.mjs` (config-driven
   inputs/brand, §6.5).

Acceptance (spec): playground builds web, Electron and Android using only the module and a
`nativeBridge` block, with no native hacks left in `app/` code.

## 5. Known leftovers from the starter (deliberate)

- `android/app/build.gradle` still forces androidx.biometric 1.1.0 and has Firebase guards —
  harmless now; the permission audit (§6.6, §9.2 / 14) will clean these **in the scaffolded
  project**, not by hand here.
- `capacitor.config.ts` still has starter values (SplashScreen auto-hide, `user-scalable=no`
  viewport in `nuxt.config.ts`) — they stay visible on purpose: they are audit items the module
  fixes (19, 35), and it should be obvious once the module owns them.
- `docs/android-release.md` kept: signing/Play release notes feed the `nnb doctor` / docs work.

## 7. Progress ledger

- **2026-11-08** — Phase 0 step 0: starter cleaned into playground; all three targets verified
  (web generate, Electron installer, Android APK).
- **2026-11-08** — Electron build fix: `@electron/get` re-fetches SHASUMS256.txt from GitHub's
  CDN, which times out here even with a warm zip cache → `electron_mirror` pinned to npmmirror
  in `playground/.npmrc`. When `nnb` exists, the CLI should own this (like the Gradle mirrors).
- **2026-11-09** — Node 24.22.2 (LTS) installed per-user at `~/.tools/node24` (own npm + pnpm);
  PowerShell profiles prepend it. No admin needed (UAC denied MSI installs).
- **2026-11-09** — Phase 0 step 1: monorepo created (`packages/nuxt-native-bridge` from the
  module template; Arselha app moved to `playground/`; `workspace:*` link; pnpm 12
  `allowBuilds` for esbuild + @parcel/watcher; lint ignores for native trees).
- **2026-11-09** — Phase 0 step 2/module skeleton ✅ verified: `src/module.ts` (nativeBridge
  block, NUXT_TARGET switch, early-boot script), `runtime/base.css`, composables
  (`useNativePlatform`, `useBackButton`, `useNativeApp`), `runtime/plugin.client.ts`
  (splash/back/app-state with install guard + unmount cleanup). Playground: module wired,
  early-boot script deleted, `useBackButton.js` deleted, `app.vue` consumes
  `onExitRequested`. Web + android generates fingerprint-verified (boot script + base css in
  bundle; ssr:false/static preset on android only); `nuxt dev` HTTP 200; lint 0 problems;
  template test 1/1.
- **2026-11-09** — Repo published to GitHub (`wissam333/nuxt-native-bridge`, public) at commit
  `7cbaf6d` (148 files). Pre-publish cleanup: stale `my-app/public_nuxt/` wallet build copy and
  `android/app/google-services.json` deleted (user-approved); keystores stay on disk but are
  gitignored at root AND android level. Dropped the nested `packages/nuxt-native-bridge/.git`
  (npm create nuxt scaffold — it blocked `git add` root-wide). `.opencode/`, `.agents/`,
  `.history/` added to root .gitignore (agent/IDE residue). `git user.name` set to
  "Wissam Najjom". Fresh-clone release builds fail without the keystore — release policy
  pending (see docs/android-release.md).
- **2026-11-09** — Phase 0 step 3: `packages/adapter-electron` extracted (spec §6.2, audit
  9.1/1–7) ✅ verified. Monorepo root moved to repo root: pnpm-workspace.yaml now lists
  `packages/*` + `packages/*/playground`; `allowBuilds` + `electron`/`electron-winstaller`
  added; `blockExoticSubdeps: false` for Forge's git-based `@electron/node-gyp` subdep;
  electron mirror promoted to root `.npmrc`; package-level workspace yaml + stale lock
  removed. Adapter: CJS `main.cjs`/`preload.cjs` (`sandbox:true`), pure `ui-router.cjs`
  (app:// SPA fallback, single decode, resolved-path containment — 12/12 `node:test`
  units), `window-state.cjs` (userData json, finite-number validation; x/y not clamped —
  shortcut note in code), single-instance lock, `setWindowOpenHandler`/`will-navigate`
  guards, CSP header (`NNB_CSP` override, `unsafe-inline` until module nonce mode),
  `NNB_SMOKE` boot probe (exit-code asserting), Forge config w/ Squirrel+zip+deb, fuses,
  app identity via `NNB_APP_NAME`/`NNB_EXECUTABLE`/`NNB_ICON` env (CLI fills later).
  UI-in-asar contract: adapter serves `www/` inside app.asar (`files` glob); the
  fs-extra postPackage copy is gone (9.1/3); UI sync belongs to `nnb build` (CLI, next).
  Module seam: `window.nnb?.exit()` branch in `useNativeApp().exit()` + `NnbElectronApi`.
  Deleted after extraction (recoverable @7cbaf6d): `playground/my-app/` (incl. dead vite
  configs), `scripts/copy-dist.mjs`, `playground/.npmrc`, `make:electron` script.
  Gates: adapter tests 12/12, adapter lint 0, module lint 0, module test 1/1, smoke
  fixture PASS, integration smoke (playground build via `NNB_UI_DIR` + `NNB_SMOKE_EXPECT`)
  PASS. Next: step 4 `nnb` CLI; step 5 icon generator parameterization (BRAND_BG marked).
- **2026-11-09** — Phase 0 step 4: `packages/nnb` CLI — verified. Zero runtime deps
  except `jiti` (reads nuxt.config.ts via `defineNuxtConfig` polyfill); no arg parser —
  `dev electron` / `build electron [--installer]` / `build android` / `sync` / `doctor`;
  app-dir cwd contract (run inside the app; `--dir` not implemented — lazy ruling).
  Adapter got 4 additive edits: `NNB_DEV_URL` mode (protocol skip + dev origin in
  will-navigate guard), static behavior unchanged (tests still 12/12).
  Layout rulings that only existed as hacks before now live in real places:
  `nodeLinker: hoisted` (electron-packager's flora-colossus cannot walk pnpm symlinks),
  `debug` declared direct (electron-squirrel-startup walker), `author` restored
  (Squirrel nuspec), electron mirror owned by CLI via `electronEnv()` (root `.npmrc`
  hack retired); Gradle side: Aliyun google/central mirrors prepended in playground
  `android/settings.gradle` (dl.google.com binaries unreachable — same ladder),
  `gradle.properties` parallel+caching+2G heap, hardcoded `org.gradle.java.home`
  removed (CLI's `JAVA_HOME` wins; doctor finds JDK by proxy).
  Debug ruling (root-caused, measured): `nuxt dev` binds `[::1]` only on Windows
  machines like this one — `waitPort` now probes `::1` **and** `127.0.0.1`
  (earlier "stall" was a readiness-probe false negative; server was healthy).
  cap sync rewrote `capacitor.settings.gradle` plugin dirs to root `node_modules`
  (4 levels up under hoisted layout) — committed as regenerated truth.
  Gates: `doctor` 7/7 ✔; `build electron` → `out/NNB Playground-win32-x64/nnbplayground.exe`;
  `build electron --installer` → `out/make/squirrel.windows/x64/NNB Playground-Setup.exe`;
  `dev electron` + `NNB_SMOKE_EXPECT='NNB Playground'` → `smoke ok`, exit 0;
  `build android` → `app-debug.apk` 8.8MB (cold 2m01s → warm 20s after Gradle tuning
  — no Android Studio needed; same Gradle toolchain as AS plus warm daemon/cache).
  CLI fixes en route: double-skipped argv destructure, java-properties `sdk.dir`
  unescape, dynamic artifact-dir matching, installer path print, real fail count.
  Next: step 5 `nnb icons` parameterization; Phase 2 module work (keyboard, theme);
  adapter-capacitor extraction.
- **2026-11-09** — Phase 0 step 5: `nnb icons` — verified. Generator moved from
  `playground/scripts/generate-icons.mjs` into `packages/nnb/icons.mjs`, fully
  parameterized per spec §5+§6.5: `source` / `android.glyph` / `android.background`
  (`"#hex"` = flat, `[top, bottom]` = vertical gradient) / `android.glyphFraction`
  (default 0.5) / `splash`; `nativeBridge.brand.color` is the single plate source
  for `ic_launcher_background.xml` (audit 13), falling back to background top when
  absent — bad colors fail loudly (`hexToRgb`). `sharp` now a declared nnb dep.
  Lazy rulings: `assets/icon.png` output dropped (zero consumers found; Forge icon
  = `NNB_ICON` favicon.ico); jpg→png bootstrapping dropped (app artwork owned by
  the app); android block skips cleanly when the app has no `android/` shell;
  `.icns` deferred to Phase 2 (spec Phase-2 milestone). Tests: 4 node --test
  (color parse, background shape, ICO container header — which caught the test's
  own first off-by-one between data-size@14 and data-offset@18). Gates:
  `nnb icons` regenerated everything byte-identical (favicon.ico 85362 bytes
  before/after; git shows zero regenerated-file diffs); `nnb build android`
  BUILD SUCCESSFUL in 2s with fresh APK (FROM-CACHE + parallel config working).
  Next: Phase 2 module work (keyboard, theme, viewport) in the module; then
  adapter-capacitor extraction; `nnb init` only when a second consumer app needs it.
- **2026-11-11** — Phase 1 fully planned in `docs/nnb-phase1-plan.md` (T1-T9 with
  gates; Phase 2/3 sequenced there too, each gets its own plan on arrival).
- **2026-11-15** — Phase 1 T1: `packages/adapter-capacitor/android` extracted from the
  playground shell — the shared bridge library (`NnbBridgeActivity`, thin `BridgePlugin`
  dispatch, splash failsafe timer). App code never wires plugins; playground keeps its
  app-local plugins (ThemePrefs/FileSave) while the library stays generic. Gate: bridge
  library `assembleDebug` green; playground still builds against it via settings.gradle
  markers (`nnb:bridge-library` … `/nnb:bridge-library`).
- **2026-11-15** — Phase 1 T2: `nativeSync` — config-driven regeneration of the native
  files nnb owns (themes from brand/splash, manifest permission markers,
  dataExtractionRules, gradle mirrors), everything outside its markers preserved.
  First-run styles.xml migration replaces the template style wholesale (duplicate styles
  broke aapt). Windows checkouts are CRLF → renderers emit LF, normalized at read sites
  (`readLf`/`readMaybe`); settings.gradle markers use Groovy comments (XML comments are
  a syntax error there). Gate: unit tests + playground sync idempotent (0 changed on re-run).
- **2026-11-15** — Phase 1 T3: splash hide ownership moved into the bridge: failsafe at
  plugin setup, real hide on `app:mounted` per `splash.hideOn`; JS composable plugin is
  android-only. Capacitor's `launchAutoHide` pinned false in scaffolded configs. Gate:
  module vitest green; splash sequence asserted in unit tests (device timing → T9).
- **2026-11-15** — Phase 1 T4: insets via `NnbInsetsPlugin` (edge-to-edge + safe-area
  JS bridge), registered by `NnbBridgeActivity` itself — app code never wires it; JS
  side is `useSafeArea()` reading the injected values. Composable imports `vue`
  directly (not `#imports`) so it is node-testable; tests mock `useNativePlatform`
  via `vi.mock`. Gate: vitest 11/11; real-device values → T9.
- **2026-11-15** — Phase 1 T5: `apiBase` — pure `pickApiBase` in a Nuxt-free
  `src/runtime/apiBase.ts` (web → undefined; android/electron → config value) +
  `useApiBase()`; no fetch interception (YAGNI, audit item dropped). Gate:
  4/4 RED→GREEN tests; NUXT_TARGET=android build + sync → config value present in the
  android assets HTML.
- **2026-11-15** — Phase 1 T6: `nnb dev web` (NUXT_TARGET stripped from the child env,
  NNB_SMOKE probe) + packaged-electron verification. THE PACKAGED-SMOKE GATE EXPOSED A
  LATENT PACKAGING BUG: the packaged app had never been RUN before — it crashed at boot
  on `require('electron-squirrel-startup')` because forge's explicit `files` list never
  included node_modules and pnpm symlinks copy as empty stubs; fixed with an afterCopy
  prod-deps hook. Rulings: Windows GUI apps print nowhere under redirection → smoke
  verdict = process exit code; `@electron/fuses` read API is `getCurrentFuseWire`
  (Buffer bits indexed by FuseV1Options, byte 49 = on). Gates: dev-web smoke ok exit 0;
  packaged exe exit 0; fuses assert matches the forge wire; lint 0.
- **2026-11-15** — Phase 1 T7: `nnb init` — scaffolds a Nuxt app for all three targets
  (config block prompts → deps → capacitor.config → cap add + thin MainActivity +
  gradle markers → nativeSync → thin electron main → icons/doctor). ONE E2E GATE, EIGHT
  REAL DEFECTS FOUND AND FIXED (all unit-pinned, 25/25): stdin-EOF silent death (race
  question against close); cli.mjs dev/build branches missing `return` (help + exit 1
  after every run — masked in T6 by the smoke exit); pnpm 12 standalone build approvals
  (app-local pnpm-workspace.yaml); gradle wrapper mirror (Tencent — services.gradle.org
  unreachable, AGP 8.13 needs Gradle ≥ 8.13 so the cached 8.11.1 was not reusable);
  maven mirrors reach buildscript AND the cap-8 settings.gradle (template has no
  repositories at all → dependencyResolutionManagement added wholesale); local.properties
  sdk.dir written from doctor's SDK detection; buildToolsVersion pinned 36.0.0 (AGP
  default 35.0.0 absent) with a subprojects afterEvaluate override for library modules;
  splash colors/drawables generated by sync (styles referenced files only the playground
  hand-made) + template splash.png deleted (aapt duplicate resources). Gates: dev-web
  smoke 'Hello E2E' exit 0; electron build exit 0 + complete asar + fuses ok (packaged
  exe run blocked by machine WDAC for new unsigned binaries — the T6 exe from the
  identical pipeline still runs green); `nnb build android` → BUILD SUCCESSFUL 7m45s,
  app-debug.apk produced.

