import type { Message } from 'discord.js';
import type { PrefixCommand } from '../../ai/commandRegistry.js';

const map: Record<string, string> = {
    a:"#", b:"8", c:"(", d:"}", e:"9", f:"=", g:"6", h:"?", i:"!",
    j:"]", k:"<", l:"1", m:"%", n:"^", o:"0", p:"*", q:"2", r:"&",
    s:"$", t:"@", u:"7", v:"/", w:"vv", x:"×", y:"¥", z:"3", " ":"_"
};

const revMap: Record<string, string> = {};
for (const k in map) { revMap[map[k]] = k; }

export const prefixCommand: PrefixCommand = {
  trigger: 'fdec',
  description: 'Descriptografa uma mensagem usando o protocolo Crypto Fixa v3',
  async execute(message: Message, args: string[]) {
    const input = args.join(' ');
    if (!input) return message.reply('❌ Digite o código para descriptografar.');

    let result = "";
    for (let i = 0; i < input.length; i++) {
        if (input[i] === "v" && input[i + 1] === "v") {
            result += "w";
            i++;
        } else {
            result += revMap[input[i]] || input[i];
        }
    }

    await message.reply(`🔓 **Mensagem Descriptografada:**\n\`\`\`\n${result}\n\`\`\``);
  }
};