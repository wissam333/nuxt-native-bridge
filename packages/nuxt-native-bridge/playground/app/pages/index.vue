<template>
  <div>
    <section class="demo-card">
      <h2>Platform</h2>
      <ul class="demo-list">
        <li>Capacitor platform: <code>{{ capPlatform }}</code></li>
        <li>User agent: <code class="demo-clamp">{{ ua }}</code></li>
      </ul>
    </section>

    <section class="demo-card">
      <h2>Theme</h2>
      <p>
        Toggle in the header. On Android this syncs the status bar style and the native
        <code>theme_dark</code> pref, so the next cold-start splash matches.
      </p>
      <div class="demo-swatches">
        <button
          v-for="p in palettes"
          :key="p.value"
          class="demo-swatch"
          :style="{ background: p.value }"
          :aria-label="`Set theme color ${p.label}`"
          @click="setColor(p.value)"
        />
      </div>
    </section>

    <section class="demo-card">
      <h2>Routing &amp; back button</h2>
      <NuxtLink
        class="demo-btn"
        to="/kbd"
      >Open keyboard demo page</NuxtLink>
      <p class="demo-hint">
        Android back now: router back → exit confirm at root
        (exitRoutes come with the module, spec §7 useBackButton).
      </p>
    </section>
  </div>
</template>

<script setup>
const palettes = [
  { label: 'Teal', value: '#0D8A8F' },
  { label: 'Deep Teal', value: '#0A5C61' },
  { label: 'Orange', value: '#E85D2A' },
  { label: 'Navy', value: '#0c1739' },
  { label: 'Blue', value: '#2563eb' },
]
const { setColor } = useTheme()
const capPlatform = ref('web')
const ua = ref('')
onMounted(async () => {
  ua.value = navigator.userAgent
  try {
    const { Capacitor } = await import('@capacitor/core')
    capPlatform.value = Capacitor.isNativePlatform() ? Capacitor.getPlatform() : 'web'
  }
  catch { /* web */ }
})
</script>
