// Partia v hlavičke webu (Michal 2026-10-26, #22 A a #23): zápasový štítok (kód, krok,
// špaky a súper) a menu „Partia ▾“ s kopírovaním kódu, hláškami Melichara, odchodom
// od stola, kontumáciou a vzdaním sa. Menu webu je počas partie preč — hráč hrá.
// Nebezpečné akcie sú v menu, vzdanie sa s potvrdením priamo v ňom.

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import type { ClientState, PlayerId } from "@naex/core";
import { chod } from "../lib/router.tsx";
import { IkonaSpaku } from "./IkonaSpaku.tsx";
import { MIMO_PULTU, prepniPultMelichara } from "./Soundboard.tsx";
import {
  ID_TLACIDLA_PARTIE,
  ZMENA_SVIETI_MS,
  krokPartie,
  minSek,
  stavKontumacie,
  textZmeny,
  zmenySpakov,
  type ZmenaSpakov,
} from "./stitokPartie.ts";
import "./hlavicka.css";

/**
 * Špaky v štítku: kým beží počítadlo bitky, ostanú staré (nech hlavička neprezradí
 * výsledok skôr než stôl); potom krátko svieti posledná zmena („+2“).
 */
function useSpakyVStitku(spaky: readonly [number, number], pozdrz: boolean): {
  readonly zobrazene: readonly [number, number];
  readonly zmena: { readonly zmeny: readonly ZmenaSpakov[]; readonly id: number } | null;
} {
  const [zobrazene, setZobrazene] = useState<readonly [number, number]>(spaky);
  const [zmena, setZmena] = useState<{ readonly zmeny: readonly ZmenaSpakov[]; readonly id: number } | null>(null);
  const [a, b] = spaky;
  useEffect(() => {
    if (pozdrz || (zobrazene[0] === a && zobrazene[1] === b)) return;
    const zmeny = zmenySpakov(zobrazene, [a, b]);
    setZobrazene([a, b]);
    setZmena((z) => ({ zmeny, id: (z?.id ?? 0) + 1 }));
  }, [a, b, pozdrz, zobrazene]);
  useEffect(() => {
    if (zmena === null) return;
    const t = setTimeout(() => setZmena(null), ZMENA_SVIETI_MS);
    return () => clearTimeout(t);
  }, [zmena]);
  return { zobrazene, zmena };
}

/** Hodiny pre odpočet kontumácie — bežia len počas čakania. */
function useTeraz(bezi: boolean): number {
  const [teraz, setTeraz] = useState(() => Date.now());
  useEffect(() => {
    setTeraz(Date.now());
    if (!bezi) return;
    const t = setInterval(() => setTeraz(Date.now()), 1000);
    return () => clearInterval(t);
  }, [bezi]);
  return teraz;
}

const slovoSpakov = (n: number): string => (n === 1 ? "špak" : n >= 2 && n <= 4 ? "špaky" : "špakov");

export interface HlavickaPartieProps {
  readonly kod: string;
  readonly view: ClientState;
  readonly menoSupera: string;
  /** Súper je počítač — nikdy sa neodpojí, kód nikomu neposielaš. */
  readonly superBot: boolean;
  readonly superPripojeny: boolean;
  readonly superOdpojenyOd: number | null;
  /** Výučba: bez kódu, kontumácie a vzdania sa (výučbu preruší jej vlastné tlačidlo). */
  readonly vyucba: boolean;
  /** Beží počítadlo bitky — štítok ešte neukáže nové špaky. */
  readonly pocitadloBezi: boolean;
  /** Soundboard Melichara (s právom) — v štítku ukáže len stav, pult otvorí menu. */
  readonly melichar?: ReactNode | undefined;
  readonly vzdat: () => void;
  readonly kontumacia?: (() => void) | undefined;
  /** Po konci partie: opustiť miestnosť. */
  readonly opustit: () => void;
}

export function HlavickaPartie({
  kod,
  view,
  menoSupera,
  superBot,
  superPripojeny,
  superOdpojenyOd,
  vyucba,
  pocitadloBezi,
  melichar,
  vzdat,
  kontumacia,
  opustit,
}: HlavickaPartieProps) {
  const ja = view.ja;
  const su: PlayerId = ja === 0 ? 1 : 0;
  const krok = krokPartie(view);
  const { zobrazene, zmena } = useSpakyVStitku([view.spaky[ja], view.spaky[su]], pocitadloBezi);
  const bezi = view.koniec === null;
  const ponukaKontumaciu = bezi && !superBot && !vyucba && kontumacia !== undefined;
  const pripojeny = superBot || superPripojeny;
  const [otvorene, setOtvorene] = useState(false);
  const teraz = useTeraz(ponukaKontumaciu && !pripojeny);
  const kontum = stavKontumacie(pripojeny, superOdpojenyOd, teraz);
  const [potvrd, setPotvrd] = useState(false);
  const [skopirovane, setSkopirovane] = useState(false);
  const obal = useRef<HTMLDivElement>(null);
  const tlacidlo = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  const zavri = (fokus: boolean): void => {
    setOtvorene(false);
    setPotvrd(false);
    if (fokus) tlacidlo.current?.focus();
  };

  useEffect(() => {
    if (!otvorene) return;
    menu.current?.querySelector<HTMLElement>("button:not(:disabled)")?.focus();
    const mimo = (e: PointerEvent): void => {
      if (e.target instanceof Node && obal.current?.contains(e.target) === true) return;
      setOtvorene(false);
      setPotvrd(false);
    };
    // Esc zavrie menu skôr, než ho dostanú skratky stola.
    const klaves = (e: KeyboardEvent): void => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      e.preventDefault();
      setOtvorene(false);
      setPotvrd(false);
      tlacidlo.current?.focus();
    };
    document.addEventListener("pointerdown", mimo);
    window.addEventListener("keydown", klaves, true);
    return () => {
      document.removeEventListener("pointerdown", mimo);
      window.removeEventListener("keydown", klaves, true);
    };
  }, [otvorene]);

  useEffect(() => {
    if (!skopirovane) return;
    const t = setTimeout(() => setSkopirovane(false), 2000);
    return () => clearTimeout(t);
  }, [skopirovane]);

  // Šípky hore/dole medzi položkami menu.
  const sipky = (e: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const polozky = [...(menu.current?.querySelectorAll<HTMLElement>("button:not(:disabled)") ?? [])];
    const i = polozky.findIndex((p) => p === document.activeElement);
    const dalsi = polozky[(i + (e.key === "ArrowDown" ? 1 : polozky.length - 1)) % polozky.length];
    e.preventDefault();
    dalsi?.focus();
  };

  const popisZmeny =
    zmena === null
      ? ""
      : zmena.zmeny.map((z) => `${z.kto === 0 ? "Ty" : menoSupera}: ${textZmeny(z.n)} ${slovoSpakov(Math.abs(z.n))}`).join(", ");
  const zmenaPre = (kto: 0 | 1): ZmenaSpakov | undefined => zmena?.zmeny.find((z) => z.kto === kto);
  const cislo = (kto: 0 | 1) => {
    const z = zmenaPre(kto);
    const n = zobrazene[kto];
    return (
      <b key={z === undefined ? `n${kto}` : `z${kto}-${zmena?.id}`} className={`stitok-n${z === undefined ? "" : z.n > 0 ? " blik" : " blik minus"}`}>
        {n < 0 ? `−${-n}` : n}
      </b>
    );
  };
  const znacka = (kto: 0 | 1) => {
    const z = zmenaPre(kto);
    return z === undefined ? null : (
      <span key={`zm${kto}-${zmena?.id}`} className={`stitok-zmena${z.n < 0 ? " minus" : ""}`} aria-hidden="true">
        {textZmeny(z.n)}
      </span>
    );
  };

  return (
    <div className="partia-hlavicka" ref={obal} {...{ [MIMO_PULTU]: "" }}>
      <div className="partia-stitok" role="group" aria-label={`Partia ${kod}`}>
        {!vyucba && !superBot && (
          <>
            <span className="stitok-kod" title="Kód miestnosti — pošli ho súperovi, alebo sa ním vrátiš">
              {kod}
            </span>
            <span className="stitok-delic stitok-kod-delic" aria-hidden="true" />
          </>
        )}
        <span className={`stitok-krok${krok.finale ? " finale" : ""}`}>
          <span className="stitok-dlhe">{krok.text}</span>
          <span className="stitok-kratke">{krok.kratko}</span>
        </span>
        <span className="stitok-delic" aria-hidden="true" />
        <span className="stitok-skore" role="img" aria-label={`Špaky: ty ${zobrazene[0]}, ${menoSupera} ${zobrazene[1]}`} title={`Špaky — ty ${zobrazene[0]} : ${zobrazene[1]} ${menoSupera}`}>
          <IkonaSpaku trieda="stitok-pop ja" />
          {cislo(0)}
          {znacka(0)}
          <span className="stitok-dvojbodka" aria-hidden="true">
            :
          </span>
          {znacka(1)}
          {cislo(1)}
          <IkonaSpaku trieda="stitok-pop su" />
        </span>
        <span className="stitok-delic" aria-hidden="true" />
        <span className={`stitok-super ${pripojeny ? "online" : "offline"}`} title={`${menoSupera} ${pripojeny ? "je pri stole" : "je odpojený"}`}>
          <span aria-hidden="true">{pripojeny ? "●" : "○"}</span>
          <span className="stitok-super-meno">{menoSupera}</span>
          {!pripojeny && <span className="stitok-super-stav">odpojený</span>}
        </span>
        <span className="hp-citacka" aria-live="polite">
          {popisZmeny}
        </span>
      </div>
      {melichar}
      <div className="partia-menu-obal">
        <button
          type="button"
          ref={tlacidlo}
          id={ID_TLACIDLA_PARTIE}
          className="partia-menu-tlacidlo"
          aria-haspopup="menu"
          aria-expanded={otvorene}
          onClick={() => (otvorene ? zavri(false) : setOtvorene(true))}
        >
          Partia <span className="sipka" aria-hidden="true">▾</span>
          {ponukaKontumaciu && kontum.druh === "mozna" && <span className="bodka-pozor" title="Môžeš si vyžiadať kontumačnú výhru" />}
          {ponukaKontumaciu && kontum.druh === "mozna" && <span className="hp-citacka">(kontumačná výhra je k dispozícii)</span>}
        </button>
        {otvorene && (
          <div className="partia-menu" role="menu" aria-label={`Partia ${kod}`} ref={menu} onKeyDown={sipky}>
            <div className="partia-menu-hlava">
              <strong>{vyucba ? "Prvá hra s Melicharom" : `Partia ${kod}`}</strong>
              <span>
                s {menoSupera} · {krok.text} · špaky {zobrazene[0]} : {zobrazene[1]}
              </span>
            </div>
            {!vyucba && !superBot && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  void navigator.clipboard
                    ?.writeText(kod)
                    .then(() => setSkopirovane(true))
                    .catch(() => undefined);
                }}
              >
                {skopirovane ? "Kód skopírovaný — pošli ho súperovi" : "Kopírovať kód miestnosti"} <kbd>{kod}</kbd>
              </button>
            )}
            {melichar !== undefined && melichar !== null && melichar !== false && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  zavri(false);
                  prepniPultMelichara();
                }}
              >
                Hlášky Melichara <kbd>M</kbd>
              </button>
            )}
            <hr />
            {bezi ? (
              <button type="button" role="menuitem" className="dvoj" onClick={() => chod("/")}>
                <b>Odísť od stola</b>
                <small>{vyucba ? "Výučba počká" : "Partia beží ďalej"} — vrátiš sa cez „Späť ku stolu“ v hlavičke.</small>
              </button>
            ) : (
              <button type="button" role="menuitem" className="dvoj" onClick={opustit}>
                <b>Opustiť hru</b>
                <small>Partia je dohraná — stôl sa zavrie.</small>
              </button>
            )}
            {ponukaKontumaciu && (
              <button
                type="button"
                role="menuitem"
                className={`dvoj kontum${kontum.druh === "mozna" ? " zvyraznena" : ""}`}
                disabled={kontum.druh !== "mozna"}
                onClick={() => {
                  zavri(false);
                  kontumacia?.();
                }}
              >
                <b>Kontumačná výhra{kontum.druh === "caka" ? ` · o ${minSek(kontum.zostavaMs)}` : ""}</b>
                <small>
                  {kontum.druh === "pripojeny"
                    ? "Len keď je súper odpojený aspoň 3 minúty."
                    : kontum.druh === "caka"
                      ? `${menoSupera} je odpojený. Sprístupní sa po 3 minútach.`
                      : `${menoSupera} je odpojený 3 minúty — môžeš si ju vyžiadať.`}
                </small>
              </button>
            )}
            {bezi && !vyucba && (
              <>
                <hr />
                {potvrd ? (
                  <div className="partia-potvrd" role="alert">
                    <p>
                      <b>Vzdať sa?</b> Partia sa skončí tvojou prehrou.
                    </p>
                    <div>
                      <button type="button" className="tlacidlo-male" autoFocus onClick={() => setPotvrd(false)}>
                        Hrať ďalej
                      </button>
                      <button
                        type="button"
                        className="tlacidlo-male tlacidlo-nebezpecne"
                        onClick={() => {
                          zavri(false);
                          vzdat();
                        }}
                      >
                        Vzdať sa
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" role="menuitem" className="nebezpecne" onClick={() => setPotvrd(true)}>
                    Vzdať sa…
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
