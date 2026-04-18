import type {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";

export type AnySlashCommandBuilder =
  | SlashCommandBuilder
  | SlashCommandOptionsOnlyBuilder
  | SlashCommandSubcommandsOnlyBuilder;

export interface SlashCommand {
  data: AnySlashCommandBuilder;

  // sempre async + protegido contra retorno inesperado
  execute: (interaction: ChatInputCommandInteraction) => Promise<unknown>;

  // controle de acesso
  adminOnly?: boolean;

  // opcional: nome cacheado (evita acessar builder toda hora)
  name?: string;

  // opcional: cooldown em ms (anti spam / abuso da IA)
  cooldownMs?: number;
}
