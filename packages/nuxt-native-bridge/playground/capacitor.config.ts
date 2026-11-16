import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  // Playground identity — its OWN id, never a product's (T9: installing a
  // demo under a product's id can overwrite/wipe that product on the device).
  appId: 'com.nnb.playground',
  appName: 'NNB Playground',
  webDir: '.output/public',
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    SplashScreen: {
      // The nnb module owns the splash hide (fade + failsafe, audit 19);
      // native auto-hide is off so the splash drops when the app is ready.
      // hide()'s fadeOutDuration is IGNORED for the initial splash on
      // Android (T9 device finding) — the fade lives here instead.
      launchAutoHide: false,
      launchFadeOutDuration: 300,
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    Keyboard: {
      // iOS-only: "body" resize is the smooth mode (no viewport jump).
      // Android relies on Chromium's IME-insets handling (edge-to-edge,
      // targetSdk 36) — no manual resize needed. Re-enable
      // resizeOnFullScreen only if inputs get covered on older Android
      // device models.
      resize: 'body',
    },
  },

  android: {
    backgroundColor: '#0D8A8F',
  },
}

export default config
