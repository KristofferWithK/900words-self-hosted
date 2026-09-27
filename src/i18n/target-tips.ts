import type { LanguageCode } from '../lang/types'
import type { UiLanguage } from './types'

type DanishTips = readonly [string, string, string, string, string]
type GermanTips = readonly [
  string, string, string, string, string,
  string, string, string, string, string,
]

/**
 * Casey's learner-language tips are about the active pack, but their wording
 * follows the UI language. Keep the Danish five and German ten in source order:
 * the two sets are different lessons, not translations of one another.
 */
export type TargetTipsByLanguage = Readonly<{
  da: DanishTips
  de: GermanTips
}>

/** Complete UI-language wording for the target-language tips Casey rotates. */
export const TARGET_TIPS: Readonly<Record<UiLanguage, TargetTipsByLanguage>> = {
  en: {
    da: [
      'æ, ø and å can only be Danish. A word with one of them is never English.',
      'Danish nouns carry their gender like luggage: learn «et hus», not just «hus».',
      'A compound of two words you know is a word you know: morgenmad, dyreliv.',
      'The definite article goes on the END in Danish: huset is “the house”.',
      'Danes count in twenties: halvtreds (fifty) is “half third times twenty”.',
    ],
    de: [
      'German nouns come in threes: learn «das Haus», never just «Haus».',
      'Every German noun is written with a capital letter, wherever it stands in the sentence.',
      'der and das both take «ein». Only die words take «eine», so «ein» hides a difference «der» shows.',
      'Some verbs split: «aufstehen» becomes «Ich stehe um sieben auf». The small word waits at the end.',
      'ä, ö, ü and ß are German letters. On a keyboard without them, ae, oe, ue and ss are real spellings, not workarounds.',
      'Flensburg, our first stop, is just a few kilometres from the Danish border.',
      'Germany has 16 federal states. Berlin, Hamburg and Bremen are states as well as cities!',
      'Germany borders nine countries, including Denmark, Poland and France.',
      'On their first day of school, many German children get a Schultüte: a cone full of treats.',
      'Germany’s highest mountain, the Zugspitze, rises in the Alps near the Austrian border.',
    ],
  },
  de: {
    da: [
      'æ, ø und å sind dänische Buchstaben. Ein Wort mit einem davon ist kein englisches Wort.',
      'Dänische Nomen haben ein grammatisches Geschlecht: Lerne «et hus», nicht nur «hus».',
      'Aus zwei Wörtern, die du kennst, wird ein Wort, das du kennst: «morgenmad», «dyreliv».',
      'Im Dänischen steht der bestimmte Artikel am ENDE des Wortes: «huset» heißt «das Haus».',
      'Im Dänischen zählt man in Zwanzigern: «halvtreds» (50) bedeutet sinngemäß «zweieinhalb Zwanziger».',
    ],
    de: [
      'Deutsche Nomen gibt es in drei grammatischen Geschlechtern: Lerne «das Haus», nicht nur «Haus».',
      'Jedes deutsche Substantiv schreibt man groß, egal, wo es im Satz steht.',
      'Auf «der» und «das» folgt «ein». Nur bei «die»-Wörtern heißt es «eine». «ein» verrät den Unterschied nicht, den «der» zeigt.',
      'Manche Verben trennen sich: Aus «aufstehen» wird «Ich stehe um sieben auf». Das kleine Wort wartet am Satzende.',
      'ä, ö, ü und ß gehören zum Deutschen. Fehlen sie auf der Tastatur, sind ae, oe, ue und ss gebräuchliche Ersatzschreibungen.',
      'Flensburg, unser erster Halt, liegt nur wenige Kilometer von der dänischen Grenze entfernt.',
      'Deutschland hat 16 Bundesländer. Berlin, Hamburg und Bremen sind zugleich Länder und Städte!',
      'Deutschland grenzt an neun Länder, darunter Dänemark, Polen und Frankreich.',
      'Am ersten Schultag bekommen viele Kinder in Deutschland eine Schultüte: eine Tüte voller Süßigkeiten.',
      'Deutschlands höchster Berg, die Zugspitze, liegt in den Alpen nahe der österreichischen Grenze.',
    ],
  },
  es: {
    da: [
      'æ, ø y å son letras danesas. Una palabra con alguna de ellas no es inglesa.',
      'Los sustantivos daneses tienen género: aprende «et hus», no solo «hus».',
      'Si conoces dos palabras, también conoces la compuesta: «morgenmad», «dyreliv».',
      'En danés, el artículo definido va al FINAL de la palabra: «huset» significa «la casa».',
      'En danés se cuenta de veinte en veinte: «halvtreds» (50) equivale a «dos veintenas y media».',
    ],
    de: [
      'Los sustantivos alemanes tienen tres géneros: aprende «das Haus», no solo «Haus».',
      'Todos los sustantivos alemanes se escriben con mayúscula, estén donde estén en la frase.',
      'Con «der» y «das» se usa «ein». Solo las palabras con «die» usan «eine»: «ein» oculta una diferencia que «der» sí muestra.',
      'Algunos verbos se separan: «aufstehen» se convierte en «Ich stehe um sieben auf»; la partícula espera al final.',
      'ä, ö, ü y ß son letras alemanas. Si tu teclado no las tiene, ae, oe, ue y ss son formas habituales de escribirlas.',
      'Flensburg, nuestra primera parada, está a solo unos kilómetros de la frontera danesa.',
      'Alemania tiene 16 estados federados. ¡Berlín, Hamburgo y Bremen son ciudades y estados a la vez!',
      'Alemania tiene frontera con nueve países, entre ellos Dinamarca, Polonia y Francia.',
      'El primer día de clase, muchos niños alemanes reciben una Schultüte: una bolsa cónica llena de golosinas.',
      'La montaña más alta de Alemania, el Zugspitze, está en los Alpes, cerca de la frontera austríaca.',
    ],
  },
  zh: {
    da: [
      'æ、ø 和 å 是丹麦语字母。含有其中一个的词就不是英语。',
      '丹麦语名词有词性，像行李贴着标签一样：记「et hus」，别只记「hus」。',
      '两个认识的词合起来，也会成为你认识的词：「morgenmad」「dyreliv」。',
      '丹麦语把定冠词接在词尾：「huset」就是「房子」。',
      '丹麦语按二十来计数：「halvtreds」（50）来自“离三个二十还差半个二十”的说法。',
    ],
    de: [
      '德语名词有三种语法性别：记「das Haus」，别只记「Haus」。',
      '每个德语名词都要大写，无论它在句子中的什么位置。',
      '「der」和「das」后面都用「ein」；只有「die」类名词用「eine」。所以「ein」看不出「der」能显示的区别。',
      '有些德语动词会分开：「aufstehen」会变成「Ich stehe um sieben auf」。可分前缀要等到句末。',
      'ä、ö、ü 和 ß 是德语字母。键盘没有这些字母时，ae、oe、ue 和 ss 是常见的替代拼法。',
      '弗伦斯堡是我们旅程的第一站，离丹麦边境只有几公里。',
      '德国有16个联邦州。柏林、汉堡和不来梅既是城市，也是州！',
      '德国与九个国家接壤，包括丹麦、波兰和法国。',
      '许多德国孩子上学第一天会收到 Schultüte：一个装满糖果的圆锥形礼包。',
      '德国最高峰楚格峰位于阿尔卑斯山，靠近奥地利边境。',
    ],
  },
  fr: {
    da: [
      'æ, ø et å sont des lettres danoises. Un mot qui en contient une n’est pas anglais.',
      'Les noms danois ont un genre : apprends «et hus», pas seulement «hus».',
      'Deux mots que tu connais forment un mot que tu connais : «morgenmad», «dyreliv».',
      'En danois, l’article défini se colle à la FIN du mot : «huset» signifie «la maison».',
      'En danois, on compte par vingtaines : «halvtreds» (50) équivaut à «deux vingtaines et demie».',
    ],
    de: [
      'Les noms allemands ont trois genres : apprends «das Haus», pas seulement «Haus».',
      'Tous les noms allemands prennent une majuscule, où qu’ils se trouvent dans la phrase.',
      '«der» et «das» prennent tous deux «ein». Seuls les mots en «die» prennent «eine» : «ein» masque une différence que «der» révèle.',
      'Certains verbes se séparent : «aufstehen» devient «Ich stehe um sieben auf». Le petit mot attend à la fin.',
      'ä, ö, ü et ß sont des lettres allemandes. Sans elles au clavier, ae, oe, ue et ss sont des graphies de remplacement courantes.',
      'Flensburg, notre première étape, se trouve à quelques kilomètres seulement de la frontière danoise.',
      'L’Allemagne compte 16 Länder. Berlin, Hambourg et Brême sont à la fois des villes et des Länder !',
      'L’Allemagne a neuf pays voisins, dont le Danemark, la Pologne et la France.',
      'Pour leur premier jour d’école, beaucoup d’enfants allemands reçoivent une Schultüte : un cornet rempli de friandises.',
      'Le Zugspitze, plus haut sommet d’Allemagne, se trouve dans les Alpes, près de la frontière autrichienne.',
    ],
  },
  pt: {
    da: [
      'æ, ø e å são letras dinamarquesas. Uma palavra com uma delas não é inglesa.',
      'Os substantivos dinamarqueses têm género: aprende «et hus», não apenas «hus».',
      'Duas palavras que já conheces também formam uma palavra que conheces: «morgenmad», «dyreliv».',
      'Em dinamarquês, o artigo definido junta-se ao FIM da palavra: «huset» quer dizer «a casa».',
      'Em dinamarquês conta-se de vinte em vinte: «halvtreds» (50) equivale a «duas vintenas e meia».',
    ],
    de: [
      'Os substantivos alemães têm três géneros: aprende «das Haus», não apenas «Haus».',
      'Todos os substantivos alemães se escrevem com inicial maiúscula, em qualquer lugar da frase.',
      '«der» e «das» usam ambos «ein». Só as palavras com «die» usam «eine»: «ein» esconde uma diferença que «der» mostra.',
      'Alguns verbos separam-se: «aufstehen» passa a «Ich stehe um sieben auf». A partícula fica à espera no fim.',
      'ä, ö, ü e ß são letras alemãs. Sem elas no teclado, ae, oe, ue e ss são formas alternativas de escrita correntes.',
      'Flensburg, a nossa primeira paragem, fica a poucos quilómetros da fronteira dinamarquesa.',
      'A Alemanha tem 16 estados federados. Berlim, Hamburgo e Bremen são cidades e estados!',
      'A Alemanha faz fronteira com nove países, incluindo a Dinamarca, a Polónia e a França.',
      'No primeiro dia de aulas, muitas crianças alemãs recebem uma Schultüte: um cone cheio de doces.',
      'O Zugspitze, a montanha mais alta da Alemanha, fica nos Alpes, perto da fronteira austríaca.',
    ],
  },
  nl: {
    da: [
      'æ, ø en å zijn Deense letters. Een woord met een van die letters is geen Engels woord.',
      'Deense zelfstandige naamwoorden hebben een geslacht: leer «et hus», niet alleen «hus».',
      'Twee woorden die je kent, vormen samen een woord dat je kent: «morgenmad», «dyreliv».',
      'In het Deens komt het bepaald lidwoord ACHTERAAN: «huset» betekent «het huis».',
      'In het Deens tel je in twintigtallen: «halvtreds» (50) komt neer op «tweeënhalf keer twintig».',
    ],
    de: [
      'Duitse zelfstandige naamwoorden hebben drie grammaticale geslachten: leer «das Haus», niet alleen «Haus».',
      'Elk Duits zelfstandig naamwoord krijgt een hoofdletter, waar het ook in de zin staat.',
      'Na «der» en «das» komt allebei «ein». Alleen woorden met «die» krijgen «eine»: «ein» verbergt een verschil dat «der» laat zien.',
      'Sommige werkwoorden splitsen: «aufstehen» wordt «Ich stehe um sieben auf». Het kleine woord wacht achteraan.',
      'ä, ö, ü en ß zijn Duitse letters. Staan ze niet op je toetsenbord, dan zijn ae, oe, ue en ss gangbare schrijfwijzen als alternatief.',
      'Flensburg, onze eerste stop, ligt op maar een paar kilometer van de Deense grens.',
      'Duitsland heeft 16 deelstaten. Berlijn, Hamburg en Bremen zijn zowel steden als deelstaten!',
      'Duitsland grenst aan negen landen, waaronder Denemarken, Polen en Frankrijk.',
      'Op hun eerste schooldag krijgen veel Duitse kinderen een Schultüte: een puntzak vol lekkers.',
      'De Zugspitze, de hoogste berg van Duitsland, ligt in de Alpen, vlak bij de Oostenrijkse grens.',
    ],
  },
  pl: {
    da: [
      'æ, ø i å to duńskie litery. Słowo z jedną z nich nie jest angielskie.',
      'Duńskie rzeczowniki mają rodzaj: zapamiętaj «et hus», nie samo «hus».',
      'Dwa znane słowa złożone razem też tworzą znane słowo: «morgenmad», «dyreliv».',
      'W duńskim rodzajnik określony dokleja się na KOŃCU wyrazu: «huset» znaczy «dom».',
      'W duńskim liczy się dwudziestkami: «halvtreds» (50) oznacza «dwie i pół dwudziestki».',
    ],
    de: [
      'Niemieckie rzeczowniki mają trzy rodzaje gramatyczne: ucz się «das Haus», nie samego «Haus».',
      'Każdy niemiecki rzeczownik zapisuje się wielką literą, niezależnie od miejsca w zdaniu.',
      'Po «der» i «das» występuje «ein». Tylko rzeczowniki z «die» mają «eine», więc «ein» ukrywa różnicę widoczną w «der».',
      'Niektóre czasowniki się rozdzielają: «aufstehen» zmienia się w «Ich stehe um sieben auf». Małe słowo czeka na końcu.',
      'ä, ö, ü i ß to niemieckie litery. Gdy nie ma ich na klawiaturze, ae, oe, ue i ss są częstymi zapisami zastępczymi.',
      'Flensburg, nasz pierwszy przystanek, leży zaledwie kilka kilometrów od duńskiej granicy.',
      'Niemcy mają 16 krajów związkowych. Berlin, Hamburg i Brema są jednocześnie miastami i krajami!',
      'Niemcy graniczą z dziewięcioma państwami, w tym z Danią, Polską i Francją.',
      'W pierwszym dniu szkoły wiele niemieckich dzieci dostaje Schultüte: rożek pełen słodyczy.',
      'Zugspitze, najwyższy szczyt Niemiec, leży w Alpach, blisko granicy z Austrią.',
    ],
  },
  sv: {
    da: [
      'æ, ø och å är danska bokstäver. Ett ord med någon av dem är inte engelska.',
      'Danska substantiv har ett genus: lär dig «et hus», inte bara «hus».',
      'Två ord du kan blir ett ord du kan: «morgenmad», «dyreliv».',
      'På danska hamnar den bestämda artikeln i SLUTET av ordet: «huset» betyder «hus i bestämd form».',
      'Danska räknar i tjugotal: «halvtreds» (50) betyder «två och ett halvt tjugotal».',
    ],
    de: [
      'Tyska substantiv har tre grammatiska genus: lär dig «das Haus», inte bara «Haus».',
      'Alla tyska substantiv skrivs med stor bokstav, oavsett var de står i meningen.',
      'Både «der» och «das» följs av «ein». Bara ord med «die» får «eine», så «ein» döljer en skillnad som «der» visar.',
      'Vissa verb delar på sig: «aufstehen» blir «Ich stehe um sieben auf». Det lilla ordet väntar till slutet.',
      'ä, ö, ü och ß är tyska bokstäver. Saknas de på tangentbordet är ae, oe, ue och ss vanliga alternativa stavningar.',
      'Flensburg, vårt första stopp, ligger bara några kilometer från den danska gränsen.',
      'Tyskland har 16 förbundsländer. Berlin, Hamburg och Bremen är både städer och delstater!',
      'Tyskland gränsar till nio länder, bland annat Danmark, Polen och Frankrike.',
      'På sin första skoldag får många tyska barn en Schultüte: en strut fylld med godsaker.',
      'Tysklands högsta berg, Zugspitze, ligger i Alperna nära den österrikiska gränsen.',
    ],
  },
  nb: {
    da: [
      'æ, ø og å er danske bokstaver. Et ord med en av dem er ikke engelsk.',
      'Danske substantiv har et grammatisk kjønn: lær «et hus», ikke bare «hus».',
      'To ord du kan, blir også et ord du kan: «morgenmad», «dyreliv».',
      'På dansk kommer den bestemte artikkelen på SLUTTEN av ordet: «huset» betyr «hus i bestemt form».',
      'På dansk teller man med tjue som grunnenhet: «halvtreds» (50) tilsvarer «to og en halv ganger tjue».',
    ],
    de: [
      'Tyske substantiv har tre grammatiske kjønn: lær «das Haus», ikke bare «Haus».',
      'Alle tyske substantiv skrives med stor forbokstav, uansett hvor de står i setningen.',
      'Både «der» og «das» får «ein». Bare ord med «die» får «eine», så «ein» skjuler en forskjell «der» viser.',
      'Noen verb deler seg: «aufstehen» blir til «Ich stehe um sieben auf». Det lille ordet venter til slutt.',
      'ä, ö, ü og ß er tyske bokstaver. Mangler de på tastaturet, er ae, oe, ue og ss vanlige alternative skrivemåter.',
      'Flensburg, vårt første stopp, ligger bare noen få kilometer fra den danske grensen.',
      'Tyskland har 16 delstater. Berlin, Hamburg og Bremen er både byer og delstater!',
      'Tyskland grenser til ni land, blant annet Danmark, Polen og Frankrike.',
      'På den første skoledagen får mange tyske barn en Schultüte: en kjegle full av godteri.',
      'Tysklands høyeste fjell, Zugspitze, ligger i Alpene nær den østerrikske grensen.',
    ],
  },
  hu: {
    da: [
      'Az æ, ø és å dán betűk. Amelyik szóban ilyen van, az nem angol.',
      'A dán főneveknek nyelvtani nemük van: tanuld meg az «et hus» alakot, ne csak a «hus»-t.',
      'Két ismert szóból is lehet egy ismerős szó: «morgenmad», «dyreliv».',
      'A dán határozott névelő a szó VÉGÉRE kerül: a «huset» azt jelenti: «a ház».',
      'A dánban húszasával számolnak: a «halvtreds» (50) azt jelenti: „két és fél húszas”.',
    ],
    de: [
      'A német főneveknek három nyelvtani nemük van: tanuld meg a «das Haus» alakot, ne csak a «Haus»-t.',
      'Minden német főnevet nagy kezdőbetűvel írunk, bárhol áll is a mondatban.',
      'A «der» és a «das» után is «ein» áll. Csak a «die» szavakhoz tartozik «eine», így az «ein» elrejti azt a különbséget, amit a «der» megmutat.',
      'Néhány ige szétválik: az «aufstehen» ilyen lesz: «Ich stehe um sieben auf». A kis szó a mondat végére kerül.',
      'Az ä, ö, ü és ß német betűk. Ha nincsenek a billentyűzeten, az ae, oe, ue és ss elterjedt helyettesítő írásmódok.',
      'Flensburg, az első állomásunk, mindössze néhány kilométerre van a dán határtól.',
      'Németországnak 16 tartománya van. Berlin, Hamburg és Bréma egyszerre város és tartomány!',
      'Németország kilenc országgal határos, köztük Dániával, Lengyelországgal és Franciaországgal.',
      'Az első tanítási napon sok német gyerek Schultütét kap: egy édességgel teli, tölcsér alakú csomagot.',
      'Németország legmagasabb hegye, a Zugspitze, az Alpokban, az osztrák határ közelében emelkedik.',
    ],
  },
}

/** Pick wording by the language Casey speaks, then the topic by the active pack. */
export function targetTipsFor(uiLanguage: UiLanguage, language: LanguageCode): readonly string[] {
  return TARGET_TIPS[uiLanguage][language]
}
