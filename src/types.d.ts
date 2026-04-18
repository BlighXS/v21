import type { Collection } from "discord.js";
import type { SlashCommand } from "@/utils/types.js";

declare module "discord.js" {
  interface Client {
    commands: Collection<string, SlashCommand>;
  }
}

export {};
