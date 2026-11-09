// @ts-check
import { createConfigForNuxt } from '@nuxt/eslint-config/flat'

// Same style family as the other packages; this package is plain Node ESM.
export default createConfigForNuxt({
  features: {
    tooling: true,
    stylistic: true,
  },
})
