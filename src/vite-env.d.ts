/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

/** Build identity, injected by vite.config.ts. */
declare const __BUILD_STAMP__: string
/** The TestFlight build number, or '' on the web. See vite.config.ts. */
declare const __TF_BUILD__: string
/** The immutable normal / feedback / developer bundle policy. */
declare const __BUILD_AUDIENCE__: 'normal' | 'feedback' | 'developer' | 'open-source' | 'web-demo'
declare const __SELF_HOSTED_CASEY_URL__: string
/** The website Casey (web-demo builds only), e.g. https://casey.900words.app/v1. */
declare const __WEB_CASEY_URL__: string
/** The public Cloudflare Turnstile site key (web-demo builds only). */
declare const __TURNSTILE_SITE_KEY__: string
/** The App Store listing the demo's end card links to; '' until it exists. */
declare const __APP_STORE_URL__: string
/** True only for the bundled native shell; false and tree-shaken on web. */
declare const __CAP_BUILD__: boolean
/** On-device Casey (Gemma): the developer, normal and open-source native builds only. */
declare const __ON_DEVICE_CASEY__: boolean
/** Casey's own logic runs in the app: on-device Casey's builds, and every open-source build (own AI key). */
declare const __IN_APP_CASEY__: boolean
