import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderGrammarDocument, renderGrammarHtml } from './grammar-document.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
writeFileSync(resolve(ROOT, 'docs/grammar-da.md'), renderGrammarDocument())
writeFileSync(resolve(ROOT, 'docs/grammar-da.html'), renderGrammarHtml())
