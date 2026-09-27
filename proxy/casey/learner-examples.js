// Player-language examples were authored against Danish. Keep their translated
// explanations and glosses, but use German target words when learning German.
const germanTerms = { hest: 'Pferd', hund: 'Hund', kat: 'Katze', æble: 'Apfel',
  pære: 'Birne', træ: 'Baum', sød: 'süß', frugt: 'Obst' }
const targetWords = text => text.replace(/(?<![\p{L}])(hest|hund|kat|æble|pære|træ|sød|frugt)(?![\p{L}])/gu,
  word => germanTerms[word])
export const targetExampleText = (code, text) => code === 'de' ? targetWords(text) : text
const translations = {
  cykel: { da: 'Fahrrad', article: 'ein', gender: 'neuter', countable: true },
  dreng: { da: 'Junge', article: 'ein', gender: 'masculine', countable: true },
  eftermiddag: { da: 'Nachmittag', article: 'ein', gender: 'masculine', countable: true },
  trafik: { da: 'Verkehr', gender: 'masculine', countable: false },
  cykle: { da: 'Rad fahren' },
}

export function playerForTargetLanguage(targetLanguage, player) {
  if (targetLanguage?.code !== 'de' || targetLanguage?.name !== 'German' ||
      (player.exampleTarget && player.exampleTarget !== 'da')) return player
  const examples = [...player.translateExamples.matchAll(/\{[^\n]+\}/g)].map(match => JSON.parse(match[0]))
  if (!examples.length || examples.some(example => !translations[example.da])) {
    throw new Error('German transfer has an unsupported player-language dictionary example')
  }
  return { ...player, exampleTarget: 'de',
    homographNote: 'Check the meaning in each language; spelling alone is not a semantic connection.',
    rationaleExample: targetWords(player.rationaleExample),
    clueExampleRationale: targetWords(player.clueExampleRationale),
    reasoningExample: targetWords(player.reasoningExample),
    guessExample: targetWords(player.guessExample),
    translateExamples: examples.map(example => {
      const target = translations[example.da]
      return `Example for "${target.da}": ${JSON.stringify({ ...target, en: example.en })}`
    }).join('\n'),
  }
}
