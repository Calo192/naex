// Výber karty z ponuky počas partie na plsti (Michal 2026-11-11, mock A v docs/napady/vyber-z-ponuky.html):
// Živnostník, Predavačka a Zastávka nedávajú okno cez celú obrazovku — ponuka leží na stole ako Vízia.
// Klik na kartu ju len vyznačí a pečiatka cez ňu (VZIAŤ! / NAVRCH!) je tlačidlo; až klik na pečiatku
// pošle zámer. Okno, ktoré kartu bralo hneď a po vzatí ostalo otvorené, hráča mýlilo.

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

export interface KartaPonuky {
  readonly kluc: number;
  readonly nazov: string;
  /** Kartu voľba nedovoľuje (iný druh) — štítok cez kartu, napr. „len Nástroj“. */
  readonly mimo?: string | undefined;
  readonly render: (sirka: number) => ReactNode;
}

/** Pečiatka cez vyznačenú kartu: slovo a kam karta pôjde. */
export interface PeciatkaPonuky {
  readonly text: string;
  readonly pod: string;
  readonly aria: string;
}

export interface RozmerPonuky {
  readonly sirka: number;
  readonly medzera: number;
  /** Odstup spodku kariet od spodku plste. */
  readonly dole: number;
}

/** Pomer výšky a šírky karty (54 × 80 mm). */
const POMER = 80 / 54;
/** Nad kartami pilulka pokynu; vyznačená karta sa ešte vysunie. */
const REZERVA_HORE = 34 + 12;
/** Pod kartami tlačidlo „Pozrieť stôl“ na spodnej hrane. */
const REZERVA_DOLE = 36;
/** Telefón na šírku: hrana nie je, tlačidlá sú v pruhu pokynu. */
const REZERVA_TELEFON = 8;
const MAX_SIRKA = 260;
const MIN_SIRKA = 70;

/** Karty čo najväčšie, aby sa celá ponuka zmestila do plste v jednom rade bez posúvania. */
export function rozmerPonuky(plst: { readonly w: number; readonly h: number }, pocet: number, naSirku: boolean): RozmerPonuky {
  const n = Math.max(1, pocet);
  const dole = naSirku ? REZERVA_TELEFON : REZERVA_DOLE;
  const hore = naSirku ? 18 : REZERVA_HORE;
  const podlaVysky = (plst.h - hore - dole) / POMER;
  // Medzera rastie s kartou, ale pri hustej ponuke na úzkom stole ustúpi karte.
  const medzera = n === 1 ? 0 : naSirku ? 8 : Math.max(10, Math.min(24, Math.floor(podlaVysky * 0.09)));
  const podlaSirky = (plst.w - 40 - (n - 1) * medzera) / n;
  return { sirka: Math.max(MIN_SIRKA, Math.floor(Math.min(podlaVysky, podlaSirky, MAX_SIRKA))), medzera, dole };
}

export function PonukaNaStole({
  karty,
  rozmer,
  vyznacena,
  peciatka,
  onVezmi,
}: {
  readonly karty: readonly KartaPonuky[];
  readonly rozmer: RozmerPonuky;
  readonly vyznacena: number | null;
  readonly peciatka: PeciatkaPonuky;
  readonly onVezmi: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  // Klávesnica: Enter na karte ju vyznačí, ďalší Enter (na pečiatke) ju vezme.
  useEffect(() => {
    if (vyznacena !== null) ref.current?.focus({ preventScroll: true });
  }, [vyznacena]);
  return (
    <div className="ponuka-na-stole" style={{ gap: rozmer.medzera, bottom: rozmer.dole, "--ponuka-sirka": `${rozmer.sirka}px` } as CSSProperties}>
      {karty.map((k) => {
        const vybrana = k.kluc === vyznacena;
        return (
          <figure
            key={k.kluc}
            className={["ponuka-stol-karta", vybrana ? "vyznacena" : "", k.mimo !== undefined ? "mimo" : ""].filter((x) => x !== "").join(" ")}
            data-uid={k.kluc}
            aria-label={k.nazov}
          >
            {k.render(rozmer.sirka)}
            {k.mimo !== undefined && <figcaption className="ponuka-mimo">{k.mimo}</figcaption>}
            {vybrana && (
              // Pečiatka leží vedľa karty, nie v nej — karta je sama tlačidlo a tlačidlá sa nevnárajú.
              <button
                ref={ref}
                type="button"
                className="naex-peciatka ponuka-peciatka"
                aria-label={peciatka.aria}
                title={peciatka.aria}
                onClick={onVezmi}
              >
                <span className="naex-peciatka-text">{peciatka.text}</span>
                <span className="naex-peciatka-kto">{peciatka.pod}</span>
              </button>
            )}
          </figure>
        );
      })}
    </div>
  );
}
