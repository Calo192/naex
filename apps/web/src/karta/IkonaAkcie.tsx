// Ikona akcie: vstavané piktogramy z tlačového PDF (ikony.ts), vlastné
// akcie ako nahraté SVG (cez <img> — skripty v SVG sa nespustia).

import { useId } from "react";
import type { AkciaDef } from "@naex/tvorba";
import { IKONY } from "./ikony.ts";
import { mediaUrl } from "../lib/api.ts";

const VSTAVANE = IKONY as Readonly<Record<string, readonly { d: string; evenOdd: boolean }[]>>;

/**
 * `zar`: akcia posilnená Nástrojom (žeravá ikona) — piktogram dostane žeravý
 * prechod a rozmazanú žiaru pod sebou. Nahraté SVG zafarbí CSS filter (karta.css).
 */
export function IkonaAkcie({ kluc, akcia, zar = false }: { readonly kluc: string; readonly akcia?: AkciaDef | undefined; readonly zar?: boolean }) {
  // Id prechodu pre každú ikonu zvlášť — useId má dvojbodky, ktoré url(#…) nemusí zniesť.
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  if (akcia?.ikona.typ === "svg") {
    return <img className="ikona-akcie ikona-svg" src={mediaUrl(akcia.ikona.media)} alt="" draggable={false} />;
  }
  const cesty = VSTAVANE[kluc];
  if (cesty === undefined) {
    // Akcia bez ikony — aspoň začiatočné písmená.
    return (
      <svg className="ikona-akcie" viewBox="0 0 100 100" aria-hidden="true">
        <text x="50" y="62" textAnchor="middle" fontSize="34" fontWeight="700" fill="#fff">
          {(akcia?.nazov ?? kluc).slice(0, 2)}
        </text>
      </svg>
    );
  }
  const piktogram = cesty.map((c, i) => <path key={i} d={c.d} fillRule={c.evenOdd ? "evenodd" : "nonzero"} />);
  if (!zar) {
    return (
      <svg className="ikona-akcie" viewBox="0 0 100 100" aria-hidden="true">
        {piktogram}
      </svg>
    );
  }
  return (
    <svg className="ikona-akcie ikona-zar" viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id={`zar${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff2b0" />
          <stop offset=".45" stopColor="#ffb02e" />
          <stop offset="1" stopColor="#e2470f" />
        </linearGradient>
        <filter id={`zhar${id}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>
      <g className="ikona-zhar" filter={`url(#zhar${id})`}>
        {piktogram}
      </g>
      <g fill={`url(#zar${id})`}>{piktogram}</g>
    </svg>
  );
}
