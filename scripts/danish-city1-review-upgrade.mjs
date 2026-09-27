#!/usr/bin/env node
/**
 * The Danish City 1 review focus upgrade: 29 of the 100 City 1 review
 * sentences rewritten so that no sentence underlines an article or pronoun
 * (den, det, en, et, i) and no support word underlines more than five cards.
 * Owner-approved in chat on 2026-09-26, the same change made to German.
 *
 * The accepted finish-review files under prototypes/finish-review/ are
 * hash-pinned and stay exactly as they were. This is a successor set: each
 * row here replaces the accepted row for the same word at version + 1, and
 * `src/review/city1.ts` layers it over them. Its recordings are a separate
 * manifest (`city1-sentence-audio.da.upgrade.runtime.json`), so the frozen
 * 704-recording Aoede manifest is untouched too.
 *
 *   node scripts/danish-city1-review-upgrade.mjs          check, print a summary
 *   node scripts/danish-city1-review-upgrade.mjs --write  check and write the JSON
 *   node scripts/danish-city1-review-upgrade.mjs --check  fail if the JSON is stale
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TARGET = resolve(ROOT, 'src/data/city1-review-upgrade.da.json')
const IMPL = resolve(ROOT, 'prototypes/finish-review/implementation')
const APPROVAL = 'owner-chat-2026-09-26'

// [card id, Danish, English, card form as written, target id, focus as written]
const ROWS = [
  ['da:barn', 'Mit barn er også her.', 'My child is here too.', 'barn', 'da-focus:ogsaa', 'også'],
  ['da:kat', 'Katten sover altid her.', 'The cat always sleeps here.', 'Katten', 'da-focus:altid', 'altid'],
  ['da:pige', 'Pigen spiller gerne fodbold.', 'The girl likes playing football.', 'Pigen', 'da-focus:gerne', 'gerne'],
  ['da:uge', 'Jeg er her kun en uge.', "I'm only here for a week.", 'uge', 'da-focus:kun', 'kun'],
  ['da:lille', 'Huset er meget lille.', 'The house is very small.', 'lille', 'da-focus:meget', 'meget'],
  ['da:se', 'Vi ses i morgen!', 'See you tomorrow!', 'ses', 'da-focus:i-morgen', 'i morgen'],
  ['da:god', 'Filmen var god.', 'The film was good.', 'god', 'da-focus:var', 'var'],
  ['da:rigtig', 'Nej, det er ikke rigtigt.', "No, that's not right.", 'rigtigt', 'da-focus:ikke', 'ikke'],
  ['da:sjov', 'Det er virkelig sjovt!', "That's really fun!", 'sjovt', 'da-focus:virkelig', 'virkelig'],
  ['da:sted', 'Vi mødes samme sted i morgen.', "We'll meet at the same place tomorrow.", 'sted', 'da-focus:samme', 'samme'],
  ['da:finde', 'Jeg kan ikke finde banegården.', "I can't find the station.", 'finde', 'da-focus:ikke', 'ikke'],
  ['da:høre', 'Jeg kan ikke høre dig.', "I can't hear you.", 'høre', 'da-focus:ikke', 'ikke'],
  ['da:bruge', 'Må jeg bruge din telefon?', 'May I use your phone?', 'bruge', 'da-focus:maa', 'Må'],
  ['da:år', 'Jeg kommer tilbage næste år.', "I'm coming back next year.", 'år', 'da-focus:tilbage', 'tilbage'],
  ['da:måde', 'Man kan også gøre det på en anden måde.', 'You can also do it another way.', 'måde', 'da-focus:ogsaa', 'også'],
  ['da:forskellig', 'Vi er meget forskellige.', 'We are very different.', 'forskellige', 'da-focus:meget', 'meget'],
  ['da:spændende', 'Bogen er virkelig spændende.', 'The book is really exciting.', 'spændende', 'da-focus:virkelig', 'virkelig'],
  ['da:ny', 'Det er helt nyt for mig.', "That's all new to me.", 'nyt', 'da-focus:helt', 'helt'],
  ['da:sidste', 'Det er den sidste bus i dag.', "That's the last bus today.", 'sidste', 'da-focus:i-dag', 'i dag'],
  ['da:eksempel', 'Kan du give mig et eksempel?', 'Can you give me an example?', 'eksempel', 'ledger:kan', 'Kan'],
  ['da:menneske', 'Der er mange mennesker her.', 'There are a lot of people here.', 'mennesker', 'da-focus:mange', 'mange'],
  ['da:grund', 'Hvorfor? Der er en god grund.', "Why? There's a good reason.", 'grund', 'da-focus:hvorfor', 'Hvorfor'],
  ['da:land', 'Hvilket land kommer du fra?', 'Which country are you from?', 'land', 'da-focus:hvilket', 'Hvilket'],
  ['da:verden', 'Jeg vil gerne se verden.', "I'd like to see the world.", 'verden', 'da-focus:gerne', 'gerne'],
  ['da:måned', 'Jeg har været her en måned nu.', "I've been here for a month now.", 'måned', 'da-focus:nu', 'nu'],
  ['da:tanke', 'Jeg havde samme tanke.', 'I had the same thought.', 'tanke', 'da-focus:samme', 'samme'],
  ['da:tvivl', 'Uden tvivl!', 'Without a doubt!', 'tvivl', 'da-focus:uden', 'Uden'],
  ['da:film', 'Hvornår starter filmen?', 'When does the film start?', 'filmen', 'da-focus:hvornaar', 'Hvornår'],
  ['da:rejse', 'God rejse og farvel!', 'Have a good trip, goodbye!', 'rejse', 'ledger:farvel', 'farvel'],
]

// new target id → [meaning, usage, example Danish, example English, focus as written in the example]
const ABOUT = {
  'da-focus:ogsaa': ['Also; too.', 'Adds the same thing again. Jeg også is: me too.', 'Jeg også.', 'Me too.', 'også'],
  'da-focus:altid': ['Always.', 'Every time, without exception. Its opposite is aldrig, never.', 'Bussen er altid sen.', 'The bus is always late.', 'altid'],
  'da-focus:gerne': ['Gladly; like to.', 'After a verb it says you like doing it. Jeg vil gerne have … is the polite way to ask for something.', 'Jeg vil gerne have en kaffe.', 'I would like a coffee.', 'gerne'],
  'da-focus:kun': ['Only.', 'Limits what follows: kun en, kun i dag.', 'Jeg har kun ti kroner.', 'I only have ten kroner.', 'kun'],
  'da-focus:meget': ['Very; much; a lot.', 'Makes an adjective stronger (meget varm) or says a lot of something (meget vand).', 'Det er meget varmt i dag.', 'It is very hot today.', 'meget'],
  'da-focus:i-morgen': ['Tomorrow.', 'The day after today. I dag is today and i går yesterday.', 'Jeg kommer i morgen.', "I'm coming tomorrow.", 'i morgen'],
  'da-focus:var': ['Was; were.', 'The past of er, the same for everyone: jeg var, vi var, det var.', 'Det var dejligt.', 'That was lovely.', 'var'],
  'da-focus:ikke': ['Not.', 'Says no to a verb or a whole sentence. It comes after the verb: Jeg forstår ikke.', 'Det er ikke langt.', 'It is not far.', 'ikke'],
  'da-focus:virkelig': ['Really.', 'Makes a word stronger, or asks whether something is true: Virkelig?', 'Virkelig?', 'Really?', 'Virkelig'],
  'da-focus:samme': ['Same.', 'Says two things are one and the same: den samme bus, det samme.', 'Vi bor i samme gade.', 'We live in the same street.', 'samme'],
  'da-focus:maa': ['May; be allowed to.', 'Må jeg …? asks for permission politely. The other verb follows without at.', 'Må jeg komme ind?', 'May I come in?', 'Må'],
  'da-focus:tilbage': ['Back; left (over).', 'Returning somewhere (komme tilbage), or what remains (er der noget tilbage?).', 'Jeg er tilbage om fem minutter.', "I'll be back in five minutes.", 'tilbage'],
  'da-focus:helt': ['Completely; quite.', 'Makes an adjective total: helt nyt, helt fint. Det er helt fint is: that is absolutely fine.', 'Det er helt fint.', "That's completely fine.", 'helt'],
  'da-focus:i-dag': ['Today.', 'This day. I morgen is tomorrow and i går yesterday.', 'Hvad laver du i dag?', 'What are you doing today?', 'i dag'],
  'da-focus:mange': ['Many; a lot of.', 'A large number of things you can count: mange mennesker. Mange tak is: thanks a lot.', 'Mange tak!', 'Thanks a lot!', 'Mange'],
  'da-focus:hvorfor': ['Why.', 'Asks for a reason. The answer often starts with fordi.', 'Hvorfor ikke?', 'Why not?', 'Hvorfor'],
  'da-focus:hvilket': ['Which.', 'Asks you to choose. Hvilken goes with en-words, hvilket with et-words and hvilke with plurals.', 'Hvilket tog skal jeg tage?', 'Which train should I take?', 'Hvilket'],
  'da-focus:nu': ['Now.', 'At this moment. It often closes a sentence: Vi kører nu.', 'Bussen kommer nu.', 'The bus is coming now.', 'nu'],
  'da-focus:uden': ['Without.', 'Leaves something out: uden mælk, uden mig.', 'En kaffe uden mælk, tak.', 'A coffee without milk, please.', 'uden'],
  'da-focus:hvornaar': ['When.', 'Asks about time. The verb follows it: Hvornår kommer …?', 'Hvornår kommer toget?', 'When does the train come?', 'Hvornår'],
}

const fail = (message) => { throw new Error(message) }
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const canonical = (value) => Array.isArray(value)
  ? `[${value.map(canonical).join(',')}]`
  : value && typeof value === 'object'
    ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
    : JSON.stringify(value)
const letter = /[\p{L}\p{N}]/u
const read = (path) => JSON.parse(readFileSync(resolve(IMPL, path), 'utf8'))

function spanOf(text, form, where) {
  const hits = []
  for (let at = text.indexOf(form); at >= 0; at = text.indexOf(form, at + 1)) {
    const before = text[at - 1], after = text[at + form.length]
    if ((!before || !letter.test(before)) && (!after || !letter.test(after))) hits.push(at)
  }
  if (hits.length !== 1) fail(`${where}: «${form}» occurs ${hits.length} times on word boundaries in «${text}»`)
  return { text: form, start: hits[0], end: hits[0] + form.length }
}
const bump = (id, from, to) => id.endsWith(`:v${from}`) ? `${id.slice(0, -String(from).length)}${to}` : fail(`${id} does not end in :v${from}`)

export function buildUpgrade() {
  const accepted = [...read('review-sentences.json').rows, ...read('roster-extension/review-sentences.json').rows]
  const byWord = new Map(accepted.map((row) => [row.wordId, row]))
  const inventory = new Map(read('inventory.json').targets.map((target) => [target.targetId, target]))
  const cycle = JSON.parse(readFileSync(resolve(ROOT, 'src/data/city1-board-cycle.da.json'), 'utf8'))
  const city1 = new Set(JSON.stringify(cycle).match(/"da:[^"]+"/g).map((id) => JSON.parse(id)))
  const newStage = { city: 0, use: 'productive-target' }
  const stageOf = (targetId) => inventory.get(targetId)?.stage ?? (ABOUT[targetId] ? newStage : fail(`${targetId} is neither accepted nor authored here`))

  const seen = new Set()
  const review = ROWS.map(([wordId, da, en, form, targetId, focusForm]) => {
    const old = byWord.get(wordId) ?? fail(`${wordId} has no accepted review row to replace`)
    if (!city1.has(wordId)) fail(`${wordId} is not a City 1 card`)
    if (seen.has(wordId)) fail(`${wordId} is replaced twice`)
    seen.add(wordId)
    const wordSpan = spanOf(da, form, wordId)
    const targetSpan = spanOf(da, focusForm, `${wordId} focus`)
    if (wordSpan.start < targetSpan.end && targetSpan.start < wordSpan.end) fail(`${wordId}: card and focus overlap`)
    const version = old.version + 1
    const row = {
      wordId, city: 0, sourceSha256: old.sourceSha256, version,
      sentenceId: bump(old.sentenceId, old.version, version), audioId: bump(old.audioId, old.version, version),
      text: { da, en }, wordSpan, targetId, targetStage: stageOf(targetId), targetSpan, status: 'accepted',
    }
    return { ...row, approval: { artifact: APPROVAL, sha256: sha256(canonical(row)) } }
  })

  // The whole City 1 set after the upgrade: no article/pronoun focus, no focus over five.
  const replaced = new Map(review.map((row) => [row.wordId, row]))
  const effective = [...city1].map((id) => replaced.get(id) ?? byWord.get(id) ?? fail(`${id} has no review row`))
  const uses = new Map()
  for (const row of effective) {
    if (['ledger:den', 'ledger:det', 'ledger:en', 'ledger:et', 'ledger:i'].includes(row.targetId)) fail(`${row.wordId} still underlines ${row.targetSpan.text}`)
    uses.set(row.targetId, (uses.get(row.targetId) ?? 0) + 1)
  }
  for (const [targetId, count] of uses) if (count > 5) fail(`${targetId} underlines ${count} City 1 cards (at most 5)`)
  const sentences = new Set(effective.map((row) => row.text.da))
  if (sentences.size !== effective.length) fail('two City 1 cards share a review sentence')

  const about = Object.entries(ABOUT).map(([targetId, [meaningEn, usageEn, exampleDa, exampleEn, form]]) => {
    if (!uses.has(targetId)) fail(`About ${targetId} is used by no City 1 review row`)
    if (sentences.has(exampleDa)) fail(`About ${targetId}: its example repeats a review sentence`)
    const row = {
      targetId, targetStage: newStage, version: 1, meaningEn, usageEn,
      example: { da: exampleDa, en: exampleEn }, targetSpan: spanOf(exampleDa, form, `About ${targetId}`), status: 'accepted',
    }
    return { ...row, approval: { artifact: APPROVAL, sha256: sha256(canonical(row)) } }
  })
  return {
    json: {
      language: 'da', city: 0,
      note: 'Generated by scripts/danish-city1-review-upgrade.mjs; edit that file, not this one. Each review row replaces the accepted row for its word.',
      review, about,
    },
    uses,
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { json, uses } = buildUpgrade()
    const text = `${JSON.stringify(json, null, 2)}\n`
    if (process.argv.includes('--write')) writeFileSync(TARGET, text)
    else if (process.argv.includes('--check')) {
      let current = ''
      try { current = readFileSync(TARGET, 'utf8').replace(/\r\n/g, '\n') } catch {}
      if (current !== text) fail('src/data/city1-review-upgrade.da.json is stale: run node scripts/danish-city1-review-upgrade.mjs --write')
    }
    const top = [...uses].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id, n]) => `${id.replace(/^[^:]+:/, '')} ${n}`).join(', ')
    console.log(`${json.review.length} rows replaced, ${json.about.length} new About notes, ${uses.size} focus words across City 1 (most used: ${top})`)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
