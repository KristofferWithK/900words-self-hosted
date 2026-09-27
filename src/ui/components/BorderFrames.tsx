const CARD_OUTLINES = [
  'M 10 1 C 5 1 1 5 1 10 L 1 90 C 1 95 5 99 10 99 L 90 99 C 95 99 99 95 99 90 L 99 10 C 99 5 95 1 90 1 Z',
  'M 11 2 C 5 2 1.5 5.5 1.5 11 L 2 88 C 2 95 5 98.5 11 98.5 C 34 96 67 100 89 97 C 95 97 98.5 94 98.5 88 L 98 12 C 98 6 95 2 89 2 C 66 5 34 0 11 2 Z',
  'M 9 1 C 4 1 1 4 1.5 10 C 3.5 34 0 66 2.5 90 C 2.5 96 5 99 11 99 C 35 101 65 96 89 98.5 C 95 98.5 99 96 98.5 90 C 96 66 101 35 98 10 C 98 4 95 1 89 1 C 65 3 35 0 9 1 Z',
] as const

const SUITCASE_OUTLINES = [
  'M 20 18 C 13 18 8.5 23 8.5 30 L 8 76 C 8 83 13 87.5 20 87.5 L 100 88 C 107 88 111.5 83 111.5 76 L 111 30 C 111 23 107 18 100 18 Z',
  'M 20 19 C 13 19 9 23 9 30 L 9.5 76 C 9.5 83 13 87 20 87 C 44 84.5 76 89.5 100 87 C 107 87 111 83 111 76 L 110 30 C 110 23 106 19 100 19 C 76 21 44 16.5 20 19 Z',
  'M 19 18 C 12 18 8 22 8 30 C 10 43 6.5 63 8.5 76 C 8.5 83 13 88 20 88 C 43 90 77 85 100 88 C 107 88 112 83 112 76 C 110 61 113.5 43 111 30 C 111 23 106 18 99 18 C 77 15.5 43 20.5 19 18 Z',
] as const

const frameClass = (index: number) => `card-border-frame card-border-frame-${index + 1}`

export function WordBorderFrames() {
  return (
    <svg
      className="card-border-motion-frames"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      {CARD_OUTLINES.map((d, index) => <path key={d} className={frameClass(index)} d={d} />)}
    </svg>
  )
}

export function SuitcaseBorderFrames() {
  return (
    <g className="card-suitcase-motion-frames" aria-hidden="true">
      {SUITCASE_OUTLINES.map((d, index) => <path key={d} className={frameClass(index)} d={d} />)}
    </g>
  )
}
