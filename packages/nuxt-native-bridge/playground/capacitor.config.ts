import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  // appId is permanent (store / installs) — do not change
  appId: 'arselhawallet.com',
  appName: 'أرسلها',
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
      launchAutoHide: false,
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
