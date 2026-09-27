// LiteRT-LM's WebAssembly engine, served by the app itself at
// <base>litert-lm/wasm/ for desktop Gemma (src/ai/gemma/web.ts).
//
// The package would otherwise fetch it from a CDN on first use, and a
// self-build that plays offline must not depend on one. The dev server
// streams the files from node_modules; a build copies them next to the app.
// They are 21-34 MB each, so the service worker's precache (vite.config.ts,
// 3 MB per file and no .wasm) never takes them.
import { copyFileSync, createReadStream, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const SOURCE = resolve('node_modules/@litert-lm/core/wasm')
const TYPES = { '.wasm': 'application/wasm', '.js': 'text/javascript' }

export function litertLmWasm() {
  let base = '/'
  let outDir = 'dist'
  return {
    name: 'litert-lm-wasm',
    configResolved(config) {
      base = config.base
      outDir = resolve(config.root, config.build.outDir)
    },
    configureServer(server) {
      server.middlewares.use(`${base}litert-lm/wasm/`, (req, res, next) => {
        const name = decodeURIComponent((req.url ?? '').split('?')[0].replace(/^\//, ''))
        const file = join(SOURCE, name)
        if (!/^[\w.-]+$/.test(name) || !existsSync(file)) return next()
        res.setHeader('Content-Type', TYPES[name.slice(name.lastIndexOf('.'))] ?? 'application/octet-stream')
        createReadStream(file).pipe(res)
      })
    },
    writeBundle() {
      const target = join(outDir, 'litert-lm', 'wasm')
      mkdirSync(target, { recursive: true })
      for (const name of readdirSync(SOURCE)) copyFileSync(join(SOURCE, name), join(target, name))
    },
  }
}
