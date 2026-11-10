// Pojem v texte pravidiel (osnova 2026-10-24): podčiarknutý, vysvetlenie zo
// slovníka sa ukáže pod myšou alebo pri fokuse z klávesnice; na dotykovom
// zariadení ťuknutie otvorí spodný panel. Klik myšou skočí do slovníka.

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useTip } from "../../karta/Tip.tsx";
import { pojemJadra, pojemSlovnika, type PojemSlovnika } from "./slovnik.ts";

interface PojemKontext {
  ukaz(el: Element, id: string): void;
  skry(): void;
  otvor(id: string): void;
}

const Kontext = createContext<PojemKontext | null>(null);

/** Skok na pojem v slovníku na konci stránky. */
export function chodNaPojem(id: string): void {
  const el = document.getElementById(`pojem-${id}`);
  if (el === null) return;
  history.pushState(null, "", `#pojem-${id}`);
  el.scrollIntoView({ block: "center" });
  el.classList.add("pojem-zvyrazneny");
  setTimeout(() => el.classList.remove("pojem-zvyrazneny"), 1600);
}

export function PojmyPravidiel({ children }: { readonly children: ReactNode }) {
  const { tip, ukaz: ukazTip, skry } = useTip();
  const [panel, setPanel] = useState<PojemSlovnika | null>(null);
  const ukaz = useCallback(
    (el: Element, id: string) => {
      const p = pojemSlovnika(id);
      if (p !== null) ukazTip(el, { nadpis: p.pojem, text: p.popis });
    },
    [ukazTip],
  );
  const otvor = useCallback((id: string) => setPanel(pojemSlovnika(id)), []);
  useEffect(() => {
    if (panel === null) return;
    const esc = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setPanel(null);
    };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [panel]);

  return (
    <Kontext.Provider value={{ ukaz, skry, otvor }}>
      {children}
      {tip}
      {panel !== null && (
        <div className="pojem-panel" role="dialog" aria-label={panel.pojem}>
          <button type="button" className="pojem-panel-zavriet" aria-label="Zavrieť" onClick={() => setPanel(null)}>
            ✕
          </button>
          <strong>{panel.pojem}</strong>
          <p>{panel.popis}</p>
          <a
            href={`#pojem-${panel.id}`}
            onClick={(e) => {
              e.preventDefault();
              setPanel(null);
              chodNaPojem(panel.id);
            }}
          >
            V slovníku →
          </a>
        </div>
      )}
    </Kontext.Provider>
  );
}

/** Pojem v texte; k = id zo slovníka, obsah = slovo v texte (v páde vety). */
export function Pojem({ k, children }: { readonly k: string; readonly children: ReactNode }) {
  const kontext = useContext(Kontext);
  if (kontext === null || pojemSlovnika(k) === null) return <>{children}</>;
  return (
    <button
      type="button"
      className="pojem"
      onMouseEnter={(e) => kontext.ukaz(e.currentTarget, k)}
      onMouseLeave={kontext.skry}
      onFocus={(e) => kontext.ukaz(e.currentTarget, k)}
      onBlur={kontext.skry}
      onPointerUp={(e) => {
        // Dotyk: spodný panel (bublina pod prstom by zakryla text); myš: skok do slovníka.
        kontext.skry();
        if (e.pointerType === "touch" || e.pointerType === "pen") kontext.otvor(k);
        else chodNaPojem(k);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          kontext.skry();
          chodNaPojem(k);
        }
      }}
    >
      {children}
    </button>
  );
}

/**
 * Pojem jadra v bubline Melichara a v nápovedách (Michal 2026-11-10): podčiarknutý, pod myšou
 * alebo pri fokuse krátka veta pre nováčika (JADRO_POJMOV), na dotyku ju ukáže a skryje ťuk.
 * Nie je to tlačidlo — bublina leží aj v tlačidlách možností a tlačidlo v tlačidle nejde.
 */
export function PojemVBubline({ k, children }: { readonly k: string; readonly children: ReactNode }) {
  const { tip, ukaz, skry } = useTip();
  const otvoreny = useRef(false);
  const dotyk = useRef(false);
  const p = pojemSlovnika(k);
  const j = pojemJadra(k);
  if (p === null || j === null) return <>{children}</>;
  const otvor = (el: Element): void => {
    otvoreny.current = true;
    ukaz(el, { nadpis: p.pojem, text: j.kratko });
  };
  const zavri = (): void => {
    otvoreny.current = false;
    skry();
  };
  return (
    <>
      <span
        className="pojem pojem-bublina"
        role="button"
        tabIndex={0}
        aria-label={`${p.pojem}: ${j.kratko}`}
        onMouseEnter={(e) => otvor(e.currentTarget)}
        onMouseLeave={zavri}
        onFocus={(e) => otvor(e.currentTarget)}
        onBlur={zavri}
        onPointerUp={(e) => {
          dotyk.current = e.pointerType !== "mouse";
          if (!dotyk.current) return;
          if (otvoreny.current) zavri();
          else otvor(e.currentTarget);
        }}
        onClick={(e) => {
          // Ťuk na slovo len ukáže vysvetlenie — neprejde na bar pod ním (ďalšia strana, „rozumiem“).
          if (dotyk.current) e.stopPropagation();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") zavri();
        }}
      >
        {children}
      </span>
      {tip}
    </>
  );
}
