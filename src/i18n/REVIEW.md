# Who has read these translations

> **Current.** Updated in the same PR as any translation work (UL7).

The gates guarantee that nothing is MISSING. Only a person guarantees that it
is RIGHT. This file is the difference, and it is what a release note quotes:
a language listed as machine-authored ships labelled as such.

| Language | State | Reviewer | Date | Covers |
|---|---|---|---|---|
| English | source | Kristoffer (owner) | ongoing | everything |
| German | read line by line, one reader | Claude Fable | 2026-09-11 | all seven sections, 188 of 671 values revised |
| Spanish | read line by line, one reader | Claude Fable | 2026-09-11 | all seven sections, 189 of 671 values revised |
| Chinese (Simplified) | read line by line, one reader | Claude Fable | 2026-09-11 | all seven sections, 340 of 658 values revised |
| French | machine-authored, UNREAD | — | 2026-09-12 | all seven sections |
| Portuguese (European) | machine-authored, UNREAD | — | 2026-09-12 | all seven sections |
| Dutch | machine-authored, UNREAD | — | 2026-09-12 | all seven sections |
| Polish | machine-authored, UNREAD | — | 2026-09-12 | all seven sections |
| Swedish | machine-authored, UNREAD | — | 2026-09-12 | all seven sections |
| Norwegian (Bokmål) | machine-authored, UNREAD | — | 2026-09-12 | all seven sections |
| Hungarian | machine-authored, UNREAD | — | 2026-09-12 | all seven sections |

The 2026-09-13 integration adds the German-preview labels and Guide titles to
the seven new catalogues and removes retired Settings copy. These additions
are machine-authored and have not received a separate native-speaker review.

The 2026-09-24 daily-game-limit upgrade and self-hosted Casey error copy were
added to all eleven catalogues. Non-English wording is machine-authored and has
not received a separate native-speaker review.

The 2026-09-25 developer-continue label was added to all eleven catalogues.
Non-English wording is machine-authored and has not received native-speaker
review.

The 2026-09-27 offline-mode copy was added to all eleven catalogues:
- the Settings section with its first-time explanation and iPhone list;
- the in-round "no internet, play offline?" offer and its button;
- offline Casey's thinking line;
- the reworded download strings.
Non-English wording is machine-authored and has not received native-speaker
review; the owner reads German. The same day added its "Experimental" tag and
the explanation's opening sentence, also machine-authored outside English.

The 2026-09-27 self-build copy (Settings → Casey’s AI: your own AI key, Gemma on
this iPhone, your own Casey server, and the three own-key error messages) and
the reworded "set up Casey" message were added to all eleven catalogues, on
`open-source/1.0`, followed the same day by the first-run offer of Casey's download
(`ossGemmaFirstRun`) and a reworded Gemma choice. Non-English wording is
machine-authored and unread.

The 2026-09-27 welcome line (Casey's 900-words coverage line) replaced the old
one in all eleven catalogues. Non-English wording is machine-authored and has
not received native-speaker review.

**Casey's own voice is tracked separately**, because it lives in the Worker
rather than the catalogue (`proxy/casey/player-language.js`): the fifteen
sentences she writes a rationale, a reasoning and an error message with.

| Casey pack | State | Reviewer | Date |
|---|---|---|---|
| German, Spanish, Chinese | read and revised | Claude Fable | 2026-09-12 |
| The other seven | machine-authored, UNREAD | — | 2026-09-12 |

**One reader is not the same as reviewed.** Each language was read end to end
against the English and the glossary, by a reader asked the four questions
below rather than "is this accurate". That caught real defects — see the next
section — and it is a far better starting point than the machine pass. It is
still one pass by one reader, and a human native speaker will find more. Treat
the state as "reviewed once", not "signed off".

## What the first reading actually found

Worth recording, because all three readers found the same SHAPES of problem
independently, which says something about where the next one should look.

- **The pack/wrap distinction collapsed in Casey's teaching tips** — in all
  three languages, in the very lines that teach it. The glossary existed to
  prevent exactly this and the machine pass walked through it anyway.
- **One word doing three jobs.** German used `Tipp` for a guess, for Casey's
  tip, and for a tap. In a game whose vocabulary is Hinweis-and-raten that is a
  comprehension bug, not a wording one.
- **A verb that presumes success.** Spanish `adivinar` is telic, so "Casey
  adivinó X — carta neutral" says she got it right and then says she did not.
- **Register slips the type system cannot see.** The Spanish rules card was in
  *vosotros*, which is Spain-only plural; one tour line said *nosotras*, which
  misgenders a male player on the first screen he reads.
- **Typography.** A third of the Chinese changes were half-width punctuation
  and spacing left over from the English.
- **Three defects in the ENGLISH**, found because three readers compared it to
  itself: a truncated tooltip ending in "— r", `${n} lesson` with no plural,
  and an accessible name interpolating the stored English `won`/`lost`.
- **One false alarm, worth knowing.** All three flagged Settings for saying the
  study phase "fades after Aalborg" in one line and "reaches Skagen" in the
  next. Those are the same fact; see the end of GLOSSARY.md before anyone
  "fixes" it.

## The release note, until a reader signs off

While a language sits at "machine-authored, unreviewed", say so where players
can see it. A TestFlight or store note should read: *German, Spanish and
Chinese are new and machine-translated. Tell us what reads wrong.* That is
honest, it is short, and it turns the gap into the fastest way to close it.

As of 2026-09-12 that note needs to name ten languages, and seven of them have
not had even the one machine reading the first three got. Say it plainly:
*The app now speaks eleven languages. Everything but English is machine-
translated, and seven of them are brand new. Tell us what reads wrong.*

**The three closest to Danish are the ones to say it loudest for.** A Swedish,
Norwegian or Dutch player can half-read Danish already, so they are the most
likely to notice a wrong word AND the most likely to be misled by one: a
translation that has drifted into Danish reads as almost-right to them rather
than as obviously foreign (UL15).

## Where to start, if you only have an hour

In this order, because this is the order a new player meets them and the order
in which a bad line does the most damage:

1. **`onboarding`** — the ticket and Casey's staged introduction. A stiff line
   here loses the player before the game starts.
2. **`casey`** — her tips and her bubble. She is the app's face; the test is
   "would a person say this", not "is this a correct translation".
3. **`game`** — the densest screen, and the one with the most invented
   vocabulary. Check it against [GLOSSARY.md](GLOSSARY.md) rather than reading
   it as prose.
4. **`home`**, **`guide`**, **`settings`**, **`system`** — in that order.

Three things are worth knowing before you start. The English was moved
byte-for-byte, so a line that reads oddly in English is not a translation
error — it was already there, and it is listed in the plan's findings. Casey is
"she" in every language. And the bold rows in the glossary are places where two
translators disagreed and were reconciled, so they are the likeliest to be
worth a second opinion.

## What a reviewer is being asked

Not "is this a correct translation of the English". The English is a starting
point, not a contract. The questions are:

1. **Would a person say this?** A stiff-but-accurate line is a failure here.
   Casey is warm, direct and brief in every language.
2. **Is it the same word every time?** Check against
   [GLOSSARY.md](GLOSSARY.md); a term translated two ways is worse than a term
   translated awkwardly once.
3. **Does it fit?** The screens are measured at 360×640 and must not scroll. A
   line that is right but long is a bug, and a shorter phrasing is the fix.
4. **Is the register right?** Informal throughout: du, tú, 你. Never Sie,
   usted or 您.

## How to record a review

Replace the row with the reviewer's name, the date, and what they actually
read — "the Settings screen", not "German" — so the next reviewer knows where
to start. A partial review is worth recording as a partial review.
