// Vývojový scenár rozdania (2026-11-01): partia proti botovi so staršími na stupni 3, aby sa
// dal v prehliadači prejsť celý tok zajatia (§10) — strach dvíha len Nakladačka (v11)
// a stupeň 3 prirodzene príde až v neskorších kolách. Zapína ho len premenná prostredia
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

/** Cigarety navyše na pokus o zajatie (pred stavbou šenku, v10.1) aj na branie zo šenku. */
const CIGARETY_NAVYSE = 4;

/**
 * Upraví čerstvo rozdanú partiu: prvý starší sa človeka bojí na červenej (strach 3 — človek
 * ho smie skúsiť zajať), druhý sa na červenej bojí bota (pokus smie skúsiť bot). Obaja
 * dostanú cigarety navyše. „zajatie-vyhra“ dá človeku o jedného väzňa menej, než treba na
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
  const starsi = state.starsi
    .map((e, i) => (i === 0 ? sCervenou(e, clovek) : i === 1 ? sCervenou(e, bot) : e))
    .filter((e) => !vazniCloveka.some((v) => v.elderId === e.elderId));
  const [h0, h1] = state.hraci;
  const hraci: GameState["hraci"] = [
    { ...h0, cigarety: h0.cigarety + CIGARETY_NAVYSE },
    { ...h1, cigarety: h1.cigarety + CIGARETY_NAVYSE },
  ];
  return { ...state, starsi, hraci, vazni: [...state.vazni, ...vazni] };
}
