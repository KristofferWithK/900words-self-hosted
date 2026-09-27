import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { lessonFinishOffers, planRuntimeLessons } from '../../journey/lessonMilestones'
import { milestoneKey } from '../../progression/identity'
import type { CompletionReceipt, RequiredBoardSet } from '../../progression/types'
import { CurriculumOfferReader, curriculumOfferFor } from './CurriculumOfferReader'

const board = { courseId: 'da', cityId: 'sonderborg', authoredBoardId: 'bank_001', contentRevision: '1' } as const
const set: RequiredBoardSet = { courseId: 'da', cityId: 'sonderborg', setVersion: 'city1-required-boards-v1', boards: [board] }

function receipt(count: number): CompletionReceipt {
  const settled = { acceptedAt: 1_700_000_000_000 + count, evidence: { board }, newMilestoneIds: [milestoneKey(set, count)] } as unknown as CompletionReceipt
  return { ...settled, lessons: planRuntimeLessons({ receipt: settled, curriculum: null, survival: null }) }
}

describe('receipt curriculum-offer reader', () => {
  it('resolves every live C1-09 offer from the receipt planner to its exact authored item', () => {
    const ids = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
      .flatMap((count) => lessonFinishOffers(receipt(count)))
      .filter((offer) => offer.kind === 'curriculum')
      .map((offer) => offer.itemId)
    expect(ids).toEqual([
      'sonderborg-notice', 'sonderborg-discriminate', 'sonderborg-manipulate', 'sonderborg-listen', 'sonderborg-transfer',
      'sonderborg-situation-1', 'sonderborg-situation-2', 'sonderborg-situation-3', 'sonderborg-situation-4', 'sonderborg-exit',
    ])
    for (const itemId of ids) {
      const offer = curriculumOfferFor(0, itemId)
      expect(offer).not.toBeNull()
      expect(offer?.kind === 'activity' ? offer.activity.id : offer?.exit.id).toBe(itemId)
    }
    expect(curriculumOfferFor(0, 'ribe-possessives')).toBeNull()
  })

  it.each([
    ['sonderborg-notice', 'The ending carries', 'Der er et hus her. Huset er lille.'],
    ['sonderborg-situation-1', 'Say your name', 'Hej, jeg hedder Mia.'],
    ['sonderborg-exit', 'Sønderborg exit', 'Catch the location'],
  ])('renders the authored %s Guide page read-only', (itemId, title, authoredText) => {
    const html = renderToStaticMarkup(<CurriculumOfferReader cityIndex={0} itemId={itemId} onClose={() => {}} onOpenSection={() => {}} />)
    expect(html).toContain('curriculum-offer-reader')
    expect(html).toContain(title)
    expect(html).toContain(authoredText)
    expect(html).toContain('guide-thumb-grammar')
    expect(html).not.toContain('Mark read')
    expect(html).not.toContain('Schedule')
  })
})
