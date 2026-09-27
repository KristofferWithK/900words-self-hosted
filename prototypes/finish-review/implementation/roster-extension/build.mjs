// Extension-only authoring harness. Never imports or writes application data.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { validSpan } from '../validate.mjs';
const root = new URL('../../../../', import.meta.url);
const read = p => readFileSync(new URL(p, root), 'utf8');
const json = p => JSON.parse(read(p));
const sha = s => createHash('sha256').update(s).digest('hex');
const out = (p, value) => writeFileSync(new URL(p, import.meta.url), JSON.stringify(value, null, 2) + '\n');
const parent = 'prototypes/finish-review/implementation/';
const inventory = json(parent + 'inventory.json');
const words = json('src/data/words.da.json');
const rosterPath = 'src/data/city1-replacement-corpus.da.json';
const cyclePath = 'src/data/city1-board-cycle.da.json';
const roster = json(rosterPath), cycle = json(cyclePath);
const accepted = new Set(inventory.words.map(w => w.wordId));
const missing = roster.wordIds.filter(id => !accepted.has(id));
const overlap = roster.wordIds.filter(id => accepted.has(id));
const sourceWords = missing.map(id => words.find(w => w.id === id));
const sourceHash = w => sha(JSON.stringify([w.id, w.curriculumRank, w.exampleDa, w.exampleEn]));
const targets = new Map(inventory.targets.map(t => [t.targetId, t]));
const span = (text, form) => {
  for (let start = text.indexOf(form); start >= 0; start = text.indexOf(form, start + 1)) {
    const candidate = { text: form, start, end: start + form.length };
    if (validSpan(text, candidate)) return candidate;
  }
  throw Error(`Missing whole-word span ${form}: ${text}`);
};
const lines = readFileSync(new URL('authored-pairs.tsv', import.meta.url), 'utf8').trimEnd().split('\n');
const headers = lines.shift().split('\t');
const drafts = lines.map(l => Object.fromEntries(l.split('\t').map((v, i) => [headers[i], v])));
for (const kind of ['board', 'review']) {
  const rows = drafts.map(d => {
    const wordId = `da:${d.wordId}`, w = sourceWords.find(w => w.id === wordId);
    if (!w) throw Error(`Not missing: ${wordId}`);
    const row = { wordId, city: 0, sourceSha256: sourceHash(w), version: 1,
      sentenceId: `city1:${wordId}:${kind}:sentence:v1`, audioId: `city1:${wordId}:${kind}:audio:v1`,
      text: { da: d[`${kind}Da`], en: d[`${kind}En`] }, wordSpan: span(d[`${kind}Da`], d[`${kind}Form`]),
      status: 'editorial', approval: null };
    if (kind === 'review') Object.assign(row, { targetId: d.targetId, targetStage: targets.get(d.targetId).stage, targetSpan: span(d.reviewDa, d.targetForm) });
    return row;
  });
  out(`${kind}-sentences.json`, { version: 1, base: inventory.base, language: 'da', city: 0, kind, rows });
}
// Source identity stays compatible with the original row hashing algorithm.
// Envelope base retains its schema lineage; workspace base is pinned separately.
out('scope.json', {
  version: 1, language: 'da', city: 0, status: 'editorial-unaccepted',
  workspaceBase: 'db2020d8eb937df104fae867c876f1b1cbd5c511', contractBase: inventory.base,
  sourceVersion: 'city1-ordinary-roster-extension-v1', backup: '/tmp/city1-before-roster-extension.tar.gz',
  counts: { acceptedInventory: accepted.size, authoredRoster: roster.wordIds.length, overlap: overlap.length, union: new Set([...accepted, ...roster.wordIds]).size, missing: missing.length },
  wordIds: missing, overlapWordIds: overlap,
  sources: Object.fromEntries([rosterPath, cyclePath, 'src/data/words.da.json', parent+'inventory.json', parent+'CONTRACT.md', 'src/lang/da/curriculum-support.ts'].map(p => [p, sha(read(p))])),
  authoredRoster: { path: rosterPath, schemaVersion: roster.schemaVersion, source: roster.source, wordIds: roster.wordIds },
  authoredCycle: { path: cyclePath, schemaVersion: cycle.schemaVersion, sourceSha256: cycle.sourceSha256, boardCount: cycle.boards.length,
    boards: cycle.boards.map(b => ({ id: b.id, wordIds: b.wordIds })) },
  immutableAcceptedFiles: Object.fromEntries(['board-sentences.json','review-sentences.json','about-targets.json','board-editorial.md','review-editorial.md'].map(f => [parent+f, sha(read(parent+f))])),
  aboutReuse: { path: parent+'about-targets.json', count: 39, policy: 'Reference existing accepted entries unchanged; no copied or new About records.' },
  wordSourceHashAlgorithm: 'SHA-256 of UTF-8 JSON.stringify([id,curriculumRank,exampleDa,exampleEn])',
  wordSources: sourceWords.map(w => ({ wordId: w.id, headword: w.da, sensesEn: w.en, pos: w.pos, ...(w.article ? {article: w.article} : {}), ...(w.countable === false ? {countable:false} : {}), curriculumRank: w.curriculumRank, exampleDa: w.exampleDa, exampleEn: w.exampleEn, sourceSha256: sourceHash(w),
    authoredBoardIds: cycle.boards.filter(b => b.wordIds.includes(w.id)).map(b => b.id) })),
  boundary: 'Authored roster controls ordinary playable sentence coverage. Rank-100 bank, wrap-up/seeded eligibility, saved versions, roster, ranks, boards, progress and later-city membership remain unchanged. Parent-reviewed successor adapter required before import.'
});
console.log(`Saved ${drafts.length} board + ${drafts.length} review rows.`);
