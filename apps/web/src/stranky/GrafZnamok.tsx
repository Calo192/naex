// Časová os priemerných známok hry (Michal 2026-10-21): ľudia, AI a spolu.
// Bod je „stav k dátumu“ — priemer posledných známok každého hodnotiteľa
// platných v ten deň —, preto sa čiara kreslí schodovito: hodnota platí,
// kým ju niekto nezmení. Pod osou sú značky hotových položiek roadmapy,
// aby bolo vidno, po ktorej zmene sa hodnotenie pohlo.

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { Kriterium } from "./HodnotenieHry.tsx";

export interface Hodnota {
  readonly priemer: number | null;
  readonly n: number;
}
export interface Skupina {
  readonly celkom: Hodnota;
  readonly kriteria: Readonly<Record<string, Hodnota>>;
}
export interface BodVyvoja {
  readonly den: string;
  readonly ludia: Skupina;
  readonly ai: Skupina;
  readonly spolu: Skupina;
}
export interface Vyvoj {
  readonly kriteria: readonly Kriterium[];
  readonly minLudi: number;
  readonly body: readonly BodVyvoja[];
  readonly udalosti: readonly { readonly cas: number; readonly text: string }[];
}

export type Seria = "ludia" | "ai" | "spolu";
export const SERIE: readonly { readonly kluc: Seria; readonly nazov: string }[] = [
  { kluc: "ludia", nazov: "Ľudia" },
  { kluc: "ai", nazov: "AI playtesteri" },
  { kluc: "spolu", nazov: "Spolu" },
];

/** Hodnota série pre zvolené kritérium („celkom“ = priemer cez hodnotiteľov). */
export const hodnota = (b: BodVyvoja, s: Seria, kriterium: string): Hodnota =>
  kriterium === "celkom" ? b[s].celkom : (b[s].kriteria[kriterium] ?? { priemer: null, n: 0 });

const DEN_MS = 24 * 60 * 60 * 1000;
/** Poludnie dňa v Bratislave — deň z API je RRRR-MM-DD. */
const casDna = (den: string): number => Date.parse(`${den}T12:00:00+02:00`);
const dnes = (): string => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Bratislava" }).format(Date.now());
export const kratkyDen = (den: string): string => {
  const [, m, d] = den.split("-");
  return `${Number(d)}. ${Number(m)}.`;
};
export const cislo = (x: number): string => x.toLocaleString("sk-SK", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const M = { l: 34, r: 92, t: 14, b: 46 };

export function GrafZnamok({ vyvoj, kriterium }: { readonly vyvoj: Vyvoj; readonly kriterium: string }) {
  const [viditelne, setViditelne] = useState<ReadonlySet<Seria>>(new Set<Seria>(["ludia", "ai", "spolu"]));
  const [aktivny, setAktivny] = useState<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const plocha = useRef<HTMLDivElement>(null);
  // viewBox = skutočná šírka v px, aby písmo a čiary ostali rovnako veľké na mobile aj na širokom monitore.
  const [W, setW] = useState(760);
  const H = W < 520 ? 240 : 280;
  useEffect(() => {
    const el = plocha.current;
    if (el === null) return;
    const ro = new ResizeObserver(([z]) => {
      if (z !== undefined) setW(Math.max(300, Math.round(z.contentRect.width)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const body = vyvoj.body;

  const { x, y, od, po, ticky } = useMemo(() => {
    const prvy = body[0]?.den ?? dnes();
    const od = casDna(prvy) - DEN_MS / 2;
    const po = Math.max(casDna(dnes()), casDna(body.at(-1)?.den ?? prvy)) + DEN_MS / 2;
    const x = (t: number): number => M.l + ((t - od) / (po - od)) * (W - M.l - M.r);
    const y = (v: number): number => M.t + ((10 - v) / 9) * (H - M.t - M.b);
    const dni = Math.round((po - od) / DEN_MS);
    const krok = Math.max(1, Math.ceil(dni / Math.max(3, Math.floor((W - M.l - M.r) / 70))));
    const ticky: number[] = [];
    for (let t = casDna(prvy); t <= po; t += krok * DEN_MS) ticky.push(t);
    return { x, y, od, po, ticky };
  }, [body, W, H]);

  // Schodovitá čiara: hodnota platí do ďalšej zmeny, posledná až po dnešok.
  const cesta = (s: Seria): string => {
    let d = "";
    let kreslim = false;
    body.forEach((b, i) => {
      const v = hodnota(b, s, kriterium).priemer;
      if (v === null) {
        kreslim = false;
        return;
      }
      const x0 = x(casDna(b.den));
      const x1 = i + 1 < body.length ? x(casDna(body[i + 1]!.den)) : x(po - DEN_MS / 2);
      d += `${kreslim ? "L" : "M"}${x0.toFixed(1)},${y(v).toFixed(1)}H${x1.toFixed(1)}`;
      kreslim = true;
    });
    return d;
  };

  // Popisy na konci čiar — posunuté, aby sa neprekrývali.
  const popisy = useMemo(() => {
    const p = SERIE.filter((s) => viditelne.has(s.kluc))
      .map((s) => {
        const posledny = [...body].reverse().find((b) => hodnota(b, s.kluc, kriterium).priemer !== null);
        const v = posledny === undefined ? null : hodnota(posledny, s.kluc, kriterium).priemer;
        return v === null ? null : { ...s, v, yy: y(v) };
      })
      .filter((q): q is NonNullable<typeof q> => q !== null)
      .sort((a, b) => a.yy - b.yy);
    for (let i = 1; i < p.length; i++) {
      const pred = p[i - 1]!;
      if (p[i]!.yy - pred.yy < 14) p[i] = { ...p[i]!, yy: pred.yy + 14 };
    }
    return p;
  }, [body, kriterium, viditelne, y]);

  // Hotové položky roadmapy po dňoch — jedna značka na deň.
  const znacky = useMemo(() => {
    const podlaDna = new Map<string, string[]>();
    for (const u of vyvoj.udalosti) {
      if (u.cas < od || u.cas > po) continue;
      const den = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Bratislava" }).format(u.cas);
      podlaDna.set(den, [...(podlaDna.get(den) ?? []), u.text]);
    }
    return [...podlaDna.entries()].map(([den, texty]) => ({ den, texty }));
  }, [vyvoj.udalosti, od, po]);

  const najblizsi = (e: PointerEvent<SVGRectElement>): void => {
    const r = svg.current?.getBoundingClientRect();
    if (r === undefined || body.length === 0) return;
    const px = ((e.clientX - r.left) / r.width) * W;
    let naj = 0;
    body.forEach((b, i) => {
      if (Math.abs(x(casDna(b.den)) - px) < Math.abs(x(casDna(body[naj]!.den)) - px)) naj = i;
    });
    setAktivny(naj);
  };

  const klavesy = (e: KeyboardEvent<SVGSVGElement>): void => {
    if (body.length === 0) return;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const i = aktivny ?? body.length - 1;
      setAktivny(Math.min(body.length - 1, Math.max(0, i + (e.key === "ArrowRight" ? 1 : -1))));
    } else if (e.key === "Escape") setAktivny(null);
  };

  const bod = aktivny === null ? null : body[aktivny];
  const nazovKriteria = kriterium === "celkom" ? "priemer všetkých kritérií" : (vyvoj.kriteria.find((k) => k.kluc === kriterium)?.nazov ?? kriterium);

  return (
    <figure className="graf-znamok">
      <div className="graf-legenda" role="group" aria-label="Série grafu">
        {SERIE.map((s) => (
          <button
            key={s.kluc}
            type="button"
            className={`graf-legenda-polozka seria-${s.kluc}`}
            aria-pressed={viditelne.has(s.kluc)}
            onClick={() => {
              const nove = new Set(viditelne);
              if (nove.has(s.kluc)) nove.delete(s.kluc);
              else nove.add(s.kluc);
              setViditelne(nove);
            }}
          >
            <svg viewBox="0 0 24 8" aria-hidden="true">
              <line x1="1" y1="4" x2="23" y2="4" />
            </svg>
            {s.nazov}
          </button>
        ))}
      </div>

      <div className="graf-plocha" ref={plocha}>
        <svg
          ref={svg}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Vývoj známky: ${nazovKriteria}. Šípkami vľavo a vpravo prechádzaš dni.`}
          tabIndex={0}
          onKeyDown={klavesy}
          onBlur={() => setAktivny(null)}
        >
          {[2, 4, 6, 8, 10].map((v) => (
            <g key={v} className="graf-mriezka">
              <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} />
              <text x={M.l - 8} y={y(v)} dy="0.32em" textAnchor="end">
                {v}
              </text>
            </g>
          ))}
          {ticky.map((t) => (
            <text key={t} className="graf-os-x" x={x(t)} y={H - M.b + 18} textAnchor="middle">
              {kratkyDen(new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Bratislava" }).format(t))}
            </text>
          ))}
          {znacky.map((z) => (
            <g key={z.den} className="graf-udalost">
              <title>{`${kratkyDen(z.den)}: ${z.texty.join(" · ")}`}</title>
              <line x1={x(casDna(z.den))} x2={x(casDna(z.den))} y1={M.t} y2={H - M.b} />
              <path d={`M${x(casDna(z.den))},${H - M.b + 26}l-5,8h10z`} />
            </g>
          ))}
          {bod != null && <line className="graf-kurzor" x1={x(casDna(bod.den))} x2={x(casDna(bod.den))} y1={M.t} y2={H - M.b} />}
          {SERIE.filter((s) => viditelne.has(s.kluc)).map((s) => (
            <g key={s.kluc} className={`seria-${s.kluc}`}>
              <path className="graf-ciara" d={cesta(s.kluc)} />
              {body.map((b) => {
                const v = hodnota(b, s.kluc, kriterium).priemer;
                return v === null ? null : <circle key={b.den} className="graf-bod" cx={x(casDna(b.den))} cy={y(v)} r={bod === b ? 5 : 3} />;
              })}
            </g>
          ))}
          {popisy.map((p) => (
            <text key={p.kluc} className="graf-popis" x={W - M.r + 8} y={p.yy} dy="0.32em">
              {p.nazov.split(" ")[0]} {cislo(p.v)}
            </text>
          ))}
          <rect
            className="graf-zachyt"
            x={M.l}
            y={M.t}
            width={W - M.l - M.r}
            height={H - M.t - M.b}
            onPointerMove={najblizsi}
            onPointerDown={najblizsi}
            onPointerLeave={() => setAktivny(null)}
          />
        </svg>
        {bod != null && (
          <div className="graf-tooltip" style={{ left: `${(x(casDna(bod.den)) / W) * 100}%` }} role="status">
            <strong>{kratkyDen(bod.den)}</strong>
            {SERIE.filter((s) => viditelne.has(s.kluc)).map((s) => {
              const h = hodnota(bod, s.kluc, kriterium);
              return (
                <span key={s.kluc} className={`seria-${s.kluc}`}>
                  <i aria-hidden="true" />
                  <b>{h.priemer === null ? "—" : cislo(h.priemer)}</b> {s.nazov}
                  <small> ({h.n})</small>
                </span>
              );
            })}
          </div>
        )}
      </div>
      <figcaption className="tlmene">
        Hodnota platí, kým ju niekto nezmení. V zátvorke je počet hodnotiteľov. Trojuholník pod osou je dokončená položka roadmapy.
      </figcaption>
    </figure>
  );
}

/** Tabuľkový pohľad na tú istú os — dostupný aj bez myši a farieb. */
export function TabulkaVyvoja({ vyvoj, kriterium }: { readonly vyvoj: Vyvoj; readonly kriterium: string }) {
  return (
    <details className="graf-tabulka">
      <summary>Tabuľka po dňoch</summary>
      <div className="tabulka-obal">
        <table className="vyvoj-tabulka">
          <thead>
            <tr>
              <th>Deň</th>
              {SERIE.map((s) => (
                <th key={s.kluc} className="cislo">
                  {s.nazov}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...vyvoj.body].reverse().map((b) => (
              <tr key={b.den}>
                <td>{kratkyDen(b.den)}</td>
                {SERIE.map((s) => {
                  const h = hodnota(b, s.kluc, kriterium);
                  return (
                    <td key={s.kluc} className="cislo">
                      {h.priemer === null ? "—" : cislo(h.priemer)} <span className="tlmene">({h.n})</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
