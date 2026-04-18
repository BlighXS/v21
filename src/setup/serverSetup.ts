import type {
  ButtonInteraction,
  Guild,
  GuildBasedChannel,
  Message,
} from "discord.js";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionsBitField,
} from "discord.js";
import { buildEmbed } from "../utils/format.js";
import { isAdminMember } from "../utils/permissions.js";
import { logger } from "../utils/logger.js";

const SETUP_ID = "svrc";
const DELAY = 400; // anti rate limit

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const STRUCTURE = {
  roles: [
    {
      name: "Fundador",
      color: 0xf59e0b,
      reason: "Cargo de fundador do servidor",
    },
    { name: "Moderador", color: 0x3b82f6, reason: "Cargo de moderação" },
    {
      name: "Desenvolvedor",
      color: 0x8b5cf6,
      reason: "Cargo de desenvolvedor",
    },
    {
      name: "Reverser",
      color: 0xef4444,
      reason: "Cargo de engenharia reversa",
    },
    { name: "Membro", color: 0x22c55e, reason: "Cargo padrão de membro" },
    { name: "Novato", color: 0x6b7280, reason: "Cargo de novato" },
  ],
  categories: [
    {
      name: "📋 INICIO",
      channels: [
        {
          name: "regras",
          type: ChannelType.GuildText,
          topic: "Regras do servidor.",
        },
        {
          name: "avisos",
          type: ChannelType.GuildText,
          topic: "Avisos oficiais.",
        },
        { name: "apresentacoes", type: ChannelType.GuildText },
        { name: "geral", type: ChannelType.GuildText },
        { name: "boas-vindas", type: ChannelType.GuildText },
      ],
    },
    // restante igual...
  ],
};

function normalize(str: string) {
  return str.toLowerCase();
}

async function ensureRole(
  guild: Guild,
  name: string,
  color: number,
  reason: string,
) {
  const existing = guild.roles.cache.find(
    (r) => normalize(r.name) === normalize(name),
  );
  if (existing) return existing;

  try {
    const role = await guild.roles.create({ name, color, reason });
    await sleep(DELAY);
    return role;
  } catch (error) {
    logger.error({ error, name }, "Erro ao criar cargo");
    throw error;
  }
}

async function ensureCategory(guild: Guild, name: string) {
  const existing = guild.channels.cache.find(
    (c) =>
      c.type === ChannelType.GuildCategory &&
      normalize(c.name) === normalize(name),
  );

  if (existing) return existing;

  try {
    const cat = await guild.channels.create({
      name,
      type: ChannelType.GuildCategory,
    });

    await sleep(DELAY);
    return cat;
  } catch (error) {
    logger.error({ error, name }, "Erro ao criar categoria");
    throw error;
  }
}

async function ensureChannel(
  guild: Guild,
  parent: GuildBasedChannel,
  name: string,
  type: ChannelType,
  topic?: string,
) {
  const existing = guild.channels.cache.find(
    (c) =>
      c.parentId === parent.id &&
      normalize(c.name) === normalize(name) &&
      c.type === type,
  );

  if (existing) return existing;

  try {
    const channel = await guild.channels.create({
      name,
      type,
      parent,
      topic,
    });

    await sleep(DELAY);
    return channel;
  } catch (error) {
    logger.error({ error, name }, "Erro ao criar canal");
    throw error;
  }
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
        "topic" in channel ? channel.topic : undefined,
      );
    }
  }
}

export async function handleServerSetupCommand(message: Message) {
  if (!message.guild) return;

  if (!message.member || !isAdminMember(message.member)) {
    const embed = buildEmbed("Acesso negado", "Sem permissão.", "warn");
    await message.reply({ embeds: [embed] });
    return;
  }

  const embed = buildEmbed(
    "Setup do Servidor",
    "Criar estrutura base (cargos + canais)?",
    "info",
  );

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${SETUP_ID}:confirm`)
      .setLabel("Criar")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`${SETUP_ID}:cancel`)
      .setLabel("Cancelar")
      .setStyle(ButtonStyle.Secondary),
  );

  await message.reply({ embeds: [embed], components: [row] });
}

export async function handleServerSetupButton(interaction: ButtonInteraction) {
  if (!interaction.customId.startsWith(`${SETUP_ID}:`)) return false;

  if (!interaction.guild) {
    await interaction.reply({
      content: "Somente em servidor.",
      ephemeral: true,
    });
    return true;
  }

  if (
    !interaction.member ||
    !("permissions" in interaction.member) ||
    !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)
  ) {
    await interaction.reply({ content: "Sem permissão.", ephemeral: true });
    return true;
  }

  const action = interaction.customId.split(":")[1];

  if (action === "cancel") {
    await interaction.reply({
      embeds: [buildEmbed("Cancelado", "Nada foi feito.", "info")],
      ephemeral: true,
    });
    return true;
  }

  if (action === "confirm") {
    await interaction.reply({
      embeds: [buildEmbed("Executando", "Criando estrutura...", "action")],
      ephemeral: true,
    });

    try {
      await createStructure(interaction.guild);

      await interaction.followUp({
        embeds: [buildEmbed("Concluído", "Estrutura criada.", "ok")],
        ephemeral: true,
      });
    } catch (error) {
      logger.error({ error }, "Erro no setup");

      await interaction.followUp({
        embeds: [buildEmbed("Erro", "Falha ao criar estrutura.", "error")],
        ephemeral: true,
      });
    }

    return true;
  }

  return false;
}
