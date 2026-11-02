// Založí playtest: vlastný server (samostatný port, dočasná databáza — reštarty
// vývojového servera ho nezhodia), dva hráčske účty a rozohranú partiu.
//
// Použitie (z koreňa repozitára):
//   node --experimental-strip-types --no-warnings tools/playtest/zaloz.ts ["Meno hráča 1"] ["Meno hráča 2"] [kratka|stredna|dlha]
//
// Dĺžka hry = počet lokalít (3 / 5 / 7); predvolená je stredná.
//
// S prepínačom --bot hrá hráč 1 proti offline protihráčovi Štamgastovi
// (NPC na serveri); meno hráča 2 sa vtedy ignoruje a účet hráča 2 nevzniká.
//
// S prepínačom --zrejuca (Michal 2026-11-02) sa partia nezakladá na dočasnom serveri, ale na
// pokusnej Zrejúcej (<DOMENA z deploy/.env.produkcia>/zrejuca): hrajú ju AI účty postáv
// (tie isté, ktorými píšu spätnú väzbu, tools/playtest/web.ts) a hrá sa tam rozpracovaná sada
// tvorcu. Mená hráčov musia byť mená postáv z hraci.json (turnus.ts ich dáva sám).
//
// Vypíše cestu k relácii (playtest/<id>/); všetko ostatné je v <relacia>/hra.json.
// Server zastaví tools/playtest/ukonci.ts <relacia>. Viac partií naraz zakladá
// tools/playtest/turnus.ts — dáva im id prepínačom --id <id> (napr. 20261021-120000-2).

import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, openSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import WebSocket from "ws";
import { nastavDocasneEnv } from "../docasne.ts";

const protiBotovi = process.argv.includes("--bot");
const naZrejucej = process.argv.includes("--zrejuca");
const iId = process.argv.indexOf("--id");
const danyId = iId === -1 ? undefined : process.argv[iId + 1];
if (danyId !== undefined && !/^\d{8}-\d{6}(-\d)?$/.test(danyId)) {
  console.error("--id má tvar RRRRMMDD-HHMMSS alebo RRRRMMDD-HHMMSS-N.");
  process.exit(1);
}
const [meno1 = "Playtester 1", meno2 = "Playtester 2", dlzka = "stredna"] = process.argv
  .slice(2)
  .filter((a, j, v) => a !== "--bot" && a !== "--zrejuca" && a !== "--id" && v[j - 1] !== "--id");
if (!["kratka", "stredna", "dlha"].includes(dlzka)) {
  console.error("Dĺžka hry musí byť kratka, stredna alebo dlha.");
  process.exit(1);
}
for (const m of [meno1, meno2]) {
  if (m.trim().length < 2 || m.trim().length > 24) {
    console.error(`Meno „${m}“ musí mať 2 – 24 znakov.`);
    process.exit(1);
  }
}

function volnyPort(od: number): Promise<number> {
  return new Promise((ok) => {
    const s = createServer();
    s.once("error", () => ok(volnyPort(od + 1)));
    s.listen(od, () => s.close(() => ok(od)));
  });
}

const cas = new Date();
const id = danyId ?? cas.toISOString().slice(0, 19).replace(/[-:]/g, "").replace("T", "-");
const relacia = join("playtest", id);
const dataDir = resolve(relacia, "server-data");
for (const d of ["hrac1", "hrac2", "snimky", "server-data"]) mkdirSync(join(relacia, d), { recursive: true });

function pripoj(ws: string, cookie: string): Promise<WebSocket> {
  return new Promise((ok, zle) => {
    const spojenie = new WebSocket(`${ws}/ws`, { headers: { cookie } });
    spojenie.on("open", () => ok(spojenie));
    spojenie.on("error", zle);
  });
}
function cakaj(ws: WebSocket, typ: string): Promise<Record<string, unknown>> {
  return new Promise((ok) => {
    const f = (d: WebSocket.RawData): void => {
      const m = JSON.parse(String(d)) as Record<string, unknown>;
      if (m.type === typ) {
        ws.off("message", f);
        ok(m);
      }
    };
    ws.on("message", f);
  });
}

/** Hráč 1 založí miestnosť, hráč 2 sa pripojí (pri --bot hrá proti botovi); vráti kód miestnosti. */
async function zalozPartiu(ws: string, cookies: readonly string[]): Promise<string> {
  const w1 = await pripoj(ws, cookies[0] ?? "");
  const priv = cakaj(w1, "privitanie");
  const chyba = cakaj(w1, "error");
  w1.send(JSON.stringify({ type: "create", dlzka, bot: protiBotovi }));
  const prva = await Promise.race([priv, chyba]);
  if (prva.type === "error") throw new Error(String(prva.text));
  const kod = String(prva.code);
  if (!protiBotovi) {
    const w2 = await pripoj(ws, cookies[1] ?? "");
    const stav = cakaj(w2, "state");
    w2.send(JSON.stringify({ type: "join", code: kod }));
    await stav;
    w2.close();
  }
  w1.close();
  return kod;
}

if (naZrejucej) {
  const { prihlasAgenta, zrejucaWeb } = await import("./web.ts");
  const url = zrejucaWeb();
  const mena = [meno1, meno2].slice(0, protiBotovi ? 1 : 2);
  if (mena.some((m) => /^Playtester \d$/.test(m))) throw new Error("Na Zrejúcej hrajú AI účty postáv — zadaj mená postáv z tools/playtest/hraci.json.");
  const ucty = [];
  for (const m of mena) ucty.push(await prihlasAgenta(url, m));
  const kod = await zalozPartiu(url.replace(/^http/, "ws"), ucty.map((u) => u.cookie));
  const hraci = ucty.map(({ login, heslo, meno }) => ({ login, heslo, meno }));
  // Server nespúšťame — pid null; ukonci.ts ho preto nezastavuje.
  writeFileSync(join(relacia, "hra.json"), JSON.stringify({ id, url, kod, dlzka, pid: null, zalozena: cas.toISOString(), hraci, protiBotovi, zrejuca: true }, null, 2));
  console.log(`Playtest založený: ${relacia.split("\\").join("/")}`);
  console.log(`Server: ${url} (Zrejúca), miestnosť ${kod}`);
  console.log(`Hráč 1: ${hraci[0]?.meno ?? meno1} | Hráč 2: ${protiBotovi ? "Štamgast (offline protihráč)" : (hraci[1]?.meno ?? meno2)} | dĺžka hry: ${dlzka}`);
  process.exit(0);
}

if (!existsSync("apps/web/dist/index.html")) {
  console.error("Chýba zbuildovaný klient (apps/web/dist) — spusti najprv: npm run build --workspace=@naex/web");
  process.exit(1);
}

// Dočasné súbory servera na disk projektu, nie na C (Michal 2026-10-23) — server zdedí TEMP.
nastavDocasneEnv();

// Od 8800 — nižšie porty majú dev servery súbežných sessions (docs/SESSIONS.md).
const port = await volnyPort(8800);
const log = openSync(join(relacia, "server.log"), "a");
const server = spawn(process.execPath, ["--experimental-strip-types", "--no-warnings", "packages/server/src/index.ts"], {
  env: { ...process.env, PORT: String(port), NAEX_DATA: dataDir, NAEX_ADMIN_HESLO: "" },
  detached: true,
  stdio: ["ignore", log, log],
  windowsHide: true,
});
server.unref();
// Pri akejkoľvek chybe nižšie server zastav — inak by ostal visieť na porte.
process.on("uncaughtException", (err) => {
  console.error(`CHYBA: ${err.message}`);
  server.kill();
  process.exit(1);
});
process.on("unhandledRejection", (err) => {
  console.error(`CHYBA: ${err instanceof Error ? err.message : String(err)}`);
  server.kill();
  process.exit(1);
});
const api = `http://localhost:${port}/api`;

// Server pri prvom štarte plní databázu (karty, obrázky) — chvíľu to trvá.
for (let i = 0; ; i++) {
  try {
    if ((await fetch(`${api}/ja`)).ok) break;
  } catch {
    // ešte nebeží
  }
  if (i > 120) throw new Error(`Server sa nespustil — pozri ${join(relacia, "server.log")}`);
  await new Promise((ok) => setTimeout(ok, 500));
}

// Testovacie účty len pre túto dočasnú databázu.
const hraci = [
  { login: "hrac1", heslo: randomBytes(9).toString("base64url"), meno: meno1.slice(0, 24) },
  { login: "hrac2", heslo: randomBytes(9).toString("base64url"), meno: meno2.slice(0, 24) },
].slice(0, protiBotovi ? 1 : 2);
const cookies: string[] = [];
for (const h of hraci) {
  const r = await fetch(`${api}/registracia`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-naex": "1" },
    body: JSON.stringify(h),
  });
  if (!r.ok) throw new Error(`Registrácia ${h.login}: ${await r.text()}`);
  cookies.push((r.headers.get("set-cookie") ?? "").split(";")[0] ?? "");
}

const kod = await zalozPartiu(`ws://localhost:${port}`, cookies);

writeFileSync(join(relacia, "hra.json"), JSON.stringify({ id, port, kod, dlzka, pid: server.pid, zalozena: cas.toISOString(), hraci, protiBotovi }, null, 2));
// Lomky aj na Windows — cesta sa posiela agentom do príkazov.
console.log(`Playtest založený: ${relacia.split("\\").join("/")}`);
console.log(`Server: http://localhost:${port} (pid ${server.pid}), miestnosť ${kod}`);
console.log(`Hráč 1: ${meno1} | Hráč 2: ${protiBotovi ? "Štamgast (offline protihráč)" : meno2} | dĺžka hry: ${dlzka}`);
