# City 1 BOARD staging acceptance

Status: accepted for BOARD staging integration, 2026-09-10. Parent accepts all 100 BOARD pairs based on Rocky's independent read and the two independent model review reports identified below. All rows now use status accepted and reference this successor evidence. This is no audio acceptance or bake approval; overall sentence-set acceptance and app integration are not complete.

## Reported independent review provenance and verdicts

The following provenance and verdicts are recorded as reported by the parent in the finalization instruction; this finalization did not obtain a new external review or rerun either model review.

- Reviewed artifact: board-sentences.json, 100 unique word IDs, exact pre-acceptance UTF-8 SHA-256 `7000320fdf9c8edf8fa914bdf496de45ef1fc26182251f3ce9371f344c4e37d5`.
- Rocky independently read all 100 pairs and verified that same SHA-256 unchanged at `2026-09-10T09:15:07Z`; Rocky reported draft validator zero errors.
- Independent Danish editorial model review: `sa-0-88aac1d5`, batch `deleg_fd10c7bb`. Reviewed 100 unique IDs and the same SHA-256; verdict: no blockers. Danish present-tense progressive/habitual readings are valid; inflections and mass noun usage passed.
- Independent L2 pedagogy model review: `sa-1-d869de31`, batch `deleg_fd10c7bb`. Reviewed 100 unique IDs and the same SHA-256; verdict: no blockers.
- Both reviews were actual independent model reviews, not native-human reviews. No native-human editor certification or external human educator review is claimed. No Sol approval stamp is asserted or reused.
- Reported nonblocking observations and resolutions: optional strand ambiguity and hospital/arbejde/bil simplifications were intentionally not adopted because the current prose is acceptable. No Danish, English, spans, source hashes, versions or identities were changed. Remaining BOARD blockers reported: none.
- Parent verdict: accept the BOARD set for integration based on those reports. This acceptance does not cover Review/About sets, audio, a bake, or completed implementation.

## Preserved authoring context

The author notes and original checks below describe the pre-acceptance editorial/null artifact. They are author observations and historical validation results, not additional independent reviews.

Checkout base verified: db2020d8eb937df104fae867c876f1b1cbd5c511. The frozen schema/inventory envelope base remains 21cd5ac2f9c2eaa24ca34674f6b9a580d77a8a82 as required by the contract; these are distinct provenance identities. Inventory order/ranks and source hashes are copied unchanged; ranks belong to inventory, not sentence row fields.

The eight sample pairs guide style, not acceptance. The duplicated sample sentence for bog/læse is avoided in this complete set. Danish present tense is translated as English progressive for ongoing activities and simple present for states/general descriptions. No support-target quotas were imposed.

Per-row notes below are the author's decisions and concerns, not independent findings. Every selected surface is a whole inflected headword; offsets are computed using JavaScript indexOf/length (UTF-16).

| Rank | Word ID | Danish | English | Highlight | Author decision / concern |
|---|---|---|---|---|---|
| 1 | da:mor | Min mor er hjemme. | My mother is at home. | mor | Possessive singular; ordinary family reference. |
| 2 | da:far | Min far laver mad. | My father is cooking. | far | Possessive singular; laver mad translated idiomatically as cooking. |
| 3 | da:barn | Barnet leger på gulvet. | The child is playing on the floor. | Barnet | Definite singular; neutral play scene. |
| 4 | da:hund | Hunden sover. | The dog is sleeping. | Hunden | Retains accepted style sample; two-word exception. |
| 5 | da:kat | Katten sover. | The cat is sleeping. | Katten | Retains accepted style sample; two-word exception. |
| 6 | da:hus | Huset har en have. | The house has a garden. | Huset | Definite neuter singular; concrete house sense. |
| 7 | da:bord | Bordet står i køkkenet. | The table is in the kitchen. | Bordet | Definite neuter; English is renders ordinary furniture location. |
| 8 | da:seng | Sengen er blød. | The bed is soft. | Sengen | Definite common-gender singular. |
| 9 | da:mad | Maden er varm. | The food is hot. | Maden | Definite mass noun; varm in a food-temperature context. |
| 10 | da:æble | Jeg spiser et æble. | I am eating an apple. | æble | Indefinite neuter singular. |
| 11 | da:mælk | Mælken er i køleskabet. | The milk is in the fridge. | Mælken | Definite mass noun; ordinary storage context. |
| 12 | da:vand | Jeg drikker vand. | I am drinking water. | vand | Retains style sample; bare mass noun. |
| 13 | da:kaffe | Jeg drikker kaffe. | I am drinking coffee. | kaffe | Retains style sample; bare mass noun. |
| 14 | da:øje | Hun har blå øjne. | She has blue eyes. | øjne | Irregular indefinite plural of øje. |
| 15 | da:hånd | Mine hænder er kolde. | My hands are cold. | hænder | Irregular plural with plural adjective agreement. |
| 16 | da:dør | Døren er åben. | The door is open. | Døren | Retains style sample; noun door, not verb dies. |
| 17 | da:vindue | Vinduet er lukket. | The window is closed. | Vinduet | Definite neuter singular. |
| 18 | da:stol | Stolen står ved bordet. | The chair is by the table. | Stolen | Definite singular; furniture location. |
| 19 | da:køkken | Vi spiser i køkkenet. | We are eating in the kitchen. | køkkenet | Definite neuter singular; ordinary room use. |
| 20 | da:mund | Barnet åbner munden. | The child opens their mouth. | munden | Definite body part; English their expresses the child’s own mouth without adding gender. |
| 21 | da:hoved | Han drejer hovedet. | He turns his head. | hovedet | Definite body part corresponds to English possessive. |
| 22 | da:mand | Manden venter på bussen. | The man is waiting for the bus. | Manden | Man sense, not husband; ordinary vente på construction. |
| 23 | da:kvinde | Kvinden læser en avis. | The woman is reading a newspaper. | Kvinden | Definite singular; one ordinary activity. |
| 24 | da:pige | Pigen tegner et hus. | The girl is drawing a house. | Pigen | Definite singular; concrete activity. |
| 25 | da:dreng | Drengen spiller bold. | The boy is playing ball. | Drengen | Definite singular; ordinary spiller bold collocation. |
| 26 | da:bror | Min bror bor i Aarhus. | My brother lives in Aarhus. | bror | Possessive singular; simple residence statement. |
| 27 | da:søster | Min søster er på arbejde. | My sister is at work. | søster | Possessive singular; ordinary at-work phrase. |
| 28 | da:rød | Bilen er rød. | The car is red. | rød | Retains style sample; common-gender predicate agreement. |
| 29 | da:hvid | Huset er hvidt. | The house is white. | hvidt | Neuter predicate inflection of hvid. |
| 30 | da:sort | Skoene er sorte. | The shoes are black. | sorte | Plural predicate inflection of sort. |
| 31 | da:ost | Der er ost på brødet. | There is cheese on the bread. | ost | Bare mass noun; ordinary food use. |
| 32 | da:æg | Jeg koger et æg. | I am boiling an egg. | æg | Indefinite neuter singular; count noun. |
| 33 | da:kød | Kødet ligger i køleskabet. | The meat is in the fridge. | Kødet | Definite mass noun; English location does not need lying. |
| 34 | da:fisk | Fisken svømmer i vandet. | The fish is swimming in the water. | Fisken | Living animal sense is explicit; definite singular. |
| 35 | da:spise | Vi spiser morgenmad. | We are eating breakfast. | spiser | Present tense of spise; one ordinary meal. |
| 36 | da:drikke | Hun drikker et glas vand. | She is drinking a glass of water. | drikker | Present tense of drikke; ordinary measured drink. |
| 37 | da:øl | Øllen er kold. | The beer is cold. | Øllen | Common-gender definite beer serving; ordinary count/serving use, no invented meaning. |
| 38 | da:sol | Solen skinner i dag. | The sun is shining today. | Solen | Definite singular; conventional weather statement. |
| 39 | da:træ | Træet står i haven. | The tree is in the garden. | Træet | Living tree sense, not material wood. |
| 40 | da:blomst | Blomsten står i en vase. | The flower is in a vase. | Blomsten | Definite singular; ordinary vase location. |
| 41 | da:fugl | Fuglen sidder i træet. | The bird is sitting in the tree. | Fuglen | Definite singular; ordinary bird location. |
| 42 | da:hest | Hesten spiser græs. | The horse is eating grass. | Hesten | Definite singular; ordinary feeding activity. |
| 43 | da:bil | Bilen holder foran huset. | The car is parked in front of the house. | Bilen | Holder is the ordinary stationary-car use; English parked conveys it. |
| 44 | da:by | Vi bor i en lille by. | We live in a small town. | by | Indefinite singular; town chosen from source senses. |
| 45 | da:skole | Skolen ligger ved parken. | The school is by the park. | Skolen | School building/location sense; English is for ligger. |
| 46 | da:bog | Jeg læser en bog. | I am reading a book. | bog | Retains style sample; læse receives different text at rank 100. |
| 47 | da:ben | Hun strækker benene. | She stretches her legs. | benene | Definite plural; leg sense explicit, not bones. |
| 48 | da:fod | Min fod er kold. | My foot is cold. | fod | Possessive singular; literal body part. |
| 49 | da:arm | Han løfter armen. | He raises his arm. | armen | Definite body part corresponds to English possessive. |
| 50 | da:finger | Hun har en ring på fingeren. | She has a ring on her finger. | fingeren | Definite singular; English possessive reflects Danish body-part construction. |
| 51 | da:næse | Min næse er kold. | My nose is cold. | næse | Possessive singular; literal body part. |
| 52 | da:tand | Barnet har en løs tand. | The child has a loose tooth. | tand | Indefinite singular; ordinary childhood context. |
| 53 | da:hår | Hendes hår er langt. | Her hair is long. | hår | Collective mass hair, not one strand; neuter langt. |
| 54 | da:hjerte | Hjertet slår hurtigt. | The heart is beating fast. | Hjertet | Literal organ sense; no metaphor or diagnosis. |
| 55 | da:dag | Det er en varm dag. | It is a warm day. | dag | Indefinite singular; ordinary weather description. |
| 56 | da:nat | Natten er stille. | The night is quiet. | Natten | Definite singular; simple nighttime description. |
| 57 | da:aften | Vi spiser sammen i aften. | We are eating together this evening. | aften | Bare noun in ordinary temporal phrase i aften. |
| 58 | da:uge | En uge har syv dage. | A week has seven days. | uge | Indefinite singular; simple duration fact. |
| 59 | da:stor | Haven er stor. | The garden is big. | stor | Common-gender predicate adjective; physical size. |
| 60 | da:lille | Værelset er lille. | The room is small. | lille | Lille unchanged with neuter singular; physical size. |
| 61 | da:gammel | Cyklen er gammel. | The bicycle is old. | gammel | Common-gender adjective; ordinary age of an object. |
| 62 | da:ung | Hunden er ung. | The dog is young. | ung | Common-gender adjective; literal age. |
| 63 | da:glad | Jeg er glad i dag. | I am happy today. | glad | Emotional state; no more complex glad for construction. |
| 64 | da:elske | Jeg elsker min familie. | I love my family. | elsker | Present tense of elske; ordinary affection, not a weakened like gloss. |
| 65 | da:ven | Min ven kommer på besøg. | My friend is coming to visit. | ven | Possessive singular; conventional visit phrase. |
| 66 | da:søn | Deres søn er fem år. | Their son is five years old. | søn | Possessive singular; English old completes age idiom. |
| 67 | da:datter | Min datter leger i haven. | My daughter is playing in the garden. | datter | Possessive singular; ordinary activity. |
| 68 | da:kage | Kagen står på bordet. | The cake is on the table. | Kagen | Definite singular cake; simple location. |
| 69 | da:smør | Der er smør på brødet. | There is butter on the bread. | smør | Bare mass noun; no count article. |
| 70 | da:salt | Suppen mangler salt. | The soup needs salt. | salt | Bare mass noun; needs naturally translates culinary mangler. |
| 71 | da:sukker | Jeg tager sukker i kaffen. | I take sugar in my coffee. | sukker | Bare mass noun; habitual drink preference, English possessive is idiomatic. |
| 72 | da:kartoffel | Jeg skræller en kartoffel. | I am peeling a potato. | kartoffel | Indefinite singular; concrete food preparation. |
| 73 | da:grøntsag | Vi køber friske grøntsager. | We are buying fresh vegetables. | grøntsager | Ordinary indefinite plural; avoids an unnatural isolated generic singular. |
| 74 | da:lampe | Lampen står på bordet. | The lamp is on the table. | Lampen | Definite singular; ordinary furniture location. |
| 75 | da:værelse | Værelset har to vinduer. | The room has two windows. | Værelset | Definite neuter singular; concrete room description. |
| 76 | da:himmel | Himlen er blå. | The sky is blue. | Himlen | Ordinary contracted definite singular; sky sense, not heaven. |
| 77 | da:regn | Regnen falder på taget. | The rain is falling on the roof. | Regnen | Definite mass noun; rain, not imperative of regne. |
| 78 | da:sne | Der ligger sne på vejen. | There is snow on the road. | sne | Bare mass noun; snow, not the verb to snow. |
| 79 | da:måne | Månen lyser over havet. | The moon is shining over the sea. | Månen | Definite singular; ordinary visible moonlight description. |
| 80 | da:stjerne | Jeg ser en stjerne. | I see a star. | stjerne | Indefinite singular; literal celestial object. |
| 81 | da:hav | Havet er roligt. | The sea is calm. | Havet | Definite neuter singular; literal sea. |
| 82 | da:strand | Vi går på stranden. | We are walking on the beach. | stranden | Definite singular; location on beach rather than destination. |
| 83 | da:park | Vi mødes i parken. | We are meeting in the park. | parken | Definite singular; ordinary meeting location. |
| 84 | da:gade | Gaden er stille. | The street is quiet. | Gaden | Definite singular; literal street. |
| 85 | da:kirke | Kirken har et højt tårn. | The church has a tall tower. | Kirken | Church building sense; no religious practice assumed. |
| 86 | da:hospital | Hospitalet ligger tæt på stationen. | The hospital is close to the station. | Hospitalet | Definite neuter singular; ordinary location, no medical advice. |
| 87 | da:butik | Butikken sælger tøj. | The shop sells clothes. | Butikken | Definite singular; ordinary retail sense. |
| 88 | da:bank | Banken er lukket i dag. | The bank is closed today. | Banken | Financial institution sense; no banking advice. |
| 89 | da:penge | Jeg har penge i lommen. | I have money in my pocket. | penge | Danish plural-form noun maps to English mass money. |
| 90 | da:købe | Jeg køber et brød. | I am buying a loaf of bread. | køber | Present tense of købe; et brød is a loaf, not a mass-noun error. |
| 91 | da:arbejde | Mit arbejde begynder klokken otte. | My work starts at eight o’clock. | arbejde | Noun work matches source POS; avoids source example’s verb arbejder. |
| 92 | da:lærer | Læreren skriver på tavlen. | The teacher is writing on the board. | Læreren | Definite noun teacher, not verb lærer. |
| 93 | da:tog | Toget kommer om fem minutter. | The train is coming in five minutes. | Toget | Definite neuter noun train, not past tense of tage. |
| 94 | da:bus | Bussen stopper ved skolen. | The bus stops by the school. | Bussen | Definite singular with doubled s; ordinary route statement. |
| 95 | da:cykel | Min cykel har en kurv. | My bicycle has a basket. | cykel | Possessive singular; concrete feature. |
| 96 | da:fly | Flyet lander snart. | The plane is landing soon. | Flyet | Definite neuter noun aircraft, not imperative fly. |
| 97 | da:køre | Hun kører bilen. | She is driving the car. | kører | Present tense; explicit car object fixes drive sense. |
| 98 | da:sove | Barnet sover i sengen. | The child is sleeping in the bed. | sover | Present tense of sove; simple literal sleep. |
| 99 | da:løbe | Han løber i parken. | He is running in the park. | løber | Present tense; ordinary running, not flight or linked events. |
| 100 | da:læse | Hun læser en avis. | She is reading a newspaper. | læser | Present tense of læse; distinct from bog sample and every other board pair. |

## Original author self-review

Assistant author reread all 100 bilingual pairs and selected spans against the source headword, POS and English senses. The noun `arbejde` now appears as a noun; the source example used `arbejder`, a verb. Body-part definite forms, irregular plurals, mass nouns and adjective agreement are noted individually above. All pairs are single clauses, with no embedded quotations or linked events. Seven board examples retain sample wording; `læse` uses a different sentence to remove the sample's duplication with `bog`.

No unresolved lexical or inflection error was identified by this assistant self-review. This is not a native-language certification. Original judgment calls submitted for Rocky's independent review:

- `øl`: `Øllen er kold.` uses common-gender definite beer as a serving. It intentionally does not demonstrate every gender/count use of øl.
- `mund`: English singular `their` preserves the unspecified gender of `barnet`; Danish uses the normal definite body-part form `munden`.
- `mad`: `varm` is rendered as `hot` in ordinary food-temperature English; `warm` is also possible depending on the imagined temperature.
- `salt`: `mangler salt` is rendered as `needs salt`, the natural culinary equivalent, rather than the more literal `lacks salt`.
- Location verbs `står`, `ligger` and stationary-car `holder` receive natural English location/parking wording. These choices preserve the headword sense but are not word-for-word glosses of each verb.

At the original authoring checkpoint, independent review and Rocky's acceptance were pending. The reported model reviews and parent BOARD acceptance above supersede that pending status; no native-human review is claimed. Review/About content was absent at that checkpoint, so distinctness against the eventual review set must be rechecked during integration.

## Original authoring checks

- Read AGENTS.md, docs/WORKING.md, docs/LAUNCH.md, docs/README.md, relevant engineering-guide context, CONTRACT.md, schema.json, inventory.mjs/inventory.json, validate.mjs, sample-pairs.json, and source City 1 headwords/POS/senses. No other worktree was inspected.
- Verified branch `codex/city1-board-sentences-20260910` and HEAD `db2020d8eb937df104fae867c876f1b1cbd5c511`; initial working tree was clean.
- Saved complete JSON checkpoints at 25, 50, 75 and 100 rows, with corresponding per-row author notes.
- `node prototypes/finish-review/implementation/validate.mjs --draft` from repository root, Node v26.5.1: exit 0, errors `[]`, missing board `[]`, missing review 100, missing About 39. The latter are expected parallel-work gaps. The validator recomputed inventory and found no stale snapshot. Only the documented experimental type-stripper warning appeared; no npm dependencies were installed.
- Read-only Node assertions passed: exactly 100 rows; inventory order/ranks 1–100; exact word IDs and source hashes; all editorial/null; exact v1 board sentence/audio identities; all 100 valid whole-word UTF-16 spans. Case-insensitive Danish uniqueness 100/100; English uniqueness 100/100.
- Whitespace-delimited Danish word counts: 2 words × 2 rows, 3 × 30, 4 × 43, 5 × 23, 6 × 2. Thus 98/100 have 3–6 words; the two 2-word sentences are the dog/cat style samples. Maximum Danish length is 35 UTF-16 code units including punctuation (`Hospitalet ligger tæt på stationen.`). English: 4–9 words, maximum 40 UTF-16 code units (`The car is parked in front of the house.`).
- `git diff --check`: passed. Working-tree scope check showed only board-sentences.json and this board-editorial.md changed. No production bank, review/About files, schemas or validator edits. No paid generation, audio work, network, credentials, deployment, commit or push.

Pre-acceptance board-sentences.json exact UTF-8 SHA-256: `7000320fdf9c8edf8fa914bdf496de45ef1fc26182251f3ce9371f344c4e37d5`. This identifies the staged authoring artifact only; it is not an approval fingerprint or acceptance evidence.

## Accepted BOARD row fingerprint evidence

These 100 wordId fingerprint lines use the exported editorialFingerprint from validate.mjs on the final status accepted rows. The helper excludes approval. After this evidence file is fully written, its exact UTF-8 SHA-256 is computed and populated into every row's approval as board-editorial.md. Acceptance metadata changes the JSON artifact hash; the reviewed prose and all other row fields remain unchanged.

```text
da:mor 104c2c0df3b32a97669deffa4ecc2502c62a44ab0fd77f2b02b9df4e55f15ede
da:far 42dfc426fe6325c39b464be67dfb6b5fd0dde23a3137332b08bd8c7541ff0ec8
da:barn 76103abbdcf5a02f31ae663ad31375ff9ae2a82263e56c18cc981fde0360b734
da:hund da9aa7e0510c520edeed096ae823a5d7f5add148f462d74b7a388a1bd51875c1
da:kat 2f669e00ad4ad4a665fd004f83677a6e373658ba6898b8f070236d8df0dcc939
da:hus 8a12ae537a30f445b1781e70430b1d87fcd6e36600946d7a00fe661884106998
da:bord cd19ce6c32e8899452cecf05ed064e6c272ee024be94637722b989ee08484824
da:seng 8eb6513a473dc99776f4c85f4deb3ed00e04f300c16d4315c67378ddaaa56871
da:mad fd11e5c1c448dcb724383a1364f93b51e3d85bf296157e77a9959595fce8507e
da:æble 8a99c676625913eff49a8a131b1b522910e226b56d022aeadd5da36def779409
da:mælk 611156793de57fb85fc51ae19bf1d68971a9f600687f2fc0679985a7eaab963a
da:vand 5aab1c530905c1c42ced8ed614454b3ecf22ae31c445aca11c6be2d9430ec30e
da:kaffe 9bd9a5a18b35b08d802c0b0b3b982939251a18534727ae957c999e58e8a2c0e0
da:øje 8c6cce6c2cb98c7ab9ce2aada7e0859c4004f43ff78fb6e9530252510ab9ce01
da:hånd 13d78d08175a944f17bd7f487ca67d069422273dbeac3bbf3c0f750e5f882567
da:dør 3ad0589cc0a691e385492035a68a6f9269cb71a32154a3a671572ca63be89807
da:vindue 69d4d76460dca0eb51068b4579614cd1c3a3f74cad60304da72f9b6374ea7adf
da:stol 2e9d31a901cea5ab97e7e2404c73cf89efc9d0380cc73df1135ac3170bc6758d
da:køkken e98d7079d69e0430e1cc546d2732dbf599a1ebe833bf587635e26cc25ae9455e
da:mund 82c251c61e4611cebcd4a8fdc1788c8e9eeeb90eb16821093e506baf83cca8b6
da:hoved 0fb7ebc1ac25558b4bb9d94a148d3eabe36ac42b0aea52161936bc3c0e4ba7d1
da:mand d316fc4be38bd129e69a675c087c4765e9a65e4b8fbef5c02dee7e0b6343f6f3
da:kvinde 6b658f817276029a3e4bf7602dcf815002d7469e06c3efda6960d1789db3b344
da:pige 5ea956127631428121b54b36a7a03d2d578af128816b69ab0a919c6961e1bd97
da:dreng 5a1e30940e9836aef3a03e1facc404cd8f0290a1c6c4aeb16c33a00595de032d
da:bror 2fd87ad3b9b3716fee78529d946469b5f8e179a7279ed3112a3361c74cbfb069
da:søster 1dc84005eb288cb25a3922e66fa7ca8a6db5c3bf2f8c4400701d9b2399976548
da:rød 252103ecaaeafe4cd0ecff448a703e72f9f56ef17bd9fc51a10f0406014975b7
da:hvid 652a7fd162bf7ddf3895da7a7843304b5e3a78fb578004da8da81ae5939fd199
da:sort 2e9799d1081f8226b6a6e0d918166fd035c4ffdf46d249322243eabe19710555
da:ost 5ff76aa6bd05b99758b5cf1e54c57b2e0147146bd7816d53ec3f1f6cfca8bce7
da:æg 2acc5522af8145383253d1017ff053cce3935228099d727db8e226acfdcb64c6
da:kød c98221cb780e092e6df27d83ae97626094864eb4fa2f1e2ccc56d9b38777d9e7
da:fisk 545ab26b04d4de70b5e0147581ecc4ba15bce39a01410f572423bde92a3003a9
da:spise 4b47a0bbd15a0e7619c7acce4c2bbdabf8ae56cc6c0c7265a4b0ccb6098e8dc3
da:drikke b64052fd03ea765c8c4ffdc9e9315c8c0e2d78a53dd33a4e844836560ee7170d
da:øl 1f7cdd8ca3cb033388cf7862430bb843fa1c7e93769ffb180554dc4b914e8653
da:sol 6f168129548e87876ddbc3ff81631b5eb4122649a3f0bb456334a5977891a6a0
da:træ ad4ece21906e0d98dbe0166dfb07be3d707edc52e0a041b09497bf88d64e8503
da:blomst 17cdebdcb244d863fd76a72094623f44765e91368918e14b7b4469bbc34c9d87
da:fugl 4fdf63ef02224185be20fd1474300bf77b3d7771d0d88ad198893c9b0bae0a45
da:hest 0c883090c64dacdb5ea644546ba883c2641bf37273c162ac392a38f48944cf52
da:bil 97358de4cafa04bab61509739f0ac264cebec3ce83c8face68de0a253c9991fe
da:by ec7b031a8db18baeb7f65be80c8f4c88bdee168b7930ee6f7889fae707b9081f
da:skole 3288468189380e3259b29c2e08ec9cb1a19c05eae64fac1688211cec4cd73915
da:bog 0603d68dde7f7e9be96fe85551d852845ca5406c8e6fc43834f85a1874ed9c8e
da:ben a5c0ff2a89620f243604cd3bb49fffb9c3b809163af2489d58b88120f77661a4
da:fod ed1f3c1bf67ce001b54d87b4a6aa15f6cff1ce1a47066764cd03564034b0fa54
da:arm 2a0ae622f4e5415421c64077a353b1911038d5e7f2d5f9086f4f16cddf7f9293
da:finger 4604bc63b8ff35f030df6af06ff73f531c2c807499a3922d6c48bf8b94067983
da:næse d162ce6bcce19647c2a8a7d0b068308ae087c82d00c9829fd984ca2e0edc3601
da:tand 12ae6f0de30c8717bb1bce757d5925f69d44f786124d76676821d8f8b66d10d6
da:hår 5924d17e2b1f8d69d0f67ac88aee4de312037934f1c7f328c0a99656a7cd61e1
da:hjerte 2cb851744664b67ec198eaa014dd088396d4140cca83ca6a8e79221e67375119
da:dag a515a83216efa045ff8737a51f602edf1c3ac5a94889fed7835a356fda229a06
da:nat 52916ce232735317e6b255f04eb9fcd08765d6bfd8ad8fad292d161b5086474b
da:aften 9054f32e28f01c85b032618621cb716160e7468b08e507c6cf787e81ac59a22a
da:uge 1a787a7a13cd0732af622cfec9d357fff25b688806e4b6e9c4a3448430fa5e8f
da:stor 58d5fcd3b4b66d0a02f412e005fcdb7810365f4e8e1c835af986efadeda2a17c
da:lille 0f8143b07fe2fca319791403c398a85908408f72453a4e85ff0166b217c2466b
da:gammel 47c9a27f416628d853dfed55c2c50fc6b94ba8849c5ec41a6cd9fac150157a0e
da:ung 568db61313d45ce70a378c6ab451a02c3f6f802167582f01a33f6b1c110253c9
da:glad ca7f2db7eb8227c427a9672ac9e792ccdfe9108d25ad0399310409b1b31caf24
da:elske 600c74cbe58e2e9fca1bebbf0190ad758d1642df4595bea7c02deb284162a3ac
da:ven 634df570210c9ae9769b443ce0a2aa6b1c315c2afe4abe5fe39fbe9127056782
da:søn 51e749ff4e48f2f6975944af5eae6ad968afcd13c5dec775d5e6944a89687565
da:datter bd5e3353a5f828bcf32142c043da5677e13e7ccf4702d6dae7f3ed9c4c082872
da:kage 309fb404dd5bd036a9fbce5ea6c2057b34893963193c97d07c7958974f07a8b0
da:smør bed01e5bd9f868393b06adf6201f2e8ddae914182816e63939cea75efa5ad9d3
da:salt cb68d656826809df5aad8d75f1cf6bbd9854f9befb9a40a17d40bd1d40037c0b
da:sukker e2d742f27bdb3b6f5e2b703c57ad1586a0269c2da42c172e4287e0de94fb0941
da:kartoffel 8ce50fc3b504a3c343033c5f21807d5c75a5f83b40739079d029a6cca4613dc3
da:grøntsag a696d38b61a531e2812f156ae7460479cc572ecb97298683774d4ae8ee3faccb
da:lampe f82bd3f024786a9a6be3103f7ed72ab4f9f573180765bd168f36ff25c654182e
da:værelse 5830336ac1581b1c980455a185e0cc525387394abf18bba58ba6aab32e6d0c12
da:himmel 458f623e5fd1c8daf1a48e1f0b427b0f11e8e25f1cf146f3b5123e1aaa49773c
da:regn c20da6af8bcaedfc660874f4d7b8bdb071382eaade488453ee9548161a4a5c72
da:sne 4695b5fd6805e639f63483d689c7d498464e50e6d0f61d78d66e4cd592df74f7
da:måne f2166710504f9f5eea6dd965e507a9a18f4c7d8ea8f754336b5acda062e150b7
da:stjerne 8e5a14339c2eb40410f83358e8cba00a585523b8f06377581ff2e49a4840e8ff
da:hav dbf2e0a15ee7ebfd6768ebdfee1cf8ea06ccd56a5b97242b1a2efceee34132d7
da:strand a901bdeb1e1c0f5f7d91ac71fbdaf9435c0b4a568090d0427771e2f3f226f62f
da:park 931fd963c7b8a9576d88d40fb3dc634ee2d6c9be1d457e8b413880d1a4683c0c
da:gade 2f9f594abd8877f701a095c1aa0255a3c20fedc1a8e2e5b34c82ba974664d5fe
da:kirke 59271c35144eaf35d1d5659d4f232b20b1af7b9393a7406d9c0d27f51faf9b5a
da:hospital a310c62b22c94d6373693185627dd6b07c329e8f7b36754216b1581a93fb7a20
da:butik cafe27c07d78d69f833f064676a8dfddc459866e9229759a31f6ace6a0da48e7
da:bank 0863753a74a8c80100e2a3826f05efadd44cf7ada3e987ce78a4e6ba28e1415f
da:penge 472af9bd3957976766204f148fef67d5d121f2cfad203eb5c3ece9792638d00c
da:købe 03db05a97f908bab6671f4af5f53b0995c25a3738fc9f03cee58b7d6ee410c08
da:arbejde 87d9f4141db26df42d782bcecc82b532977ed70693fc53600df8b23d945bb17a
da:lærer ccbe2b1628c5cf78a6640fd5cb21de4c2305655b32a9dbfb863ade68309ac731
da:tog 90e7e553a7bf3dd785a1d209b0f44596791083ffd3b739aec742f09b3cd82a68
da:bus e39a337de755b250020b107fd7f35115e43f2b0a1f251b5942342afb154e8334
da:cykel efce3a19b16c947828b529a5bde442fab71c863ab8b9a8305b7e980c2f03910d
da:fly b791e946cb400b0077f24c6c4e647371d7c86118e30f4ec8723f0fe5f096a25b
da:køre 62444730f9d892c24e46e8d72e9941fe52fa5bb63eff5ba506896461eb404a6e
da:sove 9ecc57c6456c48ed6bb2f7360fd7927f83af5b8e4c6e3d3c94d829f7c3c342e5
da:løbe 6935c28a5b6ea7d7b4f84c9d7ca54b4dbb3df8e6816ae1e329d17d55c6275c64
da:læse ff0bdf37309c4db5d354b16d9bac4a1355d0863279f4c958a5885ecafecc701b
```