import type { Catalogue } from '../en'

/**
 * Casey 是“她”（UL12）。用“你”，不用“您”。句子要短：它们出现在 360 像素宽的
 * 手机上的一个对话气泡里。
 *
 * 有几个值特意在开头或结尾留了一个空格：它们是包住 <strong> 或 <code> 的半句话，
 * 而被包住的那个词是拉丁字母（Casey、/v1），中文和拉丁字母之间本来就要留空格。
 * 接在全角标点前后的半句则不留。
 */
export const casey: Catalogue['casey'] = {
  tipCaseyKeyCounts: '你猜的时候，算的是 Casey 的绿色卡片。看她的底牌，不是你的。',
  tipCollectBothWays: '一个词要你出过提示、也猜中过，才算收集到：一来一回都翻到绿色。',
  tipWrapToKeep: '收集到的词在路上还会摔坏。打包好才留得住。',
  tipEarnWrapUp: '赢三个回合，换一个打包回合。最多能存三个；等收集得多了再用。一次最多装十五个词。',

  tipTapCaseyForCase: '点 Casey 打开箱子。你收集的每个词都装在这里一路同行。',
  tipWrapUpCardsStartInEnglish: (language) => `打包回合里，卡片一开始显示的是卡面。打出${language}，才能装进行李箱。`,
  tipWrapUpSkipAllowed: '打包回合里可以跳过一张卡片，只是这一回合它就打包不了了。',
  tipLastChance: '提示用完不算出局：到了最后机会，你还能继续说词。',
  tipLookUpMidRound: (language) => `回合中途也能在提示框里查词：输入你的语言，出来的是${language}。`,
  tipWrapCityOpensRoad: '把一座城市的一百个词全部打包，往前的路就开了。',

  // 词是丹麦语、释义暂时是英语，两边都是拉丁字母，所以这里用带空格的半角破折号。
  wordOfTheDay: (word, meaning) => `每日一词：${word}（${meaning}）。`,

  personalTrickyWord: (word, meaning, misses) =>
    `要留意的词：${word}（${meaning}）。它已经难倒你 ${misses}× 了。`,
  personalBestWord: (word, meaning, greens) =>
    `这个你真的会：${word}（${meaning}）。已经 ${greens}× 变绿。`,
  personalCluedTogether: (a, b, times) =>
    `我们在 ${a} 和 ${b} 上很有默契。你的提示已经 ${times}× 同时找到它们。`,
  personalFavouriteClue: (clue, times) =>
    `你最爱用的提示是「${clue}」。已经用了 ${times}×。`,
  personalGames: (played, won) =>
    `我们一起玩了：${played} 局。一起赢了：${won} 局。`,

  notAnsweredBubble: '我还没回答过。点这里测试连接 →',
  notAnsweredAria: 'Casey 还没回答过。打开设置，测试连接',
  bubbleAria: (line) => `Casey 说：${line} 点击换一条提示。`,
  suitcaseAria: '打开行李箱：你的收藏',

  lookingAgain: '让我再看看词板。',
  asFarAsIDare: '我只敢到这儿了。',
  // `reasoning` 是她自己的一句话，目前还是英语、以句点结尾，所以后面留一个空格。
  withSecondChoice: (reasoning, word) => `${reasoning} 我本来的第二选择是 ${word}。`,
}
