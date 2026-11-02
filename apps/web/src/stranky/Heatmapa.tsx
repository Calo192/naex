// Heatmapa akcií (/karty/heatmapa, Michal 2026-11-02): ako sú v zverejnenej sade
// obsadené pozície kariet — podľa tagu a akcie, aj ako ich vidí súper (karta
// otočená o 180°). Počíta heatmapaAkcii z @naex/tvorba; tu je len kreslenie.

import { useMemo, useState, type CSSProperties } from "react";
import type { AkciaDef, BunkaHeatmapy, Heatmapa as HeatmapaData, Pozicia, StranaHeatmapy } from "@naex/tvorba";
import { POZICIE, akcieNaKartach, heatmapaAkcii } from "@naex/tvorba";
import { useTitulok } from "../lib/router.tsx";
import { useSada } from "../lib/sada.tsx";
import { Hlaska, Nacitavanie } from "../komponenty.tsx";
import { HlavaStranky } from "../HlavaStranky.tsx";
import { IkonaAkcie } from "../karta/IkonaAkcie.tsx";
import { KartyZalozky } from "../dielna/Dielna.tsx";
import "./heatmapa.css";

/** Hlavné typy kariet idú prvé v poradí, v akom ich Michal menoval; ostatné tagy podľa počtu. */
const HLAVNE_TAGY = ["Občan", "Nástroj", "Starešina", "Zviera", "Lokalita", "Kliatba"];
const STRANY: readonly StranaHeatmapy[] = ["lava", "prava"];
const NAZOV_STRANY: Record<StranaHeatmapy, string> = { lava: "vľavo", prava: "vpravo" };

type Bunka = { readonly strana: StranaHeatmapy; readonly i: Pozicia };

const cislo = (x: number): string => x.toLocaleString("sk", { maximumFractionDigits: 1 });
const percent = (x: number): string => `${Math.round(x * 100)} %`;

/** Sýtosť bunky voči najobsadenejšej pozícii — pri zriedkavej akcii by absolútny podiel nebolo vidno. */
function styl(obsadene: number, maximum: number): CSSProperties {
  const sila = maximum > 0 ? obsadene / maximum : 0;
  return { "--sila": `${Math.round(8 + sila * 82)}%`, color: sila > 0.55 ? "var(--na-akcente)" : undefined } as CSSProperties;
}

function maximum(h: HeatmapaData): number {
  return Math.max(0, ...STRANY.flatMap((s) => h[s].map((b) => b.obsadene)));
}

function BunkaKarty({
  b,
  pocet,
  max,
  oznacena,
  oznac,
  pripni,
  popis,
}: {
  readonly b: BunkaHeatmapy;
  readonly pocet: number;
  readonly max: number;
  readonly oznacena: boolean;
  readonly oznac: () => void;
  readonly pripni: () => void;
  readonly popis: string;
}) {
  return (
    <button
      type="button"
      className={["hm-bunka", oznacena ? "oznacena" : "", b.blokovane > 0 ? "s-blokom" : ""].filter((x) => x !== "").join(" ")}
      style={styl(b.obsadene, max)}
      onMouseEnter={oznac}
      onFocus={oznac}
      onClick={pripni}
      aria-pressed={oznacena}
      aria-label={`${popis}: ${cislo(b.obsadene)} kariet, ${percent(pocet > 0 ? b.obsadene / pocet : 0)}${b.blokovane > 0 ? `, blokovaná na ${b.blokovane}` : ""}`}
    >
      <b>{cislo(b.obsadene)}</b>
      <span>{percent(pocet > 0 ? b.obsadene / pocet : 0)}</span>
      {b.blokovane > 0 && <small title="Na toľkých kartách je pozícia blokovaná">⊘ {b.blokovane}</small>}
    </button>
  );
}

function ZoznamKariet({ b, nadpis }: { readonly b: BunkaHeatmapy | null; readonly nadpis: string }) {
  if (b === null)
    return (
      <aside className="hm-zoznam" aria-live="polite">
        <p className="tlmene">Prejdi myšou ponad pozíciu (na telefóne ťukni) — ukáže sa, ktoré karty ju obsadzujú.</p>
      </aside>
    );
  const obsadzuju = b.karty.filter((k) => !k.blokovana);
  const blokovane = b.karty.filter((k) => k.blokovana);
  return (
    <aside className="hm-zoznam" aria-live="polite">
      <h3>{nadpis}</h3>
      {obsadzuju.length === 0 ? (
        <p className="tlmene">Túto pozíciu neobsadzuje žiadna karta.</p>
      ) : (
        <ul>
          {obsadzuju.map((k) => (
            <li key={k.id}>
              <span>{k.nazov}</span>
              <span className="tlmene" title="Podiel variantov karty, v ktorých je tu akcia">
                {k.podiel === 1 ? "vždy" : `${percent(k.podiel)} variantov`}
              </span>
            </li>
          ))}
        </ul>
      )}
      {blokovane.length > 0 && (
        <p className="hm-blokovane">
          <strong>Blokovaná ({blokovane.length}):</strong> {blokovane.map((k) => k.nazov).join(", ")}
        </p>
      )}
    </aside>
  );
}

function IkonaVolby({ akcia }: { readonly akcia: AkciaDef }) {
  return (
    <span className="hm-ikona">
      <IkonaAkcie kluc={akcia.kluc} akcia={akcia} />
    </span>
  );
}

export function Heatmapa() {
  useTitulok("Heatmapa akcií");
  const { sada, chyba } = useSada();
  const [tag, setTag] = useState<string | null>(null);
  const [akcia, setAkcia] = useState<string | null>(null);
  const [otocene, setOtocene] = useState(false);
  const [nadBunkou, setNadBunkou] = useState<Bunka | null>(null);
  const [pripnuta, setPripnuta] = useState<Bunka | null>(null);

  const karty = useMemo(() => (sada === null ? [] : sada.karty.filter((k) => tag === null || k.tagy.includes(tag))), [sada, tag]);
  const tagy = useMemo(() => {
    if (sada === null) return [];
    const pocty = new Map<string, number>();
    for (const k of sada.karty) for (const t of k.tagy) pocty.set(t, (pocty.get(t) ?? 0) + 1);
    const hlavne = HLAVNE_TAGY.filter((t) => pocty.has(t));
    const ostatne = [...pocty.keys()].filter((t) => !HLAVNE_TAGY.includes(t)).sort((a, b) => (pocty.get(b) ?? 0) - (pocty.get(a) ?? 0) || a.localeCompare(b, "sk"));
    return [...hlavne, ...ostatne].map((t) => ({ tag: t, pocet: pocty.get(t) ?? 0 }));
  }, [sada]);
  const naKartach = useMemo(() => akcieNaKartach(karty), [karty]);
  const h = useMemo(() => heatmapaAkcii(karty, { akcia, otocene }), [karty, akcia, otocene]);
  // Prehľad: každá akcia zvlášť, aby sa dali porovnať naraz (riadok = akcia).
  const prehlad = useMemo(
    () => (sada === null ? [] : sada.akcie.filter((a) => naKartach.has(a.kluc)).map((a) => ({ a, h: heatmapaAkcii(karty, { akcia: a.kluc, otocene }) }))),
    [sada, karty, naKartach, otocene],
  );

  const hlava = (
    <HlavaStranky
      nadpis="Karty"
      uvod="Heatmapa akcií — ktoré pozície na kartách sady obsadzujú akcie, podľa typu karty aj podľa akcie."
      zalozky={<KartyZalozky aktivna="heatmapa" />}
      viac={
        <p>
          Karta má 4 pozície vľavo a 4 vpravo, 0 je hore. Každá karta má váhu 1: ak má viac variantov (akcie na rôznych pozíciách), počíta sa priemer
          cez všetky jej varianty. Číslo v bunke je, koľko kariet v priemere pozíciu obsadzuje, a percento z vybraných kariet; ⊘ je počet kariet, ktoré
          ju majú blokovanú. Sýtosť farby je voči najobsadenejšej pozícii. Prepínač <em>ako na súperovej strane</em> ukáže kartu otočenú o 180° —
          strany sa vymenia a pozícia 0 je dole.
        </p>
      }
    />
  );
  if (chyba !== null || sada === null) return <div className="heatmapa">{hlava}{chyba !== null ? <Hlaska>{chyba}</Hlaska> : <Nacitavanie />}</div>;

  const akcieSady = new Map(sada.akcie.map((a) => [a.kluc, a]));
  const zvolena = akcia === null ? null : akcieSady.get(akcia);
  const ukazana = pripnuta ?? nadBunkou;
  const max = maximum(h);
  const popisBunky = (s: StranaHeatmapy, i: Pozicia): string => `${NAZOV_STRANY[s]} ${i}`;
  const prepniPripnutu = (b: Bunka): void => setPripnuta((p) => (p !== null && p.strana === b.strana && p.i === b.i ? null : b));
  const jeOznacena = (s: StranaHeatmapy, i: Pozicia): boolean => ukazana !== null && ukazana.strana === s && ukazana.i === i;

  return (
    <div className="heatmapa">
      {hlava}
      <div className="mriezka">
        <div className="hm-ovladanie">
          <div className="cipy" role="group" aria-label="Tag kariet">
            <button className={tag === null ? "cip aktivny" : "cip"} onClick={() => setTag(null)}>
              Všetky <span className="hm-pocet">{sada.karty.length}</span>
            </button>
            {tagy.map((t) => (
              <button key={t.tag} className={tag === t.tag ? "cip aktivny" : "cip"} onClick={() => setTag(t.tag)}>
                {t.tag} <span className="hm-pocet">{t.pocet}</span>
              </button>
            ))}
          </div>
          <div className="cipy hm-akcie" role="group" aria-label="Akcia">
            <button className={akcia === null ? "cip aktivny" : "cip"} onClick={() => setAkcia(null)}>
              Všetky akcie
            </button>
            {sada.akcie.map((a) => (
              <button
                key={a.kluc}
                className={["cip", "hm-akcia", akcia === a.kluc ? "aktivny" : "", naKartach.has(a.kluc) ? "" : "nevyskytuje"].filter((x) => x !== "").join(" ")}
                onClick={() => setAkcia(a.kluc)}
                title={naKartach.has(a.kluc) ? `${a.nazov}: na ${naKartach.get(a.kluc)} kartách` : `${a.nazov}: medzi vybranými kartami nie je`}
              >
                <IkonaVolby akcia={a} />
                {a.nazov}
              </button>
            ))}
          </div>
          <label className="hm-otocene">
            <input type="checkbox" checked={otocene} onChange={(e) => setOtocene(e.target.checked)} />
            ako na súperovej strane (otočené o 180°)
          </label>
        </div>

        <section className="hm-hlavna" aria-label="Heatmapa pozícií">
          <div className="hm-karta-obal">
            <p className="hm-suhrn">
              {h.pocetKariet} {h.pocetKariet === 1 ? "karta" : h.pocetKariet >= 2 && h.pocetKariet <= 4 ? "karty" : "kariet"}
              {" · "}
              {zvolena === null || zvolena === undefined ? (
                "ľubovoľná akcia"
              ) : (
                <span className="hm-zvolena">
                  <IkonaVolby akcia={zvolena} /> {zvolena.nazov}
                </span>
              )}
              {otocene && " · otočené"}
            </p>
            <div className="hm-karta" onMouseLeave={() => setNadBunkou(null)}>
              {STRANY.map((s) => (
                <div key={s} className={`hm-stlpec hm-${s}`}>
                  <span className="hm-nazov-strany">{NAZOV_STRANY[s]}</span>
                  {POZICIE.map((i) => (
                    <div key={i} className="hm-riadok">
                      <span className="hm-index" aria-hidden="true">
                        {i}
                      </span>
                      <BunkaKarty
                        b={h[s][i]}
                        pocet={h.pocetKariet}
                        max={max}
                        oznacena={jeOznacena(s, i)}
                        oznac={() => setNadBunkou({ strana: s, i })}
                        pripni={() => prepniPripnutu({ strana: s, i })}
                        popis={popisBunky(s, i)}
                      />
                    </div>
                  ))}
                </div>
              ))}
              <div className="hm-stred" aria-hidden="true">
                {zvolena !== null && zvolena !== undefined ? <IkonaVolby akcia={zvolena} /> : <span>{tag ?? "Všetky"}</span>}
              </div>
            </div>
          </div>
          <ZoznamKariet
            b={ukazana === null ? null : h[ukazana.strana][ukazana.i]}
            nadpis={ukazana === null ? "" : `${popisBunky(ukazana.strana, ukazana.i)} · ${zvolena?.nazov ?? "ľubovoľná akcia"}${pripnuta !== null ? " · pripnuté" : ""}`}
          />
        </section>

        <section className="hm-prehlad" aria-label="Prehľad všetkých akcií">
          <h2>Všetky akcie naraz</h2>
          <p className="tlmene">Riadok = akcia, sýtosť voči jej najobsadenejšej pozícii. Klik na riadok ju vyberie hore.</p>
          <div className="hm-tabulka-obal">
            <table className="hm-tabulka">
              <thead>
                <tr>
                  <th scope="col">Akcia</th>
                  {STRANY.flatMap((s) =>
                    POZICIE.map((i) => (
                      <th key={`${s}${i}`} scope="col" className={i === 0 ? `hm-zaciatok-${s}` : undefined}>
                        {s === "lava" ? "L" : "P"}
                        {i}
                      </th>
                    )),
                  )}
                  <th scope="col">kariet</th>
                </tr>
              </thead>
              <tbody>
                {prehlad.map(({ a, h: ha }) => {
                  const m = maximum(ha);
                  return (
                    <tr key={a.kluc} className={akcia === a.kluc ? "aktivny" : undefined} onClick={() => setAkcia(a.kluc)}>
                      <th scope="row">
                        <IkonaVolby akcia={a} /> {a.nazov}
                      </th>
                      {STRANY.flatMap((s) =>
                        POZICIE.map((i) => (
                          <td key={`${s}${i}`} className={["hm-td", i === 0 ? `hm-zaciatok-${s}` : ""].filter((x) => x !== "").join(" ")} style={styl(ha[s][i].obsadene, m)}>
                            {ha[s][i].obsadene > 0 ? cislo(ha[s][i].obsadene) : "·"}
                          </td>
                        )),
                      )}
                      <td className="hm-td-pocet">{naKartach.get(a.kluc) ?? 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
