import { 
  Events, 
  Interaction, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle, 
  ActionRowBuilder
} from 'discord.js';

export default {
  name: Events.InteractionCreate,
  async execute(interaction: Interaction) {
    const UNREG_ROLE_ID = '1495985456943202327';
    const MEMBER_ROLE_ID = '1493095650555068576';
    const TAG_ROLE_ID = '1495985457895309333';

    // 1. DISPARAR MODAL AO CLICAR NO BOTÃO
    if (interaction.isButton() && interaction.customId === 'faw_start_reg') {
      const modal = new ModalBuilder()
        .setCustomId('faw_reg_modal')
        .setTitle('CADASTRO OPERACIONAL');

      const nickInput = new TextInputBuilder()
        .setCustomId('reg_nick')
        .setLabel('NICKNAME DESEJADO')
        .setStyle(TextInputStyle.Short)
        .setMinLength(2)
        .setMaxLength(16)
        .setRequired(true);

      const tagInput = new TextInputBuilder()
        .setCustomId('reg_tag_opt')
        .setLabel('DESEJA A TAG [FAW] E COR ROXA? (SIM/NAO)')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(3)
        .setPlaceholder('Responda SIM ou NAO')
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(nickInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(tagInput)
      );

      return await interaction.showModal(modal);
    }

    // 2. PROCESSAR O FORMULÁRIO ENVIADO
    if (interaction.isModalSubmit() && interaction.customId === 'faw_reg_modal') {
      const nick = interaction.fields.getTextInputValue('reg_nick');
      const wantTag = interaction.fields.getTextInputValue('reg_tag_opt').toLowerCase() === 'sim';
      const member = interaction.member! as any;

      try {
        await interaction.deferReply({ ephemeral: true });

        let finalNick = nick;
        if (wantTag) {
          finalNick = `FAW | ${nick}`;
          await member.roles.add(TAG_ROLE_ID).catch(() => {});
        }

        await member.setNickname(finalNick).catch(() => {});
        await member.roles.add(MEMBER_ROLE_ID);
        await member.roles.remove(UNREG_ROLE_ID).catch(() => {});

        await interaction.editReply({ 
          content: `✅ **Acesso Concedido!** Bem-vindo, **${finalNick}**. Todos os setores foram liberados.` 
        });
      } catch (err) {
        console.error('Erro no registro:', err);
        await interaction.editReply({ content: '❌ **Falha:** Não foi possível aplicar seu registro. Avise a staff.' });
      }
    }
  }
};