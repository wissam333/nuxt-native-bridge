import { defineNuxtPlugin, useRouter, useRuntimeConfig, useNuxtApp } from '#imports'
import { useNativePlatform } from './composables/useNativePlatform'
import { useBackButton } from './composables/useBackButton'
import { useNativeAppRegistry, useNativeApp } from './composables/useNativeApp'
import type { NnbPublicRuntimeConfig } from './types'

/**
 * Lifecycle owner (client only). Web target: this plugin is a no-op, the app
 * behaves exactly as without nnb.
 *
 * Takes over the starter's app.vue native blocks:
 * - splash hide with fade + failsafe (audit item 19)
 * - Android back button: handler stack → exitRoutes → router back (items 21, 23)
 * - app state resume/pause fan-out via useNativeApp registries (item 24)
 */
export default defineNuxtPlugin(() => {
  const { target } = useNativePlatform()

  // Web keeps its normal Nuxt behavior untouched.
  if (target === 'web') return

  const win = window as typeof window & { __nnb_plugin_installed?: boolean }
  if (win.__nnb_plugin_installed) return
  win.__nnb_plugin_installed = true

  const reg = useNativeAppRegistry()
  const { handlerStack } = useBackButton()
  const nativeApp = useNativeApp()

  // Splash: hide with a clean fade as soon as we can, with a failsafe so a
  // stalled boot never leaves the splash stuck (audit item 19).
  const failsafe = setTimeout(hideSplash, 8000)
  async function hideSplash() {
    clearTimeout(failsafe)
    try {
      const { SplashScreen } = await import('@capacitor/splash-screen')
      await SplashScreen.hide({ fadeOutDuration: 300 })
    }
    catch (err) {
      console.warn('[nnb] splash hide failed:', err)
    }
  }
  hideSplash()

  // Runtime config gets its values baked by the module at build time.
  const nativeBridge = (useRuntimeConfig().public as NnbPublicRuntimeConfig).nativeBridge
  const exitRoutes: string[] = nativeBridge?.backButton?.exitRoutes ?? ['/']

  async function wireNative() {
    if (target !== 'android') return
    const router = useRouter()
    const { App } = await import('@capacitor/app')

    await App.addListener('backButton', () => {
      if (handlerStack.value.length > 0) {
        handlerStack.value[handlerStack.value.length - 1]!()
        return
      }
      // exitRoutes instead of Capacitor's canGoBack: back must not walk the
      // history into auth screens (audit item 23).
      if (exitRoutes.includes(router.currentRoute.value.path)) {
        nativeApp.exit()
        return
      }
      router.back()
    })

    await App.addListener('appStateChange', (state) => {
      const list = state.isActive ? reg.resumeHandlers : reg.pauseHandlers
      for (const cb of [...list]) cb()
    })
  }
  wireNative().catch(err => console.warn('[nnb] native wiring failed:', err))

  // Remove every listener when the app unmounts so re-runs (HMR or teardown)
  // cannot stack handlers (audit item 24).
  const nuxtApp = useNuxtApp()
  nuxtApp.hook('app:unmount', () => {
    import('@capacitor/app')
      .then(({ App }) => App.removeAllListeners())
      .catch(() => {})
    win.__nnb_plugin_installed = false
  })
})
