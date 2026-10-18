// Založí partiu AGENT PROTI ČLOVEKU. Agent má na webe účet „<meno> (AI)“,
// založí súkromnú miestnosť a človek sa do nej pripojí odkazom v prehliadači.
// Partia sa počíta do Frajeriny a štatistík oboch — je to normálna hra.
//
// Predvolene spustí VLASTNÝ server partie (bez --watch, port od 8800) nad tou
// istou databázou data/ ako vývojový server: miestnosti žijú len v pamäti
// servera, takže reštart vývojového servera po zmene kódu by rozohranú partiu
// zhodil. Prihlásenie z localhost:8787 platí aj tu (relácie sú v databáze,
// cookie nerozlišuje porty). Server zastaví tools/playtest/ukonci.ts <relacia>.
// S --url sa partia založí na existujúcom webe (napr. produkčnom) bez servera.
//
// Použitie (z koreňa repozitára):
//   node --experimental-strip-types --no-warnings tools/playtest/zaloz-clovek.ts "<meno agenta>" [kratka|stredna|dlha] [--url <web>]
//
// Agent potom hrá ako hráč 1: tools/playtest/hrac.ts <relacia> 1 cakaj|stav|tah …

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, openSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import WebSocket from "ws";
import { prihlasAgenta, webDostupny } from "./web.ts";

const DLZKY = ["kratka", "stredna", "dlha"] as const;
type Dlzka = (typeof DLZKY)[number];

const argv = process.argv.slice(2);
const iUrl = argv.indexOf("--url");
const volne = argv.filter((a, i) => a !== "--url" && argv[i - 1] !== "--url");
const [meno, dlzkaArg = "stredna"] = volne;
if (meno === undefined || meno.trim().length < 2) {
  console.error('Použitie: zaloz-clovek.ts "<meno agenta>" [kratka|stredna|dlha] [--url <web>]');
  process.exit(1);
}
if (!(DLZKY as readonly string[]).includes(dlzkaArg)) {
  console.error(`Dĺžka hry musí byť jedna z: ${DLZKY.join(", ")}.`);
  process.exit(1);
}
const dlzka = dlzkaArg as Dlzka;

const cas = new Date();
const id = `${cas.toISOString().slice(0, 19).replace(/[-:]/g, "").replace("T", "-")}-clovek`;
const relacia = join("playtest", id);
mkdirSync(join(relacia, "hrac1"), { recursive: true });

function volnyPort(od: number): Promise<number> {
  return new Promise((ok) => {
    const s = createServer();
    s.once("error", () => ok(volnyPort(od + 1)));
    s.listen(od, () => s.close(() => ok(od)));
  });
}

function najnovsiSubor(dir: string): number {
  let max = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    max = Math.max(max, e.isDirectory() ? najnovsiSubor(p) : statSync(p).mtimeMs);
  }
  return max;
}

/** Vlastný server servíruje zbuildovaného klienta — starý build by človeku ukázal staré rozhranie. */
function buildKlienta(): void {
  const index = "apps/web/dist/index.html";
  const zdroje = ["apps/web/src", "packages/core/src", "packages/core/data", "packages/tvorba/src"];
  const zmena = Math.max(statSync("apps/web/index.html").mtimeMs, ...zdroje.map(najnovsiSubor));
  if (existsSync(index) && statSync(index).mtimeMs >= zmena) return;
  console.log("Klient je starší než zdrojáky — buildujem (npm run build --workspace=@naex/web)…");
  const r = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build", "--workspace=@naex/web"], {
    stdio: ["ignore", "inherit", "inherit"],
    shell: process.platform === "win32",
  });
  if (r.status !== 0) {
    console.error("Build klienta zlyhal.");
    process.exit(1);
  }
}

let url: string;
let pid: number | undefined;
if (iUrl !== -1) {
  url = (argv[iUrl + 1] ?? "").replace(/\/+$/, "");
  if (!(await webDostupny(url))) {
    console.error(`Web ${url} nebeží.`);
    process.exit(1);
  }
} else {
  buildKlienta();
  const port = await volnyPort(8800);
  const log = openSync(join(relacia, "server.log"), "a");
  const server = spawn(
    process.execPath,
    ["--experimental-strip-types", "--no-warnings", "--env-file-if-exists=.env", "packages/server/src/index.ts"],
    { env: { ...process.env, PORT: String(port) }, detached: true, stdio: ["ignore", log, log], windowsHide: true },
  );
  server.unref();
  pid = server.pid;
  url = `http://localhost:${port}`;
  for (let i = 0; !(await webDostupny(url)); i++) {
    if (i > 60 || server.exitCode !== null) {
      server.kill();
      console.error(`Server partie sa nespustil — pozri ${join(relacia, "server.log")}`);
      process.exit(1);
    }
    await new Promise((ok) => setTimeout(ok, 500));
  }
}

const ucet = await prihlasAgenta(url, meno);
const ws = new WebSocket(`${url.replace(/^http/, "ws")}/ws`, { headers: { cookie: ucet.cookie } });
await new Promise<void>((ok, zle) => {
  ws.once("open", () => ok());
  ws.once("error", zle);
});
const odpoved = await new Promise<{ kod: string } | { chyba: string }>((ok) => {
  ws.on("message", (raw) => {
    const m = JSON.parse(String(raw)) as { type: string; code?: string; text?: string };
    if (m.type === "privitanie") ok({ kod: String(m.code) });
    if (m.type === "error") ok({ chyba: String(m.text) });
  });
  ws.send(JSON.stringify({ type: "create", verejna: false, dlzka }));
});
if ("chyba" in odpoved) {
  console.error(`Server odmietol založiť partiu: ${odpoved.chyba}`);
  ws.close();
  if (pid !== undefined) process.kill(pid);
  process.exitCode = 1;
  await new Promise((ok) => setTimeout(ok, 200));
  process.exit();
}
const kod = odpoved.kod;
// Miestnosť ostane čakať na súpera aj po odpojení agenta.
ws.close();

writeFileSync(
  join(relacia, "hra.json"),
  JSON.stringify(
    { id, rezim: "clovek", url, kod, dlzka, ...(pid !== undefined ? { pid } : {}), zalozena: cas.toISOString(), hraci: [{ login: ucet.login, heslo: ucet.heslo, meno: ucet.meno }] },
    null,
    2,
  ),
);

console.log(`Relácia: ${relacia.split("\\").join("/")}`);
if (pid !== undefined) console.log(`Server partie: ${url} (pid ${pid}, log ${resolve(relacia, "server.log")})`);
console.log(`Agent: ${ucet.meno} (hráč 1) · dĺžka hry: ${dlzka}`);
console.log(`Človek sa pripojí: ${url}/hra?kod=${kod}   (kód miestnosti ${kod})`);
