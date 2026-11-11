// Vízia na stole (Michal 2026-11-08, mockup V-B v docs/napady/frakcie-mockupy.html): vrchná
// karta balíčka vyjde nad ruku priamo na plsť a stôl ostane vidieť — namiesto okna, ktoré
// stôl zakrylo. Rozhoduje sa dvoma pečiatkami cez kartu (VZIAŤ!, SPÁLIŤ!, Michal 2026-11-11) ako
// pri výbere z ponuky. Krištáľová gula ukáže dve karty a každá má svoju dvojicu.

import type { CSSProperties, ReactNode } from "react";
import type { Command } from "@naex/core";
import { t } from "../i18n/jazyk.tsx";

export interface KartaVizie {
  readonly kluc: string | number;
  readonly nazov: string;
  /** Pod kartou, napr. „vrchná“ / „druhá“ pri Krištáľovej guli. */
  readonly popis?: string;
  readonly render: (sirka: number) => ReactNode;
}

/** Pomer výšky a šírky karty (54 × 80 mm). */
const POMER = 80 / 54;
/** Nad kartou pilulka pokynu na hornej hrane stola. */
const REZERVA_HORE = 34;
/** Pod kartou tlačidlá spodnej hrany stola (Pozrieť stôl…) — do plste vyčnievajú asi o polovicu. */
const REZERVA_DOLE = 36;
/** Pri Krištáľovej guli je pod kartou popis „vrchná“ / „druhá“. */
const REZERVA_POPISU = 18;
/** Telefón na šírku: hrana nie je, pokyn je v pruhu. */
const REZERVA_TELEFON = 8;
const MAX_SIRKA = 300;
const MIN_SIRKA = 84;

export interface RozmerVizie {
  readonly sirka: number;
  readonly medzera: number;
  /** Odstup spodku karty (s popisom) od spodku plste. */
  readonly dole: number;
}

/** Karta čo najväčšia, aby sa s pilulkou a hranou zmestila do plste bez posúvania. */
export function rozmerVizie(plst: { readonly w: number; readonly h: number }, pocet: number, naSirku: boolean): RozmerVizie {
  const medzera = pocet > 1 ? (naSirku ? 20 : 40) : 0;
  const dole = naSirku ? REZERVA_TELEFON : REZERVA_DOLE;
  const hore = naSirku ? 10 : REZERVA_HORE;
  const popis = pocet > 1 ? REZERVA_POPISU : 0;
  const podlaVysky = (plst.h - hore - dole - popis) / POMER;
  const podlaSirky = (plst.w - 40 - (pocet - 1) * medzera) / pocet;
  return { sirka: Math.max(MIN_SIRKA, Math.floor(Math.min(podlaVysky, podlaSirky, MAX_SIRKA))), medzera, dole };
}

/** Zámer pre i-tu ukázanú kartu: prvá je vrchná, druhá (Krištáľová gula) nesie `druha`. */
export function zamerVizie(i: number, vziat: boolean): Command {
  return i === 0 ? { type: "vizia", vziat } : { type: "vizia", vziat, druha: true };
}

/**
 * Karty Vízie na plsti — línia za nimi stlmí (hra.css). Voľby sú pečiatky cez kartu (Michal 2026-11-11:
 * „radšej pečiatky ako buttony namiesto ikon“): VZIAŤ! do ruky a SPÁLIŤ! navždy z hry; klik na pečiatku
 * je zámer. Pri Krištáľovej guli má každá karta svoju dvojicu.
 */
export function ViziaNaStole({ karty, rozmer, onVolba }: { readonly karty: readonly KartaVizie[]; readonly rozmer: RozmerVizie; readonly onVolba: (i: number, vziat: boolean) => void }) {
  return (
    <div className="vizia-na-stole" style={{ gap: rozmer.medzera, bottom: rozmer.dole, "--ponuka-sirka": `${rozmer.sirka}px` } as CSSProperties}>
      {karty.map((k, i) => {
        const ktora = k.popis === undefined ? k.nazov : `${k.nazov} (${k.popis})`;
        return (
          <figure key={k.kluc} className="vizia-stol-karta" data-vizia={i} aria-label={k.nazov}>
            {k.render(rozmer.sirka)}
            {/* Pečiatky ležia vedľa karty, nie v nej — karta má vlastnú lupu a tlačidlá sa nevnárajú. */}
            <button type="button" className="naex-peciatka ponuka-peciatka vizia-peciatka vizia-volba vziat" data-vizia={i} aria-label={t("ponuka.vziatAria", { karta: ktora })} title={t("ponuka.vziatAria", { karta: ktora })} onClick={() => onVolba(i, true)}>
              <span className="naex-peciatka-text">{t("ponuka.vziat")}</span>
              <span className="naex-peciatka-kto">{t("ponuka.doRuky")}</span>
            </button>
            <button type="button" className="naex-peciatka ponuka-peciatka vizia-peciatka vizia-volba spalit" data-vizia={i} aria-label={t("ponuka.spalitAria", { karta: ktora })} title={t("ponuka.spalitAria", { karta: ktora })} onClick={() => onVolba(i, false)}>
              <span className="naex-peciatka-text">{t("ponuka.spalit")}</span>
              <span className="naex-peciatka-kto">{t("ponuka.navzdy")}</span>
            </button>
            {k.popis !== undefined && <figcaption>{k.popis}</figcaption>}
          </figure>
        );
      })}
    </div>
  );
}
