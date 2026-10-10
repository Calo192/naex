// Ikona akcie: vstavané piktogramy z tlačového PDF (ikony.ts), vlastné
// akcie ako nahraté SVG (cez <img> — skripty v SVG sa nespustia).

import type { AkciaDef } from "@naex/tvorba";
import { IKONY } from "./ikony.ts";
import { mediaUrl } from "../lib/api.ts";

const VSTAVANE = IKONY as Readonly<Record<string, readonly { d: string; evenOdd: boolean }[]>>;

export function IkonaAkcie({ kluc, akcia }: { readonly kluc: string; readonly akcia?: AkciaDef | undefined }) {
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
  return (
    <svg className="ikona-akcie" viewBox="0 0 100 100" aria-hidden="true">
      {cesty.map((c, i) => (
        <path key={i} d={c.d} fillRule={c.evenOdd ? "evenodd" : "nonzero"} />
      ))}
    </svg>
  );
}
