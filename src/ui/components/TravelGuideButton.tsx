import { UI } from '../../i18n'

/**
 * The small book-shaped entry point to the Travel Guide.
 *
 * Home and the first-run Home introduction share this control so the Guide
 * reads as one familiar object while its surrounding map can change.
 */
export function TravelGuideButton({
  onClick,
  disabled = false,
  className = '',
  home = true,
}: {
  onClick?: () => void
  disabled?: boolean
  className?: string
  /** Home positions the cover over its map; inline fits it into another row. */
  home?: boolean
}) {
  const classes = `travel-guide-button${home ? ' home-guide-button' : ''} ${className}`.trim()
  const content = (
    <svg className="travel-guide-icon" viewBox="0 0 34 38" aria-hidden="true">
      <path className="travel-guide-icon-cover travel-guide-icon-pencil" d="M5 4.2c5-.9 13-.3 22 .5-.9 8.7.2 18.1-.6 28.9-7.1-1-14.3-.3-21.6-.8.8-9.5-.7-19.5 0-28.6Z" />
      <path className="travel-guide-icon-grammar" d="M7.2 3.4c2.1-.4 4.4-.2 6.5.2l-.3 4.4c-2-.4-4.1-.4-6.2 0Z" />
      <path className="travel-guide-icon-survival" d="M17.1 3.3c2-.3 4.2-.1 6.4.3l-.2 4.3c-2.1-.4-4.1-.3-6.2.1Z" />
      <path className="travel-guide-icon-route" d="M8.4 26.2c1.1-3.2 3.2-4.4 5.1-3.5 1.7.8 2.7.1 3.5-2.1 1-2.9 3.5-1.6 4.6-4.8.9-2.4 2.2-3.5 4.5-4.5" />
      <circle className="travel-guide-icon-origin" cx="8.5" cy="25" r="1.4" />
      <path className="travel-guide-icon-casey" d="M10.1 10.1c2.5-.5 5.5-.2 7.9.1-.3 1.9-.1 3.9-.3 5.8-2.6-.3-5.1-.1-7.7-.2.2-1.9-.2-3.8.1-5.7ZM11.7 10V8.4m4.9 1.5V8.3" />
      <circle className="travel-guide-icon-eye" cx="12.4" cy="12.1" r=".65" />
      <circle className="travel-guide-icon-eye" cx="15.6" cy="12.1" r=".65" />
    </svg>
  )

  if (onClick) {
    return <button type="button" className={classes} onClick={onClick} disabled={disabled} aria-label={UI.guide.openGuideAria}>{content}</button>
  }
  return <div className={classes} role="img" aria-label={UI.guide.title}>{content}</div>
}
