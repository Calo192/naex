// Stávka bitky (Michal 2026-10-22, návrh 3 A z playtestu 20261021-143600; v6
// v špakoch): koľko špakov dostane víťaz tejto bitky — ja, keď vyhrám, a súper,
// keď vyhrá on; strach starších od v8.3 v stávke nie je. Čísla ráta jadro (stavkaBitky), klient ich len píše.

import type { StavkaBitky as Stavka } from "@naex/core";
import { t } from "../i18n/jazyk.tsx";
import { HODNOTA_POLA } from "./textyStarsich.ts";
import { IkonaSpaku } from "./Spaky.tsx";

const vysvetlenie = (): string =>
  t("stavka.vysvetlenie", { hodnota: HODNOTA_POLA });

export function StavkaBitky({ stavka, kratko = false }: { readonly stavka: Stavka; readonly kratko?: boolean }) {
  const casti = [
    stavka.naSekere > 0 ? t("stavka.zoSekery", { n: stavka.naSekere }) : null,
    stavka.herna[0] > 0 ? t("stavka.zHerne", { n: stavka.herna[0] }) : null,
  ].filter((x) => x !== null);
  const sekera = casti.length > 0 ? t("stavka.zToho", { casti: casti.join(", ") }) : "";
  // Kultúrny dom (v11.13): každý hráč dostane špaky len za svoje karty v línii, aj víťaz.
  const kd =
    stavka.porazenemu[0] + stavka.porazenemu[1] > 0
      ? t("stavka.kulturak", { ja: stavka.porazenemu[0], su: stavka.porazenemu[1] })
      : "";
  const titul = t("stavka.titul", { karty: t("spaky.kartVLinii", { n: stavka.karty }), vyhra: stavka.vyhra, sekera, prehra: -stavka.prehra, kd, vysvetlenie: vysvetlenie() });
  // Hlavička stola: len „o +3 / +3“ s ohorkom — celé znenie v nápovede.
  if (kratko)
    return (
      <span className="stavka-bitky jbar-stavka" title={titul}>
        <span className="stavka-nazov">{t("stavka.o")}</span> <b className="stavka-plus">+{stavka.vyhra}</b>/<b className="stavka-minus">+{-stavka.prehra}</b>
        <IkonaSpaku />
      </span>
    );
  return (
    <span className="stavka-bitky" title={titul}>
      <span className="stavka-dlhe">
        <span className="stavka-nazov">{t("stavka.tatoBitka")}</span> {t("stavka.vyhra")} <b className="stavka-plus">+{t("stavka.nSpakov", { n: stavka.vyhra })}</b>
        {sekera}, {t("stavka.superovaVyhra")} <b className="stavka-minus">+{-stavka.prehra}</b>
      </span>
      <span className="stavka-kratke">
        <b className="stavka-plus">+{stavka.vyhra}</b> / <b className="stavka-minus">+{-stavka.prehra}</b> {t("stavka.spakov")}
      </span>
    </span>
  );
}
