// Hráči, ranky a práva — správa účtov, od 2026-10-21 mimo Tvorby (Michal:
// hráči v tvorbe kariet nemajú čo robiť). Ranky (Michal 2026-10-22): návštevník
// → Poldeci → Deci → Sedmička mení admin aj subadmin, subadmina len admin.

import { useEffect, useState } from "react";
import { api } from "../lib/api.ts";
import { Odkaz, useTitulok } from "../lib/router.tsx";
import { NAZOV_UROVNE, RANKY_HRACOV, useUcet, type Pouzivatel, type Rola } from "../lib/ucet.tsx";
import { Avatar, Hlaska, Nacitavanie } from "../komponenty.tsx";
import { RankyPrava } from "./RankyPrava.tsx";

type Riadok = Pouzivatel & { readonly vytvoreny: number; readonly dohrate: number; readonly rolaRucne?: boolean };

const FILTRE: readonly (Rola | "ai")[] = ["admin", "subadmin", "sedmicka", "deci", "hrac", "navstevnik", "ai"];
const jeRankHraca = (r: Rola): boolean => RANKY_HRACOV.includes(r);

export function Hraci() {
  useTitulok("Hráči — správa");
  const { ja } = useUcet();
  const [zoznam, setZoznam] = useState<readonly Riadok[] | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);
  const [hladat, setHladat] = useState("");
  const [filter, setFilter] = useState<Rola | "ai" | null>(null);
  const somAdmin = ja?.rola === "admin";
  // Rank nastaví admin každému okrem admina (aj subadmina), subadmin len hráčom a len medzi hráčskymi rankami.
  const nastavitelne: readonly Rola[] = somAdmin ? ["subadmin", ...[...RANKY_HRACOV].reverse()] : [...RANKY_HRACOV].reverse();
  const smiemMenit = (p: Riadok): boolean => p.rola !== "admin" && (somAdmin || jeRankHraca(p.rola));

  const nacitaj = () =>
    void api
      .get<{ pouzivatelia: Riadok[] }>("/admin/pouzivatelia")
      .then((r) => setZoznam(r.pouzivatelia))
      .catch((e: unknown) => setChyba(e instanceof Error ? e.message : String(e)));
  useEffect(nacitaj, []);

  const uprav = async (p: Riadok, zmena: { rola?: Rola; ai?: boolean; automaticky?: true }) => {
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
          Nový účet je Nealko; po výučbe alebo prvej dohratej partii (aj proti počítaču) je z neho Poldeci, potom Deci a Sedmička podľa hviezd
          achievementov (percentá v Ranky a práva). Rank nastavený ručne (značka „ručne“) automatika nemení, kým ho nevrátiš na automatický. Účty AI agentov majú značku AI
          — ich spätnú väzbu web predvolene skrýva. {somAdmin ? "Rank aj značku AI meníš v tabuľke." : "Hráčske ranky meníš v tabuľke; subadminov a značku AI mení len admin."}
        </p>
      </header>
      {chyba !== null && <Hlaska>{chyba}</Hlaska>}
      <RankyPrava poZmene={nacitaj} />
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
              <th>Rank</th>
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
                  {smiemMenit(p) ? (
                    <span className="hraci-rank">
                      <select value={p.rola} onChange={(e) => void uprav(p, { rola: e.target.value as Rola })} aria-label={`Rank ${p.meno}`}>
                        {nastavitelne.map((r) => (
                          <option key={r} value={r}>
                            {NAZOV_UROVNE[r]}
                          </option>
                        ))}
                      </select>
                      {p.rolaRucne === true && jeRankHraca(p.rola) && (
                        <>
                          <span className="odznak" title="Rank nastavil správca — automatický postup ho nemení.">ručne</span>
                          <button onClick={() => void uprav(p, { automaticky: true })} title="Prepočítať rank podľa pravidiel postupu">
                            automaticky
                          </button>
                        </>
                      )}
                    </span>
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
