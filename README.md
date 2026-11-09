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
    app/ public/ scripts/
    android/                     Capacitor native shell (raw material for adapter-capacitor)
  test/                          module tests
packages/adapter-electron/       hardened Electron shell (app://, sandbox, window-state,
                                 single-instance, CSP) + Forge config
docs/                            plan + notes (docs/nnb-plan.md = current working plan)
```

## Status

- Module skeleton implemented and verified (web + android generates, dev server).
- adapter-electron extracted; unit-tested path resolver, smoke-tested against the
  playground build. Installers: `pnpm -C packages/adapter-electron make` (needs a UI
  synced to `www/` — automated by the CLI in the next step).
- Android APK verified earlier as the starter shell; adapter-capacitor extraction pending.
- Next: `nnb` CLI (init/dev/build: one command per target), then icon generator
  parameterization (see `docs/nnb-plan.md`).
