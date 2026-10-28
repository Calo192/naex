// Prehrá scenár výučby „Prvá hra“ v jadre a vypíše, čo sa po každom kroku
// deje — pomôcka pre autora scenára (Navrhár): vidno fázu, kto je na ťahu,
// ruky, líniu a na konci legálne ťahy s odkazmi na karty, ktoré sa dajú
// rovno prepísať do ďalšieho kroku.
//
//   node --experimental-strip-types --no-warnings tools/vyucba/prehraj.ts [scenar.json] [--ticho]
//
// Predvolený scenár je packages/core/data/vyucba/prva-hra.json. --ticho
// vypíše len chybu alebo „scenár sedí“ a ťahy na konci.

import { readFileSync } from "node:fs";
import type { CardInstance, Command, GameData, GameState, PlayerId, ScenarVyucby } from "@naex/core";
import { VYUCBA_BOT, VYUCBA_HRAC, defOf, legalCommands, naTahu, overScenar, prehrajVyucbu, prikazZoScenara } from "@naex/core";
import { loadDataFromDisk } from "../../packages/server/src/server.ts";

const args = process.argv.slice(2);
const ticho = args.includes("--ticho");
const cesta = args.find((a) => !a.startsWith("--")) ?? new URL("../../packages/core/data/vyucba/prva-hra.json", import.meta.url);
const scenar = JSON.parse(readFileSync(cesta, "utf8")) as ScenarVyucby;
const data: GameData = loadDataFromDisk();

const meno = (k: CardInstance): string => `${k.defId}/${k.leftLayout}/${k.rightLayout}`;
const kto = (p: PlayerId | null): string => (p === VYUCBA_HRAC ? "hráč" : p === VYUCBA_BOT ? "bot" : "nikto");

function opis(state: GameState): string[] {
  const out = [`  fáza ${state.faza}${state.draftStav !== null ? ` (${state.draftStav.krok})` : ""}${state.bitkaStav?.krok ? ` (${state.bitkaStav.krok})` : ""}, kolo ${state.kolo}, na ťahu ${kto(naTahu(state))}, útočník ${kto(state.utocnik)}`];
  for (const p of [VYUCBA_HRAC, VYUCBA_BOT]) {
    const h = state.hraci[p];
    out.push(`  ${kto(p)}: ruka [${h.ruka.map(meno).join(", ")}] · balíček ${h.doberaci.length} · cig ${h.cigarety} · poldeci ${h.poldeciPlne}/${h.poldeciVypite}`);
  }
  out.push(`  línia: ${[...state.strany[0]].reverse().map((pl) => meno(pl.card)).join(" ")} | ${state.ciel?.lokalita ? meno(state.ciel.lokalita) : "—"} | ${state.strany[1].map((pl) => meno(pl.card)).join(" ")}`);
  if (state.senok.length > 0) out.push(`  šenok: [${state.senok.map(meno).join(", ")}]`);
  if (state.draftStav?.krok === "stavba") out.push(`  stavba hráča: [${state.draftStav.balicky[VYUCBA_HRAC].map(meno).join(", ")}]`);
  if (state.koniec !== null) out.push(`  KONIEC: ${state.koniec.dovod} body ${JSON.stringify(state.koniec.body)}`);
  return out;
}

/** Uid v príkaze → odkaz „zóna:defId#n“ pre scenár. */
function sOdkazmi(state: GameState, p: PlayerId, c: Command): string {
  const zony: [string, readonly CardInstance[]][] = [
    ["ruka", state.hraci[p].ruka],
    ["senok", state.senok],
    ["lokality", state.lokalityVHre],
    ["ciel", state.ciel?.lokalita == null ? [] : [state.ciel.lokalita]],
    ["stavba", state.draftStav?.balicky[p] ?? []],
    ["priznane", state.hraci[p].priznane],
    ["linia", [...state.strany[0], ...state.strany[1]].filter((pl) => pl.playedBy === p).map((pl) => pl.card)],
  ];
  const odkaz = (uid: number): string | number => {
    for (const [z, karty] of zony) {
      const k = karty.find((x) => x.uid === uid);
      if (k === undefined) continue;
      const rovnake = karty.filter((x) => x.defId === k.defId);
      const n = rovnake.indexOf(k) + 1;
      return `${z}:${k.defId}${n > 1 ? `#${n}` : ""}`;
    }
    return uid;
  };
  return JSON.stringify(c, (key, v: unknown) =>
    ["uid", "rukaUid", "senokUid", "cirhozaUid", "kartaUid"].includes(key) && typeof v === "number"
      ? odkaz(v)
      : ["uids", "doSenku", "odhod"].includes(key) && Array.isArray(v)
        ? v.map((x: unknown) => (typeof x === "number" ? odkaz(x) : x))
        : v,
  );
}

const chyba = overScenar(data, scenar);
let state = prehrajVyucbu(data, scenar, 0);
if (!ticho) {
  console.log(`Scenár „${scenar.nazov}“ — ${scenar.kroky.length} krokov. Rozdanie:`);
  console.log(opis(state).join("\n"));
}
for (const [i, krok] of scenar.kroky.entries()) {
  const p = krok.kto === "bot" ? VYUCBA_BOT : VYUCBA_HRAC;
  if (!ticho) {
    const cmd = krok.prikaz === undefined ? "" : (() => { try { return JSON.stringify(prikazZoScenara(state, p, krok.prikaz)); } catch (e) { return `CHYBA ${(e as Error).message}`; } })();
    console.log(`\n#${i} ${krok.id} [${krok.kto}] ${cmd}\n  Melichar: ${krok.melichar}`);
  }
  try {
    state = prehrajVyucbu(data, scenar, i + 1);
  } catch {
    break;
  }
  if (!ticho) console.log(opis(state).join("\n"));
}
console.log(chyba === null ? "\nScenár sedí." : `\nCHYBA: ${chyba}`);
const dalsi = naTahu(state);
if (state.koniec === null && dalsi !== null) {
  console.log(`\nLegálne ťahy (${kto(dalsi)}) po poslednom kroku:`);
  for (const c of legalCommands(data, state, dalsi).slice(0, 60)) console.log(`  ${sOdkazmi(state, dalsi, c)}`);
  if (state.faza === "draft" && state.draftStav?.krok === "stavba") {
    console.log(`  (stavba šenku: ${kto(VYUCBA_HRAC)} aj ${kto(VYUCBA_BOT)} naraz — balíček bota [${state.draftStav.balicky[VYUCBA_BOT].map((k) => defOf(data, k).id).join(", ")}])`);
  }
}
