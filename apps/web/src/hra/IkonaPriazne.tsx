// Ikona priazne staršieho: krígeľ piva s penou (Michal 2026-10-30: „To srdiečko sa mi vôbec
// nepáči… V tejto hre taký symbol nemá čo robiť. Ikona priazne sa nahradí pivným pohárom.“).
// Tvar je v tvarPriazne.ts. Samostatný súbor bez závislostí na stole — pravidlá a ukážky
// ho vkladajú do textu.

import "./ikona-priazne.css";
import { CESTY_PRIAZNE } from "./tvarPriazne.ts";

/**
 * Záznam Logu o novej priazni (zaznamyPriazne v jadre) — text bez značky, inak null.
 * Jadro píše do logu len text; krígeľ pred riadok kreslí Log. Miestnosti spred zmeny
 * majú v histórii riadky so srdcom na začiatku — tie sa ukážu rovnako, bez srdca.
 */
export function riadokPriazneLogu(riadok: string): string | null {
  if (riadok.startsWith(`${String.fromCharCode(0x2665)} `)) return riadok.slice(2);
  return /^Priazeň .+ sily \d+ dostáva /.test(riadok) ? riadok : null;
}

/**
 * Ikona priazne do textu a dlaždíc — veľkosť podľa písma okolo, farbu dá rodič (color).
 * S `titul` je to obrázok s menom pre čítačku, inak ozdoba vedľa textu, ktorý to už hovorí.
 */
export function IkonaPriazne({ trieda, titul }: { readonly trieda?: string; readonly titul?: string }) {
  return (
    <svg
      className={`ikona-priazne${trieda === undefined ? "" : ` ${trieda}`}`}
      viewBox="0 0 100 100"
      {...(titul === undefined ? { "aria-hidden": true } : { role: "img", "aria-label": titul })}
    >
      {titul !== undefined && <title>{titul}</title>}
      {CESTY_PRIAZNE.map((d, i) => (
        <path key={i} d={d} fillRule="evenodd" />
      ))}
    </svg>
  );
}
