# nuxt-native-bridge

One Nuxt codebase shipped as a website, a desktop app (Electron) and an Android app
(Capacitor). This module is the Nuxt half: target switch, early-boot script, splash
timing, safe-area tokens, back-button handling and the `nativeBridge` config contract.

```bash
pnpm dlx @nnb/cli init          # scaffolds an app for all three targets
pnpm exec nnb dev web           # or your own `pnpm dev`
pnpm exec nnb build electron    # packaged desktop app
pnpm exec nnb build android     # generated + synced + Gradle, one command
```

Full tutorial, CLI reference and specs: [github.com/wissam333/nuxt-native-bridge](https://github.com/wissam333/nuxt-native-bridge).

## What the module does

- `nativeBridge` config block in `nuxt.config.ts` (app id/name, brand color, icons,
  splash, apiBase, permissions, exit routes).
- Target switch from `NUXT_TARGET`: web keeps your config untouched; electron and
  android build a static SPA with pre-compression off (Android's asset merger
  rejects `.gz` siblings).
- Composables: `useNativePlatform()`, `useSafeArea()`, `useApiBase()`, `useNativeApp()`.
- Free native behavior: splash hide/fade, theme-following dark mode, safe-area
  padding, Android back-button exit modal.

Tested with Nuxt 3.16+ and Nuxt 4.x, Capacitor 8.x, Electron 39 + Forge 7.

MIT license.
