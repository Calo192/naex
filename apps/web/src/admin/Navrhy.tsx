// Galéria návrhov (MAUI Drafts): náhľady, hľadanie, duplikovanie, mazanie.

import { useState } from "react";
import type { KartaNavrh } from "@naex/tvorba";
import { slug, variant, variantyKarty } from "@naex/tvorba";
import { KartaLico } from "../karta/KartaLico.tsx";
import { Odkaz, chod, useTitulok } from "../lib/router.tsx";
import { Hlaska } from "../komponenty.tsx";
import { problemyNavrhov, useAdmin, zmeneneOdZverejnenia } from "./stav.tsx";
import { AdminHlava, Ikona } from "./spolocne.tsx";

type Triedenie = "nazov" | "upravene";

/** Na telefóne menšie karty, aby sa zmestili dve vedľa seba. */
const sirkaKarty = (): number => (typeof window !== "undefined" && window.matchMedia?.("(max-width: 600px)").matches === true ? 160 : 190);

export function Navrhy() {
  useTitulok("Karty — tvorba");
  const { obsah, vzhlad, sady, ulozKartu, zmazKartu } = useAdmin();
  const [hladat, setHladat] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [triedenie, setTriedenie] = useState<Triedenie>("nazov");
  const [chyba, setChyba] = useState<string | null>(null);
  const [sirka] = useState(sirkaKarty);
  if (obsah === null || vzhlad === null) return null;

  const tagy = [...new Set(obsah.karty.flatMap((k) => k.tagy))].sort((a, b) => a.localeCompare(b, "sk"));
  const zmenene = new Set(zmeneneOdZverejnenia(obsah, sady).map((k) => k.id));
  const chybne = new Set(problemyNavrhov(obsah).map((p) => p.karta.id));
  const f = hladat.trim().toLocaleLowerCase("sk");
  const viditelne = obsah.karty
    .filter((k) => (tag === null || k.tagy.includes(tag)) && (f === "" || k.nazov.toLocaleLowerCase("sk").includes(f) || k.efekt.toLocaleLowerCase("sk").includes(f)))
    .sort((a, b) => (triedenie === "upravene" ? b.upravene - a.upravene : a.nazov.localeCompare(b.nazov, "sk")));

  const duplikuj = async (k: KartaNavrh) => {
    let id = `${slug(k.nazov)}_kopia`;
    while (obsah.karty.some((x) => x.id === id)) id += "_2";
    try {
      await ulozKartu({ ...k, id, nazov: `${k.nazov} (kópia)` });
      chod(`/admin/karty/${id}`);
    } catch (e) {
      setChyba(e instanceof Error ? e.message : String(e));
    }
  };

  const zmaz = async (k: KartaNavrh) => {
    if (!window.confirm(`Naozaj zmazať návrh „${k.nazov}“? V zverejnenej sade ostane do ďalšieho zverejnenia.`)) return;
    try {
      await zmazKartu(k.id);
    } catch (e) {
      setChyba(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="admin-stranka">
      <AdminHlava titul="Karty" popis="Návrhy kariet. Klikni na kartu a uprav ju v tvorcovi; hráči zmeny uvidia po zverejnení sady.">
        <Odkaz href="/admin/karty/nova" className="tlacidlo tlacidlo-hlavne">
          <Ikona nazov="plus" /> Nová karta
        </Odkaz>
      </AdminHlava>
      {chyba !== null && <Hlaska>{chyba}</Hlaska>}

      <div className="galeria-ovladanie">
        <div className="galeria-riadok">
          <label className="hladanie">
            <Ikona nazov="hladat" />
            <input type="search" placeholder="Hľadať v názve a efekte…" value={hladat} onChange={(e) => setHladat(e.target.value)} aria-label="Hľadať kartu" />
          </label>
          <label className="galeria-triedenie">
            Zoradiť
            <select value={triedenie} onChange={(e) => setTriedenie(e.target.value as Triedenie)}>
              <option value="nazov">podľa názvu</option>
              <option value="upravene">naposledy upravené</option>
            </select>
          </label>
          <span className="galeria-pocet" aria-live="polite">
            {viditelne.length === obsah.karty.length ? `${obsah.karty.length} kariet` : `${viditelne.length} z ${obsah.karty.length}`}
          </span>
        </div>
        <div className="cipy" role="group" aria-label="Filter podľa tagu">
          <button className={tag === null ? "cip aktivny" : "cip"} aria-pressed={tag === null} onClick={() => setTag(null)}>
            Všetky
          </button>
          {tagy.map((t) => (
            <button key={t} className={tag === t ? "cip aktivny" : "cip"} aria-pressed={tag === t} onClick={() => setTag(tag === t ? null : t)}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {viditelne.length === 0 ? (
        <div className="galeria-prazdna">
          <p>Žiadna karta nezodpovedá hľadaniu.</p>
          <button
            className="tlacidlo-jemne"
            onClick={() => {
              setHladat("");
              setTag(null);
            }}
          >
            Zrušiť filter
          </button>
        </div>
      ) : (
        <div className="galeria">
          {viditelne.map((k) => {
            const vs = variantyKarty(k);
            const v = variant(vs, 0);
            const href = `/admin/karty/${encodeURIComponent(k.id)}`;
            return (
              <figure key={k.id} className="galeria-polozka">
                <Odkaz href={href} className="galeria-karta" aria-label={`Upraviť ${k.nazov}`}>
                  {v !== null ? (
                    <KartaLico karta={k} lava={v.lava} prava={v.prava} vzhlad={vzhlad} sirka={sirka} bezPopisov />
                  ) : (
                    <div className="navrh-chybny" style={{ width: sirka }}>
                      {k.nazov}
                      <span>chybné rozloženie</span>
                    </div>
                  )}
                  {(chybne.has(k.id) || zmenene.has(k.id)) && (
                    <span className="galeria-stitky">
                      {chybne.has(k.id) && <span className="galeria-stitok zly">problém</span>}
                      {zmenene.has(k.id) && <span className="galeria-stitok">upravená</span>}
                    </span>
                  )}
                </Odkaz>
                <figcaption className="navrh-popis">
                  <span title="Permutácie strán × kópie každej">
                    {vs.pocet} {vs.pocet === 1 ? "variant" : vs.pocet <= 4 ? "varianty" : "variantov"}
                    {k.kopie > 1 && ` × ${k.kopie}`}
                  </span>
                  <span className="navrh-akcie">
                    <button className="tlacidlo-ikona" onClick={() => void duplikuj(k)} title="Duplikovať" aria-label={`Duplikovať ${k.nazov}`}>
                      <Ikona nazov="kopia" velkost={16} />
                    </button>
                    <button className="tlacidlo-ikona nebezpecne" onClick={() => void zmaz(k)} title="Zmazať" aria-label={`Zmazať ${k.nazov}`}>
                      <Ikona nazov="kos" velkost={16} />
                    </button>
                  </span>
                </figcaption>
              </figure>
            );
          })}
        </div>
      )}
    </div>
  );
}
