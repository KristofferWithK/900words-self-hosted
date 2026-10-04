import type { Catalogue } from '../en'

/**
 * 简体中文。出错时的话要平静、说清事实，而且一定要说出玩家还剩什么——
 * 不说“你的回合是安全的”的失败提示，读起来就像丢了进度。不用“请”。
 */
export const system: Catalogue['system'] = {
  saveChangeFailed: "存档更改未能完成。请重试后再继续游戏。",
  // ── Casey 的连接 ─────────────────────────────────────────────────────────
  caseyRefused: 'Casey 的服务器拒绝了这次请求。你的回合是安全的。稍后再试，或者在设置里检查 Casey 的连接。',
  caseyDailyCap:
    'Casey 今天的脑力用完了。这台手机在她服务器上的每日额度已用尽，UTC 午夜重置。你的回合是安全的；重置后 Casey 就能继续。',
  baseUrlNotAbsolute: '基础网址必须是以 https:// 开头的完整地址。去设置里检查一下。',
  baseUrlNotHttps: '基础网址必须用 https://（只有本地 Casey 服务器才允许 http://）。去设置里检查一下。',
  baseUrlHasExtras: '基础网址只能包含 Casey 服务器的地址和路径，不能带凭据、查询参数或片段。去设置里检查一下。',
  selfHostedCaseyRequired: '在设置中设置 Casey：添加你自己的 AI 密钥，或下载 Gemma。',
  ownKeyRefused: '你的 AI 服务拒绝了这个密钥。去设置里检查一下。',
  ownKeyBadRequest: '你的 AI 服务拒绝了请求。去设置里检查模型名称。',
  ownKeyUnreachable: '无法连接到你的 AI 服务。',
  caseyNoEndpoint: '这台 Casey 服务器还没有决策接口。更新或重新部署服务器，然后再试。',
  caseyBusy: 'Casey 的模型正忙。稍等一下再试。',
  caseyRefusedView: 'Casey 的服务器拒绝了这份对局视图。',
  caseyServerError: 'Casey 的服务器没能完成这次请求。',
  offline: '你好像断网了。',
  caseyTimeout: (seconds) => `Casey 超过 ${seconds} 秒没回应，这次请求已放弃。你的回合是安全的；等连接稳一些再试。`,
  caseyUnreachable: '联系不上 Casey。连接断了，或者服务器拒绝了浏览器的请求（CORS）。再试一次；如果一直这样，去设置里检查基础网址。',
  caseyNonJson: 'Casey 的服务器返回的不是 JSON。',
  caseyBadShape: 'Casey 的服务器返回了无法识别的格式。',
  caseyPingFailed: 'Casey 没有回应连接检查。',

  // ── 有更新的版本在等着 ───────────────────────────────────────────────────
  updateReady: '900words 有新版本了。',
  updateReload: '重新加载',
  updateLater: '稍后',
  offlineReady: '已经可以离线玩了。',

  // ── 没能到达的录音 ───────────────────────────────────────────────────────
  audioFailed: (what) => `${what}没加载出来。`,
  audioWord: '这个词的录音',
  audioExample: '例句录音',
  audioChapter: '课文录音',
  audioTask: '这段录音',
  audioSurvival: '这段录音',

  // ── 在旧键名下找到的进度 ─────────────────────────────────────────────────
  rescuedProgress: (city, packed) => `找到了旧版本的进度：${city}，${packed} 个已打包的词。已经放回来了。`,
  rescuedAck: '好',

  // ── Apple 对旅行通票的答复 ───────────────────────────────────────────────
  passPending: 'Apple 还在确认这张旅行通票。保持应用打开，然后试试“恢复购买”。',
  passCancelled: '没有完成购买。',
  passUnavailable: '旅行通票只在 iOS 应用里提供。',
  passError: 'Apple 没能检查这张旅行通票。再试一次。',
  passNotEntitled: '这个 Apple 账户下没有找到旅行通票。',
  passRestoreUnavailable: '恢复购买只在 iOS 应用里提供。',
  passRestoreError: 'Apple 没能恢复购买。再试一次。',
  passRedeemOpened: 'Apple 已打开兑换码页面。',
  passRedeemUnavailable: '兑换码只在 iOS 应用里提供。',
  passPendingPlay: 'Google Play 还在确认这笔购买。保持应用打开，然后试试“恢复购买”。',
  passErrorPlay: 'Google Play 没能检查这笔购买。再试一次。',
  passNotEntitledPlay: '这个 Google 账号下没有找到无限畅玩的购买记录。',
  passRestoreErrorPlay: 'Google Play 没能恢复购买。再试一次。',

  // ── 存储没有照办 ─────────────────────────────────────────────────────────
  backupFileUnreadable: '这个文件读不出来。',
  backupWriteFailed: '备份文件写不进去。',
  clipboardBlocked: '剪贴板被拦住了。选中下面的文字，自己复制一下。',

  // ── 无法使用的备份文件 ───────────────────────────────────────────────────
  backupNotJson: '这个文件不是 JSON。选你从这里导出的那个文件。',
  backupTooNew: '这份备份是更新版本的 900words 写的。先更新应用。',
  backupNotOurs: '这个文件不是 900words 的备份。',
  // 直接接在上一句后面；中文句号后不需要空格。
  backupMaybeOtherApp: '它可能来自别的应用。',
  companionFailed: '和 AI 伙伴沟通时出了问题。',
}
