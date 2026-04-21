import type { Message } from 'discord.js';
import type { PrefixCommand } from '../../ai/commandRegistry.js';

const map: Record<string, string> = {
    a:"#", b:"8", c:"(", d:"}", e:"9", f:"=", g:"6", h:"?", i:"!",
    j:"]", k:"<", l:"1", m:"%", n:"^", o:"0", p:"*", q:"2", r:"&",
    s:"$", t:"@", u:"7", v:"/", w:"vv", x:"×", y:"¥", z:"3", " ":"_"
};

export const prefixCommand: PrefixCommand = {
  trigger: 'fenc',
  description: 'Criptografa uma mensagem usando o protocolo Crypto Fixa v3',
  async execute(message: Message, args: string[]) {
    const input = args.join(' ').toLowerCase();
    if (!input) return message.reply('❌ Digite o texto para criptografar.');

    let result = "";
    for (const char of input) {
        result += map[char] || char;
    }

    await message.reply(`🔐 **Mensagem Criptografada:**\n\`\`\`\n${result}\n\`\`\``);
  }
};