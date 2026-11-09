import type { ModuleOptions } from '../module'

/** Shape of runtimeConfig.public.nativeBridge as written by the module. */
export interface NnbPublicRuntimeConfig {
  nativeBridge?: ModuleOptions & { target: string }
}

/** window.nnb — set by adapter-electron's sandboxed preload (shell seam). */
export interface NnbElectronApi {
  target: 'electron'
  platform: string
  exit(): void
  window: {
    close(): void
    minimize(): void
    maximizeOrRestore(): void
  }
}

declare global {
  interface Window {
    nnb?: NnbElectronApi
  }
}
