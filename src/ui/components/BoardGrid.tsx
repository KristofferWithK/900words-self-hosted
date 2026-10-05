import { type CSSProperties, useEffect, useRef } from 'react'
import { articleLabel, genderLabel } from '../../data/gender'
import type { CardRole, GameState, Reveal } from '../../engine/types'
import { isGuessable } from '../../engine/game'
import { UI } from '../../i18n'
import { ACTIVE } from '../../lang/active'
import { pressHaptic } from '../feedback'
import { playWord, preloadWordAudio } from '../speak'
import { WordBorderFrames } from './BorderFrames'
import { SuitcaseGlyph } from './SuitcaseGlyph'

interface Props {
  game: GameState
  /** Player may tap cards to (pre-)select a guess right now. */
  canGuess: boolean
  selectedWordId: string | null
  onCardTap: (wordId: string) => void
  onInfoTap: (wordId: string) => void
  /** Dictionary access is locked during the wrap-up packing phase. */
  dictionaryLocked: boolean
  /**
   * Wrap-up rounds: which cards are still English-side up. An unpacked card
   * shows its gloss where the Danish goes — for the whole round, if it was
   * skipped: the English face is the visible mark of "cannot wrap this time".
   */
  englishFace?: (wordId: string) => boolean
  /** Words whose Danish translation was revealed by a postcard during packing. */
  packingTranslated?: readonly string[]
  /**
   * Wrap-up rounds: which cards were NOT collected when the board was dealt
   * (W1's top-up). They play like any other card and count toward the win, but
   * nothing can pack them and `finishRound` cannot wrap them, so they carry a
   * quiet mark rather than a loud one — the player is not being refused
   * anything, and a card that shouts would make a topped-up board read as a
   * board full of mistakes.
   */
  notWrappable?: (wordId: string) => boolean
  /** Packing phase: unpacked cards are tappable to select for packing. */
  packingSelectable?: boolean
  /**
   * The translation-recall challenge is on screen. It is the ONLY phase in
   * which a solved suitcase shows anything: its UI-language gloss is the
   * composer's prompt, and outside recall the suitcase is drawn EMPTY.
   */
  wheelActive?: boolean
  /** The wheel challenge: which solved words are already translated. */
  wheelSolved?: (wordId: string) => boolean
  /**
   * The wheel has spun (owner, 2026-09-27): every suitcase lid turns from the
   * meaning to the Danish, the translated ones in green and the rest as the
   * answer the player did not give.
   */
  wheelAnswers?: boolean
  /**
   * The whole player key put away — border and accessible name both. During
   * packing (recall, not a key-reading exercise) and during the guessing half
   * of the round; `playerKeyHidden` below is the rule.
   */
  hidePlayerKey?: boolean
}

/**
 * When the player's key is put away (owner, 2026-09-11: "when it's the
 * player's turn to guess, I don't want the green outlines to be there, so
 * that it's a visual signifier that now you're guessing, and they're not
 * distracted by your own key — and when you are the one who has to create
 * the clue, the green lines are back").
 *
 * Hidden while Casey prepares her clue and while the player guesses under
 * it: the frames' absence is the sign that this half of the round is hers.
 * Shown while the player clues and while Casey guesses under that clue —
 * her guesses are judged against this key, so it is what "got one!" means.
 * Shown in the last chance too, deliberately: your own greens are among the
 * words that win it, and hiding what the rules count would be hiding the
 * puzzle. Shown on the WON-SPIN board as well (owner, build 90: "at a
 * successful spin it should go to a board … and you see your key. That's
 * where you make the choice") — translateWheel reads like playerClueInput.
 * Packing hides it for its own reason.
 */
export function playerKeyHidden({
  phase,
  packing,
}: {
  phase: GameState['phase']
  packing: boolean
}): boolean {
  if (packing) return true
  return phase === 'aiClueInput' || phase === 'playerGuessing'
}

/**
 * When the board wears the wheel's treatments — the lid words, the dimming,
 * the missed key words' marks: from the challenge through the filled wheel to
 * the end of the post-spin review (owner, 2026-09-27). `showing` is the
 * store's spin hold or review, the only time a finished round keeps its board.
 */
export function wheelBoardActive(game: GameState, showing: boolean): boolean {
  return !!game.wheel && (game.phase === 'translateChallenge' || game.phase === 'translateWheel' ||
    (game.phase === 'finished' && showing))
}

const revealKind = (game: GameState, wordId: string): string => {
  const r = game.reveals[wordId]!
  if (r.kind !== 'bystander') return r.kind
  return r.against.length === 2 ? 'bystander-both' : `bystander-${r.against[0]}`
}

/** Reveal state spelled out for assistive tech — color alone is not enough. */
const stateText = (r: Reveal): string => {
  if (r.kind === 'hidden') return ''
  if (r.kind === 'green') return UI.game.cardFound
  if (r.against.length === 2) return UI.game.cardNeutralBoth
  return r.against[0] === 'player' ? UI.game.cardNeutralPlayer : UI.game.cardNeutralCasey
}

/**
 * Your own key — the private information you play from, like a Duet key card.
 * One mark, not two: the dashed border that said "forbidden on your key" is
 * gone with the cards it described. Said only while the key is shown, so a
 * screen reader gets the same board a sighted player does in every phase.
 */
const keyText: Record<CardRole, string> = {
  green: UI.game.cardYourTarget,
  bystander: '',
}

/** A directional reveal names the clue-giver's key, not the tapper. */
const humanBystanderMistakes = (game: GameState): ReadonlySet<string> => {
  const ids = new Set<string>()
  for (const clue of game.clueHistory) {
    if (clue.by !== 'ai') continue
    for (const guess of clue.guesses) {
      if (guess.result === 'bystander') ids.add(guess.wordId)
    }
  }
  return ids
}

export function BoardGrid({
  game,
  canGuess,
  selectedWordId,
  onCardTap,
  onInfoTap,
  dictionaryLocked,
  englishFace,
  packingTranslated = [],
  notWrappable,
  packingSelectable,
  wheelActive = false,
  wheelSolved,
  wheelAnswers = false,
  hidePlayerKey = false,
}: Props) {
  // Every word on the board is readied the moment it is dealt, so the first
  // tap on a card is a start rather than a load. The board changes once a
  // round, so this runs once a round; the pool holds the whole deal.
  const dealt = game.words.map((w) => w.wordId).join(',')
  useEffect(() => {
    if (dealt) void preloadWordAudio(dealt.split(','))
  }, [dealt])
  // The word a pointer-down just said, so the click that follows it on the
  // same card does not say it twice. See the card's two handlers.
  const spoken = useRef<{ id: string; at: number } | undefined>(undefined)
  const humanMistakes = humanBystanderMistakes(game)

  return (
    <div
      className="board-grid"
      style={{
        gridTemplateColumns: `repeat(${game.config.cols}, 1fr)`,
        // Rows shrink together with the phase's dock: minmax(0, 1fr) lets a
        // short phone flatten the cards instead of scrolling the screen.
        gridTemplateRows: `repeat(${game.config.rows}, minmax(0, 1fr))`,
      }}
    >
      {game.words.map((w) => {
        const reveal = game.reveals[w.wordId]!
        const kind = revealKind(game, w.wordId)
        const guessable = canGuess && isGuessable(game, w.wordId)
        const myRole = game.playerKey[w.wordId]!
        // Once a word is globally revealed its key role is spent; while it is
        // still in play (hidden, or neutral in only one direction) you need to
        // see it to give clues.
        // While the key is put away (`hidePlayerKey`: packing, and the
        // guessing half of the round) EVERY player-key cue is absent,
        // including on a Danish-side-up top-up card — by border and by
        // accessible name alike.
        const showKey = !hidePlayerKey && (reveal.kind === 'hidden' || reveal.kind === 'bystander')
        const faceDown = englishFace?.(w.wordId) ?? false
        const postcardRevealed = packingTranslated.includes(w.wordId)
        const noWrap = notWrappable?.(w.wordId) ?? false
        const packable = (packingSelectable ?? false) && (faceDown || postcardRevealed)
        // A word's decorative border gets its own stable CSS clock. Hashing
        // the id avoids synchronized cards without runtime timers or random
        // values that change when React renders again.
        let motionHash = 2166136261
        for (let i = 0; i < w.wordId.length; i++) {
          motionHash = Math.imul(motionHash ^ w.wordId.charCodeAt(i), 16777619)
        }
        const motionSeed = motionHash >>> 0
        // Off on the whole wheel board, the post-spin review included: that
        // board's cards are dimmed and marked, not boiling (owner, 2026-09-27).
        const borderMotion =
          !wheelActive &&
          game.phase !== 'translateChallenge' &&
          game.phase !== 'translateWheel' &&
          reveal.kind !== 'green'
        const borderMotionStyle = {
          '--word-border-delay': `${-(motionSeed % 720)}ms`,
        } as CSSProperties
        // The wheel phase has NO selection machinery (owner, 2026-09-17): the
        // composer grades the typed answer against every untranslated wheel
        // word on submit, so a suitcase tap selects nothing. A solved,
        // untranslated suitcase keeps its full-ink glyph (below) as the
        // "this is one you can answer" affordance; the packed state is the
        // green drawing + check, nothing else.
        const wheelSelectable = false
        const wheelPacked = wheelActive && (wheelSolved?.(w.wordId) ?? false)
        // One of CASEY's key words the round never found (owner, 2026-09-27):
        // it holds a slice on the wheel that can never turn green, so the board
        // shows where that slice came from with a dashed green border. Your
        // own missed words need nothing new: they keep your key's solid border.
        const caseyMissed =
          wheelActive && reveal.kind !== 'green' && game.aiKey[w.wordId] === 'green' && myRole !== 'green'
        const answer = `${articleLabel(w) ? `${articleLabel(w)} ` : ''}${w.da}`
        // Outside a guessing turn (and outside packing) a tap's only job left
        // is to say the word — looking it up is ⓘ's alone now (U1). Kept as
        // its own flag rather than folded into `disabled` because it also
        // drives the aria hint below.
        const tapPlaysWord = !guessable && !packable && !wheelSelectable && !dictionaryLocked
        const accessibleName = faceDown
          ? `${w.en[0]}${packable ? UI.game.cardNotYetPacked(ACTIVE.name) : UI.game.cardUnpacked}${stateText(reveal)}`
          : wheelActive && reveal.kind === 'green'
            ? `${w.en[0]}${UI.game.wheelCardStatus(wheelPacked)}${wheelAnswers ? `, ${answer}` : ''}`
            : `${genderLabel(w) ? `${genderLabel(w)} ` : ''}${w.da}${postcardRevealed ? UI.game.cardTranslationRevealed : ''}${showKey ? keyText[myRole] : ''}${caseyMissed ? UI.game.cardMissedKey : ''}${stateText(reveal)}${
                noWrap ? UI.game.cardNotYoursToWrap : ''
              }${tapPlaysWord ? UI.game.cardTapToHear : ''}`

        return (
          <div
            key={w.wordId}
            className={`word-card-wrap wrap-${kind}`}
            data-translation-pending={wheelActive && reveal.kind === 'green' && !wheelSolved?.(w.wordId) ? 'true' : undefined}
          >
            {/* The visible card and its separate lookup button share this
                surface. Grid rows can be taller than a card's 5:4 shape (the
                tutorial's 3×3 board is), so positioning the lookup button
                against the whole row made it float above the paper. */}
            <div className="word-card-surface">
              <button
                className={[
                  'word-card',
                  // The kind class paints the reveal state. A bystander takes
                  // NO kind class: the old .card-bystander-* gradients are
                  // gone (owner, build 90), so the only bystander paint is
                  // the strike class below; the wrapper keeps its
                  // `wrap-${kind}` DOM shape for selectors that read it.
                  kind === 'hidden' || reveal.kind === 'bystander'
                    ? ''
                    : `card-${kind}`,
                  guessable ? 'card-guessable' : '',
                  borderMotion ? 'card-border-motion' : '',
                  // The tints are GONE (owner, build 90): a bystander shows
                  // ONE thing while you are guessing — that you already had
                  // it wrong — and nothing about who burned it. The
                  // strike-through is on TEXT (below), so the card itself
                  // stays plain white in every phase; `wrap-${kind}` keeps
                  // the DOM shape for selectors that read it.
                  // Only a bystander the human actually selected shows the
                  // strike while the human is guessing. `against` is the
                  // directional key and cannot identify the actor; clue
                  // history does that.
                  canGuess && reveal.kind === 'bystander' && humanMistakes.has(w.wordId)
                    ? 'card-bystander-struck'
                    : '',
                  // No tap-state paints on a suitcase in the wheel phase
                  // (owner, 2026-09-17): there is no selection to show — the
                  // composer grades on submit against every untranslated wheel
                  // word — and the packed card wears ONLY the green drawing +
                  // check, no frame, no scale-up. `.card-selected` (the
                  // guessing turn's outline) is kept OFF the suitcase here too:
                  // a wheel-phase tap sets no selectedWordId, and the owner
                  // has repeatedly rejected a box around the suitcase (build
                  // 87; the build-89 packed-card ring was exactly this outline
                  // surviving a wheel hit — the hit cleared nothing, the word
                  // stopped being wheel-selectable, and the `!wheelSelectable`
                  // guard let the 3px outline paint around the packed card).
                  selectedWordId === w.wordId && !wheelSelectable ? 'card-selected' : '',
                  wheelPacked ? 'card-wheel-packed' : '',
                  wheelAnswers && reveal.kind === 'green' && !wheelPacked ? 'card-wheel-unpacked' : '',
                  caseyMissed ? 'card-wheel-missed' : '',
                  // The last chance's dimming (owner, 2026-09-17): the
                  // non-suitcase cards step back so the intention goes to the
                  // suitcase words. Visual only — the cards stay tappable for
                  // what a tap still means there, and the accessible names
                  // carry full information regardless of the paint.
                  wheelActive && reveal.kind !== 'green' ? 'card-dimmed' : '',
                  showKey ? `mykey-${myRole}` : '',
                  faceDown ? 'card-face-en' : '',
                  postcardRevealed ? 'card-translation-revealed' : '',
                  noWrap ? 'card-no-wrap' : '',
                ].join(' ')}
                style={borderMotionStyle}
                disabled={!guessable && !tapPlaysWord && !packable}
                aria-label={accessibleName}
                aria-pressed={selectedWordId === w.wordId}
                onPointerDown={(e) => {
                  /**
                   * The word is said when the finger LANDS, not when it lifts.
                   * `click` arrives on touch end, so a card tapped normally
                   * held its sound for the 80–150 ms the finger was down —
                   * the largest piece of the delay the owner could still feel
                   * after the clips were readied ahead of the tap. Nothing
                   * about a card is ambiguous at pointer-down (a card is a
                   * button or it is not; the board never scrolls), so there
                   * is nothing to wait for. The guess itself still happens on
                   * click below: hearing a word is free, choosing it is not.
                   *
                   * NOT in the wheel phase (owner, 2026-09-17): there the
                   * Danish word IS the answer the composer asks for, so a
                   * suitcase tap stays silent — and it SELECTS nothing any
                   * more: the composer grades on submit against every
                   * untranslated wheel word, no tap-to-select.
                   *
                   * The tick comes FIRST, before the word and before anything
                   * the tap changes on screen (owner, build 122: "a delay
                   * between me touching the card and feeling the vibration").
                   * It used to wait for the click, which on a guessing turn
                   * also waited for the selection's store update and render.
                   * Same rule as every tap target's tick: an enabled card
                   * ticks, a face-down one included; its click is then quiet
                   * (useTapHaptics). Nothing else may run ahead of these two.
                   */
                  if (e.button !== 0) return
                  if (!e.currentTarget.disabled) pressHaptic(e.currentTarget)
                  if (faceDown || wheelActive) return
                  spoken.current = { id: w.wordId, at: performance.now() }
                  void playWord(w.wordId)
                }}
                onClick={() => {
                /**
                 * Tapping a word says it — the whole card, every time it is a
                 * live button, and nothing else. That used to be shared with a
                 * second job: outside a guessing turn, the same tap also opened
                 * the dictionary. The owner split them apart (U1) — "the
                 * translation and definition of the word should only appear if
                 * you click on the i symbol and not just the word. The audio
                 * should still play though" — because a card that plays sound
                 * AND opens a sheet on the same gesture cannot be told apart
                 * from a lookup, and the SRS was crediting `recordLookup` on a
                 * tap that only ever meant "say that again". Now ⓘ (`card-info`
                 * below) is the only door to the sheet, and hearing a word is
                 * free while reading its meaning is what costs a lookup.
                 *
                 * Not on a face-down card. There the English is showing and
                 * the Danish is what the player has to produce from memory, so
                 * saying it aloud would hand over the one thing the packing
                 * phase exists to withhold — the same reasoning PackingDock
                 * gives for only speaking on a hit.
                 *
                 * `playWord` checks the sound setting itself and reports a
                 * clip that does not play (the audio notice), so there is
                 * nothing to gate here. A pointer tap has already said the
                 * word on the way down (above); this only speaks for a click
                 * that had no pointer — a keyboard's Enter or Space.
                 *
                 * The wheel phase keeps the same silence as pointer-down: the
                 * Danish is the answer, and no tap selects anything — the
                 * composer grades the typed text against every untranslated
                 * wheel word on submit (owner, 2026-09-17).
                 */
                const said = spoken.current
                const justSaid = said?.id === w.wordId && performance.now() - said.at < 1000
                if (!faceDown && !justSaid && !wheelActive) void playWord(w.wordId)
                if (justSaid) spoken.current = undefined
                if (guessable || packable) onCardTap(w.wordId)
                }}
              >
              {borderMotion && <WordBorderFrames />}
              {/* Long dashes a CSS dashed border cannot draw: its dash length
                  is the browser's. The rect sits on the card's own border. */}
              {caseyMissed && (
                <svg className="card-missed-frame" aria-hidden="true">
                  <rect x="0" y="0" width="100%" height="100%" rx="6.5" ry="6.5" />
                </svg>
              )}
              {/* No dot: the card's own border carries your key — solid green
                  for a target — and two marks saying one thing was one too
                  many. The border differs by style as well as colour, so it
                  does not rest on colour alone, and the accessible name says
                  it outright. (There was a dashed black border here too, for
                  a word forbidden on your key. Both are gone.) */}
              {/* Gender in front of the word, where it is read — "et hus", the
                  way the pair is actually learned. It rode in the top strip
                  for one build because it costs nothing there, and it was too
                  easy to miss.
                  It is not free here: a 4-wide board at 360px leaves the word
                  64px and an inline "en" takes about 13 of them, so 71 of the
                  430 nouns gain a second line. Measured across the whole set,
                  none is clipped — the article is small, the strip's old
                  padding came back when the key dot went, and the word is now
                  sized off the card rather than the viewport. */}
              {/* A solved card is put away — SUITCASE-AS-CARD (owner,
                  2026-09-16): the card border and background drop away and the
                  suitcase drawing fills the card (tight viewBox crop, the body
                  rect is the card outline). EMPTY UNLESS THE WHEEL IS ON
                  (owner, build 87): the lid word — the UI-language gloss — is
                  the composer's prompt and appears ONLY while the wheel phase
                  is active; in every other phase the suitcase is drawn bare,
                  no text, no check. A tap selects nothing in the wheel phase
                  (free-type grading, owner 2026-09-17); after a correct answer
                  the suitcase packs — green strokes + the small check, no
                  frame, no scale-up. The accessible name still carries the
                  word and ", found"; the glyph and the lid word are
                  aria-hidden decoration. */}
              {reveal.kind === 'green' ? (
                <>
                  <SuitcaseGlyph borderMotion={game.phase === 'translateChallenge'} />
                  {wheelActive && !wheelAnswers && (
                    <span className="card-lid-word" lang={ACTIVE.code} aria-hidden="true">
                      {w.en[0]}
                    </span>
                  )}
                  {wheelActive && wheelAnswers && (
                    <span
                      className={`card-lid-word card-lid-answer${wheelPacked ? ' card-lid-yours' : ''}`}
                      lang={ACTIVE.code}
                      aria-hidden="true"
                    >
                      {articleLabel(w) && <span className="card-lid-article">{articleLabel(w)}</span>}
                      {w.da}
                    </span>
                  )}
                  {/* The check marks a TRANSLATED suitcase — only the word the
                      player has already answered wears it (the old render
                      showed it on every suitcase during the wheel phase). */}
                  {wheelPacked && (
                    <span className="card-packed-check" aria-hidden="true">
                      ✓
                    </span>
                  )}
                </>
              ) : faceDown ? (
                // The English face: what a card looks like before it is packed.
                // Same slot and sizing as the Danish, so the board keeps its
                // shape as cards flip.
                <span className="card-da">
                  <span className="card-word card-word-en">{w.en[0]}</span>
                </span>
              ) : (
                <span className="card-da" lang={ACTIVE.code}>
                  {articleLabel(w) && <span className="card-article">{articleLabel(w)}</span>}
                  {/* The Danish word alone, so a selector can still ask for it
                      without the article coming along in the text. */}
                  <span className="card-word">{w.da}</span>
                </span>
              )}
              {/* The ✕ mark on a bystander is GONE (owner, build 87): the
                  beige tints are the shading, the ✕ was clutter, and the miss
                  now says itself with the error blip (feedback.ts). */}
              </button>
              {/* ⓘ is a lookup for a word still in play. A solved word is put
                  away — there is nothing left to look up mid-round, so the
                  button does not render at all on a solved card and cannot
                  crowd the glyph. */}
              {!dictionaryLocked && reveal.kind !== 'green' && (
                <button
                  className="card-info"
                  aria-label={UI.game.lookUpAria(w.da)}
                  onClick={() => {
                    onInfoTap(w.wordId)
                  }}
                >
                  ⓘ
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
