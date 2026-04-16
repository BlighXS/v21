export interface ProjectFile {
  filename: string;
  content: string;
}

export type ProjectType = "python" | "c" | "cpp" | "node" | "rust" | "asm";

const ALIASES: Record<string, ProjectType> = {
  python: "python", py: "python",
  c: "c",
  cpp: "cpp", "c++": "cpp",
  node: "node", nodejs: "node", js: "node", javascript: "node",
  rust: "rust", rs: "rust",
  asm: "asm", assembly: "asm", nasm: "asm"
};

export function resolveProjectType(input: string): ProjectType | null {
  return ALIASES[input.toLowerCase()] ?? null;
}

export function getProjectTemplate(type: ProjectType, name: string): ProjectFile[] {
  const safe = name.replace(/[^a-zA-Z0-9_-]/g, "_") || "projeto";

  if (type === "python") {
    return [
      {
        filename: "main.py",
        content: `#!/usr/bin/env python3
# ${safe} — gerado pela Fawers (FAW)

def main():
    print("${safe} iniciado")

if __name__ == "__main__":
    main()
`
      },
      {
        filename: "requirements.txt",
        content: `# Dependências do ${safe}
# Adicione os pacotes necessários aqui
`
      },
      {
        filename: "README.md",
        content: `# ${safe}

Projeto base Python gerado pela Fawers — FAW.

## Uso
\`\`\`bash
python main.py
\`\`\`
`
      }
    ];
  }

  if (type === "c") {
    return [
      {
        filename: "main.c",
        content: `#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// ${safe} — gerado pela Fawers (FAW)

int main(int argc, char *argv[]) {
    printf("${safe} iniciado\\n");
    return 0;
}
`
      },
      {
        filename: "Makefile",
        content: `CC = gcc
CFLAGS = -Wall -Wextra -O2
TARGET = ${safe}
SRC = main.c

all: $(TARGET)

$(TARGET): $(SRC)
\t$(CC) $(CFLAGS) -o $(TARGET) $(SRC)

clean:
\trm -f $(TARGET)

.PHONY: all clean
`
      },
      {
        filename: "README.md",
        content: `# ${safe}

Projeto base C gerado pela Fawers — FAW.

## Compilar
\`\`\`bash
make
\`\`\`

## Limpar
\`\`\`bash
make clean
\`\`\`
`
      }
    ];
  }

  if (type === "cpp") {
    return [
      {
        filename: "main.cpp",
        content: `#include <iostream>
#include <string>
#include <vector>

// ${safe} — gerado pela Fawers (FAW)

int main(int argc, char* argv[]) {
    std::cout << "${safe} iniciado" << std::endl;
    return 0;
}
`
      },
      {
        filename: "Makefile",
        content: `CXX = g++
CXXFLAGS = -Wall -Wextra -O2 -std=c++17
TARGET = ${safe}
SRC = main.cpp

all: $(TARGET)

$(TARGET): $(SRC)
\t$(CXX) $(CXXFLAGS) -o $(TARGET) $(SRC)

clean:
\trm -f $(TARGET)

.PHONY: all clean
`
      },
      {
        filename: "README.md",
        content: `# ${safe}

Projeto base C++ gerado pela Fawers — FAW.

## Compilar
\`\`\`bash
make
\`\`\`
`
      }
    ];
  }

  if (type === "node") {
    return [
      {
        filename: "index.js",
        content: `#!/usr/bin/env node
// ${safe} — gerado pela Fawers (FAW)

"use strict";

function main() {
  console.log("${safe} iniciado");
}

main();
`
      },
      {
        filename: "package.json",
        content: JSON.stringify(
          {
            name: safe.toLowerCase(),
            version: "1.0.0",
            description: `Projeto ${safe} — FAW`,
            main: "index.js",
            scripts: { start: "node index.js" },
            keywords: [],
            author: "BlightG7",
            license: "MIT"
          },
          null,
          2
        ) + "\n"
      },
      {
        filename: ".gitignore",
        content: `node_modules/
*.log
`
      },
      {
        filename: "README.md",
        content: `# ${safe}

Projeto base Node.js gerado pela Fawers — FAW.

## Uso
\`\`\`bash
node index.js
\`\`\`
`
      }
    ];
  }

  if (type === "rust") {
    return [
      {
        filename: "src/main.rs",
        content: `// ${safe} — gerado pela Fawers (FAW)

fn main() {
    println!("${safe} iniciado");
}
`
      },
      {
        filename: "Cargo.toml",
        content: `[package]
name = "${safe.toLowerCase()}"
version = "0.1.0"
edition = "2021"
authors = ["BlightG7"]

[dependencies]
`
      },
      {
        filename: "README.md",
        content: `# ${safe}

Projeto base Rust gerado pela Fawers — FAW.

## Compilar e rodar
\`\`\`bash
cargo run
\`\`\`
`
      }
    ];
  }

  if (type === "asm") {
    return [
      {
        filename: "main.asm",
        content: `; ${safe} — gerado pela Fawers (FAW)
; NASM x86_64 Linux

section .data
    msg db "${safe} iniciado", 0x0A
    msg_len equ $ - msg

section .bss

section .text
    global _start

_start:
    ; escreve msg no stdout
    mov rax, 1          ; syscall write
    mov rdi, 1          ; fd stdout
    mov rsi, msg
    mov rdx, msg_len
    syscall

    ; exit 0
    mov rax, 60
    xor rdi, rdi
    syscall
`
      },
      {
        filename: "Makefile",
        content: `NASM = nasm
LD = ld
TARGET = ${safe}
SRC = main.asm

all: $(TARGET)

$(TARGET): $(SRC)
\t$(NASM) -f elf64 -o $(TARGET).o $(SRC)
\t$(LD) -o $(TARGET) $(TARGET).o

clean:
\trm -f $(TARGET) $(TARGET).o

.PHONY: all clean
`
      },
      {
        filename: "README.md",
        content: `# ${safe}

Projeto base Assembly (NASM x86_64 Linux) gerado pela Fawers — FAW.

## Compilar
\`\`\`bash
make
\`\`\`

## Executar
\`\`\`bash
./${safe}
\`\`\`
`
      }
    ];
  }

  return [];
}
