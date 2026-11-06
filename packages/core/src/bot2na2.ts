// Bot v 2 na 2 (roadmapa #27, Michal 2026-11-02: boti na každom mieste). Vidí partiu zo svojho
// miesta ako 1 na 1: ruka je jeho, tím je hráč. Heuristiky bota sa tak nemusia učiť miesta
// a každé jeho zlepšenie platí aj tu. Skryté karty súpera zamieša tahBota ako vždy, partner
// sa však nepočíta: čo má v ruke, bot ignoruje, ale tímovým zdrojom verí.

import type { Command, GameState } from "./engine.ts";
import { apply, balicekMiesta, hotovoMiesta, legalCommands, partnerMiesta, skoncilVykladanie, vyberMiesta } from "./engine.ts";
import type { BotNastavenia } from "./bot.ts";
import { tahBota } from "./bot.ts";
import type { GameData } from "./data.ts";
import { kartyVRukach, rukaClena } from "./player.ts";
import type { Miesto, PlayerId } from "./types.ts";
import { clenMiesta, opponentOf, timMiesta } from "./types.ts";

/** Stav 2 na 2 prepočítaný na 1 na 1 z pohľadu člena `m`. Slúži len botovi, do hry sa nevracia. */
export function pohladPreBota(state: GameState, m: Miesto): GameState {
  const tim = timMiesta(m);
  const su = opponentOf(tim);
  const hraci = ([0, 1] as const).map((p) => {
    const { rukaDruheho: _, ...h } = state.hraci[p];
    return { ...h, ruka: p === tim ? rukaClena(state.hraci[p], clenMiesta(m)) : kartyVRukach(state.hraci[p]) };
  }) as unknown as GameState["hraci"];
  const { format: _f, kapitani: _k, ...zvysok } = state;
  const z = state.zhromazdenieStav;
  const d = state.draftStav;
  const pk = state.pitkaStav;
  const poTime = <T>(moje: T, jeho: T): readonly [T, T] => (tim === 0 ? [moje, jeho] : [jeho, moje]);
  const clenSupera = (x: Miesto): Miesto => (timMiesta(x) === su ? x : partnerMiesta(x));
  return {
    ...zvysok,
    hraci,
    // Kto odpovedá na NA EX, je v 2 na 2 miesto člena; v pohľade 1 na 1 by ukazovalo mimo hráča.
    pitkaStav: pk === null || pk.odpoveda === undefined ? pk : { ...pk, odpoveda: timMiesta(pk.odpoveda) },
    zhromazdenieStav:
      z === null
        ? null
        : {
            naTahu: timMiesta(z.naTahu),
            zostavaLimit: z.zostavaLimit,
            navyse: z.navyse,
            pasoval: poTime(
              skoncilVykladanie(z, m),
              skoncilVykladanie(z, clenSupera(m)) && skoncilVykladanie(z, partnerMiesta(clenSupera(m))),
            ),
          },
    draftStav:
      d === null
        ? null
        : {
            krok: d.krok,
            naTahu: timMiesta(d.naTahu),
            noveKarty: d.noveKarty,
            ...(d.zobrate === undefined ? {} : { zobrate: d.zobrate }),
            balicky: poTime(balicekMiesta(d, m), balicekMiesta(d, clenSupera(m))),
            vyber: poTime(vyberMiesta(d, m), vyberMiesta(d, clenSupera(m))),
            hotovo: poTime(hotovoMiesta(d, m), hotovoMiesta(d, clenSupera(m)) && hotovoMiesta(d, partnerMiesta(clenSupera(m)))),
          },
  };
}

function jeLegalny(data: GameData, state: GameState, cmd: Command, m: Miesto): boolean {
  try {
    apply(data, state, cmd, m);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ťah bota na mieste `m`. Pohľad 1 na 1 nevie o všetkom, čo tím smie (odovzdanie odpovede
 * partnerovi, posledná šanca v šenku), preto sa navrhnutý ťah overí v skutočnom stave a keď
 * neprejde, zahrá sa prvý legálny.
 */
export function tahBotaNaMieste(data: GameData, state: GameState, m: Miesto, seed: number, nastavenia: BotNastavenia = {}): Command {
  const legal = legalCommands(data, state, m);
  const prvy = legal[0];
  if (prvy === undefined) throw new Error("Bot nemá legálny ťah.");
  if (legal.length === 1) return prvy;
  const ja: PlayerId = timMiesta(m);
  let navrh: Command | null = null;
  try {
    navrh = tahBota(data, pohladPreBota(state, m), ja, seed, nastavenia);
  } catch {
    // Pohľad 1 na 1 v tomto stave nemá ťah (napríklad ťah má partner) — rozhodne zoznam legálnych.
    navrh = null;
  }
  return navrh !== null && jeLegalny(data, state, navrh, m) ? navrh : prvy;
}
