# Android Release (Play Store)

## Current version

| Field         | Value                            | Where                        |
| ------------- | -------------------------------- | ---------------------------- |
| applicationId | `arselhawallet.com` (Play requires it to equal the verified site domain; rename applied 2026-09-24 — permanently never change again) | `android/app/build.gradle` |
| versionCode   | **2** (integer — must +1 on every upload) | `android/app/build.gradle` |
| versionName   | **"1.1"** (shown to users)       | `android/app/build.gradle`   |
| targetSdk     | **36** (Play requires API 36 as of 2026) | `android/variables.gradle` |
| Last AAB      | `android/app/build/outputs/bundle/release/app-release.aab` | built 2026-09-26 (version 2 / "1.1" — targetSdk 36) |

## Build a new version (every release)

Run from the project root (`D:\2026\USD`):

```powershell
# 1. Bump the version first (see below), then:
npm run build
npx cap sync android
cd android
.\gradlew.bat bundleRelease
```

The signed AAB lands at:

```
android/app/build/outputs/bundle/release/app-release.aab
```

Upload it in Play Console → Release → Production (or Closed testing) →
Create new release → upload AAB → release notes → roll out.

## Bumping the version

In `android/app/build.gradle`:

```gradle
versionCode 3        // was 2 — MUST increase with every Play upload
versionName "1.2"    // user-visible name, free choice
```

Rules: `versionCode` is compared numerically by Play — re-uploading the
same (or a lower) code is rejected. `versionName` is display-only.

## Signing (do not lose this)

- Keystore: `android/app/release.keystore`
- Passwords/alias: `android/app/keystore.properties`
- Both are **git-ignored on purpose** (never commit secrets).
- Back them up off this PC (USB + cloud). Losing the keystore means the
  app listing can never be updated again.

## Troubleshooting

| Problem | Fix |
| ------- | --- |
| Play rejects AAB: "version code already used" | Bump `versionCode`, rebuild |
| Play rejects AAB: must target API 36 | Set `compileSdkVersion` and `targetSdkVersion` to 36 in `android/variables.gradle`, rebuild |
| `keystore.properties` missing | Restore from backup; the release build cannot sign without it |
| Stale app content in AAB | You skipped `npm run build` or `npx cap sync` — run the full sequence |
| Gradle SDK error | Check `android/local.properties` → `sdk.dir` points at a valid Android SDK |
