// Hráči a úrovne účtov (admin / subadmin / hráč / návštevník) — správa účtov,
// od 2026-10-21 mimo Tvorby (Michal: hráči v tvorbe kariet nemajú čo robiť).
// Zoznam vidí admin aj subadmin; úroveň mení len admin a admin je len jeden.

import { useEffect, useState } from "react";
import { api } from "../lib/api.ts";
import { Odkaz, useTitulok } from "../lib/router.tsx";
import { NAZOV_UROVNE, useUcet, type Pouzivatel, type Rola } from "../lib/ucet.tsx";
import { Avatar, Hlaska, Nacitavanie } from "../komponenty.tsx";

type Riadok = Pouzivatel & { readonly vytvoreny: number; readonly dohrate: number };

/** Úrovne, ktoré smie admin nastaviť (admina nikto ďalší nedostane). */
const NASTAVITELNE: readonly Rola[] = ["subadmin", "hrac", "navstevnik"];
const FILTRE: readonly (Rola | "ai")[] = ["admin", "subadmin", "hrac", "navstevnik", "ai"];

export function Hraci() {
  useTitulok("Hráči — správa");
  const { ja } = useUcet();
  const [zoznam, setZoznam] = useState<readonly Riadok[] | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);
  const [hladat, setHladat] = useState("");
  const [filter, setFilter] = useState<Rola | "ai" | null>(null);
  const somAdmin = ja?.rola === "admin";

  const nacitaj = () =>
    void api
      .get<{ pouzivatelia: Riadok[] }>("/admin/pouzivatelia")
      .then((r) => setZoznam(r.pouzivatelia))
      .catch((e: unknown) => setChyba(e instanceof Error ? e.message : String(e)));
  useEffect(nacitaj, []);

  const uprav = async (p: Riadok, zmena: { rola?: Rola; ai?: boolean }) => {
    try {
      await api.patch(`/admin/pouzivatelia/${p.id}`, zmena);
      nacitaj();
    } catch (e) {
      setChyba(e instanceof Error ? e.message : String(e));
    }
  };

  if (zoznam === null) return chyba !== null ? <Hlaska>{chyba}</Hlaska> : <Nacitavanie />;
  const f = hladat.trim().toLowerCase();
  const sedi = (p: Riadok, x: Rola | "ai" | null) => x === null || (x === "ai" ? p.ai === true : p.rola === x);
  const viditelni = zoznam.filter((p) => sedi(p, filter) && (f === "" || p.login.toLowerCase().includes(f) || p.meno.toLowerCase().includes(f)));
  const pocet = (x: Rola | "ai") => zoznam.filter((p) => sedi(p, x)).length;

  return (
    <div className="hraci-stranka">
      <header className="hraci-hlavicka">
        <h1>Hráči</h1>
        <p className="tlmene">
          Nový účet je návštevník (hrá a číta spätnú väzbu); po prvej dohratej partii (aj proti botovi) sa sám stane hráčom. Subadmin smie
          to isté čo admin okrem zmeny úrovní. Účty AI agentov (playtesteri, protihráč) majú značku AI — ich spätnú väzbu web predvolene
          skrýva. {somAdmin ? "Úroveň a značku AI meníš priamo v tabuľke." : "Úrovne mení len admin."}
        </p>
      </header>
      {chyba !== null && <Hlaska>{chyba}</Hlaska>}
      <div className="hraci-ovladanie">
        <input type="search" placeholder="Hľadať meno alebo login…" value={hladat} onChange={(e) => setHladat(e.target.value)} aria-label="Hľadať hráča" />
        <div className="cipy" role="group" aria-label="Filter podľa úrovne">
          <button className={filter === null ? "cip aktivny" : "cip"} aria-pressed={filter === null} onClick={() => setFilter(null)}>
            Všetci ({zoznam.length})
          </button>
          {FILTRE.filter((x) => pocet(x) > 0).map((x) => (
            <button key={x} className={filter === x ? "cip aktivny" : "cip"} aria-pressed={filter === x} onClick={() => setFilter(filter === x ? null : x)}>
              {x === "ai" ? "AI" : NAZOV_UROVNE[x]} ({pocet(x)})
            </button>
          ))}
        </div>
      </div>
      <div className="tabulka-obal">
        <table className="tabulka hraci-tabulka">
          <thead>
            <tr>
              <th>Hráč</th>
              <th>Registrácia</th>
              <th className="cislo">Dohraté</th>
              <th>Úroveň</th>
              <th>AI</th>
            </tr>
          </thead>
          <tbody>
            {viditelni.map((p) => (
              <tr key={p.id}>
                <td>
                  <Odkaz href={`/hrac/${p.id}`} className="hraci-meno">
                    <Avatar meno={p.meno} avatar={p.avatar} velkost={32} />
                    <span>
                      <strong>{p.meno}</strong>
                      <span className="tlmene">@{p.login}</span>
                    </span>
                  </Odkaz>
                </td>
                <td>{new Date(p.vytvoreny).toLocaleDateString("sk")}</td>
                <td className="cislo">{p.dohrate}</td>
                <td>
                  {somAdmin && p.rola !== "admin" ? (
                    <select value={p.rola} onChange={(e) => void uprav(p, { rola: e.target.value as Rola })} aria-label={`Úroveň ${p.meno}`}>
                      {NASTAVITELNE.map((r) => (
                        <option key={r} value={r}>
                          {NAZOV_UROVNE[r]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className={p.rola === "admin" || p.rola === "subadmin" ? "odznak odznak-admin" : "odznak"}>{NAZOV_UROVNE[p.rola]}</span>
                  )}
                </td>
                <td>
                  {somAdmin && p.rola !== "admin" ? (
                    <input type="checkbox" checked={p.ai === true} onChange={(e) => void uprav(p, { ai: e.target.checked })} aria-label={`${p.meno} je AI agent`} />
                  ) : (
                    p.ai === true && <span className="odznak odznak-ai">AI</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {viditelni.length === 0 && <p className="tlmene hraci-prazdne">Nikto nezodpovedá hľadaniu.</p>}
      </div>
    </div>
  );
}
