1. Verify the two remaining targets of the cleaned playground (quick, do first)
- Electron: npm run make:electron — generate → copy → Forge make; proves the Electron shell still loads the clean app
- Android: cd android && .\gradlew assembleDebug — proves the trimmed plugin set still compiles
2. Restructure into the spec monorepo (§4, §15.2)
- Create the workspace: packages/nuxt-native-bridge via npm create nuxt -- -t module (gives you @nuxt/module-builder, lint/test/release scripts free)
- Move this repo's Nuxt app (app/, public/, nuxt.config.ts, capacitor.config.ts, my-app/, android/, scripts/) into playground/
- Root becomes pnpm-workspace.yaml + packages
3. Extract the module (Phase 0 step 3) — the highest-value work
- src/module.ts per spec §15.3: nativeBridge config block, NUXT_TARGET switch, early-boot script owner, baseStyles CSS
- src/runtime/: base.css (from app/assets/scss/main.scss), plugin.client.ts (splash hide + back button + app state, with listener cleanup), useNativePlatform, useBackButton
- Playground switches to modules: ["../src/module"] + a nativeBridge block — then delete the duplicated head script, composables and native hacks from the playground app (audit items 19, 23–26, 34, 35, 40)
4. Extract adapter-electron (Phase 0 step 2)
- From my-app/: explicit dev/prod env var, hardened app:// handler, serve UI from the asar, CJS preload with sandbox: true, single-instance + window-state + nav guards
5. CLI + doctor (Phase 0 step 5)
- nnb dev | build wrapping what scripts/ + package.json do today, nnb doctor starting with JDK/SDK detection
6. Parametrize the icon generator (from scripts/generate-icons.mjs → nnb icons)
Spec's stated order of work: module first (using the starter as playground), then adapter-electron, then CLI — steps 1–3 get us to the Phase 0 acceptance criterion: "playground builds web, Electron and Android using only the module and a nativeBridge block".