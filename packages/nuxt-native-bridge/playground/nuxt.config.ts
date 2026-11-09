// https://nuxt.com/docs/api/configuration/nuxt-config
// NNB playground config.
// - The local module owns the build target switch, early-boot attributes and
//   base CSS; app code keeps nothing native inside it anymore.
// - icon/image settings stay: they are what the module must guard on native
//   targets (§9.5 / 31-32).
export default defineNuxtConfig({
  modules: ['../src/module', '@nuxt/icon', '@nuxt/image'],

  ssr: false,
  devtools: { enabled: false },

  app: {
    head: {
      title: 'NNB Playground',
      meta: [
        {
          name: 'viewport',
          // user-scalable=no is an accessibility problem (§9.5 / 35) — keep zoom
          // until the module owns the viewport meta injection.
          content: 'width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no',
        },
        { name: 'description', content: 'Playground for nuxt-native-bridge' },
      ],
      link: [
        { rel: 'stylesheet', href: '/bootstrap.min.css' },
        { rel: 'icon', type: 'image/png', href: '/favicon.png' },
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'apple-touch-icon', href: '/icon-192x192.png' },
      ],
      script: [],
    },
  },

  css: ['@/assets/scss/main.scss'],
  compatibilityDate: '2025-07-15',
  nitro: {
    preset: 'static', // one static generate feeds Electron (.output/public) and Android webDir
  },

  icon: {
    fallbackToApi: false,
    provider: 'client',
    clientBundle: {
      scan: true,
      includeCustomCollections: false,
    },
    serverBundle: {
      collections: ['ph', 'bi', 'mdi'],
    },
  },
  image: {
    provider: 'ipx',
    format: ['webp'],
    quality: 80,
  },

  nativeBridge: {
    app: { id: 'com.arselha.demo', name: 'NNB Playground' },
    brand: { color: '#0D8A8F' },
    baseStyles: true,
    backButton: { exitRoutes: ['/'] },
  },
})
