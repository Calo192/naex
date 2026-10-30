// Závislosť a Absťák — čo hráč vidí a čo ho čaká na konci kola.
//
// Pravidlo je v motore (koniecBitky): na konci kola sa porovnajú neresti
// oboch hráčov v tomto kole (v8.1 Krok so stolom, Michal 2026-10-28). Tu je
// len výhľad pre rozhranie, z verejných údajov (playtest 20261019-055945:
// hráči nevedeli, kedy a prečo Absťák prišiel ani ako sa ho zbaviť).

import type { PlayerId } from "./types.ts";
import { opponentOf } from "./types.ts";
import type { GameData } from "./data.ts";
import type { VerejnyHrac, VerejnyStav } from "./effects.ts";
import type { PlayerState } from "./player.ts";
import { verejneAbstaky } from "./engine.ts";

type HracZavislosti = VerejnyHrac & Pick<PlayerState, "nerestiTotoKolo">;

/** Spĺňa ho GameState aj ClientState. */
export interface StavPreZavislost extends VerejnyStav {
  readonly kolo: number;
  readonly hraci: readonly [HracZavislosti, HracZavislosti];
}

/**
 * Čo sa stane na konci kola, keby skončilo teraz:
 *  - ziska:  menej nerestí než súper → +1 Absťák,
 *  - zbavi:  viac nerestí než súper a má Absťák → −1 Absťák,
 *  - nic:    rovnako, alebo viac, ale Absťák nemá.
 */
export type VyhladZavislosti = "ziska" | "zbavi" | "nic";

export interface StavZavislosti {
  /** Absťáky, ktoré hráč má (priznané a v línii). */
  readonly abstaky: number;
  /** O koľko mu Absťáky znížia tuhé poškodenie v bitke. */
  readonly ubera: number;
  /** Pohoršenia navyše z Absťákov v bitke (Nervák, v8.1). */
  readonly pohorsenia: number;
  /** Neresti tohto kola vrátane poldeci, ktoré ležia na stole cez NA EX (vypijú sa v bitke). */
  readonly teraz: number;
  /** Z toho NA EX na stole, ešte nezapočítané. */
  readonly naexNaStole: number;
  /** Súperove neresti tohto kola, rovnako vrátane jeho NA EX na stole. */
  readonly super: number;
  readonly vyhlad: VyhladZavislosti;
  /** Koľko nerestí ešte chýba, aby Absťák nepribudol (pri „ziska“), inak 0. */
  readonly doBezpecia: number;
  /** Koľko nerestí ešte chýba, aby jeden Absťák odišiel (keď nejaký má a ešte nie je „zbavi“), inak 0. */
  readonly doZbavenia: number;
}

function nerestiSNaex(s: StavPreZavislost, p: PlayerId): { readonly spolu: number; readonly naex: number } {
  let naex = 0;
  // Zrážka NA EX (v5, Výtržník): druhý poldeci na karte je nerest druhého hráča.
  for (const strana of s.strany) for (const pl of strana) if (pl.naexBy === p || pl.naexBy2 === p) naex++;
  return { spolu: s.hraci[p].nerestiTotoKolo + naex, naex };
}

export function stavZavislosti(data: GameData, s: StavPreZavislost, p: PlayerId): StavZavislosti {
  const ja = nerestiSNaex(s, p);
  const on = nerestiSNaex(s, opponentOf(p)).spolu;
  const teraz = ja.spolu;
  const abstaky = verejneAbstaky(s, p);
  const vyhlad: VyhladZavislosti = teraz < on ? "ziska" : teraz > on && abstaky > 0 ? "zbavi" : "nic";
  return {
    abstaky,
    ubera: abstaky,
    pohorsenia: abstaky,
    teraz,
    naexNaStole: ja.naex,
    super: on,
    vyhlad,
    doBezpecia: vyhlad === "ziska" ? on - teraz : 0,
    doZbavenia: abstaky > 0 && teraz <= on ? on + 1 - teraz : 0,
  };
}
