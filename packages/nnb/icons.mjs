// `nnb icons` — parameterized icon + splash generator (spec §6.5).
// Generalized from the playground's starter script; every color and path now
// comes from nuxt.config.ts nativeBridge.icons / nativeBridge.brand.color.
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const ensureDir = (dir) => {
  fs.mkdirSync(dir, { recursive: true })
}

// #RRGGBB → {r,g,b}. Config is the single source, so a bad value must be loud.
export function hexToRgb(hex) {
  const m = typeof hex === 'string' && /^#[0-9a-f]{6}$/i.exec(hex.trim())
  if (!m) throw new Error(`invalid color ${JSON.stringify(hex)} — expected #RRGGBB`)
  const s = hex.trim().slice(1)
  return {
    r: Number.parseInt(s.slice(0, 2), 16),
    g: Number.parseInt(s.slice(2, 4), 16),
    b: Number.parseInt(s.slice(4, 6), 16),
    alpha: 1,
  }
}

// icons.android.background: "#hex" = flat plate, [top, bottom] = vertical gradient.
export function parseBackground(background) {
  if (typeof background === 'string') {
    const rgb = hexToRgb(background)
    return { top: rgb, bottom: rgb, flat: true }
  }
  if (Array.isArray(background) && background.length === 2) {
    return { top: hexToRgb(background[0]), bottom: hexToRgb(background[1]), flat: false }
  }
  throw new Error('nativeBridge.icons.android.background must be "#RRGGBB" or [topHex, bottomHex]')
}

/** Write a simple single-image ICO that embeds a PNG (works for Electron + browsers). */
export function writePngAsIco(pngBuffer, outPath) {
  const size = pngBuffer.length
  const buf = Buffer.alloc(6 + 16 + size)
  let off = 0
  buf.writeUInt16LE(0, off)
  off += 2 // reserved
  buf.writeUInt16LE(1, off)
  off += 2 // type ICO
  buf.writeUInt16LE(1, off)
  off += 2 // count
  buf.writeUInt8(0, off)
  off += 1 // width 0 = 256
  buf.writeUInt8(0, off)
  off += 1 // height 0 = 256
  buf.writeUInt8(0, off)
  off += 1 // colors
  buf.writeUInt8(0, off)
  off += 1 // reserved
  buf.writeUInt16LE(1, off)
  off += 2 // planes
  buf.writeUInt16LE(32, off)
  off += 2 // bpp
  buf.writeUInt32LE(size, off)
  off += 4
  buf.writeUInt32LE(22, off)
  off += 4 // offset
  pngBuffer.copy(buf, off)
  fs.writeFileSync(outPath, buf)
}

const resizeCover = (src, size) =>
  sharp(src)
    .resize(size, size, { fit: 'cover', position: 'centre' })
    .png()
    .toBuffer()

/**
 * Android launcher icons are assembled from the configured transparent glyph
 * over a brand background (config: flat color or vertical gradient).
 *
 * Launcher circle/squircle masks can clip up to ~18% of the adaptive icon, so
 * the glyph is scaled to glyphFraction (default 0.5) of the canvas — safely
 * inside every mask's visible zone — then centered. No crop, no plate band.
 */
const circleMaskSvg = size =>
  Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white"/></svg>`,
  )

/** Bounding box of non-transparent content as fractions of the source size. */
const contentBox = async (src) => {
  const { data, info } = await sharp(src).raw().toBuffer({ resolveWithObject: true })
  const W = info.width
  const H = info.height
  const C = info.channels
  let x0 = W
  let y0 = H
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const a = C > 3 ? data[(y * W + x) * C + 3] : 255
      if (a >= 5) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  return { wf: (x1 - x0 + 1) / W, hf: (y1 - y0 + 1) / H }
}

/** Background factory for this run (flat or gradient) — spec §6.5. */
const makeBrandBg = ({ top, bottom }) => {
  const brandBg = (size) => {
    const buf = Buffer.alloc(size * size * 4)
    for (let y = 0; y < size; y++) {
      const t = size === 1 ? 0 : y / (size - 1)
      const r = Math.round(top.r + (bottom.r - top.r) * t)
      const g = Math.round(top.g + (bottom.g - top.g) * t)
      const b = Math.round(top.b + (bottom.b - top.b) * t)
      for (let x = 0; x < size; x++) {
        const o = (y * size + x) * 4
        buf[o] = r
        buf[o + 1] = g
        buf[o + 2] = b
        buf[o + 3] = 255
      }
    }
    return sharp(buf, { raw: { width: size, height: size, channels: 4 } })
      .png()
      .toBuffer()
  }
  return brandBg
}

/** Glyph resized to glyphFraction of the canvas width (centered, non-cropped). */
const glyphFitted = async (src, size, frac) => {
  const box = await contentBox(src)
  const inner = Math.max(
    1,
    Math.round(Math.min((size * frac) / box.wf, size * 0.92)),
  )
  const glyph = await sharp(src)
    .resize(inner, inner, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()
  return { glyph, pad: Math.round((size - inner) / 2) }
}

const glyphOnBg = async (src, size, frac, brandBg) => {
  const bg = await brandBg(size)
  const { glyph, pad } = await glyphFitted(src, size, frac)
  return sharp(bg).composite([{ input: glyph, top: pad, left: pad }]).png().toBuffer()
}

const launcherRound = async (src, size, frac, brandBg) => {
  const img = await glyphOnBg(src, size, frac, brandBg)
  return sharp(img)
    .composite([{ input: circleMaskSvg(size), blend: 'dest-in' }])
    .png()
    .toBuffer()
}

/** Adaptive foreground layer: glyph on a transparent canvas. */
const glyphFg = async (src, size, frac) => {
  const { glyph, pad } = await glyphFitted(src, size, frac)
  return sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: glyph, top: pad, left: pad }])
    .png()
    .toBuffer()
}

const write = async (root, filePath, buffer) => {
  ensureDir(path.dirname(filePath))
  fs.writeFileSync(filePath, buffer)
  console.log('  ✓', path.relative(root, filePath))
}

// Entrypoint. cfg.items = parsed nativeBridge; all paths app-dir relative.
export async function buildIcons(appDir, icons, brandColor) {
  const app = p => path.join(appDir, p)
  const src = app(icons.source)
  if (!fs.existsSync(src)) throw new Error(`icons.source not found: ${icons.source}`)

  // Audit #13: brand.color is the single plate source; icon background may add
  // a gradient, but an absent brand color falls back to the background top.
  const plate = brandColor || (Array.isArray(icons.android?.background) ? icons.android.background[0] : icons.android?.background)
  if (!plate) throw new Error('no brand color: set nativeBridge.brand.color (spec §5, audit 13)')

  console.log('Launcher source:', icons.source)
  console.log('[web / electron]')

  const icon512 = await resizeCover(src, 512)
  const icon192 = await resizeCover(src, 192)
  const icon256 = await resizeCover(src, 256)
  const icon48 = await resizeCover(src, 48)
  const icon72 = await resizeCover(src, 72)

  await write(appDir, app('public/icon.png'), icon512)
  await write(appDir, app('public/icon-192x192.png'), icon192)
  await write(appDir, app('public/favicon.png'), icon256)
  await write(appDir, app('public/badge-72x72.png'), icon72)
  writePngAsIco(icon256, app('public/favicon.ico'))
  console.log('  ✓ public/favicon.ico')
  await write(appDir, app('public/favicon-48.png'), icon48)

  // Android block runs only when the shell exists (targets: ["web"] apps skip).
  const androidRes = app('android/app/src/main/res')
  if (!fs.existsSync(path.join(appDir, 'android'))) {
    console.log('[android skipped — no android/ shell in this app]')
    return
  }

  console.log('[android launcher mipmaps]')
  const glyph = app(icons.android?.glyph || '')
  if (!fs.existsSync(glyph)) throw new Error('nativeBridge.icons.android.glyph not found in this app')
  const bgSpec = parseBackground(icons.android?.background)
  const brandBg = makeBrandBg(bgSpec)
  const frac = icons.android?.glyphFraction ?? 0.5
  console.log('  glyph:', icons.android.glyph, '—', bgSpec.flat ? 'flat plate' : 'vertical gradient', '—', Math.round(frac * 100) + '% of canvas')

  const densities = [
    { name: 'ldpi', launcher: 36, foreground: 81 },
    { name: 'mdpi', launcher: 48, foreground: 108 },
    { name: 'hdpi', launcher: 72, foreground: 162 },
    { name: 'xhdpi', launcher: 96, foreground: 216 },
    { name: 'xxhdpi', launcher: 144, foreground: 324 },
    { name: 'xxxhdpi', launcher: 192, foreground: 432 },
  ]

  for (const d of densities) {
    const dir = path.join(androidRes, `mipmap-${d.name}`)
    ensureDir(dir)

    // Legacy + round + adaptive: glyph sits in the foreground safe zone, the
    // background carries the brand, so launcher masks never clip the glyph.
    const [legacy, round, fg, bg] = await Promise.all([
      glyphOnBg(glyph, d.launcher, frac, brandBg),
      launcherRound(glyph, d.launcher, frac, brandBg),
      glyphFg(glyph, d.foreground, frac),
      brandBg(d.foreground),
    ])

    await write(appDir, path.join(dir, 'ic_launcher.png'), legacy)
    await write(appDir, path.join(dir, 'ic_launcher_round.png'), round)
    await write(appDir, path.join(dir, 'ic_launcher_foreground.png'), fg)
    await write(appDir, path.join(dir, 'ic_launcher_background.png'), bg)
  }

  const bgColorXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${plate}</color>
</resources>
`
  fs.writeFileSync(path.join(androidRes, 'values', 'ic_launcher_background.xml'), bgColorXml)
  console.log('  ✓ android .../values/ic_launcher_background.xml')

  console.log('[android splash]')
  if (icons.splash) {
    const splashSrc = app(icons.splash)
    if (!fs.existsSync(splashSrc)) throw new Error('nativeBridge.icons.splash not found in this app')
    // Do not write drawable/splash.png — it would collide with drawable/splash.xml
    const splashLogo = await sharp(splashSrc)
      .resize(1024, 1024, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer()
    await write(appDir, path.join(androidRes, 'drawable', 'splash_logo.png'), splashLogo)
    await write(appDir, path.join(androidRes, 'drawable', 'splash_icon_logo.png'), splashLogo)
  }
  else {
    console.log('  (no splash configured)')
  }

  console.log('Done. Rebuild Electron / Android to pick up new icons.')
}
