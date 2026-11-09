export interface NativeApp {
  /**
   * Called when the platform asks to exit (Android back on an exitRoute, or
   *  a direct exit intent). Registering a handler means "ask me first" — the
   *  app decides (exit-confirm dialog, app-lock, …).
   */
  onExitRequested(cb: () => void): () => void
  /** Fired when the app comes to the foreground. */
  onResume(cb: () => void): () => void
  /** Fired when the app goes to the background. */
  onPause(cb: () => void): () => void
  /**
   * Leave the app. If no exit handlers are registered the plugin exits
   *  straight away; with handlers, the plugin only fires them.
   */
  exit(): Promise<void>
}

// Module-scope registries: client plugin and composables share one process.
// Re-runs under HMR don't stack: the plugin de-dupes itself (audit item 24).
const exitHandlers: Array<() => void> = []
const resumeHandlers: Array<() => void> = []
const pauseHandlers: Array<() => void> = []

function listen(list: Array<() => void>, cb: () => void) {
  list.push(cb)
  return () => {
    const i = list.indexOf(cb)
    if (i !== -1) list.splice(i, 1)
  }
}

export function useNativeApp(): NativeApp {
  const onExitRequested = (cb: () => void) => listen(exitHandlers, cb)
  const onResume = (cb: () => void) => listen(resumeHandlers, cb)
  const onPause = (cb: () => void) => listen(pauseHandlers, cb)

  const exit = async () => {
    // Handlers registered: the app owns the exit UX (confirm, app-lock, …).
    if (exitHandlers.length > 0) {
      for (const cb of [...exitHandlers]) cb()
      return
    }
    // Electron shell: the preload API (window.nnb) is the exit seam.
    if (import.meta.client && window.nnb) {
      window.nnb.exit()
      return
    }
    const { App } = await import('@capacitor/app')
    await App.exitApp()
  }

  return { onExitRequested, onResume, onPause, exit }
}

export function useNativeAppRegistry() {
  return { exitHandlers, resumeHandlers, pauseHandlers }
}
