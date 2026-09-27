# City 1 ordinary-roster extension — author editorial handoff

Status: **editorial, unaccepted**. Version 1, 2026-09-10. This is the author's self-check and coverage record. It is not an independent model review, native-human signoff, Sol stamp, or acceptance artifact. All 152 sentence rows have `status:"editorial"` and `approval:null`. Parent independent model editorial review must precede any production import.

## Scope and source provenance

The actual 150-board ordinary City 1 cycle uses the 100 IDs in `src/data/city1-replacement-corpus.da.json`. The frozen accepted rank-100 inventory shares 24 of those IDs: the union is 176 and the exact missing difference is 76, including `da:film`. `scope.json` pins both source files, the cycle's upstream source identity and every board's ordered IDs, the accepted inventory and contract, the current dictionary, effective support stages, and all five immutable accepted files. Each missing word records its actual dictionary senses, POS, rank, old bilingual source pair, source hash and authored board memberships. File SHA-256 values refer to exact UTF-8 bytes; per-word hashes use the original `JSON.stringify([id,curriculumRank,exampleDa,exampleEn])` algorithm.

Sentence envelopes retain contract base `21cd5ac2f9c2eaa24ca34674f6b9a580d77a8a82`; this identifies schema/source lineage, not this checkout's HEAD. `scope.workspaceBase` explicitly records verified HEAD `db2020d8eb937df104fae867c876f1b1cbd5c511`, with source version `city1-ordinary-roster-extension-v1`. The pre-existing dirty backup is `/tmp/city1-before-roster-extension.tar.gz`.

No roster, curriculum rank, board order, progress, later-city membership or saved version changes were made. The rank-100 bank remains needed for wrap-up and seeded play. The original 100-row contract is unchanged and deliberately rejects these 76 rows. The local validator's injected inventory is a **staging structural check only**, not a production or acceptance adapter. A parent-reviewed successor adapter is the next integration task; it must retain accepted old versions and the distinct ordinary-board versus rank-bank scopes.

## Author self-check: language and learning design

Board examples are ordinary headword-focused statements, all 3–7 whitespace-delimited words. Review pairs differ in both Danish and English from their board pair and focus only existing effective City 1 targets. Almost all reviews are 3–7 words; `Prøv igen.` is a natural two-word retry instruction. No sentence uses a quoted mini-story or a disconnected clause to manufacture coverage. `Du snakker hurtigt. Lidt langsommere, tak.` and `Jeg forstår ikke. Hvad betyder ordet?` are connected observations/repair requests addressing one immediate problem.

Checks use actual dictionary senses: `gang` is time/occasion; `dyr` is an animal; `møde` is a meeting; `rejse` is a trip; `lyst` is inclination; `hjem` is a noun, not `hjemme`. Common/neuter agreement and inflected forms are explicit in the table below. Later-ranked headwords do not introduce their later-city teaching stages: there are no later-stage primary focuses, tense lessons, subordinate-word-order exercises or productive plural tasks. Present forms, adjective agreement and fixed imperatives are example language, not asserted mastered rules. The selected inflections and naturalness still require independent editorial judgment; surface matching cannot certify them.

The one incidental `kan` is inside the existing repetition request, never free productive modal practice. A regression checks that preview focus `ledger:kan` is legal only in an existing eligible fixed chunk. Receptive `skål`, `om`, `hen`, and `øh` never become review focuses. `i` in the world-location question is a locative preposition, not plural-you `I`.

Author corrections before freeze: replaced an initial perfect-tense month example with simple `Juni er en måned.`; removed an awkward degree-of-desire question; removed an unnecessary two-part certainty reply and name clarification; replaced a non-listed modal example request with `Vis eksemplet igen, tak.`. The first structural run caught collisions with the linked About examples for `sige`, `komme`, and `bo`, and a span selecting `et` inside `det`. These were repaired by a natural apology prefix, a different country, a friend-location question, and whole-word span selection. The 39 accepted general About entries remain referenced unchanged; no new About prose was authored.

## Coverage and limits

The extension has 26 distinct primary focuses; accepted-plus-extension staging has 33 of the effective 35. The combined gaps are `ledger:kan` and `supplemental:da-chunk-immediate-help`. `kan` does occur incidentally in the exact repeat request; incidental presence is not a primary focus. Immediate-help remains an explicit gap. Four receptive About entries remain ineligible, as intended. Extension-only gaps are listed below; the accepted bank supplies several of them. No artificial target quotas were applied.

`ledger:goddag`, `ledger:godmorgen`, `ledger:godnat`, `ledger:hallo`, `ledger:farvel`, `ledger:undskyld`, `ledger:kan`, `supplemental:da-chunk-immediate-help`, `supplemental:da-word-thing`.

`validation.json` contains the complete 39-target extension and combined matrices, every focused word ID, incidental surface occurrences, effective stages, linked About availability and mapped existing curriculum sources. Its `rowFindings` reports every word's selected forms, focus/stage, incidental target forms and About distinctness. Surface matches can be ambiguous and are not grammatical or learning assessments. No board/review reading, listening or About access is credited as retrieval, comprehension or mastery.

The previously reported 22 whole-route curriculum-floor failures remain unresolved evidence from the integration task. This slice does not rerun or alter those production floors, replace later-ranked words in the production corpus, or certify that a prospective import meets them. Any eventual replacement can also remove support forms from existing later-ranked examples; the successor adapter/import needs its own current-corpus coverage checks. Extra review repair exposure here is not a substitute for those checks.

## Actual validation

Node v26.5.1, no installs or network:

- `node prototypes/finish-review/implementation/roster-extension/validate.mjs --report`: **passed**, zero errors; 76 board + 76 review, 39 unchanged reused About entries; combined staging 176 + 176; 704 unique sentence/audio identities across both banks (304 new).
- `node prototypes/finish-review/implementation/roster-extension/validate.test.mjs`: **21 passed, 0 failed**. Mutation tests cover missing film, duplicate/foreign IDs, source drift, self-acceptance, blank English, UTF-16/boundary spans, receptive/later-stage focuses, About collisions, distinct board/review text and identities, fixed-chunk preview policy and provenance drift.
- `node prototypes/finish-review/implementation/validate.test.mjs`: **46 passed, 0 failed**; original contract/queue tests unchanged.
- `node prototypes/finish-review/implementation/validate.mjs --acceptance`: **passed**, original 100 board + 100 review + 39 About only.
- Passing the extension to the unchanged original acceptance helper yields **460 expected errors**, including unknown word IDs, missing original IDs, required 100-row counts and absent acceptance. This is the preserved integration boundary, not an extension acceptance failure to relax.

Logs are `tests.log`, `original-tests.log`, and `original-acceptance.log`; machine-readable results are `validation.json`. No app tests, build, browser, audio bake, production import, paid call, commit, push or deployment are claimed. Rebuild draft JSON with `node prototypes/finish-review/implementation/roster-extension/build.mjs` only while these drafts remain unaccepted; this v1 authoring helper is not a future approved-version migration tool.

## Row-level author findings

Each entry covers both bilingual pairs; the highlighted forms and primary review target are explicit. All findings are author self-checks pending independent educator/native-language model review, with no human certification inferred. The parallel TSV retains the full manually authored texts and notes for reproducibility.

| Word ID | Board form → review form | Review focus / stage | Author sense, grammar and coverage finding |
|---|---|---|---|
| `da:se` | ser → ser | `ledger:hvad` / productive-target (city 0) | Present ser; hvad asks for the object seen. |
| `da:tro` | tror → tror | `ledger:ja` / productive-target (city 0) | Believing a person, not religious belief; ja confirms trust. |
| `da:sige` | siger → sige | `supplemental:da-chunk-repeat` / productive-target (city 0) | Exact existing repair request; no general modal lesson. |
| `da:vide` | ved → ved | `ledger:nej` / productive-target (city 0) | Irregular ved; nej answers a knowledge question. |
| `da:komme` | kommer → kommer | `supplemental:da-chunk-origin` / productive-target (city 0) | Existing personal-origin chunk; no new tense target. |
| `da:synes` | synes → synes | `ledger:hvad` / productive-target (city 0) | Opinion sense; short same-opinion statement without an embedded clause. |
| `da:gå` | går → går | `ledger:hvem` / productive-target (city 0) | Walking sense; hvem asks for a person. |
| `da:god` | god → god | `ledger:ja` / productive-target (city 0) | Common-gender predicate god; affirmative reply. |
| `da:rigtig` | rigtigt → rigtigt | `ledger:det` / productive-target (city 0) | Correct sense; neuter rigtigt and referential det. |
| `da:tage` | tager → tager | `ledger:okay` / productive-target (city 0) | Transport choice; okay signals agreement, present for immediate plan. |
| `da:tænke` | tænker → tænker | `ledger:lidt` / productive-target (city 0) | Think sense, lidt limits amount of thinking. |
| `da:få` | får → får | `ledger:hvem` / productive-target (city 0) | Receive sense, not causative få. |
| `da:gang` | gang → gang | `ledger:tak` / productive-target (city 0) | Occasion sense, never corridor; natural short repetition request. |
| `da:nå` | når → når | `ledger:ja` / productive-target (city 0) | Catch transport sense; present expresses imminent outcome. |
| `da:lave` | laver → laver | `ledger:hvad` / productive-target (city 0) | Do/make sense; conventional activity question. |
| `da:prøve` | prøver → Prøv | `ledger:igen` / productive-target (city 0) | Trying clothing on versus another attempt; short natural retry instruction. |
| `da:sjov` | sjov → sjov | `ledger:en` / productive-target (city 0) | Adjective funny, not noun fun; en introduces common-gender historie. |
| `da:hedde` | hedder → hedder | `supplemental:da-chunk-name` / productive-target (city 0) | Existing self-introduction chunk with a distinct name. |
| `da:sidde` | sidder → Sidder | `ledger:her` / productive-target (city 0) | Her denotes current location; sit not lie. |
| `da:huske` | husker → husker | `ledger:hvem` / productive-target (city 0) | Remember sense; address is incidental supporting vocabulary. |
| `da:tid` | tid → tid | `ledger:lidt` / productive-target (city 0) | Uncountable time; idiomatic god tid versus small amount. |
| `da:hel` | helt → hel | `supplemental:da-chunk-existence` / productive-target (city 0) | Whole not very; helt agrees with æble, hel with kage. |
| `da:bo` | bor → bor | `ledger:hvor` / productive-target (city 0) | Reside sense; simple location question. |
| `da:sted` | sted → sted | `ledger:et` / productive-target (city 0) | Neuter noun place; natural question seeking a quiet spot. |
| `da:stå` | står → står | `ledger:der` / productive-target (city 0) | Locative there, not existential der; standing person. |
| `da:finde` | finder → Finder | `ledger:igen` / productive-target (city 0) | Find again; den refers to a previously mentioned common-gender object. |
| `da:snakke` | snakker → snakker | `supplemental:da-chunk-slower` / productive-target (city 0) | Talk sense; speed observation motivates exact existing slower-speech request, no comparative grammar instruction. |
| `da:høre` | hører → hører | `ledger:hvad` / productive-target (city 0) | Hear, not obey; immediate sound question. |
| `da:bruge` | bruger → bruger | `ledger:hvem` / productive-target (city 0) | Use sense; den refers to a common-gender object, no possessive lesson. |
| `da:år` | år → år | `ledger:et` / productive-target (city 0) | Neuter year; singular noun phrases in both examples. |
| `da:ligge` | ligger → ligger | `ledger:hvor` / productive-target (city 0) | Static location; Danish ligger is naturally English is in location question. |
| `da:måde` | måde → måde | `ledger:den` / productive-target (city 0) | Way/manner sense, not road; den points to a demonstrated method. |
| `da:svær` | svær → svært | `ledger:lidt` / productive-target (city 0) | Neuter predicate svært after det; lidt softens degree. |
| `da:forskellig` | forskellige → forskellige | `ledger:ja` / productive-target (city 0) | Plural adjective required for comparison of objects; fixed form, no plural grammar focus. |
| `da:fin` | fin → fine | `ledger:tak` / productive-target (city 0) | Nice/lovely sense; fine is definite attributive form, thanks anchored to a gift. |
| `da:side` | side → siden | `supplemental:da-chunk-where` / productive-target (city 0) | Page sense both rows; definite siden in existing location chunk. |
| `da:lang` | lang → lang | `supplemental:da-chunk-existence` / productive-target (city 0) | Length sense; common-gender lang, natural availability/observation question. |
| `da:spændende` | spændende → spændende | `ledger:en` / productive-target (city 0) | Exciting sense; article introduces common-gender film. |
| `da:ny` | ny → nyt | `ledger:det` / productive-target (city 0) | New sense; nyt agrees with neuter hus, referential det. |
| `da:dårlig` | dårlig → dårlig | `ledger:nej` / productive-target (city 0) | Spoiled milk and poor coffee; both dictionary bad sense, no health claim. |
| `da:sidste` | sidste → sidste | `ledger:den` / productive-target (city 0) | Final sense; definite bus phrase kept as a whole example. |
| `da:eksempel` | eksempel → eksemplet | `ledger:igen` / productive-target (city 0) | Natural request to see an example again; imperative is a fixed instruction, focus is igen. |
| `da:dansk` | dansk → dansk | `supplemental:da-chunk-meaning` / productive-target (city 0) | Board uses dictionary adjective sense; review asks about the word without a quoted story. |
| `da:vej` | Vejen → vejen | `supplemental:da-chunk-where` / productive-target (city 0) | Road sense; existing location chunk, not route-instruction grammar. |
| `da:halv` | halv → halv | `ledger:der` / productive-target (city 0) | Half an object; existential der, tilbage incidental. |
| `da:mulig` | mulig → muligt | `ledger:ja` / productive-target (city 0) | Possible sense; neuter muligt with det, no infinitive complement. |
| `da:menneske` | menneske → menneske | `ledger:et` / productive-target (city 0) | Human/person sense, neuter article; no claim about gender from meaning. |
| `da:hjem` | hjem → hjem | `ledger:velkommen` / productive-target (city 0) | Noun home, not adverb hjemme; greeting fits a host welcoming a guest. |
| `da:time` | time → time | `supplemental:da-chunk-existence` / productive-target (city 0) | Hour sense, not school lesson; time availability. |
| `da:sikker` | sikker → sikker | `ledger:nej` / productive-target (city 0) | Safe and sure are both source senses; nej answers a certainty question. |
| `da:billede` | Billedet → billedet | `ledger:hvad` / productive-target (city 0) | Picture sense; Danish på corresponds to English in for image content. |
| `da:klar` | klar → klar | `ledger:ja` / productive-target (city 0) | Ready sense; affirmative response to readiness question. |
| `da:ord` | ord → ordet | `supplemental:da-chunk-dont-understand` / productive-target (city 0) | Exact non-understanding chunk followed by its connected word-meaning question; singular definite ordet. |
| `da:sprog` | sprog → sproget | `ledger:hvad` / productive-target (city 0) | Neuter sprog and definite sproget; name question. |
| `da:mening` | mening → mening | `ledger:hvad` / productive-target (city 0) | Opinion sense in both rows, not purpose; question targets hvad. |
| `da:grund` | grund → grunden | `ledger:hvad` / productive-target (city 0) | Reason sense; no causal clause or later-city linker. |
| `da:klokke` | Klokken → klokke | `supplemental:da-chunk-existence` / productive-target (city 0) | Bell sense, not time-telling; bell in an entrance or reception. |
| `da:person` | person → person | `ledger:hvem` / productive-target (city 0) | Person identification; den is demonstrative incidental to hvem. |
| `da:land` | land → landet | `ledger:hvad` / productive-target (city 0) | Country sense, definite landet; no nationality morphology lesson. |
| `da:verden` | Verden → verden | `ledger:i` / productive-target (city 0) | Locative preposition i, not plural-you pronoun I; one location question. |
| `da:historie` | historie → historien | `ledger:igen` / productive-target (city 0) | Story sense; natural repeat request, no invented narrative frame. |
| `da:møde` | Mødet → mødet | `supplemental:da-chunk-where` / productive-target (city 0) | Noun meeting with definite mødet, not verb meet. |
| `da:måned` | måned → måneden | `ledger:hvad` / productive-target (city 0) | Month name question; simple present board, no perfect tense. |
| `da:lov` | Loven → loven | `supplemental:da-chunk-meaning` / productive-target (city 0) | Law sense, not an instruction or legal guidance; existing meaning question. |
| `da:tanke` | tanke → tanke | `ledger:en` / productive-target (city 0) | Thought/idea sense; common-gender indefinite noun phrase. |
| `da:kæreste` | kæreste → kæreste | `ledger:hej` / productive-target (city 0) | Romantic partner sense without assigning gender; greeting connected to asking for someone. |
| `da:tvivl` | tvivl → tvivl | `ledger:igen` / productive-target (city 0) | Uncountable doubt; igen marks recurring uncertainty, not an assessed repair task. |
| `da:dyr` | Dyret → dyret | `supplemental:da-chunk-where` / productive-target (city 0) | Neuter noun animal, never adjective expensive. |
| `da:krone` | krone → krone | `ledger:her` / productive-target (city 0) | Currency sense, not royal crown; deictic her in a handover. |
| `da:lyst` | lyst → lyst | `ledger:nej` / productive-target (city 0) | Uncountable inclination; conventional polite refusal, not the adjective light. |
| `da:klasse` | Klassen → klassen | `ledger:velkommen` / productive-target (city 0) | School class sense; connected welcome for a new member. |
| `da:liv` | liv → liv | `supplemental:da-chunk-existence` / productive-target (city 0) | Life/activity sense; existential chunk, not existential philosophy instruction. |
| `da:film` | film → filmen | `ledger:hvad` / productive-target (city 0) | Film/movie sense; definite filmen; required missing ID explicitly present. |
| `da:rejse` | Rejsen → rejse | `ledger:tak` / productive-target (city 0) | Noun trip, not verb travel; thanks at the end of a shared journey. |
| `da:musik` | musik → musikken | `ledger:hvor` / productive-target (city 0) | Uncountable music; source/location question with definite musikken. |
| `da:navn` | navn → navn | `ledger:igen` / productive-target (city 0) | Natural short request to repeat a name; no added clause to obtain a preview-kan focus. |

## Review handoff

Independent L2 educator findings: **pending**. Independent Danish-language editor findings: **pending**. Native-human and audio review: **not performed**. Parent should assess all 152 bilingual rows, inflections/senses, naturalness, City 1 difficulty, target uses, repair context and distinctions from About. The next authorized integration slice needs a successor adapter for the union of ordinary roster and retained rank bank, plus saved-version and production-coverage validation. This authoring slice grants no production acceptance.
