import type { Message } from "discord.js";
import { logger } from "../utils/logger.js";
import { config } from "../utils/config.js";

const COMMAND_PREFIX = "!";
const COOLDOWN_MS = 2000;

const cooldowns = new Map<string, number>();

function isCreator(userId: string): boolean {
    return userId === "892469618063589387";
}

function isOnCooldown(userId: string): boolean {
    const last = cooldowns.get(userId);
    if (!last) return false;

    return Date.now() - last < COOLDOWN_MS;
}

function setCooldown(userId: string) {
    cooldowns.set(userId, Date.now());

    // cleanup automático simples
    setTimeout(() => cooldowns.delete(userId), COOLDOWN_MS * 2);
}

/**
 * Handler principal de mensagens do FAW
 */
export const handleMessage = async (message: Message) => {
    try {
        // ignora bots
        if (message.author.bot) return;

        const content = message.content?.trim();
        if (!content) return;

        const userId = message.author.id;

        // rate limit básico (anti spam)
        if (isOnCooldown(userId)) return;
        setCooldown(userId);

        // comandos simples
        if (!content.startsWith(COMMAND_PREFIX)) return;

        const cmd = content.toLowerCase();

        if (cmd === "!bomb") {
            try {
                await message.reply("Boom! 💣");

                logger.info(
                    {
                        userId,
                        tag: message.author.tag,
                        command: "!bomb",
                        guildId: message.guild?.id,
                    },
                    "Comando executado",
                );
            } catch (error) {
                logger.warn(
                    { error, userId },
                    "Erro ao executar comando !bomb",
                );
            }

            return;
        }

        // hook futuro para IA / comandos dinâmicos
        if (isCreator(userId)) {
            logger.debug({ userId, content }, "Mensagem do criador detectada");
            // espaço pra comandos avançados / execução IA
        }
    } catch (error) {
        logger.error({ error }, "Erro no handler de mensagem");
    }
};
