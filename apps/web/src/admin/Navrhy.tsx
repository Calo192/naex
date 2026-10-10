// Galéria návrhov (MAUI Drafts): náhľady, hľadanie, duplikovanie, mazanie.

import { useState } from "react";
import type { KartaNavrh } from "@naex/tvorba";
import { slug, variant, variantyKarty } from "@naex/tvorba";
import { KartaLico } from "../karta/KartaLico.tsx";
import { Odkaz, chod, useTitulok } from "../lib/router.tsx";
import { Hlaska } from "../komponenty.tsx";
import { useAdmin } from "./stav.tsx";

export function Navrhy() {
  useTitulok("Karty — tvorba");
  const { obsah, vzhlad, ulozKartu, zmazKartu } = useAdmin();
  const [hladat, setHladat] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);
  if (obsah === null || vzhlad === null) return null;

  const tagy = [...new Set(obsah.karty.flatMap((k) => k.tagy))].sort((a, b) => a.localeCompare(b, "sk"));
  const f = hladat.trim().toLocaleLowerCase("sk");
  const viditelne = obsah.karty.filter(
    (k) => (tag === null || k.tagy.includes(tag)) && (f === "" || k.nazov.toLocaleLowerCase("sk").includes(f) || k.efekt.toLocaleLowerCase("sk").includes(f)),
  );

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
      <div className="admin-hlava">
        <h1>Karty</h1>
        <Odkaz href="/admin/karty/nova" className="tlacidlo tlacidlo-hlavne">
          + Nová karta
        </Odkaz>
      </div>
      {chyba !== null && <Hlaska>{chyba}</Hlaska>}
      <div className="glosar-ovladanie" style={{ marginBottom: 20 }}>
        <input type="search" placeholder="Hľadať…" value={hladat} onChange={(e) => setHladat(e.target.value)} style={{ maxWidth: 260 }} />
        <div className="cipy">
          <button className={tag === null ? "cip aktivny" : "cip"} onClick={() => setTag(null)}>
            Všetky ({obsah.karty.length})
          </button>
          {tagy.map((t) => (
            <button key={t} className={tag === t ? "cip aktivny" : "cip"} onClick={() => setTag(t)}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="mriezka-kariet" style={{ gridTemplateColumns: "repeat(auto-fill, 190px)" }}>
        {viditelne.map((k) => {
          const vs = variantyKarty(k);
          const v = variant(vs, 0);
          return (
            <figure key={k.id} className="mriezka-polozka navrh">
              {v !== null ? (
                <KartaLico karta={k} lava={v.lava} prava={v.prava} vzhlad={vzhlad} sirka={190} onClick={() => chod(`/admin/karty/${k.id}`)} bezPopisov />
              ) : (
                <div className="navrh-chybny" onClick={() => chod(`/admin/karty/${k.id}`)}>
                  {k.nazov}
                  <span>chybné rozloženie</span>
                </div>
              )}
              <figcaption className="navrh-popis">
                <span>
                  {vs.pocet} {vs.pocet === 1 ? "variant" : "variantov"}
                  {k.kopie > 1 && ` × ${k.kopie}`}
                </span>
                <span className="navrh-akcie">
                  <button className="tlacidlo-male tlacidlo-jemne" onClick={() => void duplikuj(k)} title="Duplikovať">
                    ⧉
                  </button>
                  <button className="tlacidlo-male tlacidlo-jemne" onClick={() => void zmaz(k)} title="Zmazať">
                    🗑
                  </button>
                </span>
              </figcaption>
            </figure>
          );
        })}
      </div>
    </div>
  );
}
