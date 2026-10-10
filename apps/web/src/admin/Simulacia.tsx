// Simulácia (MAUI Simulation): poskladaj líniu z návrhov a sleduj, čo sa
// na spojoch aktivuje — počíta to herné jadro (evaluateLine), takže
// výsledok je presne taký ako v hre. Bez zverejnenia.

import { useMemo, useState } from "react";
import type { CardInstance, GameData } from "@naex/core";
import { evaluateLine, loadGameData } from "@naex/core";
import eldersJson from "@naex/core/data/elders.json";
import type { KartaNavrh } from "@naex/tvorba";
import { doCardsJson, neznameAkcie, variantyKarty } from "@naex/tvorba";
import { useTitulok } from "../lib/router.tsx";
import { Hlaska } from "../komponenty.tsx";
import { HernaKarta } from "../hra/HernaKarta.tsx";
import { useAdmin } from "./stav.tsx";

interface Slot {
  readonly id: string;
  readonly variant: number;
  readonly otocena: boolean;
}

export function Simulacia() {
  useTitulok("Simulácia — tvorba");
  const { obsah, vzhlad } = useAdmin();
  const [linia, setLinia] = useState<Slot[]>(() => {
    const k = obsah?.karty.filter((x) => !x.tagy.includes("Kliatba")) ?? [];
    return k.slice(0, 3).map((x) => ({ id: x.id, variant: 0, otocena: false }));
  });
  const [sirka, setSirka] = useState(190);

  // Herné dáta z rozpracovaných návrhov — karty s vlastnými akciami (bez pravidiel) vynecháme.
  const { data, vynechane } = useMemo((): { data: GameData | null; vynechane: KartaNavrh[] } => {
    if (obsah === null) return { data: null, vynechane: [] };
    const hratelne = obsah.karty.filter((k) => neznameAkcie(k).length === 0 && variantyKarty(k).pocet > 0);
    const vynechane = obsah.karty.filter((k) => !hratelne.includes(k));
    try {
      return { data: loadGameData(doCardsJson(hratelne, "simulácia"), eldersJson), vynechane };
    } catch {
      // Chýbajúci starší v návrhoch → simulácia starších nepotrebuje.
      return { data: loadGameData(doCardsJson(hratelne, "simulácia"), { elders: [] }), vynechane };
    }
  }, [obsah]);

  if (obsah === null || vzhlad === null || data === null) return null;
  const sada = { verzia: 0, cas: 0, karty: obsah.karty, cardsJson: null, ...vzhlad };
  const hratelne = obsah.karty.filter((k) => data.cards.has(k.id));

  const instancie: CardInstance[] = linia
    .filter((s) => data.cards.has(s.id))
    .map((s, i) => {
      const v = data.variants.get(s.id);
      const r = v?.right.length ?? 1;
      const n = Math.max(1, v?.total ?? 1);
      const idx = ((s.variant % n) + n) % n;
      return { uid: i + 1, defId: s.id, leftLayout: Math.floor(idx / r), rightLayout: idx % r };
    });
  // Otočenú kartu „zahral súper“ — tak ju jadro otočí.
  const ev = evaluateLine(data, {
    lokalita: null,
    lokalitaOtocena: false,
    // Partia hráča 0 vedie od lokality doľava — línia zľava doprava je jej obrátené poradie.
    partie: [instancie.map((c, i) => ({ card: c, playedBy: linia[i]?.otocena === true ? (1 as const) : (0 as const) })).reverse(), []],
  });
  const sumy = Object.entries(ev.sums[0]).filter(([, x]) => (x ?? 0) > 0);

  const zmen = (i: number, z: Partial<Slot>) => setLinia(linia.map((s, j) => (j === i ? { ...s, ...z } : s)));
  const posun = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= linia.length) return;
    const nova = [...linia];
    [nova[i], nova[j]] = [nova[j] as Slot, nova[i] as Slot];
    setLinia(nova);
  };

  return (
    <div className="admin-stranka">
      <div className="admin-hlava">
        <h1>Simulácia línie</h1>
        <label className="glosar-velkost">
          <span className="tlmene">Veľkosť</span>
          <input type="range" min={120} max={300} step={10} value={sirka} onChange={(e) => setSirka(Number(e.target.value))} />
        </label>
      </div>
      <p className="tlmene">
        Pravá strana každej karty sa páruje s ľavou stranou nasledujúcej. Otočená karta je položená nohami hore (do súperovej
        partie). Pracuje s rozpracovanými návrhmi — netreba zverejniť.
      </p>
      {vynechane.length > 0 && (
        <Hlaska druh="info">Bez simulácie (vlastná akcia bez pravidiel alebo chybné rozloženie): {vynechane.map((k) => k.nazov).join(", ")}.</Hlaska>
      )}

      <div className="simulacia-linia">
        {linia.map((s, i) => {
          const inst = instancie[i];
          return (
            <div key={i} className="simulacia-slot">
              <div className="simulacia-ovladanie">
                <select value={s.id} onChange={(e) => zmen(i, { id: e.target.value, variant: 0 })}>
                  {hratelne.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.nazov}
                    </option>
                  ))}
                </select>
                <div className="riadok-tlacidiel">
                  <button className="tlacidlo-male" onClick={() => zmen(i, { variant: s.variant - 1 })} aria-label="Predchádzajúci variant">
                    ‹
                  </button>
                  <span className="tlmene">{(((s.variant % (data.variants.get(s.id)?.total ?? 1)) + (data.variants.get(s.id)?.total ?? 1)) % (data.variants.get(s.id)?.total ?? 1)) + 1}/{data.variants.get(s.id)?.total ?? 1}</span>
                  <button className="tlacidlo-male" onClick={() => zmen(i, { variant: s.variant + 1 })} aria-label="Ďalší variant">
                    ›
                  </button>
                  <button className={s.otocena ? "tlacidlo-male tlacidlo-hlavne" : "tlacidlo-male"} onClick={() => zmen(i, { otocena: !s.otocena })} title="Otočiť o 180°">
                    ⟳
                  </button>
                </div>
                <div className="riadok-tlacidiel">
                  <button className="tlacidlo-male tlacidlo-jemne" onClick={() => posun(i, -1)} disabled={i === 0} aria-label="Posunúť doľava">
                    ←
                  </button>
                  <button className="tlacidlo-male tlacidlo-jemne" onClick={() => posun(i, 1)} disabled={i === linia.length - 1} aria-label="Posunúť doprava">
                    →
                  </button>
                  <button className="tlacidlo-male tlacidlo-jemne" onClick={() => setLinia(linia.filter((_, j) => j !== i))} aria-label="Odstrániť">
                    ✕
                  </button>
                </div>
              </div>
              {inst !== undefined && (
                <HernaKarta karta={inst} sada={sada} data={data} sirka={sirka} otocena={s.otocena} eval={ev.cards.get(inst.uid) ?? null} />
              )}
            </div>
          );
        })}
        <button className="simulacia-pridat" onClick={() => setLinia([...linia, { id: hratelne[0]?.id ?? "", variant: 0, otocena: false }])}>
          + karta
        </button>
      </div>

      <section className="panel" style={{ marginTop: 20 }}>
        <h3>Aktívne akcie v línii</h3>
        {sumy.length === 0 ? (
          <p className="tlmene">Nič sa neaktivovalo.</p>
        ) : (
          <div className="cipy">
            {sumy.map(([k, x]) => (
              <span key={k} className="cip aktivny">
                {vzhlad.akcie.find((a) => a.kluc === k)?.nazov ?? k} ×{x}
              </span>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
