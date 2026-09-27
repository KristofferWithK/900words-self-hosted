import type { Catalogue } from '../en'

/**
 * 简体中文。旅行指南的语气平静、准确。“生存会话”是整个分区的名字，
 * 分区里的一段对话叫“对话”。“向前看”和主页、地图上的同一个词保持一致。
 */
export const guide: Catalogue['guide'] = {
  // ── the guide as an object: covers, names, ways out ──────────────────────
  title: '旅行指南',
  openGuideAria: '打开旅行指南',
  coverAria: 'Casey 的旅行指南',
  bookCoverAria: '旅行指南封面',
  backFromGuideAria: '离开旅行指南',
  backToGuideAria: '返回旅行指南',
  backToHomeAria: '返回主页',
  backToCoverAria: '返回旅行指南封面',
  caseyFieldNotes: 'Casey 的随手笔记',
  coverTitle: { da: '你的丹麦语旅程，先用铅笔记下。', de: '你的德语旅程，先用铅笔记下。' },
  pocketGuideEyebrow: 'Casey 的口袋指南',
  pocketGuideTitle: { da: '路上用的丹麦语。', de: '路上用的德语。' },
  pocketGuideBlurb: '一路上会遇到的词、句型和对话，都有简短的笔记。',
  openGrammarContentsAria: '打开语法目录',

  // ── the two sections and their thumb indexes ─────────────────────────────
  sectionGrammar: '语法',
  sectionSurvival: '生存会话',
  thumbIndexesAria: '旅行指南分区标签',
  grammarThumbBlurb: { da: '丹麦语是怎么运作的', de: '德语是怎么运作的' },
  survivalThumbBlurb: '出门在外怎么说',
  backToGrammarIndexAria: '返回语法目录',
  backToSurvivalIndexAria: '返回生存会话目录',

  // ── a section's city index ───────────────────────────────────────────────
  cityIndexAria: (section) => `${section}城市目录`,
  cityIndexHeading: '九座城市章节',
  cityIndexLede: '任选一座城市，城市名会显示推荐的学习水平。',
  sectionEmpty: '这一部分还没有为这门语言写好。',
  cityRowAria: (city, topic, current) => `${city}：${topic}${current ? '，当前城市' : ''}`,
  // 中文名词不随数量变化：“3 节课”“4 段对话”。
  lessonCount: (n) => `${n} 节课`,
  exchangeCount: (n) => `${n} 段对话`,
  grammarBookTitle: (city) => `${city}语法`,
  grammarBookDescription: (n) => `旅行指南中收录了 ${n} 节简短课程。`,
  grammarLessonBookDescription: '先读一页规则，再看语境中的例句。',
  grammarExamplesContext: '语境中的例句',
  grammarExamplesIntro: '把每句话作为完整、实用的句子来读。',
  englishOnlyNotice: '仅英文 · 翻译待补',
  nextSurvivalLabel: '下一步：生存会话 →',

  // ── one Survival exchange ────────────────────────────────────────────────
  exchangeAria: (title) => `对话：${title}`,
  recommendedCity: (city) => `推荐：${city}`,
  speakerYou: '你',
  speakerLocal: '当地人',
  listen: '收听',
  listenToAria: (line) => `收听：${line}`,
  translationToggle: '中文',
  recordingDidNotLoad: '录音没加载出来',
  listenNotRecordedYet: '尚未录音',
  addressFormAria: (form: string) => `称呼方式：${form}`,
  exchangeNavAria: '对话导航',

  // ── turning the pages of a book ──────────────────────────────────────────
  bookNavAria: '书页导航',
  previous: '上一页',
  next: '下一页',
  previousLabel: '← 上一页',
  nextLabel: '下一页 →',
  openBook: '翻开',
  backFromAria: (book) => `离开${book}`,
  backToCoverOfAria: (book) => `返回${book}封面`,
  pageOf: (page, total) => `第 ${page} 页，共 ${total} 页`,
  pageAnnouncement: (title, page, total) => `${title}，第 ${page} 页，共 ${total} 页`,

  // ── the train ride: its bar, its recording, its way out ──────────────────
  skipLessonAria: '跳过这节课',
  skipShort: '跳过',
  continueLabel: '继续',
  toSurvivalLabel: '生存会话 →',
  recordingSectionAria: '丹麦语课文录音',
  hearTheLesson: '听这节课',
  hearTheLessonHelp: '一段自然语速的丹麦语录音。点某一行，逐句细看。',
  stop: '停止',
  recordingLoading: '正在加载课文录音…',
  recordingFailed: '课文录音没加载出来。再试一次。',
  recordingMissing: '这节课还没有录音。',
  grammarChapterAria: (chapter) => `语法第 ${chapter} 章`,

  // ── the Travel Guide index screen: tabs, chapters, activities ────────────
  tabChapters: '章节',
  tabPractice: '练习',
  tabSituations: '情景',
  tabsAria: '旅行指南分区',
  chapterKicker: (chapter, city) => `第 ${chapter} 章，共 9 章 · ${city}`,
  chapterRowTitle: (chapter, city) => `第 ${chapter} 章 · ${city}`,
  chapterReached: '已到达',
  lookAhead: '向前看',
  lookAheadNote: '向前看只是先读一读，不会解锁这座城市，也不算完成。',
  activityNew: '新',
  activityLater: '稍后',
  activityDone: '已完成',
  activityLocked: '未解锁',
  activityListIntro: '“新”“稍后”“已完成”都会留在这里，下了火车也不会丢。未解锁的活动要等语言站发出邀请。',
  noActivitiesYet: '到达一座城市，它的练习就会出现在这里。',
  kindPractice: '练习',
  kindReadinessTask: '出发任务',
  kindSituation: '情景',
  readerNote: '这是可以反复翻看的指南页面。首次尝试记录只在计分活动里产生，光打开这一页不会。',
}
