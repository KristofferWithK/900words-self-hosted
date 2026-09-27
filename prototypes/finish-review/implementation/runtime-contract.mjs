// Executable reference contract only. Integration owner ports/types this into the app.
// No stores, callbacks, time, rewards or evidence writes.
const rowKeys = ['wordId', 'targetId', 'sentenceId', 'audioId', 'version'];
const pinKeys = [...rowKeys, 'clueHistoryIndex', 'clueText', 'clueNumber'];
const validClue = clue => clue?.by === 'player' &&
  typeof clue.text === 'string' && clue.text.trim().length > 0 && clue.text === clue.text.trim() &&
  Number.isInteger(clue.number) && clue.number >= 1 && clue.number <= 4 && Array.isArray(clue.guesses);
const copyPin = pin => Object.fromEntries(pinKeys.map(key => [key, pin[key]]));

export function selectQueue(clueHistory, reviewRows, usedTargetIds = []) {
  const byWord = new Map(reviewRows.map(r => [r.wordId, r]));
  const used = new Set(usedTargetIds), queue = [];
  for (const [clueHistoryIndex, clue] of clueHistory.entries()) {
    if (!validClue(clue)) continue;
    const candidates = clue.guesses.filter(guess => guess?.result === 'green')
      .map(guess => byWord.get(guess.wordId)).filter(Boolean);
    const row = candidates.find(row => !used.has(row.targetId)) ?? candidates[0];
    if (!row) continue;
    queue.push(copyPin({...row, clueHistoryIndex, clueText: clue.text, clueNumber: clue.number}));
    used.add(row.targetId);
  }
  return queue;
}

export function restoreQueue(saved, roundId, acceptedRows, clueHistory) {
  const dismissed = { version: 1, roundId, queue: [], cursor: 0, dismissed: true };
  if (!saved || saved.version !== 1 || saved.roundId !== roundId || saved.dismissed !== false ||
      !Array.isArray(clueHistory) || !Array.isArray(saved.queue) || !Number.isInteger(saved.cursor) ||
      saved.cursor < 0 || saved.cursor >= saved.queue.length) return dismissed;
  let previousIndex = -1;
  for (const pin of saved.queue) {
    if (!pin || !Number.isInteger(pin.clueHistoryIndex) || pin.clueHistoryIndex <= previousIndex) return dismissed;
    const clue = clueHistory[pin.clueHistoryIndex];
    if (!validClue(clue) || pin.clueText !== clue.text || pin.clueNumber !== clue.number ||
        !clue.guesses.some(guess => guess?.wordId === pin.wordId && guess.result === 'green') ||
        !acceptedRows.some(row => rowKeys.every(key => row[key] === pin[key]))) return dismissed;
    previousIndex = pin.clueHistoryIndex;
  }
  return { version: 1, roundId, queue: saved.queue.map(copyPin), cursor: saved.cursor, dismissed: false };
}
