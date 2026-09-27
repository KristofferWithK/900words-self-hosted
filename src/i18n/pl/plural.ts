/**
 * Polska liczba mnoga. Trzy formy, nie dwie:
 *
 *   1            → „słowo”   (mianownik l. poj.)
 *   2–4          → „słowa”   (mianownik l. mn.)
 *   5+ i 0       → „słów”    (dopełniacz l. mn.)
 *
 * Decydują dwie ostatnie cyfry: 22, 23, 24 biorą „słowa”, ale 12, 13, 14
 * biorą „słów”, tak jak 5–21. Naiwne `n === 1 ? a : b` kompiluje się i jest
 * błędne dla każdego n ≥ 5 — dlatego każda liczba w tym katalogu przechodzi
 * przez tę funkcję.
 */
export const plural = (n: number, one: string, few: string, many: string): string => {
  const abs = Math.abs(Math.trunc(n))
  if (abs === 1) return one
  const lastDigit = abs % 10
  const lastTwo = abs % 100
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14)) return few
  return many
}
