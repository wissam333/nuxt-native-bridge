// NNB Electron Forge config (spec §6.2). App identity comes from env so the
// `nnb` CLI can generate this per app without code changes (defaults = placeholders).
const { FusesPlugin } = require('@electron-forge/plugin-fuses')
const { FuseV1Options, FuseVersion } = require('@electron/fuses')

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
    files: ['main.cjs', 'ui-router.cjs', 'window-state.cjs', 'preload.cjs', 'forge.config.cjs', 'package.json', 'www/**/*'],
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
