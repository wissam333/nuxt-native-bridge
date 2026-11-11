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
      return { stylesXml: existing.replace(m[0], generated.trimEnd()) }
    }
  }
  // First run (or marker-less file): replace wholesale — the template styles
  // are exactly what's being parameterized; keeping them next to the generated
  // ones duplicates style names and aapt fails the build (ledger ruling:
  // wholesale first-run replace, user edits kept from run 2 via markers).
  return {
    stylesXml: `<?xml version="1.0" encoding="utf-8" ?>\n<resources>\n\n${BASE_APP_THEME}\n\n${generated}\n</resources>\n`,
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

  const perms = permissions
    .map(p => `    <uses-permission android:name="android.permission.${p}" />`)
    .join('\n')
  const block = `    <!-- nnb:permissions — generated from nativeBridge.android.permissions, rewritten by nnb sync -->\n${perms}\n    <!-- /nnb:permissions -->\n`

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
  return content
    .replace(/^[ \t]*\/\/ Aliyun mirrors first[\s\S]*?same ruling as the electron mirror\.\n/m, '')
    .replace(/^[ \t]*maven \{ url '[^']*' \}[ \t]*\n/gm, '')
    .replace(/(repositories \{\n)/, `$1${block}\n`)
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
  changed += writeIfChanged(stylesPath, renderThemes(nativeBridge, readMaybe(stylesPath)).stylesXml)

  const manifestPath = app('android/app/src/main/AndroidManifest.xml')
  changed += writeIfChanged(manifestPath, renderManifestPatch(readMaybe(manifestPath), nativeBridge.android?.permissions))

  changed += writeIfChanged(path.join(res, 'xml', 'nnb_data_extraction_rules.xml'), renderDataExtractionRules())

  const settingsPath = app('android/settings.gradle')
  changed += writeIfChanged(settingsPath, renderSettingsPatch(readMaybe(settingsPath), nativeBridge.android?.mavenMirrors))

  log(changed === 0 ? '[nnb] sync: native files already up to date (0 changed)' : `[nnb] sync: ${changed} native file(s) regenerated`)
}
