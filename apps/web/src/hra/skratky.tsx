// Klávesové skratky v partii (Michal 2026-10-22, roadmapa #19): K končím /
// hotovo / potvrdiť, P pasovať, N NA EX!, O tvoje karty, Esc zrušiť, ? zoznam skratiek.
// Hlavné tlačidlo kroku nesie data-skratka — skratka ho len stlačí, takže
// platia tie isté podmienky ako pri kliknutí (disabled, potvrdenie, Krčma).
// M a číslice 1–9 patria pultu Melichara (kláves pečiatky je v skupina.json). Vypínač je v profile (Preferencie).

import { useEffect, useRef, useState } from "react";

export const SKRATKY_V_PARTII: readonly { readonly klaves: string; readonly popis: string }[] = [
  { klaves: "K", popis: "končím · hotovo · potvrdiť ťah" },
  { klaves: "P", popis: "pasovať (v šenku „už neťahám“)" },
  { klaves: "N", popis: "NA EX! na vybranú kartu" },
  { klaves: "O", popis: "tvoje karty: balíček, odhodené, priznané, Dedičstvo" },
  { klaves: "Esc", popis: "zrušiť výber · zavrieť · nakoniec vrátiť návrh ťahu do ruky" },
  { klaves: "M", popis: "pult majstra Melichara" },
  { klaves: "1–9", popis: "pečiatka Melichara s tým číslom — náhodná hláška zo skupiny" },
  { klaves: "?", popis: "tento zoznam" },
];

const STLACITELNE = new Set(["k", "p", "n", "o"]);

/** Čo je nad stolom otvorené — každé z toho zavrie Esc samo (svojou obsluhou). */
export interface VrstvyPreEsc {
  readonly lupa: boolean;
  /** Vrstva (Log, Šenok…), bublina karty hráča, zoznam skratiek, koniec hry. */
  readonly dialog: boolean;
  readonly starsi: boolean;
  /** Vybrané „+“ na konci strany, cieľ NA EX, výber karty do oblasti. */
  readonly vyber: boolean;
  readonly potvrdenie: boolean;
  readonly pult: boolean;
}

/**
 * Vráti Esc návrh ťahu do ruky? Až ako posledná vrstva (Leader 2026-10-24): kým je
 * niečo otvorené, Esc zavrie najprv to. A len cez tlačidlo návratu, ktoré by hráč
 * mohol stlačiť (`navrat` — viditeľné, povolené, nič ho nezakrýva, ani stmavenie
 * výučby), takže Esc nikdy nezruší viac než klik a návrh nepotvrdí ani neodošle.
 */
export function escVratiNavrh(vrstvy: VrstvyPreEsc, navrat: boolean): boolean {
  return navrat && !Object.values(vrstvy).some(Boolean);
}

/** Tlačidlo návratu návrhu (data-skratka="esc"), ak by ho hráč mohol stlačiť myšou. */
export function tlacidloNavratu(): HTMLElement | null {
  const el = [...document.querySelectorAll('[data-skratka="esc"]')].find(stlacitelne);
  if (el === undefined) return null;
  const r = el.getBoundingClientRect();
  const navrchu = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return navrchu !== null && el.contains(navrchu) ? el : null;
}

/** Pri písaní do poľa (chat, meno…) skratky mlčia. */
function pise(t: EventTarget | null): boolean {
  return t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement || (t instanceof HTMLElement && t.isContentEditable);
}

function stlacitelne(el: Element): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  if (el instanceof HTMLButtonElement && el.disabled) return false;
  if (el.getAttribute("aria-disabled") === "true") return false;
  return el.getClientRects().length > 0;
}

/** Zapne skratky; vráti, či je otvorený zoznam skratiek, a jeho prepínač. */
export function useSkratky(
  zapnute: boolean,
  /** Kláves bez tlačidla na stole (N bez vybranej karty) — stôl povie prečo (playtest výučby U6). */
  bezTlacidla?: (klaves: string) => void,
): { readonly napoveda: boolean; readonly prepniNapovedu: () => void; readonly zavriNapovedu: () => void } {
  const [napoveda, setNapoveda] = useState(false);
  const bezTlacidlaRef = useRef(bezTlacidla);
  bezTlacidlaRef.current = bezTlacidla;
  useEffect(() => {
    if (!zapnute) return;
    const klaves = (e: KeyboardEvent): void => {
      if (e.ctrlKey || e.metaKey || e.altKey || pise(e.target)) return;
      if (e.key === "?") {
        e.preventDefault();
        setNapoveda((n) => !n);
        return;
      }
      if (e.key === "Escape") {
        setNapoveda(false);
        return;
      }
      const k = e.key.toLowerCase();
      if (!STLACITELNE.has(k)) return;
      const tlacidlo = [...document.querySelectorAll(`[data-skratka="${k}"]`)].find(stlacitelne);
      if (tlacidlo === undefined) {
        bezTlacidlaRef.current?.(k);
        return;
      }
      e.preventDefault();
      tlacidlo.click();
    };
    window.addEventListener("keydown", klaves);
    return () => window.removeEventListener("keydown", klaves);
  }, [zapnute]);
  return { napoveda, prepniNapovedu: () => setNapoveda((n) => !n), zavriNapovedu: () => setNapoveda(false) };
}

export function SkratkyNapoveda({ onZavri }: { readonly onZavri: () => void }) {
  return (
    <div className="skratky-napoveda" role="dialog" aria-label="Klávesové skratky">
      <header>
        <strong>Klávesové skratky</strong>
        <button type="button" className="tlacidlo-male" onClick={onZavri} aria-label="Zavrieť (Esc)">
          ✕
        </button>
      </header>
      <dl>
        {SKRATKY_V_PARTII.map((s) => (
          <div key={s.klaves}>
            <dt>
              <kbd>{s.klaves}</kbd>
            </dt>
            <dd>{s.popis}</dd>
          </div>
        ))}
      </dl>
      <p className="tlmene">Pri písaní do poľa skratky nefungujú. Vypnúť ich môžeš v Profile → Preferencie.</p>
    </div>
  );
}
