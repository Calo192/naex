// Achievementy v profile hráča (/hrac/:id): vitrína v záložke a v Prehľade karta s naposledy
// získanými podtáckami. Dáta prídu v GET /api/hraci/:id (pole achievementy) — null, kým
// achievementy nie sú zapnuté alebo keď si cudzí hráč skryl súhrn; vtedy sa nič neukáže.

import { useMemo } from "react";
import { useSada } from "../lib/sada.tsx";
import { polozkaVitriny, type VitrinaApi } from "./data.ts";
import { NAZOV_RANKU, Podtacok } from "./Podtacok.tsx";
import { Vitrina, type PolozkaVitriny } from "./Vitrina.tsx";
import "./podtacok.css";

/** Koľko posledných podtáckov ukáže karta v Prehľade. */
const POSLEDNYCH = 6;

function usePolozky(vitrina: VitrinaApi): readonly PolozkaVitriny[] {
  const { sada } = useSada();
  const ikony = sada?.ikonyBodovania;
  return useMemo(() => vitrina.achievementy.map((a) => polozkaVitriny(a, ikony ?? [])), [vitrina, ikony]);
}

export function VitrinaHraca({ vitrina, vlastna }: { readonly vitrina: VitrinaApi; readonly vlastna: boolean }) {
  const polozky = usePolozky(vitrina);
  return <Vitrina polozky={polozky} kategorie={vitrina.kategorie} vlastna={vlastna} />;
}

/** Karta v Prehľade: počet a naposledy získané podtácky; klik vedie do záložky. */
export function PoslednePodtacky({ vitrina, vlastna, vsetky }: { readonly vitrina: VitrinaApi; readonly vlastna: boolean; readonly vsetky: () => void }) {
  const polozky = usePolozky(vitrina);
  const ziskane = polozky.filter((p) => p.rank !== null).sort((a, b) => (b.ziskane ?? 0) - (a.ziskane ?? 0));
  return (
    <section className="panel profil-karta podtacky-karta">
      <header className="profil-karta-hlava">
        <h2>Achievementy</h2>
        <button type="button" className="tlacidlo-male tlacidlo-jemne" onClick={vsetky}>
          {ziskane.length} z {polozky.length} ›
        </button>
      </header>
      {ziskane.length === 0 ? (
        <p className="tlmene">{vlastna ? "Zatiaľ žiadny podtácok — prvé prídu s prvými partiami." : "Zatiaľ nezískal žiadny achievement."}</p>
      ) : (
        <ul className="podtacky-rad">
          {ziskane.slice(0, POSLEDNYCH).map((p) => (
            <li key={p.id} title={`${p.nazov} — ${p.popis}`}>
              <Podtacok rank={p.rank ?? "bronz"} ikona={p.ikona} obrazok={p.obrazok} nazov={p.nazov} ziskany tajny={p.tajny} velkost={88} />
              <span>{p.nazov}</span>
              <small className="tlmene">{p.rank === null ? "" : NAZOV_RANKU[p.rank]}</small>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
