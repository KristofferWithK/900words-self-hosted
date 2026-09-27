/**
 * The player's own language, as Casey needs it.
 *
 * Two languages meet in every Casey prompt and they are not the same axis.
 * `language.js` holds the language being LEARNED — Danish: how it spells, what
 * a compound looks like in it, which of its words are grammatical. This file
 * holds the language the player already SPEAKS, which is the language Casey
 * has to write in. A German player learning Danish gets a Danish board and a
 * German rationale.
 *
 * Everything here is therefore about OUTPUT, never about instruction. The
 * prompts themselves stay in English — that is the language the models were
 * steered in, and rewriting the rules into four languages would trade a known
 * prompt for three unmeasured ones. What changes is what Casey is told to
 * write, and the worked examples that show her the register.
 *
 * The Worker owns these strings for the same reason it owns the Danish ones:
 * it is a separately deployed trust boundary, so a caller supplies the CODE
 * and never the copy.
 */

/**
 * The clue prompt's short quoted example of a rationale, and the full example
 * reply's rationale, in each language. They are the same two sentences in four
 * voices; the Danish board words inside them (hest) stay Danish, because that
 * is what the player will see on the card.
 */
const ENGLISH = {
  code: 'en',
  /** The language's name in English, for the prompt that asks for it. */
  name: 'English',
  /**
   * Words that are a Danish word AND a word of the player's language with an
   * unrelated sense. Their partner types clues on a phone keyboard that
   * rewrites Danish into the nearest word it knows, so reading the clue the
   * wrong way costs the turn rather than merely slowing it down.
   */
  homographNote:
    'Danish "foster" is a fetus, English "foster" is to raise a child; Danish "kind" is a cheek, English "kind" is friendly; Danish "sky" is a cloud or gravy.',
  /** How long one reasoning may be. Words for alphabetic languages, characters for Chinese. */
  reasoningLength: 'Use at most 12 words',
  rationaleExample:
    'Dogs and cats are both household pets; hest is an animal too but not one you keep indoors.',
  clueExampleRationale:
    'Dogs and cats are both household pets; the riskiest neutral is hest, an animal too, but not one you keep indoors, so it should not pull you.',
  reasoningExample: '"æble (apple) is a fruit, matching frugt"',
  guessExample: `Example of a well-calibrated reply, from a DIFFERENT board where the clue was "frugt" (2):
{"guesses": [{"wordId": "w2", "confidence": 0.9, "reasoning": "æble (apple) is a fruit, matching frugt"}, {"wordId": "w9", "confidence": 0.8, "reasoning": "pære (pear) is a fruit, matching frugt"}, {"wordId": "w5", "confidence": 0.3, "reasoning": "træ (tree) has a loose link to fruit because fruit grows on trees"}, {"wordId": "w11", "confidence": 0.15, "reasoning": "sød (sweet) describes fruit but is not one"}]}`,
  /** The translate prompt's worked examples: the gloss side is the player's language. */
  translateExamples: `Example for "cykel": {"da": "cykel", "en": "bicycle", "article": "en", "gender": "common", "countable": true}
Example for "afternoon": {"da": "eftermiddag", "en": "afternoon", "article": "en", "gender": "common", "countable": true}
Example for "trafik": {"da": "trafik", "en": "traffic", "gender": "common", "countable": false}
Example for "at cykle": {"da": "cykle", "en": "to cycle"}`,
  /**
   * The sentences the SERVER writes when the model gives nothing usable. No
   * prompt is involved, so these are the only Casey copy the Worker authors
   * outright, and they have to be translated rather than instructed.
   *
   * `joinNames` receives BARE Danish words and adds this language's own quote
   * marks. It used to receive them already wrapped in « », which quietly
   * imposed a French convention on Chinese.
   */
  joinNames: (names) => {
    const quoted = names.map((name) => `«${name}»`)
    return quoted.length <= 1
      ? quoted.join('')
      : `${quoted.slice(0, -1).join(', ')} and ${quoted[quoted.length - 1]}`
  },
  oneIdea: (names) => `I see ${names} as one idea`,
  alsoCameToMind: (base, name) =>
    `${base}; «${name}» came to mind too, but it does not belong with these in the same way.`,
  onlyIdea: (base) => `${base}.`,
  makesMeThinkOf: (clue, name, first) =>
    `«${clue}» makes me think of ${name}${first ? ' first' : ' as well'}.`,
  firstClue: (clue, names) =>
    `«${clue}»: ${names} all fit together under that one word.`,
  /** What the player is shown when Casey cannot answer at all. */
  messages: {
    noClue: 'Casey could not settle on a clue for the words she is holding.',
    noGuess: 'Casey could not work out which words your clue points at.',
    noWordsLeft: 'Casey has no words left to clue this round.',
    badTranslation: 'The translation came back in a form the app could not read.',
    badPing: 'Casey answered, but not in the expected form.',
  },
}

const GERMAN = {
  code: 'de',
  name: 'German',
  // Every pair is a word in the shipped 900, and every German sense is
  // genuinely unrelated. An earlier draft offered art/Art and flot/flott:
  // German "Art" also means species and "flott" also means smart, so both were
  // cognates wearing a false friend's coat, and "art" is not even in the pack.
  homographNote:
    'Danish "gift" is married (and also poison), German "Gift" is only poison; Danish "bord" is a table, German "Bord" is a shelf or a ship\'s side (an Bord); Danish "ost" is cheese, German "Ost" is east; Danish "tag" is a roof and "tage" is to take, German "Tag"/"Tage" is day/days; Danish "kind" is a cheek, German "Kind" is a child; Danish "rar" is nice, German "rar" is rare.',
  reasoningLength: 'Use at most 12 words',
  rationaleExample:
    'Hund und Katze sind beides Haustiere; hest ist auch ein Tier, aber keins, das man in der Wohnung hält.',
  clueExampleRationale:
    'Hund und Katze sind beides Haustiere; der riskanteste neutrale Kandidat ist hest, auch ein Tier, aber keins, das man in der Wohnung hält, also sollte es dich nicht ablenken.',
  reasoningExample: '"æble (Apfel) ist eine Frucht, passt zu frugt"',
  guessExample: `Example of a well-calibrated reply, from a DIFFERENT board where the clue was "frugt" (2):
{"guesses": [{"wordId": "w2", "confidence": 0.9, "reasoning": "æble (Apfel) ist eine Frucht, passt zu frugt"}, {"wordId": "w9", "confidence": 0.8, "reasoning": "pære (Birne) ist eine Frucht, passt zu frugt"}, {"wordId": "w5", "confidence": 0.3, "reasoning": "træ (Baum) hat nur einen entfernten Bezug, denn Obst wächst an Bäumen"}, {"wordId": "w11", "confidence": 0.15, "reasoning": "sød (süß) beschreibt Obst, ist aber selbst keine Frucht"}]}`,
  translateExamples: `Example for "cykel": {"da": "cykel", "en": "Fahrrad", "article": "en", "gender": "common", "countable": true}
Example for "Nachmittag": {"da": "eftermiddag", "en": "Nachmittag", "article": "en", "gender": "common", "countable": true}
Example for "trafik": {"da": "trafik", "en": "Verkehr", "gender": "common", "countable": false}
Example for "at cykle": {"da": "cykle", "en": "Fahrrad fahren"}`,
  joinNames: (names) => {
    const quoted = names.map((name) => `«${name}»`)
    return quoted.length <= 1
      ? quoted.join('')
      : `${quoted.slice(0, -1).join(', ')} und ${quoted[quoted.length - 1]}`
  },
  oneIdea: (names) => `Ich sehe ${names} als eine gemeinsame Idee`,
  alsoCameToMind: (base, name) =>
    `${base}; «${name}» kam mir auch in den Sinn, passt aber nicht so recht zu den anderen.`,
  onlyIdea: (base) => `${base}.`,
  makesMeThinkOf: (clue, name, first) =>
    `«${clue}» lässt mich ${first ? 'zuerst' : 'auch'} an ${name} denken.`,
  firstClue: (clue, names) =>
    `«${clue}»: ${names} passen alle unter diesen einen Begriff.`,
  messages: {
    noClue: 'Casey konnte sich für die Wörter, die sie bei sich hat, auf keinen Hinweis festlegen.',
    noGuess: 'Casey konnte nicht herausfinden, auf welche Wörter dein Hinweis zielt.',
    noWordsLeft: 'Casey hat in dieser Runde keine Wörter mehr, für die sie einen Hinweis geben kann.',
    badTranslation: 'Die Übersetzung kam in einer Form zurück, die die App nicht lesen konnte.',
    badPing: 'Casey hat geantwortet, aber nicht in der erwarteten Form.',
  },
}

const SPANISH = {
  code: 'es',
  name: 'Spanish',
  // Content words a partner would really type as a clue. An earlier draft
  // spent two of its four slots on sin and vi, which are true homographs and
  // function words nobody clues with.
  homographNote:
    'Danish "gris" is a pig, Spanish "gris" is grey; Danish "fin" is fine or nice, Spanish "fin" is an end; Danish "sur" is sour, Spanish "sur" is south; Danish "ven" is a friend, Spanish "ven" is the imperative "come!".',
  reasoningLength: 'Use at most 12 words',
  rationaleExample:
    'El perro y el gato son animales de compañía; hest también es un animal, pero no de los que se tienen en casa.',
  clueExampleRationale:
    'El perro y el gato son animales de compañía; la carta neutral más peligrosa es hest, también un animal, pero no de los que se tienen en casa, así que no debería atraerte.',
  reasoningExample: '"æble (manzana) es una fruta, encaja con frugt"',
  guessExample: `Example of a well-calibrated reply, from a DIFFERENT board where the clue was "frugt" (2):
{"guesses": [{"wordId": "w2", "confidence": 0.9, "reasoning": "æble (manzana) es una fruta, encaja con frugt"}, {"wordId": "w9", "confidence": 0.8, "reasoning": "pære (pera) es una fruta, encaja con frugt"}, {"wordId": "w5", "confidence": 0.3, "reasoning": "træ (árbol) tiene un vínculo débil: la fruta crece en los árboles"}, {"wordId": "w11", "confidence": 0.15, "reasoning": "sød (dulce) describe la fruta, pero no es una fruta"}]}`,
  translateExamples: `Example for "cykel": {"da": "cykel", "en": "bicicleta", "article": "en", "gender": "common", "countable": true}
Example for "tarde": {"da": "eftermiddag", "en": "tarde", "article": "en", "gender": "common", "countable": true}
Example for "trafik": {"da": "trafik", "en": "tráfico", "gender": "common", "countable": false}
Example for "at cykle": {"da": "cykle", "en": "ir en bicicleta"}`,
  // "y" becomes "e" before an i- sound, and the board is full of words that
  // start with one: is, ild, idé. Quoting does not exempt them.
  joinNames: (names) => {
    const quoted = names.map((name) => `«${name}»`)
    if (quoted.length <= 1) return quoted.join('')
    const last = quoted[quoted.length - 1]
    const conjunction = /^«?h?i(?![aeiou])/i.test(last) ? ' e ' : ' y '
    return `${quoted.slice(0, -1).join(', ')}${conjunction}${last}`
  },
  oneIdea: (names) => `Veo ${names} como una sola idea`,
  alsoCameToMind: (base, name) =>
    `${base}; «${name}» también se me ocurrió, pero no encaja con estas de la misma manera.`,
  onlyIdea: (base) => `${base}.`,
  makesMeThinkOf: (clue, name, first) =>
    `«${clue}» me hace pensar ${first ? 'primero' : 'también'} en ${name}.`,
  firstClue: (clue, names) =>
    `«${clue}»: ${names} encajan todos bajo esa misma idea.`,
  messages: {
    noClue: 'Casey no ha conseguido decidirse por una pista para las palabras que lleva.',
    noGuess: 'Casey no ha conseguido averiguar a qué palabras apunta tu pista.',
    noWordsLeft: 'A Casey no le quedan palabras sobre las que dar una pista en esta ronda.',
    badTranslation: 'La traducción ha llegado en un formato que la aplicación no ha podido leer.',
    badPing: 'Casey ha respondido, pero no en el formato esperado.',
  },
}

const CHINESE = {
  code: 'zh',
  name: 'Chinese',
  // Chinese shares no spellings with Danish, so the collision runs the other
  // way round: through the pinyin keyboard, which turns a typed Danish word
  // into the character that string spells. An earlier draft had it backwards,
  // warning that a Latin clue might be pinyin — but a Chinese speaker does not
  // write Chinese as bare toneless pinyin, and the two examples it used were
  // function words nobody clues with.
  homographNote:
    'Chinese shares no spellings with Danish, so the collision runs through the pinyin keyboard: a player who types a Danish word while the pinyin IME is active gets the CHARACTER that string spells — "lang" (long) comes out as 狼 wolf, "kan" (can) as 看 look, "hun" (she) as 婚 marriage, "ti" (ten) as 踢 kick. So read a character clue as Chinese, but if it is what a Danish board word would become when typed as pinyin, weigh that reading too; a Latin-letter clue is almost always Danish.',
  // Chinese is not written with spaces, so a word count means nothing here.
  reasoningLength: 'Use at most 25 Chinese characters',
  rationaleExample: '狗和猫都是家里养的宠物；hest 也是动物，但一般不养在家里。',
  // 中立牌 and 提示, matching what the player already reads on the board
  // (src/i18n/zh/game.ts and the glossary). 中性词 means a word with no
  // positive or negative colouring, which is a fact about Chinese grammar and
  // not a card on this board.
  clueExampleRationale:
    '狗和猫都是家里养的宠物；最容易误导你的中立牌是 hest，它也是动物，但一般不养在家里，所以别被它带偏。',
  reasoningExample: '"æble（苹果）是水果，对应 frugt"',
  guessExample: `Example of a well-calibrated reply, from a DIFFERENT board where the clue was "frugt" (2):
{"guesses": [{"wordId": "w2", "confidence": 0.9, "reasoning": "æble（苹果）是水果，对应 frugt"}, {"wordId": "w9", "confidence": 0.8, "reasoning": "pære（梨）是水果，对应 frugt"}, {"wordId": "w5", "confidence": 0.3, "reasoning": "træ（树）只是间接相关：水果长在树上"}, {"wordId": "w11", "confidence": 0.15, "reasoning": "sød（甜）能形容水果，但本身不是水果"}]}`,
  translateExamples: `Example for "cykel": {"da": "cykel", "en": "自行车", "article": "en", "gender": "common", "countable": true}
Example for "下午": {"da": "eftermiddag", "en": "下午", "article": "en", "gender": "common", "countable": true}
Example for "trafik": {"da": "trafik", "en": "交通", "gender": "common", "countable": false}
Example for "at cykle": {"da": "cykle", "en": "骑自行车"}`,
  // Chinese sets no space beside its own punctuation, and 、 is the
  // enumeration comma. The « » are kept because the shipped Chinese UI already
  // quotes board words that way (src/i18n/zh/game.ts); a native reader would
  // write “ ”, and changing it is an app-wide decision rather than Casey's.
  joinNames: (names) => {
    const quoted = names.map((name) => `«${name}»`)
    return quoted.length <= 1 ? quoted.join('') : `${quoted.slice(0, -1).join('、')}和${quoted[quoted.length - 1]}`
  },
  // 归为一类 — grouping words under one clue. 同一个想法 is "the same opinion".
  oneIdea: (names) => `我把${names}归为一类`,
  alsoCameToMind: (base, name) => `${base}；我也想到了«${name}»，不过它和这几个不是一路的。`,
  onlyIdea: (base) => `${base}。`,
  makesMeThinkOf: (clue, name, first) => `«${clue}»让我${first ? '最先' : '还'}想到 ${name}。`,
  firstClue: (clue, names) =>
    `«${clue}»：${names}都可以归在这个词下面。`,
  messages: {
    noClue: 'Casey 想不出适合她手上这些词的提示。',
    noGuess: 'Casey 看不出你的提示指向哪些词。',
    noWordsLeft: '这一轮 Casey 已经没有可以出提示的词了。',
    badTranslation: '翻译结果的格式有误，应用无法读取。',
    badPing: 'Casey 回答了，但格式不符合预期。',
  },
}

const FRENCH = {
  code: 'fr',
  name: 'French',
  homographNote:
    'Danish "sur" is sour, French "sur" is "on"; Danish "fin" is fine or nice, French "fin" is an end; Danish "sol" is the sun, French "sol" is the ground; Danish "mine" is "my", French "mine" is a look or an expression.',
  reasoningLength: 'Use at most 12 words',
  rationaleExample:
    'Le chien et le chat sont tous les deux des animaux de compagnie ; hest est aussi un animal, mais pas de ceux qu\'on garde à la maison.',
  clueExampleRationale:
    'Le chien et le chat sont tous les deux des animaux de compagnie ; la carte neutre la plus dangereuse est hest, un animal lui aussi, mais pas de ceux qu\'on garde à la maison : il ne devrait donc pas t\'attirer.',
  reasoningExample: '"æble (pomme) est un fruit, comme frugt"',
  guessExample: `Example of a well-calibrated reply, from a DIFFERENT board where the clue was "frugt" (2):
{"guesses": [{"wordId": "w2", "confidence": 0.9, "reasoning": "æble (pomme) est un fruit, comme frugt"}, {"wordId": "w9", "confidence": 0.8, "reasoning": "pære (poire) est un fruit, comme frugt"}, {"wordId": "w5", "confidence": 0.3, "reasoning": "træ (arbre) n\'a qu\'un lien indirect : les fruits poussent dans les arbres"}, {"wordId": "w11", "confidence": 0.15, "reasoning": "sød (sucré) décrit un fruit mais n\'en est pas un"}]}`,
  translateExamples: `Example for "cykel": {"da": "cykel", "en": "vélo", "article": "en", "gender": "common", "countable": true}
Example for "après-midi": {"da": "eftermiddag", "en": "après-midi", "article": "en", "gender": "common", "countable": true}
Example for "trafik": {"da": "trafik", "en": "circulation", "gender": "common", "countable": false}
Example for "at cykle": {"da": "cykle", "en": "faire du vélo"}`,
  joinNames: (names) => {
    const quoted = names.map((name) => `«${name}»`)
    return quoted.length <= 1
      ? quoted.join('')
      : `${quoted.slice(0, -1).join(', ')} et ${quoted[quoted.length - 1]}`
  },
  oneIdea: (names) => `Je vois ${names} comme une seule idée`,
  alsoCameToMind: (base, name) =>
    `${base} ; «${name}» m\'est aussi venu à l\'esprit, mais il ne va pas avec les autres de la même façon.`,
  onlyIdea: (base) => `${base}.`,
  makesMeThinkOf: (clue, name, first) =>
    `«${clue}» me fait ${first ? "d\'abord" : 'aussi'} penser à ${name}.`,
  firstClue: (clue, names) =>
    `«${clue}» : ${names} vont tous ensemble sous ce même mot.`,
  messages: {
    noClue: 'Casey n\'a pas réussi à se décider sur un indice pour les mots qu\'elle transporte.',
    noGuess: 'Casey n\'a pas réussi à voir quels mots ton indice désigne.',
    noWordsLeft: 'Casey n\'a plus de mots à faire deviner dans cette manche.',
    badTranslation: 'La traduction est revenue dans un format que l\'application n\'a pas pu lire.',
    badPing: 'Casey a répondu, mais pas dans le format attendu.',
  },
}

const PORTUGUESE = {
  code: 'pt',
  name: 'Portuguese',
  // European Portuguese (UL13): the game is a train journey, and a Brazilian
  // reader would expect "trem" where this app says "comboio".
  homographNote:
    'Danish "mel" is flour, Portuguese "mel" is honey; Danish "ser" is "sees", Portuguese "ser" is "to be"; Danish "tal" is a number, Portuguese "tal" means "such"; Danish "os" is "us", Portuguese "os" is "the".',
  reasoningLength: 'Use at most 12 words',
  rationaleExample:
    'O cão e o gato são ambos animais de companhia; hest também é um animal, mas não dos que se têm em casa.',
  clueExampleRationale:
    'O cão e o gato são ambos animais de companhia; a carta neutra mais perigosa é hest, também um animal, mas não dos que se têm em casa, por isso não te deve atrair.',
  reasoningExample: '"æble (maçã) é uma fruta, corresponde a frugt"',
  guessExample: `Example of a well-calibrated reply, from a DIFFERENT board where the clue was "frugt" (2):
{"guesses": [{"wordId": "w2", "confidence": 0.9, "reasoning": "æble (maçã) é uma fruta, corresponde a frugt"}, {"wordId": "w9", "confidence": 0.8, "reasoning": "pære (pera) é uma fruta, corresponde a frugt"}, {"wordId": "w5", "confidence": 0.3, "reasoning": "træ (árvore) tem uma ligação indireta: a fruta cresce nas árvores"}, {"wordId": "w11", "confidence": 0.15, "reasoning": "sød (doce) descreve a fruta, mas não é uma fruta"}]}`,
  translateExamples: `Example for "cykel": {"da": "cykel", "en": "bicicleta", "article": "en", "gender": "common", "countable": true}
Example for "tarde": {"da": "eftermiddag", "en": "tarde", "article": "en", "gender": "common", "countable": true}
Example for "trafik": {"da": "trafik", "en": "trânsito", "gender": "common", "countable": false}
Example for "at cykle": {"da": "cykle", "en": "andar de bicicleta"}`,
  joinNames: (names) => {
    const quoted = names.map((name) => `«${name}»`)
    return quoted.length <= 1
      ? quoted.join('')
      : `${quoted.slice(0, -1).join(', ')} e ${quoted[quoted.length - 1]}`
  },
  oneIdea: (names) => `Vejo ${names} como uma só ideia`,
  alsoCameToMind: (base, name) =>
    `${base}; «${name}» também me ocorreu, mas não encaixa com estas da mesma maneira.`,
  onlyIdea: (base) => `${base}.`,
  makesMeThinkOf: (clue, name, first) =>
    `«${clue}» faz-me pensar ${first ? 'primeiro' : 'também'} em ${name}.`,
  firstClue: (clue, names) =>
    `«${clue}»: ${names} encaixam todos nesta mesma ideia.`,
  messages: {
    noClue: 'A Casey não conseguiu decidir-se por uma pista para as palavras que leva consigo.',
    noGuess: 'A Casey não conseguiu perceber que palavras a tua pista indica.',
    noWordsLeft: 'A Casey já não tem palavras sobre as quais dar uma pista nesta ronda.',
    badTranslation: 'A tradução chegou num formato que a aplicação não conseguiu ler.',
    badPing: 'A Casey respondeu, mas não no formato esperado.',
  },
}

const POLISH = {
  code: 'pl',
  name: 'Polish',
  homographNote:
    'Danish "dom" is a verdict, Polish "dom" is a house; Danish "pas" is a passport, Polish "pas" is a belt; Danish "to" is the number two, Polish "to" is "this"; Danish "list" is a ruse, Polish "list" is a letter.',
  reasoningLength: 'Use at most 12 words',
  rationaleExample:
    'Pies i kot to oba zwierzęta domowe; hest też jest zwierzęciem, ale nie z tych, które trzyma się w domu.',
  clueExampleRationale:
    'Pies i kot to oba zwierzęta domowe; najgroźniejsza neutralna karta to hest, też zwierzę, ale nie z tych trzymanych w domu, więc nie powinno cię skusić.',
  reasoningExample: '"æble (jabłko) to owoc, pasuje do frugt"',
  guessExample: `Example of a well-calibrated reply, from a DIFFERENT board where the clue was "frugt" (2):
{"guesses": [{"wordId": "w2", "confidence": 0.9, "reasoning": "æble (jabłko) to owoc, pasuje do frugt"}, {"wordId": "w9", "confidence": 0.8, "reasoning": "pære (gruszka) to owoc, pasuje do frugt"}, {"wordId": "w5", "confidence": 0.3, "reasoning": "træ (drzewo) ma tylko pośredni związek: owoce rosną na drzewach"}, {"wordId": "w11", "confidence": 0.15, "reasoning": "sød (słodki) opisuje owoc, ale sam nim nie jest"}]}`,
  translateExamples: `Example for "cykel": {"da": "cykel", "en": "rower", "article": "en", "gender": "common", "countable": true}
Example for "popołudnie": {"da": "eftermiddag", "en": "popołudnie", "article": "en", "gender": "common", "countable": true}
Example for "trafik": {"da": "trafik", "en": "ruch drogowy", "gender": "common", "countable": false}
Example for "at cykle": {"da": "cykle", "en": "jeździć na rowerze"}`,
  joinNames: (names) => {
    const quoted = names.map((name) => `«${name}»`)
    return quoted.length <= 1
      ? quoted.join('')
      : `${quoted.slice(0, -1).join(', ')} i ${quoted[quoted.length - 1]}`
  },
  oneIdea: (names) => `Widzę ${names} jako jeden pomysł`,
  alsoCameToMind: (base, name) =>
    `${base}; «${name}» też przyszło mi do głowy, ale nie pasuje do tamtych tak samo.`,
  onlyIdea: (base) => `${base}.`,
  makesMeThinkOf: (clue, name, first) =>
    `«${clue}» ${first ? 'najpierw' : 'też'} kojarzy mi się z ${name}.`,
  firstClue: (clue, names) =>
    `«${clue}»: ${names} pasują tu wszystkie razem.`,
  messages: {
    noClue: 'Casey nie zdołała wybrać podpowiedzi do słów, które niesie.',
    noGuess: 'Casey nie zdołała rozpoznać, na które słowa wskazuje twoja podpowiedź.',
    noWordsLeft: 'W tej rundzie Casey nie ma już słów, do których mogłaby dać podpowiedź.',
    badTranslation: 'Tłumaczenie wróciło w formacie, którego aplikacja nie potrafiła odczytać.',
    badPing: 'Casey odpowiedziała, ale nie w oczekiwanym formacie.',
  },
}

const HUNGARIAN = {
  code: 'hu',
  name: 'Hungarian',
  homographNote:
    'Danish "is" is ice, Hungarian "is" means "also"; Danish "hal" is a hall, Hungarian "hal" is a fish; Danish "kor" is a choir, Hungarian "kor" is an age or era; Danish "far" is a father, Hungarian "far" is a rear end.',
  reasoningLength: 'Use at most 12 words',
  rationaleExample:
    'A kutya és a macska is háziállat; a hest szintén állat, de nem olyan, amit otthon tartanak.',
  clueExampleRationale:
    'A kutya és a macska is háziállat; a legveszélyesebb semleges kártya a hest, szintén állat, de nem olyan, amit otthon tartanak, úgyhogy ne csábítson el.',
  reasoningExample: '"æble (alma) gyümölcs, illik a frugt szóhoz"',
  guessExample: `Example of a well-calibrated reply, from a DIFFERENT board where the clue was "frugt" (2):
{"guesses": [{"wordId": "w2", "confidence": 0.9, "reasoning": "æble (alma) gyümölcs, illik a frugt szóhoz"}, {"wordId": "w9", "confidence": 0.8, "reasoning": "pære (körte) gyümölcs, illik a frugt szóhoz"}, {"wordId": "w5", "confidence": 0.3, "reasoning": "træ (fa) csak közvetve kapcsolódik: a gyümölcs fán terem"}, {"wordId": "w11", "confidence": 0.15, "reasoning": "sød (édes) a gyümölcsöt írja le, de maga nem gyümölcs"}]}`,
  translateExamples: `Example for "cykel": {"da": "cykel", "en": "kerékpár", "article": "en", "gender": "common", "countable": true}
Example for "délután": {"da": "eftermiddag", "en": "délután", "article": "en", "gender": "common", "countable": true}
Example for "trafik": {"da": "trafik", "en": "forgalom", "gender": "common", "countable": false}
Example for "at cykle": {"da": "cykle", "en": "kerékpározni"}`,
  joinNames: (names) => {
    const quoted = names.map((name) => `«${name}»`)
    return quoted.length <= 1
      ? quoted.join('')
      : `${quoted.slice(0, -1).join(', ')} és ${quoted[quoted.length - 1]}`
  },
  oneIdea: (names) => `Egy gondolatnak látom ezeket: ${names}`,
  alsoCameToMind: (base, name) =>
    `${base}; eszembe jutott a «${name}» is, de nem illik ugyanúgy a többihez.`,
  onlyIdea: (base) => `${base}.`,
  makesMeThinkOf: (clue, name, first) =>
    `A «${clue}» ${first ? 'először' : 'szintén'} a ${name} szót juttatja eszembe.`,
  firstClue: (clue, names) =>
    `A «${clue}» mindet egybe fog: ${names}.`,
  messages: {
    noClue: 'Casey nem tudott nyomot választani a nála lévő szavakhoz.',
    noGuess: 'Casey nem tudta kitalálni, mely szavakra mutat a nyomod.',
    noWordsLeft: 'Ebben a körben Caseynek nem maradt szava, amire nyomot adhatna.',
    badTranslation: 'A fordítás olyan formában érkezett vissza, amit az alkalmazás nem tudott értelmezni.',
    badPing: 'Casey válaszolt, de nem a várt formában.',
  },
}

const SWEDISH = {
  code: 'sv',
  name: 'Swedish',
  // Swedish and Danish are close enough that the false friends are the
  // dangerous kind: a clue read the wrong way here does not slow the turn
  // down, it inverts it.
  homographNote:
    'Danish "rolig" is calm, Swedish "rolig" is funny; Danish "semester" is an academic term, Swedish "semester" is a holiday; Danish "rar" is kind, Swedish "rar" is cute; Danish "by" is a town, Swedish "by" is a village; Danish "frokost" is lunch, Swedish "frukost" is breakfast.',
  reasoningLength: 'Use at most 12 words',
  rationaleExample:
    'Hund och katt är båda husdjur; hest är också ett djur, men inte ett man har hemma.',
  clueExampleRationale:
    'Hund och katt är båda husdjur; det farligaste neutrala kortet är hest, också ett djur, men inte ett man har hemma, så det bör inte locka dig.',
  reasoningExample: '"æble (äpple) är en frukt, passar till frugt"',
  guessExample: `Example of a well-calibrated reply, from a DIFFERENT board where the clue was "frugt" (2):
{"guesses": [{"wordId": "w2", "confidence": 0.9, "reasoning": "æble (äpple) är en frukt, passar till frugt"}, {"wordId": "w9", "confidence": 0.8, "reasoning": "pære (päron) är en frukt, passar till frugt"}, {"wordId": "w5", "confidence": 0.3, "reasoning": "træ (träd) har bara en indirekt koppling: frukt växer på träd"}, {"wordId": "w11", "confidence": 0.15, "reasoning": "sød (söt) beskriver frukt men är inte en frukt"}]}`,
  translateExamples: `Example for "dreng": {"da": "dreng", "en": "pojke", "article": "en", "gender": "common", "countable": true}
Example for "eftermiddag": {"da": "eftermiddag", "en": "eftermiddag", "article": "en", "gender": "common", "countable": true}
Example for "trafik": {"da": "trafik", "en": "trafik", "gender": "common", "countable": false}
Example for "at cykle": {"da": "cykle", "en": "cykla"}`,
  joinNames: (names) => {
    const quoted = names.map((name) => `«${name}»`)
    return quoted.length <= 1
      ? quoted.join('')
      : `${quoted.slice(0, -1).join(', ')} och ${quoted[quoted.length - 1]}`
  },
  oneIdea: (names) => `Jag ser ${names} som en och samma idé`,
  alsoCameToMind: (base, name) =>
    `${base}; «${name}» slog mig också, men det hör inte ihop med de andra på samma sätt.`,
  onlyIdea: (base) => `${base}.`,
  makesMeThinkOf: (clue, name, first) =>
    `«${clue}» får mig att tänka ${first ? 'först' : 'också'} på ${name}.`,
  firstClue: (clue, names) =>
    `«${clue}»: ${names} hör alla ihop under det ordet.`,
  messages: {
    noClue: 'Casey kunde inte bestämma sig för en ledtråd till orden hon bär på.',
    noGuess: 'Casey kunde inte lista ut vilka ord din ledtråd pekar på.',
    noWordsLeft: 'Casey har inga ord kvar att ge ledtråd om den här rundan.',
    badTranslation: 'Översättningen kom tillbaka i ett format som appen inte kunde läsa.',
    badPing: 'Casey svarade, men inte i det format som väntades.',
  },
}

const NORWEGIAN = {
  code: 'nb',
  name: 'Norwegian',
  // Bokmål. As with Swedish, the false friends here invert a clue rather
  // than merely slow it down.
  homographNote:
    'Danish "rar" is kind or nice, Norwegian "rar" is strange; Danish "artig" is well-behaved, Norwegian "artig" is fun; Danish "grine" is to laugh, Norwegian "grine" is to cry; Danish "frokost" is lunch, Norwegian "frokost" is breakfast.',
  reasoningLength: 'Use at most 12 words',
  rationaleExample:
    'Hund og katt er begge husdyr; hest er også et dyr, men ikke et man har inne.',
  clueExampleRationale:
    'Hund og katt er begge husdyr; det farligste nøytrale kortet er hest, også et dyr, men ikke et man har inne, så det bør ikke friste deg.',
  reasoningExample: '"æble (eple) er en frukt, passer til frugt"',
  guessExample: `Example of a well-calibrated reply, from a DIFFERENT board where the clue was "frugt" (2):
{"guesses": [{"wordId": "w2", "confidence": 0.9, "reasoning": "æble (eple) er en frukt, passer til frugt"}, {"wordId": "w9", "confidence": 0.8, "reasoning": "pære (pære) er en frukt, passer til frugt"}, {"wordId": "w5", "confidence": 0.3, "reasoning": "træ (tre) har bare en indirekte kobling: frukt vokser på trær"}, {"wordId": "w11", "confidence": 0.15, "reasoning": "sød (søt) beskriver frukt, men er ikke en frukt"}]}`,
  translateExamples: `Example for "cykel": {"da": "cykel", "en": "sykkel", "article": "en", "gender": "common", "countable": true}
Example for "ettermiddag": {"da": "eftermiddag", "en": "ettermiddag", "article": "en", "gender": "common", "countable": true}
Example for "trafik": {"da": "trafik", "en": "trafikk", "gender": "common", "countable": false}
Example for "at cykle": {"da": "cykle", "en": "å sykle"}`,
  joinNames: (names) => {
    const quoted = names.map((name) => `«${name}»`)
    return quoted.length <= 1
      ? quoted.join('')
      : `${quoted.slice(0, -1).join(', ')} og ${quoted[quoted.length - 1]}`
  },
  oneIdea: (names) => `Jeg ser ${names} som én og samme idé`,
  alsoCameToMind: (base, name) =>
    `${base}; «${name}» slo meg også, men det hører ikke sammen med de andre på samme måte.`,
  onlyIdea: (base) => `${base}.`,
  makesMeThinkOf: (clue, name, first) =>
    `«${clue}» får meg til å tenke ${first ? 'først' : 'også'} på ${name}.`,
  firstClue: (clue, names) =>
    `«${clue}»: ${names} hører alle sammen under det ordet.`,
  messages: {
    noClue: 'Casey klarte ikke å bestemme seg for et hint til ordene hun bærer på.',
    noGuess: 'Casey klarte ikke å finne ut hvilke ord hintet ditt peker på.',
    noWordsLeft: 'Casey har ingen ord igjen å gi hint om denne runden.',
    badTranslation: 'Oversettelsen kom tilbake i et format appen ikke kunne lese.',
    badPing: 'Casey svarte, men ikke i det formatet som var ventet.',
  },
}

const DUTCH = {
  code: 'nl',
  name: 'Dutch',
  homographNote:
    'Danish "mand" is a man, Dutch "mand" is a basket; Danish "vind" is wind, Dutch "vind" is "I find"; Danish "slim" is slime, Dutch "slim" is clever; Danish "kop" is a cup, Dutch "kop" is an animal head.',
  reasoningLength: 'Use at most 12 words',
  rationaleExample:
    'Hond en kat zijn allebei huisdieren; hest is ook een dier, maar geen dier dat je binnen houdt.',
  clueExampleRationale:
    'Hond en kat zijn allebei huisdieren; de gevaarlijkste neutrale kaart is hest, ook een dier, maar geen dier dat je binnen houdt, dus het hoort je niet te verleiden.',
  reasoningExample: '"æble (appel) is fruit, past bij frugt"',
  guessExample: `Example of a well-calibrated reply, from a DIFFERENT board where the clue was "frugt" (2):
{"guesses": [{"wordId": "w2", "confidence": 0.9, "reasoning": "æble (appel) is fruit, past bij frugt"}, {"wordId": "w9", "confidence": 0.8, "reasoning": "pære (peer) is fruit, past bij frugt"}, {"wordId": "w5", "confidence": 0.3, "reasoning": "træ (boom) heeft maar een indirect verband: fruit groeit aan bomen"}, {"wordId": "w11", "confidence": 0.15, "reasoning": "sød (zoet) beschrijft fruit, maar is zelf geen fruit"}]}`,
  translateExamples: `Example for "cykel": {"da": "cykel", "en": "fiets", "article": "en", "gender": "common", "countable": true}
Example for "namiddag": {"da": "eftermiddag", "en": "namiddag", "article": "en", "gender": "common", "countable": true}
Example for "trafik": {"da": "trafik", "en": "verkeer", "gender": "common", "countable": false}
Example for "at cykle": {"da": "cykle", "en": "fietsen"}`,
  joinNames: (names) => {
    const quoted = names.map((name) => `«${name}»`)
    return quoted.length <= 1
      ? quoted.join('')
      : `${quoted.slice(0, -1).join(', ')} en ${quoted[quoted.length - 1]}`
  },
  oneIdea: (names) => `Ik zie ${names} als één idee`,
  alsoCameToMind: (base, name) =>
    `${base}; «${name}» kwam ook bij me op, maar het hoort niet op dezelfde manier bij de rest.`,
  onlyIdea: (base) => `${base}.`,
  makesMeThinkOf: (clue, name, first) =>
    `«${clue}» doet me ${first ? 'als eerste' : 'ook'} aan ${name} denken.`,
  firstClue: (clue, names) =>
    `«${clue}»: ${names} passen allemaal bij hetzelfde idee.`,
  messages: {
    noClue: 'Casey kon geen aanwijzing kiezen voor de woorden die ze bij zich heeft.',
    noGuess: 'Casey kon niet achterhalen welke woorden jouw aanwijzing bedoelt.',
    noWordsLeft: 'Casey heeft deze ronde geen woorden meer om een aanwijzing over te geven.',
    badTranslation: 'De vertaling kwam terug in een vorm die de app niet kon lezen.',
    badPing: 'Casey heeft geantwoord, maar niet in de verwachte vorm.',
  },
}

export const PLAYER_LANGUAGES = {
  en: ENGLISH,
  de: GERMAN,
  es: SPANISH,
  zh: CHINESE,
  fr: FRENCH,
  pt: PORTUGUESE,
  nl: DUTCH,
  pl: POLISH,
  sv: SWEDISH,
  nb: NORWEGIAN,
  hu: HUNGARIAN,
}

/**
 * English, when the request says nothing. A client from before Phase 4 sends no
 * `playerLanguage` at all, and the answer it gets back must be the answer it
 * used to get.
 */
export const DEFAULT_PLAYER_LANGUAGE = ENGLISH

export const isPlayerLanguage = (code) => Object.hasOwn(PLAYER_LANGUAGES, code)

export const playerLanguageFor = (code) => PLAYER_LANGUAGES[code] ?? DEFAULT_PLAYER_LANGUAGE
