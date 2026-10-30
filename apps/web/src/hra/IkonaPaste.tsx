// Ikona päste — vydesenie pri rozdeľovaní Pohoršenia (Michal 2026-10-30: „krígeľ pre
// ‚udobrenie‘ a päsť pre ‚vydesenie‘ … intuitívnejšie, ktorým smerom sa marker posúva“).
// Dvojička IkonaPriazne: tvar v tvarPaste.ts, veľkosť podľa písma, farbu dá rodič.

import "./ikona-paste.css";
import { CESTY_PASTE } from "./tvarPaste.ts";

/** S `titul` je to obrázok s menom pre čítačku, inak ozdoba vedľa textu, ktorý to už hovorí. */
export function IkonaPaste({ trieda, titul }: { readonly trieda?: string; readonly titul?: string }) {
  return (
    <svg
      className={`ikona-paste${trieda === undefined ? "" : ` ${trieda}`}`}
      viewBox="0 0 100 100"
      {...(titul === undefined ? { "aria-hidden": true } : { role: "img", "aria-label": titul })}
    >
      {titul !== undefined && <title>{titul}</title>}
      {CESTY_PASTE.map((d, i) => (
        <path key={i} d={d} fillRule="evenodd" />
      ))}
    </svg>
  );
}
