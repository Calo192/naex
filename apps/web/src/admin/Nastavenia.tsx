// Globálne nastavenia (MAUI Global Settings): farby kategórií, rozloženie
// odtieňov a hromadné prepísanie rozmeru a mierok všetkých kariet.

import { useState } from "react";
import type { Kategoria, Nastavenia as NastaveniaT } from "@naex/tvorba";
import { pastelHex, rozlozOdtiene } from "@naex/tvorba";
import { useTitulok } from "../lib/router.tsx";
import { Hlaska, Pole } from "../komponenty.tsx";
import { useAdmin } from "./stav.tsx";
import { AdminHlava } from "./spolocne.tsx";

export function Nastavenia() {
  useTitulok("Nastavenia — tvorba");
  const { obsah, ulozKategorie, ulozNastavenia, ulozKartu, ulozBodovaciu } = useAdmin();
  const [kategorie, setKategorie] = useState<Kategoria[]>(() => {
    // Doplň kategórie pre tagy, ktoré ešte nemajú záznam (MAUI to robí pri otvorení).
    const z = [...(obsah?.kategorie ?? [])];
    for (const t of new Set(obsah?.karty.flatMap((k) => k.tagy) ?? [])) {
      if (!z.some((k) => k.nazov.toLocaleLowerCase("sk") === t.toLocaleLowerCase("sk"))) z.push({ nazov: t, odtien: 0, zapnuta: false });
    }
    return z;
  });
  const [n, setN] = useState<NastaveniaT>(() => obsah?.nastavenia ?? { sirkaMm: 54, vyskaMm: 80, mierkaTextu: 1.1, mierkaIkon: 1.3 });
  const [hromadne, setHromadne] = useState({ rozmer: false, text: false, ikony: false });
  const [sprava, setSprava] = useState<{ druh: "ok" | "chyba"; text: string } | null>(null);
  const [caka, setCaka] = useState(false);
  if (obsah === null) return null;

  const obal = async (f: () => Promise<void>, ok: string) => {
    setCaka(true);
    setSprava(null);
    try {
      await f();
      setSprava({ druh: "ok", text: ok });
    } catch (e) {
      setSprava({ druh: "chyba", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setCaka(false);
    }
  };

  const pouziNaVsetky = () =>
    obal(async () => {
      await ulozNastavenia(n);
      for (const k of obsah.karty) {
        await ulozKartu({
          ...k,
          ...(hromadne.rozmer ? { sirkaMm: n.sirkaMm, vyskaMm: n.vyskaMm } : {}),
          ...(hromadne.text ? { mierkaTextu: n.mierkaTextu } : {}),
          ...(hromadne.ikony ? { mierkaIkon: n.mierkaIkon } : {}),
        });
      }
      // Bodovacie karty musia sedieť s kartami, ktoré sa do nich vkladajú.
      if (hromadne.rozmer || hromadne.ikony) {
        for (const b of obsah.bodovacie) {
          await ulozBodovaciu({
            ...b,
            ...(hromadne.rozmer ? { sirkaMm: n.sirkaMm, vyskaMm: n.vyskaMm } : {}),
            ...(hromadne.ikony ? { mierkaIkon: n.mierkaIkon } : {}),
          });
        }
      }
    }, "Nastavenia sú uložené a použité na všetky karty.");

  const pouziteTagy = new Set(obsah.karty.flatMap((k) => k.tagy));

  return (
    <div className="admin-stranka">
      <AdminHlava titul="Farby a rozmery" popis="Farba karty podľa kategórie jej prvého tagu a predvolené rozmery a mierky nových kariet." />
      {sprava !== null && <Hlaska druh={sprava.druh}>{sprava.text}</Hlaska>}

      <section className="panel">
        <div className="admin-hlava">
          <h2>Farby kategórií</h2>
          <div className="riadok-tlacidiel">
            <button onClick={() => setKategorie(rozlozOdtiene(kategorie))} title="Rozloží odtiene zapnutých kategórií rovnomerne po kruhu">
              Rozložiť odtiene
            </button>
            <button className="tlacidlo-hlavne" disabled={caka} onClick={() => void obal(() => ulozKategorie(kategorie), "Farby kategórií sú uložené.")}>
              Uložiť farby
            </button>
          </div>
        </div>
        <p className="tlmene">
          Karta bez vlastnej farby preberá farbu <strong>prvého svojho tagu so zapnutou kategóriou</strong>. Vypnutá kategória
          (napr. Občan) farbu nedáva — použije sa ďalší tag.
        </p>
        <div className="kategorie">
          {kategorie.map((k, i) => (
            <div key={k.nazov} className={k.zapnuta ? "kategoria" : "kategoria vypnuta"}>
              <span className="farba-vzorka velka" style={{ background: k.zapnuta ? pastelHex(k.odtien) : "transparent" }} />
              <label className="kategoria-meno">
                <input
                  type="checkbox"
                  checked={k.zapnuta}
                  onChange={(e) => setKategorie(kategorie.map((x, j) => (j === i ? { ...x, zapnuta: e.target.checked } : x)))}
                />
                <strong>{k.nazov}</strong>
                {!pouziteTagy.has(k.nazov) && <span className="tlmene">(nepoužitý)</span>}
              </label>
              <input
                type="range"
                className="duha"
                min={0}
                max={359}
                value={k.odtien}
                disabled={!k.zapnuta}
                onChange={(e) => setKategorie(kategorie.map((x, j) => (j === i ? { ...x, odtien: Number(e.target.value) } : x)))}
                aria-label={`Odtieň ${k.nazov}`}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Rozmer a mierky</h2>
        <p className="tlmene">Predvolené hodnoty pre nové karty. Zaškrtnuté môžeš naraz prepísať na všetkých kartách.</p>
        <div className="mriezka-poli">
          <Pole label="Šírka (mm)">
            <input type="number" min={20} max={200} step={0.5} value={n.sirkaMm} onChange={(e) => setN({ ...n, sirkaMm: Number(e.target.value) })} />
          </Pole>
          <Pole label="Výška (mm)">
            <input type="number" min={20} max={300} step={0.5} value={n.vyskaMm} onChange={(e) => setN({ ...n, vyskaMm: Number(e.target.value) })} />
          </Pole>
          <Pole label={`Mierka textu ${n.mierkaTextu.toFixed(2)}×`}>
            <input type="range" min={0.6} max={1.8} step={0.02} value={n.mierkaTextu} onChange={(e) => setN({ ...n, mierkaTextu: Number(e.target.value) })} />
          </Pole>
          <Pole label={`Mierka ikon ${n.mierkaIkon.toFixed(2)}×`}>
            <input type="range" min={0.5} max={1.8} step={0.02} value={n.mierkaIkon} onChange={(e) => setN({ ...n, mierkaIkon: Number(e.target.value) })} />
          </Pole>
        </div>
        <div className="riadok-tlacidiel" style={{ marginBottom: 14 }}>
          <label>
            <input type="checkbox" checked={hromadne.rozmer} onChange={(e) => setHromadne({ ...hromadne, rozmer: e.target.checked })} /> rozmer
          </label>
          <label>
            <input type="checkbox" checked={hromadne.text} onChange={(e) => setHromadne({ ...hromadne, text: e.target.checked })} /> mierka textu
          </label>
          <label>
            <input type="checkbox" checked={hromadne.ikony} onChange={(e) => setHromadne({ ...hromadne, ikony: e.target.checked })} /> mierka ikon
          </label>
        </div>
        <div className="riadok-tlacidiel">
          <button disabled={caka} onClick={() => void obal(() => ulozNastavenia(n), "Predvolené hodnoty sú uložené.")}>
            Uložiť ako predvolené
          </button>
          <button
            className="tlacidlo-hlavne"
            disabled={caka || (!hromadne.rozmer && !hromadne.text && !hromadne.ikony)}
            onClick={() => window.confirm(`Prepísať vybrané hodnoty na všetkých ${obsah.karty.length} kartách?`) && void pouziNaVsetky()}
          >
            {caka ? "Ukladám…" : "Použiť na všetky karty"}
          </button>
        </div>
      </section>
    </div>
  );
}
