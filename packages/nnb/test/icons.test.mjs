// Locks the pure parts of the icon generator: config parsing and the hand-
// rolled ICO container (binary formats are where silent corruption hides).
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { hexToRgb, parseBackground, writePngAsIco } from '../icons.mjs'

test('hexToRgb parses #RRGGBB and rejects the rest', () => {
  assert.deepEqual(hexToRgb('#0D8A8F'), { r: 13, g: 138, b: 143, alpha: 1 })
  assert.throws(() => hexToRgb('0D8A8F'))
  assert.throws(() => hexToRgb('#12345'))
})

test('parseBackground: string = flat, pair = gradient', () => {
  const flat = parseBackground('#0D8A8F')
  assert.equal(flat.flat, true)
  assert.deepEqual(flat.top, flat.bottom)

  const grad = parseBackground(['#139CAE', '#0C6271'])
  assert.equal(grad.flat, false)
  assert.equal(grad.top.r, 19)
  assert.equal(grad.bottom.r, 12)
})

test('parseBackground rejects an empty array', () => {
  assert.throws(() => parseBackground([]))
})

test('writePngAsIco emits a valid single-image ICO header', () => {
  const png = Buffer.alloc(6, 0xAB) // payload content is irrelevant here
  const dir = fs.mkdtempSync(path.join(tmpdir(), 'nnb-ico-'))
  const file = path.join(dir, 'x.ico')
  writePngAsIco(png, file)
  const buf = fs.readFileSync(file)
  assert.equal(buf.readUInt16LE(2), 1) // type ICO
  assert.equal(buf.readUInt16LE(4), 1) // image count
  assert.equal(buf.readUInt32LE(14), png.length) // data size
  assert.equal(buf.readUInt32LE(18), 22) // data offset = 6 + 16
  assert.equal(buf.length, 22 + png.length)
})
