export const useTheme = () => {
  // Brand teal from owner screenshot / square logo
  const BRAND_PRIMARY = '#0D8A8F'
  // Older defaults we migrate away from so returning users pick up the new brand
  const LEGACY_PRIMARIES = new Set([
    '#1F4E5F',
    '#1f4e5f',
    '#ea1c24',
    '#EA1C24',
    '#d32f2f',
    '#D32F2F',
  ])

  const primaryColor = useState('primaryColor', () => BRAND_PRIMARY)
  const isDark = useState('isDark', () => false)

  const palettes = [
    { label: 'Teal', value: BRAND_PRIMARY },
    { label: 'Deep Teal', value: '#0A5C61' },
    { label: 'Orange', value: '#E85D2A' },
    { label: 'Navy', value: '#0c1739' },
    { label: 'Indigo', value: '#4338ca' },
    { label: 'Blue', value: '#2563eb' },
    { label: 'Green', value: '#16a34a' },
    { label: 'Purple', value: '#7c3aed' },
  ]

  const hexToRgba = (hex, alpha) => {
    const r = Number.parseInt(hex.slice(1, 3), 16)
    const g = Number.parseInt(hex.slice(3, 5), 16)
    const b = Number.parseInt(hex.slice(5, 7), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  const darkenHex = (hex, amount = 0.22) => {
    const r = Math.round(Number.parseInt(hex.slice(1, 3), 16) * (1 - amount))
    const g = Math.round(Number.parseInt(hex.slice(3, 5), 16) * (1 - amount))
    const b = Math.round(Number.parseInt(hex.slice(5, 7), 16) * (1 - amount))
    const toHex = n => n.toString(16).padStart(2, '0')
    return `#${toHex(Math.max(0, r))}${toHex(Math.max(0, g))}${toHex(Math.max(0, b))}`
  }

  const applyTheme = (color, dark) => {
    if (!import.meta.client) return
    const root = document.documentElement
    const primaryDark = darkenHex(color, 0.28)

    root.style.setProperty('--primary', color)
    root.style.setProperty('--primary-soft', hexToRgba(color, dark ? 0.18 : 0.1))
    root.style.setProperty('--primary-mid', hexToRgba(color, dark ? 0.28 : 0.2))
    root.style.setProperty('--primary-dark', primaryDark)
    // Secondary follows brand (deep teal companion) instead of navy
    root.style.setProperty('--secondary', primaryDark)
    root.style.setProperty('--secondary-soft', hexToRgba(primaryDark, 0.1))
    root.style.setProperty('--secondary-mid', hexToRgba(primaryDark, 0.2))
    root.style.setProperty('--accent', '#E85D2A')
    root.style.setProperty('--accent-soft', hexToRgba('#E85D2A', dark ? 0.18 : 0.12))

    if (dark) {
      root.style.setProperty('--bg-page', '#0b1416')
      root.style.setProperty('--bg-surface', '#132022')
      root.style.setProperty('--bg-elevated', '#1a2c2f')
      root.style.setProperty('--border-color', '#243b3e')
      root.style.setProperty('--text-primary', '#e8f6f7')
      root.style.setProperty('--text-muted', '#8aadaf')
      root.style.setProperty('--text-sub', '#9bb8bb')
      root.style.setProperty('--text-secondary', '#9bb8bb')
      root.style.setProperty('--status-bar-bg', '#0b1416')
      root.classList.add('dark')
      root.style.colorScheme = 'dark'
      // Keep overscroll / safe-area under the bottom bar from flashing white
      document.documentElement.style.backgroundColor = '#0b1416'
      document.body.style.backgroundColor = '#0b1416'
    }
    else {
      // Soft mint wash — spirit of the owner screenshot
      root.style.setProperty('--bg-page', '#f3fafb')
      root.style.setProperty('--bg-surface', '#ffffff')
      root.style.setProperty('--bg-elevated', '#eef8f9')
      root.style.setProperty('--border-color', '#d7ecee')
      root.style.setProperty('--text-primary', '#0a3d40')
      root.style.setProperty('--text-muted', '#5f8285')
      root.style.setProperty('--text-sub', '#4a6f72')
      root.style.setProperty('--text-secondary', '#3d6568')
      root.style.setProperty('--status-bar-bg', '#f3fafb')
      root.classList.remove('dark')
      root.style.colorScheme = 'light'
      document.documentElement.style.backgroundColor = '#f3fafb'
      document.body.style.backgroundColor = '#f3fafb'
    }

    localStorage.setItem('theme-color', color)
    localStorage.setItem('theme-dark', String(dark))
    persistNativeTheme(dark)
  }

  // Mirror the app-level theme into native SharedPreferences so the Android
  // splash (rendered before the webview boots) matches the app's own theme
  // instead of the system dark-mode setting.
  const persistNativeTheme = async (dark) => {
    if (!import.meta.client) return
    try {
      const { Capacitor, registerPlugin } = await import('@capacitor/core')
      if (!Capacitor.isNativePlatform()) return
      const ThemePrefs = registerPlugin('ThemePrefs')
      await ThemePrefs.setDark({ dark })
    }
    catch (e) {
      console.warn('ThemePrefs persist failed', e)
    }
  }

  const setColor = (color) => {
    primaryColor.value = color
    applyTheme(color, isDark.value)
  }

  const toggleDark = () => {
    isDark.value = !isDark.value
    applyTheme(primaryColor.value, isDark.value)
  }

  const init = () => {
    if (!import.meta.client) return
    let savedColor = localStorage.getItem('theme-color') || BRAND_PRIMARY
    if (LEGACY_PRIMARIES.has(savedColor)) {
      savedColor = BRAND_PRIMARY
    }
    const savedDark = localStorage.getItem('theme-dark') === 'true'
    primaryColor.value = savedColor
    isDark.value = savedDark
    applyTheme(savedColor, savedDark)
  }

  return { primaryColor, isDark, palettes, setColor, toggleDark, init }
}
