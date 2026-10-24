// Ťahanie kariet cez Pointer Events — jedna cesta pre myš aj dotyk, bez
// knižnice. Vstavané HTML5 drag-and-drop na dotykových zariadeniach nefunguje.
//
// Ciele sú prvky s atribútom data-ciel; pod kurzorom sa hľadajú cez
// elementFromPoint (duch karty má pointer-events: none). Poloha ducha sa mení
// priamo v DOM, nie cez stav — inak by sa celá plocha prekresľovala
// s každým pohybom myši. Stav sa mení len pri štarte a pri zmene cieľa.

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { flushSync } from "react-dom";

export interface Tahanie<Z> {
  readonly zdroj: Z;
  /** Ľavý horný roh ducha v čase posledného prekreslenia. */
  readonly x: number;
  readonly y: number;
  readonly sirka: number;
  /** data-ciel prvku pod kurzorom, alebo null. */
  readonly ciel: string | null;
}

/** Do tejto vzdialenosti (px) je to ešte klik, nie ťahanie. */
const PRAH = 6;
/** Pri okraji línie sa línia sama posúva — koniec dlhej partie môže byť mimo. */
const OKRAJ_POSUVU = 70;
/** Koľko plochy ducha musí cieľ prekryť, keď ho kurzor minie. */
const MIN_PREKRYTIE = 0.15;
/** Do akej vzdialenosti (px) od kurzora sa cieľ ešte chytí, keď ho nič iné nenašlo. */
const BLIZKO = 28;

function cielNa(x: number, y: number, duch: HTMLElement | null): string | null {
  const el = document.elementFromPoint(x, y);
  const pod = el?.closest<HTMLElement>("[data-ciel]")?.dataset.ciel;
  if (pod !== undefined || duch === null) return pod ?? null;
  // Kurzor cieľ minul, hoci karta naň dopadla: úzke „+“ sa pri štarte ťahania
  // rozšíri na celé miesto a stred „+“ potom leží na hrane susednej karty
  // (playtest výučby 2026-10-23: ťah na „+“ mlčky nezabral). Rozhodne cieľ,
  // ktorý ťahaná karta prekrýva najviac.
  const d = duch.getBoundingClientRect();
  let naj: string | null = null;
  let max = MIN_PREKRYTIE * d.width * d.height;
  // Nakoniec cieľ tesne vedľa kurzora: karta v ruke je pod myšou zväčšená, duch potom
  // visí nad kurzorom a pri malých kartách (stôl so scrollom, 72 px) prekrytie nestačí.
  let najblizsi: string | null = null;
  let vzdialenost = BLIZKO;
  for (const c of document.querySelectorAll<HTMLElement>("[data-ciel]")) {
    if (duch.contains(c)) continue;
    const r = c.getBoundingClientRect();
    const p = Math.max(0, Math.min(d.right, r.right) - Math.max(d.left, r.left)) * Math.max(0, Math.min(d.bottom, r.bottom) - Math.max(d.top, r.top));
    if (p > max) {
      max = p;
      naj = c.dataset.ciel ?? null;
    }
    const v = Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom));
    if (v < vzdialenost) {
      vzdialenost = v;
      najblizsi = c.dataset.ciel ?? null;
    }
  }
  return naj ?? najblizsi;
}

/** `bod` = kde kurzor kartu pustil. */
export function useTahanie<Z>(pusti: (zdroj: Z, ciel: string | null, bod: { readonly x: number; readonly y: number }) => void) {
  const [tahanie, setTahanie] = useState<Tahanie<Z> | null>(null);
  const duchRef = useRef<HTMLDivElement>(null);
  const pustiRef = useRef(pusti);
  pustiRef.current = pusti;
  const upratRef = useRef<(() => void) | null>(null);
  useEffect(() => () => upratRef.current?.(), []);

  /** `sirka` = šírka ducha, keď sa ťahá zo zväčšenej kópie (lupa). */
  const zacni = (zdroj: Z, e: ReactPointerEvent<HTMLElement>, sirka?: number): void => {
    if (e.button !== 0 || upratRef.current !== null) return;
    // Merá sa samotná karta, nie obal: v ruke je obal pri prekrytí užší
    // a karta pod myšou môže byť zväčšená — duch má mať bežnú veľkosť.
    const el = e.currentTarget.querySelector<HTMLElement>(".kl") ?? e.currentTarget;
    const r = el.getBoundingClientRect();
    const rect = { width: sirka ?? el.offsetWidth };
    const mierka = r.width > 0 ? rect.width / r.width : 1;
    const id = e.pointerId;
    const start = { x: e.clientX, y: e.clientY };
    const dx = (e.clientX - r.left) * mierka;
    const dy = (e.clientY - r.top) * mierka;
    let bod = start;
    let ciel: string | null = null;
    let bezi = false;
    let snimka = 0;

    const prekresli = (): void => {
      const novy = cielNa(bod.x, bod.y, duchRef.current);
      if (duchRef.current !== null) {
        duchRef.current.style.transform = `translate(${bod.x - dx}px, ${bod.y - dy}px)`;
      }
      if (novy !== ciel) {
        ciel = novy;
        setTahanie({ zdroj, x: bod.x - dx, y: bod.y - dy, sirka: rect.width, ciel });
      }
    };

    const posuvajLiniu = (): void => {
      const linia = document.elementFromPoint(bod.x, bod.y)?.closest<HTMLElement>(".linia");
      if (linia != null) {
        const r = linia.getBoundingClientRect();
        const krok = bod.x < r.left + OKRAJ_POSUVU ? -14 : bod.x > r.right - OKRAJ_POSUVU ? 14 : 0;
        if (krok !== 0) {
          linia.scrollLeft += krok;
          prekresli();
        }
      }
      snimka = requestAnimationFrame(posuvajLiniu);
    };

    const pohyb = (ev: PointerEvent): void => {
      if (ev.pointerId !== id) return;
      bod = { x: ev.clientX, y: ev.clientY };
      if (!bezi) {
        if (Math.hypot(bod.x - start.x, bod.y - start.y) < PRAH) return;
        bezi = true;
        document.body.classList.add("tahanie-aktivne");
        // Miesta sa ukazujú až počas ťahania; vykresli ich hneď, aby ich
        // našlo aj pustenie po jedinom rýchlom pohybe.
        flushSync(() => setTahanie({ zdroj, x: bod.x - dx, y: bod.y - dy, sirka: rect.width, ciel: null }));
        prekresli();
        snimka = requestAnimationFrame(posuvajLiniu);
        return;
      }
      ev.preventDefault();
      prekresli();
    };

    const koniec = (ev: PointerEvent): void => {
      if (ev.pointerId !== id) return;
      const bolo = bezi;
      // Duch sa ešte meria tu — uprat ho zhasne.
      if (bezi && duchRef.current !== null) duchRef.current.style.transform = `translate(${ev.clientX - dx}px, ${ev.clientY - dy}px)`;
      const kam = bezi && ev.type === "pointerup" ? cielNa(ev.clientX, ev.clientY, duchRef.current) : null;
      uprat();
      if (!bolo) return;
      // Po pustení pošle prehliadač ešte click — nesmie z neho byť klik
      // na kartu pod kurzorom (napr. otočenie lokality).
      const zahod = (c: MouseEvent): void => {
        c.stopPropagation();
        c.preventDefault();
      };
      window.addEventListener("click", zahod, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", zahod, { capture: true }), 0);
      pustiRef.current(zdroj, kam, { x: ev.clientX, y: ev.clientY });
    };

    const uprat = (): void => {
      window.removeEventListener("pointermove", pohyb);
      window.removeEventListener("pointerup", koniec);
      window.removeEventListener("pointercancel", koniec);
      cancelAnimationFrame(snimka);
      document.body.classList.remove("tahanie-aktivne");
      upratRef.current = null;
      setTahanie(null);
    };

    window.addEventListener("pointermove", pohyb, { passive: false });
    window.addEventListener("pointerup", koniec);
    window.addEventListener("pointercancel", koniec);
    upratRef.current = uprat;
  };

  return { tahanie, zacni, duchRef };
}
