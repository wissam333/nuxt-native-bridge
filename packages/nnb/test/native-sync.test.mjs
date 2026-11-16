// Locks the native-file generator: themes from brand/splash config, manifest
// permission markers (idempotent), allowBackup=false + dataExtractionRules.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderThemes, renderManifestPatch, renderDataExtractionRules, renderSettingsPatch, renderBuildscriptPatch, renderRootGradleTools, renderSplashColors, renderSplashDrawables } from '../native-sync.mjs'

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

test('renderSettingsPatch adds dependencyResolutionManagement when the template has no repositories', () => {
  // cap-8 template: only project includes, no repositories anywhere
  const cap8 = `include ':app'\nproject(':capacitor-cordova-android-plugins').projectDir = new File('./capacitor-cordova-android-plugins/')\n`
  const out = renderSettingsPatch(cap8, ['https://maven.aliyun.com/repository/google'])
  assert.match(out, /^dependencyResolutionManagement \{/)
  assert.match(out, /PREFER_SETTINGS/)
  assert.match(out, /nnb:maven-mirrors[\s\S]*aliyun[\s\S]*nnb:maven-mirrors\n {8}google\(\)/)
  // project includes preserved after the new block
  assert.match(out, /\ninclude ':app'/)
  // idempotent
  assert.equal(renderSettingsPatch(out, ['https://maven.aliyun.com/repository/google']), out)
})

test('renderBuildscriptPatch mirrors the buildscript repositories block', () => {
  const gradle = `buildscript {\n    repositories {\n        google()\n        mavenCentral()\n    }\n    dependencies {\n        classpath 'com.android.tools.build:gradle:8.13.0'\n    }\n}\n\nallprojects {\n    repositories {\n        google()\n    }\n}\n`
  const out = renderBuildscriptPatch(gradle, ['https://maven.aliyun.com/repository/google'])
  // first repositories block (buildscript) marked, google() kept after it
  assert.match(out, /buildscript \{\n {4}repositories \{\n {8}\/\/ nnb:maven-mirrors[\s\S]*aliyun[\s\S]*nnb:maven-mirrors\n {8}google\(\)/)
  // allprojects block untouched (PREFER_SETTINGS governs dependency repos)
  assert.match(out, /allprojects \{\n {4}repositories \{\n {8}google\(\)/)
  // idempotent + mirrors update between markers
  const twice = renderBuildscriptPatch(out, ['https://mirror-b.example.com/m2'])
  assert.match(twice, /mirror-b\.example\.com/)
  assert.doesNotMatch(twice, /aliyun/)
})

test('renderRootGradleTools appends the subprojects build-tools override, idempotent', () => {
  const gradle = `buildscript {\n    repositories {\n        google()\n    }\n}\n\ntask clean(type: Delete) {\n    delete rootProject.buildDir\n}\n`
  const out = renderRootGradleTools(gradle)
  assert.match(out, /nnb:build-tools[\s\S]*subprojects \{[\s\S]*rootProject\.ext\.has\('buildToolsVersion'\)[\s\S]*nnb:build-tools/)
  // appended after the clean task, not before it
  assert.match(out, /task clean[\s\S]*nnb:build-tools/)
  // idempotent
  assert.equal(renderRootGradleTools(out), out)
})

test('renderSplashColors creates the colors file and updates its own markers', () => {
  const fresh = renderSplashColors(null, { light: '#0D8A8F', dark: '#0B1416' })
  assert.match(fresh, /^<\?xml version="1\.0" encoding="utf-8"\?>\n<resources>/)
  assert.match(fresh, /<color name="splash_bg">#0D8A8F<\/color>/)
  assert.match(fresh, /<color name="splash_bg_dark">#0B1416<\/color>/)
  // idempotent
  assert.equal(renderSplashColors(fresh, { light: '#0D8A8F', dark: '#0B1416' }), fresh)
  // marked run with new colors replaces between markers
  const updated = renderSplashColors(fresh, { light: '#111111', dark: '#222222' })
  assert.match(updated, /splash_bg">#111111/)
  assert.doesNotMatch(updated, /#0D8A8F/)
  // hand-written colors.xml: splash colors appended in markers, own entries kept
  const hand = '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="brand">#ABCDEF</color>\n</resources>\n'
  const handOut = renderSplashColors(hand, { light: '#0D8A8F', dark: '#0B1416' })
  assert.match(handOut, /<color name="brand">#ABCDEF<\/color>/)
  assert.match(handOut, /<color name="splash_bg">#0D8A8F<\/color>/)
  assert.equal(renderSplashColors(handOut, { light: '#0D8A8F', dark: '#0B1416' }), handOut)
})

test('renderSplashDrawables: no logo = plain color splash; logo = bitmap + inset icon', () => {
  const plain = renderSplashDrawables({ light: '#0D8A8F', dark: '#0B1416', hasLogo: false })
  assert.match(plain['splash.xml'], /<color android:color="@color\/splash_bg" \/>/)
  assert.doesNotMatch(plain['splash.xml'], /splash_logo/)
  assert.match(plain['splash_dark.xml'], /@color\/splash_bg_dark/)
  assert.match(plain['splash_icon.xml'], /<layer-list[^>]*\/>/)
  const logo = renderSplashDrawables({ light: '#0D8A8F', dark: '#0B1416', hasLogo: true })
  assert.match(logo['splash.xml'], /<bitmap android:src="@drawable\/splash_logo" android:gravity="fill" \/>/)
  assert.match(logo['splash_icon.xml'], /android:inset="20%"/)
})

test('renderThemes emits values-night styles — T9: Android 12+ draws the cold-start splash from resources before the process runs, so the runtime dark pref can never repaint it; splash follows system night', () => {
  const { stylesNightXml } = renderThemes(CFG)
  assert.match(stylesNightXml, /name="AppTheme\.NoActionBarLaunch"/)
  assert.match(stylesNightXml, /windowSplashScreenBackground">#0B1416/)
  assert.match(stylesNightXml, /android:windowLightStatusBar">false/)
  assert.match(stylesNightXml, /@drawable\/splash_dark/)
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
