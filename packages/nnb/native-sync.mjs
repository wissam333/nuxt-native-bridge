// `nnb sync` native-file generation (spec §6.3): config-driven launch themes,
// manifest permission markers, allowBackup/dataExtractionRules, gradle mirrors.
// Pure renderers are exported for tests; nativeSync() writes, skipping
// unchanged files so a second sync is a no-op.
import fs from 'node:fs'
import path from 'node:path'

const HEX = /^#[0-9a-f]{6}$/i
const assertHex = (value, what) => {
  if (!HEX.test(value || '')) throw new Error(`${what} must be #RRGGBB, got ${JSON.stringify(value)}`)
}

// styles.xml with the nnb-generated styles between markers. First run replaces
// the whole file (the Capacitor template content is what's being parameterized
// — ledger ruling: user hand-edits outside markers are preserved from run 2 on).
export function renderThemes(cfg, existing = null) {
  const brand = cfg?.brand?.color || '#0D8A8F'
  const splash = cfg?.android?.splash || {}
  assertHex(brand, 'nativeBridge.brand.color')
  assertHex(splash.light, 'android.splash.light')
  assertHex(splash.dark, 'android.splash.dark')

  const generated = `    <!-- nnb:styles — generated from nativeBridge config, rewritten by nnb sync -->
    <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="windowActionBar">false</item>
        <item name="windowNoTitle">true</item>
        <item name="android:windowBackground">${splash.light}</item>
        <item name="android:navigationBarColor">${brand}</item>
    </style>

    <style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
        <item name="android:background">@drawable/splash</item>
        <item name="android:windowBackground">${splash.light}</item>
        <item name="windowSplashScreenBackground">${splash.light}</item>
        <item name="windowSplashScreenAnimatedIcon">@drawable/splash_icon</item>
        <item name="android:windowLightStatusBar">true</item>
        <item name="android:statusBarColor">@android:color/transparent</item>
    </style>

    <style name="AppTheme.NoActionBarLaunchDark" parent="Theme.SplashScreen">
        <item name="android:background">@drawable/splash_dark</item>
        <item name="android:windowBackground">${splash.dark}</item>
        <item name="windowSplashScreenBackground">${splash.dark}</item>
        <item name="windowSplashScreenAnimatedIcon">@drawable/splash_icon</item>
        <item name="android:windowLightStatusBar">false</item>
        <item name="android:statusBarColor">@android:color/transparent</item>
    </style>
    <!-- /nnb:styles -->`

  // values-night: on Android 12+ the SYSTEM draws the cold-start splash from
  // resources resolved at window creation — before any code runs — so the
  // app's runtime dark pref can never repaint it (T9 device finding: pref
  // dark + dotted setTheme still booted the green splash). The achievable
  // behavior is resource-driven: when system night mode is on, these same
  // style names resolve dark. The runtime setTheme(dark) in
  // NnbBridgeActivity still themes the window BEHIND the splash and pre-31
  // devices, so it stays.
  const generatedNight = `    <!-- nnb:styles-night — dark resolution of the launch styles, rewritten by nnb sync -->
    <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="windowActionBar">false</item>
        <item name="windowNoTitle">true</item>
        <item name="android:windowBackground">${splash.dark}</item>
        <item name="android:navigationBarColor">${brand}</item>
    </style>

    <style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
        <item name="android:background">@drawable/splash_dark</item>
        <item name="android:windowBackground">${splash.dark}</item>
        <item name="windowSplashScreenBackground">${splash.dark}</item>
        <item name="windowSplashScreenAnimatedIcon">@drawable/splash_icon</item>
        <item name="android:windowLightStatusBar">false</item>
        <item name="android:statusBarColor">@android:color/transparent</item>
    </style>`

  const nightFile = `<?xml version="1.0" encoding="utf-8" ?>\n<resources>\n\n${generatedNight}\n</resources>\n`

  const BASE_APP_THEME = `    <!-- Base application theme. -->
    <style name="AppTheme" parent="Theme.AppCompat.Light.DarkActionBar">
        <item name="colorPrimary">@color/colorPrimary</item>
        <item name="colorPrimaryDark">@color/colorPrimaryDark</item>
        <item name="colorAccent">@color/colorAccent</item>
    </style>`

  if (existing) {
    // Run 2+: preserve everything outside the marker block. The regex
    // consumes the leading indent so re-indentation can never accumulate.
    const m = /^[ \t]*<!-- nnb:styles[\s\S]*?<!-- \/nnb:styles -->$/m.exec(existing)
    if (m) {
      return { stylesXml: existing.replace(m[0], generated.trimEnd()), stylesNightXml: nightFile }
    }
  }
  // First run (or marker-less file): replace wholesale — the template styles
  // are exactly what's being parameterized; keeping them next to the generated
  // ones duplicates style names and aapt fails the build (ledger ruling:
  // wholesale first-run replace, user edits kept from run 2 via markers).
  return {
    stylesXml: `<?xml version="1.0" encoding="utf-8" ?>\n<resources>\n\n${BASE_APP_THEME}\n\n${generated}\n</resources>\n`,
    // values-night/styles.xml is wholly generated (no user content to preserve)
    stylesNightXml: nightFile,
  }
}

// Manifest patch: permissions live ONLY inside nnb markers (audit 14 — stale
// app-level permissions are removed), allowBackup=false (audit 15),
// dataExtractionRules scaffolded. Idempotent by construction.
export function renderManifestPatch(manifest, permissions = []) {
  let out = manifest
    // drop previous marker blocks (leading indent included), then any
    // marker-less permission lines; collapse the blank lines they leave
    .replace(/^[ \t]*<!-- nnb:permissions[\s\S]*?<!-- \/nnb:permissions -->\n?/gm, '')
    .replace(/[ \t]*<uses-permission[^>]*\/>[ \t]*\n?/g, '')
    .replace(/(<manifest[^>]*>\n)\n+/, '$1')

  // INTERNET is mandatory: without it the WebView cannot reach any API. It is
  // always emitted (deduped) because the audit-14 strip below would otherwise
  // remove Capacitor's template permission and silently break every network call.
  const all = ['INTERNET', ...permissions.filter(p => p !== 'INTERNET')]
  const perms = all
    .map(p => `    <uses-permission android:name="android.permission.${p}" />`)
    .join('\n')
  const block = `    <!-- nnb:permissions — generated from nativeBridge.android.permissions (INTERNET always included), rewritten by nnb sync -->\n${perms}\n    <!-- /nnb:permissions -->\n`

  // re-insert after the <manifest ...> tag
  out = out.replace(/(<manifest[^>]*>\n)/, `$1${block}`)

  if (/android:allowBackup="/.test(out)) {
    out = out.replace(/(android:allowBackup=")[^"]*(")/, '$1false$2')
  }
  else {
    out = out.replace(/(<application\b)/, '$1\n        android:allowBackup="false"')
  }

  if (!/android:dataExtractionRules="/.test(out)) {
    out = out.replace(/(<application\b)/, '$1\n        android:dataExtractionRules="@xml/nnb_data_extraction_rules"')
  }
  return out
}

export function renderDataExtractionRules() {
  return `<?xml version="1.0" encoding="utf-8"?>
<!-- generated by nnb sync — adjust to your data policy -->
<data-extraction-rules>
    <cloud-backup>
        <exclude domain="root" path="." />
    </cloud-backup>
    <device-transfer>
        <exclude domain="root" path="." />
    </device-transfer>
</data-extraction-rules>
`
}

// settings.gradle: maven mirrors between // markers (audit 11 — config-driven;
// markers use Groovy comment syntax, not XML, since this is a .gradle file).
export function renderSettingsPatch(content, mirrors = []) {
  const block = `        // nnb:maven-mirrors — generated from nativeBridge.android.mavenMirrors, rewritten by nnb sync\n${mirrors.map(u => `        maven { url '${u}' }`).join('\n')}\n        // /nnb:maven-mirrors`
  const withMarkers = /^[ \t]*\/\/ nnb:maven-mirrors[\s\S]*?\/\/ \/nnb:maven-mirrors/m.test(content)
  if (withMarkers) {
    return content.replace(/^[ \t]*\/\/ nnb:maven-mirrors[\s\S]*?\/\/ \/nnb:maven-mirrors/m, block)
  }
  // first migration: strip hardcoded mirror lines (and their old comment),
  // add the block right after `repositories {` so mirrors win the ordering
  // race. Marker-less maven{} lines are ours to manage (audit 11 ruling).
  const stripped = content
    .replace(/^[ \t]*\/\/ Aliyun mirrors first[\s\S]*?same ruling as the electron mirror\.\n/m, '')
    .replace(/^[ \t]*maven \{ url '[^']*' \}[ \t]*\n/gm, '')
  if (/repositories \{/.test(stripped)) {
    return stripped.replace(/(repositories \{\n)/, `$1${block}\n`)
  }
  // cap-8 template: settings.gradle has no repositories at all (remote repos
  // live in root build.gradle's allprojects, unmirrorable there) — add the
  // playground's dependencyResolutionManagement block wholesale (T7 e2e gate).
  return `dependencyResolutionManagement {\n    repositoriesMode.set(RepositoriesMode.PREFER_SETTINGS)\n    repositories {\n${block}\n        google()\n        mavenCentral()\n    }\n}\n\n${stripped}`
}

// root build.gradle: the buildscript classpath (AGP, google-services) resolves
// ONLY from buildscript.repositories — dependencyResolutionManagement in
// settings.gradle does not cover it (found by the T7 e2e gate). Mirror the
// first repositories block, which in the capacitor template is buildscript's.
export function renderBuildscriptPatch(content, mirrors = []) {
  const block = `        // nnb:maven-mirrors — generated from nativeBridge.android.mavenMirrors, rewritten by nnb sync\n${mirrors.map(u => `        maven { url '${u}' }`).join('\n')}\n        // /nnb:maven-mirrors`
  const withMarkers = /^[ \t]*\/\/ nnb:maven-mirrors[\s\S]*?\/\/ \/nnb:maven-mirrors/m.test(content)
  if (withMarkers) {
    return content.replace(/^[ \t]*\/\/ nnb:maven-mirrors[\s\S]*?\/\/ \/nnb:maven-mirrors/m, block)
  }
  return content.replace(/(repositories \{\n)/, `$1${block}\n`)
}

// root build.gradle: library modules (:capacitor-android, :nnb-bridge) have
// build.gradle files we don't own, and they inherit AGP's default build tools
// (35.0.0) — override every android module from variables.gradle's pin.
export function renderRootGradleTools(content) {
  const block = `// nnb:build-tools — generated by nnb sync; library modules read the pin from variables.gradle
subprojects {
    afterEvaluate { proj ->
        def a = proj.extensions.findByName('android')
        if (a != null && rootProject.ext.has('buildToolsVersion')) a.buildToolsVersion = rootProject.ext.buildToolsVersion
    }
}
// /nnb:build-tools
`
  const marked = /\/\/ nnb:build-tools[\s\S]*?\/\/ \/nnb:build-tools\n?/
  if (marked.test(content)) return content.replace(marked, block)
  return content.replace(/\s*$/, '\n\n') + block
}

// Splash drawables: the generated styles reference @drawable/splash,
// splash_icon and splash_dark; the logo PNGs come from `nnb icons`. Until
// then the drawables render the plain brand color (T7 e2e gate: aapt link
// failed without them — no renderer ever wrote these files).
export function renderSplashColors(colorsXml, { light, dark }) {
  colorsXml = colorsXml ?? ''
  const block = `    <!-- nnb:splash-colors — generated from nativeBridge.android.splash, rewritten by nnb sync -->
    <color name="splash_bg">${light}</color>
    <color name="splash_bg_dark">${dark}</color>
    <!-- /nnb:splash-colors -->`
  if (/^[ \t]*<!-- nnb:splash-colors[\s\S]*?<!-- \/nnb:splash-colors -->/m.test(colorsXml)) {
    return colorsXml.replace(/^[ \t]*<!-- nnb:splash-colors[\s\S]*?<!-- \/nnb:splash-colors -->/m, block)
  }
  // no colors.xml yet: create it with just the splash colors
  if (!colorsXml) {
    return `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n\n${block}\n</resources>\n`
  }
  // hand-written colors.xml (no splash_bg): leave the app's own entries alone
  if (/name="splash_bg"/.test(colorsXml) || !colorsXml.includes('</resources>')) return colorsXml
  return colorsXml.replace(/([ \t]*)<\/resources>/, `${block}\n</resources>`)
}

export function renderSplashDrawables({ hasLogo }) {
  const logoItem = hasLogo
    ? `    <item\n        android:width="280dp"\n        android:height="280dp"\n        android:gravity="center">\n        <bitmap android:src="@drawable/splash_logo" android:gravity="fill" />\n    </item>\n`
    : ''
  const layer = color => `<?xml version="1.0" encoding="utf-8"?>\n<layer-list xmlns:android="http://schemas.android.com/apk/res/android">\n    <item>\n        <color android:color="${color}" />\n    </item>\n${logoItem}</layer-list>\n`
  // Android 12+ masks the system-splash icon with a circle; inset the logo so
  // it stays inside the mask. Without a logo: blank icon, plain color splash.
  const iconXml = hasLogo
    ? `<?xml version="1.0" encoding="utf-8"?>\n<!-- Android 12+ system splash masks the icon with a circle. Inset the logo\n     (20% each side => 60% of the canvas) so it stays fully inside the mask\n     instead of being cut off at the edges. -->\n<inset xmlns:android="http://schemas.android.com/apk/res/android"\n    android:inset="20%"\n    android:drawable="@drawable/splash_icon_logo" />\n`
    : `<?xml version="1.0" encoding="utf-8"?>\n<layer-list xmlns:android="http://schemas.android.com/apk/res/android" />\n`
  return {
    'splash.xml': layer('@color/splash_bg'),
    'splash_dark.xml': layer('@color/splash_bg_dark'),
    'splash_icon.xml': iconXml,
  }
}

// Writes only when content changed. Returns the number of files written.
// Windows checkouts are CRLF (core.autocrlf); every renderer below is written
// against LF and pinned that way by tests — normalize once at the read sites.
const readLf = f => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
const readMaybe = f => fs.existsSync(f) ? readLf(f) : null

function writeIfChanged(file, content) {
  const prev = fs.existsSync(file) ? readLf(file) : null
  if (prev === content) return 0
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
  return 1
}

export function nativeSync(appDir, nativeBridge, log = console.log) {
  const app = p => path.join(appDir, p)
  const res = app('android/app/src/main/res')
  if (!fs.existsSync(path.join(appDir, 'android'))) {
    log('[nnb] sync: no android/ shell — native files skipped')
    return
  }
  let changed = 0

  const stylesPath = path.join(res, 'values', 'styles.xml')
  const themes = renderThemes(nativeBridge, readMaybe(stylesPath))
  changed += writeIfChanged(stylesPath, themes.stylesXml)
  changed += writeIfChanged(path.join(res, 'values-night', 'styles.xml'), themes.stylesNightXml)

  const manifestPath = app('android/app/src/main/AndroidManifest.xml')
  changed += writeIfChanged(manifestPath, renderManifestPatch(readMaybe(manifestPath), nativeBridge.android?.permissions))

  changed += writeIfChanged(path.join(res, 'xml', 'nnb_data_extraction_rules.xml'), renderDataExtractionRules())

  const settingsPath = app('android/settings.gradle')
  changed += writeIfChanged(settingsPath, renderSettingsPatch(readMaybe(settingsPath), nativeBridge.android?.mavenMirrors))

  // Splash colors + drawables (logo arrives via `nnb icons`; until then the
  // splash is the plain brand color).
  const splashColors = {
    light: nativeBridge.android?.splash?.light || '#0D8A8F',
    dark: nativeBridge.android?.splash?.dark || '#0B1416',
  }
  const colorsPath = path.join(res, 'values', 'colors.xml')
  changed += writeIfChanged(colorsPath, renderSplashColors(readMaybe(colorsPath), splashColors))
  const splash = renderSplashDrawables({
    ...splashColors,
    hasLogo: fs.existsSync(path.join(res, 'drawable', 'splash_logo.png')),
  })
  for (const [name, xml] of Object.entries(splash)) {
    changed += writeIfChanged(path.join(res, 'drawable', name), xml)
  }

  // The cap template's splash.png collides with the generated splash.xml
  // (aapt "Duplicate resources" — T7 e2e gate); nnb owns `splash` now.
  for (const dir of fs.readdirSync(res).filter(d => d.startsWith('drawable'))) {
    const png = path.join(res, dir, 'splash.png')
    if (fs.existsSync(png)) {
      fs.rmSync(png)
      changed += 1
      log(`[nnb] sync: removed template ${dir}/splash.png (replaced by generated splash drawables)`)
    }
  }

  const buildGradlePath = app('android/build.gradle')
  changed += writeIfChanged(buildGradlePath, renderRootGradleTools(renderBuildscriptPatch(readMaybe(buildGradlePath), nativeBridge.android?.mavenMirrors)))

  log(changed === 0 ? '[nnb] sync: native files already up to date (0 changed)' : `[nnb] sync: ${changed} native file(s) regenerated`)
}
