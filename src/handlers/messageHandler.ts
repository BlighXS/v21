// Arquivo atualizado com o comando !bomb
export const messageHandler = async (client, message) => {
    if (message.author.bot) return;

    const prefix = '!';
    if (!message.content.startsWith(prefix)) return;

    const command = message.content.slice(prefix.length).trim().split(/ +/).shift().toLowerCase();

    if (command === 'bomb') {
        return message.reply('Boom! 💣');
    }

    // ... outros comandos existentes ...
};