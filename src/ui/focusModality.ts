/**
 * Which way the player is moving focus: `<html data-focus-modality="keyboard">`
 * while they Tab through the app, no attribute once they touch or click.
 *
 * Why `:focus-visible` alone is not enough: iOS WebKit matches it for every
 * focus a SCRIPT moves, so a pop-up that focuses its action on open (Round
 * guidance's showModal + focus, the onboarding intro's autoFocus, the
 * coach-mark tour's Next) painted its keyboard ring on a thumb-only phone.
 * On the luggage tags that ring was a green rectangle over the tag's own
 * outline (owner, build 123: "in a few pop-ups it still had the green
 * border"). Rules that must show only for the keyboard read this attribute
 * as well as `:focus-visible` (styles/99-tag.css).
 *
 * Only Tab counts as keyboard: on a phone the on-screen keyboard sends keydown
 * for every letter typed into a field, and typing a clue is not moving focus.
 */
export const FOCUS_MODALITY_ATTRIBUTE = 'data-focus-modality'

const installedOn = new WeakSet<Document>()

export function installFocusModality(doc: Document | undefined = typeof document === 'undefined' ? undefined : document): void {
  if (!doc || installedOn.has(doc)) return
  installedOn.add(doc)
  const root = doc.documentElement
  doc.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') root.setAttribute(FOCUS_MODALITY_ATTRIBUTE, 'keyboard')
  }, true)
  const pointer = () => root.removeAttribute(FOCUS_MODALITY_ATTRIBUTE)
  doc.addEventListener('pointerdown', pointer, true)
  doc.addEventListener('touchstart', pointer, { capture: true, passive: true })
}
