/**
 * Server-owned prompt builders. Kept byte-parallel with src/ai/prompts.ts;
 * proxy/casey/orchestrator.test.mjs pins representative output parity.
 */
import { DEFAULT_PLAYER_LANGUAGE } from './player-language.js';
import { playerForTargetLanguage, targetExampleText } from './learner-examples.js';
import { aiTargetableIds } from './projections.js';
import { PLAYER_VOICE_RULE } from './voice.js';
const revealLabel = (r) => {
    if (r.kind === 'hidden')
        return 'hidden';
    if (r.kind === 'bystander')
        return `revealed neutral (under ${r.against.join('+')} clue)`;
    return `revealed ${r.kind}`;
};
/**
 * "the 2th correct one", as the guess prompt had been saying for its whole
 * life. The engine refuses any clue number outside 1-4, so four cases is the
 * whole domain and a general ordinal routine would be more machinery than the
 * problem has.
 */
const ordinal = (n) => ['', '1st', '2nd', '3rd', '4th'][n] ?? `${n}th`;
const historyLines = (history) => history.length === 0
    ? '(none yet)'
    : history
        .map((c) => `${c.by === 'ai' ? 'You' : 'Partner'} clued "${c.text}" (${c.number}); guesses: ${c.guesses.map((g) => `${g.da}→${g.result}`).join(', ') || '(none)'}`)
        .join('\n');
/**
 * The rules, as Casey needs them.
 *
 * With two roles on a key and nothing else, this paragraph has a job it did not
 * have before: making the CLOCK legible as the only danger there is. What it
 * replaces was written around a card that ended the round on the spot, and once
 * those sentences were cut the remainder still had the shape of a warning —
 * which reads as an instruction to be careful, and being careful is how this
 * board is actually lost.
 *
 * Shared verbatim by the clue and the guess prompt, so it must never name a
 * role the way the clue prompt's board table does (`my key: GREEN`): the
 * guesser is shown no key at all, and projections.test.ts asserts that marker
 * cannot reach them. Keep every mention of the roles in lower case here.
 */
const rules = (lang) => `You are Casey, a cheerful travelling suitcase (with eyes) who accompanies the player through 900words, a cooperative ${lang.name} word-association game that helps your partner learn ${lang.name}. You carry every word they learn, so you want them found. The board is a grid of ${lang.name} words and the two of you play it together — there is no opponent, and no card on it is fatal. Each side holds a secret key that marks some words as its targets, coloured green, and leaves the rest neutral; a card is one or the other and there is no third thing it can be. The two keys DIFFER, so a word that is neutral on yours may be a target on theirs, and you win together only by finding every target on both keys. Neither of you ever sees the other's key, and the guesser is shown no key at all, so on a turn you are guessing there is nothing of yours to protect. You alternate: the clue-giver gives one word and a number, the guesser names cards, and every guess is judged against the CLUE-GIVER'S key and nothing else. The number is the whole allowance — name that many of the giver's targets and the turn ends itself, though the guesser may stop sooner and keep what they have. Naming a card that is not a target on the giver's key ends the turn on the spot; the card is marked neutral for that side only, so it stays takeable later under the other side's clue. Either ending costs one of the shared clue tokens, so a neutral does not merely waste a card, it spends a clue for nothing. That is where the whole danger lives: the clues are few, the targets are many, and a turn spent on one easy word is a turn the board does not give back. When the tokens run out the round does not end — it goes to last chance, where you keep naming cards with no new clue to go on, a target on either key counts, and the first card that is a target on neither ends everything. So win it while the clues last, rather than being careful and running out anyway.`;
/**
 * The budget, spelled out.
 *
 * Casey was giving clues of 1 on a board where that cannot win: the beginner
 * grid is four clues for eight greens, so anything under two a clue runs the
 * tokens out with greens still hidden. He had every number needed to work that
 * out — his own key and the turn count are both in this view — and no reason
 * to. Saying it plainly is cheaper than hoping he does the division.
 *
 * Counted from the AI's own key only, which is all this view carries, so the
 * firewall is untouched.
 */
function paceLine(view) {
    const mine = aiTargetableIds(view).length;
    if (mine === 0 || view.turnsLeft <= 0)
        return '';
    // Your own greens are only half the board's work; the shared pool is spent
    // by both sides, so roughly half these turns are yours.
    const myTurns = Math.max(1, Math.ceil(view.turnsLeft / 2));
    if (view.turnsLeft <= 2) {
        // The last clue is also the only information the player will ever get
        // about these words. When the tokens run out the round does not end — it
        // goes to sudden death, where they keep naming words with no new clue to
        // go on. A green you never pointed at is a green they cannot find, so a
        // narrow last clue does not lose one word, it loses the round.
        return `THE CLOCK: ${mine} of your greens are still hidden and there ${view.turnsLeft === 1 ? 'is 1 clue' : `are ${view.turnsLeft} clues`} left in the shared pool. This is the last clue you are likely to get, and it is also the last thing your partner will ever hear about these words: when the clues run out the round goes to last chance, where they keep naming words with nothing new to go on. Anything you do not point at now, they cannot find later. So cover ALL ${mine} if one idea can stretch that far — say ${Math.min(4, mine)} and name them all — and if no single idea reaches them, pick the clue that gestures at as many as possible. A clue of 1 here throws the rest of the board away.`;
    }
    // Reported as the honest range rather than rounded up. Ceil alone turns a
    // 2.33 average into "3 words per clue", which asks for a harder clue than
    // the board does and is the opposite mistake to the one being fixed.
    const exact = mine / myTurns;
    const low = Math.floor(exact);
    const high = Math.ceil(exact);
    const rate = low === high || low === 0 ? `${high}` : `${low} or ${high}`;
    // What one cheap clue actually costs: the rest, over the turns that are left.
    const after = myTurns > 1 ? Math.ceil((mine - 1) / (myTurns - 1)) : mine - 1;
    const cost = after > high
        ? ` A clue of 1 now leaves ${mine - 1} for ${myTurns - 1} turn${myTurns - 1 === 1 ? '' : 's'} — ${after} a clue, from a position that will not be easier.`
        : '';
    return `THE ARITHMETIC: ${mine} of your greens are still hidden, and ${view.turnsLeft} clues remain in the pool shared with your partner — so expect about ${myTurns} more turns of your own. That is ${rate} word${high === 1 ? '' : 's'} a clue just to finish.${cost}`;
}
/**
 * What the player marked as a bad call, in past rounds' reviews.
 *
 * The only channel in the game where the player gets to say "that was wrong"
 * and have it mean something next time. Kept short and quoted rather than
 * summarised: Casey's own reasoning is in there, and being shown the sentence
 * he wrote is what makes the correction land rather than reading as a scold.
 */
function flaggedBlock(flagged) {
    if (flagged.length === 0)
        return '';
    const lines = flagged.slice(0, 6).map((f) => f.kind === 'clue'
        ? `- your clue «${f.what}»${f.why ? ` — you said: "${f.why}"` : ''}`
        : `- guessing «${f.what}» under their clue «${f.underClue ?? '?'}»${f.why ? ` — you said: "${f.why}"` : ''}`);
    return `
CALLS YOUR PARTNER MARKED AS BAD, from earlier rounds:
${lines.join('\n')}
These are their judgement, not a score. Read what you wrote at the time and ask what the reasoning has in common — a link that was yours rather than theirs, a word you leaned on that a learner does not have, a confidence you did not have the grounds for. Do not mention this list to them; just do not make the same call again.
`;
}
export function buildCluePrompt(view, lang, associationContext = '', player = DEFAULT_PLAYER_LANGUAGE) {
    player = playerForTargetLanguage(lang, player);
    const targetable = aiTargetableIds(view);
    const targetableSet = new Set(targetable);
    const board = view.words
        .map((w) => {
        // Spelled out per row rather than left as an intersection of two columns.
        // The table said "my key: GREEN" beside "revealed green" and expected the
        // reader to work out that the word was spent; a model that did not kept
        // naming a found word as its target, was refused, and the round died on
        // "the AI kept answering invalidly".
        const usable = w.roleOnMyKey === 'green'
            ? targetableSet.has(w.id)
                ? ' | ** YOU MAY TARGET THIS **'
                : ' | green on your key but ALREADY FOUND — cannot be targeted'
            : '';
        return `${w.id} | ${w.da} (${w.en.join('/')}) [${w.pos}] | ${revealLabel(w.reveal)} | my key: ${w.roleOnMyKey.toUpperCase()}${usable}`;
    })
        .join('\n');
    // Casey clues in the language being learned, always: the setting that once
    // switched her to English is gone (owner, 2026-09-11 — "that's what the
    // dictionary is for").
    const system = `${rules(lang)}

You are the CLUE-GIVER this turn. Choose from YOUR unrevealed GREEN words and give a single-word clue in ${lang.name} that evokes them.

THE ONLY WORDS YOU MAY NAME AS TARGETS: ${targetable.length > 0 ? targetable.map((id) => `${id} (${view.words.find((w) => w.id === id).da})`).join(', ') : '(none — you should not have been asked)'}
Naming anything else — a word already found, or a neutral — is not a smaller clue, it is a rejected one, and you will be asked again.${associationContext ? `\n\n${associationContext}` : ''}

${flaggedBlock(view.flagged)}
${paceLine(view)}

Two or three targets is the normal shape of a clue here. The service will reject a one-target clue while two or more unrevealed greens remain; you may use one only when exactly one of your unrevealed greens remains. Before you settle for a pair, look for a third green that fits the same idea — a category (fruit, furniture, weather), a place they both belong to, a thing you do with both. Test each target alone and ask whether your partner, who cannot see your key, would name it from this clue by itself; drop a target you only linked by a chain of reasoning, and keep the rest. Do not talk yourself down to one because two feels risky: the board is not lost by a wrong guess, it is lost by running out of clues with greens still on it.
Hard constraints:
- Give ONE ${lang.name} word. Interpret it in ${lang.name} even if its spelling also exists in English; English glosses on cards do not make a clue illegal. Do not reject a clue just because its language is uncertain from spelling alone. The clue must not be a remaining visible board word, a ${lang.name} form/inflection of one, or a genuine compound in ${lang.name} of one. Found green words in the suitcase no longer restrict clues; unrevealed words and neutral cards still do. A compound contains its parts: ${lang.prompts.compoundExample}. Shared letters, spelling and fragments do NOT make words related: every clue and rationale must name a semantic connection, never an orthographic one. ${lang.prompts.spellingRule}
- Your partner is a ${lang.name} LEARNER: prefer a clear, common association over a clever obscure one.
- Some greens are grammatical words — ${lang.prompts.functionWordNote} — or clue a different green this turn and leave it.
- THE LOOKAHEAD, and do it before you commit to anything: take your candidate clue and go through EVERY unrevealed word on the board that is not one of your targets, scoring each for how well the clue fits it — scoring it as your partner would, who cannot see your key. Under your own clue every one of those words is a trap, whatever it may be on their key, because only your targets score. If the best-scoring of them fits as well as or better than any target does, the clue is wrong: change the clue and score the board again. Then name the one that scored highest — the single riskiest neutral — in your rationale. A neutral costs a turn, and turns are what this board is short of.
- Your partner has the whole allowance to spend and works down their own ranking, so the question is not "would they name a neutral FIRST" — it is whether they would name it at all before the number runs out.
- A word shown as "revealed neutral (under player clue)" that is still GREEN on your key has NOT been scored for you — it is still a valid target. Only "revealed green" is gone for good.
- Never split a clue you could give whole. If three greens fit one idea, say 3; do not give it as a 2 and save the third for a turn that may not come.
- ${targetExampleText(lang.code, PLAYER_VOICE_RULE)}
Respond with ONLY a JSON object: {"clue": string, "number": <how many words you mean, 1-4>, "targetWordIds": [ids of the words you mean], "rationale": <one or two sentences IN ${player.name.toUpperCase()}, written for your partner to read after the game: the connection to each target, AND the riskiest neutral your lookahead turned up — the non-target that scored highest against this clue — with what makes it the wrong answer anyway. "${player.rationaleExample}" That second half is the part they cannot work out for themselves, and it is where the ${lang.name} gets learned. Board words stay in ${lang.name} inside the sentence. The finished explanation only — never deliberation, second thoughts or corrections; if you change your mind, change the clue and the number too, and describe only the clue you are actually giving>}

${targetExampleText(lang.code, 'Example of a strong reply, from a DIFFERENT board where w3 was "hund" (dog) and w7 was "kat" (cat), both green on your key, and the lookahead scored "hest" (horse) as the closest non-target:')}
{"clue": "${lang.prompts.clueExampleWord}", "number": 2, "targetWordIds": ["w3", "w7"], "rationale": "${player.clueExampleRationale}"}`;
    // The gloss column really is English until the word data is translated
    // (ui-language-plan Phase 3), so it is labelled for what it holds rather
    // than for who is reading. Casey reads it and writes the rationale in the
    // player's language regardless.
    const user = `Board (id | ${lang.name.toLowerCase()} (english) [pos] | status | my key):
${board}

Clue history:
${historyLines(view.history)}

Turns left: ${view.turnsLeft}. Give your clue now as JSON.`;
    return [
        { role: 'system', content: system },
        { role: 'user', content: user },
    ];
}
export function buildGuessPrompt(view, lang, associationContext = '', candidateMode, player = DEFAULT_PLAYER_LANGUAGE) {
    player = playerForTargetLanguage(lang, player);
    const board = view.words
        .map((w) => `${w.id} | ${w.da} (${w.en.join('/')}) [${w.pos}] | ${revealLabel(w.reveal)}`)
        .join('\n');
    const topTwo = candidateMode === 'top-two';
    const currentPublicClue = view.history[view.history.length - 1];
    const alreadyMade = currentPublicClue?.by === 'player' ? currentPublicClue.guesses.length : 0;
    const remainingAllowance = Math.max(0, view.currentClue.number - alreadyMade);
    const numberRule = topTwo
        ? `- The clue's ORIGINAL number is ${view.currentClue.number}: that is how many words your partner originally intended. The public history shows ${alreadyMade} guess(es) already made for this clue, leaving ${remainingAllowance} guess(es) in its allowance. Propose alternatives for the NEXT ONE actual guess; do not assert that the original ${view.currentClue.number} matches remain unrevealed.`
        : `- The number is evidence, not decoration: your partner is asserting that exactly ${view.currentClue.number} unrevealed word(s) fit. Work out which SET of ${view.currentClue.number} they most likely meant BEFORE scoring anything, then score that whole set high. Stopping at the one obvious word wastes the turn as surely as a wrong guess does.`;
    const system = `${rules(lang)}

You are the GUESSER this turn. Your partner gave a clue pointing at some of THEIR green words. You do NOT know their key — reason only from the clue's meaning and the board.${associationContext ? `\n\n${associationContext}` : ''}
- THE CLUE IS IN ${lang.name.toUpperCase()}. Your partner is asked for one ${lang.name} word, and submitted clues are interpreted in the course language regardless of the player's interface language. Do not reinterpret the clue as ${player.name}; that language only controls the explanation you write for the player. A dictionary lookup may start from an English word, but its result is still a ${lang.name} clue. For a ${lang.name}/${player.name} homograph with unrelated senses, use the ${lang.name} sense — ${player.homographNote}
${numberRule}
${topTwo ? '- For this NEXT actual guess, return your first and second ranked DISTINCT legal candidates in model rank order. Return two whenever two legal alternatives exist; return one only when there is just one plausible legal candidate. Do not search for a key or intended target: you cannot see either.' : '- List EVERY unrevealed word with any link to the clue, best first, with a calibrated confidence 0-1. A word you leave out is a word you have not ruled out.'}
- EVERY reasoning must be one short sentence IN ${player.name.toUpperCase()} explaining this candidate’s own connection to the clue. Board words stay in ${lang.name} inside it. ${player.reasoningLength}; include only the link, without introductory filler. ${player.reasoningExample}. Compare candidates when ranking them, but do not include a competitor, nearest decoy, runner-up, or second-choice clause in the reasoning. Do not predict a hidden-key result. Keep each explanation self-contained, including low-confidence entries.
- YOUR TOP-RANKED WORD IS NAMED ON THE BOARD NO MATTER WHAT CONFIDENCE YOU GIVE IT. The rules require a guess every turn: you cannot pass, and scoring everything low does not decline the turn, it just means the word you happened to list first gets named at 0.05. So the ranking IS the decision. Ask "which word would I least regret naming out loud" and put that first — not "which is least unrelated".
${topTwo ? '' : `- After the first, guesses are executed in confidence order and stopped by two rules: at most ${view.currentClue.number} are taken — the number is the whole allowance and the turn ends itself on the ${ordinal(view.currentClue.number)} correct one — and everything stops at the first below 0.35. So from the second onward the bands mean something exact: 0.8+ "I am acting on this", 0.5-0.79 "plausible but I would rather not be the one who names it", 0.35-0.49 "only if nothing better", under 0.35 "do not name this". On the FIRST they mean nothing — it is named regardless — so use the confidence to tell your partner the truth afterwards, and the ordering to protect them now.\n- You get ${view.currentClue.number} shot(s) and no more, so spend them on the ${view.currentClue.number} words you actually believe in. Ranking a weak word above a strong one costs you the strong one outright; there is no spare guess to recover it.`}
- ${view.turnsLeft <= 2 ? `Only ${view.turnsLeft} clue(s) left: a cautious stop now may cost the game, so back your best set.` : 'Be honest about uncertainty: a card that is not a target on their key ends the turn where it stands and takes one of the shared tokens with it. That is the whole cost — nothing on this board is fatal — but it is a clue the two of you never get back.'}
- ${targetExampleText(lang.code, PLAYER_VOICE_RULE)}
${flaggedBlock(view.flagged)}
${topTwo ? '- These rows are alternatives for ONE guess, not a multi-guess turn plan. Preserve your model rank even if the second row has higher numeric confidence. Each candidate needs its own reasoning and calibrated confidence.' : ''}
Respond with ONLY a JSON object: {"guesses": [{"wordId": string, "confidence": number, "reasoning": <short sentence in ${player.name}>}]}. ${topTwo ? 'Return the first-ranked row first and the second-ranked row second; do not sort them by confidence.' : ''}

${player.guessExample}`;
    // As in the clue prompt: the gloss column is English until Phase 3.
    const user = `Board (id | ${lang.name.toLowerCase()} (english) [pos] | status):
${board}

Clue history:
${historyLines(view.history)}

${topTwo ? `Turns left: ${view.turnsLeft}. Your partner's clue: "${view.currentClue.text}" (${view.currentClue.number}). That is the ORIGINAL clue count; public history shows ${alreadyMade} guess(es) already made for it and ${remainingAllowance} remaining in its allowance. Return ranked alternatives for the next ONE actual guess as JSON.` : `Turns left: ${view.turnsLeft}. Your partner's clue: "${view.currentClue.text}" (${view.currentClue.number}) — they are telling you that exactly ${view.currentClue.number} unrevealed word(s) on this board fit it. Rank your guesses as JSON.`}`;
    return [
        { role: 'system', content: system },
        { role: 'user', content: user },
    ];
}
/**
 * Translate one word involving the learned language.
 *
 * Takes a bare string and nothing else — no view, no board, no key. The player
 * asks this while composing a clue, so a prompt that could see the board would
 * be a hole straight through the game.
 *
 * For Danish, the direction is fixed, not worked out from the word: the owner's rule
 * (2026-09-17, the «tank» bug) is that the dictionary always goes from the UI
 * language to Danish. "tank" is a word in BOTH Norwegian and Danish, so a
 * model left to infer the direction reads it as Danish and translates
 * Danish→Danish — which is how the hint came back "en tanke — thought (from
 * tank)" to a player who had typed the Norwegian word for a combat vehicle.
 * The term is what the player typed, so it is a word of the player's language;
 * "da" is always its Danish answer. (judgeTargetWord rides the same request
 * and still works: a typed word that already IS the Danish answer comes back
 * unchanged, and the equality check clears it. German prompts allow either
 * direction because the field may be filled from a German board word.)
 */
export function buildTranslatePrompt(term, lang, player = DEFAULT_PLAYER_LANGUAGE) {
    player = playerForTargetLanguage(lang, player);
    // The neutral half: what the job is, and the one editorial rule about notes.
    // Everything about gender, articles, countability and the JSON shape is a
    // fact about the language being learned and comes from that pack; the
    // worked examples show the gloss side in the player's own language.
    const system = lang.code === 'de'
        ? `You translate single words between ${lang.name} and ${player.name} for someone learning ${lang.name}. Work out the direction yourself from the word you are given.

${lang.prompts.translateRules}

${player.translateExamples}
- The note is for the one thing that would trip a learner: a false friend, a register that is wrong for everyday speech, a sense that is not the obvious one. Most words need none — leave it out rather than pad it. Write the note in ${player.name}.
- If the word is ${lang.name}, "da" is that word, tidied to its citation form. If it is ${player.name}, "da" is the ${lang.name} for it. "en" is always the ${player.name} side. (The fields are called "da" and "en" whatever the two languages are — see the note on WordEntry.da.)`
        : `You translate single words from ${player.name} into ${lang.name} for someone learning ${lang.name}. The word you are given is always a ${player.name} word; give its ${lang.name} equivalent, even when the same spelling exists in both languages.

${lang.prompts.translateRules}

${player.translateExamples}
- The note is for the one thing that would trip a learner: a false friend, a register that is wrong for everyday speech, a sense that is not the obvious one. Most words need none — leave it out rather than pad it. Write the note in ${player.name}.
- "da" is always the ${lang.name} word for the term you were given, tidied to its citation form. "en" is always the ${player.name} side. (The fields are called "da" and "en" whatever the two languages are — see the note on WordEntry.da.)`;
    return [
        { role: 'system', content: system },
        { role: 'user', content: `Translate: ${term}` },
    ];
}
