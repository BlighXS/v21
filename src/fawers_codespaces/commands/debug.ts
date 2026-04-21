import type { Message } from 'discord.js';
import type { PrefixCommand } from '../../ai/commandRegistry.js';
import os from 'node:os';

export const prefixCommand: PrefixCommand = {
  trigger: 'debug',
  description: 'Exibe o estado interno e métricas do sistema',
  async execute(message: Message) {
    if (message.author.id !== '892469618063589387') return;

    const memory = process.memoryUsage();
    const uptime = process.uptime();
    const h = Math.floor(uptime / 3600);
    const m = Math.floor((uptime % 3600) / 60);

    const info = `⚙️ **Internal Debug State:**\n` +
      `• **Node.js**: ${process.version}\n` +
      `• **PID**: ${process.pid}\n` +
      `• **Uptime**: ${h}h ${m}m\n` +
      `• **RSS**: ${(memory.rss / 1024 / 1024).toFixed(2)} MB\n` +
      `• **Heap**: ${(memory.heapUsed / 1024 / 1024).toFixed(2)} / ${(memory.heapTotal / 1024 / 1024).toFixed(2)} MB\n` +
      `• **OS**: ${os.type()} ${os.release()} (${os.arch()})\n` +
      `• **Platform**: ${process.platform}`;

    await message.reply(info);
  }
};