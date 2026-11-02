// Pomôcka pre autora výučby: po každom kroku vypíše čísla, ktoré Melichar hovorí —
// špaky, cigarety, odhad tuhého, strach a reči pri starších, priazne a stav bitky.
// Texty scenára tak treba overiť len proti tomuto výpisu (Vymyselník 2026-11-02, v11).
//
//   node --experimental-strip-types --no-warnings tools/vyucba/stav-krokov.ts [od] [po]

import { readFileSync } from "node:fs";
import type { GameData, GameState, ScenarVyucby } from "@naex/core";
import { evaluateLine, lineState, poskodenieBitky, prehrajVyucbu, priazenPre } from "@naex/core";
import { loadDataFromDisk } from "../../packages/server/src/server.ts";

const scenar = JSON.parse(readFileSync(new URL("../../packages/core/data/vyucba/prva-hra.json", import.meta.url), "utf8")) as ScenarVyucby;
const data: GameData = loadDataFromDisk();
const [od, po] = [Number(process.argv[2] ?? 0), Number(process.argv[3] ?? scenar.kroky.length - 1)];

function opis(s: GameState): string {
  const tuhe = s.ciel?.lokalita == null ? "—" : poskodenieBitky(data, s, evaluateLine(data, lineState(s)).sums).tuhe.join(" : ");
  const starsi = s.starsi
    .filter((e) => e.strach[0] + e.strach[1] + e.reci[0] + e.reci[1] > 0)
    .map((e) => `${e.elderId} S${e.strach.join("/")} R${e.reci.join("/")} P${priazenPre(e, 0)}/${priazenPre(e, 1)}`)
    .join(", ");
  const h = s.hraci;
  const b = s.bitkaStav;
  const bitka = b === null ? "" : ` bitka(${b.krok} čaká ${b.caka} víťaz ${b.vitaz} nakl ${b.prebytokZostava} hádka ${JSON.stringify(b.hadka ? { m: b.hadka.makke, v: b.hadka.vitaz, z: b.hadka.zostava } : null)})`;
  const posl = s.nastenka.at(-1);
  return [
    `  ${s.faza} k${s.kolo} špaky ${s.spaky.join(" : ")} cig ${h[0].cigarety}/${h[1].cigarety} dlhy ${h[0].dlhy}/${h[1].dlhy} poldeci ${h[0].poldeciPlne}+${h[0].poldeciVypite}/${h[1].poldeciPlne}+${h[1].poldeciVypite} tuhé ${tuhe}${bitka}`,
    `  starší: ${starsi || "—"} · väzni ${JSON.stringify(s.vazni.map((v) => [v.elderId, v.hrac]))}`,
    posl === undefined ? "" : `  nástenka: ${JSON.stringify(posl).slice(0, 600)}`,
    s.koniec === null ? "" : `  KONIEC ${JSON.stringify(s.koniec)}`,
  ]
    .filter((x) => x !== "")
    .join("\n");
}

for (let i = od; i <= po && i < scenar.kroky.length; i++) {
  const k = scenar.kroky[i];
  if (k === undefined) break;
  console.log(`#${i} ${k.id} [${k.kto}] ${k.melichar.slice(0, 140)}`);
  console.log(opis(prehrajVyucbu(data, scenar, i + 1)));
}
