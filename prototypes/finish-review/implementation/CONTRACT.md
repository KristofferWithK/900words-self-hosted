# City 1 sentence contract v1

Status: staging prerequisite, 2026-09-10. Base: `21cd5ac2f9c2eaa24ca34674f6b9a580d77a8a82` (verified HEAD). Rocky orchestrates and reviews. This task owns only this directory; no corpus/UI edits, historical stamp changes, paid calls, audio generation, deployment, credentials, commits, pushes or other worktrees.

The eight `../sample-pairs.json` pairs are the accepted **style baseline**, not an accepted 100-pair curriculum. Current owner instructions supersede `../APPROVAL.md` for UI behavior below. Empty authoring files are deliberate handoff slots, not rewritten content.

## Files and ownership

All paths below are relative to `prototypes/finish-review/implementation/`.

| Owner | Exact files | Interface |
|---|---|---|
| Contract owner | `CONTRACT.md`, `schema.json`, `inventory.mjs`, `inventory.json`, `validate.mjs`, `validate.test.mjs`, `runtime-contract.mjs` | Frozen shared shape, actual source inventory, validator and executable reference tests |
| Board writer | `board-sentences.json`; later `board-editorial.md` | Exactly one new board example pair per inventory word; independently authored successor evidence |
| Review writer | `review-sentences.json`, `about-targets.json`; later `review-editorial.md` | Exactly one distinct review pair per word, one focus per review; shared general About records |
| Integration owner | Shared app/data files and existing validators, including `gameStore`, `RoundSummary`, `speak` | Sole owner of app wiring and eventual bank replacement; no writer edits these |

Writers may read each other's files for cross-validation but edit only their own. Contract-owned targets live in `inventory.json.targets`; About prose lives separately so review authors never edit the target catalogue. Raw bank replacements remain staging until the integration owner accepts and ports them.

## Inventory and authoring shape

`inventory.mjs` reads only named repository sources. It evaluates the actual `curriculum-support.ts` exports using Node's `stripTypeScriptTypes`, then takes the last stage with `city <= 0`. It verifies ledger classification against all unique `function-words.da.json` terms. It does not infer productive eligibility from runtime `supportItems`, base `firstCity`, or final coverage floors.

Computed inventory: **100 unique word IDs at curriculum ranks 1–100; 39 support entries, 35 review-eligible**:

| Kind | Productive | Preview | Receptive |
|---|---:|---:|---:|
| Ledger | 24 | 1 (`kan`) | 3 (`skål`, `om`, `hen`) |
| Supplemental chunks | 9 | 0 | 0 |
| Supplemental words | 1 (`ting`, `tingen` together) | 0 | 1 (`øh`) |

`at` is not eligible in City 1. `kan` is not productive modal grammar: a review focusing it must instantiate an existing eligible fixed chunk containing it. Receptive entries remain available for general About and incidental presence, never primary review focuses. Both `ting` and `tingen` retain the one existing ID `supplemental:da-word-thing`. Stage city indices are zero-based; City 1 is `0`.

`schema.json` is JSON Schema 2020-12 for the three authoring envelopes. `validate.mjs` enforces the structural shape directly without installing a schema engine and adds the semantic checks described here. No omitted or extra row fields. All documents have `{version:1, base, language:"da", city:0, kind, rows:[]}`; `kind` is `board`, `review`, or `about`.

Sentence rows have `wordId`, `city:0`, `sourceSha256` (copy the word inventory value), positive integer `version`, `sentenceId`, `audioId`, `text:{da,en}`, `wordSpan:{text,start,end}`, `status`, and `approval`. Review rows additionally have `targetId`, `targetStage:{city,use}` copied from the inventory, and `targetSpan:{text,start,end}`. IDs are exactly:

```text
city1:<wordId>:board:sentence:v<version>
city1:<wordId>:board:audio:v<version>
city1:<wordId>:review:sentence:v<version>
city1:<wordId>:review:audio:v<version>
```

For example, `<wordId>` is the full `da:hund`, not `hund`. These are logical version identities, not existing MP3 filenames. Bump the sentence version for changed text, translation, highlighting or focus; bump both associated identities together. Never reuse a board identity for review. Board and review Danish must differ.

All text is exact authored text, trimmed and nonblank in **both languages**. Spans use JavaScript UTF-16 offsets, start inclusive/end exclusive, and exact case: `da.slice(start,end) === span.text`. Mark the actual inflected card form (e.g. `Hunden`), not an inferred lemma location. Spans must end on word boundaries. Review target spans must instantiate a listed ledger/supplemental form; `…` denotes a nonempty phrase slot, not literal ellipsis. Include phrase punctuation in the span when the listed form requires it. Case-insensitive surface matching is not morphology analysis.

About rows have `targetId`, `targetStage`, positive integer `version`, `meaningEn`, `usageEn`, `example:{da,en}`, `targetSpan`, `status`, `approval`. Author all 39 entries, including receptive/preview records. Meaning and use explain the word/chunk **generally**, independent of a particular card. Supply one short bilingual alternative example at City 1 level; it must instantiate the target and differ from every linked review sentence. For ambiguous `i/I`, distinguish the relevant uses editorially; a surface match cannot determine the grammatical sense.

`status` is `draft`, `editorial` (ready for review), or `accepted`. Draft/editorial rows have `approval:null`. Accepted rows have `approval:{artifact,sha256}` referencing the owning successor file from the table. `sha256` hashes the exact UTF-8 evidence file. That file must contain a line `<wordId-or-targetId> <editorialFingerprint(row)>` for each accepted row. Import the exported `editorialFingerprint` helper from `validate.mjs`: it hashes canonical sorted JSON excluding `approval`, so editing accepted content invalidates the evidence link. Include separate board, review and About row fingerprints, even when IDs overlap.

Successor evidence must identify the final content and separately report L2 educator and native-editor findings, resolutions and remaining blockers. Rocky reviews the successor evidence. A hash/filename check does not certify its substantive verdict. Old completed Sol fingerprints or reports cannot be relabelled fresh approval; historical stamps remain unchanged. Do not mark new prose accepted merely because the samples were accepted for style.

## Checks and coverage

From the repository root, Node **22.13+** with `node:module.stripTypeScriptTypes` is required; no installs or network:

```sh
node prototypes/finish-review/implementation/inventory.mjs
node prototypes/finish-review/implementation/validate.test.mjs
node prototypes/finish-review/implementation/validate.mjs --draft
node prototypes/finish-review/implementation/validate.mjs --draft --report
node prototypes/finish-review/implementation/validate.mjs --acceptance
```

Only the contract owner regenerates the inventory after reviewing source drift. Validation recomputes it and rejects a stale snapshot. Per-word `sourceSha256` hashes JSON `[id,curriculumRank,exampleDa,exampleEn]`; full source hashes additionally pin the catalogue and mapped teaching sources.

Draft mode allows absent records, reports every missing ID, and rejects malformed supplied rows. Acceptance requires exactly 100 unique eligible word rows in **each** sentence set, all 39 About rows, valid target/stage/span/source links, distinct identities and successor editorial evidence. Board rows need no primary support focus; review rows require one of the 35 eligible entries. Coverage gaps are reported, not converted into unapproved City 1 quotas.

`--report` emits the machine-readable coverage matrix: board/review presence with editorial status, primary review focus and effective mode, About presence, other accepted source references and gaps. Other sources are mapped from City 1 Grammar/Survival/due-review/exit activities (visual, model-answer and audio-script fields) and Guide lesson Danish example pairs. Each source includes path, item ID, field, activity mode and role. These are **surface-presence** references within existing accepted source material, not certification that the matched term is that activity's assessed target. The map is explicitly limited to these fields; no claim of exhaustive teaching coverage. Existing card sentences being replaced are not counted as retained sources. Final route floors are not City 1 sentence quotas; token counts do not establish teaching, retrieval or mastery.

## UI and state integration boundary

`runtime-contract.mjs` is a pure executable reference, not imported by the app. Explicit signatures:

```js
selectQueue(clueHistory, reviewRows, usedTargetIds = []) // -> QueuePin[]
restoreQueue(saved, roundId, acceptedRows, clueHistory) // -> QueueState
```

`reviewRows` and `acceptedRows` must already be validated accepted City 1 review records. `clueHistory` is the trustworthy engine history for `roundId`, supplied independently of the saved queue. `usedTargetIds` seeds the set of previously used focuses. `selectQueue` iterates history by its original zero-based index, selecting **exactly one** row per qualifying **player clue** (`by === 'player'`). These are Casey's guesses against the player's key, as recorded by `gameStore.ts` in `submitPlayerClue` and explained in `finishRound`. AI-given clues are ignored. Only this clue's own `guesses` with `result === 'green'` joined by `wordId` to validated rows are candidates. Within that clue's deterministic guess order, choose the first unused target if available, otherwise the first candidate; then mark the selected target used. Omit clues with no eligible correct guess. Never globally reorder clue chronology, deduplicate words across clues, or borrow candidates from other clues, `targets`, reveals or unlinked sudden-death outcomes. Distinct clues may repeat a target or word. An empty queue omits the sentence section.

Each `QueuePin` contains exactly `{clueHistoryIndex,clueText,clueNumber,wordId,targetId,sentenceId,audioId,version}`. Pin the actual source clue text and number, not reconstructed values. A qualifying source clue has trimmed nonblank string `text`, integer `number` from **1 through 4** (the engine's range), and a `guesses` array. Invalid source clues are omitted. The engine already checks board/language clue legality; this reference validates the persisted types/range and does not rerun that board-dependent check.

`QueueState` is `{version:1,roundId,queue,cursor,dismissed}` under the existing language/game persistence namespace. The integration owner supplies a stable persisted round ID and uses the same pins across renders/reloads. Next sentence increments the cursor; exhaustion sets `dismissed:true`. Leaving via Home/Play next also dismisses it. `restoreQueue` preserves valid pins and cursor without mutation and returns only these state fields. It requires matching round/version, `dismissed:false`, an integer cursor within a nonempty queue, and the trustworthy history. Every pin must have a nonnegative integer history index in strictly increasing order (duplicate clue indices and reordered chronology are rejected), refer to a valid player clue with exactly matching text/number, and link its word to a green guess in that same clue. All five row identity fields must match an available accepted record, including sentence/audio identities and version. Repeated words/targets on distinct clues are valid. Restore validates source linkage without rerunning target preference or substituting a different candidate.

Absent/legacy pins, missing trustworthy history, incorrect giver/result/index/text/number, duplicate indices, invalid state, and unavailable/stale row versions dismiss the entire queue as `{version:1,roundId,queue:[],cursor:0,dismissed:true}`. Never create a fresh queue during rehydration or silently substitute newer text. New finished rounds alone may create a queue. Resolve pinned versions from retained accepted records or dismiss if unavailable. Neither function writes rewards or evidence.

UI callbacks own no rewards. Restore/dismiss/next/listen/About must never call `finishRound` or rerun round completion; preserve `roundRecorded` and existing once-only guards. Preserve all prior curriculum evidence. Reading/listening/expanding is exposure only, with no automatic retrieval credit. Reference tests cover pure selection and legacy dismissal; integration must still test real storage migration, reload, duplicate callbacks and no reward rerun in the app store.

Settled UI: Danish first; one **Listen** only, Danish synthesis bake rate **0.8**, playback **1.0**. About this word shows general meaning + usage + one short bilingual alternative example. **Next sentence** advances; direct **Play next game** is available throughout and becomes primary after the last sentence; smaller **Home** remains at least 44px. Preserve onboarding `hideReplay`, post-wrap Grammar/Survival/Continue, City 1 train closure and existing rewards. The integration must preserve these exceptions when wiring direct replay.

Board text ultimately remains `WordEntry.exampleDa/exampleEn`. Review text is a distinct bank keyed by stable word/version identities, not the current focus-ID-only `sentence-review.da.json` format. Integration owner alone chooses/ports the final storage adapter and updates shared validators without falsifying old approvals.

Audio manifest rate and identities must be scoped to these City 1 sentences, never changing all 900 examples globally or unrelated word-slow recordings. Current `.github/workflows/bake-audio.yml` reconciles every source; a later separately authorized audio task needs explicit capped inputs/runs, text freeze, manifest/cache reconciliation and native evidence. This contract authorizes no paid work or workflow trigger.

## Next three task boundaries and acceptance

1. Board writer: fill only `board-sentences.json`, validate drafts, obtain successor editorial evidence in `board-editorial.md`; hand off 100 staged pairs without changing `words.da.json`.
2. Review writer: fill only `review-sentences.json` and `about-targets.json`, coordinate distinct pairs through reads, report coverage gaps, obtain `review-editorial.md`; hand off 100 review pairs and 39 general About entries.
3. Integration owner: after Rocky reviews content, run acceptance, port banks/selector/persistence/UI, preserve reward and navigation guards, run appropriate source/type/unit/build/browser checks and produce successor implementation evidence. Scope any later audio task separately; no paid call follows from this prerequisite.

Technical limits: structural checks cannot judge Danish naturalness, translation equivalence, whether the chosen inflection belongs to the card, generality of About prose, or City 1 difficulty. Successor editorial review must check these. Phrase matching is deliberately conservative; slot matches and activity presence require editorial interpretation. Node currently emits an experimental stripping warning. Actual app migration/reward and native/audio behavior await integration evidence.

Verification at handoff (Node 26.5.1): **30 self-tests passed, 0 failed**. Inventory regeneration matched the source-derived snapshot. Draft validation exited 0 and emitted 39 coverage rows, reporting 100 missing board, 100 missing review and 39 missing About records. Acceptance exited 1 as expected for those empty staging files. `node scripts/validate-docs.mjs` passed (52 classified documents). Working-tree changes are confined to this directory; app checks are deferred because no app or bank content changed.

Bounded review correction verification: corrected tests ran first against the old runtime implementation: **RED, 46 tests, 28 passed, 18 failed**. After the selector and restore correction, the same full contract suite was **GREEN, 46 passed, 0 failed** (`node prototypes/finish-review/implementation/validate.test.mjs`). This supersedes the earlier 30-test runtime evidence above. Correction edits are limited to `runtime-contract.mjs`, `validate.test.mjs`, and this document; authoring schemas and corpus remain unchanged.
