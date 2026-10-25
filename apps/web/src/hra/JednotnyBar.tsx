// Jednotný bar nad stolom (Michal 2026-10-25, mock V2 „Os dole, správa pod verdiktom“).
// Hore: tvoja strana | odhad bitky, prepínač strán a stavová správa | súperova strana.
// Dole: os kola ako pravítko nad stolom, vydesení a Šenok · Lokality · Log · ?.
// Výška je vo všetkých fázach aj režimoch rovnaká (hra.css, .jbar) — stôl pod ním neskáče.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTip, type TipObsah } from "../karta/Tip.tsx";
import type { RezimMelichara, RezimStran, SpravaBaru } from "./bar.ts";
import { ID_MIESTA_MELICHARA } from "./MelicharBar.tsx";

export interface StranaBaru {
  /** „ty“ alebo meno súpera. */
  readonly meno: string;
  readonly akcie: ReactNode;
  readonly karty: ReactNode;
  /** Kto je na rade — len nenápadne, stôl to povie farbou (Michal 2026-10-25). */
  readonly naTahu: boolean;
}

export interface JednotnyBarProps {
  readonly os: ReactNode;
  readonly desi: ReactNode;
  readonly nastroje: ReactNode;
  readonly rezim: RezimStran;
  readonly prepni: () => void;
  /** Riadok stredu: odhad bitky, inak cieľ kola. */
  readonly stred: ReactNode;
  readonly tip: TipObsah | null;
  readonly ja: StranaBaru;
  readonly su: StranaBaru;
  readonly sprava: SpravaBaru | null;
  readonly zrusChybu?: (() => void) | undefined;
  /** Na mobile strany ukazujú len karty — akcie sú v celom paneli bitky pod barom. */
  readonly bezPrepinaca?: boolean;
  /** Plávajúce pod barom (zoznam skratiek). */
  readonly children?: ReactNode;
}

interface ZobrazenaSprava {
  readonly sprava: SpravaBaru;
  readonly id: number;
  readonly stara: boolean;
}

function Strana({ s, kto, rezim }: { readonly s: StranaBaru; readonly kto: "ja" | "su"; readonly rezim: RezimStran }) {
  return (
    <div className={`jbar-strana ${kto}${s.naTahu ? " na-tahu" : ""}`}>
      <span className="jbar-kto" title={s.naTahu ? `${s.meno} — na ťahu` : s.meno}>
        {s.meno}
        {s.naTahu && <small className="jbar-na-tahu">na ťahu</small>}
      </span>
      <span className={`jbar-obsah ${rezim === "akcie" ? "efekty jbar-akcie" : "jbar-karty"}`}>{rezim === "akcie" ? s.akcie : s.karty}</span>
    </div>
  );
}

export function JednotnyBar({ os, desi, nastroje, rezim, prepni, stred, tip, ja, su, sprava, zrusChybu, bezPrepinaca = false, children }: JednotnyBarProps) {
  const { tip: okno, ukaz, skry } = useTip();
  // Kým nepríde nová správa, stará ostane stlmená (mock V2) — miesto nikdy neskáče prázdne
  // a hráč si ju ešte dočíta. Chyba po potvrdení zmizne celá.
  const [zobrazena, setZobrazena] = useState<ZobrazenaSprava | null>(null);
  useEffect(() => {
    setZobrazena((z) => {
      if (sprava === null) return z === null || z.sprava.druh === "chyba" ? null : z.stara ? z : { ...z, stara: true };
      if (z !== null && !z.stara && z.sprava.druh === sprava.druh && z.sprava.text === sprava.text) return z;
      return { sprava, id: (z?.id ?? 0) + 1, stara: false };
    });
  }, [sprava?.druh, sprava?.text]);
  const z = zobrazena;
  const prepnutNa = rezim === "akcie" ? "karty na vyloženie" : "aktivované akcie";
  // Keď hovorí Melichar (jeho bublina je v mieste baru), bar skryje svoje riadky — os ostane,
  // keď na ňu ukazuje; odhad, o ktorom hovorí, sa vloží do jeho bubliny.
  const miestoRef = useRef<HTMLDivElement>(null);
  const [mel, setMel] = useState<{ readonly rezim: RezimMelichara; readonly ukazka: HTMLElement | null } | null>(null);
  useEffect(() => {
    const el = miestoRef.current;
    if (el === null) return;
    const zisti = (): void => {
      const bublina = [...el.children].at(-1);
      const r = bublina?.getAttribute("data-mel-rezim");
      const rezimMel: RezimMelichara | null = r === "cely" || r === "hore" || r === "odhad" ? r : null;
      const ukazka = bublina?.querySelector<HTMLElement>(".mel-ukazka") ?? null;
      setMel((m) => (rezimMel === null ? null : m?.rezim === rezimMel && m.ukazka === ukazka ? m : { rezim: rezimMel, ukazka }));
    };
    zisti();
    const mo = new MutationObserver(zisti);
    mo.observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-mel-rezim"] });
    return () => mo.disconnect();
  }, []);
  return (
    <header className={`jbar rezim-${rezim}${mel === null ? "" : ` mel-hovori mel-${mel.rezim}`}`} aria-label="Priebeh kola a odhad bitky">
      <div className="jbar-mel-miesto" id={ID_MIESTA_MELICHARA} ref={miestoRef} />
      {mel?.rezim === "odhad" &&
        mel.ukazka !== null &&
        createPortal(
          <span className="jbar-odhad jbar-odhad-kopia" onMouseEnter={(e) => tip !== null && ukaz(e.currentTarget, tip)} onMouseLeave={skry}>
            {stred}
          </span>,
          mel.ukazka,
        )}
      <div className="jbar-st" hidden={mel !== null}>
        <Strana s={ja} kto="ja" rezim={rezim} />
        <div className="jbar-stred">
          <button
            type="button"
            className="jbar-odhad"
            data-prepni-strany=""
            data-vyucba="odhad"
            aria-pressed={rezim === "karty"}
            aria-label={bezPrepinaca ? undefined : `Strany baru: ${rezim === "akcie" ? "akcie" : "karty"} — klik prepne na ${prepnutNa}`}
            disabled={bezPrepinaca}
            onClick={prepni}
            onMouseEnter={(e) => tip !== null && ukaz(e.currentTarget, tip)}
            onMouseLeave={skry}
            onFocus={(e) => tip !== null && ukaz(e.currentTarget, tip)}
            onBlur={skry}
          >
            {stred}
            {!bezPrepinaca && (
              <span className="jbar-cip" aria-hidden="true">
                <span className={rezim === "akcie" ? "zap" : ""}>akcie</span>
                <span className={rezim === "karty" ? "zap" : ""}>karty</span>
              </span>
            )}
          </button>
          {okno}
          <div className="jbar-sprava-miesto" role="status" aria-live="polite">
            {z !== null && (
              <span
                key={z.id}
                className={`jbar-sprava ${z.sprava.druh}${z.stara ? " stara" : " nova"}`}
                title={z.sprava.text}
                {...(z.sprava.druh === "chyba" ? { role: "alert" } : {})}
              >
                <span className="jbar-sprava-text">
                  {z.sprava.druh === "chyba" ? "⚠ Ťah neprešiel: " : z.sprava.druh === "super" ? "↺ " : ""}
                  {z.sprava.text}
                </span>
                {z.sprava.druh === "chyba" && zrusChybu !== undefined && (
                  <button type="button" className="tlacidlo-male" onClick={zrusChybu}>
                    OK
                  </button>
                )}
              </span>
            )}
          </div>
        </div>
        <Strana s={su} kto="su" rezim={rezim} />
      </div>
      <div className="jbar-os" hidden={mel !== null && mel.rezim !== "hore"}>
        {os}
        {desi}
        {nastroje}
      </div>
      {children}
    </header>
  );
}
