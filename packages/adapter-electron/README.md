# @nnb/adapter-electron

The hardened Electron shell behind `nnb build electron` for
[nuxt-native-bridge](https://www.npmjs.com/package/nuxt-native-bridge).

You normally do not install this package by hand: `@nnb/cli` adds it to your app and
drives it. This page is for anyone reading the shell's security model or wiring it
manually.

## How it is used

```bash
pnpm exec nnb build electron            # packaged app in the adapter's out/ directory
pnpm exec nnb build electron --installer  # + Squirrel installer
pnpm exec nnb dev electron              # dev window with HMR against your Nuxt dev server
```

The CLI generates the app's static UI, syncs it into the shell, then runs Electron
Forge with the hardened config in this package.

## What is hardened

| Layer | Behavior |
| --- | --- |
| Protocol | `app://` serves the packaged UI only; no `file://`, no network origins |
| Window | sandboxed renderer, `contextIsolation`, no node integration, navigation and new-window guards |
| Preload | minimal `contextBridge` surface (CJS, sandbox-compatible) |
| CSP | strict Content-Security-Policy header served on every `app://` response |
| Process | single-instance lock, rejected remote content, window-state persistence |
| Packaging | Electron Forge + asar integrity fuses (`onlyLoadAppFromAsar`, cookie encryption, etc.) |
| Smoke probe | `NNB_SMOKE=1` boots the shell, asserts the page title and exits 0/1 |

## Manual run (advanced)

```pwsh
$env:NNB_UI_DIR = "path\to\.output\public"   # built Nuxt static output
npm start
```

| Env var | Meaning |
| --- | --- |
| `NNB_UI_DIR` | dev UI source (built Nuxt `.output/public`); required when unpackaged |
| `NNB_DEV_URL` | Nuxt dev-server URL; set by `nnb dev electron` for HMR |
| `NNB_APP_NAME` / `NNB_EXECUTABLE` / `NNB_ICON` | Forge identity; the CLI fills these from `nativeBridge` |
| `NNB_CSP` | override the default CSP served on `app://` |
| `NNB_SMOKE` / `NNB_SMOKE_EXPECT` | boot probe (document title must equal expect; default `nnb-smoke`) |

MIT license.
