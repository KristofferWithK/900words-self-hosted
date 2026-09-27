// Explicit successor acceptance; the original CLI still accepts only its frozen 100.
import { validateExtensionManifest } from './checkpoint.mjs';
import { extensionPredecessorWords } from './predecessor.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildInventory, hash, matchesForm } from '../inventory.mjs';
import { validate } from '../validate.mjs';
const root = new URL('../../../../', import.meta.url);
const parent = 'prototypes/finish-review/implementation/';
const read = p => readFileSync(new URL(p, root), 'utf8');
const json = p => JSON.parse(read(p));
const local = p => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const sorted = xs => [...xs].sort();
export async function inputs({ draft = false } = {}) {
  return { scope: local('scope.json'), board: local((draft ? 'reviewed-originals/' : '')+'board-sentences.json'), review: local((draft ? 'reviewed-originals/' : '')+'review-sentences.json'),
    about: json(parent+'about-targets.json'), inventory: await buildInventory(),
    originals: { board: json(parent+'board-sentences.json'), review: json(parent+'review-sentences.json'), about: json(parent+'about-targets.json') } };
}
export function check(data, { acceptance = false } = {}) {
  const { scope, board, review, about, inventory, originals } = data;
  const errors = [];
  if(acceptance) for(const [file, sha] of Object.entries(validateExtensionManifest(readFileSync(new URL('successor-hashes.json', import.meta.url), 'utf8')))) {
    if(hash(readFileSync(new URL(file,import.meta.url),'utf8'))!==sha) errors.push(`successor frozen bytes drift: ${file}`);
  }
  const checkThat = (ok, message) => { if (!ok) errors.push(message); };
  const sameSet = (a,b) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
  const roster = json('src/data/city1-replacement-corpus.da.json');
  const cycle = json('src/data/city1-board-cycle.da.json');
  const currentWords = new Map(extensionPredecessorWords(json('src/data/words.da.json')).map(w => [w.id,w]));
  const acceptedIds = inventory.words.map(w=>w.wordId), accepted = new Set(acceptedIds);
  const missing = roster.wordIds.filter(id=>!accepted.has(id));
  checkThat(accepted.size === 100 && roster.wordIds.length === 100 && new Set(roster.wordIds).size === 100, 'inventory/roster must each be 100 unique IDs');
  checkThat(roster.wordIds.filter(id=>accepted.has(id)).length === 24 && new Set([...accepted,...roster.wordIds]).size === 176, 'overlap/union must be 24/176');
  checkThat(missing.length === 76 && missing.includes('da:film'), 'missing set must be 76 including film');
  checkThat(sameSet(scope.wordIds, missing), 'scope exact missing IDs');
  checkThat(JSON.stringify(scope.counts) === JSON.stringify({acceptedInventory:100,authoredRoster:100,overlap:24,union:176,missing:76}), 'scope counts');
  checkThat(sameSet([...new Set(cycle.boards.flatMap(b=>b.wordIds))], roster.wordIds), 'actual cycle union must equal roster');
  checkThat(JSON.stringify(scope.authoredCycle.boards) === JSON.stringify(cycle.boards.map(b=>({id:b.id,wordIds:b.wordIds}))), 'cycle provenance board order/IDs');
  checkThat(scope.authoredCycle.sourceSha256 === cycle.sourceSha256 && scope.authoredCycle.boardCount === cycle.boards.length, 'cycle source identity');
  checkThat(scope.workspaceBase === 'db2020d8eb937df104fae867c876f1b1cbd5c511' && scope.contractBase === inventory.base, 'base provenance');
  for (const [path, sha] of Object.entries({...scope.sources,...scope.immutableAcceptedFiles})) checkThat(hash(path === 'src/data/words.da.json' ? JSON.stringify([...currentWords.values()],null,2)+'\n' : read(path))===sha, `source byte drift: ${path}`);
  checkThat(JSON.stringify(json(parent+'inventory.json')) === JSON.stringify(inventory), 'original inventory drift');
  checkThat(inventory.targets.length === 39 && inventory.targets.filter(t=>t.reviewEligible).length === 35, 'effective target catalogue must remain 39/35');
  checkThat(about.rows.length === 39 && JSON.stringify(about) === JSON.stringify(originals.about), 'reuse unchanged 39 About records');
  checkThat(sameSet(scope.wordSources.map(w=>w.wordId),missing), 'source pair roster');
  for (const w of scope.wordSources) {
    const current = currentWords.get(w.wordId);
    checkThat(current && w.headword === current.da && JSON.stringify(w.sensesEn) === JSON.stringify(current.en) && w.pos === current.pos && w.curriculumRank === current.curriculumRank && w.exampleDa === current.exampleDa && w.exampleEn === current.exampleEn, `current dictionary/source pair mismatch: ${w.wordId}`);
    checkThat(w.sourceSha256 === hash(JSON.stringify([w.wordId,w.curriculumRank,w.exampleDa,w.exampleEn])), `word source hash: ${w.wordId}`);
    checkThat(sameSet(w.authoredBoardIds,cycle.boards.filter(b=>b.wordIds.includes(w.wordId)).map(b=>b.id)), `board provenance: ${w.wordId}`);
  }
  const evidence = file=>read(parent+file);
  const extensionEvidence = file=>readFileSync(new URL(file,import.meta.url),'utf8');
  const reusedAbout = { ...about, rows: about.rows.map(r=>({...r,status:'editorial',approval:null})) };
  const originalResult = validate(originals, inventory, {mode:'acceptance',readEvidence:evidence});
  errors.push(...originalResult.errors.map(e=>'original acceptance: '+e));
  // Reuse the original structural helper with an explicit local projection only.
  // No persisted inventory changes and no extension acceptance assertion.
  const projection = {...inventory, words:scope.wordSources};
  const draftResult = validate({board,review,about:reusedAbout},projection,{mode:'draft',readEvidence:extensionEvidence});
  errors.push(...draftResult.errors);
  for (const kind of ['board','review']) {
    const rows = data[kind].rows;
    checkThat(rows.length === 76 && sameSet(rows.map(r=>r.wordId),missing), `${kind}: exactly 76 missing IDs`);
    for (const row of rows) {
      if (acceptance) {
        checkThat(row.status === 'accepted', `${kind}/${row.wordId}: successor acceptance required`);
        const original = local('reviewed-originals/'+kind+'-sentences.json').rows.find(r=>r.wordId===row.wordId);
        const expected = structuredClone(original);
        if(kind==='review' && row.wordId==='da:finde') { expected.text.en='Will you find it again?'; expected.version=2; expected.sentenceId=expected.sentenceId.replace(':v1',':v2'); expected.audioId=expected.audioId.replace(':v1',':v2'); }
        checkThat(JSON.stringify({...row,status:'editorial',approval:null})===JSON.stringify(expected), `${kind}/${row.wordId}: reviewed prose/version drift`);
      } else checkThat(row.status === 'editorial' && row.approval === null && row.version === 1, `${kind}/${row.wordId}: unaccepted v1 only`);
      if (kind === 'review') {
        const b=board.rows.find(b=>b.wordId===row.wordId);
        checkThat(b?.text.en.toLowerCase() !== row.text.en.toLowerCase(), `${row.wordId}: English board/review must differ`);
      }
    }
  }
  const allRows=[...originals.board.rows,...originals.review.rows,...board.rows,...review.rows];
  const identities=allRows.flatMap(r=>[r.sentenceId,r.audioId]);
  checkThat(identities.length === 704 && new Set(identities).size===704, 'all 704 sentence/audio identities must be unique');
  const combined = { board:{...board,rows:[...originals.board.rows,...board.rows]},review:{...review,rows:[...originals.review.rows,...review.rows]},about };
  const structuralCombined=structuredClone(combined);
  for(const doc of Object.values(structuralCombined)) for(const r of doc.rows) { r.status='editorial'; r.approval=null; }
  const combinedResult=validate(structuralCombined,{...inventory,words:[...inventory.words,...scope.wordSources]},{mode:'draft',readEvidence:evidence});
  errors.push(...combinedResult.errors.map(e=>'combined local structural check: '+e));
  const rejectedByOriginal=validate({board,review,about},inventory,{mode:'acceptance',readEvidence:evidence});
  checkThat(rejectedByOriginal.errors.some(e=>e.includes('requires exactly 100 rows')) && rejectedByOriginal.errors.some(e=>e.includes('unknown word ID')), 'original gate must reject extension count and eligibility');
  const rowFindings=review.rows.map(r=>({wordId:r.wordId,boardForm:board.rows.find(b=>b.wordId===r.wordId)?.wordSpan.text,reviewForm:r.wordSpan.text,targetId:r.targetId,targetStage:r.targetStage,targetForm:r.targetSpan.text,
    incidentalSurfaceTargetIds:inventory.targets.filter(t=>t.targetId!==r.targetId && t.forms.some(f=>matchesForm(r.text.da,f))).map(t=>t.targetId),
    aboutExampleDistinct:about.rows.find(a=>a.targetId===r.targetId)?.example.da!==r.text.da,
    editorialStatus:acceptance ? 'parent-accepted independent model reports; no human/audio certification' : 'reviewed original draft'}));
  return { errors, counts: {board:board.rows.length,review:review.rows.length,aboutReused:about.rows.length,combinedBoard:combined.board.rows.length,combinedReview:combined.review.rows.length,uniqueSentenceAndAudioIds:new Set(identities).size},
    originalAcceptance:{errors:originalResult.errors.length},originalRejectsExtension:{errors:rejectedByOriginal.errors.length,countAndEligibilityRejection:true},
    extensionCoverage:draftResult.coverage,combinedCoverage:combinedResult.coverage,rowFindings,
    claim:'Dual-source validation; parent-reported independent model acceptance when requested. Optional exposure only, no retrieval/mastery, native-human/audio or whole-route certification.' };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result=check(await inputs(), { acceptance: true });
  if(process.argv.includes('--report')) writeFileSync(new URL('successor-validation.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({...result,extensionCoverage:undefined,combinedCoverage:undefined,rowFindings:undefined},null,2));
  process.exitCode=result.errors.length?1:0;
}
