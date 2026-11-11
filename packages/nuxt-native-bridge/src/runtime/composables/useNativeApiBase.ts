import { useRuntimeConfig } from '#imports'
import { useNativePlatform } from './useNativePlatform'
import { pickApiBase } from '../apiBase'

/**
 * Apps do `$fetch(apiBase + path)` or set their own baseURL — the module
 * only carries the value. No fetch interception (deliberately lazy).
 */
export function useNativeApiBase(): string | undefined {
  const { target } = useNativePlatform()
  const nativeBridge = (useRuntimeConfig().public as { nativeBridge?: { apiBase?: string } }).nativeBridge
  return pickApiBase(target, nativeBridge)
}
