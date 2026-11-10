// Jednotný bar nad stolom (Michal 2026-10-25, mock V2 „Os dole, správa pod verdiktom“).
// Hore: tvoja strana | odhad kola | súperova strana (Michal 2026-11-06: strany vždy akcie, bez správy súpera;
// chyba ťahu na chvíľu preberie stred). Telefón si nechal svoj odznak.
// Dole: os kola ako pravítko nad stolom, vydesení a Log · ? — len na mobile a v prehrávači;
// pri stole je os v strede hlavičky webu (Michal 2026-10-27, dizajn timeline-lista A) a bar má jeden riadok.
// Výška je vo všetkých fázach aj režimoch rovnaká (hra.css, .jbar) — stôl pod ním neskáče.

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTip, type TipObsah } from "../karta/Tip.tsx";
import type { RezimMelichara, RezimStran } from "./bar.ts";
import { ID_MIESTA_MELICHARA } from "./MelicharBar.tsx";
import { rozmiestniAkcie } from "./ustupkyBaru.ts";
import { t } from "../i18n/jazyk.tsx";

export interface StranaBaru {
  /** „ty“ alebo meno súpera. */
  readonly meno: string;
  readonly akcie: ReactNode;
  readonly karty: ReactNode;
  /** Kto je na rade — len nenápadne, stôl to povie farbou (Michal 2026-10-25). */
  readonly naTahu: boolean;
  /** Stav pod menom (pas, NA EX skryto, stavia šenok); má prednosť pred „na ťahu“. */
  readonly stav?: { readonly text: string; readonly tip?: string } | null;
}

export interface JednotnyBarProps {
  /** Os kola, vydesení a nástroje stola v dolnom riadku; null = os je v hlavičke webu, bar má jeden riadok. */
  readonly os: ReactNode | null;
  readonly desi: ReactNode | null;
  readonly nastroje: ReactNode | null;
  readonly rezim: RezimStran;
  /** Riadok stredu: odhad kola, inak cieľ. */
  readonly stred: ReactNode;
  readonly tip: TipObsah | null;
  readonly ja: StranaBaru;
  readonly su: StranaBaru;
  /** Prečo ťah neprešiel: jediné hlásenie, ktoré v bare ostalo. */
  readonly chyba: string | null;
  readonly zrusChybu?: (() => void) | undefined;
  /** Telefón: strany ukazujú len karty a správy ostávajú; akcie sú v celom paneli bitky pod barom. */
  readonly mobil?: boolean;
  /** Telefón na šírku: ťuk na odznak odhadu ukáže okno s celým odhadom (nápoveda pod myšou tam nie je). */
  readonly onOdhad?: (() => void) | undefined;
  /** Plávajúce pod barom (zoznam skratiek). */
  readonly children?: ReactNode;
}

function Strana({ s, kto, rezim }: { readonly s: StranaBaru; readonly kto: "ja" | "su"; readonly rezim: RezimStran }) {
  return (
    <div className={`jbar-strana ${kto}${s.naTahu ? " na-tahu" : ""}`}>
      <span className="jbar-kto" title={s.stav?.tip ?? (s.naTahu ? t("bar.menoNaTahu", { meno: s.meno }) : s.meno)}>
        {s.meno}
        {s.stav != null ? <small className="jbar-na-tahu">{s.stav.text}</small> : s.naTahu && <small className="jbar-na-tahu">{t("bar.naTahu")}</small>}
      </span>
      {rezim === "akcie" ? (
        <span className="jbar-obsah efekty jbar-akcie">
          {s.akcie}
          <span className="efekt jbar-vic" hidden />
        </span>
      ) : (
        <span className="jbar-obsah jbar-karty">{s.karty}</span>
      )}
    </div>
  );
}

export function JednotnyBar({ os, desi, nastroje, rezim, stred, tip, ja, su, chyba, zrusChybu, mobil = false, onOdhad, children }: JednotnyBarProps) {
  const { tip: okno, ukaz, skry } = useTip();
  const chybaVStrede = !mobil && chyba !== null;
  // Klik pripne nápovedu odhadu, aby sa dala čítať bez držania myši (mock: „mouseover alebo klik“).
  const [pripnuty, setPripnuty] = useState(false);
  // Strany sa rozsúvajú podľa skutočnej šírky pri každom vykreslení aj pri zmene okna.
  const barRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (barRef.current !== null && rezim === "akcie") rozmiestniAkcie(barRef.current);
  });
  useEffect(() => {
    const el = barRef.current;
    if (el === null || rezim !== "akcie") return;
    const ro = new ResizeObserver(() => rozmiestniAkcie(el));
    ro.observe(el);
    return () => ro.disconnect();
  }, [rezim]);
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
  const sOsou = os !== null || desi !== null || nastroje !== null;
  return (
    <header
      ref={barRef}
      className={`jbar rezim-${rezim}${sOsou ? "" : " bez-osi"}${mel === null ? "" : ` mel-hovori mel-${mel.rezim}`}`}
      aria-label={sOsou ? "Priebeh kola a odhad" : "Odhad kola"}
    >
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
        <div className={`jbar-stred${chybaVStrede ? " s-chybou" : ""}`}>
          {!chybaVStrede && (
            <button
              type="button"
              className="jbar-odhad"
              data-vyucba="odhad"
              aria-label={onOdhad !== undefined ? "Odhad bitky — ťuk ukáže podrobnosti" : "Odhad kola — klik pripne podrobnosti"}
              disabled={onOdhad === undefined && (mobil || tip === null)}
              onClick={(e) => {
                if (onOdhad !== undefined) {
                  onOdhad();
                  return;
                }
                if (tip === null) return;
                if (pripnuty) skry();
                else ukaz(e.currentTarget, tip);
                setPripnuty(!pripnuty);
              }}
              onMouseEnter={(e) => onOdhad === undefined && tip !== null && ukaz(e.currentTarget, tip)}
              onMouseLeave={() => {
                if (!pripnuty) skry();
              }}
              onFocus={(e) => onOdhad === undefined && tip !== null && ukaz(e.currentTarget, tip)}
              onBlur={() => {
                setPripnuty(false);
                skry();
              }}
            >
              {stred}
            </button>
          )}
          {okno}
          <div className={`jbar-sprava-miesto${chyba === null ? " prazdne" : ""}`} role="status" aria-live="polite">
            {chyba !== null && (
              <span className="jbar-sprava chyba" title={chyba} role="alert">
                <span className="jbar-sprava-text">⚠ Ťah neprešiel: {chyba}</span>
                {zrusChybu !== undefined && (
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
      {sOsou && (
        <div className="jbar-os" hidden={mel !== null && mel.rezim !== "hore"}>
          {os}
          {desi}
          {nastroje}
        </div>
      )}
      {children}
    </header>
  );
}
