// Panely hernej plochy: doska hráča (zdroje), odhad/výsledok bitky,
// priebeh kola. Ukazovatele starších sú v Scorecard.tsx.
//
// Zásada: každé číslo, od ktorého závisí rozhodnutie (poldeci, cigarety,
// pečeň, dlhy, poškodenie), je veľké, pomenované a vždy na tom istom mieste.

import { Fragment, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import type { Action, ActionSums, ClientState, DamageResult, Favour, GameData, NahladPitkyHraca, OdhadSpakov, PlayerId, RozpisPoskodenia, StavZavislosti, StavkaBitky as StavkaBitkyCisla, ZdrojeAkcii } from "@naex/core";
import { KONSTANTY, barterCena, battleOutcome, cenaFajceniaHraca, hraVPitke, jeCielLokalita, limitBuduceKolo, limitZhromazdenia, lokalitNevybranych, pocet, spakov, tvar, vidiVolbuSupera, opponentOf } from "@naex/core";
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
import { CENA_POLA, HODNOTA_POLA } from "./textyStarsich.ts";
import { NA_STOLE_VYSVETLENIE, poldeciNaStole, ukazZadlzenie, zadlzenieHrozi } from "./tabula.ts";
import type { SpakyTeraz } from "@naex/core";
import { t } from "../i18n/jazyk.tsx";

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
    const text = `po kole Chuť ${z.chutPo}`;
    return { text, naDlazdici: text, trieda: "" };
  }
  // Na dlaždici bez „inak“: pri 1366 a 1440 sa celé varovanie skrátilo na „…+1 Ab…“.
  return { text: `chýba ${z.doBezpecia} · inak +1 Absťák`, naDlazdici: `chýba ${z.doBezpecia} · +1 Absťák`, trieda: "zly" };
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
            {z.abstaky > 0 && <small className="abstak-ubera"> Absťák ×{z.abstaky}</small>}
          </span>
          {/* Prúžok vedľa čísla — bar má pevnú výšku, pod číslom sú len dva krátke riadky. */}
          <NerestiPruh z={z} />
        </>
      }
      pod={
        <>
          <span className="neresti-pocet">dnes {z.teraz}</span>
          <span className={`abstak-vyhlad ${vyhlad.trieda}`}>{vyhlad.naDlazdici}</span>
        </>
      }
      tip={{
        nadpis: "Chuť a Absťák",
        text: (
          <>
            <span className="tip-stav">
              Chuť {z.chut} · dnes {z.teraz} · {vyhlad.text}
              {z.abstaky > 0 && ` · ${ja ? "máš" : "má"} ${z.abstaky} Absťák${z.abstaky === 1 ? "" : z.abstaky < 5 ? "y" : "ov"} v balíčku, v bitke −${z.ubera} tuhé`}
            </span>
            Nerest je len to, čo vypiješ a vyfajčíš: Vypiť 1, odpoveď na NA EX 1, NA EX {KONSTANTY.NEREST_NAEX}, každá vyfajčená cigareta 1 (doliatie, barter ani platby nie). Na konci kola:
            menej nerestí než Chuť = karta Absťák do odhadzovacieho balíčka; potom Chuť = väčšie z (Chuť, neresti) − {KONSTANTY.CHUT_UBYTOK}. Absťák sa nedá
            priznať, po bitke ide z ruky späť do odhadzovacieho a každý v balíčku ti v bitke uberie 1 tuhé. Spáliť ho smie Vízia. Po finále sa nič nerieši.
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
  return n === 1 ? "ďalšia Pitka" : n >= 2 && n <= 4 ? `ďalšie ${n} Pitky` : `ďalších ${n} Pitiek`;
}

/**
 * Výhľad Pitky: v dlaždici najviac dva krátke riadky, celé znenie do nápovedy
 * (Michal 2026-10-23: tri riadky sa do baru s pevnou výškou nezmestili, text
 * sa orezal a číslo prekrylo nadpis).
 */
function vyhladPitky(x: VstupVyhladu): { readonly kratke: readonly { readonly text: string; readonly zly: boolean }[]; readonly cele: readonly string[] } {
  const vsetky = x.kliatby + x.opakovane * x.dalsiePitky;
  const pitka = `${x.vPitke ? "po Pitke" : "v Pitke"}: ${x.kliatby > 0 ? `${x.meno} ×${x.kliatby}${x.bitka === undefined ? bodov(x.kliatby * x.cena) : ""}` : "nič"}`;
  const dalsie = x.dalsiePitky > 0 && x.opakovane > 0 ? `a v ${x.dalsiePitky === 1 ? "ďalšej Pitke" : `ďalších ${x.dalsiePitky} Pitkách`} znova ×${x.opakovane}` : null;
  const poBitke =
    x.bitka === undefined || vsetky === 0
      ? null
      : `${x.bitka.pali > 0 ? `bitka spáli až ${x.bitka.pali} → ostane ×${x.bitka.ostane}` : `po bitke ostanú ×${x.bitka.ostane}`}${bodov(x.bitka.ostane * x.cena)}`;
  const kratke = [{ text: pitka, zly: x.kliatby > 0 }];
  // Druhý riadok: Dlh — čo ostane po bitke (zahŕňa aj ďalšie Pitky); Cirhóza — ďalšie Pitky.
  if (x.bitka !== undefined && poBitke !== null) kratke.push({ text: `po bitke ×${x.bitka.ostane}${bodov(x.bitka.ostane * x.cena)}`, zly: x.bitka.ostane > 0 });
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
    nadpis: "Karty",
    text: (
      <>
        <span className="tip-stav">
          {karty.vylozi.tip} · ruka {hrac.rukaPocet} · balíček {hrac.doberaciPocet} · odhodené {hrac.odhadzovaci.length} · priznané kliatby {hrac.priznane.length} · náradie{" "}
          {hrac.dedicstvo.length}
        </span>
        {ja ? "Klik (alebo O) ukáže balíček, odhodené, priznané a Dedičstvo. Kliatbu či Nástroj pustíš sem." : "Klik ukáže súperove priznané kliatby a Dedičstvo."}
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
              <b>{hrac.rukaPocet}</b> ruka
            </span>
            <span>
              <b>
                {hrac.priznane.length}
                {karty.navrhy > 0 && `+${karty.navrhy}`}
              </b>{" "}
              priznané
            </span>
          </span>
        </span>
      ) : (
        <>
          <span className="zdroj-nazov">{c.zamknute !== null ? "sem teraz nie" : "pusti sem"}</span>
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
      {utoci ? "⚔ útočník" : "⛨ obranca"}
      {frajerina !== undefined && <span className="doska-frajerina" title="Frajerina">{frajerina}</span>}
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
  menoSupera = "súper",
  mena,
  pult,
}: HracDoskaProps) {
  const hrac = view.hraci[p];
  const ja = p === view.ja;
  const spakyVidno = useSpakyVDlazdici(view.spaky[p], pocitadloBezi);
  const odpojenyMs = useOdpojenyCas(spojenie?.odpojenyOd ?? null, spojenie !== undefined && !spojenie.pripojeny);
  const meno = info?.meno ?? `Hráč ${p + 1}`;
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
      ? ", súper ho vidí cez Bzdochu"
      : ", súper ho ešte nevidí"
    : ", skryté — vidíš ho cez Bzdochu";
  const plne = Math.max(0, hrac.poldeciPlne - skryteNaex);
  const vypiteSoStolom = hrac.poldeciVypite + naexNaStole;
  // Limit, s ktorým hráč vstupuje do Zhromaždenia (so Zastávkou a Vínkom; NA EX na stole sa neráta).
  const limit = limitZhromazdenia(view, p);
  const buduci = limitBuduceKolo(view, p, false, data);
  const kto = ja ? "Máš" : "Má";
  const cenaNovehoPoldeci = barterCena(data, view, p);
  const doNovehoPoldeci = hrac.cigarety >= cenaNovehoPoldeci ? "stačí na nový poldeci" : `${cenaNovehoPoldeci - hrac.cigarety} do nového poldeci`;
  const utoci = view.utocnik === p;
  const v = vyhlad?.nahlad ?? null;
  const pecenPo = v === null ? hrac.pecen : v.pecen + v.pecenZoStola;
  const zadlzeniePo = v === null ? hrac.zadlzenie : v.zadlzenie + v.zadlzenieZoStola;
  const vyhladPecene: VstupVyhladu | null =
    vyhlad === null || v === null
      ? null
      : {
          kliatby: v.cirhozy,
          meno: "Cirhóza",
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
          meno: "Dlh",
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
      aria-label={`Hráč ${meno}`}
      data-vyucba={ja ? "bar" : "bar-supera"}
    >
      <div className="doska-hrac">
        <KartaHraca info={info} meno={meno} ja={ja}>
          <Avatar meno={meno} avatar={info?.avatar ?? null} velkost={60} farba={ja ? "ja" : "su"} />
          {spojenie !== undefined && (
            <span
              className={`avatar-spojenie ${spojenie.pripojeny ? "online" : "offline"}`}
              role="img"
              aria-label={spojenie.pripojeny ? "pri stole" : "odpojený"}
              title={spojenie.pripojeny ? `${meno} je pri stole` : `${meno} je odpojený`}
            />
          )}
        </KartaHraca>
        <div>
          <strong className="doska-meno">
            {meno} {ja && <span className="tlmene">(ty)</span>}
          </strong>
          <Rola
            utoci={utoci}
            tip={
              view.ciel?.typ === "finale"
                ? utoci
                  ? { nadpis: "Útočník finále", text: "Má menej špakov — dobieha (pri rovnosti prehral poslednú bitku). Vykladá prvý, na NA EX odpovedá prvý." }
                  : { nadpis: "Obranca finále", text: "Vedie v špakoch: vybral vrcholovú lokalitu. V Pitke začína." }
                : utoci
                ? { nadpis: "Útočník", text: "Prehral poslednú bitku: vykladá prvý, z ponuky berie druhý. Na NA EX odpovedá prvý — lícom dole." }
                : { nadpis: "Obranca", text: "Vyhral poslednú bitku: vyberá cieľ kola, z ponuky berie prvý (na prvom ťahu 1 kartu), na NA EX odpovedá druhý na druhý kraj. Remízu v tuhom vyhrá, kto má menej Absťákov, potom Dlhov; inak idú špaky na sekeru." }
            }
            frajerina={info?.frajerina}
          />
          {spojenie !== undefined && !spojenie.pripojeny && <span className="doska-odpojeny">○ odpojený {minSek(odpojenyMs)}</span>}
          {/* Nepriznané kliatby pod menom; priznané a Dedičstvo sú v dlaždici KARTY (Michal 2026-10-23, #76). */}
          {((view.pata === undefined && kliatby.cirhoza > 0) || zavislost.abstaky > 0) && (
            <span className="doska-oblast">
              <span
                className="cip kliatba"
                title={
                  view.pata !== undefined
                    ? "Absťák sa nedá priznať — každý v balíčku uberie v bitke 1 tuhé."
                    : (ja
                    ? `Tvoje nepriznané kliatby v ruke a v balíčkoch. Každá Cirhóza ti na konci hry zoberie ${pocet(KONSTANTY.SPAKY_ZA_CIRHOZU, "špak", "špaky", "špakov")}.`
                    : `Súperove nepriznané kliatby podľa toho, čo bolo vidno na stole. Každá Cirhóza mu na konci hry zoberie ${pocet(KONSTANTY.SPAKY_ZA_CIRHOZU, "špak", "špaky", "špakov")}.`) +
                  (zavislost.abstaky > 0 ? " Absťák sa nedá priznať — každý v balíčku uberie v bitke 1 tuhé." : "")
                }
              >
                nepriznané{view.pata === undefined && kliatby.cirhoza > 0 && ` · Cirhóza ×${kliatby.cirhoza}`}
                {zavislost.abstaky > 0 && ` · Absťák ×${zavislost.abstaky}`}
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
                <span className="pod-plne">plné · </span>
                {vypiteSoStolom} vypité{naexNaStole > 0 && ` (${naexNaStole} na stole)`}
              </span>
              <b>limit kariet {limit}</b>
            </>
          }
          tip={{
            nadpis: "Poldeci",
            text: (
              <>
                {prisunPoldeci !== undefined && <RozpisZdroja prisun={prisunPoldeci} />}
                <span className="tip-stav">
                  {kto} {plne} plné, {vypiteSoStolom} vypité{naexNaStole > 0 && ` (z toho ${naexNaStole} na stole cez NA EX${skryteNaex > 0 ? kSkrytemu : ""})`} · limit kariet{" "}
                  {limit}
                  {jeCielLokalita(view, "zastavka") && " (Zastávka: spoločný pre oboch)"} · ďalšie kolo {buduci}
                </span>
                Limit vykladania = plné + 1; na začiatku kola sa {KONSTANTY.POLDECI_NA_ZACIATKU_KOLA} vypitý doleje sám. Plný poldeci platí ďalšiu
                kartu v ťahu Zhromaždenia alebo NA EX v Pitke. Na konci hry je každý plný {KONSTANTY.SPAKY_ZA_POLDECI} špak (výkupné).
                {naexNaStole > 0 && ` ${NA_STOLE_VYSVETLENIE}`}
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
            nadpis: "Cigarety",
            text: (
              <>
                {prisunCigariet !== undefined && <RozpisZdroja prisun={prisunCigariet} />}
                <span className="tip-stav">
                  {kto} {hrac.cigarety} · {doNovehoPoldeci}
                </span>
                Platíš nimi karty z ponuky a Dedičstvo; v Pitke na svojom ťahu fajčíš: karta za 1 cigaretu, ďalšia v tej istej Pitke za 2, potom 3…
                {jeCielLokalita(view, "benzinka") && " (Benzínka: každé o 1 lacnejšie — 0, 1, 2…)"}
                {view.faza === "pitka" && ` (${ja ? "tvoje" : "jeho"} ďalšie teraz ${cenaFajceniaHraca(view, p) === 0 ? "zadarmo" : `za ${cenaFajceniaHraca(view, p)}`})`}. Doliatie poldeci stojí {KONSTANTY.REFILL_CENA}, nový poldeci {cenaNovehoPoldeci}{ja && " — v Pitke ich máš na hrane stola"}. Na konci hry každých {KONSTANTY.CIGARIET_ZA_SPAK} cigariet = 1 špak (výkupné).
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
            nadpis: "Pečeň",
            text: (
              <>
                <span className="tip-stav">
                  {hrac.pecen}
                  {v !== null && v.pecenZoStola > 0 && ` ▸ ${pecenPo}`} z {prahy.cirhoza}
                  {vyhladPecene !== null && ` · ${vyhladPitky(vyhladPecene).cele.join(" · ")}`}
                </span>
                Za každé {prahy.cirhoza} vznikne v Pitke Cirhóza: nepriznaná {ja ? "ti" : "mu"} na konci hry zoberie {pocet(KONSTANTY.SPAKY_ZA_CIRHOZU, "špak", "špaky", "špakov")}, priznaná dá
                súperovi +1 tuhé v bitke. Po každej Pitke sa pečeň vynuluje.
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
                  zadĺženie {hrac.zadlzenie}
                  {v !== null && v.zadlzenieZoStola > 0 && <span className="projekcia"> ▸ {zadlzeniePo}</span>}/{prahy.dlh}
                </span>
              )}
              {vyhladZadlzenia !== null ? (
                <TextVyhladu x={vyhladZadlzenia} />
              ) : prahy.exekucia > 0 ? (
                <span>exekúcia v bitke: {view.pata === undefined ? `−${spakov(prahy.exekucia)}` : `každému staršiemu −${prahy.exekucia}`}</span>
              ) : prahy.priznaneDlhy > 0 ? (
                <span>Záhradkár: exekúcia ťa obíde</span>
              ) : (
                <span>bez Dlhov</span>
              )}
            </>
          }
          tip={{
            nadpis: "Dlhy",
            text: (
              <>
                <span className="tip-stav">
                  {prahy.priznaneDlhy} {prahy.priznaneDlhy === 1 ? "priznaný Dlh" : "priznané Dlhy"}
                  {prahy.exekucia > 0 ? ` · exekúcia v tejto bitke: ${view.pata === undefined ? `−${spakov(prahy.exekucia)}` : `každému staršiemu −${prahy.exekucia} pečene`}` : prahy.priznaneDlhy > 0 ? " · Záhradkár: exekúcia ťa obíde" : ""}
                  {ukazZadlzenie(hrac.zadlzenie, prahy.dlh) && ` · zadĺženie ${hrac.zadlzenie}${v !== null && v.zadlzenieZoStola > 0 ? ` ▸ ${zadlzeniePo}` : ""} z ${prahy.dlh}`}
                  {vyhladZadlzenia !== null && ` · ${vyhladPitky(vyhladZadlzenia).cele.join(" · ")}`}
                </span>
                {prahy.dlh > 1 ? `Každé ${prahy.dlh} zadĺženia v Pitke = Dlh, hneď priznaný; zvyšok zadĺženia po Pitke ostáva a čaká na ďalší Dlh.` : "Každá akcia Hazard v Pitke = Dlh, hneď priznaný."} Za priznané Dlhy príde v každej bitke
                {view.pata === undefined ? (
                  <>Exekútor: zhorí polovica Dlhov (zaokrúhlene nahor) a toľko špakov, tvoja priazeň Advokáta z nich uberie 1 / 2 / 3. Záhradkár v tvojej partii ho v tom kole obíde.</>
                ) : (
                  "Exekúcia v bitke: zhorí polovica Dlhov nahor a každý stojaci starší stratí 1 pečeň za každý spálený Dlh; štít ju netlmí."
                )}
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
              ? "Zavrieť nástenku (Esc)"
              : `${ja ? "Tvoje špaky" : `Špaky ${meno}`}: ${body.spaky[p]}. Po najbližšej bitke ${ja ? "ti" : "mu"} starší dajú ${body.zaStarsichVyhra[p]} pri výhre a ${body.zaStarsichPrehra[p]} pri prehre (dlaždica Starší).` +
                (body.vykupne[p].spaky > 0 && view.koniec === null ? ` Výkupné poldeci a cigariet na konci hry: +${body.vykupne[p].spaky}.` : "") +
                (body.cirhozy[p] > 0 ? ` Nepriznaná Cirhóza ×${body.cirhozy[p]}: na konci hry −${body.cirhozy[p] * KONSTANTY.SPAKY_ZA_CIRHOZU}.` : "") +
                " Klik ukáže nástenku: odkiaľ sú špaky po bitkách."
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
const ZDROJ_ROZPISU: Readonly<Record<string, string>> = {
  cirhoza: "súperove priznané Cirhózy",
  BITKAR: "priazeň Bitkára",
  Viera: "súperova nezrušená Viera",
  abstak: "Absťáky (trasú sa ruky)",
  pasca: "súperova Pasca (−1 za každé tvoje Zviera v línii)",
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
      ? "zdvojená Posilnením"
      : d === "NA EX"
        ? "zdvojená cez NA EX"
        : d === "Vzbura"
          ? "aktivovaná Vzburou"
          : d === "Forsáž"
            ? "zdvojená Forsážou"
            : d === "Odpor proti Posilneniu"
            ? "aktivovaná Odporom proti Posilneniu"
            : d.startsWith("karta:")
              ? `efekt karty ${menoKarty(d.slice(6))}`
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
        {z.hodnota < 0 ? `súperov ${menoKarty(z.defId)}` : menoKarty(z.defId)}
        {z.vStrede ? " (karta v strede)" : ""}: <b>{znamienko(z.hodnota)}</b>
        {z.dovody.length > 0 ? ` — ${z.dovody.map(dovod).join(", ")}` : ""}
      </span>
    ));
    if (ohovaracka > 0) {
      riadky.push(
        <span key="ohovaracka" className="tip-riadok">
          Ohováračka (priazeň): <b>{znamienko(ohovaracka)}</b>
        </span>,
      );
    }
    const sila = SILA[a];
    const stav: string[] = [];
    if (sila !== undefined) stav.push(`${hodnota} × ${sila} = ${hodnota * sila} tuhého poškodenia`);
    if (a === "Viera") {
      stav.push(`hodnota jednej Viery ${rozpis.hodnotaViery}`);
      if (zrusene > 0) stav.push(`${zrusene} minutá na súperove Povery`);
      if (rozpis.veriaciPo !== rozpis.veriaciPred) stav.push(`Veriaci: pred hádkou ${rozpis.veriaciPred}, po hádke ${rozpis.veriaciPo}`);
    }
    if (a === "Povera") {
      if (ignorovana > 0) stav.push(`${ignorovana} ignoruje súperov Farár`);
      if (zrusene > 0) stav.push(`${zrusene} zrušila súperova Viera`);
      stav.push(`zvyšné ${rozpis.zvysnaPovera} = ${rozpis.zvysnaPovera * rozpis.silaPovery} mäkké do hádky`);
    }
    // Hádka (v10): Pohoršenie je 2 mäkké, Viera ho nezruší.
    if (a === "Pohoršenie") stav.push(`${hodnota} × 2 = ${hodnota * 2} mäkké do hádky`);
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
          nadpis: `${nazov(a)} ${hodnota}${navyse > 0 ? ` (z toho ${znamienko(navyse)} zdvojením)` : ""}`,
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
  return dlazdice.length > 0 ? <>{dlazdice}</> : <span className="efekty-ziadne">žiadne aktívne akcie</span>;
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
  const zdroj = (z: string): string => ZDROJ_ROZPISU[z] ?? menoKarty(z);
  const bonus = rozpis.bonusy.reduce((s, z) => s + z.hodnota, 0);
  const zrazka = rozpis.zrazky.reduce((s, z) => s + z.hodnota, 0);
  const tipTuhe: TipObsah = {
    nadpis: `Tuhé poškodenie ${tuhe}`,
    text: (
      <>
        Rozhoduje o víťazovi bitky. Rana 1, Pecka 2, Petelica 3.
        <span className="tip-riadok">
          z akcií: <b>{rozpis.zAkcii}</b>
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
          Rozdiel tuhého je Nakladačka, drží ju víťaz (Pohoršenia a Povery sú mäkké — rozhodujú len hádku, v10). Pri
          rovnakom tuhom vyhrá, kto má menej Absťákov, potom menej priznaných Dlhov; inak idú špaky na sekeru.
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
                <span className="bitka-skryta" title="Záverečná lícom dole — jej príspevok nevidíš, môže byť aj viac.">
                  ?
                </span>
              )}
            </span>
          }
          hodnota={<span className="bitka-popis">tuhé</span>}
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
      {hrozby[0]?.zdroj === "hadka" ? "" : "ešte môže: "}
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
    ? "menej Absťákov, potom menej Dlhov; inak špaky prepadnú (finále)"
    : "menej Absťákov, potom menej Dlhov; inak špaky na sekeru";
  const verdikt =
    rozdiel === 0
      ? `Remíza — ${coPriRemize}`
      : vysledok
        ? vyhravam
          ? tvar(rodJa, "Vyhral si bitku", "Vyhrala si bitku", "Bitka je vyhratá")
          : tvar(rodJa, "Prehral si bitku", "Prehrala si bitku", "Bitka je prehratá")
        : vyhravam
          ? `Vyhrávaš o ${rozdiel}`
          : `Prehrávaš o ${rozdiel}`;
  // V bare je na verdikt jeden krátky riadok — čo prinesie remíza, povie nápoveda.
  const kratko = rozdiel === 0 ? "Remíza" : verdikt;
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
      <span className="jbar-nadpis">{vysledok ? "výsledok" : "odhad"}</span>
      <b className={`jbar-verdikt ${vitaz === null ? "remiza" : vyhravam ? "vyhravam" : "prehravam"}`}>
        {kratko}
        {skrytaSupera === true && !vysledok && " ?"}
      </b>
      <span className="jbar-tuhe" title="tuhé poškodenie ty : súper">
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
      ? "Remíza"
      : vysledok
        ? hadkaVedie
          ? tvar(rodJa, "Vyhral si", "Vyhrala si", "Hádka je vyhratá")
          : tvar(rodJa, "Prehral si", "Prehrala si", "Hádka je prehratá")
        : hadkaVedie
          ? `Vyhrávaš o ${hadkaRozdiel}`
          : `Prehrávaš o ${hadkaRozdiel}`;
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
        {riadok("bitka", damage.tuhe[ja], damage.tuhe[su], otaznik, `${kratko}${otaznik === "" ? "" : " ?"}`, vitaz === null ? "remiza" : vyhravam ? "vyhravam" : "prehravam")}
        {riadok("hádka", mak[0], mak[1], "", hadkaText, hadkaRozdiel === 0 ? "remiza" : hadkaVedie ? "vyhravam" : "prehravam")}
      </span>
      {spaky != null && kraj("su", spaky.hraci[su].spolu)}
    </span>
  );
}

/** Rozpis odhadu špakov v nápovede stredu baru: čo sa skladá do čísel na krajoch. */
function RozpisSpakovKola({ spaky, ja, menoSupera }: { readonly spaky: OdhadSpakov; readonly ja: PlayerId; readonly menoSupera: string }) {
  const su = opponentOf(ja);
  const [t, s] = [spaky.hraci[ja], spaky.hraci[su]];
  const riadky: readonly (readonly [string, number, number])[] = [
    ["Za bitku", t.zaBitku, s.zaBitku],
    ["Nakladačka vo finále", t.nakladacka, s.nakladacka],
    ["Hádka vo finále", t.hadka, s.hadka],
    ["Starší", t.starsi, s.starsi],
    ["Robota", t.robota, s.robota],
    ["Exekútor", -t.exekutor, -s.exekutor],
  ];
  return (
    <span className="tip-riadok">
      <span className="tip-spaky">
        <b>Špaky po kole, keď to tak ostane</b>
        <b>ty</b>
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
        <b className="spolu">Spolu</b>
        <b className="spolu">{znSpakov(t.spolu)}</b>
        <b className="spolu">{znSpakov(s.spolu)}</b>
      </span>
      {spaky.obrat !== null && (
        <span className="tip-riadok">
          {spaky.vitaz === ja ? "Keď súper bitku otočí" : "Keď bitku otočíš"}: ty {znSpakov(spaky.obrat[ja])}, súper {znSpakov(spaky.obrat[su])}
          {t.nakladacka + s.nakladacka > 0 ? " a Nakladačka podľa obratu." : "."}
        </span>
      )}
      {spaky.naSekeru > 0 && <span className="tip-riadok">Na sekeru pôjde {spakov(spaky.naSekeru)}, vezme ich víťaz ďalšej bitky.</span>}
      {spaky.prepadne > 0 && <span className="tip-riadok">Sekera vo finále: {spakov(spaky.prepadne)} prepadne.</span>}
      <span className="tip-riadok">Bez krádeže pri zajatí (rozhodne sa až pri delení Nakladačky) a výkupného na konci hry.</span>
    </span>
  );
}

/** Nápoveda odhadu v bare: čo býval celý panel bitky, a stávka (Michal 2026-10-25: len v nápovede). */
export function tipOdhadu(props: BitkaPanelProps, stavka: StavkaBitkyCisla | null, ucetPitky: string | null = null): TipObsah {
  const { damage, ja, vysledok, mena, ciel, naSekeru, prebytokNaRozdelenie, utocnik } = props;
  const { su, prebytok, prebytokDrzi, rozdiel, coPriRemize, verdikt } = verdiktBitky(props);
  return {
    nadpis: `${vysledok ? "Výsledok bitky" : "Odhad bitky"}${ciel === "" ? "" : ` · ${ciel}`}`,
    text: (
      <>
        <b>{verdikt}</b> · tuhé {damage.tuhe[ja]} : {damage.tuhe[su]}
        <span className="tip-riadok">
          {prebytokDrzi === null
            ? "Nakladačka: nikto"
            : `Nakladačka ${prebytok}${prebytokNaRozdelenie < prebytok ? ` − Puška = ${prebytokNaRozdelenie}` : ""} → ${prebytokDrzi === ja ? "tebe" : mena[su]} · ${CENA_POLA}`}
        </span>
        {(props.hrozby ?? []).map((h) => (
          <span key={klucHrozby(h)} className="tip-riadok">
            {h.cele}
          </span>
        ))}
        {naSekeru.length > 0 && (
          <span className="tip-riadok">
            na sekere {naSekeru.join(", ")} — vezme ich víťaz
          </span>
        )}
        {!vysledok && rozdiel !== 0 && <span className="tip-riadok">pri remíze: {coPriRemize}</span>}
        {props.poBitke != null && <span className="tip-riadok">po bitke (efekty Prehra): {props.poBitke}</span>}
        {(props.priazne ?? []).length > 0 && (
          <span className="tip-riadok tip-priazne">
            priazne:
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
            táto bitka ({pocet(stavka.karty, "karta", "karty", "kariet")} v línii): tvoja výhra <b>+{stavka.vyhra} špakov</b>, súperova <b>+{-stavka.prehra}</b>
            {stavka.naSekere > 0 && <> · na sekere {stavka.naSekere}</>}
          </span>
        )}
        {utocnik !== undefined && <span className="tip-riadok">{utocnik}</span>}
        {ucetPitky !== null && <span className="tip-riadok">{ucetPitky}</span>}
        {!vysledok && <span className="tip-stav">Podľa aktuálnej línie.</span>}
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
    <section className={`bitka-panel ${vitaz === null ? "" : vyhravam ? "vyhravam" : "prehravam"}`} aria-label="Bitka">
      {strana(ja, "vlavo")}
      <div className="bitka-stred">
        <span className="bitka-nadpis">
          {vysledok ? "Výsledok bitky" : "Odhad bitky"} · {ciel}
        </span>
        {utocnik !== undefined && <span className="bitka-pozn">{utocnik}</span>}
        {naSekeru.length > 0 && (
          <span className="bitka-sekera" title="Špaky z predošlých remíz — víťaz tejto bitky ich dostane navyše.">
            na sekere {naSekeru.join(", ")} — vezme ich víťaz
          </span>
        )}
        <span className="bitka-verdikt">{verdikt}</span>
        <RiadkyHrozby hrozby={props.hrozby} ukazHrozbu={props.ukazHrozbu} />
        <span className="bitka-pozn">
          {prebytokDrzi === null
            ? "Nakladačka: nikto"
            : `Nakladačka ${prebytok}${prebytokNaRozdelenie < prebytok ? ` − Puška = ${prebytokNaRozdelenie}` : ""} → ${prebytokDrzi === ja ? "tebe" : mena[su]} · ${CENA_POLA}`}
        </span>
        {!vysledok && rozdiel !== 0 && <span className="bitka-pozn tlmene">pri remíze: {coPriRemize}</span>}
        {props.poBitke != null && <span className="bitka-pozn">po bitke (efekty Prehra): {props.poBitke}</span>}
        {!vysledok && <span className="bitka-pozn tlmene">podľa aktuálnej línie</span>}
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
    "Pitiek je 1 + menší z počtov aktivovaných akcií karty v strede v jej dvoch krajoch — počet sa mení, keď hráči vykladajú karty k lokalite.";
  // Vo finále je „Finále“ hlavou osi (krokPartie) — krok „Finále“ by ho opakoval (dizajn timeline-lista, U2).
  const finale = view.ciel?.typ === "finale";
  const tipFinale: TipObsah = {
    nadpis: "Finále",
    text: (
      <>
        Posledná bitka na vrcholovej lokalite (v7): útočí, kto má menej špakov (pri rovnosti porazený poslednej bitky), a vedúci
        vyberie lokalitu, natočí ju víťaz poslednej hádky. Kraje, prevaha aj počet Pitiek ako na každej lokalite.
        <span className="tip-riadok">Nakladačka a hádka sa vo finále nerozdeľujú — víťaz za ne dostane 1 špak za každý bod. Starší bodujú ako po každej bitke, výpalné a cigareta porazenému sa neplatia. Potom sa vykúpi, čo ostalo, a odpočíta sa nepriznaná Cirhóza.</span>
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
              nadpis: "O čo sa bijeme",
              text: (
                <>
                  Obranca (víťaz poslednej bitky) vyberie lokalitu, natočí ju víťaz minulej hádky (po remíze obranca).
                  <span className="tip-riadok">Natočenie určuje, ktoré akcie lokality sú obrátené ku ktorému kraju.</span>
                </>
              ),
            },
          },
        ]),
    {
      id: "draft",
      nazov: t("faza.draft"),
      tip: {
        nadpis: "Ponuka",
        text: (
          <>
            <b>Stavba ponuky:</b> každý dostane {KONSTANTY.STAVBA_NARADIE} karty z balíčka nástrojov a {KONSTANTY.STAVBA_OBCANIA} z balíčka dedinčanov; obaja
            naraz dajú polovicu do ponuky a polovicu naspodok ich balíčka — bez podávania.
            <span className="tip-riadok">
              <b>Branie:</b> striedavo, začína obranca (na prvom ťahu len 1 kartu) — 1 karta za {KONSTANTY.CENA_SENKU[1]} cigaretu, 2 karty za {KONSTANTY.CENA_SENKU[2]}{" "}
              cigarety. Bez cigariet sa nedá brať. Kto prestane, súperovi nechá už len jeden posledný ťah.
            </span>
            <span className="tip-riadok">
              <b>Zajatie a presvedčenie</b> sú po bitke pri rozdelení: za {KONSTANTY.CENA_ZAJATIA} z Nakladačky zajmeš staršieho na svojom červenom strachu,
              za {KONSTANTY.CENA_PRESVEDCENIA} z hádky presvedčíš staršieho, ktorý sa súpera bojí viac než teba.
            </span>
            {view.faza !== "draft" && <span className="tip-stav">Klik ukáže, čo ostalo v ponuke ({view.senok.length}).</span>}
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
          nadpis: `Zhromaždenie — kladenie kariet${viac ? ` (${i} z ${pitiek})` : ""}`,
          text: (
            <>
              Striedavo vykladáte karty z ruky na hociktorý koniec línie, začína útočník. Limit vykladania = plné poldeci + poldeci na
              stole + 1; každá ďalšia karta v tom istom ťahu stojí plný poldeci.
              <span className="tip-riadok">
                Kedykoľvek na ťahu: priznať Cirhózu (kartu za ňu nedostaneš, súper za ňu v bitke +1 tuhé), Nástroj do Dedičstva (za cigarety, cena rastie);
                fajčí sa až v Pitke. Kto pasuje, do Pitky už nevykladá a dostane cigaretu za každú kartu, ktorú ešte smel
                vyložiť, aj keď už nemá čím. Končí, keď obaja vyčerpajú limit alebo pasujú.
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
          nadpis: `Pitka${viac ? ` ${i} z ${pitiek}` : ""}`,
          text: (
            <>
              <b>Hráte obaja naraz</b>; „hotovo“ sa nedá vrátiť a NA EX sa odkryjú naraz. NA EX! — plný poldeci na
              Občana či Starešinu v línii: zruší jeho aktívne akcie a zdvojí neaktívne (násobky sa násobia: NA EX × Silná žena = ×4); súper
              smie po odkrytí odpovedať jednou kartou lícom dole (najprv útočník, potom obranca na druhý kraj; otočia sa naraz). Fajčiť (karta za 1, 2, 3… cig. v každej Pitke), doliať poldeci ({KONSTANTY.REFILL_CENA} cig.), nový poldeci (barter).
              <span className="tip-riadok">
                Potom sa pripíšu akcie: Hazard (každá akcia Dlh, hneď priznaný), Poškodenie pečene a Poldeci (za každý celý
                prah Cirhóza do odhadzovacieho balíčka), Obmedzenie, Cigarety a Vízia. Pečeň sa po Pitke vynuluje.
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
      nadpis: view.ciel?.typ === "finale" ? "Finále" : "Bitka o lokalitu",
      text: (
        <>
          Rozhoduje tuhé poškodenie (Rana 1, Pecka 2, Petelica 3; mínus súperova Viera a vlastné Absťáky). Pri rovnakom tuhom vyhrá, kto
          má menej Absťákov, potom menej priznaných Dlhov; inak sekera — špaky kola čakajú na víťaza ďalšej bitky (vo finále prepadnú).
          Víťaz dostane 1 špak za každú kartu v línii (aspoň 1) a lokalita ide na krčmovú nástenku. Starší bodujú hneď po bitke: stupeň {HODNOTA_POLA} dostane, kto ho drží — reči obaja, strach len víťaz.
          Rozdiel tuhého je Nakladačka: víťaz ju rozdelí na svoj strach (vo finále za ňu dostane špaky 1 : 1).
          <span className="tip-riadok">
            Najprv hádka (mäkké), potom poškodenie, starší, Exekútor a rozdelenie Nakladačky a hádky. Potom porazený dostane {KONSTANTY.CIGARETY_PORAZENEMU} cigaretu a súper ti zaplatí výpalné za tvoj červený strach. Na začiatku kola si každý dobere {KONSTANTY.DOBRATIE_PO_BITKE} karty. Porazený je v ďalšom kole
            útočník.
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
                text: `Kolo ${view.kolo}, lokalita ${Math.min(view.lokalitCelkom, odohrane + 1)} z ${view.lokalitCelkom}. Hrá sa o ${pocet(view.lokalitCelkom, "lokalitu", "lokality", "lokalít")} a finále; ${nevybrane >= 2 && nevybrane <= 4 ? "zostávajú" : "zostáva"} ${pocet(nevybrane, "nevybraná", "nevybrané", "nevybraných")}${view.spakyNaSekere > 0 ? `, na sekere ${view.spakyNaSekere} špakov` : ""}.`,
              },
        }}
        trieda={`priebeh-kolo${finale ? " finale" : ""}`}
        pridavok={view.spakyNaSekere > 0 ? <span className="priebeh-sekera">{t("faza.naSekere", { n: view.spakyNaSekere })}</span> : undefined}
      />
      {polozky}
    </ol>
  );
}
