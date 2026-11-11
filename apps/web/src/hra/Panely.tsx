// Panely hernej plochy: doska hráča (zdroje), odhad/výsledok bitky,
// priebeh kola. Ukazovatele starších sú v Scorecard.tsx.
//
// Zásada: každé číslo, od ktorého závisí rozhodnutie (poldeci, cigarety,
// pečeň, dlhy, poškodenie), je veľké, pomenované a vždy na tom istom mieste.

import { Fragment, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import type { Action, ActionSums, ClientState, DamageResult, Favour, GameData, NahladPitkyHraca, OdhadSpakov, PlayerId, RozpisPoskodenia, StavZavislosti, StavkaBitky as StavkaBitkyCisla, ZdrojeAkcii } from "@naex/core";
import { KONSTANTY, barterCena, battleOutcome, cenaFajceniaHraca, hraVPitke, jeCielLokalita, limitBuduceKolo, limitZhromazdenia, lokalitNevybranych, vidiVolbuSupera, opponentOf } from "@naex/core";
import { ZMENA_SVIETI_MS, klikKrokuOsi, krokPartie, minSek, textZmeny } from "./stitokPartie.ts";
import type { Rod } from "@naex/core";
import type { Sada } from "@naex/tvorba";
import { IkonaAkcie } from "../karta/IkonaAkcie.tsx";
import { IkonaCigareta, IkonaPoldeci } from "./ikonyZdrojov.tsx";
import { PeciatkaZdroja, RozpisZdroja, type PrisunDlazdice } from "./PeciatkaZdroja.tsx";
import { useTip, type TipObsah } from "../karta/Tip.tsx";
import { PilulkaPriazne } from "./KruzokPriazne.tsx";
import type { PriazenKola } from "./priazenKola.ts";
import { Avatar } from "../komponenty.tsx";
import { BarSpakov } from "./BarSpakov.tsx";
import { BarStarsich, DlazdicaStarsich, type DlazdicaStarsichProps } from "./Starsi.tsx";
import { KartaHraca } from "./KartaHraca.tsx";
import type { HracInfo } from "./useHra.ts";
import { PocetSpakov } from "./Spaky.tsx";
import { IkonaSpaku } from "./IkonaSpaku.tsx";
import { cenaPola, HODNOTA_POLA } from "./textyStarsich.ts";
import { naStoleVysvetlenie, poldeciNaStole, ukazZadlzenie, zadlzenieHrozi } from "./tabula.ts";
import { titulBezExekucie, hroziVyhraStrachom } from "./vyhraStrachom.ts";
import type { SpakyTeraz } from "@naex/core";
import { t, tr, tRod } from "../i18n/jazyk.tsx";
import { spakov } from "../i18n/pocty.ts";

// Ikony zdrojov a výmena „cena → zisk“ sú v ikonyZdrojov.tsx — bez ťažkých závislostí Panelov,
// aby ich mohli použiť aj malé komponenty testované bez prehliadača (KseftPodKartou).
export { CenaCigariet, CenaPoldeci, IkonaCigareta, IkonaKarty, IkonaPoldeci, Vymena } from "./ikonyZdrojov.tsx";

/** Absťák: prázdny pohárik v trasúcej sa ruke. */
export function IkonaAbstak() {
  return (
    <svg className="ikona-abstak" viewBox="0 0 30 30" aria-hidden="true">
      <path className="trasenie" d="M3 9q-2 3 0 6M5.5 7q-2.5 5 0 10M27 9q2 3 0 6M24.5 7q2.5 5 0 10" />
      <path className="pohar" d="M9 4h12l-1.8 21H10.8z" />
      <path className="kvapka" d="M15 13.5c-1.4 2-2 3-2 4a2 2 0 0 0 4 0c0-1-.6-2-2-4z" />
    </svg>
  );
}

// ---- doska hráča --------------------------------------------------------------

/**
 * Neresti kola proti latke Chuti (v9.1): dieliky po čiaru treba zaplniť, aby na konci
 * kola nepribudla karta Absťák; neresti za čiarou Chuť zvýšia.
 */
function NerestiPruh({ z }: { readonly z: StavZavislosti }) {
  const latka = Math.max(0, z.chut);
  const dieliky = Math.max(latka, z.teraz, 1);
  return (
    <span className="neresti-pruh" aria-hidden="true">
      {Array.from({ length: dieliky }, (_, i) => {
        const plny = i < z.teraz;
        const trieda = i < latka ? (plny ? "plny" : "chyba") : plny ? "plny" : "";
        return (
          <span key={i} className={trieda}>
            {i === latka && latka > 0 && <i className="ciara" />}
          </span>
        );
      })}
    </span>
  );
}

/** Krátky výhľad pod počítadlom a jeho trieda (farba). */
function vyhladChuti(z: StavZavislosti): { text: string; naDlazdici: string; trieda: string } {
  if (z.vyhlad !== "ziska") {
    const text = t("panel.poKoleChut", { n: z.chutPo });
    return { text, naDlazdici: text, trieda: "" };
  }
  // Na dlaždici bez „inak“: pri 1366 a 1440 sa celé varovanie skrátilo na „…+1 Ab…“.
  return { text: t("panel.chybaInak", { n: z.doBezpecia }), naDlazdici: t("panel.chyba", { n: z.doBezpecia }), trieda: "zly" };
}

/**
 * Chuť na doske (v9.1): latka nerestí, neresti kola, čo bude na konci kola a koľko
 * kariet Absťák má hráč v balíčku (každá −1 tuhé v bitke).
 */
function ZdrojChut({ z, ja }: { readonly z: StavZavislosti; readonly ja: boolean }) {
  const vyhlad = vyhladChuti(z);
  return (
    <Zdroj
      nazov={t("pult.chut")}
      trieda={`zdroj-abstak ${z.vyhlad === "ziska" ? "varovanie" : ""} ${z.abstaky > 0 ? "ma-abstak" : ""}`}
      ikona={<IkonaAbstak />}
      hodnota={
        <>
          <span className="velke-cislo">
            {z.chut}
            {z.abstaky > 0 && <small className="abstak-ubera"> {t("panel.abstakKrat", { n: z.abstaky })}</small>}
          </span>
          {/* Prúžok vedľa čísla — bar má pevnú výšku, pod číslom sú len dva krátke riadky. */}
          <NerestiPruh z={z} />
        </>
      }
      pod={
        <>
          <span className="neresti-pocet">{t("panel.dnes", { n: z.teraz })}</span>
          <span className={`abstak-vyhlad ${vyhlad.trieda}`}>{vyhlad.naDlazdici}</span>
        </>
      }
      tip={{
        nadpis: t("panel.chutAAbstak"),
        text: (
          <>
            <span className="tip-stav">
              {t("panel.chutStav", { chut: z.chut, dnes: z.teraz, vyhlad: vyhlad.text })}
              {z.abstaky > 0 &&
                ` · ${ja ? t("panel.abstakyJa", { n: z.abstaky, ubera: z.ubera }) : t("panel.abstakySu", { n: z.abstaky, ubera: z.ubera })}`}
            </span>
            {t("panel.chutPravidlo", { naex: KONSTANTY.NEREST_NAEX, ubytok: KONSTANTY.CHUT_UBYTOK })}
          </>
        ),
      }}
    />
  );
}

/**
 * Pruh z dielikov: koľko zostáva do prahu (pečeň → Cirhóza, Dlhy → Exekútor).
 * `pribudne` = čo pripíšu karty na stole pri vyhodnotení Pitky — šrafované
 * dieliky (dizajn hra-nezrovnalosti-20261021-1229: počítadlo ukazovalo len
 * „doteraz“ a Cirhóza prekvapila). Dieliky za prahom sú červené.
 */
function Pruh({ hodnota, prah, pribudne = 0 }: { readonly hodnota: number; readonly prah: number; readonly pribudne?: number }) {
  const spolu = hodnota + pribudne;
  const dieliky = Math.min(Math.max(prah, 1, spolu), Math.max(prah, 1) * 3);
  const blizko = spolu >= prah - 1;
  return (
    <span className={`pruh ${blizko ? "blizko" : ""}`} aria-hidden="true">
      {Array.from({ length: dieliky }, (_, i) => {
        const trieda = [i < hodnota ? "plny" : i < spolu ? "caka" : "", i >= prah && i < spolu ? "nad" : "", i > 0 && i % prah === 0 ? "prah" : ""];
        return <span key={i} className={trieda.join(" ").trim()} />;
      })}
    </span>
  );
}

/** Výhľad Pitky na doske hráča — čo hra vyhodnotí, ak sa na stole nič nezmení. */
export interface VyhladPitky {
  readonly nahlad: NahladPitkyHraca;
  /** „po Pitke“ (prebieha Pitka) alebo „do Pitky“ (Zhromaždenie pred ňou). */
  readonly vPitke: boolean;
  /** Pitky kola po tejto — NA EX a karty na stole sa v nich vyhodnotia znova. */
  readonly dalsiePitky: number;
  /** Špaky jednej kliatby navyše na konci hry (záporné; Cirhóza −SPAKY_ZA_CIRHOZU, Dlh 0). */
  readonly cenaCirhozy: number;
  readonly cenaDlhu: number;
  /**
   * Nové Dlhy z Pitiek kola po najbližšej bitke (návrh #1 B): koľko ich bitka
   * najviac spáli (Robota, Dievčina na vydaj) a koľko z nich ostane.
   */
  readonly dlhyBitka: { readonly pali: number; readonly ostane: number };
}

/** „ · −3 š“ — cena kliatby v špakoch na konci hry; Dlh na konci špaky neberie, vtedy nič. */
function bodov(n: number): string {
  return n === 0 ? "" : ` · ${n > 0 ? "+" : "−"}${Math.abs(n)} š`;
}

/** Čo vstupuje do výhľadu Pitky pod Pečeňou či Zadĺžením. */
interface VstupVyhladu {
  readonly kliatby: number;
  readonly meno: string;
  readonly cena: number;
  readonly opakovane: number;
  readonly dalsiePitky: number;
  readonly vPitke: boolean;
  /** Dlh: čo spáli najbližšia bitka — body sa rátajú len za Dlhy, ktoré ostanú. */
  readonly bitka?: { readonly pali: number; readonly ostane: number };
}

function pitkyKratko(n: number): string {
  return t("panel.dalsiePitky", { n });
}

/**
 * Výhľad Pitky: v dlaždici najviac dva krátke riadky, celé znenie do nápovedy
 * (Michal 2026-10-23: tri riadky sa do baru s pevnou výškou nezmestili, text
 * sa orezal a číslo prekrylo nadpis).
 */
function vyhladPitky(x: VstupVyhladu): { readonly kratke: readonly { readonly text: string; readonly zly: boolean }[]; readonly cele: readonly string[] } {
  const vsetky = x.kliatby + x.opakovane * x.dalsiePitky;
  const pitka = `${x.vPitke ? t("panel.poPitke") : t("panel.vPitke")}: ${x.kliatby > 0 ? `${x.meno} ×${x.kliatby}${x.bitka === undefined ? bodov(x.kliatby * x.cena) : ""}` : t("starsi.nic")}`;
  const dalsie = x.dalsiePitky > 0 && x.opakovane > 0 ? t("panel.znova", { n: x.dalsiePitky, k: x.opakovane }) : null;
  const poBitke =
    x.bitka === undefined || vsetky === 0
      ? null
      : (x.bitka.pali > 0 ? t("panel.bitkaSpali", { n: x.bitka.pali, k: x.bitka.ostane }) : t("panel.poBitkeOstanu", { k: x.bitka.ostane })) + bodov(x.bitka.ostane * x.cena);
  const kratke = [{ text: pitka, zly: x.kliatby > 0 }];
  // Druhý riadok: Dlh — čo ostane po bitke (zahŕňa aj ďalšie Pitky); Cirhóza — ďalšie Pitky.
  if (x.bitka !== undefined && poBitke !== null) kratke.push({ text: t("panel.poBitkeKrat", { k: x.bitka.ostane }) + bodov(x.bitka.ostane * x.cena), zly: x.bitka.ostane > 0 });
  else if (dalsie !== null) kratke.push({ text: `${pitkyKratko(x.dalsiePitky)}: ×${x.opakovane}`, zly: true });
  return { kratke, cele: [pitka, dalsie, poBitke].filter((t): t is string => t !== null) };
}

/** Riadky výhľadu pod počítadlom (krátke; celé v nápovede dlaždice). */
function TextVyhladu({ x }: { readonly x: VstupVyhladu }) {
  return (
    <>
      {vyhladPitky(x).kratke.map((r) => (
        <span key={r.text} className={`vyhlad ${r.zly ? "zly" : ""}`}>
          {r.text}
        </span>
      ))}
    </>
  );
}

/** Zdroj na doske; nápoveda sa ukáže pri prejdení myšou (ako tooltipy kariet). */
function Zdroj({
  nazov,
  hodnota,
  ikona,
  pod,
  trieda,
  roh,
  tip,
}: {
  readonly nazov: string;
  readonly hodnota: ReactNode;
  readonly ikona?: ReactNode;
  readonly pod?: ReactNode;
  readonly trieda?: string;
  /** Pečiatka v rohu dlaždice. */
  readonly roh?: ReactNode;
  readonly tip: TipObsah;
}) {
  const { tip: okno, ukaz, skry } = useTip();
  return (
    <div
      className={`zdroj ${trieda ?? ""}`}
      data-vyucba-prvok={/zdroj-([a-z]+)/.exec(trieda ?? "")?.[1]}
      tabIndex={0}
      onMouseEnter={(e) => ukaz(e.currentTarget, tip)}
      onMouseLeave={skry}
      onFocus={(e) => ukaz(e.currentTarget, tip)}
      onBlur={skry}
    >
      <span className="zdroj-nazov">{nazov}</span>
      <span className="zdroj-hodnota">
        {ikona}
        {hodnota}
      </span>
      {pod !== undefined && <span className="zdroj-pod">{pod}</span>}
      {roh}
      {okno}
    </div>
  );
}

/** Dlaždica KARTY (Michal 2026-10-23, #76): stav a cieľ priznania či Dedičstva. */
export interface KartyDlazdica {
  readonly otvorena: boolean;
  /** Otvorí vrstvu Karty (balíček, odhodené, priznané, Dedičstvo). */
  readonly otvor: () => void;
  /** Koľko kariet z ruky je v návrhu ťahu na priznanie či do Dedičstva. */
  readonly navrhy: number;
  /** Veľké číslo dlaždice: koľko hráč ešte vyloží, v Pitke limit ďalšieho Zhromaždenia. */
  readonly vylozi: { readonly cislo: number; readonly popis: string; readonly tip: string };
  /** Pri ťahaní (alebo vybranej) kliatbe či Nástroji je dlaždica cieľom. */
  readonly ciel: {
    readonly nazov: string;
    readonly pozn: string;
    /** Prečo karta sem teraz nesmie (napr. chýbajú cigarety). */
    readonly zamknute: string | null;
    readonly aktivny: boolean;
    readonly nad: boolean;
    readonly dataCiel: string | undefined;
    readonly onKlik: (() => void) | undefined;
  } | null;
}

function DlazdicaKariet({ hrac, ja, karty }: { readonly hrac: ClientState["hraci"][number]; readonly ja: boolean; readonly karty: KartyDlazdica }) {
  const { tip: okno, ukaz, skry } = useTip();
  const c = karty.ciel;
  const tip: TipObsah = {
    nadpis: t("nav.karty"),
    text: (
      <>
        <span className="tip-stav">
          {karty.vylozi.tip} ·{" "}
          {t("panel.kartyStav", { ruka: hrac.rukaPocet, balicek: hrac.doberaciPocet, odhodene: hrac.odhadzovaci.length, priznane: hrac.priznane.length, naradie: hrac.dedicstvo.length })}
        </span>
        {ja ? t("panel.kartyKlikJa") : t("panel.kartyKlikSu")}
      </>
    ),
  };
  const aktivuj = c?.onKlik ?? karty.otvor;
  return (
    <div
      className={[
        "zdroj zdroj-karty karty-dlazdica",
        c !== null ? "ako-ciel" : "",
        c?.aktivny === true ? "ciel-zona" : "",
        c?.nad === true ? "nad-cielom" : "",
        c?.zamknute != null ? "zamknuta" : "",
        karty.otvorena ? "otvorena" : "",
      ].join(" ")}
      data-ciel={c?.dataCiel}
      data-skratka={ja ? "o" : undefined}
      data-vyucba-prvok="karty"
      role="button"
      tabIndex={0}
      aria-expanded={karty.otvorena}
      aria-keyshortcuts={ja ? "O" : undefined}
      onClick={aktivuj}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        aktivuj();
      }}
      onMouseEnter={(e) => c === null && ukaz(e.currentTarget, tip)}
      onMouseLeave={skry}
    >
      {c === null ? (
        // Michal 2026-11-06 (mock Dlaždica 2): veľké číslo vľavo na oboch stranách, zvyšok v nápovede a po kliku.
        <span className="karty-prehlad">
          <span className="karty-vylozi">
            <b>{karty.vylozi.cislo}</b>
            <span>{karty.vylozi.popis}</span>
          </span>
          <span className="karty-rad">
            <span>
              <b>{hrac.rukaPocet}</b> {t("panel.ruka")}
            </span>
            <span>
              <b>
                {hrac.priznane.length}
                {karty.navrhy > 0 && `+${karty.navrhy}`}
              </b>{" "}
              {t("panel.priznane")}
            </span>
          </span>
        </span>
      ) : (
        <>
          <span className="zdroj-nazov">{c.zamknute !== null ? t("panel.semTerazNie") : t("panel.pustiSem")}</span>
          <span className="zdroj-hodnota">
            <span className="velke-cislo karty-ciel">{c.nazov}</span>
          </span>
          <span className="zdroj-pod">{c.zamknute ?? c.pozn}</span>
        </>
      )}
      {okno}
    </div>
  );
}

/** Rola hráča v kole pod menom — nenápadný riadok s nápovedou, nie bublina. */
function Rola({ utoci, tip, frajerina }: { readonly utoci: boolean; readonly tip: TipObsah; readonly frajerina: number | undefined }) {
  const { tip: okno, ukaz, skry } = useTip();
  return (
    <span className={`doska-rola ${utoci ? "utocnik" : "obranca"}`} onMouseEnter={(e) => ukaz(e.currentTarget, tip)} onMouseLeave={skry}>
      {utoci ? `⚔ ${t("panel.utocnik")}` : `⛨ ${t("panel.obranca")}`}
      {frajerina !== undefined && <span className="doska-frajerina" title={t("lobby.frajerina")}>{frajerina}</span>}
      {okno}
    </span>
  );
}

export interface HracDoskaProps {
  /** Režim Päta, Lakeť, Otočka: starší namiesto dlaždíc Špaky a Starší, ktoré v režime nie sú. */
  readonly pult?: ReactNode;
  readonly view: ClientState;
  /** Pečiatka a rozpis na dlaždiciach Cigarety a Poldeci. */
  readonly prisunCigariet?: PrisunDlazdice;
  readonly prisunPoldeci?: PrisunDlazdice;
  /** Dáta sady — akcie Poldeci do výhľadu limitu. */
  readonly data: GameData;
  readonly p: PlayerId;
  readonly info: HracInfo | null;
  readonly prahy: { readonly cirhoza: number; readonly dlh: number; readonly exekucia: number; readonly priznaneDlhy: number };
  /** Absťáky, neresti kola a výhľad na koniec kola (stavZavislosti). */
  readonly zavislost: StavZavislosti;
  readonly menoKarty: (defId: string) => string;
  /** Výhľad Pitky (Zhromaždenie a Pitka) — inak null. */
  readonly vyhlad: VyhladPitky | null;
  /** Špaky „keby hra skončila teraz“ — dlaždica Body (v6: špaky mínus nepriznaná Cirhóza). */
  readonly body: SpakyTeraz;
  /**
   * Dlaždica Starší (Michal 2026-10-27, S1 stupienky): klik prepne stôl na líniu starších
   * a oba bary na bar starších. `stlacene`: línia práve ukazuje tohto hráča.
   * posuny = koľko starších sa pohlo od poslednej bitky (stopa na stupnici, #95); suhrn = beží súhrn kola.
   */
  readonly starsi: DlazdicaStarsichProps["starsi"];
  /** Klik na Špaky otvorí krčmovú nástenku s účtom (Michal 2026-10-27, variant A). */
  readonly spakyKlik: { readonly stlacene: boolean; readonly prepni: () => void };
  /** Dlaždica KARTY: klik otvorí vrstvu Karty, pri ťahaní kliatby či Nástroja je cieľom (#76). */
  readonly karty: KartyDlazdica;
  /**
   * Prepnutý bar (Michal 2026-10-27): kým je otvorená nástenka, zdroje nahradia dlaždice
   * špakov; kým stôl ukazuje líniu starších, nahradí ich bar starších (zdroje skryje hra.css).
   */
  readonly rezim?: "spaky" | "starsi" | undefined;
  /** Beží počítadlo bitky — Špaky ešte ukážu staré číslo (stôl prezradí výsledok sám). */
  readonly pocitadloBezi?: boolean | undefined;
  /** Spojenie súpera (človek) — bodka na avatare, odpojený aj s časom pod menom. */
  readonly spojenie?: { readonly pripojeny: boolean; readonly odpojenyOd: number | null } | undefined;
  /** Meno súpera toho, kto sa pozerá — nápoveda a lístok Hádky v bare starších. */
  readonly menoSupera?: string;
  /** Mená hráčov podľa miesta (0, 1) — nápoveda starších volá hráčov menom. */
  readonly mena?: readonly [string, string];
}

/**
 * Špaky v dlaždici (Michal 2026-10-27, dizajn timeline-lista A — skóre už nie je v lište):
 * kým beží počítadlo bitky, ostane staré číslo; potom krátko svieti zmena („+2“).
 */
function useSpakyVDlazdici(n: number, pozdrz: boolean): { readonly zobrazene: number; readonly zmena: { readonly n: number; readonly id: number } | null } {
  const [zobrazene, setZobrazene] = useState(n);
  const [zmena, setZmena] = useState<{ readonly n: number; readonly id: number } | null>(null);
  useEffect(() => {
    if (pozdrz || zobrazene === n) return;
    setZmena((z) => ({ n: n - zobrazene, id: (z?.id ?? 0) + 1 }));
    setZobrazene(n);
  }, [n, pozdrz, zobrazene]);
  useEffect(() => {
    if (zmena === null) return;
    const t = setTimeout(() => setZmena(null), ZMENA_SVIETI_MS);
    return () => clearTimeout(t);
  }, [zmena]);
  return { zobrazene, zmena };
}

/** Čas od odpojenia súpera — tiká len kým je odpojený. */
function useOdpojenyCas(odpojenyOd: number | null, bezi: boolean): number {
  const [teraz, setTeraz] = useState(() => Date.now());
  useEffect(() => {
    setTeraz(Date.now());
    if (!bezi) return;
    const t = setInterval(() => setTeraz(Date.now()), 1000);
    return () => clearInterval(t);
  }, [bezi]);
  return odpojenyOd === null ? 0 : Math.max(0, teraz - odpojenyOd);
}


/**
 * Bar hráča (Michal 2026-10-22, dizajn stol-oproti-b2-20261022-1030): súperi
 * sedia oproti sebe — súperov bar je nad staršími, tvoj pod stolom, oba
 * v jednom rade a zrkadlovo (tvoj: portrét · Špaky · Starší · Dlhy … Poldeci · Karty,
 * súperov presne obrátene; poradie dáva mriežka v hra.css). Klik na Špaky otvorí
 * nástenku s účtom, klik na Starších líniu starších; bar sa vtedy prepne na dlaždice
 * špakov či starších. Bez bubliniek so stavom — kto je na ťahu, ukazuje
 * stôl a pokyn, NA EX vidno na poldeci.
 */
export function HracDoska({
  view,
  prisunCigariet,
  prisunPoldeci,
  data,
  p,
  info,
  prahy,
  zavislost,
  menoKarty,
  vyhlad,
  body,
  starsi,
  spakyKlik,
  karty,
  rezim,
  pocitadloBezi = false,
  spojenie,
  menoSupera = t("stol.superKratko"),
  mena,
  pult,
}: HracDoskaProps) {
  const hrac = view.hraci[p];
  const ja = p === view.ja;
  const spakyVidno = useSpakyVDlazdici(view.spaky[p], pocitadloBezi);
  const odpojenyMs = useOdpojenyCas(spojenie?.odpojenyOd ?? null, spojenie !== undefined && !spojenie.pripojeny);
  const meno = info?.meno ?? t("stol.hrac", { n: p + 1 });
  // Stavbu šenku aj Pitku (Michal 2026-10-27) hrajú obaja naraz — „na ťahu“ je každý, kto ešte neskončil.
  const ps = view.pitkaStav;
  const naTahu =
    view.koniec === null &&
    (view.faza === "draft" && view.draftStav?.krok === "stavba"
      ? !view.draftStav.vybral[p]
      : view.faza === "pitka" && view.vizia === null && ps !== null
        ? ps.reakcia === p || hraVPitke(ps, p)
        : view.naTahu === p);
  // NA EX naraz (v5): skryté NA EX vidí len jeho majiteľ (viewFor) — poldeci sa odpíše až pri odkrytí,
  // no hráč ho už dal, preto ho tu ukážeme ako ležiaci na stole. Zrážka = druhý poldeci na karte (naexBy2).
  // Súperove skryté NA EX prídu len s Bzdochou (hrám Pitku po ňom) — a moje vidí súper, keď ju má on.
  const { naStole: naexNaStole, skryte: skryteNaex } = poldeciNaStole(view, p);
  const kSkrytemu = ja
    ? vidiVolbuSupera(data, view, opponentOf(p))
      ? t("panel.superVidiBzdocha")
      : t("panel.superNevidi")
    : t("panel.skryteBzdocha");
  const plne = Math.max(0, hrac.poldeciPlne - skryteNaex);
  const vypiteSoStolom = hrac.poldeciVypite + naexNaStole;
  // Limit, s ktorým hráč vstupuje do Zhromaždenia (so Zastávkou a Vínkom; NA EX na stole sa neráta).
  const limit = limitZhromazdenia(view, p);
  const buduci = limitBuduceKolo(view, p, false, data);
  const kto = ja ? t("panel.mas") : t("panel.ma");
  const cenaNovehoPoldeci = barterCena(data, view, p);
  const doNovehoPoldeci = hrac.cigarety >= cenaNovehoPoldeci ? t("panel.staciNaPoldeci") : t("panel.doNovehoPoldeci", { n: cenaNovehoPoldeci - hrac.cigarety });
  const utoci = view.utocnik === p;
  // Výhra strachom (krok 4c) ukončí hru pred exekúciou (4d) — zaujíma to toho, kto má Dlhy.
  const bezExekucie = prahy.exekucia > 0 && view.pata === undefined && hroziVyhraStrachom(view.vyhry);
  const v = vyhlad?.nahlad ?? null;
  const pecenPo = v === null ? hrac.pecen : v.pecen + v.pecenZoStola;
  const zadlzeniePo = v === null ? hrac.zadlzenie : v.zadlzenie + v.zadlzenieZoStola;
  const vyhladPecene: VstupVyhladu | null =
    vyhlad === null || v === null
      ? null
      : {
          kliatby: v.cirhozy,
          meno: t("panel.cirhoza"),
          cena: vyhlad.cenaCirhozy,
          opakovane: Math.floor(v.pecenZoStola / v.prahPecene),
          dalsiePitky: vyhlad.dalsiePitky,
          vPitke: vyhlad.vPitke,
        };
  const vyhladZadlzenia: VstupVyhladu | null =
    vyhlad === null || v === null
      ? null
      : {
          kliatby: v.dlhy,
          meno: t("panel.dlh"),
          cena: vyhlad.cenaDlhu,
          opakovane: Math.floor(v.zadlzenieZoStola / v.prahDlhu),
          dalsiePitky: vyhlad.dalsiePitky,
          vPitke: vyhlad.vPitke,
          bitka: vyhlad.dlhyBitka,
        };
  const kliatby = view.nepriznaneKliatby[p];

  const poldeci: ReactNode[] = [];
  for (let i = 0; i < plne; i++) poldeci.push(<IkonaPoldeci key={`p${i}`} plny />);
  // Poldeci z NA EX je už vypitý (Michal 2026-11-03) — hráč vidí, že sa mu vráti, no nie plný.
  for (let i = 0; i < naexNaStole; i++) poldeci.push(<IkonaPoldeci key={`s${i}`} naStole />);
  for (let i = 0; i < hrac.poldeciVypite; i++) poldeci.push(<IkonaPoldeci key={`v${i}`} plny={false} />);

  return (
    <section
      className={`doska ${ja ? "moja" : "superova"} ${naTahu ? "na-tahu" : ""}${rezim === undefined ? "" : ` rezim-${rezim}`}`}
      aria-label={t("panel.hracAria", { meno })}
      data-vyucba={ja ? "bar" : "bar-supera"}
    >
      <div className="doska-hrac">
        <KartaHraca info={info} meno={meno} ja={ja}>
          <Avatar meno={meno} avatar={info?.avatar ?? null} velkost={60} farba={ja ? "ja" : "su"} />
          {spojenie !== undefined && (
            <span
              className={`avatar-spojenie ${spojenie.pripojeny ? "online" : "offline"}`}
              role="img"
              aria-label={spojenie.pripojeny ? t("panel.priStole") : t("panel.odpojeny")}
              title={spojenie.pripojeny ? t("panel.jePriStole", { meno }) : t("panel.jeOdpojeny", { meno })}
            />
          )}
        </KartaHraca>
        <div>
          <strong className="doska-meno">
            {meno} {ja && <span className="tlmene">({t("stol.ty")})</span>}
          </strong>
          <Rola
            utoci={utoci}
            tip={
              view.ciel?.typ === "finale"
                ? utoci
                  ? { nadpis: t("panel.utocnikFinale"), text: t("panel.utocnikFinaleText") }
                  : { nadpis: t("panel.obrancaFinale"), text: t("panel.obrancaFinaleText") }
                : utoci
                ? { nadpis: t("panel.utocnikNadpis"), text: t("panel.utocnikText") }
                : { nadpis: t("panel.obrancaNadpis"), text: t("panel.obrancaText") }
            }
            frajerina={info?.frajerina}
          />
          {spojenie !== undefined && !spojenie.pripojeny && <span className="doska-odpojeny">○ {t("panel.odpojeny")} {minSek(odpojenyMs)}</span>}
          {/* Nepriznané kliatby pod menom; priznané a Dedičstvo sú v dlaždici KARTY (Michal 2026-10-23, #76). */}
          {((view.pata === undefined && kliatby.cirhoza > 0) || zavislost.abstaky > 0) && (
            <span className="doska-oblast">
              <span
                className="cip kliatba"
                title={
                  view.pata !== undefined
                    ? t("panel.abstakNepriznat")
                    : (ja
                    ? t("panel.nepriznaneJa", { spaky: spakov(KONSTANTY.SPAKY_ZA_CIRHOZU) })
                    : t("panel.nepriznaneSu", { spaky: spakov(KONSTANTY.SPAKY_ZA_CIRHOZU) })) +
                  (zavislost.abstaky > 0 ? ` ${t("panel.abstakNepriznat")}` : "")
                }
              >
                {t("panel.nepriznane")}{view.pata === undefined && kliatby.cirhoza > 0 && ` · ${t("panel.cirhozaKrat", { n: kliatby.cirhoza })}`}
                {zavislost.abstaky > 0 && ` · ${t("panel.abstakKrat", { n: zavislost.abstaky })}`}
              </span>
            </span>
          )}
        </div>
      </div>

      {/* display: contents — dlaždice sú priamo v mriežke baru (poradie v hra.css). */}
      <div className="doska-zdroje">
        {rezim === "spaky" && <BarSpakov view={view} p={p} body={body} menoKarty={menoKarty} />}
        {rezim === "starsi" && <BarStarsich view={view} data={data} p={p} menoKarty={menoKarty} menoSupera={menoSupera} mena={mena} />}
        <Zdroj
          nazov={t("pult.poldeci")}
          trieda="zdroj-poldeci"
          roh={prisunPoldeci !== undefined && <PeciatkaZdroja prisun={prisunPoldeci} />}
          hodnota={
            <>
              <span className="poldeci-rad">{poldeci.length > 0 ? poldeci : "—"}</span>
              <span className="velke-cislo">{plne}</span>
            </>
          }
          pod={
            <>
              {/* Každý riadok vo vlastnom prvku — v úzkej dlaždici sa skráti trojbodkou, nezalomí (malý notebook).
                  Na stole sa ráta k vypitým; v nízkom okne „plné ·“ ustúpi, aby trojbodka nezrezala „na stole“
                  (UI inšpekcia 2026-10-24). */}
              <span className={naexNaStole > 0 ? "s-naex" : undefined}>
                <span className="pod-plne">{t("panel.plneBodka")}</span>
                {t("panel.vypite", { n: vypiteSoStolom })}{naexNaStole > 0 && t("panel.naStoleZatvorka", { n: naexNaStole })}
              </span>
              <b>{t("panel.limitKariet", { n: limit })}</b>
            </>
          }
          tip={{
            nadpis: t("pult.poldeci"),
            text: (
              <>
                {prisunPoldeci !== undefined && <RozpisZdroja prisun={prisunPoldeci} />}
                <span className="tip-stav">
                  {t("panel.poldeciStav", { kto, plne, vypite: vypiteSoStolom })}
                  {naexNaStole > 0 && t("panel.zTohoNaStole", { n: naexNaStole, skryte: skryteNaex > 0 ? kSkrytemu : "" })}
                  {t("panel.limitKarietBodka", { n: limit })}
                  {jeCielLokalita(view, "zastavka") && t("panel.zastavka")}
                  {t("panel.dalsieKolo", { n: buduci })}
                </span>
                {t("panel.poldeciPravidlo", { dolieva: KONSTANTY.POLDECI_NA_ZACIATKU_KOLA, spaky: KONSTANTY.SPAKY_ZA_POLDECI })}
                {naexNaStole > 0 && ` ${naStoleVysvetlenie()}`}
              </>
            ),
          }}
        />
        <Zdroj
          nazov={t("pult.cigarety")}
          trieda="zdroj-cigarety"
          ikona={<IkonaCigareta />}
          hodnota={<span className="velke-cislo">{hrac.cigarety}</span>}
          roh={prisunCigariet !== undefined && <PeciatkaZdroja prisun={prisunCigariet} />}
          tip={{
            nadpis: t("pult.cigarety"),
            text: (
              <>
                {prisunCigariet !== undefined && <RozpisZdroja prisun={prisunCigariet} />}
                <span className="tip-stav">
                  {kto} {hrac.cigarety} · {doNovehoPoldeci}
                </span>
                {t("panel.cigaretyPravidlo")}
                {jeCielLokalita(view, "benzinka") && t("panel.benzinka")}
                {view.faza === "pitka" &&
                  (ja ? t("panel.fajcenieJa", { cena: cenaFajceniaHraca(view, p) === 0 ? t("tabula.zadarmo") : t("panel.zaN", { n: cenaFajceniaHraca(view, p) }) }) : t("panel.fajcenieSu", { cena: cenaFajceniaHraca(view, p) === 0 ? t("tabula.zadarmo") : t("panel.zaN", { n: cenaFajceniaHraca(view, p) }) }))}
                {t("panel.cigaretyPravidlo2", { doliatie: KONSTANTY.REFILL_CENA, novy: cenaNovehoPoldeci, hrana: ja ? t("panel.naHrane") : "", zaSpak: KONSTANTY.CIGARIET_ZA_SPAK })}
              </>
            ),
          }}
        />
        {view.bezChuti !== true && <ZdrojChut z={zavislost} ja={ja} />}
        <Zdroj
          nazov={t("pult.pecen")}
          trieda={`zdroj-pecen ${(v?.cirhozy ?? 0) > 0 ? "hrozi" : pecenPo >= prahy.cirhoza - 1 ? "varovanie" : ""}`}
          hodnota={
            <span className="velke-cislo">
              {hrac.pecen}
              {v !== null && v.pecenZoStola > 0 && <span className="projekcia"> ▸ {pecenPo}</span>}
              <small>/{prahy.cirhoza}</small>
            </span>
          }
          pod={
            <>
              <Pruh hodnota={hrac.pecen} pribudne={v?.pecenZoStola ?? 0} prah={prahy.cirhoza} />
              {vyhladPecene !== null && <TextVyhladu x={vyhladPecene} />}
            </>
          }
          tip={{
            nadpis: t("pult.pecen"),
            text: (
              <>
                <span className="tip-stav">
                  {hrac.pecen}
                  {v !== null && v.pecenZoStola > 0 && ` ▸ ${pecenPo}`} {t("panel.zN", { n: prahy.cirhoza })}
                  {vyhladPecene !== null && ` · ${vyhladPitky(vyhladPecene).cele.join(" · ")}`}
                </span>
                {ja
                  ? t("panel.pecenPravidloJa", { prah: prahy.cirhoza, spaky: spakov(KONSTANTY.SPAKY_ZA_CIRHOZU) })
                  : t("panel.pecenPravidloSu", { prah: prahy.cirhoza, spaky: spakov(KONSTANTY.SPAKY_ZA_CIRHOZU) })}
              </>
            ),
          }}
        />
        {/* Dlhy a Zadĺženie v jednej dlaždici (Michal 2026-10-27): číslo = priznané Dlhy k Exekútorovi, pod ním
            koľko Dlhov prinesie stôl; riadok zadĺženia len s Výherným automatom (prah 2, v11.8). Vyučba zvýrazňuje časti zvlášť (bar:dlhy, bar:zadlzenie). */}
        <Zdroj
          nazov={t("pult.dlhy")}
          trieda={`zdroj-dlhy ${
            (v?.dlhy ?? 0) > 0 || prahy.exekucia > 0 ? "hrozi" : zadlzenieHrozi(zadlzeniePo, prahy.dlh) ? "varovanie" : ""
          }`}
          hodnota={
            <span className="velke-cislo">
              {prahy.priznaneDlhy}
              {prahy.exekucia > 0 && <small> −{prahy.exekucia}</small>}
            </span>
          }
          pod={
            <>
              {ukazZadlzenie(hrac.zadlzenie, prahy.dlh) && (
                <span className={`dlhy-zadlzenie ${zadlzenieHrozi(zadlzeniePo, prahy.dlh) ? "zly" : ""}`} data-vyucba-prvok="zadlzenie">
                  {t("panel.zadlzenieN", { n: hrac.zadlzenie })}
                  {v !== null && v.zadlzenieZoStola > 0 && <span className="projekcia"> ▸ {zadlzeniePo}</span>}/{prahy.dlh}
                </span>
              )}
              {vyhladZadlzenia !== null ? (
                <TextVyhladu x={vyhladZadlzenia} />
              ) : prahy.exekucia > 0 ? (
                <span title={bezExekucie ? titulBezExekucie() : undefined}>
                  {bezExekucie ? t("panel.exekuciaNie", { n: prahy.exekucia }) : t("panel.exekuciaVBitke", { co: view.pata === undefined ? `−${spakov(prahy.exekucia)}` : t("panel.kazdemuStarsiemu", { n: prahy.exekucia }) })}
                </span>
              ) : prahy.priznaneDlhy > 0 ? (
                <span>{t("panel.zahradkar")}</span>
              ) : (
                <span>{t("panel.bezDlhov")}</span>
              )}
            </>
          }
          tip={{
            nadpis: t("pult.dlhy"),
            text: (
              <>
                <span className="tip-stav">
                  {t("panel.priznaneDlhy", { n: prahy.priznaneDlhy })}
                  {prahy.exekucia > 0
                    ? t("panel.exekuciaVTejto", { co: view.pata === undefined ? `−${spakov(prahy.exekucia)}${bezExekucie ? `. ${titulBezExekucie()}` : ""}` : t("panel.kazdemuPecene", { n: prahy.exekucia }) })
                    : prahy.priznaneDlhy > 0
                      ? ` · ${t("panel.zahradkar")}`
                      : ""}
                  {ukazZadlzenie(hrac.zadlzenie, prahy.dlh) && t("panel.zadlzenieZ", { n: hrac.zadlzenie, po: v !== null && v.zadlzenieZoStola > 0 ? ` ▸ ${zadlzeniePo}` : "", prah: prahy.dlh })}
                  {vyhladZadlzenia !== null && ` · ${vyhladPitky(vyhladZadlzenia).cele.join(" · ")}`}
                </span>
                {prahy.dlh > 1 ? t("panel.dlhPrah", { n: prahy.dlh }) : t("tabula.dlhyHazard")}{" "}
                {view.pata === undefined
                  ? t("panel.dlhyExekutor")
                  : t("panel.dlhyExekuciaPata")}
              </>
            ),
          }}
        />
        <DlazdicaKariet hrac={hrac} ja={ja} karty={karty} />
        {pult ?? (
          <>
        <button
          type="button"
          className={`zdroj zdroj-body${spakyKlik.stlacene ? " stlacene" : ""}`}
          aria-pressed={spakyKlik.stlacene}
          data-vyucba-prvok="body"
          title={
            spakyKlik.stlacene
              ? t("panel.zavrietNastenku")
              : (ja
                  ? t("panel.spakyTitulJa", { n: body.spaky[p], vyhra: body.zaStarsichVyhra[p], prehra: body.zaStarsichPrehra[p] })
                  : t("panel.spakyTitulSu", { meno, n: body.spaky[p], vyhra: body.zaStarsichVyhra[p], prehra: body.zaStarsichPrehra[p] })) +
                (body.vykupne[p].spaky > 0 && view.koniec === null ? t("panel.vykupneTitul", { n: body.vykupne[p].spaky }) : "") +
                (body.cirhozy[p] > 0 ? t("panel.cirhozaTitul", { n: body.cirhozy[p], spaky: body.cirhozy[p] * KONSTANTY.SPAKY_ZA_CIRHOZU }) : "") +
                t("panel.klikNastenka")
          }
          onClick={spakyKlik.prepni}
        >
          <span className="zdroj-nazov">{t("pult.spaky")} {spakyKlik.stlacene ? "▴" : "▾"}</span>
          <span className="zdroj-hodnota">
            {/* Michal 2026-10-26: len piktogram, nadpis a číslo — rozpis je na nástenke za ▾. */}
            <PocetSpakov n={spakyVidno.zobrazene} kto={ja ? "moj" : "superov"} titul="" />
            {spakyVidno.zmena !== null && (
              <span key={spakyVidno.zmena.id} className={`spaky-zmena${spakyVidno.zmena.n < 0 ? " minus" : ""}`}>
                {textZmeny(spakyVidno.zmena.n)}
              </span>
            )}
          </span>
        </button>
        <DlazdicaStarsich view={view} p={p} zaStarsich={body.zaStarsichVyhra[p]} zaStarsichPrehra={body.zaStarsichPrehra[p]} starsi={starsi} />
          </>
        )}
      </div>

    </section>
  );
}

// ---- bitka: aktívne efekty oboch hráčov -------------------------------------------
//
// Michal 2026-10-20: aktívne efekty boli nenápadné a malé. Každá aktívna akcia
// je teraz veľká ikona s hodnotou pod ňou; prírastky a úbytky sú v zátvorke
// a nápoveda vymenuje, ktoré karty a prečo hodnotu dali.

const SILA: Partial<Record<Action, number>> = { Rana: 1, Pecka: 2, Petelica: 3 };
const PORADIE_AKCII: readonly Action[] = [
  "Rana",
  "Pecka",
  "Petelica",
  "Viera",
  "Povera",
  "Vízia",
  "Cigareta",
  "Obmedzenie",
  "Robota",
  "Pohoršenie",
  "Dlh",
  "PoškodeniePečene",
  "Poldeci",
];

/** Zdroje rozpisu poškodenia, ktoré nie sú kartou. */
const ZDROJ_ROZPISU: Readonly<Record<string, () => string>> = {
  cirhoza: () => t("panel.zdrojCirhoza"),
  BITKAR: () => t("pocitadlo.bitkar"),
  Viera: () => t("panel.zdrojViera"),
  abstak: () => t("panel.zdrojAbstak"),
  pasca: () => t("panel.zdrojPasca"),
};

function znamienko(n: number): string {
  return n > 0 ? `+${n}` : `−${-n}`;
}

/** Dôvody, ktoré akciu karty zdvojujú (NA EX, Posilnenie, Forsáž, efekt karty ako Silná žena). */
function jeZdvojenie(dovod: string): boolean {
  return dovod === "NA EX" || dovod === "Posilnenie" || dovod === "Forsáž" || dovod.startsWith("karta:");
}

/** Dlaždica efektu: ikona, hodnota pod ňou, zmeny v zátvorke, nápoveda pri prejdení myšou. */
function Dlazdica({
  ikona,
  hodnota,
  zmeny,
  tip,
  trieda,
  nasobok = 1,
  nazov,
  popis,
}: {
  readonly ikona: ReactNode;
  readonly hodnota: ReactNode;
  readonly zmeny: readonly number[];
  readonly tip: TipObsah;
  readonly trieda?: string;
  /** Najväčší násobok karty (×2 NA EX, ×4 NA EX so Silnou ženou) — čip namiesto „(+3)“. */
  readonly nasobok?: number;
  /** Názov akcie vedľa ikony — jednotný bar ho ukáže len pri širokom okne. */
  readonly nazov?: string;
  /** Názov akcie pre nápovedu „+N“, keď sa akcia v bare nezmestí (ustupkyBaru.ts). */
  readonly popis?: string;
}) {
  const { tip: okno, ukaz, skry } = useTip();
  const viditelne = zmeny.filter((z) => z !== 0);
  return (
    <span
      className={`efekt ${trieda ?? ""}`}
      data-nazov={popis}
      tabIndex={0}
      onMouseEnter={(e) => ukaz(e.currentTarget, tip)}
      onMouseLeave={skry}
      onFocus={(e) => ukaz(e.currentTarget, tip)}
      onBlur={skry}
    >
      <span className="efekt-ikona">{ikona}</span>
      {nazov !== undefined && <span className="efekt-nazov">{nazov}</span>}
      <span className="efekt-hodnota">
        {hodnota}
        {nasobok > 1 && <small className="efekt-nasobok">×{nasobok}</small>}
        {viditelne.length > 0 && <small className="efekt-zmeny">({viditelne.map(znamienko).join(" ")})</small>}
      </span>
      {okno}
    </span>
  );
}

interface AkcieStranyProps {
  readonly sums: ActionSums;
  readonly zdroje: ZdrojeAkcii;
  readonly rozpis: RozpisPoskodenia;
  readonly sada: Sada;
  readonly menoKarty: (defId: string) => string;
  /** Názov akcie vedľa ikony (jednotný bar ho ukáže len pri širokom okne). */
  readonly sNazvom?: boolean;
}

/**
 * Aktivované akcie jednej strany ako dlaždice so skutočnými piktogramami akcií (aj
 * vlastnými ikonami z tvorcu) — v paneli bitky aj v jednotnom bare (Michal 2026-10-25).
 */
export function AkcieStrany({ sums, zdroje, rozpis, sada, menoKarty, sNazvom = false }: AkcieStranyProps) {
  const akcia = (kluc: string) => sada.akcie.find((a) => a.kluc === kluc);
  const nazov = (kluc: string): string => akcia(kluc)?.nazov ?? kluc;
  const dovod = (d: string): string =>
    d === "Posilnenie"
      ? t("panel.dovodPosilnenie")
      : d === "NA EX"
        ? t("panel.dovodNaex")
        : d === "Vzbura"
          ? t("panel.dovodVzbura")
          : d === "Forsáž"
            ? t("panel.dovodForsaz")
            : d === "Odpor proti Posilneniu"
            ? t("panel.dovodOdpor")
            : d.startsWith("karta:")
              ? t("panel.dovodKarta", { meno: menoKarty(d.slice(6)) })
              : d;

  const aktivne = PORADIE_AKCII.filter((a) => (sums[a] ?? 0) !== 0 || (a === "Povera" && (rozpis.poveraIgnorovana > 0 || rozpis.poveryOhovaracky > 0)) || (zdroje[a] ?? []).length > 0);
  // Názvy sa zmestia len k pár akciám — pri viacerých by sa ikony na strane baru nezmestili.
  const sNazvami = sNazvom && aktivne.length <= 4;
  const dlazdice: ReactNode[] = [];
  for (const a of aktivne) {
    // Povery z Ohováračky sa rátajú ako Povery z kariet — bez nich by rušenie vyšlo do mínusu.
    const ohovaracka = a === "Povera" ? rozpis.poveryOhovaracky : 0;
    const hodnota = (sums[a] ?? 0) + ohovaracka;
    const ignorovana = a === "Povera" ? rozpis.poveraIgnorovana : 0;
    const zoznam = zdroje[a] ?? [];
    // Zdvojenia (Posilnenie, NA EX, efekty kariet) — o koľko je súčet vyšší než počet aktívnych slotov;
    // záporné položky sú zrážky súperových efektov (Presbiter).
    const kladne = zoznam.filter((z) => z.hodnota > 0);
    const navyse = kladne.reduce((s, z) => s + z.hodnota, 0) - kladne.length;
    // Násobky sa násobia (NA EX ×2 × Silná žena ×2 = ×4) — ukáže sa najväčší čipom ×N.
    const nasobok = Math.max(1, ...kladne.map((z) => 2 ** z.dovody.filter(jeZdvojenie).length));
    const zrazkaEfektom = zoznam.filter((z) => z.hodnota < 0).reduce((s, z) => s + z.hodnota, 0);
    const zrusene = a === "Viera" ? rozpis.zrusenaViera : a === "Povera" ? rozpis.zrusenaPovera : 0;
    const riadky: ReactNode[] = zoznam.map((z, i) => (
      <span key={i} className="tip-riadok">
        {z.hodnota < 0 ? t("panel.superov", { meno: menoKarty(z.defId) }) : menoKarty(z.defId)}
        {z.vStrede ? t("panel.kartaVStrede") : ""}: <b>{znamienko(z.hodnota)}</b>
        {z.dovody.length > 0 ? ` — ${z.dovody.map(dovod).join(", ")}` : ""}
      </span>
    ));
    if (ohovaracka > 0) {
      riadky.push(
        <span key="ohovaracka" className="tip-riadok">
          {t("panel.ohovarackaPriazen")} <b>{znamienko(ohovaracka)}</b>
        </span>,
      );
    }
    const sila = SILA[a];
    const stav: string[] = [];
    if (sila !== undefined) stav.push(t("panel.stavTuhe", { n: hodnota, sila, spolu: hodnota * sila }));
    if (a === "Viera") {
      stav.push(t("panel.hodnotaViery", { n: rozpis.hodnotaViery }));
      if (zrusene > 0) stav.push(t("panel.minutaNaPovery", { n: zrusene }));
      if (rozpis.veriaciPo !== rozpis.veriaciPred) stav.push(t("panel.veriaci", { pred: rozpis.veriaciPred, po: rozpis.veriaciPo }));
    }
    if (a === "Povera") {
      if (ignorovana > 0) stav.push(t("panel.ignorujeFarar", { n: ignorovana }));
      if (zrusene > 0) stav.push(t("panel.zrusilaViera", { n: zrusene }));
      stav.push(t("panel.zvysnePovery", { n: rozpis.zvysnaPovera, spolu: rozpis.zvysnaPovera * rozpis.silaPovery }));
    }
    // Hádka (v10): Pohoršenie je 2 mäkké, Viera ho nezruší.
    if (a === "Pohoršenie") stav.push(t("panel.stavPohorsenie", { n: hodnota, spolu: hodnota * 2 }));
    dlazdice.push(
      <Dlazdica
        key={a}
        trieda={sila !== undefined ? "tuha" : ""}
        ikona={<IkonaAkcie kluc={a} akcia={akcia(a)} />}
        {...(sNazvami ? { nazov: nazov(a) } : {})}
        popis={nazov(a)}
        hodnota={hodnota}
        nasobok={nasobok}
        zmeny={[nasobok > 1 ? 0 : navyse, zrazkaEfektom, -zrusene, -ignorovana]}
        tip={{
          nadpis: `${nazov(a)} ${hodnota}${navyse > 0 ? t("panel.zdvojenim", { n: znamienko(navyse) }) : ""}`,
          text: (
            <>
              {akcia(a)?.popis ?? ""}
              {stav.length > 0 && <span className="tip-stav">{stav.join(" · ")}</span>}
              {riadky}
            </>
          ),
        }}
      />,
    );
  }
  return dlazdice.length > 0 ? <>{dlazdice}</> : <span className="efekty-ziadne">{t("panel.ziadneAkcie")}</span>;
}

function StranaBitky({
  meno,
  tuhe,
  sums,
  zdroje,
  rozpis,
  sada,
  vitaz,
  zarovnanie,
  menoKarty,
  skryta,
}: {
  readonly meno: string;
  readonly tuhe: number;
  readonly sums: ActionSums;
  readonly zdroje: ZdrojeAkcii;
  readonly rozpis: RozpisPoskodenia;
  readonly sada: Sada;
  readonly vitaz: boolean;
  readonly zarovnanie: "vlavo" | "vpravo";
  readonly menoKarty: (defId: string) => string;
  /** Súperova Záverečná lícom dole — tuhé môže byť viac. */
  readonly skryta?: boolean;
}) {
  const zdroj = (z: string): string => ZDROJ_ROZPISU[z]?.() ?? menoKarty(z);
  const bonus = rozpis.bonusy.reduce((s, z) => s + z.hodnota, 0);
  const zrazka = rozpis.zrazky.reduce((s, z) => s + z.hodnota, 0);
  const tipTuhe: TipObsah = {
    nadpis: t("panel.tuhePoskodenie", { n: tuhe }),
    text: (
      <>
        {t("panel.rozhodujeTuhe")}
        <span className="tip-riadok">
          {t("panel.zAkcii")} <b>{rozpis.zAkcii}</b>
        </span>
        {rozpis.bonusy.map((z) => (
          <span key={`b${z.zdroj}`} className="tip-riadok">
            {zdroj(z.zdroj)}: <b>{znamienko(z.hodnota)}</b>
          </span>
        ))}
        {rozpis.zrazky.map((z) => (
          <span key={`z${z.zdroj}`} className="tip-riadok">
            {zdroj(z.zdroj)}: <b>{znamienko(-z.hodnota)}</b>
          </span>
        ))}
        <span className="tip-stav">
          {t("panel.rozdielTuheho")}
        </span>
      </>
    ),
  };

  return (
    <div className={`bitka-strana ${zarovnanie} ${vitaz ? "vitaz" : ""}`}>
      <div className="bitka-suhrn">
        <span className="bitka-meno">{meno}</span>
        <Dlazdica
          trieda="efekt-tuhe"
          ikona={
            <span className="bitka-tuhe">
              {tuhe}
              {skryta === true && (
                <span className="bitka-skryta" title={t("panel.zaverecnaSkryta")}>
                  ?
                </span>
              )}
            </span>
          }
          hodnota={<span className="bitka-popis">{t("rekap.tuhe")}</span>}
          zmeny={[bonus, -zrazka]}
          tip={tipTuhe}
        />
      </div>
      <div className="efekty">
        <AkcieStrany sums={sums} zdroje={zdroje} rozpis={rozpis} sada={sada} menoKarty={menoKarty} />
      </div>
    </div>
  );
}

export interface BitkaPanelProps {
  readonly damage: DamageResult;
  readonly sums: readonly [ActionSums, ActionSums];
  readonly zdroje: readonly [ZdrojeAkcii, ZdrojeAkcii];
  readonly rozpis: readonly [RozpisPoskodenia, RozpisPoskodenia];
  readonly ja: PlayerId;
  readonly vysledok: boolean;
  readonly mena: readonly [string, string];
  readonly sada: Sada;
  readonly ciel: string;
  readonly menoKarty: (defId: string) => string;
  /** Špaky na sekere z predošlých remíz („4 špaky“) — víťaz tejto bitky ich berie tiež. */
  readonly naSekeru: readonly string[];
  /** Finále — pri sekere špaky prepadnú. */
  readonly poslednaBitka: boolean;
  /** Prebytok po zľave Pušky (prebytokNaRozdelenie) — toľko sa naozaj rozdelí. */
  readonly prebytokNaRozdelenie: number;
  /** Kto útočí a prečo (návrh 5 A) — „útočník = porazený z minulej bitky“. */
  readonly utocnik?: string;
  /** Rod hráča pre „Vyhral(a) si bitku“ (Michal 2026-10-22); chýba = neutrálne. */
  readonly rodJa?: Rod;
  /**
   * Hrozba na stole (Michal 2026-10-23): o koľko ešte súper (a ty) môže otočiť bitku
   * jedným NA EX z toho, čo leží na stole — ruka sa nepočíta. Len keď mení výsledok.
   */
  readonly hrozby?: readonly HrozbaBitky[];
  /** Prejdenie myšou po riadku hrozby zvýrazní kartu v línii (null = koniec). */
  readonly ukazHrozbu?: (uid: number | null) => void;
  /** Súper má v línii Záverečnú lícom dole — jeho tuhé je neisté (roadmapa #83). */
  readonly skrytaSupera?: boolean;
  /** Efekty Prehra po bitke podľa stola (návrh #38 B: Dievčina na vydaj, Farár, Podvodník). */
  readonly poBitke?: string | null;
  /** Priazne, ktoré vstupujú do bitky (po hádke) — v nápovede odhadu s krúžkom (Michal 2026-10-31). */
  readonly priazne?: readonly PriazenVOdhade[];
  /** Odhad špakov po kole (kraje stredu baru); počas bitky a na telefóne chýba. */
  readonly spaky?: OdhadSpakov | null;
}

export interface PriazenVOdhade {
  readonly fav: Favour;
  readonly p: PriazenKola;
  /** „Autobusár +1 tuhé v bitke“, „Veterinár: Fero +1 Viera v bitke“. */
  readonly text: string;
  /** „(hádka: Fero)“ — keď ju hádka tohto kola zmenila. */
  readonly hadka: string | null;
}

export interface HrozbaBitky {
  readonly kto: "ja" | "su";
  /** NA EX z kariet na stole (predvolené), rozsah nerozdelenej hádky (v10), alebo kliatby z NA EX (#38 B). */
  readonly zdroj?: "naex" | "hadka" | "kliatby";
  /** Krátko do riadku bitky: „Súper ešte môže: tuhé 0 : 8“. */
  readonly kratko: string;
  /** Najkratšie, keď hrozbu majú obaja a idú do jedného riadku: „súper až 0 : 8“. */
  readonly mini: string;
  /** Mini pri viacerých hrozbách naraz — s „NA EX“, aby sa nezamenila s hádkou. */
  readonly miniNaex?: string;
  /** Celé znenie (titulok): aj karta a prebytok. */
  readonly cele: string;
  /** Karta v línii, ktorú riadok zvýrazní; Pohoršenia žiadnu nemajú. */
  readonly uid: number | null;
}

const klucHrozby = (h: HrozbaBitky): string => `${h.kto}-${h.zdroj ?? "naex"}`;

/**
 * Riadky hrozby — v celom paneli pod verdiktom. V riadku bitky (pevná výška pásu)
 * vždy jeden riadok: dve hrozby by sa doň nezmestili (UI inšpekcia, bugfix/hrozba),
 * tak idú vedľa seba v najkratšom znení; celé je v titulku.
 */
function RiadkyHrozby({
  hrozby,
  ukazHrozbu,
  jedenRiadok = false,
}: {
  readonly hrozby: readonly HrozbaBitky[] | undefined;
  readonly ukazHrozbu: ((uid: number | null) => void) | undefined;
  readonly jedenRiadok?: boolean;
}) {
  if (hrozby === undefined || hrozby.length === 0) return null;
  const cast = (h: HrozbaBitky, text: string) => (
    <span
      key={klucHrozby(h)}
      className={`hrozba-bitky ${h.kto}`}
      title={h.cele}
      onMouseEnter={() => h.uid !== null && ukazHrozbu?.(h.uid)}
      onMouseLeave={() => ukazHrozbu?.(null)}
    >
      {text}
    </span>
  );
  if (!jedenRiadok) return <>{hrozby.map((h) => cast(h, h.kratko))}</>;
  return (
    <span className="hrozba-bitky-riadok" data-vyucba="hrozba" title={hrozby.map((h) => h.cele).join("\n")}>
      {hrozby[0]?.zdroj === "hadka" ? "" : t("panel.esteMoze")}
      {hrozby.map((h, i) => (
        <span key={klucHrozby(h)}>
          {i > 0 && " · "}
          {cast(h, h.mini)}
        </span>
      ))}
    </span>
  );
}

/** Verdikt a prebytok bitky — spoločné pre panel aj jeho jednoriadkový súhrn. */
function verdiktBitky({ damage, ja, vysledok, poslednaBitka, rodJa = null }: BitkaPanelProps) {
  const su = opponentOf(ja);
  // Remíza v6 (Michal 2026-10-26): rozhodnú Absťáky, potom Dlhy, inak sekera — tu len odhad z tuhého (PRAVIDLA §9.4).
  const { vitaz, prebytok, prebytokDrzi } = battleOutcome(damage);
  const rozdiel = Math.abs(damage.tuhe[ja] - damage.tuhe[su]);
  const vyhravam = vitaz === ja;
  const coPriRemize = poslednaBitka
    ? t("panel.remizaFinale")
    : t("panel.remizaSekera");
  const verdikt =
    rozdiel === 0
      ? t("panel.remizaCo", { co: coPriRemize })
      : vysledok
        ? vyhravam
          ? tRod("panel.vyhralBitku", rodJa)
          : tRod("panel.prehralBitku", rodJa)
        : vyhravam
          ? t("pocitadlo.vyhravas", { n: rozdiel })
          : t("pocitadlo.prehravas", { n: rozdiel });
  // V bare je na verdikt jeden krátky riadok — čo prinesie remíza, povie nápoveda.
  const kratko = rozdiel === 0 ? t("koniec.remiza") : verdikt;
  return { su, vitaz, prebytok, prebytokDrzi, rozdiel, vyhravam, coPriRemize, verdikt, kratko };
}

/**
 * Odhad bitky v strede jednotného baru (Michal 2026-10-25, mock V2): verdikt, tuhé a hrozba
 * v jednom riadku — jediné miesto odhadu. Prebytok, remíza, cieľ aj stávka sú v nápovede
 * (tipOdhadu); natrvalo by brali miesto stavovej správe pod nimi.
 */
export function OdhadBaru(props: BitkaPanelProps) {
  const { damage, ja, vysledok, skrytaSupera } = props;
  const { su, vitaz, vyhravam, kratko } = verdiktBitky(props);
  return (
    <>
      <span className="jbar-nadpis">{vysledok ? t("panel.vysledok") : t("panel.odhad")}</span>
      <b className={`jbar-verdikt ${vitaz === null ? "remiza" : vyhravam ? "vyhravam" : "prehravam"}`}>
        {kratko}
        {skrytaSupera === true && !vysledok && " ?"}
      </b>
      <span className="jbar-tuhe" title={t("panel.tuheTySuper")}>
        {damage.tuhe[ja]} : {damage.tuhe[su]}
        {skrytaSupera === true && !vysledok && "?"}
      </span>
      <RiadkyHrozby hrozby={props.hrozby} ukazHrozbu={props.ukazHrozbu} jedenRiadok />
    </>
  );
}

const znSpakov = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");

/** Pás prevahy: od stredu k tomu, kto vedie; mierka je spoločná pre bitku aj hádku. */
function PasPrevahy({ a, b, mierka }: { readonly a: number; readonly b: number; readonly mierka: number }) {
  const rozdiel = Math.abs(a - b);
  return (
    <span className="jk-pas" aria-hidden="true">
      {rozdiel > 0 && <i className={a > b ? "ja" : "su"} style={{ width: `${Math.max((rozdiel / mierka) * 50, 5)}%` }} />}
    </span>
  );
}

/**
 * Stred baru (Michal 2026-11-06, mock „Špaky na krajoch“): tvoje špaky po kole pri tvojej strane,
 * súperove pri jeho, medzi nimi bitka a hádka pod sebou s pásom a verdiktom. Počas bitky je výplata
 * už na stole, preto kraje vtedy chýbajú. Keď je akcií veľa, verdikt ustúpi (ustupkyBaru.ts).
 */
export function OdhadKola(props: BitkaPanelProps) {
  const { damage, ja, vysledok, skrytaSupera, spaky, rodJa = null } = props;
  const { su, vitaz, vyhravam, kratko } = verdiktBitky(props);
  const otaznik = skrytaSupera === true && !vysledok ? "?" : "";
  const mak: readonly [number, number] = [damage.makke[ja], damage.makke[su]];
  const hadkaRozdiel = Math.abs(mak[0] - mak[1]);
  const hadkaVedie = mak[0] > mak[1];
  const hadkaText =
    hadkaRozdiel === 0
      ? t("koniec.remiza")
      : vysledok
        ? hadkaVedie
          ? tRod("panel.vyhralHadku", rodJa)
          : tRod("panel.prehralHadku", rodJa)
        : hadkaVedie
          ? t("pocitadlo.vyhravas", { n: hadkaRozdiel })
          : t("pocitadlo.prehravas", { n: hadkaRozdiel });
  const mierka = Math.max(8, damage.tuhe[ja], damage.tuhe[su], mak[0], mak[1]);
  const riadok = (nazov: string, a: number, b: number, sufix: string, text: string, trieda: string) => (
    <>
      <span className="jbar-nadpis">{nazov}</span>
      <span className={`jk-cislo ja${a > b ? " vedie" : ""}`}>{a}</span>
      <PasPrevahy a={a} b={b} mierka={mierka} />
      <span className={`jk-cislo su${b > a ? " vedie" : ""}`}>
        {b}
        {sufix}
      </span>
      <b className={`jk-verdikt ${trieda}`}>{text}</b>
    </>
  );
  const kraj = (kto: "ja" | "su", n: number) => (
    <span className={`jk-kraj ${kto}`}>
      <b>{znSpakov(n)}</b>
      <small>
        po kole <IkonaSpaku />
      </small>
    </span>
  );
  return (
    <span className="jk">
      {spaky != null && kraj("ja", spaky.hraci[ja].spolu)}
      <span className="jk-riadky">
        {riadok(t("rekap.bitka"), damage.tuhe[ja], damage.tuhe[su], otaznik, `${kratko}${otaznik === "" ? "" : " ?"}`, vitaz === null ? "remiza" : vyhravam ? "vyhravam" : "prehravam")}
        {riadok(t("rekap.hadkaMale"), mak[0], mak[1], "", hadkaText, hadkaRozdiel === 0 ? "remiza" : hadkaVedie ? "vyhravam" : "prehravam")}
      </span>
      {spaky != null && kraj("su", spaky.hraci[su].spolu)}
    </span>
  );
}

/** Rozpis odhadu špakov v nápovede stredu baru: čo sa skladá do čísel na krajoch. */
function RozpisSpakovKola({ spaky, ja, menoSupera }: { readonly spaky: OdhadSpakov; readonly ja: PlayerId; readonly menoSupera: string }) {
  const su = opponentOf(ja);
  const [mj, s] = [spaky.hraci[ja], spaky.hraci[su]];
  const riadky: readonly (readonly [string, number, number])[] = [
    [t("panel.zaBitku"), mj.zaBitku, s.zaBitku],
    [t("panel.nakladackaFinale"), mj.nakladacka, s.nakladacka],
    [t("panel.hadkaFinale"), mj.hadka, s.hadka],
    [t("starsi.nazov"), mj.starsi, s.starsi],
    [t("spaky.robota"), mj.robota, s.robota],
    [t("spaky.exekutor"), -mj.exekutor, -s.exekutor],
  ];
  return (
    <span className="tip-riadok">
      <span className="tip-spaky">
        <b>{t("panel.spakyPoKole")}</b>
        <b>{t("stol.ty")}</b>
        <b>{menoSupera}</b>
        {riadky
          .filter(([, a, b]) => a !== 0 || b !== 0)
          .map(([nazov, a, b]) => (
            <Fragment key={nazov}>
              <span>{nazov}</span>
              <span>{znSpakov(a)}</span>
              <span>{znSpakov(b)}</span>
            </Fragment>
          ))}
        <b className="spolu">{t("linia.spolu")}</b>
        <b className="spolu">{znSpakov(mj.spolu)}</b>
        <b className="spolu">{znSpakov(s.spolu)}</b>
      </span>
      {spaky.obrat !== null && (
        <span className="tip-riadok">
          {spaky.vitaz === ja
            ? t("panel.obratSuper", { ja: znSpakov(spaky.obrat[ja]), su: znSpakov(spaky.obrat[su]) })
            : t("panel.obratTy", { ja: znSpakov(spaky.obrat[ja]), su: znSpakov(spaky.obrat[su]) })}
          {mj.nakladacka + s.nakladacka > 0 ? t("panel.podlaObratu") : "."}
        </span>
      )}
      {spaky.naSekeru > 0 && <span className="tip-riadok">{t("panel.naSekeruPojde", { spaky: spakov(spaky.naSekeru) })}</span>}
      {spaky.prepadne > 0 && <span className="tip-riadok">{t("panel.sekeraFinalePrepadne", { spaky: spakov(spaky.prepadne) })}</span>}
      <span className="tip-riadok">{t("panel.bezKradeze")}</span>
    </span>
  );
}

/** Nápoveda odhadu v bare: čo býval celý panel bitky, a stávka (Michal 2026-10-25: len v nápovede). */
export function tipOdhadu(props: BitkaPanelProps, stavka: StavkaBitkyCisla | null, ucetPitky: string | null = null): TipObsah {
  const { damage, ja, vysledok, mena, ciel, naSekeru, prebytokNaRozdelenie, utocnik } = props;
  const { su, prebytok, prebytokDrzi, rozdiel, coPriRemize, verdikt } = verdiktBitky(props);
  return {
    nadpis: `${vysledok ? t("panel.vysledokBitky") : t("panel.odhadBitky")}${ciel === "" ? "" : ` · ${ciel}`}`,
    text: (
      <>
        <b>{verdikt}</b> · {t("rekap.tuhe")} {damage.tuhe[ja]} : {damage.tuhe[su]}
        <span className="tip-riadok">
          {prebytokDrzi === null
            ? t("rekap.nakladackaNikto")
            : t("panel.nakladackaKomu", { n: prebytok, puska: prebytokNaRozdelenie < prebytok ? ` − ${t("panel.puska")} = ${prebytokNaRozdelenie}` : "", komu: prebytokDrzi === ja ? t("panel.tebe") : mena[su], cena: cenaPola() })}
        </span>
        {(props.hrozby ?? []).map((h) => (
          <span key={klucHrozby(h)} className="tip-riadok">
            {h.cele}
          </span>
        ))}
        {naSekeru.length > 0 && (
          <span className="tip-riadok">
            {t("panel.naSekereVezme", { n: naSekeru.join(", ") })}
          </span>
        )}
        {!vysledok && rozdiel !== 0 && <span className="tip-riadok">{t("panel.priRemize", { co: coPriRemize })}</span>}
        {props.poBitke != null && <span className="tip-riadok">{t("panel.poBitkePrehra")} {props.poBitke}</span>}
        {(props.priazne ?? []).length > 0 && (
          <span className="tip-riadok tip-priazne">
            {t("panel.priazne")}
            {(props.priazne ?? []).map((x, i) => (
              <span key={i} className="tip-priazen">
                <PilulkaPriazne fav={x.fav} p={x.p} /> {x.text}
                {x.hadka !== null && <small> {x.hadka}</small>}
              </span>
            ))}
          </span>
        )}
        {!vysledok && props.spaky != null && <RozpisSpakovKola spaky={props.spaky} ja={ja} menoSupera={mena[su]} />}
        {!vysledok && props.spaky == null && stavka !== null && (
          <span className="tip-riadok">
            {tr("panel.taBitka", { karty: t("spaky.kartVLinii", { n: stavka.karty }), vyhra: stavka.vyhra, prehra: -stavka.prehra })}
            {stavka.naSekere > 0 && <> · {t("panel.naSekere", { n: stavka.naSekere })}</>}
          </span>
        )}
        {utocnik !== undefined && <span className="tip-riadok">{utocnik}</span>}
        {ucetPitky !== null && <span className="tip-riadok">{ucetPitky}</span>}
        {!vysledok && <span className="tip-stav">{t("panel.podlaLinie")}</span>}
      </>
    ),
  };
}

export function BitkaPanel(props: BitkaPanelProps) {
  const { damage, sums, zdroje, rozpis, ja, vysledok, mena, sada, ciel, menoKarty, naSekeru, prebytokNaRozdelenie, utocnik } = props;
  const { su, vitaz, prebytok, prebytokDrzi, rozdiel, vyhravam, coPriRemize, verdikt } = verdiktBitky(props);

  const strana = (p: PlayerId, zarovnanie: "vlavo" | "vpravo") => (
    <StranaBitky
      meno={mena[p]}
      tuhe={damage.tuhe[p]}
      sums={sums[p]}
      zdroje={zdroje[p]}
      rozpis={rozpis[p]}
      sada={sada}
      vitaz={vitaz === p}
      zarovnanie={zarovnanie}
      menoKarty={menoKarty}
      skryta={p !== ja && props.skrytaSupera === true}
    />
  );

  return (
    <section className={`bitka-panel ${vitaz === null ? "" : vyhravam ? "vyhravam" : "prehravam"}`} aria-label={t("faza.bitka")}>
      {strana(ja, "vlavo")}
      <div className="bitka-stred">
        <span className="bitka-nadpis">
          {vysledok ? t("panel.vysledokBitky") : t("panel.odhadBitky")} · {ciel}
        </span>
        {utocnik !== undefined && <span className="bitka-pozn">{utocnik}</span>}
        {naSekeru.length > 0 && (
          <span className="bitka-sekera" title={t("panel.sekeraTitul")}>
            {t("panel.naSekereVezme", { n: naSekeru.join(", ") })}
          </span>
        )}
        <span className="bitka-verdikt">{verdikt}</span>
        <RiadkyHrozby hrozby={props.hrozby} ukazHrozbu={props.ukazHrozbu} />
        <span className="bitka-pozn">
          {prebytokDrzi === null
            ? t("rekap.nakladackaNikto")
            : t("panel.nakladackaKomu", { n: prebytok, puska: prebytokNaRozdelenie < prebytok ? ` − ${t("panel.puska")} = ${prebytokNaRozdelenie}` : "", komu: prebytokDrzi === ja ? t("panel.tebe") : mena[su], cena: cenaPola() })}
        </span>
        {!vysledok && rozdiel !== 0 && <span className="bitka-pozn tlmene">{t("panel.priRemize", { co: coPriRemize })}</span>}
        {props.poBitke != null && <span className="bitka-pozn">{t("panel.poBitkePrehra")} {props.poBitke}</span>}
        {!vysledok && <span className="bitka-pozn tlmene">{t("panel.podlaLinieMale")}</span>}
      </div>
      {strana(su, "vpravo")}
    </section>
  );
}

// ---- priebeh kola: časová os hore ---------------------------------------------------
//
// Michal 2026-10-20: úzka časová os je ako ruka stálou súčasťou obrazovky.
// Ukazuje celé kolo — pri viacerých Pitkách každé Zhromaždenie a Pitku zvlášť —
// a pri prejdení myšou, čo sa v danej časti robí.

interface KrokKola {
  readonly id: string;
  readonly nazov: string;
  readonly tip: TipObsah;
  /** Kratšie popisy pre úzku os (container query): stredný „Zhrom. 2“, najkratší „Z2“. */
  readonly stredne?: string;
  readonly kratke?: string;
}

function KrokOsi({
  krok,
  trieda,
  refEl,
  onKlik,
  pridavok,
}: {
  readonly krok: KrokKola;
  readonly trieda: string;
  readonly refEl?: RefObject<HTMLLIElement | null>;
  readonly onKlik?: (() => void) | undefined;
  /** Za názvom (hlava osi: „· na sekere 2 š.“). */
  readonly pridavok?: ReactNode;
}) {
  const { tip: okno, ukaz, skry } = useTip();
  return (
    <li
      ref={refEl}
      className={`${trieda}${onKlik !== undefined ? " klikatelny" : ""}`}
      tabIndex={0}
      onClick={onKlik}
      onKeyDown={onKlik === undefined ? undefined : (e) => (e.key === "Enter" || e.key === " ") && onKlik()}
      onMouseEnter={(e) => ukaz(e.currentTarget, krok.tip)}
      onMouseLeave={skry}
      onFocus={(e) => ukaz(e.currentTarget, krok.tip)}
      onBlur={skry}
    >
      {/* Aktuálny krok ostáva celý; ostatné sa na úzkej osi skrátia (hra.css, container os-kola). */}
      {trieda.includes("aktualny") || (krok.stredne === undefined && krok.kratke === undefined) ? (
        krok.nazov
      ) : (
        <>
          <span className="krok-dlhe">{krok.nazov}</span>
          <span className="krok-stredne">{krok.stredne ?? krok.nazov}</span>
          <span className="krok-kratke">{krok.kratke ?? krok.stredne ?? krok.nazov}</span>
        </>
      )}
      {pridavok}
      {okno}
    </li>
  );
}

export function PriebehKola({
  view,
  onBitka,
  onDraft,
}: {
  readonly view: ClientState;
  readonly onBitka?: (() => void) | undefined;
  /** Klik na krok Draft mimo Draftu ukáže šenok na pozretie (Michal 2026-10-27 — tlačidlo Šenok zaniklo). */
  readonly onDraft?: (() => void) | undefined;
}) {
  const pitiek = Math.max(1, view.pitkyCelkom);
  const viac = pitiek > 1;
  const pocetPozn =
    t("os.pocetPitiek");
  // Vo finále je „Finále“ hlavou osi (krokPartie) — krok „Finále“ by ho opakoval (dizajn timeline-lista, U2).
  const finale = view.ciel?.typ === "finale";
  const tipFinale: TipObsah = {
    nadpis: t("faza.finale"),
    text: (
      <>
        {t("os.finale")}
        <span className="tip-riadok">{t("os.finale2")}</span>
      </>
    ),
  };
  const kroky: KrokKola[] = [
    ...(finale
      ? []
      : [
          {
            id: "volbaCiela",
            nazov: t("faza.volbaCiela"),
            stredne: t("faza.volbaCielaStredne"),
            tip: {
              nadpis: t("faza.volbaCiela"),
              text: (
                <>
                  {t("os.volbaCiela")}
                  <span className="tip-riadok">{t("os.natocenie")}</span>
                </>
              ),
            },
          },
        ]),
    {
      id: "draft",
      nazov: t("faza.draft"),
      tip: {
        nadpis: t("faza.draft"),
        text: (
          <>
            {tr("os.stavba", { naradie: KONSTANTY.STAVBA_NARADIE, obcania: KONSTANTY.STAVBA_OBCANIA })}
            <span className="tip-riadok">
              {tr("os.branie", { jedna: KONSTANTY.CENA_SENKU[1] ?? 1, dve: KONSTANTY.CENA_SENKU[2] ?? 3 })}
            </span>
            <span className="tip-riadok">
              {tr("os.zajatie", { zajatie: KONSTANTY.CENA_ZAJATIA, presvedcenie: KONSTANTY.CENA_PRESVEDCENIA })}
            </span>
            {view.faza !== "draft" && <span className="tip-stav">{t("os.klikPonuka", { n: view.senok.length })}</span>}
          </>
        ),
      },
    },
  ];
  for (let i = 1; i <= pitiek; i++) {
    const cislo = viac ? ` ${i}` : "";
    kroky.push(
      {
        id: `zhromazdenie-${i}`,
        nazov: `${t("faza.zhromazdenie")}${cislo}`,
        stredne: `${t("faza.zhromazdenieStredne")}${cislo}`,
        kratke: viac ? `${t("faza.zhromazdenieSkratka")}${i}` : t("faza.zhromazdenieSkratka"),
        tip: {
          nadpis: t("os.zhromazdenie") + (viac ? ` (${t("os.izN", { i, n: pitiek })})` : ""),
          text: (
            <>
              {t("os.zhromazdenieText")}
              <span className="tip-riadok">
                {t("os.zhromazdenieText2")}
              </span>
              {viac && <span className="tip-stav">{pocetPozn}</span>}
            </>
          ),
        },
      },
      {
        id: `pitka-${i}`,
        nazov: `${t("faza.pitka")}${cislo}`,
        kratke: viac ? `${t("faza.pitkaSkratka")}${i}` : t("faza.pitkaSkratka"),
        tip: {
          nadpis: t("faza.pitka") + (viac ? ` ${t("os.izN", { i, n: pitiek })}` : ""),
          text: (
            <>
              {tr("os.pitkaText", { doliatie: KONSTANTY.REFILL_CENA })}
              <span className="tip-riadok">
                {t("os.pitkaText2")}
              </span>
              {viac && <span className="tip-stav">{pocetPozn}</span>}
            </>
          ),
        },
      },
    );
  }
  kroky.push({
    id: "bitka",
    nazov: t("faza.bitka"),
    tip: {
      nadpis: view.ciel?.typ === "finale" ? t("faza.finale") : t("os.bitkaOLokalitu"),
      text: (
        <>
          {t("os.bitkaText", { hodnota: HODNOTA_POLA })}
          <span className="tip-riadok">
            {t("os.bitkaText2", { cigarety: KONSTANTY.CIGARETY_PORAZENEMU, dobratie: KONSTANTY.DOBRATIE_PO_BITKE })}
          </span>
        </>
      ),
    },
  });

  const aktualneId =
    view.faza === "zhromazdenie"
      ? `zhromazdenie-${Math.min(pitiek, view.pitkaCislo + 1)}`
      : view.faza === "pitka"
        ? `pitka-${Math.max(1, view.pitkaCislo)}`
        : view.faza === "natocenieCiela"
          ? "volbaCiela"
          : view.faza;
  const aktualny = kroky.findIndex((k) => k.id === aktualneId);
  // Aktuálny krok vždy v zornom poli — pri 1280 px ho os orezávala (dizajn
  // hra-nezrovnalosti-20261021-1229, UI N1c). Hotové dvojice Zhromaždenie + Pitka
  // sa zbalia do „Z1 P1 ✓“, plný názov ostáva v nápovede.
  const aktualnyRef = useRef<HTMLLIElement | null>(null);
  useEffect(() => {
    const el = aktualnyRef.current;
    if (el === null) return;
    const rychlo = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    el.scrollIntoView({ inline: "center", block: "nearest", behavior: rychlo ? "auto" : "smooth" });
  }, [aktualneId, view.kolo]);
  const odohrane = view.nastenka.filter((b) => b.lokalita !== null).length;
  // view.lokalityVHre sú len lokality na výber (v7 jednej úrovne) — koľko ich ešte príde, ráta rozpis.
  const nevybrane = lokalitNevybranych(view);
  // Hlava osi počíta postup partie raz a jednotne s menu Partia: „Bitka 2 z 6“, posledná „Finále“.
  const hlava = krokPartie(view);
  const polozky: ReactNode[] = [];
  // Po konci hry os nestojí na „Voľbe cieľa“ ďalšieho kola, ktoré už nebude — ukáže koniec.
  if (view.koniec !== null) {
    polozky.push(
      <KrokOsi
        key="koniec"
        krok={{ id: "koniec", nazov: t("faza.koniecHry"), tip: { nadpis: t("faza.koniecHry"), text: view.koniec.dovod } }}
        trieda="aktualny"
        refEl={aktualnyRef}
      />,
    );
  }
  for (let i = 0; i < kroky.length && view.koniec === null; i++) {
    const k = kroky[i];
    const dalsi = kroky[i + 1];
    if (k === undefined) continue;
    const parHotovy = viac && k.id.startsWith("zhromazdenie-") && dalsi !== undefined && i + 1 < aktualny;
    if (parHotovy) {
      const cislo = k.id.slice("zhromazdenie-".length);
      polozky.push(
        <KrokOsi
          key={`par-${cislo}`}
          krok={{ id: `par-${cislo}`, nazov: `${t("faza.zhromazdenieSkratka")}${cislo} ${t("faza.pitkaSkratka")}${cislo} ✓`, tip: { nadpis: t("faza.parHotovy", { i: cislo, n: pitiek }), text: dalsi.tip.text } }}
          trieda="hotovy zbalene"
        />,
      );
      i++;
      continue;
    }
    // „Pitka 1 z 2“ je od jednotného baru len tu (Michal 2026-10-25) — aj pri Zhromaždení.
    polozky.push(
      <KrokOsi
        key={k.id}
        krok={
          i === aktualny && viac && k.id.startsWith("pitka-")
            ? { ...k, nazov: t("faza.pitkaZ", { i: k.id.slice(6), n: pitiek }) }
            : i === aktualny && viac && k.id.startsWith("zhromazdenie-")
              ? { ...k, nazov: t("faza.zhromazdenieZ", { i: k.id.slice(13), n: pitiek }) }
              : k
        }
        trieda={i === aktualny ? "aktualny" : i < aktualny ? "hotovy" : ""}
        {...(i === aktualny ? { refEl: aktualnyRef } : {})}
        onKlik={{ ucetBitky: onBitka, senok: onDraft, nic: undefined }[klikKrokuOsi(k.id, view.faza) ?? "nic"]}
      />,
    );
  }
  return (
    <ol className="priebeh-kola" aria-label={t("faza.kolo", { n: view.kolo })} data-vyucba="os-kola">
      <KrokOsi
        krok={{
          id: "hlava",
          nazov: hlava.text,
          kratke: hlava.kratko,
          tip: finale
            ? tipFinale
            : {
                nadpis: hlava.text,
                text: t("os.koloText", { kolo: view.kolo, i: Math.min(view.lokalitCelkom, odohrane + 1), n: view.lokalitCelkom, lokality: t("os.lokalit", { n: view.lokalitCelkom }), zostava: t("os.zostava", { n: nevybrane }), sekera: view.spakyNaSekere > 0 ? t("os.naSekereSpakov", { n: view.spakyNaSekere }) : "" }),
              },
        }}
        trieda={`priebeh-kolo${finale ? " finale" : ""}`}
        pridavok={view.spakyNaSekere > 0 ? <span className="priebeh-sekera">{t("faza.naSekere", { n: view.spakyNaSekere })}</span> : undefined}
      />
      {polozky}
    </ol>
  );
}
