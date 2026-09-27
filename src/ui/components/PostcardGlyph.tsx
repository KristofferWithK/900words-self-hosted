import type { SVGProps } from 'react'

/** Shared postcard drawing from the approved Home reference. */
export function PostcardGlyph({ className = '', ...props }: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 46 38" className={`postcard-glyph ${className}`.trim()} aria-hidden="true" focusable="false" {...props}>
    <rect x="3" y="6" width="40" height="27" rx="3.5" fill="#fffdf8" stroke="currentColor" strokeWidth="2.2" transform="rotate(-2 23 19.5)" />
    <line x1="9" y1="20" x2="24" y2="19" stroke="#8f8776" strokeWidth="2" strokeLinecap="round" />
    <line x1="9" y1="26" x2="21" y2="25.2" stroke="#8f8776" strokeWidth="2" strokeLinecap="round" />
    <rect x="29" y="10.5" width="9.5" height="9.5" rx="1.5" fill="none" stroke="#c8442c" strokeWidth="1.8" transform="rotate(2 33.75 15.25)" />
    <circle cx="27.5" cy="14" r="5.2" fill="none" stroke="currentColor" strokeWidth="1.4" opacity=".55" strokeDasharray="2.4 2" />
  </svg>
}
