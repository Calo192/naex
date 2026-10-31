// Súhrn posunov starších pred výberom lokality (Michal 2026-10-30, mock 5 „Bublina pri dlaždici“;
// interview 2026-10-31). Stôl ostáva stolom: dlaždica Starší v bare hráča zasvieti, jej
// stĺpčekmi prejde svetlo zľava doprava a pri každom zobrazenom staršom vyskočí z jeho
// stĺpčeka bublina; stĺpček sa mení spolu s markerom v bubline. Tlačidlo príde po 2 s a len
// ono pokračuje — klik mimo nič nerobí. Po poslednom staršom ide hra rovno ďalej.
// Čo ukázať, ráta obsahSuhrnu.ts; tu je len poradie a kreslenie.

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { MarkerPos, PlayerId, Vazen } from "@naex/core";
import { KONSTANTY, STUPNICA_ZONY, cigariet, pocet } from "@naex/core";
import "./suhrn-posunov.css";
import { IKONY } from "../karta/ikony.ts";
import { IkonaPriazne } from "./IkonaPriazne.tsx";
import { IkonaSpaku } from "./IkonaSpaku.tsx";
import { ZnackaStrachu } from "./IkonaStrachu.tsx";
import { farbaZony } from "./LiniaStarsich.tsx";
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
  readonly polozky: readonly PolozkaSuhrnu[];
  /** Starší zo začiatku kola v poradí stĺpčekov dlaždice a ich markery vtedy. */
  readonly zaciatok: readonly { readonly elderId: string; readonly marker: MarkerPos }[];
  readonly ja: PlayerId;
  readonly mena: readonly [string, string];
  readonly vazni: readonly Vazen[];
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

export function SuhrnPosunov({ polozky, zaciatok, ja, mena, vazni, menoKarty, obrazok, mobil, posledne, onDlazdica, onKoniec }: SuhrnPosunovProps) {
  const rm = useMemo(bezPohybu, []);
  const cas = (ms: number): number => (rm ? 0 : ms);
  // Stĺpčeky dlaždice: starší zo začiatku kola; kto pribudol (zatiaľ nič také), ide na koniec.
  const poradie = useMemo(() => [...zaciatok.map((s) => s.elderId), ...polozky.map((p) => p.elderId).filter((id) => !zaciatok.some((s) => s.elderId === id))], [zaciatok, polozky]);
  const [stlpec, setStlpec] = useState(-1);
  const [faza, setFaza] = useState<"sken" | "bublina" | "odchod">("sken");
  const [odomknute, setOdomknute] = useState(false);
  const [marker, setMarker] = useState<MarkerPos | null>(null);
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
    const posun = polozka.posun;
    if (posun === null) setMarker(null);
    else if (rm) setMarker(posun.na);
    else {
      // Marker ide po poliach; stĺpček v dlaždici s ním (oba berú `marker`).
      setMarker(posun.z);
      const kroky = Math.abs(posun.na - posun.z);
      const smer = posun.na > posun.z ? 1 : -1;
      const krok = Math.min(420, 1100 / kroky);
      for (let i = 1; i <= kroky; i++) casovace.push(setTimeout(() => setMarker((posun.z + smer * i) as MarkerPos), PRICHOD_MS + krok * (i - 1)));
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
      setMarker(null);
      setStlpec((x) => x + 1);
    }, cas(ODCHOD_MS));
  };

  // Dlaždica: zobrazení starší majú marker po kole (väzeň zmizne), ten v bubline ide s markerom.
  useEffect(() => {
    const stlpce = poradie.map((elderId, i) => {
      const p = polozky.find((x) => x.elderId === elderId);
      const z = zaciatok.find((s) => s.elderId === elderId)?.marker ?? p?.elder?.marker ?? (3 as MarkerPos);
      if (p === undefined || i > stlpec) return { elderId, marker: z };
      if (i === stlpec) return { elderId, marker: p.vazen !== null ? (faza === "odchod" ? null : z) : (marker ?? z) };
      return { elderId, marker: p.vazen !== null ? null : (p.elder?.marker ?? z) };
    });
    onDlazdica({ stlpce, sken: idStlpca ?? null, aktivny: faza === "sken" || polozka === undefined ? null : polozka.elderId, preskoceni });
  }, [stlpec, marker, faza, preskoceni]);

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
          p={polozka}
          ja={ja}
          mena={mena}
          vazni={vazni}
          meno={menoKarty(polozka.defId)}
          obrazok={obrazok(polozka.defId)}
          marker={marker}
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
  p,
  ja,
  mena,
  vazni,
  meno,
  obrazok,
  marker,
  mobil,
  odchod,
  poradie,
  odomknute,
  tlacidlo,
  onDalej,
}: {
  readonly p: PolozkaSuhrnu;
  readonly ja: PlayerId;
  readonly mena: readonly [string, string];
  readonly vazni: readonly Vazen[];
  readonly meno: string;
  readonly obrazok: string | null;
  readonly marker: MarkerPos | null;
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
        <Cip key={i} d={d} ja={ja} mena={mena} vazni={vazni} />
      ))}
    </div>
  );
  const vazen = p.vazen;
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
              <IkonaMrezi />
            </span>
          )}
        </span>
        <b className="sb-meno">{meno}</b>
      </div>
      {p.posun !== null && <VelkaStupnica z={p.posun.z} marker={marker ?? p.posun.z} ja={ja} />}
      {/* Bez stupnice (výplata, Povera, väzeň) idú dôsledky do riadka s tlačidlom — bublina nie je naprázdno vysoká. */}
      {p.posun !== null && dosledkyEl}
      <div className={`sb-pata${p.posun === null ? " s-dosledkami" : ""}`}>
        {p.posun === null && dosledkyEl}
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

/** Stupnica pred → po: každý vidí svoju polovicu vľavo (ako línia starších), duch ostane na starom mieste. */
function VelkaStupnica({ z, marker, ja }: { readonly z: MarkerPos; readonly marker: MarkerPos; readonly ja: PlayerId }) {
  const poloha = (m: number): number => (ja === 0 ? m : 6 - m);
  const komu = marker < 3 ? 0 : marker > 3 ? 1 : null;
  return (
    <span className="sb-stupnica" aria-hidden="true">
      <span className="sb-kraj ja" />
      <span className="sb-kraj su" />
      {STUPNICA_ZONY.map((zona, k) => (
        <i key={k} style={{ background: farbaZony(zona), "--z": zona } as CSSProperties} />
      ))}
      {z !== marker && (
        <>
          <u className="sb-stopa" style={{ "--od": Math.min(poloha(z), poloha(marker)), "--do": Math.max(poloha(z), poloha(marker)) } as CSSProperties} />
          <b className="sb-marker duch" style={{ "--p": poloha(z) } as CSSProperties} />
        </>
      )}
      <b className={`sb-marker${komu === null ? "" : komu === ja ? " ja" : " su"}`} style={{ "--p": poloha(marker) } as CSSProperties}>
        {komu !== null && <IkonaPriazne />}
      </b>
    </span>
  );
}

function Cip({ d, ja, mena, vazni }: { readonly d: Dosledok; readonly ja: PlayerId; readonly mena: readonly [string, string]; readonly vazni: readonly Vazen[] }) {
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
      return cip("strach", `Bojí sa ${koho} — stupeň ${d.stupen}`, <ZnackaStrachu uroven={d.stupen} trieda={d.hrac === ja ? "moje" : "superove"} />);
    case "naUdrzanie":
      return cip(
        "udrzanie",
        `${pocet(d.spaky, "špak", "špaky", "špakov")} ${komu}, keď sa marker udrží do konca kola`,
        <>
          <IkonaSpaku />
          <b>+{d.spaky}</b>
          <IkonaHodin />
        </>,
      );
    case "zajatieMozne":
      return cip(
        "zajatie",
        `Stupeň 3 — ${d.hrac === ja ? "môžeš ho" : `${mena[d.hrac]} ho môže`} po šenku skúsiť zajať za ${cigariet(KONSTANTY.CENA_POKUSU)}`,
        <>
          <IkonaMrezi />
          <IkonaCigarety />
        </>,
      );
    case "vyplata":
      return cip(
        "vyplata",
        `Udržaný strach: ${pocet(d.spaky, "špak", "špaky", "špakov")} ${komu}`,
        <>
          <ZnackaStrachu uroven={d.stupen} trieda={d.hrac === ja ? "moje" : "superove"} />
          <IkonaSpaku />
          <b>+{d.spaky}</b>
        </>,
      );
    case "povera":
      return cip(
        "povera",
        `Povera: ${kto} — priazeň požičaná v bitke o ${d.stupne} ${d.stupne === 1 ? "stupeň" : "stupne"}`,
        <>
          <IkonaPovery />
          <IkonaPriazne />
          <b>+{d.stupne}</b>
        </>,
      );
    case "vazen": {
      const n = vazni.filter((v) => v.hrac === d.hrac).length;
      return cip(
        "vazen",
        `Uväznený — ${d.hrac === ja ? "tvoj" : `${mena[d.hrac]} má`} väzeň (${n} z ${KONSTANTY.VAZNI_NA_VYHRU})`,
        <>
          <IkonaMrezi />
          <b>
            {n}/{KONSTANTY.VAZNI_NA_VYHRU}
          </b>
        </>,
      );
    }
  }
}

function IkonaMrezi() {
  return (
    <svg className="sb-ikona" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 2.5h18v2.2H3zm0 16.8h18v2.2H3zM5 4.7h2.2v14.6H5zm4.1 0h2.2v14.6H9.1zm4.1 0h2.2v14.6h-2.2zm4.1 0H19.5v14.6h-2.2z" />
    </svg>
  );
}

function IkonaHodin() {
  return (
    <svg className="sb-ikona hodiny" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 2h12v2h-1.4c0 3.1-1.9 4.7-3.5 6 1.6 1.3 3.5 2.9 3.5 6V20H18v2H6v-2h1.4v-4c0-3.1 1.9-4.7 3.5-6-1.6-1.3-3.5-2.9-3.5-6H6zm3.4 2c0 2.2 1.3 3.3 2.6 4.4 1.3-1.1 2.6-2.2 2.6-4.4zm2.6 9.6c-1.3 1.1-2.6 2.2-2.6 4.4v2h5.2v-2c0-2.2-1.3-3.3-2.6-4.4z" />
    </svg>
  );
}

function IkonaPiktogramu({ kluc, trieda }: { readonly kluc: "Povera" | "Cigareta"; readonly trieda: string }) {
  return (
    <svg className={`sb-ikona ${trieda}`} viewBox="0 0 100 100" aria-hidden="true">
      {IKONY[kluc].map((c, i) => (
        <path key={i} d={c.d} fillRule={c.evenOdd ? "evenodd" : "nonzero"} />
      ))}
    </svg>
  );
}

const IkonaPovery = () => <IkonaPiktogramu kluc="Povera" trieda="povera" />;
const IkonaCigarety = () => <IkonaPiktogramu kluc="Cigareta" trieda="cigareta" />;
