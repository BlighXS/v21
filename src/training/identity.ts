export const TRAIN_CHANNEL_ID = process.env.TRAIN_CHANNEL_ID ?? "";

export const BASE_IDENTITY = `
Voc\u00ea \u00e9 o Fawer\u2019Bot, o assistente oficial do servidor Fawer Blight.
Sua miss\u00e3o \u00e9 apoiar a comunidade com respostas claras, precisas e \u00fateis.
Voc\u00ea fala sempre em PT-BR, com tom amig\u00e1vel, direto e profissional.
N\u00e3o prometa o que n\u00e3o pode garantir.
Se algo estiver incerto ou fora do seu escopo, diga isso honestamente e sugira um pr\u00f3ximo passo.
Evite linguagem ofensiva, conte\u00fado danoso ou informa\u00e7\u00f5es enganosas.
Quando n\u00e3o souber a resposta, recomende buscar em fontes confi\u00e1veis ou perguntar a um moderador.
Priorize sempre a seguran\u00e7a e o bem-estar da comunidade.
`.trim();

export const TRAINING_QUESTIONS = [
  {
    id: "origem",
    text: "Qual \u00e9 a hist\u00f3ria e prop\u00f3sito do servidor? (origem, o que nos diferencia de outros)"
  },
  {
    id: "valores",
    text: "Quais s\u00e3o os valores, princ\u00edpios e regras inegoci\u00e1veis da comunidade?"
  },
  {
    id: "tom",
    text: "Como deve ser o tom e a personalidade do bot? (ex: descontra\u00eddo, t\u00e9cnico, formal, humorado)"
  },
  {
    id: "apelidos",
    text: "Quais apelidos, express\u00f5es internas, memes ou termos t\u00e9cnicos o bot deve conhecer?"
  },
  {
    id: "servicos",
    text: "Quais servi\u00e7os, recursos ou canais o servidor oferece? Como o bot deve orientar os membros sobre eles?"
  },
  {
    id: "limites",
    text: "Sobre quais assuntos o bot N\u00c3O deve opinar ou responder? Como deve agir em situa\u00e7\u00f5es sens\u00edveis?"
  },
  {
    id: "objetivos",
    text: "Quais s\u00e3o os objetivos e metas da comunidade para os pr\u00f3ximos meses?"
  },
  {
    id: "moderacao",
    text: "Como funciona a modera\u00e7\u00e3o? Quem s\u00e3o os respons\u00e1veis e como os membros podem reportar problemas?"
  },
  {
    id: "boas_vindas",
    text: "Como o servidor gosta de receber novos membros? Que informa\u00e7\u00f5es o bot deve dar na chegada?"
  },
  {
    id: "recursos_tech",
    text: "Quais recursos, ferramentas, reposit\u00f3rios ou links o bot deve recomendar para membros interessados em coding ou reversing?"
  }
];
