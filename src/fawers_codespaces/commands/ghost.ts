import type { Message } from 'discord.js';
import type { PrefixCommand } from '../../ai/commandRegistry.js';

export const prefixCommand: PrefixCommand = {
  trigger: 'ghost',
  description: 'Revela caracteres invisíveis, encodings ocultos e truques de Unicode',
  async execute(message: Message, args: string[]) {
    const text = args.join(' ');
    if (!text) return message.reply('Uso: `;ghost <texto>`');

    let report = '👻 **Ghost Hunter - Revelando o Invisível:**\n\n';
    let found = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const code = char.charCodeAt(0);

      // Detecta caracteres de controle, zero-width e outros suspeitos
      if (code < 32 || (code >= 127 && code <= 160) || [0x200B, 0x200C, 0x200D, 0x200E, 0x200F, 0xFEFF].includes(code)) {
        report += `• Caractere Oculto: \`U+${code.toString(16).toUpperCase().padStart(4, '0')}\` na posição ${i}\n`;
        found = true;
      }
    }

    if (!found) {
      report += '✅ Nenhum caractere invisível ou de controle detectado.';
    } else {
      report += '\n⚠️ **Aviso:** Caracteres invisíveis são frequentemente usados para bypass de filtros de segurança ou Homograph Attacks.';
    }

    await message.reply(report);
  }
};