import type { ButtonInteraction, Guild, GuildBasedChannel, Message } from "discord.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField } from "discord.js";
import { buildEmbed } from "../utils/format.js";
import { isAdminMember } from "../utils/permissions.js";

const SETUP_ID = "svrc";

const STRUCTURE = {
  roles: [
    { name: "Fawle's", color: 0x4b5563, reason: "Menor cargo de permissao" },
    { name: "Novatos", color: 0x22c55e, reason: "Novatos da comunidade" }
  ],
  categories: [
    {
      name: "INICIO",
      channels: [
        { name: "regras", type: ChannelType.GuildText },
        { name: "avisos", type: ChannelType.GuildText },
        { name: "apresentacoes", type: ChannelType.GuildText },
        { name: "geral", type: ChannelType.GuildText }
      ]
    },
    {
      name: "CODDING",
      channels: [
        { name: "coding-geral", type: ChannelType.GuildText },
        { name: "ajuda", type: ChannelType.GuildText },
        { name: "projetos", type: ChannelType.GuildText },
        { name: "snippets", type: ChannelType.GuildText }
      ]
    },
    {
      name: "REVERSE-ENGINEERING",
      channels: [
        { name: "reversing-geral", type: ChannelType.GuildText },
        { name: "crackmes", type: ChannelType.GuildText },
        { name: "malware-lab", type: ChannelType.GuildText },
        { name: "ferramentas", type: ChannelType.GuildText }
      ]
    },
    {
      name: "LABORATORIO DIGITAL",
      channels: [
        { name: "lab-geral", type: ChannelType.GuildText },
        { name: "experimentos", type: ChannelType.GuildText },
        { name: "reports", type: ChannelType.GuildText }
      ]
    },
    {
      name: "VOZ",
      channels: [
        { name: "Geral", type: ChannelType.GuildVoice },
        { name: "Coding", type: ChannelType.GuildVoice },
        { name: "Lab", type: ChannelType.GuildVoice }
      ]
    }
  ]
};

function buildIntroEmbed() {
  const lines = [
    "Esse setup cria cargos, categorias e canais para um servidor de coding, engenharia reversa e laboratorio digital.",
    "Ele nao apaga nada existente. Apenas adiciona o que estiver faltando.",
    "Deseja criar agora?"
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
  type: ChannelType
) {
  const existing = guild.channels.cache.find(
    (c) => c.parentId === parent.id && c.name === name && c.type === type
  );
  if (existing) return existing;
  return guild.channels.create({ name, type, parent });
}

async function createStructure(guild: Guild) {
  for (const role of STRUCTURE.roles) {
    await ensureRole(guild, role.name, role.color, role.reason);
  }

  for (const category of STRUCTURE.categories) {
    const cat = await ensureCategory(guild, category.name);
    for (const channel of category.channels) {
      await ensureChannel(guild, cat, channel.name, channel.type);
    }
  }
}

export async function handleServerSetupCommand(message: Message) {
  if (!message.guild) return;
  if (!message.member || !isAdminMember(message.member)) {
    const embed = buildEmbed("Acesso negado", "Sem permissao para este comando.", "warn");
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
    await interaction.reply({ content: "Comando disponivel apenas em servidor.", ephemeral: true });
    return true;
  }

  if (!interaction.member || !("permissions" in interaction.member)) {
    await interaction.reply({ content: "Permissao insuficiente.", ephemeral: true });
    return true;
  }

  const memberPerms = interaction.member.permissions;
  if (!memberPerms.has(PermissionsBitField.Flags.Administrator)) {
    await interaction.reply({ content: "Permissao insuficiente.", ephemeral: true });
    return true;
  }

  const action = interaction.customId.split(":")[1];

  if (action === "cancel") {
    const embed = buildEmbed("Setup cancelado", "Sem alteracoes realizadas.", "info");
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return true;
  }

  if (action === "confirm") {
    const embed = buildEmbed("Setup em andamento", "Criando cargos e canais...", "action");
    await interaction.reply({ embeds: [embed], ephemeral: true });

    try {
      await createStructure(interaction.guild);
      const done = buildEmbed("Setup concluido", "Estrutura criada com sucesso.", "ok");
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
