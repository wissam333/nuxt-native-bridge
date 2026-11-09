// @ts-check
import { createConfigForNuxt } from '@nuxt/eslint-config/flat'

// Same style family as the module package (st-required single quotes etc.).
// The shell is plain CJS; no Vue playground content here.
export default createConfigForNuxt({
  features: {
    tooling: true,
    stylistic: true,
  },
  dirs: {
    src: ['./test'],
  },
})
