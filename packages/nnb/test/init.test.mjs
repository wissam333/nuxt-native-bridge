// Pins nnb init's pure scaffolding renderers (plan T7): the config-block
// insertion, capacitor config, thin MainActivity and bridge-include wiring.
// The orchestrator (prompts, cap add, installs) is verified by the one-time
// e2e gate on a throwaway app.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  renderBridgeInclude, renderCapacitorConfig, renderMainActivity, renderNuxtConfigPatch, renderWrapperMirror,
  renderBuildToolsPin,
} from '../init.mjs'

const NUXT_CONFIG = `export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: true },
})
`

test('renderNuxtConfigPatch inserts the marker block and the modules entry', () => {
  const out = renderNuxtConfigPatch(NUXT_CONFIG, { id: 'com.example.hello', name: 'Hello' })
  assert.match(out, /nnb:init[\s\S]*nativeBridge:[\s\S]*app: \{ id: 'com\.example\.hello', name: 'Hello' \}/)
  assert.match(out, /modules: \['nuxt-native-bridge'\]/)
  // inserted inside defineNuxtConfig — the final closer is untouched
  assert.equal((out.match(/\}\)/g) || []).length, 1)
})

test('renderNuxtConfigPatch appends to an existing modules array', () => {
  const withModules = NUXT_CONFIG.replace(
    '  compatibilityDate',
    '  modules: [\'@nuxt/eslint\'],\n  compatibilityDate',
  )
  const out = renderNuxtConfigPatch(withModules, { id: 'com.example.hello', name: 'Hello' })
  assert.match(out, /modules: \['@nuxt\/eslint', 'nuxt-native-bridge'\]/)
  // and the module name is not duplicated into the marker block
  assert.doesNotMatch(out, /modules: \['nuxt-native-bridge'\]/)
})

test('renderNuxtConfigPatch is idempotent and leaves an existing nativeBridge alone', () => {
  const once = renderNuxtConfigPatch(NUXT_CONFIG, { id: 'com.example.hello', name: 'Hello' })
  const twice = renderNuxtConfigPatch(once, { id: 'com.example.hello', name: 'Hello' })
  assert.equal(twice, once)
})

test('renderCapacitorConfig pins webDir, autoHide off and the brand background', () => {
  const out = renderCapacitorConfig({ appId: 'com.example.hello', appName: 'Hello', brand: '#0D8A8F' })
  assert.match(out, /appId: 'com\.example\.hello'/)
  assert.match(out, /appName: 'Hello'/)
  assert.match(out, /webDir: '\.output\/public'/)
  assert.match(out, /launchAutoHide: false/)
  assert.match(out, /launchFadeOutDuration: 300/)
  assert.match(out, /backgroundColor: '#0D8A8F'/)
})

test('renderMainActivity is thin and extends the bridge activity', () => {
  const out = renderMainActivity('com.example.hello')
  assert.match(out, /^package com\.example\.hello;/m)
  assert.match(out, /extends NnbBridgeActivity/)
  assert.doesNotMatch(out, /registerPlugin/)
})

const SETTINGS = `dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
    }
}

include ':app'
`

test('renderBridgeInclude inserts markers with the computed relative path', () => {
  const out = renderBridgeInclude(SETTINGS, '../../packages/adapter-capacitor/android')
  assert.match(out, /nnb:bridge-library[\s\S]*include ':nnb-bridge'[\s\S]*projectDir = new File\('\.\.\/\.\.\/packages\/adapter-capacitor\/android'\)/)
  // before include ':app', gradle-comment markers
  assert.match(out, /\/nnb:bridge-library\n\ninclude ':app'/)
})

test('renderBridgeInclude is idempotent', () => {
  const once = renderBridgeInclude(SETTINGS, '../../packages/adapter-capacitor/android')
  const twice = renderBridgeInclude(once, '../../packages/adapter-capacitor/android')
  assert.equal(twice, once)
})

test('renderBuildToolsPin pins the pair next to compileSdk, idempotent', () => {
  const vars = `ext {\n    minSdkVersion = 24\n    compileSdkVersion = 36\n    targetSdkVersion = 36\n}\n`
  const varsOut = renderBuildToolsPin(vars)
  assert.match(varsOut, /compileSdkVersion = 36\n {4}buildToolsVersion = '36\.0\.0'/)
  assert.equal(renderBuildToolsPin(varsOut), varsOut)
  // pre-pinned files pass through untouched
  const pinned = `ext {\n    buildToolsVersion = '34.0.0'\n}\n`
  assert.equal(renderBuildToolsPin(pinned), pinned)
})

test('renderWrapperMirror swaps only the gradle-dist host', () => {
  const props = 'distributionUrl=https\\://services.gradle.org/distributions/gradle-8.14.3-all.zip\nnetworkTimeout=10000\n'
  const out = renderWrapperMirror(props)
  assert.match(out, /^distributionUrl=https:\/\/mirrors\.cloud\.tencent\.com\/gradle\/gradle-8\.14\.3-all\.zip$/m)
  assert.match(out, /^networkTimeout=10000$/m)
  // unescaped input and idempotency
  assert.equal(renderWrapperMirror('distributionUrl=https://services.gradle.org/distributions/gradle-9.0-all.zip\n'),
    'distributionUrl=https://mirrors.cloud.tencent.com/gradle/gradle-9.0-all.zip\n')
  assert.equal(renderWrapperMirror(out), out)
})
