// Vodorovný posun línie (rozloženie A, Michal 2026-11-11): veľkosť karty riadi výška
// stola a čo sa do šírky nevojde, sa posúva. Lokalita sa po načítaní vycentruje,
// šípky ukazujú, koľko kariet je za okrajom, a duch karty z ruky mimo pohľadu
// dostane pri okraji značku. Výpočty nad úsekmi sú čisté (test), hook len meria DOM.

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

/** Vodorovný úsek v súradniciach obsahu línie (od začiatku posúvaného obsahu). */
export interface Usek {
  readonly lavo: number;
  readonly pravo: number;
}

/** Koľko kariet je za ľavým a pravým okrajom — karta je skrytá, keď je jej stred mimo okna. */
export function skryteKarty(karty: readonly Usek[], okno: Usek): { readonly vlavo: number; readonly vpravo: number } {
  let vlavo = 0;
  let vpravo = 0;
  for (const k of karty) {
    const stred = (k.lavo + k.pravo) / 2;
    if (stred < okno.lavo) vlavo++;
    else if (stred > okno.pravo) vpravo++;
  }
  return { vlavo, vpravo };
}

/**
 * Posun, pri ktorom je lokalita v strede okna. Keď by kratší koniec línie vytŕčal
 * o menej než jednu kartu, línia sa zarovná naň — žiadna karta neostane odrezaná napoly.
 */
export function cielPosunu(lokalita: Usek, sirkaObsahu: number, sirkaOkna: number, sirkaKarty: number): number {
  const max = Math.max(0, sirkaObsahu - sirkaOkna);
  if (max === 0) return 0;
  const stred = Math.min(max, Math.max(0, (lokalita.lavo + lokalita.pravo) / 2 - sirkaOkna / 2));
  const vlavo = stred;
  const vpravo = max - stred;
  if (vlavo < sirkaKarty && vpravo < sirkaKarty) return vlavo <= vpravo ? 0 : max;
  if (vlavo < sirkaKarty) return 0;
  if (vpravo < sirkaKarty) return max;
  return Math.round(stred);
}

/**
 * Šírka karty v posúvanej línii: z výšky stola (`podlaVysky`, so stropom). Keď sa celá línia
 * vojde (karty, lokalita a miesto na kartu na oboch koncoch) pri karte menšej najviac
 * o `1 − zmensenie`, karta sa radšej zmenší, než by sa línia posúvala. Nikdy nie pod `min`.
 */
export function sirkaPosuvnejLinie(podlaVysky: number, sirkaLinie: number, kariet: number, o: { readonly min: number; readonly strop: number; readonly zmensenie: number }): number {
  const vyska = Math.min(o.strop, podlaVysky);
  // 32 px: okraje miest na kartu a rezerva, aby celá línia naozaj nepotrebovala posuvník.
  const celaLinia = Math.floor((sirkaLinie - 32) / (kariet + 3));
  return Math.max(o.min, celaLinia >= o.zmensenie * vyska ? Math.min(vyska, celaLinia) : vyska);
}

export interface StavPosunu {
  /** Skryté karty za ľavým / pravým okrajom. */
  readonly vlavo: number;
  readonly vpravo: number;
  /** Dá sa posunúť doľava / doprava. */
  readonly mozeVlavo: boolean;
  readonly mozeVpravo: boolean;
  /** Kam je lokalita odsunutá (nie je celá vidno), inak null. */
  readonly lokalita: "vlavo" | "vpravo" | null;
  /** Spoje ducha karty z ruky, ktorý leží za ľavým / pravým okrajom (0 = žiadny). */
  readonly duchVlavo: number;
  readonly duchVpravo: number;
}

const BEZ_POSUNU: StavPosunu = { vlavo: 0, vpravo: 0, mozeVlavo: false, mozeVpravo: false, lokalita: null, duchVlavo: 0, duchVpravo: 0 };

/** Úsek prvku v súradniciach obsahu línie. */
function usek(el: Element, linia: HTMLElement, zaciatok: number): Usek {
  const r = el.getBoundingClientRect();
  return { lavo: r.left - zaciatok + linia.scrollLeft, pravo: r.right - zaciatok + linia.scrollLeft };
}

/**
 * Poloha skupiny línie v obsahu bez posunu harmoniky — lupa posúva skupiny len na pohľad
 * a kotva pohľadu by s nimi inak posúvala celú líniu.
 */
function polohaVObsahu(el: HTMLElement, linia: HTMLElement): Usek {
  const t = getComputedStyle(el).transform;
  const harmonika = t === "none" ? 0 : new DOMMatrixReadOnly(t).m41;
  const u = usek(el, linia, linia.getBoundingClientRect().left + linia.clientLeft);
  return { lavo: u.lavo - harmonika, pravo: u.pravo - harmonika };
}

function zmeraj(linia: HTMLElement, lokalita: HTMLElement | null): StavPosunu {
  const zaciatok = linia.getBoundingClientRect().left + linia.clientLeft;
  const okno = { lavo: linia.scrollLeft, pravo: linia.scrollLeft + linia.clientWidth };
  const max = linia.scrollWidth - linia.clientWidth;
  // Karty línie (aj lokalita a rub Záverečnej); miesto s duchom nie je karta.
  const karty = [...linia.querySelectorAll(".partia-rad > *")]
    .filter((el) => el.querySelector(".duch-karty") === null && el.querySelector(".kl, .rub-zaverecnej") !== null)
    .map((el) => usek(el, linia, zaciatok));
  const { vlavo, vpravo } = skryteKarty(karty, okno);
  let lok: StavPosunu["lokalita"] = null;
  if (lokalita !== null) {
    const u = usek(lokalita, linia, zaciatok);
    lok = u.lavo < okno.lavo - 1 ? "vlavo" : u.pravo > okno.pravo + 1 ? "vpravo" : null;
  }
  let duchVlavo = 0;
  let duchVpravo = 0;
  for (const d of linia.querySelectorAll<HTMLElement>(".duch-karty")) {
    const u = usek(d, linia, zaciatok);
    const pary = Number(d.dataset.pary ?? "0");
    if ((u.lavo + u.pravo) / 2 < okno.lavo) duchVlavo = pary;
    else if ((u.lavo + u.pravo) / 2 > okno.pravo) duchVpravo = pary;
  }
  return { vlavo, vpravo, mozeVlavo: linia.scrollLeft > 1, mozeVpravo: linia.scrollLeft < max - 1, lokalita: lok, duchVlavo, duchVpravo };
}

function rovnake(a: StavPosunu, b: StavPosunu): boolean {
  return (Object.keys(a) as (keyof StavPosunu)[]).every((k) => a[k] === b[k]);
}

/**
 * Stav posunu línie a ovládanie: šípky, „Na lokalitu“, koliesko myši posúva vodorovne.
 * Lokalita drží miesto v pohľade: keď na ľavom konci pribudne karta alebo miesto na kartu,
 * pohľad sa posunie s ňou, aby línia neuskočila. `centruj` = kľúč, pri ktorého zmene sa
 * lokalita znova vycentruje (načítanie, nová karta, iná veľkosť kariet).
 */
export function usePosunLinie(
  liniaRef: RefObject<HTMLDivElement | null>,
  lokalitaRef: RefObject<HTMLDivElement | null>,
  zapnute: boolean,
  sirkaKarty: number,
  centruj: string,
): { readonly stav: StavPosunu; readonly posun: (smer: -1 | 1) => void; readonly naLokalitu: () => void } {
  const [stav, setStav] = useState<StavPosunu>(BEZ_POSUNU);
  const obnov = useCallback(() => {
    const l = liniaRef.current;
    const s = l === null || !zapnute ? BEZ_POSUNU : zmeraj(l, lokalitaRef.current);
    setStav((x) => (rovnake(x, s) ? x : s));
  }, [liniaRef, lokalitaRef, zapnute]);
  // Kotva pohľadu: poloha lokality v obsahu po minulom prekreslení.
  const kotva = useRef<number | null>(null);
  useLayoutEffect(() => {
    const l = liniaRef.current;
    const lok = lokalitaRef.current;
    if (l !== null && lok !== null && zapnute) {
      const x = polohaVObsahu(lok, l).lavo;
      if (kotva.current !== null && Math.abs(x - kotva.current) >= 1) l.scrollLeft += x - kotva.current;
      kotva.current = polohaVObsahu(lok, l).lavo;
    }
    obnov();
  });
  const naLokalitu = useCallback(() => {
    const l = liniaRef.current;
    const lok = lokalitaRef.current;
    if (l === null || lok === null) return;
    l.scrollTo({ left: cielPosunu(polohaVObsahu(lok, l), l.scrollWidth, l.clientWidth, sirkaKarty), behavior: "smooth" });
  }, [liniaRef, lokalitaRef, sirkaKarty]);
  // Len pri zmene kľúča — nie pri každom prekreslení (naLokalitu sa mení so šírkou karty, tá je v kľúči).
  const naLokalituRef = useRef(naLokalitu);
  naLokalituRef.current = naLokalitu;
  useEffect(() => {
    if (zapnute) naLokalituRef.current();
  }, [centruj, zapnute]);
  useEffect(() => {
    const l = liniaRef.current;
    if (l === null || !zapnute) return;
    let snimka = 0;
    const naScroll = (): void => {
      cancelAnimationFrame(snimka);
      snimka = requestAnimationFrame(obnov);
    };
    // Na stole sa stránka zvislo neposúva — koliesko myši nad líniou ju posúva vodorovne.
    // Aj nad lupou karty z línie (portál v <body>): lupa sa pri posune sama zavrie.
    const koliesko = (e: WheelEvent): void => {
      if (e.ctrlKey || Math.abs(e.deltaY) <= Math.abs(e.deltaX) || l.scrollWidth <= l.clientWidth + 1) return;
      const ciel = e.target instanceof Element ? e.target : null;
      const r = l.getBoundingClientRect();
      const nadLiniou = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (ciel === null || !nadLiniou || !(l.contains(ciel) || ciel.closest(".lupa") !== null)) return;
      e.preventDefault();
      l.scrollLeft += e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;
    };
    l.addEventListener("scroll", naScroll, { passive: true });
    window.addEventListener("wheel", koliesko, { passive: false });
    const ro = new ResizeObserver(naScroll);
    ro.observe(l);
    return () => {
      cancelAnimationFrame(snimka);
      l.removeEventListener("scroll", naScroll);
      window.removeEventListener("wheel", koliesko);
      ro.disconnect();
    };
  }, [liniaRef, zapnute, obnov]);
  const posun = useCallback(
    (smer: -1 | 1) => {
      const l = liniaRef.current;
      if (l === null) return;
      l.scrollBy({ left: smer * Math.max(sirkaKarty, l.clientWidth - 2 * sirkaKarty), behavior: "smooth" });
    },
    [liniaRef, sirkaKarty],
  );
  return { stav, posun, naLokalitu };
}
