// Stávka bitky (Michal 2026-10-22, návrh 3 A z playtestu 20261021-143600; v6
// v špakoch): koľko špakov dostane víťaz tejto bitky — ja, keď vyhrám, a súper,
// keď vyhrá on; strach starších od v8.3 v stávke nie je. Čísla ráta jadro (stavkaBitky), klient ich len píše.

import type { StavkaBitky as Stavka } from "@naex/core";
import { pocet } from "@naex/core";
import { IkonaSpaku } from "./Spaky.tsx";

const VYSVETLENIE =
  "Víťaz bitky dostane 1 špak za každú kartu v línii (na oboch stranách, v čase bitky), aspoň 1, " +
  "a k tomu špaky zo sekery. Starší platia za strach až na konci kola za stupeň udržaný od minulého kola — tomu, koho sa boja, nech bitku vyhrá ktokoľvek. " +
  "Každá ďalšia karta v línii zvýši stávku o 1.";

export function StavkaBitky({ stavka, kratko = false }: { readonly stavka: Stavka; readonly kratko?: boolean }) {
  const casti = [
    stavka.naSekere > 0 ? `${stavka.naSekere} zo sekery` : null,
    stavka.herna[0] > 0 ? `${stavka.herna[0]} z Herne` : null,
  ].filter((x) => x !== null);
  const sekera = casti.length > 0 ? ` (z toho ${casti.join(", ")})` : "";
  // Noviny (Titulka): porazený majiteľ dostane špak za každý Dlh víťaza navyše.
  const noviny = [
    stavka.noviny[0] > 0 ? ` Keď prehráš, dostaneš +${stavka.noviny[0]} za Dlhy, ktoré má súper navyše — Noviny.` : "",
    stavka.noviny[1] > 0 ? ` Keď prehrá súper, dostane +${stavka.noviny[1]} za tvoje Dlhy navyše — jeho Noviny.` : "",
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
