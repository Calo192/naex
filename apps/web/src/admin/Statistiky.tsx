// Štatistiky návrhov (MAUI Statistics): kópie, použitie akcií, pozície,
// páry na spojoch, tagy, blokované pozície a bodovacie karty.

import { useMemo, useState, type CSSProperties } from "react";
import { INDEXY, sancaKategorie, statistiky, statistikyBodovania } from "@naex/tvorba";
import { IkonaAkcie } from "../karta/IkonaAkcie.tsx";
import { mediaUrl } from "../lib/api.ts";
import { useTitulok } from "../lib/router.tsx";
import { useAdmin } from "./stav.tsx";

type Sekcia = "pouzitie" | "pozicie" | "pary" | "kopie" | "tagy" | "blokovane" | "bodovanie";

const SEKCIE: readonly [Sekcia, string][] = [
  ["pouzitie", "Použitie"],
  ["pozicie", "Pozície"],
  ["pary", "Páry"],
  ["kopie", "Kópie"],
  ["tagy", "Tagy"],
  ["blokovane", "Blokované"],
  ["bodovanie", "Bodovacie karty"],
];

const pct = (x: number) => `${Math.round(x * 100)} %`;

/** Bunka tepelnej mapy — sýtosť jantárovej podľa hodnoty 0..max. */
function Bunka({ x, max, text }: { readonly x: number; readonly max: number; readonly text?: string | undefined }) {
  const a = max <= 0 ? 0 : Math.min(1, x / max);
  return (
    <td className="teplo" style={{ "--a": a } as CSSProperties} title={text ?? pct(x)}>
      {x === 0 ? "·" : (text ?? pct(x))}
    </td>
  );
}

export function Statistiky() {
  useTitulok("Štatistiky — tvorba");
  const { obsah } = useAdmin();
  const [sekcia, setSekcia] = useState<Sekcia>("pouzitie");
  const [tag, setTag] = useState<string>("Starešina");
  const s = useMemo(() => (obsah === null ? null : statistiky(obsah.karty)), [obsah]);
  if (obsah === null || s === null) return null;

  const akcia = (kluc: string) => obsah.akcie.find((a) => a.kluc === kluc);
  const ikona = (kluc: string) => (
    <span className="mini-slot" style={{ background: "#8a7a62" }}>
      <IkonaAkcie kluc={kluc} akcia={akcia(kluc)} />
    </span>
  );
  const kluce = s.pouzitie.map((u) => u.kluc);
  const maxPar = Math.max(0, ...Object.values(s.pary).flatMap((r) => Object.values(r)));
  const tagy = [...new Set(obsah.karty.flatMap((k) => k.tagy))].sort((a, b) => a.localeCompare(b, "sk"));
  const kategoria = sancaKategorie(obsah.karty, tag);
  const bod = statistikyBodovania(obsah.bodovacie);

  return (
    <div className="admin-stranka">
      <h1>Štatistiky</h1>
      <p className="tlmene">
        {s.navrhov} návrhov · {s.vytlacenychKariet} vytlačených kariet (permutácie × kópie). Každá vytlačená karta má
        v štatistikách rovnakú váhu.
      </p>
      <div className="cipy" style={{ margin: "14px 0 20px" }}>
        {SEKCIE.map(([id, text]) => (
          <button key={id} className={sekcia === id ? "cip aktivny" : "cip"} onClick={() => setSekcia(id)}>
            {text}
          </button>
        ))}
      </div>

      <section className="panel statistika">
        {sekcia === "pouzitie" && (
          <>
            <h2>Použitie akcií</h2>
            <p className="tlmene">Koľko návrhov akciu obsahuje a koľkokrát sa objaví na všetkých vytlačených kartách.</p>
            <div className="stlpce">
              {s.pouzitie.map((u) => (
                <div key={u.kluc} className="stlpec-riadok">
                  {ikona(u.kluc)}
                  <span className="stlpec-meno">{akcia(u.kluc)?.nazov ?? u.kluc}</span>
                  <span className="stlpec">
                    <span style={{ width: pct(u.podiel) }} />
                  </span>
                  <span className="stlpec-cislo">
                    {u.navrhov} návrhov · {u.vyskytov}×
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {sekcia === "pozicie" && (
          <>
            <h2>Pozícia akcie (keď ju karta má)</h2>
            <p className="tlmene">Šanca, že akcia leží na danom indexe, ak ju vytlačená karta obsahuje.</p>
            <div className="tabulka-obal">
              <table className="tabulka teplotna">
                <thead>
                  <tr>
                    <th>Akcia</th>
                    {INDEXY.map((i) => (
                      <th key={i}>{i}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {kluce.map((k) => (
                    <tr key={k}>
                      <th>
                        {ikona(k)} {akcia(k)?.nazov ?? k}
                      </th>
                      {(s.pozicie[k] ?? []).map((x, i) => (
                        <Bunka key={i} x={x} max={1} />
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {sekcia === "pary" && (
          <>
            <h2>Páry na spoji</h2>
            <p className="tlmene">
              Očakávaný počet stretnutí pravej akcie jednej karty (riadok) s ľavou akciou ďalšej karty (stĺpec) na
              rovnakej pozícii, pre náhodnú dvojicu vytlačených kariet. Ukazuje, ktoré kombinácie budú v hre časté.
            </p>
            <div className="tabulka-obal">
              <table className="tabulka teplotna">
                <thead>
                  <tr>
                    <th>pravá ↓ / ľavá →</th>
                    {kluce.map((k) => (
                      <th key={k} title={akcia(k)?.nazov ?? k}>
                        {ikona(k)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {kluce.map((r) => (
                    <tr key={r}>
                      <th>
                        {ikona(r)} {akcia(r)?.nazov ?? r}
                      </th>
                      {kluce.map((l) => {
                        const x = s.pary[r]?.[l] ?? 0;
                        return <Bunka key={l} x={x} max={maxPar} text={x === 0 ? undefined : x.toFixed(3)} />;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {sekcia === "kopie" && (
          <>
            <h2>Vytlačené kópie podľa karty</h2>
            <table className="tabulka">
              <thead>
                <tr>
                  <th>Karta</th>
                  <th>Permutácií</th>
                  <th>Vytlačených</th>
                </tr>
              </thead>
              <tbody>
                {s.kopie.map((k) => (
                  <tr key={k.id}>
                    <td>{k.nazov}</td>
                    <td>{k.permutacii}</td>
                    <td>{k.kariet}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {sekcia === "tagy" && (
          <>
            <h2>Tagy</h2>
            <div className="stlpce">
              {s.tagy.map((t) => (
                <div key={t.tag} className="stlpec-riadok">
                  <span className="stlpec-meno">{t.tag}</span>
                  <span className="stlpec">
                    <span style={{ width: pct(t.navrhov / Math.max(1, s.navrhov)) }} />
                  </span>
                  <span className="stlpec-cislo">{t.navrhov}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {sekcia === "blokovane" && (
          <>
            <h2>Blokované pozície</h2>
            <p className="tlmene">Podiel návrhov, ktoré majú pozíciu blokovanú.</p>
            <table className="tabulka teplotna">
              <thead>
                <tr>
                  {INDEXY.map((i) => (
                    <th key={i}>{i}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {s.blokovane.map((x, i) => (
                    <Bunka key={i} x={x} max={1} />
                  ))}
                </tr>
              </tbody>
            </table>
          </>
        )}

        {sekcia === "bodovanie" && (
          <>
            <h2>Šanca obsadenia indexu podľa kategórie</h2>
            <p className="tlmene">
              Keď sa do bodovacej karty vloží karta tejto kategórie, s akou šancou bude mať na indexe akciu (a aktivuje
              bočnú bodovaciu pozíciu)?
            </p>
            <select value={tag} onChange={(e) => setTag(e.target.value)} style={{ maxWidth: 240, marginBottom: 12 }}>
              {tagy.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <table className="tabulka teplotna">
              <thead>
                <tr>
                  {INDEXY.map((i) => (
                    <th key={i}>{i}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {kategoria.map((x, i) => (
                    <Bunka key={i} x={x} max={1} />
                  ))}
                </tr>
              </tbody>
            </table>
            <h2 style={{ marginTop: 24 }}>Ikony na bodovacích kartách</h2>
            {Object.keys(bod).length === 0 ? (
              <p className="tlmene">Zatiaľ žiadne bodovacie karty s ikonami.</p>
            ) : (
              <table className="tabulka teplotna">
                <thead>
                  <tr>
                    <th>Ikona</th>
                    {INDEXY.map((i) => (
                      <th key={i}>{i}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(bod).map(([id, arr]) => {
                    const ik = obsah.ikonyBodovania.find((x) => x.id === id);
                    return (
                      <tr key={id}>
                        <th>
                          {ik !== undefined && <img src={mediaUrl(ik.media)} alt="" className="mini-ikona" />} {ik?.nazov ?? id}
                        </th>
                        {arr.map((x, i) => (
                          <Bunka key={i} x={x} max={1} />
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </>
        )}
      </section>
    </div>
  );
}
