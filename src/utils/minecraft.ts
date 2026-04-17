import { spawn, ChildProcess } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import { createWriteStream, existsSync } from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { logger } from './logger.js';

const MC_DIR = path.join(process.cwd(), 'mc_server');
const JAR_URL = 'https://piston-data.mojang.com/v1/objects/593513cf3d0a2c710fd34a66a1532822a4d339d6/server.jar';
let mcProcess: ChildProcess | null = null;

export async function setupMC() {
  if (!existsSync(MC_DIR)) await mkdir(MC_DIR, { recursive: true });
  
  await writeFile(path.join(MC_DIR, 'eula.txt'), 'eula=true');
  await writeFile(path.join(MC_DIR, 'server.properties'), 'online-mode=false\ngamemode=survival\nmotd=FAW Lab - Mundo de Blight & Fawers\nmax-players=5\nserver-port=25565');

  const jarPath = path.join(MC_DIR, 'server.jar');
  if (existsSync(jarPath)) return true;

  return new Promise((resolve, reject) => {
    logger.info('Iniciando download do Server JAR 1.21.1...');
    const file = createWriteStream(jarPath);
    
    const download = (url: string) => {
      https.get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          download(response.headers.location!);
          return;
        }
        
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          logger.info('Download do Minecraft concluído com sucesso!');
          resolve(true);
        });
      }).on('error', (err) => {
        logger.error({ err }, 'Erro no download do MC Server');
        reject(err);
      });
    };
    
    download(JAR_URL);
  });
}

export function startMC(onData: (data: string) => void) {
  if (mcProcess) return 'Servidor já está rodando!';

  mcProcess = spawn('java', ['-Xmx4G', '-Xms2G', '-jar', 'server.jar', 'nogui'], {
    cwd: MC_DIR
  });

  mcProcess.stdout?.on('data', (data) => onData(data.toString()));
  mcProcess.stderr?.on('data', (data) => onData(data.toString()));

  mcProcess.on('close', () => {
    mcProcess = null;
  });

  return 'Iniciando processo Java...';
}

export function sendMCCommand(cmd: string) {
  if (mcProcess && mcProcess.stdin) {
    mcProcess.stdin.write(cmd + '\n');
  }
}