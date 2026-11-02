// Línia starších (Michal 2026-10-23, roadmapa #68 + #69 variant A; v11 Strach a reči 2026-11-02,
// docs/napady/strach-reci-mocky.html): osem starších v rade na mieste línie kariet. Ukáže sa po
// kliku na dlaždicu Starší a sama pri krokoch na staršom (Nakladačka, hádka, pokus o zajatie).
//
// Dve rozloženia s prepínačom v hlavičke:
//  - Teplomery (mock 3): portrét staršieho a po jeho okrajoch dva teplomery 0–3 — vľavo tvoj,
//    vpravo súperov. Strach plní teplomer zdola (žltá, oranžová, červená), reči sú bublina nad
//    strachom s počtom špakov. Dole krúžok priazne (komu a akú silnú) a špaky výhra / prehra.
//  - Pult (mock 5): tabuľka — riadok na staršieho, strach a reči oboch, priazeň od stredu
//    k hráčovi, špaky pri výhre a prehre a súčty.
// Väzeň ostáva na svojom mieste v rade ako prázdne miesto „v pivnici“.
//
// Rozdeľovanie (v11): víťaz bitky dvíha Nakladačkou svoj strach, víťaz hádky svoje reči. Klik
// na stupeň v tvojom teplomeri (aj v Pulte) ho zdvihne, klik na najvyšší vybraný ho vráti;
// klik na portrét pridá stupeň. Zdvihy sú nepotvrdené, kým ich Potvrdiť na hrane stola nepošle
// — cenu a zvyšok ráta jadro (teplomery.ts, rozdelenie.ts).

import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { useState } from "react";
import type { Action, DruhMarkera, ElderState, GameData, PlayerId, PultStarsich, StarsiVerejne, StavVyhier, Stupen, ZmenaMarkera } from "@naex/core";
import { NAZVY_ZON, STAV_STARSIEHO, favourStarsieho, opponentOf, priazenSila, spakyStarsieho, stupenStavu } from "@naex/core";
import { FARBY_STUPNICE } from "@naex/tvorba";
import { IKONY } from "../karta/ikony.ts";
import { UCINOK_KRATKO, UCINOK_PRIAZNE } from "./Scorecard.tsx";
import { KruzokPriazne, spojUdalosti, useNapovedaStarsieho } from "./KruzokPriazne.tsx";
import { kratkeMeno, ktoPriazen, obsahNapovedy, priazenKola } from "./priazenKola.ts";
import { NAZOV_ZDROJA, PRAVIDLO_STRACHU, nazovStupna } from "./textyStarsich.ts";
import { spakyStupna, type StupenRozdelenia } from "./teplomery.ts";
import "./teplomery.css";

export { IKONA_PRIAZNE } from "./KruzokPriazne.tsx";

/** Rozdeľovanie pri staršom v mojom kroku — stupne a čo s nimi urobí klik (teplomery.ts). */
export interface RozdelenieStarsieho {
  /** Marker, ktorý krok dvíha: strach (Nakladačka) alebo reči (hádka). */
  readonly marker: DruhMarkera;
  /** Stupne 1–3 môjho markera pri staršom. */
  readonly stupne: readonly StupenRozdelenia[];
  /** Nepotvrdený zdvih tohto staršieho. */
  readonly zdvih: { readonly z: Stupen; readonly na: Stupen; readonly cena: number } | null;
  /** Klik na stupeň (zdvihnúť, vrátiť). */
  readonly klik: (stupen: number) => void;
}

/** Jeden starší v línii — dáta pripraví HernaPlocha. */
export interface StarsiVLinii {
  readonly elder: StarsiVerejne;
  readonly meno: string;
  /** Ilustrácia karty staršieho (portrét). */
  readonly obrazok: string | null;
  /** Klik v kroku (pokus o zajatie, Kapybara) a čo urobí — rozdeľovanie nesie `rozdelenie`. */
  readonly klik?: { readonly akcia: string; readonly klik: () => void } | undefined;
  /** Prečo sa v kroku nedá kliknúť (zamknutý starší). */
  readonly dovod?: string | undefined;
  /** Pokus o zajatie (v10.1): kto skúša staršieho zajať — starší je v ohrození. */
  readonly patron: { readonly kto: PlayerId } | null;
  /** Vybraný pri pokuse o zajatie (čaká sa na potvrdenie). */
  readonly vybrany?: boolean;
  /** Zmeny strachu a rečí od poslednej bitky (štítok na portréte). */
  readonly zmeny?: readonly ZmenaMarkera[];
  /** Rozdeľovanie v mojom kroku. */
  readonly rozdelenie?: RozdelenieStarsieho | undefined;
  /** Starší po nepotvrdenom rozdelení — z neho špaky a priazeň v náhľade. */
  readonly po?: StarsiVerejne | undefined;
}

/** Väzeň na mieste svojho ukazovateľa. */
export interface VazenVLinii {
  readonly elderId: string;
  readonly meno: string;
  readonly obrazok: string | null;
  readonly hrac: PlayerId;
}

export type MiestoVLinii = { readonly typ: "starsi"; readonly s: StarsiVLinii } | { readonly typ: "vazen"; readonly v: VazenVLinii };

export type RezimLinie = "teplomery" | "pult";

export interface LiniaStarsichProps {
  readonly rad: readonly MiestoVLinii[];
  readonly data: GameData;
  readonly ja: PlayerId;
  /** Čí pohľad línia ukazuje — po kliku na súperovu dlaždicu Starší súperov. */
  readonly pohlad: PlayerId;
  readonly mena: readonly [string, string];
  /** Krok na staršom, ktorý línia práve ukazuje (Nakladačka, hádka, pokus o zajatie) — inak null. */
  readonly krok: string | null;
  /** Starší, ktorým sa práve zmenil marker (blikne po kroku). */
  readonly zmenene: ReadonlySet<string>;
  /** Okamžité výhry: červené a väzni oboch (ClientState.vyhry). */
  readonly vyhry: StavVyhier;
  /** Pult starších (pultStarsich) — súčty pri výhre a prehre. */
  readonly pult: PultStarsich;
  readonly rezim: RezimLinie;
  readonly onRezim: (r: RezimLinie) => void;
  /** Tlačidlo vľavo v hlavičke: späť na stôl, nahliadnuť, ďalej. */
  readonly tlacidlo?: ReactNode;
}

/**
 * Farba stupňa 0–3 (farby stupnice sú pevné, ako na tlačenom scorecarde). FARBY_STUPNICE tvorcu
 * má 9 polí od červenej po červenú — stupeň sa berie od kraja.
 */
export const farbaZony = (uroven: number): string => FARBY_STUPNICE[3 - uroven] ?? FARBY_STUPNICE[3];

/** Farby stupňov ako premenné pre CSS (teplomery.css). */
const FARBY: CSSProperties = { "--tp-z1": farbaZony(1), "--tp-z2": farbaZony(2), "--tp-z3": farbaZony(3) } as CSSProperties;

export function LiniaStarsich({ rad, data, ja, pohlad, mena, krok, zmenene, vyhry, pult, rezim, onRezim, tlacidlo }: LiniaStarsichProps) {
  const su = opponentOf(ja);
  // Náhľad kroku v hlavičke — celý text, karta sa neoreže (UI U3).
  const [nahlad, setNahlad] = useState<string | null>(null);
  const nahladovany = rad.find((m): m is Extract<MiestoVLinii, { typ: "starsi" }> => m.typ === "starsi" && m.s.elder.elderId === nahlad)?.s;
  const akciaNahladu = nahladovany?.klik?.akcia;
  const rozdeluje = rad.some((m) => m.typ === "starsi" && m.s.rozdelenie !== undefined);
  // Pri rozdeľovaní hlavička nič nehovorí — zvyšok a pokyn sú v bubline na hrane stola.
  const stred =
    krok === null || rozdeluje ? null : (
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
    <div className={`linia-starsich tp-linia${pohlad === su ? " pohlad-su" : ""}${krok !== null ? " v-kroku" : ""}${rozdeluje ? " rozdeluje" : ""}`} style={FARBY}>
      <div className="ls-hlava">
        {tlacidlo}
        {stred}
        <StavVyhierLinie vyhry={vyhry} ja={ja} mena={mena} />
        <span className="tp-prepinac" role="group" aria-label="Zobrazenie starších" title={PRAVIDLO_STRACHU}>
          <button type="button" aria-pressed={rezim === "teplomery"} onClick={() => onRezim("teplomery")}>
            Teplomery
          </button>
          <button type="button" aria-pressed={rezim === "pult"} onClick={() => onRezim("pult")}>
            Pult
          </button>
        </span>
      </div>
      {rezim === "pult" ? (
        <PultLinie rad={rad} data={data} ja={ja} mena={mena} pult={pult} vyhry={vyhry} />
      ) : (
        <div className="ls-rad" data-vyucba="starsi-stupnica">
          {rad.map((m) =>
            m.typ === "vazen" ? (
              <KartaVazna key={m.v.elderId} v={m.v} ja={ja} mena={mena} />
            ) : (
              <TeplomerStarsieho
                key={m.s.elder.elderId}
                s={m.s}
                data={data}
                ja={ja}
                mena={mena}
                krok={krok}
                zmeneny={zmenene.has(m.s.elder.elderId)}
                nahlad={nahlad === m.s.elder.elderId}
                onNahlad={(n) => setNahlad(n ? m.s.elder.elderId : (x) => (x === m.s.elder.elderId ? null : x))}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}

/** Stav okamžitých výhier (v11) v hlavičke — nenápadne: červené x/4 a väzni x/N oboch. */
function StavVyhierLinie({ vyhry, ja, mena }: { readonly vyhry: StavVyhier; readonly ja: PlayerId; readonly mena: readonly [string, string] }) {
  const su = opponentOf(ja);
  const hrac = (p: PlayerId): ReactNode => {
    const c = vyhry.cervene[p];
    const v = vyhry.vazni[p];
    const hrozi = c >= vyhry.cervenychNaVyhru - 1 || v >= vyhry.vazniNaVyhru - 1;
    const kto = p === ja ? "ty" : kratkeMeno(mena[p]);
    const popis = `${p === ja ? "Ty" : mena[p]}: červené ${c} z ${vyhry.cervenychNaVyhru}, väzni ${v} z ${vyhry.vazniNaVyhru} — kto vyhrá bitku a má dosť, vyhráva hneď`;
    return (
      <span className={`tp-vyhry ${p === ja ? "ja" : "su"}${hrozi ? " hrozi" : ""}`} role="img" aria-label={popis} title={popis}>
        <span className="tp-vyhry-kto">{kto}</span>
        <span className="tp-pipy" aria-hidden="true">
          {Array.from({ length: vyhry.cervenychNaVyhru }, (_, i) => (
            <i key={i} className={i < c ? "on" : ""} />
          ))}
        </span>
        <b>
          {c}/{vyhry.cervenychNaVyhru}
        </b>
        <span className="tp-vazni">
          ⛓ {v}/{vyhry.vazniNaVyhru}
        </span>
      </span>
    );
  };
  return (
    <span className="tp-stav-vyhier">
      {hrac(ja)}
      {hrac(su)}
    </span>
  );
}

/** Štítok zmien od bitky: zdroje a počet („Nakladačka ×2 · Hádka“); kto menil, nesie farba. */
export function stitokZmien(zmeny: readonly Pick<ZmenaMarkera, "zdroj" | "kto">[]): string {
  const out: { zdroj: ZmenaMarkera["zdroj"]; pocet: number }[] = [];
  for (const z of zmeny) {
    const x = out.find((y) => y.zdroj === z.zdroj);
    if (x !== undefined) x.pocet++;
    else out.push({ zdroj: z.zdroj, pocet: 1 });
  }
  return out.map((x) => `${NAZOV_ZDROJA[x.zdroj]}${x.pocet > 1 ? ` ×${x.pocet}` : ""}`).join(" · ");
}

function TeplomerStarsieho({
  s,
  data,
  ja,
  mena,
  krok,
  zmeneny,
  nahlad,
  onNahlad,
}: {
  readonly s: StarsiVLinii;
  readonly data: GameData;
  readonly ja: PlayerId;
  readonly mena: readonly [string, string];
  readonly krok: string | null;
  readonly zmeneny: boolean;
  /** Myš či fokus je na tomto staršom — v kroku ho zvýrazní a hlavička povie, čo klik urobí. */
  readonly nahlad: boolean;
  readonly onNahlad: (n: boolean) => void;
}) {
  const su = opponentOf(ja);
  const { elder, klik } = s;
  const r = s.rozdelenie;
  const po = s.po ?? elder;
  const fav = favourStarsieho(data, elder);
  const pk = priazenKola(po, ja);
  const body = spakyStarsieho(po);
  const napoveda = useNapovedaStarsieho(
    () =>
      obsahNapovedy({
        data,
        elder: po,
        meno: s.meno,
        ja,
        mena,
        akcia: klik?.akcia ?? null,
        dalsi: s.patron === null ? null : { nazov: "Ohrozenie", text: `zajať ho skúša ${s.patron.kto === ja ? "ty" : mena[s.patron.kto]} — v tomto kole sa nedvíha` },
      }),
    { menoSupera: mena[su], zvacsenina: () => <Zvacsenina s={s} fav={fav} pk={pk} /> },
  );

  // Rozdeľovanie: klik na portrét pridá stupeň nad najvyšší vybraný (veľký cieľ pre prst).
  const dalsiStupen = r?.stupne.find((x) => x.stav === "dosah");
  const klikKarty = r !== undefined ? (dalsiStupen === undefined ? undefined : () => r.klik(dalsiStupen.stupen)) : klik?.klik;
  const krokTrieda =
    r !== undefined
      ? ` rozdel${r.zdvih !== null ? " s-posunom" : ""}${dalsiStupen === undefined && r.zdvih === null ? " mrtvy" : ""}`
      : krok === null
        ? ""
        : s.vybrany === true
          ? " vybrany"
          : klik !== undefined
            ? ` klik${nahlad ? " nahl" : ""}`
            : " nedost";
  const popis =
    `${s.meno} — ${STAV_STARSIEHO[stupenStavu(elder)]}. Priazeň ${ktoPriazen(pk, { ja: "ty", su: mena[su] })}. ` +
    `Ty: strach ${nazovStupna(elder.strach[ja])}, reči ${nazovStupna(elder.reci[ja])}; ${mena[su]}: strach ${nazovStupna(elder.strach[su])}, reči ${nazovStupna(elder.reci[su])}.` +
    (r?.zdvih != null ? ` Návrh: ${r.marker === "strach" ? "strach" : "reči"} ${nazovStupna(r.zdvih.z)} → ${nazovStupna(r.zdvih.na)} za ${r.zdvih.cena}.` : "") +
    (s.dovod !== undefined ? ` — ${s.dovod}` : "") +
    (klik !== undefined && r === undefined ? ` — klikni: ${klik.akcia}` : "");
  const zmeny = s.zmeny ?? [];
  const ktoMenil = new Set(zmeny.map((x) => x.kto));
  const farbaZmien = ktoMenil.size !== 1 ? "" : ktoMenil.has(ja) ? " moje" : " superove";

  return (
    <div
      className={`ls-sc tp-k${krokTrieda}${zmeneny ? " zmena" : ""}`}
      data-vyucba={`starsi:${elder.elderId}`}
      {...spojUdalosti(napoveda.props, {
        tabIndex: 0,
        "aria-label": popis,
        ...(klikKarty === undefined
          ? {}
          : {
              role: "button",
              onClick: (e: { readonly target: EventTarget }) => {
                // Ťuk po podržaní prsta otvoril zväčšeninu; klik na stupeň má vlastnú obsluhu.
                if (napoveda.poPodrzani()) return;
                if (e.target instanceof Element && e.target.closest(".tp-seg") !== null) return;
                klikKarty();
              },
              onKeyDown: (e: ReactKeyboardEvent) => {
                if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return;
                e.preventDefault();
                klikKarty();
              },
            }),
        onMouseEnter: () => onNahlad(true),
        onMouseLeave: () => onNahlad(false),
        onFocus: () => onNahlad(true),
        onBlur: () => onNahlad(false),
      })}
    >
      <div className="ls-telo">
        <span className="ls-portret">
          {s.obrazok !== null ? <img src={s.obrazok} alt="" draggable={false} /> : <span className="ls-portret-prazdny" />}
          <span className="tp-tien" aria-hidden="true" />
          <Teplomer strana="ja" elderId={elder.elderId} strach={elder.strach[ja]} reci={elder.reci[ja]} r={r} meno={s.meno} />
          <Teplomer strana="su" elderId={elder.elderId} strach={elder.strach[su]} reci={elder.reci[su]} meno={s.meno} />
          {s.patron !== null ? (
            <span className={`tp-ohrozenie ${s.patron.kto === ja ? "ja" : "su"}`}>⛓ v ohrození · {s.patron.kto === ja ? "skúšaš ty" : `skúša ${kratkeMeno(mena[s.patron.kto])}`}</span>
          ) : zmeny.length > 0 ? (
            <span className={`ls-listok tp-zmeny${farbaZmien}`}>⇄ {stitokZmien(zmeny)}</span>
          ) : null}
          {r?.zdvih != null && <span className="tp-cena-navrhu">−{r.zdvih.cena}</span>}
          <KruzokPriazne fav={fav} p={pk} trieda="ls-kruzok tp-kruzok" />
        </span>
      </div>
      <span className="ls-stav tp-stav" aria-hidden="true">
        <b className="ls-meno">{s.meno}</b>
        <span className="tp-body" title="špaky po bitke: pri výhre / pri prehre — ty · súper">
          <b className="ja">
            {body.vyhra[ja]}/{body.prehra[ja]}
          </b>
          <span> · </span>
          <b className="su">
            {body.vyhra[su]}/{body.prehra[su]}
          </b>
        </span>
      </span>
      {s.dovod !== undefined && r === undefined && (
        <div className="ls-pata">
          <span className="ls-dovod">{s.dovod}</span>
        </div>
      )}
      {napoveda.vrstva}
    </div>
  );
}

/**
 * Teplomer jedného hráča: tri stupne zdola (žltá, oranžová, červená), strach ich plní, reči sú
 * bublina na svojom stupni s počtom špakov. V rozdeľovaní sú stupne tlačidlá s cenou.
 */
function Teplomer({ strana, elderId, strach, reci, r, meno }: { readonly strana: "ja" | "su"; readonly elderId: string; readonly strach: number; readonly reci: number; readonly r?: RozdelenieStarsieho | undefined; readonly meno: string }) {
  const na = r?.zdvih?.na ?? null;
  // Náhľad po zdvihu: strach dorastie, reči sa presunú (pod strachom zaniknú).
  const strachPo = r?.marker === "strach" && na !== null ? na : strach;
  const reciPo = r?.marker === "reci" && na !== null ? na : reci > strachPo ? reci : 0;
  return (
    // Kľúče výučby: môj teplomer strach:<id>, pri rozdeľovaní rečí reci:<id>; stupne stupen:<id>:<n>.
    <span className={`tp-bar ${strana}${r !== undefined ? ` rozdel ${r.marker}` : ""}`} data-vyucba={strana === "ja" ? `${r?.marker === "reci" ? "reci" : "strach"}:${elderId}` : undefined}>
      {([3, 2, 1] as const).map((z) => {
        const st = r?.stupne.find((x) => x.stupen === z);
        const on = strachPo >= z;
        const nove = on && strach < z;
        const reciTu = reciPo === z;
        const trieda = `tp-seg z${z}${on ? " on" : ""}${nove ? " nove" : ""}${st !== undefined ? ` ${st.stav}` : ""}`;
        const obsah = (
          <>
            {reciTu && (
              <span className={`tp-reci${r?.marker === "reci" && na === z ? " nove" : ""}`}>
                <BublinaReci n={spakyStupna(z)} />
              </span>
            )}
            {st !== undefined && st.stav === "dosah" && <i className="tp-cena">{st.cena}</i>}
          </>
        );
        if (st === undefined || r === undefined || st.stav === "pod" || st.stav === "zamknuty") {
          return (
            <span key={z} className={trieda}>
              {obsah}
            </span>
          );
        }
        const co = r.marker === "strach" ? "strach" : "reči";
        const label =
          st.stav === "vybrany"
            ? z === na
              ? `${meno}: vrátiť ${co} o stupeň`
              : `${meno}: ${co} len na ${NAZVY_ZON[z]}`
            : st.stav === "dosah"
              ? `${meno}: ${co} na ${NAZVY_ZON[z]} za ${st.cena}`
              : `${meno}: na ${NAZVY_ZON[z]} (${st.cena}) zvyšok nestačí`;
        return (
          <button key={z} type="button" className={trieda} data-vyucba={`stupen:${elderId}:${z}`} aria-label={label} title={label} aria-disabled={st.stav === "mimo"} aria-pressed={st.stav === "vybrany"} onClick={() => r.klik(z)}>
            {obsah}
          </button>
        );
      })}
    </span>
  );
}

/** Bublina rečí s počtom špakov (mock 3) — vo farbe hráča podľa teplomera (CSS). */
function BublinaReci({ n }: { readonly n: number | null }) {
  return (
    <svg className="tp-bub" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M3 3h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9l-4 4v-4H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      {n !== null && (
        <text x="10" y="11.5" textAnchor="middle">
          {n}
        </text>
      )}
    </svg>
  );
}

/** Väzeň na mieste ukazovateľa: v pivnici držiteľa, ráta sa mu ako červená. */
function KartaVazna({ v, ja, mena }: { readonly v: VazenVLinii; readonly ja: PlayerId; readonly mena: readonly [string, string] }) {
  const kto = v.hrac === ja ? "teba" : kratkeMeno(mena[v.hrac]);
  return (
    <div className={`ls-sc tp-k tp-vazen ${v.hrac === ja ? "ja" : "su"}`} tabIndex={0} aria-label={`${v.meno} — väzeň v pivnici u ${kto}, ráta sa ${v.hrac === ja ? "ti" : "mu"} ako červená`}>
      <div className="ls-telo">
        <span className="ls-portret">
          {v.obrazok !== null ? <img src={v.obrazok} alt="" draggable={false} /> : <span className="ls-portret-prazdny" />}
          <span className="tp-mreze" aria-hidden="true" />
          <span className="tp-vazen-text">
            ⛓ v pivnici u {kto}
            <small>ráta sa ako červená</small>
          </span>
        </span>
      </div>
      <span className="ls-stav tp-stav" aria-hidden="true">
        <b className="ls-meno">{v.meno}</b>
      </span>
    </div>
  );
}

/** Zväčšenina staršieho na telefóne (podržanie prsta) — pod ňou je nápoveda. */
function Zvacsenina({ s, fav, pk }: { readonly s: StarsiVLinii; readonly fav: ReturnType<typeof favourStarsieho>; readonly pk: ReturnType<typeof priazenKola> }) {
  return (
    <span className="np-zoom-karta">
      <span className="np-zoom-portret">
        {s.obrazok !== null ? <img src={s.obrazok} alt="" draggable={false} /> : null}
        <KruzokPriazne fav={fav} p={pk} velkost={46} />
      </span>
      <b>{s.meno}</b>
    </span>
  );
}

/** Pipy stupnice v Pulte: strach plné štvorce, reči krúžok na svojom stupni. */
function Pipy({
  hodnota,
  reci,
  r,
  meno,
  zrkadlo,
}: {
  readonly hodnota: number;
  readonly reci: boolean;
  readonly r?: RozdelenieStarsieho | undefined;
  readonly meno: string;
  /** Súperove stĺpce idú od stredu doprava — poradie stupňov sa otočí. */
  readonly zrkadlo: boolean;
}) {
  const na = r?.zdvih?.na ?? null;
  const po = na ?? hodnota;
  const stupne = zrkadlo ? ([1, 2, 3] as const) : ([3, 2, 1] as const);
  return (
    <span className={`tp-pipy-pult${reci ? " reci" : ""}`}>
      {stupne.map((z) => {
        const st = r?.stupne.find((x) => x.stupen === z);
        const on = reci ? po === z : po >= z;
        const trieda = `z${z}${on ? " on" : ""}${on && (reci ? hodnota !== z : hodnota < z) ? " nove" : ""}${st !== undefined ? ` ${st.stav}` : ""}`;
        if (r === undefined || st === undefined || st.stav === "pod" || st.stav === "zamknuty") return <i key={z} className={trieda} />;
        const label = `${meno}: ${reci ? "reči" : "strach"} na ${NAZVY_ZON[z]}${st.stav === "dosah" ? ` za ${st.cena}` : st.stav === "mimo" ? " — zvyšok nestačí" : ""}`;
        return (
          <button key={z} type="button" className={`tp-seg ${trieda}`} aria-label={label} title={label} aria-disabled={st.stav === "mimo"} aria-pressed={st.stav === "vybrany"} onClick={() => r.klik(z)}>
            {st.stav === "dosah" ? st.cena : null}
          </button>
        );
      })}
    </span>
  );
}

/** Priazeň v Pulte: stĺpec od stredu k hráčovi, ktorému patrí, a účinok. */
function PriazenPultu({ e, data, ja, mena }: { readonly e: ElderState; readonly data: GameData; readonly ja: PlayerId; readonly mena: readonly [string, string] }) {
  const p = priazenKola(e, ja);
  const fav = favourStarsieho(data, e);
  const popis = p.komu === null ? `nikomu · pri +1: ${UCINOK_KRATKO[fav](1)}` : `${p.komu === "ja" ? "ty" : kratkeMeno(mena[opponentOf(ja)])}: ${UCINOK_KRATKO[fav](p.sila)}`;
  return (
    <span className="tp-priazen" title={popis}>
      <span className={`tp-priazen-os${p.komu === null ? "" : ` ${p.komu}`}`} aria-hidden="true">
        {p.komu !== null && <i style={{ width: `${(p.sila / 3) * 50}%` } as CSSProperties} />}
      </span>
      <KruzokPriazne fav={fav} p={p} velkost={22} />
      <small>{popis}</small>
    </span>
  );
}

/** Pult starších (mock 5): riadok na staršieho a súčty. */
function PultLinie({
  rad,
  data,
  ja,
  mena,
  pult,
  vyhry,
}: {
  readonly rad: readonly MiestoVLinii[];
  readonly data: GameData;
  readonly ja: PlayerId;
  readonly mena: readonly [string, string];
  readonly pult: PultStarsich;
  readonly vyhry: StavVyhier;
}) {
  const su = opponentOf(ja);
  const menoSu = kratkeMeno(mena[su]);
  // Súčty po nepotvrdenom rozdelení — z náhľadov starších.
  const vsetci = rad.flatMap((m) => (m.typ === "starsi" ? [spakyStarsieho(m.s.po ?? m.s.elder)] : []));
  const sucet = (f: (x: ReturnType<typeof spakyStarsieho>) => number): number => vsetci.reduce((a, x) => a + f(x), 0);
  const zmenene = sucet((x) => x.vyhra[ja]) !== pult.vyhra[ja];
  return (
    <div className="tp-pult-obal" data-vyucba="starsi-stupnica">
      <table className="tp-pult">
        <thead>
          <tr>
            <th className="vlavo">Starší</th>
            <th className="ja">ty strach</th>
            <th className="ja">ty reči</th>
            <th>
              Priazeň <span className="ja">◀ ty</span> · <span className="su">{menoSu} ▶</span>
            </th>
            <th className="su">{menoSu} reči</th>
            <th className="su">{menoSu} strach</th>
            <th className="ja" title="špaky po bitke pri tvojej výhre · prehre">
              ty výhra · prehra
            </th>
            <th className="su" title={`špaky po bitke pri výhre · prehre (${mena[su]})`}>
              {menoSu} výhra · prehra
            </th>
          </tr>
        </thead>
        <tbody>
          {rad.map((m) => {
            if (m.typ === "vazen") {
              return (
                <tr key={m.v.elderId} className="tp-pult-vazen">
                  <td className="vlavo">
                    <PultMeno meno={m.v.meno} obrazok={m.v.obrazok} pod={`väzeň · ${m.v.hrac === ja ? "tvoj" : menoSu}`} />
                  </td>
                  <td colSpan={7} className={m.v.hrac === ja ? "ja" : "su"}>
                    ⛓ v pivnici u {m.v.hrac === ja ? "teba" : menoSu} — ráta sa ako červená
                  </td>
                </tr>
              );
            }
            const s = m.s;
            const e = s.elder;
            const po = s.po ?? e;
            const b = spakyStarsieho(po);
            const r = s.rozdelenie;
            const ohrozenie = s.patron === null ? "" : ` · ⛓ v ohrození (${s.patron.kto === ja ? "ty" : menoSu})`;
            return (
              <tr key={e.elderId} className={`${s.patron !== null ? "ohrozeny" : ""}${r?.zdvih != null ? " s-posunom" : ""}`} data-vyucba={`starsi:${e.elderId}`}>
                <td className="vlavo">
                  <PultMeno meno={s.meno} obrazok={s.obrazok} pod={`${STAV_STARSIEHO[stupenStavu(e)]}${ohrozenie}`} />
                </td>
                <td>
                  <Pipy hodnota={e.strach[ja]} reci={false} r={r?.marker === "strach" ? r : undefined} meno={s.meno} zrkadlo={false} />
                </td>
                <td>
                  <Pipy hodnota={e.reci[ja]} reci r={r?.marker === "reci" ? r : undefined} meno={s.meno} zrkadlo={false} />
                </td>
                <td>
                  <PriazenPultu e={po} data={data} ja={ja} mena={mena} />
                </td>
                <td>
                  <Pipy hodnota={e.reci[su]} reci meno={s.meno} zrkadlo />
                </td>
                <td>
                  <Pipy hodnota={e.strach[su]} reci={false} meno={s.meno} zrkadlo />
                </td>
                <td className="tp-bd ja">
                  <b>{b.vyhra[ja]}</b> · {b.prehra[ja]}
                </td>
                <td className="tp-bd su">
                  <b>{b.vyhra[su]}</b> · {b.prehra[su]}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td className="vlavo">Spolu{zmenene ? " po návrhu" : ""}</td>
            <td colSpan={2} className="ja">
              červené {vyhry.cervene[ja]}/{vyhry.cervenychNaVyhru} · ⛓ {vyhry.vazni[ja]}/{vyhry.vazniNaVyhru}
            </td>
            <td />
            <td colSpan={2} className="su">
              červené {vyhry.cervene[su]}/{vyhry.cervenychNaVyhru} · ⛓ {vyhry.vazni[su]}/{vyhry.vazniNaVyhru}
            </td>
            <td className="tp-bd ja">
              <b>{sucet((x) => x.vyhra[ja])}</b> · {sucet((x) => x.prehra[ja])}
            </td>
            <td className="tp-bd su">
              <b>{sucet((x) => x.vyhra[su])}</b> · {sucet((x) => x.prehra[su])}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function PultMeno({ meno, obrazok, pod }: { readonly meno: string; readonly obrazok: string | null; readonly pod: string }) {
  // Stav a ohrozenie v titulku — riadok Pultu musí ostať nízky (8 riadkov pri 1366 × 650).
  return (
    <span className="tp-pult-kto" title={`${meno} — ${pod}`}>
      {obrazok !== null ? <img src={obrazok} alt="" draggable={false} /> : <span className="tp-pult-obr" />}
      <span>
        <b>
          {meno}
          {pod.includes("⛓") && <span className="tp-pult-ohr">⛓</span>}
        </b>
        <small>{pod}</small>
      </span>
    </span>
  );
}

/**
 * Ikona kroku v bubline a na žetónoch — piktogram akcie: hádka Pohoršenie (mäkké), Nakladačka
 * je prebytok poškodenia, preto Rana (Michal 2026-10-30).
 */
const AKCIA_DELENIA: Readonly<Record<"hadka" | "reci" | "prebytok", Action>> = { hadka: "Pohoršenie", reci: "Pohoršenie", prebytok: "Rana" };

export function IkonaDelenia({ krok }: { readonly krok: "hadka" | "reci" | "prebytok" }) {
  return (
    <svg className="ikona-delenia" viewBox="0 0 100 100" aria-hidden="true">
      {IKONY[AKCIA_DELENIA[krok]].map((c, i) => (
        <path key={i} d={c.d} fillRule={c.evenOdd ? "evenodd" : "nonzero"} />
      ))}
    </svg>
  );
}

/**
 * Účinok priazne staršieho — vždy, aj keď priazeň nemá nikto (Michal 2026-10-23:
 * hráč má vidieť, koho sa oplatí desiť). Bez priazne pri sile 1.
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
