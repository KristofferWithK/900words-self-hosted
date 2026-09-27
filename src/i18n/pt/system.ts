import type { Catalogue } from '../en'

/**
 * Português europeu. Tu, nunca você. Calmo e factual — e cada falha diz o que
 * fica com quem joga: «A tua ronda está a salvo.»
 */
export const system: Catalogue['system'] = {
  saveChangeFailed: "A alteração dos dados guardados não pôde ser concluída. Tenta novamente antes de continuares a jogar.",
  // ── a ligação da Casey ───────────────────────────────────────────────────
  caseyRefused:
    'O servidor da Casey recusou o pedido. A tua ronda está a salvo. Tenta outra vez daqui a um momento, ou verifica a ligação da Casey nas Definições.',
  caseyDailyCap:
    'A Casey já pensou tudo o que tinha a pensar por hoje. O limite diário deste telemóvel no servidor dela esgotou-se e é reposto à meia-noite UTC. A tua ronda está a salvo; a Casey continua depois da reposição.',
  baseUrlNotAbsolute:
    'O URL base tem de ser um endereço completo a começar por https://. Verifica-o nas Definições.',
  baseUrlNotHttps:
    'O URL base tem de usar https:// (http:// só é permitido para um servidor da Casey local). Verifica-o nas Definições.',
  baseUrlHasExtras:
    'O URL base só pode conter o endereço e o caminho do servidor da Casey, sem credenciais, query nem fragmento. Verifica-o nas Definições.',
  selfHostedCaseyRequired: 'Configura a Casey nas Definições: adiciona a tua própria chave de IA ou descarrega o Gemma.',
  ownKeyRefused: 'O teu serviço de IA recusou a chave. Verifica-a nas Definições.',
  ownKeyBadRequest: 'O teu serviço de IA recusou o pedido. Verifica o nome do modelo nas Definições.',
  ownKeyUnreachable: 'Não foi possível contactar o teu serviço de IA.',
  caseyNoEndpoint:
    'Este servidor da Casey ainda não tem o endpoint de decisão. Atualiza ou volta a implementar o servidor e tenta de novo.',
  caseyBusy: 'O modelo da Casey está ocupado. Espera um momento e tenta de novo.',
  caseyRefusedView: 'O servidor da Casey recusou a vista do jogo.',
  caseyServerError: 'O servidor da Casey não conseguiu completar o pedido.',
  offline: 'Parece que estás offline.',
  caseyTimeout: (seconds) =>
    `A Casey demorou mais de ${seconds} segundos e o pedido foi abandonado. A tua ronda está a salvo; tenta de novo quando a ligação estiver mais estável.`,
  caseyUnreachable:
    'Não foi possível chegar à Casey. A ligação caiu, ou o servidor recusou o pedido do navegador (CORS). Tenta de novo; se continuar, verifica o URL base nas Definições.',
  caseyNonJson: 'O servidor da Casey devolveu uma resposta que não é JSON.',
  caseyBadShape: 'O servidor da Casey devolveu uma resposta com um formato desconhecido.',
  caseyPingFailed: 'A Casey não respondeu ao teste de ligação.',

  // ── uma versão mais recente à espera ─────────────────────────────────────
  updateReady: 'Está pronta uma nova versão do 900words.',
  updateReload: 'Recarregar',
  updateLater: 'Mais tarde',
  offlineReady: 'Pronto para jogar offline.',

  // ── uma gravação que não chegou ──────────────────────────────────────────
  audioFailed: (what) => `${what} não carregou.`,
  audioWord: 'A gravação da palavra',
  audioExample: 'A gravação da frase',
  audioChapter: 'A gravação da lição',
  audioTask: 'A gravação',
  audioSurvival: 'A gravação',

  // ── progresso encontrado numa chave antiga ───────────────────────────────
  rescuedProgress: (city, packed) =>
    `Encontrámos progresso de uma versão anterior: ${city}, ${packed} ${packed === 1 ? 'palavra embrulhada' : 'palavras embrulhadas'}. Já está reposto.`,
  rescuedAck: 'Certo',

  // ── o que a Apple respondeu sobre um passe de viagem ─────────────────────
  passPending:
    'A Apple ainda está a confirmar este passe de viagem. Mantém a app aberta e depois experimenta «Restaurar compras».',
  passCancelled: 'Não foi feita nenhuma compra.',
  passUnavailable: 'Os passes de viagem estão disponíveis na app para iOS.',
  passError: 'A Apple não conseguiu verificar este passe de viagem. Tenta outra vez.',
  passNotEntitled: 'Não foi encontrado nenhum passe de viagem para esta Conta Apple.',
  passRestoreUnavailable: '«Restaurar compras» está disponível na app para iOS.',
  passRestoreError: 'A Apple não conseguiu restaurar as compras. Tenta outra vez.',
  passRedeemOpened: 'A Apple abriu o painel para resgatar códigos.',
  passRedeemUnavailable: 'O resgate de códigos está disponível na app para iOS.',

  // ── o armazenamento não fez o que lhe pedimos ────────────────────────────
  backupFileUnreadable: 'Não foi possível ler esse ficheiro.',
  backupWriteFailed: 'Não foi possível guardar o ficheiro da cópia de segurança.',
  clipboardBlocked:
    'Área de transferência bloqueada. Seleciona o texto abaixo e copia-o tu.',

  // ── uma cópia de segurança que não conseguimos usar ──────────────────────
  backupNotJson: 'Esse ficheiro não é JSON. Escolhe o ficheiro que exportaste daqui.',
  backupTooNew:
    'Essa cópia de segurança foi criada por uma versão mais recente do 900words. Atualiza a app primeiro.',
  backupNotOurs: 'Esse ficheiro não é uma cópia de segurança do 900words.',
  backupMaybeOtherApp: ' Pode ser de outra app.',
  companionFailed: 'Algo correu mal na conversa com a companheira de IA.',
}
