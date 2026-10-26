// Hodnotenie hry hráčom podľa tých istých 12 kritérií ako po playteste
// (Michal 2026-10-21). Hráč ho kedykoľvek zmení; server si každú zmenu
// zapamätá s časom, takže na stránke Vývoj vidno, kam sa hra uberá.
// Ostatní vidia len priemery, nikdy známky konkrétneho hráča.

import { useEffect, useState, type FormEvent } from "react";
import { api } from "../lib/api.ts";
import { Odkaz } from "../lib/router.tsx";
import { Hlaska } from "../komponenty.tsx";
import "./vyvoj.css";

export interface Kriterium {
  readonly kluc: string;
  readonly nazov: string;
  readonly otazka: string;
}

type Znamky = Readonly<Record<string, number>>;

const STUPNE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

/** Kotvy stupnice z kritérií playtestu (tools/playtest/kriteria.md). */
function slovne(z: number): string {
  return z <= 2 ? "zásadne nefunguje" : z <= 4 ? "slabé" : z <= 6 ? "priemerné" : z <= 8 ? "dobré" : "výnimočné";
}

const rovnake = (a: Znamky, b: Znamky): boolean => {
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k]);
};

const datum = (cas: number): string => new Date(cas).toLocaleDateString("sk-SK", { day: "numeric", month: "numeric", year: "numeric" });

export function HodnotenieHry({ smiePisat }: { readonly smiePisat: boolean }) {
  const [kriteria, setKriteria] = useState<readonly Kriterium[] | null>(null);
  const [ulozene, setUlozene] = useState<{ znamky: Znamky; cas: number | null }>({ znamky: {}, cas: null });
  const [znamky, setZnamky] = useState<Znamky>({});
  const [otvorene, setOtvorene] = useState(() => location.hash === "#hodnotenie");
  const [posiela, setPosiela] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [hotovo, setHotovo] = useState(false);

  useEffect(() => {
    // Kritériá z /znamky/moje — /znamky (Vývoj) rank hráča vidieť nemusí.
    api
      .get<{ znamky: Znamky | null; cas: number | null; kriteria: Kriterium[] }>("/znamky/moje")
      .then((m) => {
        setKriteria(m.kriteria);
        setUlozene({ znamky: m.znamky ?? {}, cas: m.cas });
        setZnamky(m.znamky ?? {});
      })
      .catch((e: unknown) => setChyba(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(() => {
    if (otvorene && location.hash === "#hodnotenie") document.getElementById("hodnotenie")?.scrollIntoView({ block: "start" });
  }, [otvorene, kriteria]);

  const odosli = (e: FormEvent) => {
    e.preventDefault();
    setPosiela(true);
    setChyba(null);
    api
      .put<{ cas: number }>("/znamky", { znamky })
      .then((r) => {
        setUlozene({ znamky, cas: r.cas });
        setHotovo(true);
      })
      .catch((err: unknown) => setChyba(err instanceof Error ? err.message : String(err)))
      .finally(() => setPosiela(false));
  };

  const pocet = Object.keys(ulozene.znamky).length;
  const priemer = pocet === 0 ? null : Object.values(ulozene.znamky).reduce((a, b) => a + b, 0) / pocet;
  const zmenene = !rovnake(znamky, ulozene.znamky);

  return (
    <section id="hodnotenie" className="panel hodnotenie-hry" aria-labelledby="hodnotenie-nadpis">
      <header className="hodnotenie-hlava">
        <div>
          <h2 id="hodnotenie-nadpis">Ohodnoť hru</h2>
          <p className="tlmene">
            Tých istých 12 kritérií, ktorými hru hodnotia AI playtesteri po každej partii. Hodnotenie môžeš kedykoľvek zmeniť — každá zmena sa
            zapíše s dátumom a ostatní vidia len priemer všetkých hráčov na stránke <Odkaz href="/vyvoj">Vývoj hry</Odkaz>.
          </p>
        </div>
        {smiePisat && (
          <button type="button" className={otvorene ? "tlacidlo-jemne" : "tlacidlo-hlavne"} onClick={() => setOtvorene(!otvorene)} aria-expanded={otvorene} aria-controls="hodnotenie-formular">
            {otvorene ? "Zbaliť" : pocet === 0 ? "Ohodnotiť" : "Zmeniť hodnotenie"}
          </button>
        )}
      </header>

      {!smiePisat ? (
        <p className="tlmene">Hodnotiť hru tvoj rank zatiaľ nesmie.</p>
      ) : (
        ulozene.cas !== null &&
        !otvorene && (
          <p className="hodnotenie-suhrn">
            {priemer === null ? (
              <>Hodnotenie si stiahol {datum(ulozene.cas)}.</>
            ) : (
              <>
                Tvoje hodnotenie z {datum(ulozene.cas)}: priemer <strong>{priemer.toLocaleString("sk-SK", { maximumFractionDigits: 1 })}</strong> z {pocet}{" "}
                {pocet === 1 ? "kritéria" : "kritérií"}.
              </>
            )}
          </p>
        )
      )}

      {chyba !== null && <Hlaska>{chyba}</Hlaska>}

      {smiePisat && otvorene && kriteria !== null && (
        <form id="hodnotenie-formular" onSubmit={odosli}>
          <p className="tlmene hodnotenie-stupnica">
            1–2 zásadne nefunguje · 3–4 slabé · 5–6 priemerné · 7–8 dobré · 9–10 výnimočné. Vyplň len kritériá, ku ktorým máš názor.
          </p>
          <ol className="hodnotenie-kriteria">
            {kriteria.map((k) => {
              const z = znamky[k.kluc];
              return (
                <li key={k.kluc}>
                  <fieldset>
                    <legend>
                      <span className="hodnotenie-nazov">{k.nazov}</span>
                      <span className="hodnotenie-otazka">{k.otazka}</span>
                    </legend>
                    <div className="hodnotenie-stupne">
                      {STUPNE.map((s) => (
                        <label key={s} className={z === s ? "vybrany" : ""} title={`${s} — ${slovne(s)}`}>
                          <input
                            type="radio"
                            name={`znamka-${k.kluc}`}
                            value={s}
                            checked={z === s}
                            onChange={() => {
                              setHotovo(false);
                              setZnamky({ ...znamky, [k.kluc]: s });
                            }}
                          />
                          <span>{s}</span>
                        </label>
                      ))}
                      <label className={`bez-nazoru ${z === undefined ? "vybrany" : ""}`}>
                        <input
                          type="radio"
                          name={`znamka-${k.kluc}`}
                          value=""
                          checked={z === undefined}
                          onChange={() => {
                            setHotovo(false);
                            setZnamky(Object.fromEntries(Object.entries(znamky).filter(([kk]) => kk !== k.kluc)));
                          }}
                        />
                        <span>bez názoru</span>
                      </label>
                    </div>
                  </fieldset>
                </li>
              );
            })}
          </ol>
          <div className="riadok-tlacidiel hodnotenie-spodok">
            <button type="submit" className="tlacidlo-hlavne" disabled={posiela || !zmenene}>
              {posiela ? "Ukladám…" : Object.keys(znamky).length === 0 && pocet > 0 ? "Stiahnuť hodnotenie" : "Uložiť hodnotenie"}
            </button>
            {hotovo && !zmenene && <span className="hlaska-ok-text">Uložené. Ďakujeme!</span>}
            {ulozene.cas !== null && <span className="tlmene">naposledy uložené {datum(ulozene.cas)}</span>}
          </div>
        </form>
      )}
    </section>
  );
}
