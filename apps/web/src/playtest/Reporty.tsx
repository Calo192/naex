// Reporty z playtestov AI hráčov (docs/playtesty a nahraté na web) — pre admina
// a subadminov. Report je samostatné HTML od AI spisovateľa; zobrazuje sa
// v izolovanom rámci (sandbox bez allow-same-origin), server ho podáva cez
// krátkodobý token.

import { useEffect, useState } from "react";
import { api } from "../lib/api.ts";
import { Odkaz, useTitulok } from "../lib/router.tsx";
import { Hlaska, Nacitavanie } from "../komponenty.tsx";

export interface Report {
  readonly subor: string;
  readonly nazov: string;
  readonly cas: number | null;
  readonly druh: "prehlad" | "report" | "strategia" | "navrhy";
}

export const kedy = (cas: number): string =>
  new Date(cas).toLocaleString("sk", { timeZone: "UTC", day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });

export const odkazNaReport = (subor: string): string => `/playtest/reporty/${encodeURIComponent(subor)}`;

/** Turnus = čas z názvu súboru; report, rozbor stratéga a návrhy jedného turnusu sú v jednom riadku. */
const turnus = (subor: string): string => /(\d{8}-\d{6})/.exec(subor)?.[1] ?? subor;

export function Reporty({ subor }: { readonly subor: string | null }) {
  useTitulok("Playtest — reporty");
  const [data, setData] = useState<{ token: string; reporty: readonly Report[] } | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);

  // Token platí 2 hodiny — pri každom otvorení sekcie či reportu sa načíta nový.
  useEffect(() => {
    api
      .get<{ token: string; reporty: Report[] }>("/admin/playtesty")
      .then(setData)
      .catch((e: unknown) => setChyba(e instanceof Error ? e.message : String(e)));
  }, [subor]);

  if (data === null) return chyba !== null ? <Hlaska>{chyba}</Hlaska> : <Nacitavanie />;

  if (subor !== null) {
    const report = data.reporty.find((r) => r.subor === subor);
    const adresa = `/playtesty/${data.token}/${encodeURIComponent(subor)}`;
    return (
      <div className="playtest-nahlad">
        <div className="riadok-tlacidiel" style={{ marginBottom: 10 }}>
          <Odkaz href="/playtest/reporty">← všetky reporty</Odkaz>
          <strong style={{ marginLeft: 8 }}>{report?.nazov ?? subor}</strong>
          <a href={adresa} target="_blank" rel="noopener noreferrer" style={{ marginLeft: "auto" }}>
            otvoriť v novej karte
          </a>
        </div>
        {/* Aj súbor mimo zoznamu (návrhy a dizajny bez dátumu, na ktoré odkazuje roadmapa) — prístup stráži token servera. */}
        <iframe className="playtest-ramec" src={adresa} title={report?.nazov ?? subor} sandbox="allow-scripts allow-popups" />
      </div>
    );
  }

  const prehlady = data.reporty.filter((r) => r.druh === "prehlad");
  const turnusy = new Map<string, { cas: number | null; report?: Report; strategia?: Report; navrhy?: Report }>();
  for (const r of data.reporty) {
    if (r.druh === "prehlad") continue;
    const t = turnus(r.subor);
    const riadok = turnusy.get(t) ?? { cas: r.cas };
    turnusy.set(t, { ...riadok, [r.druh]: r });
  }
  const bunka = (r: Report | undefined, text?: string) => (r === undefined ? <span className="tlmene">—</span> : <Odkaz href={odkazNaReport(r.subor)}>{text ?? r.nazov}</Odkaz>);

  return (
    <div>
      <p className="tlmene">
        Reporty z partií AI playtesterov, rozbory stratéga a návrhy navrhára. Každý playtest ich sem pridá sám. Vidí ich len admin a subadmini.
      </p>
      {chyba !== null && <Hlaska>{chyba}</Hlaska>}
      {prehlady.length > 0 && (
        <>
          <h2>Prehľady</h2>
          <ul className="playtest-zoznam">
            {prehlady.map((r) => (
              <li key={r.subor}>
                <Odkaz href={odkazNaReport(r.subor)}>{r.nazov}</Odkaz>
              </li>
            ))}
          </ul>
        </>
      )}
      <h2>Playtesty ({turnusy.size})</h2>
      {turnusy.size === 0 ? (
        <p className="tlmene">Zatiaľ žiadny report — spusti playtest (/naex-playtest).</p>
      ) : (
        <div className="tabulka-obal">
          <table className="tabulka">
            <thead>
              <tr>
                <th>Kedy</th>
                <th>Report</th>
                <th>Rozbor stratéga</th>
                <th>Návrhy</th>
              </tr>
            </thead>
            <tbody>
              {[...turnusy].map(([t, r]) => (
                <tr key={t}>
                  <td style={{ whiteSpace: "nowrap" }}>{r.cas !== null ? kedy(r.cas) : "—"}</td>
                  <td>{bunka(r.report)}</td>
                  <td>{bunka(r.strategia, "rozbor")}</td>
                  <td>{bunka(r.navrhy, "návrhy")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
