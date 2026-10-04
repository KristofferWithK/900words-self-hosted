#!/usr/bin/env node
/**
 * German City 1 (Flensburg) plays the Danish course, board for board.
 *
 * Owner, 2026-09-27: "it could and should just be the same as danish. this is
 * our universality approach." So the German course is not chosen on its own.
 * It is the Danish required set (city1-required-boards-v2) with every card
 * read through the one Danish-to-German card map: the same 100 boards, in the
 * same order, with the same keys and the same four appended boards. And the
 * same clue rules, applied to German words rather than to the Danish ones:
 *
 *   - SAME_ROOT: Casey gives no clue built on her target's own word («Fahrrad»
 *     for «fahren»), the rule the Danish bank got for «tanke» and «tænke».
 *     German makes its own pairs: «Länge» and «lang» are one root in German,
 *     while Danish «længde» and «lang» never reached the Danish list.
 *   - LOST_SENSE: a clue whose only link to the German card is a sense the
 *     German card does not have. Danish «gang» is "time" and also "corridor";
 *     German «Mal» is only "time", so «Korridor» leads nowhere near it. These
 *     groups came in with the word-for-word translation of the Danish bank.
 *
 * What this script writes, and from what:
 *
 *   src/data/city1-board-cycle-appendix.de.json   bank_151 onward in German,
 *       mapped from src/data/city1-board-cycle-appendix.da.json. The 150-board
 *       German archive (city1-board-cycle.de.json) is not touched.
 *   proxy/data/authored-clues.de.1.json           Casey's German clue groups.
 *       Boards 1-150 are the German translation run (docs/roadmap/german-
 *       city1-boards.md) with the two lists above taken out, IN PLACE: the file
 *       is its own input, and taking a listed group out twice is the same as
 *       once. The appended boards are translated here, from the Danish
 *       appendix bank's Casey groups (the same graph.casey the 150 were
 *       translated from), by APPENDIX_CLUES.
 *   src/data/city1-clue-groups.de.json            group membership, no clue text.
 *   src/data/city1-required-board-manifest.de.json   the German required set,
 *       city1-german-city1-playtest-v2: the Danish v2 ids in the Danish v2
 *       order. The 150-board playtest set it supersedes is kept, byte for
 *       byte, as city1-required-board-manifest.de.v1.json, because a German
 *       save names it.
 *
 * The German words are model output. The owner is a native German speaker and
 * reads them; nothing here is a native-speaker sign-off on its own.
 *
 *   node scripts/german-city1-course.mjs          write the four files
 *   node scripts/german-city1-course.mjs --check  exit 1 if any would change
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHECK = process.argv.includes('--check')

const DANISH_ARCHIVE = 'src/data/city1-board-cycle.da.json'
const DANISH_APPENDIX = 'src/data/city1-board-cycle-appendix.da.json'
const DANISH_MANIFEST = 'src/data/city1-required-board-manifest.da.json'
const DANISH_APPENDIX_BANK = 'docs/research/board-engine/city1-bank/bank.city1.appendix.json'
const GERMAN_ARCHIVE = 'src/data/city1-board-cycle.de.json'
const GERMAN_WORDS = 'src/data/words.de.json'
const SUPERSEDED_MANIFEST = 'src/data/city1-required-board-manifest.de.v1.json'

const APPENDIX_OUT = 'src/data/city1-board-cycle-appendix.de.json'
const BANK_OUT = 'proxy/data/authored-clues.de.1.json'
const GROUPS_OUT = 'src/data/city1-clue-groups.de.json'
const MANIFEST_OUT = 'src/data/city1-required-board-manifest.de.json'

const SET_VERSION = 'city1-german-city1-playtest-v2'
const SUPERSEDED_SET_VERSION = 'city1-german-city1-playtest-v1'

/**
 * Casey's German clues built on her target's own word, keyed by clue, with the
 * greens each may not point at. Found by a stem and word-family scan of every
 * German group and read by hand. Left in on purpose, because the two only look
 * alike or are related too far back for a learner to see it: «Gericht» and
 * «richtig», «schwierig» and «schwer», «gehorchen» and «hören», «Stellung» and
 * «stehen», «Ankunft» and «kommen», «Fußgänger» and «gehen», «sichtbar» and
 * «sehen» (the Danish list keeps «fodgænger» and «gå» the same way).
 */
const SAME_ROOT = {
  denken: ['de:Gedanke'],
  benennen: ['de:Name'],
  Benennung: ['de:Name'],
  nennen: ['de:Name'],
  Länge: ['de:lang'],
  Fernseher: ['de:sehen'],
  Schüler: ['de:Schule'],
  Gewissheit: ['de:wissen'],
  bewusst: ['de:wissen'],
  Einfahrt: ['de:fahren'],
  Fahrspur: ['de:fahren'],
  Fahrrad: ['de:fahren'],
  Fahrgemeinschaft: ['de:fahren'],
  Abfahrt: ['de:fahren'],
  Lesung: ['de:lesen'],
  Gespräch: ['de:Sprache'],
  sprechen: ['de:Sprache'],
  aussprechen: ['de:Sprache'],
  älter: ['de:alt'],
  Meinung: ['de:meinen'],
  Sitzplatz: ['de:sitzen'],
  Aussage: ['de:sagen'],
  Mittwoch: ['de:Woche'],
  Dänemark: ['de:dänisch'],
  Stillstand: ['de:stehen'],
}

/**
 * Clues whose only road to the German card runs through a sense the German
 * words do not share. Two ways in: the German card lacks a sense of the
 * Danish card («gang» is also a corridor, «Mal» is not), or the Danish clue
 * had two senses and was translated in the other one («kort», a map, became
 * «kurz», short). Found by reading every clue that reaches each card with a
 * Danish double meaning, and every card's full clue list once.
 */
const LOST_SENSE = {
  // «gang» is also a corridor, a gait and a walk; «Mal» is only "time, occasion".
  Bewegung: ['de:Mal'], Flur: ['de:Mal'], Fußboden: ['de:Mal'], Fußgänger: ['de:Mal'], Gang: ['de:Mal'],
  Gasse: ['de:Mal'], Korridor: ['de:Mal'], Passant: ['de:Mal'], Stufe: ['de:Mal'], Wanderer: ['de:Mal'],
  Wanderung: ['de:Mal'], eng: ['de:Mal'], gehen: ['de:Mal'], wandern: ['de:Mal'],
  // «lov» is also permission; «Gesetz» is only a law.
  Erlaubnis: ['de:Gesetz'],
  // «dyr» is also "expensive"; «Tier» is only an animal.
  kostbar: ['de:Tier'],
  // «klar» is also clear, bright and obvious; «bereit» is only "ready".
  Licht: ['de:bereit'], durchsichtig: ['de:bereit'], eindeutig: ['de:bereit'], logisch: ['de:bereit'],
  verwirrt: ['de:bereit'],
  // «mening» is also meaning and sense; «Meinung» is only an opinion.
  Bedeutung: ['de:Meinung'], Wichtigkeit: ['de:Meinung'], Definition: ['de:Meinung'], Semantik: ['de:Meinung'],
  Satz: ['de:Meinung'], Übersetzung: ['de:Meinung'], verstehen: ['de:Meinung'], Text: ['de:Meinung'],
  Wort: ['de:Meinung'], Sprache: ['de:Meinung'], Erklärung: ['de:Meinung'],
  // «prøve» is also a test, an exam and a sample; «probieren» is only "to try".
  Ausbildung: ['de:probieren'], Biologie: ['de:probieren'], Blut: ['de:probieren'], Casting: ['de:probieren'],
  Lehrer: ['de:probieren'], Lehrling: ['de:probieren'], Lehrplan: ['de:probieren'], Lektion: ['de:probieren'],
  Mikroskop: ['de:probieren'], Prüfung: ['de:probieren'], Schule: ['de:probieren'], Schüler: ['de:probieren'],
  Unterricht: ['de:probieren'], mündlich: ['de:probieren'], untersuchen: ['de:probieren'],
  durchführen: ['de:probieren'], lernen: ['de:probieren'],
  // «klokke» is also a bell; «Uhr» is only a clock.
  Geräusch: ['de:Uhr'], Kirche: ['de:Uhr'], Klang: ['de:Uhr'], anrufen: ['de:Uhr'], läuten: ['de:Uhr'],
  // «bruge» is also "to spend"; «benutzen» is only "to use".
  Budget: ['de:benutzen'], Geld: ['de:benutzen'], Kreditkarte: ['de:benutzen'], Unkosten: ['de:benutzen'],
  sparen: ['de:benutzen'],
  // «tage» takes a photo, a trip and the wrong turn («tage fejl»); German does not «nehmen» those.
  Tour: ['de:nehmen'], Bild: ['de:nehmen'], Foto: ['de:nehmen'], Selfie: ['de:nehmen'], Fehler: ['de:nehmen'],
  Aufenthalt: ['de:nehmen'],
  // «tro» is also "loyal"; «glauben» is only "to believe".
  loyal: ['de:glauben'],
  // «kort», a map, was translated as «kurz», short.
  kurz: ['de:Platz', 'de:Reise'],
  // «eventyr», an adventure, was translated as «Märchen», a fairy tale.
  Märchen: ['de:Reise'],
  // «have», a garden, was translated as «haben», to have.
  haben: ['de:Zuhause'],
  // «ret», right, was translated as «Gericht», a dish or a court.
  Gericht: ['de:richtig'],
  // «horn», a car horn, was translated as «Horn»; German calls it «Hupe».
  Horn: ['de:Auto'],
  // «øre», the coin, was translated as «Ohr», the ear.
  Ohr: ['de:Geld', 'de:Krone'],
  // «karakter», a school grade or a character in a story, was translated as «Note» or «Charakter».
  Note: ['de:Geschichte', 'de:Person'], Charakter: ['de:Schule', 'de:probieren'],
  // «ringe» is to ring and also "poor": «Uhr» is no bell, and «klingeln» is not "poor".
  klingeln: ['de:Uhr', 'de:schlecht'],
  // «skridt», a step, for «gang»; and «tage et skridt» for «nehmen», where German takes no step.
  Schritt: ['de:Mal', 'de:nehmen'],
  // «oplyst», lit and also informed, for «vide»; and «klar» for «bereit».
  beleuchtet: ['de:bereit', 'de:wissen'],
  // «synlig», visible, for «synes» by their shared root; and «klar» for «bereit».
  sichtbar: ['de:bereit', 'de:meinen'],
}

/**
 * Casey's clues for the appended boards, board by board: the Danish clue of
 * each group in the Danish appendix bank, and its German clue, or null where
 * no faithful German word reaches the same greens. A board-aware choice, as
 * the translation run's repairs were: «frikvarter» is «Pause» here because
 * «Schulpause» holds «Schule», a card on bank_154. Every Danish clue of a board
 * must be listed, so a rebuilt appendix fails here rather than half translated.
 */
const APPENDIX_CLUES = {
  bank_151: {
    transport: 'Transport', sandsynlig: 'wahrscheinlich', køre: 'fahren', autoværn: 'Leitplanke', bus: 'Bus',
    gps: 'Navi', trafik: 'Verkehr', kørsel: 'Fahrt', begær: 'Begierde', varevogn: 'Lieferwagen',
    ekspedition: 'Expedition', gade: 'Straße', potentiale: 'Potenzial', tryg: 'geborgen',
    // «Uhrzeit» holds «Zeit», a card here; «Uhr» is the time you read off a clock.
    klokkeslæt: 'Uhr',
    // «forløb» and «korridor» reach «gang» in senses «Mal» does not have.
    forløb: null, korridor: null,
  },
  bank_152: {
    ventetid: 'Wartezeit', uenighed: 'Uneinigkeit', rejsetid: 'Reisezeit', udfordring: 'Herausforderung',
    synes: 'finden', køreplan: 'Fahrplan', klokkeslæt: 'Uhrzeit', transport: 'Transport', test: 'Test',
    vanskelig: 'schwierig', fundere: 'grübeln', anderledes: 'anders', synspunkt: 'Standpunkt',
    // «prøve» as a test or an exam: «probieren» is only "to try".
    bedømmelse: null, vurdering: null, skole: null, lærer: null,
    // «Gedanke» for «denken» and «Länge» for «lang» are SAME_ROOT in German.
    tanke: null, længde: null,
  },
  bank_153: {
    kunst: 'Kunst', scene: 'Szene', kameramand: 'Kameramann', plakat: 'Plakat', producere: 'produzieren',
    pasfoto: 'Passfoto', thriller: 'Thriller', sang: 'Lied', pige: 'Mädchen', hotel: 'Hotel',
    danmark: 'Dänemark', potentiale: 'Potenzial',
    // «machen» is the card itself; «tun» is the other everyday "do".
    gøre: 'tun',
    // «Einwohner» holds «wohnen», a card on this board, and so does «Bewohner».
    indbygger: null,
  },
  bank_154: {
    hæfte: 'Heft', notesbog: 'Notizbuch', lektie: 'Hausaufgabe', overveje: 'überlegen', fundere: 'grübeln',
    skepsis: 'Skepsis',
    // «anden gang» is «ein anderes Mal»; «andere» is also the other, the different.
    anden: 'andere',
    // «Schulpause» holds «Schule», a card on this board.
    frikvarter: 'Pause',
    // «korridor» reaches «gang», and «synlig» reaches «synes», in senses the German cards lack.
    korridor: null, synlig: null,
  },
}

const TOTAL_WORDS = 18
const GREENS_PER_SIDE = 8

const bytesOf = (path) => readFileSync(resolve(ROOT, path))
const jsonOf = (path) => JSON.parse(bytesOf(path).toString('utf8'))
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
const text = (value, indent) => `${JSON.stringify(value, null, indent)}\n`

const { GERMAN_LANGUAGE } = await import(pathToFileURL(resolve(ROOT, 'proxy/casey/language.de.js')).href)

// ---------------------------------------------------------------- the card map

const danishArchive = jsonOf(DANISH_ARCHIVE)
const danishAppendix = jsonOf(DANISH_APPENDIX)
const germanArchiveBytes = bytesOf(GERMAN_ARCHIVE)
const germanArchive = JSON.parse(germanArchiveBytes.toString('utf8'))
const germanWords = new Map(jsonOf(GERMAN_WORDS).map((word) => [word.id, word]))

/**
 * Danish id -> German id, read off the two shipped 150-board archives, which
 * agree cell for cell. One Danish card is one German card everywhere, or the
 * map is refused.
 */
function cardMap() {
  if (danishArchive.boards.length !== germanArchive.boards.length) throw new Error('the Danish and German archives differ in length')
  const map = new Map()
  const back = new Map()
  danishArchive.boards.forEach((da, index) => {
    const de = germanArchive.boards[index]
    if (da.id !== de.id || da.seedHex !== de.seedHex || da.firstGiver !== de.firstGiver || da.greenOverlap !== de.greenOverlap) {
      throw new Error(`${da.id}: the German archive does not carry the Danish board`)
    }
    da.wordIds.forEach((id, cell) => {
      const german = de.wordIds[cell]
      if ((map.get(id) ?? german) !== german || (back.get(german) ?? id) !== id) {
        throw new Error(`${da.id}: ${id} and ${german} break the one-to-one card map`)
      }
      map.set(id, german)
      back.set(german, id)
    })
    const keys = (daKey, deKey) => daKey.length === deKey.length && daKey.every((id, i) => map.get(id) === deKey[i])
    if (!keys(da.playerGreenIds, de.playerGreenIds) || !keys(da.aiGreenIds, de.aiGreenIds)) {
      throw new Error(`${da.id}: the German keys are not the Danish keys`)
    }
  })
  for (const id of map.values()) if (!germanWords.has(id)) throw new Error(`${id} is not a German word`)
  return map
}
const toGerman = cardMap()
const german = (id) => {
  const mapped = toGerman.get(id)
  if (!mapped) throw new Error(`${id} has no German card`)
  return mapped
}

// ------------------------------------------------------------ appended boards

function appendixBoards() {
  const archiveIds = new Set(germanArchive.boards.map((board) => board.id))
  return danishAppendix.boards.map((da) => {
    if (archiveIds.has(da.id)) throw new Error(`${da.id} is already in the German archive`)
    const board = {
      id: da.id,
      seedHex: da.seedHex,
      firstGiver: da.firstGiver,
      greenOverlap: da.greenOverlap,
      wordIds: da.wordIds.map(german),
      playerGreenIds: da.playerGreenIds.map(german),
      aiGreenIds: da.aiGreenIds.map(german),
    }
    const cells = new Set(board.wordIds)
    if (board.wordIds.length !== TOTAL_WORDS || cells.size !== TOTAL_WORDS) throw new Error(`${da.id}: needs ${TOTAL_WORDS} distinct cards`)
    for (const key of [board.playerGreenIds, board.aiGreenIds]) {
      if (key.length !== GREENS_PER_SIDE || new Set(key).size !== GREENS_PER_SIDE || key.some((id) => !cells.has(id))) {
        throw new Error(`${da.id}: a key needs ${GREENS_PER_SIDE} distinct greens on the board`)
      }
    }
    return board
  })
}

// ------------------------------------------------------------------ legality

const viewWords = (board) => board.wordIds.map((id) => {
  const word = germanWords.get(id)
  return { id, da: word.da, pos: word.pos }
})
const fold = (value) => value.normalize('NFC').toLocaleLowerCase()
/**
 * The Worker's German rule, and the translation run's plainer one beside it
 * (one letters-only word, no capital inside it, not holding a card of three
 * letters or more and not held by one), so an appended board's clue meets
 * both of the tests the other 150 met.
 */
function legalOn(clue, board) {
  const words = viewWords(board)
  if (!GERMAN_LANGUAGE.checkClueLegality(clue, words).legal) return false
  if (!/^\p{L}+$/u.test(clue) || /\p{Lu}/u.test(clue.slice(1))) return false
  const c = fold(clue)
  return words.every(({ da }) => {
    const b = fold(da)
    return c !== b && !(b.length >= 3 && c.includes(b)) && !b.includes(c)
  })
}

// ------------------------------------------------------------ Casey's groups

const listed = (list, group) => (list[group.clue] ?? []).some((id) => group.targetWordIds.includes(id))
const dropped = { sameRoot: 0, lostSense: 0 }
function keep(group) {
  if (listed(SAME_ROOT, group)) { dropped.sameRoot++; return false }
  if (listed(LOST_SENSE, group)) { dropped.lostSense++; return false }
  return true
}

function appendixGroups(boards) {
  const bank = jsonOf(DANISH_APPENDIX_BANK)
  if (bank.boards.length !== boards.length) throw new Error(`${DANISH_APPENDIX_BANK} and ${DANISH_APPENDIX} differ in length`)
  let left = 0
  const out = boards.map((board, index) => {
    const source = bank.boards[index]
    const danish = danishAppendix.boards[index]
    if (source.cells.join(',') !== danish.wordIds.join(',') || source.casey.join(',') !== danish.aiGreenIds.join(',')) {
      throw new Error(`${board.id}: the appendix bank board is not the shipped one`)
    }
    const table = APPENDIX_CLUES[board.id]
    if (!table) throw new Error(`${board.id}: no German clues in APPENDIX_CLUES`)
    const groups = []
    const seen = new Set()
    for (const group of source.graph.casey) {
      if (!(group.clue in table)) throw new Error(`${board.id}: the Danish clue «${group.clue}» has no line in APPENDIX_CLUES`)
      const clue = table[group.clue]
      if (clue === null) { left++; continue }
      if (!legalOn(clue, board)) throw new Error(`${board.id}: «${clue}» (for «${group.clue}») is not legal on the board`)
      const targetWordIds = group.ids.map(german)
      if (targetWordIds.some((id) => !board.aiGreenIds.includes(id))) throw new Error(`${board.id}: «${clue}» targets off Casey's key`)
      const key = `${clue}|${targetWordIds.join(',')}`
      if (seen.has(key)) continue
      seen.add(key)
      groups.push({ clue, clueEnglish: '', targetWordIds })
    }
    const unused = Object.keys(table).filter((clue) => !source.graph.casey.some((group) => group.clue === clue))
    if (unused.length) throw new Error(`${board.id}: APPENDIX_CLUES lists clues the board does not have: ${unused.join(', ')}`)
    return { id: board.id, wordIds: board.wordIds, aiGreenIds: board.aiGreenIds, caseyClueGroups: groups }
  })
  return { boards: out, left }
}

function bankDoc(appendix) {
  const current = jsonOf(BANK_OUT)
  const archiveIds = germanArchive.boards.map((board) => board.id)
  const byId = new Map(current.boards.map((board) => [board.id, board]))
  for (const id of byId.keys()) {
    if (!archiveIds.includes(id) && !appendix.some((board) => board.id === id)) throw new Error(`${BANK_OUT} has a board no cycle holds: ${id}`)
  }
  const archiveBoards = germanArchive.boards.map((cycleBoard) => {
    const board = byId.get(cycleBoard.id)
    if (!board) throw new Error(`${BANK_OUT} has no ${cycleBoard.id}`)
    if (board.wordIds.join(',') !== cycleBoard.wordIds.join(',') || board.aiGreenIds.join(',') !== cycleBoard.aiGreenIds.join(',')) {
      throw new Error(`${cycleBoard.id}: ${BANK_OUT} is not the archive's board`)
    }
    return { ...board, caseyClueGroups: board.caseyClueGroups.filter(keep) }
  })
  const appended = appendixGroups(appendix)
  const boards = [...archiveBoards, ...appended.boards.map((board) => ({ ...board, caseyClueGroups: board.caseyClueGroups.filter(keep) }))]
  for (const board of boards) {
    if (board.caseyClueGroups.length === 0) throw new Error(`${board.id}: Casey is left with no German clue group`)
  }
  return {
    doc: { schemaVersion: current.schemaVersion, sourceSha256: current.sourceSha256, note: BANK_NOTE, boards },
    boards,
    left: appended.left,
  }
}

const BANK_NOTE =
  "Casey's judged clue groups for the German City 1 course (Flensburg). Boards bank_001 to bank_150 were rendered into German by " +
  'the runbook at docs/roadmap/german-city1-boards.md (emit-shipped.mjs): Casey\'s Danish groups translated word-for-word ' +
  '(frozen/clues.de.json), board-aware repairs applied per board (frozen/repairs.json), a group dropped where no German word ' +
  'exists or the German clue is illegal on its board, and the board\'s top-up groups appended (frozen/topup.de.json), from the ' +
  'Danish shipped Worker bank (source sha256 d79876670fd3b664a42a68d3a517bf0ce5e8239ba309ae09fb257c0826985139). Since ' +
  '2026-09-27 scripts/german-city1-course.mjs keeps this file: it leaves out every group built on its target\'s own German word ' +
  '(SAME_ROOT) and every group whose only link to a German card is a Danish sense that card lacks (LOST_SENSE), and it appends ' +
  'bank_151 onward, translated from the Danish appendix bank by APPENDIX_CLUES. The German words are model output, read by the owner.'

/** Membership only, as the Danish file: two or three of Casey's greens a group reaches, as cell indexes. */
function groupsDoc(cycle, bankBoards, appendixSha256) {
  const byId = new Map(bankBoards.map((board) => [board.id, board]))
  return {
    schemaVersion: 1,
    sourceSha256: germanArchive.sourceSha256,
    appendixSha256,
    boards: cycle.map((board) => {
      const casey = []
      for (const group of byId.get(board.id).caseyClueGroups) {
        if (group.targetWordIds.length < 2) continue
        const cell = group.targetWordIds.map((id) => board.wordIds.indexOf(id)).sort((a, b) => a - b).join('.')
        if (!casey.includes(cell)) casey.push(cell)
      }
      return { id: board.id, player: [], casey }
    }),
  }
}

// ------------------------------------------------------------------ the course

function manifestDoc(appendixBytes) {
  const danishBytes = bytesOf(DANISH_MANIFEST)
  const danish = JSON.parse(danishBytes.toString('utf8'))
  const superseded = bytesOf(SUPERSEDED_MANIFEST)
  const previous = JSON.parse(superseded.toString('utf8'))
  if (previous.boardSetVersion !== SUPERSEDED_SET_VERSION) throw new Error(`${SUPERSEDED_MANIFEST} is not ${SUPERSEDED_SET_VERSION}`)
  return {
    schemaVersion: 1,
    kind: 'city1-required-board-manifest',
    status: 'owner-authorized-playtest',
    boardSetVersion: SET_VERSION,
    supersedes: SUPERSEDED_SET_VERSION,
    learnerCourse: 'de',
    stableCityId: 'flensburg',
    requiredBoardCount: danish.requiredBoardCount,
    contentRevisionRule: previous.contentRevisionRule,
    sourceSha256: germanArchive.sourceSha256,
    approval: {
      owner: 'Kristoffer, chat 2026-09-27',
      decision: 'German City 1 plays the Danish course board for board: the same boards, in the same order (the universality approach).',
      followsDanishSet: danish.boardSetVersion,
    },
    sources: {
      danishManifest: { path: DANISH_MANIFEST, sha256: sha256(danishBytes) },
      archivalCycle: { path: GERMAN_ARCHIVE, sha256: sha256(germanArchiveBytes), boardCount: germanArchive.boards.length },
      cycleAppendix: { path: APPENDIX_OUT, sha256: sha256(appendixBytes), boardCount: danishAppendix.boards.length },
      supersededManifest: { path: SUPERSEDED_MANIFEST, sha256: sha256(superseded) },
    },
    requiredBoards: danish.requiredBoards,
    displayOrder: danish.displayOrder,
  }
}

// ---------------------------------------------------------------------- build

const appendix = appendixBoards()
const appendixText = text({
  schemaVersion: germanArchive.schemaVersion,
  sourceSha256: germanArchive.sourceSha256,
  danishAppendixSha256: sha256(bytesOf(DANISH_APPENDIX)),
  note:
    `The boards appended after the German 150-board archive, bank_151 onward: ${DANISH_APPENDIX} read through the Danish-to-German ` +
    'card map of the two shipped archives, cell for cell, with seedHex, firstGiver and greenOverlap carried over. Written by ' +
    'scripts/german-city1-course.mjs.',
  boards: appendix,
}, 1)
const appendixBytes = Buffer.from(appendixText, 'utf8')
const cycle = [...germanArchive.boards, ...appendix]
const bank = bankDoc(appendix)
const outputs = [
  [APPENDIX_OUT, appendixText],
  [BANK_OUT, text(bank.doc, 1)],
  [GROUPS_OUT, text(groupsDoc(cycle, bank.boards, sha256(appendixBytes)), 2)],
  [MANIFEST_OUT, text(manifestDoc(appendixBytes), 2)],
]

// What the course asks of Casey's groups in Danish (city1ClueGroups.test.ts), reported for German.
const thin = bank.boards.flatMap((board) => {
  const multi = board.caseyClueGroups.filter((group) => group.targetWordIds.length >= 2)
  const grouped = new Set(multi.flatMap((group) => group.targetWordIds)).size
  const reached = new Set(board.caseyClueGroups.flatMap((group) => group.targetWordIds)).size
  return multi.length < 5 || grouped < 5
    ? [`${board.id} ${multi.length} groups of 2+, ${grouped}/${GREENS_PER_SIDE} greens in one, ${reached}/${GREENS_PER_SIDE} reached`]
    : []
})

const stale = []
for (const [path, contents] of outputs) {
  const current = (() => { try { return bytesOf(path).toString('utf8') } catch { return null } })()
  if (current === contents) continue
  stale.push(path)
  if (!CHECK) writeFileSync(resolve(ROOT, path), contents)
}
console.log(`German City 1: ${cycle.length} boards (${appendix.length} appended), ${SET_VERSION} follows ${DANISH_MANIFEST}`)
console.log(`Casey's German groups: ${bank.boards.reduce((n, b) => n + b.caseyClueGroups.length, 0)} kept; this run left out ${dropped.sameRoot} same-root and ${dropped.lostSense} lost-sense groups, and ${bank.left} appendix groups had no faithful German clue`)
console.log(thin.length ? `under the Danish floor of five: ${thin.join('; ')}` : 'every board meets the Danish floor of five')
if (CHECK) {
  if (stale.length) {
    console.error(`stale: ${stale.join(', ')} (run node scripts/german-city1-course.mjs)`)
    process.exit(1)
  }
  console.log('all four files are current')
} else {
  console.log(stale.length ? `wrote ${stale.join(', ')}` : 'nothing to write')
}
