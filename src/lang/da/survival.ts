import type { CitySurvivalGuide, SurvivalExchange, SurvivalGuide } from '../survival'

type Line = readonly [speaker: 'traveller' | 'local', da: string, en: string]

const line = ([speaker, da, en]: Line) => ({ speaker, da, en })

const exchange = (
  targetActivityId: string,
  titleEn: string,
  phrases: readonly (readonly [da: string, en: string])[],
  dialogue: readonly [Line, Line, Line, Line],
): SurvivalExchange => ({
  targetActivityId,
  titleEn,
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
 * The compact, read-only Survival book. Every entry points to one accepted
 * T6 target rather than making a new lesson claim. BK2 renders the phrases
 * and four translated, individually revealable dialogue lines on one page.
 */
export const danishSurvivalGuide: SurvivalGuide = {
  cities: [
    city('sonderborg', 0, 'Arrive, meet Casey and repair a conversation', [
      exchange('sonderborg-situation-1', 'Say your name', [
        ['hej', 'hello'], ['Jeg hedder Mia. / Mit navn er Mia.', 'My name is Mia.'],
      ], [
        ['local', 'Hej! Velkommen til Sønderborg.', 'Hello! Welcome to Sønderborg.'],
        ['traveller', 'Hej! Jeg hedder Mia.', 'Hello! My name is Mia.'],
        ['local', 'Hyggeligt at møde dig, Mia.', 'Nice to meet you, Mia.'],
        ['traveller', 'I lige måde.', 'Nice to meet you too.'],
      ]),
      exchange('sonderborg-situation-2', 'Confirm and say goodbye', [
        ['Ja, jeg kommer fra Canada.', 'Yes, I come from Canada.'], ['Farvel!', 'Goodbye!'],
      ], [
        ['local', 'Kommer du fra Canada?', 'Do you come from Canada?'],
        ['traveller', 'Ja, jeg kommer fra Canada.', 'Yes, I come from Canada.'],
        ['local', 'Velkommen. Jeg skal videre nu.', 'Welcome. I have to go now.'],
        ['traveller', 'Farvel!', 'Goodbye!'],
      ]),
      exchange('sonderborg-situation-3', 'Ask for repetition', [
        ['Kan du sige det igen?', 'Can you say that again?'], ['lidt langsommere', 'a little more slowly'],
      ], [
        ['local', 'Øh, bussen kører fra spor tre om fem minutter.', 'Um, the bus leaves from platform three in five minutes.'],
        ['traveller', 'Kan du sige det igen?', 'Can you say that again?'],
        ['local', 'Ja. Fra spor tre om fem minutter.', 'Yes. From platform three in five minutes.'],
        ['traveller', 'Tak.', 'Thank you.'],
      ]),
      exchange('sonderborg-situation-4', 'Ask for immediate help', [
        ['Undskyld, kan du hjælpe mig?', 'Excuse me, can you help me?'], ['Hvor er toilettet?', 'Where is the toilet?'],
      ], [
        ['traveller', 'Undskyld, kan du hjælpe mig?', 'Excuse me, can you help me?'],
        ['local', 'Ja, selvfølgelig.', 'Yes, of course.'],
        ['traveller', 'Hvor er toilettet?', 'Where is the toilet?'],
        ['local', 'Det er lige der.', 'It is right there.'],
      ]),
    ]),
    city('ribe', 1, 'Meet a host or colleague', [
      exchange('ribe-situation-1', 'Meet your host', [
        ['Jeg bor i Odense.', 'I live in Odense.'], ['Hvor bor du?', 'Where do you live?'],
      ], [
        ['local', 'Hej, jeg hedder Anna. Hvor bor du?', 'Hello, my name is Anna. Where do you live?'],
        ['traveller', 'Jeg bor i Odense.', 'I live in Odense.'],
        ['local', 'Det er en fin by.', 'That is a nice city.'],
        ['traveller', 'Ja, det synes jeg også.', 'Yes, I think so too.'],
      ]),
      exchange('ribe-situation-2', 'Talk about work', [
        ['Jeg arbejder som lærer.', 'I work as a teacher.'], ['Hvad arbejder du med?', 'What do you do for work?'],
      ], [
        ['local', 'Hvad arbejder du med?', 'What do you do for work?'],
        ['traveller', 'Jeg arbejder som lærer.', 'I work as a teacher.'],
        ['local', 'Hvor arbejder du?', 'Where do you work?'],
        ['traveller', 'På en skole i Ribe.', 'At a school in Ribe.'],
      ]),
      exchange('ribe-situation-3', 'Spell your name', [
        ['Lea staves L-E-A.', 'Lea is spelled L-E-A.'], ['Mit navn er Lea.', 'My name is Lea.'],
      ], [
        ['local', 'Hvordan staver du dit navn?', 'How do you spell your name?'],
        ['traveller', 'Lea staves L-E-A.', 'Lea is spelled L-E-A.'],
        ['local', 'Tak, Lea.', 'Thank you, Lea.'],
        ['traveller', 'Selv tak.', 'You are welcome.'],
      ]),
      exchange('ribe-situation-4', 'Identify an owner', [
        ['Er det dine ting?', 'Are these your things?'], ['Det er mine ting.', 'They are my things.'],
      ], [
        ['local', 'Er det dine ting?', 'Are these your things?'],
        ['traveller', 'Ja, det er mine ting.', 'Yes, they are my things.'],
        ['local', 'Her er de.', 'Here they are.'],
        ['traveller', 'Tak.', 'Thank you.'],
      ]),
    ]),
    city('kolding', 2, 'Order food or make a small purchase', [
      exchange('kolding-situation-1', 'Order food and drink', [
        ['Jeg vil gerne have …', 'I would like …'], ['… tak.', '… please.'],
      ], [
        ['local', 'Hvad vil du gerne have?', 'What would you like?'],
        ['traveller', 'Jeg vil gerne have en sandwich og et glas vand, tak.', 'I would like a sandwich and a glass of water, please.'],
        ['local', 'Det kommer med det samme.', 'It will come right away.'],
        ['traveller', 'Tak.', 'Thank you.'],
      ]),
      exchange('kolding-situation-2', 'Ask the price', [
        ['Hvor meget koster brødet?', 'How much does the bread cost?'], ['Hvad koster …?', 'What does … cost?'],
      ], [
        ['local', 'Kan jeg hjælpe?', 'Can I help?'],
        ['traveller', 'Hvor meget koster brødet?', 'How much does the bread cost?'],
        ['local', 'Det koster tyve kroner.', 'It costs twenty kroner.'],
        ['traveller', 'Tak.', 'Thank you.'],
      ]),
      exchange('kolding-situation-3', 'Choose an alternative', [
        ['Jamen, så …', 'Well then …'], ['Så vil jeg gerne have kaffe, tak.', 'Then I would like coffee, please.'],
      ], [
        ['local', 'Jamen, vi har desværre ikke te. Vi har kaffe.', 'Well, unfortunately we do not have tea. We have coffee.'],
        ['traveller', 'Så vil jeg gerne have kaffe, tak.', 'Then I would like coffee, please.'],
        ['local', 'Selvfølgelig.', 'Of course.'],
        ['traveller', 'Tak.', 'Thank you.'],
      ]),
      exchange('kolding-situation-4', 'Ask for the bill', [
        ['én ting mere', 'one more thing'], ['Regningen, tak.', 'The bill, please.'],
      ], [
        ['local', 'Var der andet?', 'Was there anything else?'],
        ['traveller', 'Ja, én ting mere: regningen, tak.', 'Yes, one more thing: the bill, please.'],
        ['local', 'Ja, et øjeblik.', 'Yes, one moment.'],
        ['traveller', 'Tak.', 'Thank you.'],
      ]),
    ]),
    city('aarhus', 3, 'Plan a work or study day', [
      exchange('aarhus-situation-1', 'Ask when class begins', [
        ['Hvornår begynder undervisningen?', 'When does class begin?'], ['Hvornår starter …?', 'When does … start?'],
      ], [
        ['local', 'Undervisningen er i lokale tre.', 'Class is in room three.'],
        ['traveller', 'Hvornår begynder undervisningen?', 'When does class begin?'],
        ['local', 'Den begynder klokken ni.', 'It begins at nine.'],
        ['traveller', 'Tak.', 'Thank you.'],
      ]),
      exchange('aarhus-situation-2', 'Give a short yesterday-and-today update', [
        ['I går …', 'Yesterday …'], ['I dag har jeg …', 'Today I have …'],
      ], [
        ['local', 'Fortæl kort om i går og i dag.', 'Briefly tell me about yesterday and today.'],
        ['traveller', 'I går købte jeg brød og læste en bog.', 'Yesterday I bought bread and read a book.'],
        ['traveller', 'I dag har jeg lavet mad.', 'Today I have made food.'],
        ['local', 'Det lyder godt.', 'That sounds good.'],
      ]),
      exchange('aarhus-situation-3', 'Say when you are unavailable', [
        ['Jeg kan ikke mødes klokken ni.', 'I cannot meet at nine.'], ['Kan vi mødes …?', 'Can we meet …?'],
      ], [
        ['local', 'Øh, kan vi mødes klokken ni?', 'Um, can we meet at nine?'],
        ['traveller', 'Jeg kan ikke mødes klokken ni.', 'I cannot meet at nine.'],
        ['local', 'Hvornår kan du?', 'When can you?'],
        ['traveller', 'Klokken ti passer bedre.', 'Ten works better.'],
      ]),
      exchange('aarhus-situation-4', 'Offer a new time', [
        ['i hvert fald ikke klokken ni', 'at least not at nine'], ['Kan vi mødes i morgen klokken ti i stedet?', 'Can we meet tomorrow at ten instead?'],
      ], [
        ['local', 'Jeg kan i hvert fald ikke klokken ni. Kan du senere?', 'At any rate, I cannot do nine. Can you meet later?'],
        ['traveller', 'Kan vi mødes i morgen klokken ti i stedet?', 'Can we meet tomorrow at ten instead?'],
        ['local', 'Ja, det passer fint.', 'Yes, that works well.'],
        ['traveller', 'Godt, vi ses.', 'Great, see you.'],
      ]),
    ]),
    city('aalborg', 4, 'Find a platform, stop or entrance', [
      exchange('aalborg-situation-1', 'Find the track', [
        ['Hvor er spor to?', 'Where is platform two?'], ['Hvor ligger …?', 'Where is … located?'],
      ], [
        ['traveller', 'Undskyld, hvor er spor to?', 'Excuse me, where is platform two?'],
        ['local', 'Ligeud og til højre.', 'Straight ahead and to the right.'],
        ['traveller', 'Tak for hjælpen.', 'Thank you for the help.'],
        ['local', 'Selv tak.', 'You are welcome.'],
      ]),
      exchange('aalborg-situation-2', 'Buy a ticket', [
        ['En billet til Skagen, tak.', 'A ticket to Skagen, please.'], ['Jeg vil gerne have …', 'I would like …'],
      ], [
        ['local', 'Hvor skal du hen?', 'Where are you going?'],
        ['traveller', 'En billet til Skagen, tak.', 'A ticket to Skagen, please.'],
        ['local', 'En enkeltbillet?', 'A single ticket?'],
        ['traveller', 'Ja, tak.', 'Yes, please.'],
      ]),
      exchange('aalborg-situation-3', 'Confirm the map', [
        ['Skal jeg dreje til højre her?', 'Should I turn right here?'], ['ligeud', 'straight ahead'],
      ], [
        ['local', 'Gå ligeud til kirken.', 'Go straight ahead to the church.'],
        ['traveller', 'Skal jeg dreje til højre her?', 'Should I turn right here?'],
        ['local', 'Ja, til højre ved kirken.', 'Yes, right at the church.'],
        ['traveller', 'Tak.', 'Thank you.'],
      ]),
      exchange('aalborg-situation-4', 'Tell a fellow traveller about yesterday and today', [
        ['I går …', 'Yesterday …'], ['I dag har jeg …', 'Today I have …'],
      ], [
        ['local', 'Hvad lavede du i går?', 'What did you do yesterday?'],
        ['traveller', 'I går lavede jeg mad og købte brød.', 'Yesterday I made food and bought bread.'],
        ['local', 'Og i dag?', 'And today?'],
        ['traveller', 'I dag har jeg arbejdet hjemme.', 'Today I have worked at home.'],
      ]),
    ]),
    city('skagen', 5, 'Carry out a simple day trip', [
      exchange('skagen-situation-1', 'Describe the weather', [
        ['Det er koldt, men der er sol.', 'It is cold, but sunny.'], ['men', 'but'],
      ], [
        ['local', 'Hvordan er vejret i dag?', 'How is the weather today?'],
        ['traveller', 'Det er koldt, men der er sol.', 'It is cold, but sunny.'],
        ['local', 'Så tager vi en jakke med.', 'Then we will bring a jacket.'],
        ['traveller', 'God idé.', 'Good idea.'],
      ]),
      exchange('skagen-situation-2', 'Choose a meal', [
        ['Jeg vil gerne have suppe, fordi den er varm.', 'I would like soup because it is warm.'], ['fordi', 'because'],
      ], [
        ['local', 'Hvad vil du spise?', 'What would you like to eat?'],
        ['traveller', 'Jeg vil gerne have suppe, fordi den er varm.', 'I would like soup because it is warm.'],
        ['local', 'Det er et godt valg.', 'That is a good choice.'],
        ['traveller', 'Tak.', 'Thank you.'],
      ]),
      exchange('skagen-situation-3', 'Repair a route change', [
        ['Kan du sige den nye tid igen?', 'Can you say the new time again?'], ['den nye tid', 'the new time'],
      ], [
        ['local', 'Jamen, færgen sejler først klokken seksten.', 'Well, the ferry does not leave until four p.m.'],
        ['traveller', 'Kan du sige den nye tid igen?', 'Can you say the new time again?'],
        ['local', 'Ja, klokken seksten.', 'Yes, at four p.m.'],
        ['traveller', 'Tak.', 'Thank you.'],
      ]),
      exchange('skagen-situation-4', 'Describe the destination', [
        ['et smukt og roligt sted', 'a beautiful and quiet place'], ['I går … / I dag har jeg …', 'Yesterday … / Today I have …'],
      ], [
        ['local', 'Hvordan er det?', 'What is it like?'],
        ['traveller', 'Det er et smukt og roligt sted.', 'It is a beautiful and quiet place.'],
        ['local', 'Og hvad lavede du?', 'And what did you do?'],
        ['traveller', 'I går læste jeg en bog der. I dag har jeg købt kaffe på caféen.', 'Yesterday I read a book there. Today I have bought coffee at the café.'],
      ]),
    ]),
    city('odense', 6, 'Explain a disruption or ask for help', [
      exchange('odense-situation-1', 'Report a missed connection', [
        ['Toget var forsinket, så jeg missede bussen.', 'The train was late, so I missed the bus.'], ['så', 'so'],
      ], [
        ['local', 'Ej, hvad skete der?', 'Oh no, what happened?'],
        ['traveller', 'Toget var forsinket, så jeg missede bussen.', 'The train was late, so I missed the bus.'],
        ['local', 'Jeg kan hjælpe dig med en ny billet.', 'I can help you with a new ticket.'],
        ['traveller', 'Tak.', 'Thank you.'],
      ]),
      exchange('odense-situation-2', 'Describe a lost item', [
        ['Jeg har mistet to ting …', 'I have lost two things …'], ['sort, ligesom den her', 'black, like this one'],
      ], [
        ['local', 'Ej, var tasken sort, ligesom den her?', 'Oh, was the bag black, like this one?'],
        ['traveller', 'Ja. Jeg har mistet to ting: tasken og et kamera.', 'Yes. I have lost two things: the bag and a camera.'],
        ['local', 'Hvor så du dem sidst?', 'Where did you last see them?'],
        ['traveller', 'I bussen.', 'On the bus.'],
      ]),
      exchange('odense-situation-3', 'Explain a simple symptom', [
        ['Jeg har ondt i hovedet.', 'My head hurts.'], ['Jeg har haft feber siden i går.', 'I have had a fever since yesterday.'],
      ], [
        ['local', 'Hvad er der galt?', 'What is wrong?'],
        ['traveller', 'Jeg har ondt i hovedet.', 'My head hurts.'],
        ['local', 'Har du haft feber?', 'Have you had a fever?'],
        ['traveller', 'Ja, jeg har haft feber siden i går.', 'Yes, I have had a fever since yesterday.'],
      ]),
      exchange('odense-situation-4', 'Ask for the next step', [
        ['Hvad skal jeg gøre nu?', 'What should I do now?'], ['nu', 'now'],
      ], [
        ['local', 'Jeg kan godt se problemet.', 'I can see the problem.'],
        ['traveller', 'Hvad skal jeg gøre nu?', 'What should I do now?'],
        ['local', 'Gå til skranken ved siden af.', 'Go to the counter next door.'],
        ['traveller', 'Tak for hjælpen.', 'Thank you for the help.'],
      ]),
    ]),
    city('roskilde', 7, 'Arrange a visit or shared activity', [
      exchange('roskilde-situation-1', 'Make an invitation', [
        ['Har du lyst til at gå til koncert fredag?', 'Would you like to go to a concert on Friday?'], ['Skal vi …?', 'Shall we …?'],
      ], [
        ['local', 'Øh, har du planer på fredag?', 'Um, do you have plans on Friday?'],
        ['traveller', 'Har du lyst til at gå til koncert fredag?', 'Would you like to go to a concert on Friday?'],
        ['local', 'Ja, det vil jeg gerne.', 'Yes, I would like that.'],
        ['traveller', 'Godt.', 'Great.'],
      ]),
      exchange('roskilde-situation-2', 'Decline and suggest another day', [
        ['Jeg kan i hvert fald lørdag.', 'At least I can do Saturday.'], ['Passer det?', 'Does that work?'],
      ], [
        ['local', 'Kan du komme fredag?', 'Can you come on Friday?'],
        ['traveller', 'Det kan jeg desværre ikke på fredag.', 'Unfortunately I cannot on Friday.'],
        ['traveller', 'Jeg kan i hvert fald lørdag. Passer det?', 'At least I can do Saturday. Does that work?'],
        ['local', 'Ja, lørdag passer fint.', 'Yes, Saturday works well.'],
      ]),
      exchange('roskilde-situation-3', 'Clarify obligation and permission', [
        ['Jeg skal bestille, men jeg må gerne betale senere.', 'I must book, but I may pay later.'], ['skal / må gerne', 'must / may'],
      ], [
        ['local', 'Du skal bestille en billet.', 'You must book a ticket.'],
        ['traveller', 'Jeg skal bestille, men jeg må gerne betale senere?', 'I must book, but may I pay later?'],
        ['local', 'Ja, det må du gerne.', 'Yes, you may.'],
        ['traveller', 'Tak.', 'Thank you.'],
      ]),
      exchange('roskilde-situation-4', 'Compare and confirm the final plan', [
        ['Søndag klokken elleve passer bedre.', 'Sunday at eleven works better.'], ['Vi mødes på stationen.', 'We will meet at the station.'],
      ], [
        ['local', 'Lørdag klokken seks eller søndag klokken elleve?', 'Saturday at six or Sunday at eleven?'],
        ['traveller', 'Søndag klokken elleve passer bedre.', 'Sunday at eleven works better.'],
        ['traveller', 'Vi mødes på stationen.', 'We will meet at the station.'],
        ['local', 'Aftale.', 'Agreed.'],
      ]),
    ]),
    city('kobenhavn', 8, 'Navigate a service problem and make a choice', [
      exchange('kobenhavn-situation-1', 'Change an appointment', [
        ['Jeg vil gerne ændre min aftale.', 'I would like to change my appointment.'], ['fordi tirsdag ikke passer', 'because Tuesday does not work'],
      ], [
        ['local', 'Hvad kan jeg hjælpe med?', 'What can I help you with?'],
        ['traveller', 'Jeg vil gerne ændre min aftale, fordi tirsdag ikke passer.', 'I would like to change my appointment because Tuesday does not work.'],
        ['local', 'Hvilken dag passer bedre?', 'Which day works better?'],
        ['traveller', 'Torsdag passer bedre.', 'Thursday works better.'],
      ]),
      exchange('kobenhavn-situation-2', 'Solve a digital login problem', [
        ['ligesom i går', 'like yesterday'], ['Hvad skal jeg gøre?', 'What should I do?'],
      ], [
        ['local', 'Er problemet ligesom i går?', 'Is the problem like yesterday?'],
        ['traveller', 'Jeg kan ikke logge ind.', 'I cannot log in.'],
        ['traveller', 'Hvad skal jeg gøre?', 'What should I do?'],
        ['local', 'Prøv at nulstille din adgangskode.', 'Try resetting your password.'],
      ]),
      exchange('kobenhavn-situation-3', 'Report a housing problem', [
        ['Vinduet er i stykker, så værelset er koldt.', 'The window is broken, so the room is cold.'], ['i stykker', 'broken'],
      ], [
        ['local', 'Hvad er problemet i lejligheden?', 'What is the problem in the flat?'],
        ['traveller', 'Vinduet er i stykker, så værelset er koldt.', 'The window is broken, so the room is cold.'],
        ['local', 'Jeg sender en vicevært.', 'I will send a caretaker.'],
        ['traveller', 'Tak.', 'Thank you.'],
      ]),
      exchange('kobenhavn-situation-4', 'Clarify a cancellation condition', [
        ['Skal jeg betale, hvis jeg aflyser i dag?', 'Do I have to pay if I cancel today?'], ['hvis', 'if'],
      ], [
        ['local', 'Der er et gebyr ved sen aflysning.', 'There is a fee for late cancellation.'],
        ['traveller', 'Skal jeg betale, hvis jeg aflyser i dag?', 'Do I have to pay if I cancel today?'],
        ['local', 'Nej, ikke hvis du aflyser i dag.', 'No, not if you cancel today.'],
        ['traveller', 'Så aflyser jeg nu.', 'Then I will cancel now.'],
      ]),
    ]),
  ],
}
