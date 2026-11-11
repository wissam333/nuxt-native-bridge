// Pins apiBase carrying (plan T5): web gets undefined even when set —
// native targets get the value. The composable wires it, the pure fn is the
// testable core.
import { describe, expect, it } from 'vitest'

import { pickApiBase } from '../src/runtime/apiBase'

describe('pickApiBase', () => {
  it('web: undefined even when apiBase is set', () => {
    expect(pickApiBase('web', { apiBase: 'https://api.demo' })).toBeUndefined()
  })

  it('android: the value passes through', () => {
    expect(pickApiBase('android', { apiBase: 'https://api.demo' })).toBe('https://api.demo')
  })

  it('electron: native too — the value passes through', () => {
    expect(pickApiBase('electron', { apiBase: 'https://api.demo' })).toBe('https://api.demo')
  })

  it('native without config: undefined, no crash', () => {
    expect(pickApiBase('android', undefined)).toBeUndefined()
  })
})
