/**
 * Generate app icons from the brand assets:
 * - Web / desktop launcher + favicon: public/square-logo.png (full-bleed, own bg)
 * - Android launcher: public/3.png (transparent glyph) + programmatic brand
 *   gradient background, so launcher masks never clip the glyph
 * - Android splash: public/4.png
 *
 * Usage: node scripts/generate-icons.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const launcherSrcPath = path.join(root, 'public', 'square-logo.png')
const launcherJpgPath = path.join(root, 'public', 'square-logo.jpg')
const glyphSrcPath = path.join(root, 'public', '3.png')
const splashSrcPath = path.join(root, 'public', '4.png')

// Brand teal — splash plate + adaptive fallback
const BRAND_BG = { r: 13, g: 138, b: 143, alpha: 1 } // #0D8A8F — future `nnb icons` config input
void BRAND_BG

// Programmatic background for Android launcher icons — a vertical gradient
// echoed from the square-logo artwork (light teal top, deep teal bottom).
const BG_TOP_RGB = { r: 19, g: 156, b: 174 }
const BG_BOTTOM_RGB = { r: 12, g: 98, b: 113 }

const ensureDir = (dir) => {
  fs.mkdirSync(dir, { recursive: true })
}

/** Write a simple single-image ICO that embeds a PNG (works for Electron + browsers). */
const writePngAsIco = (pngBuffer, outPath) => {
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
 * Android launcher icons are assembled from public/3.png (the logo glyph with a
 * transparent background) over a programmatically-drawn brand gradient.
 *
 * The glyph spans ~96% of the 3.png canvas, and launcher circle/squircle masks
 * can clip up to ~18% of the adaptive icon. So we scale the glyph so it ends up
 * at GLYPH_TARGET_FRAC (≈66%) of the icon canvas — safely inside every mask's
 * visible zone — then center it on the gradient. No crop, no flat plate band.
 */
const GLYPH_TARGET_FRAC = 0.5

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

/** Brand gradient background (vertical). */
const brandBg = (size) => {
  const buf = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    const t = size === 1 ? 0 : y / (size - 1)
    const r = Math.round(BG_TOP_RGB.r + (BG_BOTTOM_RGB.r - BG_TOP_RGB.r) * t)
    const g = Math.round(BG_TOP_RGB.g + (BG_BOTTOM_RGB.g - BG_TOP_RGB.g) * t)
    const b = Math.round(BG_TOP_RGB.b + (BG_BOTTOM_RGB.b - BG_TOP_RGB.b) * t)
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

/** Glyph resized so its width lands at GLYPH_TARGET_FRAC of the canvas (centered). */
const glyphFitted = async (src, size) => {
  const box = await contentBox(src)
  const inner = Math.max(
    1,
    Math.round(Math.min((size * GLYPH_TARGET_FRAC) / box.wf, size * 0.92)),
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

/** Legacy / round icon: glyph on the programmatic brand gradient. */
const glyphOnBg = async (src, size) => {
  const bg = await brandBg(size)
  const { glyph, pad } = await glyphFitted(src, size)
  return sharp(bg).composite([{ input: glyph, top: pad, left: pad }]).png().toBuffer()
}

/** Adaptive foreground layer: glyph on a transparent canvas. */
const glyphFg = async (src, size) => {
  const { glyph, pad } = await glyphFitted(src, size)
  return sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: glyph, top: pad, left: pad }])
    .png()
    .toBuffer()
}

const launcherRound = async (src, size) => {
  const img = await glyphOnBg(src, size)
  return sharp(img)
    .composite([{ input: circleMaskSvg(size), blend: 'dest-in' }])
    .png()
    .toBuffer()
}

const write = async (filePath, buffer) => {
  ensureDir(path.dirname(filePath))
  fs.writeFileSync(filePath, buffer)
  console.log('  ✓', path.relative(root, filePath))
}

async function ensureLauncherPng() {
  if (fs.existsSync(launcherSrcPath)) return
  if (!fs.existsSync(launcherJpgPath)) {
    console.error('Missing launcher source: public/square-logo.png (or .jpg)')
    process.exit(1)
  }
  await sharp(launcherJpgPath).png().toFile(launcherSrcPath)
  console.log('  ✓ public/square-logo.png (from square-logo.jpg)')
}

async function main() {
  await ensureLauncherPng()

  if (!fs.existsSync(splashSrcPath)) {
    console.error('Missing splash source: public/4.png')
    process.exit(1)
  }

  console.log('Launcher source:', path.relative(root, launcherSrcPath))
  console.log('Splash source:', path.relative(root, splashSrcPath))
  console.log('\n[web / electron]')

  const icon512 = await resizeCover(launcherSrcPath, 512)
  const icon192 = await resizeCover(launcherSrcPath, 192)
  const icon256 = await resizeCover(launcherSrcPath, 256)
  const icon48 = await resizeCover(launcherSrcPath, 48)
  const icon72 = await resizeCover(launcherSrcPath, 72)

  await write(path.join(root, 'public', 'icon.png'), icon512)
  await write(path.join(root, 'public', 'icon-192x192.png'), icon192)
  await write(path.join(root, 'public', 'favicon.png'), icon256)
  await write(path.join(root, 'public', 'badge-72x72.png'), icon72)
  await write(path.join(root, 'assets', 'icon.png'), icon512)

  writePngAsIco(icon256, path.join(root, 'public', 'favicon.ico'))
  console.log('  ✓ public/favicon.ico')
  await write(path.join(root, 'public', 'favicon-48.png'), icon48)

  console.log('[android launcher mipmaps]')

  if (!fs.existsSync(glyphSrcPath)) {
    console.error('Missing glyph source: public/3.png')
    process.exit(1)
  }
  console.log('  glyph source: public/3.png, bg: vertical brand gradient')
  console.log('  glyph target:', Math.round(GLYPH_TARGET_FRAC * 100) + '% of canvas')

  const densities = [
    { name: 'ldpi', launcher: 36, foreground: 81 },
    { name: 'mdpi', launcher: 48, foreground: 108 },
    { name: 'hdpi', launcher: 72, foreground: 162 },
    { name: 'xhdpi', launcher: 96, foreground: 216 },
    { name: 'xxhdpi', launcher: 144, foreground: 324 },
    { name: 'xxxhdpi', launcher: 192, foreground: 432 },
  ]

  const androidRes = path.join(root, 'android', 'app', 'src', 'main', 'res')

  for (const d of densities) {
    const dir = path.join(androidRes, `mipmap-${d.name}`)
    ensureDir(dir)

    // Transparent glyph from public/3.png on the programmatic brand gradient.
    // Adaptive: glyph sits in the foreground safe zone, background carries the
    // gradient, so masks never clip the glyph and no plate shows behind it.
    const [legacy, round, fg, bg] = await Promise.all([
      glyphOnBg(glyphSrcPath, d.launcher),
      launcherRound(glyphSrcPath, d.launcher),
      glyphFg(glyphSrcPath, d.foreground),
      brandBg(d.foreground),
    ])

    await write(path.join(dir, 'ic_launcher.png'), legacy)
    await write(path.join(dir, 'ic_launcher_round.png'), round)
    await write(path.join(dir, 'ic_launcher_foreground.png'), fg)
    await write(path.join(dir, 'ic_launcher_background.png'), bg)
  }

  const bgColorXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#0D8A8F</color>
</resources>
`
  fs.writeFileSync(
    path.join(androidRes, 'values', 'ic_launcher_background.xml'),
    bgColorXml,
  )
  console.log('  ✓ android .../values/ic_launcher_background.xml')

  console.log('\n[android splash]')
  // Do not write drawable/splash.png — it would collide with drawable/splash.xml
  const splashLogo = await sharp(splashSrcPath)
    .resize(1024, 1024, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()
  await write(path.join(androidRes, 'drawable', 'splash_logo.png'), splashLogo)
  await write(path.join(androidRes, 'drawable', 'splash_icon_logo.png'), splashLogo)

  console.log('\nDone. Rebuild Electron / Android to pick up new icons.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
