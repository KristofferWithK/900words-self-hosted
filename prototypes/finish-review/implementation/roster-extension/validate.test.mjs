import assert from 'node:assert/strict';
import test from 'node:test';
import { inputs, check } from './validate.mjs';
import { validSpan } from '../validate.mjs';
const data = await inputs({ draft: true });
const mutated = fn => { const d=structuredClone(data); fn(d); return check(d); };
const fails = (name, fn, pattern) => test(name,()=>assert.ok(mutated(fn).errors.some(e=>pattern.test(e))));
test('complete extension passes local checks; original acceptance remains green',()=>{
  const result=check(data); assert.deepEqual(result.errors,[]);
  assert.deepEqual(result.counts,{board:76,review:76,aboutReused:39,combinedBoard:176,combinedReview:176,uniqueSentenceAndAudioIds:704});
  assert.equal(result.originalAcceptance.errors,0);
  assert.ok(result.originalRejectsExtension.errors>0);
});
fails('missing film is rejected',d=>{d.review.rows=d.review.rows.filter(r=>r.wordId!=='da:film');},/exactly 76 missing IDs/);
fails('duplicate row cannot stand in for a missing word',d=>{d.board.rows[0]=d.board.rows[1];},/duplicate ID|exactly 76 missing IDs/);
fails('rank-100 word is not an extension member',d=>{d.board.rows[0].wordId='da:mor';},/unknown word ID|exactly 76 missing IDs/);
fails('source pair drift is rejected',d=>{d.scope.wordSources[0].exampleDa+=' ændret';},/source pair mismatch|word source hash/);
fails('row source hash drift is rejected',d=>{d.review.rows[0].sourceSha256='0'.repeat(64);},/stale word source/);
fails('new row cannot self-accept',d=>{d.review.rows[0].status='accepted';d.review.rows[0].approval={artifact:'editorial.md',sha256:'0'.repeat(64)};},/unaccepted v1 only/);
fails('editorial row must have null approval',d=>{d.board.rows[0].approval={};},/approval must be null/);
fails('empty English is rejected',d=>{d.review.rows[0].text.en='';},/nonblank exact Danish and English/);
fails('wrong UTF16 span is rejected',d=>{d.review.rows[0].wordSpan.start++;},/bad inflected word span/);
fails('word-internal et match is rejected',d=>{const r=d.review.rows.find(r=>r.wordId==='da:år');r.targetSpan={text:'et',start:4,end:6};},/bad target span/);
fails('receptive target cannot be focus',d=>{const r=d.review.rows[0];r.targetId='ledger:skål';r.targetStage={city:0,use:'receptive-ambient'};},/ineligible City1 target/);
fails('later stage cannot replace effective City1 stage',d=>{d.review.rows[0].targetStage={city:1,use:'productive-target'};},/wrong target stage/);
fails('About example cannot duplicate linked review',d=>{const r=d.review.rows[0];d.about.rows.find(a=>a.targetId===r.targetId).example={...r.text};},/About must be an alternative/);
fails('board/review Danish must differ',d=>{const r=d.review.rows[0];d.board.rows[0].text={...r.text};d.board.rows[0].wordSpan={...r.wordSpan};},/board\/review Danish must differ/);
fails('board/review English must differ',d=>{d.board.rows[0].text.en=d.review.rows[0].text.en;},/English board\/review must differ/);
fails('review cannot share board audio identity',d=>{d.review.rows[0].audioId=d.board.rows[0].audioId;},/invalid or shared audioId/);
test('preview kan can focus only the existing fixed request context',()=>{
  const valid=mutated(d=>{const r=d.review.rows.find(r=>r.wordId==='da:sige');r.targetId='ledger:kan';r.targetStage={city:0,use:'preview-as-chunk'};r.targetSpan={text:'kan',start:10,end:13};});
  assert.deepEqual(valid.errors,[]);
  const invalid=mutated(d=>{const r=d.review.rows.find(r=>r.wordId==='da:sige');r.targetId='ledger:kan';r.targetStage={city:0,use:'preview-as-chunk'};r.text={da:'Jeg kan sige navnet.',en:'I can say the name.'};r.wordSpan={text:'sige',start:8,end:12};r.targetSpan={text:'kan',start:4,end:7};});
  assert.ok(invalid.errors.some(e=>e.includes('preview requires an eligible fixed chunk context')));
});
test('span helper uses UTF16 units after an astral character',()=>{
  assert.equal(validSpan('🎬 Filmen er god.',{text:'Filmen',start:3,end:9}),true);
  assert.equal(validSpan('🎬 Filmen er god.',{text:'Filmen',start:2,end:8}),false);
});
fails('cycle provenance cannot silently change',d=>{d.scope.authoredCycle.boards[0].wordIds.reverse();},/cycle provenance/);
fails('immutable original file hash mismatch is detected',d=>{const k=Object.keys(d.scope.immutableAcceptedFiles)[0];d.scope.immutableAcceptedFiles[k]='0'.repeat(64);},/source byte drift/);
const acceptedData = await inputs();
test('successor dual-source acceptance passes with original About evidence independently checked',()=>assert.deepEqual(check(acceptedData,{acceptance:true}).errors,[]));
for(const [name,change] of [
  ['prose',d=>{d.review.rows[0].text.en+=' changed';}],
  ['approval',d=>{d.board.rows[0].approval.sha256='0'.repeat(64);}],
  ['status',d=>{d.review.rows[0].status='editorial';d.review.rows[0].approval=null;}],
  ['version',d=>{d.review.rows.find(r=>r.wordId==='da:finde').version=1;}],
  ['original About',d=>{d.originals.about.rows[0].usageEn+=' changed';}],
]) test(`successor rejects ${name} drift`,()=>{const d=structuredClone(acceptedData);change(d);assert.ok(check(d,{acceptance:true}).errors.length);});
