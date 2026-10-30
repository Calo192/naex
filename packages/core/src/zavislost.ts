// Chuť a Absťák — čo hráč vidí a čo ho čaká na konci kola.
//
// Pravidlo je v motore (koniecKolaChut, v9.1, Michal 2026-10-30): kto mal v kole menej
// nerestí, než je jeho Chuť, dostane kartu Absťák; potom Chuť = väčšie z (Chuť, neresti) − 1.
// Tu je len výhľad pre rozhranie, z verejných údajov (playtest 20261019-055945: hráči
// nevedeli, kedy a prečo Absťák prišiel).

import type { PlayerId } from "./types.ts";
import type { GameData } from "./data.ts";
import type { VerejnyHrac, VerejnyStav } from "./effects.ts";
import type { PlayerState } from "./player.ts";
import { KONSTANTY } from "./constants.ts";
import { chutPoKole, latkaChuti, opatrovatelkyHraca, verejneAbstaky } from "./engine.ts";

type HracZavislosti = VerejnyHrac & Pick<PlayerState, "nerestiTotoKolo" | "chut">;

/** Spĺňa ho GameState aj ClientState. */
export interface StavPreZavislost extends VerejnyStav {
  readonly kolo: number;
  readonly hraci: readonly [HracZavislosti, HracZavislosti];
  readonly bezChuti?: true;
}

/**
 * Čo sa stane na konci kola, keby skončilo teraz:
 *  - ziska: menej nerestí než Chuť (s Opatrovateľkou nižšia) → karta Absťák,
 *  - nic:   aspoň toľko, koľko je Chuť.
 */
export type VyhladZavislosti = "ziska" | "nic";

export interface StavZavislosti {
  /** Chuť hráča — latka nerestí na konci kola. */
  readonly chut: number;
  /** Latka, s ktorou sa neresti porovnajú (Chuť mínus Opatrovateľky v línii). */
  readonly latka: number;
  /** Neresti tohto kola vrátane NA EX na stole (každé za 2, vypijú sa v bitke). */
  readonly teraz: number;
  /** Z toho NA EX na stole, ešte nezapočítané (počet NA EX, nie nerestí). */
  readonly naexNaStole: number;
  /** Karty Absťák v balíčku (ruka, doberací, odhadzovací). */
  readonly abstaky: number;
  /** O koľko mu Absťáky znížia tuhé poškodenie v bitke. */
  readonly ubera: number;
  readonly vyhlad: VyhladZavislosti;
  /** Koľko nerestí ešte chýba, aby Absťák nepribudol, inak 0. */
  readonly doBezpecia: number;
  /** Chuť po konci kola, keby skončilo teraz. */
  readonly chutPo: number;
}

function naexNaStole(s: StavPreZavislost, p: PlayerId): number {
  let naex = 0;
  // Zrážka NA EX (v5, Výtržník): druhý poldeci na karte je nerest druhého hráča.
  for (const strana of s.strany) for (const pl of strana) if (pl.naexBy === p || pl.naexBy2 === p) naex++;
  return naex;
}

export function stavZavislosti(data: GameData, s: StavPreZavislost, p: PlayerId): StavZavislosti {
  const naex = naexNaStole(s, p);
  const teraz = s.hraci[p].nerestiTotoKolo + naex * KONSTANTY.NEREST_NAEX;
  const chut = s.hraci[p].chut;
  const latka = latkaChuti(chut, opatrovatelkyHraca(data, s, p));
  const abstaky = verejneAbstaky(s, p);
  const vyhlad: VyhladZavislosti = s.bezChuti !== true && teraz < latka ? "ziska" : "nic";
  return {
    chut,
    latka,
    teraz,
    naexNaStole: naex,
    abstaky,
    ubera: abstaky,
    vyhlad,
    doBezpecia: vyhlad === "ziska" ? latka - teraz : 0,
    chutPo: s.bezChuti === true ? chut : chutPoKole(chut, teraz),
  };
}
