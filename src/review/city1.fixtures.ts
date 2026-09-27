// TEST FIXTURES ONLY. Imported exclusively by tests and the local browser harness.
import type { AboutTarget, City1Catalog, ReviewSentence } from './city1'
export function testRow(wordId = 'da:hund', targetId = 'ledger:hvor'): ReviewSentence {
  return { wordId, city: 0, sourceSha256: 'TEST', version: 1,
    sentenceId: `city1:${wordId}:review:sentence:v1`, audioId: `city1:${wordId}:review:audio:v1`,
    text: { da: 'Hvor er hunden?', en: 'Where is the dog?' },
    wordSpan: { text: 'hunden', start: 8, end: 14 }, targetSpan: { text: 'Hvor', start: 0, end: 4 },
    targetId, targetStage: { city: 0, use: 'productive-target' }, status: 'accepted',
    approval: { artifact: 'TEST ONLY', sha256: 'TEST ONLY' } }
}
export const testAbout: AboutTarget = { targetId: 'ledger:hvor', targetStage: { city: 0, use: 'productive-target' },
  version: 1, status: 'accepted', approval: { artifact: 'TEST ONLY', sha256: 'TEST ONLY' },
  meaningEn: 'Where', usageEn: 'Asks about a place.', example: { da: 'Hvor er katten?', en: 'Where is the cat?' },
  targetSpan: { text: 'Hvor', start: 0, end: 4 } }
export const testCatalog: City1Catalog = { board: [], review: [testRow()], about: [testAbout], recordings: [] }
