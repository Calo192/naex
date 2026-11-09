// Podložené Nástroje pod kartou v línii (Náradie, Michal 2026-11-08, docs/napady/naradie-mock-stol-2.html,
// rozloženie M2): Nástroj leží pod hostiteľom ako karta, hostiteľ je na ňom posunutý po dlhšej strane
// a spod neho vidno len pretŕčajúcu hranu vo farbe Nástroja (Michal 2026-11-09), rám hovorí, čí je. Pod kartou natočenou
// ku mne trčí dole, pod súperovou hore (podľa karty, nie podľa majiteľa Nástroja). Zámočník: ďalšie
// Nástroje po jednej hrane ďalej.

import type { CSSProperties, ReactNode } from "react";
import type { HranaNastroja, PlayerId, PodlozenyNastroj } from "@naex/core";
import type { Vzhlad } from "@naex/tvorba";
import { ObsahHrany, PODIEL_HRANY, popisHranyNastroja } from "../karta/KartaLico.tsx";
import { useTip } from "../karta/Tip.tsx";

/** Výška pretŕčajúcej hrany v px pri karte širokej `sirka` (mock M2: 36 px pri karte vysokej 190 px). */
export function vyskaHranyPod(sirka: number): number {
  return Math.round(Math.min(36, Math.max(18, ((sirka * 80) / 54) * PODIEL_HRANY)));
}

/** Kam hrana trčí: pod kartou natočenou ku mne dole, pod súperovou hore. */
export function smerPretrcania(playedBy: PlayerId, ja: PlayerId): "dole" | "hore" {
  return playedBy === ja ? "dole" : "hore";
}

export interface NastrojPodKartou {
  readonly n: PodlozenyNastroj;
  readonly hrana: HranaNastroja | null;
  readonly nazov: string;
  /** Farba stredného pruhu karty Nástroja — hrana má tú istú (Michal 2026-11-09). */
  readonly farba: string;
  /** Zasunutý v návrhu ťahu — dá sa otočiť, ešte nie je zaplatený. */
  readonly navrh?: boolean;
}

export function PodlozeneNastroje({
  nastroje,
  smer,
  vyska,
  ja,
  vzhlad,
  menoHraca,
  obsah,
  lupa,
  otoc,
}: {
  readonly nastroje: readonly NastrojPodKartou[];
  readonly smer: "dole" | "hore";
  readonly vyska: number;
  readonly ja: PlayerId;
  readonly vzhlad: Pick<Vzhlad, "akcie">;
  readonly menoHraca: (p: PlayerId) => string;
  /** Hostiteľ (karta v línii). */
  readonly obsah: ReactNode;
  /** Klik na hranu: lupa s celou kartou Nástroja. */
  readonly lupa: (n: PodlozenyNastroj, el: HTMLElement) => void;
  /** Otočenie zasunutého Nástroja v návrhu; null = druhá hrana pod túto kartu nejde. */
  readonly otoc: (() => void) | null;
}) {
  const { tip, ukaz, skry } = useTip();
  const spolu = nastroje.length * vyska;
  return (
    <div className={`s-nastrojmi s-nastrojmi-${smer}`} style={{ [smer === "dole" ? "paddingBottom" : "paddingTop"]: spolu } as CSSProperties}>
      {obsah}
      {nastroje.map((x, i) => {
        const moj = x.n.majitel === ja;
        const popis = x.hrana === null ? "Nástroj bez hrán v sade." : popisHranyNastroja(x.hrana);
        const kto = moj ? "ty" : menoHraca(x.n.majitel);
        const navrat = moj ? "Po bitke sa vráti do tvojho odhadzovacieho balíčka." : `Po bitke sa vráti do odhadzovacieho balíčka hráča ${kto}.`;
        // Najbližší k hostiteľovi je prvý podložený, ďalšie (Zámočník) trčia o hranu ďalej.
        const odstup = (nastroje.length - 1 - i) * vyska;
        return (
          <div
            key={x.n.card.uid}
            role="button"
            tabIndex={0}
            className={`pas-nastroja ${moj ? "pas-moj" : "pas-supera"}${x.navrh === true ? " pas-navrh" : ""}`}
            style={{ height: vyska, background: x.farba, [smer === "dole" ? "bottom" : "top"]: odstup, "--pil": `${Math.round(vyska * 0.62)}px` } as CSSProperties}
            aria-label={`${x.nazov}: ${popis} Podložil ${kto}.`}
            onMouseEnter={(e) => ukaz(e.currentTarget, { nadpis: x.nazov, text: <>{popis}<span className="tip-stav">{`Podložil ${kto}. ${navrat}`}</span></> })}
            onMouseLeave={skry}
            onClick={(e) => {
              skry();
              if (x.navrh === true && otoc !== null) otoc();
              else lupa(x.n, e.currentTarget);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") lupa(x.n, e.currentTarget);
            }}
          >
            {x.hrana !== null && <ObsahHrany hrana={x.hrana} vzhlad={vzhlad} />}
            {x.navrh === true && (
              <button
                type="button"
                className="pas-nastroja-otoc"
                disabled={otoc === null}
                title={otoc === null ? "Druhá hrana pod túto kartu nejde." : "Otočiť Nástroj — bude trčať druhá hrana (aj medzerník)."}
                aria-label="Otočiť Nástroj"
                onClick={(e) => {
                  e.stopPropagation();
                  otoc?.();
                }}
              >
                ⟲
              </button>
            )}
          </div>
        );
      })}
      {tip}
    </div>
  );
}
