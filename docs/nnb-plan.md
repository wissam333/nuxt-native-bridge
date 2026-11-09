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

