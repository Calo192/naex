// Panely hernej plochy: doska hráča (zdroje), odhad/výsledok bitky,
// priebeh kola. Ukazovatele starších sú v Scorecard.tsx.
//
// Zásada: každé číslo, od ktorého závisí rozhodnutie (poldeci, cigarety,
// pečeň, dlhy, poškodenie), je veľké, pomenované a vždy na tom istom mieste.

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import type {
  Action,
  ActionSums,
  ClientState,
  DamageResult,
  GameData,
  NahladPitkyHraca,
  PlayerId,
  RozpisPoskodenia,
  SpakyTeraz,
  StavZavislosti,
  StavkaBitky as StavkaBitkyCisla,
  ZdrojeAkcii,
} from "@naex/core";
import { KONSTANTY, battleOutcome, cenaFajceniaHraca, hraVPitke, jeCielLokalita, limitBuduceKolo, limitZhromazdenia, lokalitNevybranych, pocet, spakov, tvar, vidiVolbuSupera } from "@naex/core";
import { ZMENA_SVIETI_MS, klikKrokuOsi, krokPartie, minSek, textZmeny } from "./stitokPartie.ts";
import type { Rod } from "@naex/core";
import type { Sada } from "@naex/tvorba";
import { IkonaAkcie } from "../karta/IkonaAkcie.tsx";
import { IKONY } from "../karta/ikony.ts";
import { useTip, type TipObsah } from "../karta/Tip.tsx";
import { Avatar } from "../komponenty.tsx";
import { BarSpakov } from "./BarSpakov.tsx";
import { BarStarsich, DlazdicaStarsich } from "./Starsi.tsx";
import { KartaHraca } from "./KartaHraca.tsx";
import type { HracInfo } from "./useHra.ts";
import { PocetSpakov } from "./Spaky.tsx";
import { CENA_POLA } from "./textyStarsich.ts";

// ---- ikony zdrojov -----------------------------------------------------------

// Cigareta a poldeci majú v celej hre jednu podobu — piktogram z karty
// (Michal 2026-10-21); stav hovorí farba: plný jantárový, vypitý sivý.
const piktogram = (kluc: "Cigareta" | "Poldeci"): ReactNode =>
  IKONY[kluc].map((c, i) => <path key={i} d={c.d} fillRule={c.evenOdd ? "evenodd" : "nonzero"} />);

export function IkonaPoldeci({ plny = true, novy = false }: { readonly plny?: boolean; readonly novy?: boolean }) {
  return (
    <svg className={`ikona-poldeci ${plny ? "plny" : "vypity"}${novy ? " novy" : ""}`} viewBox="0 0 100 100" aria-hidden="true">
      {piktogram("Poldeci")}
      {novy && <path className="plus" d="M78 62v34M61 79h34" />}
    </svg>
  );
}

export function IkonaCigareta({ zakaz = false }: { readonly zakaz?: boolean }) {
  return (
    <svg className={`ikona-cigareta${zakaz ? " zakaz" : ""}`} viewBox="0 0 100 100" aria-hidden="true">
      {piktogram("Cigareta")}
      {zakaz && <path className="preskrt" d="M10 92L90 8" />}
    </svg>
  );
}

/** Karta, ktorú hráč dostane (fajčenie: cigarety → karta). */
export function IkonaKarty({ zakaz = false }: { readonly zakaz?: boolean }) {
  return (
    <svg className={`ikona-karty${zakaz ? " zakaz" : ""}`} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="2.5" width="14" height="19" rx="2.2" />
      <rect className="ilustracia" x="7.3" y="4.8" width="9.4" height="8.4" rx="0.8" />
      {zakaz && <path className="preskrt" d="M3 22L21 2" />}
    </svg>
  );
}

/** Cena v cigaretách: „−2“ a malá cigareta. */
export function CenaCigariet({ n, znamienko = "−" }: { readonly n: number; readonly znamienko?: "−" | "+" }) {
  return (
    <span className="cena-cig">
      {znamienko}
      {n}
      <IkonaCigareta />
    </span>
  );
}

/**
 * Výmena v jednom poradí na každom tlačidle a náhľade (Michal 2026-10-28: „zjednotiť to treba“):
 * čo dáš → čo dostaneš. Cena v cigaretách vľavo, odmena vpravo; pri zisku cigariet
 * (pas) je vľavo úkon a vpravo +cigarety. Bez odmeny ostane len cena.
 */
export function Vymena({ das, dostanes }: { readonly das: ReactNode; readonly dostanes?: ReactNode }) {
  return (
    <span className="vymena">
      {das}
      {dostanes !== undefined && dostanes !== null && (
        <>
          <span className="pecat-sipka" aria-hidden="true">
            →
          </span>
          {dostanes}
        </>
      )}
    </span>
  );
}

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
 * Neresti kola proti súperovým (v8.1 Krok so stolom): dieliky po čiaru súpera
 * treba zaplniť, aby Absťák nepribudol; dielik za čiarou jeden Absťák zoberie.
 */
function NerestiPruh({ z }: { readonly z: StavZavislosti }) {
  const dieliky = Math.max(z.super + 1, z.teraz);
  return (
    <span className="neresti-pruh" aria-hidden="true">
      {Array.from({ length: dieliky }, (_, i) => {
        const plny = i < z.teraz;
        const trieda = i < z.super ? (plny ? "plny" : "chyba") : plny ? "plny nad" : "nad";
        return (
          <span key={i} className={trieda}>
            {i === z.super && <i className="ciara" />}
          </span>
        );
      })}
    </span>
  );
}

/** Krátky výhľad pod počítadlom a jeho trieda (farba). */
function vyhladAbstaku(z: StavZavislosti, ja: boolean): { text: string; trieda: string } {
  switch (z.vyhlad) {
    case "ziska":
      return { text: `hrozí +1 · chýba ${z.doBezpecia}`, trieda: "zly" };
    case "zbavi":
      return { text: `${ja ? "zbavíš" : "zbaví"} sa 1`, trieda: "dobry" };
    case "nic":
      return z.doZbavenia > 0
        ? { text: `bez zmeny · +${z.doZbavenia} = −1`, trieda: "" }
        : { text: "bez zmeny", trieda: "" };
  }
}

/** Absťák na doske: koľko ich má, čo robia, neresti kola a čo bude na konci kola. */
function ZdrojAbstak({ z, ja }: { readonly z: StavZavislosti; readonly ja: boolean }) {
  const vyhlad = vyhladAbstaku(z, ja);
  return (
    <Zdroj
      nazov="Absťák"
      trieda={`zdroj-abstak ${z.vyhlad === "ziska" ? "varovanie" : ""} ${z.abstaky > 0 ? "ma-abstak" : ""}`}
      ikona={<IkonaAbstak />}
      hodnota={
        <>
          <span className="velke-cislo">
            {z.abstaky}
            {z.ubera > 0 && <small className="abstak-ubera"> −{z.ubera} tuhé</small>}
          </span>
          {/* Prúžok vedľa čísla — bar má pevnú výšku, pod číslom sú len dva krátke riadky. */}
          <NerestiPruh z={z} />
        </>
      }
      pod={
        <>
          <span className="neresti-pocet">
            {ja ? `súper ${z.super} · ty ${z.teraz}` : `ty ${z.super} · on ${z.teraz}`}
          </span>
          <span className={`abstak-vyhlad ${vyhlad.trieda}`}>{vyhlad.text}</span>
        </>
      }
      tip={{
        nadpis: "Absťák",
        text: (
          <>
            <span className="tip-stav">
              {ja ? "Máš" : "Má"} {z.abstaky}
              {z.abstaky > 0 && ` · v bitke −${z.ubera} tuhé, +${z.pohorsenia} Pohoršenie`} · neresti {z.teraz}, súper {z.super} · {vyhlad.text}
            </span>
            Na konci kola sa porovnajú neresti oboch: menej ako súper = +1 Absťák, viac = jeden odíde, rovnako nič. Každý Absťák v bitke o ranu
            menej a 1 Pohoršenie navyše. Nerest je poldeci navyše, NA EX, cigareta, doliatie aj barter.
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
  tip,
}: {
  readonly nazov: string;
  readonly hodnota: ReactNode;
  readonly ikona?: ReactNode;
  readonly pod?: ReactNode;
  readonly trieda?: string;
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
          Ruka {hrac.rukaPocet} · balíček {hrac.doberaciPocet} · odhodené {hrac.odhadzovaci.length} · priznané kliatby {hrac.priznane.length} · náradie{" "}
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
        <>
          <span className="zdroj-nazov">Karty ▾</span>
          <span className="zdroj-hodnota">
            <span className="karty-pocty">
              <span>
                <b>{hrac.rukaPocet}</b> ruka
              </span>
              <span>
                <b>{hrac.doberaciPocet}</b> balíček
              </span>
              <span>
                <b>{hrac.odhadzovaci.length}</b> odhodené
              </span>
            </span>
          </span>
          <span className="zdroj-pod karty-oblast">
            kliatby {hrac.priznane.length} · náradie {hrac.dedicstvo.length}
            {karty.navrhy > 0 && <b> · +{karty.navrhy} v ťahu</b>}
          </span>
        </>
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
  readonly view: ClientState;
  /** Dáta sady — priazne do výhľadu limitu (Na zdravie „do dna“, v5). */
  readonly data: GameData;
  readonly p: PlayerId;
  readonly info: HracInfo | null;
  readonly prahy: { readonly cirhoza: number; readonly dlh: number; readonly exekucia: number; readonly priznaneDlhy: number };
  /** Absťáky, neresti kola a výhľad na koniec kola (stavZavislosti). */
  readonly zavislost: StavZavislosti;
  readonly menoKarty: (defId: string) => string;
  readonly popisKarty: (defId: string) => string;
  /** Výhľad Pitky (Zhromaždenie a Pitka) — inak null. */
  readonly vyhlad: VyhladPitky | null;
  /** Špaky jedného Dlhu na konci hry (v6: 0 — Dlh trestá Exekútor a remíza). */
  readonly cenaDlhu: number;
  /** Doliatie a nový poldeci za cigarety — len na tvojej doske (Michal 2026-10-18: nedali sa nájsť). */
  readonly obchodCigariet?:
    | { readonly mozno: boolean; readonly doliat: () => void; readonly novy: () => void; readonly cenaBarteru: number }
    | undefined;
  /** Špaky „keby hra skončila teraz“ — dlaždica Body (v6: špaky mínus nepriznaná Cirhóza). */
  readonly body: SpakyTeraz;
  /** Mená oboch hráčov podľa miesta. */
  readonly mena: readonly [string, string];
  /**
   * Dlaždica Starší (Michal 2026-10-27, S1 stupienky): klik prepne stôl na líniu starších
   * a oba bary na bar starších. `stlacene`: línia práve ukazuje tohto hráča.
   * posuny = koľko starších sa pohlo od poslednej bitky (stopa na stupnici, #95).
   */
  readonly starsi: { readonly stlacene: boolean; readonly prepni: () => void; readonly id: string; readonly posuny?: number };
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
  data,
  p,
  info,
  prahy,
  zavislost,
  menoKarty,
  popisKarty,
  vyhlad,
  cenaDlhu,
  obchodCigariet,
  body,
  mena,
  starsi,
  spakyKlik,
  karty,
  rezim,
  pocitadloBezi = false,
  spojenie,
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
  const skryteNaex = (view.pitkaStav?.skryteNaex ?? []).filter((x) => x.hrac === p).length;
  const kSkrytemu = ja
    ? vidiVolbuSupera(data, view, p === 0 ? 1 : 0)
      ? ", súper ho vidí cez Bzdochu"
      : ", súper ho ešte nevidí"
    : ", skryté — vidíš ho cez Bzdochu";
  const naexNaStole = view.strany[0].concat(view.strany[1]).filter((pl) => pl.naexBy === p || pl.naexBy2 === p).length + skryteNaex;
  const plne = Math.max(0, hrac.poldeciPlne - skryteNaex);
  // Limit, s ktorým hráč vstupuje do Zhromaždenia (so Zastávkou a Vínkom; NA EX na stole sa neráta).
  const limit = limitZhromazdenia(view, p);
  const buduci = limitBuduceKolo(view, p, false, data);
  const kto = ja ? "Máš" : "Má";
  const doNovehoPoldeci =
    hrac.cigarety >= KONSTANTY.BARTER_CENA ? "stačí na nový poldeci" : `${KONSTANTY.BARTER_CENA - hrac.cigarety} do nového poldeci`;
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
                  ? { nadpis: "Útočník finále", text: "Má menej špakov — dobieha (pri rovnosti prehral poslednú bitku). Vykladá prvý, v Pitke má posledné slovo." }
                  : { nadpis: "Obranca finále", text: "Vedie v špakoch: vybral a natočil vrcholovú lokalitu. V Pitke začína." }
                : utoci
                ? { nadpis: "Útočník", text: "Prehral poslednú bitku: zo šenku berie a vykladá prvý. V Pitke hrá druhý — má posledné slovo." }
                : { nadpis: "Obranca", text: "Vyhral poslednú bitku: vyberá cieľ kola, v Pitke začína. Remízu v tuhom vyhrá, kto má menej Absťákov, potom Dlhov; inak idú špaky na sekeru." }
            }
            frajerina={info?.frajerina}
          />
          {spojenie !== undefined && !spojenie.pripojeny && <span className="doska-odpojeny">○ odpojený {minSek(odpojenyMs)}</span>}
          {/* Nepriznané kliatby pod menom; priznané a Dedičstvo sú v dlaždici KARTY (Michal 2026-10-23, #76). */}
          {kliatby.cirhoza > 0 && (
            <span className="doska-oblast">
              <span
                className="cip kliatba"
                title={
                  ja
                    ? `Tvoje nepriznané kliatby v ruke a v balíčkoch. Každá Cirhóza ti na konci hry zoberie ${pocet(KONSTANTY.SPAKY_ZA_CIRHOZU, "špak", "špaky", "špakov")}.`
                    : `Súperove nepriznané kliatby podľa toho, čo bolo vidno na stole. Každá Cirhóza mu na konci hry zoberie ${pocet(KONSTANTY.SPAKY_ZA_CIRHOZU, "špak", "špaky", "špakov")}.`
                }
              >
                nepriznané · Cirhóza ×{kliatby.cirhoza}
              </span>
            </span>
          )}
        </div>
      </div>

      {/* display: contents — dlaždice sú priamo v mriežke baru (poradie v hra.css). */}
      <div className="doska-zdroje">
        {rezim === "spaky" && <BarSpakov view={view} p={p} body={body} menoKarty={menoKarty} />}
        {rezim === "starsi" && <BarStarsich view={view} data={data} p={p} menoKarty={menoKarty} />}
        <Zdroj
          nazov="Poldeci"
          trieda="zdroj-poldeci"
          hodnota={
            <>
              <span className="poldeci-rad">{poldeci.length > 0 ? poldeci : "—"}</span>
              <span className="velke-cislo">{plne}</span>
            </>
          }
          pod={
            <>
              {/* Každý riadok vo vlastnom prvku — v úzkej dlaždici sa skráti trojbodkou, nezalomí (malý notebook).
                  „Na stole“ pred „vypité“: trojbodka zrezala práve ju (UI inšpekcia 2026-10-24). */}
              <span>
                plné{naexNaStole > 0 && ` · ${naexNaStole} na stole`} · {hrac.poldeciVypite} vypité
              </span>
              <b>limit kariet {limit}</b>
            </>
          }
          tip={{
            nadpis: "Poldeci",
            text: (
              <>
                <span className="tip-stav">
                  {kto} {plne} plné, {hrac.poldeciVypite} vypité{naexNaStole > 0 && `, ${naexNaStole} na stole (NA EX${skryteNaex > 0 ? kSkrytemu : ""})`} · limit kariet{" "}
                  {limit}
                  {jeCielLokalita(view, "zastavka") && " (Zastávka: spoločný pre oboch)"} · ďalšie kolo {buduci}
                </span>
                Limit vykladania = plné + 1; na začiatku kola sa {KONSTANTY.POLDECI_NA_ZACIATKU_KOLA} vypitý doleje sám. Plný poldeci platí ďalšiu
                kartu v ťahu Zhromaždenia alebo NA EX v Pitke. Na konci hry je každý plný {KONSTANTY.SPAKY_ZA_POLDECI} špak (výkupné).
              </>
            ),
          }}
        />
        <Zdroj
          nazov="Cigarety"
          trieda="zdroj-cigarety"
          ikona={<IkonaCigareta />}
          hodnota={<span className="velke-cislo">{hrac.cigarety}</span>}
          pod={
            obchodCigariet === undefined ? (
              doNovehoPoldeci
            ) : (
              <>
                {/* Na nízkom okne sa tlačidlá do baru nezmestia — v Pitke sú aj pečiatkami na hrane stola. */}
                <span className="obchod-text">{doNovehoPoldeci}</span>
                <span className="obchod-cigariet">
                <button
                  disabled={!obchodCigariet.mozno || hrac.cigarety < KONSTANTY.REFILL_CENA || hrac.poldeciVypite === 0}
                  title={
                    obchodCigariet.mozno
                      ? `Za ${KONSTANTY.REFILL_CENA} cigarety otočíš vypitý poldeci na plný.`
                      : "Doliať poldeci sa dá v Pitke na tvojom ťahu."
                  }
                  onClick={obchodCigariet.doliat}
                >
                  <Vymena das={`−${KONSTANTY.REFILL_CENA}`} dostanes="doliať" />
                </button>
                <button
                  disabled={!obchodCigariet.mozno || hrac.cigarety < obchodCigariet.cenaBarteru}
                  title={
                    obchodCigariet.mozno
                      ? `Za ${obchodCigariet.cenaBarteru} cigariet nový plný poldeci navyše (natrvalo o jeden viac).`
                      : "Nový poldeci za cigarety sa kupuje v Pitke na tvojom ťahu."
                  }
                  onClick={obchodCigariet.novy}
                >
                  <Vymena das={`−${obchodCigariet.cenaBarteru}`} dostanes="nový poldeci" />
                </button>
                </span>
              </>
            )
          }
          tip={{
            nadpis: "Cigarety",
            text: (
              <>
                <span className="tip-stav">
                  {kto} {hrac.cigarety} · {doNovehoPoldeci}
                </span>
                Platíš nimi šenok a Dedičstvo; v Pitke na svojom ťahu fajčíš: karta za 1 cigaretu, ďalšia v tej istej Pitke za 2, potom 3…
                {view.faza === "pitka" && ` (${ja ? "tvoje" : "jeho"} ďalšie teraz za ${cenaFajceniaHraca(view, p)})`}. Doliatie poldeci stojí {KONSTANTY.REFILL_CENA}, nový
                poldeci {obchodCigariet?.cenaBarteru ?? KONSTANTY.BARTER_CENA}. Na konci hry každých {KONSTANTY.CIGARIET_ZA_SPAK} cigariet = 1 špak (výkupné).
              </>
            ),
          }}
        />
        <ZdrojAbstak z={zavislost} ja={ja} />
        <Zdroj
          nazov="Pečeň"
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
        {/* Dlhy a Zadĺženie v jednej dlaždici (Michal 2026-10-27): číslo = priznané Dlhy k Exekútorovi,
            pod ním zadĺženie k ďalšiemu Dlhu (v7 po Pitke neprepadá). Vyučba zvýrazňuje obe časti zvlášť (bar:dlhy, bar:zadlzenie). */}
        <Zdroj
          nazov="Dlhy"
          trieda={`zdroj-dlhy ${
            (v?.dlhy ?? 0) > 0 || prahy.exekucia > 0 ? "hrozi" : zadlzeniePo >= prahy.dlh - 1 ? "varovanie" : ""
          }`}
          hodnota={
            <span className="velke-cislo">
              {prahy.priznaneDlhy}
              {prahy.exekucia > 0 && <small> −{prahy.exekucia}</small>}
            </span>
          }
          pod={
            <>
              <span className={`dlhy-zadlzenie ${zadlzeniePo >= prahy.dlh - 1 ? "zly" : ""}`} data-vyucba-prvok="zadlzenie">
                zadĺženie {hrac.zadlzenie}
                {v !== null && v.zadlzenieZoStola > 0 && <span className="projekcia"> ▸ {zadlzeniePo}</span>}/{prahy.dlh}
              </span>
              {vyhladZadlzenia !== null ? (
                <TextVyhladu x={vyhladZadlzenia} />
              ) : prahy.exekucia > 0 ? (
                <span>exekúcia v bitke: −{spakov(prahy.exekucia)}</span>
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
                  {prahy.exekucia > 0 ? ` · exekúcia v tejto bitke: −${spakov(prahy.exekucia)}` : prahy.priznaneDlhy > 0 ? " · Záhradkár: exekúcia ťa obíde" : ""} · zadĺženie {hrac.zadlzenie}
                  {v !== null && v.zadlzenieZoStola > 0 && ` ▸ ${zadlzeniePo}`} z {prahy.dlh}
                  {vyhladZadlzenia !== null && ` · ${vyhladPitky(vyhladZadlzenia).cele.join(" · ")}`}
                </span>
                Každé {prahy.dlh} zadĺženia v Pitke = Dlh, hneď priznaný; zvyšok zadĺženia po Pitke ostáva a čaká na ďalší Dlh (v7). Za priznané Dlhy príde v každej bitke
                Exekútor: zhorí polovica Dlhov (zaokrúhlene nahor) a toľko špakov, so súperovou priazňou Exekútora o 1 / 2 / 3 viac. Záhradkár v tvojej partii ho v tom kole obíde.
              </>
            ),
          }}
        />
        <DlazdicaKariet hrac={hrac} ja={ja} karty={karty} />
        <button
          type="button"
          className={`zdroj zdroj-body${spakyKlik.stlacene ? " stlacene" : ""}`}
          aria-pressed={spakyKlik.stlacene}
          data-vyucba-prvok="body"
          title={
            spakyKlik.stlacene
              ? "Zavrieť nástenku (Esc)"
              : `${ja ? "Tvoje špaky" : `Špaky ${meno}`}: ${body.spaky[p]}. Po bitke, ak ju ${ja ? "vyhráš" : "vyhrá"}, ${ja ? "ti" : "mu"} starší, ktorí sa ${ja ? "ťa" : "ho"} boja, dajú ${body.zaStarsich[p]} (dlaždica Starší).` +
                (body.vykupne[p].spaky > 0 && view.koniec === null ? ` Výkupné poldeci a cigariet na konci hry: +${body.vykupne[p].spaky}.` : "") +
                (body.cirhozy[p] > 0 ? ` Nepriznaná Cirhóza ×${body.cirhozy[p]}: na konci hry −${body.cirhozy[p] * KONSTANTY.SPAKY_ZA_CIRHOZU}.` : "") +
                " Klik ukáže nástenku: odkiaľ sú špaky po bitkách."
          }
          onClick={spakyKlik.prepni}
        >
          <span className="zdroj-nazov">Špaky {spakyKlik.stlacene ? "▴" : "▾"}</span>
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
        <DlazdicaStarsich view={view} p={p} zaStarsich={body.zaStarsich[p]} starsi={starsi} />
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

/** Dôvody, ktoré akciu karty zdvojujú (NA EX, Posilnenie, efekt karty ako Silná žena). */
function jeZdvojenie(dovod: string): boolean {
  return dovod === "NA EX" || dovod === "Posilnenie" || dovod.startsWith("karta:");
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
}) {
  const { tip: okno, ukaz, skry } = useTip();
  const viditelne = zmeny.filter((z) => z !== 0);
  return (
    <span
      className={`efekt ${trieda ?? ""}`}
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
          : d.startsWith("karta:")
            ? `efekt karty ${menoKarty(d.slice(6))}`
            : d;

  const aktivne = PORADIE_AKCII.filter((a) => (sums[a] ?? 0) !== 0 || (a === "Povera" && rozpis.poveraIgnorovana > 0) || (zdroje[a] ?? []).length > 0);
  // Názvy sa zmestia len k pár akciám — pri viacerých by sa ikony na strane baru nezmestili.
  const sNazvami = sNazvom && aktivne.length <= 4;
  const dlazdice: ReactNode[] = [];
  for (const a of aktivne) {
    const hodnota = sums[a] ?? 0;
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
    const sila = SILA[a];
    const stav: string[] = [];
    if (sila !== undefined) stav.push(`${hodnota} × ${sila} = ${hodnota * sila} tuhého poškodenia`);
    if (a === "Viera") {
      stav.push(`hodnota jednej Viery ${rozpis.hodnotaViery}`);
      if (zrusene > 0) stav.push(`${zrusene} zrušila súperova Povera`);
    }
    if (a === "Povera") {
      if (ignorovana > 0) stav.push(`${ignorovana} ignoruje súperov Farár`);
      if (zrusene > 0) stav.push(`${zrusene} zrušila súperova Viera`);
      stav.push(Number.isFinite(rozpis.makkeStrop) ? `mäkké poškodenie najviac ${rozpis.makkeStrop} (súperove priznané Dlhy)` : "mäkké poškodenie bez stropu");
    }
    dlazdice.push(
      <Dlazdica
        key={a}
        trieda={sila !== undefined ? "tuha" : ""}
        ikona={<IkonaAkcie kluc={a} akcia={akcia(a)} />}
        {...(sNazvami ? { nazov: nazov(a) } : {})}
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
  makke,
  celkove,
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
  readonly makke: number;
  readonly celkove: number;
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
          {makke > 0 ? `+ ${makke} mäkké (Povera) = celkom ${celkove}` : `celkom ${celkove}`} — celkové určí, kto rozdelí prebytok. Pri
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
        <span className="bitka-doplnok">{makke > 0 ? `+${makke} mäkké · ` : ""}celkom {celkove}</span>
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
}

export interface HrozbaBitky {
  readonly kto: "ja" | "su";
  /** NA EX z kariet na stole (predvolené), rozsah nepridelených Pohoršení, alebo kliatby z NA EX (#38 B). */
  readonly zdroj?: "naex" | "pohorsenia" | "kliatby";
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
      {hrozby[0]?.zdroj === "pohorsenia" ? "" : "ešte môže: "}
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
function verdiktBitky({ damage, ja, vysledok, naSekeru, poslednaBitka, prebytokNaRozdelenie, rodJa = null }: BitkaPanelProps) {
  const su = (ja === 0 ? 1 : 0) as PlayerId;
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

/** Nápoveda odhadu v bare: čo býval celý panel bitky, a stávka (Michal 2026-10-25: len v nápovede). */
export function tipOdhadu(props: BitkaPanelProps, stavka: StavkaBitkyCisla | null, prepnutNa: string): TipObsah {
  const { damage, ja, vysledok, mena, ciel, naSekeru, prebytokNaRozdelenie, utocnik } = props;
  const { su, prebytok, prebytokDrzi, rozdiel, coPriRemize, verdikt } = verdiktBitky(props);
  return {
    nadpis: `${vysledok ? "Výsledok bitky" : "Odhad bitky"}${ciel === "" ? "" : ` · ${ciel}`}`,
    text: (
      <>
        <b>{verdikt}</b> · tuhé {damage.tuhe[ja]} : {damage.tuhe[su]}
        <span className="tip-riadok">
          {prebytokDrzi === null
            ? "prebytok: nikto"
            : `prebytok ${prebytok}${prebytokNaRozdelenie < prebytok ? ` − Puška = ${prebytokNaRozdelenie}` : ""} → ${prebytokDrzi === ja ? "tebe" : mena[su]} · ${CENA_POLA}`}
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
        {!vysledok && stavka !== null && (
          <span className="tip-riadok">
            táto bitka ({pocet(stavka.karty, "karta", "karty", "kariet")} v línii): tvoja výhra <b>+{stavka.vyhra} špakov</b>, súperova <b>+{-stavka.prehra}</b>
            {stavka.starsi[0] + stavka.starsi[1] > 0 && (
              <>
                {" "}
                (z toho od starších {stavka.starsi[0]} / {stavka.starsi[1]})
              </>
            )}
            {stavka.naSekere > 0 && <> · na sekere {stavka.naSekere}</>}
          </span>
        )}
        {utocnik !== undefined && <span className="tip-riadok">{utocnik}</span>}
        <span className="tip-stav">
          {vysledok ? "" : "Podľa aktuálnej línie. "}Klik ukáže na stranách baru {prepnutNa}.
        </span>
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
      makke={damage.makke[p]}
      celkove={damage.celkove[p]}
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
            ? "prebytok: nikto"
            : `prebytok ${prebytok}${prebytokNaRozdelenie < prebytok ? ` − Puška = ${prebytokNaRozdelenie}` : ""} → ${prebytokDrzi === ja ? "tebe" : mena[su]} · ${CENA_POLA}`}
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
    "Pitiek je 1 + menší z počtov aktivovaných akcií karty v strede na jej dvoch stranách — počet sa mení, keď hráči vykladajú karty k lokalite.";
  // Vo finále je „Finále“ hlavou osi (krokPartie) — krok „Finále“ by ho opakoval (dizajn timeline-lista, U2).
  const finale = view.ciel?.typ === "finale";
  const tipFinale: TipObsah = {
    nadpis: "Finále",
    text: (
      <>
        Posledná bitka na vrcholovej lokalite (v7): útočí, kto má menej špakov (pri rovnosti porazený poslednej bitky), a vedúci
        vyberie a natočí lokalitu. Kraje, prevaha aj počet Pitiek ako na každej lokalite.
        <span className="tip-riadok">Po finále dajú starší ešte raz špaky za nové zóny (aj z prebytku, ktorý rozdelí jeho držiteľ) a odpočíta sa nepriznaná Cirhóza.</span>
      </>
    ),
  };
  const kroky: KrokKola[] = [
    ...(finale
      ? []
      : [
          {
            id: "volbaCiela",
            nazov: "Voľba cieľa",
            stredne: "Voľba",
            tip: {
              nadpis: "Voľba cieľa",
              text: (
                <>
                  Obranca (víťaz poslednej bitky) vyberie lokalitu a natočí ju.
                  <span className="tip-riadok">Natočenie určuje, ktoré akcie lokality sú obrátené ku ktorej strane.</span>
                </>
              ),
            },
          },
        ]),
    {
      id: "draft",
      nazov: "Draft",
      tip: {
        nadpis: "Draft — šenok a patronát",
        text: (
          <>
            <b>Stavba šenku:</b> obaja naraz dajú z balíčka stavby polovicu kariet do šenku a polovicu naspodok spoločného
            balíčka — bez podávania.
            <span className="tip-riadok">
              <b>Branie:</b> striedavo, začína útočník — 1 karta za {KONSTANTY.CENA_SENKU[1]} cigaretu, 2 karty za {KONSTANTY.CENA_SENKU[2]}{" "}
              cigarety. Bez cigariet sa nedá brať. Kto prestane, súperovi nechá už len jeden posledný ťah.
            </span>
            <span className="tip-riadok">
              <b>Patronát:</b> komu starší prejavuje priazeň (aspoň žltá), smie si ho vziať do ruky — najprv útočník, potom obranca.
              Na jeho miesto dá lícom dole Občana či Zviera z ruky, marker ide do stredu. Platí cigarety podľa zóny (červená 1, oranžová 2,
              žltá 3), súper dostane
              v bitke Pohoršenia (o koľko marker išiel do stredu). Výhra = starší je jeho; prehra = odhodí poldeci.
            </span>
            {view.faza !== "draft" && <span className="tip-stav">Klik ukáže, čo ostalo v šenku ({view.senok.length}).</span>}
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
        nazov: `Zhromaždenie${cislo}`,
        stredne: `Zhrom.${cislo}`,
        kratke: viac ? `Z${i}` : "Z",
        tip: {
          nadpis: `Zhromaždenie${viac ? ` ${i} z ${pitiek}` : ""}`,
          text: (
            <>
              Striedavo vykladáte karty z ruky na hociktorú stranu línie, začína útočník. Limit vykladania = plné poldeci + poldeci na
              stole + 1; každá ďalšia karta v tom istom ťahu stojí plný poldeci.
              <span className="tip-riadok">
                Kedykoľvek na ťahu: priznať kliatbu (za Cirhózu sa nedoberá; Dlh sa prizná sám pri dobratí), Nástroj do Dedičstva (za cigarety, cena rastie);
                fajčí sa až v Pitke. Kto pasuje, do Pitky už nevykladá a dostane cigaretu za každú kartu, ktorú ešte smel
                vyložiť, najviac toľko, koľko má kariet v ruke. Končí, keď obaja vyčerpajú limit alebo pasujú.
              </span>
              {viac && <span className="tip-stav">{pocetPozn}</span>}
            </>
          ),
        },
      },
      {
        id: `pitka-${i}`,
        nazov: `Pitka${cislo}`,
        kratke: viac ? `P${i}` : "P",
        tip: {
          nadpis: `Pitka${viac ? ` ${i} z ${pitiek}` : ""}`,
          text: (
            <>
              <b>Začína obranca</b>; keď dá „hotovo“, hrá útočník a má posledné slovo („hotovo“ sa nedá vrátiť). NA EX! — plný poldeci na
              Občana či Starešinu v línii: zruší jeho aktívne akcie a zdvojí neaktívne (násobky sa násobia: NA EX × Silná žena = ×4); súper
              smie hneď odpovedať jednou kartou. Fajčiť (karta za 1, 2, 3… cig. v každej Pitke), doliať poldeci ({KONSTANTY.REFILL_CENA} cig.), nový poldeci (barter).
              <span className="tip-riadok">
                Potom sa pripíšu akcie: Dlh (zadĺženie — za každý celý prah Dlh, hneď priznaný), Poškodenie pečene a Poldeci (za každý celý
                prah Cirhóza do odhadzovacieho balíčka), Obmedzenie, Cigarety a Vízia. Pečeň aj zadĺženie sa po Pitke vynulujú.
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
    nazov: "Bitka",
    tip: {
      nadpis: view.ciel?.typ === "finale" ? "Finále" : "Bitka o lokalitu",
      text: (
        <>
          Rozhoduje tuhé poškodenie (Rana 1, Pecka 2, Petelica 3; mínus súperova Viera a vlastné Absťáky). Pri rovnakom tuhom vyhrá, kto
          má menej Absťákov, potom menej priznaných Dlhov; inak sekera — špaky kola čakajú na víťaza ďalšej bitky (vo finále prepadnú).
          Víťaz dostane toľko špakov, koľko Pitiek sa odohralo (mínus rozdiel Absťákov, aspoň 1) a lokalita ide na krčmovú nástenku.
          Potom víťazovi dajú špaky starší, ktorí sa ho boja (žltá 1, oranžová 2, červená 3); porazený od nich nič, pri sekere dostanú
          obaja. Kto má vyššie celkové, rozdelí prebytok —
          posúva markery starších; po finále ho dostane ako špaky.
          <span className="tip-riadok">
            Potom Exekútor, Pohoršenie, prebytok… a každý si dobere {pocet(KONSTANTY.KARTY_PO_BITKE, "kartu", "karty", "kariet")}. Porazený je v ďalšom kole
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
        krok={{ id: "koniec", nazov: "Koniec hry", tip: { nadpis: "Koniec hry", text: view.koniec.dovod } }}
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
          krok={{ id: `par-${cislo}`, nazov: `Z${cislo} P${cislo} ✓`, tip: { nadpis: `Zhromaždenie a Pitka ${cislo} z ${pitiek} — hotové`, text: dalsi.tip.text } }}
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
            ? { ...k, nazov: `Pitka ${k.id.slice(6)} z ${pitiek}` }
            : i === aktualny && viac && k.id.startsWith("zhromazdenie-")
              ? { ...k, nazov: `Zhromaždenie ${k.id.slice(13)} z ${pitiek}` }
              : k
        }
        trieda={i === aktualny ? "aktualny" : i < aktualny ? "hotovy" : ""}
        {...(i === aktualny ? { refEl: aktualnyRef } : {})}
        onKlik={{ ucetBitky: onBitka, senok: onDraft, nic: undefined }[klikKrokuOsi(k.id, view.faza) ?? "nic"]}
      />,
    );
  }
  return (
    <ol className="priebeh-kola" aria-label={`Kolo ${view.kolo}`} data-vyucba="os-kola">
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
        pridavok={view.spakyNaSekere > 0 ? <span className="priebeh-sekera"> · na sekere {view.spakyNaSekere} š.</span> : undefined}
      />
      {polozky}
    </ol>
  );
}
