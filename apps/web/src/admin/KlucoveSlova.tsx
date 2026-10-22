// Kľúčové slová (MAUI Keywords): ako sa formátuje text efektu na karte
// a čo sa hráčovi ukáže v tooltipe nad pojmom.

import { useMemo, useState } from "react";
import type { KlucoveSlovo } from "@naex/tvorba";
import { formatujEfekt } from "@naex/tvorba";
import { useTitulok } from "../lib/router.tsx";
import { Hlaska } from "../komponenty.tsx";
import { useAdmin } from "./stav.tsx";
import { AdminHlava } from "./spolocne.tsx";

export function KlucoveSlova() {
  useTitulok("Kľúčové slová — tvorba");
  const { obsah, ulozKlucoveSlova } = useAdmin();
  const [zoznam, setZoznam] = useState<KlucoveSlovo[]>(() => [...(obsah?.klucoveSlova ?? [])]);
  const [skuska, setSkuska] = useState("Bitka: Zahoď 1 kartu. Furt: Preskúmaj 5 kariet.");
  const [sprava, setSprava] = useState<{ druh: "ok" | "chyba"; text: string } | null>(null);
  const riadky = useMemo(() => formatujEfekt(skuska, zoznam), [skuska, zoznam]);

  const zmen = (i: number, z: Partial<KlucoveSlovo>) => setZoznam(zoznam.map((k, j) => (j === i ? { ...k, ...z } : k)));
  const uloz = async () => {
    try {
      await ulozKlucoveSlova(zoznam.filter((k) => k.slovo.trim() !== ""));
      setSprava({ druh: "ok", text: "Uložené. Na kartách sa prejaví hneď v tvorcovi, hráčom po zverejnení." });
    } catch (e) {
      setSprava({ druh: "chyba", text: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <div className="admin-stranka">
      <AdminHlava
        titul="Kľúčové slová"
        popis="Formátovanie textu efektov a vysvetlivky v tooltipe. Slovo sa porovnáva bez interpunkcie a bez ohľadu na veľké písmená; „Nový riadok“ zalomí text pred slovom (spúšťače)."
      >
        <button className="tlacidlo-hlavne" onClick={() => void uloz()}>
          Uložiť
        </button>
      </AdminHlava>
      {sprava !== null && <Hlaska druh={sprava.druh}>{sprava.text}</Hlaska>}

      <section className="panel">
        <h3>Skúška</h3>
        <textarea value={skuska} onChange={(e) => setSkuska(e.target.value)} rows={2} />
        <div className="skuska-vystup">
          {riadky.map((r, i) => (
            <div key={i}>
              {r.map((u, j) =>
                u.tucne || u.kurziva ? (
                  <span key={j} style={{ fontWeight: u.tucne ? 700 : 400, fontStyle: u.kurziva ? "italic" : "normal" }}>
                    {u.text}
                  </span>
                ) : (
                  <span key={j}>{u.text}</span>
                ),
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Šesť stĺpcov so vstupmi sa na telefóne posúva vo vlastnom kontajneri. */}
      <div className="tabulka-obal">
        <table className="tabulka slova-tabulka">
          <thead>
            <tr>
              <th>Slovo</th>
              <th>Tučné</th>
              <th>Kurzíva</th>
              <th>Nový riadok</th>
              <th>Ďalšie tvary (čiarkou)</th>
              <th>Popis pre hráča</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {zoznam.map((k, i) => (
              <tr key={i}>
                <td>
                  <input value={k.slovo} onChange={(e) => zmen(i, { slovo: e.target.value })} aria-label="Slovo" />
                </td>
                <td>
                  <input type="checkbox" checked={k.tucne} onChange={(e) => zmen(i, { tucne: e.target.checked })} aria-label="Tučné" />
                </td>
                <td>
                  <input type="checkbox" checked={k.kurziva} onChange={(e) => zmen(i, { kurziva: e.target.checked })} aria-label="Kurzíva" />
                </td>
                <td>
                  <input type="checkbox" checked={k.novyRiadok} onChange={(e) => zmen(i, { novyRiadok: e.target.checked })} aria-label="Nový riadok" />
                </td>
                <td>
                  <input
                    value={k.tvary.join(", ")}
                    onChange={(e) => zmen(i, { tvary: e.target.value.split(",").map((t) => t.trim()) })}
                    aria-label="Tvary"
                  />
                </td>
                <td>
                  <input value={k.popis} onChange={(e) => zmen(i, { popis: e.target.value })} aria-label="Popis" />
                </td>
                <td>
                  <button className="tlacidlo-male tlacidlo-jemne" onClick={() => setZoznam(zoznam.filter((_, j) => j !== i))} aria-label="Odstrániť">
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={() => setZoznam([...zoznam, { slovo: "", tucne: false, kurziva: true, novyRiadok: false, tvary: [], popis: "" }])}>
        + Pridať slovo
      </button>
    </div>
  );
}
