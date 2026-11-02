// Krúžok priazne a nápoveda nad staršom (Michal 2026-10-31, mockup „Priazeň podľa Michala“;
// v11 Strach a reči). Krúžok je pri staršom vždy — v línii, v baroch, v rekapitulácii, v bublinách
// aj na konci partie — a ukazuje, komu starší dáva priazeň a akú silnú.
// Texty pod fotkou nie sú: všetko celou vetou povie nápoveda pri prejdení myšou, fokusom
// klávesnice alebo podržaním prsta (na telefóne so zväčšeninou staršieho). Obsah: priazenKola.ts.

import "./priazen-kola.css";
import { createContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FocusEvent, type HTMLAttributes, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Action, Favour } from "@naex/core";
import { pocet } from "@naex/core";
import { FARBY_STUPNICE } from "@naex/tvorba";
import { IKONY } from "../karta/ikony.ts";
import { riadkyKruzkov, vetaPriazne, vetaSpakov, vetaZajatia, type KomuPriazen, type ObsahNapovedy, type ObsahNapovedyVazna, type PriazenKola } from "./priazenKola.ts";
import { slovoStupna, type Rod } from "./textyStarsich.ts";

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

/** Farby stupňov pre nápovedu v portáli (mimo línie starších) — pevné ako na scorecarde. */
const FARBY_NAPOVEDY = { "--tp-z1": FARBY_STUPNICE[2], "--tp-z2": FARBY_STUPNICE[1], "--tp-z3": FARBY_STUPNICE[0] } as CSSProperties;

/** Stupeň slovom vo farbe stupňa (nie názvom farby); 0 tlmene. */
export function SlovoStupna({ n, rod }: { readonly n: number; readonly rod: Rod }) {
  return <b className={`np-st s${n}`}>{slovoStupna(n, rod)}</b>;
}

/** Štvorček plnej (strach) či šrafovanej (reči) časti teplomera — legenda v texte. */
export function Stvorcek({ druh, n }: { readonly druh: "strach" | "reci"; readonly n: number }) {
  return <i className={`np-kv ${druh} s${n}`} aria-hidden="true" />;
}

/**
 * Obsah nápovedy nad staršom (R3, docs/napady/starsi-ram-mocky.html): strach a reči oboch,
 * špaky po bitke vetou, priazeň komu a všetky tri sily, riziko zajatia. Hráči menom.
 */
export function ObsahNapovedyStarsieho({ o, obrazok = null }: { readonly o: ObsahNapovedy | ObsahNapovedyVazna; readonly obrazok?: string | null }) {
  if (o.druh === "vazen") return <ObsahNapovedyVaznaEl o={o} obrazok={obrazok} />;
  return (
    <div className="np-r3" style={FARBY_NAPOVEDY}>
      <div className="np-a">
        <span className="np-hlava">
          {obrazok !== null && <img src={obrazok} alt="" draggable={false} />}
          <span>
            <b className="np-meno">{o.meno}</b>
            <small className="np-nazov">plná = strach, šrafovaná = reči</small>
          </span>
          <KruzokPriazne fav={o.favour} p={o.priazen} velkost={34} />
        </span>
        {o.akcia !== null && <span className="np-akcia">Klik: {o.akcia}</span>}
        <table className="np-tab">
          <thead>
            <tr>
              <th />
              <th>stupeň</th>
              <th>
                <Stvorcek druh="strach" n={2} />
                strach
              </th>
              <th>
                <Stvorcek druh="reci" n={2} />
                reči
              </th>
            </tr>
          </thead>
          <tbody>
            {o.hraci.map((h) => (
              <tr key={h.komu} className={h.komu}>
                <th>{h.kto}</th>
                <td>{h.vrchol === 0 ? <span className="np-st s0">{slovoStupna(0, o.rod)}</span> : <SlovoStupna n={h.vrchol} rod={o.rod} />}</td>
                <td>{h.strach === 0 ? <span className="np-st s0">—</span> : `po ${slovoStupna(h.strach, o.rod)}`}</td>
                <td>{h.reci === 0 ? <span className="np-st s0">—</span> : `po ${slovoStupna(h.reci, o.rod)}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <span className="np-h4">Špaky po bitke</span>
        <ul className="np-sp">
          {o.hraci.map((h) => (
            <li key={h.komu} className={h.komu}>
              <b>{h.kto}</b>
              <span>{vetaSpakov(h, o.rod)}</span>
            </li>
          ))}
        </ul>
        <span className="np-pozn">Víťaz bitky dostane za vrch teplomera, porazený len za reči. Pri sekere obaja len za reči.</span>
      </div>
      <div className="np-b">
        <span className="np-h4">
          <IkonaPriazneKruzku fav={o.favour} /> Priazeň {o.nazovPriazne} · {o.kedyPriazne}
        </span>
        <span className={`np-komu ${trieda(o.priazen.komu)}`}>{vetaPriazne(o)}</span>
        <span className="np-pozn">Kto ju má, tomu platí podľa sily:</span>
        <ol className="np-sily">
          {o.sily.map((t, i) => (
            <li key={i} className={o.priazen.sila === i + 1 ? `on ${trieda(o.priazen.komu)}` : undefined}>
              <b>sila {i + 1}</b>
              <span>{t}</span>
            </li>
          ))}
        </ol>
        <span className="np-pozn">Priazeň ráta len strach (plnú časť). Reči priazeň nedávajú a nerátajú sa ani do výhry strachom, ani do zajatia.</span>
        {o.zajatie.map((z) => (
          <span key={z.hrac} className={`np-zajatie ${z.komu}`}>
            ⛓ {vetaZajatia(z, o.rod)}
          </span>
        ))}
        {o.dalsi !== null && (
          <span className="np-r">
            <span className="np-l">{o.dalsi.nazov}</span>
            <span>{o.dalsi.text}</span>
          </span>
        )}
      </div>
    </div>
  );
}

/** Nápoveda nad väzňom (R3): je z neho stále vydesený, krádež pri zajatí a schopnosť väzňa doslova (v11.2). */
function ObsahNapovedyVaznaEl({ o, obrazok }: { readonly o: ObsahNapovedyVazna; readonly obrazok: string | null }) {
  return (
    <div className="np-r3" style={FARBY_NAPOVEDY}>
      <div className="np-a">
        <span className="np-hlava">
          {obrazok !== null && <img src={obrazok} alt="" draggable={false} />}
          <span>
            <b className="np-meno">{o.meno}</b>
            <small className="np-nazov">
              v pivnici · <b className={`np-kto ${o.komu}`}>{o.kto}</b>
            </small>
          </span>
        </span>
        <span className="np-vazen">
          <b className={`np-kto ${o.komu}`}>{o.kto}:</b> je z neho stále <SlovoStupna n={3} rod={o.rod} />. Ráta sa ako červená do výhry strachom (červené {o.cervene} z {o.cervenychNaVyhru}) a je väzeň (väzni {o.vazni} z {o.vazniNaVyhru}).
        </span>
        {o.kradez !== null && (
          <span className="np-vazen">
            Krádež pri zajatí (bitka {o.kradez.kolo}): {o.kradez.obet} → {o.kto} {pocet(o.kradez.spaky, "špak", "špaky", "špakov")} za vrch teplomera.
          </span>
        )}
      </div>
      <div className="np-b">
        <span className="np-h4">Čo už nerobí</span>
        <span className="np-vazen">
          Teplomery nemá, nebojuje, špaky ani priazeň{o.nazovPriazne === null ? "" : ` ${o.nazovPriazne}`} nedáva. Nikto ho nevyslobodí.
        </span>
        {o.schopnost !== null && (
          <>
            <span className="np-h4">
              Schopnosť väzňa ({o.kto}, raz za hru){o.pouzita ? " · použitá" : ""}
            </span>
            <span className="np-vazen">{o.schopnost}</span>
          </>
        )}
      </div>
    </div>
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
export function useNapovedaStarsieho(obsah: () => ObsahNapovedy | ObsahNapovedyVazna | null, moznosti: { readonly obrazok?: string | null; readonly zvacsenina?: () => ReactNode } = {}): NapovedaStarsieho {
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
                  <div className="np-tip np-tip-zoom">
                    <ObsahNapovedyStarsieho o={o} obrazok={moznosti.obrazok ?? null} />
                  </div>
                )}
              </div>
            </div>,
            document.body,
          )
        : createPortal(
            <TipPriKotve kotva={stav.kotva} kratky={stav.druh === "kruzky"}>
              {stav.druh === "kruzky" ? (
                riadkyKruzkov().map((r, i) => (
                  <span key={i} className={i === 1 ? "np-hadka" : undefined}>
                    {r}
                  </span>
                ))
              ) : o !== null ? (
                <ObsahNapovedyStarsieho o={o} obrazok={moznosti.obrazok ?? null} />
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

/**
 * Nápoveda pri kotve so šípkou: nad ňou, keď sa nezmestí (horný bar), pod ňou; vysoký starší
 * v línii (R3) nemá miesto ani nad, ani pod — nápoveda je vedľa neho (vpravo, inak vľavo).
 */
function TipPriKotve({ kotva, kratky, children }: { readonly kotva: HTMLElement; readonly kratky: boolean; readonly children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [poloha, setPoloha] = useState<{ readonly left: number; readonly top: number; readonly sipka: number; readonly kde: "nad" | "pod" | "vpravo" | "vlavo" } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el === null) return;
    const k = kotva.getBoundingClientRect();
    const t = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const nad = k.top - t.height - 12 >= 4;
    const pod = k.bottom + t.height + 14 <= vh;
    if (nad || pod) {
      const stred = k.left + k.width / 2;
      const left = Math.max(6, Math.min(vw - t.width - 6, stred - t.width / 2));
      const top = nad ? k.top - t.height - 10 : k.bottom + 10;
      setPoloha({ left, top, sipka: Math.max(12, Math.min(t.width - 12, stred - left)), kde: nad ? "nad" : "pod" });
      return;
    }
    const vpravo = k.right + 12 + t.width <= vw - 4 || k.left - 12 - t.width < 4;
    const left = vpravo ? Math.min(vw - t.width - 4, k.right + 12) : k.left - t.width - 12;
    const top = Math.max(4, Math.min(vh - t.height - 4, k.top));
    setPoloha({ left, top, sipka: Math.max(14, Math.min(t.height - 14, k.top + 24 - top)), kde: vpravo ? "vpravo" : "vlavo" });
  }, [kotva, kratky, children]);
  return (
    <div
      ref={ref}
      className={`np-tip${kratky ? " kratky" : ""}${poloha === null || poloha.kde === "nad" ? "" : ` ${poloha.kde}`}`}
      role="tooltip"
      style={{ left: poloha?.left ?? 0, top: poloha?.top ?? 0, visibility: poloha === null ? "hidden" : undefined, "--sipka": `${poloha?.sipka ?? 0}px` } as CSSProperties}
    >
      {children}
    </div>
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
