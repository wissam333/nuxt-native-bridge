<template>
  <div class="demo-shell">
    <header class="demo-header">
      <h1>NNB Playground</h1>
      <button
        class="demo-icon-btn"
        aria-label="Toggle dark mode"
        @click="toggleDark"
      >
        {{ isDark ? "🌙" : "☀️" }}
      </button>
    </header>
    <main class="demo-main">
      <slot />
    </main>
  </div>
</template>

<script setup>
const { isDark, toggleDark, init } = useTheme()
onMounted(() => init())
</script>
