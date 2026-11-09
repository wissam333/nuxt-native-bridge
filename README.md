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

- `nnb` CLI (Phase 0 set) verified end-to-end: `doctor` 7/7; `build electron`
  → packaged app; `--installer` → Squirrel setup exe; `dev electron` → real HMR
  inside the shell (`NNB_SMOKE` probe asserts the served title); `build android`
  → `app-debug.apk` (Gradle mirrors + warm-daemon tuning; Android Studio not needed).
- Module skeleton implemented and verified (web + android generates, dev server).
- adapter-electron extracted; unit-tested path resolver, smoke-tested against the
  playground build; dev-server mode added for `nnb dev electron`.
- Android APK verified via the CLI; adapter-capacitor extraction pending.
- `nnb icons` verified: config-driven (spec §5 `nativeBridge.icons` + `brand.color`
  as the audit-13 plate source), outputs byte-identical to the old hardcoded
  script; launcher/splash re-verified in the Android build. `.icns` is Phase 2.
- Next: Phase 2 module work (keyboard, theme; see `docs/nnb-plan.md`).
