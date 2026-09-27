#!/usr/bin/env node
/**
 * The German City 1 (Flensburg) finish-screen review: one sentence per card,
 * each underlining the card and one high-frequency support word, plus a
 * general About note per support word.
 *
 * Owner-approved in chat on 2026-09-26, after asking for fewer article and
 * «Sie» focuses and more words from the high-frequency support list. There is
 * no German frequency ledger in the repo, so the support words are the German
 * counterparts of the Danish City 1 review targets plus the German course's
 * own City 1 support terms; no focus word underlines more than five cards.
 *
 * This file is the source. It writes `src/data/city1-review.de.json` in the
 * row shapes of `src/review/city1.ts`, with every span computed and checked
 * here rather than typed by hand:
 *
 *   node scripts/german-city1-review.mjs          check, print a summary
 *   node scripts/german-city1-review.mjs --write  check and write the JSON
 *   node scripts/german-city1-review.mjs --check  fail if the JSON is stale
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { slugForId } from './audio-slug.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TARGET = resolve(ROOT, 'src/data/city1-review.de.json')
const VERSION = 1
const APPROVAL = 'owner-chat-2026-09-26'

// [card id, German, English, card form as written, focus id, focus as written]
const REVIEW = [
  ['de:Mutter', 'Hallo, ist deine Mutter da?', 'Hello, is your mum there?', 'Mutter', 'hallo', 'Hallo'],
  ['de:Vater', 'Guten Tag, ich bin der Vater von Lea.', "Good afternoon, I'm Lea's father.", 'Vater', 'guten-tag', 'Guten Tag'],
  ['de:Kind', 'Wer ist das Kind?', 'Who is the child?', 'Kind', 'wer', 'Wer'],
  ['de:Hund', 'Der Hund ist schon alt.', 'The dog is already old.', 'Hund', 'schon', 'schon'],
  ['de:Katze', 'Gibt es hier eine Katze?', 'Is there a cat here?', 'Katze', 'gibt-es', 'Gibt es'],
  ['de:Haus', 'Willkommen in unserem Haus!', 'Welcome to our house!', 'Haus', 'willkommen', 'Willkommen'],
  ['de:Essen', 'Danke für das Essen!', 'Thank you for the food!', 'Essen', 'danke', 'Danke'],
  ['de:Wasser', 'Noch ein Wasser, bitte.', 'Another water, please.', 'Wasser', 'noch', 'Noch'],
  ['de:Mann', 'Wer ist der Mann da?', 'Who is that man there?', 'Mann', 'da', 'da'],
  ['de:Mädchen', 'Das Mädchen spielt gern Fußball.', 'The girl likes playing football.', 'Mädchen', 'gern', 'gern'],
  ['de:Auto', 'Ja, das ist mein Auto.', 'Yes, that is my car.', 'Auto', 'ja', 'Ja'],
  ['de:Stadt', 'Jetzt sind wir in der Stadt.', 'Now we are in the city.', 'Stadt', 'jetzt', 'Jetzt'],
  ['de:Schule', 'Die Schule ist gleich hier.', 'The school is right here.', 'Schule', 'hier', 'hier'],
  ['de:Tag', 'Heute ist ein schöner Tag.', 'Today is a lovely day.', 'Tag', 'heute', 'Heute'],
  ['de:Woche', 'Nächste Woche fahre ich wieder nach Flensburg.', "Next week I'm going to Flensburg again.", 'Woche', 'wieder', 'wieder'],
  ['de:groß', 'Die Stadt ist sehr groß.', 'The city is very big.', 'groß', 'sehr', 'sehr'],
  ['de:klein', 'Das Zimmer ist ein bisschen klein.', 'The room is a bit small.', 'klein', 'ein-bisschen', 'ein bisschen'],
  ['de:alt', 'Wie alt bist du?', 'How old are you?', 'alt', 'wie', 'Wie'],
  ['de:Freund', 'Mein Freund kommt auch.', 'My friend is coming too.', 'Freund', 'auch', 'auch'],
  ['de:Geld', 'Hast du noch Geld?', 'Do you have any money left?', 'Geld', 'noch', 'noch'],
  ['de:Arbeit', 'Die Arbeit ist jetzt fertig.', 'The work is done now.', 'Arbeit', 'jetzt', 'jetzt'],
  ['de:Bus', 'Wann kommt der Bus?', 'When is the bus coming?', 'Bus', 'wann', 'Wann'],
  ['de:fahren', 'Wir fahren zusammen nach Flensburg.', "We're going to Flensburg together.", 'fahren', 'zusammen', 'zusammen'],
  ['de:lesen', 'Ich lese gern.', 'I like reading.', 'lese', 'gern', 'gern'],
  ['de:Jahr', 'Das Jahr ist schon fast vorbei.', 'The year is almost over already.', 'Jahr', 'schon', 'schon'],
  ['de:bekommen', 'Was bekommen Sie?', 'What can I get you?', 'bekommen', 'was', 'Was'],
  ['de:dänisch', 'Das Brot hier ist dänisch.', 'The bread here is Danish.', 'dänisch', 'hier', 'hier'],
  ['de:Mensch', 'Hier gibt es viele Menschen.', 'There are a lot of people here.', 'Menschen', 'gibt-es', 'gibt es'],
  ['de:kommen', 'Woher kommst du?', 'Where are you from?', 'kommst', 'woher', 'Woher'],
  ['de:gut', 'Danke, mir geht es gut.', "Thanks, I'm fine.", 'gut', 'danke', 'Danke'],
  ['de:Zuhause', 'Flensburg ist mein Zuhause.', 'Flensburg is my home.', 'Zuhause', 'mein', 'mein'],
  ['de:sagen', 'Wie sagt man das auf Deutsch?', 'How do you say that in German?', 'sagt', 'wie', 'Wie'],
  ['de:gehen', 'Wir gehen jetzt, tschüss!', "We're going now, bye!", 'gehen', 'tschuess', 'tschüss'],
  ['de:neu', 'Das ist alles neu für mich.', "That's all new to me.", 'neu', 'alles', 'alles'],
  ['de:sehen', 'Wir sehen uns morgen!', 'See you tomorrow!', 'sehen', 'morgen', 'morgen'],
  ['de:ganz', 'Ich bin noch ganz müde.', "I'm still really tired.", 'ganz', 'noch', 'noch'],
  ['de:nehmen', 'Ich nehme einen Kaffee, bitte.', "I'll have a coffee, please.", 'nehme', 'bitte', 'bitte'],
  ['de:lang', 'Die Reise ist lang, aber schön.', 'The trip is long but lovely.', 'lang', 'aber', 'aber'],
  ['de:finden', 'Ich finde den Bahnhof nicht.', "I can't find the station.", 'finde', 'nicht', 'nicht'],
  ['de:letzte', 'Das ist der letzte Bus heute.', 'That is the last bus today.', 'letzte', 'heute', 'heute'],
  ['de:stehen', 'Wer steht da?', 'Who is standing there?', 'steht', 'wer', 'Wer'],
  ['de:Tier', 'Welches Tier ist das?', 'Which animal is that?', 'Tier', 'welch', 'Welches'],
  ['de:wissen', 'Das weiß ich nicht.', "I don't know.", 'weiß', 'nicht', 'nicht'],
  ['de:glauben', 'Ja, das glaube ich auch.', 'Yes, I think so too.', 'glaube', 'auch', 'auch'],
  ['de:Partner', 'Mein Partner und ich wohnen hier.', 'My partner and I live here.', 'Partner', 'und', 'und'],
  ['de:richtig', 'Nein, das ist nicht richtig.', "No, that's not right.", 'richtig', 'nein', 'Nein'],
  ['de:benutzen', 'Kann ich hier das WLAN benutzen?', 'Can I use the Wi-Fi here?', 'benutzen', 'koennen', 'Kann'],
  ['de:machen', 'Das macht nichts.', "That doesn't matter.", 'macht', 'nichts', 'nichts'],
  ['de:schön', 'Hier ist es wirklich schön.', "It's really lovely here.", 'schön', 'wirklich', 'wirklich'],
  ['de:liegen', 'Wo liegt Flensburg?', 'Where is Flensburg?', 'liegt', 'wo', 'Wo'],
  ['de:Land', 'Aus welchem Land kommst du?', 'Which country are you from?', 'Land', 'aus', 'Aus'],
  ['de:sitzen', 'Entschuldigung, sitzt hier jemand?', 'Excuse me, is anyone sitting here?', 'sitzt', 'entschuldigung', 'Entschuldigung'],
  ['de:bereit', 'Okay, ich bin bereit.', "Okay, I'm ready.", 'bereit', 'okay', 'Okay'],
  ['de:Leben', 'So ist das Leben.', "That's life.", 'Leben', 'so', 'So'],
  ['de:heißen', 'Wie heißt du?', "What's your name?", 'heißt', 'wie', 'Wie'],
  ['de:Welt', 'Ich möchte die Welt sehen.', 'I would like to see the world.', 'Welt', 'moechte', 'möchte'],
  ['de:Mal', 'Bis zum nächsten Mal!', 'Until next time!', 'Mal', 'bis', 'Bis'],
  ['de:Wort', 'Was bedeutet das Wort?', 'What does the word mean?', 'Wort', 'was', 'Was'],
  ['de:hören', 'Ich höre dich nicht.', "I can't hear you.", 'höre', 'nicht', 'nicht'],
  ['de:Reise', 'Gute Reise und tschüss!', 'Have a good trip, bye!', 'Reise', 'tschuess', 'tschüss'],
  ['de:Klasse', 'Wir sind in der gleichen Klasse.', 'We are in the same class.', 'Klasse', 'wir', 'Wir'],
  ['de:Seite', 'Auf welcher Seite sind wir?', 'Which page are we on?', 'Seite', 'welch', 'welcher'],
  ['de:Weg', 'Der Weg ist hier links.', 'The way is here on the left.', 'Weg', 'hier', 'hier'],
  ['de:sicher', 'Bist du sicher?', 'Are you sure?', 'sicher', 'du', 'du'],
  ['de:Krone', 'Was kostet das in Kronen?', 'How much is that in kroner?', 'Kronen', 'was', 'Was'],
  ['de:schwer', 'Die Tasche ist zu schwer.', 'The bag is too heavy.', 'schwer', 'zu', 'zu'],
  ['de:Treffen', 'Wann ist das Treffen?', 'When is the meeting?', 'Treffen', 'wann', 'Wann'],
  ['de:denken', 'Was denkst du?', 'What do you think?', 'denkst', 'was', 'Was'],
  ['de:wohnen', 'Wo wohnst du?', 'Where do you live?', 'wohnst', 'wo', 'Wo'],
  ['de:Platz', 'Ist hier noch ein Platz frei?', 'Is there still a free seat here?', 'Platz', 'noch', 'noch'],
  ['de:probieren', 'Möchtest du das probieren?', 'Would you like to try that?', 'probieren', 'moechte', 'Möchtest'],
  ['de:schlecht', 'Mir ist schlecht.', 'I feel sick.', 'schlecht', 'mir', 'Mir'],
  ['de:möglich', 'Ist das heute möglich?', 'Is that possible today?', 'möglich', 'heute', 'heute'],
  ['de:Zeit', 'Hast du jetzt Zeit?', 'Do you have time now?', 'Zeit', 'jetzt', 'jetzt'],
  ['de:Name', 'Entschuldigung, wie ist Ihr Name?', 'Excuse me, what is your name?', 'Name', 'entschuldigung', 'Entschuldigung'],
  ['de:erinnern', 'Erinnerst du dich an mich?', 'Do you remember me?', 'Erinnerst', 'dich', 'dich'],
  ['de:verschieden', 'Wir sind sehr verschieden.', 'We are very different.', 'verschieden', 'sehr', 'sehr'],
  ['de:Person', 'Wie viele Personen?', 'How many people?', 'Personen', 'wie-viel', 'Wie viele'],
  ['de:Grund', 'Das ist der Grund, warum ich hier bin.', "That's the reason why I'm here.", 'Grund', 'warum', 'warum'],
  ['de:Weise', 'Auf diese Weise geht es schneller.', "It's quicker this way.", 'Weise', 'dies', 'diese'],
  ['de:Bild', 'Wer hat das Bild gemacht?', 'Who took the picture?', 'Bild', 'wer', 'Wer'],
  ['de:Lust', 'Ich habe keine Lust.', "I don't feel like it.", 'Lust', 'kein', 'keine'],
  ['de:Stunde', 'Der Bus kommt in einer Stunde.', 'The bus comes in an hour.', 'Stunde', 'in', 'in'],
  ['de:Geschichte', 'Kennst du die Geschichte schon?', 'Do you already know the story?', 'Geschichte', 'schon', 'schon'],
  ['de:erreichen', 'Wir erreichen Flensburg um acht.', 'We reach Flensburg at eight.', 'erreichen', 'um', 'um'],
  ['de:Monat', 'Ich bin seit einem Monat hier.', "I've been here for a month.", 'Monat', 'seit', 'seit'],
  ['de:Gedanke', 'Mach dir keine Gedanken!', "Don't worry about it!", 'Gedanken', 'kein', 'keine'],
  ['de:meinen', 'Wie meinst du das?', 'What do you mean?', 'meinst', 'wie', 'Wie'],
  ['de:Sprache', 'Ich spreche die Sprache ein bisschen.', 'I speak the language a little.', 'Sprache', 'ein-bisschen', 'ein bisschen'],
  ['de:Beispiel', 'Kannst du mir ein Beispiel geben?', 'Can you give me an example?', 'Beispiel', 'koennen', 'Kannst'],
  ['de:lustig', 'Das ist aber lustig!', 'That really is funny!', 'lustig', 'aber', 'aber'],
  ['de:Zweifel', 'Ohne Zweifel!', 'Without a doubt!', 'Zweifel', 'ohne', 'Ohne'],
  ['de:spannend', 'Das Buch ist wirklich spannend.', 'The book is really exciting.', 'spannend', 'wirklich', 'wirklich'],
  ['de:Uhr', 'Wie viel Uhr ist es?', 'What time is it?', 'Uhr', 'wie-viel', 'Wie viel'],
  ['de:halb', 'Wir treffen uns um halb drei.', "We're meeting at half past two.", 'halb', 'um', 'um'],
  ['de:Film', 'Der Film war gut.', 'The film was good.', 'Film', 'war', 'war'],
  ['de:Gesetz', 'Das ist gegen das Gesetz.', "That's against the law.", 'Gesetz', 'gegen', 'gegen'],
  ['de:Musik', 'Ich höre gern Musik.', 'I like listening to music.', 'Musik', 'gern', 'gern'],
  ['de:Meinung', 'Was ist deine Meinung?', "What's your opinion?", 'Meinung', 'was', 'Was'],
  ['de:reden', 'Können wir morgen reden?', 'Can we talk tomorrow?', 'reden', 'morgen', 'morgen'],
]

// focus id → [meaning, usage, example German, example English, focus as written in the example]
const ABOUT = {
  hallo: ['Hello; hi.', 'An everyday greeting for any time of day. On the phone it is also how you answer.', 'Hallo, Mia!', 'Hi, Mia!', 'Hallo'],
  'guten-tag': ['Good day; hello.', 'The polite greeting from late morning to early evening, for shops, offices and people you do not know.', 'Guten Tag, Frau Berg.', 'Good afternoon, Ms Berg.', 'Guten Tag'],
  wer: ['Who.', 'Asks about a person. The verb comes straight after it: wer ist …?, wer kommt …?', 'Wer kommt heute?', 'Who is coming today?', 'Wer'],
  schon: ['Already; yet.', 'Says something has happened earlier than expected. In a question it means yet: Bist du schon da?', 'Der Zug ist schon da.', 'The train is already here.', 'schon'],
  'gibt-es': ['There is; there are. Gibt es …? is: is there …?', 'Says that something exists or is available. It stays es gibt for one thing or many.', 'Es gibt hier ein Café.', 'There is a café here.', 'Es gibt'],
  willkommen: ['Welcome.', 'Greets someone arriving. Add in with a place: Willkommen in Flensburg!', 'Herzlich willkommen!', 'A warm welcome!', 'willkommen'],
  danke: ['Thank you; thanks.', 'The everyday thanks. Danke für … names the thing; danke schön is a little warmer.', 'Danke schön!', 'Thank you very much!', 'Danke'],
  noch: ['Still; another; left (over).', 'Noch ein … asks for one more. With a verb it means still: Ich bin noch hier.', 'Noch einen Kaffee?', 'Another coffee?', 'Noch'],
  da: ['There; here.', 'Points at a place near the speaker or the listener. Ist … da? asks whether someone is in.', 'Ist Lea da?', 'Is Lea there?', 'da'],
  gern: ['Gladly; like to.', 'After a verb it says you like doing it: Ich lese gern. On its own it answers a thank-you or a request.', 'Ich koche gern.', 'I like cooking.', 'gern'],
  ja: ['Yes.', 'The ordinary yes. Ja, gern is a friendly yes, please.', 'Ja, gern.', 'Yes, please.', 'Ja'],
  jetzt: ['Now.', 'Says something happens at this moment. It often stands first for emphasis.', 'Ich gehe jetzt.', 'I am going now.', 'jetzt'],
  hier: ['Here.', 'The place where the speaker is. Hier ist … hands something over or points at it.', 'Hier ist der Bahnhof.', 'Here is the station.', 'Hier'],
  heute: ['Today.', 'This day. It can stand first or later in the sentence.', 'Heute ist Montag.', 'Today is Monday.', 'Heute'],
  wieder: ['Again.', 'Something happens another time. Noch einmal asks for a repeat; wieder describes one.', 'Es regnet wieder.', 'It is raining again.', 'wieder'],
  sehr: ['Very; very much.', 'Makes an adjective stronger: sehr gut. Danke sehr is a polite thanks.', 'Das ist sehr gut.', 'That is very good.', 'sehr'],
  'ein-bisschen': ['A bit; a little.', 'Softens what follows. Ein bisschen Deutsch is a little German.', 'Ich spreche ein bisschen Deutsch.', 'I speak a little German.', 'ein bisschen'],
  wie: ['How; what.', 'Asks about manner or state. In Wie heißt du? and Wie alt …? English says what or how.', 'Wie geht es dir?', 'How are you?', 'Wie'],
  auch: ['Also; too.', 'Adds the same to something already said. Ich auch is: me too.', 'Ich auch.', 'Me too.', 'auch'],
  wann: ['When.', 'Asks about time. The verb follows it: Wann kommt …?', 'Wann fährt der Zug?', 'When does the train leave?', 'Wann'],
  zusammen: ['Together.', 'Several people doing one thing. In a café, zusammen asks for one bill.', 'Zusammen, bitte.', 'Together, please.', 'Zusammen'],
  was: ['What.', 'Asks about a thing. Was ist das? is the first question of any new place.', 'Was ist das?', 'What is that?', 'Was'],
  mein: ['My.', 'Says something belongs to you. It is mein before a der or das noun and meine before a die noun.', 'Das ist mein Zimmer.', 'That is my room.', 'mein'],
  tschuess: ['Bye.', 'The friendly goodbye. Auf Wiedersehen is the polite one.', 'Tschüss, bis morgen!', 'Bye, see you tomorrow!', 'Tschüss'],
  alles: ['Everything; all.', 'All of it at once. Alles gut? asks whether everything is fine.', 'Alles gut?', 'Everything OK?', 'Alles'],
  morgen: ['Tomorrow.', 'The day after today. Small letter; Morgen with a capital is the morning.', 'Ich komme morgen wieder.', 'I will come back tomorrow.', 'morgen'],
  bitte: ['Please; you are welcome.', 'Makes a request polite. After a thank-you it means you are welcome; wie bitte? asks for a repeat.', 'Ein Wasser, bitte.', 'A water, please.', 'bitte'],
  aber: ['But; really.', 'Joins two ideas that pull apart. In Das ist aber … it adds surprise.', 'Klein, aber schön.', 'Small but lovely.', 'aber'],
  nicht: ['Not.', 'Says no to a verb, an adjective or a whole sentence. A noun takes kein instead.', 'Das ist nicht gut.', 'That is not good.', 'nicht'],
  welch: ['Which.', 'Asks you to choose. Its ending follows the noun: welcher Bus, welche Tür, welches Haus.', 'Welcher Bus fährt zum Bahnhof?', 'Which bus goes to the station?', 'Welcher'],
  und: ['And.', 'Joins two words or two sentences. Und du? passes a question back.', 'Und du?', 'And you?', 'Und'],
  nein: ['No.', 'The ordinary no. Nein, danke declines politely.', 'Nein, danke.', 'No, thank you.', 'Nein'],
  koennen: ['Can; be able to.', 'Kann ich …? and Kannst du …? ask for permission or help. The other verb goes to the end.', 'Kannst du mir helfen?', 'Can you help me?', 'Kannst'],
  nichts: ['Nothing.', 'Not anything. Das macht nichts is: never mind, no problem.', 'Ich sehe nichts.', 'I cannot see anything.', 'nichts'],
  wirklich: ['Really.', 'Makes a word stronger or asks whether something is true: Wirklich?', 'Wirklich?', 'Really?', 'Wirklich'],
  wo: ['Where.', 'Asks about a place. Wo ist …? is the question for finding anything.', 'Wo ist der Bahnhof?', 'Where is the station?', 'Wo'],
  aus: ['From; out of.', 'Says where someone or something comes from: Ich komme aus Kanada.', 'Ich komme aus Dänemark.', 'I come from Denmark.', 'aus'],
  entschuldigung: ['Excuse me; sorry.', 'Opens a question to a stranger, or apologises for a small thing.', 'Entschuldigung, wo ist die Toilette?', 'Excuse me, where is the toilet?', 'Entschuldigung'],
  okay: ['OK.', 'Agrees or says something is fine. German uses it just as English does.', 'Okay, bis dann.', 'OK, see you then.', 'Okay'],
  so: ['So; like this; that way.', 'Points at a manner. So ist das is: that is how it is.', 'So geht das.', 'That is how it works.', 'So'],
  moechte: ['Would like.', 'The polite way to ask for or offer something: Ich möchte …, Möchtest du …?', 'Ich möchte ein Brot.', 'I would like a bread roll.', 'möchte'],
  bis: ['Until; see you.', 'Bis + a time is a goodbye: bis morgen, bis bald, bis dann.', 'Bis bald!', 'See you soon!', 'Bis'],
  wir: ['We.', 'The speaker and others. The verb ends in -en: wir sind, wir gehen.', 'Wir sind hier.', 'We are here.', 'Wir'],
  du: ['You (one friend).', 'Speaks to one person you know well, a child or someone your own age. Strangers and officials get Sie.', 'Kommst du mit?', 'Are you coming along?', 'du'],
  zu: ['Too; to.', 'Before an adjective it means too much: zu groß, zu teuer.', 'Das ist zu teuer.', 'That is too expensive.', 'zu'],
  mir: ['(To) me.', 'Me after a verb or word that takes the dative: mir ist kalt, gib mir, hilf mir.', 'Mir ist kalt.', 'I am cold.', 'Mir'],
  dich: ['You (one friend, as object).', 'The du-form when you are the one something happens to: Ich sehe dich.', 'Ich sehe dich morgen.', 'I will see you tomorrow.', 'dich'],
  'wie-viel': ['How much; how many.', 'Wie viel asks about an amount, wie viele about things you can count.', 'Wie viel kostet das?', 'How much does that cost?', 'Wie viel'],
  warum: ['Why.', 'Asks for a reason. The answer often starts with weil.', 'Warum nicht?', 'Why not?', 'Warum'],
  dies: ['This; these.', 'Points at something near. Its ending follows the noun: dieser Bus, diese Tür, dieses Haus.', 'Dieser Platz ist frei.', 'This seat is free.', 'Dieser'],
  kein: ['No; not any.', 'Says no to a noun: kein Geld, keine Zeit. Other words take nicht.', 'Ich habe keine Zeit.', 'I have no time.', 'keine'],
  in: ['In; into.', 'A place or a span of time: in Flensburg, in einer Stunde.', 'Ich wohne in Flensburg.', 'I live in Flensburg.', 'in'],
  um: ['At (a clock time).', 'Um + a time: um acht, um halb drei.', 'Der Zug kommt um neun.', 'The train comes at nine.', 'um'],
  seit: ['Since; for (so long).', 'Says how long something has been true. German uses the present tense with it.', 'Ich lerne seit Montag Deutsch.', 'I have been learning German since Monday.', 'seit'],
  ohne: ['Without.', 'Leaves something out: ohne Zucker, ohne mich.', 'Einen Kaffee ohne Zucker, bitte.', 'A coffee without sugar, please.', 'ohne'],
  war: ['Was.', 'The past of ist: das war gut, es war schön.', 'Es war schön.', 'It was lovely.', 'war'],
  gegen: ['Against; around (a time).', 'Opposes something, or gives a rough time: gegen acht.', 'Ich komme gegen acht.', 'I will come at about eight.', 'gegen'],
  woher: ['Where from.', 'Asks about origin. The answer uses aus: Ich komme aus …', 'Woher kommt der Zug?', 'Where is the train coming from?', 'Woher'],
}

const fail = (message) => { throw new Error(message) }
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const canonical = (value) => Array.isArray(value)
  ? `[${value.map(canonical).join(',')}]`
  : value && typeof value === 'object'
    ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
    : JSON.stringify(value)
const letter = /[\p{L}\p{N}]/u

/** The only occurrence of `form` in `text` on word boundaries, or a failure naming the row. */
function spanOf(text, form, where) {
  const hits = []
  for (let at = text.indexOf(form); at >= 0; at = text.indexOf(form, at + 1)) {
    const before = text[at - 1], after = text[at + form.length]
    if ((!before || !letter.test(before)) && (!after || !letter.test(after))) hits.push(at)
  }
  if (hits.length !== 1) fail(`${where}: «${form}» occurs ${hits.length} times on word boundaries in «${text}»`)
  return { text: form, start: hits[0], end: hits[0] + form.length }
}

export function buildCatalog() {
  const words = JSON.parse(readFileSync(resolve(ROOT, 'src/data/words.de.json'), 'utf8'))
  const cycle = JSON.parse(readFileSync(resolve(ROOT, 'src/data/city1-board-cycle.de.json'), 'utf8'))
  const city1 = new Set(JSON.stringify(cycle).match(/"de:[^"]+"/g).map((id) => JSON.parse(id)))
  const byId = new Map(words.map((word) => [word.id, word]))
  const seen = new Set(), sentences = new Set(), uses = new Map()
  const stage = { city: 0, use: 'productive-target' }

  const review = REVIEW.map(([wordId, de, en, form, focusId, focusForm]) => {
    const word = byId.get(wordId) ?? fail(`${wordId} is not in words.de.json`)
    if (!city1.has(wordId)) fail(`${wordId} is not a City 1 card`)
    if (seen.has(wordId)) fail(`${wordId} has two review rows`)
    if (sentences.has(de)) fail(`«${de}» is used twice`)
    if (!ABOUT[focusId]) fail(`${wordId}: focus ${focusId} has no About note`)
    seen.add(wordId); sentences.add(de)
    uses.set(focusId, (uses.get(focusId) ?? 0) + 1)
    if (de !== de.trim() || en !== en.trim() || !de || !en) fail(`${wordId}: blank or untrimmed text`)
    if (de === word.exampleDa) fail(`${wordId}: review repeats the dictionary example`)
    const wordSpan = spanOf(de, form, wordId)
    const targetSpan = spanOf(de, focusForm, `${wordId} focus`)
    if (wordSpan.start < targetSpan.end && targetSpan.start < wordSpan.end) fail(`${wordId}: card and focus overlap`)
    const slug = slugForId(wordId) ?? fail(`${wordId}: no audio slug`)
    const row = {
      wordId, city: 0, sourceSha256: sha256(canonical(word)), version: VERSION,
      sentenceId: `city1:de:${slug}:review:sentence:v${VERSION}`,
      audioId: `city1:de:${slug}:review:audio:v${VERSION}`,
      text: { da: de, en }, wordSpan,
      targetId: `de-focus:${focusId}`, targetStage: stage, targetSpan, status: 'accepted',
    }
    return { ...row, approval: { artifact: APPROVAL, sha256: sha256(canonical(row)) } }
  })
  if (seen.size !== city1.size) fail(`${city1.size - seen.size} City 1 cards have no review row: ${[...city1].filter((id) => !seen.has(id)).join(', ')}`)
  for (const [focusId, count] of uses) if (count > 5) fail(`focus ${focusId} underlines ${count} cards (at most 5)`)

  const about = Object.entries(ABOUT).map(([focusId, [meaningEn, usageEn, exampleDe, exampleEn, form]]) => {
    if (!uses.has(focusId)) fail(`About note ${focusId} is used by no review row`)
    if (sentences.has(exampleDe)) fail(`About ${focusId}: its example repeats a review sentence`)
    const row = {
      targetId: `de-focus:${focusId}`, targetStage: stage, version: VERSION, meaningEn, usageEn,
      example: { da: exampleDe, en: exampleEn }, targetSpan: spanOf(exampleDe, form, `About ${focusId}`), status: 'accepted',
    }
    return { ...row, approval: { artifact: APPROVAL, sha256: sha256(canonical(row)) } }
  })
  return {
    json: {
      language: 'de', city: 0, version: VERSION,
      note: 'Generated by scripts/german-city1-review.mjs; edit that file, not this one. The text field is named da for the shared row shape; it holds German.',
      review, about,
    },
    uses,
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { json, uses } = buildCatalog()
    const text = `${JSON.stringify(json, null, 2)}\n`
    if (process.argv.includes('--write')) writeFileSync(TARGET, text)
    else if (process.argv.includes('--check')) {
      let current = ''
      try { current = readFileSync(TARGET, 'utf8').replace(/\r\n/g, '\n') } catch {}
      if (current !== text) fail('src/data/city1-review.de.json is stale: run node scripts/german-city1-review.mjs --write')
    }
    const top = [...uses].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, n]) => `${id} ${n}`).join(', ')
    console.log(`${json.review.length} review rows, ${json.about.length} About notes, ${uses.size} focus words (most used: ${top})`)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
