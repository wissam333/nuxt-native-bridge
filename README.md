# nuxt-native-bridge (nnb)

Build **one Nuxt codebase** and ship it as a website, a desktop app (Electron),
and an Android app (Capacitor). Spec: [`nuxt-native-bridge Full Specification and Roadmap.md`](./nuxt-native-bridge%20Full%20Specification%20and%20Roadmap.md).

Name decision (2026-11-09): the npm package stays **`nuxt-native-bridge`** (descriptive,
searchable, ecosystem-conventional, `npm view`-verified free); the brand lives in the
tagline — *One Nuxt codebase → website, desktop, Android* — and the `nnb` CLI name.

## Layout

```
packages/nuxt-native-bridge/     the module (Nuxt module starter template)
  src/                           module.ts + runtime (being built — Phase 0)
  playground/                    the former Arselha starter, cleaned (this repo's app)
    app/ public/ scripts/
    android/                     Capacitor native shell (MainActivity, ThemePrefs/FileSave plugins)
    my-app/                      Electron Forge shell for the playground
  test/                          module tests
docs/                            plan + notes (docs/nnb-plan.md = current working plan)
```

## Status

- Playground: cleaned starter, builds **web** (`pnpm run generate` in playground), **Electron**
  (`npm run make:electron`, installer verified, GitHub-CDN workaround in `playground/.npmrc`),
  and **Android** (APK verified).
- Next: Phase 0 module extraction — `src/module.ts`, base CSS, first composables
  (see `docs/nnb-plan.md`).
