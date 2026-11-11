import { ref } from 'vue'
import { useNativePlatform } from './useNativePlatform'

export interface SafeAreaInsets {
  top: number
  bottom: number
}

/**
 * audit 20: THE one writer for the safe-area CSS tokens. Everything else
 * reads `var(--nnb-inset-top/bottom)`; web/electron keep the base.css
 * `env()` max() fallback because this is never called there.
 */
export function applySafeAreaVars(insets: SafeAreaInsets, doc: Document = document) {
  doc.documentElement.style.setProperty('--nnb-inset-top', `${insets.top}px`)
  doc.documentElement.style.setProperty('--nnb-inset-bottom', `${insets.bottom}px`)
}

/**
 * Real native insets via the NnbInsets bridge plugin (android only).
 * web/electron: isSupported false, zeroed insets — CSS fallback stands.
 */
export function useNativeSafeArea() {
  const { isAndroid } = useNativePlatform()
  const insets = ref<SafeAreaInsets>({ top: 0, bottom: 0 })
  const isSupported = isAndroid

  if (isAndroid && import.meta.client) {
    void (async () => {
      const { registerPlugin } = await import('@capacitor/core')
      const NnbInsets = registerPlugin<{ getInsets(): Promise<SafeAreaInsets> }>('NnbInsets')
      const res = await NnbInsets.getInsets()
      insets.value = { top: res.top ?? 0, bottom: res.bottom ?? 0 }
      applySafeAreaVars(insets.value)
    })().catch(err => console.warn('[nnb] insets unavailable, CSS fallback stands:', err))
  }

  return { insets, isSupported }
}
