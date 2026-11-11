// Pins useNativeSafeArea (plan T4, audit 20): the android path is the only
// supported one; the CSS-var writer is THE single token writer; web/electron
// keep the base.css env() fallback untouched.
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useNativePlatform } from '../src/runtime/composables/useNativePlatform'
import { applySafeAreaVars, useNativeSafeArea } from '../src/runtime/composables/useNativeSafeArea'

vi.mock('../src/runtime/composables/useNativePlatform', () => ({
  useNativePlatform: vi.fn(),
}))

const mockPlatform = vi.mocked(useNativePlatform)

function fakeDoc() {
  const set = vi.fn()
  return { set, doc: { documentElement: { style: { setProperty: set } } } }
}

beforeEach(() => {
  mockPlatform.mockReset()
})

describe('applySafeAreaVars', () => {
  it('writes both tokens on :root — one writer, px units', () => {
    const { set, doc } = fakeDoc()
    applySafeAreaVars({ top: 24, bottom: 32 }, doc as unknown as Document)
    expect(set).toHaveBeenCalledWith('--nnb-inset-top', '24px')
    expect(set).toHaveBeenCalledWith('--nnb-inset-bottom', '32px')
  })
})

describe('useNativeSafeArea', () => {
  it('web/electron: isSupported false, zero insets, no CSS writes', () => {
    mockPlatform.mockReturnValue({ target: 'web', os: 'unknown', isElectron: false, isAndroid: false, isNative: false })
    const { set, doc } = fakeDoc()
    const { insets, isSupported } = useNativeSafeArea()
    expect(isSupported).toBe(false)
    expect(insets.value).toEqual({ top: 0, bottom: 0 })
    expect(set).not.toHaveBeenCalled()
    void doc
  })

  it('android: isSupported true — plugin path selected', () => {
    mockPlatform.mockReturnValue({ target: 'android', os: 'android', isElectron: false, isAndroid: true, isNative: true })
    const { isSupported } = useNativeSafeArea()
    expect(isSupported).toBe(true)
  })
})
