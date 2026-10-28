// Stávka bitky (Michal 2026-10-22, návrh 3 A z playtestu 20261021-143600; v6
// v špakoch): koľko špakov dostane víťaz tejto bitky — ja, keď vyhrám, a súper,
// keď vyhrá on — od v6.1 aj so staršími. Čísla ráta jadro (stavkaBitky), klient ich len píše.

import type { StavkaBitky as Stavka } from "@naex/core";
import { pocet } from "@naex/core";
import { IkonaSpaku } from "./Spaky.tsx";

const VYSVETLENIE =
  "Víťaz bitky dostane 1 špak za každú kartu v línii (na oboch stranách, v čase bitky), aspoň 1, " +
  "a k tomu špaky zo sekery a od starších, ktorí sa ho boja — len za zóny, ktoré mu ešte nezaplatili. Porazený od starších nedostane nič, pri sekere dostanú obaja. " +
  "Každá ďalšia karta v línii zvýši stávku o 1.";

export function StavkaBitky({ stavka, kratko = false }: { readonly stavka: Stavka; readonly kratko?: boolean }) {
  const casti = [
    stavka.naSekere > 0 && stavka.noviny[0] === 0 ? `${stavka.naSekere} zo sekery` : null,
    stavka.herna[0] > 0 && stavka.noviny[0] === 0 ? `${stavka.herna[0]} z Herne` : null,
    stavka.starsi[0] > 0 ? `${stavka.starsi[0]} od starších` : null,
  ].filter((x) => x !== null);
  const sekera = casti.length > 0 ? ` (z toho ${casti.join(", ")})` : "";
  // Noviny: víťaz s viac Dlhmi odovzdá špaky za bitku porazenému — povedať, inak „+1“ pri výhre mätie.
  const noviny = [
    stavka.noviny[0] > 0 ? ` Keď vyhráš, špaky za bitku (${stavka.noviny[0]}) vezme súper — Noviny.` : "",
    stavka.noviny[1] > 0 ? ` Keď vyhrá súper, jeho špaky za bitku (${stavka.noviny[1]}) dostaneš ty — Noviny.` : "",
  ].join("");
  // Kultúrny dom (v8): aj porazený dostane špaky za svoje karty v línii.
  const kd =
    stavka.porazenemu[0] + stavka.porazenemu[1] > 0
      ? ` Kultúrny dom: aj porazený dostane 1 špak za každú svoju kartu v línii — ty pri prehre +${stavka.porazenemu[0]}, súper +${stavka.porazenemu[1]}.`
      : "";
  const titul = `Táto bitka (${pocet(stavka.karty, "karta", "karty", "kariet")} v línii): tvoja výhra +${stavka.vyhra} špakov${sekera}, súperova +${-stavka.prehra}.${noviny}${kd} ${VYSVETLENIE}`;
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
