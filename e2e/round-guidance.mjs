/** Existing gameplay drives take the visible action when guidance blocks their
 * next interaction. Never set the opt-out or rewrite round state: the focused
 * round-opening drive owns modal assertions, and these retain all their normal
 * board, dock, keyboard, tutorial, and continuation checks. */
const ACTIONS = {
  'Casey’s first clue': 'Start guessing',
  'Your turn!': 'Write a clue',
  'Your turn to give a clue': 'Write a clue',
  // The title is catalogue copy. Every registered UI language maps its live
  // translation-arrival panel to that panel's own primary action, so browser
  // drives exercise the actual phase instead of treating it as an unknown
  // modal.
  'Translation time': 'Start translating',
  'Zeit zum Übersetzen': 'Übersetzen starten',
  'Hora de traducir': 'Empezar a traducir',
  'Place à la traduction': 'Commencer à traduire',
  'Fordítási idő': 'Fordítás indítása',
  'Tid for å oversette': 'Begynn å oversette',
  'Tijd om te vertalen': 'Begin met vertalen',
  'Czas na tłumaczenie': 'Zacznij tłumaczyć',
  'Hora de traduzir': 'Começar a traduzir',
  'Dags att översätta': 'Börja översätta',
  '翻译时间': '开始翻译',
  // The wheel arrival's action names the spin (owner, 2026-09-17); the
  // no-wheel sudden death keeps "Keep naming".
  'Last Chance': null,
  'Pack the board first': 'Start packing',
}

export const actionFor = (title, bodyText) => {
  // The two last-chance arrivals share the title; the body sentence picks the
  // button. The wheel sentence's own action is the spin affordance — and
  // since the spin decides the round (owner, 2026-09-18), the wheel sentence
  // no longer contains "Spin the wheel" as a phrase to sniff for; the wheel
  // arrival is detected the same way the dialog itself decides: the sentence
  // is the ending one, whose button still says "Spin the wheel".
  if (title === 'Last Chance') {
    return bodyText?.includes('the ending') ? 'Spin the wheel' : 'Keep naming'
  }
  const action = ACTIONS[title]
  if (!action) throw new Error(`Unexpected round guidance: ${title}`)
  return action
}

export async function installRoundGuidanceHandler(page) {
  const dialog = page.locator('dialog.round-guidance-dialog[open]')
  await page.addLocatorHandler(dialog, async () => {
    const title = await dialog.locator('h2').innerText()
    const body = await dialog.locator('#round-guidance-description').innerText().catch(() => '')
    await dialog.getByRole('button', { name: actionFor(title, body), exact: true }).click()
  })
}

/**
 * Take the panel's action now, if one is up. The handler above runs only
 * while an action is blocked by the panel — and a play loop that looks for a
 * guessable card before tapping never gets that far, because the board
 * withholds `card-guessable` while guidance is up (the last chance's panel
 * is the one that opens mid-loop). Call this at the top of such a loop.
 */
export async function dismissRoundGuidance(page) {
  // Page-level evaluation throughout, never a locator inside the panel: any
  // locator operation that resolves an element under the overlay is itself
  // intercepted by the handler above, which closes the panel and then waits
  // for a control that no longer exists.
  const title = await page.evaluate(() => document.querySelector('dialog.round-guidance-dialog[open] h2')?.textContent ?? null)
  if (!title) return false
  const body = await page.evaluate(() => document.querySelector('dialog.round-guidance-dialog[open] #round-guidance-description')?.textContent ?? '')
  const action = actionFor(title, body)
  await page.evaluate((action) => {
    const dialog = document.querySelector('dialog.round-guidance-dialog[open]')
    const button = [...(dialog?.querySelectorAll('button') ?? [])].find((b) => b.textContent.trim() === action)
    if (!button) throw new Error(`No ${action} button on the guidance panel`)
    button.click()
  }, action)
  await page.waitForFunction(() => !document.querySelector('dialog.round-guidance-dialog[open]'))
  return true
}
