// Bot režimu Päta, Lakeť, Otočka: jednoduché heuristiky pre kroky režimu, zvyšok kola (šenok,
// Zhromaždenie, Pitka) hrá bežný bot. Stačí na to, aby sa dala zmerať dĺžka partie a hrať proti nemu;
// hranie na pečeň sa dá neskôr doladiť (bot-tréner).

import type { Command, GameState } from "./engine.ts";
import { legalCommands } from "./engine.ts";
import type { BotNastavenia } from "./bot.ts";
import { tahBota } from "./bot.ts";
import type { GameData } from "./data.ts";
import type { ActionSums } from "./partia.ts";
import type { HraPata, StarsiPata, StarsiId } from "./pata.ts";
import { PATA, stojaci, sumyRadu } from "./pata.ts";
import type { Action, PlayerId } from "./types.ts";
import { opponentOf } from "./types.ts";

const VAHY: Partial<Record<Action, number>> = {
  Rana: 1,
  Pecka: 2,
  Petelica: 3,
  Povera: 2,
  Pohoršenie: 1.5,
  Viera: 1.5,
  Robota: 1,
  Cigareta: 0.5,
  Poldeci: 0.7,
  Vízia: 0.3,
  Dlh: -1,
  PoškodeniePečene: -0.5,
  Obmedzenie: 0.3,
};

function hodnotaSum(s: ActionSums): number {
  return (Object.keys(s) as Action[]).reduce((a, k) => a + (s[k] ?? 0) * (VAHY[k] ?? 0), 0);
}

function odolnost(s: StarsiPata): number {
  return s.pecen + s.stit;
}

function najslabsi(rad: readonly StarsiPata[]): StarsiPata | undefined {
  return [...rad].sort((a, b) => odolnost(a) - odolnost(b))[0];
}

function naRad(data: GameData, h: HraPata, p: PlayerId, c: Command): number {
  if (c.type !== "pataRad") return 0;
  const rad = c.poradie.map((id) => h.rady[p].find((x) => x.karta.defId === id)).filter((x): x is StarsiPata => x !== undefined);
  return hodnotaSum(sumyRadu(data, rad, p));
}

/** Ťah bota: krok režimu podľa heuristík, inak bežný bot. */
export function tahBotaPata(data: GameData, state: GameState, p: PlayerId, seed: number, nastavenia: BotNastavenia = {}): Command {
  const h = state.pata;
  if (h === undefined || h.krok === null) return tahBota(data, state, p, seed, nastavenia);
  const legal = legalCommands(data, state, p);
  const prvy = legal[0];
  if (prvy === undefined) throw new Error("Bot nemá legálny ťah.");
  const su = opponentOf(p);
  const najlepsi = (hodnota: (c: Command) => number): Command => legal.reduce((a, c) => (hodnota(c) > hodnota(a) ? c : a), prvy);
  switch (h.krok) {
    case "draft":
      return najlepsi((c) => (c.type === "pataVyber" ? PATA.PECEN[c.elderId as StarsiId] : 0));
    case "rad":
      return najlepsi((c) => naRad(data, h, p, c));
    case "vymena":
      return { type: "pataVymena", index: null };
    case "liecenie": {
      if ((state.hraci[p].dlhy ?? 0) > 0) return prvy;
      const slaby = najslabsi(stojaci(h, p));
      return legal.find((c) => c.type === "pataLiecenie" && slaby !== undefined && c.liecenie[slaby.karta.defId] !== undefined) ?? prvy;
    }
    case "utok": {
      // Tuhé na najslabšieho, nech padne skoro; jed na najzdravšieho, tam stihne účinkovať.
      const ciel = najslabsi(stojaci(h, su));
      const zdravy = [...stojaci(h, su)].sort((a, b) => b.pecen - a.pecen)[0];
      return (
        legal.find(
          (c) =>
            c.type === "pataUtok" &&
            (Object.keys(c.tuhe).length === 0 || c.tuhe[ciel?.karta.defId ?? ""] !== undefined) &&
            (Object.keys(c.jed).length === 0 || c.jed[zdravy?.karta.defId ?? ""] !== undefined),
        ) ?? prvy
      );
    }
    case "vyzrat": {
      // Poldeci šetrí na Pitku, vyžrať dá len tomu, kto je blízko pádu.
      const slaby = najslabsi(stojaci(h, p));
      if (slaby === undefined || slaby.pecen > 6 || state.hraci[p].poldeciPlne < 2) return { type: "pataVyzrat", elderId: null };
      return { type: "pataVyzrat", elderId: slaby.karta.defId };
    }
  }
}
