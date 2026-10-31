// Celá obrazovka na telefóne (Michal 2026-10-31, po skúške na Androide): adresný riadok Chromu
// zobral stolu na šírku ≈ 15 % výšky. Fullscreen API ho na ťuk skryje a potom sa dá zamknúť
// orientácia na šírku. iPhone (Safari) Fullscreen API pre stránku nemá — tam sa nič neponúka.
// Na počítači je to len nenápadná ikona vedľa Log · ? pre všetkých (Michal 2026-10-31); stôl
// v celej obrazovke prepočíta rozloženie sám (reaguje na resize okna).

import { useCallback, useEffect, useState } from "react";

const KLUC_ODMIETNUTIA = "naex-cela-obrazovka-nie";

type OrientaciaSZamkom = ScreenOrientation & { lock?: (o: string) => Promise<void> };

/** Prehliadač vie dať stránku na celú obrazovku (Android Chrome áno, iPhone Safari nie). */
function dostupna(): boolean {
  return typeof document !== "undefined" && document.fullscreenEnabled === true && typeof document.documentElement.requestFullscreen === "function";
}

function zamkniNaSirku(): void {
  const o = (typeof screen === "undefined" ? undefined : screen.orientation) as OrientaciaSZamkom | undefined;
  try {
    o?.lock?.("landscape").catch(() => undefined);
  } catch {
    // starší prehliadač — orientáciu nechá na hráčovi
  }
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
    void document.documentElement
      .requestFullscreen({ navigationUI: "hide" })
      .then(zamkniNaSirku)
      .catch(() => undefined);
  }, []);
  return { mozna, zapnuta, prepni };
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
 * Výrazná ponuka pri príchode k stolu: raz za návštevu, kým hráč nie je na celej obrazovke.
 * „Teraz nie“ si prehliadač zapamätá do zatvorenia karty (ikona v pulte ostáva).
 */
export function PonukaCelejObrazovky({ prepni }: { readonly prepni: () => void }) {
  const [odmietnuta, setOdmietnuta] = useState(() => {
    try {
      return sessionStorage.getItem(KLUC_ODMIETNUTIA) === "1";
    } catch {
      return false;
    }
  });
  if (odmietnuta) return null;
  const nie = (): void => {
    setOdmietnuta(true);
    try {
      sessionStorage.setItem(KLUC_ODMIETNUTIA, "1");
    } catch {
      // súkromné okno bez úložiska — ponuka sa len skryje
    }
  };
  return (
    <div className="ponuka-celej-obrazovky" role="dialog" aria-modal="true" aria-labelledby="ponuka-celej-obrazovky-nadpis">
      <div className="ponuka-celej-obrazovky-okno">
        <IkonaCelejObrazovky zapnuta={false} />
        <strong id="ponuka-celej-obrazovky-nadpis">Hrať na celú obrazovku?</strong>
        <span>Lišta prehliadača zaberá stolu miesto. Na celej obrazovke sú karty väčšie a nič sa neskrýva pod okraj.</span>
        <span className="ponuka-celej-obrazovky-tlacidla">
          <button type="button" className="tlacidlo-jemne" onClick={nie}>
            Teraz nie
          </button>
          <button type="button" className="tlacidlo-hlavne" onClick={prepni} autoFocus>
            Na celú obrazovku
          </button>
        </span>
      </div>
    </div>
  );
}
