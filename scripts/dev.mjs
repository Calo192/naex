// Spustí server aj klienta naraz — prenosne (na Windowse `a & b` v cmd.exe
// beží sekvenčne, takže klasický npm trik s `&` tu nefunguje).
import { spawn } from "node:child_process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";

const children = [
  ["server", ["run", "dev", "--workspace=@naex/server"]],
  ["web", ["run", "dev", "--workspace=@naex/web"]],
].map(([name, args]) => {
  const child = spawn(npm, args, { stdio: "inherit", shell: process.platform === "win32" });
  child.on("exit", (code) => {
    console.error(`[dev] ${name} skončil (kód ${code}) — ukončujem aj zvyšok.`);
    for (const other of children) if (other !== child) other.kill();
    process.exit(code ?? 0);
  });
  return child;
});

process.on("SIGINT", () => {
  for (const child of children) child.kill();
});
