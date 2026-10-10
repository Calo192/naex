// Používatelia a roly (admin / hráč).

import { useEffect, useState } from "react";
import { api } from "../lib/api.ts";
import { useTitulok } from "../lib/router.tsx";
import { useUcet, type Pouzivatel } from "../lib/ucet.tsx";
import { Avatar, Hlaska, Nacitavanie } from "../komponenty.tsx";

type Riadok = Pouzivatel & { readonly vytvoreny: number };

export function Pouzivatelia() {
  useTitulok("Používatelia — tvorba");
  const { ja } = useUcet();
  const [zoznam, setZoznam] = useState<readonly Riadok[] | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);
  const [hladat, setHladat] = useState("");

  const nacitaj = () =>
    void api
      .get<{ pouzivatelia: Riadok[] }>("/admin/pouzivatelia")
      .then((r) => setZoznam(r.pouzivatelia))
      .catch((e: unknown) => setChyba(e instanceof Error ? e.message : String(e)));
  useEffect(nacitaj, []);

  const nastavRolu = async (p: Riadok, rola: "admin" | "pouzivatel") => {
    try {
      await api.patch(`/admin/pouzivatelia/${p.id}`, { rola });
      nacitaj();
    } catch (e) {
      setChyba(e instanceof Error ? e.message : String(e));
    }
  };

  if (zoznam === null) return chyba !== null ? <Hlaska>{chyba}</Hlaska> : <Nacitavanie />;
  const f = hladat.trim().toLowerCase();
  const viditelni = zoznam.filter((p) => f === "" || p.login.toLowerCase().includes(f) || p.meno.toLowerCase().includes(f));

  return (
    <div className="admin-stranka">
      <h1>Používatelia</h1>
      <p className="tlmene">
        {zoznam.length} účtov. Admin vidí tvorbu kariet; hráč vidí pravidlá, karty a hrá. Účty z premennej NAEX_ADMINS dostanú
        rolu admin pri každom prihlásení.
      </p>
      {chyba !== null && <Hlaska>{chyba}</Hlaska>}
      <input type="search" placeholder="Hľadať…" value={hladat} onChange={(e) => setHladat(e.target.value)} style={{ maxWidth: 280, marginBottom: 14 }} />
      <table className="tabulka">
        <thead>
          <tr>
            <th>Hráč</th>
            <th>Prihlasovacie meno</th>
            <th>Registrácia</th>
            <th>Rola</th>
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
              <td>
                <select
                  value={p.rola}
                  disabled={p.id === ja?.id}
                  onChange={(e) => void nastavRolu(p, e.target.value === "admin" ? "admin" : "pouzivatel")}
                  style={{ maxWidth: 140 }}
                >
                  <option value="pouzivatel">hráč</option>
                  <option value="admin">admin</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
