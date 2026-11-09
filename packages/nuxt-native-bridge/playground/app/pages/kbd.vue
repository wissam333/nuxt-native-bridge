<template>
  <div>
    <section class="demo-card">
      <h2>Keyboard demo</h2>
      <p>
        Focus an input and scroll: on Android the keyboard must hide on scroll
        (useKeyboard, spec §9.3 / 25).
      </p>
      <input
        class="demo-input"
        type="text"
        placeholder="Type here…"
      >
      <input
        class="demo-input"
        type="number"
        placeholder="A number field"
      >
    </section>

    <section class="demo-card">
      <h2>Handler stack demo</h2>
      <p>
        This page pushes a back-button handler that shows a message instead of leaving
        — pop it with the button below.
      </p>
      <button
        class="demo-btn"
        @click="closeHandler"
      >
        Pop back handler
      </button>
      <p
        v-if="closed"
        class="demo-hint"
      >
        Handler popped — Android back now leaves the page.
      </p>
    </section>
  </div>
</template>

<script setup>
const { pushHandler, popHandler } = useBackButton()
const closed = ref(false)

// Register a handler while the page exists; the module later formalizes this
// page-scoped pattern (spec §7 useBackButton handler stack).
const pageHandler = () => alert('Page says: back handled by page, not router.')
onMounted(() => pushHandler(pageHandler))
onBeforeUnmount(() => popHandler(pageHandler))

const closeHandler = () => {
  popHandler(pageHandler)
  closed.value = true
}
</script>
