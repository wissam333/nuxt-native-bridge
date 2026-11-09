// @ts-check
import { createConfigForNuxt } from '@nuxt/eslint-config/flat'

// Run `npx @eslint/config-inspector` to inspect the resolved config interactively
export default createConfigForNuxt({
  features: {
    // Rules for module authors
    tooling: true,
    // Rules for formatting
    stylistic: true,
  },
  dirs: {
    src: [
      './playground',
    ],
  },
})
  .append(
    // The playground carries real native project trees (android, Electron's
    // node_modules, build output) that must never be linted.
    {
      ignores: [
        '**/node_modules/**',
        '**/.output/**',
        '**/.nuxt/**',
        '**/dist/**',
        'playground/android/**',
        'playground/my-app/**',
        '**/public/**',
      ],
    },
    // Demo-tree relaxations: single-word demo page names are fine, and
    // starter code keeps relying on Nuxt auto-imports for useState.
    {
      files: ['playground/app/**'],
      rules: {
        'vue/multi-word-component-names': 'off',
        'no-undef': 'off',
      },
    },
  )
