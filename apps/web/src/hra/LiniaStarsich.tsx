// Línia starších (Michal 2026-10-23, roadmapa #68 + #69 variant A; v11 Strach a reči 2026-11-02):
// osem starších v rade na mieste línie kariet. Ukáže sa po kliku na dlaždicu Starší, sama pri
// krokoch na staršom (Nakladačka so zajatím, hádka s presvedčením) a v súhrne po bitke.
//
// Dve rozloženia s prepínačom v hlavičke:
//  - Teplomery R3 „Okraje s hladinami“ (Michal 2026-11-02, docs/napady/starsi-ram-mocky.html):
//    pri okrajoch portrétu pás každého hráča v jeho farbe — ty vľavo, súper vpravo. Strach je plná
//    výplň, súperove reči šrafa na ňom (v11.12). Od vrchu strachu ide do stredu čiara hladiny s menom hráča,
//    medzi hladinami zátvorka priazne so silou; dole krúžok priazne. Slová stupňov pri teplomeroch
//    nie sú — sú pod menom staršieho a v nápovede.
//  - Pult (mock 5): tabuľka — riadok na staršieho, strach a reči oboch, priazeň od stredu
//    k hráčovi, špaky pri výhre a prehre a súčty.
// Väzeň ostáva na svojom mieste v rade: bez teplomerov, len pečiatka „V PIVNICI u …“.
//
// Rozdeľovanie (v11): víťaz bitky dvíha Nakladačkou svoj strach, víťaz hádky svoje reči (v11.12
// na teplomere súpera, šrafa vo farbe majiteľa). Klik
// na stupeň v teplomeri (aj v Pulte) ho zdvihne, klik na najvyšší vybraný ho vráti;
// klik na portrét pridá stupeň. Zdvihy sú nepotvrdené, kým ich Potvrdiť na hrane stola nepošle
// — cenu a zvyšok ráta jadro (teplomery.ts, rozdelenie.ts).
//
// Súhrn po bitke (návrh c, docs/napady/suhrn-po-bitke-mocky.html): pás nad radom vedie krokmi
// pravidiel (krokySuhrnu.ts), teplomery ukazujú stav v kroku a pohnú sa na mieste; dotknutí
// starší svietia, ostatní stmavnú. Krok sa neprehráva sám — Ďalej a Preskočiť sú na mieste potvrdenia
// v strede spodnej hrany stola (HernaPlocha); v rohu pásu sa prehliadali (Michal 2026-11-03).

import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { useState } from "react";
import type { Action, BitkaNaNastenke, DruhMarkera, ElderState, GameData, PlayerId, PultStarsich, StarsiVerejne, StavVyhier, Stupen, ZmenaMarkera } from "@naex/core";
import { NAZVY_ZON, blokReci, favourStarsieho, opponentOf, priazenHraca, priazenSila, spakyStarsieho, stupenStavu } from "@naex/core";
import { FARBY_STUPNICE } from "@naex/tvorba";
import { IKONY } from "../karta/ikony.ts";
import { UCINOK_KRATKO, UCINOK_PRIAZNE } from "./Scorecard.tsx";
import { KruzokPriazne, SlovoStupna, Stvorcek, spojUdalosti, useNapovedaStarsieho } from "./KruzokPriazne.tsx";
import { kradezPriZajati, kratkeMeno, ktoPriazen, obsahNapovedy, obsahNapovedyVazna, priazenKola } from "./priazenKola.ts";
import { NAZOV_ZDROJA, pravidloStrachu, rodStarsieho, slovoStupna, type Rod } from "./textyStarsich.ts";
import type { StupenRozdelenia } from "./teplomery.ts";
import { NAZOV_KROKU, dotknuty, fazaKroku, opisKroku, riadkyKroku, stitkyKroku, type KontextSuhrnu, type KrokSuhrnu, type Markery, type StitokSuhrnu, type SuhrnBitky } from "./krokySuhrnu.ts";
import { textCervenych } from "./vyhraStrachom.ts";
import { spakov } from "../i18n/pocty.ts";
import { t } from "../i18n/jazyk.tsx";
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

/** Pečiatka ZAJAŤ / PRESVEDČIŤ na staršom pri mojom rozdelení (v11.6) — dáta pripraví HernaPlocha. */
export interface AkciaStarsieho {
  readonly druh: "zajat" | "presvedcit";
  /** Celá cena pri tomto staršom (pri presvedčení s dotiahnutím rečí na červenú). */
  readonly cena: number;
  /** Zvolená v nepotvrdenom rozdelení — plná pečiatka ZAJATÝ / PRESVEDČENÝ. */
  readonly zapnuta: boolean;
  /** Čo akcia urobí (titulok). */
  readonly nahlad: string;
  readonly klik: () => void;
}

/** Jeden starší v línii — dáta pripraví HernaPlocha. */
export interface StarsiVLinii {
  readonly elder: StarsiVerejne;
  readonly meno: string;
  /** Ilustrácia karty staršieho (portrét). */
  readonly obrazok: string | null;
  /** Klik v kroku (Kapybara) a čo urobí — rozdeľovanie nesie `rozdelenie`. */
  readonly klik?: { readonly akcia: string; readonly klik: () => void } | undefined;
  /** Prečo sa v kroku nedá kliknúť (zamknutý starší). */
  readonly dovod?: string | undefined;
  /** Kto staršieho presvedčil (v11.4) — značka pri ňom; jeho karta patrí tomu hráčovi. */
  readonly presvedcil: { readonly kto: PlayerId } | null;
  /** Zvolený na zajatie či presvedčenie v nepotvrdenom rozdelení (v11.4). */
  readonly vybrany?: boolean;
  /** Pečiatka akcie rozdelenia (v11.6) — len keď sa tu akcia na moje body dá. */
  readonly akcia?: AkciaStarsieho | undefined;
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
  readonly defId: string;
  readonly scorecard: string;
  readonly meno: string;
  readonly obrazok: string | null;
  readonly hrac: PlayerId;
  /** Schopnosť väzňa je minutá (v11.2) — značka „použitá“ pri pečiatke, obom. */
  readonly pouzita?: boolean;
  /** Tlačidlo schopnosti pod pečiatkou — len pri vlastnom väzňovi (HernaPlocha). */
  readonly schopnost?: ReactNode;
}

export type MiestoVLinii = { readonly typ: "starsi"; readonly s: StarsiVLinii } | { readonly typ: "vazen"; readonly v: VazenVLinii };

export type RezimLinie = "teplomery" | "pult";

/** Súhrn po bitke na línii (HernaPlocha drží krok a tlačidlá na hrane stola): pás s krokmi. */
export interface SuhrnNaLinii {
  readonly bitka: SuhrnBitky;
  /** Index kroku v bitka.kroky. */
  readonly krok: number;
  readonly kontext: KontextSuhrnu;
}

export interface LiniaStarsichProps {
  readonly rad: readonly MiestoVLinii[];
  readonly data: GameData;
  readonly ja: PlayerId;
  /** Čí pohľad línia ukazuje — po kliku na súperovu dlaždicu Starší súperov. */
  readonly pohlad: PlayerId;
  readonly mena: readonly [string, string];
  /** Krok na staršom, ktorý línia práve ukazuje (Nakladačka, hádka) — inak null. */
  readonly krok: string | null;
  /** Starší, ktorým sa práve zmenil marker (blikne po kroku). */
  readonly zmenene: ReadonlySet<string>;
  /** Okamžité výhry: červené a väzni oboch (ClientState.vyhry). */
  readonly vyhry: StavVyhier;
  /** Odohrané bitky — krádež pri zajatí v nápovede väzňa. */
  readonly nastenka: readonly Pick<BitkaNaNastenke, "kolo" | "bodovanie" | "kradez">[];
  /** Pult starších (pultStarsich) — súčty pri výhre a prehre. */
  readonly pult: PultStarsich;
  readonly rezim: RezimLinie;
  readonly onRezim: (r: RezimLinie) => void;
  /** Tlačidlo vľavo v hlavičke: späť na stôl, nahliadnuť, ďalej. */
  readonly tlacidlo?: ReactNode;
  /** Súhrn po bitke — línia ukazuje stav v kroku súhrnu. */
  readonly suhrn?: SuhrnNaLinii | undefined;
}

/** Stav staršieho slovom (STAV_STARSIEHO v jadre) v jazyku hráča. */
const stavStarsieho = (s: number): string => t(`stupen.m${s >= 0 && s <= 3 ? s : 0}`);
const nazovZony = (z: number): string => (z >= 0 && z < NAZVY_ZON.length ? t(`zona.${z}`) : "");

/**
 * Farba stupňa 0–3 (farby stupnice sú pevné, ako na tlačenom scorecarde). FARBY_STUPNICE tvorcu
 * má 9 polí od červenej po červenú — stupeň sa berie od kraja.
 */
export const farbaZony = (uroven: number): string => FARBY_STUPNICE[3 - uroven] ?? FARBY_STUPNICE[3];

/** Farby stupňov ako premenné pre CSS (teplomery.css). */
const FARBY: CSSProperties = { "--tp-z1": farbaZony(1), "--tp-z2": farbaZony(2), "--tp-z3": farbaZony(3) } as CSSProperties;

type StarsiSuhrnu = SuhrnBitky["starsi"][number];

export function LiniaStarsich({ rad, data, ja, pohlad, mena, krok, zmenene, vyhry, nastenka, pult, rezim, onRezim, tlacidlo, suhrn }: LiniaStarsichProps) {
  const su = opponentOf(ja);
  // Náhľad kroku v hlavičke — celý text, karta sa neoreže (UI U3).
  const [nahlad, setNahlad] = useState<string | null>(null);
  const nahladovany = rad.find((m): m is Extract<MiestoVLinii, { typ: "starsi" }> => m.typ === "starsi" && m.s.elder.elderId === nahlad)?.s;
  const akciaNahladu = nahladovany?.klik?.akcia;
  const rozdeluje = rad.some((m) => m.typ === "starsi" && m.s.rozdelenie !== undefined);
  // Pri rozdeľovaní hlavička nič nehovorí — zvyšok a pokyn sú v bubline na hrane stola.
  const stred =
    suhrn !== undefined ? (
      <span className="ls-tlmene">po bitke {suhrn.bitka.kolo}</span>
    ) : krok === null || rozdeluje ? null : (
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
            <span className="len-mys">{t("linia.mys")}</span>
            <span className="len-dotyk">{t("linia.dotyk")}</span>
          </span>
        )}
      </span>
    );
  // Súhrn ide vždy na teplomeroch — Pult sa nehýbe.
  const naPulte = rezim === "pult" && suhrn === undefined;
  const krokSuhrnu: KrokSuhrnu | null = suhrn === undefined ? null : (suhrn.bitka.kroky[suhrn.krok] ?? "koniec");
  const kartaSuhrnu = (elderId: string): { readonly e: StarsiSuhrnu; readonly karta: SuhrnKarty } | null => {
    if (suhrn === undefined || krokSuhrnu === null) return null;
    const e = suhrn.bitka.starsi.find((x) => x.elderId === elderId);
    if (e === undefined) return null;
    const f = fazaKroku(krokSuhrnu);
    return {
      e,
      karta: {
        kluc: `${suhrn.bitka.kolo}-${suhrn.krok}`,
        od: f.od === null ? null : e.fazy[f.od]!,
        duch: f.duch,
        tlmeny: !dotknuty(e, krokSuhrnu),
        stitky: stitkyKroku(e, krokSuhrnu, ja, suhrn.kontext),
        riadky: riadkyKroku(e, krokSuhrnu, suhrn.kontext),
      },
    };
  };
  /** Starší v stave kroku súhrnu (aj zajatý v tejto bitke, kým súhrn nedošiel na koniec). */
  const vStaveKroku = (s: StarsiVLinii, e: StarsiSuhrnu): StarsiVLinii => {
    const f = e.fazy[fazaKroku(krokSuhrnu ?? "koniec").stav]!;
    return { elder: { ...s.elder, strach: f.strach, reci: f.reci, ...(f.reciOd !== undefined ? { reciOd: f.reciOd } : {}) }, meno: s.meno, obrazok: s.obrazok, presvedcil: s.presvedcil };
  };

  return (
    <div className={`linia-starsich tp-linia${pohlad === su ? " pohlad-su" : ""}${krok !== null ? " v-kroku" : ""}${rozdeluje ? " rozdeluje" : ""}${suhrn !== undefined ? " v-suhrne" : ""}`} style={FARBY}>
      <div className="ls-hlava">
        {tlacidlo}
        {stred}
        <StavVyhierLinie vyhry={vyhry} ja={ja} mena={mena} />
        {suhrn === undefined && (
          <span className="tp-prepinac" role="group" aria-label={t("linia.zobrazenie")} title={pravidloStrachu()}>
            <button type="button" aria-pressed={rezim === "teplomery"} onClick={() => onRezim("teplomery")}>
              {t("linia.teplomery")}
            </button>
            <button type="button" aria-pressed={rezim === "pult"} onClick={() => onRezim("pult")}>
              {t("linia.pult")}
            </button>
          </span>
        )}
      </div>
      {suhrn !== undefined && krokSuhrnu !== null && <PasSuhrnu suhrn={suhrn} krok={krokSuhrnu} />}
      {naPulte ? (
        <PultLinie rad={rad} data={data} ja={ja} mena={mena} pult={pult} vyhry={vyhry} />
      ) : (
        <div className="ls-rad" data-vyucba="starsi-stupnica">
          {rad.map((m) => {
            if (m.typ === "vazen") {
              const x = kartaSuhrnu(m.v.elderId);
              // Zajatý v tejto bitke je do posledného kroku ešte na stupnici.
              if (x !== null && x.e.vazen !== null && krokSuhrnu !== "koniec") {
                const fav = data.scorecards.find((sc) => sc.id === m.v.scorecard)?.favour ?? "BITKAR";
                const s: StarsiVLinii = {
                  elder: { elderId: m.v.elderId, karta: { uid: -1, defId: m.v.defId, leftLayout: 0, rightLayout: 0 }, scorecard: m.v.scorecard, strach: [0, 0], reci: [0, 0], reciOd: [0, 0], priazen: fav },
                  meno: m.v.meno,
                  obrazok: m.v.obrazok,
                  presvedcil: null,
                };
                return <TeplomerStarsieho key={m.v.elderId} s={vStaveKroku(s, x.e)} data={data} ja={ja} mena={mena} krok={null} zmeneny={false} nahlad={false} onNahlad={() => undefined} suhrn={x.karta} />;
              }
              return <KartaVazna key={m.v.elderId} v={m.v} data={data} ja={ja} mena={mena} vyhry={vyhry} nastenka={nastenka} tlmeny={suhrn !== undefined && (x === null || x.karta.tlmeny)} />;
            }
            const x = kartaSuhrnu(m.s.elder.elderId);
            return (
              <TeplomerStarsieho
                key={m.s.elder.elderId}
                s={x === null ? m.s : vStaveKroku(m.s, x.e)}
                data={data}
                ja={ja}
                mena={mena}
                krok={x === null ? krok : null}
                zmeneny={x === null && zmenene.has(m.s.elder.elderId)}
                nahlad={nahlad === m.s.elder.elderId}
                onNahlad={(n) => setNahlad(n ? m.s.elder.elderId : (y) => (y === m.s.elder.elderId ? null : y))}
                suhrn={x?.karta}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Pás súhrnu po bitke nad radom: výsledok a kroky; pod nimi veta kroku. */
function PasSuhrnu({ suhrn, krok }: { readonly suhrn: SuhrnNaLinii; readonly krok: KrokSuhrnu }) {
  const { bitka, kontext } = suhrn;
  const vysledok = bitka.vitaz === null ? t("linia.naSekeru") : t("linia.vitaz", { meno: kontext.mena[bitka.vitaz] });
  return (
    <div className="r3-pas-suhrnu" role="group" aria-label={t("linia.suhrnPoBitke", { n: bitka.kolo })}>
      <span className="r3-ps-bitka">
        {t("linia.bitkaN", { n: bitka.kolo })} · <b className={bitka.vitaz === null ? undefined : "vyhra"}>{vysledok}</b>
      </span>
      <span className="r3-ps-kroky" aria-hidden="true">
        {bitka.kroky.map((k, i) => (
          <span key={k} className={i === suhrn.krok ? "on" : i < suhrn.krok ? "bol" : undefined}>
            {i + 1} {NAZOV_KROKU[k]}
          </span>
        ))}
      </span>
      <span className="r3-ps-opis" aria-live="polite">
        <b>
          {suhrn.krok + 1}. {NAZOV_KROKU[krok]}:
        </b>{" "}
        {opisKroku(bitka, krok, kontext)}
      </span>
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
    const kto = p === ja ? t("stol.ty") : kratkeMeno(mena[p]);
    const popis = t("linia.popisVyhier", { kto: p === ja ? t("starsi.Ty") : mena[p], titul: textCervenych(c, v, vyhry.cervenychNaVyhru).titul, v, z: vyhry.vazniNaVyhru });
    return (
      <span className={`tp-vyhry ${p === ja ? "ja" : "su"}${hrozi ? " hrozi" : ""}`} role="img" aria-label={popis} title={popis}>
        <span className="tp-vyhry-kto">{kto}</span>
        <span className="tp-pipy" aria-hidden="true">
          {Array.from({ length: vyhry.cervenychNaVyhru }, (_, i) => (
            <i key={i} className={i < c ? "on" : ""} />
          ))}
        </span>
        <b>{textCervenych(c, v, vyhry.cervenychNaVyhru).odznak}</b>
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

/** Súhrn po bitke na jednej karte staršieho: stav v kroku, predošlý stav pre pohyb a štítky. */
export interface SuhrnKarty {
  /** Kľúč kroku — nový krok kartu prekreslí, nech sa pohyb prehrá znova. */
  readonly kluc: string;
  readonly od: Markery | null;
  /** Prerušovaná hladina spred bitky (posledný krok). */
  readonly duch: boolean;
  readonly tlmeny: boolean;
  readonly stitky: readonly StitokSuhrnu[];
  readonly riadky: readonly string[];
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
  suhrn,
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
  readonly suhrn?: SuhrnKarty | undefined;
}) {
  const su = opponentOf(ja);
  const { elder, klik } = s;
  const r = s.rozdelenie;
  const po = s.po ?? elder;
  const fav = favourStarsieho(data, elder);
  const pk = priazenKola(po, ja);
  const rod = rodStarsieho(elder.karta.defId, s.meno);
  const kratke: readonly [string, string] = [kratkeMeno(mena[0]), kratkeMeno(mena[1])];
  const napoveda = useNapovedaStarsieho(
    () =>
      obsahNapovedy({
        data,
        elder: po,
        meno: s.meno,
        ja,
        mena,
        akcia: klik?.akcia ?? null,
        dalsi: s.presvedcil === null ? null : { nazov: t("linia.presvedceny"), text: t("linia.presvedcilHo", { kto: kratke[s.presvedcil.kto] }) },
      }),
    { obrazok: s.obrazok, zvacsenina: () => <Zvacsenina s={s} fav={fav} pk={pk} /> },
  );

  // Rozdeľovanie: klik na portrét pridá stupeň nad najvyšší vybraný (veľký cieľ pre prst).
  const dalsiStupen = r?.stupne.find((x) => x.stav === "dosah");
  const klikKarty = r !== undefined ? (dalsiStupen === undefined ? undefined : () => r.klik(dalsiStupen.stupen)) : klik?.klik;
  const krokTrieda =
    r !== undefined
      ? ` rozdel${r.zdvih !== null ? " s-posunom" : ""}${dalsiStupen === undefined && r.zdvih === null && s.vybrany !== true && s.akcia === undefined ? " mrtvy" : ""}${s.vybrany === true ? " vybrany" : ""}`
      : krok === null
        ? ""
        : s.vybrany === true
          ? " vybrany"
          : klik !== undefined
            ? ` klik${nahlad ? " nahl" : ""}`
            : " nedost";
  // v11.12: reči ležia na súperovom teplomere, stupeň hráča je jeho strach.
  const slovo = (h: PlayerId): string => slovoStupna(elder.strach[h], rod);
  const popis =
    t("linia.popisPriazen", { meno: s.meno, kto: ktoPriazen(pk, { ja: kratke[ja], su: kratke[su] }) }) +
    t("linia.popisStupne", { a: kratke[ja], stupenA: slovo(ja) + (elder.reci[ja] > 0 ? t("linia.reciZatvorka") : ""), b: kratke[su], stupenB: slovo(su) + (elder.reci[su] > 0 ? t("linia.reciZatvorka") : "") }) +
    (r?.zdvih != null
      ? r.marker === "strach"
        ? t("linia.navrhStrach", { z: slovoStupna(r.zdvih.z, rod), na: slovoStupna(r.zdvih.na, rod), cena: r.zdvih.cena })
        : t("linia.navrhReci", { z: slovoStupna(r.zdvih.z, rod), na: slovoStupna(r.zdvih.na, rod), cena: r.zdvih.cena })
      : "") +
    (s.dovod !== undefined ? ` — ${s.dovod}` : "") +
    (klik !== undefined && r === undefined ? t("linia.klikni", { akcia: klik.akcia }) : "");
  const zmeny = suhrn === undefined ? (s.zmeny ?? []) : [];
  const ktoMenil = new Set(zmeny.map((x) => x.kto));
  const farbaZmien = ktoMenil.size !== 1 ? "" : ktoMenil.has(ja) ? " moje" : " superove";

  return (
    <div
      className={`ls-sc tp-k${krokTrieda}${zmeneny ? " zmena" : ""}${suhrn?.tlmeny === true ? " suhrn-tlmeny" : ""}${suhrn !== undefined && !suhrn.tlmeny ? " suhrn-svieti" : ""}`}
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
                if (e.target instanceof Element && e.target.closest(".r3-seg") !== null) return;
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
          {/* Nový kľúč v každom kroku súhrnu prehrá pohyb znova; súrodenci potrebujú každý iný kľúč. */}
          <TeplomerR3
            key={suhrn === undefined ? undefined : `tp-${suhrn.kluc}`}
            elderId={elder.elderId}
            ja={ja}
            v={po}
            pred={r !== undefined ? elder : (suhrn?.od ?? null)}
            duch={suhrn?.duch === true}
            mena={kratke}
            r={r}
            meno={s.meno}
            rod={rod}
            suhrn={suhrn !== undefined}
          />
          {suhrn !== undefined ? (
            suhrn.stitky.length > 0 && (
              <span className="r3-stitky" key={`st-${suhrn.kluc}`}>
                {suhrn.stitky.map((x, i) => (
                  <span key={i} className={`r3-stitok ${x.trieda}`} style={{ "--d": `${0.2 + i * 0.15}s` } as CSSProperties}>
                    <span className="dlhe">{x.text}</span>
                    <span className="kratke">{x.kratko}</span>
                  </span>
                ))}
              </span>
            )
          ) : s.presvedcil !== null ? (
            <span className={`tp-ohrozenie ${s.presvedcil.kto === ja ? "ja" : "su"}`} title={t("linia.presvedcilTitul", { kto: kratke[s.presvedcil.kto] })}>
              ✦ {t("linia.presvedcil", { kto: kratke[s.presvedcil.kto] })}
            </span>
          ) : zmeny.length > 0 ? (
            <span className={`ls-listok tp-zmeny${farbaZmien}`}>⇄ {stitokZmien(zmeny)}</span>
          ) : null}
          {r?.zdvih != null && <span className="tp-cena-navrhu">−{r.zdvih.cena}</span>}
          {s.akcia !== undefined && suhrn === undefined && <PeciatkaAkcie a={s.akcia} elderId={elder.elderId} meno={s.meno} rod={rod} />}
          <KruzokPriazne key={suhrn === undefined ? undefined : `kr-${suhrn.kluc}`} fav={fav} p={pk} trieda={`ls-kruzok tp-kruzok${suhrn?.od != null && !rovnakaPriazen(suhrn.od, po) ? " nove" : ""}`} />
        </span>
      </div>
      <span className="ls-stav tp-stav" aria-hidden="true">
        <b className="ls-meno">{s.meno}</b>
        {suhrn !== undefined ? (
          <span className="r3-riadky suhrn">
            {suhrn.riadky.slice(0, 3).map((x, i) => (
              <span key={i}>{x}</span>
            ))}
          </span>
        ) : (
          <span className="r3-riadky">
            {([ja, su] as const).map((h) => (
              <RiadokStupna key={h} kto={kratke[h]} komu={h === ja ? "ja" : "su"} strach={po.strach[h]} reci={po.reci[h]} rod={rod} />
            ))}
          </span>
        )}
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
 * Pečiatka ZAJAŤ / PRESVEDČIŤ na staršom (v11.6, Michal 2026-11-03) namiesto tlačidiel v bubline:
 * pred klikom tlmený obrys s celou cenou, po kliku plný odtlačok ZAJATÝ / PRESVEDČENÝ (ten istý
 * jazyk ako V PIVNICI a moment NA EX!); ďalší klik ju vráti. Udalosti ďalej nepúšťa — klik na
 * pečiatku nesmie zdvihnúť stupeň v teplomeri ani podržanie otvoriť zväčšeninu.
 */
function PeciatkaAkcie({ a, elderId, meno, rod, vPulte = false }: { readonly a: AkciaStarsieho; readonly elderId: string; readonly meno: string; readonly rod: Rod; readonly vPulte?: boolean }) {
  const zajat = a.druh === "zajat";
  const nazov = zajat ? t("linia.zajat") : t("linia.presvedcit");
  const hotovo = zajat ? (rod === "z" ? t("linia.zajata") : t("linia.zajaty")) : rod === "z" ? t("linia.presvedcena") : t("linia.presvedcenyVelke");
  const zastav = (e: { readonly stopPropagation: () => void }): void => e.stopPropagation();
  return (
    <button
      type="button"
      className={`tp-peciatka-akcie ${a.druh}${a.zapnuta ? " on" : ""}${vPulte ? " v-pulte" : ""}`}
      aria-pressed={a.zapnuta}
      aria-label={a.zapnuta ? t("linia.akciaZapnuta", { meno, hotovo: hotovo.toLowerCase(), cena: a.cena }) : zajat ? t("linia.zajatZa", { meno, cena: a.cena }) : t("linia.presvedcitZa", { meno, cena: a.cena })}
      title={a.zapnuta ? t("linia.klikZrusi", { nahlad: a.nahlad }) : a.nahlad}
      data-vyucba={`${a.druh}:${elderId}`}
      onPointerDown={zastav}
      onKeyDown={zastav}
      onClick={(e) => {
        e.stopPropagation();
        a.klik();
      }}
    >
      {a.zapnuta ? (
        <b>{hotovo}</b>
      ) : (
        <>
          <b>{nazov}</b>
          <span className="cena">−{a.cena}</span>
        </>
      )}
    </button>
  );
}

const rovnakaPriazen = (a: Markery, b: Markery): boolean => priazenHraca(a) === priazenHraca(b) && priazenSila(a) === priazenSila(b);

/** Riadok pod menom staršieho: meno hráča, štvorčeky strachu a rečí a stupeň slovom (strach, v11.12). */
function RiadokStupna({ kto, komu, strach, reci, rod }: { readonly kto: string; readonly komu: "ja" | "su"; readonly strach: number; readonly reci: number; readonly rod: Rod }) {
  const vrchol = strach;
  return (
    <span className={`r3-riadok ${komu}`}>
      <b className="kto">{kto}</b>
      {vrchol === 0 && reci === 0 ? (
        <span className="np-st s0">{slovoStupna(0, rod)}</span>
      ) : (
        <>
          {strach > 0 && <Stvorcek druh="strach" n={strach} />}
          {reci > 0 && <Stvorcek druh="reci" n={reci} />}
          <SlovoStupna n={vrchol} rod={rod} />
          {reci > 0 && <span className="r3-pozn">{t("linia.pomlckaReci")}</span>}
        </>
      )}
    </span>
  );
}

/** Výplň stupňa z pre hráča: plná (strach), alebo prázdny; šrafu súperových rečí kreslí blok. */
const vyplnStupna = (z: number, strach: number): "plna" | null => (z <= strach ? "plna" : null);

/**
 * Teplomery R3 „Okraje s hladinami“ (docs/napady/starsi-ram-mocky.html): pás hráča pri okraji
 * portrétu vo farbe hráča (ty vľavo, súper vpravo), strach plný, súperove reči šrafa na ňom. Od vrchu
 * strachu ide do stredu čiara hladiny s menom hráča, medzi hladinami zátvorka priazne so silou —
 * priazeň meria len plnú časť. `pred` = stav pred krokom (súhrn po bitke, nepotvrdený zdvih):
 * nové diely narastú, zmiznuté ostanú prerušované a hladina sa posunie.
 */
function TeplomerR3({
  elderId,
  ja,
  v,
  pred,
  duch,
  mena,
  r,
  meno,
  rod,
  suhrn,
}: {
  readonly elderId: string;
  readonly ja: PlayerId;
  readonly v: Markery;
  readonly pred: Markery | null;
  readonly duch: boolean;
  /** Krátke mená podľa miesta (0, 1). */
  readonly mena: readonly [string, string];
  readonly r?: RozdelenieStarsieho | undefined;
  readonly meno: string;
  readonly rod: Rod;
  /** V súhrne sa pohyb prehrá (rast, posun), pri rozdeľovaní len bliká návrh. */
  readonly suhrn: boolean;
}) {
  const su = opponentOf(ja);
  const pk = priazenKola(v, ja);
  const prPred = pred === null ? null : priazenKola(pred, ja);
  const prNova = prPred !== null && (prPred.komu !== pk.komu || prPred.sila !== pk.sila);
  const a = Math.min(v.strach[ja], v.strach[su]);
  const b = Math.max(v.strach[ja], v.strach[su]);
  const hladina = (h: PlayerId) => {
    const strana = h === ja ? "ja" : "su";
    const posun = pred !== null && pred.strach[h] !== v.strach[h];
    return (
      <span key={strana}>
        {posun && duch && <span className={`r3-hladina ${strana} duch`} style={{ "--h": pred.strach[h] } as CSSProperties} />}
        <span className={`r3-hladina ${strana}${posun && suhrn ? " posun" : ""}`} style={{ "--h": v.strach[h], "--h-od": pred?.strach[h] ?? v.strach[h] } as CSSProperties}>
          <b className="r3-meno">{mena[h]}</b>
        </span>
      </span>
    );
  };
  return (
    <span className={`r3${r !== undefined ? ` rozdel ${r.marker}${r.marker === "reci" ? " na-supera" : ""}` : ""}`}>
      <PasR3 strana="ja" elderId={elderId} strach={v.strach[ja]} blok={blokReci(v, su)} blokPred={blokReci(pred ?? v, su)} pred={pred === null ? null : { strach: pred.strach[ja] }} r={r?.marker === "reci" ? undefined : r} meno={meno} rod={rod} suhrn={suhrn} />
      <PasR3 strana="su" elderId={elderId} strach={v.strach[su]} blok={blokReci(v, ja)} blokPred={blokReci(pred ?? v, ja)} pred={pred === null ? null : { strach: pred.strach[su] }} r={r?.marker === "reci" ? r : undefined} meno={meno} rod={rod} suhrn={suhrn} />
      {hladina(ja)}
      {hladina(su)}
      {pk.komu !== null && (
        <span className={`r3-zatvorka ${pk.komu}${prNova && suhrn ? " vyskoc" : ""}${prNova ? " nova" : ""}`} style={{ "--a": a, "--b": b } as CSSProperties}>
          <b>+{pk.sila}</b>
        </span>
      )}
    </span>
  );
}

/** Jeden pás hráča: tri stupne zdola; v rozdeľovaní sú stupne tlačidlá s cenou. */
function PasR3({
  strana,
  elderId,
  strach,
  blok,
  blokPred,
  pred,
  r,
  meno,
  rod,
  suhrn,
}: {
  readonly strana: "ja" | "su";
  readonly elderId: string;
  readonly strach: number;
  /** Súperove reči na tomto teplomere a ich stav pred krokom (v11.12): šrafa cez strach. */
  readonly blok: { readonly od: number; readonly vrch: number } | null;
  readonly blokPred: { readonly od: number; readonly vrch: number } | null;
  readonly pred: { readonly strach: number } | null;
  readonly r?: RozdelenieStarsieho | undefined;
  readonly meno: string;
  readonly rod: Rod;
  readonly suhrn: boolean;
}) {
  return (
    // Kľúče výučby: môj teplomer strach:<id>, pri rozdeľovaní rečí reci:<id>; stupne stupen:<id>:<n>.
    <span className={`r3-pas ${strana}`} data-vyucba={strana === "ja" ? `${r?.marker === "reci" ? "reci" : "strach"}:${elderId}` : undefined}>
      {([3, 2, 1] as const).map((z) => {
        const st = r?.stupne.find((x) => x.stupen === z);
        const teraz = vyplnStupna(z, strach);
        const predtym = pred === null ? teraz : vyplnStupna(z, pred.strach);
        const zmena = teraz !== predtym;
        const srafa = blok !== null && z >= blok.od && z <= blok.vrch;
        const srafaPred = blokPred !== null && z >= blokPred.od && z <= blokPred.vrch;
        const trieda = `r3-seg z${z}${(zmena && teraz !== null) || (srafa && !srafaPred) ? " nove" : ""}${(zmena && predtym !== null && teraz === null) || (srafaPred && !srafa) ? " duch" : ""}${st !== undefined ? ` ${st.stav}` : ""}`;
        const obsah = (
          <>
            {zmena && predtym !== null && <i className={`r3-vypln ${predtym}${suhrn ? " mizne" : " stara"}`} />}
            {teraz !== null && <i className={`r3-vypln ${teraz}${zmena && suhrn ? " rast" : ""}`} style={{ "--d": `${0.15 + (z - 1) * 0.18}s` } as CSSProperties} />}
            {srafaPred && !srafa && <i className={`r3-vypln srafa${suhrn ? " mizne" : " stara"}`} />}
            {srafa && <i className={`r3-vypln srafa${!srafaPred && suhrn ? " rast" : ""}`} style={{ "--d": `${0.15 + (3 - z) * 0.18}s` } as CSSProperties} />}
            {st !== undefined && st.stav === "dosah" && <em className="r3-cena">{st.cena}</em>}
          </>
        );
        if (st === undefined || r === undefined || st.stav === "pod" || st.stav === "zamknuty") {
          return (
            <span key={z} className={trieda}>
              {obsah}
            </span>
          );
        }
        const jeStrach = r.marker === "strach";
        const stupen = slovoStupna(z, rod);
        const label =
          st.stav === "vybrany"
            ? z === r.zdvih?.na
              ? jeStrach
                ? t("linia.vratitStrach", { meno })
                : t("linia.vratitReci", { meno })
              : jeStrach
                ? t("linia.strachLenPo", { meno, stupen })
                : t("linia.reciLenPo", { meno, stupen })
            : st.stav === "dosah"
              ? jeStrach
                ? t("linia.strachPoZa", { meno, stupen, cena: st.cena })
                : t("linia.reciPoZa", { meno, stupen, cena: st.cena })
              : t("linia.nestaci", { meno, stupen, cena: st.cena });
        return (
          <button key={z} type="button" className={trieda} data-vyucba={`stupen:${elderId}:${z}`} aria-label={label} title={label} aria-disabled={st.stav === "mimo"} aria-pressed={st.stav === "vybrany"} onClick={() => r.klik(z)}>
            {obsah}
          </button>
        );
      })}
    </span>
  );
}

/**
 * Väzeň na mieste ukazovateľa (R3, Michal 2026-11-02): bez teplomerov a mreží, len pečiatka
 * „V PIVNICI u …“ vo farbe držiteľa; v nápovede „je z neho stále vydesený“, krádež a schopnosť väzňa.
 * Pod pečiatkou tlačidlo schopnosti (vlastný väzeň) alebo značka „použitá“ (v11.2).
 */
function KartaVazna({
  v,
  data,
  ja,
  mena,
  vyhry,
  nastenka,
  tlmeny,
}: {
  readonly v: VazenVLinii;
  readonly data: GameData;
  readonly ja: PlayerId;
  readonly mena: readonly [string, string];
  readonly vyhry: StavVyhier;
  readonly nastenka: readonly Pick<BitkaNaNastenke, "kolo" | "bodovanie" | "kradez">[];
  readonly tlmeny?: boolean;
}) {
  const kto = kratkeMeno(mena[v.hrac]);
  // Krádež na pečiatke (Michal 2026-11-02): koľko špakov držiteľ pri zajatí dostal.
  const kradez = kradezPriZajati(nastenka, v.elderId, v.hrac);
  const rod = rodStarsieho(v.defId, v.meno);
  const napoveda = useNapovedaStarsieho(
    () =>
      obsahNapovedyVazna({
        data,
        vazen: { elderId: v.elderId, hrac: v.hrac, karta: { uid: -1, defId: v.defId, leftLayout: 0, rightLayout: 0 }, scorecard: v.scorecard, ...(v.pouzita === true ? { pouzita: true as const } : {}) },
        meno: v.meno,
        ja,
        mena,
        vyhry,
        nastenka,
      }),
    { obrazok: v.obrazok, zvacsenina: () => <Zvacsenina s={{ meno: v.meno, obrazok: v.obrazok }} /> },
  );
  return (
    <div
      className={`ls-sc tp-k tp-vazen ${v.hrac === ja ? "ja" : "su"}${tlmeny === true ? " suhrn-tlmeny" : ""}`}
      {...spojUdalosti(napoveda.props, { tabIndex: 0, "aria-label": t("linia.vazenAria", { meno: v.meno, kto, stupen: slovoStupna(3, rod) }) })}
    >
      <div className="ls-telo">
        <span className="ls-portret">
          {v.obrazok !== null ? <img src={v.obrazok} alt="" draggable={false} /> : <span className="ls-portret-prazdny" />}
          <span className="tp-peciatka" role="img" aria-label={t("linia.vPivniciU", { kto }) + (kradez === null ? "" : ` · ${v.hrac === ja ? t("linia.vzalSi", { spaky: spakov(kradez.spaky) }) : t("linia.vzalTi", { spaky: spakov(kradez.spaky) })}`)}>
            <b>{t("linia.vPivnici")}</b>
            <span>{t("linia.uKoho", { kto })}</span>
            {kradez !== null && <small>{v.hrac === ja ? t("linia.vzalSi", { spaky: spakov(kradez.spaky) }) : t("linia.vzalTi", { spaky: spakov(kradez.spaky) })}</small>}
          </span>
        </span>
      </div>
      {v.schopnost !== undefined ? (
        <span className="tp-schopnost">{v.schopnost}</span>
      ) : (
        v.pouzita === true && (
          <span className="tp-schopnost pouzita" title={t("linia.schopnostMinuta")}>
            {t("linia.schopnostPouzita")}
          </span>
        )
      )}
      <span className="ls-stav tp-stav" aria-hidden="true">
        <b className="ls-meno">{v.meno}</b>
        <span className="r3-riadky">
          <span className={`r3-riadok ${v.hrac === ja ? "ja" : "su"}`}>
            <b className="kto">{kto}:</b> {t("linia.jeZNehoStale")} <SlovoStupna n={3} rod={rod} />
          </span>
        </span>
      </span>
      {napoveda.vrstva}
    </div>
  );
}

/** Zväčšenina staršieho na telefóne (podržanie prsta) — pod ňou je nápoveda. */
function Zvacsenina({ s, fav, pk }: { readonly s: Pick<StarsiVLinii, "meno" | "obrazok">; readonly fav?: ReturnType<typeof favourStarsieho>; readonly pk?: ReturnType<typeof priazenKola> }) {
  return (
    <span className="np-zoom-karta">
      <span className="np-zoom-portret">
        {s.obrazok !== null ? <img src={s.obrazok} alt="" draggable={false} /> : null}
        {fav !== undefined && pk !== undefined && <KruzokPriazne fav={fav} p={pk} velkost={46} />}
      </span>
      <b>{s.meno}</b>
    </span>
  );
}

/** Pipy stupnice v Pulte: strach plné štvorce, reči krúžok na svojom stupni. */
function Pipy({
  hodnota,
  reci,
  blok,
  blokPred,
  r,
  meno,
  zrkadlo,
}: {
  readonly hodnota: number;
  readonly reci: boolean;
  /** Blok rečí po návrhu a pred ním (v11.12); undefined = strach. */
  readonly blok?: { readonly od: number; readonly vrch: number } | null;
  readonly blokPred?: { readonly od: number; readonly vrch: number } | null;
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
        const v = (b: { readonly od: number; readonly vrch: number } | null): boolean => b !== null && z >= b.od && z <= b.vrch;
        const on = blok !== undefined ? v(blok) : po >= z;
        const novy = blok !== undefined ? !v(blokPred ?? null) : hodnota < z;
        const trieda = `z${z}${on ? " on" : ""}${on && novy ? " nove" : ""}${st !== undefined ? ` ${st.stav}` : ""}`;
        if (r === undefined || st === undefined || st.stav === "pod" || st.stav === "zamknuty") return <i key={z} className={trieda} />;
        const label = (reci ? t("linia.reciNa", { meno, zona: nazovZony(z) }) : t("linia.strachNa", { meno, zona: nazovZony(z) })) + (st.stav === "dosah" ? t("linia.za", { cena: st.cena }) : st.stav === "mimo" ? t("linia.zvysokNestaci") : "");
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
  const popis = p.komu === null ? t("priazen.nikomu", { ucinok: UCINOK_KRATKO[fav](1) }) : `${p.komu === "ja" ? t("stol.ty") : kratkeMeno(mena[opponentOf(ja)])}: ${UCINOK_KRATKO[fav](p.sila)}`;
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
            <th className="vlavo">{t("starsi.nazov")}</th>
            <th className="ja">{t("linia.tyStrach")}</th>
            <th className="ja">{t("linia.tyReci")}</th>
            <th>
              {t("linia.priazen")} <span className="ja">◀ {t("stol.ty")}</span> · <span className="su">{menoSu} ▶</span>
            </th>
            <th className="su">{t("linia.hracReci", { meno: menoSu })}</th>
            <th className="su">{t("linia.hracStrach", { meno: menoSu })}</th>
            <th className="ja" title={t("linia.spakyTvoje")}>
              {t("linia.tyVyhraPrehra")}
            </th>
            <th className="su" title={t("linia.spakySupera", { meno: mena[su] })}>
              {t("linia.hracVyhraPrehra", { meno: menoSu })}
            </th>
          </tr>
        </thead>
        <tbody>
          {rad.map((m) => {
            if (m.typ === "vazen") {
              return (
                <tr key={m.v.elderId} className="tp-pult-vazen">
                  <td className="vlavo">
                    <PultMeno meno={m.v.meno} obrazok={m.v.obrazok} pod={m.v.hrac === ja ? t("linia.vazenTvoj") : t("linia.vazenHraca", { meno: menoSu })} />
                  </td>
                  <td colSpan={7} className={m.v.hrac === ja ? "ja" : "su"}>
                    ⛓ {m.v.hrac === ja ? t("linia.vPivniciTeba") : t("linia.vPivniciHraca", { meno: menoSu })}
                  </td>
                </tr>
              );
            }
            const s = m.s;
            const e = s.elder;
            const po = s.po ?? e;
            const b = spakyStarsieho(po);
            const r = s.rozdelenie;
            const ohrozenie = s.presvedcil === null ? "" : ` · ✦ ${t("linia.presvedcil", { kto: s.presvedcil.kto === ja ? t("stol.ty") : menoSu })}`;
            return (
              <tr key={e.elderId} className={`${s.presvedcil !== null ? "ohrozeny" : ""}${r?.zdvih != null ? " s-posunom" : ""}`} data-vyucba={`starsi:${e.elderId}`}>
                <td className={`vlavo${s.akcia !== undefined ? " s-peciatkou" : ""}`}>
                  <PultMeno meno={s.meno} obrazok={s.obrazok} pod={`${stavStarsieho(stupenStavu(e))}${ohrozenie}`} />
                  {s.akcia !== undefined && <PeciatkaAkcie a={s.akcia} elderId={e.elderId} meno={s.meno} rod={rodStarsieho(e.karta.defId, s.meno)} vPulte />}
                </td>
                <td>
                  <Pipy hodnota={e.strach[ja]} reci={false} r={r?.marker === "strach" ? r : undefined} meno={s.meno} zrkadlo={false} />
                </td>
                <td>
                  <Pipy hodnota={e.reci[ja]} reci blok={blokReci(po, ja)} blokPred={blokReci(e, ja)} r={r?.marker === "reci" ? r : undefined} meno={s.meno} zrkadlo={false} />
                </td>
                <td>
                  <PriazenPultu e={po} data={data} ja={ja} mena={mena} />
                </td>
                <td>
                  <Pipy hodnota={e.reci[su]} reci blok={blokReci(e, su)} blokPred={blokReci(e, su)} meno={s.meno} zrkadlo />
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
            <td className="vlavo">{zmenene ? t("linia.spoluPoNavrhu") : t("linia.spolu")}</td>
            <td colSpan={2} className="ja" title={textCervenych(vyhry.cervene[ja], vyhry.vazni[ja], vyhry.cervenychNaVyhru).titul}>
              {t("starsi.cervene")} {textCervenych(vyhry.cervene[ja], vyhry.vazni[ja], vyhry.cervenychNaVyhru).kratko} · ⛓ {vyhry.vazni[ja]}/{vyhry.vazniNaVyhru}
            </td>
            <td />
            <td colSpan={2} className="su" title={textCervenych(vyhry.cervene[su], vyhry.vazni[su], vyhry.cervenychNaVyhru).titul}>
              {t("starsi.cervene")} {textCervenych(vyhry.cervene[su], vyhry.vazni[su], vyhry.cervenychNaVyhru).kratko} · ⛓ {vyhry.vazni[su]}/{vyhry.vazniNaVyhru}
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
  // Stav a presvedčenie v titulku — riadok Pultu musí ostať nízky (8 riadkov pri 1366 × 650).
  return (
    <span className="tp-pult-kto" title={`${meno} — ${pod}`}>
      {obrazok !== null ? <img src={obrazok} alt="" draggable={false} /> : <span className="tp-pult-obr" />}
      <span>
        <b>
          {meno}
          {pod.includes("✦") && <span className="tp-pult-ohr">✦</span>}
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
    kratko: sila > 0 ? UCINOK_KRATKO[fav](pri) : t("linia.priJedna", { ucinok: UCINOK_KRATKO[fav](pri) }),
    cely: sila > 0 ? t("linia.priazenSila", { sila, ucinok: UCINOK_PRIAZNE[fav](pri) }) : t("linia.priazenNikoho", { ucinok: UCINOK_PRIAZNE[fav](pri) }),
  };
}
