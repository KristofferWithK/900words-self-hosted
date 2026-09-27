/**
 * Toldalékok futás közben kapott nevekhez — városnév, országnév, dán szó.
 *
 * A magyar toldalék a szó hangrendjéhez igazodik (Aalborgba, de Skagenbe), a
 * szóvégi a/e/o/ö pedig megnyúlik előtte (Ribe → Ribébe; AkH. 216.). Egy
 * paraméterre ezt nem lehet előre ráírni, ezért itt számoljuk ki. Az útvonal
 * dán városnevei közül egyik sem néma betűre végződik, így kötőjel nem kell
 * (AkH. 217.); a kötőjeles eseteket (Casey-nek, App Store-ban) a szövegek
 * maguk hordozzák, mert ott a név állandó.
 *
 * A `String()` azért van ott, mert a katalógus-kapu (catalogue.test.ts)
 * számmal is meghívja a függvényeket.
 */

const MELY = 'aáoóuúå'
const MAGAS = 'eéöőüűøæ'
/** i/í semleges: vegyes hangrendű szóban az előtte álló magánhangzó dönt. */
const NYUJTAS: Readonly<Record<string, string>> = { a: 'á', e: 'é', o: 'ó', ö: 'ő' }

function hangrend(nev: string): 'mely' | 'magas' {
  const s = nev.toLowerCase()
  for (let i = s.length - 1; i >= 0; i--) {
    const c = s.charAt(i)
    if (MELY.includes(c)) return 'mely'
    if (MAGAS.includes(c)) return 'magas'
  }
  return 'magas'
}

function nyujtott(nev: string): string {
  const veg = nev.slice(-1).toLowerCase()
  const hosszu = NYUJTAS[veg]
  return hosszu ? nev.slice(0, -1) + hosszu : nev
}

/** -ba/-be: „Vissza Aalborgba”, „Skagenbe”, „Ribébe”. */
export const hova = (nev: string): string => {
  const n = nyujtott(String(nev))
  return `${n}${hangrend(n) === 'mely' ? 'ba' : 'be'}`
}

/** -ban/-ben: „Aalborgban”, „Skagenben”, „Ribében”. */
export const hol = (nev: string): string => {
  const n = nyujtott(String(nev))
  return `${n}${hangrend(n) === 'mely' ? 'ban' : 'ben'}`
}

/** Határozott névelő a következő szó elé: „a «hund»”, „az «and»”. */
export const az = (szo: string): string =>
  /^[aáeéiíoóöőuúüűøæå]/i.test(String(szo)) ? 'az' : 'a'

/** Ugyanaz mondat elején. */
export const Az = (szo: string): string => (az(szo) === 'az' ? 'Az' : 'A')
