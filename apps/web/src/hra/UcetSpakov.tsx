// Účet špakov (pravidlá v6, Michal 2026-10-26): odkiaľ má každý hráč špaky —
// bitky, starší, prebytok vo finále, Exekútor a nepriznaná Cirhóza. Pre koniec
// hry a detail partie; rovnaká mriežka ako špaky jednej bitky (SpakyBitky).
// Čísla ráta jadro (rozpisSpakov), klient ich len píše.

import type { PlayerId, RozpisSpakov } from "@naex/core";
import { IkonaSpaku, sMinusom } from "./Spaky.tsx";

const RIADKY: readonly { readonly kluc: keyof RozpisSpakov; readonly nazov: string }[] = [
  { kluc: "zaBitky", nazov: "vyhraté bitky" },
  { kluc: "zaStarsich", nazov: "starší, ktorí sa boja" },
  { kluc: "prebytok", nazov: "prebytok (finále, Kultúrny dom)" },
  { kluc: "exekutor", nazov: "Exekútor" },
  { kluc: "cirhoza", nazov: "nepriznaná Cirhóza" },
];

const zn = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");

export function UcetSpakov({ rozpis, ja, mena }: { readonly rozpis: readonly [RozpisSpakov, RozpisSpakov]; readonly ja: PlayerId; readonly mena: readonly [string, string] }) {
  const su: PlayerId = ja === 0 ? 1 : 0;
  return (
    <div className="spaky-bitky ucet-spakov" role="table" aria-label="Účet špakov">
      <span className="sb-hlava" role="row">
        <span role="columnheader">špaky</span>
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
        <span role="rowheader">spolu</span>
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
