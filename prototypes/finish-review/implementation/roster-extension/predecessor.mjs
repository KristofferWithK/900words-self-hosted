// Explicit second source boundary: reconstruct the extension's reviewed input.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const read = name => readFileSync(new URL(name, import.meta.url), 'utf8');
const scope = JSON.parse(read('scope.json'));
export function extensionPredecessorWords(words) {
  const prior = new Map(scope.wordSources.map(w => [w.wordId, w]));
  const next = new Map(JSON.parse(read('board-sentences.json')).rows.map(r => [r.wordId, r]));
  const originalPrior = new Map(JSON.parse(read('../predecessor-examples.json')).map(w => [w.id, w]));
  const originalBoard = new Map(JSON.parse(read('../board-sentences.json')).rows.map(r => [r.wordId, r]));
  const reconstructed = words.map(w => {
    const old = originalPrior.get(w.id), accepted = originalBoard.get(w.id);
    if (old && w.exampleDa === old.exampleDa && w.exampleEn === old.exampleEn) {
      return { ...w, exampleDa: accepted.text.da, exampleEn: accepted.text.en };
    }
    const p = prior.get(w.id);
    if (!p) return w;
    const r = next.get(w.id);
    if (!((w.exampleDa === p.exampleDa && w.exampleEn === p.exampleEn) ||
      (w.exampleDa === r?.text.da && w.exampleEn === r?.text.en))) throw Error(`${w.id}: unauthorized extension source drift`);
    return { ...w, exampleDa: p.exampleDa, exampleEn: p.exampleEn };
  });
  const sha = createHash('sha256').update(JSON.stringify(reconstructed, null, 2) + '\n').digest('hex');
  if (sha !== scope.sources['src/data/words.da.json']) throw Error('extension predecessor whole-file source drift');
  return reconstructed;
}
