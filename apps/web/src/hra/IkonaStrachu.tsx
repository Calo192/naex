// Ikona strachu staršieho na stole, v pravidlách a v achievementoch — tvary a ich zdôvodnenie
// sú v tvaryStrachu.ts (bez Reactu, aby z nich vznikli aj tlačové ikony bodovania).

import "./ikona-strachu.css";
import type { StupenStrachu } from "./tvaryStrachu.ts";
import { PRIESVITNOST_PODKLADU, cestaVykricnikovPeciatky, cestyStrachu, stupenStrachu } from "./tvaryStrachu.ts";

export type { StupenStrachu } from "./tvaryStrachu.ts";
export { NAZOV_STUPNA, PRIESVITNOST_PODKLADU, cestyStrachu, stupenStrachu } from "./tvaryStrachu.ts";

/**
 * Ikona strachu do textu a dlaždíc. Farbu dá rodič (color), veľkosť CSS (.ikona-strachu).
 * S `titul` je to obrázok s menom pre čítačku, inak ozdoba vedľa textu, ktorý to už hovorí.
 */
export function IkonaStrachu({ stupen, trieda, titul }: { readonly stupen: StupenStrachu; readonly trieda?: string; readonly titul?: string }) {
  return (
    <svg
      className={`ikona-strachu s${stupen}${trieda === undefined ? "" : ` ${trieda}`}`}
      viewBox="0 0 24 24"
      {...(titul === undefined ? { "aria-hidden": true } : { role: "img", "aria-label": titul })}
    >
      {titul !== undefined && <title>{titul}</title>}
      {cestyStrachu(stupen).map((c, i) => (
        <path key={i} d={c.d} fillRule={c.evenOdd ? "evenodd" : undefined} fillOpacity={c.podklad ? PRIESVITNOST_PODKLADU : undefined} />
      ))}
    </svg>
  );
}

/** Ikona podľa úrovne zóny alebo špakov za strach; v Neutralite (0) nič. */
export function ZnackaStrachu({ uroven, trieda, titul }: { readonly uroven: number; readonly trieda?: string; readonly titul?: string }) {
  const stupen = stupenStrachu(uroven);
  if (stupen === null) return null;
  return <IkonaStrachu stupen={stupen} {...(trieda === undefined ? {} : { trieda })} {...(titul === undefined ? {} : { titul })} />;
}

/** !!! do pečiatky vydesenia na portréte — rám a atrament vo farbe obávaného dá CSS pečiatky. */
export function VykricnikyPeciatky() {
  return (
    <svg className="vykricniky-peciatky" viewBox="4.6 3.6 14.8 16.8" aria-hidden="true">
      <path d={cestaVykricnikovPeciatky()} />
    </svg>
  );
}
