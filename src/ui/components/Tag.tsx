import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'

/**
 * A luggage tag in place of a button: the café world's house look
 * (docs/roadmap/cafe-world.md section 6, "Luggage tags with one unbroken
 * outline, clipped corners at the string end and a punched hole, in place of
 * buttons"; T1 in docs/design/cafe-world/design-suitcase-tags-options.jpg).
 *
 * ONE component for every labelled button that becomes a tag (owner O2: small
 * round icon buttons stay round). Home's two tags are the first; later screens
 * (CW-12) reuse it. Its look lives in one file, styles/99-tag.css, as custom
 * properties at the top of that file, so a different ink, fill or cut is one
 * edit there.
 *
 * It is a real <button>: the native pressed (:active), disabled and
 * focus-visible states all apply, and its box is at least 44 x 44 CSS px. The
 * outline and the fill are drawn by the tag's own pseudo-elements, clipped to
 * the tag's shape, so the button itself is never clipped and the focus ring
 * around it is never cut off.
 *
 * `label` is the tag's name in the serif; `note` the small line under it. The
 * button's accessible name is both, in that order, unless an `aria-label` is
 * given.
 */
export interface TagProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'type'> {
  /** The tag's name: "Café puzzle". */
  readonly label: ReactNode
  /** The small line under the name: "Café Solen". Omitted when empty. */
  readonly note?: ReactNode
  /** `row`: sized to share a row (Home's pair). `wide`: a full-width tag in a sheet or panel. */
  readonly size?: 'row' | 'wide'
  /** `primary` writes the label in the primary green (T1's "Next sentence"); `plain` in ink. */
  readonly tone?: 'plain' | 'primary'
  /** The button itself (React 19 passes `ref` as a prop): for a screen that
   *  moves focus to its tag, as the coach-mark tour does to its Next. */
  readonly ref?: Ref<HTMLButtonElement>
}

export function Tag({ label, note, size = 'row', tone = 'plain', className = '', ...button }: TagProps) {
  const classes = `tag tag-${size}${tone === 'primary' ? ' tag-primary' : ''} ${className}`.trim()
  return (
    <button {...button} type="button" className={classes}>
      <span className="tag-hole" aria-hidden="true" />
      <span className="tag-text">
        <span className="tag-label">{label}</span>
        {note !== undefined && note !== null && note !== '' && <span className="tag-note">{note}</span>}
      </span>
    </button>
  )
}
