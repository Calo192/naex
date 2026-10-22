// Spojnice akcií na spojoch línie (Michal 2026-10-22: karty majú ležať v rovnom
// rade). Vzpriamená karta má sloty pri ilustrácii hore, otočená dole — pár akcií
// na spoji teda nie je v jednej výške a čiara ukáže, čo s čím tvorí pár.
// Meria sa z DOM: pár tvoria aktívne (či zrušené) sloty priľahlých hrán v poradí
// zhora — index na hrane rastie zhora nadol na oboch kartách (hranyZPohladu).

import { useLayoutEffect, useState, type RefObject } from "react";

interface Ciara {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly zrusena: boolean;
}

const V_PARE = ".kl-slot.kl-aktivna, .kl-slot.kl-zrusena";
/** Karty sa na spoji dotýkajú (pri lokalite delí skupiny ≈ 10 px); väčšia medzera = nie sú susedia. */
const DOTYK_PX = 16;

function zmeraj(linia: HTMLElement): Ciara[] {
  const lr = linia.getBoundingClientRect();
  // Súradnice v obsahu línie (posúva sa vodorovne), od vnútornej hrany rámu.
  const dx = linia.scrollLeft - lr.left - linia.clientLeft;
  const dy = linia.scrollTop - lr.top - linia.clientTop;
  const karty = [...linia.querySelectorAll<HTMLElement>(".kl")]
    .map((el) => ({ el, r: el.getBoundingClientRect() }))
    .sort((a, b) => a.r.left - b.r.left);
  const hrana = (k: { el: HTMLElement; r: DOMRect }, prava: boolean): { r: DOMRect; zrusena: boolean }[] =>
    [...k.el.querySelectorAll<HTMLElement>(V_PARE)]
      .map((s) => ({ r: s.getBoundingClientRect(), zrusena: s.classList.contains("kl-zrusena") }))
      .filter(({ r }) => r.left + r.width / 2 > k.r.left + k.r.width / 2 === prava)
      .sort((a, b) => a.r.top - b.r.top);
  const out: Ciara[] = [];
  for (let i = 1; i < karty.length; i++) {
    const a = karty[i - 1]!;
    const b = karty[i]!;
    if (Math.abs(b.r.left - a.r.right) > DOTYK_PX) continue;
    const lave = hrana(a, true);
    const prave = hrana(b, false);
    if (lave.length !== prave.length) continue;
    lave.forEach(({ r: p, zrusena }, j) => {
      const { r: q, zrusena: zrusenaSused } = prave[j]!;
      const x1 = p.left + p.width / 2;
      const y1 = p.top + p.height / 2;
      const x2 = q.left + q.width / 2;
      const y2 = q.top + q.height / 2;
      const d = Math.hypot(x2 - x1, y2 - y1);
      // Od okraja slotu k okraju slotu — ikony akcií ostanú čisté.
      const r1 = Math.min(p.width, p.height) / 2;
      const r2 = Math.min(q.width, q.height) / 2;
      // Pár v jednej výške (dve vzpriamené karty) sa stretá sám, čiara netreba.
      if (d <= r1 + r2 + 4) return;
      const ux = (x2 - x1) / d;
      const uy = (y2 - y1) / d;
      out.push({
        x1: x1 + ux * r1 + dx,
        y1: y1 + uy * r1 + dy,
        x2: x2 - ux * r2 + dx,
        y2: y2 - uy * r2 + dy,
        zrusena: zrusena || zrusenaSused,
      });
    });
  }
  return out;
}

/** Vrstva nad líniou; prepočíta sa po každom prekreslení plochy a pri zmene šírky. */
export function SpojeLinie({ liniaRef }: { readonly liniaRef: RefObject<HTMLDivElement | null> }) {
  const [ciary, setCiary] = useState<readonly Ciara[]>([]);
  const obnov = (): void => {
    const el = liniaRef.current;
    if (el === null) return;
    const nove = zmeraj(el);
    setCiary((stare) => (JSON.stringify(stare) === JSON.stringify(nove) ? stare : nove));
  };
  useLayoutEffect(obnov);
  useLayoutEffect(() => {
    const el = liniaRef.current;
    if (el === null) return;
    const ro = new ResizeObserver(obnov);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  if (ciary.length === 0) return null;
  return (
    <svg className="spoje-linie" aria-hidden="true">
      {ciary.map((c, i) => (
        <line key={i} x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2} className={c.zrusena ? "zrusena" : undefined} />
      ))}
    </svg>
  );
}
