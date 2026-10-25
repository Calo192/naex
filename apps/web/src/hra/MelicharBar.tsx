// Majster Melichar hovorí v jednotnom bare (Michal 2026-10-25, mock „Melichar v bare“):
// jeho bublina obsadí bar, ktorý ostane rovnako vysoký; po „ďalej“ či zatvorení sa bar
// vráti. Hovorí tak výučba, nápovedy aj hláška pri pečiatke momentu. Bublina sa vkladá
// do miesta v bare (portál) — výučba a nápovedy žijú mimo hernej plochy (Hra.tsx).
// Na to isté miesto ide aj pult hlášok (Soundboard); keď Melichar hovorí, pult mu ustúpi.
// Bublina sa nikdy nerozbalí cez stôl a nescrolluje (Michal 2026-10-25): dlhší text ide
// na strany s „ďalej“, kvíz má otázku vľavo a dve možnosti pod sebou vpravo.

import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Sada } from "@naex/tvorba";
import { IkonaAkcie } from "../karta/IkonaAkcie.tsx";
import { IKONY } from "../karta/ikony.ts";
import { castiVety, rozdelNaStrany, vetyTextu, type RezimMelichara } from "./bar.ts";
import { MELICHAR_PRIBEH } from "./melicharPribeh.ts";

/** Miesto v bare (JednotnyBar), kam sa bublina vkladá. */
export const ID_MIESTA_MELICHARA = "jbar-melichar";

/** Miesto v bare — po novej partii je to iný prvok, preto sa overuje, či ešte žije. */
export function useMiestoVBare(): HTMLElement | null {
  const [miesto, setMiesto] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const najdi = (): void => setMiesto((m) => (m !== null && m.isConnected ? m : document.getElementById(ID_MIESTA_MELICHARA)));
    najdi();
    const t = setInterval(najdi, 400);
    return () => clearInterval(t);
  }, []);
  return miesto;
}

/** Hovorí Melichar v bare (výučba, nápoveda, hláška momentu)? Pult hlášok mu vtedy ustúpi (Soundboard). */
export function useMelicharHovoriVBare(miesto: HTMLElement | null): boolean {
  const [hovori, setHovori] = useState(false);
  useEffect(() => {
    if (miesto === null) {
      setHovori(false);
      return;
    }
    const zisti = (): void => setHovori([...miesto.children].some((el) => el.classList.contains("mel")));
    zisti();
    const mo = new MutationObserver(zisti);
    mo.observe(miesto, { childList: true });
    return () => mo.disconnect();
  }, [miesto]);
  return hovori;
}

/** Veta Melichara s piktogramami akcií namiesto značiek [Rana] (bar.ts, castiVety). */
export function VetaMelichara({ text, sada }: { readonly text: string; readonly sada: Sada | null }) {
  const akcia = (k: string) => sada?.akcie.find((a) => a.kluc === k);
  const jeAkcia = (k: string): boolean => Object.hasOwn(IKONY, k) || akcia(k) !== undefined;
  return (
    <>
      {castiVety(text, jeAkcia).map((c, i) =>
        "akcia" in c ? (
          <span key={i} className="mel-ikona" title={akcia(c.akcia)?.nazov ?? c.akcia}>
            <IkonaAkcie kluc={c.akcia} akcia={akcia(c.akcia)} />
          </span>
        ) : (
          <Fragment key={i}>{c.text}</Fragment>
        ),
      )}
    </>
  );
}

/** Fotka Melichara: pri myši (na dotyku po ťuknutí) sa zväčší a povie, kto je. */
function AvatarMelichara() {
  const [otvoreny, setOtvoreny] = useState(false);
  const mys = useRef(false);
  return (
    <span className={`mel-avatar-obal${otvoreny ? " otvoreny" : ""}`} onMouseLeave={() => setOtvoreny(false)}>
      <button
        type="button"
        className="mel-avatar"
        aria-label={`Kto je ${MELICHAR_PRIBEH.meno}`}
        aria-expanded={otvoreny}
        onPointerDown={(e) => {
          mys.current = e.pointerType === "mouse";
        }}
        // Myš ukazuje príbeh prejdením (CSS :hover) — klik ho prepína len na dotyku a z klávesnice.
        onClick={() => {
          if (!mys.current) setOtvoreny((o) => !o);
          mys.current = false;
        }}
      >
        <img src="/melichar.jpg" alt="" draggable={false} />
      </button>
      <span className="mel-pribeh" role="tooltip">
        <img src="/melichar.jpg" alt={MELICHAR_PRIBEH.meno} draggable={false} />
        <span>
          <b>{MELICHAR_PRIBEH.meno}.</b> {MELICHAR_PRIBEH.text}
        </span>
      </span>
    </span>
  );
}

/** Kus textu v bare: veta, štítok ťahu, chyba. Strana sa delí len medzi kusmi. */
export interface KusVety {
  readonly kluc: string;
  readonly obsah: ReactNode;
}

/** Text Melichara ako kusy po vetách — s piktogramami akcií ako vo VetaMelichara. */
export function kusyVety(kluc: string, text: string, sada: Sada | null): KusVety[] {
  return vetyTextu(text).map((veta, i) => ({ kluc: `${kluc}-${i}`, obsah: <VetaMelichara text={veta} sada={sada} /> }));
}

export interface Strany {
  readonly strana: number;
  readonly pocet: number;
  /** Je za touto stranou ešte ďalšia? */
  readonly dalsiaJe: boolean;
  readonly dalsia: () => void;
  readonly predosla: () => void;
  readonly setPocet: (n: number) => void;
}

/** Ktorá strana textu sa ukazuje; nový text (kľúč) začne od prvej. */
export function useStrany(kluc: string): Strany {
  const [s, setS] = useState({ kluc, strana: 0 });
  const [pocet, setPocet] = useState(1);
  const strana = s.kluc === kluc ? Math.min(s.strana, pocet - 1) : 0;
  const dalsia = useCallback(() => setS({ kluc, strana: strana + 1 }), [kluc, strana]);
  const predosla = useCallback(() => setS({ kluc, strana: Math.max(0, strana - 1) }), [kluc, strana]);
  return { strana, pocet, dalsiaJe: strana < pocet - 1, dalsia, predosla, setPocet };
}

/**
 * Text v bare po stranách (Michal 2026-10-25: nescrolluje sa, bar sa nerozbalí). Merač s celým
 * textom je mimo toku a skrytý; pri zmene textu či šírky sa pred vykreslením na chvíľu zobrazí
 * a zmeria, koľko kusov sa zmestí do voľnej výšky tela bubliny.
 */
export function StrankovanaVeta({
  kusy,
  podpis,
  strany,
}: {
  readonly kusy: readonly KusVety[];
  /** Mení sa s textom — kusy sú prvky Reactu a porovnať ich nejde. */
  readonly podpis: string;
  readonly strany: Strany;
}) {
  const merac = useRef<HTMLDivElement>(null);
  const [zaciatky, setZaciatky] = useState<readonly number[]>([0]);
  const { setPocet } = strany;
  const zmeraj = useCallback(() => {
    const m = merac.current;
    const veta = m?.closest<HTMLElement>(".mel-veta") ?? null;
    const telo = veta?.closest<HTMLElement>(".mel-telo") ?? null;
    if (m === null || veta === null || telo === null) return;
    // Voľná výška = výška vety + čo v tele ostáva voľné (kratší text je v ňom vycentrovaný).
    const cs = getComputedStyle(telo);
    const prvy = telo.firstElementChild?.getBoundingClientRect();
    const posledny = telo.lastElementChild?.getBoundingClientRect();
    const vnutro = telo.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const volne = prvy === undefined || posledny === undefined ? 0 : Math.max(0, vnutro - (posledny.bottom - prvy.top));
    const dostupne = veta.clientHeight + volne;
    const spany = [...m.children] as HTMLElement[];
    m.style.display = "block";
    const vyska = (od: number, po: number): number => {
      spany.forEach((el, i) => (el.style.display = i >= od && i < po ? "" : "none"));
      return m.getBoundingClientRect().height;
    };
    const r = rozdelNaStrany(spany.length, vyska, dostupne + 0.5);
    m.style.display = "";
    for (const el of spany) el.style.display = "";
    if (r.pretecie.length > 0) console.warn(`Melichar: veta sa do baru nezmestí ani sama — text treba skrátiť: „${podpis.slice(0, 90)}…“`);
    setZaciatky((z) => (z.length === r.zaciatky.length && z.every((x, i) => x === r.zaciatky[i]) ? z : r.zaciatky));
    setPocet(r.zaciatky.length);
  }, [podpis, setPocet]);
  useLayoutEffect(zmeraj, [zmeraj]);
  useEffect(() => {
    const veta = merac.current?.closest(".mel-veta");
    if (veta == null) return;
    // Šírka vety sa mení s oknom aj s tlačidlami vpravo; písmo sa môže dotiahnuť neskôr.
    const ro = new ResizeObserver(() => zmeraj());
    ro.observe(veta);
    void document.fonts.ready.then(() => zmeraj());
    return () => ro.disconnect();
  }, [zmeraj]);
  const i = Math.min(strany.strana, zaciatky.length - 1);
  const od = zaciatky[i] ?? 0;
  const po = zaciatky[i + 1] ?? kusy.length;
  return (
    <>
      <div className="mel-strana">
        {kusy.slice(od, po).map((k) => (
          <Fragment key={k.kluc}>{k.obsah}</Fragment>
        ))}
      </div>
      <div className="mel-merac" ref={merac} aria-hidden="true">
        {kusy.map((k) => (
          <span key={k.kluc}>{k.obsah}</span>
        ))}
      </div>
    </>
  );
}

/** Číslo strany vedľa menovky, keď je text na viac strán. */
export function CisloStrany({ strany }: { readonly strany: Strany }) {
  if (strany.pocet <= 1) return null;
  return (
    <span className="mel-cislo-strany" aria-label={`Strana ${strany.strana + 1} z ${strany.pocet}`}>
      {strany.strana + 1}/{strany.pocet}
    </span>
  );
}

export interface MelicharVBareProps {
  readonly rezim: RezimMelichara;
  /** Veta a čo k nej patrí (štítok ťahu, chyba) — StrankovanaVeta, v bare sa nescrolluje. */
  readonly children: ReactNode;
  /** Počítadlo krokov vedľa menovky (výučba). */
  readonly pocitadlo?: ReactNode;
  /**
   * Možnosti kvízu napravo od otázky, pod sebou (Michal 2026-10-25: „Otázka môže byť vľavo
   * a možnosti pod sebou napravo od otázky.“) — v bare a v jeho výške, nič cez stôl.
   */
  readonly moznosti?: ReactNode;
  /** Vpravo: stav a tlačidlá („ďalej“, „rozumiem“…). */
  readonly vpravo: ReactNode;
  readonly trieda?: string;
  /** Atribúty pre nástroje (data-vyucba-bublina, data-vyucba-krok, data-napoveda). */
  readonly atributy?: Readonly<Record<`data-${string}`, string>>;
}

export function MelicharVBare({ rezim, children, pocitadlo, moznosti, vpravo, trieda, atributy }: MelicharVBareProps) {
  const miesto = useMiestoVBare();
  if (miesto === null) return null;
  return createPortal(
    <aside className={`mel${trieda === undefined ? "" : ` ${trieda}`}`} data-mel-rezim={rezim} aria-label={MELICHAR_PRIBEH.meno} {...atributy}>
      <AvatarMelichara />
      <div className="mel-telo">
        <span className="mel-kto">
          {MELICHAR_PRIBEH.meno}
          {pocitadlo}
        </span>
        <div className="mel-veta">{children}</div>
      </div>
      {/* Sem bar vloží odhad bitky, keď o ňom Melichar hovorí (JednotnyBar). */}
      {rezim === "odhad" && <span className="mel-ukazka" />}
      {moznosti !== undefined && <div className="mel-moznosti">{moznosti}</div>}
      <div className="mel-vpravo">{vpravo}</div>
    </aside>,
    miesto,
  );
}
