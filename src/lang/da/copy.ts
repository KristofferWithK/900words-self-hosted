import type { TargetCopy } from '../types'

/**
 * The places the Danish build speaks Danish at the player rather than
 * English. See `TargetCopy` for why each one is an exception to the
 * English-chrome rule.
 *
 * `tips` carries English facts about Danish plus a run of Denmark fun facts.
 * They reach the rotation through the pack-tips mechanism (cluey-tips.ts),
 * which interleaves them with the gameplay rules and never drops one.
 */
export const danishCopy: TargetCopy = {
  welcome: 'Velkommen til',
  journeyOver: 'Rejsen er slut',
  answerPlaceholder: 'dansk…',
  tips: [
    // ── Danish language ──────────────────────────────────────────────────
    'The Danish alphabet ends with three extra letters: “æ”, “ø” and “å”.',
    'Danish nouns have grammatical gender: learn “et hus” (“a house”), not just “hus”.',
    'Danish compounds combine familiar words: “morgenmad” (breakfast) and “dyreliv” (wildlife).',
    'Danish puts the definite article at the end: “huset” means “the house”.',
    'Danish counts in twenties: “halvtreds” (“fifty”) comes from “half third times twenty”.',
    '900 Danish words can go a long way in everyday conversation.',
    // ── inventions & brands ──────────────────────────────────────────────
    'LEGO takes its name from “leg godt”, Danish for “play well”.',
    'Bluetooth is named after Danish king Harald “Blåtand” (Bluetooth).',
    'The LEGO brick design from 1958 still fits today’s bricks.',
    'More than 400 billion LEGO bricks have been made.',
    'Struer-based Bang & Olufsen has made audio equipment since 1925.',
    'The LEGO House in “Billund” was built using 21 million LEGO bricks.',
    // ── people & science ─────────────────────────────────────────────────
    'Copenhagen-born physicist Niels Bohr helped explain the atom and won a Nobel Prize.',
    'In 1820, Danish physicist Hans Christian Ørsted discovered that electric current creates magnetism.',
    'Danish astronomer Tycho Brahe charted the stars before telescopes existed.',
    'Hans Christian Andersen’s fairy tales are still read around the world.',
    'Copenhagen philosopher Søren Kierkegaard is often called a founder of existentialism.',
    'Andreas Mogensen was the first Dane in space.',
    'Danish-born explorer Vitus Bering gave his name to the sea between Asia and America.',
    // ── places ───────────────────────────────────────────────────────────
    '“Kronborg” is the castle Shakespeare called Elsinore in “Hamlet”.',
    'The statue “Den Lille Havfrue” (“The Little Mermaid”) has sat on its Copenhagen rock since 1913.',
    '“Rundetårn” has a spiral ramp instead of stairs.',
    'In “Odense”, you can visit Hans Christian Andersen’s childhood home.',
    'The white chalk cliffs of “Møns Klint” rise 128 metres above the Baltic Sea.',
    'In Denmark, the sea is never more than 52 kilometres away.',
    'At “Grenen” near “Skagen”, two seas meet in visible crossing currents.',
    'The Danish island “Bornholm” is closer to Sweden than to the rest of Denmark.',
    'On “Læsø”, some historic houses still have roofs made of seaweed.',
    '“Den Gamle By” in Aarhus is an old town rebuilt from historic buildings moved there from across Denmark.',
    // ── Vikings & history ────────────────────────────────────────────────
    'Vikings reached North America about 500 years before Columbus.',
    'The “Jelling stones”, carved in the 900s, are known as Denmark’s birth certificate.',
    'According to legend, Denmark’s flag “Dannebrog” fell from the sky in 1219.',
    '“Ribe”, Denmark’s oldest town, was thriving in the Viking Age.',
    'The Viking ring fortresses at “Trelleborg” were laid out in almost perfect circles.',
    'Denmark has Europe’s oldest continuous monarchy, dating back more than 1,000 years.',
    // ── food ─────────────────────────────────────────────────────────────
    '“Rugbrød” (Danish rye bread) is a food so emblematic that English often keeps its Danish name.',
    'At Danish birthdays, children often eat “kagemand” (cake man) from the head down.',
    '“Æbleskiver” are Danish Christmas pancake puffs, served with jam and powdered sugar.',
    'Danish butter brand Lurpak is sold around the world.',
    'Denmark exported bacon to England for more than a century.',
    'A red “rød pølse” in a bun is a classic Danish street-food snack.',
    // ── nature & geography ───────────────────────────────────────────────
    'Denmark has about 400 islands; most are uninhabited.',
    'At 170.86 metres, “Møllehøj” is Denmark’s highest point.',
    'Denmark’s coastline stretches for more than 7,000 kilometres.',
    'The Skagen spit grows as currents deposit sand along Denmark’s northern tip.',
    'Wild horses roam freely on the Danish island of “Langeland”.',
    '“Jægersborg Dyrehave”, north of Copenhagen, is home to thousands of free-roaming deer.',
    'The Gulf Stream helps keep Denmark’s winters mild.',
    // ── culture & quirks ─────────────────────────────────────────────────
    'The Danish word “hygge” is borrowed worldwide for a hard-to-translate feeling of coziness and togetherness.',
    'Copenhagen has more bicycles than cars.',
    'Danish birthdays often feature the national flag “Dannebrog”, even on cakes.',
    'At “Fastelavn”, children take turns hitting a barrel to win sweets.',
    'On Denmark’s “J-Day” in November, people toast the release of Christmas beer at 8:59 p.m.',
    'At “Sankthans”, bonfires and a witch effigy mark the midsummer tradition.',
    'Danish graduates decorate their “studenterhue” with messages and drawings from friends.',
    'Denmark has roughly twice as many pigs as people.',
    // ── wind & energy ────────────────────────────────────────────────────
    'Wind power supplies more than half of Denmark’s electricity.',
    'Denmark built the world’s first offshore wind farm.',
    'The island of “Samsø” produces more renewable electricity than it uses, from wind and solar power.',
    // ── design ───────────────────────────────────────────────────────────
    'Arne Jacobsen’s Danish “Egg” chair can be found in public spaces around the world.',
    '“Danish design” is known worldwide for its simple, elegant style.',
    'Hans Wegner’s “Round Chair” was used by Kennedy and Nixon during their televised debate.',
    // ── records & superlatives ───────────────────────────────────────────
    'Copenhagen’s “Tivoli Gardens” opened in 1843 and inspired Walt Disney.',
    '“Dyrehavsbakken”, founded in 1583, is the world’s oldest amusement park.',
    'Copenhagen restaurant “Noma” has been named the world’s best restaurant five times.',
    'Denmark regularly ranks among the world’s happiest countries.',
    // ── animals & symbols ────────────────────────────────────────────────
    'Denmark’s national bird is the mute swan.',
    'Denmark’s national flower is the daisy “marguerite”, a little sun on a stem.',
    'Harbour porpoises can sometimes be spotted from the quays of Copenhagen Harbour.',
    // ── city & bridges ───────────────────────────────────────────────────
    '“København” means “merchants’ harbour”, a nod to the city’s trading roots.',
    'The “Øresundsbroen” (“Øresund Bridge”) links Denmark and Sweden for both trains and cars.',
    'The Great Belt Bridge (“Storebæltsbroen”) is one of Europe’s longest suspension bridges.',
    'Jutland is a peninsula; the rest of Denmark is made up of islands.',
  ],
}
