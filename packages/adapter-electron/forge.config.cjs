// NNB Electron Forge config (spec §6.2). App identity comes from env so the
// `nnb` CLI can generate this per app without code changes (defaults = placeholders).
const { FusesPlugin } = require('@electron-forge/plugin-fuses')
const { FuseV1Options, FuseVersion } = require('@electron/fuses')

const { cpSync } = require('node:fs')
const path = require('node:path')

// pnpm's symlinked node_modules does not survive electron-packager's copy
// (packages arrive as empty dirs — found by the T6 packaged-app smoke gate).
// Pack prod dependencies as real files after the normal copy, resolving each
// the way the app's Node does (hoisted layouts included).
function copyProdDeps(buildPath, _electronVersion, _platform, _arch, callback) {
  try {
    const deps = Object.keys(require('./package.json').dependencies || {})
    for (const name of deps) {
      const entry = require.resolve(name, { paths: [__dirname] })
      cpSync(path.dirname(entry), path.join(buildPath, 'node_modules', name), { recursive: true, dereference: true })
    }
    callback()
  }
  catch (err) {
    callback(err)
  }
}

const NAME = process.env.NNB_APP_NAME || 'NnbApp'
const EXECUTABLE = process.env.NNB_EXECUTABLE || 'nnbapp'
const ICON = process.env.NNB_ICON || undefined

module.exports = {
  packagerConfig: {
    name: NAME,
    executableName: EXECUTABLE,
    asar: true,
    icon: ICON,
    // The whole app (incl. www/) rides inside app.asar, so the integrity fuses
    // cover the UI — replaces the old fs-extra app.asar.unpacked copy (9.1/3).
    // Prod deps ride along via afterCopy (pnpm-safe).
    files: ['main.cjs', 'ui-router.cjs', 'window-state.cjs', 'preload.cjs', 'forge.config.cjs', 'package.json', 'www/**/*'],
    afterCopy: [copyProdDeps],
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: EXECUTABLE,
        setupExe: `${NAME}-Setup.exe`,
        setupIcon: ICON,
        noMsi: true,
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin', 'linux'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          icon: ICON,
        },
      },
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
}
