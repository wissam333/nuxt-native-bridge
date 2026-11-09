export function useStatusBar() {
  let initialized = false

  function applyNativeSafeAreaFallback() {
    if (!import.meta.client) return
    const root = document.documentElement
    root.classList.add('capacitor-native')
    // Android WebView frequently reports env(safe-area-inset-*) as 0 with
    // edge-to-edge / overlaysWebView. CSS prefers real env() when present.
    if (!root.style.getPropertyValue('--safe-area-top-min')) {
      root.style.setProperty('--safe-area-top-min', '32px')
    }
    if (!root.style.getPropertyValue('--safe-area-bottom-min')) {
      root.style.setProperty('--safe-area-bottom-min', '16px')
    }
  }

  async function applyStatusBarTheme(isDark: boolean) {
    try {
      const { Capacitor } = await import('@capacitor/core')
      if (!Capacitor.isNativePlatform()) return

      applyNativeSafeAreaFallback()

      const { StatusBar, Style } = await import('@capacitor/status-bar')

      if (!initialized) {
        await StatusBar.setOverlaysWebView({ overlay: true })
        initialized = true
      }

      await StatusBar.setStyle({ style: isDark ? Style.Light : Style.Dark })
    }
    catch {
      // Plugins throw on web/desktop — silently ignore
    }
  }

  return { applyStatusBarTheme }
}
