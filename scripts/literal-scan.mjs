import { parse } from '@babel/parser'

/**
 * Gate 2's eyes: find the English still written into a component.
 *
 * ── WHY A PARSER AND NOT A REGEX ───────────────────────────────────────────
 *
 * The thing being counted is "text a player reads", and in a `.tsx` file that
 * is a position in the syntax, not a shape in the characters. `"sheet-glosses
 * card-word"` and `"Tap a card to hear it"` are both quoted strings of three
 * words; one is a class list and one is copy, and only the parse tells them
 * apart. A regex counting quoted strings would have to be taught every
 * exception by hand and would still miscount on the first `className` that
 * reads like a sentence.
 *
 * ── WHY @babel/parser, AND WHY THIS FILE IS .mjs ───────────────────────────
 *
 * Two SPEC CORRECTIONS, recorded here because the next reader will wonder.
 *
 * 1. `docs/ui-language-plan.md` §5.6 specified `ts.createSourceFile`. This
 *    repo is on `typescript@7`, the Go port, whose npm package exports
 *    `version` and `versionMajorMinor` and nothing else — there is no JS
 *    compiler API to call. `@babel/parser` was already in the tree under
 *    `@vitejs/plugin-react`, parses every file shape this repo has, and is now
 *    declared in `devDependencies` so this does not rest on a hoist.
 * 2. §5.6 put the scanner and its gate under `src/i18n/`. They read the
 *    filesystem, and a test under `src/` cannot: this project compiles `src`
 *    with DOM libs and no node types, so `import from 'node:fs'` there passes
 *    vitest and fails `tsc -b`. `src/journey/travelStory.test.ts` records
 *    walking into exactly that. So the scanner lives here with the other
 *    validators, and the gate is `npm run validate:literals` — which also puts
 *    it in `deploy.yml`, where a vitest-only gate would not have been.
 *
 * ── THE BIAS ───────────────────────────────────────────────────────────────
 *
 * Over-counting is cheap and under-counting is silent. A false positive shows
 * up in the inventory, gets read by a human, and goes in the allowlist with a
 * reason. A false negative is a string that ships in English forever. So the
 * rules below err wide, and ALLOWLIST is the escape hatch.
 */

/**
 * @typedef {'jsx-text' | 'jsx-attr' | 'jsx-child' | 'sentence'} RawLiteralKind
 * @typedef {{ line: number, text: string, kind: RawLiteralKind }} RawLiteral
 */

/** Any letter in any script: Latin for the source, but Han once zh is in play. */
const HAS_LETTER = /\p{L}/u

/**
 * Three or more words separated by whitespace. The whitespace is what makes
 * this safe on the things that are not prose: import paths, class names in
 * non-copy attributes, ids and slugs have separators that are not spaces.
 */
const THREE_WORDS = /\p{L}+(?:\s+\p{L}+){2,}/u

/**
 * Attributes whose value a player reads or hears. `className`, `data-*`, `id`
 * and the rest are deliberately absent: their values are identifiers (project
 * guide, trap 5) and must never move into a catalogue.
 */
const COPY_ATTRIBUTES = new Set([
  'title',
  'aria-label',
  'aria-description',
  'aria-roledescription',
  'aria-valuetext',
  'aria-placeholder',
  'placeholder',
  'alt',
  'label',
])

/**
 * Text that is not copy in any language, so the scanner does not count it and
 * no phase has to move it into the catalogue.
 *
 * A name is here because translating it would be WRONG, not because moving it
 * is inconvenient. Every entry carries its reason. Matched against the TRIMMED
 * text, exactly — never as a substring, so "OK" is allowed while "OK, let's
 * go" is still copy.
 */
export const ALLOWLIST = new Set([
  // Names. The rebrand is user-facing copy, but the NAMES are the same in
  // every language (ui-language-plan UL12).
  '900words',
  'Casey',
  'TestFlight',
  'iOS',

  // Punctuation and glyphs rendered as text. «» marks a word in the language
  // being learned and stays whatever that language uses.
  '«',
  '»',
  '„',
  '“',
  'ⓘ',
  '?',
  '…',
  '·',
  '—',
  '–',
  // The dictionary line's separator since the em dashes went (owner,
  // 2026-09-26): «et hus: house».
  ':',
  '→',
  '←',
  '×',
  '✓',
  '◎',

  // Two-letter codes used as values and as `lang` attributes, not as prose.
  'da',
  'en',
  'de',
  'es',
  'zh',

  // A URL path suffix a developer types into the Base URL field. The sentence
  // around it DID move; this is the part of it that is an address.
  '/v1',

  // The country code drawn as a passport stamp on the guide's cover,
  // aria-hidden and decorative. It is the country, not a word.
  'DK',

  // A sample of the backup file's own JSON, shown as a textarea placeholder so
  // a player can see what a valid paste looks like. Translating it would make
  // it a sample of something that does not parse.
  '{"app":"cluecabulary",…}',

  // The prefix of the native build tag, as in "· b1234". An identifier with a
  // separator in front of it, not a word.
  '\u00b7 b',

  // The glyph on the board's translations toggle, in the same header row as
  // ?, \u2190 and \u21bb. Its meaning is carried by the aria-label, which IS translated.
  'Aa',
])

const isNode = (v) => typeof v === 'object' && v !== null && typeof v.type === 'string'

/**
 * The text a literal contributes, with its holes closed up. A template's
 * expressions are dropped and its literal spans joined with a space, so
 * `` `Pack «${word}»` `` reads as `Pack « »` — enough to decide "is this
 * copy?", which is all this has to do.
 *
 * @param {any} node
 * @returns {string | null}
 */
export function staticText(node) {
  if (node.type === 'StringLiteral') return String(node.value ?? '')
  if (node.type === 'TemplateLiteral') {
    return node.quasis.map((q) => q.value.cooked ?? q.value.raw).join(' ')
  }
  return null
}

const isLiteral = (node) => node.type === 'StringLiteral' || node.type === 'TemplateLiteral'

function attributeName(node) {
  const name = node.name
  if (!name) return ''
  if (name.type === 'JSXIdentifier') return String(name.name ?? '')
  if (name.type === 'JSXNamespacedName') {
    return `${String(name.namespace?.name ?? '')}:${String(name.name?.name ?? '')}`
  }
  return ''
}

const SKIP_KEYS = new Set(['loc', 'leadingComments', 'trailingComments', 'innerComments'])

/** Every string and template anywhere under a node. */
function literalsUnder(root) {
  const found = []
  const visit = (value) => {
    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }
    if (!isNode(value)) return
    if (isLiteral(value)) found.push(value)
    for (const key of Object.keys(value)) {
      if (SKIP_KEYS.has(key)) continue
      visit(value[key])
    }
  }
  visit(root)
  return found
}

/** `console.log(...)` and friends: developer output, never player copy. */
function isConsoleCall(node) {
  if (node.type !== 'CallExpression') return false
  const callee = node.callee
  if (!callee || callee.type !== 'MemberExpression') return false
  return callee.object?.type === 'Identifier' && callee.object.name === 'console'
}

/**
 * `new Error('…')` — the BUILT-IN, by name.
 *
 * A plain Error is the developer's exception: thrown to unwind, caught a few
 * frames up, never rendered. `speak.ts` rejects with 'chapter audio playback
 * cancelled' five times and no player ever sees the words.
 *
 * The distinction that makes this safe is that a message meant for a PLAYER
 * gets a class of its own here — `AiError` in `src/ai/client.ts` is thrown
 * precisely so `e instanceof AiError ? e.message : …` can put it on screen.
 * So a custom error class is still scanned, and only the built-in is skipped.
 * Checked before it was written: every `new Error(…)` in the watched set is
 * `speak.ts`'s internal control flow, and every player-facing throw is an
 * `AiError`.
 */
function isPlainErrorConstruction(node) {
  return (
    node.type === 'NewExpression' &&
    node.callee?.type === 'Identifier' &&
    node.callee.name === 'Error'
  )
}

/**
 * Count the player-facing English in one file.
 *
 * @param {string} fileName for the caller's messages; the scan is positional
 * @param {string} source
 * @param {Set<string>} [allow] matched against TRIMMED text, exactly
 * @returns {RawLiteral[]}
 */
export function scanFile(fileName, source, allow = new Set()) {
  const ast = parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] })

  /** @type {RawLiteral[]} */
  const found = []
  /** Literals already reported by the attribute pass; the sentence rule skips them. */
  const counted = new Set()
  /** Literals that are identifiers by position and must never be reported. */
  const skipped = new Set()

  const record = (node, kind) => {
    const raw = staticText(node)
    if (raw === null) return
    const text = raw.trim()
    if (!text || allow.has(text)) return
    found.push({ line: node.loc?.start.line ?? 0, text, kind })
  }

  // ── pass 1: attributes ──────────────────────────────────────────────────
  //
  // Done first and whole-subtree, so an interesting attribute's literals are
  // claimed before the sentence rule can see them, and a `className` string is
  // struck out before it can be mistaken for a sentence. An expression inside
  // a NON-copy attribute is left alone on purpose: `onClick={() =>
  // setError('that word is on the board')}` is copy and the sentence rule
  // should find it.
  const walkAttributes = (value) => {
    if (Array.isArray(value)) {
      value.forEach(walkAttributes)
      return
    }
    if (!isNode(value)) return
    if (value.type === 'JSXAttribute' && value.value) {
      if (COPY_ATTRIBUTES.has(attributeName(value))) {
        for (const literal of literalsUnder(value.value)) {
          record(literal, 'jsx-attr')
          counted.add(literal)
        }
      } else if (isLiteral(value.value)) {
        skipped.add(value.value)
      }
    }
    for (const key of Object.keys(value)) {
      if (SKIP_KEYS.has(key)) continue
      walkAttributes(value[key])
    }
  }
  walkAttributes(ast)

  // ── pass 2: text, children and sentences ────────────────────────────────
  const walk = (value, stack, skipping) => {
    if (Array.isArray(value)) {
      for (const item of value) walk(item, stack, skipping)
      return
    }
    if (!isNode(value)) return

    const node = value
    const parent = stack[stack.length - 1]
    const grandparent = stack[stack.length - 2]
    const nowSkipping = skipping || isConsoleCall(node) || isPlainErrorConstruction(node)

    if (node.type === 'JSXText') {
      const raw = String(node.value ?? '')
      const text = raw.trim()
      if (text && HAS_LETTER.test(text) && !allow.has(text)) {
        // A JSXText node starts immediately after the opening tag, so its own
        // start line is the tag's, not the text's. Step over the leading
        // whitespace so the number points at the words someone is hunting for.
        const leading = (raw.slice(0, raw.indexOf(text[0])).match(/\n/g) ?? []).length
        found.push({ line: (node.loc?.start.line ?? 0) + leading, text, kind: 'jsx-text' })
      }
    } else if (isLiteral(node) && !counted.has(node) && !skipped.has(node) && !nowSkipping) {
      const text = staticText(node) ?? ''
      const isObjectKey =
        parent?.type === 'ObjectProperty' && parent.key === node && parent.computed !== true
      const isModuleSource =
        (parent?.type === 'ImportDeclaration' ||
          parent?.type === 'ExportNamedDeclaration' ||
          parent?.type === 'ExportAllDeclaration' ||
          parent?.type === 'TSImportType') &&
        parent.source === node
      const isTypePosition = parent?.type === 'TSLiteralType'

      if (!isObjectKey && !isModuleSource && !isTypePosition) {
        const inJsxChild =
          parent?.type === 'JSXExpressionContainer' &&
          (grandparent?.type === 'JSXElement' || grandparent?.type === 'JSXFragment')
        if (inJsxChild) {
          if (HAS_LETTER.test(text)) record(node, 'jsx-child')
        } else if (THREE_WORDS.test(text)) {
          record(node, 'sentence')
        }
      }
    }

    const nextStack = [...stack, node]
    for (const key of Object.keys(node)) {
      if (SKIP_KEYS.has(key)) continue
      walk(node[key], nextStack, nowSkipping)
    }
  }
  walk(ast, [], false)

  found.sort((a, b) => a.line - b.line)
  void fileName
  return found
}
