# City 1 review and About editorial handoff

Status: bounded REVIEW+ABOUT staging acceptance authorized by the parent, 2026-09-10. Accepted for integration; final artifact hashes await parent verification. No native-human or audio approval, and no full City 1 teaching-coverage acceptance.

## Identity and scope

Working checkout: db2020d8eb937df104fae867c876f1b1cbd5c511. The frozen schema/inventory envelope still requires base 21cd5ac2f9c2eaa24ca34674f6b9a580d77a8a82; it is preserved as a contract identity, not represented as the task checkout.

Only review-sentences.json, about-targets.json and this file are authored. No other worktree was read. No board-author edits, production corpus edits, installs, network, credentials, paid generation, Aoede audition/bake, commits, pushes or deployment. The contract CLI necessarily checks the local board staging envelope, which currently reports 100 absent records. Parent independently checked the actual 100 board and 100 review rows, including the revised cheese row, with zero same-word Danish collisions. That supplied check is distinct from this checkout’s empty board envelope.

100 separate review pairs, one per actual inventory word; 39 general About entries, including all four receptive entries and preview kan. All 100 review rows and 39 About rows have status accepted and approval links to this exact successor evidence. Sentence/audio identities are logical staging IDs, not generated recordings. Review versions are v2 except da:glad, da:ost, da:drikke and da:køre v3; About hallo, thing, ja, lidt and i are v2, others v1. Version bumps include the span/wording audit.

- Pre-finalization review-sentences.json SHA-256: 0391b5166e22649fccc696bf9de082ca616f417efeb6e6f8d3bf9fcfe8390242
- Pre-finalization about-targets.json SHA-256: b2c84a54fdb971dfc6efb3889c30a6efc335d66015b1ddd4aa791b1d25b638b5

These historical pre-finalization hashes identify the revised proposal only. Final accepted row fingerprints appear below; approval links hash this exact UTF-8 evidence file. Final JSON file hashes are reported separately to avoid a circular evidence hash.

## Author self-audit: L2 considerations

98 review rows contain 3–6 whitespace-separated words; two contain 2 words (Godmorgen, far. and Vand, tak.). The short rows are useful formulas. Rows use a single clause, greeting plus clause, or a compact request/response. No quoted board terms, invented name slots, or story clauses were added for coverage. The eight approved samples guide style; all eight sample review texts are retained. This is style reuse, not inherited acceptance.

Coverage is deliberately distributed: 27 of 35 eligible primary focuses are represented. The largest is lidt (10); ledger hvor has 2 rows and the whole where chunk has 2. Repeated useful patterns are intentional. Each row has one primary focus even where several forms occur. There is no City 1 quota derived from whole-route floors and no claim of teaching, retrieval, or mastery from these counts.

Resolved during authoring: shortened the heart row to visual identification rather than anatomy; replaced welcome-to-your-room with Her er dit værelse.; made butter quantity explicit on the nose; changed the glad row to an everyday return to happiness; corrected et versus det focus for stjerne; repaired case/boundary offsets and six full-question target spans after draft validation rejected missing question marks. The schema and validator were not changed.

## Independent educator and native-editor review

Provenance: the parent supplied actual independent MODEL reviews under `deleg_21e45f02`, covering all 100 review rows and all 39 About records. Danish editorial reviewer: `sa-0-62703912`; L2 pedagogy reviewer: `sa-1-5a588cdb`. These are model findings, not human reviews; finalization does not claim a new independent review run or human approval.

L2 educator MODEL findings: the categorical countable-object prohibition in About ledger:lidt was inaccurate. Resolved with: “Before a substance, lidt gives a small quantity. With an adjective or action, it gives a small degree or extent. For a few individual objects, use nogle få.” Coverage limits are reported below; they are not new authoring quotas.

Native-editor MODEL findings: no Danish sentence grammar blocker reported across the reviewed bank. Adopted only the requested small optional improvements: cheese serving, concise Ja tak example, explicit plural English for drikke and About I, and explicit vehicle departure for køre. All other optional suggestions remain unadopted. The parent independently verified all 100+39 records, inspected the six corrected records and accepted the six authorized changes. No unresolved factual or Danish grammar blocker remains for this bounded bank.

Remaining contextual considerations from the author checklist: den/it and response rows need ordinary conversational context; the unnamed thing needs a shared referent; the lost tooth is a narrow child context. Goddag, min ven, body-movement imperatives, weak adjectives, Hvad er det for en ... and på vej retain the previously noted register or learning-load considerations. These are not newly asserted grammar blockers.

## Bounded revision record

Verified pre-change SHA-256: review `ba9212aaccd6ae33f48dd74c0c098a2d9e06a976b478cb0a244ca4d07b656122`; About `265e32fcd315cf01fbab4dffa2395e48606c322afc446b08be355c861dafb7ab`.

| Record | Version | Exact adopted change |
|---|---|---|
| Review da:ost | 2 → 3 | En skive ost, tak. / A slice of cheese, please.; wordSpan ost [9,12), preserved ledger:en targetSpan En [0,2). |
| Review da:drikke | 2 → 3 | English: What are you all drinking? |
| Review da:køre | 2 → 3 | English: Okay, we are driving off now. |
| About ledger:lidt | 1 → 2 | Corrected usage quoted above. |
| About ledger:ja | 1 → 2 | Ja tak. / Yes, please.; recalculated targetSpan Ja [0,2). |
| About ledger:i | 1 → 2 | English: You are here (plural). |

Each changed review row has both identities bumped: `city1:<wordId>:review:sentence:v3` and `city1:<wordId>:review:audio:v3`. Unchanged Danish spans remain exact. Envelope versions stay 1 per schema. The parent reversed these six authorized changes in memory and reproduced both original model-reviewed hashes above exactly. Final polish changes only the ledger:i English punctuation to “You are here (plural).”, retaining its unpublished v2. All other prose, versions, spans and identities are preserved. All 139 rows are now accepted with fresh fingerprints generated after the status change.

## Review row findings

Each entry below records the selected sense/context and any notable morphology or concern. Exact Danish/English pairs, City 1 stages and UTF-16 spans live in review-sentences.json.

| Word ID | Danish | Primary focus | Author finding |
|---|---|---|---|
| da:mor | Hallo, er mor der? | ledger:hallo | Phone-style attention check; mor is Mum, der points to the person being available. |
| da:far | Godmorgen, far. | ledger:godmorgen | A normal two-word morning greeting; far is a direct address. |
| da:barn | Er det dit barn? | ledger:det | Det identifies a child; it does not agree with barn through a new rule here. |
| da:hund | Hvor er hunden? | ledger:hvor | Location question; hunden is the definite singular. |
| da:kat | Er det din kat? | ledger:det | Det means that in identification despite kat being an en-noun. |
| da:hus | Der er et hus. | ledger:der | Existential der er introduces a house; not a pointed location. |
| da:bord | Tingen ligger på bordet. | supplemental:da-word-thing | Tingen is singular the thing, with an understood unnamed object; bordet is the table. |
| da:seng | Her er din seng. | ledger:her | Her introduces a bed being shown; din is possessive. |
| da:mad | Tak for mad. | ledger:tak | Conventional thanks after eating; mad is idiomatically the meal. |
| da:æble | Et æble, tak. | ledger:et | Et is the neuter article in a compact order. |
| da:mælk | Lidt mælk, tak. | ledger:lidt | Lidt gives a small amount of milk; tak closes a request. |
| da:vand | Vand, tak. | ledger:tak | A useful two-word request; tak means please, not retrospective thanks. |
| da:kaffe | Lidt kaffe, tak. | ledger:lidt | Lidt gives a small quantity of coffee; retained sample wording. |
| da:øje | Der er noget i øjet. | ledger:der | Existential der er; øjet is singular definite, and noget means something. |
| da:hånd | Giv mig din hånd igen. | ledger:igen | Repeat a simple hand-taking instruction; Giv is an imperative, not the new focus. |
| da:dør | Der er en dør. | ledger:der | Existential der er; retained sample wording. |
| da:vindue | Er der et vindue? | supplemental:da-chunk-existence | Availability question; full chunk includes the question mark. |
| da:stol | Den stol er ledig. | ledger:den | Den points out a common-gender noun; ledig means unoccupied here. |
| da:køkken | Hvem er i køkkenet? | ledger:hvem | Hvem asks which person; køkkenet is the kitchen. |
| da:mund | Åbn munden lidt. | ledger:lidt | Lidt gives extent of opening; Danish definite body part translates naturally as your mouth. |
| da:hoved | Drej hovedet lidt. | ledger:lidt | Lidt gives degree of turning; a short movement instruction. |
| da:mand | Hvem er den mand? | ledger:hvem | Hvem asks a person's identity; den is incidental. |
| da:kvinde | Hvem er den kvinde? | ledger:hvem | Same useful identification pattern for a woman. |
| da:pige | Der er en pige udenfor. | ledger:en | En is the common-gender article; udenfor is an incidental location word. |
| da:dreng | Den dreng er min bror. | ledger:den | Den points to the boy being identified; no story setup is required. |
| da:bror | Goddag, er din bror hjemme? | ledger:goddag | Goddag opens a polite enquiry; its formality merits native register review. |
| da:søster | Hej, er din søster her? | ledger:hej | Hej opens an everyday enquiry about someone's presence. |
| da:rød | Ja, bilen er rød. | ledger:ja | Ja confirms a prior proposition; no claim of standalone answer retrieval. |
| da:hvid | Nej, katten er hvid. | ledger:nej | Nej corrects an assumed colour; the implied prior question is not supplied. |
| da:sort | Den sorte, tak. | ledger:den | Den sorte selects a common-gender black item; sorte is the weak adjective form. |
| da:ost | En skive ost, tak. | ledger:en | Orders a slice of cheese; En modifies skive and preserves the article focus. |
| da:æg | Er der æg? | supplemental:da-chunk-existence | Æg is plural here, despite sharing the singular surface; existential question. |
| da:kød | Nej tak, jeg spiser ikke kød. | ledger:nej | Polite refusal plus one short clause; ikke is incidental, not a City 1 primary target. |
| da:fisk | En fisk, tak. | ledger:en | En fisk asks for one fish; no unusual use of a word as a label. |
| da:spise | Hvad spiser du? | ledger:hvad | Hvad asks about the object of eating; spiser is present tense. |
| da:drikke | Hvad drikker I? | ledger:i | Uppercase I is plural you, not the preposition; English you all makes plurality explicit. |
| da:øl | En øl, tak. | ledger:tak | Tak closes an order for a beer; en øl is an ordinary serving. |
| da:sol | Vi sidder i solen. | ledger:i | Lowercase i is in; solen is definite singular. |
| da:træ | Det er et træ. | ledger:et | Et is the neuter article; initial Det identifies the object. |
| da:blomst | Tak for blomsten. | ledger:tak | Tak for expresses thanks received; blomsten is definite singular. |
| da:fugl | Der er en fugl i træet. | supplemental:da-chunk-existence | Existential statement introduces a bird; full slot includes the location. |
| da:hest | Er det din hest? | ledger:det | Det identifies an animal; not a neuter-pronoun agreement lesson. |
| da:bil | Undskyld, er det din bil? | ledger:undskyld | Undskyld gets attention politely before an ownership question. |
| da:by | Velkommen til byen. | ledger:velkommen | A welcome to the town; byen is definite singular. |
| da:skole | Hvor er skolen? | supplemental:da-chunk-where | Whole location chunk with a definite singular noun and required question mark. |
| da:bog | Her er din bog. | ledger:her | Her introduces a book handed over or shown; retained sample wording. |
| da:ben | Benet er okay nu. | ledger:okay | Okay describes the leg's condition now; prior discomfort is implied, not narrated. |
| da:fod | Flyt foden lidt. | ledger:lidt | Lidt gives movement extent; definite foden maps naturally to your foot. |
| da:arm | Løft armen igen. | ledger:igen | Igen requests repetition; Løft is an imperative. |
| da:finger | Hvad har du på fingeren? | ledger:hvad | Hvad asks what is on a finger; likely a ring or mark, without inventing a story. |
| da:næse | Du har lidt smør på næsen. | ledger:lidt | Lidt quantifies butter; added smør makes the quantity concrete. |
| da:tand | Her er min tand. | ledger:her | A child showing a lost tooth is a plausible context; without it this line is less universal. |
| da:hår | Dit hår er lidt vådt. | ledger:lidt | Lidt modifies degree of wetness; vådt agrees with neuter hår. |
| da:hjerte | Er det et hjerte? | ledger:et | Et focuses the article while identifying a heart shape; avoids anatomy terminology. |
| da:dag | Tak for en god dag. | ledger:tak | Tak for expresses gratitude after a day together; lovely is an idiomatic rendering of god. |
| da:nat | Det er nat nu. | ledger:det | Det is impersonal it in a time expression, not pointing to a neuter object. |
| da:aften | Farvel og tak for i aften. | ledger:farvel | Conventional parting thanks; one compact formula rather than multiple narrative clauses. |
| da:uge | Jeg er her i en uge. | ledger:en | En can be heard as a/one in a duration; i means for here, not its spatial sense. |
| da:stor | Ja, den er stor. | ledger:ja | Ja confirms size; den needs a previously mentioned common-gender referent. |
| da:lille | Den lille, tak. | ledger:den | Den lille selects the small item; referent is understood in the request. |
| da:gammel | Den er lidt gammel. | ledger:lidt | Lidt gives degree and softens an age assessment; den needs a referent. |
| da:ung | Ja, hun er ung. | ledger:ja | Ja confirms a person's youth; no comparative grammar. |
| da:glad | Jeg er glad igen. | ledger:igen | Igen means return to a state; changed from a less useful classroom-style question. |
| da:elske | Hvem elsker du? | ledger:hvem | Hvem is the object of elsker; English who is the natural conversational form. |
| da:ven | Hej, min ven. | ledger:hej | Warm direct address; min ven can sound affectionate and needs register review. |
| da:søn | Her er min søn. | ledger:her | Her introduces a person; søn is singular. |
| da:datter | Er din datter her? | ledger:her | Her asks about presence at the current location. |
| da:kage | Ja tak, lidt kage. | ledger:ja | Ja tak accepts an offer; lidt quantifies cake incidentally. |
| da:smør | Er der smør? | supplemental:da-chunk-existence | Existential availability question for a mass noun. |
| da:salt | Lidt salt, tak. | ledger:lidt | Lidt quantifies salt in a request. |
| da:sukker | Nej tak, ikke sukker. | ledger:nej | Nej tak refuses sugar; short conversational ellipsis is intentional. |
| da:kartoffel | En kartoffel mere, tak. | ledger:en | En means one with mere; a request for one more potato. |
| da:grøntsag | Hvad er det for en grøntsag? | ledger:hvad | Hvad er det for en ...? asks what kind; useful but more complex than plain Hvad er det? |
| da:lampe | Den lampe er fin. | ledger:den | Den identifies a specific lamp; fin is a simple evaluation. |
| da:værelse | Her er dit værelse. | ledger:her | Her shows the assigned room; replaced the less idiomatic welcome-to-your-room draft. |
| da:himmel | Der er skyer på himlen. | ledger:der | Existential introduction of clouds; himlen is the definite form of himmel. |
| da:regn | Der er regn på vej. | supplemental:da-chunk-existence | Existential der er plus idiomatic på vej; the phrase adds some learning load. |
| da:sne | Der er lidt sne. | ledger:lidt | Lidt is small quantity; snow is treated as a mass noun. |
| da:måne | Der er månen! | ledger:der | Pointing der with a definite moon: there it is, not a new existential indefinite. |
| da:stjerne | Er det en stjerne? | ledger:det | Det identifies a star; the actual target is det, not the substring et. |
| da:hav | Havet er lige her. | ledger:her | Her is location, strengthened by lige as right here. |
| da:strand | Hvor er stranden? | supplemental:da-chunk-where | Whole location question; stranden is definite singular. |
| da:park | Vi er i parken. | ledger:i | Lowercase i is spatial in; it must not be classified as plural you. |
| da:gade | Hvad hedder den gade? | ledger:hvad | Hvad hedder asks a street's name; does not claim the first-person name chunk. |
| da:kirke | Den kirke er gammel. | ledger:den | Den points to a specific church; gammel describes it. |
| da:hospital | Hvor er hospitalet? | ledger:hvor | Hvor asks location; hospitalet is definite singular. |
| da:butik | Er der en butik her? | supplemental:da-chunk-existence | Whole existential availability question; her supplies a separate location. |
| da:bank | Undskyld, hvor er banken? | ledger:undskyld | Undskyld gets attention before a location question. |
| da:penge | Her er dine penge. | ledger:her | Her accompanies handing over or showing money; penge is plural in Danish. |
| da:købe | Hvad køber du? | ledger:hvad | Hvad asks what is being bought; køber is present tense. |
| da:arbejde | Er du på arbejde igen? | ledger:igen | Igen means back/again at work; arbejde is a noun in på arbejde. |
| da:lærer | Goddag, er du den nye lærer? | ledger:goddag | Polite greeting to a possible new teacher; den nye adds weak adjective morphology. |
| da:tog | Er det vores tog? | ledger:det | Det identifies the train; vores means our, incidentally. |
| da:bus | Bussen er der. | ledger:der | Der points to location; Bussen is definite singular. |
| da:cykel | Den cykel er min. | ledger:den | Den singles out a bicycle; min is a possessive predicate. |
| da:fly | Der er et fly. | ledger:et | Et is the neuter article; existential construction is incidental. |
| da:køre | Okay, vi kører nu. | ledger:okay | Okay acknowledges departure; kører implies leaving by vehicle, not walking. |
| da:sove | Godnat, sov godt. | ledger:godnat | Godnat plus a conventional bedtime wish; sov is the imperative of sove. |
| da:løbe | Hvem løber der? | ledger:hvem | Hvem asks who is running; der supplies an incidental pointed location. |
| da:læse | Læs det igen. | ledger:igen | Igen requests another reading; Læs is the imperative, retained sample wording. |

## About row findings

Every About is general meaning plus use plus one other bilingual example, rather than an explanation of a particular board row. All 39 examples differ from every review linked to that target. Fixed chunks may use their exact canonical sentence because they have no linked review rows. The About table and JSON remain staged, including receptive and preview entries.

| Target | Alternative Danish / English | Author finding |
|---|---|---|
| ledger:hej | Hej, Anna. / Hi, Anna. | Informal arrival/departure uses distinguished. |
| ledger:goddag | Goddag, Peter. / Hello, Peter. | Daytime/formal register stated; native editor should check register strength. |
| ledger:godmorgen | Godmorgen, alle sammen. / Good morning, everyone. | Morning timing explained generally. |
| ledger:godnat | Godnat, mor. / Good night, Mum. | Bedtime/parting use distinguished from arrival. |
| ledger:hallo | Hallo, er du der? / Hello, are you there? | Attention/phone use; example avoids a new productive modal construction. |
| ledger:velkommen | Velkommen til Danmark. / Welcome to Denmark. | General arrival pattern til; place example. |
| ledger:farvel | Farvel, Anna. / Goodbye, Anna. | Parting formula; everyday alternative noted. |
| ledger:tak | Tak for hjælpen. / Thank you for your help. | Thanks and request functions separated; example is gratitude. |
| ledger:undskyld | Undskyld, er du Anna? / Excuse me, are you Anna? | Attention and apology both explained; example gets attention. |
| ledger:okay | Okay, jeg kommer. / Okay, I am coming. | Acknowledgement and acceptable condition both explained. |
| ledger:ja | Ja tak. / Yes, please. | Affirmative answer and polite acceptance distinguished. |
| ledger:nej | Nej tak, jeg er mæt. / No thanks, I am full. | Negative answer and polite refusal distinguished. |
| ledger:igen | Sig det igen. / Say it again. | Repetition or recurrence, not a special verb form. |
| ledger:lidt | Jeg er lidt træt. / I am a little tired. | Quantity versus degree explicit; recommends nogle få for a few individual objects without a categorical prohibition. |
| ledger:en | Jeg har en hund. / I have a dog. | Common gender; a/an versus one depends on context. |
| ledger:et | Jeg har et æble. / I have an apple. | Neuter article; English a/an is not a gender guide. |
| ledger:den | Den er min. / It is mine. | Pronoun and demonstrative meanings explained; omitted noun needs context. |
| ledger:det | Det er en bog. / That is a book. | Identification, reference, and impersonal uses separated. |
| ledger:her | Jeg bor her. / I live here. | Proximity/location and showing or handing over. |
| ledger:der | Der er en bus. / There is a bus. | Existential introduction explicitly distinguished from pointed location. |
| ledger:hvor | Hvor bor du? / Where do you live? | Location primary; degree with adjective acknowledged, not assessed here. |
| ledger:hvad | Hvad er det? / What is that? | General what and naming questions. |
| ledger:hvem | Hvem er du? / Who are you? | Person questions, including object use. |
| ledger:kan | Kan du hjælpe mig? / Can you help me? | Preview only inside known chunks; no productive modal mastery. |
| ledger:i | I er her. / You are here (plural). | Both lowercase preposition and uppercase plural pronoun; sentence-initial ambiguity explicit. |
| ledger:skål | Skål, alle sammen! / Cheers, everyone! | Receptive toast, with bowl homograph warning to prevent false sense counts. |
| ledger:om | Bogen er om dyr. / The book is about animals. | Receptive preposition; examples show context-dependent meaning. |
| ledger:hen | Gå hen til døren. / Go over to the door. | Receptive direction, not stationary location. |
| supplemental:da-chunk-name | Jeg hedder Anna. / My name is Anna. | First-person introduction with a real name slot. |
| supplemental:da-chunk-origin | Jeg kommer fra Danmark. / I am from Denmark. | Origin introduction with a country; avoids using a board noun as a name or place. |
| supplemental:da-chunk-dont-understand | Jeg forstår ikke. / I do not understand. | Exact repair sentence is itself the example; no linked reviews to duplicate. |
| supplemental:da-chunk-repeat | Kan du sige det igen? / Can you say that again? | Exact fixed repeat request, with punctuation retained. |
| supplemental:da-chunk-slower | Lidt langsommere, tak. / A little more slowly, please. | Exact fixed slower request, with punctuation retained. |
| supplemental:da-chunk-meaning | Hvad betyder det? / What does that mean? | Det refers back to something requiring explanation; no contrived quoted board noun. |
| supplemental:da-chunk-where | Hvor er min mor? / Where is my mum? | General location request; er unchanged with number. |
| supplemental:da-chunk-existence | Er der kaffe? / Is there any coffee? | Existential and interrogative patterns; no spatial gloss for introductory der. |
| supplemental:da-chunk-immediate-help | Hjælp! / Help! | Alternative help forms distinguished; example chooses the shortest existing form. |
| supplemental:da-word-uh | Øh, jeg ved det ikke. / Um, I do not know. | Receptive hesitation, not a required productive word. |
| supplemental:da-word-thing | Jeg mangler en ting. / I am missing one thing. | En ting and tingen singular explicitly; plural ting acknowledged separately. |

## Coverage matrix

All 100 local board records are absent; the parent separately verified the actual final 100 board/100 review rows with zero same-word Danish collisions. Review presence below includes primary and incidental surface matches. P = productive-target, V = preview-as-chunk, R = receptive-ambient, all at city 0. Every About is present and accepted within this bounded bank. Retained counts refer only to the inventory's mapped existing teaching fields, not deleted/replaced board examples. Case-insensitive surface matching cannot decide i/I or grammatical sense. In particular, da:måne begins Der er but points to the visible moon; an existence-chunk surface match there is not existential teaching evidence. The plural I in da:drikke and spatial i in da:sol/da:park are deliberately distinguished in the row findings.

| Target | Stage | Primary review word IDs | Review surface rows | About | Retained fields | Gaps |
|---|---|---|---:|---|---:|---|
| ledger:hej | P | da:søster, da:ven | 2 | accepted | 4 | — |
| ledger:goddag | P | da:bror, da:lærer | 2 | accepted | 0 | — |
| ledger:godmorgen | P | da:far | 1 | accepted | 0 | — |
| ledger:godnat | P | da:sove | 1 | accepted | 0 | — |
| ledger:hallo | P | da:mor | 1 | accepted | 0 | — |
| ledger:velkommen | P | da:by | 1 | accepted | 0 | — |
| ledger:farvel | P | da:aften | 1 | accepted | 1 | — |
| ledger:tak | P | da:mad, da:vand, da:øl, da:blomst, da:dag | 18 | accepted | 2 | — |
| ledger:undskyld | P | da:bil, da:bank | 2 | accepted | 1 | — |
| ledger:okay | P | da:ben, da:køre | 2 | accepted | 0 | — |
| ledger:ja | P | da:rød, da:stor, da:ung, da:kage | 4 | accepted | 2 | — |
| ledger:nej | P | da:hvid, da:kød, da:sukker | 3 | accepted | 0 | — |
| ledger:igen | P | da:hånd, da:arm, da:glad, da:arbejde, da:læse | 5 | accepted | 1 | — |
| ledger:lidt | P | da:mælk, da:kaffe, da:mund, da:hoved, da:fod, da:næse, da:hår, da:gammel, da:salt, da:sne | 11 | accepted | 0 | — |
| ledger:en | P | da:pige, da:ost, da:fisk, da:uge, da:kartoffel | 12 | accepted | 5 | — |
| ledger:et | P | da:æble, da:træ, da:hjerte, da:fly | 6 | accepted | 4 | — |
| ledger:den | P | da:stol, da:dreng, da:sort, da:lille, da:lampe, da:kirke, da:cykel | 13 | accepted | 0 | — |
| ledger:det | P | da:barn, da:kat, da:hest, da:nat, da:stjerne, da:tog | 11 | accepted | 4 | — |
| ledger:her | P | da:seng, da:bog, da:tand, da:søn, da:datter, da:værelse, da:hav, da:penge | 11 | accepted | 5 | — |
| ledger:der | P | da:hus, da:øje, da:dør, da:himmel, da:måne, da:bus | 17 | accepted | 3 | — |
| ledger:hvor | P | da:hund, da:hospital | 5 | accepted | 4 | — |
| ledger:hvad | P | da:spise, da:finger, da:grøntsag, da:gade, da:købe | 6 | accepted | 1 | — |
| ledger:hvem | P | da:køkken, da:mand, da:kvinde, da:elske, da:løbe | 5 | accepted | 0 | — |
| ledger:kan | V | — | 0 | accepted | 7 | no-review-focus |
| ledger:i | P | da:drikke, da:sol, da:park | 8 | accepted | 0 | — |
| ledger:skål | R | — | 0 | accepted | 0 | no-mapped-surface-source |
| ledger:om | R | — | 0 | accepted | 2 | — |
| ledger:hen | R | — | 0 | accepted | 0 | no-mapped-surface-source |
| supplemental:da-chunk-name | P | — | 0 | accepted | 2 | no-review-focus |
| supplemental:da-chunk-origin | P | — | 0 | accepted | 1 | no-review-focus |
| supplemental:da-chunk-dont-understand | P | — | 0 | accepted | 0 | no-review-focus; no-mapped-surface-source |
| supplemental:da-chunk-repeat | P | — | 0 | accepted | 1 | no-review-focus |
| supplemental:da-chunk-slower | P | — | 0 | accepted | 0 | no-review-focus; no-mapped-surface-source |
| supplemental:da-chunk-meaning | P | — | 0 | accepted | 0 | no-review-focus; no-mapped-surface-source |
| supplemental:da-chunk-where | P | da:skole, da:strand | 5 | accepted | 4 | — |
| supplemental:da-chunk-existence | P | da:vindue, da:æg, da:fugl, da:smør, da:regn, da:butik | 14 | accepted | 3 | — |
| supplemental:da-chunk-immediate-help | P | — | 0 | accepted | 1 | no-review-focus |
| supplemental:da-word-uh | R | — | 0 | accepted | 2 | — |
| supplemental:da-word-thing | P | da:bord | 1 | accepted | 4 | — |

## Deliberate focus gaps and retained teaching

Eight eligible focuses have no review row: kan, name, origin, dont-understand, repeat, slower, meaning, immediate-help. The exact repair/help formulas contain no City 1 board word. Adding a disconnected clause or quoting a board term would manufacture coverage. The name/origin slots are left for real introductions rather than making a common noun into a person/place. Kan stays preview: no arbitrary modal sentence was introduced to make it a focus.

27 of 35 eligible primary targets link to review rows. Twelve authored About records are not reachable through the review selector: the eight focus gaps above plus four receptive records (skål, om, hen, øh). Authored About presence is not selector reachability or teaching coverage.

Name, origin, repeat and immediate-help have actual Survival phrase coverage in `src/lang/da/survival.ts:34–66`, rendered by `src/ui/screens/TravelGuideBook.tsx:140`, as well as the mapped activity references below. Kan remains preview in fixed chunks. Slower has partial accessible Survival coverage at `src/lang/da/survival.ts:50–56`: `lidt langsommere` is rendered through TravelGuideBook but lacks the canonical `tak`. It is not wholly absent; the inventory’s narrower exact-source map still reports zero for the canonical slower chunk.

Dont-understand and meaning remain unserved in the defined mapping. Receptive skål and hen exposure gaps are reported, not solved; om and øh retain mapped sources. About examples do not erase these gaps. Here skål is the inventory’s receptive toast entry, not modal skal.

These are broader curriculum coverage limits, not justification for forced board connections or an automatic new About index. CONTRACT.md lines 69/71 explicitly report gaps without new quotas and limit the source map; no full City 1 teaching coverage is claimed. The retained-fields matrix below is the validator’s bounded map, not an exhaustive account of Survival phrase access.

Source aliases: C = src/lang/da/curriculum-cities-1-3.ts; G = src/lang/da/beginner-grammar-lessons.ts. Each reference gives item ID, exact field, activity mode and role. These are inventory-mapped surface occurrences in retained source material, not certification that the target is taught or assessed in that activity.

| Target | Retained references |
|---|---|
| ledger:hej | C :: sonderborg-situation-1 :: answer.modelDa :: supported-interaction / productive<br>C :: sonderborg-situation-1 :: audio[0].textDa :: supported-interaction / productive<br>C :: sonderborg-exit-interact :: answer.modelDa :: supported-interaction / productive<br>C :: sonderborg-exit-interact :: audio[0].textDa :: supported-interaction / productive |
| ledger:goddag | None in the defined inventory map. |
| ledger:godmorgen | None in the defined inventory map. |
| ledger:godnat | None in the defined inventory map. |
| ledger:hallo | None in the defined inventory map. |
| ledger:velkommen | None in the defined inventory map. |
| ledger:farvel | C :: sonderborg-situation-2 :: answer.modelDa :: supported-interaction / productive |
| ledger:tak | C :: sonderborg-exit-form :: visualDa :: grammar-in-use / controlled<br>C :: sonderborg-exit-form :: answer.modelDa :: grammar-in-use / controlled |
| ledger:undskyld | C :: sonderborg-situation-4 :: answer.modelDa :: supported-interaction / productive |
| ledger:okay | None in the defined inventory map. |
| ledger:ja | C :: sonderborg-situation-2 :: answer.modelDa :: supported-interaction / productive<br>C :: sonderborg-situation-4 :: audio[0].textDa :: supported-interaction / productive |
| ledger:nej | None in the defined inventory map. |
| ledger:igen | C :: sonderborg-situation-3 :: answer.modelDa :: supported-interaction / productive |
| ledger:lidt | None in the defined inventory map. |
| ledger:en | C :: sonderborg-manipulate :: visualDa :: grammar-in-use / controlled<br>C :: sonderborg-manipulate :: audio[0].textDa :: grammar-in-use / controlled<br>C :: sonderborg-due-review :: visualDa :: grammar-in-use / controlled<br>G :: sonderborg-articles :: examples[0][0] :: reading / exposure<br>G :: sonderborg-articles :: examples[2][0] :: reading / exposure |
| ledger:et | C :: sonderborg-notice :: visualDa :: grammar-in-use / controlled<br>C :: sonderborg-notice :: audio[0].textDa :: grammar-in-use / controlled<br>C :: sonderborg-discriminate :: answer.modelDa :: grammar-in-use / controlled<br>G :: sonderborg-articles :: examples[4][0] :: reading / exposure |
| ledger:den | None in the defined inventory map. |
| ledger:det | C :: sonderborg-situation-3 :: answer.modelDa :: supported-interaction / productive<br>C :: sonderborg-due-review :: audio[0].textDa :: grammar-in-use / controlled<br>G :: sonderborg-articles :: examples[0][0] :: reading / exposure<br>G :: sonderborg-articles :: examples[2][0] :: reading / exposure |
| ledger:her | C :: sonderborg-notice :: visualDa :: grammar-in-use / controlled<br>C :: sonderborg-notice :: audio[0].textDa :: grammar-in-use / controlled<br>C :: sonderborg-transfer :: answer.modelDa :: grammar-in-use / controlled<br>G :: sonderborg-articles :: examples[3][0] :: reading / exposure<br>G :: sonderborg-articles :: examples[4][0] :: reading / exposure |
| ledger:der | C :: sonderborg-notice :: visualDa :: grammar-in-use / controlled<br>C :: sonderborg-notice :: audio[0].textDa :: grammar-in-use / controlled<br>G :: sonderborg-articles :: examples[4][0] :: reading / exposure |
| ledger:hvor | C :: sonderborg-situation-4 :: answer.modelDa :: supported-interaction / productive<br>C :: sonderborg-exit-interact :: answer.modelDa :: supported-interaction / productive<br>G :: sonderborg-articles :: examples[1][0] :: reading / exposure<br>G :: sonderborg-articles :: examples[5][0] :: reading / exposure |
| ledger:hvad | C :: sonderborg-situation-1 :: audio[0].textDa :: supported-interaction / productive |
| ledger:hvem | None in the defined inventory map. |
| ledger:kan | C :: sonderborg-transfer :: audio[0].textDa :: grammar-in-use / controlled<br>C :: sonderborg-situation-3 :: answer.modelDa :: supported-interaction / productive<br>C :: sonderborg-situation-4 :: answer.modelDa :: supported-interaction / productive<br>C :: sonderborg-exit-interact :: audio[0].textDa :: supported-interaction / productive<br>C :: sonderborg-exit-form :: visualDa :: grammar-in-use / controlled<br>C :: sonderborg-exit-form :: answer.modelDa :: grammar-in-use / controlled<br>C :: sonderborg-exit-form :: audio[0].textDa :: grammar-in-use / controlled |
| ledger:i | None in the defined inventory map. |
| ledger:skål | None in the defined inventory map. |
| ledger:om | C :: sonderborg-manipulate :: audio[0].textDa :: grammar-in-use / controlled<br>C :: sonderborg-situation-3 :: audio[0].textDa :: supported-interaction / productive |
| ledger:hen | None in the defined inventory map. |
| supplemental:da-chunk-name | C :: sonderborg-situation-1 :: answer.modelDa :: supported-interaction / productive<br>C :: sonderborg-exit-interact :: answer.modelDa :: supported-interaction / productive |
| supplemental:da-chunk-origin | C :: sonderborg-situation-2 :: answer.modelDa :: supported-interaction / productive |
| supplemental:da-chunk-dont-understand | None in the defined inventory map. |
| supplemental:da-chunk-repeat | C :: sonderborg-situation-3 :: answer.modelDa :: supported-interaction / productive |
| supplemental:da-chunk-slower | None in the defined inventory map. |
| supplemental:da-chunk-meaning | None in the defined inventory map. |
| supplemental:da-chunk-where | C :: sonderborg-situation-4 :: answer.modelDa :: supported-interaction / productive<br>C :: sonderborg-exit-interact :: answer.modelDa :: supported-interaction / productive<br>G :: sonderborg-articles :: examples[1][0] :: reading / exposure<br>G :: sonderborg-articles :: examples[5][0] :: reading / exposure |
| supplemental:da-chunk-existence | C :: sonderborg-notice :: visualDa :: grammar-in-use / controlled<br>C :: sonderborg-notice :: audio[0].textDa :: grammar-in-use / controlled<br>G :: sonderborg-articles :: examples[4][0] :: reading / exposure |
| supplemental:da-chunk-immediate-help | C :: sonderborg-situation-4 :: answer.modelDa :: supported-interaction / productive |
| supplemental:da-word-uh | C :: sonderborg-listen :: audio[0].textDa :: listening / receptive<br>C :: sonderborg-situation-3 :: audio[0].textDa :: supported-interaction / productive |
| supplemental:da-word-thing | C :: sonderborg-transfer :: visualDa :: grammar-in-use / controlled<br>C :: sonderborg-transfer :: answer.modelDa :: grammar-in-use / controlled<br>G :: sonderborg-articles :: examples[0][0] :: reading / exposure<br>G :: sonderborg-articles :: examples[1][0] :: reading / exposure |

## Verification and remaining boundary

- node prototypes/finish-review/implementation/validate.mjs --draft: passed after correcting malformed own rows; 0 errors, 0 missing review, 0 missing About, expected 100 missing board IDs.
- node prototypes/finish-review/implementation/validate.mjs --draft --report: passed on final JSON; 39 coverage rows, 27 focused targets. The matrix above preserves focus, surface presence, source references and gaps.
- node prototypes/finish-review/implementation/validate.test.mjs: 46 passed, 0 failed. These test structural/runtime contracts, not Danish naturalness.
- The validator recomputes the inventory and found no source drift. The inventory was not regenerated or edited. Node 26.5.1 emits the existing experimental stripTypeScriptTypes warning.
- Parent supplied draft-validator/diff success and actual final cross-bank verification. This checkout cannot reproduce the cross-bank comparison with its empty board envelope. Bounded accepted status is explicitly authorized by the parent; full three-bank acceptance remains unavailable with 100 missing board rows.

No app/build/audio/native tests were run for these staging-only prose changes. A nested child-process attempt to capture the report was blocked by local EPERM; direct CLI validation and a shell pipe succeeded without changing permissions.


Bounded revision verification: draft validator and draft coverage report passed after the six-record revision; contract tests passed 46/46. Exact before/after row comparison confirmed only the three named review rows and three named About records changed, with all other author rows preserved. Diff whitespace check passed. That revision did not grant acceptance. The parent has now accepted this bounded sentence+About bank for integration, preserving the 27/35 primary-focus limit, 12 About records unreachable via review, and all retained/partial/gap distinctions. No app/schema/Survival edits, bake, network, install, commit or push. Stop for parent verification of the finalized artifacts.

## Final successor acceptance fingerprints

Generated with the exported `editorialFingerprint` from `validate.mjs` after setting all 139 statuses to accepted. Approval is excluded by that helper. These fingerprints bind the exact final prose, versions, identities, stages and spans. No historical Sol stamps or invented signoff are used. Parent acceptance is the authorization supplied in this task, not a claim that the parent has already inspected these final serialized artifacts.

### Review rows (100)

```text
da:mor 37edbed900ac2f3b149d1d8d743a68feec762ed418e2e96f327a5c8965826101
da:far 0b16fbdc2086757c07d93631470164eaf7a958c85070891c2a77e91ed40d6b6e
da:barn ba8f7446f650fdbec460b9252b4765988b3d54c72b71e5e3df32a172c5d9a93c
da:hund 1a2dff41846e48ab5f6b01cc60098fdd1fbcef6dc7a1ef6925497b503ef67f82
da:kat 20f8218692e6a1067f2f33cb607ee7e30e75451247d8db86774d07db087e97db
da:hus 5f16aafca51fe1098520dc5923c888ff05735fc1d3639b5d94140027dd68cab5
da:bord ae3e385333d3bf0e1790dedcc9a3b48548080f20a5743b07a46a54d417ead159
da:seng c39f2b7af12742d5cb9eb07f41bd15d8774857a362e63bd66b61497185553a27
da:mad 7111b0eb11e9fe198f6489de742f967a8d17b14bd0e91fb5f9b9fb3b6e7b17e3
da:æble b1abd1c87f3041c155c8297e7f21b619dd627efa55b474b021f6d332a844a840
da:mælk 5d8cdc3213de97859863d64b291098a29fc4df2c89f8418ac15cea067c280dde
da:vand 1983a7426168ef15f3f86461abeb7c55c09214307c94ccda4dc0f0b5442adf82
da:kaffe 9f3456deea3cc2087ccb5630bc5ec83300509d229d5208c009f8b202e1723a56
da:øje e46c6e764be1f57ef2a75f6e1586736fb4b046f079b44e55b3f866abe0f12498
da:hånd f858976917c012702c5422954a6f26027fd5826bc12670bfb8b795866239fd08
da:dør 3a2256e0cade673680a16c2e0d3e363047b90c427d861a1075ad24e7451dc023
da:vindue 946e10cf058866fa0b39d4bb6d07825e1bc4450337419b79d76bfce1318172a3
da:stol 77992003e7088710fd5d89090e39f168ff47b57aa409e365ce0e46c55b3894ef
da:køkken a564ad76f8708b57e9971da69c6cada269f6bafd1ce0b2b13af88267e3eaf8a3
da:mund 44179c6a26580964fd00ce8ba62fe020bc8ae5543550e2c0e4e2e6987646b0ae
da:hoved 2d68caf305f26d028752747972eec92f7e9fb96225728fc20317ed5375f81b4a
da:mand 306f427559e903034ae758b3b905385f64ce787f7dafd7a5253ebb66124b369c
da:kvinde 6e196ef35267e23a3ec04b4fbdbc15577094962025639af2af28729b51e59980
da:pige b88f4b1beb8c918764eb272adcb5b753e42b2e8a2a39c8f8d51353e29746f01e
da:dreng b8d40dfee6b1deac9f0dc29676a5784b446ac036540c2594ef6fbe534633f873
da:bror 74e100e85f6be81a9644e0b1e2d22d45cda4264fbffc71a9225b9da5b7f07bfe
da:søster 9cff08d8b2ca9cab754795346cf848e88db134556b630c74c1123f5db34f8663
da:rød 1665b2204339dfff773f28216ea4b80306da542bf4670290ab03914c3b74f69e
da:hvid 4fc89573ef1193ddea20f781d5275ccc4ce21f2411e28b3a74fa6201e4485cfb
da:sort c330765ac3ef08da968e74a0285f3a10832583e5aaa0ff2e992659b2047071a1
da:ost 6cf7928c5de7fefc163fd4af44d67feac8f0b990e1d1fd443cce29434cd4ffec
da:æg 5df8f2a31eed555d25ac2cb7a487432dcfb9691bf9547bd2b109e21e82112080
da:kød 9a4efef3184787dfa84ad0bbf4193eecb32821a231f4397d31f7c407ae053f50
da:fisk be7ecfb4c78d44548eb05d269c20b908110158d6daf7fdcdec674681c04553f4
da:spise 3332d85bce40fb2b5b02b72fa24f918768a6ee1c536272e6f7d9306c8c9f2e63
da:drikke d4e0cf3a9b0bae32e8270260c3e0f273e6a7d4c3fd6091373fb1b634138b8a2a
da:øl 68d767b10799a5daf6b47dda9a3d32d7f35d078d5ad4f1fc6d2747acb54b3cfc
da:sol f05265afe6574ddcb4a531594931223e82770a83bc279926137b0e40714cb302
da:træ b9ad958c7c3ebc43a19b3f94ae9f0dfbc01d0a2449bd384c7a74c62dbdc752f4
da:blomst 01ae84f325659793c04fe0933d603f508d8420f9018d709f7a373c5120404f04
da:fugl 325ef72028226eb6893af46d5d5e7f616f20f89f35b8fab7a6572352f58f254e
da:hest 0f2903ca26dd0a5a008e9e1e35f632686412a8dc5abe8cfc9c3c200cb47eea2a
da:bil 8d7ef17726081a88d331184039191cf177992e23199b3fed3680e6865394994a
da:by f96ff2e6210b19b531dd44089192e47b4a5650e9fef680876bba8130412de6fb
da:skole c0bf1e51b5e0972680058fbfd19006114fac984b5494d4c28da5777255e553a3
da:bog 0bdc719131462d0103b532d95d5587db4f904d926da27f59cda6c067afe699a7
da:ben b38e337d0f755cc3a21aa388c54beb7a10744d4b10102b98eebcda126640d15a
da:fod 6a55cdf706a00bc6581c3d3f10fed26e68ff6a6a30ff184f119ec01590c1e5fa
da:arm 31f5188d687e49690e8c6b9b813c70326d20d36128bfbd42af3200ce8062bac3
da:finger 590f75cbdf7afa83ea52c62ee699148f1a7a7c72d5255c7c63114f72de0836f1
da:næse 5f496a0e7f9796691809fb7a2512b147acdf2e9e914f2841e50db07f2bd546e3
da:tand dfbe42e63b8413216f0d53ba596708e796d7b0d5b3e33334b79b1273f53a4e5a
da:hår c1e8ee2219ec65ec9b2fd48871e58ace32a43f1e7b3470d5f836f33ce9fbd2e2
da:hjerte 175d45a06bac059c88e8e43e73e698cfdf23183c7dbf0b2b0e23b18b09cec078
da:dag 4b70a82430abbbf168e7df87701046cfa1bd98057c1a6553c6d0a93eb8c7e3e3
da:nat 8157132141881eae8d89a6e0953f51ecf76188b6ab9419d28ffa4a1a075a70c3
da:aften ab4d1108ba555159558390a5313ce974fe3b5af471cc61a404ee6ffeb7aeb56a
da:uge 24d3c9e70d9fb0ffe0e71d8921d17cb8d38a4038c3208aee5b678b66ebf69566
da:stor 1d361e2fc991a688ad32f3f4a129247d01c41ac2a9c444833541a5d7ae2b6a59
da:lille 8ce337f34cb383e238c472223b0703a5ad10547e3132b438e438a6c328a77798
da:gammel 1b59220b535d18165af843f0fd1cfbc49dd0034e3afd4551b553cdb890d35552
da:ung 6792491ea1c551036bafcd66e5aaa2bff6f4762767dccc24998683604d79ec46
da:glad fea0fe47d109209481a038f25081d5cf3c269823d193bcd7c7662d87211ff153
da:elske 6c1c3369c5a175fa984c27f743d26c45bcfd262d3aaefb0f89020fe17f250e3d
da:ven 1620ffb3209b01e3f6fc7743d37131181fc23106a008791524e4aec83bca3b5e
da:søn 34a0465cf4bf3b5c363caad9a42439013d701dda7d1947d68d26aae7dcd8f495
da:datter aaf7dc00411c19d980b771f6c1d2bcdb204140b63b49874c9b4414a6a24fe789
da:kage 0404ba004f41a20260b3aec6d88dc2a65fe9396f3a7abaadfe16cad594293aa9
da:smør 8b2158f6c4ff3acdcdf2540efac5f37b5ead09903a61c6387fadb06167c82501
da:salt 72383d33096bdb2e3eb1ff95913364e583bae60b9484c67c18e9c3c5ad0d49d2
da:sukker 718cadb5c1b65719d82a138f8ba1e21f7560e82c027ed72b4ab7b390ae7d7e2e
da:kartoffel 01f3a260df6ee512722be6ba75127abb6758568e16d290dcc585d28cae721153
da:grøntsag d147ac3d7d021321ef089322da0964efa0e84eeff61af5eb23886243238267be
da:lampe 3716f70bbdcd561e8208203a907984fb2a1c188ca1059431cb9ee0b63929c0df
da:værelse 69da892132fba57b9c8c101e29569abf01c58bebfddb3eb54c61128c36699b9e
da:himmel 6d3ec70ea62e50920cbb94c136679e6095f430a71d29a1a8fac262590cf3c0e3
da:regn 47d5cd8df451e91e9e5ddbfbc64fe5a66189528ab85335b13e4c15be57c92af8
da:sne 547859b4d64c3b620c41319c63d053334b81a2bc0c74ef59ca58788ec0d16b9c
da:måne 9289b2f4d9bfff5d9d08dd614be0f46ef9ba557b862b585e16a1a55fc9c4f462
da:stjerne 3d4ce2aada5da6536b03e48bceac72a2cf8fa50af84e3d5bc91bd0dcddcc0ff6
da:hav 7d19c88f4ca90411466e59aefc51c3a71d8732ef4caaaa082393b303a72de90b
da:strand f37843935695647e1db00111e4252d9e4982908f64c9f491ef26deb4c34cc339
da:park d06837c558cd7ef8e3dda50b1b12b9314cfd3d3b1f72101799d3d282a3e8249b
da:gade 54ad7f729056e39a76325eab173141e303bcb76bbfe17a1c5ca9b567d23e7a79
da:kirke 7f31844118fbf5bdbb456ddbaa1367fb23067f9f3ded131eb4f9c85be6adab50
da:hospital 8f9ffe39280693afd502cacbe7543989eae092f333a8880701168a9ff0a598d5
da:butik a0678a677138b10a4221c445295aa760b2dfa24d09915ffe71eff1e327063cc5
da:bank 1584de992718220ad6d47f216ea975b189abc182d125c0fedb497ebf385f024e
da:penge 005778dc11bdf9af68238dbfe989a48e959cec9c66f5da1b99f0584ae194c932
da:købe a4588de3d317917b23e0401a85f0a09fcaa56f7a60bfbfeb3296187d4c54baa4
da:arbejde 1e949ff85648f037282990038e647405fb567610085dcf96e8f6297c1e259063
da:lærer 2826244d49478069e8138ae0a13c614b8c0483485e6659a3f6993e978be1d294
da:tog 8189e95822c7d94711d8cab6664a821ccd0cbaca55ae2be8cccded9f96f4efb9
da:bus 5d2140583868b4fc3fb93cff5fc786948fa5ec57985cf96fbdeae423c959a711
da:cykel e81b185ab7b8a8908041d8d9476f07b27e90b67cb0a1fad90ecbf56d1faeeb00
da:fly 30931ac27460aa1e23130cd1a98665a82460779ad288d7541803e949eca792c8
da:køre d06ae5284c49ce93d03ec57f6a4cb405a06ca603c57add5c8692c698d3f32ef1
da:sove a5f99d870ff496b8869de5ad685f09afb6767a94e12d5c24ddefc69f5f6937e2
da:løbe 623163cb59990ed1532a14260463b39328d5bb30aab592afbb61cd5b1d8b8762
da:læse c90d30ab71f2868d1721b4549f49d0dea116ba89532276a6fc5b70ebffc4caf6
```

### About rows (39)

```text
ledger:hej ab3eed7557d6b58f8c33fa2060a08a394dca5367793be133d6ec351cf257c15f
ledger:goddag 280c90ef1d666a15b5629445a3fce3474a74c8b426b6cca60144d4682a2744b6
ledger:godmorgen 51ea0f56073e9a299d2dde5dd9cb966dfca9790a36ba54b81813e99e8a25942c
ledger:godnat 31b447813eaf7c6cdc74821b3697e2586acfd01e0ffcf875454a7a2178f489b6
ledger:hallo f4eaf97ea6167d1a5ee8643e88d7bdc7558641c5c3f2cfa3313985126f58edb7
ledger:velkommen d57a3fb9574dc46a3f4e9ce4527a7eaa589d2c7223064b86ac48bfa22c967fdc
ledger:farvel ab23fae27cafbd12ed3f44f454a3d7943bcc1eac785f34619c70965b3357475c
ledger:tak 594c7cebdd8c386338db13eadd9a260980b3ff65e1312785b7a1b5b9419f054e
ledger:undskyld e50d4d2106f880f2fa2846b28bc6904bb920c651c5cdb9243860c8486d9f1778
ledger:okay 277df698ccc6b0ae3bea1378489f9393f4319b9bae1a809c7c7f8d0008c9d4fb
ledger:ja 9c8d608e57915886cdd7b7d4e87217be5b6bac66565b0a1f60689128123039da
ledger:nej 21d074172a280c2b4a3cbbad0eb55c3ad593822255336cbc2a1d5cb0f46eed00
ledger:igen 88794c7fc64915d82615f9ab9baf4e1b7a11cfe17a837659333aa0b955fa4567
ledger:lidt c1796482e9416a1bb25b8a2ce2e8d9645a3c175e01b302cb1b889896b2ed110e
ledger:en f681046945e7a69fca779c7c3398a4b94078653005e82f5b5b012dc472eeb493
ledger:et 0f784f01a7f5718c04f50117f224e857a3ddee6b4bda929339471fbc78421dc2
ledger:den 949572123869f811cae3373529191546d4dfcb709bb881cbd63f65d247598707
ledger:det 29511ec864e92bbfa83133eaed02a2d641c79bdd1c38f9df10c5210ef6a6b4d5
ledger:her d67908ee70b750c1981309c1e8bb82fafe8f7a0960655f91850b65c62ceff405
ledger:der 1d626dc425a3ad4ccd6453e0c8c03217d927658641ea82d01a3fb0c2e4bc028e
ledger:hvor f80c9722e86f543254dd7dd18d18045859ec7d72df86623aad27eb8e9465e655
ledger:hvad 8966b413cb3f4812929823f2cb7a81775dd94b3f1a391e1606045d18666607da
ledger:hvem 4f937ccbbe1e68eb743191cd3af4143dfe35711837cfe8668b82b798c132a6d2
ledger:kan 590cc9f197913721131ec89735ca2f685fc543010a4ff1687c74597ca68de746
ledger:i 64ef1212bd9b3bf5149f26e6bc4002b61b74cc272f6f6c8dea05f7e736a1f991
ledger:skål 5de6ecbba76af4678e6fcc2c43b5f285adbcd7655f26a96ca9ab04834de9615c
ledger:om 2d60eab5f1f813400882a6130d34d5ad34c11cde50e47755a5fe457a70189554
ledger:hen d59fe09998604ed554bace571631d5be9130035d6da252054ff4902091f863eb
supplemental:da-chunk-name 085f58714574316ab55a33f64efeac4bce9c33ce0eb8937663a753361d4f7754
supplemental:da-chunk-origin 0a18a626b502b61c8d8a747de5130ceef88d62ca0b111d002e95f58e44d067e0
supplemental:da-chunk-dont-understand a2968aa6159e6e5b6c101b90c35b8c038e35204107c9a28d389f8079f7ff3d4a
supplemental:da-chunk-repeat cff7b0cf6e3ce89ace539695cdff324dfc196a672e692bd321c5aa93bc39d5a8
supplemental:da-chunk-slower d9a70ce20dfff4fb04738e7adf31b1a22f57712476686267b0f49f9cffbe8661
supplemental:da-chunk-meaning ba867b525b4f12b627595312475dc74e70a26b7ff734552d7caf640abea6cc24
supplemental:da-chunk-where 44c320d2190fd4dceb7c4ce00c6e30ac2793d62c9c97c122068b8b6e4da2b520
supplemental:da-chunk-existence 1aeedd9e5d0907e1835413022e7ab6a05281736473681a226d17b8a06e810816
supplemental:da-chunk-immediate-help 4ea763f03df597a1d0c76a17d812b07854d9ab0e1a579d719c94767fec8998c0
supplemental:da-word-uh 6bac0cee02990bc6b2ae8eaa28a1ab77d58ad1a04260bb4b233678828eadbf1e
supplemental:da-word-thing 9a9c8476ac616a5a38a6c14b8cb8122c51d3359cd6e60cb35a1b1211fcf6af11
```

Finalization check note: the first accepted-row draft run rejected the evidence because the validator requires the entire evidence string to be trimmed. Removed the terminal newline and rehashed approvals; no row content or fingerprints changed.