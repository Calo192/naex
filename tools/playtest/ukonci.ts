// Zastaví server playtestu (pid z <relacia>/hra.json). Dáta relácie ostávajú.
//   node --experimental-strip-types --no-warnings tools/playtest/ukonci.ts <relacia>

import { readFileSync } from "node:fs";
import { join } from "node:path";

const relacia = process.argv[2];
if (relacia === undefined) {
  console.error("Použitie: ukonci.ts <relacia>");
  process.exit(1);
}
const { pid, url } = JSON.parse(readFileSync(join(relacia, "hra.json"), "utf8")) as { pid: number | null; url?: string };
// Partia na Zrejúcej (zaloz.ts --zrejuca) beží na serveri webu — ten sa nezastavuje.
if (pid === null) {
  console.log(`Partia beží na ${url ?? "webe"} — server sa nezastavuje; dohratá partia ostáva v jej štatistikách.`);
  process.exit(0);
}
try {
  process.kill(pid);
  console.log(`Server playtestu (pid ${pid}) zastavený.`);
} catch {
  console.log(`Server playtestu (pid ${pid}) už nebeží.`);
}
