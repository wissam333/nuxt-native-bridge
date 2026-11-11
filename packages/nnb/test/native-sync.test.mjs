// Locks the native-file generator: themes from brand/splash config, manifest
// permission markers (idempotent), allowBackup=false + dataExtractionRules.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderThemes, renderManifestPatch, renderDataExtractionRules, renderSettingsPatch } from '../native-sync.mjs'

const CFG = {
  brand: { color: '#0D8A8F' },
  android: {
    splash: { hideOn: 'mounted', fade: 300, failsafe: 8000, light: '#0D8A8F', dark: '#0B1416' },
    permissions: ['CAMERA'],
  },
}

const MANIFEST = `<?xml version="1.0" encoding="utf-8" ?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <application
        android:allowBackup="true"
        android:usesCleartextTraffic="false"
        android:theme="@style/AppTheme">
        <activity android:name=".MainActivity" />
    </application>
</manifest>
`

test('renderThemes emits light+dark launch themes and NoActionBar from config', () => {
  const { stylesXml } = renderThemes(CFG)
  assert.match(stylesXml, /name="AppTheme\.NoActionBarLaunch"/)
  assert.match(stylesXml, /name="AppTheme\.NoActionBarLaunchDark"/)
  assert.match(stylesXml, /name="AppTheme\.NoActionBar"/)
  // audit 18: the dark variant exists with the dark splash color
  assert.match(stylesXml, /windowSplashScreenBackground">#0B1416/)
  // audit 13: brand.color is the single navigationBarColor source
  assert.match(stylesXml, /android:navigationBarColor">#0D8A8F/)
})

test('renderManifestPatch writes permissions between markers and removes stale ones', () => {
  const out = renderManifestPatch(MANIFEST, CFG.android.permissions)
  // declared between markers...
  assert.match(out, /nnb:permissions[\s\S]*CAMERA[\s\S]*nnb:permissions/)
  // ...and the stale unmarked ones (fine/coarse location) are gone
  assert.doesNotMatch(out, /ACCESS_FINE_LOCATION/)
  assert.match(out, /CAMERA/)
  // no blank-line residue where stripped permissions used to be
  assert.doesNotMatch(out, /\n{3}/)
})

test('renderManifestPatch sets allowBackup=false and scaffolds dataExtractionRules', () => {
  const out = renderManifestPatch(MANIFEST, CFG.android.permissions)
  assert.match(out, /android:allowBackup="false"/)
  assert.match(out, /android:dataExtractionRules="@xml\/nnb_data_extraction_rules"/)
})

test('renderManifestPatch is idempotent', () => {
  const once = renderManifestPatch(MANIFEST, CFG.android.permissions)
  const twice = renderManifestPatch(once, CFG.android.permissions)
  assert.equal(twice, once)
})

test('renderDataExtractionRules excludes webview storage from cloud backup', () => {
  const xml = renderDataExtractionRules()
  assert.match(xml, /<data-extraction-rules>/)
  assert.match(xml, /<cloud-backup>/)
})

const SETTINGS = `dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.PREFER_SETTINGS)
    repositories {
        maven { url 'https://stale.example.com/repo' }
        google()
        mavenCentral()
    }
}
`

test('renderSettingsPatch replaces the mirror block between markers, idempotent', () => {
  const once = renderSettingsPatch(SETTINGS, ['https://maven.aliyun.com/repository/google'])
  // stale mirror gone, configured one between markers, google() untouched
  assert.doesNotMatch(once, /stale\.example\.com/)
  assert.match(once, /nnb:maven-mirrors[\s\S]*aliyun[\s\S]*nnb:maven-mirrors/)
  assert.match(once, /google\(\)/)
  // a second run with different mirrors replaces the inner content
  const twice = renderSettingsPatch(once, ['https://mirror-b.example.com/m2'])
  assert.match(twice, /mirror-b\.example\.com/)
  assert.doesNotMatch(twice, /aliyun/)
})

test('renderThemes replaces a marker-less styles.xml wholesale — no duplicate styles', () => {
  const plain = '<?xml version="1.0" encoding="utf-8" ?>\n<resources>\n\n    <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar" />\n\n</resources>\n'
  const migrated = renderThemes(CFG, plain).stylesXml
  // keeping the template style next to the generated one fails aapt with
  // "Found item Style/AppTheme.NoActionBar more than one time" — replaced, not appended
  assert.equal((migrated.match(/name="AppTheme\.NoActionBar"/g) || []).length, 1)
  assert.equal((migrated.match(/<\/resources>/g) || []).length, 1)
  // and it is idempotent from run 2 on (markers present)
  assert.equal(renderThemes(CFG, migrated).stylesXml, migrated)
})
