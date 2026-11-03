// Vývojový scenár rozdania (2026-11-01; v11.4): partia proti botovi so staršími na stupni 3 a so
// staršími, pri ktorých má súper vyšší strach, aby sa dal v prehliadači prejsť tok zajatia
// a presvedčenia (§10) — strach dvíha len Nakladačka (v11) a stupeň 3 prirodzene príde až
// v neskorších kolách. Zapína ho len premenná prostredia
// NAEX_SCENAR na lokálnom serveri (index.ts ho na produkcii ignoruje); jadro sa nemení,
// scenár len upraví stav po rozdaní.

import type { GameState, PlayerId, Vazen } from "@naex/core";
import { opponentOf, vazniNaVyhru } from "@naex/core";

export const SCENARE = ["zajatie", "zajatie-vyhra"] as const;
export type Scenar = (typeof SCENARE)[number];

export function jeScenar(x: string | undefined): x is Scenar {
  return (SCENARE as readonly string[]).includes(x ?? "");
}

/**
 * Scenár z premenných prostredia (NAEX_SCENAR). Na živom webe nikdy: Dockerfile nastavuje
 * NODE_ENV=production a docker-compose NAEX_SECURE_COOKIE=1 — stačí jedno z nich.
 */
export function scenarZProstredia(env: Readonly<Record<string, string | undefined>>): { readonly scenar: Scenar | undefined; readonly ignorovany: string | null } {
  const x = env.NAEX_SCENAR;
  if (x === undefined || x === "") return { scenar: undefined, ignorovany: null };
  const produkcia = env.NODE_ENV === "production" || env.NAEX_SECURE_COOKIE === "1";
  return !produkcia && jeScenar(x) ? { scenar: x, ignorovany: null } : { scenar: undefined, ignorovany: x };
}

/** Cigarety navyše na branie zo šenku a Kšefty — partia sa rozbehne rýchlejšie. */
const CIGARETY_NAVYSE = 4;

/**
 * Upraví čerstvo rozdanú partiu: prvý starší sa človeka bojí na červenej (strach 3 — človek
 * ho smie po vyhratej bitke Nakladačkou zajať), druhý sa na červenej bojí bota (zajať smie bot).
 * Predposledný sa bota bojí viac než človeka (3 : 2 — človek ho smie presvedčiť hádkou),
 * posledný naopak (presvedčiť smie bot). Obaja dostanú cigarety navyše. „zajatie-vyhra“ dá človeku o jedného väzňa menej, než treba na
 * výhru (v11 podľa ligy) — ďalší zajatý vyhráva a schopnosť väzňa sa dá skúsiť hneď v prvom ťahu.
 */
export function pouziScenar(state: GameState, scenar: Scenar, clovek: PlayerId): GameState {
  const bot = opponentOf(clovek);
  const sCervenou = (e: GameState["starsi"][number], p: PlayerId): GameState["starsi"][number] => {
    const strach: [0 | 1 | 2 | 3, 0 | 1 | 2 | 3] = [e.strach[0], e.strach[1]];
    strach[p] = 3;
    return { ...e, strach, reci: [0, 0] };
  };
  const vazniCloveka = scenar === "zajatie-vyhra" ? state.starsi.slice(2, 2 + vazniNaVyhru(state.lokalitCelkom) - 1) : [];
  const vazni: Vazen[] = vazniCloveka.map((e, i) => ({
    elderId: e.elderId,
    hrac: clovek,
    poradie: state.vazni.length + i + 1,
    karta: e.karta,
    scorecard: e.scorecard,
    miesto: state.starsi.indexOf(e),
  }));
  /** Strach [p] 3, druhého 2 — presvedčiť smie druhý hráč (v11.4). */
  const sPresvedcenim = (e: GameState["starsi"][number], p: PlayerId): GameState["starsi"][number] => {
    const strach: [0 | 1 | 2 | 3, 0 | 1 | 2 | 3] = [2, 2];
    strach[p] = 3;
    return { ...e, strach, reci: [0, 0] };
  };
  const n = state.starsi.length;
  const starsi = state.starsi
    .map((e, i) => (i === 0 ? sCervenou(e, clovek) : i === 1 ? sCervenou(e, bot) : i === n - 2 ? sPresvedcenim(e, bot) : i === n - 1 ? sPresvedcenim(e, clovek) : e))
    .filter((e) => !vazniCloveka.some((v) => v.elderId === e.elderId));
  const [h0, h1] = state.hraci;
  const hraci: GameState["hraci"] = [
    { ...h0, cigarety: h0.cigarety + CIGARETY_NAVYSE },
    { ...h1, cigarety: h1.cigarety + CIGARETY_NAVYSE },
  ];
  return { ...state, starsi, hraci, vazni: [...state.vazni, ...vazni] };
}
