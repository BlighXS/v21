import { spawn } from "node:child_process";
import { logger } from "./logger.js";

export function restartProcess() {
  try {
    const node = process.execPath;
    const args = process.argv.slice(1);
    logger.warn({ args }, "Restart requested");
    spawn(node, args, {
      stdio: "inherit",
      env: process.env
    });
  } catch (error) {
    logger.error({ error }, "Failed to spawn restart process");
  } finally {
    setTimeout(() => process.exit(0), 200);
  }
}
