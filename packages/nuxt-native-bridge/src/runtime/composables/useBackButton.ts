import { ref } from '#imports'

type BackHandler = () => void

const handlerStack = ref<BackHandler[]>([])

/**
 * Handler stack for the Android back button (ported from the starter's
 * useBackButton). Order of use, from the plugin: top handler → router back →
 * exit request on exitRoutes.
 */
export function useBackButton() {
  const pushHandler = (fn: BackHandler) => {
    if (!handlerStack.value.includes(fn)) handlerStack.value.push(fn)
  }
  const popHandler = (fn: BackHandler) => {
    const i = handlerStack.value.lastIndexOf(fn)
    if (i !== -1) handlerStack.value.splice(i, 1)
  }
  return { pushHandler, popHandler, handlerStack }
}
