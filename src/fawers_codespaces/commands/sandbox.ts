import type { Message } from 'discord.js';
import type { PrefixCommand } from '../../ai/commandRegistry.js';

export const prefixCommand: PrefixCommand = {
  trigger: 'sandbox',
  description: 'Simula um terminal Linux para treinamento',
  async execute(message: Message, args: string[]) {
    const cmd = args[0]?.toLowerCase();
    
    if (!cmd) return message.reply('💻 **FAW Sandbox Terminal**\nUso: `;sandbox <comando>` (ex: ls, whoami, cat, help)');

    const responses: Record<string, string> = {
      'ls': 'bin  etc  home  root  tmp  usr  var  flag.txt',
      'whoami': 'fawner_user',
      'pwd': '/home/fawner_user',
      'id': 'uid=1001(fawner_user) gid=1001(fawner_user) groups=1001(fawner_user)',
      'cat flag.txt': 'faw{terminal_sandbox_mastered}',
      'help': 'Comandos disponíveis: ls, whoami, pwd, id, cat, clear, exit',
      'uname -a': 'Linux faw-sandbox 5.15.0-generic #1 SMP x86_64 GNU/Linux'
    };

    const output = responses[args.join(' ')] || `bash: ${cmd}: command not found`;
    await message.reply(`\`\`\`bash\n$ ${args.join(' ')}\n${output}\n\`\`\``);
  }
};