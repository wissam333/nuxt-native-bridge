// Drift guard: packages/nnb/bridge-android is the PUBLISHED copy of the bridge
// library that `nnb init` scaffolds into apps. It must stay byte-identical to
// packages/adapter-capacitor/android (the source of truth used by the
// playground build). If this test fails, re-copy the sources.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const CLI_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const VENDORED = path.join(CLI_DIR, 'bridge-android')
const ORIGINAL = path.resolve(CLI_DIR, '..', 'adapter-capacitor', 'android')

const sourceFiles = (root) => {
  if (!fs.existsSync(root)) return null
  const out = []
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name === 'build' || entry.name === '.gitignore') continue
      const p = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(p)
      else out.push([path.relative(root, p), crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')])
    }
  }
  walk(root)
  return out
}

test('vendored bridge-android matches adapter-capacitor/android', () => {
  const vendored = sourceFiles(VENDORED)
  const original = sourceFiles(ORIGINAL)
  assert.ok(vendored, 'bridge-android vendored copy missing from the CLI package')
  if (original === null) return // published tarball: adapter not a sibling — nothing to compare
  assert.deepEqual(vendored, original)
})
