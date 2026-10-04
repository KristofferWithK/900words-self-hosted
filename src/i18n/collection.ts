import { UI_LANGUAGE } from './active'

/**
 * What is left of the board collection's own copy now that it is the city's
 * stamp card (CW-11): the stamp card's lines are in each catalogue's `home`
 * section, beside the suitcase's.
 */
type CollectionCopy = {
  primaryWaiting: string; pagerAria: string; replay: string
}

const copies: Record<string, CollectionCopy> = {
  en: { primaryWaiting: 'A replay is open. Your primary board is waiting unchanged.', pagerAria: 'Board collection pages', replay: 'Replay this board' },
  de: { primaryWaiting: 'Eine Wiederholung ist geöffnet. Dein Hauptbrett wartet unverändert.', pagerAria: 'Seiten der Brettsammlung', replay: 'Dieses Brett wiederholen' },
  es: { primaryWaiting: 'Hay una repetición abierta. Tu tablero principal espera sin cambios.', pagerAria: 'Páginas de la colección de tableros', replay: 'Repetir este tablero' },
  fr: { primaryWaiting: 'Une reprise est ouverte. Ta grille principale attend sans changer.', pagerAria: 'Pages de la collection de grilles', replay: 'Rejouer cette grille' },
  pt: { primaryWaiting: 'Há uma repetição aberta. O teu tabuleiro principal espera sem mudanças.', pagerAria: 'Páginas da coleção de tabuleiros', replay: 'Repetir este tabuleiro' },
  nl: { primaryWaiting: 'Er staat een herhaling open. Je hoofdbord wacht ongewijzigd.', pagerAria: 'Pagina’s van de bordenverzameling', replay: 'Dit bord herhalen' },
  pl: { primaryWaiting: 'Powtórka jest otwarta. Twoja główna plansza czeka bez zmian.', pagerAria: 'Strony kolekcji plansz', replay: 'Powtórz tę planszę' },
  sv: { primaryWaiting: 'En repris är öppen. Ditt huvudbräde väntar oförändrat.', pagerAria: 'Sidor i brädsamlingen', replay: 'Spela om det här brädet' },
  nb: { primaryWaiting: 'En reprise er åpen. Hovedbrettet ditt venter uendret.', pagerAria: 'Sider i brettsamlingen', replay: 'Spill dette brettet igjen' },
  hu: { primaryWaiting: 'Egy újrajátszás nyitva van. A főtáblád változatlanul vár.', pagerAria: 'A táblagyűjtemény oldalai', replay: 'Tábla újrajátszása' },
  zh: { primaryWaiting: '重玩已打开。你的主棋盘保持不变，正在等待。', pagerAria: '棋盘收藏分页', replay: '重玩此棋盘' },
}

export const COLLECTION_UI = copies[UI_LANGUAGE] ?? copies.en
