import { Message } from 'discord.js';

const BLACKLISTED_USERS = ['896137886070624338'];

/**
 * Handler principal de mensagens do FAW
 * Gerenciado autonomamente pela Fawers
 */
export const handleMessage = async (message: Message) => {
    // Ignora bots para evitar loop
    if (message.author.bot) return;

    // Blackhole Protocol: ignora usuários banidos pelo criador
    if (BLACKLISTED_USERS.includes(message.author.id)) return;

    const content = message.content.trim();

    // Comando !bomb solicitado pelo Criador (BlightG7)
    if (content.toLowerCase() === '!bomb') {
        try {
            await message.reply('Boom! 💣');
            console.log(`[FAWERS-CORE] Comando !bomb executado por ${message.author.tag}`);
        } catch (err) {
            console.error('[FAWERS-ERROR] Erro ao responder !bomb:', err);
        }
        return;
    }

    // Reconhecimento do Criador
    if (message.author.id === '892469618063589387') {
        // Silencioso, mas processando...
    }
};