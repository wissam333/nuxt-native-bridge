// Unit tests for the app:// path resolver (audit 9.1/4) — the security core
// of the protocol handler, exercised here without Electron.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { resolveUiPath } from '../ui-router.cjs'

const root = path.resolve(process.cwd(), 'test', 'fixtures', 'www')
const inside = (...segs) => path.resolve(root, ...segs)

test('serves index.html for the bare origin (SPA entry)', () => {
  assert.deepEqual(resolveUiPath('app://./', root), { filePath: inside('index.html') })
})

test('resolves nested asset paths', () => {
  assert.deepEqual(
    resolveUiPath('app://./_nuxt/entry.abc123.js', root),
    { filePath: inside('_nuxt', 'entry.abc123.js') },
  )
})

test('strips query and hash before resolving', () => {
  assert.deepEqual(resolveUiPath('app://./_nuxt/entry.js?v=1#/dashboard', root), {
    filePath: inside('_nuxt', 'entry.js'),
  })
})

test('SPA fallback: extension-less path serves index.html', () => {
  assert.deepEqual(resolveUiPath('app://./dashboard/profile', root), { filePath: inside('index.html') })
})

test('decodes percent-encoded filenames (spaces work)', () => {
  assert.deepEqual(resolveUiPath('app://./my%20file.json', root), { filePath: inside('my file.json') })
})

test('rejects plain traversal above the ui root', () => {
  assert.equal(resolveUiPath('app://./../package.json', root), null)
})

test('rejects encoded traversal (%2e%2e)', () => {
  assert.equal(resolveUiPath('app://./%2e%2e%2fpackage.json', root), null)
})

test('decodes exactly once: double-encoded traversal stays contained', () => {
  const r = resolveUiPath('app://./%252e%252e%252fpackage.json', root)
  assert.ok(r, 'must resolve to a file INSIDE root, not escape it')
  assert.ok(r.filePath.startsWith(root + path.sep))
  assert.ok(r.filePath.endsWith(path.join('%2e%2e%2fpackage.json')), 'served as a literal (missing) file name')
})

test('rejects drive paths and backslash traversal on windows', { skip: process.platform !== 'win32' }, () => {
  assert.equal(resolveUiPath('app://./C:/Windows/win.ini', root), null)
  assert.equal(resolveUiPath('app://./..\\package.json', root), null)
})

test('rejects malformed percent-encoding', () => {
  assert.equal(resolveUiPath('app://./%zzbroken', root), null)
})

test('rejects foreign hosts on the scheme', () => {
  assert.equal(resolveUiPath('app://evil.example/payload.html', root), null)
})

test('rejects non-string input and empty root', () => {
  assert.equal(resolveUiPath(42, root), null)
  assert.equal(resolveUiPath('app://./x.txt', ''), null)
  assert.equal(resolveUiPath('app://./x.txt', undefined), null)
})
