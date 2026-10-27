// Závislosť a Absťák — čo hráč vidí a čo ho čaká na konci kola.
//
// Pravidlo je v motore (koniecBitky): na konci kola sa porovnajú neresti
// tohto a predošlého kola. Tu je len výhľad pre rozhranie, z verejných
// údajov (playtest 20261019-055945: hráči nevedeli, kedy a prečo Absťák
// prišiel ani ako sa ho zbaviť).

import type { PlayerId } from "./types.ts";
import type { GameData } from "./data.ts";
import type { VerejnyHrac, VerejnyStav } from "./effects.ts";
import type { PlayerState } from "./player.ts";
import { abstakyVBitke, verejneAbstaky } from "./engine.ts";

type HracZavislosti = VerejnyHrac & Pick<PlayerState, "nerestiTotoKolo" | "nerestiMinuleKolo">;

/** Spĺňa ho GameState aj ClientState. */
export interface StavPreZavislost extends VerejnyStav {
  readonly kolo: number;
  readonly hraci: readonly [HracZavislosti, HracZavislosti];
}

/**
 * Čo sa stane na konci kola, keby skončilo teraz:
 *  - zaklad: prvé kolo len nastaví základ,
 *  - ziska:  menej nerestí než minule (+ Milujúce manželky) → +1 Absťák,
 *  - zbavi:  viac nerestí než minule a má Absťák → −1 Absťák,
 *  - nic:    rovnako, alebo viac, ale Absťák nemá.
 */
export type VyhladZavislosti = "zaklad" | "ziska" | "zbavi" | "nic";

export interface StavZavislosti {
  /** Absťáky, ktoré hráč má (priznané). */
  readonly abstaky: number;
  /** O koľko mu Absťáky znížia tuhé poškodenie v bitke. */
  readonly ubera: number;
  /** Neresti tohto kola vrátane poldeci, ktoré ležia na stole cez NA EX (vypijú sa v bitke). */
  readonly teraz: number;
  /** Z toho NA EX na stole, ešte nezapočítané. */
  readonly naexNaStole: number;
  readonly minule: number;
  readonly vyhlad: VyhladZavislosti;
  /** Koľko nerestí ešte chýba, aby Absťák nepribudol (pri „ziska“), inak 0. */
  readonly doBezpecia: number;
  /** Koľko nerestí ešte chýba, aby jeden Absťák odišiel (keď nejaký má), inak 0. */
  readonly doZbavenia: number;
}

export function stavZavislosti(data: GameData, s: StavPreZavislost, p: PlayerId): StavZavislosti {
  const hrac = s.hraci[p];
  let naexNaStole = 0;
  // Zrážka NA EX (v5, Výtržník): druhý poldeci na karte je nerest druhého hráča.
  for (const strana of s.strany) for (const pl of strana) if (pl.naexBy === p || pl.naexBy2 === p) naexNaStole++;
  const teraz = hrac.nerestiTotoKolo + naexNaStole;
  const minule = hrac.nerestiMinuleKolo;
  const abstaky = verejneAbstaky(s, p);
  const vyhlad: VyhladZavislosti =
    s.kolo <= 1 ? "zaklad" : teraz < minule ? "ziska" : teraz > minule && abstaky > 0 ? "zbavi" : "nic";
  return {
    abstaky,
    ubera: abstakyVBitke(data, s, p, 0),
    teraz,
    naexNaStole,
    minule,
    vyhlad,
    doBezpecia: vyhlad === "ziska" ? minule - teraz : 0,
    doZbavenia: s.kolo > 1 && abstaky > 0 && teraz <= minule ? minule + 1 - teraz : 0,
  };
}
