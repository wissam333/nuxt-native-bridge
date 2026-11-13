// T6 gate B part 2: read the packaged binary's fuses and assert they match
// the forge.config.cjs FusesPlugin wire (spec §11-1). getCurrentFuseWire
// returns an array-like of '0'/'1' bits indexed by FuseV1Options.
const { getCurrentFuseWire, FuseV1Options } = require('@electron/fuses')

const exe = 'D:/2027/USD/packages/adapter-electron/out/NNB Playground-win32-x64/nnbplayground.exe'

// Single source of truth: the values in forge.config.cjs.
const EXPECTED = {
  [FuseV1Options.RunAsNode]: false,
  [FuseV1Options.EnableCookieEncryption]: true,
  [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
  [FuseV1Options.EnableNodeCliInspectArguments]: false,
  [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
  [FuseV1Options.OnlyLoadAppFromAsar]: true,
}

getCurrentFuseWire(exe)
  .then((wire) => {
    // The wire comes back as a Buffer: byte 49 ('1') = flipped on.
    const isOn = idx => wire[idx] === 49 || wire[idx] === '1'
    const mismatches = Object.entries(EXPECTED)
      .filter(([idx, want]) => isOn(idx) !== want)
      .map(([idx]) => idx)
    if (mismatches.length > 0) {
      console.error(`fuse mismatch at indices: ${mismatches.join(', ')}`)
      process.exit(1)
    }
    console.log('[nnb] fuses ok — packaged binary matches forge config')
  })
  .catch((e) => {
    console.error(`getCurrentFuseWire failed: ${e.message}`)
    process.exit(1)
  })
