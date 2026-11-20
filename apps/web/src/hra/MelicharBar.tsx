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
import { castiVety, kusyStrany, rozdelNaStrany, usekyVety, vetyTextu, type RezimMelichara } from "./bar.ts";
import { MELICHAR_PRIBEH } from "./melicharPribeh.ts";
import { PojemVBubline } from "../stranky/pravidla/Pojem.tsx";
import { castiSPojmami, prvePojmy } from "../stranky/pravidla/slovnik.ts";

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

const ZIADNE_POJMY: ReadonlySet<string> = new Set();

/**
 * Veta Melichara s piktogramami akcií namiesto značiek [Rana] (bar.ts, castiVety). Pojmy jadra
 * z `pojmy` sú podčiarknuté s krátkym vysvetlením (PojemVBubline), každý raz.
 */
export function VetaMelichara({ text, sada, pojmy = ZIADNE_POJMY }: { readonly text: string; readonly sada: Sada | null; readonly pojmy?: ReadonlySet<string> }) {
  const akcia = (k: string) => sada?.akcie.find((a) => a.kluc === k);
  const jeAkcia = (k: string): boolean => Object.hasOwn(IKONY, k) || akcia(k) !== undefined;
  return (
    <>
      {castiVety(text, jeAkcia).map((c, i) =>
        "akcia" in c ? (
          <span key={i} className="mel-ikona" title={akcia(c.akcia)?.nazov ?? c.akcia}>
            <IkonaAkcie kluc={c.akcia} akcia={akcia(c.akcia)} />
          </span>
        ) : pojmy.size === 0 ? (
          <Fragment key={i}>{c.text}</Fragment>
        ) : (
          <Fragment key={i}>
            {castiSPojmami(c.text, pojmy).map((k, j) =>
              k.pojem === undefined ? (
                <Fragment key={j}>{k.text}</Fragment>
              ) : (
                <PojemVBubline key={j} k={k.pojem}>
                  {k.text}
                </PojemVBubline>
              ),
            )}
          </Fragment>
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
  /** Ten istý kus po menších častiach, keď sa nezmestí do baru ani sám. */
  readonly jemne?: readonly KusVety[];
  /** Kus začne novú stranu a text sa otvorí na nej (rada po chybe; pokyn ostane o stranu späť). */
  readonly novaStrana?: boolean;
}

/**
 * Text Melichara ako kusy po vetách — s piktogramami akcií ako vo VetaMelichara. Pojem jadra
 * sa podčiarkne pri prvom výskyte v texte.
 */
export function kusyVety(kluc: string, text: string, sada: Sada | null): KusVety[] {
  const vety = vetyTextu(text);
  const prve = prvePojmy(vety);
  let predVetou: ReadonlySet<string> = ZIADNE_POJMY;
  return vety.map((veta, i) => {
    const useky = usekyVety(veta);
    const tu = prve[i] ?? ZIADNE_POJMY;
    // Rozbitá veta: pojem sa podčiarkne v tom úseku, kde je prvýkrát, nie v každom.
    const vUsekoch = tu.size === 0 ? useky.map(() => ZIADNE_POJMY) : prvePojmy(useky, predVetou);
    predVetou = new Set([...predVetou, ...tu]);
    return {
      kluc: `${kluc}-${i}`,
      obsah: <VetaMelichara text={veta} sada={sada} pojmy={tu} />,
      ...(useky.length > 1
        ? { jemne: useky.map((u, j) => ({ kluc: `${kluc}-${i}-${j}`, obsah: <VetaMelichara text={u} sada={sada} pojmy={vUsekoch[j] ?? ZIADNE_POJMY} /> })) }
        : {}),
    };
  });
}

export interface Strany {
  readonly strana: number;
  readonly pocet: number;
  /** Je za touto stranou ešte ďalšia? */
  readonly dalsiaJe: boolean;
  readonly dalsia: () => void;
  readonly predosla: () => void;
  /** Počet strán a strana, na ktorej sa text otvorí (kus s novaStrana, inak prvá). */
  readonly setPocet: (n: number, start?: number) => void;
}

const SKRYTA_PODOBA = { inert: true, "aria-hidden": true } as const;

/**
 * Dve podoby toho istého miesta v bare (napr. „ďalej“ na strane textu a ponuka na poslednej):
 * ukáže sa jedna, druhá leží neviditeľná pod ňou a drží šírku. Keby tlačidlá menili šírku vety
 * podľa strany, užšia veta pridá stranu, širšia ju uberie a bar sa prepína dookola — „vibroval“
 * a nedal sa kliknúť (koniec 1. časti výučby, Firefox, Michal 2026-10-30). Skrytá podoba dostane
 * ziva = false: bez kliknutia a bez značiek, ktoré hľadajú nástroje.
 */
export function NaJednomMieste({
  ukaz,
  a,
  b,
}: {
  readonly ukaz: "a" | "b";
  readonly a: (ziva: boolean) => ReactNode;
  readonly b: (ziva: boolean) => ReactNode;
}) {
  return (
    <span className="mel-jedno-miesto">
      <span {...(ukaz === "a" ? {} : SKRYTA_PODOBA)}>{a(ukaz === "a")}</span>
      <span {...(ukaz === "b" ? {} : SKRYTA_PODOBA)}>{b(ukaz === "b")}</span>
    </span>
  );
}

/** Ktorá strana textu sa ukazuje; nový text (kľúč) začne od prvej, alebo od strany s novaStrana. */
export function useStrany(kluc: string): Strany {
  const [s, setS] = useState({ kluc, strana: 0 });
  const [rozdelenie, setRozdelenie] = useState({ pocet: 1, start: 0 });
  const { pocet } = rozdelenie;
  const strana = s.kluc === kluc ? Math.min(s.strana, pocet - 1) : Math.min(rozdelenie.start, pocet - 1);
  const dalsia = useCallback(() => setS({ kluc, strana: strana + 1 }), [kluc, strana]);
  const predosla = useCallback(() => setS({ kluc, strana: Math.max(0, strana - 1) }), [kluc, strana]);
  const setPocet = useCallback((n: number, start = 0) => setRozdelenie((r) => (r.pocet === n && r.start === start ? r : { pocet: n, start })), []);
  return { strana, pocet, dalsiaJe: strana < pocet - 1, dalsia, predosla, setPocet };
}

/**
 * Tlačidlo ‹ na predošlú stranu. Kým má text viac strán, miesto drží aj na prvej (neviditeľné) —
 * keby pribudlo až na druhej, zúžilo by vetu a strany by sa rozdelili inak (V-01).
 */
export function PredoslaStrana({ strany, popis }: { readonly strany: Strany; readonly popis: string }) {
  if (strany.pocet <= 1) return null;
  const ziva = strany.strana > 0;
  return (
    <button
      type="button"
      className={`tlacidlo-jemne mel-spat${ziva ? "" : " mel-rezerva"}`}
      onClick={ziva ? strany.predosla : undefined}
      title={popis}
      aria-label={popis}
      {...(ziva ? {} : { tabIndex: -1, "aria-hidden": true, inert: true })}
    >
      ‹
    </button>
  );
}

const ZIADNE_KLUCE: readonly string[] = [];

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
  // Kusy, ktoré sa nezmestili ani samy, idú po menších častiach; nový text začína odznova.
  const [rozbite, setRozbite] = useState<{ readonly podpis: string; readonly kluce: readonly string[] }>({ podpis, kluce: [] });
  const rozbiteKluce = rozbite.podpis === podpis ? rozbite.kluce : ZIADNE_KLUCE;
  const naStrany = kusy.flatMap((k) =>
    rozbiteKluce.includes(k.kluc) ? (k.jemne ?? [k]).map((j, i) => (i === 0 && k.novaStrana === true ? { ...j, novaStrana: true } : j)) : [k],
  );
  const { setPocet } = strany;
  const zmeraj = useCallback(() => {
    const m = merac.current;
    const veta = m?.closest<HTMLElement>(".mel-veta") ?? null;
    const telo = veta?.closest<HTMLElement>(".mel-telo") ?? null;
    if (m === null || veta === null || telo === null) return;
    // Výška pre vetu = vnútro tela bez menovky — z baru, nie z práve ukázanej strany. Predtým sa
    // brala z výšky vety: strana s piktogramom či štítkom dala viac, krátka strana a skrytá menovka
    // (os kola) menej, a hranice strán sa so stranou posúvali (V-01, V-17).
    const cs = getComputedStyle(telo);
    const medzera = parseFloat(cs.rowGap) || 0;
    const vnutro = telo.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const ostatne = [...telo.children].filter((el): el is HTMLElement => el !== veta && el instanceof HTMLElement && getComputedStyle(el).display !== "none");
    const dostupne = Math.max(0, vnutro - ostatne.reduce((s, el) => s + el.getBoundingClientRect().height + medzera, 0));
    const spany = [...m.children] as HTMLElement[];
    m.style.display = "block";
    const vyska = (od: number, po: number): number => {
      spany.forEach((el, i) => (el.style.display = i >= od && i < po ? "" : "none"));
      return m.getBoundingClientRect().height;
    };
    const zlomy = new Set(spany.flatMap((el, i) => (el.dataset.novaStrana === undefined ? [] : [i])));
    const r = rozdelNaStrany(spany.length, vyska, dostupne + 0.5, zlomy);
    m.style.display = "";
    for (const el of spany) el.style.display = "";
    const naRozbitie = r.pretecie.map((p) => spany[p]).flatMap((el) => (el?.dataset.jemne === undefined || el.dataset.kluc === undefined ? [] : [el.dataset.kluc]));
    if (naRozbitie.length > 0) {
      setRozbite({ podpis, kluce: [...rozbiteKluce, ...naRozbitie] });
      return;
    }
    if (r.pretecie.length > 0) console.warn(`Melichar: veta sa do baru nezmestí ani po častiach — text treba skrátiť: „${podpis.slice(0, 90)}…“`);
    setZaciatky((z) => (z.length === r.zaciatky.length && z.every((x, i) => x === r.zaciatky[i]) ? z : r.zaciatky));
    const prvyZlom = Math.min(...zlomy);
    setPocet(r.zaciatky.length, Number.isFinite(prvyZlom) ? Math.max(0, r.zaciatky.findIndex((z) => z >= prvyZlom)) : 0);
  }, [podpis, setPocet, rozbiteKluce]);
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
  const [od, po] = kusyStrany(zaciatky, naStrany.length, strany.strana);
  return (
    <>
      <div className="mel-strana">
        {naStrany.slice(od, po).map((k) => (
          <Fragment key={k.kluc}>{k.obsah}</Fragment>
        ))}
      </div>
      <div className="mel-merac" ref={merac} aria-hidden="true">
        {naStrany.map((k) => (
          <span key={k.kluc} data-kluc={k.kluc} data-jemne={k.jemne === undefined ? undefined : ""} data-nova-strana={k.novaStrana === true ? "" : undefined}>
            {k.obsah}
          </span>
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
          <span className="mel-meno">{MELICHAR_PRIBEH.meno}</span>
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
