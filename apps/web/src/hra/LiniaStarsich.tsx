// Línia starších (Michal 2026-10-23, roadmapa #68 + #69 variant A): osem
// scorecardov v rade na mieste línie kariet. Ukáže sa po kliku na Body
// a sama pri krokoch na staršom (Pohoršenie, prebytok, patronát).
// Scorecard je prekreslený v HTML: podmienky po bokoch portrétu, schodová
// stupnica so zrkadlením (tvoja polovica vľavo), priazeň, body a strach.
//
// Popis stupnice a stopa posunu (roadmapa #95, Michal 2026-10-26): pod stupnicou
// strany „◀ ty · súper ▶“ a dva čipy, ktoré nikdy nezmiznú (komu priazeň, koho
// sa bojí); po posune duch na starom mieste a lístok so zdrojom a dôsledkom pre
// oboch; pri Pohoršení a prebytku čipy pri prejdení myšou ukážu stav po posune.
// Pri každom staršom čip „teraz“ s bodmi (#109) — z bodyTeraz, teda z toho istého
// elderScore ako záverečné bodovanie.

import type { CSSProperties, HTMLAttributes, KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import type { BodyStarsieho, ElderState, GameData, PlayerId, Podmienka, PosunMarkera } from "@naex/core";
import {
  NAZVY_ZON,
  STUPNICA_ZONY,
  favourStarsieho,
  obavanyHrac,
  podmienkyStarsieho,
  prekraciaHranicu,
  priazenHraca,
  priazenSila,
  scorecardStarsieho,
  strachZ,
  type MarkerPos,
} from "@naex/core";
import type { IkonaBodovania } from "@naex/tvorba";
import { FARBY_STUPNICE } from "@naex/tvorba";
import { IkonaPodmienky } from "../karta/IkonaPodmienky.tsx";
import { NAZOV_PODMIENKY } from "../karta/podmienky.ts";
import { KRATKO_PODMIENKA } from "./BodovyBar.tsx";
import { ZA_CO, kohoBoduje, subojeStarsieho } from "./bodyPodmienok.tsx";
import { UCINOK_KRATKO, UCINOK_PRIAZNE, znamienko } from "./Scorecard.tsx";

/** Jeden smer posunu markera v kroku (Pohoršenie v5: k súperovi alebo k sebe). */
export interface VolbaPosunu {
  /** Ku komu marker pôjde: „ja“ = k sebe, „su“ = k súperovi. */
  readonly smer: "ja" | "su";
  readonly nazov: string;
  /** Celý náhľad posunu do hlavičky línie. */
  readonly akcia: string;
  readonly ciel: MarkerPos;
  readonly klik: () => void;
}

/** Posuny jedného staršieho od poslednej bitky (do konca Zhromaždenia) — duch a lístok. */
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

const NAZOV_ZDROJA: Readonly<Record<PosunMarkera["zdroj"], string>> = {
  pohorsenie: "Pohoršenie",
  prebytok: "Prebytok",
  patronat: "Patronát",
};

/** Jeden starší v línii — dáta pripraví HernaPlocha. */
export interface StarsiVLinii {
  readonly elder: ElderState;
  readonly meno: string;
  /** Ilustrácia karty staršieho (portrét). */
  readonly obrazok: string | null;
  readonly body: BodyStarsieho | undefined;
  /** Klik v kroku (Pohoršenie, prebytok, patronát) a čo urobí. */
  readonly klik?: { readonly akcia: string; readonly klik: () => void } | undefined;
  /** Pohoršenie (v5): povolené smery posunu — namiesto kliku na celý scorecard. */
  readonly volby?: readonly VolbaPosunu[] | undefined;
  /** Kam by sa marker posunul (duch markera pri prejdení myšou). */
  readonly ciel?: MarkerPos | null | undefined;
  /** Prečo sa v kroku nedá kliknúť (zamknutý starší). */
  readonly dovod?: string | undefined;
  /** Prejdené hranice zón v tejto bitke — ukazujú sa pri Pohoršení. */
  readonly hranice?: number | undefined;
  readonly patron: { readonly kto: PlayerId; readonly pohorsenia: number } | null;
  /** Vybraný v patronáte (čaká sa na kartu z ruky). */
  readonly vybrany?: boolean;
  /** Posuny od poslednej bitky — duch na starom mieste a lístok so zdrojom. */
  readonly stopa?: StopaStarsieho | undefined;
}

export interface LiniaStarsichProps {
  readonly starsi: readonly StarsiVLinii[];
  readonly data: GameData;
  readonly ikony: readonly IkonaBodovania[];
  readonly ja: PlayerId;
  /** Čie čísla sú zvýraznené — po kliku na súperove Body súperove. */
  readonly pohlad: PlayerId;
  readonly mena: readonly [string, string];
  readonly vydeseni: readonly [number, number];
  readonly prahVydesenia: number;
  readonly spolu: readonly [number, number];
  /** Krok na staršom, ktorý línia práve ukazuje (Pohoršenie…) — inak null. */
  readonly krok: string | null;
  /** Pri Pohoršení svietia hranice zón (§9.2: najviac 2 na marker). */
  readonly hraniceZon: boolean;
  /** Starší, ktorých posun sa práve zmenil (blikne po kroku). */
  readonly zmenene: ReadonlySet<string>;
  /** Tlačidlo vľavo v hlavičke: späť na stôl, nahliadnuť, ďalej. */
  readonly tlacidlo?: ReactNode;
  /** Podmienka z bodového baru pod myšou — svietia starší, u ktorých boduje (Michal 2026-10-23). */
  readonly zvyraznena?: Podmienka | null;
  /** Lupa staršieho (prejdenie myšou, ťuk) — udalosti a data-lupa z HernaPlocha. */
  readonly lupa?: ((s: StarsiVLinii) => HTMLAttributes<HTMLElement>) | undefined;
  /** Prebytok v mojom kroku: koľko zostáva a koľko stojí posun (Miňištrant) — náhľad počtu posunov. */
  readonly prebytok?: { readonly zostava: number; readonly cena: number } | undefined;
}

/** Vzťah staršieho k hráčom pri danej polohe markera. */
function vztah(elder: ElderState, marker: MarkerPos) {
  const e = marker === elder.marker ? elder : { ...elder, marker };
  return { priazen: priazenHraca(e), sila: priazenSila(e), obavany: obavanyHrac(e), uroven: STUPNICA_ZONY[marker] };
}

/** Farebný štvorček zóny (farby stupnice sú pevné, ako na tlačenom scorecarde). */
function ZnackaZony({ uroven }: { readonly uroven: number }) {
  return <i className="ls-znacka" style={{ background: FARBY_STUPNICE[3 - uroven] }} aria-hidden="true" />;
}

export function LiniaStarsich({
  starsi,
  data,
  ikony,
  ja,
  pohlad,
  mena,
  vydeseni,
  prahVydesenia,
  spolu,
  krok,
  hraniceZon,
  zmenene,
  tlacidlo,
  zvyraznena = null,
  lupa,
  prebytok,
}: LiniaStarsichProps) {
  const su: PlayerId = ja === 0 ? 1 : 0;
  // Náhľad posunu v hlavičke — celý text, dlaždica sa neoreže (UI U3).
  const [nahlad, setNahlad] = useState<{ readonly elderId: string; readonly smer: "ja" | "su" | null } | null>(null);
  const [legenda, setLegenda] = useState(false);
  const nahladovany = starsi.find((s) => s.elder.elderId === nahlad?.elderId);
  const akciaNahladu = nahladovany?.volby?.find((v) => v.smer === nahlad?.smer)?.akcia ?? nahladovany?.klik?.akcia;
  const priazne = (p: PlayerId): string =>
    starsi
      .filter((s) => priazenHraca(s.elder) === p)
      .map((s) => `${scorecardStarsieho(data, s.elder).nazov} +${priazenSila(s.elder)}`)
      .join(" · ") || "žiadna";
  const kto = (p: PlayerId): string => (p === ja ? "ty" : mena[p]);
  const posunov = prebytok === undefined || prebytok.cena <= 0 ? null : Math.floor(prebytok.zostava / prebytok.cena);

  const stred =
    krok !== null ? (
      <span className="ls-nahlad" aria-live="polite">
        {nahladovany !== undefined && akciaNahladu !== undefined ? (
          <>
            <b>{nahladovany.meno}</b>
            {" — "}
            {akciaNahladu}
          </>
        ) : (
          <span className="ls-tlmene">
            {starsi.some((s) => s.volby !== undefined)
              ? "Pri staršom vyber smer: k súperovi, alebo k sebe — priazeň sa zmení hneď a platí už v tejto bitke."
              : posunov !== null && prebytok !== undefined && prebytok.cena > 1
                ? `Prebytok ${prebytok.zostava}, posun stojí ${prebytok.cena} (Miňištrant) — vystačí na ${posunov} ${posunov === 1 ? "posun" : posunov < 5 ? "posuny" : "posunov"}. Prejdi myšou na staršieho.`
                : "Prejdi myšou alebo Tabom na staršieho — čipy pod stupnicou ukážu stav po posune."}
          </span>
        )}
      </span>
    ) : (
      <span className="ls-suhrn">
        vydesení <b className="moje">ty {vydeseni[ja]}/{prahVydesenia}</b> · <b className="superove">{mena[su]} {vydeseni[su]}/{prahVydesenia}</b>
        <span className="ls-oddel" aria-hidden="true">·</span>
        body <b className="moje">ty {znamienko(spolu[ja])}</b> · <b className="superove">{mena[su]} {znamienko(spolu[su])}</b>
      </span>
    );

  return (
    <div className={`linia-starsich${pohlad === su ? " pohlad-su" : ""}${krok !== null ? " v-kroku" : ""}${zvyraznena !== null ? " so-zvyraznenim" : ""}`}>
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
        <span className="ls-priazne moje">
          <b>♥ tvoje:</b> {priazne(ja)}
        </span>
        {stred}
        <span className="ls-priazne superove">
          <b>♥ {mena[su]}:</b> {priazne(su)}
        </span>
      </div>
      {legenda && <LegendaStupnice starsi={starsi} data={data} ja={ja} mena={mena} zavri={() => setLegenda(false)} />}
      <div className="ls-rad">
        {starsi.map((s, i) => (
          <ScorecardVLinii
            key={s.elder.elderId}
            s={s}
            poradie={i + 1}
            data={data}
            ikony={ikony}
            ja={ja}
            pohlad={pohlad}
            mena={mena}
            krok={krok}
            hraniceZon={hraniceZon}
            zmeneny={zmenene.has(s.elder.elderId)}
            nahlad={nahlad?.elderId === s.elder.elderId ? nahlad.smer : undefined}
            onNahlad={(n, smer = null) => setNahlad(n ? { elderId: s.elder.elderId, smer } : (x) => (x?.elderId === s.elder.elderId ? null : x))}
            kto={kto}
            zvyraznena={zvyraznena}
            lupa={lupa?.(s)}
            posunov={posunov}
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
    prikladText = "Teraz sú všetci starší v strede (Neutralita): nikto nemá ich priazeň a nikoho sa neboja.";
  } else {
    const v = vztah(priklad.elder, priklad.elder.marker);
    const fav = favourStarsieho(data, priklad.elder);
    const ty = v.obavany === ja;
    prikladText = (
      <>
        <b>Teraz:</b> {priklad.meno} je v zóne {NAZVY_ZON[v.uroven]} na {ty ? `strane ${mena[su]}` : "tvojej strane"}. {ty ? `Priazeň +${v.sila} má ${mena[su]}` : `Priazeň +${v.sila} máš ty`} (
        {UCINOK_KRATKO[fav](v.sila)}). Bojí sa {ty ? "teba" : mena[su]}: keď {ty ? "vyhráš" : `${mena[su]} vyhrá`} pri
        tomto staršom viac súbojov, {ty ? "dostaneš" : "dostane"} 1 + {v.uroven} = {1 + v.uroven} b.
      </>
    );
  }
  return (
    <div className="ls-legenda" id="ls-legenda" role="dialog" aria-label="Ako čítať stupnicu" ref={ref}>
      <p>
        <b>Tvoja polovica je vždy vľavo</b> (◀ ty), {mena[su]} vpravo. Zóny od stredu: Neutralita, <ZnackaZony uroven={1} /> Znepokojenie,{" "}
        <ZnackaZony uroven={2} /> Strach, <ZnackaZony uroven={3} /> Vydesenie.
      </p>
      <p>
        <b>♥ Priazeň</b> má ten, na koho polovici marker leží — bonus počas hry, sila +1 / +2 / +3 podľa zóny.
      </p>
      <p>
        <b>Bojí sa toho druhého.</b> Kto vyhrá viac súbojov podmienok staršieho, dostane 1 b + 1 za každú zónu strachu, v ktorej sa ho bojí (pri
        rovnosti obaja; s priazňou či v strede 1 b).
      </p>
      <p>{prikladText}</p>
      <p className="ls-tlmene">Posúva ho prebytok po bitke (k súperovi toho, kto ho drží) a Pohoršenie (o krok k súperovi alebo k sebe).</p>
      <button type="button" className="ls-tlacidlo" onClick={zavri}>
        Rozumiem <kbd>Esc</kbd>
      </button>
    </div>
  );
}

function ScorecardVLinii({
  s,
  poradie,
  data,
  ikony,
  ja,
  pohlad,
  mena,
  krok,
  hraniceZon,
  zmeneny,
  nahlad,
  onNahlad,
  kto,
  zvyraznena,
  lupa,
  posunov,
}: {
  readonly s: StarsiVLinii;
  readonly poradie: number;
  readonly data: GameData;
  readonly ikony: readonly IkonaBodovania[];
  readonly ja: PlayerId;
  readonly pohlad: PlayerId;
  readonly mena: readonly [string, string];
  readonly krok: string | null;
  readonly hraniceZon: boolean;
  readonly zmeneny: boolean;
  /** Náhľad na tomto staršom: null = celý scorecard, smer = tlačidlo smeru, undefined = žiadny. */
  readonly nahlad: "ja" | "su" | null | undefined;
  readonly onNahlad: (n: boolean, smer?: "ja" | "su" | null) => void;
  readonly kto: (p: PlayerId) => string;
  readonly zvyraznena: Podmienka | null;
  readonly lupa: HTMLAttributes<HTMLElement> | undefined;
  /** Na koľko posunov ešte prebytok vystačí (Miňištrant), mimo prebytku null. */
  readonly posunov: number | null;
}) {
  const { elder, body, klik, volby } = s;
  const su: PlayerId = ja === 0 ? 1 : 0;
  const sc = scorecardStarsieho(data, elder);
  const fav = favourStarsieho(data, elder);
  const podmienky = podmienkyStarsieho(data, elder);
  // Zrkadlenie (Michal 2026-10-22, #55): každý vidí svoju polovicu stupnice vľavo.
  const poloha = (m: number): number => (ja === 0 ? m : 8 - m);
  // Súboj podmienky (v5): kto ju pri tomto staršom vyhráva — odznak z pohľadu zvýrazneného hráča.
  const suboje = body === undefined ? [] : subojeStarsieho(body);
  const subojNa = (strana: "lava" | "prava", index: number) => suboje.find((x) => x.strana === strana && x.index === index);
  const ina: PlayerId = pohlad === 0 ? 1 : 0;
  const koho = (p: PlayerId): string => (p === ja ? "teba" : mena[p]);

  const strana = (str: "lava" | "prava"): ReactNode =>
    podmienky
      .filter((p) => p.strana === str)
      .map((p) => {
        const x = subojNa(str, p.index);
        const vysledok = x === undefined ? "" : x.vitaz === null ? "rovnosť, nevyhrá nikto" : `vyhráva ${kto(x.vitaz)}`;
        return (
          <span
            key={p.index}
            className={`ls-podmienka${p.aktivna ? " aktivna" : ""}${p.aktivna && p.podmienka === zvyraznena ? " zvyraznena" : ""}`}
            title={`${NAZOV_PODMIENKY[p.podmienka]} — ${p.aktivna ? `súboj${x !== undefined ? `: ${kto(ja)} ${x.hodnoty[ja]} · ${kto(su)} ${x.hodnoty[su]} → ${vysledok}` : ""}. ${ZA_CO[p.podmienka]}` : "neaktívna, karta staršieho tu nemá akciu"}`}
          >
            <IkonaPodmienky podmienka={p.podmienka} ikony={ikony} />
            {p.aktivna && x !== undefined && (
              <span className={`ls-odznak ${x.vitaz === pohlad ? "plus" : x.vitaz === ina ? "minus" : "nula"}`}>
                {x.vitaz === pohlad ? "✓" : x.vitaz === ina ? "✗" : "="}
              </span>
            )}
          </span>
        );
      });

  const krokTrieda =
    krok === null ? "" : s.vybrany === true ? " vybrany" : klik !== undefined || volby !== undefined ? ` klik${nahlad !== undefined ? " nahl" : ""}${volby !== undefined ? " smery" : ""}` : " nedost";
  const ciel =
    volby !== undefined ? (volby.find((v) => v.smer === nahlad)?.ciel ?? null) : nahlad !== undefined || s.vybrany === true ? (s.ciel ?? null) : null;
  // Náhľad pred posunom (návrh stupnica-posun C): čipy ukážu stav po posune.
  const poPosune = ciel !== null && ciel !== elder.marker ? ciel : null;
  const teraz = vztah(elder, elder.marker);
  const zobraz = poPosune === null ? teraz : vztah(elder, poPosune);
  const vydeseny = teraz.uroven === 3;
  const zvyrazneny = zvyraznena !== null && podmienky.some((p) => p.aktivna && p.podmienka === zvyraznena);
  const ucinok = ucinokPriazne(data, elder);
  const textPriazne = (v: ReturnType<typeof vztah>): string => (v.priazen === null ? "nikto" : `${kto(v.priazen)} +${v.sila}`);
  const textStrachu = (v: ReturnType<typeof vztah>): string => (v.obavany === null ? "nikoho sa nebojí" : `bojí sa ${koho(v.obavany)} · ${NAZVY_ZON[v.uroven]}`);
  const popisMarkera = `${s.meno}: ${textStrachu(teraz)}, priazeň ${textPriazne(teraz)}`;

  // Body teraz (#109): kto by za staršieho dostal body, keby hra skončila teraz.
  const boduje = body === undefined ? null : kohoBoduje(body);
  const textTeraz =
    body === undefined || boduje === null
      ? null
      : boduje === "obaja"
        ? body.body[ja] === body.body[su]
          ? `obaja ${body.body[ja]} b`
          : `ty ${body.body[ja]} · ${mena[su]} ${body.body[su]} b`
        : `${kto(boduje)} ${body.body[boduje]} b`;

  const stopa = s.stopa;
  const lupaVKroku = krok !== null ? lupaBezKliku(lupa) : undefined;

  return (
    <div
      className={`ls-sc${krokTrieda}${zmeneny ? " zmena" : ""}${zvyrazneny ? " zvyrazneny" : ""}${stopa !== undefined ? " so-stopou" : ""}`}
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
      <div className="ls-sc-hlava" {...lupaVKroku}>
        <b className="ls-meno">{s.meno}</b>
        {body !== undefined && boduje !== null && textTeraz !== null && (
          <span className={`ls-boduje ${boduje === "obaja" ? "obaja" : boduje === ja ? "moje" : "superove"}`} title={vysvetlenieBodov(body, elder, ja, mena).join(" ")}>
            <span className="ls-teraz">teraz: </span>
            <span className="ls-hviezda" aria-hidden="true">
              ★{" "}
            </span>
            {textTeraz}
          </span>
        )}
        <span className="ls-poradie">{poradie}</span>
      </div>
      <div className="ls-telo">
        <span className="ls-podmienky">{strana("lava")}</span>
        <span className="ls-portret">
          {s.obrazok !== null ? <img src={s.obrazok} alt="" draggable={false} /> : <span className="ls-portret-prazdny" />}
          {vydeseny && <span className={`ls-peciatka ${teraz.obavany === ja ? "moja" : "superova"}`}>vydesený</span>}
          {s.patron !== null && (
            <span className="ls-patron">
              {s.patron.kto === ja ? "v tvojej ruke" : `v ruke: ${kto(s.patron.kto)}`} · {s.patron.kto === ja ? "súper" : "ty"} +{s.patron.pohorsenia} Pohoršenia
            </span>
          )}
          {stopa !== undefined && s.patron === null && poPosune === null && <ListokPosunu stopa={stopa} elder={elder} ja={ja} mena={mena} kto={kto} />}
        </span>
        <span className="ls-podmienky">{strana("prava")}</span>
      </div>
      <Stupnica
        marker={poloha(elder.marker)}
        ciel={poPosune === null ? null : poloha(poPosune)}
        stopa={stopa === undefined || stopa.z === elder.marker ? null : poloha(stopa.z)}
        priazen={teraz.priazen === null ? null : teraz.priazen === ja ? "ja" : "su"}
        hranice={hraniceZon}
      />
      <span className="ls-strany" aria-hidden="true">
        <span className="moje">◀ ty</span>
        {hraniceZon && s.hranice !== undefined && (
          <span className="ls-hranice" title="Pohoršenia jedného hráča prenesú marker najviac cez 2 hranice zón.">
            hranice {"●".repeat(Math.min(2, s.hranice))}
            {"○".repeat(Math.max(0, 2 - s.hranice))}
          </span>
        )}
        <span className="superove">{mena[su]} ▶</span>
      </span>
      <span className={`ls-stav${poPosune !== null ? " po-posune" : ""}`}>
        <span className={`ls-cip priazen ${zobraz.priazen === null ? "" : zobraz.priazen === ja ? "moja" : "superova"}`} title={`${sc.nazov}: ${ucinok.cely}`}>
          ♥ {poPosune !== null && textPriazne(teraz) !== textPriazne(zobraz) && <s>{textPriazne(teraz)}</s>} {textPriazne(zobraz)}
          <span className="ls-cip-dlhe"> · {zobraz.sila > 0 ? UCINOK_KRATKO[fav](zobraz.sila) : sc.nazov}</span>
        </span>
        <span className={`ls-cip strach${zobraz.obavany === null ? " nikoho" : zobraz.obavany === ja ? " moj" : " superov"}`} title={textStrachu(zobraz)}>
          {zobraz.uroven > 0 && <ZnackaZony uroven={zobraz.uroven} />}
          {zobraz.obavany === null ? (
            "nikoho sa nebojí"
          ) : (
            <>
              bojí sa {koho(zobraz.obavany)}
              <span className="ls-cip-dlhe">
                {" "}
                · {poPosune !== null && teraz.uroven !== zobraz.uroven && teraz.obavany === zobraz.obavany && <s>{NAZVY_ZON[teraz.uroven]}</s>} {NAZVY_ZON[zobraz.uroven]}
              </span>
            </>
          )}
        </span>
      </span>
      <div className="ls-pata">
        {volby !== undefined ? (
          <span className="ls-smery">
            {(["ja", "su"] as const).map((smer) => {
              const v = volby.find((x) => x.smer === smer);
              const nazov = smer === "ja" ? "◀ k sebe" : "k súperovi ▶";
              return v === undefined ? (
                <button key={smer} type="button" className={`ls-smer ${smer}`} disabled title={smer === "ja" ? "K sebe sa tento marker posunúť nedá." : "K súperovi sa tento marker posunúť nedá."}>
                  {nazov}
                </button>
              ) : (
                <button
                  key={smer}
                  type="button"
                  className={`ls-smer ${smer}${nahlad === smer ? " nahl" : ""}`}
                  aria-label={`${s.meno}: ${v.akcia}`}
                  onClick={v.klik}
                  onMouseEnter={() => onNahlad(true, smer)}
                  onMouseLeave={() => onNahlad(false)}
                  onFocus={() => onNahlad(true, smer)}
                  onBlur={() => onNahlad(false)}
                >
                  {nazov}
                </button>
              );
            })}
          </span>
        ) : s.dovod !== undefined ? (
          <span className="ls-dovod">{s.dovod}</span>
        ) : poPosune !== null && posunov !== null ? (
          <span className="ls-po-posune">
            {posunov <= 1 ? "po posune · prebytok sa minie" : `po posune · prebytok ešte na ${posunov - 1} ${posunov - 1 === 1 ? "posun" : posunov - 1 < 5 ? "posuny" : "posunov"}`}
          </span>
        ) : (
          <span className="ls-body" title="Súboje = vyhraté aktívne podmienky; body za staršieho získa, kto ich vyhrá viac (rovnosť = obaja).">
            <span className={`moje ${triedaBodov(body?.body[ja] ?? 0)}`}>ty {body?.body[ja] ?? 0} b</span>
            <span className="ls-suboje">
              súboje {body?.vyhry[ja] ?? 0}:{body?.vyhry[su] ?? 0}
            </span>
            <span className={`superove ${triedaBodov(body?.body[su] ?? 0)}`}>
              {mena[su]} {body?.body[su] ?? 0} b
            </span>
          </span>
        )}
        <span className="ls-ucinok" title={ucinok.cely}>
          {teraz.priazen === null ? (
            <>
              <b>Priazeň</b> zatiaľ nikto — pri +1: {UCINOK_PRIAZNE[fav](1)}
            </>
          ) : (
            <>
              <b>{teraz.priazen === ja ? "Tvoja" : "Súperova"} priazeň:</b> {UCINOK_PRIAZNE[fav](teraz.sila)}
            </>
          )}
        </span>
      </div>
    </div>
  );
}

const triedaBodov = (b: number): string => (b > 0 ? "plus" : b < 0 ? "minus" : "nula");

/**
 * Lupa počas kroku (UX N4): na celý scorecard sa v kroku kliká a prejdenie myšou
 * ukazuje stav po posune, preto lupu otvorí len hlavička (meno a body) — a ťuk
 * na nej posun nespustí.
 */
function lupaBezKliku(lupa: HTMLAttributes<HTMLElement> | undefined): HTMLAttributes<HTMLElement> | undefined {
  if (lupa === undefined) return undefined;
  const { onClick, tabIndex: _tab, onFocus: _f, onBlur: _b, ...zvysok } = lupa;
  return onClick === undefined
    ? zvysok
    : {
        ...zvysok,
        onClick: (e) => {
          e.stopPropagation();
          onClick(e);
        },
      };
}

/**
 * Lístok posunu na portréte (návrh stupnica-posun B): zdroj posunov od poslednej
 * bitky a čo z nich má ktorý hráč — priazeň hneď, strach (body) na konci.
 */
function ListokPosunu({
  stopa,
  elder,
  ja,
  mena,
  kto,
}: {
  readonly stopa: StopaStarsieho;
  readonly elder: ElderState;
  readonly ja: PlayerId;
  readonly mena: readonly [string, string];
  readonly kto: (p: PlayerId) => string;
}) {
  const su: PlayerId = ja === 0 ? 1 : 0;
  const zdroj = stopa.zdroje.map((x) => `${NAZOV_ZDROJA[x.zdroj]} · ${kto(x.kto)}${x.pocet > 1 ? ` ×${x.pocet}` : ""}`).join(" · ");
  const riadky = ([ja, su] as const).map((p) => ({ p, text: dosledokPosunu(elder, stopa.z, p, p === ja) }));
  const nic = riadky.every((r) => r.text === null);
  return (
    <span className="ls-listok" title={`${zdroj}. ${riadky.map((r) => `${r.p === ja ? "Ty" : mena[r.p]}: ${r.text ?? "bez zmeny"}`).join(". ")}.`}>
      <b>{zdroj}</b>
      {nic ? (
        <span className="ls-listok-riadok">zatiaľ bez účinku · {NAZVY_ZON[STUPNICA_ZONY[elder.marker]]}</span>
      ) : (
        riadky.map((r) => (
          <span key={r.p} className={`ls-listok-riadok ${r.p === ja ? "moje" : "superove"}`}>
            <b>{r.p === ja ? "ty" : mena[r.p]}:</b> {r.text ?? "bez zmeny"}
          </span>
        ))
      )}
    </span>
  );
}

/** Čo posun z `z` na dnešnú polohu dal hráčovi p: priazeň (hneď) a strach (body na konci); null = nič. */
export function dosledokPosunu(elder: ElderState, z: MarkerPos, p: PlayerId, ty = false): string | null {
  const pred = { ...elder, marker: z };
  const priazen = (e: ElderState): number => (priazenHraca(e) === p ? priazenSila(e) : 0);
  const [prPred, prPo] = [priazen(pred), priazen(elder)];
  const [stPred, stPo] = [strachZ(pred, p), strachZ(elder, p)];
  const casti: string[] = [];
  if (prPo !== prPred) casti.push(prPo > 0 ? `♥ +${prPo}${prPred > 0 ? ` (bolo +${prPred})` : " hneď"}` : `♥ preč (bolo +${prPred})`);
  // „budí / budíš strach“ — bez zámena, ktorý by musel poznať rod hráča.
  const budi = ty ? "budíš" : "budí";
  if (stPo !== stPred) casti.push(stPo > 0 ? `${budi} strach: ${NAZVY_ZON[stPo]} → až ${1 + stPo} b` : `už ne${budi} strach (bolo ${NAZVY_ZON[stPred]})`);
  return casti.length === 0 ? null : casti.join(" · ");
}

/**
 * Prečo starší dáva práve tieto body (#109) — súboje a 1 + strach. Čísla sú
 * z BodyStarsieho (bodyTeraz → elderScore), nie z vlastného výpočtu.
 */
export function vysvetlenieBodov(body: BodyStarsieho, elder: ElderState, ja: PlayerId, mena: readonly [string, string]): string[] {
  const su: PlayerId = ja === 0 ? 1 : 0;
  const preco = (p: PlayerId): string => {
    const z = body.strach[p];
    if (z > 0) return `1 + ${z} za strach (${NAZVY_ZON[z]}) = ${1 + z} b`;
    return priazenHraca(elder) === p ? "1 b (priazeň, nie strach)" : "1 b (marker v strede)";
  };
  const vety = [`Súboje ${body.vyhry[ja]} : ${body.vyhry[su]} (ty : ${mena[su]}).`];
  if (body.vyhry[ja] === body.vyhry[su]) {
    vety.push(`Rovnosť — body dostanú obaja: ty ${preco(ja)}, ${mena[su]} ${preco(su)}.`);
  } else {
    const v: PlayerId = body.vyhry[ja] > body.vyhry[su] ? ja : su;
    const p: PlayerId = v === ja ? su : ja;
    vety.push(`${v === ja ? "Viac súbojov vyhrávaš ty" : `Viac súbojov vyhráva ${mena[v]}`} → ${preco(v)}. ${p === ja ? "Ty nedostaneš" : `${mena[p]} nedostane`} nič.`);
  }
  return vety;
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
      {FARBY_STUPNICE.map((f, k) => (
        <i key={k} style={{ background: f, "--z": STUPNICA_ZONY[k] } as CSSProperties} />
      ))}
      {hranice &&
        [1, 2, 3, 6, 7, 8]
          .filter((b) => prekraciaHranicu((b - 1) as MarkerPos, b as MarkerPos))
          .map((b) => <em key={b} style={{ "--b": b } as CSSProperties} />)}
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
 * Lupa staršieho (Michal 2026-10-23): karta staršieho s akciami, stupnica, priazeň,
 * strach a kto priazeň získa pri vydesení; pod tým podmienky 4 + 4 ako na scorecarde
 * (ľavá a pravá strana) s bodmi ty / súper a rozpis, prečo starší dáva práve
 * tieto body (#109). Výška podľa obsahu (Lupa ju zmeria), dlhé znenia sú v titulkoch.
 */
export function LupaStarsieho({
  s,
  data,
  ikony,
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
  const { elder, body } = s;
  const su: PlayerId = ja === 0 ? 1 : 0;
  const sc = scorecardStarsieho(data, elder);
  const fav = favourStarsieho(data, elder);
  const v = vztah(elder, elder.marker);
  const poloha = (m: number): number => (ja === 0 ? m : 8 - m);
  const podmienky = podmienkyStarsieho(data, elder);
  const suboje = body === undefined ? [] : subojeStarsieho(body);
  const kto = (p: PlayerId): string => (p === ja ? "ty" : mena[p]);
  const strana = (str: "lava" | "prava"): ReactNode =>
    podmienky
      .filter((p) => p.strana === str)
      .sort((a, b) => a.index - b.index)
      .map((p) => {
        const x = suboje.find((y) => y.strana === p.strana && y.index === p.index);
        const hodnota = (h: PlayerId): string => (x === undefined ? "0" : `${x.vitaz === h ? "✓" : ""}${x.hodnoty[h]}`);
        return (
          <li
            key={`${p.strana}${p.index}`}
            className={`${p.aktivna ? "aktivna" : ""}${x?.vitaz === ja ? " vyhravam" : x?.vitaz === su ? " prehravam" : ""}`}
            title={`${NAZOV_PODMIENKY[p.podmienka]} — ${p.aktivna ? `súboj ty ${x?.hodnoty[ja] ?? 0} · ${mena[su]} ${x?.hodnoty[su] ?? 0}. ${ZA_CO[p.podmienka]}` : "neaktívna, karta na ukazovateli tu nemá akciu"}`}
          >
            <IkonaPodmienky podmienka={p.podmienka} ikony={ikony} />
            <span className="lst-nazov">{KRATKO_PODMIENKA[p.podmienka]}</span>
            <span className="lst-body">{p.aktivna ? `${hodnota(ja)} : ${hodnota(su)}` : "—"}</span>
          </li>
        );
      });
  // Kto vyhráva ktoré súboje — menovite, aby bolo jasné, odkiaľ je „súboje 2 : 1“.
  const zoznam = (h: PlayerId | null): string =>
    suboje
      .filter((x) => x.vitaz === h)
      .map((x) => `${KRATKO_PODMIENKA[x.podmienka]} ${x.hodnoty[ja]}:${x.hodnoty[su]}`)
      .join(", ");
  const stopa = s.stopa;
  return (
    <div className="lupa-starsieho" style={{ width: sirka }}>
      <div className="lst-vrch">
        <div className="lst-karta">{karta}</div>
        <div className="lst-info">
          <div className="lst-hlava">
            <b>{s.meno}</b> <span className="lst-tlmene">· {sc.nazov}</span>
          </div>
          <Stupnica
            marker={poloha(elder.marker)}
            ciel={null}
            stopa={stopa === undefined || stopa.z === elder.marker ? null : poloha(stopa.z)}
            priazen={v.priazen === null ? null : v.priazen === ja ? "ja" : "su"}
            hranice={false}
          />
          <span className="ls-strany">
            <span className="moje">◀ ty</span>
            <span className="superove">{mena[su]} ▶</span>
          </span>
          <p className={`lst-priazen ${v.priazen === null ? "" : v.priazen === ja ? "moja" : "superova"}`} title={UCINOK_PRIAZNE[fav](v.sila > 0 ? v.sila : 1)}>
            <b>♥ {v.priazen === null ? "nikto" : `${kto(v.priazen)} +${v.sila}`}:</b> {UCINOK_KRATKO[fav](v.sila > 0 ? v.sila : 1)}
            {v.sila === 0 && <span className="lst-tlmene"> (pri +1)</span>}
          </p>
          <p>
            {v.uroven > 0 && <ZnackaZony uroven={v.uroven} />}
            {v.obavany === null ? "Nikoho sa nebojí (Neutralita)." : `Bojí sa ${v.obavany === ja ? "teba" : mena[su]} · ${NAZVY_ZON[v.uroven]}`}
          </p>
          {stopa !== undefined && (
            <p className="lst-stopa">
              <b>Od bitky:</b> {stopa.zdroje.map((x) => `${NAZOV_ZDROJA[x.zdroj]} · ${kto(x.kto)}${x.pocet > 1 ? ` ×${x.pocet}` : ""}`).join(" · ")}
              {stopa.z === elder.marker
                ? " — marker je späť, kde bol."
                : ` — ${NAZVY_ZON[STUPNICA_ZONY[stopa.z]]} → ${NAZVY_ZON[v.uroven]}. Ty: ${dosledokPosunu(elder, stopa.z, ja, true) ?? "bez zmeny"}. ${mena[su]}: ${dosledokPosunu(elder, stopa.z, su) ?? "bez zmeny"}.`}
            </p>
          )}
          <p className="lst-vydesenie" title={`Vydesíš ho ty → priazeň +3 dostane ${mena[su]}: ${UCINOK_PRIAZNE[fav](3)} Vydesí ho ${mena[su]} → dostaneš ju ty.`}>
            <b>Vydesíš</b> → súper +3 ({UCINOK_KRATKO[fav](3)}) · <b>vydesí súper</b> → ty +3
          </p>
        </div>
      </div>
      <div className="lst-podmienky" aria-label={`Súboje podmienok — ty : ${mena[su]}`}>
        <ul>{strana("lava")}</ul>
        <ul>{strana("prava")}</ul>
      </div>
      {body !== undefined && (
        <div className="lst-spolu">
          <p>
            <b>★ Body teraz:</b> {vysvetlenieBodov(body, elder, ja, mena).join(" ")}
          </p>
          {suboje.length > 0 && (
            <p className="lst-tlmene">
              {zoznam(ja) !== "" && <>Ty vyhrávaš: {zoznam(ja)}. </>}
              {zoznam(su) !== "" && (
                <>
                  {mena[su]} vyhráva: {zoznam(su)}.{" "}
                </>
              )}
              {zoznam(null) !== "" && <>Rovnosť: {zoznam(null)}.</>}
            </p>
          )}
          {suboje.length === 0 && <p className="lst-tlmene">Karta na ukazovateli neaktivuje žiadnu podmienku — súboje sú 0 : 0, body dostanú obaja.</p>}
        </div>
      )}
    </div>
  );
}
