// Veštica (Prehra, PRAVIDLA §9.5b): porazený vymení jednu kartu svojho doberacieho balíčka
// za súperovu. Michal 2026-11-03: „Upraviť UI preskúmania kariet — či už mojich alebo súpera.
// Taktiež upraviť vizuál, ktorú kartu kam dávam.“ Tvoj balíček je vľavo v tvojej farbe, súperov
// vpravo v jeho; v strede výmena so šípkami — ktorá karta odíde ku komu. Karty sa zmestia bez
// posúvania: veľkosť sa ráta z miesta, ktoré balíček má, a lupa ukáže kartu celú.

import { useEffect, useState, type ReactNode } from "react";
import type { CardInstance } from "@naex/core";

/** Pomer výšky karty k šírke (ako na stole). */
const POMER_KARTY = 80 / 54;
const MEDZERA = 8;
const NAJMENSIA = 44;

/** Najväčšia šírka karty, pri ktorej sa `n` kariet zmestí do plochy sirka × vyska. */
export function sirkaKarietVestice(n: number, sirka: number, vyska: number, najviac: number): number {
  if (n === 0 || sirka <= 0 || vyska <= 0) return najviac;
  for (let w = najviac; w > NAJMENSIA; w--) {
    const stlpce = Math.max(1, Math.floor((sirka + MEDZERA) / (w + MEDZERA)));
    const rady = Math.ceil(n / stlpce);
    if (rady * w * POMER_KARTY + (rady - 1) * MEDZERA <= vyska) return w;
  }
  return NAJMENSIA;
}

/** Plocha prvku (šírka, výška) — sleduje zmenu okna. */
function usePlocha(): [(el: HTMLDivElement | null) => void, { readonly sirka: number; readonly vyska: number }] {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [plocha, setPlocha] = useState({ sirka: 0, vyska: 0 });
  useEffect(() => {
    if (el === null) return;
    const ro = new ResizeObserver(([z]) => setPlocha({ sirka: Math.floor(z?.contentRect.width ?? 0), vyska: Math.floor(z?.contentRect.height ?? 0) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, plocha];
}

export interface VesticaVyberProps {
  readonly moj: readonly CardInstance[];
  readonly jeho: readonly CardInstance[];
  /** Index vybranej karty v mojom a v súperovom balíčku. */
  readonly moja: number | null;
  readonly jehoVyber: number | null;
  readonly menoSupera: string;
  readonly menoKarty: (defId: string) => string;
  readonly onVyber: (kto: "moj" | "jeho", i: number | null) => void;
  /** Karta s lupou (HernaPlocha sLupou). */
  readonly karta: (k: CardInstance, sirka: number, vybrana: boolean, onClick: () => void, stitok: ReactNode) => ReactNode;
  /** Najväčšia šírka karty. */
  readonly najviac: number;
}

function Balicek({
  kto,
  karty,
  vyber,
  nadpis,
  pokyn,
  stitokVybranej,
  props,
}: {
  readonly kto: "moj" | "jeho";
  readonly karty: readonly CardInstance[];
  readonly vyber: number | null;
  readonly nadpis: string;
  readonly pokyn: string;
  readonly stitokVybranej: ReactNode;
  readonly props: VesticaVyberProps;
}) {
  const [ref, plocha] = usePlocha();
  const sirka = sirkaKarietVestice(karty.length, plocha.sirka, plocha.vyska, props.najviac);
  return (
    <section className={`vestica-balicek ${kto === "moj" ? "ja" : "su"}`} aria-label={nadpis}>
      <header className="vestica-hlava">
        <span className="vestica-meno">{nadpis}</span>
        <span className="vestica-pocet">{karty.length === 1 ? "1 karta" : karty.length < 5 ? `${karty.length} karty` : `${karty.length} kariet`}</span>
        <span className="vestica-pokyn">{pokyn}</span>
      </header>
      <div className="vestica-karty" ref={ref}>
        {karty.map((k, i) => {
          const vybrana = vyber === i;
          return props.karta(k, sirka, vybrana, () => props.onVyber(kto, vybrana ? null : i), vybrana ? stitokVybranej : null);
        })}
      </div>
    </section>
  );
}

/** Miesto výmeny v strede: vybraná karta (meno) a šípka k novému majiteľovi. */
function Presun({ karta, smer, kam, prazdne }: { readonly karta: string | null; readonly smer: "doprava" | "dolava"; readonly kam: string; readonly prazdne: string }) {
  return (
    <div className={`vestica-presun ${smer} ${karta === null ? "prazdny" : ""}`}>
      <span className="vestica-presun-karta">{karta ?? prazdne}</span>
      <span className="vestica-sipka" aria-hidden="true">
        {smer === "doprava" ? "⟶" : "⟵"}
      </span>
      <span className="vestica-presun-kam">{kam}</span>
    </div>
  );
}

export function VesticaVyber(props: VesticaVyberProps) {
  const km = props.moja === null ? undefined : props.moj[props.moja];
  const kj = props.jehoVyber === null ? undefined : props.jeho[props.jehoVyber];
  return (
    <div className="vestica">
      <Balicek
        kto="moj"
        karty={props.moj}
        vyber={props.moja}
        nadpis="Tvoj doberací balíček"
        pokyn="vyber kartu, ktorú dáš"
        stitokVybranej={<span className="vestica-stitok su">dáš ⟶</span>}
        props={props}
      />
      <div className="vestica-vymena" aria-live="polite">
        <span className="vestica-vymena-nadpis">výmena</span>
        <Presun karta={km === undefined ? null : props.menoKarty(km.defId)} smer="doprava" kam={`do balíčka: ${props.menoSupera}`} prazdne="tvoja karta" />
        <Presun karta={kj === undefined ? null : props.menoKarty(kj.defId)} smer="dolava" kam="do tvojho balíčka" prazdne="jeho karta" />
        <span className="vestica-vymena-pozn">potom sa oba balíčky zamiešajú</span>
      </div>
      <Balicek
        kto="jeho"
        karty={props.jeho}
        vyber={props.jehoVyber}
        nadpis={`Balíček: ${props.menoSupera}`}
        pokyn="vyber kartu, ktorú si vezmeš"
        stitokVybranej={<span className="vestica-stitok ja">⟵ vezmeš</span>}
        props={props}
      />
    </div>
  );
}
