import type { PlayerLanguage } from './player-language'

export declare function targetExampleText(code: string, text: string): string
export declare function playerForTargetLanguage(
  targetLanguage: { code: string; name: string },
  player: PlayerLanguage,
): PlayerLanguage
