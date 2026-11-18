# nuxt-native-bridge

One Nuxt codebase shipped as a website, a desktop app (Electron) and an Android app (Capacitor).

```bash
pnpm dlx @nnb/cli init          # scaffold an app for all three targets
pnpm dev                        # website, unchanged
pnpm exec nnb build electron    # packaged desktop app
pnpm exec nnb build android     # generated + synced + Gradle, one command
```

Full tutorial, CLI reference and specs: [github.com/wissam333/nuxt-native-bridge](https://github.com/wissam333/nuxt-native-bridge).

## Quickstart

```bash
pnpm create nuxt my-app         # or add nnb to an existing Nuxt 3.16+/4.x app
cd my-app
pnpm dlx @nnb/cli init
```

`init` asks for a package id (`com.you.myapp`) and app name, adds the `nativeBridge`
config block, installs Capacitor + the hardened Electron shell, generates the native
theme/splash files and finishes with a `nnb doctor` environment check.

## The only contract: `nativeBridge` in `nuxt.config.ts`

```ts
nativeBridge: {
  app: { id: 'com.you.myapp', name: 'My App' },
  brand: { color: '#0D8A8F' },
  apiBase: 'https://api.example.com',   // carried to native targets only
  icons: {
    source: 'public/icon.jpg',          // web/desktop icons + favicons
    android: { glyph: 'public/glyph.png', background: ['#16211F', '#0A1311'] },
    splash: 'public/glyph.png',         // splash logo
  },
  android: { splash: { hideOn: 'mounted', fade: 300 } },
  backButton: { exitRoutes: ['/'] },    // system back asks to exit here, not navigate
}
```

Changed branding? `pnpm exec nnb icons` regenerates everything from this block.

## What the module does

- Target switch from `NUXT_TARGET`: web keeps your config untouched; electron and
  android build a static SPA (pre-compression off, since Android's asset merger
  rejects `.gz` siblings).
- Nuxt Image is switched to `provider: 'none'` on native targets: its `/_ipx/...`
  URLs need a running server, so optimized images would be broken in the app.
  List `nuxt-native-bridge` before `@nuxt/image` in `modules` for this to apply.
- Early-boot script: target/os attributes, native safe-area minimums and the
  pre-paint status-bar color land before any Vue code runs.
- Splash hide/fade timing that follows the system dark mode on Android 12+.

## Composables

| Composable | What it gives you |
| --- | --- |
| `useNativePlatform()` | `'web' \| 'electron' \| 'android'`, branch when needed |
| `useNativeSafeArea()` | real device insets as CSS vars + refs (camera cutouts, gesture bars) |
| `useNativeApiBase()` | your `apiBase` on native targets, `undefined` on web |
| `useNativeApp()` | `onExitRequested()`, `onResume()`, `onPause()`, `exit()`; render your own confirm dialog on exit routes |
| `useBackButton()` | `pushHandler()` / `popHandler()` for screens that intercept Android back |

Splash, theming, safe-area padding and back-button handling come for free; most apps
write zero platform code.

## Compatibility

| Component | Supported |
| --- | --- |
| Nuxt | 3.16+ and 4.x |
| Capacitor | 8.x |
| Electron / Forge | 39 / 7.x |
| JDK / Android SDK | 21 / compileSdk 36 |

## The nnb toolkit

| Package | Role |
| --- | --- |
| [`nuxt-native-bridge`](https://www.npmjs.com/package/nuxt-native-bridge) | this module: target switch, boot script, composables, config contract |
| [`@nnb/cli`](https://www.npmjs.com/package/@nnb/cli) | `nnb init / dev / build / sync / icons / doctor` |
| [`@nnb/adapter-electron`](https://www.npmjs.com/package/@nnb/adapter-electron) | hardened Electron shell used by `nnb build electron` |

MIT license.
