/**
 * The nine German stops the grammar course is written against.
 *
 * PROVISIONAL. A route is an owner decision — `docs/curriculum/next-languages-de-en.md`
 * §6 lists it as one — and a real `src/lang/de/route.ts` also needs coordinates
 * and a map module built by `scripts/make-map.mjs`. This file exists so the
 * chapters can own a city the way the accepted Danish chapters do, and so that
 * changing the route later is a rename rather than a rewrite.
 *
 * The shape is the Danish one: nine stops, a border at one end and the capital
 * at the other. Danish starts on Als, at the German border; this route starts
 * across that same border in Flensburg and ends in Berlin.
 */
export const GERMAN_ROUTE_CITIES = [
  { id: 'flensburg', name: 'Flensburg' },
  { id: 'luebeck', name: 'Lübeck' },
  { id: 'hamburg', name: 'Hamburg' },
  { id: 'bremen', name: 'Bremen' },
  { id: 'koeln', name: 'Köln' },
  { id: 'frankfurt', name: 'Frankfurt' },
  { id: 'nuernberg', name: 'Nürnberg' },
  { id: 'dresden', name: 'Dresden' },
  { id: 'berlin', name: 'Berlin' },
] as const

export const GERMAN_ROUTE_CITY_IDS: readonly string[] = GERMAN_ROUTE_CITIES.map((city) => city.id)
export const GERMAN_ROUTE_CITY_NAMES: readonly string[] = GERMAN_ROUTE_CITIES.map((city) => city.name)
