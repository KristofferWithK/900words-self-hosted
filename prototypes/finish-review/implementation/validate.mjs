import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildInventory, hash, matchesForm } from './inventory.mjs';

export const FILES = { board: 'board-sentences.json', review: 'review-sentences.json', about: 'about-targets.json' };
const nonblank = s => typeof s === 'string' && /\p{L}/u.test(s) && s === s.trim();
const keys = (o, names) => o && typeof o === 'object' && !Array.isArray(o) && Object.keys(o).sort().join() === names.split(' ').sort().join();
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export function editorialFingerprint(row) {
  const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).filter(k => k !== 'approval').sort().map(k => [k, canonical(value[k])])) : value;
  return hash(JSON.stringify(canonical(row)));
}
export function validSpan(text, span) {
  return typeof text === 'string' && keys(span, 'text start end') && nonblank(span.text) &&
    Number.isInteger(span.start) && Number.isInteger(span.end) && span.start >= 0 && span.end > span.start &&
    span.end <= text.length && text.slice(span.start, span.end) === span.text &&
    !/[\p{L}\p{N}]/u.test(text[span.start - 1] ?? '') && !/[\p{L}\p{N}]/u.test(text[span.end] ?? '');
}
// Inject inventory/evidence reader only for unit fixtures. CLI always recomputes actual sources.
export function validate(sets, inventory, { mode = 'draft', readEvidence = () => { throw Error('evidence unavailable'); } } = {}) {
  const errors = [], missing = {};
  const fail = (where, message) => errors.push(`${where}: ${message}`);
  if (!['draft', 'acceptance'].includes(mode)) fail('mode', 'expected draft or acceptance');
  const words = new Map(inventory.words.map(w => [w.wordId, w]));
  const targets = new Map(inventory.targets.map(t => [t.targetId, t]));
  const identities = new Set();
  const aboutById = new Map();
  const evidenceFor = kind => kind === 'board' ? 'board-editorial.md' : 'review-editorial.md';
  function editorial(row, kind, at) {
    if (!['draft', 'editorial', 'accepted'].includes(row.status)) fail(at, 'invalid status');
    if (mode === 'acceptance' && row.status !== 'accepted') fail(at, 'successor editorial acceptance required');
    if (row.status === 'accepted') {
      if (!keys(row.approval, 'artifact sha256') || row.approval.artifact !== evidenceFor(kind)) fail(at, 'expected owned successor approval artifact');
      else {
        try {
          const bytes = readEvidence(row.approval.artifact);
          if (!nonblank(bytes) || hash(bytes) !== row.approval.sha256 || !bytes.includes(`${row.wordId ?? row.targetId} ${editorialFingerprint(row)}`)) fail(at, 'successor evidence hash/record link mismatch');
        } catch { fail(at, 'successor evidence missing'); }
      }
    } else if (row.approval !== null) fail(at, 'unaccepted row approval must be null');
  }
  function bilingual(o, at) {
    if (!keys(o, 'da en') || !nonblank(o.da) || !nonblank(o.en)) fail(at, 'nonblank exact Danish and English required');
  }
  function targetCheck(row, at, eligible) {
    const t = targets.get(row.targetId);
    if (!t || (eligible && !t.reviewEligible)) fail(at, 'ineligible City1 target');
    if (!keys(row.targetStage, 'city use') || row.targetStage.city !== t?.stage.city || row.targetStage.use !== t?.stage.use) fail(at, 'wrong target stage');
    return t;
  }
  for (const kind of ['about', 'board', 'review']) {
    const doc = sets[kind];
    if (!keys(doc, 'version base language city kind rows') || doc.version !== 1 || doc.base !== inventory.base || doc.language !== 'da' || doc.city !== 0 || doc.kind !== kind || !Array.isArray(doc.rows)) {
      fail(kind, 'invalid document envelope'); continue;
    }
    const seen = new Set();
    for (const [i, row] of doc.rows.entries()) {
      const at = `${kind}[${i}]`;
      const common = 'status approval';
      const fields = kind === 'about' ? `targetId targetStage version meaningEn usageEn example targetSpan ${common}` :
        `wordId city sourceSha256 version sentenceId audioId text wordSpan ${common}${kind === 'review' ? ' targetId targetStage targetSpan' : ''}`;
      if (!keys(row, fields)) { fail(at, 'wrong fields (see schema.json)'); continue; }
      const id = kind === 'about' ? row.targetId : row.wordId;
      if (seen.has(id)) fail(at, 'duplicate ID');
      seen.add(id);
      if (!Number.isInteger(row.version) || row.version < 1) fail(at, 'positive integer version required');
      editorial(row, kind, at);
      if (kind === 'about') {
        const t = targetCheck(row, at, false);
        if (!nonblank(row.meaningEn) || !nonblank(row.usageEn)) fail(at, 'general meaning/use required');
        bilingual(row.example, at);
        if (!validSpan(row.example?.da, row.targetSpan) || !t?.forms.some(f => matchesForm(row.targetSpan?.text ?? '', f))) fail(at, 'bad About target span/form');
        aboutById.set(id, row);
        continue;
      }
      const w = words.get(id);
      if (!w || row.city !== 0) fail(at, 'unknown word ID or wrong city');
      if (row.sourceSha256 !== w?.sourceSha256) fail(at, 'stale word source');
      bilingual(row.text, at);
      if (!validSpan(row.text?.da, row.wordSpan)) fail(at, 'bad inflected word span');
      for (const field of ['sentenceId', 'audioId']) {
        const expected = `city1:${id}:${kind}:${field === 'audioId' ? 'audio' : 'sentence'}:v${row.version}`;
        if (row[field] !== expected || identities.has(row[field])) fail(at, `invalid or shared ${field}`);
        identities.add(row[field]);
      }
      if (kind === 'review') {
        const t = targetCheck(row, at, true);
        if (!validSpan(row.text?.da, row.targetSpan) || !t?.forms.some(f => matchesForm(row.targetSpan?.text ?? '', f))) fail(at, 'bad target span/form');
        if (t?.stage.use === 'preview-as-chunk' && !inventory.targets.some(chunk => chunk.supplementalKind === 'chunk' && chunk.reviewEligible &&
          chunk.forms.some(f => t.forms.some(term => matchesForm(f, term)) && matchesForm(row.text?.da ?? '', f)))) fail(at, 'preview requires an eligible fixed chunk context');
        const about = aboutById.get(row.targetId);
        if (!about) {
          if (mode === 'acceptance') fail(at, 'missing shared About');
        } else if (about.example.da === row.text.da) fail(at, 'About must be an alternative example');
      }
    }
    const required = kind === 'about' ? inventory.targets.map(t => t.targetId) : [...words.keys()];
    missing[kind] = required.filter(id => !seen.has(id));
    if (mode === 'acceptance' && missing[kind].length) fail(kind, `${missing[kind].length} missing IDs`);
    if (mode === 'acceptance' && kind !== 'about' && doc.rows.length !== words.size) fail(kind, `requires exactly ${words.size} rows`);
  }
  const safeRows = kind => Array.isArray(sets[kind]?.rows) ? sets[kind].rows.filter(r => r && typeof r === 'object') : [];
  const boards = new Map(safeRows('board').map(r => [r.wordId, r]));
  for (const r of safeRows('review')) {
    const b = boards.get(r?.wordId);
    if (typeof b?.text?.da === 'string' && typeof r.text?.da === 'string' && b.text.da.toLocaleLowerCase('da') === r.text.da.toLocaleLowerCase('da')) fail(r.wordId, 'board/review Danish must differ');
  }
  const coverage = inventory.targets.map(t => {
    const presence = {};
    for (const kind of ['board', 'review']) presence[kind] = safeRows(kind)
      .filter(r => t.forms.some(f => matchesForm(r?.text?.da ?? '', f)))
      .map(r => ({ wordId: r.wordId, status: r.status, mode: kind === 'review' && r.targetId === t.targetId ? t.stage.use : 'incidental-presence' }));
    const focusRows = safeRows('review').filter(r => r.targetId === t.targetId).map(r => r.wordId);
    return { targetId: t.targetId, stage: t.stage, reviewEligible: t.reviewEligible, presence, focusRows,
      about: aboutById.has(t.targetId), otherAcceptedSources: t.otherAcceptedSources,
      gaps: [...(!focusRows.length && t.reviewEligible ? ['no-review-focus'] : []),
        ...(!aboutById.has(t.targetId) ? ['no-general-about'] : []),
        ...(!presence.board.length && !presence.review.length && !t.otherAcceptedSources.length ? ['no-mapped-surface-source'] : [])] };
  });
  return { mode, errors, missing, coverage, claim: 'Presence and authored modes only; no teaching, retrieval, mastery or whole-route floor certification.' };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.some(a => !['--draft', '--acceptance', '--report'].includes(a)) || (args.includes('--draft') && args.includes('--acceptance'))) throw Error('Usage: node validate.mjs [--draft|--acceptance] [--report]');
    const inventory = await buildInventory();
    const stored = JSON.parse(readFileSync(new URL('inventory.json', import.meta.url), 'utf8'));
    if (!equal(stored, inventory)) throw Error('inventory.json is stale; contract owner must regenerate and review');
    const sets = Object.fromEntries(Object.entries(FILES).map(([kind, file]) => [kind, JSON.parse(readFileSync(new URL(file, import.meta.url), 'utf8'))]));
    const result = validate(sets, inventory, {
      mode: args.includes('--acceptance') ? 'acceptance' : 'draft',
      readEvidence: file => readFileSync(new URL(file, import.meta.url), 'utf8'),
    });
    console.log(JSON.stringify(args.includes('--report') ? result : { mode: result.mode, errors: result.errors, missing: result.missing, counts: inventory.counts }, null, 2));
    process.exitCode = result.errors.length ? 1 : 0;
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
