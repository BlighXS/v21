import mineflayer from 'mineflayer';
import { logger } from './logger.js';

let bot: mineflayer.Bot | null = null;

export function connectToMC(host: string, port: number, username: string, onChat: (user: string, msg: string) => void) {
  if (bot) {
    bot.quit();
    bot = null;
  }

  logger.info(`Conectando ao Minecraft: ${host}:${port} como ${username}`);

  bot = mineflayer.createBot({
    host,
    port,
    username,
    version: '1.21.1',
    checkTimeoutInterval: 60000
  });

  bot.on('spawn', () => {
    logger.info('Fawers_IA spawnou no servidor!');
    bot?.chat('Oie! Fawers chegou no lab. Pronta para minerar e ajudar! ✨🌸');
  });

  bot.on('chat', (username, message) => {
    if (username === bot?.username) return;
    onChat(username, message);
  });

  bot.on('error', (err) => logger.error({ err }, 'Erro no bot do Minecraft'));
  bot.on('kicked', (reason) => logger.warn({ reason }, 'Fawers foi kickada do Minecraft'));
}

export function sendToMC(msg: string) {
  if (bot) bot.chat(msg);
}