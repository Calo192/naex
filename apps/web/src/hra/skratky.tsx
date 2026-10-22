// Klávesové skratky v partii (Michal 2026-10-22, roadmapa #19): K končím /
// hotovo / potvrdiť, P pasovať, N NA EX!, Esc zrušiť, ? zoznam skratiek.
// Hlavné tlačidlo kroku nesie data-skratka — skratka ho len stlačí, takže
// platia tie isté podmienky ako pri kliknutí (disabled, potvrdenie, Krčma).
// M a 1–4 patria soundboardu Melichara. Vypínač je v profile (Preferencie).

import { useEffect, useState } from "react";

export const SKRATKY_V_PARTII: readonly { readonly klaves: string; readonly popis: string }[] = [
  { klaves: "K", popis: "končím · hotovo · potvrdiť ťah" },
  { klaves: "P", popis: "pasovať (v šenku „už neťahám“)" },
  { klaves: "N", popis: "NA EX! na vybranú kartu" },
  { klaves: "Esc", popis: "zrušiť výber · zavrieť" },
  { klaves: "M", popis: "hlášky majstra Melichara" },
  { klaves: "1–4", popis: "náhodná hláška zo skupiny" },
  { klaves: "?", popis: "tento zoznam" },
];

const STLACITELNE = new Set(["k", "p", "n"]);

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
export function useSkratky(zapnute: boolean): { readonly napoveda: boolean; readonly prepniNapovedu: () => void; readonly zavriNapovedu: () => void } {
  const [napoveda, setNapoveda] = useState(false);
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
      if (tlacidlo === undefined) return;
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
