// Pure path logic for the app:// protocol handler (audit 9.1/4).
// Kept dependency-free so node --test can exercise it without Electron.
const path = require('node:path')

// Maps an app:// URL to a file inside uiRoot, or null when the request must be
// rejected. SPA fallback: a path without an extension serves index.html
// (spec §3.1 history routing).
function resolveUiPath(rawUrl, uiRoot) {
  if (typeof rawUrl !== 'string' || !uiRoot) return null

  // The adapter only ever loads app://./ (host "."). Anything else is not ours.
  let rest = rawUrl.replace(/^app:\/\/\.\//, '')
  if (rest === rawUrl) return null

  rest = rest.split('?')[0].split('#')[0]

  let decoded
  try {
    decoded = decodeURIComponent(rest)
  }
  catch {
    return null // malformed percent-encoding
  }

  if (!decoded || !path.posix.extname(decoded)) decoded = 'index.html'

  // Containment must run on the RESOLVED path: decodeURIComponent alone can be
  // escaped by double-encoding, absolute drive paths, or backslash tricks.
  const root = path.resolve(uiRoot)
  const filePath = path.resolve(root, decoded)
  if (filePath !== root && !filePath.startsWith(root + path.sep)) return null

  return { filePath }
}

module.exports = { resolveUiPath }
