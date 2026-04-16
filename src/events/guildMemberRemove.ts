import type { GuildMember, PartialGuildMember } from "discord.js";
import type { BotEvent } from "../utils/events.js";
import { logger } from "../utils/logger.js";
import { sendToLogChannel } from "../utils/logChannel.js";

const event: BotEvent = {
  name: "guildMemberRemove",
  async execute(member: GuildMember | PartialGuildMember) {
    const guild = member.guild;
    const user = member.user;
    if (!user) return;

    const memberCount = guild.memberCount;
    logger.info({ guildId: guild.id, userId: user.id, tag: user.tag }, "Membro saiu do servidor");

    await sendToLogChannel(
      member.client,
      "Membro saiu",
      `**${user.tag}** (${user.id}) saiu do servidor **${guild.name}**. Total: ${memberCount}`,
      "warn"
    );
  }
};

export default event;
