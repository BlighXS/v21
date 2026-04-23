import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import {
  Client,
  Collection,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  DMChannel,
} from "discord.js";

import { loadCommands } from "./utils/loadCommands.js";
import { loadEvents } from "./utils/loadEvents.js";
import { logger } from "./utils/logger.js";
import { config } from "./utils/config.js";

// ================= ENV =================
const fawEnvPath = path.join(process.cwd(), "faw.env");
dotenv.config({
  path: fs.existsSync(fawEnvPath) ? fawEnvPath : undefined,
  override: true,
});

// ================= INTENTS =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
  ],
  partials: [Partials.Channel],
});

client.commands = new Collection();

// ================= LOAD =================
await loadCommands(client);
await loadEvents(client);

// ================= PREFIX GUILD (ESSENCIAL) =================
client.on("messageCreate", async (message) => {
  try {
    if (!message.guild) return; // ignora DM
    if (message.author.bot) return;

    const prefix = config.PREFIX;
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const cmdName = args.shift()?.toLowerCase();

    const command = client.commands.get(cmdName);
    if (!command) return;

    await command.execute(message, args);
  } catch (err) {
    console.error("erro messageCreate:", err);
  }
});

// ================= REGISTRO =================
const UNREG_ROLE_ID = "1495985456943202327";
const MEMBER_ROLE_ID_REG = "1493095650555068576";
const TAG_ROLE_ID = "1495985457895309333";

client.on("interactionCreate", async (interaction) => {
  try {
    // Botão "Iniciar Registro" → abre modal
    if (interaction.isButton() && interaction.customId === "faw_start_reg") {
      const { ModalBuilder, TextInputBuilder, TextInputStyle } = await import("discord.js");
      const modal = new ModalBuilder()
        .setCustomId("faw_reg_modal")
        .setTitle("CADASTRO OPERACIONAL");

      const nickInput = new TextInputBuilder()
        .setCustomId("reg_nick")
        .setLabel("NICKNAME DESEJADO")
        .setStyle(TextInputStyle.Short)
        .setMinLength(2)
        .setMaxLength(16)
        .setRequired(true);

      const tagInput = new TextInputBuilder()
        .setCustomId("reg_tag_opt")
        .setLabel("DESEJA A TAG [FAW] E COR ROXA? (SIM/NAO)")
        .setStyle(TextInputStyle.Short)
        .setMaxLength(3)
        .setPlaceholder("SIM ou NAO")
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder<import("discord.js").TextInputBuilder>().addComponents(nickInput),
        new ActionRowBuilder<import("discord.js").TextInputBuilder>().addComponents(tagInput),
      );

      return await interaction.showModal(modal);
    }

    // Envio do modal → processa registro
    if (interaction.isModalSubmit() && interaction.customId === "faw_reg_modal") {
      const nick = interaction.fields.getTextInputValue("reg_nick");
      const wantTag = interaction.fields.getTextInputValue("reg_tag_opt").trim().toLowerCase() === "sim";
      const member = interaction.member as any;

      await interaction.deferReply({ ephemeral: true });

      let finalNick = nick;
      if (wantTag) {
        finalNick = `FAW | ${nick}`;
        await member.roles.add(TAG_ROLE_ID).catch(() => {});
      }

      await member.setNickname(finalNick).catch(() => {});
      await member.roles.add(MEMBER_ROLE_ID_REG).catch(() => {});
      await member.roles.remove(UNREG_ROLE_ID).catch(() => {});

      return await interaction.editReply({
        content: `✅ **Acesso Concedido!** Bem-vindo, **${finalNick}**. Todos os setores foram liberados.`,
      });
    }
  } catch (err) {
    console.error("Erro no registro:", err);
    try {
      const payload = { content: "❌ Falha no registro. Avise a staff.", flags: 64 };
      if ((interaction as any).deferred || (interaction as any).replied) {
        await (interaction as any).editReply(payload);
      } else {
        await (interaction as any).reply({ ...payload, ephemeral: true });
      }
    } catch {}
  }
});

// ================= LOGIN =================
client.login(config.DISCORD_TOKEN);