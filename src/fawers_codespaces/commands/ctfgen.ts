import type { Message } from 'discord.js';
import type { PrefixCommand } from '../../ai/commandRegistry.js';
import { EmbedBuilder } from 'discord.js';

const MISSIONS = [
  {
    title: 'Operação: Golden Key',
    desc: 'Um servidor de arquivos legado (Windows Server 2008) foi detectado na rede interna.',
    files: '`backup_config.xml`, `credentials.db.bak`, `shell.php`',
    goal: 'Obter a flag de Admin localizada em C:\\Users\\Administrator\\Desktop\\flag.txt',
    hint: 'O serviço SMB (445) está vulnerável ao EternalBlue (MS17-010).'
  },
  {
    title: 'Operação: Silent Leak',
    desc: 'Uma API de desenvolvimento foi deixada aberta sem autenticação em uma sub-rede.',
    files: '`app.js`, `package.json`, `.env` (vazado)',
    goal: 'Exfiltrar a chave privada da AWS do ambiente de produção.',
    hint: 'Verifique se há rotas de debug (/debug, /env) que expõem variáveis de ambiente.'
  }
];

export const prefixCommand: PrefixCommand = {
  trigger: 'ctfgen',
  description: 'Gera uma missão CTF completa',
  async execute(message: Message) {
    const m = MISSIONS[Math.floor(Math.random() * MISSIONS.length)];
    
    const embed = new EmbedBuilder()
      .setTitle(`⚔️ ${m.title}`)
      .setColor('#ff0000')
      .addFields(
        { name: '📝 Descrição', value: m.desc },
        { name: '📂 Arquivos Detectados', value: m.files },
        { name: '🎯 Objetivo Final', value: m.goal },
        { name: '💡 Dica Técnica', value: `||${m.hint}||` }
      )
      .setFooter({ text: 'FAW CTF System v4.0' });

    await message.reply({ embeds: [embed] });
  }
};