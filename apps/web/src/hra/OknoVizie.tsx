// Okno Vízie (Michal 2026-11-02): jediné rozhodnutie je nechať si vrchnú kartu
// balíčka alebo ju spáliť, preto je karta veľká (väčšina výšky obrazovky,
// čitateľný efekt aj akcie) a tlačidlá sú hneď pod ňou. Krištáľová guľa
// ukáže dve karty, každú so svojimi tlačidlami. Okno sa dá skryť (pozrieť
// stôl) a znova otvoriť z pásu pokynov.

import { useEffect, useRef, type ReactNode } from "react";

export interface KartaVizie {
  readonly kluc: string | number;
  readonly nazov: string;
  /** Pod kartou, napr. „vrchná“ / „druhá“ pri Krištáľovej guli. */
  readonly popis?: string;
  readonly render: (sirka: number) => ReactNode;
  readonly nechat: () => void;
  readonly zahodit: () => void;
}

/** Pomer výšky a šírky karty (54 × 80 mm). */
const POMER = 80 / 54;

/** Šírka karty, aby sa okno s textom a tlačidlami zmestilo bez posúvania. */
export function sirkaKartyVizie(sirkaOkna: number, vyskaOkna: number, pocet: number): number {
  const nizke = vyskaOkna < 520;
  // Nadpis s vetou a tlačidlá pod kartou; na nízkom okne (telefón na šírku) sú stiesnenejšie.
  const rezerva = nizke ? 112 : 210;
  const vyska = Math.min(vyskaOkna - rezerva, vyskaOkna * 0.74);
  const naSirku = (sirkaOkna - 48 - (pocet - 1) * 32) / pocet;
  return Math.max(110, Math.floor(Math.min(vyska / POMER, naSirku, 560)));
}

export function OknoVizie({
  nadpis,
  text,
  karty,
  sirkaOkna,
  vyskaOkna,
  onSkry,
}: {
  readonly nadpis: string;
  readonly text: ReactNode;
  readonly karty: readonly KartaVizie[];
  readonly sirkaOkna: number;
  readonly vyskaOkna: number;
  readonly onSkry: () => void;
}) {
  const skryRef = useRef(onSkry);
  skryRef.current = onSkry;
  const prveRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const klaves = (e: KeyboardEvent): void => {
      if (e.key === "Escape") skryRef.current();
    };
    window.addEventListener("keydown", klaves);
    prveRef.current?.focus({ preventScroll: true });
    return () => window.removeEventListener("keydown", klaves);
  }, []);
  const sirka = sirkaKartyVizie(sirkaOkna, vyskaOkna, karty.length);

  return (
    <div className="vizia-okno" role="dialog" aria-modal="true" aria-label={nadpis}>
      <header className="vizia-okno-hlava">
        <h2>{nadpis}</h2>
        <p>{text}</p>
        <button className="vizia-okno-skryt" onClick={onSkry} title="Skryť a pozrieť stôl (Esc) — vrátiš sa tlačidlom v páse pokynov" aria-label="Skryť okno">
          ✕
        </button>
      </header>
      <div className="vizia-okno-karty">
        {karty.map((k, i) => (
          <figure key={k.kluc} className="vizia-okno-karta" aria-label={k.nazov}>
            {k.render(sirka)}
            <figcaption>
              {k.popis !== undefined && <span className="vizia-okno-popis">{k.popis}</span>}
              <span className="vizia-okno-tlacidla">
                <button ref={i === 0 ? prveRef : undefined} className="tlacidlo-hlavne" onClick={k.nechat}>
                  Nechať
                  <small>do ruky</small>
                </button>
                <button onClick={k.zahodit}>
                  Spáliť
                  <small>navždy z hry</small>
                </button>
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
