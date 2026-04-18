import { spawn } from "node:child_process";
import { logger } from "./logger.js";

let restarting = false;

export function restartProcess(): void {
  if (restarting) {
    logger.warn("Restart já em andamento, ignorando chamada duplicada");
    return;
  }

  restarting = true;

  try {
    const node = process.execPath;
    const args = process.argv.slice(1);

    logger.warn({ args, pid: process.pid }, "Restart solicitado");

    const child = spawn(node, args, {
      stdio: "inherit",
      env: {
        ...process.env,
        PROCESS_RESTARTED: "true",
      },
      detached: true,
    });

    child.on("error", (error) => {
      logger.error({ error }, "Erro ao spawnar novo processo");
    });

    // desanexa o filho (evita travar no pai)
    child.unref();
  } catch (error) {
    logger.error({ error }, "Falha ao reiniciar processo");
    restarting = false;
    return;
  }

  // dá tempo pro novo processo subir
  setTimeout(() => {
    logger.warn("Encerrando processo atual após restart");
    process.exit(0);
  }, 500);
}
