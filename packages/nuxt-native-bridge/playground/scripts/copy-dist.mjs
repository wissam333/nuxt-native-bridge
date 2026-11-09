// Cross-platform replacement for the starter's `xcopy /E /I /Y .output\public
// my-app\public_nuxt` (spec §9.1 / 2: xcopy is Windows-only).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const src = path.join(root, '.output', 'public')
const dest = path.join(root, 'my-app', 'public_nuxt')

fs.cpSync(src, dest, { recursive: true, force: true })
console.log(`copied ${src} -> ${dest}`)
