# nnb compatibility matrix

Pinned from day one (spec §12): nnb verifies exactly these versions; anything
else is untested. Update this table when a pin changes, with the reason.

| Component            | Pinned              | Notes |
| -------------------- | ------------------- | ----- |
| Nuxt                 | 3.16+ / 4.x         | 4.6.4 (e2e scratch app), 3.16.2 (ask-med, npm, android+electron built) |
| Node                 | 24 LTS              | 24.22.2 |
| Electron             | current stable      | via adapter-electron; Forge packaging |
| @electron/forge      | current             | afterCopy prod-deps hook (pnpm layout) |
| Capacitor            | 8.x                 | 8.6.0 core/cli/android + official plugins |
| Android Gradle Plugin| 8.13.0              | cap-8 template default |
| Gradle               | 8.14.3              | wrapper pinned; dist via Tencent mirror on restricted networks |
| JDK                  | 21                  | Microsoft OpenJDK 21 verified |
| Android targetSdk    | 36                  | compileSdk 36, minSdk 24 (cap-8 defaults) |
| Build Tools          | 36.0.0              | pinned by nnb sync (AGP default 35.0.0 often absent) |

Known machine-level constraints (not nnb bugs, but they shape the defaults):

- Restricted networks: services.gradle.org and direct google()/mavenCentral()
  time out — nnb defaults maven mirrors to Aliyun and the wrapper dist to the
  Tencent mirror (see `nativeBridge.android.mavenMirrors` / init).
- Windows Device Guard/WDAC: brand-new unsigned packaged exes can be blocked
  until they gain reputation; the packaging pipeline itself is verified.
