import type { Catalogue } from '../en'

/**
 * 简体中文。用“你”，不用“您”。Casey 是“她”。标点用全角，数字用阿拉伯数字。
 *
 * 名词不随数量变化，所以复数条目是一个忽略数量的函数；只有数字本身被读出来
 * 的地方才用到它。«» 里的丹麦语词保持丹麦语，前后不加空格；裸露的拉丁字母和
 * 数字（Casey、3、Wi-Fi）与中文之间留一个半角空格。
 *
 * 两个词要分清：“装进行李箱”（简写“装箱”）是打包回合里把一张卡片输入进去的
 * 动作；“打包”是一个词经打包回合后永久留下的状态。英文里也是 pack 和 wrap 两个词。
 */
export const game: Catalogue['game'] = {
  legacyRetiredTitle: "你的进度已保留",
  legacyRetiredBody: "更新后，旧版的一轮游戏无法继续。已保存的学习进度和明信片仍然保留。请继续下一块尚未完成的词板。",
  phaseGiveClue: '给 Casey 一条提示',
  phaseCaseyGuessing: 'Casey 正在猜',
  phaseCaseyClue: 'Casey 正在想提示',
  phaseYourGuess: '轮到你猜了',
  phaseLastChance: '最后机会：提示用完了',
  phaseRoundOver: '回合结束',
  phasePackTheBoard: '把词板装箱',

  announceCaseyGuess: (word, result) => `Casey 猜了 ${word}：${result}。`,
  resultCorrect: '正确',
  resultNeutral: '中立牌',
  announceCaseyThinking: 'Casey 正在思考。',

  skip: '跳过',
  homeAria: '主页',
  dealNewWordsAria: '重新发词',
  hideTranslationsAria: '隐藏翻译',
  showTranslationsAria: '显示全部翻译。每个还没解开的词都算查过词',

  errorRetry: '重试',
  errorCaseySettings: 'Casey 设置',
  practiceNote: '这是实验性无代理原型。它不是 Casey，也不是正常游戏。',

  studyTitle: '学习词板',
  studyHint: '现在所有翻译都显示着。开始后就会隐藏，点一下可以查。',
  studyStart: '开始回合',

  cardYourTarget: '，你的目标',
  cardFound: '，已找到',
  cardMissedKey: '，Casey 的词之一，未找到',
  cardNeutralBoth: '，对双方都是中立牌',
  cardNeutralPlayer: '，在你的提示下是中立牌',
  cardNeutralCasey: '，在 Casey 的提示下是中立牌',
  cardUnpacked: '，未装进行李箱',
  cardTranslationRevealed: '，已显示翻译',
  cardNotYetPacked: (language) => `，还没装进行李箱。点击输入${language}`,
  cardNotYoursToWrap: '，还不能打包',
  cardTapToHear: '。点击可收听',
  lookUpAria: (word) => `查词：${word}`,

  cluePlaceholder: '你的提示',
  clueFieldAria: (language) => `你的提示，一个${language}词`,
  fewerWordsAria: '减少词数',
  moreWordsAria: '增加词数',
  wordCountAria: (n) => `${n} 个词`,
  giveClue: '给出提示',
  giveItAnyway: '直接给出',
  askingCasey: '正在问 Casey…',
  firstClueHint: (language) => `一个${language}词。想不出来？旁边的词典能帮你翻译。`,
  tutorialClueHint: '我会按丹麦语理解提示。不确定？试试看。词典可以帮忙。',
  wrapPlayerKeyHint: '你的绿色边框回来了。这是你的秘密底牌。Casey 看不到。',
  looksEnglishFull: (word, language) =>
    `«${word}»看起来像某个卡片词的意思。点它可以看${language}怎么说，或者直接给出，让 Casey 来判。`,
  looksEnglishShort: '看起来像卡片词的意思。点它，或者直接给出',

  caseysClueLabel: 'Casey 的提示',
  lookUpInDictionaryAria: (word) => `在词典里查«${word}»`,
  guessesLeft: (n) => `还能猜 ${n} 次`,
  guessWord: (word) => `猜«${word}»`,
  cancel: '取消',
  stopKeepWhatWeHave: '停下，保留我们已有的',
  guessPrompt: '点一个你觉得 Casey 指的词。',
  firstGuessHint: '现在按 Casey 的底牌算。点一个她的提示指向的词。',
  wrapCaseyKeyHint: 'Casey 的底牌是秘密。猜猜她的提示指向哪张。现在算的是她的绿色卡片。',
  tutorialLookupHint: '点词旁边的 ⓘ，就能查它的翻译。',

  suddenDeathRule: '说出绿色卡片就赢。说错一张就结束。',
  nameWord: (word) => `说出«${word}»`,
  giveUpRound: '放弃这一回合',

  // ── 翻译转盘（最后的翻盘机会，2026-09-16）────────────────────────────────
  wheelLede: (language) => `转盘决定这一轮的成败。用${language}把这些词写回来，把它填满，然后旋转。转到绿色就获胜。`,
  /** The input's placeholder and its accessible name. */
  wheelAnswerPlaceholder: (language) => `输入${language}`,
  wheelAnswerAria: (language, glosses) =>
    `输入${language}，翻译以下任一词语：${glosses.join('、')}`,
  wheelCardStatus: (translated) =>
    translated ? '，已填写翻译' : '，等待翻译',
  wheelRetryLine: '不对。再试一次。不会失去任何东西。',
  wheelSubmit: '装箱',
  wheelSpinAria: '旋转转盘',
  wheelSpinning: '旋转中……',
  wheelWonLine: '绿色！这一轮赢了。',
  wheelMissLine: '不是绿色。这一轮输了。',
  wheelLedeMissed: (found, total, language) =>
    `你找到了${total}个词中的${found}个。留在词板上的词，在转盘上保持灰色。用${language}写出其余的词，然后旋转。`,
  wheelAnswersLine: '灰色的词是你没有写出的答案。',
  wheelSeeResults: '查看结果',
  phaseTranslateChallenge: '翻译时间',
  settlementFailed: '暂时无法保存结果。请保留本轮并重试。',
  settlementSaving: '正在保存结果…',
  guidanceTranslationBody: (language) => `行李箱上现在显示的是你找到的词的意思。用${language}把每个词写回来，填满转盘，然后转动它。停在绿色区域就能赢得本轮。`,
  guidanceStartTranslation: '开始翻译',
  phaseTranslateWheel: '转盘：旋转决定这一轮',

  // ── 最后机会的到达弹窗 ─────────────────────────────────────────────────────
  /** 提示用完、转盘挑战开始时弹窗里的那句话（所有者，2026-09-17）——与 wheelLede 同一口吻。 */
  guidanceLastChanceWheel:
    '提示用完了，所以这就是结局。翻译收集到的单词把转盘填满，然后旋转。转到绿色就赢下这一轮。',

  caseyIsThinking: 'Casey 正在思考…',
  offlineCaseyIsThinking: '离线 Casey 正在思考，会久一点。',
  offlineRoundPrompt: '没有网络。用离线 Casey 玩完本轮吗？她会慢一些。',
  playOfflineButton: '离线玩',
  onlineAgainTitle: '网络恢复了',
  onlineAgainBody:
    '本轮剩下的部分换回普通 Casey 吗？她更快，也玩得更好。如果你的网络总是断断续续，继续离线可能更稳定。',
  playOnlineButton: '在线玩',
  stayOfflineButton: '继续离线',
  hurryCaseyTitle: '点击催一催 Casey',
  hurryCaseyHint: '点这里催一催 Casey。',
  caseyGuessedWord: (word) => `Casey 猜了«${word}»。`,
  caseyChoosingWord: 'Casey 正在选词…',
  caseyChoosingWhether: 'Casey 正在决定要不要猜…',
  guessGotOne: '。猜中了！',
  guessNeutral: '。中立牌。',

  turnTokensAria: (given, total, left) => `已给出 ${given}/${total} 条提示，还剩 ${left} 条。`,
  cluesGivenCount: (given, total) => `已给出 ${given}/${total} 条提示`,

  leaveTitle: '离开这一回合？',
  leaveBody: '暂停会把这块词板原样留着。取消则丢掉它，下次“开始游戏”就是新的一回合。',
  leaveKeepPlaying: '继续玩',
  leavePause: '暂停游戏',
  leaveCancelRound: '取消回合',

  guidanceCaseyTitle: 'Casey 的第一条提示',
  guidancePlayerTitle: '轮到你了！',
  guidanceWordCount: (n) => `${n} 个词`,
  guidanceCaseyBody: '找出和 Casey 的提示有关的词。',
  guidancePlayerBody: '写一个丹麦语单词，联系你的 1–4 个绿色词。如果你不知道这个词的丹麦语，就使用词典。',
  guidanceHideReminder: '别再提醒我',
  guidanceStartGuessing: '开始猜',
  guidanceWriteClue: '写一条提示',
  guidanceLastChanceTitle: '最后机会',
  guidanceLastChanceBody: '提示用完了。但你还有机会赢。根据之前的提示继续猜。不过猜错一张就输了。',
  guidanceKeepNaming: '继续说出',
  guidancePackingTitle: '先把词板装箱',
  guidancePackingBody:
    '给每张卡片打出丹麦语，一张接一张。全部打完，或者实在打不出更多了，就开始回合。',
  guidanceStartPacking: '开始装箱',

  dictionaryPlaceholder: '词典',
  dictionaryFieldAria: (language) => `要翻译的词，${language}或你的语言`,
  dictHitAria: (entry) => `${entry}：打开词典`,
  approximateFrom: (term) => `（来自 ${term}）`,
  onTheBoardNote: '（就在词板上）',
  translateFailed: '翻译不了这个词。',
  lookupsUsed: '查询次数已用完。',
  dictionaryPracticeOnly: '练习中只能查这900个词。',
  sayAgainAria: (word) => `再说一遍 ${word}`,
  saySlowlyAria: (word) => `慢速说一遍 ${word}`,
  sayExampleAria: '再说一遍例句',
  sayExampleSlowlyAria: '慢速说一遍例句',
  recordingsUnavailableNote: ' · 常速和慢速录音都不可用',
  recordingFailedNote: ' · 录音没加载出来',
  close: '关闭',

  caseysCalls: 'Casey 的判断',
  turnCount: (n) => `${n} 轮`,
  logHint: '哪一条是 Casey 的误判，就点它旁边的 ⚑。你标记的会给她看。',
  logYou: '你',
  logFor: '指向',
  flagClueLabel: (clue) => `Casey 的提示«${clue}»`,
  flagGuessLabel: (word) => `Casey 的猜测«${word}»`,
  flagOnAria: (label) => `${label}，已标记为误判。点击撤销`,
  flagOffAria: (label) => `把 ${label}标记为误判`,
  guessCorrectSr: '，正确',
  guessNeutralSr: '，中立牌',
  confidenceSure: (percent) => `${percent}% 把握`,
  noGuessMade: '没有猜',

  ledgerEmpty: '还没有记录。每条 Casey 的提示，等你在它下面猜完，这里就多一行。',
  ledgerArmHeading: '来源',
  ledgerCluesHeading: '提示',
  ledgerFoundHeading: '找到',
  ledgerRefusedHeading: '被拒',
  ledgerHitsTitle: (hits, asked) => `要找 ${asked} 个词，找到 ${hits} 个`,
  ledgerRefusedTitle: '这个来源第一次回答被丢掉、重新问的频率',
  ledgerExplainer:
    '“找到”是一条提示要找的词里，你真正翻开的比例。“被拒”是模型第一次回答被丢掉、重新问的频率。离线来源不会被拒。',
  ledgerClear: '清空记录',

  outcomeWonTitle: '恭喜！',
  outcomeWonSub: '你赢得了一张明信片！',
  outcomeLostTitle: '下次再来',
  outcomeGivenUpSub: '回合已放弃。关联其实就在那里。',
  outcomeWheelMissSub: '转盘停在一个你从没装好的手提箱上。',
  /** 转盘的获胜结局（所有者，2026-09-18）：转盘停在了绿色上。 */
  outcomeWheelWinSub: '转盘停在了绿色上。这一轮归你了。',
  outcomeWheelSpentSub: '令牌已经用过，而线索还是用完了。',

  resultLesson: 'Guide 中有一节新的可选课程。', resultOpenGrammar: '在 Guide 中打开语法', resultOpenSurvival: '在 Guide 中打开生存', resultBackToResult: '返回结果',

  // 数字由页面画在前面，这几个值只是数字后面的量词和名词：“3 个新词”。
  roundStatsAria: '本回合的收获',
  newWordsLabel: (_n) => '个新词',
  collectedForCasey: '个词已收集',
  wrapStatsAria: '这个打包回合装了什么',
  wrappedForGood: (named) => (named ? '个词已永久打包：' : '个词已永久打包'),
  stayedLabel: '个词还留着',

  // ── 这回合把旅程带到了哪里：打包回合的阅读区 ─────────────────────────────
  // 数字由页面画在前面：“13 个 Ribe 的词已打包 · 87 个词才能坐上开往 Kolding 的火车”。
  wrapJourneyHeading: '旅程',
  wrapJourneyAria: '这个打包回合之后的旅程',
  wrappedInCity: (_n, city) => `个 ${city} 的词已打包`,
  wrapJourneyTrainReady: (city) => `开往 ${city} 的火车准备好了`,
  wrapJourneyOver: '旅程到此结束',
  wrapJourneyToGo: (_n, city) => `个词才能坐上${city ? `开往 ${city} 的` : ''}火车`,

  wrapUpUnlocked: '打包回合已解锁。这种回合会把已收集的词永久装进行李箱。打开行李箱就能用。',
  wrapUpEarned: (banked) => `又得到一个打包回合，已存 ${banked} 个。去行李箱里用一个吧。`,
  postcardEarned: (banked) => `+1 张翻译明信片 · 已有 ${banked} 张`,
  wrapUpBankFull: (cap) => `存满了。行李箱最多存 ${cap} 个打包回合。用掉一个，胜利才会重新累计。`,
  winsToWrapUp: (n) => `再赢 ${n} 个回合，就有一个打包回合`,
  wrapResultFirst: '装进行李箱又翻到绿色的卡片，就永久打包了。这回合赢不赢都一样。',
  wrapResultNothing: '一个词都没打包成。要既翻译过、又翻到绿色，才算装进行李箱，输赢不论。',
  wrapResultLost: '这里输了也没损失。你装进行李箱又翻到绿色的词，打包回合都会留下，输赢不论。',

  playAgain: '再来一局',
  playNextGame: '下一局',
  home: '主页',
  postWrapChoicesAria: '打包回合后的选择',
  postWrapHeading: '接下来做什么？',
  postWrapGrammar: '语法',
  postWrapSurvival: '生存会话',
  postWrapBoth: '两个都做',
  postWrapBothNote: '先学语法，然后直接进入对话。',
  grammarNote: (city, topic, lessons) =>
    `${city} 的语法${topic ? `：${topic}` : ''}${lessons > 1 ? `，${lessons} 节课。` : '。'}`,
  survivalNextNote: (number, total, title) =>
    `第 ${number} 段对话，共 ${total} 段：${title}。先学短语，再练对话。`,
  survivalAllReadTitle: '四段对话都已经读过了。',
  survivalLockedTitle: '完成一个打包回合，解锁下一段对话。',
  survivalLockedNote: '完成一个打包回合，就会解锁下一段对话。',

  sentenceReviewAria: '句子回顾',
  hearItInDanish: '听丹麦语',
  legendGreenLabel: '绿色',
  legendGreenMeaning: '：你找到的词。',
  legendUnderlinedLabel: '下划线',
  legendUnderlinedMeaning: (city) => `：${city} 的小词。`,
  legendTapToHear: '点一下就能听。',

  reviewTitle: '词板回顾',
  reviewProgress: (current, total) => `${current} / ${total}`,
  reviewOptional: '可选 · 每条提示一句',
  reviewListen: '收听',
  reviewListenSlowlyAria: '慢速收听',
  reviewNoRecordings: '常速和慢速录音都不可用。',
  reviewRecordingUnavailable: '录音不可用。',
  reviewSoundOff: '声音已关，或者播放已停止。',
  reviewShowTranslation: '显示翻译',
  reviewHideTranslation: '隐藏翻译',
  reviewAboutWord: '关于这个词',
  reviewNoNotes: '这个词还没有说明。',
  reviewNextSentence: '下一句',
  reviewNothingThisRound: '这回合没有可回顾的内容。Casey 每猜对你的一条提示，都会提供一句例句。',
  sentenceBandNoGreens: '这回合没有绿色词可以放进句子。',

  // ── 提示被拒绝的原因 ─────────────────────────────────────────────────────
  clueNotSingleWord: '提示只能是一个词',
  clueOnBoard: (clue) => `“${clue}”就在词板上`,
  clueTypoOf: (clue, word) => `“${clue}”可能是“${word}”的拼写错误`,
  clueGlossOnBoard: (clue, word) => `“${clue}”是词板上“${word}”的翻译`,
  clueCompoundOfWord: (clue, word) => `“${clue}”是“${word}”的复合词`,
  clueCompoundOfGloss: (clue, gloss, word) => `“${clue}”是“${gloss}”的复合词，也就是“${word}”的翻译`,
  clueFormOfWord: (clue, word) => `“${clue}”是“${word}”的变形`,
  clueFormOfGloss: (clue, gloss, word) => `“${clue}”是“${gloss}”的变形，也就是“${word}”的翻译`,

  // ── 练习回合的提示与暂时关闭的词典 ───────────────────────────────────────
  practiceClueFinal: '最后一条练习提示：把剩下的那个绿色词连上。',
  practiceClueMany: '这条练习提示：连起 2 到 3 个绿色词。',
  dictionaryClosed: '这一步做完之前，词典先关着。',
}
