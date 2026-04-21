import { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { config } from '../utils/config.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.login(config.DISCORD_TOKEN).then(async () => {
  const channel = await client.channels.fetch('1495985460281999522');
  if (channel?.isTextBased()) {
    const embed = new EmbedBuilder()
      .setTitle('🔰 PORTAL DE ACESSO - FAW')
      .setColor(0x800080)
      .setDescription(
        '### Protocolo de Identificação\n' +
        'Seja bem-vindo ao setor de triagem do laboratório **FAW**.\n\n' +
        'Para desbloquear o acesso completo ao servidor e aos laboratórios de pesquisa, clique no botão abaixo.\n\n' +
        '**Processo:**\n' +
        '1️⃣ Definição de codinome operacional.\n' +
        '2️⃣ Atribuição de Tag de Lealdade (Opcional).\n' +
        '3️⃣ Liberação de permissões de nível 1.'
      )
      .setFooter({ text: 'FAW Security Protocol | Acesso Restrito' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('faw_start_reg')
        .setLabel('Iniciar Registro')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🛡️')
    );

    await (channel as any).send({ embeds: [embed], components: [row] });
    console.log('Portal enviado com sucesso.');
  }
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});