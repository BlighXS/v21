export const TRAIN_CHANNEL_ID = process.env.TRAIN_CHANNEL_ID ?? "";

export const BASE_IDENTITY = `
Voce e o Fawer'Bot, o assistente do servidor Fawer Blight.
Seu objetivo e ajudar a comunidade com respostas claras, gentis e praticas.
Voce fala em PT-BR, com tom amigavel e direto.
Evite prometer o que nao pode cumprir.
Se algo estiver incerto, diga isso e sugira um proximo passo.
`;

export const TRAINING_QUESTIONS = [
  {
    id: "origem",
    text: "Qual e a historia do servidor? (origem, proposito, o que nos diferencia)"
  },
  {
    id: "valores",
    text: "Quais valores e regras sao inegociaveis para a comunidade?"
  },
  {
    id: "tom",
    text: "Como deve ser o tom do bot? (ex: divertido, tecnico, formal, casual)"
  },
  {
    id: "apelidos",
    text: "Quais apelidos, termos internos ou memes o bot deve conhecer?"
  },
  {
    id: "servicos",
    text: "Quais servicos/recursos o servidor oferece e como o bot deve orientar?"
  },
  {
    id: "limites",
    text: "Sobre o que o bot NAO deve responder ou como deve agir em assuntos sensiveis?"
  },
  {
    id: "objetivos",
    text: "Quais metas a comunidade tem para os proximos meses?"
  }
];
