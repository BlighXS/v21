{ pkgs }: {
  deps = [
    pkgs.wget
    pkgs.openjdk8
    pkgs.ollama
    pkgs.unzip
  ];
}