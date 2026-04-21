import { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { config } from '../utils/config.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
client.login(config.DISCORD_TOKEN).then(async () => {
  const channel = await client.channels.fetch('1495985460281999522');
  if (channel?.isTextBased()) {
    // Primeiro, tenta enviar um texto simples para garantir que a comunicação existe
    await (channel as any).send('⚙️ **INICIALIZANDO PROTOCOLO DE ACESSO...**');

    const embed = new EmbedBuilder()
      .setTitle('🔰 PORTAL DE ACESSO - FAW')
      .setColor(0x800080)
      .setDescription(
        '### Verificação de Identidade\n' +
        'Clique no botão abaixo para iniciar o registro no banco de dados do FAW.\n\n' +
        '**Nota:** O processo é automatizado e instantâneo.'
      );

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('faw_start_reg')
        .setLabel('Iniciar Registro')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🛡️')
    );

    await (channel as any).send({ embeds: [embed], components: [row] }).catch(async () => {
        // Se o embed falhar, manda pelo menos o botão com texto
        await (channel as any).send({ 
            content: '🛡️ **CLIQUE ABAIXO PARA SE REGISTRAR:**',
            components: [row] 
        });
    });
    console.log('Setup forçado com sucesso.');
  }
  process.exit(0);
});