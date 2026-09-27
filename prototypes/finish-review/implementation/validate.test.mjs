import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildInventory, BASE, hash, matchesForm } from './inventory.mjs';
import { validate, validSpan, editorialFingerprint } from './validate.mjs';
import { selectQueue, restoreQueue } from './runtime-contract.mjs';

// TEST ONLY: invented tiny inventory, never shipped or used by CLI validation.
const target = { targetId: 'ledger:her', forms: ['her'], stage: { city: 0, use: 'productive-target' }, reviewEligible: true, otherAcceptedSources: [] };
const inventory = { base: BASE, words: [{ wordId: 'test:hus', sourceSha256: 'a'.repeat(64) }], targets: [target] };
let evidence = 'TEST ONLY successor editorial evidence';
const span = (text, token) => ({ text: token, start: text.indexOf(token), end: text.indexOf(token) + token.length });
const approval = kind => ({artifact: `${kind}-editorial.md`, sha256: hash(evidence)});
function fixture() {
  const envelope = (kind, rows) => ({ version: 1, base: BASE, language: 'da', city: 0, kind, rows });
  const sentence = (kind, da, en) => ({wordId:'test:hus',city:0,sourceSha256:'a'.repeat(64),version:1,
    sentenceId:`city1:test:hus:${kind}:sentence:v1`,audioId:`city1:test:hus:${kind}:audio:v1`,
    text:{da,en},wordSpan:span(da,'hus'),status:'accepted',approval:approval(kind)});
  return { board: envelope('board',[sentence('board','Et hus.','A house.')]),
    review:envelope('review',[{...sentence('review','Et hus er her.','A house is here.'),targetId:target.targetId,targetStage:target.stage,targetSpan:span('Et hus er her.','her')}]),
    about:envelope('about',[{targetId:target.targetId,targetStage:target.stage,version:1,meaningEn:'Here',usageEn:'Points to a nearby place.',example:{da:'Bilen er her.',en:'The car is here.'},targetSpan:span('Bilen er her.','her'),status:'accepted',approval:approval('review')}]) };
}
evidence += '\n' + Object.values(fixture()).flatMap(d=>d.rows.map(r=>`${r.wordId ?? r.targetId} ${editorialFingerprint(r)}`)).join('\n');
const check = (f, mode='acceptance') => validate(f, inventory, {mode,readEvidence:()=>evidence});
test('valid synthetic tiny fixture (test only)',()=>assert.deepEqual(check(fixture()).errors,[]));
for (const [name, mutate, expected] of [
  ['duplicate IDs', f=>f.board.rows.push(f.board.rows[0]), 'duplicate ID'],
  ['missing IDs', f=>f.review.rows=[], 'missing IDs'],
  ['unknown ID', f=>f.board.rows[0].wordId='da:unknown', 'unknown word'],
  ['wrong city', f=>f.review.rows[0].city=1, 'wrong city'],
  ['wrong document city', f=>f.board.city=1, 'envelope'],
  ['wrong target', f=>f.review.rows[0].targetId='ledger:at', 'ineligible'],
  ['wrong stage', f=>f.review.rows[0].targetStage={city:7,use:'productive-target'}, 'wrong target stage'],
  ['bad word span', f=>f.board.rows[0].wordSpan.end=100, 'word span'],
  ['bad target form', f=>f.review.rows[0].targetSpan=span('Et hus er her.','hus'), 'target span'],
  ['bad About span', f=>f.about.rows[0].targetSpan.start=0, 'About target span'],
  ['shared sentence identity', f=>f.review.rows[0].sentenceId=f.board.rows[0].sentenceId, 'sentenceId'],
  ['shared audio identity', f=>f.review.rows[0].audioId=f.board.rows[0].audioId, 'audioId'],
  ['Danish blank', f=>f.board.rows[0].text.da=' ', 'Danish and English'],
  ['English blank', f=>f.review.rows[0].text.en='', 'Danish and English'],
  ['English nonstring', f=>f.review.rows[0].text.en=42, 'Danish and English'],
  ['stale source', f=>f.board.rows[0].sourceSha256='bad', 'stale word source'],
  ['historical approval', f=>f.board.rows[0].approval.artifact='docs/curriculum/t3-sol-review.md', 'successor'],
  ['wrong evidence hash', f=>f.board.rows[0].approval.sha256='bad', 'evidence hash'],
  ['missing About', f=>f.about.rows=[], 'missing shared About'],
  ['draft not accepted', f=>{f.board.rows[0].status='draft';f.board.rows[0].approval=null;}, 'successor'],
]) test(name,()=>{const f=fixture();mutate(f);assert.ok(check(f).errors.some(e=>e.includes(expected)),JSON.stringify(check(f).errors));});
test('draft gaps are reported and allowed',()=>{const f=fixture();for(const d of Object.values(f))d.rows=[];const r=check(f,'draft');assert.deepEqual(r.errors,[]);assert.deepEqual(r.missing.board,['test:hus']);assert.ok(r.coverage[0].gaps.includes('no-review-focus'));});
test('receptive cannot become a focus',()=>{const inv=structuredClone(inventory);inv.targets[0].reviewEligible=false;assert.ok(validate(fixture(),inv).errors.some(e=>e.includes('ineligible')));});
test('changed text cannot inherit successor approval',()=>{const f=fixture();f.board.rows[0].text.en='The house.';assert.ok(check(f).errors.some(e=>e.includes('evidence hash')));});
test('malformed draft rows report errors without throwing',()=>{const f=fixture();f.board.rows=[null];f.review.rows={};assert.ok(check(f,'draft').errors.length);});
test('spans and phrase matching respect token boundaries and slots',()=>{
  assert.equal(validSpan('huset',{text:'hus',start:0,end:3}),false);
  assert.equal(matchesForm('tingen','ting'),false);
  assert.equal(matchesForm('Hvor er huset?','Hvor er …?'),true);
  assert.equal(matchesForm('Hvor er?','Hvor er …?'),false);
});
test('actual inventory is reproducible and preserves effective stages',async()=>{
  const inv=await buildInventory();assert.deepEqual(inv,JSON.parse(readFileSync(new URL('inventory.json',import.meta.url))));
  assert.equal(inv.words.length,100);assert.equal(inv.targets.length,39);assert.equal(inv.counts.reviewEligible,35);
  assert.equal(inv.targets.find(t=>t.targetId==='ledger:kan').stage.use,'preview-as-chunk');
  assert.equal(inv.targets.some(t=>t.targetId==='ledger:at'),false);
  assert.deepEqual(inv.targets.find(t=>t.targetId==='supplemental:da-word-thing').forms,['ting','tingen']);
});
test('actual preview needs chunk context, and supplemental IDs validate directly',async()=>{
  const inv=await buildInventory();
  const run=(targetId,da,token)=>{
    const f=fixture();const t=inv.targets.find(t=>t.targetId===targetId);const w=inv.words[0];
    f.board.rows=[];f.about.rows=[];
    f.review.rows=[{...f.review.rows[0],wordId:w.wordId,sourceSha256:w.sourceSha256,
      sentenceId:`city1:${w.wordId}:review:sentence:v1`,audioId:`city1:${w.wordId}:review:audio:v1`,
      text:{da,en:'TEST ONLY translation.'},wordSpan:span(da,'mor'),targetId,targetStage:t.stage,
      targetSpan:span(da,token),status:'draft',approval:null}];
    return validate(f,inv).errors;
  };
  assert.deepEqual(run('ledger:kan','Mor, kan du sige det igen? mor.','kan'),[]);
  assert.ok(run('ledger:kan','Min mor kan danse.','kan').some(e=>e.includes('chunk context')));
  assert.deepEqual(run('supplemental:da-word-thing','Min mor ser tingen.','tingen'),[]);
});
const rows=[['a','x'],['b','x'],['c','y']].map(([wordId,targetId])=>({wordId,targetId,sentenceId:wordId+'s:v1',audioId:wordId+'a:v1',version:1}));
const clue = (guesses, by='player', text='Hjem', number=2) => ({by,text,number,guesses});
const green = wordId => ({wordId,result:'green'});
const pin = (row, clueHistoryIndex, source) => ({...row,clueHistoryIndex,clueText:source.text,clueNumber:source.number});
test('one Casey correct guess per PLAYER clue; AI clue ignored',()=>{
  const history=[clue([green('a'),green('c')]),clue([green('b')],'ai')];
  assert.deepEqual(selectQueue(history,rows),[pin(rows[0],0,history[0])]);
  assert.deepEqual(selectQueue(history,rows,['x']),[pin(rows[2],0,history[0])]);
});
test('PLAYER clues remain chronological; unused preference is local and repeated targets allowed',()=>{
  const history=[clue([green('a')]),clue([green('b')],'ai'),clue([green('b'),green('c')]),clue([green('b')]),clue([green('a')])];
  assert.deepEqual(selectQueue(history,rows),[pin(rows[0],0,history[0]),pin(rows[2],2,history[2]),pin(rows[1],3,history[3]),pin(rows[0],4,history[4])]);
  assert.deepEqual(selectQueue(history,rows,['x']).map(p=>p.clueHistoryIndex),[0,2,3,4]);
});
test('no eligible correct guess omitted; never borrow targets, reveals, wrong guesses or other clues',()=>{
  const history=[{...clue([{wordId:'a',result:'bystander'},{wordId:'b',result:'assassin'}]),targets:['c'],reveals:[green('c')]},clue([green('missing')]),clue([]),clue([green('a')],'ai'),clue([green('a')],'player','Senere',1)];
  assert.deepEqual(selectQueue(history,rows),[pin(rows[0],4,history[4])]);
});
for (const [field,values] of [['text',[undefined,null,42,'','  ']],['number',[undefined,null,'2',0,5,1.5,NaN,Infinity]]]) {
  for (const value of values) test(`invalid clue ${field} ${String(value)} omitted and cannot restore`,()=>{
    const source={...clue([green('a')]),[field]:value};
    assert.deepEqual(selectQueue([source],rows),[]);
    const saved={version:1,roundId:'r1',queue:[pin(rows[0],0,source)],cursor:0,dismissed:false};
    assert.equal(restoreQueue(saved,'r1',rows,[source]).dismissed,true);
  });
}
test('valid pins resume unchanged with repeated word/target on distinct clues; no mutation or rewards',()=>{
  const history=[clue([green('a')]),clue([green('a')],'player','Bolig',1)];
  const saved={version:1,roundId:'r1',queue:history.map((c,i)=>pin(rows[0],i,c)),cursor:1,dismissed:false};
  const before=JSON.stringify({saved,history,rows});
  assert.deepEqual(restoreQueue(saved,'r1',rows,history),saved);
  assert.equal(JSON.stringify({saved,history,rows}),before);
  assert.equal('rewards' in restoreQueue({...saved,rewards:10},'r1',rows,history),false);
});
test('legacy, invalid state, pin tamper and stale row versions dismiss without rewards',()=>{
  const history=[clue([green('a')]),clue([green('b')],'ai'),clue([{wordId:'a',result:'bystander'}]),clue([green('c')],'player','Andet',1)];
  const saved={version:1,roundId:'r1',queue:[pin(rows[0],0,history[0]),pin(rows[2],3,history[3])],cursor:0,dismissed:false};
  const invalid=[undefined,{}, {...saved,version:0},{...saved,cursor:8},{...saved,roundId:'old'},{...saved,queue:rows}, {...saved,queue:[saved.queue[0],saved.queue[0]]},{...saved,queue:[...saved.queue].reverse()}];
  for(const patch of [{clueHistoryIndex:1},{clueHistoryIndex:2},{clueHistoryIndex:99},{clueHistoryIndex:-1},{clueHistoryIndex:0.5},{clueHistoryIndex:'0'},{clueText:'tampered'},{clueNumber:1},{wordId:'b'},{targetId:'y'},{sentenceId:'stale'},{audioId:'stale'},{version:2}]) invalid.push({...saved,queue:[{...saved.queue[0],...patch}]});
  for(const key of ['clueHistoryIndex','clueText','clueNumber']) {const broken=structuredClone(saved);delete broken.queue[0][key];invalid.push(broken);}
  for(const value of invalid) assert.deepEqual(restoreQueue(value,'r1',rows,history),{version:1,roundId:'r1',queue:[],cursor:0,dismissed:true});
  assert.equal(restoreQueue(saved,'r1',rows).dismissed,true);
  assert.equal(restoreQueue(saved,'r1',rows.map(r=>({...r,version:2})),history).dismissed,true);
  for(const patch of [{by:'ai'},{text:'changed'},{number:3},{guesses:[{wordId:'a',result:'bystander'}]}]) {
    assert.equal(restoreQueue(saved,'r1',rows,[{...history[0],...patch},...history.slice(1)]).dismissed,true);
  }
});
