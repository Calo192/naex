// Reporty z playtestov AI hráčov (docs/playtesty) — pre admina a subadminov.
// Report je samostatné HTML od AI spisovateľa; zobrazuje sa v izolovanom
// rámci (sandbox bez allow-same-origin), server ho podáva cez krátkodobý token.

import { useEffect, useState } from "react";
import { api } from "../lib/api.ts";
import { Odkaz, useTitulok } from "../lib/router.tsx";
import { Hlaska, Nacitavanie } from "../komponenty.tsx";

interface Report {
  readonly subor: string;
  readonly nazov: string;
  readonly cas: number | null;
  readonly druh: "prehlad" | "report";
}

const kedy = (cas: number): string =>
  new Date(cas).toLocaleString("sk", { timeZone: "UTC", day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function Playtesty({ subor }: { readonly subor: string | null }) {
  useTitulok("Playtesty — správa");
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
      <div className="admin-stranka playtest-nahlad">
        <div className="riadok-tlacidiel" style={{ marginBottom: 10 }}>
          <Odkaz href="/admin/playtesty">← všetky playtesty</Odkaz>
          <strong style={{ marginLeft: 8 }}>{report?.nazov ?? subor}</strong>
          <a href={adresa} target="_blank" rel="noopener noreferrer" style={{ marginLeft: "auto" }}>
            otvoriť v novej karte
          </a>
        </div>
        {report === undefined ? (
          <Hlaska>Taký report nie je.</Hlaska>
        ) : (
          <iframe className="playtest-ramec" src={adresa} title={report.nazov} sandbox="allow-scripts allow-popups" />
        )}
      </div>
    );
  }

  const prehlady = data.reporty.filter((r) => r.druh === "prehlad");
  const reporty = data.reporty.filter((r) => r.druh === "report");
  return (
    <div className="admin-stranka">
      <h1>Playtesty</h1>
      <p className="tlmene">
        Reporty z partií AI playtesterov. Každý nový playtest sem pridá jeho spisovateľ automaticky. Vidí ich len admin a subadmini.
      </p>
      {chyba !== null && <Hlaska>{chyba}</Hlaska>}
      {prehlady.length > 0 && (
        <>
          <h2>Prehľady</h2>
          <ul className="playtest-zoznam">
            {prehlady.map((r) => (
              <li key={r.subor}>
                <Odkaz href={`/admin/playtesty/${encodeURIComponent(r.subor)}`}>{r.nazov}</Odkaz>
              </li>
            ))}
          </ul>
        </>
      )}
      <h2>Reporty ({reporty.length})</h2>
      {reporty.length === 0 ? (
        <p className="tlmene">Zatiaľ žiadny report — spusti playtest (/playtest).</p>
      ) : (
        <table className="tabulka">
          <thead>
            <tr>
              <th>Partia</th>
              <th>Report</th>
            </tr>
          </thead>
          <tbody>
            {reporty.map((r) => (
              <tr key={r.subor}>
                <td style={{ whiteSpace: "nowrap" }}>{r.cas !== null ? kedy(r.cas) : "—"}</td>
                <td>
                  <Odkaz href={`/admin/playtesty/${encodeURIComponent(r.subor)}`}>{r.nazov}</Odkaz>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
