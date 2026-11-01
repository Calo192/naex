// Línia starších (Michal 2026-10-23, roadmapa #68 + #69 variant A): osem
// starších v rade na mieste línie kariet. Ukáže sa po kliku na dlaždicu Starší
// a sama pri krokoch na staršom (hádka, Nakladačka, pokus o zajatie).
// Pri staršom je len portrét, priazeň a stupnica 7 polí so zrkadlením (tvoja
// polovica vľavo) — bodovacie podmienky scorecardov v6 nie sú (Michal 2026-10-26:
// „Ostala len priazeň a na tú scorecard netreba“).
//
// Každá informácia na jednom mieste (Michal 2026-10-28: „strašne veľa textu… mouseover
// je redundantný“): pod stupnicou len meno, priazeň tohto kola nesie krúžok na portréte
// (Michal 2026-10-31) a vety o priazni a strachu nápoveda staršieho (KruzokPriazne.tsx).
// Na portréte štítok so zdrojom posunu od bitky, na stupnici duch na starom mieste.
// Texty: textyStarsich.ts.
//
// Rozdelenie hádky a Nakladačky (mock C · Pečať, Michal 2026-10-30): v mojom kroku má
// karta meno na stred, pečať priazne na portréte a plochú stupnicu s cenou na každom
// dosiahnuteľnom poli. Smer je daný pravidlami (hádka k víťazovi §9.1, Nakladačka k súperovi
// držiteľa §9.4), preto tlačidlá smerov (krígeľ, päsť) zmizli (Michal 2026-11-01: „presúva sa
// len jedným smerom“) — ťuk na staršieho výber pridá, ďalší ho vráti; tlačidlo pod stupnicou nesie
// len znamienko, piktogram priazne a číslo (mock 9). Posuny sú nepotvrdené, kým ich Potvrdiť na hrane stola nepošle —
// plán ráta jadro (rozdelenie.ts).
// Pod stupnicou je pravítko posunu (mock 2 B, Michal 2026-10-30): pole po poli,
// kým body stačia, a za čiarou rozpočtu zámok (pravitko.ts).

import type { CSSProperties, HTMLAttributes, KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Action, ElderState, GameData, Klebety, PlayerId, PosunMarkera, SpakyStarsieho } from "@naex/core";
import { NAZVY_ZON, STUPNICA_ZONY, favourStarsieho, obavanyHrac, priazenHraca, priazenSila, sPosunutymMarkerom, strachNaUdrzanie, strachNaVyplatu, type MarkerPos } from "@naex/core";
import { FARBY_STUPNICE } from "@naex/tvorba";
import { IKONY } from "../karta/ikony.ts";
import { UCINOK_KRATKO, UCINOK_PRIAZNE } from "./Scorecard.tsx";
import { VykricnikyPeciatky } from "./IkonaStrachu.tsx";
import { IkonaPriazneKruzku, KruzokPriazne, ListokHadky, ObsahNapovedyStarsieho, spojUdalosti, useNapovedaStarsieho } from "./KruzokPriazne.tsx";
import type { Pravitko } from "./pravitko.ts";
import { dvojityMarker, ktoPriazen, listokHadky, obsahNapovedy, polohaPreHraca, priazenKola, type DvojityMarker, type ListokHadky as ListokHadkyData, type PriazenKola } from "./priazenKola.ts";
import { riadokStrachu, stitokStopy } from "./textyStarsich.ts";

export { IKONA_PRIAZNE } from "./KruzokPriazne.tsx";

/** Výber staršieho pri rozdeľovaní: kam marker (pri hádke priazeň) pôjde a za koľko (null = už nestačí). */
export interface VyberRozdelenia {
  readonly posun: { readonly na: MarkerPos; readonly cena: number } | null;
  /** Starší je už v nepotvrdených posunoch — ťuk ho vráti. */
  readonly aktivna: boolean;
  readonly klik: () => void;
  /** Cesta markera za body, ktoré staršiemu ostali (pravítko pod stupnicou). */
  readonly pravitko: Pravitko;
  /** Smer daný pravidlami: „ja“ = k tebe (hádka vždy), „su“ = k súperovi (Nakladačka, keď ju držíš ty). */
  readonly smer: "ja" | "su";
  /** Ďalej sa nedá — marker na kraji, pri hádke priazeň už tvoja v sile 3. */
  readonly kraj: boolean;
}

/** Starší pri rozdeľovaní hádky či Nakladačky (mock C · Pečať) — dáta z plánu jadra. */
export interface RozdelenieStarsieho {
  /** Výber staršieho v jedinom smere kroku; chýba = krok smer nemá. */
  readonly vyber?: VyberRozdelenia | undefined;
  /** Cena posunu na pole stupnice (pozície 0–6) a či naň rozpočet stačí; null = tam sa nejde. */
  readonly ceny: readonly ({ readonly cena: number; readonly dosah: boolean } | null)[];
  /** Nepotvrdený posun tohto staršieho. */
  readonly navrh: { readonly na: MarkerPos; readonly cena: number } | null;
  /** Zvyšok ho už nikam neposunie — karta je tlmená. */
  readonly mrtvy: boolean;
  /** Krok hádky (v10): posúva sa sila priazne do konca kola, nie marker — iný popis tlačidla. */
  readonly hadka?: boolean;
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
  /** Klik v kroku (pokus o zajatie) a čo urobí — hádku a Nakladačku nesie `rozdelenie`. */
  readonly klik?: { readonly akcia: string; readonly klik: () => void } | undefined;
  /** Prečo sa v kroku nedá kliknúť (zamknutý starší). */
  readonly dovod?: string | undefined;
  /** Pokus o zajatie (v9): kto skúša staršieho zajať — starší je v ohrození, karta v súperovej ruke. */
  readonly patron: { readonly kto: PlayerId } | null;
  /** Vybraný pri pokuse o zajatie (čaká sa na potvrdenie). */
  readonly vybrany?: boolean;
  /** Posuny od poslednej bitky — duch na starom mieste a štítok so zdrojom. */
  readonly stopa?: StopaStarsieho | undefined;
  /** Rozdeľovanie hádky či Nakladačky v mojom kroku. */
  readonly rozdelenie?: RozdelenieStarsieho | undefined;
}

export interface LiniaStarsichProps {
  readonly starsi: readonly StarsiVLinii[];
  readonly data: GameData;
  readonly ja: PlayerId;
  /** Čí pohľad línia ukazuje — po kliku na súperovu dlaždicu Starší súperov. */
  readonly pohlad: PlayerId;
  readonly mena: readonly [string, string];
  /** Klebety, ktoré v kole platia (hádka bitky) — priazeň kola v krúžku, bodke a lístku. */
  readonly klebety?: Klebety | undefined;
  /** Krok na staršom, ktorý línia práve ukazuje (hádka, Nakladačka, pokus o zajatie) — inak null. */
  readonly krok: string | null;
  /** Starší, ktorých posun sa práve zmenil (blikne po kroku). */
  readonly zmenene: ReadonlySet<string>;
  /** Tlačidlo vľavo v hlavičke: späť na stôl, nahliadnuť, ďalej. */
  readonly tlacidlo?: ReactNode;
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

export function LiniaStarsich({ starsi, data, ja, pohlad, mena, klebety, krok, zmenene, tlacidlo }: LiniaStarsichProps) {
  const su: PlayerId = ja === 0 ? 1 : 0;
  // Náhľad posunu v hlavičke — celý text, dlaždica sa neoreže (UI U3).
  const [nahlad, setNahlad] = useState<string | null>(null);
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
          <span className="ls-tlmene">
            {/* Na telefóne myš ani Tab nie sú (playtest mobilu 20261031-191322) — mobil-sirka.css prepne vetu. */}
            <span className="len-mys">Prejdi myšou alebo Tabom na staršieho — nápoveda ukáže, čo klik urobí.</span>
            <span className="len-dotyk">Podrž prst na staršom — ukáže priazeň a strach; ťuk vyberie.</span>
          </span>
        )}
      </span>
    );

  return (
    <div className={`linia-starsich${pohlad === su ? " pohlad-su" : ""}${krok !== null ? " v-kroku" : ""}`}>
      {/* Prázdna hlavička nezaberá riadok — miesto patrí starším (Michal 2026-10-30: bez „← Späť
          na stôl“ a „? stupnica“; ako čítať stupnicu povie titulok na stupnici). */}
      {(tlacidlo != null || stred !== null) && (
        <div className="ls-hlava">
          {tlacidlo}
          {stred}
        </div>
      )}
      <div className="ls-rad">
        {starsi.map((s) => (
          <ScorecardVLinii
            key={s.elder.elderId}
            s={s}
            data={data}
            ja={ja}
            mena={mena}
            klebety={klebety}
            krok={krok}
            zmeneny={zmenene.has(s.elder.elderId)}
            nahlad={nahlad === s.elder.elderId}
            onNahlad={(n) => setNahlad(n ? s.elder.elderId : (x) => (x === s.elder.elderId ? null : x))}
            kto={kto}
          />
        ))}
      </div>
    </div>
  );
}

function ScorecardVLinii({
  s,
  data,
  ja,
  mena,
  klebety,
  krok,
  zmeneny,
  nahlad,
  onNahlad,
  kto,
}: {
  readonly s: StarsiVLinii;
  readonly data: GameData;
  readonly ja: PlayerId;
  readonly mena: readonly [string, string];
  readonly klebety: Klebety | undefined;
  readonly krok: string | null;
  readonly zmeneny: boolean;
  /** Myš či fokus je na tomto staršom — v kroku ho zvýrazní a hlavička povie, čo klik urobí. */
  readonly nahlad: boolean;
  readonly onNahlad: (n: boolean) => void;
  readonly kto: (p: PlayerId) => string;
}) {
  const su: PlayerId = ja === 0 ? 1 : 0;
  const { elder, body, klik } = s;
  const fav = favourStarsieho(data, elder);
  const koho = (p: PlayerId): string => (p === ja ? "teba" : mena[p]);
  const listok = listokHadky(elder.elderId, klebety, ja);
  const napoveda = useNapovedaStarsieho(
    () => {
      const o = obavanyHrac(elder);
      return obsahNapovedy({
        data,
        elder,
        meno: s.meno,
        klebety,
        ja,
        mena,
        spaky: o === null ? 0 : (body?.spaky[o] ?? strachNaVyplatu(elder, o)),
        naUdrzanie: o === null ? 0 : (body?.naUdrzanie[o] ?? strachNaUdrzanie(elder, o)),
        akcia: klik?.akcia ?? null,
      });
    },
    { menoSupera: mena[su], zvacsenina: () => <ZvacseninaStarsieho s={s} fav={fav} p={priazenKola(elder, klebety, ja)} listok={listok} menoSupera={mena[su]} /> },
  );
  if (s.rozdelenie !== undefined) return <KartaRozdelenia s={s} r={s.rozdelenie} data={data} ja={ja} mena={mena} klebety={klebety} zmeneny={zmeneny} />;

  const krokTrieda =
    krok === null ? "" : s.vybrany === true ? " vybrany" : klik !== undefined ? ` klik${nahlad ? " nahl" : ""}` : " nedost";
  const teraz = vztah(elder, elder.marker);
  const vydeseny = teraz.uroven === 3;
  const pk = priazenKola(elder, klebety, ja);
  const dm = dvojityMarker(elder, klebety, ja);
  const o = teraz.obavany;
  const strachText = riadokStrachu(o === null ? null : mena[o], o === ja, o === null ? 0 : (body?.spaky[o] ?? strachNaVyplatu(elder, o)), o === null ? 0 : (body?.naUdrzanie[o] ?? strachNaUdrzanie(elder, o)));
  const popisMarkera = `${s.meno}: priazeň v tomto kole ${ktoPriazen(pk, { ja: "ty", su: mena[su] })}; ${strachText}`;

  const stopa = s.stopa;
  const pata = s.dovod !== undefined ? <span className="ls-dovod">{s.dovod}</span> : null;

  return (
    <div
      className={`ls-sc${krokTrieda}${zmeneny ? " zmena" : ""}${stopa !== undefined ? " so-stopou" : ""}`}
      data-vyucba={`starsi:${s.elder.elderId}`}
      {...(klik === undefined
        ? spojUdalosti(napoveda.props, { tabIndex: 0, "aria-label": popisMarkera + (s.dovod !== undefined ? ` — ${s.dovod}` : "") })
        : spojUdalosti(napoveda.props, {
            role: "button",
            tabIndex: 0,
            "aria-label": `${popisMarkera} — klikni: ${klik.akcia}`,
            onClick: () => {
              // Ťuk po podržaní prsta otvoril zväčšeninu — hádku ani zajatie nespúšťa.
              if (napoveda.poPodrzani()) return;
              klik.klik();
            },
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
          }))}
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
          <ListokHadky listok={listok} menoSupera={mena[su]} />
          {s.patron !== null && (
            <span className="ls-patron">
              v ohrození · zajať skúša {s.patron.kto === ja ? "ty" : kto(s.patron.kto)} · karta v ruke: {s.patron.kto === ja ? "súper" : "ty"}
            </span>
          )}
          {stopa !== undefined && s.patron === null && <StitokPosunu stopa={stopa} ja={ja} />}
          {/* Krúžok priazne vždy (Michal 2026-10-31): priazeň, ktorá v tomto kole naozaj platí. */}
          <KruzokPriazne fav={fav} p={pk} trieda="ls-kruzok" />
        </span>
      </div>
      <Stupnica
        marker={polohaPreHraca(elder.marker, ja)}
        stopa={stopa === undefined || stopa.z === elder.marker ? null : polohaPreHraca(stopa.z, ja)}
        dm={dm}
        kruzky={napoveda.kruzky(dm.posunute)}
      />
      {/* Pod staršinom len meno (Michal 2026-10-31): priazeň nesie krúžok, vety nápoveda. */}
      <span className="ls-stav" aria-hidden="true">
        <b className="ls-meno">{s.meno}</b>
      </span>
      {pata !== null && <div className="ls-pata">{pata}</div>}
      {napoveda.vrstva}
    </div>
  );
}

/** Zväčšenina staršieho na telefóne (podržanie prsta) — pod ňou je nápoveda. */
function ZvacseninaStarsieho({
  s,
  fav,
  p,
  listok,
  menoSupera,
}: {
  readonly s: StarsiVLinii;
  readonly fav: ReturnType<typeof favourStarsieho>;
  readonly p: PriazenKola;
  readonly listok: ListokHadkyData | null;
  readonly menoSupera: string;
}) {
  return (
    <span className="np-zoom-karta">
      <span className="np-zoom-portret">
        {s.obrazok !== null ? <img src={s.obrazok} alt="" draggable={false} /> : null}
        <ListokHadky listok={listok} menoSupera={menoSupera} />
        <KruzokPriazne fav={fav} p={p} velkost={46} />
      </span>
      <b>{s.meno}</b>
    </span>
  );
}

/**
 * Ikona kroku v bubline a na žetónoch — piktogram akcie: hádka Pohoršenie (mäkké), Nakladačka
 * je prebytok poškodenia, preto Rana (Michal 2026-10-30).
 */
const AKCIA_DELENIA: Readonly<Record<"hadka" | "prebytok", Action>> = { hadka: "Pohoršenie", prebytok: "Rana" };

export function IkonaDelenia({ krok }: { readonly krok: "hadka" | "prebytok" }) {
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
 * a cenou nepotvrdeného posunu, plochá stupnica s cenami, pravítko a tlačidlo výberu.
 */
function KartaRozdelenia({
  s,
  r,
  data,
  ja,
  mena,
  klebety,
  zmeneny,
}: {
  readonly s: StarsiVLinii;
  readonly r: RozdelenieStarsieho;
  readonly data: GameData;
  readonly ja: PlayerId;
  readonly mena: readonly [string, string];
  readonly klebety: Klebety | undefined;
  readonly zmeneny: boolean;
}) {
  const { elder } = s;
  const su: PlayerId = ja === 0 ? 1 : 0;
  // Posun markera hýbe prsteňom a bodka ide s ním o rovnaký kus — rozdiel z hádky ostáva.
  const dm = dvojityMarker(r.navrh === null ? elder : { ...elder, marker: r.navrh.na }, klebety, ja);
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
  const zona = (m: MarkerPos): string => NAZVY_ZON[STUPNICA_ZONY[m]] ?? "";

  const v = r.vyber;
  // Ťuk na kartu (portrét, stupnica, pás) pridá výber alebo ho vráti — pečať priazne má vlastný ťuk (nápoveda).
  const mozno = v !== undefined && (v.aktivna || v.posun !== null);
  const kam = v?.smer === "su" ? `k ${mena[su]}` : "k tebe";
  const popisVyberu =
    v === undefined
      ? `${s.meno}: tu sa teraz nerozdeľuje`
      : v.aktivna
        ? `${s.meno}: vrátiť výber (${navrh?.cena ?? 0} späť do zvyšku)`
        : v.posun === null
          ? v.kraj
            ? r.hadka === true
              ? `${s.meno}: priazeň je už tvoja v sile 3`
              : `${s.meno}: marker je na kraji`
            : `${s.meno}: zvyšok na ďalšie pole nestačí`
          : r.hadka === true
            ? `${s.meno}: pridať bod hádky — priazeň k tebe na silu ${STUPNICA_ZONY[v.posun.na]} (${zona(v.posun.na)}), stojí ${v.posun.cena}; do konca kola, marker stojí`
            : `${s.meno}: posunúť marker ${kam} na ${zona(v.posun.na)}, stojí ${v.posun.cena}`;
  // Tlačidlo bez textu a bez ceny (Michal 2026-11-01, mock 9): znamienko, piktogram priazne ako
  // v krúžku a číslo — „+ Rana 2“ = priazeň po posune patrí tomu, ku komu krok ide, v sile 2;
  // „− Viera 1“ = priazeň druhej strany len klesne o 1. Cena je na stupnici, pravítku a štítku −N.
  const ucinok = v === undefined ? null : ucinokVyberu(elder, klebety, ja, v, navrh, r.hadka === true);
  const pas =
    v === undefined ? null : (
      <>
        {v.aktivna && <span className="ls-vyber-spat">↺</span>}
        {ucinok !== null && <span className="ls-vyber-znak">{ucinok.znak}</span>}
        <IkonaPriazneKruzku fav={favourStarsieho(data, elder)} />
        {ucinok !== null && <span className="ls-vyber-cislo">{ucinok.cislo}</span>}
      </>
    );
  const farbaPasu = ucinok?.znak === "+" && v?.smer === "su" ? " su" : "";

  return (
    <div
      className={`ls-sc rozdel${navrh !== null ? " s-posunom" : ""}${r.mrtvy ? " mrtvy" : ""}${mozno ? " volitelny" : ""}${zmeneny ? " zmena" : ""}`}
      data-vyucba={`starsi:${elder.elderId}`}
      role="group"
      aria-label={`${s.meno}: ${strachPo}${navrh !== null ? ` — posun na ${zona(navrh.na)} za ${navrh.cena}` : ""}`}
      title={mozno ? popisVyberu : undefined}
      onClick={(e) => {
        if (e.target instanceof Element && e.target.closest(".ls-pecat-pr") !== null) return;
        if (mozno) v.klik();
      }}
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
              v ohrození · zajať skúša {s.patron.kto === ja ? "ty" : mena[s.patron.kto]}
            </span>
          )}
          {navrh !== null && <span className="ls-cena-navrhu">−{navrh.cena}</span>}
          <ListokHadky listok={listokHadky(elder.elderId, klebety, ja)} menoSupera={mena[su]} />
          <PecatPriazne
            elder={elder}
            meno={s.meno}
            data={data}
            ja={ja}
            mena={mena}
            klebety={klebety}
            body={s.body}
            na={navrh?.na ?? null}
            strach={{ teraz: strachTeraz, po: strachPo }}
          />
        </span>
      </div>
      <StupnicaRozdelenia r={r} marker={elder.marker} bodka={dm} ja={ja} />
      <PravitkaRozdelenia r={r} meno={s.meno} />
      {/* Klávesnica: pás je tlačidlo (Enter, medzerník); klik z neho prebuble na kartu a urobí výber. */}
      {pas !== null && (
        <button type="button" className={`ls-vyber${farbaPasu}${v?.aktivna === true ? " aktivna" : ""}`} aria-disabled={!mozno} aria-pressed={v?.aktivna === true} aria-label={popisVyberu}>
          {pas}
        </button>
      )}
    </div>
  );
}

/**
 * Čo výber urobí s priazňou (tlačidlo „+/− piktogram číslo“): „+“ = priazeň po posune patrí strane,
 * ku ktorej krok ide (hádka: rozdeľujúci, Nakladačka: súper držiteľa), číslo = jej sila; „−“ =
 * priazeň druhej strany len klesne (aj do stredu), číslo = o koľko. Hádka posúva účinnú priazeň
 * tohto kola (cieľ je jej poloha). Nakladačka je posledný krok kola a posúva marker — sila z hádky
 * do konca kola ostáva pevná, takže sa ráta priazeň z markera, ktorá platí od ďalšieho kola.
 */
export function ucinokVyberu(
  elder: ElderState,
  klebety: Klebety | undefined,
  ja: PlayerId,
  v: Pick<VyberRozdelenia, "posun" | "smer">,
  navrh: { readonly na: MarkerPos } | null,
  hadka: boolean,
): { readonly znak: "+" | "−"; readonly cislo: number } | null {
  const na = navrh?.na ?? v.posun?.na;
  if (na === undefined) return null;
  const pred = priazenKola(elder, hadka ? klebety : undefined, ja);
  const hrac: PlayerId | null = na < 3 ? 0 : na > 3 ? 1 : null;
  const po = hadka ? { komu: hrac === null ? null : hrac === ja ? "ja" : "su", sila: STUPNICA_ZONY[na] ?? 0 } : priazenKola({ ...elder, marker: na }, undefined, ja);
  if (po.komu === v.smer && po.sila > 0) return { znak: "+", cislo: po.sila };
  const pokles = pred.komu !== null && pred.komu !== v.smer ? pred.sila - (po.komu === pred.komu ? po.sila : 0) : 0;
  return pokles > 0 ? { znak: "−", cislo: pokles } : null;
}

/** Pravítko posunu pod stupnicou (mock 2 B) — smer je jeden, preto jedno cez celú šírku. */
function PravitkaRozdelenia({ r, meno }: { readonly r: RozdelenieStarsieho; readonly meno: string }) {
  const v = r.vyber;
  if (v === undefined) return null;
  return (
    <span className="lsp-rad jeden">
      <PravitkoPosunu p={v.pravitko} smer={v.smer} meno={meno} plne />
    </span>
  );
}

/** Zámok za čiarou rozpočtu — pole, na ktoré body už nestačia. */
function IkonaZamku() {
  return (
    <svg className="lsp-zamok" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 10V7a5 5 0 0 1 10 0v3h1.5c.8 0 1.5.7 1.5 1.5v9c0 .8-.7 1.5-1.5 1.5h-13C4.7 22 4 21.3 4 20.5v-9C4 10.7 4.7 10 5.5 10zm2.5 0h5V7a2.5 2.5 0 0 0-5 0z" />
    </svg>
  );
}

/**
 * Jedno pravítko: šírka dielika = cena poľa, farba = zóna, do ktorej marker vojde; svetlá čiara
 * = koľko bodov posun má, za ňou zámok. Pod ním „3 z 5“ (len cez celú šírku) a o koľko polí.
 */
function PravitkoPosunu({ p, smer, meno, plne }: { readonly p: Pravitko; readonly smer: "ja" | "su"; readonly meno: string; readonly plne: boolean }) {
  // Zvyšok je celý rozdaný — zámok s „0 z 0“ by len rušil, karta je aj tak tlmená.
  const rozdane = p.body === 0;
  const zamok = p.dieliky.find((d) => d.zamok);
  // Na kraji stupnice časť rozpočtu ostane — prázdny úsek až po čiaru.
  const volne = zamok === undefined ? p.body - p.cena : 0;
  const spolu = Math.max(p.body, p.cena + (zamok?.cena ?? 0), 1);
  const polia = p.polia === 0 ? (zamok === undefined ? "na kraji" : "nestačí") : `${p.polia} ${p.polia === 1 ? "pole" : p.polia < 5 ? "polia" : "polí"}`;
  const popis = rozdane
    ? `${meno}: zvyšok je rozdaný`
    : p.polia > 0
      ? `${meno}: o ${polia} za ${p.cena} z ${p.body}${zamok === undefined ? ", ďalej je kraj" : `, ďalšie pole stojí ${zamok.cena}`}`
      : zamok === undefined
        ? `${meno}: marker je na kraji`
        : `${meno}: ${p.body} nestačí ani na jedno pole (stojí ${zamok.cena})`;
  return (
    <span className={`lsp ${smer}`} role="img" aria-label={popis} title={popis}>
      <span className="lsp-os">
        <span className="lsp-dieliky">
          {!rozdane &&
            p.dieliky.map((d) => (
              <i key={d.na} className={`lsp-dielik z${d.zona}${d.zamok ? " za" : ""}`} style={{ flexGrow: d.cena, backgroundColor: farbaZony(d.zona) }}>
                {d.zamok ? <IkonaZamku /> : d.cena}
              </i>
            ))}
          {volne > 0 && <i className="lsp-dielik volne" style={{ flexGrow: volne }} />}
        </span>
        {!rozdane && <i className="lsp-ciara" style={{ left: `${((p.body / spolu) * 100).toFixed(2)}%` }} />}
      </span>
      <span className="lsp-rozp">
        {plne && !rozdane && (
          <span className="lsp-body">
            <IkonaDelenia krok="prebytok" />
            {p.cena} z {p.body}
          </span>
        )}
        {/* Bez ◀ ▶ z mocku (Michal 2026-10-30: šípky preč) — smer je daný pravidlami. */}
        <span className="lsp-polia">{rozdane ? "rozdané" : polia}</span>
      </span>
    </span>
  );
}

/** Plochá stupnica pri rozdeľovaní: 7 polí, cena až po pole, cieľ výberu orámovaný (ťuk berie celá karta). */
function StupnicaRozdelenia({
  r,
  marker,
  bodka,
  ja,
}: {
  readonly r: RozdelenieStarsieho;
  readonly marker: MarkerPos;
  /** Prsteň (marker) a bodka (priazeň tohto kola) — bodka ide s nepotvrdeným posunom. */
  readonly bodka: DvojityMarker;
  readonly ja: PlayerId;
}) {
  // Zrkadlenie: tvoja polovica vľavo — zobrazené pole k leží na pozícii poloha(k).
  const poloha = (k: number): MarkerPos => (ja === 0 ? k : 6 - k) as MarkerPos;
  const v = r.vyber;
  const ciel = v !== undefined && !v.aktivna && v.posun !== null ? v.posun.na : null;
  return (
    <span className="ls-stupnica-r" data-vyucba="starsi-stupnica">
      {STUPNICA_ZONY.map((_, k) => {
        const pos = poloha(k);
        const z = STUPNICA_ZONY[pos] ?? 0;
        const c = r.ceny[pos] ?? null;
        const trieda = `lsr-pole z${z}${c === null ? "" : c.dosah ? " dosah" : " mimo"}${pos === ciel ? " ciel" : ""}`;
        const vnutro = (
          <>
            {c !== null && c.dosah && <i className="lsr-cena">{c.cena}</i>}
            {pos === marker && <b className={`lsr-mk${r.navrh !== null ? " stare" : ""}`} />}
            {r.navrh !== null && pos === r.navrh.na && <b className="lsr-mk duch" />}
            {k === bodka.bodka && <b className={`lsr-bodka${bodka.komu === null ? "" : ` ${bodka.komu}`}`} />}
          </>
        );
        const styl = { background: farbaZony(z), "--z": z } as CSSProperties;
        return (
          <span key={k} className={trieda} style={styl}>
            {vnutro}
          </span>
        );
      })}
    </span>
  );
}

/**
 * Krúžok priazne na portréte pri rozdeľovaní (mock C): priazeň tohto kola (po hádke) vo farbe
 * toho, komu patrí. Pri nepotvrdenom posune nový krúžok, preškrtnutá stará hodnota a ▲ / ▼ / ⇄.
 * Myš, ťuk či fokus otvorí nápovedu staršieho so stavom po posune; Esc ju zavrie.
 */
function PecatPriazne({
  elder,
  meno,
  data,
  ja,
  mena,
  klebety,
  body,
  na,
  strach,
}: {
  readonly elder: ElderState;
  readonly meno: string;
  readonly data: GameData;
  readonly ja: PlayerId;
  readonly mena: readonly [string, string];
  readonly klebety: Klebety | undefined;
  readonly body: SpakyStarsieho | undefined;
  readonly na: MarkerPos | null;
  /** Koho sa starší bojí teraz a po posune (riadok strachu, pod kartou už nie je). */
  readonly strach: { readonly teraz: string; readonly po: string };
}) {
  const su: PlayerId = ja === 0 ? 1 : 0;
  const fav = favourStarsieho(data, elder);
  const a = priazenKola(elder, klebety, ja);
  const b = na === null || na === elder.marker ? null : priazenKola({ ...elder, marker: na }, klebety, ja);
  const p = b ?? a;
  const vz = (x: PriazenKola) => ({ priazen: x.hrac, sila: x.sila });
  const zmena = b === null ? null : zmenaPriazne(vz(a), vz(b), ja);
  const m = { ja: "ty", su: mena[su] };
  const [poloha, setPoloha] = useState<{ readonly x: number; readonly y: number; readonly hore: boolean } | null>(null);
  const ref = useRef<HTMLButtonElement>(null);
  const otvor = (): void => {
    const el = ref.current;
    if (el === null) return;
    const rect = el.getBoundingClientRect();
    const hore = rect.top > 250;
    setPoloha({ x: Math.min(Math.max(rect.left + rect.width / 2, 145), window.innerWidth - 145), y: hore ? rect.top - 8 : rect.bottom + 8, hore });
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
  const popis = `${meno}: priazeň v tomto kole ${ktoPriazen(p, m)}`;
  const o = obavanyHrac(elder);
  return (
    <span className="ls-pecat-pr">
      <button
        ref={ref}
        type="button"
        className="ls-pecat"
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
        <KruzokPriazne fav={fav} p={p} trieda="ls-kruzok-r" />
      </button>
      {zmena !== null && <span className={`ls-pecat-zmena ${zmena.trieda}`}>{zmena.znak}</span>}
      {b !== null && a.komu !== null && <s className="ls-pecat-bolo">+{a.sila}</s>}
      {poloha !== null &&
        createPortal(
          <span className={`np-tip ls-pecat-tip${poloha.hore ? " hore" : ""}`} role="tooltip" style={{ left: poloha.x, top: poloha.y }}>
            <ObsahNapovedyStarsieho
              o={obsahNapovedy({
                data,
                elder,
                meno,
                klebety,
                ja,
                mena,
                spaky: o === null ? 0 : (body?.spaky[o] ?? strachNaVyplatu(elder, o)),
                naUdrzanie: o === null ? 0 : (body?.naUdrzanie[o] ?? strachNaUdrzanie(elder, o)),
              })}
              menoSupera={mena[su]}
            />
            {b !== null && (
              <span className="po">
                po posune: <span className={`np-kto ${b.komu ?? "nikto"}`}>{ktoPriazen(b, m)}</span>
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

/** Schodová stupnica: výška segmentu = úroveň zóny; na nej dvojitý marker a stopa posunu. */
function Stupnica({
  marker,
  stopa,
  dm,
  kruzky,
}: {
  readonly marker: number;
  /** Kde marker stál pred posunmi od poslednej bitky (duch stopy). */
  readonly stopa: number | null;
  /** Dvojitý marker: prsteň = strach (marker), bodka = priazeň tohto kola (Michal 2026-10-31). */
  readonly dm: DvojityMarker;
  /** Prejdenie myšou nad stupnicou: nápoveda o prsteni a bodke. */
  readonly kruzky: HTMLAttributes<HTMLElement>;
}) {
  return (
    <span className="ls-stupnica" aria-hidden="true" data-vyucba="starsi-stupnica" {...kruzky}>
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
      <b className="dm-prsten" style={{ "--p": dm.prsten } as CSSProperties} />
      <b className={`dm-bodka${dm.komu === null ? "" : ` ${dm.komu}`}`} style={{ "--p": dm.bodka } as CSSProperties} />
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
