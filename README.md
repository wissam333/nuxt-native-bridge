# nuxt-native-bridge (nnb)

Build **one Nuxt codebase** and ship it as a website, a desktop app (Electron),
and an Android app (Capacitor). Spec: [`nuxt-native-bridge Full Specification and Roadmap.md`](./nuxt-native-bridge%20Full%20Specification%20and%20Roadmap.md).

Name decision (2026-11-09): the npm package stays **`nuxt-native-bridge`** (descriptive,
searchable, ecosystem-conventional, `npm view`-verified free); the brand lives in the
tagline — *One Nuxt codebase → website, desktop, Android* — and the `nnb` CLI name.

## Layout

```
packages/nuxt-native-bridge/     the module (build-target switch, boot script, runtime)
  src/                           module.ts + runtime (composables, client plugin, base css)
  playground/                    the demo app
    app/ public/
    android/                     Capacitor native shell (raw material for adapter-capacitor)
  test/                          module tests
packages/adapter-electron/       hardened Electron shell (app://, sandbox, window-state,
                                 single-instance, CSP) + Forge config
packages/nnb/                    the CLI (dev/build/doctor per target; zero-dep except jiti)
docs/                            plan + notes (docs/nnb-plan.md = current working plan)
```

## Status

- **Phase 1 complete** (per-task record in `docs/nnb-plan.md` §7):
  - `nnb init` scaffolds a Nuxt app for all three targets (config block, deps,
    capacitor.config, thin MainActivity, thin electron main, native files via sync).
  - `packages/adapter-capacitor/android` extracted: shared bridge library
    (`NnbBridgeActivity`, splash ownership, insets plugin) that init/sync wire in.
  - `nnb sync` regenerates the native files nnb owns (themes, manifest, mirrors,
    splash drawables) idempotently, preserving app-authored content outside markers.
  - Module: `apiBase` per target (web off, android/electron on), splash hide on
    `app:mounted`, `useSafeArea()` from the insets plugin.
  - Verified end-to-end on a throwaway app: `dev web` smoke, packaged electron
    (fuses asserted), `build android` → `app-debug.apk`. Device-level checks
    (splash timing, real insets, back button) are Phase 1 T9, user-assisted.
- Phase 0 (all verified): `nnb` CLI `doctor` 7/7; `build electron` → packaged app +
  Squirrel installer; `dev electron` → real HMR inside the shell; `build android` →
  APK (Gradle mirrors + warm-daemon tuning; Android Studio not needed); `nnb icons`
  config-driven (spec §5; `.icns` is Phase 2).
- Next: Phase 2 module work (keyboard, theme; see `docs/nnb-plan.md`).
