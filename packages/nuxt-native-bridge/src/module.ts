import { defineNuxtModule, createResolver, addImportsDir, addPlugin, logger } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'

export interface ModuleOptions {
  app: { id: string, name: string }
  brand: { color: string }
  /** Native launch theme: `both` follows the system, `light`/`dark` force one. */
  theme?: 'light' | 'dark' | 'both'
  /** API origin for native builds; web keeps the app's own config (T5). */
  apiBase?: string
  baseStyles: boolean
  safeArea: { topMin: string, bottomMin: string }
  backButton: { exitRoutes: string[] }
  android?: {
    splash?: { hideOn?: string, fade?: number, failsafe?: number, light?: string, dark?: string }
    mavenMirrors?: string[]
    permissions?: string[]
  }
  electron?: {
    splash?: { hideOn?: string, fade?: number, failsafe?: number, light?: string, dark?: string }
    // electron-specific configurations
  }
}

// Build target for this generation: web default; electron/android go static+SPA.
// The value is baked into the early-boot script so the DOM carries the truth
// before any Vue code runs.
export type NnbTarget = 'web' | 'electron' | 'android'

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'nuxt-native-bridge',
    configKey: 'nativeBridge',
    compatibility: { nuxt: '^3.16.0 || >=4.0.0' },
  },
  defaults: {
    app: { id: 'com.example.app', name: 'My App' },
    brand: { color: '#0D8A8F' },
    baseStyles: true,
    safeArea: { topMin: '32px', bottomMin: '16px' },
    backButton: { exitRoutes: ['/'] },
  },
  setup(options, nuxt: Nuxt) {
    const resolver = createResolver(import.meta.url)
    const target = (process.env.NUXT_TARGET || 'web') as NnbTarget

    // 1. Target switch: native targets are static SPA; the web target keeps
    //    whatever the app configured (audit item 36). Pre-compression must be
    //    off for native: .js.gz/.css.gz siblings break Android's asset merger
    //    ("Duplicate resources") and the shells serve files directly anyway.
    if (target !== 'web') {
      nuxt.options.ssr = false
      nuxt.options.nitro.preset = 'static'
      nuxt.options.nitro.compressPublicAssets = false
      // Nuxt Image's ipx provider emits /_ipx/... URLs that only a running
      // server can answer; native shells serve static files, so every image
      // (local and API-served) would silently break. Render plain <img> URLs.
      const opts = nuxt.options as Nuxt['options'] & {
        image?: { provider?: string }
        _installedModules?: Array<{ meta?: { name?: string } }>
      }
      ;(opts.image ||= {}).provider = 'none'
      if (opts._installedModules?.some(m => m.meta?.name === '@nuxt/image')) {
        logger.warn('nuxt-native-bridge must be listed before @nuxt/image in `modules`, otherwise the image provider cannot be disabled and images will be broken in native builds.')
      }
    }

    // 2. Runtime access to module config + target for the composables/plugin.
    nuxt.options.runtimeConfig.public.nativeBridge = { ...options, target }

    // 3. Early-boot script — the single owner of target/os attributes,
    //    native safe-area minimums and the pre-paint status-bar color.
    //    Replaces the app's duplicated inline script (audit items 26, 34, 40).
    nuxt.options.app.head.script ||= []
    nuxt.options.app.head.script.push({
      tagPosition: 'head',
      innerHTML: bootScript(target, options.safeArea),
    })

    // 4. Base CSS layer (opt-in): safe-area tokens + native resets +
    //    Android-scoped selection lock (audit item 33).
    if (options.baseStyles) {
      nuxt.options.css.push(resolver.resolve('./runtime/base.css'))
    }

    addImportsDir(resolver.resolve('./runtime/composables'))
    addPlugin({ src: resolver.resolve('./runtime/plugin.client'), mode: 'client' })
  },
})

// Writes the boot script as one literal so it runs before paint with zero deps.
// It must not read runtimeConfig: inline scripts execute before Nuxt hydrates.
function bootScript(target: NnbTarget, safeArea: ModuleOptions['safeArea']) {
  return `(function(){
  var d=document.documentElement;
  d.dataset.nnbTarget=${JSON.stringify(target)};
  var native=false;
  try{
    var C=window.Capacitor;
    if(C&&typeof C.isNativePlatform==="function"&&C.isNativePlatform()){native=true;}
  }catch(e){}
  if(!native&&navigator.userAgent.indexOf("Electron")!==-1){native=true;}
  d.dataset.nnbNative=native?"1":"0";
  var os="web";
  if(d.dataset.nnbTarget==="android"){os="android";}
  else if(d.dataset.nnbTarget==="electron"){
    var p=navigator.platform||"";
    os=p.indexOf("Win")!==-1?"windows":p.indexOf("Mac")!==-1?"macos":p.indexOf("Linux")!==-1?"linux":"desktop";
  }
  else if(native){os="android";}
  d.dataset.nnbOs=os;
  try{
    var s=localStorage.getItem("theme-dark");
    d.style.setProperty("--status-bar-bg",s==="true"?"#0b1416":"#f3fafb");
  }catch(e){}
  if(native){
    if(!d.style.getPropertyValue("--safe-area-top-min")){d.style.setProperty("--safe-area-top-min",${JSON.stringify(safeArea.topMin)});}
    if(!d.style.getPropertyValue("--safe-area-bottom-min")){d.style.setProperty("--safe-area-bottom-min",${JSON.stringify(safeArea.bottomMin)});}
  }
})()`
}
