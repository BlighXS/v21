import type { Message } from "discord.js";

export interface PrefixCommand {
  trigger: string;
  description?: string;
  execute: (message: Message, args: string[]) => Promise<void>;
}

const registry = new Map<string, PrefixCommand>();

export function registerPrefixCommand(cmd: PrefixCommand): void {
  registry.set(cmd.trigger.toLowerCase(), cmd);
}

export function getPrefixCommand(trigger: string): PrefixCommand | undefined {
  return registry.get(trigger.toLowerCase());
}

export function getAllPrefixCommands(): PrefixCommand[] {
  return [...registry.values()];
}

export function hasPrefixCommand(trigger: string): boolean {
  return registry.has(trigger.toLowerCase());
}
