import type { Message } from 'discord.js';
import type { PrefixCommand } from '../../ai/commandRegistry.js';

export const prefixCommand: PrefixCommand = {
  trigger: 'ip',
  description: 'Informações básicas de IP/Site',
  async execute(message: Message, args: string[]) {
    const target = args[0];
    if (!target) return message.reply('Uso: `;ip <ip|domínio>`');
    try {
      const res = await fetch(`http://ip-api.com/json/${target}?fields=status,message,country,regionName,city,zip,isp,org,as,query`);
      const data = await res.json();
      if (data.status === 'fail') return message.reply(`❌ Erro: ${data.message}`);
      const info = `🔍 **IP Intel: ${data.query}**\n📍 Local: ${data.city}, ${data.regionName} - ${data.country}\n🏢 ISP/Org: ${data.isp} (${data.org})\n📡 AS: ${data.as}`;
      await message.reply(info);
    } catch (err) {
      await message.reply('❌ Erro ao consultar API.');
    }
  }
};