// Celá obrazovka (Michal 2026-10-31, po skúške na Androide): adresný riadok Chromu zobral stolu
// na šírku ≈ 15 % výšky. Na telefóne je celá obrazovka povinná — kým nie je, stôl prekryje výzva
// „Ťukni a hraj na celú obrazovku“ (Fullscreen API chce gesto) a po ťuku sa zamkne orientácia
// na šírku. iPhone (Safari) Fullscreen API pre stránku nemá — tam stačí poloha na šírku.
// Na počítači je to len nenápadná ikona vedľa Log · ? pre všetkých; stôl v celej obrazovke
// prepočíta rozloženie sám (reaguje na resize okna).

import { useCallback, useEffect, useState } from "react";
import { vyzvaTelefonu, type VyzvaTelefonu } from "./zariadenie.ts";

type OrientaciaSZamkom = ScreenOrientation & { lock?: (o: string) => Promise<void> };

/** Prehliadač odmietol celú obrazovku (napr. vstavaný prehliadač aplikácie) — do zatvorenia karty sa už nevyžaduje. */
const KLUC_ODMIETNUTA = "naex-cela-obrazovka-odmietnuta";

/** Prehliadač vie dať stránku na celú obrazovku (Android Chrome áno, iPhone Safari nie). */
function dostupna(): boolean {
  return typeof document !== "undefined" && document.fullscreenEnabled === true && typeof document.documentElement.requestFullscreen === "function";
}

function odmietnuta(): boolean {
  try {
    return sessionStorage.getItem(KLUC_ODMIETNUTA) === "1";
  } catch {
    return false;
  }
}

function zamkniNaSirku(): void {
  const o = (typeof screen === "undefined" ? undefined : screen.orientation) as OrientaciaSZamkom | undefined;
  try {
    o?.lock?.("landscape").catch(() => undefined);
  } catch {
    // starší prehliadač — orientáciu nechá na hráčovi
  }
}

/** Zapne celú obrazovku a zamkne šírku; false = prehliadač ju odmietol. */
function zapni(): Promise<boolean> {
  return document.documentElement
    .requestFullscreen({ navigationUI: "hide" })
    .then(() => {
      zamkniNaSirku();
      return true;
    })
    .catch(() => false);
}

export function useCelaObrazovka(): { readonly mozna: boolean; readonly zapnuta: boolean; readonly prepni: () => void } {
  const [mozna] = useState(dostupna);
  const [zapnuta, setZapnuta] = useState(() => typeof document !== "undefined" && document.fullscreenElement !== null);
  useEffect(() => {
    const zmena = (): void => setZapnuta(document.fullscreenElement !== null);
    document.addEventListener("fullscreenchange", zmena);
    return () => document.removeEventListener("fullscreenchange", zmena);
  }, []);
  const prepni = useCallback(() => {
    if (document.fullscreenElement !== null) {
      void document.exitFullscreen().catch(() => undefined);
      return;
    }
    void zapni();
  }, []);
  return { mozna, zapnuta, prepni };
}

/**
 * Výzva na telefóne (stôl pre telefón, len správca): celá obrazovka, kde ju prehliadač vie,
 * inak len poloha na šírku. `zapni` patrí do ťuku na výzvu.
 */
export function useVyzvaTelefonu(telefon: boolean, naVysku: boolean): { readonly vyzva: VyzvaTelefonu; readonly zapni: () => void } {
  const { mozna, zapnuta } = useCelaObrazovka();
  const [zamietnuta, setZamietnuta] = useState(odmietnuta);
  const vyzva = vyzvaTelefonu({ telefon, naVysku, celaMozna: mozna && !zamietnuta, celaZapnuta: zapnuta });
  const zapniCelu = useCallback(() => {
    void zapni().then((ok) => {
      if (ok) return;
      setZamietnuta(true);
      try {
        sessionStorage.setItem(KLUC_ODMIETNUTA, "1");
      } catch {
        // súkromné okno bez úložiska — pamätá si to len táto stránka
      }
    });
  }, []);
  return { vyzva, zapni: zapniCelu };
}

function IkonaCelejObrazovky({ zapnuta }: { readonly zapnuta: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="ikona-celej-obrazovky">
      {zapnuta ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /> : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
    </svg>
  );
}

/** Ikona v hornom pulte: zapne alebo vypne celú obrazovku. */
export function TlacidloCelejObrazovky({ zapnuta, prepni }: { readonly zapnuta: boolean; readonly prepni: () => void }) {
  return (
    <button
      type="button"
      className="hlava-vrstva tlacidlo-celej-obrazovky"
      aria-pressed={zapnuta}
      aria-label={zapnuta ? "Ukončiť celú obrazovku" : "Hrať na celú obrazovku"}
      title={zapnuta ? "Ukončiť celú obrazovku" : "Hrať na celú obrazovku"}
      onClick={prepni}
    >
      <IkonaCelejObrazovky zapnuta={zapnuta} />
    </button>
  );
}

/**
 * Celoplošná výzva na telefóne: kým nie je celá obrazovka, stôl sa nehrá. Ťuk kamkoľvek ju zapne
 * (prehliadač chce gesto). Stôl pod výzvou ostáva v DOM aj so spojením — keď hráč celú obrazovku
 * opustí gestom späť, výzva sa vráti a partia počká presne v tom stave.
 */
export function VyzvaCelejObrazovky({ zapni }: { readonly zapni: () => void }) {
  return (
    <button type="button" className="otoc-telefon vyzva-celej-obrazovky" aria-labelledby="vyzva-celej-obrazovky-nadpis" onClick={zapni} autoFocus>
      <IkonaCelejObrazovky zapnuta={false} />
      <strong id="vyzva-celej-obrazovky-nadpis">Ťukni a hraj na celú obrazovku</strong>
      <span>Stôl NA EX! sa na telefóne hrá na celej obrazovke — lišta prehliadača by zobrala miesto kartám. Partia beží ďalej a počká ťa presne v tomto stave.</span>
    </button>
  );
}
