<template>
  <div>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>

    <!-- Exit confirm: the module asks for permission to exit (back on an
         exitRoute); the app decides what "asking" looks like. -->
    <div
      v-if="showExitModal"
      class="demo-modal-backdrop"
    >
      <div class="demo-modal">
        <p>Exit the app?</p>
        <div class="demo-modal-actions">
          <button @click="showExitModal = false">
            Cancel
          </button>
          <button
            class="demo-danger"
            @click="exitApp"
          >
            Exit
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
// The app shell is thin now — the module owns splash hide, the Android back
// button and app-state events. App-level polish that stays here until its
// module phase: keyboard (Phase 2) and theme (Phase 2, becomes useNativeTheme).
const showExitModal = ref(false)
const { isDark } = useTheme()
const { applyStatusBarTheme } = useStatusBar()
const { setup: setupKeyboard } = useKeyboard()

const { onExitRequested } = useNativeApp()
onExitRequested(() => {
  showExitModal.value = true
})

const exitApp = async () => {
  showExitModal.value = false
  const { App } = await import('@capacitor/app')
  await App.exitApp()
}

onMounted(() => {
  setupKeyboard()
})

// T9 instrument: the real native insets, once, logcat-capturable (audit 17/20).
// The layout still styles with the legacy --safe-area-*-min tokens — feed them
// the REAL density-corrected values (guessed 32px put the title under the
// camera on a 110px cutout; Phase 2 moves the layout onto the module tokens).
const { insets } = useNativeSafeArea()
watch(insets, (v) => {
  console.log('[nnb-insets]', JSON.stringify(v))
  const root = document.documentElement.style
  root.setProperty('--safe-area-top-min', `${v.top}px`)
  root.setProperty('--safe-area-bottom-min', `${v.bottom}px`)
}, { once: true })

applyStatusBarTheme(isDark.value)
watch(isDark, (dark) => {
  applyStatusBarTheme(dark)
})
</script>
