// Účet špakov (pravidlá v6, Michal 2026-10-26): odkiaľ má každý hráč špaky —
// bitky, starší, Exekútor, výkupné zdrojov a nepriznaná Cirhóza (prebytok len v partiách do v7). Pre koniec
// hry a detail partie; rovnaká mriežka ako špaky jednej bitky (SpakyBitky).
// Čísla ráta jadro (rozpisSpakov), klient ich len píše.

import { opponentOf, type PlayerId, type RozpisSpakov } from "@naex/core";
import { IkonaSpaku, sMinusom } from "./Spaky.tsx";
import { t } from "../i18n/jazyk.tsx";

const RIADKY: readonly { readonly kluc: keyof RozpisSpakov; readonly nazov: string }[] = [
  // Súčet za bitky ráta aj Robotu (rozpisSpakov) — „vyhraté bitky“ nesedelo so špakmi pri lokalitách (playtest 20261031-191322).
  { kluc: "zaBitky", get nazov() { return t("ucetSpakov.zaBitky"); } },
  { kluc: "zaStarsich", get nazov() { return t("ucetSpakov.zaStarsich"); } },
  { kluc: "prebytok", get nazov() { return t("ucetSpakov.prebytok"); } },
  { kluc: "exekutor", get nazov() { return t("ucetSpakov.exekutor"); } },
  { kluc: "vykupne", get nazov() { return t("ucetSpakov.vykupne"); } },
  { kluc: "cirhoza", get nazov() { return t("ucetSpakov.cirhoza"); } },
];

const zn = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");

export function UcetSpakov({ rozpis, ja, mena }: { readonly rozpis: readonly [RozpisSpakov, RozpisSpakov]; readonly ja: PlayerId; readonly mena: readonly [string, string] }) {
  const su = opponentOf(ja);
  return (
    <div className="spaky-bitky ucet-spakov" role="table" aria-label={t("ucetSpakov.nadpis")}>
      <span className="sb-hlava" role="row">
        <span role="columnheader">{t("ucetSpakov.spaky")}</span>
        <span role="columnheader" className="moje">
          {mena[ja]}
        </span>
        <span role="columnheader" className="superove">
          {mena[su]}
        </span>
      </span>
      {RIADKY.filter((r) => rozpis[0][r.kluc] !== 0 || rozpis[1][r.kluc] !== 0).map((r) => (
        <span key={r.kluc} className="sb-riadok" role="row">
          <span role="rowheader">{r.nazov}</span>
          {([ja, su] as const).map((p) => (
            <span key={p} role="cell" className={rozpis[p][r.kluc] > 0 ? "plus" : rozpis[p][r.kluc] < 0 ? "minus" : "nic"}>
              {zn(rozpis[p][r.kluc])}
            </span>
          ))}
        </span>
      ))}
      <span className="sb-riadok sb-spolu" role="row">
        <span role="rowheader">{t("ucetSpakov.spolu")}</span>
        {([ja, su] as const).map((p) => (
          <span key={p} role="cell">
            <b>{sMinusom(rozpis[p].spolu)}</b>
            <IkonaSpaku />
          </span>
        ))}
      </span>
    </div>
  );
}
