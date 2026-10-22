// Stávka bitky (Michal 2026-10-22, návrh 3 A z playtestu 20261021-143600):
// hráč pred pasom a pred poslednou bitkou vidí, koľko bodov sa pri výhre
// a prehre prevráti. Čísla ráta jadro (stavkaBitky), klient ich len píše.

import type { StavkaBitky as Stavka } from "@naex/core";
import { znamienko } from "./Scorecard.tsx";

const VYSVETLENIE =
  "Odhad, ako sa pohne rozdiel bodov (ty − súper), keby hra skončila hneď po bitke: víťaz získa lokalitu (aj tie na sekere) " +
  "a prebytok rozdelí medzi starších čo najlepšie pre seba. Pohoršenia a patronát nerátá — platia bez ohľadu na výsledok.";

export function StavkaBitky({ stavka }: { readonly stavka: Stavka }) {
  return (
    <span className="stavka-bitky" title={VYSVETLENIE}>
      <span className="stavka-nazov">táto bitka:</span> výhra o {stavka.prebytok} ≈ <b className="stavka-plus">{znamienko(stavka.vyhra)} b</b>, prehra
      o {stavka.prebytok} ≈ <b className="stavka-minus">{znamienko(stavka.prehra)} b</b>
      {stavka.superNajviac !== null && (
        <span className="stavka-posledna">
          {" "}
          · posledná bitka — najviac, čo môže súper získať ≈ <b>{znamienko(stavka.superNajviac)} b</b>
        </span>
      )}
    </span>
  );
}
