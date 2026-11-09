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

applyStatusBarTheme(isDark.value)
watch(isDark, (dark) => {
  applyStatusBarTheme(dark)
})
</script>
