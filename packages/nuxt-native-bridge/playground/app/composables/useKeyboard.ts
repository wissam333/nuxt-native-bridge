export function useKeyboard() {
  let isVisible = false
  let armed = false

  function hide() {
    if (!isVisible || !armed) return
    import('@capacitor/keyboard')
      .then(({ Keyboard }) => Keyboard.hide())
      .catch(() => {})
  }

  async function setup() {
    if (!import.meta.client) return
    try {
      const { Capacitor } = await import('@capacitor/core')
      if (!Capacitor.isNativePlatform()) return

      const { Keyboard } = await import('@capacitor/keyboard')
      await Keyboard.addListener('keyboardWillShow', () => {
        isVisible = true
        armed = false
      })
      // Only arm the scroll-to-hide once the keyboard is fully on screen:
      // with resize: "body" the webview resizes and scrolls the focused
      // input into view while the keyboard is animating in, and that
      // programmatic scroll must never trigger an instant hide.
      await Keyboard.addListener('keyboardDidShow', () => {
        setTimeout(() => {
          armed = true
        }, 250)
      })
      await Keyboard.addListener('keyboardDidHide', () => {
        isVisible = false
        armed = false
      })

      window.addEventListener(
        'scroll',
        () => {
          if (isVisible && armed) hide()
        },
        { passive: true, capture: true },
      )

      document.addEventListener(
        'focusout',
        (e) => {
          const target = e.target
          const isInput
            = target instanceof HTMLInputElement
              || target instanceof HTMLTextAreaElement
              || (target instanceof HTMLElement && target.isContentEditable)
          if (!isInput) return
          // blur fires before the next field's focusin, so re-check the
          // active element after a tick instead of trusting it right away.
          setTimeout(() => {
            const active = document.activeElement
            const stillEditing
              = active instanceof HTMLInputElement
                || active instanceof HTMLTextAreaElement
                || (active instanceof HTMLElement && active.isContentEditable)
            if (!stillEditing) hide()
          }, 120)
        },
        true,
      )
    }
    catch {
      // Not on native platform — no-op
    }
  }

  return { setup, hide }
}
