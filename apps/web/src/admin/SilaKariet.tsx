// Podklady pre rebalans: karty v odohraných partiách (archív) a hromadná
// simulácia sily kariet (tisíce náhodných línií vyhodnotených jadrom).

import { useEffect, useMemo, useState } from "react";
import type { GameData, StatKarty } from "@naex/core";
import { loadGameData } from "@naex/core";
import eldersJson from "@naex/core/data/elders.json";
import scorecardsJson from "@naex/core/data/scorecards.json";
import type { SilaKarty } from "@naex/tvorba";
import { doCardsJson, neznameAkcie, silaKariet, variantyKarty } from "@naex/tvorba";
import { api } from "../lib/api.ts";
import { Hlaska } from "../komponenty.tsx";
import { useAdmin } from "./stav.tsx";

const f1 = (x: number) => x.toLocaleString("sk", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const pct = (x: number) => `${Math.round(x * 100)} %`;

type Stlpec<T> = { readonly kluc: string; readonly nazov: string; readonly tip: string; readonly hodnota: (r: T) => number; readonly text: (r: T) => string };

function Tabulka<T extends { readonly defId: string }>({ riadky, stlpce, nazov }: { readonly riadky: readonly T[]; readonly stlpce: readonly Stlpec<T>[]; readonly nazov: (id: string) => string }) {
  const [podla, setPodla] = useState(stlpce[0]?.kluc ?? "");
  const [zostupne, setZostupne] = useState(true);
  const s = stlpce.find((x) => x.kluc === podla) ?? stlpce[0];
  const zoradene = s === undefined ? riadky : [...riadky].sort((a, b) => (zostupne ? s.hodnota(b) - s.hodnota(a) : s.hodnota(a) - s.hodnota(b)));
  return (
    <div className="tabulka-obal">
      <table className="tabulka">
        <thead>
          <tr>
            <th>Karta</th>
            {stlpce.map((c) => (
              <th key={c.kluc} title={c.tip} style={{ cursor: "pointer", whiteSpace: "nowrap" }} onClick={() => (c.kluc === podla ? setZostupne(!zostupne) : setPodla(c.kluc))}>
                {c.nazov}
                {c.kluc === podla ? (zostupne ? " ▼" : " ▲") : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {zoradene.map((r) => (
            <tr key={r.defId}>
              <th>{nazov(r.defId)}</th>
              {stlpce.map((c) => (
                <td key={c.kluc}>{c.text(r)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type RiadokPartii = StatKarty & { readonly defId: string };

export function KartyVPartiach() {
  const { obsah } = useAdmin();
  const [od, setOd] = useState("");
  const [vysledok, setVysledok] = useState<{ partie: number; karty: Record<string, StatKarty> } | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);
  useEffect(() => {
    setChyba(null);
    void api
      .get<{ partie: number; karty: Record<string, StatKarty> }>(`/admin/statistiky-kariet${od === "" ? "" : `?od=${od}`}`)
      .then(setVysledok)
      .catch((e: unknown) => setChyba(e instanceof Error ? e.message : String(e)));
  }, [od]);
  const nazov = (id: string) => obsah?.karty.find((k) => k.id === id)?.nazov ?? id;
  const riadky: RiadokPartii[] = Object.entries(vysledok?.karty ?? {}).map(([defId, s]) => ({ defId, ...s }));
  const naBitku = (r: RiadokPartii, x: number) => (r.bitky === 0 ? 0 : x / r.bitky);
  const stlpce: Stlpec<RiadokPartii>[] = [
    { kluc: "partie", nazov: "partie", tip: "V koľkých partiách sa karta objavila.", hodnota: (r) => r.partie, text: (r) => String(r.partie) },
    { kluc: "senok", nazov: "zo šenku", tip: "Koľkokrát si ju hráč vzal zo šenku.", hodnota: (r) => r.zoSenku, text: (r) => String(r.zoSenku) },
    { kluc: "vylozene", nazov: "vyložená", tip: "Na vlastnú stranu línie.", hodnota: (r) => r.vylozene, text: (r) => String(r.vylozene) },
    { kluc: "podstrcene", nazov: "podstrčená", tip: "Na súperovu stranu.", hodnota: (r) => r.podstrcene, text: (r) => String(r.podstrcene) },
    { kluc: "priznane", nazov: "priznaná", tip: "Priznaná kliatba alebo Nástroj do Dedičstva.", hodnota: (r) => r.priznane, text: (r) => String(r.priznane) },
    { kluc: "naex", nazov: "NA EX", tip: "Koľkokrát na nej ležal poldeci cez NA EX.", hodnota: (r) => r.naex, text: (r) => String(r.naex) },
    { kluc: "bitky", nazov: "v bitke", tip: "Ležala v línii pri vyhodnotení bitky.", hodnota: (r) => r.bitky, text: (r) => String(r.bitky) },
    { kluc: "vyhry", nazov: "výhry", tip: "Podiel bitiek, ktoré jej majiteľ vyhral.", hodnota: (r) => naBitku(r, r.vyhrateBitky), text: (r) => (r.bitky === 0 ? "—" : pct(naBitku(r, r.vyhrateBitky))) },
    { kluc: "aktivne", nazov: "⌀ aktívnych", tip: "Aktívne akcie na bitku (s násobkami).", hodnota: (r) => naBitku(r, r.aktivne), text: (r) => (r.bitky === 0 ? "—" : f1(naBitku(r, r.aktivne))) },
    { kluc: "tuhe", nazov: "⌀ tuhé", tip: "Tuhé poškodenie z jej aktívnych akcií na bitku.", hodnota: (r) => naBitku(r, r.tuhe), text: (r) => (r.bitky === 0 ? "—" : f1(naBitku(r, r.tuhe))) },
    { kluc: "zle", nazov: "⌀ kliatbové", tip: "Aktívne Hazard a Pečeň na bitku — škodia majiteľovi.", hodnota: (r) => naBitku(r, r.zle), text: (r) => (r.bitky === 0 ? "—" : f1(naBitku(r, r.zle))) },
  ];
  return (
    <>
      <h2>Karty v odohraných partiách</h2>
      <p className="tlmene">
        Zo všetkých dohratých partií na tomto webe (od zavedenia štatistík kariet). Jedna partia je jeden údaj — závery
        rob až z viacerých. Playtesty bežia na vlastnom serveri; ich partie spočíta <code>tools/admin/admin.ts karty-v-partiach --playtesty</code>.
      </p>
      <label className="pole-riadok">
        Od verzie sady{" "}
        <input type="number" min={1} value={od} placeholder="všetky" onChange={(e) => setOd(e.target.value)} style={{ width: "7em" }} />
      </label>
      {chyba !== null && <Hlaska>{chyba}</Hlaska>}
      {vysledok !== null && (
        <>
          <p className="tlmene">Partií so štatistikami kariet: {vysledok.partie}.</p>
          {riadky.length > 0 && <Tabulka riadky={riadky} stlpce={stlpce} nazov={nazov} />}
        </>
      )}
    </>
  );
}

export function SilaZoSimulacie() {
  const { obsah } = useAdmin();
  const [pokusov, setPokusov] = useState(5000);
  const [vysledok, setVysledok] = useState<readonly SilaKarty[] | null>(null);
  const [caka, setCaka] = useState(false);
  const data = useMemo((): GameData | null => {
    if (obsah === null) return null;
    const hratelne = obsah.karty.filter((k) => neznameAkcie(k).length === 0 && variantyKarty(k).pocet > 0);
    try {
      return loadGameData(doCardsJson(hratelne, "simulácia sily"), eldersJson, scorecardsJson);
    } catch {
      return loadGameData(doCardsJson(hratelne, "simulácia sily"), { elders: [] }, scorecardsJson);
    }
  }, [obsah]);
  const spusti = () => {
    if (data === null) return;
    setCaka(true);
    // Nech sa stihne prekresliť „počítam…“ pred dlhším výpočtom.
    setTimeout(() => {
      setVysledok(silaKariet(data, { pokusov, seed: 1 }));
      setCaka(false);
    }, 20);
  };
  const stlpce: Stlpec<SilaKarty>[] = [
    { kluc: "tuhe", nazov: "⌀ tuhé", tip: "Tuhé poškodenie z aktívnych akcií na výskyt v línii.", hodnota: (r) => r.tuhe, text: (r) => f1(r.tuhe) },
    { kluc: "aktivne", nazov: "⌀ aktívnych", tip: "Aktívne akcie na výskyt (s násobkami).", hodnota: (r) => r.aktivne, text: (r) => f1(r.aktivne) },
    { kluc: "aktivacia", nazov: "aktivácia", tip: "Podiel vytlačených akcií, ktoré sa spojili.", hodnota: (r) => r.aktivacia, text: (r) => pct(r.aktivacia) },
    { kluc: "zle", nazov: "⌀ kliatbové", tip: "Aktívne Hazard a Pečeň na výskyt.", hodnota: (r) => r.zle, text: (r) => f1(r.zle) },
    { kluc: "vyskytov", nazov: "výskytov", tip: "Koľkokrát karta ležala v simulovanej línii.", hodnota: (r) => r.vyskytov, text: (r) => String(r.vyskytov) },
  ];
  return (
    <>
      <h2>Sila kariet — hromadná simulácia</h2>
      <p className="tlmene">
        Náhodné línie z rozpracovaných návrhov (náhodná lokalita, 1–4 karty na strane, náhodné varianty) vyhodnotené
        jadrom hry. Meria len akcie a spoje — efekty kariet, NA EX a podstrkovanie do výpočtu nevstupujú. Lokality,
        kliatby a starší sa do línie nekladú.
      </p>
      <div className="riadok-tlacidiel">
        <label className="pole-riadok">
          Pokusov{" "}
          <input type="number" min={500} max={50000} step={500} value={pokusov} onChange={(e) => setPokusov(Math.max(500, Math.min(50000, Number(e.target.value) || 500)))} style={{ width: "7em" }} />
        </label>
        <button className="tlacidlo-hlavne" disabled={caka || data === null} onClick={spusti}>
          {caka ? "Počítam…" : "Spustiť simuláciu"}
        </button>
      </div>
      {vysledok !== null && <Tabulka riadky={vysledok} stlpce={stlpce} nazov={(id) => obsah?.karty.find((k) => k.id === id)?.nazov ?? id} />}
    </>
  );
}
