import type { ButtonInteraction, Guild, GuildBasedChannel, Message } from "discord.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField } from "discord.js";
import { buildEmbed } from "../utils/format.js";
import { isAdminMember } from "../utils/permissions.js";

const SETUP_ID = "svrc";

const STRUCTURE = {
  roles: [
    { name: "Fundador", color: 0xf59e0b, reason: "Cargo de fundador do servidor" },
    { name: "Moderador", color: 0x3b82f6, reason: "Cargo de modera\u00e7\u00e3o" },
    { name: "Desenvolvedor", color: 0x8b5cf6, reason: "Cargo de desenvolvedor" },
    { name: "Reverser", color: 0xef4444, reason: "Cargo de engenharia reversa" },
    { name: "Membro", color: 0x22c55e, reason: "Cargo padr\u00e3o de membro" },
    { name: "Novato", color: 0x6b7280, reason: "Cargo de novato" }
  ],
  categories: [
    {
      name: "\u{1F4CB} INICIO",
      channels: [
        { name: "regras", type: ChannelType.GuildText, topic: "Regras do servidor. Leia antes de participar." },
        { name: "avisos", type: ChannelType.GuildText, topic: "Avisos oficiais da staff." },
        { name: "apresentacoes", type: ChannelType.GuildText, topic: "Apresente-se para a comunidade!" },
        { name: "geral", type: ChannelType.GuildText, topic: "Chat geral da comunidade." },
        { name: "boas-vindas", type: ChannelType.GuildText, topic: "Boas-vindas aos novos membros." }
      ]
    },
    {
      name: "\u{1F4BB} CODING",
      channels: [
        { name: "coding-geral", type: ChannelType.GuildText, topic: "Discuss\u00f5es gerais sobre programa\u00e7\u00e3o." },
        { name: "ajuda", type: ChannelType.GuildText, topic: "Tire suas d\u00favidas de c\u00f3digo aqui." },
        { name: "projetos", type: ChannelType.GuildText, topic: "Compartilhe seus projetos e receba feedback." },
        { name: "snippets", type: ChannelType.GuildText, topic: "Trechos de c\u00f3digo \u00fateis." },
        { name: "recursos", type: ChannelType.GuildText, topic: "Links, tutoriais e materiais de estudo." }
      ]
    },
    {
      name: "\u{1F50D} REVERSE ENGINEERING",
      channels: [
        { name: "reversing-geral", type: ChannelType.GuildText, topic: "Discuss\u00f5es sobre engenharia reversa." },
        { name: "crackmes", type: ChannelType.GuildText, topic: "Desafios de crackme e CTF." },
        { name: "malware-lab", type: ChannelType.GuildText, topic: "An\u00e1lise de malware (ambiente controlado)." },
        { name: "ferramentas", type: ChannelType.GuildText, topic: "Ferramentas de reversing: Ghidra, IDA, x64dbg, etc." }
      ]
    },
    {
      name: "\u{1F9EA} LABORATORIO DIGITAL",
      channels: [
        { name: "lab-geral", type: ChannelType.GuildText, topic: "Discuss\u00f5es do laborat\u00f3rio digital." },
        { name: "experimentos", type: ChannelType.GuildText, topic: "Resultados de experimentos e pesquisas." },
        { name: "reports", type: ChannelType.GuildText, topic: "Relat\u00f3rios e documenta\u00e7\u00e3o." }
      ]
    },
    {
      name: "\u{1F4AC} COMUNIDADE",
      channels: [
        { name: "off-topic", type: ChannelType.GuildText, topic: "Assuntos gerais que n\u00e3o se encaixam em outros canais." },
        { name: "memes", type: ChannelType.GuildText, topic: "Memes e humor da comunidade." },
        { name: "spotify", type: ChannelType.GuildText, topic: "Busca e compartilhamento de m\u00fasicas via bot." }
      ]
    },
    {
      name: "\u{1F916} BOT",
      channels: [
        { name: "bot-comandos", type: ChannelType.GuildText, topic: "Use os comandos do bot aqui." },
        { name: "logs", type: ChannelType.GuildText, topic: "Logs autom\u00e1ticos do servidor." }
      ]
    },
    {
      name: "\u{1F3A4} VOZ",
      channels: [
        { name: "Geral", type: ChannelType.GuildVoice },
        { name: "Coding", type: ChannelType.GuildVoice },
        { name: "Lab", type: ChannelType.GuildVoice },
        { name: "AFK", type: ChannelType.GuildVoice }
      ]
    }
  ]
};

function buildIntroEmbed() {
  const totalChannels = STRUCTURE.categories.reduce((acc, cat) => acc + cat.channels.length, 0);
  const lines = [
    "Este setup cria a estrutura completa do servidor Fawer Blight.",
    `Ser\u00e3o criados **${STRUCTURE.roles.length} cargos** e **${totalChannels} canais** em **${STRUCTURE.categories.length} categorias**.`,
    "Nada existente ser\u00e1 apagado. Apenas o que estiver faltando ser\u00e1 adicionado.",
    "",
    "Deseja criar a estrutura agora?"
  ].join("\n");
  return buildEmbed("Setup do Servidor", lines, "info");
}

function buildButtonsRow(disabled = false) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${SETUP_ID}:confirm`)
      .setLabel("Criar agora")
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(`${SETUP_ID}:cancel`)
      .setLabel("Cancelar")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled)
  );
}

async function ensureRole(guild: Guild, name: string, color: number, reason: string) {
  const existing = guild.roles.cache.find((r) => r.name === name);
  if (existing) return existing;
  return guild.roles.create({ name, color, reason });
}

async function ensureCategory(guild: Guild, name: string) {
  const existing = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildCategory && c.name === name
  );
  if (existing) return existing;
  return guild.channels.create({ name, type: ChannelType.GuildCategory });
}

async function ensureChannel(
  guild: Guild,
  parent: GuildBasedChannel,
  name: string,
  type: ChannelType,
  topic?: string
) {
  const existing = guild.channels.cache.find(
    (c) => c.parentId === parent.id && c.name === name && c.type === type
  );
  if (existing) return existing;
  return guild.channels.create({ name, type, parent, topic });
}

async function createStructure(guild: Guild) {
  for (const role of STRUCTURE.roles) {
    await ensureRole(guild, role.name, role.color, role.reason);
  }

  for (const category of STRUCTURE.categories) {
    const cat = await ensureCategory(guild, category.name);
    for (const channel of category.channels) {
      await ensureChannel(
        guild,
        cat,
        channel.name,
        channel.type,
        "topic" in channel ? channel.topic : undefined
      );
    }
  }
}

export async function handleServerSetupCommand(message: Message) {
  if (!message.guild) return;
  if (!message.member || !isAdminMember(message.member)) {
    const embed = buildEmbed("Acesso negado", "Sem permiss\u00e3o para este comando.", "warn");
    await message.reply({ embeds: [embed] });
    return;
  }

  const embed = buildIntroEmbed();
  const row = buildButtonsRow(false);
  await message.reply({ embeds: [embed], components: [row] });
}

export async function handleServerSetupButton(interaction: ButtonInteraction) {
  if (!interaction.customId.startsWith(`${SETUP_ID}:`)) return false;

  if (!interaction.guild) {
    await interaction.reply({ content: "Comando dispon\u00edvel apenas em servidor.", ephemeral: true });
    return true;
  }

  if (!interaction.member || !("permissions" in interaction.member)) {
    await interaction.reply({ content: "Permiss\u00e3o insuficiente.", ephemeral: true });
    return true;
  }

  const memberPerms = interaction.member.permissions;
  if (!memberPerms.has(PermissionsBitField.Flags.Administrator)) {
    await interaction.reply({ content: "Permiss\u00e3o insuficiente.", ephemeral: true });
    return true;
  }

  const action = interaction.customId.split(":")[1];

  if (action === "cancel") {
    const embed = buildEmbed("Setup cancelado", "Nenhuma altera\u00e7\u00e3o foi realizada.", "info");
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return true;
  }

  if (action === "confirm") {
    const embed = buildEmbed("Setup em andamento", "Criando cargos, categorias e canais...", "action");
    await interaction.reply({ embeds: [embed], ephemeral: true });

    try {
      await createStructure(interaction.guild);
      const done = buildEmbed(
        "Setup conclu\u00eddo",
        "Estrutura criada com sucesso!\nConfigure o `LOG_CHANNEL_ID` com o ID do canal `#logs` para ativar logs autom\u00e1ticos.",
        "ok"
      );
      await interaction.followUp({ embeds: [done], ephemeral: true });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      const fail = buildEmbed("Falha no setup", msg, "error");
      await interaction.followUp({ embeds: [fail], ephemeral: true });
    }

    return true;
  }

  return false;
}
