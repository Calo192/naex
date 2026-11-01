// Krúžok priazne, lístok Hádky a nápoveda nad staršom (Michal 2026-10-31, mockup „Priazeň
// podľa Michala“). Krúžok je pri staršom vždy — v línii, v baroch, v rekapitulácii, v bublinách
// aj na konci partie — a ukazuje priazeň, ktorá v tomto kole naozaj platí (po hádke, v10).
// Texty pod fotkou nie sú: všetko celou vetou povie nápoveda pri prejdení myšou, fokusom
// klávesnice alebo podržaním prsta (na telefóne so zväčšeninou staršieho). Obsah: priazenKola.ts.

import "./priazen-kola.css";
import { createContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FocusEvent, type HTMLAttributes, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Action, Favour } from "@naex/core";
import { IKONY } from "../karta/ikony.ts";
import { kratkeMeno, ktoPriazen, popisListka, riadkyKruzkov, textListka, vetaHadky, type KomuPriazen, type ListokHadky as ListokHadkyData, type ObsahNapovedy, type PriazenKola } from "./priazenKola.ts";

/** Ikona akcie, ktorú priazeň staršieho posilňuje — v krúžku priazne (mock C · Pečať). */
export const IKONA_PRIAZNE: Readonly<Record<Favour, Action>> = {
  BITKAR: "Rana",
  VERIACI: "Viera",
  UZERNIK: "Dlh",
  ADVOKAT: "Dlh",
  ROBOTA: "Robota",
  FAJCIAR: "Cigareta",
  ALKOHOLIK: "Poldeci",
  // Abstinent (v10) Pohoršenie nedáva — krúžok kreslí prázdny pohárik Absťáku (IkonaPriazneKruzku).
  LAKOMEC: "Poldeci",
};

/** Ikona v krúžku priazne: akcia priazne, pri Abstinentovi (v10) Absťák — prázdny pohárik. */
export function IkonaPriazneKruzku({ fav }: { readonly fav: Favour }) {
  if (fav !== "LAKOMEC") return <IkonaAkcie akcia={IKONA_PRIAZNE[fav]} />;
  return (
    <svg className="kr-ikona" viewBox="0 0 100 100" aria-hidden="true">
      <path d="M28 10h44l-7 80H35zM36 18l5 64h18l5-64z" fillRule="evenodd" />
      <path d="M50 40c-6 8-8 12-8 16a8 8 0 0 0 16 0c0-4-2-8-8-16z" />
    </svg>
  );
}

export function IkonaAkcie({ akcia, trieda = "kr-ikona" }: { readonly akcia: Action; readonly trieda?: string }) {
  return (
    <svg className={trieda} viewBox="0 0 100 100" aria-hidden="true">
      {IKONY[akcia].map((c, i) => (
        <path key={i} d={c.d} fillRule={c.evenOdd ? "evenodd" : "nonzero"} />
      ))}
    </svg>
  );
}

const trieda = (komu: KomuPriazen): string => (komu === null ? "nikto" : komu);

/**
 * Priazeň staršieho podľa id pre záznamy, ktoré nesú len elderId (rozpis nástenky, súhrn lokality).
 * Bez poskytovateľa nevie nič — krúžok sa vtedy nekreslí a ostane pôvodný text.
 */
export const FavourStarsich = createContext<(elderId: string) => Favour | null>(() => null);

/**
 * Krúžok priazne: ikona akcie a sila vo farbe toho, komu priazeň v tomto kole patrí; sivý bez
 * čísla, keď nikomu. `cisloVedla` (tesné dlaždice pri 1366, Michal 2026-10-31): v krúžku len
 * ikona, číslo vedľa vo farbe hráča.
 */
export function KruzokPriazne({
  fav,
  p,
  velkost,
  cisloVedla = false,
  popis,
  trieda: dalsia,
}: {
  readonly fav: Favour;
  readonly p: Pick<PriazenKola, "komu" | "sila">;
  /** Priemer v px; inak podľa CSS (--kr-d). */
  readonly velkost?: number;
  readonly cisloVedla?: boolean;
  /** S popisom je to obrázok pre čítačku, inak ozdoba vedľa textu, ktorý to už hovorí. */
  readonly popis?: string;
  readonly trieda?: string;
}) {
  const cislo = p.komu !== null && p.sila > 0 ? `+${p.sila}` : null;
  return (
    <span
      className={`kr-obal${cisloVedla ? " cislo-vedla" : ""}${dalsia === undefined ? "" : ` ${dalsia}`}`}
      {...(popis === undefined ? { "aria-hidden": true } : { role: "img", "aria-label": popis, title: popis })}
    >
      <span className={`kr ${trieda(p.komu)}`} style={velkost === undefined ? undefined : ({ "--kr-d": `${velkost}px` } as CSSProperties)}>
        <IkonaPriazneKruzku fav={fav} />
        {cislo !== null && <b className="kr-cislo">{cislo}</b>}
      </span>
      {cislo !== null && <b className={`kr-vedla ${trieda(p.komu)}`}>{cislo}</b>}
    </span>
  );
}

/** Krúžok v malom tvare do riadku textu (rekapitulácia, súhrny, nástenka, odhad). */
export function PilulkaPriazne({ fav, p, popis }: { readonly fav: Favour; readonly p: Pick<PriazenKola, "komu" | "sila">; readonly popis?: string }) {
  return (
    <span className={`kr-pil ${trieda(p.komu)}`} {...(popis === undefined ? { "aria-hidden": true } : { role: "img", "aria-label": popis, title: popis })}>
      <IkonaPriazneKruzku fav={fav} />
      {p.komu !== null && p.sila > 0 ? `+${p.sila}` : "—"}
    </span>
  );
}

/**
 * Priazeň staršieho v riadku textu (rekapitulácia, súhrny): krúžok v malom tvare, meno a voliteľne
 * prechod „nikto → ty“. Lístok tu nie je — príčinu už pomenúva riadok (Michal 2026-10-31).
 */
export function PriazenStarsiehoVRiadku({ fav, p, meno, prechod }: { readonly fav: Favour; readonly p: Pick<PriazenKola, "komu" | "sila">; readonly meno: string; readonly prechod?: string }) {
  return (
    <span className="kr-riadok">
      <PilulkaPriazne fav={fav} p={p} />
      {meno}
      {prechod !== undefined && <small>{prechod}</small>}
    </span>
  );
}

/**
 * Lístok Hádky na portréte a v rohu dlaždice: kto hádku vyhral (farba) a o koľko stupňov posunul
 * silu priazne (číslo). Keď posun na konci kola zanikne, lístok sa „odlepí“ (useOdlepeny).
 */
export function ListokHadky({
  listok,
  menoSupera,
  roh = false,
}: {
  readonly listok: ListokHadkyData | null;
  readonly menoSupera: string;
  /** Roh dlaždice: menší, bez mena. */
  readonly roh?: boolean;
}) {
  const { zobraz, odlepuje } = useOdlepeny(listok);
  if (zobraz === null) return null;
  const popis = popisListka(zobraz, menoSupera);
  return (
    <span className={`lst-obal${roh ? " roh" : ""}${odlepuje ? " odlep" : ""}`}>
      <span className={`lst ${zobraz.komu}`} role="img" aria-label={popis} title={popis}>
        <IkonaHadky />
        {roh ? `+${zobraz.stupne}` : textListka(zobraz)}
      </span>
    </span>
  );
}

/**
 * Značka hádky: dve bubliny proti sebe (hádka dvoch). Zámerne iná ako piktogram Povery —
 * do hádky vstupuje aj Pohoršenie.
 */
export function IkonaHadky({ trieda = "lst-ikona" }: { readonly trieda?: string }) {
  return (
    <svg className={trieda} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2 4.5C2 3.1 3.1 2 4.5 2h8C13.9 2 15 3.1 15 4.5v4c0 1.4-1.1 2.5-2.5 2.5H8l-3.5 3v-3C3.1 11 2 9.9 2 8.5z" />
      <path d="M22 11.5c0-1.4-1.1-2.5-2.5-2.5H17v1c0 2-1.6 3.5-3.5 3.5H10v1c0 1.4 1.1 2.5 2.5 2.5H16l3.5 3v-3c1.4 0 2.5-1.1 2.5-2.5z" opacity="0.7" />
    </svg>
  );
}

/** Ako dlho sa lístok odlepuje (CSS animácia lst-odlep). */
const ODLEP_MS = 1000;

/**
 * Lístok, ktorý zmizol (koniec kola), ešte chvíľu kreslí s triedou „odlep“ — odlepí sa a spadne.
 * Pri prefers-reduced-motion CSS animáciu skráti a lístok zmizne hneď.
 */
function useOdlepeny(listok: ListokHadkyData | null): { readonly zobraz: ListokHadkyData | null; readonly odlepuje: boolean } {
  const [stary, setStary] = useState<ListokHadkyData | null>(null);
  const predosly = useRef<ListokHadkyData | null>(listok);
  useEffect(() => {
    const pred = predosly.current;
    predosly.current = listok;
    if (listok !== null || pred === null) {
      setStary(null);
      return;
    }
    setStary(pred);
    const t = setTimeout(() => setStary(null), ODLEP_MS);
    return () => clearTimeout(t);
  }, [listok === null ? "" : `${listok.hrac}:${listok.stupne}`]);
  return listok !== null ? { zobraz: listok, odlepuje: false } : { zobraz: stary, odlepuje: stary !== null };
}

/** Obsah nápovedy nad staršom: krúžok, účinok, hádka (z markera → toto kolo), strach a stupeň. */
export function ObsahNapovedyStarsieho({ o, menoSupera }: { readonly o: ObsahNapovedy; readonly menoSupera: string }) {
  const m = { ja: "ty", su: kratkeMeno(menoSupera) };
  const kto = (p: PriazenKola): ReactNode => <span className={`np-kto ${trieda(p.komu)}`}>{ktoPriazen(p, m)}</span>;
  const h = o.hadka;
  return (
    <>
      <span className="np-hlava">
        <KruzokPriazne fav={o.favour} p={o.priazen} velkost={34} />
        <span>
          <b className="np-meno">{o.meno}</b>
          <small className="np-nazov">priazeň {o.nazovPriazne}</small>
        </span>
      </span>
      {o.akcia !== null && <span className="np-akcia">Klik: {o.akcia}</span>}
      <span className="np-ucinok">
        {o.ucinok.kto !== null && <b className={`np-kto ${trieda(o.ucinok.komu)}`}>{o.ucinok.kto}:</b>} {o.ucinok.text}
      </span>
      {h !== null && (
        <span className="np-r" aria-label={vetaHadky(h.zMarkera, h.listok, h.teraz, menoSupera)}>
          <span className="np-l">Hádka</span>
          <span>
            z markera {kto(h.zMarkera)} ·{" "}
            <span className={`np-kto ${h.listok.komu}`}>
              {h.listok.komu === "ja" ? "ty" : m.su} v hádke {h.listok.komu === "ja" ? "+" : "−"}
              {h.listok.stupne}
            </span>{" "}
            · toto kolo {kto(h.teraz)}
            <small className="np-po">po kole zase {kto(h.zMarkera)}</small>
          </span>
        </span>
      )}
      <span className="np-r">
        <span className="np-l">Strach</span>
        <span className={`np-strach ${trieda(o.strach.komu)}`}>{o.strach.text}</span>
      </span>
      <span className="np-r">
        <span className="np-l">Stupeň</span>
        <span>{o.stupen}</span>
      </span>
      {o.dalsi !== null && (
        <span className="np-r">
          <span className="np-l">{o.dalsi.nazov}</span>
          <span>{o.dalsi.text}</span>
        </span>
      )}
    </>
  );
}


/** Dlhé podržanie prsta (ms) — ako lupa kariet na stole. */
const PODRZANIE_MS = 450;

type StavNapovedy =
  | { readonly druh: "starsi"; readonly kotva: HTMLElement }
  | { readonly druh: "kruzky"; readonly kotva: HTMLElement; readonly posunute: boolean }
  | { readonly druh: "zoom" };

export interface NapovedaStarsieho {
  /** Na prvok staršieho (karta v línii, dlaždica, pás na konci partie). */
  readonly props: HTMLAttributes<HTMLElement>;
  /** Na stupnicu s krúžkami — nápoveda sa prepne na 1–2 riadky o prsteni a bodke. */
  readonly kruzky: (posunute: boolean) => HTMLAttributes<HTMLElement>;
  /** Portál s nápovedou (alebo so zväčšeninou na telefóne) — vložiť kamkoľvek do stromu. */
  readonly vrstva: ReactNode;
  /** Ťuk po podržaní nesmie spustiť klik staršieho (hádka, zajatie). */
  readonly poPodrzani: () => boolean;
}

/**
 * Nápoveda nad staršom: myš (prejdenie), klávesnica (fokus) a dotyk (podržanie → zväčšenina
 * s nápovedou pod ňou, zavrie ju ťuk). Obsah sa skladá až pri otvorení.
 */
export function useNapovedaStarsieho(obsah: () => ObsahNapovedy | null, moznosti: { readonly menoSupera: string; readonly zvacsenina?: () => ReactNode }): NapovedaStarsieho {
  const [stav, setStav] = useState<StavNapovedy | null>(null);
  const kotvaStarsieho = useRef<HTMLElement | null>(null);
  const casovac = useRef<number | null>(null);
  const podrzane = useRef(false);
  const mys = (e: ReactPointerEvent): boolean => e.pointerType !== "touch";
  const zrusPodrzanie = (): void => {
    if (casovac.current !== null) window.clearTimeout(casovac.current);
    casovac.current = null;
  };
  useEffect(() => zrusPodrzanie, []);
  useEffect(() => {
    if (stav === null) return;
    const klaves = (e: KeyboardEvent): void => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      setStav(null);
    };
    window.addEventListener("keydown", klaves, true);
    return () => window.removeEventListener("keydown", klaves, true);
  }, [stav]);

  const props: HTMLAttributes<HTMLElement> = {
    onPointerEnter: (e) => {
      if (!mys(e)) return;
      kotvaStarsieho.current = e.currentTarget;
      setStav({ druh: "starsi", kotva: e.currentTarget });
    },
    onPointerLeave: (e) => {
      if (mys(e)) setStav((s) => (s?.druh === "zoom" ? s : null));
    },
    onFocus: (e: FocusEvent<HTMLElement>) => {
      if (e.target !== e.currentTarget || !e.currentTarget.matches(":focus-visible")) return;
      kotvaStarsieho.current = e.currentTarget;
      setStav({ druh: "starsi", kotva: e.currentTarget });
    },
    onBlur: () => setStav((s) => (s?.druh === "zoom" ? s : null)),
    onPointerDown: (e) => {
      if (mys(e)) return;
      podrzane.current = false;
      zrusPodrzanie();
      const x0 = e.clientX;
      const y0 = e.clientY;
      const pohyb = (ev: PointerEvent): void => {
        if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > 8) koniec();
      };
      const koniec = (): void => {
        zrusPodrzanie();
        window.removeEventListener("pointermove", pohyb);
        window.removeEventListener("pointerup", koniec);
        window.removeEventListener("pointercancel", koniec);
      };
      window.addEventListener("pointermove", pohyb);
      window.addEventListener("pointerup", koniec);
      window.addEventListener("pointercancel", koniec);
      casovac.current = window.setTimeout(() => {
        koniec();
        podrzane.current = true;
        setStav({ druh: "zoom" });
      }, PODRZANIE_MS);
    },
    onContextMenu: (e) => {
      // Podržanie na telefóne otvára vlastnú zväčšeninu — nie ponuku prehliadača.
      if (casovac.current !== null || podrzane.current) e.preventDefault();
    },
  };

  const kruzky = (posunute: boolean): HTMLAttributes<HTMLElement> => ({
    onPointerEnter: (e) => {
      if (mys(e)) setStav({ druh: "kruzky", kotva: e.currentTarget, posunute });
    },
    onPointerLeave: (e) => {
      if (!mys(e)) return;
      const k = kotvaStarsieho.current;
      setStav(k !== null && k.matches(":hover") ? { druh: "starsi", kotva: k } : null);
    },
  });

  const o = stav === null || stav.druh === "kruzky" ? null : obsah();
  const vrstva =
    stav === null
      ? null
      : stav.druh === "zoom"
        ? createPortal(
            <div
              className="np-zoom-clona"
              role="dialog"
              aria-label={o?.meno ?? "Starší"}
              onPointerDown={(e) => {
                // Prst, ktorý zväčšeninu otvoril, ju hneď nezavrie — až ďalší ťuk.
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (podrzane.current) {
                  podrzane.current = false;
                  return;
                }
                setStav(null);
              }}
            >
              <div className="np-zoom">
                {moznosti.zvacsenina?.()}
                {o !== null && (
                  <span className="np-tip np-tip-zoom">
                    <ObsahNapovedyStarsieho o={o} menoSupera={moznosti.menoSupera} />
                  </span>
                )}
              </div>
            </div>,
            document.body,
          )
        : createPortal(
            <TipPriKotve kotva={stav.kotva} kratky={stav.druh === "kruzky"}>
              {stav.druh === "kruzky" ? (
                riadkyKruzkov(stav.posunute).map((r, i) => (
                  <span key={i} className={i === 1 ? "np-hadka" : undefined}>
                    {r}
                  </span>
                ))
              ) : o !== null ? (
                <ObsahNapovedyStarsieho o={o} menoSupera={moznosti.menoSupera} />
              ) : null}
            </TipPriKotve>,
            document.body,
          );

  return {
    props,
    kruzky,
    vrstva,
    poPodrzani: () => {
      const bolo = podrzane.current;
      podrzane.current = false;
      return bolo;
    },
  };
}

/** Nápoveda nad kotvou so šípkou; keď sa nad ňu nezmestí (horný bar), je pod ňou. */
function TipPriKotve({ kotva, kratky, children }: { readonly kotva: HTMLElement; readonly kratky: boolean; readonly children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [poloha, setPoloha] = useState<{ readonly left: number; readonly top: number; readonly sipka: number; readonly pod: boolean } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el === null) return;
    const k = kotva.getBoundingClientRect();
    const t = el.getBoundingClientRect();
    const pod = k.top - t.height - 12 < 4;
    const stred = k.left + k.width / 2;
    const left = Math.max(6, Math.min(window.innerWidth - t.width - 6, stred - t.width / 2));
    const top = pod ? Math.min(window.innerHeight - t.height - 4, k.bottom + 10) : k.top - t.height - 10;
    setPoloha({ left, top, sipka: Math.max(12, Math.min(t.width - 12, stred - left)), pod });
  }, [kotva, kratky, children]);
  return (
    <span
      ref={ref}
      className={`np-tip${kratky ? " kratky" : ""}${poloha?.pod === true ? " pod" : ""}`}
      role="tooltip"
      style={{ left: poloha?.left ?? 0, top: poloha?.top ?? 0, visibility: poloha === null ? "hidden" : undefined, "--sipka": `${poloha?.sipka ?? 0}px` } as CSSProperties}
    >
      {children}
    </span>
  );
}

/**
 * Spojí vlastnosti prvku tak, že udalosti z oboch zdrojov zavolá postupne (nápoveda a klik kroku
 * potrebujú tie isté onFocus, onBlur…); ostatné vlastnosti berie z `b`.
 */
export function spojUdalosti<T extends HTMLAttributes<HTMLElement>>(a: HTMLAttributes<HTMLElement>, b: T): T {
  const out = { ...a, ...b } as Record<string, unknown>;
  for (const [k, fa] of Object.entries(a)) {
    const fb = (b as Record<string, unknown>)[k];
    if (k.startsWith("on") && typeof fa === "function" && typeof fb === "function") {
      out[k] = (...args: unknown[]) => {
        (fa as (...x: unknown[]) => void)(...args);
        (fb as (...x: unknown[]) => void)(...args);
      };
    }
  }
  return out as T;
}
