// Asserts the hardened shell boots and serves its UI: launches electron with
// NNB_SMOKE and a tiny fixture site; main.cjs exits 0 only when the protocol
// served the fixture page. Verdict text on stdout is best-effort; the RELIABLE
// signal is the process exit code.
const { spawnSync } = require('node:child_process')
const path = require('node:path')

// Under plain Node, require('electron') is the Electron binary path.
const electron = require('electron')

const result = spawnSync(electron, ['.'], {
  cwd: path.join(__dirname, '..'),
  env: {
    ...process.env,
    NNB_SMOKE: '1',
    // Caller's NNB_UI_DIR wins (real-UI runs); fixture is only the default.
    ...(!process.env.NNB_UI_DIR && { NNB_UI_DIR: path.join(__dirname, '..', 'test', 'fixtures', 'www') }),
  },
  encoding: 'utf8',
})

const passed = result.status === 0
console.log(passed ? '[nnb] smoke: PASS' : `[nnb] smoke: FAIL (status=${result.status}${result.error ? `, ${result.error}` : ''})`)
if (!passed && result.stdout) console.log(result.stdout)
if (!passed && result.stderr) console.log(result.stderr)
process.exit(passed ? 0 : 1)
