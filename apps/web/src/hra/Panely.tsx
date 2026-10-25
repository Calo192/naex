// Panely hernej plochy: doska hráča (zdroje), odhad/výsledok bitky,
// priebeh kola. Ukazovatele starších sú v Scorecard.tsx.
//
// Zásada: každé číslo, od ktorého závisí rozhodnutie (poldeci, cigarety,
// pečeň, dlhy, poškodenie), je veľké, pomenované a vždy na tom istom mieste.

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import type {
  Action,
  ActionSums,
  BodyTeraz,
  ClientState,
  DamageResult,
  GameData,
  NahladPitkyHraca,
  PlayerId,
  RozpisPoskodenia,
  StavZavislosti,
  StavkaBitky as StavkaBitkyCisla,
  ZdrojeAkcii,
} from "@naex/core";
import { KONSTANTY, battleOutcome, textNeresti as neresti, jeCielLokalita, limitBuduceKolo, limitZhromazdenia, pocet, tvar } from "@naex/core";
import type { Rod } from "@naex/core";
import type { Sada } from "@naex/tvorba";
import { IkonaAkcie } from "../karta/IkonaAkcie.tsx";
import { IKONY } from "../karta/ikony.ts";
import { useTip, type TipObsah } from "../karta/Tip.tsx";
import { Avatar } from "../komponenty.tsx";
import { BodovyBar, type BodovyBarProps } from "./BodovyBar.tsx";
import { KartaHraca } from "./KartaHraca.tsx";
import type { HracInfo } from "./useHra.ts";
import { znamienko as znamienkoBodov } from "./Scorecard.tsx";

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
 * Neresti kola proti minulému: dieliky po čiaru minulého kola treba
 * zaplniť, aby Absťák nepribudol; dielik za čiarou jeden Absťák zoberie.
 */
function NerestiPruh({ z }: { readonly z: StavZavislosti }) {
  const prve = z.vyhlad === "zaklad";
  const dieliky = prve ? Math.max(z.teraz, 1) : Math.max(z.minule + 1, z.teraz);
  return (
    <span className="neresti-pruh" aria-hidden="true">
      {Array.from({ length: dieliky }, (_, i) => {
        const plny = i < z.teraz;
        const trieda = prve
          ? plny ? "plny" : ""
          : i < z.minule
            ? plny ? "plny" : "chyba"
            : plny ? "plny nad" : "nad";
        return (
          <span key={i} className={trieda}>
            {!prve && i === z.minule && <i className="ciara" />}
          </span>
        );
      })}
    </span>
  );
}

/** Krátky výhľad pod počítadlom a jeho trieda (farba). */
function vyhladAbstaku(z: StavZavislosti, ja: boolean): { text: string; trieda: string } {
  switch (z.vyhlad) {
    case "zaklad":
      return { text: "1. kolo = základ", trieda: "" };
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
  const ty = ja ? "ti" : "mu";
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
            neresti {z.teraz}
            {z.vyhlad !== "zaklad" && <> / minule {z.minule}</>}
          </span>
          <span className={`abstak-vyhlad ${vyhlad.trieda}`}>{vyhlad.text}</span>
        </>
      }
      tip={{
        nadpis: `Absťák — ${ja ? "máš" : "má"} ${z.abstaky}`,
        text: (
          <>
            <span className="tip-stav">
              {z.abstaky === 0
                ? `Teraz ${ty} Absťák v bitke nič neuberá.`
                : `V bitke ${ty} ${z.abstaky === 1 ? "uberie" : "uberú"} ${z.ubera} tuhé poškodenie${z.autobusar ? " (Autobusár 1 ignoruje)" : ""} — trasú sa ${ty} ruky.`}
            </span>
            <span className="tip-riadok">
              <b>Kedy príde a odíde:</b> na konci kola, po bitke, sa porovnajú neresti tohto kola s minulým.{" "}
              <b>Menej</b> → +1 Absťák (rovno priznaný, dobereš si za neho kartu). <b>Rovnako</b> → nič. <b>Viac</b> → jeden
              Absťák odíde. Prvé kolo len nastaví základ.
              {z.manzelky > 0 &&
                ` Milujúca manželka (${z.manzelky}×): Absťák príde aj pri ${z.manzelky === 1 ? "rovnakom počte nerestí" : `o ${z.manzelky - 1} viac nerestiach`} ako minule.`}
            </span>
            <span className="tip-riadok">
              <b>Nerest je:</b> každý vypitý poldeci v Zhromaždení (ďalšia karta v ťahu), NA EX (poldeci sa vypije v bitke),
              každá vyfajčená cigareta, doliatie poldeci (2) a stokársky barter (za každú cigaretu). Platba za šenok,
              Dedičstvo a Starostu sa nepočíta.
            </span>
            <span className="tip-riadok">
              <b>Toto kolo:</b> {neresti(z.teraz)}
              {z.naexNaStole > 0 && ` (z toho ${z.naexNaStole} NA EX na stole)`}
              {z.vyhlad === "zaklad"
                ? ". Je to prvé kolo — určí, koľko nerestí bude treba v druhom."
                : `, minulé kolo ${neresti(z.minule)}. ${
                    z.vyhlad === "ziska"
                      ? `Bez ďalších ${neresti(z.doBezpecia)} ${ja ? "dostaneš" : "dostane"} Absťák.`
                      : z.vyhlad === "zbavi"
                        ? `${ja ? "Zbavíš" : "Zbaví"} sa jedného Absťáku.`
                        : z.doZbavenia > 0
                          ? `Absťák nepribudne; ešte ${neresti(z.doZbavenia)} a jeden odíde.`
                          : "Absťák nepribudne."
                  }`}
            </span>
            <span className="tip-riadok">
              <b>Krčmárka</b> (ak ju máš): bez Absťáku a bez NA EX v kole otočí pri bitke vypitý poldeci na plný.
            </span>
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
  /** Body jednej kliatby navyše pri dnešných scorecardoch (záporné). */
  readonly cenaCirhozy: number;
  readonly cenaDlhu: number;
  /**
   * Nové Dlhy z Pitiek kola po najbližšej bitke (návrh #1 B): koľko ich bitka
   * najviac spáli (Robota, Dievčina na vydaj) a koľko z nich ostane.
   */
  readonly dlhyBitka: { readonly pali: number; readonly ostane: number };
}

function bodov(n: number): string {
  return n === 0 ? "0 b" : `${n > 0 ? "+" : "−"}${Math.abs(n)} b`;
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
  const pitka = `${x.vPitke ? "po Pitke" : "v Pitke"}: ${x.kliatby > 0 ? `${x.meno} ×${x.kliatby}${x.bitka === undefined ? ` · ${bodov(x.kliatby * x.cena)}` : ""}` : "nič"}`;
  const dalsie = x.dalsiePitky > 0 && x.opakovane > 0 ? `a v ${x.dalsiePitky === 1 ? "ďalšej Pitke" : `ďalších ${x.dalsiePitky} Pitkách`} znova ×${x.opakovane}` : null;
  const poBitke =
    x.bitka === undefined || vsetky === 0
      ? null
      : `${x.bitka.pali > 0 ? `bitka spáli až ${x.bitka.pali} → ostane ×${x.bitka.ostane}` : `po bitke ostanú ×${x.bitka.ostane}`} · ${bodov(x.bitka.ostane * x.cena)}`;
  const kratke = [{ text: pitka, zly: x.kliatby > 0 }];
  // Druhý riadok: Dlh — čo ostane po bitke (zahŕňa aj ďalšie Pitky); Cirhóza — ďalšie Pitky.
  if (x.bitka !== undefined && poBitke !== null) kratke.push({ text: `po bitke ×${x.bitka.ostane} · ${bodov(x.bitka.ostane * x.cena)}`, zly: x.bitka.ostane > 0 });
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

/** Celý výhľad Pitky v nápovede dlaždice — dlaždica ukáže len skrátené riadky. */
function TipVyhladu({ x }: { readonly x: VstupVyhladu | null }) {
  if (x === null) return null;
  return <span className="tip-stav">{vyhladPitky(x).cele.join(" · ")}.</span>;
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
        V ruke {hrac.rukaPocet}, v doberacom balíčku {hrac.doberaciPocet}, odhodených {hrac.odhadzovaci.length}; priznaných kliatob {hrac.priznane.length}, Nástrojov v Dedičstve {hrac.dedicstvo.length}.
        <span className="tip-stav">
          {ja ? "Klik (alebo O) ukáže balíček, odhodené, priznané a Dedičstvo. Kliatbu či Nástroj pustíš sem." : "Klik ukáže súperove priznané kliatby a Dedičstvo."}
        </span>
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
  readonly prahy: { readonly cirhoza: number; readonly dlh: number; readonly exekutor: number; readonly priznaneDlhy: number };
  /** Absťáky, neresti kola a výhľad na koniec kola (stavZavislosti). */
  readonly zavislost: StavZavislosti;
  readonly menoKarty: (defId: string) => string;
  readonly popisKarty: (defId: string) => string;
  /** Výhľad Pitky (Zhromaždenie a Pitka) — inak null. */
  readonly vyhlad: VyhladPitky | null;
  /** Body jedného Dlhu na konci hry pri dnešných scorecardoch (záporné) — pri priznaných Dlhoch. */
  readonly cenaDlhu: number;
  /** Doliatie a nový poldeci za cigarety — len na tvojej doske (Michal 2026-10-18: nedali sa nájsť). */
  readonly obchodCigariet?:
    | { readonly mozno: boolean; readonly doliat: () => void; readonly novy: () => void; readonly cenaBarteru: number }
    | undefined;
  /** Body „keby hra skončila teraz“ — dlaždica Body (Michal 2026-10-22, scoreboard zanikol). */
  readonly body: BodyTeraz;
  /** Mená oboch hráčov podľa miesta. */
  readonly mena: readonly [string, string];
  /**
   * Klik na Body prepne stôl na líniu starších (Michal 2026-10-23, #68) — bar sa
   * neprepína. `stlacene`: línia práve ukazuje čísla tohto hráča.
   */
  readonly starsi: { readonly stlacene: boolean; readonly prepni: () => void; readonly id: string };
  /** Dlaždica KARTY: klik otvorí vrstvu Karty, pri ťahaní kliatby či Nástroja je cieľom (#76). */
  readonly karty: KartyDlazdica;
  /**
   * Bodový bar (Michal 2026-10-23): kým stôl ukazuje líniu starších po kliku na Body,
   * šesť zdrojov nahradia dlaždice podmienok (zdroje skryje hra.css .doska.bodovy).
   */
  readonly bodovy?: Omit<BodovyBarProps, "p" | "body" | "mena"> | undefined;
}

/** „o 12 pred Tetou“ / „o 3 za Tetou“ / „rovnako“ — dlaždica Body. */
function porovnanieBodov(moje: number, jeho: number, menoJeho: string): string {
  if (moje === jeho) return `rovnako ako ${menoJeho}`;
  return `o ${Math.abs(moje - jeho)} ${moje > jeho ? "pred" : "za"} · ${menoJeho} ${znamienkoBodov(jeho)}`;
}

/**
 * Bar hráča (Michal 2026-10-22, dizajn stol-oproti-b2-20261022-1030): súperi
 * sedia oproti sebe — súperov bar je nad staršími, tvoj pod stolom, oba
 * v jednom rade a zrkadlovo (tvoj: portrét · Dlhy … Poldeci · Body · Karty,
 * súperov presne obrátene; poradie dáva mriežka v hra.css). Klik na Body
 * ukáže na stole líniu starších s rozpisom bodov po starších. Bez bubliniek so stavom — kto je na ťahu, ukazuje
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
  karty,
  bodovy,
}: HracDoskaProps) {
  const hrac = view.hraci[p];
  const ja = p === view.ja;
  const meno = info?.meno ?? `Hráč ${p + 1}`;
  // Stavbu šenku hrajú obaja naraz — „na ťahu“ je každý, kto ešte nevybral.
  const naTahu =
    view.koniec === null && (view.faza === "draft" && view.draftStav?.krok === "stavba" ? !view.draftStav.vybral[p] : view.naTahu === p);
  // NA EX naraz (v5): skryté NA EX vidí len jeho majiteľ (viewFor) — poldeci sa odpíše až pri odkrytí,
  // no hráč ho už dal, preto ho tu ukážeme ako ležiaci na stole. Zrážka = druhý poldeci na karte (naexBy2).
  const skryteNaex = (view.pitkaStav?.skryteNaex ?? []).filter((x) => x.hrac === p).length;
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
  const priznaneDlhy = hrac.priznane.filter((k) => k.defId === "dlh").length;

  const poldeci: ReactNode[] = [];
  for (let i = 0; i < plne; i++) poldeci.push(<IkonaPoldeci key={`p${i}`} plny />);
  for (let i = 0; i < hrac.poldeciVypite; i++) poldeci.push(<IkonaPoldeci key={`v${i}`} plny={false} />);

  return (
    <section
      className={`doska ${ja ? "moja" : "superova"} ${naTahu ? "na-tahu" : ""}${bodovy !== undefined ? " bodovy" : ""}`}
      aria-label={`Hráč ${meno}`}
      data-vyucba={ja ? "bar" : "bar-supera"}
    >
      <div className="doska-hrac">
        <KartaHraca info={info} meno={meno} ja={ja}>
          <Avatar meno={meno} avatar={info?.avatar ?? null} velkost={60} />
        </KartaHraca>
        <div>
          <strong className="doska-meno">
            {meno} {ja && <span className="tlmene">(ty)</span>}
          </strong>
          <Rola
            utoci={utoci}
            tip={
              utoci
                ? { nadpis: "Útočník", text: "Prehral poslednú bitku: zo šenku berie prvý a vykladá prvý. V Pitke hrá druhý — má posledné slovo." }
                : { nadpis: "Obranca", text: "Vyhral poslednú bitku: vyberá a natáča cieľ kola, v Pitke začína. Pri remíze nevyhrá nikto — lokalita ide na sekeru." }
            }
            frajerina={info?.frajerina}
          />
          {/* Nepriznané kliatby pod menom; priznané a Dedičstvo sú v dlaždici KARTY (Michal 2026-10-23, #76). */}
          {kliatby.dlh + kliatby.cirhoza > 0 && (
            <span className="doska-oblast">
              <span
                className="cip kliatba"
                title={
                  ja
                    ? "Tvoje nepriznané kliatby v ruke a v balíčkoch — na konci hry uberajú body."
                    : "Súperove nepriznané kliatby — počet sa ráta z toho, čo sa ukázalo na stole (vznik, priznanie, zahodenie). Ktoré karty a kde ležia, nevidíš. Už sú odpočítané v jeho bodoch."
                }
              >
                nepriznané{kliatby.cirhoza > 0 && ` · Cirhóza ×${kliatby.cirhoza}`}
                {kliatby.dlh > 0 && ` · Dlh ×${kliatby.dlh}`}
              </span>
            </span>
          )}
        </div>
      </div>

      {/* display: contents — dlaždice sú priamo v mriežke baru (poradie v hra.css). */}
      <div className="doska-zdroje">
        {bodovy !== undefined && <BodovyBar p={p} body={body} mena={mena} {...bodovy} />}
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
              <b>limit {limit}</b>
            </>
          }
          tip={{
            nadpis: "Poldeci",
            text: (
              <>
                {kto} {plne} plné a {hrac.poldeciVypite} vypité
                {naexNaStole > 0 ? `, ${naexNaStole} leží na stole cez NA EX${skryteNaex > 0 ? ` (${skryteNaex} skryto — súper ho uvidí pri odkrytí)` : ""}` : ""}.
                <span className="tip-stav">
                  {jeCielLokalita(view, "zastavka")
                    ? `Limit vykladania: Zastávka — spoločný pre oboch, ${limit} (súčet limitov oboch hráčov)`
                    : `Limit vykladania = plné + 1 = ${limit} (poldeci na stole cez NA EX sa neráta)`}
                </span>
                <span className="tip-riadok">
                  V ďalšom kole limit {buduci}: poldeci z NA EX sa pri bitke vypijú a na začiatku kola sa{" "}
                  {KONSTANTY.POLDECI_NA_ZACIATKU_KOLA} vypitý doleje sám (bez akcie Poldeci a doliatia cigaretami).
                </span>
                <span className="tip-riadok">
                  V Pitke položíš plný poldeci na Občana alebo Starešinu (NA EX!) — skryto, súper ho uvidí, keď obaja skončíte Pitku. Zdvojnásobí
                  neaktívne akcie karty a zruší jej aktívne; limit vykladania ti tým klesne o 1. V Zhromaždení ťa plný poldeci stojí každá ďalšia
                  karta v tom istom ťahu. Vypitý doleješ za {KONSTANTY.REFILL_CENA} cigarety (nie s Vínkom v Dedičstve), nový získaš barterom
                  ({KONSTANTY.BARTER_CENA} cigariet). Na konci hry vyhráva súboj Rezerva, kto má viac plných poldeci (Vínko sa ráta ako plný).
                </span>
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
                  doliať −{KONSTANTY.REFILL_CENA}
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
                  nový poldeci −{obchodCigariet.cenaBarteru}
                </button>
                </span>
              </>
            )
          }
          tip={{
            nadpis: "Cigarety",
            text: (
              <>
                {kto} {hrac.cigarety} {hrac.cigarety === 1 ? "cigaretu" : hrac.cigarety >= 2 && hrac.cigarety <= 4 ? "cigarety" : "cigariet"}.
                <span className="tip-riadok">
                  Získavaš ich z aktívnych akcií Cigareta v Pitke (mínus súperove Obmedzenia) a prenášajú sa z kola na kolo.
                  Platíš nimi šenok (1 karta = {KONSTANTY.CENA_SENKU[1]}, 2 karty = {KONSTANTY.CENA_SENKU[2]}) a Dedičstvo (cena rastie pre oboch).
                  Fajčiť smieš len v Pitke, na svojom ťahu: cigareta = karta hneď. V Pitke {KONSTANTY.REFILL_CENA} cigarety dolejú vypitý poldeci,{" "}
                  {KONSTANTY.BARTER_CENA} vymeníš za nový plný (stokársky barter). Na konci hry vyhráva súboj Cigarety pri staršom, kto ich má viac.
                </span>
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
            nadpis: "Poškodenie pečene",
            text: (
              <>
                <TipVyhladu x={vyhladPecene} />
                {hrac.pecen} z {prahy.cirhoza}
                {v !== null && v.pecenZoStola > 0 && `, karty na stole pripíšu ${v.pecenZoStola} → ${pecenPo}`}. Vyhodnocuje sa len v Pitke: za
                každý celý prah vzniká Cirhóza (ide navrch doberacieho balíčka; priznaná dá súperovi v bitke +1 tuhé poškodenie) a{" "}
                <b>po každej Pitke sa pečeň vynuluje</b>.
                {vyhlad !== null && (
                  <span className="tip-stav">
                    {vyhlad.cenaCirhozy === 0
                      ? "Ďalšia nepriznaná Cirhóza by teraz body nezmenila"
                      : `Ďalšia nepriznaná Cirhóza by ťa teraz stála ${bodov(vyhlad.cenaCirhozy)}`}{" "}
                    (súboje o Cirhózu pri starších). Nepriznaná ide po bitke do odhadzovacieho balíčka.
                  </span>
                )}
                <span className="tip-riadok">
                  Pribúda akciami Poškodenie pečene a Poldeci a NA EX v Pitke; poldeci vypitý v Zhromaždení ju pripíše dopredu do najbližšej Pitky.
                  NA EX leží na karte až do bitky — jej zdvojené akcie sa vyhodnotia v každej Pitke kola. Prah = {prahy.cirhoza}.
                </span>
              </>
            ),
          }}
        />
        <Zdroj
          nazov="Zadĺženie"
          trieda={`zdroj-zadlzenie ${(v?.dlhy ?? 0) > 0 ? "hrozi" : zadlzeniePo >= prahy.dlh - 1 ? "varovanie" : ""}`}
          hodnota={
            <span className="velke-cislo">
              {hrac.zadlzenie}
              {v !== null && v.zadlzenieZoStola > 0 && <span className="projekcia"> ▸ {zadlzeniePo}</span>}
              <small>/{prahy.dlh}</small>
            </span>
          }
          pod={
            <>
              <Pruh hodnota={hrac.zadlzenie} pribudne={v?.zadlzenieZoStola ?? 0} prah={prahy.dlh} />
              {vyhladZadlzenia !== null && <TextVyhladu x={vyhladZadlzenia} />}
            </>
          }
          tip={{
            nadpis: "Zadĺženie",
            text: (
              <>
                <TipVyhladu x={vyhladZadlzenia} />
                {hrac.zadlzenie} z {prahy.dlh}
                {v !== null && v.zadlzenieZoStola > 0 && `, karty na stole pripíšu ${v.zadlzenieZoStola} → ${zadlzeniePo}`}. Za každý celý prah
                vzniká karta Dlh — <b>hneď sa prizná</b> a na konci hry uberá body aj priznaný.
                <span className="tip-stav">
                  {cenaDlhu === 0 ? "Ďalší Dlh by teraz body nezmenil" : `Ďalší Dlh by ťa teraz stál ${bodov(cenaDlhu)}`} (súboje o Dlhy pri starších).
                </span>
                <span className="tip-riadok">Pribúda akciami Dlh v Pitke a <b>po každej Pitke sa vynuluje</b>.</span>
              </>
            ),
          }}
        />
        <Zdroj
          nazov="Dlhy"
          trieda={`zdroj-dlhy ${prahy.priznaneDlhy >= prahy.exekutor - 2 ? "varovanie" : ""}`}
          hodnota={
            <span className="velke-cislo">
              {prahy.priznaneDlhy}
              <small>/{prahy.exekutor}</small>
            </span>
          }
          pod="do Exekútora"
          tip={{
            nadpis: "Priznané Dlhy",
            text: (
              <>
                {prahy.priznaneDlhy} z {prahy.exekutor}. Keď ich má hráč v bitke aspoň {prahy.exekutor}, prichádza
                Exekútor: musí odovzdať Nástroj (polovica dlhov potom zhorí), inak prehráva. Kto je pod prahom, spáli v každej bitke 1 priznaný Dlh.
                <span className="tip-stav">
                  Na konci hry sa ráta aj priznaný Dlh — súboj Dlhy pri staršom vyhrá, kto ich má menej
                  {priznaneDlhy > 0 ? ` (máš ${priznaneDlhy} priznané)` : ""}.
                </span>
                <span className="tip-riadok">
                  Prah = {KONSTANTY.PRAH_EXEKUTORA_ZAKLAD}, súperova priazeň Exekútora ho znižuje. Priazeň Kmotra ti po bitke zníži priznané Dlhy.
                  Robota spáli 1 priznaný Dlh, Dievčina na vydaj ich spáli viac.
                </span>
              </>
            ),
          }}
        />
        <DlazdicaKariet hrac={hrac} ja={ja} karty={karty} />
        <button
          type="button"
          className={`zdroj zdroj-body ${body.spolu[p] > 0 ? "plus" : body.spolu[p] < 0 ? "minus" : ""}${starsi.stlacene ? " stlacene" : ""}`}
          aria-pressed={starsi.stlacene}
          aria-controls={starsi.id}
          data-vyucba-prvok="body"
          title={
            starsi.stlacene
              ? "Späť na stôl (Esc)"
              : "Body za starších, keby hra skončila teraz — klik ukáže pri každom staršom súboje podmienok a kto by za neho teraz dostal body"
          }
          onClick={starsi.prepni}
        >
          <span className="zdroj-nazov">Body {starsi.stlacene ? "▴" : "▾"}</span>
          <span className="zdroj-hodnota">
            <span className="velke-cislo">{znamienkoBodov(body.spolu[p])}</span>
          </span>
          <span className="zdroj-pod">{porovnanieBodov(body.spolu[p], body.spolu[p === 0 ? 1 : 0], mena[p === 0 ? 1 : 0])}</span>
        </button>
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
          rovnakom tuhom nevyhrá nikto: lokalita ide na sekeru.
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
  /** Lokality na sekere z predošlých remíz — víťaz tejto bitky ich berie tiež. */
  readonly naSekeru: readonly string[];
  /** Posledná bitka hry — pri remíze lokality prepadnú. */
  readonly poslednaBitka: boolean;
  /** Koľko stojí posun markera prebytkom, keby hráč bitku vyhral (Miňištrant); porazený platí 1. */
  readonly cenaPosunuVitaza: readonly [number, number];
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
}

export interface HrozbaBitky {
  readonly kto: "ja" | "su";
  /** Krátko do riadku bitky: „Súper ešte môže: tuhé 0 : 8“. */
  readonly kratko: string;
  /** Najkratšie, keď hrozbu majú obaja a idú do jedného riadku: „súper až 0 : 8“. */
  readonly mini: string;
  /** Celé znenie (titulok): aj karta a prebytok. */
  readonly cele: string;
  readonly uid: number;
}

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
      key={h.kto}
      className={`hrozba-bitky ${h.kto}`}
      title={h.cele}
      onMouseEnter={() => ukazHrozbu?.(h.uid)}
      onMouseLeave={() => ukazHrozbu?.(null)}
    >
      {text}
    </span>
  );
  if (!jedenRiadok) return <>{hrozby.map((h) => cast(h, h.kratko))}</>;
  return (
    <span className="hrozba-bitky-riadok" data-vyucba="hrozba" title={hrozby.map((h) => h.cele).join("\n")}>
      ešte môže: {hrozby.map((h, i) => (
        <span key={h.kto}>
          {i > 0 && " · "}
          {cast(h, h.mini)}
        </span>
      ))}
    </span>
  );
}

/** Verdikt a prebytok bitky — spoločné pre panel aj jeho jednoriadkový súhrn. */
function verdiktBitky({ damage, ja, vysledok, naSekeru, poslednaBitka, cenaPosunuVitaza, prebytokNaRozdelenie, rodJa = null }: BitkaPanelProps) {
  const su = (ja === 0 ? 1 : 0) as PlayerId;
  // Remíza (Michal 2026-10-21): pri rovnakom tuhom nevyhrá nikto — lokalita ide na sekeru (PRAVIDLA §9.4).
  const { vitaz, prebytok, prebytokDrzi } = battleOutcome(damage);
  const rozdiel = Math.abs(damage.tuhe[ja] - damage.tuhe[su]);
  const vyhravam = vitaz === ja;
  const vStavke = 1 + naSekeru.length;
  const coPriRemize = poslednaBitka
    ? `lokalita${naSekeru.length > 0 ? " aj sekera" : ""} prepadne (posledná bitka)`
    : `lokalita na sekeru → ďalšia bitka o ${vStavke + 1} lokality`;
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
  // Prebytok: posun stojí 1, víťaza s Miňištrantom viac — koľko posunov z neho reálne bude.
  const cenaPosunu = prebytokDrzi === null ? 1 : prebytokDrzi === vitaz ? cenaPosunuVitaza[prebytokDrzi] : 1;
  const posunov = Math.floor(prebytokNaRozdelenie / Math.max(1, cenaPosunu));
  // V bare je na verdikt jeden krátky riadok — čo prinesie remíza, povie nápoveda.
  const kratko = rozdiel === 0 ? "Remíza" : verdikt;
  return { su, vitaz, prebytok, prebytokDrzi, rozdiel, vyhravam, vStavke, coPriRemize, verdikt, kratko, cenaPosunu, posunov };
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
  const { su, prebytok, prebytokDrzi, rozdiel, vStavke, coPriRemize, verdikt, cenaPosunu, posunov } = verdiktBitky(props);
  const posunyText = posunov === 1 ? "posun" : posunov >= 2 && posunov <= 4 ? "posuny" : "posunov";
  return {
    nadpis: `${vysledok ? "Výsledok bitky" : "Odhad bitky"}${ciel === "" ? "" : ` · ${ciel}`}`,
    text: (
      <>
        <b>{verdikt}</b> · tuhé {damage.tuhe[ja]} : {damage.tuhe[su]}
        <span className="tip-riadok">
          {prebytokDrzi === null
            ? "prebytok: nikto"
            : `prebytok ${prebytok}${prebytokNaRozdelenie < prebytok ? ` − Puška = ${prebytokNaRozdelenie}` : ""} → ${prebytokDrzi === ja ? "tebe" : mena[su]} · ${posunov} ${posunyText} (posun stojí ${cenaPosunu}${cenaPosunu > 1 ? ", Miňištrant" : ""})`}
        </span>
        {(props.hrozby ?? []).map((h) => (
          <span key={h.kto} className="tip-riadok">
            {h.cele}
          </span>
        ))}
        {naSekeru.length > 0 && (
          <span className="tip-riadok">
            ide o {vStavke + (vStavke === 1 ? " lokalitu" : vStavke <= 4 ? " lokality" : " lokalít")} · na sekere {naSekeru.join(", ")}
          </span>
        )}
        {!vysledok && rozdiel !== 0 && <span className="tip-riadok">pri remíze: {coPriRemize}</span>}
        {!vysledok && stavka !== null && (
          <span className="tip-riadok">
            táto bitka: výhra o {stavka.prebytok} ≈ <b>{znamienkoBodov(stavka.vyhra)} b</b>, prehra o {stavka.prebytok} ≈{" "}
            <b>{znamienkoBodov(stavka.prehra)} b</b>
            {stavka.superNajviac !== null && <> · posledná bitka — súper najviac ≈ {znamienkoBodov(stavka.superNajviac)} b</>}
          </span>
        )}
        {utocnik !== undefined && <span className="tip-riadok">{utocnik}</span>}
        <span className="tip-stav">
          {vysledok ? "" : "Podľa aktuálnej línie; súperove Absťáky v ruke nevidno. "}Klik ukáže na stranách baru {prepnutNa}.
        </span>
      </>
    ),
  };
}

export function BitkaPanel(props: BitkaPanelProps) {
  const { damage, sums, zdroje, rozpis, ja, vysledok, mena, sada, ciel, menoKarty, naSekeru, prebytokNaRozdelenie, utocnik } = props;
  const { su, vitaz, prebytok, prebytokDrzi, rozdiel, vyhravam, vStavke, coPriRemize, verdikt, cenaPosunu, posunov } = verdiktBitky(props);

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
          <span className="bitka-sekera" title="Lokality z predošlých remíz — víťaz tejto bitky ich berie spolu s jej lokalitou.">
            ide o {vStavke + (vStavke === 1 ? " lokalitu" : vStavke <= 4 ? " lokality" : " lokalít")} · na sekere {naSekeru.join(", ")}
          </span>
        )}
        <span className="bitka-verdikt">{verdikt}</span>
        <RiadkyHrozby hrozby={props.hrozby} ukazHrozbu={props.ukazHrozbu} />
        <span className="bitka-pozn">
          {prebytokDrzi === null
            ? "prebytok: nikto"
            : `prebytok ${prebytok}${prebytokNaRozdelenie < prebytok ? ` − Puška = ${prebytokNaRozdelenie}` : ""} → ${prebytokDrzi === ja ? "tebe" : mena[su]} · ${posunov} ${posunov === 1 ? "posun" : posunov >= 2 && posunov <= 4 ? "posuny" : "posunov"} (posun stojí ${cenaPosunu}${cenaPosunu > 1 ? ", Miňištrant" : ""})`}
        </span>
        {!vysledok && rozdiel !== 0 && <span className="bitka-pozn tlmene">pri remíze: {coPriRemize}</span>}
        {!vysledok && <span className="bitka-pozn tlmene">podľa aktuálnej línie; súperove Absťáky v ruke nevidno</span>}
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
}

function KrokOsi({
  krok,
  trieda,
  refEl,
  onKlik,
}: {
  readonly krok: KrokKola;
  readonly trieda: string;
  readonly refEl?: RefObject<HTMLLIElement | null>;
  readonly onKlik?: (() => void) | undefined;
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
      {krok.nazov}
      {okno}
    </li>
  );
}

export function PriebehKola({ view, onBitka }: { readonly view: ClientState; readonly onBitka?: (() => void) | undefined }) {
  const pitiek = Math.max(1, view.pitkyCelkom);
  const viac = pitiek > 1;
  const pocetPozn =
    "Pitiek je 1 + menší z počtov aktivovaných akcií karty v strede na jej dvoch stranách — počet sa mení, keď hráči vykladajú karty k lokalite.";
  const kroky: KrokKola[] = [
    {
      id: "volbaCiela",
      nazov: "Voľba cieľa",
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
              Na scorecard dá lícom dole Občana či Zviera z ruky, marker ide do stredu. Platí cigarety do červenej, súper dostane
              v bitke Pohoršenia (o koľko marker išiel do stredu). Výhra = starší je jeho; prehra = odhodí poldeci.
            </span>
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
        tip: {
          nadpis: `Zhromaždenie${viac ? ` ${i} z ${pitiek}` : ""}`,
          text: (
            <>
              Striedavo vykladáte karty z ruky na hociktorú stranu línie, začína útočník. Limit vykladania = plné poldeci + poldeci na
              stole + 1; každá ďalšia karta v tom istom ťahu stojí plný poldeci.
              <span className="tip-riadok">
                Kedykoľvek na ťahu: priznať kliatbu (za Cirhózu sa nedoberá; Dlh sa prizná sám pri dobratí), Nástroj do Dedičstva (za cigarety, cena rastie), fajčiť
                (cigareta = karta). Kto pasuje, do Pitky už nevykladá a dostane cigaretu za každú kartu, ktorú ešte smel
                vyložiť. Končí, keď obaja vyčerpajú limit alebo pasujú.
              </span>
              {viac && <span className="tip-stav">{pocetPozn}</span>}
            </>
          ),
        },
      },
      {
        id: `pitka-${i}`,
        nazov: `Pitka${cislo}`,
        tip: {
          nadpis: `Pitka${viac ? ` ${i} z ${pitiek}` : ""}`,
          text: (
            <>
              <b>Začína obranca</b>; keď dá „hotovo“, hrá útočník a má posledné slovo („hotovo“ sa nedá vrátiť). NA EX! — plný poldeci na
              Občana či Starešinu v línii: zruší jeho aktívne akcie a zdvojí neaktívne (násobky sa násobia: NA EX × Silná žena = ×4); súper
              smie hneď odpovedať jednou kartou. Fajčiť, doliať poldeci ({KONSTANTY.REFILL_CENA} cig.), nový poldeci (barter).
              <span className="tip-riadok">
                Potom sa pripíšu akcie: Dlh (zadĺženie — za každý celý prah Dlh, hneď priznaný), Poškodenie pečene a Poldeci (za každý celý
                prah Cirhóza navrch balíčka), Obmedzenie, Cigarety a Vízia. Pečeň aj zadĺženie sa po Pitke vynulujú.
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
      nadpis: "Bitka o lokalitu",
      text: (
        <>
          Rozhoduje tuhé poškodenie (Rana 1, Pecka 2, Petelica 3; mínus súperova Viera a vlastné Absťáky). Pri rovnakom tuhom nevyhrá
          nikto: lokalita ide na sekeru a vezme si ju víťaz najbližšej bitky (prepadne len pri remíze v poslednej bitke). Víťaz ovládne lokalitu (aj
          tie zo sekery a staršieho, ak ho má v patronáte); kto má vyššie celkové, rozdelí prebytok — posúva markery starších.
          <span className="tip-riadok">
            Potom Exekútor, Pohoršenie, Pohreb… a každý si dobere {KONSTANTY.KARTY_PO_BITKE} karty. Porazený je v ďalšom kole
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
  const odohrane = view.ovladnute.length + view.prepadnute.length + view.naSekeru.length;
  const polozky: ReactNode[] = [];
  for (let i = 0; i < kroky.length; i++) {
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
        onKlik={k.id === "bitka" ? onBitka : undefined}
      />,
    );
  }
  return (
    <ol className="priebeh-kola" aria-label={`Kolo ${view.kolo}`} data-vyucba="os-kola">
      <li
        className="priebeh-kolo"
        title={`Hrá sa o ${pocet(view.lokalitCelkom, "lokalitu", "lokality", "lokalít")}; ${view.lokalityVHre.length >= 2 && view.lokalityVHre.length <= 4 ? "zostávajú" : "zostáva"} ${pocet(view.lokalityVHre.length, "nevybraná", "nevybrané", "nevybraných")}${view.naSekeru.length > 0 ? `, na sekere ${view.naSekeru.length}` : ""}.`}
      >
        Kolo {view.kolo} · lokalita {Math.min(view.lokalitCelkom, odohrane + 1)}/{view.lokalitCelkom}
        {view.naSekeru.length > 0 && <span className="priebeh-sekera"> · na sekere {view.naSekeru.length}</span>}
      </li>
      {polozky}
    </ol>
  );
}
