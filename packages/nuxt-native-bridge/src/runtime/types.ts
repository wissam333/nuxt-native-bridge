import type { ModuleOptions } from '../module'

/** Shape of runtimeConfig.public.nativeBridge as written by the module. */
export interface NnbPublicRuntimeConfig {
  nativeBridge?: ModuleOptions & { target: string }
}
