// Prehľad tvorcu: stav návrhov oproti zverejnenej sade a zverejnenie.

import { useEffect, useState } from "react";
import { chybyNavrhu, neznameAkcie, variantyKarty } from "@naex/tvorba";
import { api } from "../lib/api.ts";
import { Odkaz, useTitulok } from "../lib/router.tsx";
import { useSada } from "../lib/sada.tsx";
import { Hlaska } from "../komponenty.tsx";
import { useAdmin } from "./stav.tsx";

interface ZaznamSady {
  readonly verzia: number;
  readonly cas: number;
  readonly kariet: number;
}

export function Prehlad() {
  useTitulok("Tvorba kariet");
  const { obsah, zverejni } = useAdmin();
  const { obnov: obnovSadu } = useSada();
  const [sady, setSady] = useState<readonly ZaznamSady[]>([]);
  const [sprava, setSprava] = useState<{ druh: "ok" | "chyba"; text: string } | null>(null);
  const [caka, setCaka] = useState(false);

  const nacitajSady = () => void api.get<{ sady: ZaznamSady[] }>("/admin/sady").then((r) => setSady(r.sady));
  useEffect(nacitajSady, []);

  if (obsah === null) return null;
  const posledna = sady[0];
  const zmenene = posledna === undefined ? [] : obsah.karty.filter((k) => k.upravene > posledna.cas);
  const problemy = obsah.karty.flatMap((k) => [
    ...chybyNavrhu(k).map((c) => ({ k, c })),
    ...neznameAkcie(k).map((a) => ({ k, c: `akcia „${obsah.akcie.find((x) => x.kluc === a)?.nazov ?? a}“ nemá v hre pravidlá` })),
  ]);
  const vytlacenych = obsah.karty.reduce((s, k) => s + variantyKarty(k).pocet * k.kopie, 0);

  const zverejnit = async () => {
    setCaka(true);
    setSprava(null);
    try {
      const v = await zverejni();
      setSprava({ druh: "ok", text: `Zverejnená verzia ${v}. Nové hry, glosár a pravidlá už bežia na nej.` });
      obnovSadu();
      nacitajSady();
    } catch (e) {
      setSprava({ druh: "chyba", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setCaka(false);
    }
  };

  return (
    <div className="admin-stranka">
      <h1>Tvorba kariet</h1>
      <div className="dlazdice">
        <div className="dlazdica">
          <span>Návrhov kariet</span>
          <strong>{obsah.karty.length}</strong>
        </div>
        <div className="dlazdica">
          <span>Vytlačených kariet</span>
          <strong>{vytlacenych}</strong>
        </div>
        <div className="dlazdica">
          <span>Akcií</span>
          <strong>{obsah.akcie.length}</strong>
        </div>
        <div className="dlazdica">
          <span>Zverejnená verzia</span>
          <strong>v{obsah.zverejnenaVerzia}</strong>
        </div>
      </div>

      <section className="panel">
        <h2>Zverejnenie</h2>
        <p className="tlmene">
          Hráči vidia a hrajú <strong>zverejnenú</strong> sadu. Úpravy kariet sa prejavia až po zverejnení; rozohrané partie
          dohrajú na sade, s ktorou začali.
        </p>
        {zmenene.length > 0 ? (
          <Hlaska druh="info">
            Od posledného zverejnenia upravené: {zmenene.map((k) => k.nazov).join(", ")}.
          </Hlaska>
        ) : (
          <p className="tlmene">Žiadne zmeny od posledného zverejnenia.</p>
        )}
        {problemy.length > 0 && (
          <Hlaska>
            {`Pred zverejnením treba opraviť:\n${problemy.map((p) => `• ${p.k.nazov}: ${p.c}`).join("\n")}`}
          </Hlaska>
        )}
        {sprava !== null && <Hlaska druh={sprava.druh}>{sprava.text}</Hlaska>}
        <button className="tlacidlo-hlavne" onClick={() => void zverejnit()} disabled={caka || problemy.length > 0}>
          {caka ? "Zverejňujem…" : "Zverejniť sadu"}
        </button>
      </section>

      <section className="panel">
        <h2>História sád</h2>
        <table className="tabulka">
          <thead>
            <tr>
              <th>Verzia</th>
              <th>Zverejnená</th>
              <th>Kariet</th>
            </tr>
          </thead>
          <tbody>
            {sady.map((s) => (
              <tr key={s.verzia}>
                <td>v{s.verzia}</td>
                <td>{new Date(s.cas).toLocaleString("sk")}</td>
                <td>{s.kariet}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <h2>Rýchle odkazy</h2>
        <div className="riadok-tlacidiel">
          <Odkaz href="/admin/karty/nova" className="tlacidlo tlacidlo-hlavne">
            + Nová karta
          </Odkaz>
          <Odkaz href="/admin/tlac" className="tlacidlo">
            Tlačový súbor
          </Odkaz>
          <Odkaz href="/admin/statistiky" className="tlacidlo">
            Štatistiky
          </Odkaz>
          <Odkaz href="/karty" className="tlacidlo">
            Glosár (pohľad hráča)
          </Odkaz>
        </div>
      </section>
    </div>
  );
}
