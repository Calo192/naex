// Vývoj hry (/vyvoj, Michal 2026-10-21) — jedna stránka (dizajn 2026-10-26,
// návrh #20 B): súhrn známok, roadmapa na celú šírku okna, pás hotových a
// zásady s cieľmi; lepkavý pás nad nimi skáče na časti a ukazuje, kde čitateľ je.
// /vyvoj/roadmapa vedie na tú istú stránku na kotvu #roadmapa. Kto stránku
// vidí, určuje admin rankom (právo vidiet_vyvoj) a server to vynúti.
// Známky sú len priemery, nikdy jednotlivci.

import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { api, ChybaApi } from "../lib/api.ts";
import { chod, Odkaz, useTitulok } from "../lib/router.tsx";
import { maPravo, useUcet } from "../lib/ucet.tsx";
import { Hlaska, Nacitavanie } from "../komponenty.tsx";
import { HlavaStranky } from "../HlavaStranky.tsx";
import { GrafZnamok, MiniGraf, TabulkaVyvoja, cislo, hodnota, kratkyDen, terajsiaHodnota, type BodVyvoja, type Vyvoj } from "./GrafZnamok.tsx";
import { Roadmapa, type PoctyRoadmapy } from "./Roadmapa.tsx";
import "./vyvoj.css";

/** Zásady na ďalšie obdobie (návrh roadmapy, Michal 2026-10-21) — nadpis a jeden riadok (dizajn 2026-10-26). */
const ZASADY: readonly { readonly nazov: string; readonly text: string }[] = [
  { nazov: "Najprv čitateľnosť, potom čísla", text: "Každá mechanika musí mať svoju cenu na stole ešte pred rozhodnutím." },
  { nazov: "Zmraziť pravidlá a meniť ich po dávkach", text: "Zmenu najprv zmeria stratég, overí playtest a až potom sa rozhodne; v jednej téme jedna zmena naraz." },
  { nazov: "Ľudia pred formátom 2 na 2", text: "Najprv hodnotenia ľudí tými istými kritériami a porovnanie s AI playtestermi." },
  { nazov: "2 na 2 ako ďalší formát, nie náhrada", text: "Hlavná ostáva hra 1 na 1; čo sa z 2 na 2 neosvedčí, vypne sa prepínačom." },
  { nazov: "Nový obsah až po zmrazení", text: "Doladiť existujúce karty áno, nové karty a rozšírenia až nad stabilnými pravidlami." },
];

interface Ciel {
  readonly metrika: string;
  /** Kritérium známok, z ktorého sa „dnes“ počíta naživo („#ludia“ = počet ľudí); inak pevná hodnota. */
  readonly kriterium?: string;
  readonly dnes?: number;
  readonly jednotka?: string;
  readonly smer: "≥" | "≤" | "=";
  readonly ciel: number;
  /** Koniec stupnice odrážkového grafu. */
  readonly max: number;
  readonly horizont: string;
  readonly meria: string;
}

const CIELE: readonly Ciel[] = [
  { metrika: "Rovnováha a férovosť", kriterium: "rovnovaha", smer: "≥", ciel: 6.5, max: 10, horizont: "Teraz", meria: "známky na tejto stránke" },
  { metrika: "Zrozumiteľnosť pravidiel", kriterium: "zrozumitelnost", smer: "≥", ciel: 6.5, max: 10, horizont: "Teraz", meria: "známky na tejto stránke" },
  { metrika: "Víťaz poslednej bitky vyhrá partiu", dnes: 85, jednotka: " %", smer: "≤", ciel: 65, max: 100, horizont: "Teraz", meria: "stratég (turnaj botov)" },
  { metrika: "Lepší bot porazí slabšieho (rebrík)", dnes: 67, jednotka: " %", smer: "≥", ciel: 72, max: 100, horizont: "Teraz", meria: "stratég" },
  { metrika: "Predurčenosť partie rozdaním", dnes: 0.37, smer: "≤", ciel: 0.2, max: 1, horizont: "Teraz", meria: "stratég (duplikát)" },
  { metrika: "Dĺžka strednej partie", dnes: 83, jednotka: " min", smer: "≤", ciel: 60, max: 120, horizont: "Teraz", meria: "log partie" },
  { metrika: "Karty, ktoré nikto nezahrá", dnes: 3, smer: "=", ciel: 0, max: 10, horizont: "Ďalej", meria: "štatistiky kariet" },
  { metrika: "Ľudia s hodnotením hry", kriterium: "#ludia", smer: "≥", ciel: 10, max: 10, horizont: "Ďalej", meria: "známky na tejto stránke" },
];

/** Časti stránky v poradí — pás nad nimi ich ukazuje a skáče na ne. */
const SEKCIE = ["znamky", "roadmapa", "hotove", "zasady"] as const;
type Sekcia = (typeof SEKCIE)[number];

/** Najnovšia hodnota „dnes“ — spoločný priemer, a kým nie sú ľudia, priemer AI. */
function terajsia(body: readonly BodVyvoja[], kriterium: string): number | null {
  const b = body.at(-1);
  return b === undefined ? null : terajsiaHodnota(b, kriterium);
}

const formatCisla = (v: number): string => v.toLocaleString("sk-SK", { maximumFractionDigits: 2 });

/** Kde je čitateľ: posledná časť, ktorej začiatok je nad spodkom lepkavého pásu. */
function useAktivnaSekcia(pripravene: boolean): Sekcia {
  const [aktivna, setAktivna] = useState<Sekcia>("znamky");
  useEffect(() => {
    if (!pripravene) return;
    let raf = 0;
    const zmeraj = (): void => {
      raf = 0;
      const pas = document.querySelector(".sekcny-pas")?.getBoundingClientRect().bottom ?? 120;
      let kde: Sekcia = "znamky";
      for (const id of SEKCIE) {
        const el = document.getElementById(id);
        if (el !== null && el.getBoundingClientRect().top <= pas + 24) kde = id;
      }
      // Na konci stránky sa posledná časť nemusí dostať pod pás — vtedy je aktívna ona.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) kde = SEKCIE[SEKCIE.length - 1]!;
      setAktivna(kde);
    };
    const naScroll = (): void => {
      if (raf === 0) raf = requestAnimationFrame(zmeraj);
    };
    zmeraj();
    window.addEventListener("scroll", naScroll, { passive: true });
    window.addEventListener("resize", naScroll);
    return () => {
      window.removeEventListener("scroll", naScroll);
      window.removeEventListener("resize", naScroll);
      if (raf !== 0) cancelAnimationFrame(raf);
    };
  }, [pripravene]);
  return aktivna;
}

function skocNa(id: string): void {
  const el = document.getElementById(id);
  if (el === null) return;
  history.replaceState(null, "", `#${id}`);
  el.scrollIntoView({ block: "start" });
}

function KdeHraJe({ vyvoj }: { readonly vyvoj: Vyvoj }) {
  const [kriterium, setKriterium] = useState("celkom");
  const body = vyvoj.body;
  const posledny = body.at(-1);

  if (posledny === undefined) {
    return (
      <p className="panel tlmene">
        Hru zatiaľ nikto neohodnotil. Ohodnoť ju na stránke <Odkaz href="/spatna-vazba#hodnotenie">Spätná väzba</Odkaz>.
      </p>
    );
  }

  const ludi = posledny.ludia.celkom.n;
  const ai = posledny.ai.celkom.n;
  const zoradene = vyvoj.kriteria
    .map((k) => ({ ...k, v: terajsia(body, k.kluc) }))
    .filter((k): k is typeof k & { v: number } => k.v !== null)
    .sort((a, b) => b.v - a.v);
  const silne = zoradene.length >= 4 ? zoradene.slice(0, 2) : [];
  const slabe = zoradene.length >= 4 ? zoradene.slice(-2).reverse() : [];
  // Posun za posledný týždeň: porovnanie s posledným bodom starším ako 7 dní.
  const tyzden = [...body].reverse().find((b) => Date.parse(posledny.den) - Date.parse(b.den) >= 7 * 86_400_000);
  const terazCelkom = terajsia(body, "celkom");
  const predtymCelkom = tyzden === undefined ? null : terajsiaHodnota(tyzden, "celkom");
  const posun = terazCelkom !== null && predtymCelkom !== null ? terazCelkom - predtymCelkom : null;
  const lenAi = ludi < vyvoj.minLudi;
  const nazovKriteria = kriterium === "celkom" ? "priemer všetkých kritérií" : (vyvoj.kriteria.find((k) => k.kluc === kriterium)?.nazov ?? kriterium);
  const riadky = [{ kluc: "celkom", nazov: "Priemer všetkých kritérií", otazka: "Priemer známok všetkých 12 kritérií" }, ...vyvoj.kriteria];

  return (
    <>
      <div className="vyvoj-dlazdice">
        <div className="vyvoj-dlazdica">
          <span className="vyvoj-cap">Priemerná známka</span>
          <b className="vyvoj-velke">
            {terazCelkom === null ? "—" : cislo(terazCelkom)}
            {posun !== null && (
              <em className={posun >= 0 ? "hore" : "dole"}>
                {posun >= 0 ? "▲" : "▼"} {cislo(Math.abs(posun))} za týždeň
              </em>
            )}
          </b>
          <span className="vyvoj-pop">zo všetkých {vyvoj.kriteria.length} kritérií{lenAi ? " (AI playtesteri)" : ""}</span>
        </div>
        <div className="vyvoj-dlazdica">
          <span className="vyvoj-cap">Hodnotitelia</span>
          <dl className="vyvoj-dvojice">
            <dt>Ľudia</dt>
            <dd>{lenAi ? `${ludi} / ${vyvoj.minLudi}` : ludi}</dd>
            <dt>AI playtesteri</dt>
            <dd>{ai}</dd>
          </dl>
          {lenAi && <span className="vyvoj-pop">ľudia sa rátajú od {vyvoj.minLudi}</span>}
        </div>
        {silne.length > 0 && (
          <div className="vyvoj-dlazdica">
            <span className="vyvoj-cap silne">Najsilnejšie</span>
            <dl className="vyvoj-dvojice">
              {silne.map((k) => (
                <div key={k.kluc}>
                  <dt>{k.nazov}</dt>
                  <dd>{cislo(k.v)}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
        {slabe.length > 0 && (
          <div className="vyvoj-dlazdica">
            <span className="vyvoj-cap slabe">Najslabšie</span>
            <dl className="vyvoj-dvojice">
              {slabe.map((k) => (
                <div key={k.kluc}>
                  <dt>{k.nazov}</dt>
                  <dd>{cislo(k.v)}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>

      <div className="vyvoj-dvoj">
        <div className="vyvoj-graf">
          <h3>
            Známky v čase: <span>{nazovKriteria}</span>
          </h3>
          <GrafZnamok vyvoj={vyvoj} kriterium={kriterium} />
          <TabulkaVyvoja vyvoj={vyvoj} kriterium={kriterium} />
        </div>
        <div className="vyvoj-krit">
          <div className="vyvoj-krit-hlava" aria-hidden="true">
            <span>Kritérium</span>
            <span title={body[0] === undefined ? undefined : `${kratkyDen(body[0].den)}–${kratkyDen(posledny.den)}`}>v čase</span>
            <span className="cislo">Ľudia</span>
            <span className="cislo">AI</span>
            <span className="cislo">Spolu</span>
          </div>
          <ul aria-label={`Kritériá k ${kratkyDen(posledny.den)} — výber prekreslí graf`}>
            {riadky.map((k) => {
              const stitok = silne.some((s) => s.kluc === k.kluc) ? "silne" : slabe.some((s) => s.kluc === k.kluc) ? "slabe" : null;
              return (
                <li key={k.kluc}>
                  <button type="button" className={`vyvoj-krit-riadok ${k.kluc === "celkom" ? "celkom" : ""}`} aria-pressed={kriterium === k.kluc} title={k.otazka} onClick={() => setKriterium(k.kluc)}>
                    <span className="krit-nazov">
                      {k.nazov}
                      {stitok !== null && <small className={`krit-stitok ${stitok}`}>{stitok === "silne" ? "najsilnejšie" : "najslabšie"}</small>}
                    </span>
                    <MiniGraf body={body} kriterium={k.kluc} />
                    {(["ludia", "ai", "spolu"] as const).map((s) => {
                      const h = hodnota(posledny, s, k.kluc);
                      return (
                        <span key={s} className="cislo">
                          <span className="vyvoj-skryte">{s === "ludia" ? "ľudia " : s === "ai" ? "AI " : "spolu "}</span>
                          {h.priemer === null ? <span className="tlmene">—</span> : <span className="vyvoj-znamka" style={{ "--z": h.priemer } as CSSProperties}>{cislo(h.priemer)}</span>}
                        </span>
                      );
                    })}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </>
  );
}

function ZasadyACiele({ vyvoj }: { readonly vyvoj: Vyvoj | null }) {
  const dnes = (c: Ciel): number | null => {
    if (c.dnes !== undefined) return c.dnes;
    const posledny = vyvoj?.body.at(-1);
    if (posledny === undefined) return null;
    if (c.kriterium === "#ludia") return posledny.ludia.celkom.n;
    return terajsia(vyvoj?.body ?? [], c.kriterium ?? "celkom");
  };
  return (
    <div className="vyvoj-zasady-ciele">
      <ol className="vyvoj-zasady">
        {ZASADY.map((z) => (
          <li key={z.nazov}>
            <b>{z.nazov}</b>
            <span>{z.text}</span>
          </li>
        ))}
      </ol>
      <div className="vyvoj-ciele">
        <h3>Ciele: kedy je horizont splnený</h3>
        <ul>
          {CIELE.map((c) => {
            const v = dnes(c);
            const znamka = c.kriterium !== undefined && c.kriterium !== "#ludia";
            const text = (x: number): string => (znamka ? cislo(x) : formatCisla(x)) + (c.jednotka ?? "");
            const splnene = v !== null && (c.smer === "≥" ? v >= c.ciel : c.smer === "≤" ? v <= c.ciel : v === c.ciel);
            return (
              <li key={c.metrika} className="vyvoj-ciel">
                <span className="vyvoj-ciel-nazov">
                  {c.metrika}
                  <small>
                    {c.horizont} · {c.meria}
                  </small>
                </span>
                <span className="odrazkovy-graf" aria-hidden="true">
                  <i style={{ width: `${v === null ? 0 : Math.min(100, (v / c.max) * 100)}%` }} />
                  <u style={{ left: `${Math.min(100, (c.ciel / c.max) * 100)}%` }} />
                </span>
                <span className="vyvoj-ciel-hodnoty">
                  <b>{v === null ? "—" : text(v)}</b> → {c.smer === "=" ? "" : `${c.smer} `}
                  {text(c.ciel)}
                  {splnene && <span className="vyvoj-splnene"> ✓ splnené</span>}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="tlmene vyvoj-pozn">Hodnoty stratéga sú z turnajov botov k 21. 10. 2026; známky a počet ľudí sa počítajú naživo.</p>
      </div>
    </div>
  );
}

export function Vyvoj({ cesta }: { readonly cesta: string }) {
  useTitulok("Vývoj hry");
  const { ja } = useUcet();
  const [vyvoj, setVyvoj] = useState<Vyvoj | null>(null);
  const [chyba, setChyba] = useState<{ readonly text: string; readonly status: number } | null>(null);
  const [pocty, setPocty] = useState<PoctyRoadmapy | null>(null);
  const skocene = useRef(false);

  // Staré odkazy (/vyvoj/roadmapa, aj z Noviniek) vedú na kotvu tej istej stránky.
  useEffect(() => {
    if (cesta.startsWith("/vyvoj/roadmapa")) chod("/vyvoj#roadmapa", true);
    else if (cesta !== "/vyvoj") chod("/vyvoj", true);
  }, [cesta]);

  useEffect(() => {
    api
      .get<Vyvoj>("/znamky")
      .then(setVyvoj)
      .catch((e: unknown) => setChyba({ text: e instanceof Error ? e.message : String(e), status: e instanceof ChybaApi ? e.status : 0 }));
  }, []);

  // Skok na kotvu z adresy až keď je vykreslená roadmapa — inak by cieľ odplával.
  useEffect(() => {
    if (skocene.current || vyvoj === null || pocty === null) return;
    skocene.current = true;
    const id = location.hash.replace(/^#/, "");
    if (id !== "") requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "start" }));
  }, [vyvoj, pocty]);

  const aktivna = useAktivnaSekcia(vyvoj !== null);
  const naPocty = useCallback((p: PoctyRoadmapy) => setPocty(p), []);
  const zamknute = chyba !== null && (chyba.status === 401 || chyba.status === 403);
  const smieHodnotit = ja === null || maPravo(ja, "hodnotit_hru");
  const priemer = vyvoj === null ? null : terajsia(vyvoj.body, "celkom");

  const klik = (id: Sekcia) => (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    skocNa(id);
  };

  if (zamknute) {
    return (
      <div className="vyvoj-stranka">
        <HlavaStranky nadpis="Kam hra smeruje" />
        <div className="panel vyvoj-zamknute">
          {ja === null ? (
            <>
              <p>Stránku Vývoj vidia len prihlásení hráči.</p>
              <Odkaz href={`/prihlasenie?spat=${encodeURIComponent("/vyvoj")}`} className="tlacidlo tlacidlo-hlavne">
                Prihlásiť sa
              </Odkaz>
            </>
          ) : (
            <p>Stránku Vývoj tvoj rank zatiaľ nevidí. Čo sa v hre zmenilo, nájdeš v <Odkaz href="/novinky">Novinkách</Odkaz>.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="vyvoj-stranka">
      <HlavaStranky
        nadpis="Kam hra smeruje"
        uvod="NA EX! sa ešte ladí. Tu vidno, ako hru hodnotia hráči a AI playtesteri v čase, čo sa na nej robí, čo je hotové a podľa čoho sa rozhoduje."
      />

      <nav className="sekcny-pas" aria-label="Časti stránky Vývoj">
        <div className="sekcny-pas-odkazy">
          {(
            [
              ["znamky", "Známky", priemer === null ? null : cislo(priemer)],
              ["roadmapa", "Roadmapa", pocty === null ? null : String(pocty.aktivne)],
              ["hotove", "Hotové", pocty === null ? null : String(pocty.hotove)],
              ["zasady", "Zásady a ciele", null],
            ] as const
          ).map(([id, nazov, pocet]) => (
            <a key={id} href={`#${id}`} className={aktivna === id ? "aktivna" : undefined} aria-current={aktivna === id ? "location" : undefined} onClick={klik(id)}>
              {nazov}
              {pocet !== null && <span className="sekcny-pas-pocet">{pocet}</span>}
            </a>
          ))}
        </div>
        {smieHodnotit && (
          <Odkaz href="/spatna-vazba#hodnotenie" className="tlacidlo tlacidlo-hlavne sekcny-pas-akcia">
            Ohodnotiť hru
          </Odkaz>
        )}
      </nav>

      <section id="znamky" className="vyvoj-sekcia" aria-labelledby="znamky-nadpis">
        <div className="vyvoj-sekcia-hlava">
          <h2 id="znamky-nadpis">Kde hra je</h2>
          {vyvoj !== null && vyvoj.body.length > 0 && (
            <span className="tlmene">
              k {kratkyDen(vyvoj.body.at(-1)!.den)}
              {(vyvoj.body.at(-1)?.ludia.celkom.n ?? 0) < vyvoj.minLudi &&
                ` · zatiaľ len AI playtesteri — priemer ľudí ukážeme od ${vyvoj.minLudi} hodnotiteľov, inak by z neho bolo vidno známky konkrétneho hráča`}
            </span>
          )}
        </div>
        {chyba !== null ? <Hlaska>{chyba.text}</Hlaska> : vyvoj === null ? <Nacitavanie /> : <KdeHraJe vyvoj={vyvoj} />}
      </section>

      {chyba === null && <Roadmapa onPocty={naPocty} />}

      <section id="zasady" className="vyvoj-sekcia" aria-labelledby="zasady-nadpis">
        <div className="vyvoj-sekcia-hlava">
          <h2 id="zasady-nadpis">Zásady a ciele</h2>
          <span className="tlmene">podľa čoho sa rozhoduje a kedy je horizont splnený</span>
        </div>
        <ZasadyACiele vyvoj={vyvoj} />
      </section>
    </div>
  );
}
