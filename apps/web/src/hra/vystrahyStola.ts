// Texty pre stôl, ktoré playtest 20261106 hráčom chýbali (Michal 2026-11-06): koľko Cirhóz
// karta hrozí ešte pred vyložením a súperovo NA EX videné cez Bzdochu. Samotný výpočet je
// v jadre (vystrahaPecene, viewFor) — tu sú len slová.

import { opponentOf, textHrozbyKliatob, type ClientState, type PlayerId, type VystrahaPecene } from "@naex/core";

/** Krátko do miesta na stole a štítku na karte v ruke, kde sa dlhá veta nezmestí; zalomí sa len medzi časťami. */
export function vystrahaKratko(v: VystrahaPecene, ja: PlayerId): string {
  const su = opponentOf(ja);
  const moje = v.cirhozy[ja];
  const naex = v.naex?.cirhozy ?? 0;
  return [
    moje > 0 ? `Cirhóza\u00a0+${moje}` : "",
    naex > 0 ? (moje > 0 ? `NA\u00a0EX\u00a0+${naex}` : `NA\u00a0EX: Cirhóza\u00a0+${naex}`) : "",
    v.cirhozy[su] > 0 ? `súper Cirhóza\u00a0+${v.cirhozy[su]}` : "",
  ]
    .filter((t) => t !== "")
    .join(" · ");
}

/** Celá veta do pokynu; `kartaNaex` je meno karty, na ktorú by súper NA EX dal. */
export function vystrahaCela(v: VystrahaPecene, ja: PlayerId, menoSupera: string, kartaNaex: string): string {
  const su = opponentOf(ja);
  return [
    v.cirhozy[ja] > 0 ? `Hrozí ti ${textHrozbyKliatob({ cirhozy: v.cirhozy[ja], dlhy: 0, spaky: v.spaky[ja] })}` : "",
    v.naex !== null ? `ak ${menoSupera} dá NA EX na ${kartaNaex}, ešte ${textHrozbyKliatob(v.naex)}` : "",
    v.cirhozy[su] > 0 ? `${menoSupera}: ${textHrozbyKliatob({ cirhozy: v.cirhozy[su], dlhy: 0, spaky: v.spaky[su] })}` : "",
  ]
    .filter((t) => t !== "")
    .join(" · ");
}

/**
 * Na čo dal súper skryté NA EX — pohľad ho obsahuje len s Bzdochou, keď hráč vyberá po ňom
 * (viewFor), inak je zoznam prázdny. Na súperovu Záverečnú lícom dole len „Záverečná“: meno hráč nevidí.
 */
export function cieleSuperovhoNaex(view: Pick<ClientState, "ja" | "pitkaStav" | "strany" | "zaverecne">, menoKarty: (defId: string) => string): readonly string[] {
  return (view.pitkaStav?.skryteNaex ?? [])
    .filter((x) => x.hrac !== view.ja)
    .map((x) => {
      const pl = view.strany.flat().find((k) => k.card.uid === x.uid);
      if (pl !== undefined) return `${pl.playedBy === view.ja ? "tvoju" : "svoju"} kartu ${menoKarty(pl.card.defId)}`;
      return view.zaverecne.some((z) => z.uid === x.uid && z.majitel === view.ja) ? "tvoju Záverečnú" : "svoju Záverečnú";
    });
}
