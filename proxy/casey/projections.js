/** Server-side copies of the two public-view helpers used by Casey. */
export function isOpenFor(reveal, giver) {
  if (reveal.kind === 'hidden') return true
  if (reveal.kind === 'bystander') return !reveal.against.includes(giver)
  return false
}
export function aiTargetableIds(view) {
  return view.words
    .filter((word) => word.roleOnMyKey === 'green' && isOpenFor(word.reveal, 'ai'))
    .map((word) => word.id)
}

export function aiGuessableIds(view) {
  return view.words.filter((word) => isOpenFor(word.reveal, 'player')).map((word) => word.id)
}
