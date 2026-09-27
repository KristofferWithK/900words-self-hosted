import type { City } from '../../journey/route'
import type { MapArt, Route } from '../types'
import {
  GERMANY_HATCH,
  GERMANY_PATH,
  GERMANY_SKETCH,
  MAP_HEIGHT,
  MAP_WIDTH,
  projectCity,
} from './map'

/**
 * The route: from the Danish border down the Baltic and the North Sea coast,
 * west to the Rhine, then south and east across the country to the capital.
 *
 * NINE stops, for the same reason Denmark has nine — nine cities of
 * WORDS_PER_CITY is the 900 the game is named for. The shape deliberately
 * echoes the Danish route: a border at one end and the capital at the other.
 * Denmark begins on Als, at the German border; this begins across that same
 * border in Flensburg, so the two journeys meet where the countries do.
 *
 * The order is the order `src/lang/de/curriculum-grammar-brief.ts` teaches, and
 * `route-cities.ts` — which the grammar course was written against before this
 * file existed — must keep agreeing with it.
 */
const CITIES: City[] = [
  {
    id: 'flensburg',
    name: 'Flensburg',
    region: 'Schleswig-Holstein',
    lat: 54.782,
    lon: 9.433,
    blurbTarget: 'Die Reise beginnt an der Grenze, ganz im Norden.',
    blurbEn: 'The journey begins at the border, at the northern edge.',
  },
  {
    id: 'luebeck',
    name: 'Lübeck',
    region: 'Schleswig-Holstein',
    lat: 53.866,
    lon: 10.687,
    blurbTarget: 'Backstein, Marzipan und sieben Türme an der Ostsee.',
    blurbEn: 'Brick, marzipan and seven towers on the Baltic.',
  },
  {
    id: 'hamburg',
    name: 'Hamburg',
    region: 'Hamburg',
    lat: 53.551,
    lon: 9.994,
    blurbTarget: 'Der Hafen: Kräne, Wasser und Wind vom Meer.',
    blurbEn: 'The port: cranes, water and wind off the sea.',
  },
  {
    id: 'bremen',
    name: 'Bremen',
    region: 'Bremen',
    lat: 53.079,
    lon: 8.802,
    blurbTarget: 'Eine kleine Stadt mit einem Marktplatz und vier Musikanten.',
    blurbEn: 'A small city with a market square and four musicians.',
  },
  {
    id: 'koeln',
    name: 'Köln',
    region: 'Nordrhein-Westfalen',
    lat: 50.938,
    lon: 6.960,
    blurbTarget: 'Der Dom steht direkt neben dem Bahnhof. Man kann ihn nicht verfehlen.',
    blurbEn: 'The cathedral stands right beside the station. You cannot miss it.',
  },
  {
    id: 'frankfurt',
    name: 'Frankfurt',
    region: 'Hessen',
    lat: 50.111,
    lon: 8.682,
    blurbTarget: 'Hier kreuzen sich alle Wege. Die Mitte der Reise.',
    blurbEn: 'Every route crosses here. The middle of the journey.',
  },
  {
    id: 'nuernberg',
    name: 'Nürnberg',
    region: 'Bayern',
    lat: 49.452,
    lon: 11.077,
    blurbTarget: 'Eine alte Burg über engen Gassen und einer langen Geschichte.',
    blurbEn: 'An old castle above narrow lanes and a long history.',
  },
  {
    id: 'dresden',
    name: 'Dresden',
    region: 'Sachsen',
    lat: 51.050,
    lon: 13.738,
    blurbTarget: 'Wieder aufgebaut, Stein für Stein, an der Elbe.',
    blurbEn: 'Rebuilt stone by stone, on the Elbe.',
  },
  {
    id: 'berlin',
    name: 'Berlin',
    region: 'Berlin',
    lat: 52.520,
    lon: 13.405,
    blurbTarget: 'Das Ziel der Reise. Neunhundert Wörter später bist du zu Hause in der Sprache.',
    blurbEn: "Journey's end. Nine hundred words later, the language is home.",
  },
]

/**
 * The generated map, packaged as the pack wants it. `map.ts` keeps the plain
 * consts `scripts/make-map.mjs de` writes; this is the adapter, so regenerating
 * the art never has to know about the seam.
 */
const map: MapArt = {
  width: MAP_WIDTH,
  height: MAP_HEIGHT,
  project: projectCity,
  path: GERMANY_PATH,
  sketch: GERMANY_SKETCH,
  hatch: GERMANY_HATCH,
}

export const germanRoute: Route = { country: 'Germany', cities: CITIES, map }
