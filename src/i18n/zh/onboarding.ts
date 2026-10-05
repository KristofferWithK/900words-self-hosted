import type { Catalogue } from '../en'

/**
 * 简体中文。用“你”，不用“您”；Casey 是“她”。
 *
 * 排版约定（与其他文件一致）：中文与拉丁字母、数字之间留一个半角空格
 * （“点 Casey 继续”“赢 3 个回合”）；«» 里的丹麦语词前后不留空格，全角标点
 * 前后也不留。`${language}` 将来会是“丹麦语”这样的中文词，所以它前后不留空格。
 */
export const onboarding: Catalogue['onboarding'] = {
  courseText: (course) => {
    const german = course === 'de'
    return {
      languageName: german ? '德语' : '丹麦语',
      countryName: german ? '德国' : '丹麦',
      welcome: '你知道吗？在大多数语言里，900 个词就能覆盖日常口语的 80% 以上。',
      clueField: german
        ? '轮到你时，在这里输入一个德语词，把你两三个绿色词连起来。'
        : '轮到你时，在这里输入一个丹麦语词，把你两三个绿色词连起来。',
      dictionary: german
        ? '需要德语词时，就在这里查。提示发出后，词典会关闭。'
        : '需要丹麦语词时，就在这里查。提示发出后，词典会关闭。',
      tutorialHint: '用词典把你想到的词翻译出来。',
      practiceIntro: (clue, number) =>
        `我的提示是«${clue}»，对应 ${number} 个词。这块词板上哪些词和它有关？想看翻译就点 ⓘ。`,
      practiceRationaleTime: '钟表显示时间。月份和星期都是时间单位。',
      practiceRationaleTimeRecovery: '对剩下的时间相关词，再用一次这个时间联系。',
      lastGreen: german
        ? '还剩一张绿色卡片。我看不见它，所以请给我一条德语提示，指向最后这张牌。'
        : '还剩一张绿色卡片。我看不见它，所以请给我一条丹麦语提示，指向最后这张牌。',
      yourTurn: german
        ? '我的回合结束了。现在轮到你。给我一条德语提示，把你这边的 2 或 3 张绿色卡片连起来。我看不见它们，就像你看不见我的钥匙。'
        : '我的回合结束了。现在轮到你。给我一条丹麦语提示，把你这边的 2 或 3 张绿色卡片连起来。我看不见它们，就像你看不见我的钥匙。',
    }
  },
  languageEyebrow: '欢迎登车',
  languageHeading: '你说哪种语言？',
  languageHint: '点击你的语言。',
  languageAria: (endonym) => `把 900words 切换成${endonym}`,

  // ── 车票：你想学哪种语言 ────────────────────────────────────────────────
  skip: '跳过',
  ticketEyebrow: '选择你的旅程',
  ticketHeading: '你想学哪种语言？',
  ticketAria: (country, language) => `去${country}旅行，学${language}`,
  ticketLearnIn: '目的地',
  ticketMeta: (words, cities) => `${words} 个词 · ${cities} 座城市`,
  ticketHintMany: '点一张车票来选。',
  ticketHintOne: '点一下车票，我们就出发。',
  ticketComingSoon: '即将推出',

  // ── Casey before the first walk, and the first walk’s end (CW-13) ──
  introTwoGames: '背单词卡太无聊了，所以我们玩两个游戏：一个是城市观光，边走边收集词；另一个是在咖啡馆里玩的词语谜题。',
  introExplore: (city) => `我们去逛逛 ${city}，看看能不能找到一家咖啡馆。`,
  introGo: '出发',
  walkEndFound: '再走一次，或者回主页去玩我们找到的咖啡馆。',
  walkEndNotFound: '再走一次去找咖啡馆，或者回主页。',

  // ── 真实界面上的引导提示 ────────────────────────────────────────────────
  tourNext: '下一步',
  tourDone: '出发吧',
  tourLoose: '我们见过的词在上面等着。每个圆环按标记填满三分之一：散步时拍的照片、根据我的提示猜对一次、你自己给出一次提示。',
  tourLid: '集齐三个标记，这个词就收集好了。收集好的词放进箱子里，这一行会数它们。',
  tourTray: '这是这座城市的印章卡。你玩过的每家咖啡馆都会在这里盖上印章。虚线圆圈是找到了但还没玩的咖啡馆，? 是还没找到的。',
  mapTourHere: (city, words) => `这是 ${city}，我们现在就在这儿。每座城市有 ${words} 个词可以带回家。`,
  mapTourNext: (next, _words, city) =>
    `${next} 在路线更远的地方。继续提升 ${city} 的词板。下一站暂时关闭。`,
  homeTourArrival: (city, words) => `我们到 ${city} 了，来收集你的头 ${words} 个词。`,
  homeTourMap: '这是我们的地图。上面标着我们现在在哪，还有前方等着我们的城市。',
  homeTourSuitcase: '想打开行李箱，随时点我。里面能看到你遇到过、收集过、还有已经永久打包的词。',
  homeTourGuide: '语法、实用丹麦语，还有前面几座城市的练习，都在旅行指南里。你可以提前读，火车不用动。',
  // ── 练习回合的分步引导（2026-09-18）────────────────────────────────────
  introGameTourKey:
    '绿色边框是你的秘密词。我从来看不到它们，就像你也看不到我的。每次猜测都按出题者的底牌来判定。',
  introGameTourClueField:
    '轮到你的时候，在这里输入一个丹麦语词，把它和你两三张绿色卡片连起来。',
  introGameTourDictionary:
    '要是你需要一个还没学会的丹麦语词，就在这里查。提示一发出去，词典就会关上。',
  introGameTourStepper:
    '这个数字表示你的提示对应几个词。当一个联系确实能覆盖更多绿色卡片时，就把它调高。',
  translationTourBoard:
    '这些行李箱盖上显示的是我们找到的词的意思。在心里选其中一个就行。不需要先点行李箱。',
  translationTourInput: (language: string) =>
    `在这里输入它的${language}词，然后点按勾号。答错不会有任何损失，再试一次就好。`,
  translationTourWheel:
    '每答对一个，转盘上就多一格绿色。你随时可以转，但停在空格就会输掉这一局。转盘填满后，每次转都会赢。',
  wheelReadyTour:
    '转盘现在全是绿色，这次转一定会赢。点按转盘开始转动。',
  resultTourRewardNew: (rewards: string) => `这次新获得：${rewards}。`,
  resultTourRewardHeld: (rewards: string) =>
    `之前已经获得过，所以不再重复计算：${rewards}。`,
  resultTourWinTier: (tier: string, best: string) =>
    `这局谜题拿到了${tier}。这家咖啡馆目前最好的印章是${best}。`,
  resultTourLossTier: (best: string) =>
    `这局谜题输了。输掉的谜题也能得到铜印章，赢下的谜题能得到银、金或白金印章。这家咖啡馆目前最好的是${best}。`,
  resultTourCityPercent: (city) =>
    `每枚咖啡馆印章都计入 ${city} 的奖牌：25% 得铜，50% 得银，75% 得金，100% 得铂金。`,
  resultTourNoBestYet: '尚未产生',
  resultTourSentence:
    '这是可选的复习。它会把这块词板上的一个词放进句子里。这不是另一场测试。',
  resultTourNoReview:
    '这次没有可复习的句子。没关系。复习始终是可选的。',
  homeTourSightseeing: '城市观光就是我们刚才走的那一趟。每次散步都会收集词语，走得越多，找到的咖啡馆也越多。',
  homeTourCafe: (name) =>
    name ? `我们的第一家咖啡馆是 ${name}。点“咖啡馆谜题”坐下来玩吧。` : '我们的第一家咖啡馆在等你。点“咖啡馆谜题”坐下来玩吧。',
  homeTourStamp: '你玩过的每家咖啡馆都会得到一枚印章。印章合起来就是这座城市的奖牌，这里显示你的进度。',
  homeTourCollection: '点我打开行李箱。我给你看我们收集的词，还有咖啡馆的印章。',

  // ── 练习回合：Casey 写好的理由 ──────────────────────────────────────────
  practiceRationaleDrink: '水、咖啡和牛奶都是喝的东西。',
  practiceRationaleHome: '房子就是家。',
  practiceRationaleRecovery: '还是“喝”这个具体联系，用在剩下的饮料卡片上。',

  // ── 练习回合：Casey 的实时解说 ──────────────────────────────────────────
  practiceIntro: '我的提示是«drikke»，对应 3 个词。这块词板上哪些词和它有关？想看翻译就点 ⓘ。',
  guessGreenMore: (word) => `«${word}»在我的底牌上是绿色。继续猜，或者见好就收。`,
  guessGreenEnd: (word) => `«${word}»在我的底牌上是绿色。我这条提示就结束了。`,
  guessGreenEndMine: (word) =>
    `«${word}»在我的底牌上是绿色。我这条提示就结束了。轮到你的时候，你的绿色卡片才会显示出来。这条提示用的是我的底牌。`,
  guessYoursNotMine: (word) =>
    `«${word}»在你的底牌上是绿色，但在我的底牌上不是。这条提示按我的底牌算，所以这张牌还留着，等你的提示来用。`,
  guessMiss: (word) => `«${word}»在我的底牌上不是绿色，我这条提示就结束了。`,
  guessMissMine: (word) =>
    `«${word}»在我的底牌上不是绿色，我这条提示就结束了。轮到你的时候，你的绿色卡片才会显示出来。这条提示用的是我的底牌。`,
  firstClue: (clue) =>
    `欢迎来到咖啡馆！这第一张桌子是个简短的练习。这块板上哪些词能和«${clue}»联系起来？点词上的 ⓘ 可以看翻译，然后点一个词并确认。`,
  clueFor: (clue, number) => `我的提示是«${clue}»，对应 ${number} 个词。想到哪个词就点哪个。`,
  lastGreenLeft: '你还剩一张绿色卡片。我看不见它，所以给我一条丹麦语提示，指向最后这张牌。',
  yourTurn:
    '我这轮结束了，轮到你。给我一条丹麦语提示，把你那边的 2 到 3 张绿色卡片连起来。我看不见它们，就像你看不见我的底牌。',
  yourFirstClue: (clue, number, tokens) =>
    `你的提示是«${clue}»，对应 ${number} 个词。上面那 ${tokens} 个圆点是我们共用的提示标记，每条提示，不管你的还是我的，都会用掉一个。我在下面边想边说。`,
  yourClue: (clue, number) => `你的提示是«${clue}»，对应 ${number} 个词。现在我按你的底牌来猜。我在下面边想边说。`,
  practiceWon: '绿色词全找到了。我们赢了！咖啡馆谜题可没这么简单，但遇到的每个词都算数。',
  practiceLost: '这回合没拿下，不过遇到的每个词都算数。',
  findingAClue: '轮到我了。我在想提示。',
  practiceTranslation:
    '词板解开了！现在是翻译时间：每个丹麦语答案都会填满转盘的一格。现在就能转，但转盘填满一定会转到绿色。已解开的词板在这里还能达到白金。',
  practiceWheelReady: '转盘填满了。转一下就会落到绿色。在普通词板中，你的结果就是这样达到白金的。',
  practiceFinish:
    '练习完成。这张桌子不给印章。在咖啡馆谜题里，解开谜题、翻译和转盘会给咖啡馆盖上印章。你可以重玩一家咖啡馆来提升它的印章。',
  demoEndTitle: "这就是你的第一个完整词板。",
  demoEndLine: "在应用里，我会一直陪你玩，一个词板接一个词板，并记住你收集的每个词。",
  demoAppStore: "在 App Store 下载 900words",
  demoAppStoreSoon: "900words 即将登陆 App Store。",
  demoPlayAgain: "再玩一次",
  demoRestingTitle: "Casey 正在休息",
  demoRestingBody: "今天有很多人和我一起玩，我需要休息一下。明天再来，或者在应用里和我一起玩。",
  demoCheckFailed: "我们无法确认你是真人。请重新加载页面后再试一次。",
  playFullRound: '玩咖啡馆谜题',
}
