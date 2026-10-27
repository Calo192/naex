// Stávka bitky (Michal 2026-10-22, návrh 3 A z playtestu 20261021-143600; v6
// v špakoch): koľko špakov dostane víťaz tejto bitky — ja, keď vyhrám, a súper,
// keď vyhrá on — od v6.1 aj so staršími. Čísla ráta jadro (stavkaBitky), klient ich len píše.

import type { StavkaBitky as Stavka } from "@naex/core";
import { IkonaSpaku } from "./Spaky.tsx";

const VYSVETLENIE =
  "Víťaz bitky dostane toľko špakov, koľko Pitiek sa v kole odohrá, mínus o koľko má viac Absťákov než porazený (aspoň 1), " +
  "a k tomu špaky zo sekery a od starších, ktorí sa ho boja. Porazený od starších nedostane nič, pri sekere dostanú obaja.";

export function StavkaBitky({ stavka, kratko = false }: { readonly stavka: Stavka; readonly kratko?: boolean }) {
  const casti = [stavka.naSekere > 0 ? `${stavka.naSekere} zo sekery` : null, stavka.starsi[0] > 0 ? `${stavka.starsi[0]} od starších` : null].filter((x) => x !== null);
  const sekera = casti.length > 0 ? ` (z toho ${casti.join(", ")})` : "";
  const titul = `Táto bitka (${stavka.pitky} ${stavka.pitky === 1 ? "Pitka" : stavka.pitky < 5 ? "Pitky" : "Pitiek"}): tvoja výhra +${stavka.vyhra} špakov${sekera}, súperova +${-stavka.prehra}. ${VYSVETLENIE}`;
  // Hlavička stola: len „o +3 / +3“ s ohorkom — celé znenie v nápovede.
  if (kratko)
    return (
      <span className="stavka-bitky jbar-stavka" title={titul}>
        <span className="stavka-nazov">o</span> <b className="stavka-plus">+{stavka.vyhra}</b>/<b className="stavka-minus">+{-stavka.prehra}</b>
        <IkonaSpaku />
      </span>
    );
  return (
    <span className="stavka-bitky" title={titul}>
      <span className="stavka-dlhe">
        <span className="stavka-nazov">táto bitka:</span> výhra <b className="stavka-plus">+{stavka.vyhra} špakov</b>
        {sekera}, súperova výhra <b className="stavka-minus">+{-stavka.prehra}</b>
      </span>
      <span className="stavka-kratke">
        <b className="stavka-plus">+{stavka.vyhra}</b> / <b className="stavka-minus">+{-stavka.prehra}</b> špakov
      </span>
    </span>
  );
}
