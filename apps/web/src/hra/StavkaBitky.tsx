// Stávka bitky (Michal 2026-10-22, návrh 3 A z playtestu 20261021-143600):
// hráč pred pasom a pred poslednou bitkou vidí, koľko bodov sa pri výhre
// a prehre prevráti. Čísla ráta jadro (stavkaBitky), klient ich len píše.

import type { StavkaBitky as Stavka } from "@naex/core";
import { znamienko } from "./Scorecard.tsx";

const VYSVETLENIE =
  "Odhad, ako sa pohne rozdiel bodov (ty − súper), keby hra skončila hneď po bitke: víťaz získa lokalitu (aj tie na sekere) " +
  "a prebytok rozdelí medzi starších čo najlepšie pre seba. Pohoršenia a patronát nerátá — platia bez ohľadu na výsledok.";

export function StavkaBitky({ stavka }: { readonly stavka: Stavka }) {
  const posledna = stavka.superNajviac === null ? "" : ` Posledná bitka — najviac, čo môže súper získať ≈ ${znamienko(stavka.superNajviac)} b.`;
  return (
    <span
      className="stavka-bitky"
      title={`Táto bitka: výhra o ${stavka.prebytok} ≈ ${znamienko(stavka.vyhra)} b, prehra o ${stavka.prebytok} ≈ ${znamienko(stavka.prehra)} b.${posledna} ${VYSVETLENIE}`}
    >
      <span className="stavka-dlhe">
        <span className="stavka-nazov">táto bitka:</span> výhra o {stavka.prebytok} ≈ <b className="stavka-plus">{znamienko(stavka.vyhra)} b</b>, prehra
        o {stavka.prebytok} ≈ <b className="stavka-minus">{znamienko(stavka.prehra)} b</b>
        {stavka.superNajviac !== null && (
          <span className="stavka-posledna">
            {" "}
            · posledná bitka — najviac, čo môže súper získať ≈ <b>{znamienko(stavka.superNajviac)} b</b>
          </span>
        )}
      </span>
      {/* Na nízkom notebooku sa dlhá veta skracovala uprostred čísel — krátky zápis s oboma číslami. */}
      <span className="stavka-kratke">
        ±{stavka.prebytok}: <b className="stavka-plus">{znamienko(stavka.vyhra)}</b> / <b className="stavka-minus">{znamienko(stavka.prehra)} b</b>
        {stavka.superNajviac !== null && <> · súper ≤ {znamienko(stavka.superNajviac)} b</>}
      </span>
    </span>
  );
}
