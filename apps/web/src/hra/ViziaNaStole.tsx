// Vízia na stole (Michal 2026-11-08, mockup V-B v docs/napady/frakcie-mockupy.html): vrchná
// karta balíčka vyjde nad ruku priamo na plsť a stôl ostane vidieť — namiesto okna, ktoré
// stôl zakrylo. Rozhoduje sa dvoma tlačidlami s piktogramom (Dobratie, Spálenie) v strede
// spodnej hrany, kde sú aj ostatné potvrdenia ťahu. Krištáľová gula ukáže dve karty a každá
// má pod sebou svoju dvojicu.

import type { CSSProperties, ReactNode } from "react";
import type { Command } from "@naex/core";
import { IkonaAkcie } from "../karta/IkonaAkcie.tsx";

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
/** Pod kartou tlačidlá na spodnej hrane — do plste vyčnievajú asi o polovicu. */
const REZERVA_DOLE = 36;
/** Pri Krištáľovej guli je pod kartou popis „vrchná“ / „druhá“. */
const REZERVA_POPISU = 18;
/** Telefón na šírku: hrana nie je, tlačidlá sú v pruhu pokynu. */
const REZERVA_TELEFON = 8;
const MAX_SIRKA = 300;
const MIN_SIRKA = 84;

export interface RozmerVizie {
  readonly sirka: number;
  readonly medzera: number;
  /** Odstup spodku karty (s popisom) od spodku plste. */
  readonly dole: number;
}

/** Karta čo najväčšia, aby sa s pilulkou a tlačidlami zmestila do plste bez posúvania. */
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

/** Karty Vízie na plsti — línia za nimi stlmí (hra.css). */
export function ViziaNaStole({ karty, rozmer }: { readonly karty: readonly KartaVizie[]; readonly rozmer: RozmerVizie }) {
  return (
    <div className="vizia-na-stole" style={{ gap: rozmer.medzera, bottom: rozmer.dole } as CSSProperties}>
      {karty.map((k, i) => (
        <figure key={k.kluc} className="vizia-stol-karta" data-vizia={i} aria-label={k.nazov}>
          {k.render(rozmer.sirka)}
          {k.popis !== undefined && <figcaption>{k.popis}</figcaption>}
        </figure>
      ))}
    </div>
  );
}

/**
 * Dvojice tlačidiel do stredu spodnej hrany — bez textu, len piktogram a popis pod myšou
 * (ako tlačidlá rozdeľovania). Dvojica je široká ako karta nad ňou, aby pri guli
 * ležala každá pod svojou kartou.
 */
export function VolbyVizie({
  karty,
  rozmer,
  onVolba,
}: {
  readonly karty: readonly Pick<KartaVizie, "kluc" | "nazov" | "popis">[];
  readonly rozmer: RozmerVizie;
  readonly onVolba: (i: number, vziat: boolean) => void;
}) {
  return (
    <span className="vizia-volby" style={{ "--vizia-sirka": `${rozmer.sirka}px`, "--vizia-medzera": `${rozmer.medzera}px` } as CSSProperties}>
      {karty.map((k, i) => {
        const ktora = k.popis === undefined ? k.nazov : `${k.nazov} (${k.popis})`;
        return (
          <span key={k.kluc} className="vizia-par" data-vizia={i}>
            <button
              type="button"
              className="vizia-volba vziat"
              data-vizia={i}
              aria-label={`Do ruky: ${ktora}`}
              title={`Do ruky — ${k.nazov}`}
              onClick={() => onVolba(i, true)}
            >
              <span className="vizia-volba-ram">
                <IkonaAkcie kluc="Dobratie" />
              </span>
            </button>
            <button
              type="button"
              className="vizia-volba spalit"
              data-vizia={i}
              aria-label={`Spáliť navždy z hry: ${ktora}`}
              title={`Spáliť — ${k.nazov} navždy z hry`}
              onClick={() => onVolba(i, false)}
            >
              <span className="vizia-volba-ram">
                <IkonaAkcie kluc="Spálenie" />
              </span>
            </button>
          </span>
        );
      })}
    </span>
  );
}
