import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { UI } from '../../i18n'
import { trainSlips } from '../../journey/trainSlips'
import { TrainProgress, boardLabel, slipTrain, trainLabel } from './TrainProgress'

/** Sønderborg: 147 words, the city the owner's numbers are about. */
const SONDERBORG = 147

describe('slipTrain: the engine and a wagon per 20 collected words are the slips', () => {
  it('0 collected: the engine alone, seven empty wagons, 1 slip', () => {
    const train = slipTrain(0, SONDERBORG)
    expect(train.wagons).toBe(7)
    expect(train.fills).toEqual([0, 0, 0, 0, 0, 0, 0])
    expect(train.full).toBe(0)
    expect(train.slips).toBe(1)
    expect(train.slips).toBe(trainSlips(0))
    expect(train.filling).toBe(0)
    expect(train.toNextSlip).toBe(20)
  })

  it('19 collected: the first wagon at 95%, still 1 slip', () => {
    const train = slipTrain(19, SONDERBORG)
    expect(train.fills[0]).toBeCloseTo(0.95)
    expect(train.fills.slice(1).every((f) => f === 0)).toBe(true)
    expect(train.full).toBe(0)
    expect(train.slips).toBe(1)
    expect(train.slips).toBe(trainSlips(19))
    expect(train.inFilling).toBe(19)
    expect(train.toNextSlip).toBe(1)
  })

  it('20 collected: one full wagon, 2 slips', () => {
    const train = slipTrain(20, SONDERBORG)
    expect(train.fills).toEqual([1, 0, 0, 0, 0, 0, 0])
    expect(train.full).toBe(1)
    expect(train.slips).toBe(2)
    expect(train.slips).toBe(trainSlips(20))
    expect(train.filling).toBe(1)
    expect(train.inFilling).toBe(0)
  })

  it('60 collected: three full wagons, 4 slips', () => {
    const train = slipTrain(60, SONDERBORG)
    expect(train.full).toBe(3)
    expect(train.slips).toBe(4)
    expect(train.slips).toBe(trainSlips(60))
    expect(train.toNextSlip).toBe(20)
  })

  it('140 collected: seven full wagons, 8 slips, and no wagon left to fill', () => {
    const train = slipTrain(140, SONDERBORG)
    expect(train.fills).toEqual([1, 1, 1, 1, 1, 1, 1])
    expect(train.full).toBe(7)
    expect(train.slips).toBe(8)
    expect(train.slips).toBe(trainSlips(140))
    expect(train.filling).toBe(-1)
    expect(train.toNextSlip).toBeNull()
    expect(train.beyond).toBe(7)
  })

  it('147 collected: still seven wagons and 8 slips; the last 7 words add none', () => {
    const train = slipTrain(147, SONDERBORG)
    expect(train.wagons).toBe(7)
    expect(train.full).toBe(7)
    expect(train.slips).toBe(8)
    expect(train.slips).toBe(trainSlips(147))
    expect(train.toNextSlip).toBeNull()
    expect(train.beyond).toBe(7)
  })

  it('agrees with trainSlips at every count of the city', () => {
    for (let n = 0; n <= SONDERBORG; n++) {
      expect(slipTrain(n, SONDERBORG).slips).toBe(trainSlips(n))
    }
  })

  it('derives the wagons from the rule and the city, not a constant', () => {
    expect(slipTrain(0, 100).wagons).toBe(5)
    expect(slipTrain(0, 139).wagons).toBe(6)
    expect(slipTrain(0, 140).wagons).toBe(7)
    expect(slipTrain(0, 140).beyond).toBe(0)
    expect(slipTrain(0, 19).wagons).toBe(0)
    expect(slipTrain(5, 19).slips).toBe(1)
  })

  it('clamps rather than inventing a wagon, and never goes negative', () => {
    expect(slipTrain(500, SONDERBORG).slips).toBe(8)
    expect(slipTrain(-5, SONDERBORG).fills.every((f) => f === 0)).toBe(true)
    expect(slipTrain(Number.NaN, SONDERBORG).slips).toBe(1)
    expect(slipTrain(0, 0)).toMatchObject({ wagons: 0, slips: 1, filling: -1, toNextSlip: null })
  })
})

describe('TrainProgress draws the slips', () => {
  const draw = (collected: number, label?: string) =>
    renderToStaticMarkup(<TrainProgress earned={collected} goal={SONDERBORG} label={label} />)
  const count = (html: string, needle: string) => html.split(needle).length - 1

  it('names both numbers on the strip', () => {
    const label = UI.sightseeing.trainStripLabel(60, SONDERBORG, trainSlips(60))
    expect(label).toBe('60 of 147 words collected, 4 slips. The train run takes you on.')
    expect(UI.sightseeing.trainStripLabel(0, SONDERBORG, 1)).toContain('1 slip.')
    const html = draw(60, label)
    expect(html).toContain('role="img"')
    expect(html).toContain(`aria-label="${label}"`)
    expect(html).toContain('data-slips="4"')
    expect(html).toContain('data-wagons="7"')
  })

  it('is hidden from assistive technology where the counts are printed', () => {
    expect(draw(60)).toContain('aria-hidden="true"')
  })

  it('lights a window per five words in the wagon being filled', () => {
    expect(count(draw(0), 'train-pane is-lit')).toBe(0)
    expect(count(draw(19), 'train-pane is-lit')).toBe(3)
    expect(count(draw(20), 'train-pane is-lit')).toBe(4)
    expect(count(draw(72), 'train-pane is-lit')).toBe(3 * 4 + 2)
    expect(count(draw(147), 'train-pane is-lit')).toBe(7 * 4)
  })

  it('draws four windows to every wagon, and no wagon past the last full one', () => {
    expect(count(draw(0), 'train-pane')).toBe(7 * 4)
    expect(count(draw(147), 'class="train-wagon ')).toBe(7)
  })

  it('puts a green roof on the engine and on each full wagon, so roofs = slips', () => {
    for (const n of [0, 19, 20, 60, 139, 140, 147]) {
      expect(count(draw(n), 'train-roof')).toBe(trainSlips(n))
    }
  })
})

describe('trainLabel', () => {
  it('counts down to the next city', () => {
    expect(trainLabel(80, 'Ribe')).toBe(
      'You need 80 more wrapped-up words to take the train to Ribe.',
    )
  })

  it('says word, not words, at one to go', () => {
    expect(trainLabel(1, 'Ribe')).toBe(
      'You need 1 more wrapped-up word to take the train to Ribe.',
    )
  })

  it('names no city at the end of the road', () => {
    expect(trainLabel(12, null)).toBe(
      'You need 12 more wrapped-up words to finish the journey.',
    )
    expect(trainLabel(0, null)).toBe('The suitcase is packed. The journey is over.')
  })

  it('says the train is ready once the suitcase is packed', () => {
    expect(trainLabel(0, 'Ribe')).toBe('The suitcase is packed. The train to Ribe is ready.')
  })
})

describe('boardLabel', () => {
  it('names what pressing the train does, and where it goes', () => {
    expect(boardLabel('Ribe')).toBe('Board the train to Ribe')
  })

  /**
   * The readout's sentence would be a poor button name and this is the whole
   * reason there are two of them: "the train to Ribe is ready" is a state, and
   * a control is named for its action. Both screens use this one once the road
   * opens, so the door reads the same wherever it is pressed.
   */
  it('is not the readout sentence', () => {
    expect(boardLabel('Ribe')).not.toBe(trainLabel(0, 'Ribe'))
  })
})
