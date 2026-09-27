import type { Catalogue } from '../en'

/**
 * 简体中文。设置页说明事情，不表演；语气平实，用“你”，不用“您”，也不用
 * “请”。Casey 只在文件末尾的每日提醒里开口，那几句才带她的语气。
 */
export const settings: Catalogue['settings'] = {
  // ── 这个界面 ─────────────────────────────────────────────────────────────
  title: '设置',
  backAria: '返回',

  // ── 应用对你说话时用的语言 ───────────────────────────────────────────────
  uiLanguageLabel: '你的语言',
  uiLanguageHelp: '应用跟你说话用的语言。切换会重新加载应用；收藏和旅程都会保留。',

  // ── 你正在学习的语言 ─────────────────────────────────────────────────────
  learnerLanguageLabel: '语言',
  learnerLanguageHelp: '每种语言都有自己的旅程。切换回来后会从上次停下的地方继续。',
  learnerLanguagePreviewTag: '预览',
  learnerLanguagePreviewHelp: '德语目前是预览：地图和旅行指南已经就位，单词游戏还没有。课程内容尚未经过母语者校对。',

  // ── Casey 的大脑 ─────────────────────────────────────────────────────────
  caseyBrainHeading: 'Casey 的大脑',
  caseyServerNote: 'Casey 用的是 900words 自己的服务器。不用设置什么；下面的按钮会检查她有没有回应。',
  normalOllamaCaseyLabel: '普通 Ollama Casey',
  normalOllamaCaseyDetail: 'gpt-oss 120B · 提示与猜测',
  normalOllamaCaseyAria: '使用普通 Ollama Casey',
  normalCaseyOn: '普通 Casey 已开启',
  normalCaseyOff: '普通 Casey 已关闭',
  prototypeOn: '无代理原型已开启',
  customCaseyOn: '自定义 Casey 服务已开启',
  normalCaseyDetail: 'Ollama 负责游戏和翻译。Gemma 已关闭。',
  gemmaModeDetail: 'Gemma 4 E4B 负责提示和猜测。词典查不到的词仍然交给 Ollama。',
  prototypeDetail: '这个本地测试模式不是 Casey，也不是 Ollama 或 Gemma。',
  customCaseyDetail: '已选择自定义 Casey Worker。词典在线查不到的词会交给这个服务。',
  baseUrlLabel: '基础网址',
  // 中间是 <code>/v1</code>，拉丁字母前留一个空格，后面紧接全角句号。
  baseUrlHelpBefore: '由上面的开关设置，或者输入你自己的 Casey Worker 地址，末尾加上 ',
  baseUrlHelpAfter: '。必须以 https:// 开头，这样你的游戏数据才不会明文传输。',
  baseUrlUnusable: '这个基础网址用不了。',

  // ── 设备上的模型 ─────────────────────────────────────────────────────────
  gemmaUnavailableNote: '离线模式在 900words 的 iPhone app 中可用。',
  gemmaReady: (size) => `离线 Casey 已就绪（这台 iPhone 上 ${size}）。`,
  gemmaRemoveConfirm: '要从这台 iPhone 删除离线 Casey 吗？以后可以重新下载。',
  gemmaRemoveButton: '删除离线 Casey',
  gemmaProgressAria: '离线 Casey 下载进度',
  gemmaDownloading: (percent) => `${percent}%。保持 900words 打开，连着 Wi-Fi。`,
  gemmaCancelDownloadButton: '取消下载',
  gemmaDownloadNote: (size) =>
    `离线 Casey 需要下载 ${size}。使用 Wi-Fi，并保持 900words 打开，直到下载完成。`,
  gemmaDownloadButton: '下载离线 Casey',
  gemmaDownloadFailed: '下载失败。',

  // ── offline mode ─────────────────────────────────────────────────────────
  offlineModeHeading: '离线模式',
  offlineModeExperimentalTag: '实验性',
  offlineModeLabel: '没网也能玩',
  offlineModeHelp:
    '普通 Casey 通过 900words 的服务器来玩。开启离线模式后，断网时你可以在这台 iPhone 上和离线 Casey 玩完本轮。她会慢一些。',
  offlineModeAria: '离线模式',
  offlineModeExplain: (size, iphones, lowMemory) =>
    `离线模式是实验性功能，仍在改进中。\n\n离线模式会把离线 Casey（${size}）下载到这台 iPhone。使用 Wi-Fi，并保持 900words 打开，直到下载完成。\n\n离线 Casey 比普通 Casey 玩得慢。\n\n她需要较新的 iPhone：${iphones}。${lowMemory ? '\n\n这台 iPhone 的内存比这些机型少，她可能无法在上面运行。' : ''}\n\n现在下载吗？`,

  // ── Casey’s AI in a self-built (open-source) 900words ─────────────────────
  ossCaseyHeading: 'Casey 的 AI',
  ossCaseyHelp: '这是自行构建的 900words。Casey 需要一个 AI 才能玩：你自己的 AI 密钥，或这台 iPhone 上的 Gemma。',
  ownKeyOption: '你自己的 AI 密钥',
  ownKeyHelp: '任何兼容 OpenAI 的服务都可以。你的密钥只保存在这台设备上，也只会发送到下面的地址。',
  ownKeyAddressLabel: '服务地址',
  ownKeyModelLabel: '模型',
  ownKeyKeyLabel: 'API 密钥',
  ownKeyAnswered: '你的 AI 服务已回应。',
  gemmaOption: '这台 iPhone 上的 Gemma',
  gemmaOptionHelp: 'Casey 在这台 iPhone 上玩，不需要网络，也不需要密钥。她会慢一些。',
  serverOption: '你自己的 Casey 服务器',
  serverOptionHelp: '你自己部署的 Casey Worker（见 README）。',
  // Gemma in the browser, in the desktop self-build (src/ai/gemma/web.ts).
  pcCaseyHelp: '这是自行构建的 900words。Casey 需要一个 AI 才能玩：你自己的 AI 密钥，或这台电脑上的 Gemma。',
  pcGemmaOption: '这台电脑上的 Gemma',
  pcGemmaOptionHelp: 'Casey 在这台电脑上玩，不需要网络，也不需要密钥。她会慢一些。',
  pcGemmaNeeds: 'Gemma 需要支持 WebGPU 的 Chrome 或 Edge，以及带显卡的电脑。',
  pcGemmaExplain: (size) =>
    `Casey 可以在这台电脑上和 Gemma 一起玩：不需要网络，也不需要密钥。Gemma 只需下载一次（${size}），保存在这个浏览器里，在 Chrome 或 Edge 中用你的显卡运行。她比 AI 服务慢，而且仍是实验功能。\n\n下载完成前请保持这个标签页打开。\n\n现在下载 Gemma 吗？`,
  pcGemmaReady: (size) =>
    `Gemma 已就绪（这个浏览器里 ${size}）。`,
  pcGemmaRemoveConfirm: '要从这个浏览器删除 Gemma 吗？以后可以重新下载。',
  pcGemmaDownloading: (percent) =>
    `${percent}%。请保持这个标签页打开。`,
  pcGemmaDownloadNote: (size) =>
    `Gemma 需要下载 ${size}。下载完成前请保持这个标签页打开。`,
  pcGemmaAnswered: 'Gemma 在这台电脑上回应了。',
  ossOfflineLabel: '没网时离线玩',
  ossOfflineHelp: '这时 Casey 会提出用 Gemma 把这一轮玩完。第一次开启时会下载她。',
  ossGemmaFirstRun: (size, iphones, lowMemory) =>
    `这个 900words 在你的 iPhone 上和 Casey 一起玩：不需要账号，也不需要密钥。她只需下载一次（${size}）。使用 Wi-Fi，并保持 900words 打开，直到下载完成。\n\n她需要较新的 iPhone：${iphones}。${lowMemory ? '\n\n这台 iPhone 的内存比这些机型少，她可能无法在上面运行。' : ''}\n\n你也可以在设置里添加你自己的 AI 密钥。\n\n现在下载 Casey 吗？`,

  // ── 连接检查 ─────────────────────────────────────────────────────────────
  testRunning: '测试中…',
  testGemmaButton: '测试设备上的 Casey',
  testConnectionButton: '测试连接',
  connectionFailed: '连接失败。',
  gemmaAnswered: 'Gemma 在这台 iPhone 上回应了。',
  normalCaseyAnswered: '普通 Ollama Casey 回应了。',
  customCaseyAnswered: '自定义 Casey 服务回应了。',

  // ── 游戏 ─────────────────────────────────────────────────────────────────
  gameHeading: '游戏',
  soundLabel: '点词的时候读出来',
  soundHelp: '不会自动播放任何声音。每个声音都是点出来的，Casey 的猜测也一样。',
  lookupExampleLabel: '查询翻译时播放例句',
  lookupExampleHelp: '关闭后，查询会使用单词发音设置。',
  replayIntroButton: '重看开场',
  replayIntroHelp: '再看一次 Casey 的开场介绍。你的进度不会有任何变化。',

  // ── 试玩用的旅行开关 ─────────────────────────────────────────────────────
  playtestHeading: 'TestFlight 试玩',
  playtestTravelLabel: '让我随意跳城市、坐任何一班火车',
  playtestTravelHelp:
    '跳站本身在地图上完成：选一个前方的站，点“提前出发”。这不会把任何词装进行李箱，也不会增加学习进度；关掉它，就能重新测试正常的旅程门槛。',

  // ── 每日提醒的开关 ───────────────────────────────────────────────────────
  reminderHeading: '每日提醒',
  reminderWebNote: '每日提醒只在 900words 的 iPhone 应用里有。这个浏览器不会请求通知权限。',
  reminderDeniedNote: '900words 的 iPhone 通知是关着的。在 iPhone 设置里打开，再回到这里设置 Casey 的每日提醒。',
  reminderOpenSettingsButton: '打开 iPhone 通知设置',
  reminderOnNote: (time) => `Casey 每天 ${time} 会在这台 iPhone 上来打个招呼。`,
  reminderTurningOff: '正在关闭…',
  reminderTurnOffButton: '关闭每日提醒',
  reminderOffNote: (time) =>
    `Casey 可以在每天 ${time} 发一条本地提醒。消息在这台 iPhone 上根据你完成的天数生成；设备令牌和学习记录都不会离开手机。`,
  reminderAsking: '正在询问 iPhone…',
  reminderTurnOnButton: '开启每日提醒',

  // ── 你的收藏：备份 ───────────────────────────────────────────────────────
  collectionHeading: '备份',
  backupIntro:
    '你的收藏只存在这台手机上。备份是一个小文件。换手机或清浏览器数据之前，先存一份到安全的地方。',
  backupSaveButton: '保存备份',
  backupRestoreButton: '从文件恢复',
  backupShared: '备份已导出到手机。',
  backupDownloaded: '备份已下载。',
  backupHideText: '隐藏文本备份',
  backupShowText: '没有文件选择器？改用文本',
  backupCopyButton: '复制我的收藏',
  backupCopied: '备份已复制到剪贴板。',
  backupPasteLabel: '在这里粘贴备份',
  backupReadButton: '读取',
  backupHoldsHeading: '这份备份包含',
  // 加粗的数字画在前面：“34 个已收集的词，共遇到 120 个”“12 个已打包 · Sønderborg”。
  backupCollectedAfter: (met) => `个已收集的词，共遇到 ${met} 个`,
  backupWrappedAfter: (city) => `个已打包 · ${city}`,
  backupGamesLine: (games, savedOn) => `玩了 ${games} 个回合 · ${savedOn} 保存`,
  backupMergeButton: '合并到本机',
  backupReplaceButton: '全部替换',
  backupCancelButton: '取消',
  backupChoiceNote: '合并会给每个词保留两份记录里更好的那份，绝不会让你少一张绿色卡片。替换则会丢掉这台设备上的进度。',
  backupReplaceConfirm: '用这份备份替换这台设备上的全部内容？备份之后学到的东西都会丢。',
  backupMerged: (collected) => `已合并。你原来的一点没丢，并入了 ${collected} 个已收集的词。`,
  backupRestored: (collected, wrapped) => `已恢复 ${collected} 个已收集的词和 ${wrapped} 个已打包的词。`,

  // ── 作者用的提示记录 ─────────────────────────────────────────────────────
  clueLedgerHeading: 'Casey 的提示',

  // ── 数据 ─────────────────────────────────────────────────────────────────
  dataHeading: '数据',
  usageStatsLabel: '匿名使用统计',
  usageStatsHelp: '只有数字：玩了多少回合、玩家在哪里停下、Casey 或录音有没有出错。没有词，没有提示，没有任何标识。',
  usageStatsAria: '分享匿名使用统计',
  dataSharingPrivateTitle: '私密游玩',
  dataSharingPrivateDetail: '可选的游戏数据一律不离开这台手机。',
  dataSharingDiagnosticsTitle: '匿名诊断',
  dataSharingDiagnosticsDetail: '分享回合数和结果，绝不分享你的词或提示。',
  dataSharingLearningTitle: '诊断 + 供 Casey 学习的示例',
  dataSharingLearningDetail: '也分享提示、猜测和结果，帮 Casey 进步。',
  dataSharingAria: '数据分享',
  dataSharingCloseAria: '先不选，关闭',
  dataSharingPromptTitle: '900words 可以怎么用你的游戏数据？',
  dataSharingPromptNote: '没有默认选项。选哪个都不影响玩整个游戏，之后随时能在设置里改。',
  dataSharingSettingsNote: '没选的话按私密游玩处理。这里只管可选事件；Casey 和下一块词板的临时检查，仍会处理游戏所必需的最少数据。',
  dataSharingDeleting: '正在删除已分享的数据…',
  dataSharingDeleteButton: '删除已分享的数据',
  resetConfirm: (language) => `重置全部学习进度、你的${language}旅程和当前这局？`,
  resetButton: '重置进度',

  // ── 版本页脚 ─────────────────────────────────────────────────────────────
  buildStamp: (stamp) => `版本 ${stamp}`,
  testFlightBuild: (build) => `TestFlight 版本 ${build} · `,
  keyboardReadoutNote: '键盘读数已开启。点版本号五次可隐藏。',
  stateOn: '开',
  stateOff: '关',
  composerRideWaiting: '关（等待文档）',
  composerRideButton: (state) => `输入框跟随键盘：${state}`,
  trainStoryButton: (state) => `火车故事：${state}`,
  updateChecking: '正在检查…',
  checkUpdatesButton: '检查更新',
  updateCurrent: '已是最新。',
  updateFound: '新版本正在下载。关掉再打开应用就能用上。',
  updateCheckFailed: '检查不了。关掉再重新打开应用试试。',

  // ── Casey 关于每日提醒的唯一一问 ─────────────────────────────────────────
  reminderPromptCloseAria: '暂时不用',
  reminderPromptTitle: '三局装进箱子了！',
  reminderPromptBody: (time) => `一天的量够了。明天 ${time} 左右要我提醒你吗？下午轻轻提一下，随时可以在设置里关掉。`,
  reminderPromptAccept: '好，提醒我',
  reminderPromptAsking: '正在询问你的 iPhone…',
  reminderPromptDecline: '不用了',

  // ── 每日提醒本身，在手机上生成 ───────────────────────────────────────────
  reminderDoneTitle: 'Casey 今天打包收工了',
  reminderDoneBody: '三局都稳稳地装进了箱子。明天继续。',
  reminderOneLeftTitle: '和 Casey 来一小局？',
  reminderStreakBody: (days) => `今天再来一局，${days} 天的连续天数就能续上。`,
  reminderOneLeftBody: '再来一局，今天的三局就都进箱了。',
  reminderSeatTitle: 'Casey 给你留了个座位',
  reminderSeatBody: (games) => `今天玩 ${games} 小局，连续天数就开始了。`,
}
