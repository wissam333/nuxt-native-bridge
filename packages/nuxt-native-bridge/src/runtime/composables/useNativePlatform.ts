import { useRuntimeConfig } from '#imports'
import type { NnbPublicRuntimeConfig } from '../types'

export interface NativePlatform {
  /** Build target of this bundle: web | electron | android. */
  target: string
  /** Concrete OS under the target, from the early-boot script. */
  os: string
  isElectron: boolean
  isAndroid: boolean
  isNative: boolean
}

/**
 * Single source of truth for "where am I running" (audit item 26).
 * Replaces every `globalThis.Capacitor?.isNativePlatform?.()` check.
 */
export function useNativePlatform(): NativePlatform {
  const config = useRuntimeConfig()
  // runtimeConfig.public.nativeBridge is written by the module at build time.
  const cfg = (config.public as NnbPublicRuntimeConfig).nativeBridge ?? { target: 'web' }
  const target: string = cfg.target || 'web'
  let os = 'unknown'
  if (import.meta.client) {
    os = document.documentElement?.dataset.nnbOs || 'unknown'
  }
  return {
    target,
    os,
    isElectron: target === 'electron',
    isAndroid: target === 'android' || os === 'android',
    isNative: target !== 'web',
  }
}
