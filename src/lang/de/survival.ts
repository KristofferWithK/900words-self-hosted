import type { CitySurvivalGuide, SurvivalExchange, SurvivalGuide } from '../survival'

type Line = readonly [speaker: 'traveller' | 'local', de: string, en: string]

const line = ([speaker, da, en]: Line) => ({ speaker, da, en })

const exchange = (
  targetActivityId: string,
  titleEn: string,
  register: 'du' | 'Sie',
  phrases: readonly (readonly [de: string, en: string])[],
  dialogue: readonly [Line, Line, Line, Line],
): SurvivalExchange => ({
  targetActivityId,
  titleEn,
  register,
  phrases: phrases.map(([da, en]) => ({ da, en })),
  dialogue: [line(dialogue[0]), line(dialogue[1]), line(dialogue[2]), line(dialogue[3])],
})

const city = (
  cityId: string,
  cityIndex: number,
  themeEn: string,
  exchanges: CitySurvivalGuide['exchanges'],
): CitySurvivalGuide => ({ cityId, cityIndex, themeEn, exchanges })

/**
 * The German Survival book: nine themes, four exchanges each, one phone page
 * apiece.
 *
 * ── TWO DIFFERENCES FROM DANISH, BOTH DELIBERATE ───────────────────────────
 *
 * **Every page declares du or Sie.** Danish needs no such field: contemporary
 * `du` is the productive voice of its whole accepted course. German's scenes
 * split — a counter, an office, a stranger in the street and a landlord take
 * `Sie`; a host, a classmate and a friend take `du` — and getting that wrong is
 * the error a German course is likeliest to ship at volume. The setting has to
 * make the choice plausible, so Lübeck's reception desk is `Sie` while the same
 * city's host is `du`, and Dresden's booking desk is `Sie` inside an otherwise
 * `du` city.
 *
 * **`targetActivityId` is this page's own id, not a pointer.** In Danish it
 * names an accepted T6 scored activity that the Survival page re-presents; the
 * Danish test asserts the two sets match. German has no scored curriculum — its
 * `postWrapQueue` is deliberately empty (`src/lang/de/curriculum.ts`) — so
 * these ids are stable page keys and the audio-line keys they will become. They
 * make no claim that a scored activity exists behind them.
 *
 * Chunks precede their analysis here as they do in Danish: `Können Sie mir
 * helfen?` is on Flensburg's fourth page although the dative arrives in
 * Nürnberg, and `kann` is used in Bremen although the modals are Dresden's.
 * The chapters name these as chunks rather than pretending the form is taught.
 *
 * Unreviewed, like the rest of the German pack: the owner is the named native
 * verifier (`DECISIONS.md`). Nothing here has audio, and the reader greys its
 * Listen control out until a `de-DE` bake exists.
 */
export const germanSurvivalGuide: SurvivalGuide = {
  cities: [
    city('flensburg', 0, 'Arrive, greet and repair a conversation', [
      exchange('flensburg-situation-1', 'Say your name', 'Sie', [
        ['Guten Tag.', 'Hello.'], ['Ich heiße Mia.', 'My name is Mia.'],
      ], [
        ['local', 'Guten Tag! Willkommen in Flensburg.', 'Hello! Welcome to Flensburg.'],
        ['traveller', 'Guten Tag! Ich heiße Mia.', 'Hello! My name is Mia.'],
        ['local', 'Freut mich, Frau Berg.', 'Pleased to meet you, Ms Berg.'],
        ['traveller', 'Mich auch.', 'You too.'],
      ]),
      exchange('flensburg-situation-2', 'Say where you are from and say goodbye', 'Sie', [
        ['Ich komme aus Kanada.', 'I come from Canada.'], ['Auf Wiedersehen!', 'Goodbye!'],
      ], [
        ['local', 'Kommen Sie aus Kanada?', 'Do you come from Canada?'],
        ['traveller', 'Ja, ich komme aus Kanada.', 'Yes, I come from Canada.'],
        ['local', 'Schön. Ich muss jetzt weiter.', 'Nice. I have to get on now.'],
        ['traveller', 'Auf Wiedersehen!', 'Goodbye!'],
      ]),
      exchange('flensburg-situation-3', 'Ask for repetition', 'Sie', [
        ['Können Sie das bitte wiederholen?', 'Can you repeat that, please?'], ['Langsamer, bitte.', 'More slowly, please.'],
      ], [
        ['local', 'Der Bus fährt in fünf Minuten von Steig drei.', 'The bus leaves from bay three in five minutes.'],
        ['traveller', 'Können Sie das bitte wiederholen?', 'Can you repeat that, please?'],
        ['local', 'Ja. Steig drei, in fünf Minuten.', 'Yes. Bay three, in five minutes.'],
        ['traveller', 'Danke.', 'Thank you.'],
      ]),
      exchange('flensburg-situation-4', 'Ask for immediate help', 'Sie', [
        ['Entschuldigung, können Sie mir helfen?', 'Excuse me, can you help me?'], ['Wo ist die Toilette?', 'Where is the toilet?'],
      ], [
        ['traveller', 'Entschuldigung, können Sie mir helfen?', 'Excuse me, can you help me?'],
        ['local', 'Ja, natürlich.', 'Yes, of course.'],
        ['traveller', 'Wo ist die Toilette?', 'Where is the toilet?'],
        ['local', 'Gleich da drüben.', 'Just over there.'],
      ]),
    ]),
    city('luebeck', 1, 'Meet a host or a colleague', [
      exchange('luebeck-situation-1', 'Meet your host', 'du', [
        ['Ich wohne in Odense.', 'I live in Odense.'], ['Wo wohnst du?', 'Where do you live?'],
      ], [
        ['local', 'Hallo, ich heiße Anna. Wo wohnst du?', 'Hello, my name is Anna. Where do you live?'],
        ['traveller', 'Ich wohne in Odense.', 'I live in Odense.'],
        ['local', 'Das ist eine schöne Stadt.', 'That is a lovely city.'],
        ['traveller', 'Ja, das finde ich auch.', 'Yes, I think so too.'],
      ]),
      exchange('luebeck-situation-2', 'Talk about work', 'du', [
        ['Ich arbeite als Lehrerin.', 'I work as a teacher.'], ['Was machst du beruflich?', 'What do you do for work?'],
      ], [
        ['local', 'Was machst du beruflich?', 'What do you do for work?'],
        ['traveller', 'Ich arbeite als Lehrerin.', 'I work as a teacher.'],
        ['local', 'Und wo arbeitest du?', 'And where do you work?'],
        ['traveller', 'An einer Schule hier in Lübeck.', 'At a school here in Lübeck.'],
      ]),
      exchange('luebeck-situation-3', 'Spell your name', 'Sie', [
        ['Mein Name ist Lea Berg.', 'My name is Lea Berg.'], ['B wie Berta, E, R, G.', 'B as in Berta, E, R, G.'],
      ], [
        ['local', 'Wie schreibt man Ihren Namen?', 'How do you spell your name?'],
        ['traveller', 'Berg: B wie Berta, E, R, G.', 'Berg: B as in Berta, E, R, G.'],
        ['local', 'Danke, Frau Berg.', 'Thank you, Ms Berg.'],
        ['traveller', 'Gern.', 'You are welcome.'],
      ]),
      exchange('luebeck-situation-4', 'Say what belongs to whom', 'du', [
        ['Das ist meine Tasche.', 'That is my bag.'], ['Ist das dein Ticket?', 'Is that your ticket?'],
      ], [
        ['local', 'Ist das dein Ticket?', 'Is that your ticket?'],
        ['traveller', 'Nein, das ist nicht mein Ticket.', 'No, that is not my ticket.'],
        ['traveller', 'Aber das ist meine Tasche.', 'But that is my bag.'],
        ['local', 'Hier, bitte.', 'Here you are.'],
      ]),
    ]),
    city('hamburg', 2, 'Order food or make a small purchase', [
      exchange('hamburg-situation-1', 'Order food and drink', 'Sie', [
        ['Ich möchte …', 'I would like …'], ['… bitte.', '… please.'],
      ], [
        ['local', 'Was möchten Sie?', 'What would you like?'],
        ['traveller', 'Ich möchte einen Kaffee und ein Wasser, bitte.', 'I would like a coffee and a water, please.'],
        ['local', 'Kommt sofort.', 'Coming right up.'],
        ['traveller', 'Danke.', 'Thank you.'],
      ]),
      exchange('hamburg-situation-2', 'Ask the price', 'Sie', [
        ['Wie viel kostet das Brot?', 'How much does the bread cost?'], ['Was kostet …?', 'What does … cost?'],
      ], [
        ['local', 'Kann ich Ihnen helfen?', 'Can I help you?'],
        ['traveller', 'Wie viel kostet das Brot?', 'How much does the bread cost?'],
        ['local', 'Das kostet drei Euro zwanzig.', 'That costs three euros twenty.'],
        ['traveller', 'Danke.', 'Thank you.'],
      ]),
      exchange('hamburg-situation-3', 'Choose an alternative', 'Sie', [
        ['Wir haben leider keinen Tee.', 'Unfortunately we have no tea.'], ['Dann nehme ich einen Kaffee.', 'Then I will take a coffee.'],
      ], [
        ['local', 'Wir haben leider keinen Tee. Wir haben Kaffee.', 'Unfortunately we have no tea. We have coffee.'],
        ['traveller', 'Dann nehme ich einen Kaffee, bitte.', 'Then I will take a coffee, please.'],
        ['local', 'Natürlich.', 'Of course.'],
        ['traveller', 'Danke.', 'Thank you.'],
      ]),
      exchange('hamburg-situation-4', 'Ask for the bill', 'Sie', [
        ['Zahlen, bitte.', 'The bill, please.'], ['noch etwas', 'one more thing'],
      ], [
        ['local', 'Darf es noch etwas sein?', 'Would you like anything else?'],
        ['traveller', 'Nein, danke. Zahlen, bitte.', 'No, thank you. The bill, please.'],
        ['local', 'Zusammen oder getrennt?', 'Together or separately?'],
        ['traveller', 'Zusammen, bitte.', 'Together, please.'],
      ]),
    ]),
    city('bremen', 3, 'Organise a work or study day', [
      exchange('bremen-situation-1', 'Ask when the course starts', 'Sie', [
        ['Wann fängt der Kurs an?', 'When does the course start?'], ['Wann beginnt …?', 'When does … begin?'],
      ], [
        ['local', 'Der Kurs ist in Raum drei.', 'The course is in room three.'],
        ['traveller', 'Wann fängt der Kurs an?', 'When does the course start?'],
        ['local', 'Er fängt um neun an.', 'It starts at nine.'],
        ['traveller', 'Danke.', 'Thank you.'],
      ]),
      exchange('bremen-situation-2', 'Say what your morning looks like', 'du', [
        ['Ich stehe um sieben auf.', 'I get up at seven.'], ['Um acht fange ich an.', 'I start at eight.'],
      ], [
        ['local', 'Wann stehst du auf?', 'When do you get up?'],
        ['traveller', 'Ich stehe um sieben auf.', 'I get up at seven.'],
        ['local', 'Und wann fängst du an?', 'And when do you start?'],
        ['traveller', 'Um acht fange ich an.', 'At eight I start.'],
      ]),
      exchange('bremen-situation-3', 'Say when you are not free', 'du', [
        ['Um neun geht es nicht.', 'Nine does not work.'], ['Können wir uns … treffen?', 'Can we meet …?'],
      ], [
        ['local', 'Können wir uns um neun treffen?', 'Can we meet at nine?'],
        ['traveller', 'Um neun geht es leider nicht.', 'Unfortunately nine does not work.'],
        ['local', 'Wann kannst du denn?', 'When can you, then?'],
        ['traveller', 'Um zehn passt besser.', 'Ten suits better.'],
      ]),
      exchange('bremen-situation-4', 'Offer another time', 'du', [
        ['Geht es um zehn?', 'Does ten work?'], ['Morgen um zehn treffen wir uns.', 'Tomorrow at ten we will meet.'],
      ], [
        ['local', 'Heute schaffe ich es nicht mehr.', 'I will not manage it today.'],
        ['traveller', 'Geht es morgen um zehn?', 'Does tomorrow at ten work?'],
        ['local', 'Ja, das passt gut.', 'Yes, that suits well.'],
        ['traveller', 'Gut, bis morgen!', 'Good, see you tomorrow!'],
      ]),
    ]),
    city('koeln', 4, 'Find a platform, a stop or an entrance', [
      exchange('koeln-situation-1', 'Find the platform', 'Sie', [
        ['Wo ist Gleis drei?', 'Where is platform three?'], ['Entschuldigung, …', 'Excuse me, …'],
      ], [
        ['traveller', 'Entschuldigung, wo ist Gleis drei?', 'Excuse me, where is platform three?'],
        ['local', 'Geradeaus und dann rechts.', 'Straight ahead and then right.'],
        ['traveller', 'Vielen Dank für Ihre Hilfe!', 'Thank you very much for your help!'],
        ['local', 'Gern geschehen.', 'You are welcome.'],
      ]),
      exchange('koeln-situation-2', 'Buy a ticket', 'Sie', [
        ['Eine Fahrkarte nach Frankfurt, bitte.', 'A ticket to Frankfurt, please.'], ['einfach · hin und zurück', 'single · return'],
      ], [
        ['local', 'Wohin möchten Sie?', 'Where would you like to go?'],
        ['traveller', 'Eine Fahrkarte nach Frankfurt, bitte.', 'A ticket to Frankfurt, please.'],
        ['local', 'Einfach oder hin und zurück?', 'Single or return?'],
        ['traveller', 'Einfach, bitte.', 'Single, please.'],
      ]),
      exchange('koeln-situation-3', 'Confirm the way', 'Sie', [
        ['Muss ich hier rechts gehen?', 'Do I have to go right here?'], ['geradeaus', 'straight ahead'],
      ], [
        ['local', 'Gehen Sie geradeaus bis zum Dom.', 'Go straight ahead as far as the cathedral.'],
        ['traveller', 'Muss ich hier rechts gehen?', 'Do I have to go right here?'],
        ['local', 'Ja, am Dom rechts.', 'Yes, right at the cathedral.'],
        ['traveller', 'Danke.', 'Thank you.'],
      ]),
      exchange('koeln-situation-4', 'Ask where a bus goes', 'Sie', [
        ['Wohin fährt dieser Bus?', 'Where does this bus go?'], ['Steigen Sie am Dom aus.', 'Get off at the cathedral.'],
      ], [
        ['traveller', 'Entschuldigung, wohin fährt dieser Bus?', 'Excuse me, where does this bus go?'],
        ['local', 'Zum Hauptbahnhof.', 'To the main station.'],
        ['traveller', 'Und wo muss ich aussteigen?', 'And where do I have to get off?'],
        ['local', 'Steigen Sie am Dom aus.', 'Get off at the cathedral.'],
      ]),
    ]),
    city('frankfurt', 5, 'Carry out a simple day trip', [
      exchange('frankfurt-situation-1', 'Describe the weather', 'du', [
        ['Es ist kalt, aber die Sonne scheint.', 'It is cold, but the sun is shining.'], ['aber', 'but'],
      ], [
        ['local', 'Wie ist das Wetter heute?', 'What is the weather like today?'],
        ['traveller', 'Es ist kalt, aber die Sonne scheint.', 'It is cold, but the sun is shining.'],
        ['local', 'Dann nehmen wir eine Jacke mit.', 'Then we will bring a jacket.'],
        ['traveller', 'Gute Idee.', 'Good idea.'],
      ]),
      exchange('frankfurt-situation-2', 'Choose a meal and give a reason', 'Sie', [
        ['Ich nehme die Suppe, weil sie warm ist.', 'I will take the soup because it is warm.'], ['weil', 'because'],
      ], [
        ['local', 'Was möchten Sie essen?', 'What would you like to eat?'],
        ['traveller', 'Ich nehme die Suppe, weil sie warm ist.', 'I will take the soup because it is warm.'],
        ['local', 'Eine gute Wahl.', 'A good choice.'],
        ['traveller', 'Danke.', 'Thank you.'],
      ]),
      exchange('frankfurt-situation-3', 'Repair a changed time', 'Sie', [
        ['Können Sie die neue Zeit noch einmal sagen?', 'Can you say the new time again?'], ['die neue Zeit', 'the new time'],
      ], [
        ['local', 'Das Schiff fährt erst um sechzehn Uhr.', 'The boat does not leave until four p.m.'],
        ['traveller', 'Können Sie die neue Zeit noch einmal sagen?', 'Can you say the new time again?'],
        ['local', 'Ja, um sechzehn Uhr.', 'Yes, at four p.m.'],
        ['traveller', 'Danke.', 'Thank you.'],
      ]),
      exchange('frankfurt-situation-4', 'Describe the place', 'du', [
        ['Es ist schön und ruhig.', 'It is beautiful and quiet.'], ['und · aber', 'and · but'],
      ], [
        ['local', 'Wie ist es da?', 'What is it like there?'],
        ['traveller', 'Es ist schön und ruhig.', 'It is beautiful and quiet.'],
        ['local', 'Und ist es teuer?', 'And is it expensive?'],
        ['traveller', 'Der Kaffee ist teuer, aber das Essen ist billig.', 'The coffee is expensive, but the food is cheap.'],
      ]),
    ]),
    city('nuernberg', 6, 'Explain a disruption or ask for help', [
      exchange('nuernberg-situation-1', 'Report a missed connection', 'Sie', [
        ['Der Zug hatte Verspätung.', 'The train was delayed.'], ['deshalb', 'so · therefore'],
      ], [
        ['local', 'Oh, was ist passiert?', 'Oh, what happened?'],
        ['traveller', 'Der Zug hatte Verspätung, deshalb habe ich den Bus verpasst.', 'The train was delayed, so I missed the bus.'],
        ['local', 'Ich kann Ihnen ein neues Ticket geben.', 'I can give you a new ticket.'],
        ['traveller', 'Das ist sehr nett, danke.', 'That is very kind, thank you.'],
      ]),
      exchange('nuernberg-situation-2', 'Describe a lost item', 'Sie', [
        ['Ich habe meine Tasche verloren.', 'I have lost my bag.'], ['schwarz, so wie die hier', 'black, like this one'],
      ], [
        ['local', 'War die Tasche schwarz, so wie die hier?', 'Was the bag black, like this one?'],
        ['traveller', 'Ja. Ich habe meine Tasche und eine Kamera verloren.', 'Yes. I have lost my bag and a camera.'],
        ['local', 'Wo haben Sie die Sachen zuletzt gesehen?', 'Where did you last see them?'],
        ['traveller', 'Im Bus.', 'On the bus.'],
      ]),
      exchange('nuernberg-situation-3', 'Explain a simple symptom', 'Sie', [
        ['Ich habe Kopfschmerzen.', 'I have a headache.'], ['seit gestern', 'since yesterday'],
      ], [
        ['local', 'Was fehlt Ihnen?', 'What is wrong?'],
        ['traveller', 'Ich habe Kopfschmerzen.', 'I have a headache.'],
        ['local', 'Hatten Sie Fieber?', 'Have you had a fever?'],
        ['traveller', 'Ja, seit gestern habe ich Fieber.', 'Yes, I have had a fever since yesterday.'],
      ]),
      exchange('nuernberg-situation-4', 'Ask for the next step', 'Sie', [
        ['Was soll ich jetzt machen?', 'What should I do now?'], ['jetzt', 'now'],
      ], [
        ['local', 'Ich sehe das Problem.', 'I can see the problem.'],
        ['traveller', 'Was soll ich jetzt machen?', 'What should I do now?'],
        ['local', 'Gehen Sie bitte zum Schalter nebenan.', 'Please go to the counter next door.'],
        ['traveller', 'Vielen Dank für Ihre Hilfe.', 'Thank you very much for your help.'],
      ]),
    ]),
    city('dresden', 7, 'Arrange a visit or a shared activity', [
      exchange('dresden-situation-1', 'Make an invitation', 'du', [
        ['Hast du Lust, ins Konzert zu gehen?', 'Would you like to go to a concert?'], ['Sollen wir …?', 'Shall we …?'],
      ], [
        ['local', 'Hast du am Freitag schon etwas vor?', 'Do you have plans on Friday?'],
        ['traveller', 'Hast du Lust, ins Konzert zu gehen?', 'Would you like to go to a concert?'],
        ['local', 'Ja, sehr gern!', 'Yes, very gladly!'],
        ['traveller', 'Schön.', 'Lovely.'],
      ]),
      exchange('dresden-situation-2', 'Decline and suggest another day', 'du', [
        ['Am Freitag kann ich leider nicht.', 'Unfortunately I cannot on Friday.'], ['Geht Samstag?', 'Does Saturday work?'],
      ], [
        ['local', 'Kannst du am Freitag kommen?', 'Can you come on Friday?'],
        ['traveller', 'Am Freitag kann ich leider nicht.', 'Unfortunately I cannot on Friday.'],
        ['traveller', 'Geht Samstag auch?', 'Does Saturday work too?'],
        ['local', 'Ja, Samstag passt gut.', 'Yes, Saturday suits well.'],
      ]),
      exchange('dresden-situation-3', 'Clarify obligation and permission', 'Sie', [
        ['Muss ich heute buchen?', 'Do I have to book today?'], ['Darf ich später bezahlen?', 'May I pay later?'],
      ], [
        ['local', 'Sie müssen die Karte vorher buchen.', 'You have to book the ticket in advance.'],
        ['traveller', 'Muss ich heute buchen? Und darf ich später bezahlen?', 'Do I have to book today? And may I pay later?'],
        ['local', 'Buchen ja, bezahlen können Sie später.', 'Book yes, you can pay later.'],
        ['traveller', 'Gut, danke.', 'Good, thank you.'],
      ]),
      exchange('dresden-situation-4', 'Confirm the final plan', 'du', [
        ['Sonntag um elf passt mir besser.', 'Sunday at eleven suits me better.'], ['Wir treffen uns am Bahnhof.', 'We will meet at the station.'],
      ], [
        ['local', 'Samstag um sechs oder Sonntag um elf?', 'Saturday at six or Sunday at eleven?'],
        ['traveller', 'Sonntag um elf passt mir besser.', 'Sunday at eleven suits me better.'],
        ['traveller', 'Wir treffen uns am Bahnhof.', 'We will meet at the station.'],
        ['local', 'Abgemacht.', 'Agreed.'],
      ]),
    ]),
    city('berlin', 8, 'Navigate a service problem and make a choice', [
      exchange('berlin-situation-1', 'Change an appointment', 'Sie', [
        ['Ich möchte meinen Termin ändern.', 'I would like to change my appointment.'], ['weil der Dienstag nicht passt', 'because Tuesday does not work'],
      ], [
        ['local', 'Was kann ich für Sie tun?', 'What can I do for you?'],
        ['traveller', 'Ich möchte meinen Termin ändern, weil der Dienstag nicht passt.', 'I would like to change my appointment because Tuesday does not work.'],
        ['local', 'Welcher Tag passt Ihnen besser?', 'Which day suits you better?'],
        ['traveller', 'Der Donnerstag passt besser.', 'Thursday suits better.'],
      ]),
      exchange('berlin-situation-2', 'Solve a login problem', 'Sie', [
        ['Ich kann mich nicht anmelden.', 'I cannot log in.'], ['Was soll ich machen?', 'What should I do?'],
      ], [
        ['local', 'Ist das Problem wie gestern?', 'Is the problem the same as yesterday?'],
        ['traveller', 'Ja. Ich kann mich nicht anmelden.', 'Yes. I cannot log in.'],
        ['traveller', 'Was soll ich machen?', 'What should I do?'],
        ['local', 'Setzen Sie bitte Ihr Passwort zurück.', 'Please reset your password.'],
      ]),
      exchange('berlin-situation-3', 'Report a housing problem', 'Sie', [
        ['Das Fenster ist kaputt.', 'The window is broken.'], ['deshalb ist das Zimmer kalt', 'so the room is cold'],
      ], [
        ['local', 'Was ist das Problem in der Wohnung?', 'What is the problem in the flat?'],
        ['traveller', 'Das Fenster ist kaputt, deshalb ist das Zimmer kalt.', 'The window is broken, so the room is cold.'],
        ['local', 'Ich schicke einen Handwerker.', 'I will send a repairman.'],
        ['traveller', 'Danke.', 'Thank you.'],
      ]),
      exchange('berlin-situation-4', 'Ask about a cancellation condition', 'Sie', [
        ['Muss ich bezahlen?', 'Do I have to pay?'], ['wenn ich heute absage', 'if I cancel today'],
      ], [
        ['local', 'Bei später Absage gibt es eine Gebühr.', 'There is a fee for late cancellation.'],
        ['traveller', 'Muss ich bezahlen, wenn ich heute absage?', 'Do I have to pay if I cancel today?'],
        ['local', 'Nein, heute nicht.', 'No, not today.'],
        ['traveller', 'Dann sage ich jetzt ab.', 'Then I will cancel now.'],
      ]),
    ]),
  ],
}
