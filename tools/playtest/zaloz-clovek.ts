// Založí partiu AGENT PROTI ČLOVEKU na skutočnom webe (predvolene vývojový
// server http://localhost:8787). Agent má na webe účet „<meno> (AI)“, založí
// súkromnú miestnosť a človek sa do nej pripojí odkazom v prehliadači.
// Partia sa počíta do Frajeriny a štatistík oboch — je to normálna hra.
//
// Použitie (z koreňa repozitára):
//   node --experimental-strip-types --no-warnings tools/playtest/zaloz-clovek.ts "<meno agenta>" [kratka|stredna|dlha] [--url <web>]
//
// Agent potom hrá ako hráč 1: tools/playtest/hrac.ts <relacia> 1 cakaj|stav|tah …

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import WebSocket from "ws";
import { prihlasAgenta, webDostupny, webUrl } from "./web.ts";

const DLZKY = ["kratka", "stredna", "dlha"] as const;
type Dlzka = (typeof DLZKY)[number];

const volne = process.argv.slice(2).filter((a, i, all) => a !== "--url" && all[i - 1] !== "--url");
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
const url = webUrl();

if (!(await webDostupny(url))) {
  console.error(`Web ${url} nebeží. Spusti ho (npm run dev) alebo zadaj --url.`);
  process.exit(1);
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
  process.exitCode = 1;
  await new Promise((ok) => setTimeout(ok, 200));
  process.exit();
}
const kod = odpoved.kod;
// Miestnosť ostane čakať na súpera aj po odpojení agenta.
ws.close();

const cas = new Date();
const id = `${cas.toISOString().slice(0, 19).replace(/[-:]/g, "").replace("T", "-")}-clovek`;
const relacia = join("playtest", id);
mkdirSync(join(relacia, "hrac1"), { recursive: true });
writeFileSync(
  join(relacia, "hra.json"),
  JSON.stringify({ id, rezim: "clovek", url, kod, dlzka, zalozena: cas.toISOString(), hraci: [{ login: ucet.login, heslo: ucet.heslo, meno: ucet.meno }] }, null, 2),
);

console.log(`Relácia: ${relacia.split("\\").join("/")}`);
console.log(`Agent: ${ucet.meno} (hráč 1) · dĺžka hry: ${dlzka}`);
console.log(`Človek sa pripojí: ${url}/hra?kod=${kod}   (kód miestnosti ${kod})`);
