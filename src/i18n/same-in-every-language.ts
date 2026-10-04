/**
 * Catalogue paths whose translation is ALLOWED to equal the English, so gate 3
 * (`catalogue.test.ts`) does not fail them.
 *
 * Allowlisted BY PATH, never by value. A German label that happens to be the
 * English word is fine when the German word IS that word; the same string
 * appearing at another key is still an untranslated line, and the by-path rule
 * is what keeps those two apart. Every entry carries its reason.
 *
 * Paths are dotted from the catalogue root: `settings.uiLanguageLabel`.
 */
export const SAME_IN_EVERY_LANGUAGE: ReadonlySet<string> = new Set<string>([
  // 900words is a proper brand name and is not translated.
  'home.brandName',
  // ── added 2026-09-12, when eleven languages made the gate visible ────────
  //
  // Found by the translators rather than by a reader: three of them reported,
  // independently, that gate 3 had pushed their copy DOWNHILL. The gate
  // refuses a value equal to the English, which is right almost always and
  // wrong when the word genuinely is the same in both languages — and they had
  // been told they could not edit this file, so each reached for a second-best
  // word instead. Dutch wrote "Straks" and "Voor later" for a button that
  // should just say "Later"; Swedish wrote "Dina data" for a heading that
  // should just say "Data".
  //
  // The paths are listed, never the values (see above): a language that leaves
  // one of these in English by ACCIDENT is now unguarded on these four keys
  // and only these four, which is the price of not making every translator
  // work around the gate.
  //
  // "Later" is the same word in Dutch. The German "Später" and Swedish
  // "Senare" are still the right answers for those languages; nothing here
  // says a language MUST leave it.
  'system.updateLater',
  'home.stopLater',
  'guide.activityLater',
  // "Data" is the same word in Swedish, Dutch ("data" is standard beside
  // "gegevens"), Polish, Portuguese, Spanish and Italian.
  'settings.dataHeading',
  // "Experimental" is the same word in Spanish and Portuguese (2026-09-27,
  // the offline-mode label).
  'settings.offlineModeExperimentalTag',
  // "Model" is the same word in Dutch and Polish (2026-09-27, the own-AI-key
  // settings of the open-source build).
  'settings.ownKeyModelLabel',
  // ── Phase 3 German glosses (band 1, ranks 1-300, 2026-09-14) ───────────────
  //
  // The validator (glosses.test.ts) refuses a gloss identical to the Danish
  // headword and identical to the English gloss. For these ids the everyday
  // German word genuinely IS that word (true Danish–German cognates where the
  // German spelling matches: lang, klar, international, national, privat), so
  // the by-path allowlist — never a weaker word — is the right fix, exactly as
  // the catalogue entries above reason and as the French band-1 precedent
  // (glosses.da:bord, da:lang, ...) established. Paths are by id.
  'glosses.da:lang',
  'glosses.da:klar',
  'glosses.da:international',
  'glosses.da:national',
  'glosses.da:privat',

  // ── added 2026-09-14, Phase 3 Portuguese glosses band 1 (plan §9.4) ────────
  //
  // Danish↔target-language headword and English-gloss identities that are the
  // genuine Portuguese word (European Portuguese shares these with Danish or
  // English as true cognates/internationalisms). Value-specific `glosses.<id>.<gloss>`
  // entries, never blanket id entries, so an accidentally-untranslated row at
  // one of these ids stays guarded for every other gloss value.
  // da:sol — the Danish AND Portuguese word for "sun" is "sol".
  'glosses.da:sol.sol',
  // da:hospital — identical in Danish, English and Portuguese.
  'glosses.da:hospital.hospital',
  // da:hotel — identical in Danish, English and Portuguese.
  'glosses.da:hotel.hotel',
  // da:dyr — the Portuguese word for "animal" is "animal".
  'glosses.da:dyr.animal',
  // da:almindelig — "normal" is genuine everyday PT-PT beside "comum".
  'glosses.da:almindelig.normal',

  // ── Phase 3 German glosses (band 2, ranks 301-600, 2026-09-15) ─────────────
  // Same rule as band 1: for these ids the everyday German word genuinely IS
  // the Danish/English string (lokal, modern, normal, warm, Hals, billig,
  // Fabrik, interessant, perfekt), so the by-path allowlist — never a weaker
  // word — is the right fix. gratis and hold (Team) got distinct renderings
  // instead; only true identical cognates are listed here.
  'glosses.da:lokal',
  'glosses.da:moderne',
  'glosses.da:normal',
  'glosses.da:varm',
  'glosses.da:hals',
  'glosses.da:billig',
  'glosses.da:fabrik',
  'glosses.da:interessant',
  'glosses.da:perfekt',

  // ── Phase 3 German glosses (band 3, ranks 601-900, 2026-09-15) ─────────────
  // Same rule: true identical cognates only (German word spelled exactly like
  // the Danish headword or the English gloss). Distinct renderings were used
  // elsewhere (hjemmeside → die Webseite; lyserød → rosa alone).
  'glosses.da:journalist',
  'glosses.da:bad',
  'glosses.da:musik',
  'glosses.da:mild',
  'glosses.da:orange',
  'glosses.da:rund',
  'glosses.da:stille',
  'glosses.da:vild',
  'glosses.da:turist',
  'glosses.da:rimelig',
  'glosses.da:streng',
  // da:hjemmeside — "Website" is the genuine German word too (die Website),
  // identical to the ENGLISH gloss; value-specific entry per the PT convention.
  'glosses.da:hjemmeside.Website',

  // ── added 2026-09-15, Phase 3 Portuguese glosses band 2 (ranks 301-600) ────
  //
  // Same rule as band 1: value-specific entries only, for words where the
  // everyday European-Portuguese word genuinely is spelled like the English
  // gloss (or the Danish headword). Each checked by hand against a
  // dictionary; if PT-PT has a common alternative word, that alternative is
  // the gloss instead and no entry exists.
  // da:lokal — "local" is the standard PT-PT adjective (lojas locais).
  'glosses.da:lokal.local',
  // da:populær — "popular" is the standard PT-PT word.
  'glosses.da:populær.popular',
  // da:normal — "normal" is identical in Danish, English and Portuguese.
  'glosses.da:normal.normal',
  // da:særlig — "particular" is a genuine PT-PT sense word beside "especial".
  'glosses.da:særlig.particular',
  // da:influenza — "influenza" is the formal PT-PT word beside "gripe".
  'glosses.da:influenza.influenza',
  // da:internet — identical in Danish, English and Portuguese.
  'glosses.da:internet.internet',
  // da:pizza — identical in Danish, English and Portuguese.
  'glosses.da:pizza.pizza',
  // da:banan — "banana" is identical in Danish, English and Portuguese.
  'glosses.da:banan.banana',
  // da:pasta — "pasta" is a genuine PT-PT word (food sense) beside "massa".
  'glosses.da:pasta.pasta',
  // da:chokolade — "chocolate" is identical in Danish, English and Portuguese.
  'glosses.da:chokolade.chocolate',
  // da:færge — "ferry" is the everyday PT-PT word for the ferry (loanword,
  // used on Portuguese signage and timetables); "barca" listed beside it.
  'glosses.da:færge.ferry',
  // ── Phase 3 Polish glosses (P3-CONTENT-pl, bands 1-3, 2026-09-15) ─────────
  //
  // §9.4: Polish shares true internationalisms with Danish/English. For these
  // ids the everyday Polish word genuinely IS the Danish headword (and/or the
  // English gloss), so the by-path allowlist — never a weaker word — is the
  // right fix, matching the German/Portuguese band precedents above.
  // Band 1: park, bank, bus, hotel, telefon, sofa, plan, firma
  'glosses.da:park.park',
  'glosses.da:bank.bank',
  'glosses.da:bus.bus',
  'glosses.da:hotel.hotel',
  'glosses.da:telefon.telefon',
  'glosses.da:sofa.sofa',
  'glosses.da:plan.plan',
  'glosses.da:firma.firma',
  // Band 2: weekend, internet, mail, program, pizza, klub, banan, pasta, radio, tekst
  'glosses.da:weekend.weekend',
  'glosses.da:internet.internet',
  'glosses.da:mail.mail',
  'glosses.da:program.program',
  'glosses.da:pizza.pizza',
  'glosses.da:klub.klub',
  'glosses.da:banan.banan',
  'glosses.da:pasta.pasta',
  'glosses.da:radio.radio',
  'glosses.da:tekst.tekst',
  // Band 3: koncert, kamera, film
  'glosses.da:koncert.koncert',
  'glosses.da:kamera.kamera',
  'glosses.da:film.film',
  // English-equal but not headword-equal internationalisms (genuine Polish
  // borrowings that share the English gloss):
  'glosses.da:kæreste.partner',
  'glosses.da:idé.idea',
  'glosses.da:supermarked.supermarket',
  'glosses.da:øjeblik.moment',
  'glosses.da:skærm.monitor',
  'glosses.da:sodavand.soda',
  'glosses.da:landmand.farmer',
  'glosses.da:interesse.hobby',

  // ── added 2026-09-15, Phase 3 Portuguese glosses band 3 (ranks 601-900) ────
  //
  // Same rule as bands 1-2: value-specific entries only, for words where the
  // everyday European-Portuguese word genuinely is spelled like the English
  // gloss (or the Danish headword). Each checked by hand against a
  // dictionary; if PT-PT has a common alternative word, that alternative is
  // the gloss instead and no entry exists.
  // da:kok — "chef" is the everyday PT-PT word for a professional cook (o chef
  //   de cozinha); "cozinheiro" listed first for the everyday sense.
  'glosses.da:kok.chef',
  // da:skærm — "monitor" is standard PT-PT too; entry already listed above
  //   (Poland shares it), so no duplicate here.
  // da:biograf — "cinema" is the PT-PT word (o cinema); Danish "biograf" differs.
  'glosses.da:biograf.cinema',
  // da:kanal — "canal" is identical in Danish, English and Portuguese.
  'glosses.da:kanal.canal',
  // da:app — "app" is the everyday PT-PT loan beside "aplicação".
  'glosses.da:app.app',
  // da:interesse — "interesse" is identical in Danish and Portuguese
  //   (the Polish "hobby" sense at the same id is a separate entry above).
  'glosses.da:interesse.interesse',

  // ── Phase 3 French glosses (band 1, ranks 1-300, 2026-09-14) ───────────────
  //
  // The validator (glosses.test.ts) refuses a gloss identical to the English
  // gloss and identical to the Danish headword. For these ids the everyday
  // French word genuinely IS that word (true cognates: lampe, bus, restaurant,
  // station...), so the by-path allowlist — never a weaker word — is the right
  // fix, exactly as the catalogue entries above reason. Paths are by id.
  'glosses.da:bord',
  'glosses.da:tog',
  'glosses.da:bus',
  'glosses.da:spørgsmål',
  'glosses.da:lang',
  'glosses.da:billet',
  'glosses.da:natur',
  'glosses.da:dyr',
  'glosses.da:rigtig',
  'glosses.da:vigtig',
  'glosses.da:international',
  'glosses.da:side',
  'glosses.da:sikker',
  'glosses.da:restaurant',
  'glosses.da:national',
  'glosses.da:sted',
  'glosses.da:sofa',
  'glosses.da:luft',
  'glosses.da:mulig',
  'glosses.da:station',
  'glosses.da:maskine',
  'glosses.da:grund',
  'glosses.da:stemme',
  'glosses.da:billede',
  'glosses.da:offentlig',
  'glosses.da:plan',
  'glosses.da:kamp',
  'glosses.da:lampe',
  // "lokal" (adj, band 2/3): everyday French is the same word —
  // "local" (commerces locaux). True cognate, band-1 allowlist pattern.
    'glosses.da:lokal',
  'glosses.da:moderne',
  'glosses.da:normal',
  'glosses.da:vin',
  'glosses.da:brun',
  'glosses.da:internet',
  'glosses.da:pizza',
  'glosses.da:pasta',
  'glosses.da:radio',
  'glosses.da:orange',
  'glosses.da:citron',
  'glosses.da:bagage',
  'glosses.da:ambulance',
  'glosses.da:film',
  'glosses.da:plante',
  'glosses.da:pause',
  'glosses.da:adresse',
  'glosses.da:plads',
  'glosses.da:sag',
  'glosses.da:umulig',
  'glosses.da:politi',
  'glosses.da:nem',
  'glosses.da:minut',
  'glosses.da:forening',
  'glosses.da:besked',
  'glosses.da:frugt',
  'glosses.da:program',
  'glosses.da:kunde',
  'glosses.da:klub',
  'glosses.da:koncert',
  'glosses.da:tilfreds',
  'glosses.da:kok',
  'glosses.da:øjeblik',
  'glosses.da:muskel',
  'glosses.da:sodavand',
  'glosses.da:film',
  'glosses.da:appelsin',
  'glosses.da:fængsel',
  'glosses.da:journalist',
  'glosses.da:blad',
  'glosses.da:lov',
  'glosses.da:mening',
  'glosses.da:kanal',
  'glosses.da:enkel',
  'glosses.da:overraskelse',
  'glosses.da:streng',
  'glosses.da:bluse',
  'glosses.da:app',
  'glosses.da:ulykke',
  'glosses.da:kultur',
  'glosses.da:tålmodig',
  'glosses.da:fodbold',
  // ── sv glosses, added 2026-09-14 by P3-CONTENT-sv (t_57cfc7ec) ───────────
  // Danish–Swedish cognates that ARE the same word. A Swedish gloss
  // equal to the Danish headword is correct Swedish, not untranslated
  // text: the two languages share these forms (barn, hund, hus…). The
  // headword rule in glosses.test.ts consults this set for the same
  // reason the English rule does. Each entry is one word id, verified
  // individually; the gate still rejects any OTHER value at that id.
  //
  // Headword-equal (shared spelling — genuinely identical words):
  'glosses.da:barn',
  'glosses.da:hund',
  'glosses.da:hus',
  'glosses.da:bord',
  'glosses.da:kaffe',
  'glosses.da:stol',
  'glosses.da:ost',
  'glosses.da:fisk',
  'glosses.da:sol',
  'glosses.da:bil',
  'glosses.da:ben',
  'glosses.da:arm',
  'glosses.da:finger',
  'glosses.da:tand',
  'glosses.da:hår',
  'glosses.da:dag',
  'glosses.da:stor',
  'glosses.da:ung',
  'glosses.da:glad',
  'glosses.da:salt',
  'glosses.da:himmel',
  'glosses.da:regn',
  'glosses.da:måne',
  'glosses.da:hav',
  'glosses.da:strand',
  'glosses.da:park',
  'glosses.da:bank',
  'glosses.da:cykel',
  'glosses.da:år',
  'glosses.da:få',
  'glosses.da:dansk',
  'glosses.da:gå',
  'glosses.da:ny',
  'glosses.da:te',
  'glosses.da:hel',
  'glosses.da:elev',
  'glosses.da:pris',
  'glosses.da:stå',
  'glosses.da:natur',
  'glosses.da:blå',
  'glosses.da:tro',
  'glosses.da:kontor',
  'glosses.da:land',
  'glosses.da:liv',
  'glosses.da:ord',
  'glosses.da:kort',
  'glosses.da:vind',
  'glosses.da:chef',
  'glosses.da:telefon',
  'glosses.da:bo',
  'glosses.da:luft',
  'glosses.da:tid',
  'glosses.da:station',
  'glosses.da:kollega',
  'glosses.da:person',
  'glosses.da:universitet',
  'glosses.da:offentlig',
  'glosses.da:plan',
  'glosses.da:nummer',
  'glosses.da:sur',
  'glosses.da:engelsk',
  'glosses.da:glas',
  'glosses.da:politisk',
  'glosses.da:fest',
  'glosses.da:museum',
  'glosses.da:privat',
  'glosses.da:gul',
  'glosses.da:sent',
  // English-equal cognates (Swedish borrowed the same form):
  'glosses.da:hånd',
  'glosses.da:mand',
  'glosses.da:søn',
  'glosses.da:kæreste',
  'glosses.da:frokost',
  'glosses.da:almindelig',
  'glosses.da:kamp',
  // more headword-equal shared words (band 2+):
  'glosses.da:jord',
  'glosses.da:lokal',
  'glosses.da:slå',
  'glosses.da:amerikansk',
  'glosses.da:storm',
  'glosses.da:stolt',
  'glosses.da:normal',
  'glosses.da:svar',
  'glosses.da:handske',
  'glosses.da:tanke',
  'glosses.da:vin',
  'glosses.da:tysk',
  'glosses.da:minut',
  'glosses.da:feber',
  'glosses.da:blod',
  'glosses.da:varm',
  'glosses.da:vinter',
  'glosses.da:temperatur',
  'glosses.da:fred',
  'glosses.da:grå',
  'glosses.da:idé',
  'glosses.da:krig',
  'glosses.da:hals',
  'glosses.da:bibliotek',
  'glosses.da:billig',
  'glosses.da:fabrik',
  'glosses.da:gratis',
  'glosses.da:svensk',
  'glosses.da:sorg',
  'glosses.da:norsk',
  'glosses.da:fransk',
  'glosses.da:bro',
  'glosses.da:bageri',
  'glosses.da:spansk',
  'glosses.da:italiensk',
  'glosses.da:kinesisk',
  'glosses.da:kniv',
  'glosses.da:gaffel',
  'glosses.da:medicin',
  'glosses.da:middag',
  'glosses.da:tur',
  'glosses.da:grad',
  'glosses.da:brun',
  'glosses.da:internet',
  'glosses.da:program',
  'glosses.da:måltid',
  'glosses.da:pizza',
  'glosses.da:perfekt',
  'glosses.da:tomat',
  'glosses.da:banan',
  'glosses.da:politiker',
  'glosses.da:pasta',
  'glosses.da:radio',
  'glosses.da:recept',
  'glosses.da:brev',
  'glosses.da:sten',
  'glosses.da:sen',
  'glosses.da:tung',
  'glosses.da:ko',
  'glosses.da:gris',
  // more English-equal cognates (band 2+):
  'glosses.da:moderne',
  'glosses.da:gave',
  'glosses.da:fjernsyn',
  'glosses.da:tekst',
  // more headword-equal shared words (band 3):
  'glosses.da:får',
  'glosses.da:orange',
  'glosses.da:apotek',
  'glosses.da:bred',
  'glosses.da:citron',
  'glosses.da:gift',
  'glosses.da:muskel',
  'glosses.da:rund',
  'glosses.da:biograf',
  'glosses.da:hård',
  'glosses.da:ren',
  'glosses.da:smal',
  'glosses.da:kamera',
  'glosses.da:bagage',
  'glosses.da:flod',
  'glosses.da:tom',
  'glosses.da:gardin',
  'glosses.da:mus',
  'glosses.da:halv',
  'glosses.da:sko',
  'glosses.da:farlig',
  'glosses.da:tå',
  'glosses.da:film',
  'glosses.da:dum',
  'glosses.da:lastbil',
  'glosses.da:batteri',
  'glosses.da:modig',
  'glosses.da:sår',
  'glosses.da:kind',
  'glosses.da:paraply',
  'glosses.da:svag',
  'glosses.da:musik',
  'glosses.da:fattig',
  'glosses.da:turist',
  'glosses.da:kanal',
  'glosses.da:enkel',
  'glosses.da:praktisk',
  'glosses.da:skam',
  'glosses.da:mild',
  'glosses.da:teater',
  'glosses.da:app',
  'glosses.da:kalender',
  'glosses.da:ring',
  'glosses.da:kultur',
  'glosses.da:tålmodig',
  'glosses.da:regering',
  'glosses.da:fritid',
  // more English-equal cognates (band 3):
  'glosses.da:fuld',
  'glosses.da:stille',
  'glosses.da:klog',
  'glosses.da:journalist',
  'glosses.da:interesse',
  // more headword-equal shared words (post-spot-check fixes, each
  // verified identical Swedish by the GLM 5.3-flash review):
  'glosses.da:hud',
  'glosses.da:vild',
  'glosses.da:bad',
  'glosses.da:blad',
  'glosses.da:motion',
  'glosses.da:nyttig',
  'glosses.da:bror',
  'glosses.da:se',
  'glosses.da:fin',
  'glosses.da:fast',
  // ── Sightseeing, the running game (2026-10-04) ───────────────────────────
  // A word and its meaning joined by "=" ("house = hus"): there are no words
  // in it to translate, only the two the run passes in.
  'sightseeing.pair',
  // "Photos" is the French word too (les photos), the label over the count.
  'sightseeing.photosLabel',
  // "Articles" is the French word too (les articles), the name of the walk that asks them.
  'sightseeing.articlesWalk',
  // "Café" is the word in German, Spanish, French, Dutch and Portuguese too,
  // written on the café on the road when it has no name of its own.
  'sightseeing.cafeSign',
  // ── The suitcase's marks and stamp card (CW-11, 2026-10-04) ──────────────
  // "photo" is the French word too (une photo), one of a word's three marks.
  'home.markPhoto',
  // A café with no name yet, read out as "Café 12": "Café" is the word in
  // German, Spanish, French, Dutch and Portuguese as well.
  'home.stampCafeNumber',
  // A café's name and its stamp joined by the language's colon ("Café Solen:
  // Gold stamp"): both halves are passed in already translated.
  'home.stampCellStamped',
])

