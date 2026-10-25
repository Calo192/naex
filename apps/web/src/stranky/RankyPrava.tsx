// Ranky a práva (Michal 2026-10-22): matica rank × právo a pravidlá postupu.
// Mení admin aj subadmin; správcovia majú vždy všetko (sivé stĺpce). Server
// každé právo overí sám — tu sa len nastavuje.

import { useEffect, useState } from "react";
import { api } from "../lib/api.ts";
import { NAZOV_UROVNE, RANKY_HRACOV, type Pravo, type Rola } from "../lib/ucet.tsx";
import { Hlaska } from "../komponenty.tsx";

interface NastaveniePrav {
  readonly matica: Readonly<Record<Pravo, readonly Rola[]>>;
  /** Percentá všetkých hviezd achievementov (Michal 2026-10-25). */
  readonly postup: { readonly deci: number; readonly sedmicka: number };
  readonly hviezdySpolu: number;
  /** Prahy v hviezdach pre uložené percentá; null, keď sú achievementy vypnuté. */
  readonly prahyHviezd: { readonly deci: number; readonly sedmicka: number } | null;
  readonly prava: readonly Pravo[];
  readonly popis: Readonly<Record<Pravo, string>>;
}

export function RankyPrava({ poZmene }: { readonly poZmene: () => void }) {
  const [n, setN] = useState<NastaveniePrav | null>(null);
  const [postup, setPostup] = useState({ deci: "", sedmicka: "" });
  const [chyba, setChyba] = useState<string | null>(null);
  const [ulozene, setUlozene] = useState(false);

  const nacitaj = () =>
    void api
      .get<NastaveniePrav>("/admin/prava")
      .then((r) => {
        setN(r);
        setPostup({ deci: String(r.postup.deci), sedmicka: String(r.postup.sedmicka) });
      })
      .catch((e: unknown) => setChyba(e instanceof Error ? e.message : String(e)));
  useEffect(nacitaj, []);

  const uloz = async (telo: object) => {
    setChyba(null);
    setUlozene(false);
    try {
      await api.put("/admin/prava", telo);
      setUlozene(true);
      nacitaj();
      poZmene();
    } catch (e) {
      setChyba(e instanceof Error ? e.message : String(e));
    }
  };

  if (n === null) return chyba !== null ? <Hlaska>{chyba}</Hlaska> : null;
  const prepni = (pravo: Pravo, rank: Rola, ma: boolean) => {
    const ranky = n.matica[pravo].filter((r) => r !== rank);
    void uloz({ matica: { [pravo]: ma ? [...ranky, rank] : ranky } });
  };

  return (
    <details className="ranky-prava">
      <summary>
        <strong>Ranky a práva</strong>{" "}
        <span className="tlmene">— čo smie ktorý rank a kedy sa naň postupuje</span>
      </summary>
      {chyba !== null && <Hlaska>{chyba}</Hlaska>}
      <p className="tlmene">
        Návštevník → Poldeci po výučbe (achievement Prvá hra) alebo prvej dohratej partii (aj proti počítaču) → Deci → Sedmička podľa
        hviezd achievementov, v percentách všetkých hviezd (zaokrúhlené nahor). Automatika rank len zvyšuje — Deci a Sedmička získané
        ešte za partie ostávajú. Rank nastavený ručne v tabuľke nižšie automatika nemení. Admin a subadmin smú vždy všetko.
      </p>
      <form
        className="ranky-postup"
        onSubmit={(e) => {
          e.preventDefault();
          void uloz({ postup: { deci: Number(postup.deci), sedmicka: Number(postup.sedmicka) } });
        }}
      >
        <label>
          Deci od <input type="number" min={1} max={99} value={postup.deci} onChange={(e) => setPostup({ ...postup, deci: e.target.value })} /> % hviezd
          {n.prahyHviezd !== null && <span className="tlmene"> = {n.prahyHviezd.deci} ★</span>}
        </label>
        <label>
          Sedmička od <input type="number" min={2} max={100} value={postup.sedmicka} onChange={(e) => setPostup({ ...postup, sedmicka: e.target.value })} /> % hviezd
          {n.prahyHviezd !== null && <span className="tlmene"> = {n.prahyHviezd.sedmicka} ★</span>}
        </label>
        <button type="submit">uložiť postup</button>
        {ulozene && <span className="tlmene">uložené</span>}
        <span className="tlmene">
          {n.prahyHviezd === null ? "Achievementy sú vypnuté — na Deci a Sedmičku sa nepostupuje." : `Hviezd v achievementoch je spolu ${n.hviezdySpolu}.`}
        </span>
      </form>
      <div className="tabulka-obal">
        <table className="tabulka ranky-matica">
          <thead>
            <tr>
              <th>Právo</th>
              {RANKY_HRACOV.map((r) => (
                <th key={r}>{NAZOV_UROVNE[r]}</th>
              ))}
              <th className="ranky-spravca">subadmin</th>
              <th className="ranky-spravca">admin</th>
            </tr>
          </thead>
          <tbody>
            {n.prava.map((p) => (
              <tr key={p}>
                <td>{n.popis[p]}</td>
                {RANKY_HRACOV.map((r) => {
                  const ma = n.matica[p].includes(r);
                  return (
                    <td key={r}>
                      <input type="checkbox" checked={ma} onChange={() => prepni(p, r, !ma)} aria-label={`${NAZOV_UROVNE[r]}: ${n.popis[p]}`} />
                    </td>
                  );
                })}
                <td className="ranky-spravca">
                  <input type="checkbox" checked disabled aria-label={`subadmin: ${n.popis[p]}`} />
                </td>
                <td className="ranky-spravca">
                  <input type="checkbox" checked disabled aria-label={`admin: ${n.popis[p]}`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
