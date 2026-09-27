import { extensionPredecessorWords } from './roster-extension/predecessor.mjs';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const ROOT = new URL('../../../', import.meta.url);
export const BASE = '21cd5ac2f9c2eaa24ca34674f6b9a580d77a8a82';
export const hash = value => createHash('sha256').update(value).digest('hex');
export const read = path => readFileSync(new URL(path, ROOT), 'utf8');
export const json = path => JSON.parse(read(path));
const supportPath = 'src/lang/da/curriculum-support.ts';
const wordPath = 'src/data/words.da.json';
const ledgerPath = 'src/data/function-words.da.json';
// Narrow, read-only source loading. No compiler, app entry point, or dependencies.
async function moduleUrl(path, imports = {}) {
  let code = stripTypeScriptTypes(read(path), { mode: 'strip' });
  for (const [specifier, url] of Object.entries(imports)) code = code.replace(`'${specifier}'`, `'${url}'`);
  return `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
}
export function matchesForm(text, form) {
  if (typeof text !== 'string') return false;
  const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = form.split('…').map(s => escape(s.trim())).join('.+?');
  return new RegExp(`(?<![\\p{L}\\p{N}])${pattern}(?![\\p{L}\\p{N}])`, 'iu').test(text);
}
export async function buildInventory() {
  const support = await import(await moduleUrl(supportPath));
  const ledgerTerms = new Set(Object.values(json(ledgerPath)).flat());
  const classified = support.DANISH_LEDGER_FORMS.map(p => p.term);
  if (new Set(classified).size !== classified.length || classified.length !== ledgerTerms.size || classified.some(t => !ledgerTerms.has(t))) throw Error('Ledger classification must preserve every unique source term');
  // Rebuild immutable authoring inputs independently of runtime presentation.
  // Extension authoring saw accepted original100 pairs; original authoring saw
  // the historical instructional corpus. Exact whole-file hashes bind both.
  const currentWords = extensionPredecessorWords(json(wordPath));
  let wordSource = read(wordPath);
  let allWords = currentWords;
  const snapshot = new URL('predecessor-examples.json', import.meta.url);
  if (existsSync(snapshot)) {
    const prior = new Map(JSON.parse(readFileSync(snapshot, 'utf8')).map(w => [w.id, w]));
    const accepted = new Map(json('prototypes/finish-review/implementation/board-sentences.json').rows.map(r => [r.wordId, r]));
    allWords = currentWords.map(w => {
      const old = prior.get(w.id);
      if (!old) return w;
      const next = accepted.get(w.id);
      if (!((w.exampleDa === old.exampleDa && w.exampleEn === old.exampleEn) ||
        (w.exampleDa === next?.text.da && w.exampleEn === next?.text.en))) throw Error(`${w.id}: unauthorized board source drift`);
      return { ...w, ...old };
    });
    wordSource = JSON.stringify(allWords, null, 2) + '\n';
  }
  const words = allWords.filter(w => w.curriculumRank >= 1 && w.curriculumRank <= 100)
    .sort((a, b) => a.curriculumRank - b.curriculumRank)
    .map(w => ({ wordId: w.id, headword: w.da, curriculumRank: w.curriculumRank, city: 0,
      sourceSha256: hash(JSON.stringify([w.id, w.curriculumRank, w.exampleDa, w.exampleEn])) }));
  if (words.length !== 100 || new Set(words.map(w => w.wordId)).size !== 100 || words.some((w, i) => w.curriculumRank !== i + 1)) throw Error('City1 must be exactly 100 unique IDs at ranks 1–100');
  const targets = [];
  for (const [kind, profiles] of [['ledger', support.DANISH_LEDGER_FORMS], ['supplemental', support.DANISH_SUPPLEMENTAL_SUPPORT]]) {
    for (const p of profiles) {
      const stage = p.stages.filter(s => s.city <= 0).at(-1);
      if (!stage) continue;
      targets.push({ targetId: `${kind}:${p.term ?? p.id}`, kind,
        forms: p.forms ?? [p.term], ...(p.kind ? { supplementalKind: p.kind } : {}),
        classification: p.target, stage: { city: stage.city, use: stage.use },
        functionIds: stage.functionIds, reviewEligible: stage.use !== 'receptive-ambient',
        stages: p.stages });
    }
  }
  const helperPath = 'src/lang/da/curriculum-authoring.ts';
  const cityPath = 'src/lang/da/curriculum-cities-1-3.ts';
  const grammarPath = 'src/lang/da/beginner-grammar-lessons.ts';
  const { DANISH_CITIES_1_3: cities } = await import(await moduleUrl(cityPath, {
    './curriculum-authoring': await moduleUrl(helperPath),
  }));
  const { DANISH_BEGINNER_GRAMMAR_LESSONS: lessons } = await import(await moduleUrl(grammarPath));
  const c = cities[0];
  const sources = [];
  for (const a of [...c.capsules, ...c.exchanges, c.dueReview, ...c.exitTask.steps]) {
    for (const [field, text] of [
      ['visualDa', a.visualDa], ['answer.modelDa', a.answer.modelDa],
      ...a.audio.map((line, i) => [`audio[${i}].textDa`, line.textDa]),
    ]) if (text) sources.push({ path: cityPath, id: a.id, field, mode: a.mode, role: a.role, text });
  }
  for (const lesson of lessons.sonderborg) lesson.examples.forEach(([text], i) => {
    sources.push({ path: grammarPath, id: lesson.id, field: `examples[${i}][0]`, mode: 'reading', role: 'exposure', text });
  });
  for (const target of targets) target.otherAcceptedSources = sources
    .filter(s => target.forms.some(f => matchesForm(s.text, f)))
    .map(({ text, ...s }) => ({ ...s, match: 'surface-presence-only' }));
  const counts = {};
  for (const t of targets) {
    const key = `${t.kind}${t.supplementalKind ? ':' + t.supplementalKind : ''}:${t.stage.use}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return { version: 1, base: BASE, language: 'da', city: 0,
    sources: Object.fromEntries([wordPath, ledgerPath, supportPath, helperPath, cityPath, grammarPath].map(p => [p, hash(p === wordPath ? wordSource : read(p))])),
    counts: { words: words.length, targets: targets.length, reviewEligible: targets.filter(t => t.reviewEligible).length, byKindAndStage: counts },
    words, targets };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const inventory = await buildInventory();
  writeFileSync(new URL('inventory.json', import.meta.url), JSON.stringify(inventory, null, 2) + '\n');
  console.log(JSON.stringify(inventory.counts, null, 2));
}
