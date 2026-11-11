/**
 * Splash ownership (plan T3, audit 19): the module decides when and how the
 * splash hides — config-driven, with clamping so broken config cannot freeze
 * the splash or drop the failsafe.
 */
export interface SplashOptions {
  hideOn?: string
  fade?: number
  failsafe?: number
}

export interface SplashPlan {
  /** false = hide immediately at plugin setup instead of after app mount. */
  hideOnMounted: boolean
  fade: number
  failsafe: number
}

export const SPLASH_DEFAULTS = { hideOn: 'mounted', fade: 300, failsafe: 8000 } as const

export function computeSplashPlan(cfg?: SplashOptions): SplashPlan {
  const fade = cfg?.fade && cfg.fade > 0 ? cfg.fade : SPLASH_DEFAULTS.fade
  const failsafe = cfg?.failsafe && cfg.failsafe > 0 ? cfg.failsafe : SPLASH_DEFAULTS.failsafe
  return { hideOnMounted: (cfg?.hideOn ?? SPLASH_DEFAULTS.hideOn) === 'mounted', fade, failsafe }
}
