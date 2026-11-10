// Stávka bitky (Michal 2026-10-22, návrh 3 A z playtestu 20261021-143600; v6
// v špakoch): koľko špakov dostane víťaz tejto bitky — ja, keď vyhrám, a súper,
// keď vyhrá on; strach starších od v8.3 v stávke nie je. Čísla ráta jadro (stavkaBitky), klient ich len píše.

import type { StavkaBitky as Stavka } from "@naex/core";
import { pocet } from "@naex/core";
import { HODNOTA_POLA } from "./textyStarsich.ts";
import { IkonaSpaku } from "./Spaky.tsx";

const VYSVETLENIE =
  "Víťaz bitky dostane 1 špak za každú kartu v línii (v celej línii, v čase bitky), aspoň 1, " +
  `a k tomu špaky zo sekery. Starší bodujú hneď po bitke: stupeň ${HODNOTA_POLA} dostane, kto ho drží — reči obaja, strach len víťaz. ` +
  "Každá ďalšia karta v línii zvýši stávku o 1.";

export function StavkaBitky({ stavka, kratko = false }: { readonly stavka: Stavka; readonly kratko?: boolean }) {
  const casti = [
    stavka.naSekere > 0 ? `${stavka.naSekere} zo sekery` : null,
    stavka.herna[0] > 0 ? `${stavka.herna[0]} z Herne` : null,
  ].filter((x) => x !== null);
  const sekera = casti.length > 0 ? ` (z toho ${casti.join(", ")})` : "";
  // Kultúrny dom (v11.13): každý hráč dostane špaky len za svoje karty v línii, aj víťaz.
  const kd =
    stavka.porazenemu[0] + stavka.porazenemu[1] > 0
      ? ` Kultúrny dom: každý dostane špaky len za svoje karty v línii, aj víťaz — ty pri prehre +${stavka.porazenemu[0]}, súper +${stavka.porazenemu[1]}.`
      : "";
  const titul = `Táto bitka (${pocet(stavka.karty, "karta", "karty", "kariet")} v línii): tvoja výhra +${stavka.vyhra} špakov${sekera}, súperova +${-stavka.prehra}.${kd} ${VYSVETLENIE}`;
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
