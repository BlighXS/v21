import AdmZip from "adm-zip";

export interface CodeBlock {
  lang: string;
  code: string;
  filename: string;
}

const LANG_EXT: Record<string, string> = {
  python: "py", py: "py",
  javascript: "js", js: "js",
  typescript: "ts", ts: "ts",
  c: "c",
  cpp: "cpp", "c++": "cpp",
  csharp: "cs", cs: "cs",
  rust: "rs",
  go: "go",
  java: "java",
  bash: "sh", shell: "sh", sh: "sh",
  powershell: "ps1",
  html: "html",
  css: "css",
  json: "json",
  yaml: "yaml", yml: "yaml",
  toml: "toml",
  makefile: "makefile",
  asm: "asm", assembly: "asm",
  text: "txt", txt: "txt"
};

export function extractCodeBlocks(text: string): CodeBlock[] {
  const regex = /```([a-zA-Z0-9+#]*)\n([\s\S]*?)```/g;
  const blocks: CodeBlock[] = [];
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = regex.exec(text)) !== null) {
    const lang = (match[1] || "txt").toLowerCase().trim();
    const code = match[2].trim();
    if (!code) continue;
    const ext = LANG_EXT[lang] || lang || "txt";
    const filename = `arquivo_${index + 1}.${ext}`;
    blocks.push({ lang, code, filename });
    index++;
  }

  return blocks;
}

export function hasCodeBlocks(text: string): boolean {
  return /```[a-zA-Z0-9+#]*\n[\s\S]*?```/.test(text);
}

export function createZip(files: Array<{ filename: string; content: string }>): Buffer {
  const zip = new AdmZip();
  for (const f of files) {
    zip.addFile(f.filename, Buffer.from(f.content, "utf8"));
  }
  return zip.toBuffer();
}

export async function readAttachmentText(url: string): Promise<string> {
  const { default: fetch } = await import("node-fetch");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao baixar arquivo: ${res.status}`);
  return await res.text();
}

const TEXT_EXTENSIONS = new Set([
  "txt", "py", "js", "ts", "c", "cpp", "cs", "h", "hpp", "rs", "go", "java",
  "sh", "bash", "ps1", "bat", "asm", "s", "html", "css", "json", "yaml", "yml",
  "toml", "md", "ini", "cfg", "conf", "xml", "sql", "lua", "rb", "php"
]);

export function isTextAttachment(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return TEXT_EXTENSIONS.has(ext);
}

export function isImageAttachment(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return ["png", "jpg", "jpeg", "gif", "webp", "bmp"].includes(ext);
}
