// Z výsledku spustace.ts poskladá docs/napady/analyza-spustacov.html (čísla sa neprepisujú ručne).
//
//   node --experimental-strip-types --no-warnings docs/napady/revizia-sady/skript/spustace-html.ts

import { readFileSync, writeFileSync } from "node:fs";

interface Karta {
  id: string;
  name: string;
  tags: string[];
  triggers: string[];
  text: string;
  kopie: number;
  vylozene: { linia: number; dedicstvo: number };
  dosah: { stavba: number; senok: number; ruka: number };
  spustace: Record<string, { prilezitosti: number; ucinky: number }>;
}
interface Vysledok {
  partii: number;
  okamihy: Record<string, number>;
  bitiek: number;
  zhodaBitky: number;
  allTriggers: string[];
  karty: Karta[];
}

const d = JSON.parse(readFileSync(new URL("./spustace-vysledok.json", import.meta.url), "utf8")) as Vysledok;
const P = d.partii;
const KLIATBY = new Set(["dlh", "cirhoza", "abstak"]);
const f = (x: number, n = 2): string => x.toFixed(n).replace(".", ",");
const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const druh = (c: Karta): string =>
  KLIATBY.has(c.id) ? "Kliatba" : c.tags.includes("Lokalita") ? "Lokalita" : c.tags.includes("Starešina") ? "Starešina" : c.tags.includes("Nástroj") ? "Nástroj" : c.tags.includes("Občan") ? "Občan" : "Zviera";
const START = new Set(["ministrant", "milujuca_manzelka", "pijan", "dievcina_na_vydaj"]);

// --- Agregácia po spúšťačoch (kliatby zvlášť: vznikajú akciami, nie sú v sade ako kópie).
interface Agg { karty: number; kopie: number; pril: number; uc: number; druhy: Record<string, number>; kliatby: number }
const agg: Record<string, Agg> = {};
for (const t of [...d.allTriggers]) agg[t] = { karty: 0, kopie: 0, pril: 0, uc: 0, druhy: {}, kliatby: 0 };
for (const c of d.karty) {
  for (const t of c.triggers) {
    const a = (agg[t] ??= { karty: 0, kopie: 0, pril: 0, uc: 0, druhy: {}, kliatby: 0 });
    const s = c.spustace[t] ?? { prilezitosti: 0, ucinky: 0 };
    if (KLIATBY.has(c.id)) {
      a.kliatby += s.prilezitosti;
      continue;
    }
    a.karty++;
    a.kopie += c.kopie;
    a.pril += s.prilezitosti;
    a.uc += s.ucinky;
    a.druhy[druh(c)] = (a.druhy[druh(c)] ?? 0) + 1;
  }
}

const OKAMIH: Record<string, string> = {
  Nástup: `${f(d.okamihy.vylozenie! / P, 1)} vyložení`,
  Furt: "stav — ráta sa raz za kolo v línii",
  Bitka: `${f(d.okamihy.bitka! / P, 1)} bitiek`,
  Pitka: `${f(d.okamihy.pitka! / P, 1)} Pitiek`,
  Zhromaždenie: `${f(d.okamihy.zhromazdenie! / P, 1)} Zhromaždení`,
  Dedičstvo: "stav — raz za kolo v Dedičstve",
  Výhra: `${f(d.okamihy.vyhra! / P, 1)} víťazov bitky`,
  Prehra: `${f(d.okamihy.prehra! / P, 1)} porazených`,
  Prestávka: "— (fáza už neexistuje)",
  Exekúcia: `${f(d.okamihy.exekucia! / P, 1)} exekúcií`,
};
const VERDIKT_T: Record<string, [string, string]> = {
  Exekúcia: ["mrtvy", "mŕtvy — okamih nenastal ani raz"],
  Prestávka: ["mrtvy", "prázdny — žiadna karta"],
  Dedičstvo: ["malo", "málo využívaný"],
  Prehra: ["malo", "málo využívaný"],
  Nástup: ["prilezitost", "voľný — častý okamih, málo kariet"],
  Pitka: ["prilezitost", "voľný — najčastejší okamih, takmer bez Občanov"],
  Výhra: ["pozor", "zdanlivo silný — celé číslo je Miňištrant"],
  Zhromaždenie: ["ok", "len lokality, stále pravidlo"],
  Furt: ["pretazeny", "preťažený počtom, slabý účinkom"],
  Bitka: ["pretazeny", "preťažený — s kliatbami, lokalitami a staršími"],
};

const poradie = Object.entries(agg).sort((a, b) => a[1].uc - b[1].uc || a[1].karty - b[1].karty);
const maxUc = Math.max(...poradie.map(([, a]) => a.uc / P));

const riadkySpust = poradie
  .map(([t, a]) => {
    const [trieda, slovo] = VERDIKT_T[t] ?? ["", ""];
    const druhy = Object.entries(a.druhy).map(([k, n]) => `${n} ${k}`).join(", ");
    const naKopiu = a.kopie > 0 ? f(a.uc / P / a.kopie, 3) : "–";
    const pct = a.pril > 0 ? `${Math.round((100 * a.uc) / a.pril)} %` : "–";
    return `<tr class="${trieda}"><td><b>${t}</b><br><span class="pozn">${druhy || "—"}</span></td><td>${a.karty}</td><td>${a.kopie}</td><td class="pozn">${OKAMIH[t] ?? ""}</td><td>${f(a.pril / P)}</td><td><b>${f(a.uc / P)}</b></td><td>${naKopiu}</td><td>${pct}</td><td class="vl">${slovo}</td></tr>`;
  })
  .join("\n");

const pruhy = [...poradie]
  .map(([t, a]) => {
    const w = maxUc > 0 ? (100 * a.uc) / P / maxUc : 0;
    const [trieda] = VERDIKT_T[t] ?? [""];
    return `<div class="pruh ${trieda}"><span class="meno">${t}</span><span class="dráha"><span class="vypln" style="width:${w.toFixed(1)}%"></span></span><span class="cislo">${f(a.uc / P)}</span></div>`;
  })
  .join("\n");

// --- Karty
interface Riadok { c: Karta; t: string; pril: number; uc: number; stav: string; trieda: string }
const riadky: Riadok[] = [];
for (const c of d.karty) {
  if (KLIATBY.has(c.id)) continue;
  for (const t of c.triggers) {
    const s = c.spustace[t] ?? { prilezitosti: 0, ucinky: 0 };
    const pril = s.prilezitosti / P;
    const uc = s.ucinky / P;
    const dr = druh(c);
    const kartaVBalicku = dr === "Občan" || dr === "Zviera" || dr === "Nástroj";
    let stav = "";
    let trieda = "";
    if (kartaVBalicku && !START.has(c.id) && c.dosah.ruka === 0) {
      stav = "nedostane sa do hry (bot ju zo šenku nikdy nevzal)";
      trieda = "mrtvy";
    } else if (t === "Exekúcia") {
      stav = "okamih nenastal (žiadna exekúcia)";
      trieda = "mrtvy";
    } else if (uc < 0.1 && pril < 0.25) {
      stav = "zriedka v hre";
      trieda = "malo";
    } else if (uc < 0.1 || (pril >= 1 && uc / pril < 0.15)) {
      stav = "v hre, efekt nezaberá";
      trieda = "malo";
    } else if (uc >= 1 || (pril > 0 && uc / pril >= 0.6)) {
      stav = "spoľahlivý";
      trieda = "ok";
    }
    riadky.push({ c, t, pril, uc, stav, trieda });
  }
}
riadky.sort((a, b) => a.uc - b.uc || a.pril - b.pril);
const riadkyKariet = riadky
  .map((r) => {
    const dr = druh(r.c);
    const ruka = dr === "Lokalita" ? "–" : `${r.c.dosah.ruka}/${P}`;
    const vyl = dr === "Lokalita" ? "–" : dr === "Nástroj" ? `${f(r.c.vylozene.linia / P, 1)} / ${f(r.c.vylozene.dedicstvo / P, 1)}` : f(r.c.vylozene.linia / P, 1);
    const pct = r.pril > 0 ? `${Math.round((100 * r.uc) / r.pril)} %` : "–";
    return `<tr class="${r.trieda}" data-stav="${r.trieda}"><td><b>${esc(r.c.name)}</b>${START.has(r.c.id) ? " <span class=\"pozn\">(štart)</span>" : ""}<br><span class="pozn">${esc(r.c.text)}</span></td><td>${dr}</td><td>${r.t}</td><td>${ruka}</td><td>${vyl}</td><td>${f(r.pril)}</td><td><b>${f(r.uc)}</b></td><td>${pct}</td><td class="vl">${r.stav}</td></tr>`;
  })
  .join("\n");

const html = readFileSync(new URL("./spustace-sablona.html", import.meta.url), "utf8")
  .replaceAll("{{PARTII}}", String(P))
  .replaceAll("{{BITIEK}}", String(d.bitiek))
  .replaceAll("{{ZHODA}}", `${d.zhodaBitky}/${d.bitiek}`)
  .replaceAll("{{SPUSTACE}}", riadkySpust)
  .replaceAll("{{PRUHY}}", pruhy)
  .replaceAll("{{KARTY}}", riadkyKariet);
writeFileSync(new URL("../../analyza-spustacov.html", import.meta.url), html);
process.stderr.write("docs/napady/analyza-spustacov.html zapísaný\n");
