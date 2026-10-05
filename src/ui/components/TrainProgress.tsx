/**
 * The road to the next city, drawn as the train that leaves it, and since
 * CW-07b the slips its train run gives (owner, 2026-10-04: "the train sections
 * can be used to visualize the amount of slips earned").
 *
 * The locomotive is the slip every run starts with. Each wagon holds
 * `WORDS_PER_TRAIN_SLIP` collected words (20): it fills as they are collected,
 * and a full wagon is one more slip. There are as many wagons as the city's
 * words can fill, floor(total / 20), never a constant: Sønderborg's 147 words
 * draw the engine and seven wagons, eight slips, and the last wagon is full at
 * 140. The seven words after it add no slip, and the train does not pretend
 * they do: there is no eighth wagon to half-fill. `slipTrain` is that
 * arithmetic, and it agrees with `trainSlips` (journey/trainSlips.ts, the rule
 * itself) at every count.
 *
 * The look is the one the owner chose of three (2026-10-04, "look B"): each
 * wagon has four windows, one lit per five of its words, and a full wagon gets
 * a green roof. The engine's cab wears the same roof from the start, so the
 * green roofs on the train are the slips.
 *
 * Pencil and hatching are the ride train's (`TrainRide.tsx`): the same hand
 * drew Casey, the coastline and this.
 *
 * Since T1 it is also the DOOR. Pass `onBoard` and the drawing is wrapped in a
 * real button: the thing you spent a city's words filling is the thing you
 * press to ride it. Home had a separate green "Travel on → ⟨city⟩" button for
 * that and no longer does. It was a second control for a train already on the
 * screen, and it was exactly what Casey's band overflowed onto (the bug
 * DECISIONS records as "Casey drawn sliced across the green button").
 */

import { UI } from '../../i18n'
import { BASE_TRAIN_SLIPS, WORDS_PER_TRAIN_SLIP } from '../../journey/trainSlips'

/** The train for `collected` of a city's `total` words, in slips. */
export interface SlipTrain {
  /** Words one wagon holds: the slip rule's step. */
  readonly per: number
  /** Wagons behind the engine: as many as the city's words can fill. */
  readonly wagons: number
  /** Per-wagon fill in [0, 1], front wagon first. */
  readonly fills: readonly number[]
  /** Full wagons: each is a slip. */
  readonly full: number
  /** The engine's slip and one per full wagon. Equals `trainSlips(collected)`. */
  readonly slips: number
  /** The wagon being filled, or -1 when every wagon is full (or there are none). */
  readonly filling: number
  /** Words in the wagon being filled; 0 when none is. */
  readonly inFilling: number
  /** Words to the next slip, or null when the train holds every slip the city gives. */
  readonly toNextSlip: number | null
  /** The city's words past its last wagon: collecting them adds no slip (7 in Sønderborg). */
  readonly beyond: number
}

const whole = (n: number): number => (Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0)

/**
 * The wagon maths. A count above `total` clamps to it: there is no wagon for
 * words the city does not have.
 */
export function slipTrain(collected: number, total: number, per: number = WORDS_PER_TRAIN_SLIP): SlipTrain {
  const size = whole(total)
  const have = Math.min(whole(collected), size)
  const wagons = per > 0 ? Math.floor(size / per) : 0
  const fills = Array.from({ length: wagons }, (_, i) => Math.max(0, Math.min(1, (have - i * per) / per)))
  const full = fills.filter((f) => f === 1).length
  const filling = full < wagons ? full : -1
  return {
    per,
    wagons,
    fills,
    full,
    slips: BASE_TRAIN_SLIPS + full,
    filling,
    inFilling: filling < 0 ? 0 : have - filling * per,
    toNextSlip: filling < 0 ? null : (filling + 1) * per - have,
    beyond: size - wagons * per,
  }
}

/**
 * The sentence the train stands for. One function because two screens say it:
 * the map screen prints it under the train, Home has no room for it on its one
 * line and carries it as the train's accessible name instead.
 */
export function trainLabel(remaining: number, nextCity: string | null): string {
  if (remaining <= 0) {
    return nextCity === null ? UI.home.trainJourneyOver : UI.home.trainReady(nextCity)
  }
  return nextCity === null
    ? UI.home.wordsToFinish(remaining)
    : UI.home.wordsToTrain(remaining, nextCity)
}

/**
 * The train's name once it is a control rather than a readout.
 *
 * A button is named for what pressing it does, which `trainLabel` is not: at
 * nothing left to wrap it says the train "is ready", and ready is a state, not
 * an action. Both screens say this same sentence so the door is the same door.
 */
export function boardLabel(nextCity: string): string {
  return UI.home.boardTrain(nextCity)
}

/**
 * Someone running after the train, suitcase in hand (owner, 2026-10-04: "place
 * a person running after the train on the other side. Ideally they hold a
 * suitcase"). Home draws it at the back of the train, the end away from the
 * locomotive, on the same dashed rail; the map and the train sheet do not.
 *
 * A pencil stick figure in the train's own hand: the same graphite strokes,
 * the paper-white head, and a small case in Casey's beige. Leaning into the
 * run with one arm reaching for the last wagon. Decorative: the strip's
 * sentence and the "Catch the train" tag beside it carry the meaning.
 *
 * ONE component on purpose, so another runner is one swap. Its viewBox is
 * 30 x 40 with the rail at y 36.5, which puts the rail 2.6 px above the bottom
 * at Home's 30 px height: the train's rail, bottom-aligned beside it.
 */
export function TrainRunner({ className = '' }: { className?: string }) {
  return (
    <svg className={`train-runner ${className}`.trimEnd()} viewBox="0 0 30 40" aria-hidden="true" focusable="false">
      <g className="cluey-hatch">
        <path className="train-rail" d="M0 36.5 H30" />
        {/* Speed lines behind the runner. */}
        <path className="train-runner-speed" d="M26.5 9.5 h3 M27.4 13.4 h2.4" />
        {/* The case, swinging from the back hand. */}
        <path className="train-runner-handle" d="M21.4 20.6 v-1.7 h3.6 v1.7" />
        <rect className="train-runner-case" x="19.4" y="20.6" width="7.6" height="5.8" rx="1.3" />
        <path className="train-runner-latch" d="M23.2 22.4 v2.2" />
        {/* Legs mid-stride: the front foot on the rail, the back one kicked up. */}
        <path className="train-runner-limb" d="M17.4 24.2 L13.4 29.4 L11.6 36 L9.2 36" />
        <path className="train-runner-limb" d="M17.4 24.2 L20.6 29.6 L25.4 30.6" />
        {/* Body leaning into the run; one arm reaching for the train. */}
        <path className="train-runner-limb" d="M14.4 14.6 L17.4 24.2" />
        <path className="train-runner-limb" d="M15 16.8 L10.8 19.2 L7.2 16.6" />
        <path className="train-runner-limb" d="M15.4 17 L19.4 19.8 L23.2 19.2" />
        <circle className="train-runner-head" cx="13" cy="11" r="3.5" />
      </g>
    </svg>
  )
}

/** Geometry, in viewBox units. The wagons start after the locomotive. */
const LOCO = 42
const WAGON_W = 26
const WAGON_GAP = 4
const VB_H = 38
const BODY_Y = 15
const BODY_H = 12
/** Four windows to a wagon, one per five of its twenty words. */
const PANES = 4
const PANE_PAD = 2.5
const PANE_GAP = 1.5
const PANE_W = (WAGON_W - 2 * PANE_PAD - (PANES - 1) * PANE_GAP) / PANES
const wagonX = (i: number) => LOCO + i * (WAGON_W + WAGON_GAP)
const vbWidth = (wagons: number) => LOCO + wagons * (WAGON_W + WAGON_GAP)

function Wagon({ index, fill, train }: { index: number; fill: number; train: SlipTrain }) {
  const x = wagonX(index)
  const full = fill === 1
  const filling = index === train.filling
  const lit = Math.floor(fill * PANES + 1e-9)
  return (
    <g className={`train-wagon ${full ? 'is-full' : filling ? 'is-filling' : 'is-ghost'}`}>
      {full && (
        <rect className="train-roof" x={x - 1} y={BODY_Y - 3.5} width={WAGON_W + 2} height="3.5" rx="1.5" />
      )}
      <rect className="train-wagon-body" x={x} y={BODY_Y} width={WAGON_W} height={BODY_H} rx="2" />
      {Array.from({ length: PANES }, (_, k) => (
        <rect
          key={k}
          className={`train-pane ${k < lit ? 'is-lit' : ''}`.trimEnd()}
          x={x + PANE_PAD + k * (PANE_W + PANE_GAP)}
          y={BODY_Y + 3}
          width={PANE_W}
          height="6"
          rx="0.6"
        />
      ))}
      <circle cx={x + 5} cy="30" r="3.5" />
      <circle cx={x + WAGON_W - 5} cy="30" r="3.5" />
    </g>
  )
}

export function TrainProgress({
  earned,
  goal,
  label,
  className = '',
  onBoard,
}: {
  /** Words of the city collected (the three-mark count, `countMarks`). */
  earned: number
  /** The city's words (`countMarks(...).total`): it sets how many wagons there are. */
  goal: number
  /**
   * The whole sentence, for anyone who cannot see the train. Omit it where the
   * sentence is already printed next to the train (the train sheet prints the
   * counts under it), and a label there would only read it out twice.
   *
   * When `onBoard` is given this is the BUTTON's name instead, so pass
   * `boardLabel(city)` there rather than the countdown.
   */
  label?: string
  className?: string
  /**
   * Board it. Given only where the road is actually open: with it the train is
   * a real button, without it the drawing is a readout and must not be
   * focusable or announced as anything you can press.
   */
  onBoard?: () => void
}) {
  const train = slipTrain(earned, goal)
  const width = vbWidth(train.wagons)

  // Inside a button the drawing is decoration: the button carries the name,
  // and a role="img" with the same words would read it out twice.
  const named = onBoard === undefined && label !== undefined

  const drawing = (
    <svg
      className={`train-progress ${onBoard === undefined ? className : ''}`.trimEnd()}
      viewBox={`0 0 ${width} ${VB_H}`}
      // Drawn to the bottom-left of its box: where a row narrows the box (Home's
      // strip), the train keeps its rail on the bottom line beside the runner.
      preserveAspectRatio="xMinYMax meet"
      data-slips={train.slips}
      data-wagons={train.wagons}
      {...(named ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      <g className="cluey-hatch">
        <path className="train-rail" d={`M0 34 H${width}`} />

        {/* The locomotive: boiler, funnel, cab. Always solid, and always a
            slip: the one every run starts with, so its cab has the roof. */}
        <g className="train-loco">
          <rect className="train-roof" x="25" y="5.5" width="12" height="3.5" rx="1.5" />
          <rect x="2" y="14" width="24" height="13" rx="3" />
          <rect x="6" y="8" width="6" height="6" rx="1" />
          <path d="M26 9 h9 l5 8 v10 h-14 z" />
          <circle cx="9" cy="30" r="4" />
          <circle cx="24" cy="30" r="4" />
          <circle cx="35" cy="30" r="4" />
        </g>

        {train.fills.map((fill, i) => (
          <Wagon key={i} index={i} fill={fill} train={train} />
        ))}
      </g>
    </svg>
  )

  if (onBoard === undefined) return drawing

  return (
    <button
      type="button"
      className={`train-board ${className}`.trimEnd()}
      aria-label={label}
      onClick={onBoard}
    >
      {drawing}
    </button>
  )
}
