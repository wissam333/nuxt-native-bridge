// Pins the pure splash-plan helper: spec defaults, clamping of non-positive
// values, passthrough of configured ones (plan T3, audit 19).
import { describe, expect, it } from 'vitest'
import { computeSplashPlan, SPLASH_DEFAULTS } from '../src/runtime/splash'

const DEFAULTS = { hideOnMounted: true, fade: SPLASH_DEFAULTS.fade, failsafe: SPLASH_DEFAULTS.failsafe }

describe('computeSplashPlan', () => {
  it('uses spec defaults when config is empty', () => {
    expect(computeSplashPlan(undefined)).toEqual(DEFAULTS)
    expect(computeSplashPlan({})).toEqual(DEFAULTS)
  })

  it('clamps non-positive values to defaults', () => {
    expect(computeSplashPlan({ fade: 0 })).toEqual(DEFAULTS)
    expect(computeSplashPlan({ failsafe: -5 })).toEqual(DEFAULTS)
  })

  it('passes positive values through', () => {
    expect(computeSplashPlan({ fade: 500, failsafe: 12000 }))
      .toEqual({ hideOnMounted: true, fade: 500, failsafe: 12000 })
  })
})
