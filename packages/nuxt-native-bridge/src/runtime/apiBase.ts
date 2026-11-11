/**
 * The testable core of apiBase carrying (plan T5): web keeps whatever the
 * app configured — nnb adds nothing; native targets get the configured base.
 * Nuxt-free on purpose (imported by tests without the #imports alias).
 */
export function pickApiBase(target: string, nativeBridge?: { apiBase?: string }): string | undefined {
  return target === 'web' ? undefined : nativeBridge?.apiBase
}
