import type {
  Message,
  TextChannel,
  AnyThreadChannel,
  GuildMember,
  Role,
  PermissionResolvable,
  Channel,
  ButtonInteraction,
} from 'discord.js';
import {
  ChannelType,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from 'discord.js';
import type { PrefixCommand } from '../../ai/commandRegistry.js';

type Track = 'malware' | 'ctf' | 'reverse';

type Question = {
  id: string;
  prompt: string;
  options: string[];
  answerIndex: number;
  explanation?: string;
};

type QuizResult = {
  userId: string;
  userTag: string;
  track: Track;
  scorePercent: number;
  correct: number;
  total: number;
  passed: boolean;
  roleAwarded?: string;
  roleIdAwarded?: string;
  threadId: string;
  startedAt: string;
  finishedAt: string;
};

type QuizConfig = {
  quizTesterChannelId?: string;
  resultsChannelId?: string;
  panelMessageId?: string;
};

const CONFIG_CHANNEL_FALLBACK_NAME = 'quiz-tester';
const RESULTS_CHANNEL_FALLBACK_NAME = 'quiz-resultados';

// Thresholds (0-100)
const THRESHOLDS: Record<Track, number> = {
  reverse: 70,
  ctf: 65,
  malware: 80,
};

// Role names expected in the server
const ROLE_BY_TRACK: Record<Track, string> = {
  reverse: 'Reverse Engineer',
  ctf: 'CTF Player',
  malware: 'Malware Lab',
};

// Minimal question banks — can be expanded later.
const BANK: Record<Track, Question[]> = {
  reverse: [
    {
      id: 'rev-1',
      prompt:
        'No contexto de reversing, qual ferramenta é mais adequada para análise estática de um binário (sem executar) com visualização de graphs? (escolha 1)',
      options: ['Wireshark', 'IDA/Ghidra', 'Burp Suite', 'Metasploit'],
      answerIndex: 1,
      explanation: 'IDA e Ghidra são as opções clássicas para disassembly/decompilation + graph view.',
    },
    {
      id: 'rev-2',
      prompt:
        'Em x86-64 System V (Linux), qual registrador normalmente carrega o 1º argumento de uma função? (escolha 1)',
      options: ['RDI', 'RCX', 'RAX', 'RSP'],
      answerIndex: 0,
      explanation: 'SysV AMD64: RDI, RSI, RDX, RCX, R8, R9.',
    },
    {
      id: 'rev-3',
      prompt: 'O que é “IAT” em PE (Windows)? (escolha 1)',
      options: [
        'Tabela de símbolos ELF',
        'Tabela de importação de APIs (Import Address Table)',
        'Heap do processo',
        'Seção de recursos',
      ],
      answerIndex: 1,
      explanation: 'IAT resolve endereços das funções importadas em tempo de load.',
    },
    {
      id: 'rev-4',
      prompt:
        'Qual flag de compilação mais comumente torna reversing mais difícil por remover símbolos/debug? (escolha 1)',
      options: ['-g', '-O0', '-s', '-fno-pie'],
      answerIndex: 2,
      explanation: '-s (strip) remove símbolos do binário.',
    },
    {
      id: 'rev-5',
      prompt: '“ASLR” impacta principalmente o quê? (escolha 1)',
      options: [
        'Ordem de bytes no registrador',
        'Endereços em memória (randomização de layout)',
        'Permissões de arquivo',
        'Velocidade do CPU',
      ],
      answerIndex: 1,
      explanation: 'ASLR randomiza bases/endereço de stack/heap/libs.',
    },
  ],
  ctf: [
    {
      id: 'ctf-1',
      prompt: 'Numa CTF, “web” geralmente envolve o quê? (escolha 1)',
      options: [
        'Explorar vulnerabilidades em apps HTTP',
        'Fuzzing de drivers kernel',
        'Ataques físicos (RFID)',
        'Reverse de firmware apenas',
      ],
      answerIndex: 0,
    },
    {
      id: 'ctf-2',
      prompt: 'Qual encoding é comum de ver em flags, tokens e blobs de dados em CTFs? (escolha 1)',
      options: ['Base64', 'EBCDIC', 'Morse binário', 'BCD'],
      answerIndex: 0,
    },
    {
      id: 'ctf-3',
      prompt: '“pwn” em CTF normalmente está mais associado a: (escolha 1)',
      options: [
        'Forense de disco',
        'Exploitação de binários (stack/heap, ROP)',
        'OSINT',
        'Criptografia simétrica',
      ],
      answerIndex: 1,
    },
    {
      id: 'ctf-4',
      prompt: 'Se um serviço remoto tem buffer overflow clássico, um primeiro passo útil é: (escolha 1)',
      options: [
        'Rodar nmap -sV',
        'Determinar offset e controlar RIP/EIP (pattern)',
        'Trocar DNS do domínio',
        'Bruteforce de senha do SSH',
      ],
      answerIndex: 1,
    },
    {
      id: 'ctf-5',
      prompt: 'O que geralmente diferencia “crypto” em CTF de “web”? (escolha 1)',
      options: [
        'Crypto foca em quebrar/abusar de algoritmos/protocolos matemáticos',
        'Crypto é só phishing',
        'Crypto é só recon',
        'Crypto é só bypass de captcha',
      ],
      answerIndex: 0,
    },
  ],
  malware: [
    {
      id: 'mal-1',
      prompt: 'Qual a melhor prática para analisar malware com segurança? (escolha 1)',
      options: [
        'Executar direto no host',
        'Executar em VM/sandbox isolada',
        'Executar como admin no PC pessoal',
        'Mandar pra amigos testarem',
      ],
      answerIndex: 1,
      explanation: 'VM isolada + snapshots + rede controlada.',
    },
    {
      id: 'mal-2',
      prompt: 'IOC significa: (escolha 1)',
      options: ['Indicator of Compromise', 'Index of Code', 'Internet of Ciphers', 'Instruction of Compiler'],
      answerIndex: 0,
    },
    {
      id: 'mal-3',
      prompt: 'Um “packer” em malware normalmente faz o quê? (escolha 1)',
      options: [
        'Compacta/obfusca para dificultar análise',
        'Aumenta performance do CPU',
        'Melhora a rede',
        'Assina digitalmente com CA',
      ],
      answerIndex: 0,
    },
    {
      id: 'mal-4',
      prompt: 'Persistência no Windows pode ser obtida com: (escolha 1)',
      options: ['Run keys/Task Scheduler/Services', 'Trocar wallpaper', 'Abrir calculadora', 'Mudar o hostname do roteador'],
      answerIndex: 0,
    },
    {
      id: 'mal-5',
      prompt: 'Qual ferramenta é típica para monitorar comportamento de processos (file/registry/network) em Windows durante análise? (escolha 1)',
      options: ['Procmon', 'GParted', 'PuTTY', 'MS Paint'],
      answerIndex: 0,
    },
  ],
};

const mem = new Map<string, QuizConfig>(); // per-guild

function getGuildCfg(guildId: string): QuizConfig {
  return mem.get(guildId) ?? {};
}

function setGuildCfg(guildId: string, patch: Partial<QuizConfig>): QuizConfig {
  const next = { ...getGuildCfg(guildId), ...patch };
  mem.set(guildId, next);
  return next;
}

function parseTrack(raw?: string): Track | null {
  const t = (raw || '').toLowerCase().trim();
  if (t === 'malware' || t === 'mal') return 'malware';
  if (t === 'ctf') return 'ctf';
  if (t === 'reverse' || t === 'rev' || t === 're' || t === 'reversing') return 'reverse';
  return null;
}

function pickQuestions(track: Track, count = 5): Question[] {
  const src = BANK[track];
  const shuffled = [...src].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

function normalizeAnswer(s: string): string {
  return s.trim().toLowerCase();
}

function toOptionIndex(input: string): number | null {
  const s = normalizeAnswer(input);
  // accept: a/b/c/d, 1/2/3/4
  const map: Record<string, number> = { a: 0, b: 1, c: 2, d: 3, e: 4 };
  if (s in map) return map[s]!;
  const n = Number.parseInt(s, 10);
  if (Number.isFinite(n) && n >= 1 && n <= 20) return n - 1;
  return null;
}

function isSnowflake(s?: string): boolean {
  if (!s) return false;
  return /^\d{15,22}$/.test(s);
}

function resolveChannelIdToken(token?: string): string | null {
  if (!token) return null;
  const m = token.match(/^(?:<#)?(\d{15,22})(?:>)?$/);
  return m?.[1] ?? null;
}

async function resolveTextChannel(message: Message, channelId: string): Promise<TextChannel | null> {
  if (!message.guild) return null;
  const ch = (await message.guild.channels.fetch(channelId).catch(() => null)) as Channel | null;
  if (!ch) return null;
  if (ch.type !== ChannelType.GuildText) return null;
  return ch as TextChannel;
}

async function findTextChannelByName(message: Message, name: string): Promise<TextChannel | null> {
  const ch = message.guild?.channels.cache.find(
    (c) => c.type === ChannelType.GuildText && c.name === name
  ) as TextChannel | undefined;
  return ch ?? null;
}

function hasManageGuildLike(member: GuildMember | null): boolean {
  if (!member) return false;
  return member.permissions.has(PermissionsBitField.Flags.ManageGuild as PermissionResolvable);
}

async function ensureInQuizTester(message: Message): Promise<boolean> {
  if (!message.guild) return false;
  if (message.channel.type !== ChannelType.GuildText) return false;

  const cfg = getGuildCfg(message.guild.id);
  if (cfg.quizTesterChannelId) {
    return message.channel.id === cfg.quizTesterChannelId;
  }

  return (message.channel as TextChannel).name === CONFIG_CHANNEL_FALLBACK_NAME;
}

function buildPanelComponents(disabled = false) {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('quiz:start:reverse')
      .setLabel('Reverse Engineer')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId('quiz:start:ctf')
      .setLabel('CTF Player')
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId('quiz:start:malware')
      .setLabel('Malware Lab')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled)
  );
  return [row];
}

async function createPrivateThread(message: Message, track: Track): Promise<AnyThreadChannel> {
  const parent = message.channel as TextChannel;
  const thread = await parent.threads.create({
    name: `quiz-${track}-${message.author.username}`.slice(0, 95),
    autoArchiveDuration: 60,
    type: ChannelType.PrivateThread,
    reason: `Quiz individual (${track}) para ${message.author.tag}`,
  });
  await thread.members.add(message.author.id);
  return thread;
}

async function runQuizInThread(thread: AnyThreadChannel, message: Message, track: Track): Promise<QuizResult> {
  const questions = pickQuestions(track, 5);
  const startedAt = new Date().toISOString();

  await thread.send(
    `⚙️ **Quiz ${track.toUpperCase()}**\n` +
      `- Responda com **A/B/C/D** (ou **1/2/3/4**)\n` +
      `- Você tem **45s por pergunta**\n` +
      `- Nota mínima pra passar: **${THRESHOLDS[track]}%**\n` +
      `\nVamos começar.`
  );

  let correct = 0;

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]!;
    const lines = q.options.map((opt, idx) => `${String.fromCharCode(65 + idx)}. ${opt}`).join('\n');

    await thread.send(`**Q${i + 1}/${questions.length}** — ${q.prompt}\n\n${lines}`);

    const collected = await thread.awaitMessages({
      filter: (m) => m.author.id === message.author.id,
      max: 1,
      time: 45_000,
    });

    const ansMsg = collected.first();
    if (!ansMsg) {
      await thread.send('⏱️ Tempo esgotado. Próxima.');
      continue;
    }

    const idx = toOptionIndex(ansMsg.content);
    if (idx === null) {
      await thread.send('Entrada inválida. Use A/B/C/D (ou 1/2/3/4). Próxima.');
      continue;
    }

    if (idx === q.answerIndex) {
      correct++;
      await thread.send('✅ Correto.');
    } else {
      const correctLetter = String.fromCharCode(65 + q.answerIndex);
      await thread.send(`❌ Errado. Correto: **${correctLetter}**.${q.explanation ? ` ${q.explanation}` : ''}`);
    }
  }

  const total = questions.length;
  const scorePercent = Math.round((correct / total) * 100);
  const passed = scorePercent >= THRESHOLDS[track];

  const finishedAt = new Date().toISOString();

  return {
    userId: message.author.id,
    userTag: message.author.tag,
    track,
    scorePercent,
    correct,
    total,
    passed,
    threadId: thread.id,
    startedAt,
    finishedAt,
  };
}

async function awardRoleIfPassed(message: Message, result: QuizResult): Promise<QuizResult> {
  if (!message.guild) return result;
  if (!result.passed) return result;

  const member = await message.guild.members.fetch(result.userId).catch(() => null);
  if (!member) return result;

  const roleName = ROLE_BY_TRACK[result.track];
  const role = message.guild.roles.cache.find((r) => r.name === roleName) as Role | undefined;
  if (!role) return result;

  await member.roles.add(role, `Quiz ${result.track}: ${result.scorePercent}%`).catch(() => null);

  return {
    ...result,
    roleAwarded: role.name,
    roleIdAwarded: role.id,
  };
}

async function postResultToChannel(message: Message, result: QuizResult): Promise<void> {
  if (!message.guild) return;

  const cfg = getGuildCfg(message.guild.id);
  let resultsCh: TextChannel | null = null;

  if (cfg.resultsChannelId) {
    resultsCh = await resolveTextChannel(message, cfg.resultsChannelId);
  }
  if (!resultsCh) {
    resultsCh = await findTextChannelByName(message, RESULTS_CHANNEL_FALLBACK_NAME);
  }
  if (!resultsCh) return;

  const base =
    `📊 **Resultado do Quiz**\n` +
    `• Usuário: <@${result.userId}> (**${result.userTag}**)\n` +
    `• Trilha: **${result.track.toUpperCase()}**\n` +
    `• Nota: **${result.scorePercent}%** (${result.correct}/${result.total})\n` +
    `• Status: **${result.passed ? 'APROVADO' : 'REPROVADO'}**\n` +
    `• Cargo: ${result.roleAwarded ? `✅ **${result.roleAwarded}**` : '—'}\n` +
    `• Thread: <#${result.threadId}>\n` +
    `• Fim: <t:${Math.floor(new Date(result.finishedAt).getTime() / 1000)}:R>`;

  await resultsCh.send({ content: base }).catch(() => null);
}

async function getConfiguredTesterChannel(message: Message): Promise<TextChannel | null> {
  if (!message.guild) return null;
  const cfg = getGuildCfg(message.guild.id);
  if (cfg.quizTesterChannelId) {
    return await resolveTextChannel(message, cfg.quizTesterChannelId);
  }
  return await findTextChannelByName(message, CONFIG_CHANNEL_FALLBACK_NAME);
}

async function sendOrRefreshPanel(message: Message): Promise<void> {
  if (!message.guild) return;

  const tester = await getConfiguredTesterChannel(message);
  if (!tester) {
    await message.reply('Não achei o canal de quiz-tester (configure com `;quiz setchannel`).');
    return;
  }

  const cfg = getGuildCfg(message.guild.id);

  const content =
    `🧪 **Painel de Quiz — Cargos Base**\n\n` +
    `Escolha uma trilha abaixo. Vou criar uma **thread privada** só pra você e aplicar o quiz.\n\n` +
    `📌 **Notas mínimas:**\n` +
    `• Reverse Engineer: **${THRESHOLDS.reverse}%**\n` +
    `• CTF Player: **${THRESHOLDS.ctf}%**\n` +
    `• Malware Lab: **${THRESHOLDS.malware}%**\n`;

  // If there is a saved panel message, try to edit it; otherwise send a new one.
  if (cfg.panelMessageId) {
    const old = await tester.messages.fetch(cfg.panelMessageId).catch(() => null);
    if (old) {
      await old.edit({ content, components: buildPanelComponents(false) }).catch(() => null);
      await message.reply(`✅ Painel atualizado em <#${tester.id}>.`);
      return;
    }
  }

  const sent = await tester.send({ content, components: buildPanelComponents(false) });
  setGuildCfg(message.guild.id, { panelMessageId: sent.id });
  await message.reply(`✅ Painel criado em <#${tester.id}>.`);
}

async function handleButton(interaction: ButtonInteraction) {
  if (!interaction.guild || !interaction.channel) return;

  const custom = interaction.customId;
  if (!custom.startsWith('quiz:start:')) return;

  const rawTrack = custom.split(':')[2];
  const track = parseTrack(rawTrack);
  if (!track) {
    await interaction.reply({ content: 'Trilha inválida.', ephemeral: true }).catch(() => null);
    return;
  }

  const guildId = interaction.guild.id;
  const cfg = getGuildCfg(guildId);

  // Only allow clicking inside the configured tester channel (if set)
  if (cfg.quizTesterChannelId && interaction.channelId !== cfg.quizTesterChannelId) {
    await interaction.reply({ content: 'Use o painel no canal de quiz configurado.', ephemeral: true }).catch(() => null);
    return;
  }

  // Create the private thread in the channel where the button lives (must be a text channel)
  if (interaction.channel.type !== ChannelType.GuildText) {
    await interaction.reply({ content: 'Esse painel precisa estar num canal de texto.', ephemeral: true }).catch(() => null);
    return;
  }

  const parent = interaction.channel as TextChannel;

  // Anti-spam: one active private thread per user per track in this channel
  const activeThread = parent.threads.cache.find(
    (t) =>
      t.type === ChannelType.PrivateThread &&
      t.name.includes(`quiz-${track}-`) &&
      t.name.endsWith(interaction.user.username)
  );

  if (activeThread) {
    await interaction.reply({ content: `Você já tem um quiz aberto: <#${activeThread.id}>.`, ephemeral: true }).catch(() => null);
    return;
  }

  // We need a Message-like object for the existing runner. We'll emulate minimal structure.
  const fakeMessage = {
    guild: interaction.guild,
    channel: parent,
    author: interaction.user,
    reply: async (content: string) => interaction.reply({ content, ephemeral: true }),
  } as any as Message;

  const thread = await createPrivateThread(fakeMessage, track);

  await interaction.reply({ content: `Thread criada: <#${thread.id}>. Vamos lá.`, ephemeral: true }).catch(() => null);

  let result = await runQuizInThread(thread, fakeMessage, track);
  result = await awardRoleIfPassed(fakeMessage, result);

  await thread.send(
    `\n🏁 **Final**\n` +
      `Sua nota: **${result.scorePercent}%** (${result.correct}/${result.total})\n` +
      `Mínimo: **${THRESHOLDS[track]}%**\n` +
      `${result.passed ? `✅ Aprovado — cargo: **${result.roleAwarded ?? ROLE_BY_TRACK[track]}**` : '❌ Reprovado — estuda e tenta de novo.'}`
  );

  await postResultToChannel(fakeMessage, result);
}

export const prefixCommand: PrefixCommand = {
  trigger: 'quiz',
  description:
    'Painel + quiz individual em thread privada. Admin: ;quiz setchannel <tester> <resultados> | ;quiz panel',

  async execute(message: Message, args: string[]) {
    if (!message.guild) {
      await message.reply('Esse comando só funciona em servidor.');
      return;
    }

    const sub = (args[0] || '').toLowerCase();

    // ;quiz setchannel <#quiz-tester> <#quiz-resultados>
    if (sub === 'setchannel' || sub === 'setchannels') {
      const member = await message.guild.members.fetch(message.author.id).catch(() => null);
      if (!hasManageGuildLike(member)) {
        await message.reply('Sem permissão: precisa **Gerenciar Servidor** para usar setchannel.');
        return;
      }

      const testerId = resolveChannelIdToken(args[1]);
      const resultsId = resolveChannelIdToken(args[2]);

      if (!isSnowflake(testerId) || !isSnowflake(resultsId)) {
        await message.reply(
          'Uso: `;quiz setchannel <#canal-quiz-tester> <#canal-quiz-resultados>`\n' +
            'Ex: `;quiz setchannel #quiz-tester #quiz-resultados`'
        );
        return;
      }

      const testerCh = await resolveTextChannel(message, testerId);
      const resultsCh = await resolveTextChannel(message, resultsId);

      if (!testerCh) {
        await message.reply('Canal de tester inválido (precisa ser canal de texto).');
        return;
      }
      if (!resultsCh) {
        await message.reply('Canal de resultados inválido (precisa ser canal de texto).');
        return;
      }

      setGuildCfg(message.guild.id, {
        quizTesterChannelId: testerId,
        resultsChannelId: resultsId,
      });

      await message.reply(
        `✅ Configurado.\n` + `• quiz-tester: <#${testerId}>\n` + `• quiz-resultados: <#${resultsId}>`
      );
      return;
    }

    // ;quiz panel -> posts/refreshes the button panel
    if (sub === 'panel' || sub === 'painel') {
      const member = await message.guild.members.fetch(message.author.id).catch(() => null);
      if (!hasManageGuildLike(member)) {
        await message.reply('Sem permissão: precisa **Gerenciar Servidor** para criar/atualizar o painel.');
        return;
      }
      await sendOrRefreshPanel(message);
      return;
    }

    // Back-compat: ;quiz <track>
    const track = parseTrack(args[0]);
    if (!track) {
      await message.reply(
        `Uso: \`;quiz <malware|ctf|reverse>\`\n` +
          `Painel: \`;quiz panel\`\n` +
          `Config: \`;quiz setchannel #quiz-tester #quiz-resultados\`\n` +
          `Mínimos: reverse=${THRESHOLDS.reverse}%, ctf=${THRESHOLDS.ctf}%, malware=${THRESHOLDS.malware}%`
      );
      return;
    }

    const inQuizTester = await ensureInQuizTester(message);
    if (!inQuizTester) {
      await message.reply(`Use isso apenas no canal de quiz (ex: **#${CONFIG_CHANNEL_FALLBACK_NAME}**).`);
      return;
    }

    const parent = message.channel as TextChannel;
    const activeThread = parent.threads.cache.find(
      (t) =>
        t.type === ChannelType.PrivateThread &&
        t.name.includes(`quiz-${track}-`) &&
        t.name.endsWith(message.author.username)
    );

    if (activeThread) {
      await message.reply(`Você já tem um quiz aberto: <#${activeThread.id}>. Finaliza lá.`);
      return;
    }

    const thread = await createPrivateThread(message, track);
    await message.reply(`Thread criada: <#${thread.id}>. Vou aplicar o quiz lá.`);

    let result = await runQuizInThread(thread, message, track);
    result = await awardRoleIfPassed(message, result);

    await thread.send(
      `\n🏁 **Final**\n` +
        `Sua nota: **${result.scorePercent}%** (${result.correct}/${result.total})\n` +
        `Mínimo: **${THRESHOLDS[track]}%**\n` +
        `${result.passed ? `✅ Aprovado — cargo: **${result.roleAwarded ?? ROLE_BY_TRACK[track]}**` : '❌ Reprovado — estuda e tenta de novo.'}`
    );

    await postResultToChannel(message, result);
  },

  // Hook para interações de botão (o loader do FAW chama isso quando existir)
  async onInteraction(interaction: any) {
    if (interaction?.isButton?.()) {
      await handleButton(interaction as ButtonInteraction);
    }
  },
};
