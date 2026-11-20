// Vitrína achievementov (Profil a verejný profil hráča): podtácky v mriežke, získané farebne
// s dátumom, nezískané sivo s postupom, filter podľa kategórie. Dáta z API prevedie data.ts.

import { Fragment, useMemo, useState } from "react";
import { datum } from "../lib/datum.ts";
import { nazovKategorie } from "./data.ts";
import { HVIEZDY_RANKU, NAZOV_RANKU, Podtacok, type RankPodtacka } from "./Podtacok.tsx";
import "./podtacok.css";

export interface PolozkaVitriny {
  readonly id: string;
  readonly nazov: string;
  readonly popis: string;
  readonly kategoria: string;
  readonly tajny: boolean;
  readonly ikona: string | null;
  readonly obrazok: string | null;
  /** Najvyšší dosiahnutý rank, null = nezískaný. */
  readonly rank: RankPodtacka | null;
  /** Rank, ktorý sa ukáže pri nezískanom (najnižší, na ktorý sa dá ísť). */
  readonly rankCiela: RankPodtacka;
  /** Kedy získal najvyšší rank (ms), null = nezískaný. */
  readonly ziskane: number | null;
  /** Postup k ďalšiemu ranku (kariérne achievementy); pri sérii aj aktuálna séria. */
  readonly postup: { readonly hodnota: number; readonly prah: number; readonly aktualna?: number | null } | null;
  /** Vzácnosť získaného ranku („vzácne“), bežné null. */
  readonly vzacnost?: string | null;
  /** Už sa nedá získať — odmena za vernosť tým, čo ho stihli (Michal 2026-11-06). */
  readonly legacy?: boolean;
}

/** Značka achievementu, ktorý už z hry zmizol; hráčovi ostáva navždy. */
export function ZnackaLegacy() {
  return (
    <span className="znacka-legacy" title="Tento achievement sa už nedá získať. Ostáva tým, čo ho stihli.">
      LEGACY ACHIEVEMENT
    </span>
  );
}

/** Podiel postupu k ďalšiemu ranku (0–1). */
const podiel = (p: PolozkaVitriny): number => (p.postup === null ? 0 : p.postup.hodnota / Math.max(1, p.postup.prah));

/**
 * Poradie vitríny (UI inšpekcia W-35): hore Rozpracované — nezískané, na ktorých hráč už má postup,
 * od najbližšieho k cieľu; pod nimi ostatné ako police s trofejami (získané prvé, podľa ranku a mena).
 * Cudzí profil postup nevidí, Rozpracované tam nie sú. Nič sa neskrýva — každá položka je v jednej skupine.
 */
export function poradieVitriny(polozky: readonly PolozkaVitriny[], vlastna: boolean): { readonly rozpracovane: readonly PolozkaVitriny[]; readonly ostatne: readonly PolozkaVitriny[] } {
  const rozpracovany = (p: PolozkaVitriny): boolean => vlastna && p.rank === null && p.legacy !== true && p.postup !== null && p.postup.hodnota > 0;
  // Skrytý tajný („???“) až na konci — medzi získanými a ostatnými rozbíjal poličky.
  const sila = (p: PolozkaVitriny): number => (p.rank === null ? (p.tajny ? -1 : 0) : HVIEZDY_RANKU[p.rank]);
  return {
    rozpracovane: polozky.filter(rozpracovany).sort((a, b) => podiel(b) - podiel(a) || a.nazov.localeCompare(b.nazov, "sk")),
    ostatne: polozky.filter((p) => !rozpracovany(p)).sort((a, b) => sila(b) - sila(a) || a.nazov.localeCompare(b.nazov, "sk")),
  };
}

export interface KategoriaVitriny {
  readonly id: string;
  readonly nazov: string;
}

export function Vitrina({
  polozky,
  kategorie,
  vlastna,
}: {
  readonly polozky: readonly PolozkaVitriny[];
  readonly kategorie: readonly KategoriaVitriny[];
  /** Vlastný profil ukazuje aj postup; cudzí len získané a počet. */
  readonly vlastna: boolean;
}) {
  const [filter, setFilter] = useState<string | null>(null);
  const ziskanych = polozky.filter((p) => p.rank !== null).length;
  const viditelne = useMemo(
    () => poradieVitriny(polozky.filter((p) => (filter === null || p.kategoria === filter) && (vlastna || p.rank !== null)), vlastna),
    [polozky, filter, vlastna],
  );
  const vsetkyViditelne = [...viditelne.rozpracovane, ...viditelne.ostatne];
  return (
    <section className="vitrina" aria-label="Achievementy">
      <header className="vitrina-hlava">
        <h2>Achievementy</h2>
        <span className="tlmene">
          {ziskanych} z {polozky.length}
        </span>
      </header>
      <div className="vitrina-filter" role="radiogroup" aria-label="Kategória">
        <button type="button" role="radio" aria-checked={filter === null} className={filter === null ? "aktivna" : ""} onClick={() => setFilter(null)}>
          všetky
        </button>
        {kategorie.map((k) => (
          <button key={k.id} type="button" role="radio" aria-checked={filter === k.id} className={filter === k.id ? "aktivna" : ""} onClick={() => setFilter(k.id)}>
            {nazovKategorie(k)}
          </button>
        ))}
      </div>
      {vsetkyViditelne.length === 0 ? (
        <p className="tlmene">{vlastna ? "V tejto kategórii nič nie je." : "Zatiaľ nič nezískal."}</p>
      ) : (
        <>
        {[
          { kluc: "rozpracovane", nadpis: `Rozpracované · ${viditelne.rozpracovane.length}`, polozky: viditelne.rozpracovane },
          // Nadpis „Ostatné“ len keď je nad nimi skupina Rozpracované.
          { kluc: "ostatne", nadpis: viditelne.rozpracovane.length > 0 ? "Ostatné" : null, polozky: viditelne.ostatne },
        ].filter((skupina) => skupina.polozky.length > 0).map((skupina) => (
        <Fragment key={skupina.kluc}>
        {skupina.nadpis !== null && <h3 className="vitrina-skupina">{skupina.nadpis}</h3>}
        <ul className="vitrina-mriezka">
          {skupina.polozky.map((p) => {
            const ziskany = p.rank !== null;
            const skryty = p.tajny && !ziskany;
            const postup = vlastna && p.postup !== null ? p.postup : null;
            return (
              <li key={p.id} className={`${ziskany ? "ziskany" : "neziskany"}${p.legacy === true ? " legacy" : ""}`}>
                <Podtacok rank={p.rank ?? p.rankCiela} ikona={p.ikona} obrazok={p.obrazok} nazov={p.nazov} ziskany={ziskany} tajny={p.tajny} velkost={120} />
                <strong>{skryty ? "???" : p.nazov}</strong>
                {p.legacy === true && <ZnackaLegacy />}
                {/* Tajný bez zisku: nápoveda zo servera (tajnyText), inak všeobecná veta. */}
                <span className="vitrina-popis">{skryty && p.popis === "???" ? "Tajný achievement — ukáže sa, až keď ho získaš." : p.popis}</span>
                {ziskany && p.rank !== null && (
                  <small className="vitrina-meta">
                    {NAZOV_RANKU[p.rank]}
                    {p.ziskane !== null && <> · získané {datum(p.ziskane)}</>}
                    {p.vzacnost != null && <> · {p.vzacnost}</>}
                  </small>
                )}
                {postup !== null && (
                  <small className="vitrina-meta">
                    <span className="vitrina-postup" aria-hidden="true">
                      <i style={{ width: `${Math.min(100, Math.round((postup.hodnota / Math.max(1, postup.prah)) * 100))}%` }} />
                    </span>
                    {ziskany ? `k ďalšiemu: ${postup.hodnota} / ${postup.prah}` : `${postup.hodnota} / ${postup.prah}`}
                    {postup.aktualna != null && <> · teraz {postup.aktualna}</>}
                  </small>
                )}
              </li>
            );
          })}
        </ul>
        </Fragment>
        ))}
        </>
      )}
    </section>
  );
}
