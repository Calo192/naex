// Súhrn kola pri starších pred výberom lokality (Michal 2026-10-30, mock 5 „Bublina pri dlaždici“;
// interview 2026-10-31; v11 Strach a reči — teplomery pred → po namiesto stupnice). Stôl ostáva stolom: dlaždica Starší v bare hráča zasvieti, jej
// stĺpčekmi prejde svetlo zľava doprava a pri každom zobrazenom staršom vyskočí z jeho
// stĺpčeka bublina; stĺpček sa mení spolu s markerom v bubline. Tlačidlo príde po 2 s a len
// ono pokračuje — klik mimo nič nerobí. Po poslednom staršom ide hra rovno ďalej.
// Čo ukázať, ráta obsahSuhrnu.ts; tu je len poradie a kreslenie.

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { ElderState, GameData, PlayerId, Stupen, Vazen } from "@naex/core";
import { KONSTANTY, cigariet, favourStarsieho, pocet, opponentOf } from "@naex/core";
import "./suhrn-posunov.css";
import { IkonaMrezi } from "./ikonyZdrojov.tsx";
import { IKONY } from "../karta/ikony.ts";
import { IkonaPriazne } from "./IkonaPriazne.tsx";
import { IkonaSpaku } from "./IkonaSpaku.tsx";
import { ZnackaStrachu } from "./IkonaStrachu.tsx";
import { farbaZony } from "./LiniaStarsich.tsx";
import { IkonaHadky, KruzokPriazne } from "./KruzokPriazne.tsx";
import { ktoPriazen, kratkeMeno, priazenKola, type PriazenKola } from "./priazenKola.ts";
import { nazovStupna } from "./textyStarsich.ts";
import { spakyStupna } from "./teplomery.ts";

const textPriazne = (p: PriazenKola, menoSupera: string): string => ktoPriazen(p, { ja: "ty", su: kratkeMeno(menoSupera) });
import type { SuhrnDlazdice } from "./Starsi.tsx";
import { dosledky, type Dosledok, type PolozkaSuhrnu } from "./obsahSuhrnu.ts";

/** Pauza pri každom staršom, kým príde tlačidlo (Michal 2026-10-31). */
export const PAUZA_SUHRNU_MS = 2000;
/** Svetlo na nepohnutom stĺpčeku. */
const SKEN_MS = 170;
const UVOD_MS = 600;
const PRICHOD_MS = 380;
const ODCHOD_MS = 300;

export interface SuhrnPosunovProps {
  readonly data: GameData;
  readonly polozky: readonly PolozkaSuhrnu[];
  /** Starší zo začiatku kola v poradí stĺpčekov dlaždice a ich strachy vtedy. */
  readonly zaciatok: readonly ({ readonly elderId: string } & Pick<ElderState, "strach">)[];
  readonly ja: PlayerId;
  readonly mena: readonly [string, string];
  readonly vazni: readonly Vazen[];
  /** Väzni na výhru (podľa ligy) — čip väzňa „1/3“. */
  readonly vazniNaVyhru: number;
  readonly menoKarty: (defId: string) => string;
  readonly obrazok: (defId: string) => string | null;
  readonly mobil: boolean;
  /** Text tlačidla pri poslednom staršom („Vybrať lokalitu“ obrancovi, inak „Ďalej“). */
  readonly posledne: string;
  /** Stav dlaždice Starší v bare hráča — kreslí ho Panely. */
  readonly onDlazdica: (d: SuhrnDlazdice) => void;
  readonly onKoniec: () => void;
}

const bezPohybu = (): boolean => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

export function SuhrnPosunov({ data, polozky, zaciatok, ja, mena, vazni, vazniNaVyhru, menoKarty, obrazok, mobil, posledne, onDlazdica, onKoniec }: SuhrnPosunovProps) {
  const rm = useMemo(bezPohybu, []);
  const cas = (ms: number): number => (rm ? 0 : ms);
  // Stĺpčeky dlaždice: starší zo začiatku kola; kto pribudol (zatiaľ nič také), ide na koniec.
  const poradie = useMemo(() => [...zaciatok.map((s) => s.elderId), ...polozky.map((p) => p.elderId).filter((id) => !zaciatok.some((s) => s.elderId === id))], [zaciatok, polozky]);
  const [stlpec, setStlpec] = useState(-1);
  const [faza, setFaza] = useState<"sken" | "bublina" | "odchod">("sken");
  const [odomknute, setOdomknute] = useState(false);
  // Bublina najprv ukáže teplomery pred kolom, po chvíli po ňom (stĺpček v dlaždici s nimi).
  const [poZmene, setPoZmene] = useState(false);
  const [preskoceni, setPreskoceni] = useState<ReadonlySet<string>>(new Set());
  const idStlpca = stlpec >= 0 ? poradie[stlpec] : undefined;
  const polozka = idStlpca === undefined ? undefined : polozky.find((p) => p.elderId === idStlpca);
  const zobrazenych = polozka === undefined ? polozky.filter((p) => poradie.indexOf(p.elderId) < stlpec).length : polozky.indexOf(polozka);
  const koniecRef = useRef(onKoniec);
  koniecRef.current = onKoniec;

  // Poradie: úvod → svetlo po stĺpčekoch → bublina (2 s, tlačidlo) → odchod → ďalší stĺpček.
  useEffect(() => {
    if (stlpec === -1) {
      const t = setTimeout(() => setStlpec(0), cas(UVOD_MS));
      return () => clearTimeout(t);
    }
    if (stlpec >= poradie.length) {
      const t = setTimeout(() => koniecRef.current(), cas(ODCHOD_MS));
      return () => clearTimeout(t);
    }
    if (polozka === undefined) {
      const id = poradie[stlpec]!;
      const t = setTimeout(() => {
        setPreskoceni((s) => new Set([...s, id]));
        setStlpec((x) => x + 1);
      }, cas(SKEN_MS));
      return () => clearTimeout(t);
    }
    setFaza("bublina");
    setOdomknute(false);
    const casovace: ReturnType<typeof setTimeout>[] = [setTimeout(() => setOdomknute(true), PAUZA_SUHRNU_MS)];
    if (!polozka.zmena || rm) setPoZmene(true);
    else {
      setPoZmene(false);
      casovace.push(setTimeout(() => setPoZmene(true), PRICHOD_MS + 400));
    }
    return () => casovace.forEach(clearTimeout);
    // Krok sa mení len so stĺpčekom.
  }, [stlpec]);

  const dalej = (): void => {
    if (!odomknute || faza !== "bublina") return;
    setFaza("odchod");
    setTimeout(() => {
      setFaza("sken");
      setOdomknute(false);
      setPoZmene(false);
      setStlpec((x) => x + 1);
    }, cas(ODCHOD_MS));
  };

  // Dlaždica: zobrazení starší majú strachy po kole (väzeň zmizne), ten v bubline ide s nimi.
  useEffect(() => {
    const stlpce = poradie.map((elderId, i) => {
      const p = polozky.find((x) => x.elderId === elderId);
      const zs = zaciatok.find((s) => s.elderId === elderId);
      const z: readonly [Stupen, Stupen] = zs?.strach ?? p?.pred.strach ?? [0, 0];
      if (p === undefined || i > stlpec) return { elderId, strach: z };
      const po = p.elder?.strach ?? z;
      if (i === stlpec) return { elderId, strach: p.vazen !== null ? (faza === "odchod" ? null : z) : poZmene ? po : z };
      return { elderId, strach: p.vazen !== null ? null : po };
    });
    onDlazdica({ stlpce, sken: idStlpca ?? null, aktivny: faza === "sken" || polozka === undefined ? null : polozka.elderId, preskoceni });
  }, [stlpec, poZmene, faza, preskoceni]);

  // Fokus ostane v súhrne (aria-modal): Tab a Shift+Tab vedú na tlačidlo, kým nie je, na clonu.
  // Klávesy stola (K, P, N, Esc…) nedôjdu ďalej a Enter či medzera mimo bubliny nič nestlačia.
  const clonaRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    clonaRef.current?.focus({ preventScroll: true });
    const ciel = (): HTMLElement | null => document.querySelector<HTMLElement>(".suhrn-bublina .sb-dalej") ?? clonaRef.current;
    const vBubline = (e: KeyboardEvent): boolean => e.target instanceof Element && e.target.closest(".suhrn-bublina") !== null;
    const zadrz = (e: KeyboardEvent): void => {
      e.stopImmediatePropagation();
      if (e.key === "Tab") {
        e.preventDefault();
        ciel()?.focus({ preventScroll: true });
      } else if (!vBubline(e) && (e.key === "Enter" || e.key === " ")) e.preventDefault();
    };
    window.addEventListener("keydown", zadrz, true);
    window.addEventListener("keyup", zadrz, true);
    return () => {
      window.removeEventListener("keydown", zadrz, true);
      window.removeEventListener("keyup", zadrz, true);
    };
  }, []);

  return (
    <>
      {/* Klik mimo tlačidla nič nerobí (Michal 2026-10-31) — clona ho zachytí. */}
      <div ref={clonaRef} className="suhrn-clona" tabIndex={-1} aria-hidden="true" />
      {polozka !== undefined && faza !== "sken" && (
        <Bublina
          key={polozka.elderId}
          data={data}
          p={polozka}
          ja={ja}
          mena={mena}
          vazni={vazni}
          vazniNaVyhru={vazniNaVyhru}
          meno={menoKarty(polozka.defId)}
          obrazok={obrazok(polozka.defId)}
          poZmene={poZmene}
          mobil={mobil}
          odchod={faza === "odchod"}
          poradie={{ i: zobrazenych + 1, n: polozky.length }}
          odomknute={odomknute}
          tlacidlo={zobrazenych + 1 === polozky.length ? posledne : "Ďalší starší"}
          onDalej={dalej}
        />
      )}
    </>
  );
}

function Bublina({
  data,
  p,
  ja,
  mena,
  vazni,
  vazniNaVyhru,
  meno,
  obrazok,
  poZmene,
  mobil,
  odchod,
  poradie,
  odomknute,
  tlacidlo,
  onDalej,
}: {
  readonly data: GameData;
  readonly p: PolozkaSuhrnu;
  readonly ja: PlayerId;
  readonly mena: readonly [string, string];
  readonly vazni: readonly Vazen[];
  readonly vazniNaVyhru: number;
  readonly meno: string;
  readonly obrazok: string | null;
  readonly poZmene: boolean;
  readonly mobil: boolean;
  readonly odchod: boolean;
  readonly poradie: { readonly i: number; readonly n: number };
  readonly odomknute: boolean;
  readonly tlacidlo: string;
  readonly onDalej: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [poloha, setPoloha] = useState<{ readonly left: number; readonly bottom: number; readonly sipka: number; readonly sirka: number } | null>(null);
  // Bublina stojí nad stĺpčekom v dlaždici Starší.
  useLayoutEffect(() => {
    const zmeraj = (): void => {
      // Mobil: spodný panel cez celú šírku (Michal 2026-10-31) — bar hráča býva pod okrajom okna.
      // Rozloženie môže byť širšie než obrazovka — panel sa drží viditeľnej časti (visualViewport).
      if (mobil) {
        const vv = window.visualViewport;
        const sirka = vv?.width ?? document.documentElement.clientWidth;
        const spodok = vv === null || vv === undefined ? 0 : Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        setPoloha({ left: vv?.offsetLeft ?? 0, bottom: spodok, sipka: -100, sirka });
        return;
      }
      const stlpec = document.querySelector<HTMLElement>(`[data-suhrn-stlpcek="${CSS.escape(p.elderId)}"]`);
      const dlazdica = stlpec?.closest<HTMLElement>(".zdroj-starsi") ?? null;
      const sirka = Math.min(560, window.innerWidth - 24);
      const d = dlazdica?.getBoundingClientRect();
      // Dlaždica mimo okna (posunutá stránka): bublina dole v strede, bez šípky.
      if (stlpec === null || d === undefined || d.top > window.innerHeight - 60 || d.top < 200) {
        setPoloha({ left: (window.innerWidth - sirka) / 2, bottom: 12, sipka: -100, sirka });
        return;
      }
      // Poloha podľa dlaždice, nie stĺpčeka — medzi staršími sa hýbe len šípka.
      const s = stlpec.getBoundingClientRect();
      const stred = s.left + s.width / 2;
      const left = Math.max(12, Math.min(d.left + d.width / 2 - 110, window.innerWidth - sirka - 12));
      setPoloha({ left, bottom: window.innerHeight - d.top + 14, sipka: stred - left, sirka });
    };
    zmeraj();
    window.addEventListener("resize", zmeraj);
    window.visualViewport?.addEventListener("resize", zmeraj);
    window.visualViewport?.addEventListener("scroll", zmeraj);
    return () => {
      window.removeEventListener("resize", zmeraj);
      window.visualViewport?.removeEventListener("resize", zmeraj);
      window.visualViewport?.removeEventListener("scroll", zmeraj);
    };
  }, [p.elderId, mobil]);
  const tlacidloRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (odomknute) tlacidloRef.current?.focus();
  }, [odomknute]);
  const dosledkyEl = (
    <div className="sb-dosledky">
      {dosledky(p).map((d, i) => (
        <Cip key={i} d={d} ja={ja} mena={mena} vazni={vazni} vazniNaVyhru={vazniNaVyhru} />
      ))}
    </div>
  );
  const vazen = p.vazen;
  // Krúžok pri mene (Michal 2026-10-31): priazeň po kole; keď sa zmenila, aj „pred → po“.
  const e = p.elder;
  const fav = e === null ? null : favourStarsieho(data, e);
  const pkPred = e === null ? null : priazenKola(p.pred, ja);
  const pkPo = e === null ? null : priazenKola(e, ja);
  const zmenaPriazne = pkPred !== null && pkPo !== null && (pkPred.komu !== pkPo.komu || pkPred.sila !== pkPo.sila);
  const menoSu = mena[opponentOf(ja)];
  return (
    <div
      ref={ref}
      className={`suhrn-bublina${mobil ? " mobil" : ""}${odchod ? " odchod" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={`Súhrn kola — ${meno} (${poradie.i} z ${poradie.n})`}
      style={
        {
          left: poloha?.left ?? 12,
          bottom: poloha?.bottom ?? 12,
          width: poloha?.sirka,
          "--sipka": `${poloha?.sipka ?? -100}px`,
          visibility: poloha === null ? "hidden" : undefined,
        } as CSSProperties
      }
    >
      <div className="sb-hlava">
        <span className="sb-portret">
          {obrazok !== null ? <img src={obrazok} alt="" draggable={false} /> : <span className="sb-portret-prazdny" />}
          {vazen !== null && (
            <span className={`sb-mreze ${vazen.hrac === ja ? "ja" : "su"}`}>
              <IkonaMrezi className="sb-ikona" />
            </span>
          )}
        </span>
        <b className="sb-meno">{meno}</b>
        {fav !== null && pkPred !== null && pkPo !== null && (
          <span className="sb-kruzky" role="img" aria-label={zmenaPriazne ? `Priazeň pred kolom ${textPriazne(pkPred, menoSu)}, po kole ${textPriazne(pkPo, menoSu)}` : `Priazeň ${textPriazne(pkPo, menoSu)}`}>
            {zmenaPriazne && (
              <>
                <KruzokPriazne fav={fav} p={pkPred} velkost={mobil ? 30 : 36} />
                <span className="sb-sipka" aria-hidden="true">→</span>
              </>
            )}
            <KruzokPriazne fav={fav} p={pkPo} velkost={mobil ? 30 : 36} />
          </span>
        )}
      </div>
      {p.zmena && e !== null && <TeplomerySuhrnu pred={p.pred} po={poZmene ? e : p.pred} ja={ja} menoSu={kratkeMeno(menoSu)} />}
      {/* Bez teplomerov (bodovanie, väzeň) idú dôsledky do riadka s tlačidlom — bublina nie je naprázdno vysoká. */}
      {p.zmena && e !== null && dosledkyEl}
      <div className={`sb-pata${!p.zmena || e === null ? " s-dosledkami" : ""}`}>
        {(!p.zmena || e === null) && dosledkyEl}
        {poradie.n > 1 && (
          <span className="sb-bodky" aria-hidden="true">
            {Array.from({ length: poradie.n }, (_, k) => (
              <i key={k} className={k + 1 < poradie.i ? "bolo" : k + 1 === poradie.i ? "teraz" : ""} />
            ))}
          </span>
        )}
        {odomknute ? (
          <button ref={tlacidloRef} type="button" className="pecat pecat-potvrd sb-dalej" onClick={onDalej}>
            {tlacidlo} ▸{poradie.n > 1 && <span className="sb-pocet">{`${poradie.i}/${poradie.n}`}</span>}
          </button>
        ) : (
          // Miesto tlačidla drží ubúdajúci pásik — bublina neposkočí, keď tlačidlo príde.
          <span className="medziobrazovka-caka sb-caka" style={{ "--caka-ms": `${PAUZA_SUHRNU_MS}ms` } as CSSProperties} aria-hidden="true">
            <span />
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Teplomery hráčov v bubline (v11): strach a reči pred kolom → po ňom, tvoj vľavo, súperov vpravo.
 * Stupne, ktoré v kole pribudli, sú šrafované; reči sú bublina s počtom špakov.
 */
function TeplomerySuhrnu({ pred, po, ja, menoSu }: { readonly pred: Pick<ElderState, "strach" | "reci">; readonly po: Pick<ElderState, "strach" | "reci">; readonly ja: PlayerId; readonly menoSu: string }) {
  const su = opponentOf(ja);
  const jeden = (p: PlayerId, kto: string) => (
    <span className={`sb-tep ${p === ja ? "ja" : "su"}`}>
      <span className="sb-tep-kto">{kto}</span>
      {([1, 2, 3] as const).map((z) => {
        const on = po.strach[p] >= z;
        const nove = on && pred.strach[p] < z;
        const reci = po.reci[p] === z;
        return (
          <span key={z} className={`sb-tep-seg${on ? " on" : ""}${nove ? " nove" : ""}`} style={on ? ({ background: farbaZony(z) } as CSSProperties) : undefined}>
            {reci && <b className={`sb-tep-reci${pred.reci[p] !== z ? " nove" : ""}`}>{spakyStupna(z)}</b>}
          </span>
        );
      })}
      <small className="sb-tep-text">
        strach {nazovStupna(po.strach[p])}
        {po.reci[p] > 0 ? ` · reči ${nazovStupna(po.reci[p])}` : ""}
      </small>
    </span>
  );
  return (
    <span className="sb-teplomery" aria-hidden="true">
      {jeden(ja, "ty")}
      {jeden(su, menoSu)}
    </span>
  );
}

function Cip({ d, ja, mena, vazni, vazniNaVyhru }: { readonly d: Dosledok; readonly ja: PlayerId; readonly mena: readonly [string, string]; readonly vazni: readonly Vazen[]; readonly vazniNaVyhru: number }) {
  const farba = d.hrac === ja ? "ja" : "su";
  const kto = d.hrac === ja ? "ty" : mena[d.hrac];
  const komu = d.hrac === ja ? "tebe" : mena[d.hrac];
  const koho = d.hrac === ja ? "teba" : mena[d.hrac];
  const cip = (trieda: string, popis: string, obsah: ReactNode): ReactNode => (
    <span className={`sb-cip ${farba} ${trieda}`} role="img" aria-label={popis} title={popis}>
      {obsah}
    </span>
  );
  switch (d.druh) {
    case "priazen":
      return cip(
        "priazen",
        `Priazeň: ${kto} +${d.sila}${d.bolo !== null ? ` (predtým +${d.bolo})` : ""}`,
        <>
          <IkonaPriazne />
          {d.bolo !== null && <s>+{d.bolo}</s>}
          <b>+{d.sila}</b>
        </>,
      );
    case "strataPriazne":
      return cip(
        "strata",
        `Stratená priazeň: ${kto} +${d.sila}`,
        <>
          <IkonaPriazne />
          <s>+{d.sila}</s>
        </>,
      );
    case "strach":
      return cip("strach", textDosledku(d, ja, mena, vazni, vazniNaVyhru), <ZnackaStrachu uroven={d.na} trieda={d.hrac === ja ? "moje" : "superove"} />);
    case "reci":
      return cip(
        "reci",
        textDosledku(d, ja, mena, vazni, vazniNaVyhru),
        <>
          <IkonaHadky trieda="sb-ikona" />
          {d.z > 0 && <s>{nazovStupna(d.z)}</s>}
          <b>{d.na === 0 ? "—" : nazovStupna(d.na)}</b>
        </>,
      );
    case "zajatieMozne":
      return cip(
        "zajatie",
        `Strach na červenej — ${d.hrac === ja ? "môžeš ho" : `${mena[d.hrac]} ho môže`} pred šenkom skúsiť zajať za ${cigariet(KONSTANTY.CENA_POKUSU)}`,
        <>
          <IkonaMrezi className="sb-ikona" />
          <IkonaCigarety />
        </>,
      );
    case "vyplata":
      return cip(
        "vyplata",
        `${pocet(d.spaky, "špak", "špaky", "špakov")} ${komu} za ${d.reci ? "reči" : "strach"} po bitke`,
        <>
          {d.reci ? <IkonaHadky trieda="sb-ikona" /> : <ZnackaStrachu uroven={1} trieda={d.hrac === ja ? "moje" : "superove"} />}
          <IkonaSpaku />
          <b>+{d.spaky}</b>
        </>,
      );
    case "vazen": {
      const n = vazni.filter((v) => v.hrac === d.hrac).length;
      return cip(
        "vazen",
        `Uväznený — ${d.hrac === ja ? "tvoj" : `${mena[d.hrac]} má`} väzeň (${n} z ${vazniNaVyhru})`,
        <>
          <IkonaMrezi className="sb-ikona" />
          <b>
            {n}/{vazniNaVyhru}
          </b>
        </>,
      );
    }
  }
}

function IkonaPiktogramu({ kluc, trieda }: { readonly kluc: "Cigareta"; readonly trieda: string }) {
  return (
    <svg className={`sb-ikona ${trieda}`} viewBox="0 0 100 100" aria-hidden="true">
      {IKONY[kluc].map((c, i) => (
        <path key={i} d={c.d} fillRule={c.evenOdd ? "evenodd" : "nonzero"} />
      ))}
    </svg>
  );
}

const IkonaCigarety = () => <IkonaPiktogramu kluc="Cigareta" trieda="cigareta" />;

export interface SuhrnPosunovTelefonProps {
  readonly data: GameData;
  readonly polozky: readonly PolozkaSuhrnu[];
  readonly kolo: number;
  readonly ja: PlayerId;
  readonly mena: readonly [string, string];
  readonly vazni: readonly Vazen[];
  readonly vazniNaVyhru: number;
  readonly menoKarty: (defId: string) => string;
  readonly obrazok: (defId: string) => string | null;
  readonly posledne: string;
  readonly onKoniec: () => void;
}

/** Ďalej sa odomkne až po chvíli — dvojťuk z predošlého okna by súhrn preskočil nevidený. */
const ZAMOK_TELEFONU_MS = 700;

/**
 * Súhrn posunov na telefóne (Michal 2026-10-31, oprava 5: bublina po jednom bola chaos): rovnaký vzor
 * ako súhrn bitky — hore pruh so žltým Ďalej na stálom mieste, pod ním jeden zoznam všetkých
 * starších naraz: pred → po slovami a dôsledky ako čipy s textom.
 */
export function SuhrnPosunovTelefon({ data, polozky, kolo, ja, mena, vazni, vazniNaVyhru, menoKarty, obrazok, posledne, onKoniec }: SuhrnPosunovTelefonProps) {
  const [odomknute, setOdomknute] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setOdomknute(true), ZAMOK_TELEFONU_MS);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="pocitadlo-bitky rk-telefon hotova suhrn-telefon" role="dialog" aria-modal="true" aria-label={`Starší po kole ${kolo}`}>
      <div className="rk-tel-pruh">
        <span className="rk-tel-hlava">
          <span className="rk-tel-nadpis">Starší po kole {kolo}</span>
          <span className="rk-tel-verdikt">{pocet(polozky.length, "zmena", "zmeny", "zmien")}</span>
        </span>
        <button type="button" className={`rk-dalej rk-tel-akcia${odomknute ? "" : " caka"}`} disabled={!odomknute} onClick={onKoniec}>
          {posledne}
        </button>
      </div>
      <div className="rk-tel-zoznam suhrn-tel-zoznam">
        {polozky.map((p) => {
          const o = obrazok(p.defId);
          const cipy = dosledky(p);
          const e = p.elder;
          const pz = e === null ? null : priazenKola(e, ja);
          return (
            <div key={p.elderId} className="st-riadok">
              <span className="st-portret">
                {o !== null ? <img src={o} alt="" draggable={false} /> : null}
                {/* Krúžok priazne po kole (Michal 2026-10-31) — vždy, aj na telefóne. */}
                {e !== null && pz !== null && <KruzokPriazne fav={favourStarsieho(data, e)} p={pz} velkost={22} popis={`priazeň po kole: ${textPriazne(pz, mena[opponentOf(ja)])}`} />}
              </span>
              <span className="st-telo">
                <span className="st-hlava">
                  <b>{menoKarty(p.defId)}</b>
                  <span className="st-posun">
                    {p.vazen !== null ? "uväznený" : p.zmena ? "zmena" : "bodoval"}
                  </span>
                </span>
                {cipy.length > 0 && (
                  <span className="st-cipy">
                    {cipy.map((d, i) => (
                      <span key={i} className={`st-cip ${d.hrac === ja ? "ja" : "su"}`}>
                        {textDosledku(d, ja, mena, vazni, vazniNaVyhru)}
                      </span>
                    ))}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Dôsledok slovami (telefón) — ikona bez popisu sa nedala prečítať (playtest 20261031-191322). */
export function textDosledku(d: Dosledok, ja: PlayerId, mena: readonly [string, string], vazni: readonly Vazen[], vazniNaVyhru: number): string {
  const kto = d.hrac === ja ? "ty" : mena[d.hrac];
  const komu = d.hrac === ja ? "tebe" : mena[d.hrac];
  const tvoj = d.hrac === ja ? "tvoj" : `${mena[d.hrac]} —`;
  switch (d.druh) {
    case "priazen":
      return `priazeň ${kto} ${d.sila}${d.bolo !== null && d.bolo !== d.sila ? ` (predtým ${d.bolo})` : ""}`;
    case "strataPriazne":
      return `${kto} prichádza o priazeň ${d.sila}`;
    case "strach":
      return `${tvoj} strach ${nazovStupna(d.z)} → ${nazovStupna(d.na)}`;
    case "reci":
      return `${d.hrac === ja ? "tvoje" : `${mena[d.hrac]} —`} reči ${nazovStupna(d.z)} → ${d.na === 0 ? "zanikli" : nazovStupna(d.na)}`;
    case "zajatieMozne":
      return `${d.hrac === ja ? "môžeš" : `${mena[d.hrac]} môže`} pred šenkom skúsiť zajať (${cigariet(KONSTANTY.CENA_POKUSU)})`;
    case "vyplata":
      return `+${d.spaky} š ${komu} za ${d.reci ? "reči" : "strach"} po bitke`;
    case "vazen":
      return `uväznený · väzeň ${d.hrac === ja ? "tvoj" : mena[d.hrac]} ${vazni.filter((v) => v.hrac === d.hrac).length}/${vazniNaVyhru}`;
  }
}
