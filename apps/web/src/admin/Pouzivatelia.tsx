// Hráči a úrovne účtov (admin / subadmin / hráč / návštevník). Zoznam vidí
// admin aj subadmin; úroveň mení len admin a admin je len jeden.

import { useEffect, useState } from "react";
import { api } from "../lib/api.ts";
import { useTitulok } from "../lib/router.tsx";
import { NAZOV_UROVNE, useUcet, type Pouzivatel, type Rola } from "../lib/ucet.tsx";
import { Avatar, Hlaska, Nacitavanie } from "../komponenty.tsx";

type Riadok = Pouzivatel & { readonly vytvoreny: number; readonly dohrate: number };

/** Úrovne, ktoré smie admin nastaviť (admina nikto ďalší nedostane). */
const NASTAVITELNE: readonly Rola[] = ["subadmin", "hrac", "navstevnik"];

export function Pouzivatelia() {
  useTitulok("Hráči — správa");
  const { ja } = useUcet();
  const [zoznam, setZoznam] = useState<readonly Riadok[] | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);
  const [hladat, setHladat] = useState("");
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
  const viditelni = zoznam.filter((p) => f === "" || p.login.toLowerCase().includes(f) || p.meno.toLowerCase().includes(f));
  const pocet = (r: Rola) => zoznam.filter((p) => p.rola === r).length;

  return (
    <div className="admin-stranka">
      <h1>Hráči</h1>
      <p className="tlmene">
        {zoznam.length} účtov — {pocet("subadmin")} subadmin, {pocet("hrac")} hráčov, {pocet("navstevnik")} návštevníkov. Nový účet je
        návštevník (hrá a číta spätnú väzbu); po prvej dohratej partii (aj proti botovi) sa sám stane hráčom. Subadmin smie to isté čo admin
        okrem zmeny úrovní. Účty AI agentov (playtesteri, protihráč) sú hráči so značkou AI — ich spätnú väzbu web predvolene skrýva;
        nástroje playtestu ich zaradia samy. {somAdmin ? "Úroveň a značku AI meníš v posledných stĺpcoch." : "Úrovne mení len admin."}
      </p>
      {chyba !== null && <Hlaska>{chyba}</Hlaska>}
      <input type="search" placeholder="Hľadať…" value={hladat} onChange={(e) => setHladat(e.target.value)} style={{ maxWidth: 280, marginBottom: 14 }} />
      <table className="tabulka">
        <thead>
          <tr>
            <th>Hráč</th>
            <th>Prihlasovacie meno</th>
            <th>Registrácia</th>
            <th>Dohraté partie</th>
            <th>Úroveň</th>
            <th>AI</th>
          </tr>
        </thead>
        <tbody>
          {viditelni.map((p) => (
            <tr key={p.id}>
              <td>
                <span className="riadok-tlacidiel">
                  <Avatar meno={p.meno} avatar={p.avatar} velkost={30} /> {p.meno}
                </span>
              </td>
              <td>@{p.login}</td>
              <td>{new Date(p.vytvoreny).toLocaleDateString("sk")}</td>
              <td>{p.dohrate}</td>
              <td>
                {somAdmin && p.rola !== "admin" ? (
                  <select value={p.rola} onChange={(e) => void uprav(p, { rola: e.target.value as Rola })} style={{ maxWidth: 150 }} aria-label={`Úroveň ${p.meno}`}>
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
    </div>
  );
}
