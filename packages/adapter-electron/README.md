# adapter-electron

NNB's Electron shell (spec §6.2): hardened `app://` SPA protocol, secure
window, sandboxed CJS preload, single-instance, window-state, CSP header,
Forge packaging (Squirrel/zip/deb + asar integrity fuses).

## Run against a built UI (dev)

The shell never guesses — dev needs an explicit UI directory:

```pwsh
# 1. build the app once (web/static target works for desktop too)
pnpm --filter nuxt-native-bridge exec nuxt generate   # run inside packages/nuxt-native-bridge/playground

# 2. point the shell at it and start
pnpm -C packages/adapter-electron start
# with:  $env:NNB_UI_DIR = "packages/nuxt-native-bridge/playground/.output/public"
```

Packaged builds serve `www/` from inside the app asar (Forge `files`).

## Verify

| Command | What it proves |
|---|---|
| `pnpm -C packages/adapter-electron test` | `app://` path resolver: SPA fallback, decoding, containment (unit) |
| `pnpm -C packages/adapter-electron smoke` | shell boots, protocol serves a page, probe exits 0 (fixture UI) |

## Config (env)

| Var | Meaning |
|---|---|
| `NNB_UI_DIR` | dev UI source (built Nuxt `.output/public`); required when unpackaged |
| `NNB_APP_NAME` / `NNB_EXECUTABLE` / `NNB_ICON` | Forge identity; CLI fills these from `nativeBridge` |
| `NNB_CSP` | override the default CSP served on `app://` |
| `NNB_SMOKE` / `NNB_SMOKE_EXPECT` | boot probe (`document.title` must equal expect; default `nnb-smoke`) |

The `nnb` CLI (next step) automates: generate → sync UI → launch with the
right env vars; until then the manual flow above stands.
