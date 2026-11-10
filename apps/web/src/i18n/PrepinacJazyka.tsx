// Prepínač jazyka v hlavičke (lokalizácia, Michal 2026-11-10). Návštevníkovi sa voľba uloží
// v prehliadači, prihlásenému aj v profile — platí potom na každom zariadení.

import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api.ts";
import { useUcet, type Pouzivatel } from "../lib/ucet.tsx";
import { JAZYKY, NAZVY_JAZYKOV, nastavJazyk, t, useJazyk, type Jazyk } from "./jazyk.tsx";
import "./prepinac.css";

/** Voľba hráča: v prehliadači vždy, prihlásenému aj v profile (platí na každom zariadení). */
export function zvolJazyk(j: Jazyk, ja: Pouzivatel | null, nastav: (p: Pouzivatel) => void): void {
  void nastavJazyk(j, true);
  if (ja === null || ja.jazyk === j) return;
  api
    .patch<{ pouzivatel: Pouzivatel }>("/profil", { jazyk: j })
    .then((r) => nastav(r.pouzivatel))
    .catch(() => undefined);
}

export function PrepinacJazyka() {
  const jazyk = useJazyk();
  const { ja, nastav } = useUcet();
  const [otvorene, setOtvorene] = useState(false);
  const obal = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!otvorene) return;
    const zavri = (e: MouseEvent): void => {
      if (obal.current !== null && !obal.current.contains(e.target as Node)) setOtvorene(false);
    };
    const esc = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setOtvorene(false);
    };
    document.addEventListener("mousedown", zavri);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", zavri);
      document.removeEventListener("keydown", esc);
    };
  }, [otvorene]);

  const vyber = (j: Jazyk): void => {
    setOtvorene(false);
    zvolJazyk(j, ja, nastav);
  };

  return (
    <div className="jazyk-obal" ref={obal}>
      <button
        type="button"
        className="jazyk-tlacidlo"
        aria-haspopup="menu"
        aria-expanded={otvorene}
        aria-label={t("jazyk.volbaPopis", { jazyk: NAZVY_JAZYKOV[jazyk] })}
        title={t("jazyk.volba")}
        onClick={() => setOtvorene((o) => !o)}
      >
        {jazyk.toUpperCase()}
        <span className="sipka" aria-hidden="true">▾</span>
      </button>
      {otvorene && (
        <div className="ucet-menu jazyk-menu" role="menu">
          {JAZYKY.map((j) => (
            <button key={j} type="button" role="menuitemradio" aria-checked={j === jazyk} lang={j} className={j === jazyk ? "aktivna" : undefined} onClick={() => vyber(j)}>
              <span className="jazyk-kod">{j.toUpperCase()}</span>
              {NAZVY_JAZYKOV[j]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
