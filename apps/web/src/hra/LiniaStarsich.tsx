// Línia starších (Michal 2026-10-23, roadmapa #68 + #69 variant A): osem
// starších v rade na mieste línie kariet. Ukáže sa po kliku na dlaždicu Starší
// a sama pri krokoch na staršom (Pohoršenie, prebytok, patronát).
// Pri staršom je len portrét, priazeň a stupnica 7 polí so zrkadlením (tvoja
// polovica vľavo) — bodovacie podmienky scorecardov v6 nie sú (Michal 2026-10-26:
// „Ostala len priazeň a na tú scorecard netreba“).
//
// Každá informácia na jednom mieste (Michal 2026-10-28: „strašne veľa textu… mouseover
// je redundantný“): pod stupnicou strany „◀ ty · súper ▶“ a dva riadky — komu priazeň
// s krátkym účinkom a koho sa bojí so špakmi po vyhratej bitke. Na portréte štítok so
// zdrojom posunu od bitky (duch na starom mieste). V kroku duch ukáže cieľ posunu a riadky
// pri prejdení myšou stav po posune. Lupa nesie len to, čo na karte nie je: plné znenie
// priazne, pravidlo strachu, vydesenie a odkiaľ sa marker pohol. Texty: textyStarsich.ts.
//
// Rozdelenie Pohoršenia a prebytku (mock C · Pečať, Michal 2026-10-30): v mojom kroku má
// karta meno na stred, pečať priazne na portréte, plochú stupnicu s cenou na každom
// dosiahnuteľnom poli a pod ňou šípky smerov rovnako vysoké ako stupnica. Posuny sú
// nepotvrdené, kým ich Potvrdiť na hrane stola nepošle — plán ráta jadro (rozdelenie.ts).

import type { CSSProperties, HTMLAttributes, KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Action, ElderState, Favour, GameData, PlayerId, PosunMarkera, SpakyStarsieho } from "@naex/core";
import { NAZVY_ZON, STUPNICA_ZONY, favourStarsieho, obavanyHrac, priazenHraca, priazenSila, sPosunutymMarkerom, scorecardStarsieho, strachNaUdrzanie, strachNaVyplatu, type MarkerPos } from "@naex/core";
import type { IkonaBodovania } from "@naex/tvorba";
import { FARBY_STUPNICE } from "@naex/tvorba";
import { IKONY } from "../karta/ikony.ts";
import { UCINOK_KRATKO, UCINOK_PRIAZNE } from "./Scorecard.tsx";
import { VykricnikyPeciatky, ZnackaStrachu } from "./IkonaStrachu.tsx";
import { CENA_POLA, PRAVIDLO_STRACHU, plnaPriazen, prikladStrachu, riadokPriazne, riadokStrachu, stitokStopy, textStopy, textStupna, textVydesenia } from "./textyStarsich.ts";

/** Šípka smeru pri rozdeľovaní: kam marker pôjde a za koľko (null = tým smerom sa teraz nedá). */
export interface SipkaRozdelenia {
  readonly posun: { readonly na: MarkerPos; readonly cena: number } | null;
  /** Tento smer je už v nepotvrdených posunoch — ťuk ho zruší. */
  readonly aktivna: boolean;
  readonly klik: () => void;
}

/** Starší pri rozdeľovaní Pohoršenia či prebytku (mock C · Pečať) — dáta z plánu jadra. */
export interface RozdelenieStarsieho {
  /** Šípky ◀ k tebe a k súperovi ▶; chýbajúca = krok ten smer nedovoľuje (prebytok má jeden). */
  readonly sipky: { readonly ja?: SipkaRozdelenia | undefined; readonly su?: SipkaRozdelenia | undefined };
  /** Cena posunu na pole stupnice (pozície 0–6) a či naň rozpočet stačí; null = tam sa nejde. */
  readonly ceny: readonly ({ readonly cena: number; readonly dosah: boolean } | null)[];
  /** Nepotvrdený posun tohto staršieho. */
  readonly navrh: { readonly na: MarkerPos; readonly cena: number } | null;
  /** Zvyšok ho už nikam neposunie — karta je tlmená. */
  readonly mrtvy: boolean;
}

/** Posuny jedného staršieho od poslednej bitky (do konca Zhromaždenia) — duch a štítok. */
export interface StopaStarsieho {
  /** Pozícia markera pred prvým posunom. */
  readonly z: MarkerPos;
  /** Zdroje v poradí, ako prišli; rovnaké po sebe idúce sa zrátajú (×2). */
  readonly zdroje: readonly { readonly zdroj: PosunMarkera["zdroj"]; readonly kto: PlayerId; readonly pocet: number }[];
}

/** Stopa staršieho z verejných posunov (ClientState.posunyMarkerov); bez posunu undefined. */
export function stopaStarsieho(posuny: readonly PosunMarkera[], elderId: string): StopaStarsieho | undefined {
  const moje = posuny.filter((x) => x.elderId === elderId);
  const prvy = moje[0];
  if (prvy === undefined) return undefined;
  const zdroje: { zdroj: PosunMarkera["zdroj"]; kto: PlayerId; pocet: number }[] = [];
  for (const x of moje) {
    const posledny = zdroje.at(-1);
    if (posledny !== undefined && posledny.zdroj === x.zdroj && posledny.kto === x.kto) posledny.pocet++;
    else zdroje.push({ zdroj: x.zdroj, kto: x.kto, pocet: 1 });
  }
  return { z: prvy.z, zdroje };
}

/** Jeden starší v línii — dáta pripraví HernaPlocha. */
export interface StarsiVLinii {
  readonly elder: ElderState;
  readonly meno: string;
  /** Ilustrácia karty staršieho (portrét). */
  readonly obrazok: string | null;
  /** Špaky, ktoré starší dá po bitke [hráč 0, hráč 1] (v6). */
  readonly body: SpakyStarsieho | undefined;
  /** Klik v kroku (Pohoršenie, prebytok, patronát) a čo urobí. */
  readonly klik?: { readonly akcia: string; readonly klik: () => void } | undefined;
  /** Kam by sa marker posunul (duch markera v kroku). */
  readonly ciel?: MarkerPos | null | undefined;
  /** Prečo sa v kroku nedá kliknúť (zamknutý starší). */
  readonly dovod?: string | undefined;
  /** Prejdené hranice zón v tejto bitke — ukazujú sa pri Pohoršení. */
  readonly hranice?: number | undefined;
  readonly patron: { readonly kto: PlayerId; readonly pohorsenia: number } | null;
  /** Vybraný v patronáte (čaká sa na kartu z ruky). */
  readonly vybrany?: boolean;
  /** Posuny od poslednej bitky — duch na starom mieste a štítok so zdrojom. */
  readonly stopa?: StopaStarsieho | undefined;
  /** Rozdeľovanie Pohoršenia či prebytku v mojom kroku. */
  readonly rozdelenie?: RozdelenieStarsieho | undefined;
}

export interface LiniaStarsichProps {
  readonly starsi: readonly StarsiVLinii[];
  readonly data: GameData;
  readonly ikony: readonly IkonaBodovania[];
  readonly ja: PlayerId;
  /** Čí pohľad línia ukazuje — po kliku na súperovu dlaždicu Starší súperov. */
  readonly pohlad: PlayerId;
  readonly mena: readonly [string, string];
  /** Krok na staršom, ktorý línia práve ukazuje (Pohoršenie…) — inak null. */
  readonly krok: string | null;
  /** Pri Pohoršení svietia hranice zón (§9.2: najviac 2 na marker). */
  readonly hraniceZon: boolean;
  /** Starší, ktorých posun sa práve zmenil (blikne po kroku). */
  readonly zmenene: ReadonlySet<string>;
  /** Tlačidlo vľavo v hlavičke: späť na stôl, nahliadnuť, ďalej. */
  readonly tlacidlo?: ReactNode;
  /** Lupa staršieho (prejdenie myšou, ťuk) — udalosti a data-lupa z HernaPlocha. */
  readonly lupa?: ((s: StarsiVLinii) => HTMLAttributes<HTMLElement>) | undefined;
}

/** Vzťah staršieho k hráčom pri danej polohe markera. */
function vztah(elder: ElderState, marker: MarkerPos) {
  const e = marker === elder.marker ? elder : { ...elder, marker };
  return { priazen: priazenHraca(e), sila: priazenSila(e), obavany: obavanyHrac(e), uroven: STUPNICA_ZONY[marker] };
}

/**
 * Farba zóny podľa úrovne 0–3 (farby stupnice sú pevné, ako na tlačenom scorecarde).
 * FARBY_STUPNICE tvorcu má 9 polí (v5); v6 má stupnica 7 polí — farba sa berie podľa zóny.
 */
export const farbaZony = (uroven: number): string => FARBY_STUPNICE[3 - uroven] ?? FARBY_STUPNICE[3];

export function LiniaStarsich({ starsi, data, ikony, ja, pohlad, mena, krok, hraniceZon, zmenene, tlacidlo, lupa }: LiniaStarsichProps) {
  const su: PlayerId = ja === 0 ? 1 : 0;
  // Náhľad posunu v hlavičke — celý text, dlaždica sa neoreže (UI U3).
  const [nahlad, setNahlad] = useState<string | null>(null);
  const [legenda, setLegenda] = useState(false);
  const nahladovany = starsi.find((s) => s.elder.elderId === nahlad);
  const akciaNahladu = nahladovany?.klik?.akcia;
  const kto = (p: PlayerId): string => (p === ja ? "ty" : mena[p]);

  // Mimo kroku hlavička nič nezhŕňa — priazeň je pri každom staršom, vydesení a špaky
  // na dlaždiciach hráčov (Michal 2026-10-28: každá informácia na jednom mieste).
  // Pri rozdeľovaní hlavička nič nehovorí — zvyšok a pokyn sú v bubline na hrane stola.
  const stred =
    krok === null || starsi.some((s) => s.rozdelenie !== undefined) ? null : (
      <span className="ls-nahlad" aria-live="polite">
        {nahladovany !== undefined && akciaNahladu !== undefined ? (
          <>
            <b>{nahladovany.meno}</b>
            {" — "}
            {akciaNahladu}
          </>
        ) : (
          <span className="ls-tlmene">Prejdi myšou alebo Tabom na staršieho — riadky pod stupnicou ukážu stav po posune.</span>
        )}
      </span>
    );

  return (
    <div className={`linia-starsich${pohlad === su ? " pohlad-su" : ""}${krok !== null ? " v-kroku" : ""}`}>
      <div className="ls-hlava">
        {tlacidlo}
        <button
          type="button"
          className={`ls-otaznik${legenda ? " otvorena" : ""}`}
          aria-expanded={legenda}
          aria-controls="ls-legenda"
          title="Ako čítať stupnicu starších"
          onClick={() => setLegenda((x) => !x)}
        >
          ? stupnica
        </button>
        {stred}
      </div>
      {legenda && <LegendaStupnice starsi={starsi} data={data} ja={ja} mena={mena} zavri={() => setLegenda(false)} />}
      <div className="ls-rad">
        {starsi.map((s, i) => (
          <ScorecardVLinii
            key={s.elder.elderId}
            s={s}
            data={data}
            ikony={ikony}
            ja={ja}
            mena={mena}
            krok={krok}
            hraniceZon={hraniceZon}
            zmeneny={zmenene.has(s.elder.elderId)}
            nahlad={nahlad === s.elder.elderId}
            onNahlad={(n) => setNahlad(n ? s.elder.elderId : (x) => (x === s.elder.elderId ? null : x))}
            kto={kto}
            lupa={lupa?.(s)}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Legenda stupnice (UX N1): tri vety a príklad z tejto partie — prvý starší
 * mimo stredu, inak všeobecný. Esc a „Rozumiem“ zavrú, fokus sa vráti na „?“.
 */
function LegendaStupnice({
  starsi,
  data,
  ja,
  mena,
  zavri,
}: {
  readonly starsi: readonly StarsiVLinii[];
  readonly data: GameData;
  readonly ja: PlayerId;
  readonly mena: readonly [string, string];
  readonly zavri: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector("button")?.focus();
    const klaves = (e: KeyboardEvent): void => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      zavri();
    };
    window.addEventListener("keydown", klaves, true);
    return () => {
      window.removeEventListener("keydown", klaves, true);
      document.querySelector<HTMLElement>(".ls-otaznik")?.focus();
    };
  }, [zavri]);
  const su: PlayerId = ja === 0 ? 1 : 0;
  const priklad = starsi.find((s) => obavanyHrac(s.elder) !== null);
  let prikladText: ReactNode;
  if (priklad === undefined) {
    prikladText = "Teraz sú všetci starší v strede (stupeň 0, pokojní): nikto nemá ich priazeň a nikoho sa neboja.";
  } else {
    const v = vztah(priklad.elder, priklad.elder.marker);
    const fav = favourStarsieho(data, priklad.elder);
    prikladText = (
      <>
        <b>Teraz:</b>{" "}
        {prikladStrachu({
          meno: priklad.meno,
          zona: v.uroven,
          ty: v.obavany === ja,
          super: mena[su],
          sila: v.sila,
          ucinok: UCINOK_KRATKO[fav](v.sila),
          spaky: strachNaVyplatu(priklad.elder, v.obavany === ja ? ja : su),
          naUdrzanie: strachNaUdrzanie(priklad.elder, v.obavany === ja ? ja : su),
        })}
      </>
    );
  }
  return (
    <div className="ls-legenda" id="ls-legenda" role="dialog" aria-label="Ako čítať stupnicu" ref={ref}>
      <p>
        <b>Tvoja polovica je vždy vľavo</b> (◀ ty), {mena[su]} vpravo. Stupne od stredu: 0 sivý stred (pokojný), 1 žltá (znepokojený), 2 oranžová
        (vystrašený), 3 červená (vydesený).
      </p>
      <p>
        <b>Výkričníky</b> ukazujú, koho sa starší bojí — sú v jeho farbe: <ZnackaStrachu uroven={1} trieda="moje" /> stupeň 1,{" "}
        <ZnackaStrachu uroven={2} trieda="moje" /> stupeň 2, <ZnackaStrachu uroven={3} trieda="moje" /> stupeň 3 (tu sa bojí teba). Na druhom konci
        stupnice je ♥ toho, komu prejavuje priazeň.
      </p>
      <p>
        <b>♥ Priazeň</b> má ten, na koho polovici marker leží — bonus počas hry, sila = stupeň (+1 / +2 / +3).
      </p>
      <p>{PRAVIDLO_STRACHU}</p>
      <p>{prikladText}</p>
      <p className="ls-tlmene">
        Posúva ho prebytok po bitke (k súperovi toho, kto ho drží) a Pohoršenie — od seba (desíš) alebo k sebe (upokojuješ), aj na červenú a z nej späť; {CENA_POLA}.
        Vyberáš len staršieho, marker ide, kým body stačia. Nič sa nezamyká.
      </p>
      <button type="button" className="ls-tlacidlo" onClick={zavri}>
        Rozumiem <kbd>Esc</kbd>
      </button>
    </div>
  );
}

function ScorecardVLinii({
  s,
  data,
  ja,
  mena,
  krok,
  hraniceZon,
  zmeneny,
  nahlad,
  onNahlad,
  kto,
  lupa,
}: {
  readonly s: StarsiVLinii;
  readonly data: GameData;
  readonly ikony: readonly IkonaBodovania[];
  readonly ja: PlayerId;
  readonly mena: readonly [string, string];
  readonly krok: string | null;
  readonly hraniceZon: boolean;
  readonly zmeneny: boolean;
  /** Myš či fokus je na tomto staršom — riadky ukážu stav po posune. */
  readonly nahlad: boolean;
  readonly onNahlad: (n: boolean) => void;
  readonly kto: (p: PlayerId) => string;
  readonly lupa: HTMLAttributes<HTMLElement> | undefined;
}) {
  if (s.rozdelenie !== undefined) return <KartaRozdelenia s={s} r={s.rozdelenie} data={data} ja={ja} mena={mena} zmeneny={zmeneny} />;
  const { elder, body, klik } = s;
  const su: PlayerId = ja === 0 ? 1 : 0;
  const fav = favourStarsieho(data, elder);
  // Zrkadlenie (Michal 2026-10-22, #55): každý vidí svoju polovicu stupnice vľavo.
  const poloha = (m: number): number => (ja === 0 ? m : 6 - m);
  const koho = (p: PlayerId): string => (p === ja ? "teba" : mena[p]);

  const krokTrieda =
    krok === null ? "" : s.vybrany === true ? " vybrany" : klik !== undefined ? ` klik${nahlad ? " nahl" : ""}` : " nedost";
  // Náhľad ťahu ako jedna značka (Michal 2026-10-28): v kroku duch markera ukáže cieľ posunu
  // aj bez myši; riadky pod stupnicou prejdú na stav po posune až pri prejdení myšou.
  const cielKroku = klik !== undefined || s.vybrany === true ? (s.ciel ?? null) : null;
  const duch = cielKroku !== null && cielKroku !== elder.marker ? cielKroku : null;
  const poPosune = duch !== null && (nahlad || s.vybrany === true) ? duch : null;
  const teraz = vztah(elder, elder.marker);
  const zobraz = poPosune === null ? teraz : vztah(elder, poPosune);
  const vydeseny = teraz.uroven === 3;

  // Špaky za strach na konci kola a čo čaká na udržanie (v8.3): teraz z jadra (spakyTeraz),
  // po posune so zaplatenými a držanými stupňami tak, ako ich posun nechá (sPosunutymMarkerom).
  const spaky = (v: ReturnType<typeof vztah>, poPosune: boolean): number =>
    v.obavany === null
      ? 0
      : !poPosune
        ? (body?.spaky[v.obavany] ?? strachNaVyplatu(elder, v.obavany))
        : strachNaVyplatu(sPosunutymMarkerom(elder, cielKroku ?? elder.marker), v.obavany);
  const naUdrzanie = (v: ReturnType<typeof vztah>, poPosune: boolean): number =>
    v.obavany === null
      ? 0
      : !poPosune
        ? (body?.naUdrzanie[v.obavany] ?? strachNaUdrzanie(elder, v.obavany))
        : strachNaUdrzanie(sPosunutymMarkerom(elder, cielKroku ?? elder.marker), v.obavany);
  const priazenText = (v: ReturnType<typeof vztah>): string => riadokPriazne(fav, v.priazen === null ? null : kto(v.priazen), v.sila);
  const strachText = (v: ReturnType<typeof vztah>, po: boolean): string => riadokStrachu(v.obavany === null ? null : mena[v.obavany], v.obavany === ja, spaky(v, po), naUdrzanie(v, po));
  const priazenTeraz = priazenText(teraz);
  const priazenPo = priazenText(zobraz);
  const strachTeraz = strachText(teraz, false);
  const strachPo = strachText(zobraz, poPosune !== null);
  const popisMarkera = `${s.meno}: ♥ ${priazenTeraz}; ${strachTeraz}`;

  const stopa = s.stopa;
  const pata =
    s.dovod !== undefined ? (
      <span className="ls-dovod">{s.dovod}</span>
    ) : null;

  return (
    <div
      className={`ls-sc${krokTrieda}${zmeneny ? " zmena" : ""}${stopa !== undefined ? " so-stopou" : ""}`}
      data-vyucba={`starsi:${s.elder.elderId}`}
      {...(klik === undefined
        ? { "aria-label": popisMarkera + (s.dovod !== undefined ? ` — ${s.dovod}` : ""), ...(krok === null ? lupa : undefined) }
        : {
            role: "button",
            tabIndex: 0,
            "aria-label": `${popisMarkera} — klikni: ${klik.akcia}`,
            onClick: klik.klik,
            onKeyDown: (e: ReactKeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                klik.klik();
              }
            },
            onMouseEnter: () => onNahlad(true),
            onMouseLeave: () => onNahlad(false),
            onFocus: () => onNahlad(true),
            onBlur: () => onNahlad(false),
          })}
    >
      <div className="ls-telo">
        <span className="ls-portret">
          {s.obrazok !== null ? <img src={s.obrazok} alt="" draggable={false} /> : <span className="ls-portret-prazdny" />}
          {/* Pečiatka bez textu (Michal 2026-10-27): !!! atramentom toho, koho sa bojí. */}
          {vydeseny && (
            <span className={`ls-peciatka ${teraz.obavany === ja ? "moja" : "superova"}`} role="img" aria-label={`vydesený — bojí sa ${koho(teraz.obavany ?? su)}`}>
              <VykricnikyPeciatky />
            </span>
          )}
          {s.patron !== null && (
            <span className="ls-patron">
              {s.patron.kto === ja ? "v tvojej ruke" : `v ruke: ${kto(s.patron.kto)}`} · {s.patron.kto === ja ? "súper" : "ty"} +{s.patron.pohorsenia} Pohoršenia
            </span>
          )}
          {stopa !== undefined && s.patron === null && <StitokPosunu stopa={stopa} ja={ja} />}
        </span>
      </div>
      <Stupnica
        marker={poloha(elder.marker)}
        ciel={duch === null ? null : poloha(duch)}
        stopa={stopa === undefined || stopa.z === elder.marker ? null : poloha(stopa.z)}
        priazen={teraz.priazen === null ? null : teraz.priazen === ja ? "ja" : "su"}
        hranice={hraniceZon}
      />
      {/* Pod staršinom meno a komu akú priazeň dáva, väčším písmom (Michal 2026-10-30: drobné
          popisy strán a poradie nad ním nič nehovorili). */}
      <span className="ls-stav" aria-hidden="true">
        <b className="ls-meno">{s.meno}</b>
        <span className={`ls-cip priazen${zobraz.priazen === null ? "" : zobraz.priazen === ja ? " moja" : " superova"}${priazenPo !== priazenTeraz ? " po-posune" : ""}`}>
          ♥ {priazenPo}
        </span>
        <span
          className={`ls-cip strach${zobraz.obavany === null ? " nikoho" : zobraz.obavany === ja ? " moj" : " superov"}${strachPo !== strachTeraz ? " po-posune" : ""}`}
        >
          <ZnackaStrachu uroven={zobraz.obavany === null ? 0 : zobraz.uroven} />
          {strachPo}
        </span>
      </span>
      {pata !== null && <div className="ls-pata">{pata}</div>}
    </div>
  );
}

/** Ikona akcie, ktorú priazeň staršieho posilňuje — pečať priazne (mock C · Pečať). */
export const IKONA_PRIAZNE: Readonly<Record<Favour, Action>> = {
  BITKAR: "Rana",
  VERIACI: "Viera",
  UZERNIK: "Dlh",
  EXEKUTOR: "Dlh",
  NEPRAJNIK: "Cigareta",
  FAJCIAR: "Cigareta",
  ALKOHOLIK: "Poldeci",
  LAKOMEC: "Pohoršenie",
};

/**
 * Ikona kroku v bubline a na žetónoch — piktogram akcie: Pohoršenie, prebytok je prebytok
 * poškodenia, preto Rana (Michal 2026-10-30).
 */
const AKCIA_DELENIA: Readonly<Record<"pohorsenie" | "prebytok", Action>> = { pohorsenie: "Pohoršenie", prebytok: "Rana" };

export function IkonaDelenia({ krok }: { readonly krok: "pohorsenie" | "prebytok" }) {
  return (
    <svg className="ikona-delenia" viewBox="0 0 100 100" aria-hidden="true">
      {IKONY[AKCIA_DELENIA[krok]].map((c, i) => (
        <path key={i} d={c.d} fillRule={c.evenOdd ? "evenodd" : "nonzero"} />
      ))}
    </svg>
  );
}

type Vztah = ReturnType<typeof vztah>;

/** Ako sa priazeň posunom zmení pre hráča ja: ▲ viac pre neho, ▼ menej, ⇄ prejde k druhému. */
export function zmenaPriazne(a: Pick<Vztah, "priazen" | "sila">, b: Pick<Vztah, "priazen" | "sila">, ja: PlayerId): { readonly trieda: "hore" | "dole" | "prechod"; readonly znak: string } | null {
  if (a.priazen === b.priazen && a.sila === b.sila) return null;
  if (a.priazen !== null && b.priazen !== null && a.priazen !== b.priazen) return { trieda: "prechod", znak: "⇄" };
  const hodnota = (v: Pick<Vztah, "priazen" | "sila">): number => (v.priazen === null ? 0 : v.priazen === ja ? v.sila : -v.sila);
  return hodnota(b) > hodnota(a) ? { trieda: "hore", znak: "▲" } : { trieda: "dole", znak: "▼" };
}

/**
 * Karta staršieho pri rozdeľovaní (mock C · Pečať): meno na stred, portrét s pečaťou priazne
 * a cenou nepotvrdeného posunu, plochá stupnica s cenami, šípky smerov a riadok strachu.
 */
function KartaRozdelenia({
  s,
  r,
  data,
  ja,
  mena,
  zmeneny,
}: {
  readonly s: StarsiVLinii;
  readonly r: RozdelenieStarsieho;
  readonly data: GameData;
  readonly ja: PlayerId;
  readonly mena: readonly [string, string];
  readonly zmeneny: boolean;
}) {
  const { elder } = s;
  const su: PlayerId = ja === 0 ? 1 : 0;
  const teraz = vztah(elder, elder.marker);
  const navrh = r.navrh;
  const zobraz = navrh === null ? teraz : vztah(elder, navrh.na);
  const spaky = (v: Vztah, poPosune: boolean): number =>
    v.obavany === null
      ? 0
      : !poPosune || navrh === null
        ? (s.body?.spaky[v.obavany] ?? strachNaVyplatu(elder, v.obavany))
        : strachNaVyplatu(sPosunutymMarkerom(elder, navrh.na), v.obavany);
  const strachTeraz = riadokStrachu(teraz.obavany === null ? null : mena[teraz.obavany], teraz.obavany === ja, spaky(teraz, false));
  const strachPo = riadokStrachu(zobraz.obavany === null ? null : mena[zobraz.obavany], zobraz.obavany === ja, spaky(zobraz, true));
  const kam = (smer: "ja" | "su"): string => (smer === "ja" ? "k tebe" : `k ${mena[su]}`);
  const zona = (m: MarkerPos): string => NAZVY_ZON[STUPNICA_ZONY[m]] ?? "";

  const sipka = (smer: "ja" | "su"): ReactNode => {
    const x = r.sipky[smer];
    if (x === undefined) return <span className={`ls-sip ${smer} bez-smeru`} aria-hidden="true" />;
    const cena = x.aktivna ? navrh?.cena : x.posun?.cena;
    const ok = x.aktivna || x.posun !== null;
    const popis = x.aktivna
      ? `${s.meno}: zrušiť posun ${kam(smer)}`
      : x.posun !== null
        ? `${s.meno} ${kam(smer)}: na ${zona(x.posun.na)}, stojí ${x.posun.cena}`
        : `${s.meno}: ${kam(smer)} sa teraz nedá`;
    const znak = x.aktivna ? "↶" : smer === "ja" ? "◀" : "▶";
    const suma = cena === undefined ? null : <small>−{cena}</small>;
    return (
      <button type="button" className={`ls-sip ${smer}${x.aktivna ? " aktivna" : ""}`} disabled={!ok} aria-pressed={x.aktivna} aria-label={popis} title={popis} onClick={x.klik}>
        {smer === "ja" ? (
          <>
            {znak}
            {suma}
          </>
        ) : (
          <>
            {suma}
            {znak}
          </>
        )}
      </button>
    );
  };

  return (
    <div
      className={`ls-sc rozdel${navrh !== null ? " s-posunom" : ""}${r.mrtvy ? " mrtvy" : ""}${zmeneny ? " zmena" : ""}`}
      data-vyucba={`starsi:${elder.elderId}`}
      role="group"
      aria-label={`${s.meno}: ${strachPo}${navrh !== null ? ` — posun na ${zona(navrh.na)} za ${navrh.cena}` : ""}`}
    >
      <b className="ls-meno ls-meno-stred">{s.meno}</b>
      <div className="ls-telo">
        <span className="ls-portret">
          {s.obrazok !== null ? <img src={s.obrazok} alt="" draggable={false} /> : <span className="ls-portret-prazdny" />}
          {teraz.uroven === 3 && (
            <span className={`ls-peciatka ${teraz.obavany === ja ? "moja" : "superova"}`} role="img" aria-label={`vydesený — bojí sa ${teraz.obavany === ja ? "teba" : mena[teraz.obavany ?? su]}`}>
              <VykricnikyPeciatky />
            </span>
          )}
          {s.patron !== null && (
            <span className="ls-patron">
              {s.patron.kto === ja ? "v tvojej ruke" : `v ruke: ${mena[s.patron.kto]}`} · {s.patron.kto === ja ? "súper" : "ty"} +{s.patron.pohorsenia} Pohoršenia
            </span>
          )}
          {navrh !== null && <span className="ls-cena-navrhu">−{navrh.cena}</span>}
          <PecatPriazne elder={elder} meno={s.meno} data={data} ja={ja} mena={mena} na={navrh?.na ?? null} strach={{ teraz: strachTeraz, po: strachPo }} />
        </span>
      </div>
      <StupnicaRozdelenia r={r} marker={elder.marker} priazen={teraz.priazen === null ? null : teraz.priazen === ja ? "ja" : "su"} ja={ja} meno={s.meno} />
      <span className="ls-sipky">
        {sipka("ja")}
        {sipka("su")}
      </span>
    </div>
  );
}

/** Plochá stupnica pri rozdeľovaní: 7 polí, cena až po pole, cieľ šípky orámovaný a klikateľný. */
function StupnicaRozdelenia({
  r,
  marker,
  priazen,
  ja,
  meno,
}: {
  readonly r: RozdelenieStarsieho;
  readonly marker: MarkerPos;
  readonly priazen: "ja" | "su" | null;
  readonly ja: PlayerId;
  readonly meno: string;
}) {
  // Zrkadlenie: tvoja polovica vľavo — zobrazené pole k leží na pozícii poloha(k).
  const poloha = (k: number): MarkerPos => (ja === 0 ? k : 6 - k) as MarkerPos;
  const ciele = new Map<number, SipkaRozdelenia>();
  for (const x of [r.sipky.ja, r.sipky.su]) if (x !== undefined && !x.aktivna && x.posun !== null) ciele.set(x.posun.na, x);
  return (
    <span className="ls-stupnica-r" data-vyucba="starsi-stupnica">
      {STUPNICA_ZONY.map((_, k) => {
        const pos = poloha(k);
        const z = STUPNICA_ZONY[pos] ?? 0;
        const c = r.ceny[pos] ?? null;
        const ciel = ciele.get(pos);
        const trieda = `lsr-pole z${z}${c === null ? "" : c.dosah ? " dosah" : " mimo"}${ciel !== undefined ? " ciel" : ""}`;
        const vnutro = (
          <>
            {c !== null && c.dosah && <i className="lsr-cena">{c.cena}</i>}
            {pos === marker && <b className={`lsr-mk${priazen === null ? "" : ` ${priazen}`}${r.navrh !== null ? " stare" : ""}`} />}
            {r.navrh !== null && pos === r.navrh.na && <b className="lsr-mk duch" />}
          </>
        );
        const styl = { background: farbaZony(z), "--z": z } as CSSProperties;
        return ciel === undefined ? (
          <span key={k} className={trieda} style={styl}>
            {vnutro}
          </span>
        ) : (
          <button key={k} type="button" className={trieda} style={styl} aria-label={`${meno}: na ${NAZVY_ZON[z] ?? ""}, stojí ${ciel.posun?.cena ?? 0}`} onClick={ciel.klik}>
            {vnutro}
          </button>
        );
      })}
    </span>
  );
}

/**
 * Pečať priazne na portréte (mock C): ikona akcie a sila vo farbe toho, komu priazeň patrí;
 * v strede sivý prerušovaný obrys bez čísla. Pri nepotvrdenom posune nová pečať, preškrtnutá
 * stará hodnota a ▲ / ▼ / ⇄. Myš, ťuk či fokus otvorí popis; Esc ho zavrie.
 */
function PecatPriazne({
  elder,
  meno,
  data,
  ja,
  mena,
  na,
  strach,
}: {
  readonly elder: ElderState;
  readonly meno: string;
  readonly data: GameData;
  readonly ja: PlayerId;
  readonly mena: readonly [string, string];
  readonly na: MarkerPos | null;
  /** Koho sa starší bojí teraz a po posune (riadok strachu, pod kartou už nie je). */
  readonly strach: { readonly teraz: string; readonly po: string };
}) {
  const fav = favourStarsieho(data, elder);
  const a = vztah(elder, elder.marker);
  const b = na === null || na === elder.marker ? null : vztah(elder, na);
  const p = b ?? a;
  const zmena = b === null ? null : zmenaPriazne(a, b, ja);
  const trieda = (v: Vztah): string => (v.priazen === null ? "nikto" : v.priazen === ja ? "ja" : "su");
  const kto = (v: Vztah): ReactNode => (v.priazen === null ? "nikto" : <span className={`kto-${trieda(v)}`}>{v.priazen === ja ? "ty" : mena[v.priazen]}</span>);
  const [poloha, setPoloha] = useState<{ readonly x: number; readonly y: number; readonly hore: boolean } | null>(null);
  const ref = useRef<HTMLButtonElement>(null);
  const otvor = (): void => {
    const el = ref.current;
    if (el === null) return;
    const rect = el.getBoundingClientRect();
    const hore = rect.top > 170;
    setPoloha({ x: Math.min(Math.max(rect.left + rect.width / 2, 130), window.innerWidth - 130), y: hore ? rect.top - 8 : rect.bottom + 8, hore });
  };
  useEffect(() => {
    if (poloha === null) return;
    const klaves = (e: KeyboardEvent): void => {
      if (e.key !== "Escape") return;
      // Esc zavrie len popis — nepotvrdené posuny ostanú (Reset by ich inak zahodil).
      e.preventDefault();
      e.stopImmediatePropagation();
      setPoloha(null);
    };
    window.addEventListener("keydown", klaves, true);
    return () => window.removeEventListener("keydown", klaves, true);
  }, [poloha]);
  const ikona = IKONY[IKONA_PRIAZNE[fav]];
  const nazov = scorecardStarsieho(data, elder).nazov;
  const popis = `${meno}: priazeň ${nazov} ${p.priazen === null ? "nikto" : `+${p.sila} ${p.priazen === ja ? "ty" : mena[p.priazen]}`}`;
  return (
    <span className="ls-pecat-pr">
      <button
        ref={ref}
        type="button"
        className={`ls-pecat ${trieda(p)}`}
        aria-label={popis}
        aria-expanded={poloha !== null}
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse") otvor();
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") setPoloha(null);
        }}
        onFocus={(e) => {
          if (e.currentTarget.matches(":focus-visible")) otvor();
        }}
        onBlur={() => setPoloha(null)}
        onClick={() => (poloha === null ? otvor() : setPoloha(null))}
      >
        <svg className="ls-pecat-ikona" viewBox="0 0 100 100" aria-hidden="true">
          {ikona.map((c, i) => (
            <path key={i} d={c.d} fillRule={c.evenOdd ? "evenodd" : "nonzero"} />
          ))}
        </svg>
        {p.priazen !== null && <span>+{p.sila}</span>}
      </button>
      {zmena !== null && <span className={`ls-pecat-zmena ${zmena.trieda}`}>{zmena.znak}</span>}
      {b !== null && a.priazen !== null && <s className="ls-pecat-bolo">+{a.sila}</s>}
      {poloha !== null &&
        createPortal(
          <span className={`ls-pecat-tip${poloha.hore ? " hore" : ""}`} role="tooltip" style={{ left: poloha.x, top: poloha.y }}>
            <b>
              {meno} · {nazov}
              {a.priazen !== null ? ` +${a.sila}` : ""}
            </b>
            <br />
            {a.priazen === null ? (
              `nikomu — v strede nedáva nič (pri +1: ${UCINOK_PRIAZNE[fav](1)})`
            ) : (
              <>
                {kto(a)}: {UCINOK_PRIAZNE[fav](a.sila)}
              </>
            )}
            <span className="strach">{strach.teraz}</span>
            {b !== null && (
              <span className="po">
                po posune: {kto(b)}
                {b.priazen !== null ? ` +${b.sila}` : ""}
                {strach.po !== strach.teraz && (
                  <>
                    <br />
                    {strach.po}
                  </>
                )}
              </span>
            )}
          </span>,
          document.body,
        )}
    </span>
  );
}

/**
 * Štítok posunu na portréte (návrh stupnica-posun B): len zdroj a počet — kto posúval,
 * nesie farba; dôsledok je v riadkoch pod stupnicou, celé znenie v lupe.
 */
function StitokPosunu({ stopa, ja }: { readonly stopa: StopaStarsieho; readonly ja: PlayerId }) {
  const kto = new Set(stopa.zdroje.map((x) => x.kto));
  const farba = kto.size !== 1 ? "" : kto.has(ja) ? " moje" : " superove";
  return <span className={`ls-listok${farba}`}>⇄ {stitokStopy(stopa.zdroje)}</span>;
}

/** Schodová stupnica: výška segmentu = úroveň zóny, marker je tmavý disk s prstencom priazne. */
function Stupnica({
  marker,
  ciel,
  stopa,
  priazen,
  hranice,
}: {
  readonly marker: number;
  readonly ciel: number | null;
  /** Kde marker stál pred posunmi od poslednej bitky (duch stopy). */
  readonly stopa: number | null;
  readonly priazen: "ja" | "su" | null;
  readonly hranice: boolean;
}) {
  return (
    <span className="ls-stupnica" aria-hidden="true" data-vyucba="starsi-stupnica">
      {/* 7 polí (v6): červená, oranžová, žltá, sivá, žltá, oranžová, červená — číslo = sila priazne aj špaky za strach. */}
      {STUPNICA_ZONY.map((z, k) => (
        <i key={k} style={{ background: farbaZony(z), "--z": z } as CSSProperties}>
          <small>{z}</small>
        </i>
      ))}
      {stopa !== null && (
        <>
          <u className="ls-stopa" style={{ "--od": Math.min(stopa, marker), "--do": Math.max(stopa, marker) } as CSSProperties} />
          <b className="ls-marker stopa" style={{ "--p": stopa } as CSSProperties} />
        </>
      )}
      <b className={`ls-marker${priazen === null ? "" : ` ${priazen}`}`} style={{ "--p": marker } as CSSProperties} />
      {ciel !== null && ciel !== marker && <b className="ls-marker duch" style={{ "--p": ciel } as CSSProperties} />}
    </span>
  );
}

/**
 * Účinok priazne staršieho — vždy, aj keď priazeň nemá nikto (Michal 2026-10-23:
 * hráč má vidieť, koho sa oplatí desiť). Bez priazne pri sile 1 (prvá zóna).
 */
export function ucinokPriazne(data: GameData, elder: ElderState): { readonly kratko: string; readonly cely: string } {
  const fav = favourStarsieho(data, elder);
  const sila = priazenSila(elder);
  const pri = sila > 0 ? sila : 1;
  return {
    kratko: `${sila > 0 ? "" : "pri +1: "}${UCINOK_KRATKO[fav](pri)}`,
    cely: `${sila > 0 ? `Priazeň +${sila}` : "Priazeň (zatiaľ nikoho), pri +1"}: ${UCINOK_PRIAZNE[fav](pri)}`,
  };
}

/**
 * Lupa staršieho (Michal 2026-10-23, zúžená 2026-10-28): len to, čo na karte v línii nie je —
 * karta s akciami, plné znenie priazne, pravidlo strachu, čo prinesie vydesenie a odkiaľ
 * sa marker od bitky pohol. Stupnicu, komu priazeň a koho sa bojí ukazuje karta v línii.
 */
export function LupaStarsieho({
  s,
  data,
  ja,
  mena,
  sirka,
  karta,
}: {
  readonly s: StarsiVLinii;
  readonly data: GameData;
  readonly ikony: readonly IkonaBodovania[];
  readonly ja: PlayerId;
  readonly mena: readonly [string, string];
  readonly sirka: number;
  /** Karta staršieho s akciami (HernaKarta) v šírke ≈ 26 % lupy — výška ako text vedľa nej. */
  readonly karta: ReactNode;
}) {
  const { elder } = s;
  const sc = scorecardStarsieho(data, elder);
  const fav = favourStarsieho(data, elder);
  const sila = priazenSila(elder);
  const kto = (p: PlayerId): string => (p === ja ? "ty" : mena[p]);
  const stopa = s.stopa;
  return (
    <div className="lupa-starsieho" style={{ width: sirka }}>
      <div className="lst-vrch">
        <div className="lst-karta">{karta}</div>
        <div className="lst-info">
          <div className="lst-hlava">
            <b>{s.meno}</b> <span className="lst-tlmene">· {sc.nazov}</span>
          </div>
          <p className="lst-priazen">
            <b>♥ Priazeň{sila > 0 ? ` +${sila}` : ""}:</b> {plnaPriazen(fav, sila)}
          </p>
          <p className="lst-vydesenie">{textVydesenia(fav)}</p>
          {stopa !== undefined && (
            <p className="lst-stopa">
              <b>Od bitky:</b> {textStopy(stopa.zdroje, kto)}
              {stopa.z === elder.marker ? " — marker je späť, kde bol." : ` (${textStupna(STUPNICA_ZONY[stopa.z])} → ${textStupna(STUPNICA_ZONY[elder.marker])}).`}
            </p>
          )}
          <p className="lst-tlmene">{PRAVIDLO_STRACHU}</p>
        </div>
      </div>
    </div>
  );
}
