// Native targets are client-routed static shells: only the entry HTML is
// prerendered. Crawling app routes prerenders client-only pages (localStorage,
// window, auth state) on the server and fails the whole build.
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import { loadNuxt } from '@nuxt/kit'

process.env.NUXT_TARGET = 'android'
const nuxt = await loadNuxt({
  cwd: fileURLToPath(new URL('./fixtures/basic', import.meta.url)),
  ready: false,
})
await nuxt.ready()

afterAll(async () => {
  await nuxt.close()
  delete process.env.NUXT_TARGET
})

describe('android target', () => {
  it('prerenders only the shell and never crawls app routes', () => {
    expect(nuxt.options.ssr).toBe(false)
    expect(nuxt.options.nitro.preset).toBe('static')
    expect(nuxt.options.nitro.prerender?.crawlLinks).toBe(false)
    expect(nuxt.options.nitro.prerender?.routes).toEqual(['/'])
  })
})
