// Účet špakov (pravidlá v6, Michal 2026-10-26): odkiaľ má každý hráč špaky —
// bitky, starší, prebytok vo finále, Exekútor a nepriznaná Cirhóza. Jednoduchá
// tabuľka pre koniec hry a detail partie; popolníky a krčmovú nástenku kreslí
// UI v6. Čísla ráta jadro (rozpisSpakov), klient ich len píše.

import type { PlayerId, RozpisSpakov } from "@naex/core";

const RIADKY: readonly { readonly kluc: keyof RozpisSpakov; readonly nazov: string }[] = [
  { kluc: "zaBitky", nazov: "vyhraté bitky" },
  { kluc: "zaStarsich", nazov: "starší, ktorí sa boja" },
  { kluc: "prebytok", nazov: "prebytok (finále, Kultúrny dom)" },
  { kluc: "exekutor", nazov: "Exekútor" },
  { kluc: "cirhoza", nazov: "nepriznaná Cirhóza" },
];

export function UcetSpakov({ rozpis, ja, mena }: { readonly rozpis: readonly [RozpisSpakov, RozpisSpakov]; readonly ja: PlayerId; readonly mena: readonly [string, string] }) {
  const su: PlayerId = ja === 0 ? 1 : 0;
  return (
    <table className="ucet-spakov">
      <thead>
        <tr>
          <th scope="col">špaky</th>
          <th scope="col">{mena[ja]}</th>
          <th scope="col">{mena[su]}</th>
        </tr>
      </thead>
      <tbody>
        {RIADKY.filter((r) => rozpis[0][r.kluc] !== 0 || rozpis[1][r.kluc] !== 0).map((r) => (
          <tr key={r.kluc}>
            <th scope="row">{r.nazov}</th>
            <td className="cislo">{rozpis[ja][r.kluc]}</td>
            <td className="cislo">{rozpis[su][r.kluc]}</td>
          </tr>
        ))}
        <tr className="ucet-spakov-spolu">
          <th scope="row">spolu</th>
          <td className="cislo">{rozpis[ja].spolu}</td>
          <td className="cislo">{rozpis[su].spolu}</td>
        </tr>
      </tbody>
    </table>
  );
}
