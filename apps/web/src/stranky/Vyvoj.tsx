// Vývoj hry (/vyvoj, Michal 2026-10-21) — verejná stránka: kde hra je podľa
// známok hráčov a AI playtesterov v čase, kam sa má uberať (zásady a ciele)
// a roadmapa (/vyvoj/roadmapa). Známky sú len priemery, nikdy jednotlivci.

import { useEffect, useState, type CSSProperties } from "react";
import { api } from "../lib/api.ts";
import { Odkaz, useTitulok } from "../lib/router.tsx";
import { useUcet } from "../lib/ucet.tsx";
import { Hlaska, Nacitavanie } from "../komponenty.tsx";
import { GrafZnamok, TabulkaVyvoja, cislo, hodnota, kratkyDen, type BodVyvoja, type Seria, type Vyvoj } from "./GrafZnamok.tsx";
import { Roadmapa } from "./Roadmapa.tsx";
import "./vyvoj.css";

/** Zásady na ďalšie obdobie (návrh roadmapy, Michal 2026-10-21). */
const ZASADY: readonly { readonly nazov: string; readonly text: string }[] = [
  {
    nazov: "Najprv čitateľnosť, potom čísla",
    text: "Najhoršie problémy nevznikli zlou hodnotou, ale tým, že hráč nevidel, čo ho rozhodnutie stojí (kliatby pri sčítaní, cena bitky pri pase). Každá nová mechanika musí mať svoju cenu na stole ešte pred rozhodnutím.",
  },
  {
    nazov: "Zmraziť pravidlá a meniť ich po dávkach",
    text: "Po horizonte Teraz prídu Pravidlá v4. Potom zmena pravidiel len tak, že ju najprv zmeria stratég, overí playtest a až potom sa rozhodne. V jednej téme jedna zmena naraz, inak sa nedá povedať, čo zabralo.",
  },
  {
    nazov: "Ľudia pred formátom 2 na 2",
    text: "AI playtesteri sa môžu mýliť rovnakým smerom. Formát 2 na 2 zdvojnásobí, čo treba vyvažovať. Preto najprv hodnotenia ľudí tými istými kritériami a porovnanie s AI.",
  },
  {
    nazov: "2 na 2 ako ďalší formát, nie náhrada",
    text: "Hlavná ostáva hra 1 na 1. V jadre bude 1 na 1 osobitný prípad (dva tímy, každý s jedným miestom) a ak sa niečo z 2 na 2 neosvedčí, vypne sa prepínačom.",
  },
  {
    nazov: "Nový obsah až po zmrazení",
    text: "Kým sa pravidlá menia každý deň, každú novú kartu treba prerábať s nimi. Doladiť existujúce karty áno, nové karty a rozšírenia až nad stabilnými pravidlami.",
  },
];

interface Ciel {
  readonly metrika: string;
  /** Kritérium známok, z ktorého sa „dnes“ počíta naživo; inak pevná hodnota. */
  readonly kriterium?: string;
  readonly dnes?: string;
  readonly ciel: string;
  readonly horizont: string;
  readonly meria: string;
}

const CIELE: readonly Ciel[] = [
  { metrika: "Rovnováha a férovosť (priemerná známka)", kriterium: "rovnovaha", ciel: "≥ 6,5", horizont: "Teraz", meria: "známky na tejto stránke" },
  { metrika: "Zrozumiteľnosť pravidiel (priemerná známka)", kriterium: "zrozumitelnost", ciel: "≥ 6,5", horizont: "Teraz", meria: "známky na tejto stránke" },
  { metrika: "Víťaz poslednej bitky vyhrá partiu", dnes: "85 %", ciel: "≤ 65 %", horizont: "Teraz", meria: "stratég (turnaj botov)" },
  { metrika: "Lepší bot porazí slabšieho (rebrík)", dnes: "67 %", ciel: "≥ 72 %", horizont: "Teraz", meria: "stratég" },
  { metrika: "Predurčenosť partie rozdaním", dnes: "0,37", ciel: "≤ 0,20", horizont: "Teraz", meria: "stratég (duplikát)" },
  { metrika: "Dĺžka strednej partie", dnes: "83 min", ciel: "≤ 60 min", horizont: "Teraz", meria: "log partie" },
  { metrika: "Karty, ktoré nikto nezahrá", dnes: "3", ciel: "0", horizont: "Ďalej", meria: "štatistiky kariet" },
  { metrika: "Ľudia s hodnotením hry", kriterium: "#ludia", ciel: "≥ 10", horizont: "Ďalej", meria: "známky na tejto stránke" },
];

/** Najnovšia známa hodnota série (ľudia môžu byť skrytí pod minimom). */
function posledna(body: readonly BodVyvoja[], s: Seria, kriterium: string): number | null {
  const b = body.at(-1);
  return b === undefined ? null : hodnota(b, s, kriterium).priemer;
}

/** Spoločný priemer, a kým nie sú ľudia, priemer AI. */
function terajsia(body: readonly BodVyvoja[], kriterium: string): number | null {
  return posledna(body, "spolu", kriterium) ?? posledna(body, "ai", kriterium);
}

function KdeHraJe({ vyvoj }: { readonly vyvoj: Vyvoj }) {
  const [kriterium, setKriterium] = useState("celkom");
  const body = vyvoj.body;
  const posledny = body.at(-1);
  const ludi = posledny?.ludia.celkom.n ?? 0;
  const ai = posledny?.ai.celkom.n ?? 0;
  const zoradene = vyvoj.kriteria
    .map((k) => ({ ...k, v: terajsia(body, k.kluc) }))
    .filter((k): k is typeof k & { v: number } => k.v !== null)
    .sort((a, b) => b.v - a.v);
  // Posun za posledný týždeň: porovnanie s posledným bodom starším ako 7 dní.
  const tyzden = posledny === undefined ? undefined : [...body].reverse().find((b) => Date.parse(posledny.den) - Date.parse(b.den) >= 7 * 86_400_000);
  const terazCelkom = terajsia(body, "celkom");
  const predtymCelkom = tyzden === undefined ? null : (hodnota(tyzden, "spolu", "celkom").priemer ?? hodnota(tyzden, "ai", "celkom").priemer);

  if (posledny === undefined) {
    return (
      <p className="panel tlmene">
        Hru zatiaľ nikto neohodnotil. Ohodnoť ju na stránke <Odkaz href="/spatna-vazba#hodnotenie">Spätná väzba</Odkaz>.
      </p>
    );
  }

  return (
    <>
      <div className="vyvoj-dlazdice">
        <div className="vyvoj-dlazdica">
          <b>{terazCelkom === null ? "—" : cislo(terazCelkom)}</b>
          <span>
            priemerná známka zo všetkých kritérií
            {terazCelkom !== null && predtymCelkom !== null && (
              <em className={terazCelkom - predtymCelkom >= 0 ? "hore" : "dole"}>
                {" "}
                {terazCelkom - predtymCelkom >= 0 ? "▲" : "▼"} {cislo(Math.abs(terazCelkom - predtymCelkom))} za týždeň
              </em>
            )}
          </span>
        </div>
        <div className="vyvoj-dlazdica">
          <b>
            {ludi} · {ai}
          </b>
          <span>hodnotiteľov: ľudia · AI playtesteri</span>
        </div>
        {zoradene.length >= 4 && (
          <>
            <div className="vyvoj-dlazdica">
              <b className="silne">{zoradene.slice(0, 2).map((k) => cislo(k.v)).join(" · ")}</b>
              <span>najsilnejšie: {zoradene.slice(0, 2).map((k) => k.nazov).join(", ")}</span>
            </div>
            <div className="vyvoj-dlazdica">
              <b className="slabe">{zoradene.slice(-2).map((k) => cislo(k.v)).join(" · ")}</b>
              <span>najslabšie: {zoradene.slice(-2).map((k) => k.nazov).join(", ")}</span>
            </div>
          </>
        )}
      </div>
      {ludi < vyvoj.minLudi && (
        <p className="tlmene vyvoj-pozn">
          Priemer ľudí sa ukáže, keď hru ohodnotia aspoň {vyvoj.minLudi} ľudia (teraz {ludi}) — inak by z neho bolo vidno známky konkrétneho hráča. Dovtedy je
          „spolu“ priemer AI playtesterov.
        </p>
      )}

      <div className="vyvoj-graf-hlava">
        <h3>Známky v čase</h3>
        <label>
          <span className="tlmene">Kritérium</span>
          <select value={kriterium} onChange={(e) => setKriterium(e.target.value)}>
            <option value="celkom">Priemer všetkých kritérií</option>
            {vyvoj.kriteria.map((k) => (
              <option key={k.kluc} value={k.kluc}>
                {k.nazov}
              </option>
            ))}
          </select>
        </label>
      </div>
      <GrafZnamok vyvoj={vyvoj} kriterium={kriterium} />
      <TabulkaVyvoja vyvoj={vyvoj} kriterium={kriterium} />

      <h3>Kritériá k {kratkyDen(posledny.den)}</h3>
      <div className="tabulka-obal">
        <table className="vyvoj-tabulka vyvoj-kriteria">
          <thead>
            <tr>
              <th>Kritérium</th>
              <th className="cislo">Ľudia</th>
              <th className="cislo">AI</th>
              <th className="cislo">Spolu</th>
            </tr>
          </thead>
          <tbody>
            {vyvoj.kriteria.map((k) => (
              <tr key={k.kluc} className={kriterium === k.kluc ? "vybrane" : ""} onClick={() => setKriterium(k.kluc)}>
                <th scope="row" title={k.otazka}>
                  {k.nazov}
                </th>
                {(["ludia", "ai", "spolu"] as const).map((s) => {
                  const h = hodnota(posledny, s, k.kluc);
                  return (
                    <td key={s} className="cislo">
                      {h.priemer === null ? <span className="tlmene">—</span> : <span className="vyvoj-znamka" style={{ "--z": h.priemer } as CSSProperties}>{cislo(h.priemer)}</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function KamSaUbera({ vyvoj }: { readonly vyvoj: Vyvoj | null }) {
  const dnes = (c: Ciel): string => {
    if (c.dnes !== undefined) return c.dnes;
    const posledny = vyvoj?.body.at(-1);
    if (posledny === undefined) return "—";
    if (c.kriterium === "#ludia") return String(posledny.ludia.celkom.n);
    const v = terajsia(vyvoj?.body ?? [], c.kriterium ?? "celkom");
    return v === null ? "—" : cislo(v);
  };
  return (
    <>
      <ol className="vyvoj-zasady">
        {ZASADY.map((z) => (
          <li key={z.nazov}>
            <h3>{z.nazov}</h3>
            <p>{z.text}</p>
          </li>
        ))}
      </ol>
      <h3>Ciele: kedy je horizont splnený</h3>
      <div className="tabulka-obal">
        <table className="vyvoj-tabulka">
          <thead>
            <tr>
              <th>Metrika</th>
              <th className="cislo">Dnes</th>
              <th className="cislo">Cieľ</th>
              <th>Horizont</th>
              <th>Kto meria</th>
            </tr>
          </thead>
          <tbody>
            {CIELE.map((c) => (
              <tr key={c.metrika}>
                <td>{c.metrika}</td>
                <td className="cislo">{dnes(c)}</td>
                <td className="cislo">{c.ciel}</td>
                <td>{c.horizont}</td>
                <td className="tlmene">{c.meria}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="tlmene vyvoj-pozn">Hodnoty stratéga sú z turnajov botov k 21. 10. 2026; známky sa počítajú naživo.</p>
    </>
  );
}

export function Vyvoj({ cesta }: { readonly cesta: string }) {
  const roadmapa = cesta.startsWith("/vyvoj/roadmapa");
  useTitulok(roadmapa ? "Roadmapa" : "Vývoj hry");
  const { ja } = useUcet();
  const [vyvoj, setVyvoj] = useState<Vyvoj | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);

  useEffect(() => {
    if (roadmapa || vyvoj !== null) return;
    api
      .get<Vyvoj>("/znamky")
      .then(setVyvoj)
      .catch((e: unknown) => setChyba(e instanceof Error ? e.message : String(e)));
  }, [roadmapa, vyvoj]);

  return (
    <div className="vyvoj-stranka">
      <header className="stranka-hlava">
        <h1>Kam hra smeruje</h1>
        <p className="tlmene">
          NA EX! sa ešte ladí. Tu vidno, ako hru hodnotia hráči a AI playtesteri v čase, podľa čoho sa rozhoduje, čo ďalej, a čo je na rade.
          {ja !== null && (
            <>
              {" "}
              Svoje hodnotenie zadáš alebo zmeníš na stránke <Odkaz href="/spatna-vazba#hodnotenie">Spätná väzba</Odkaz>.
            </>
          )}
        </p>
        <nav className="cipy" aria-label="Vývoj hry">
          <Odkaz href="/vyvoj" className={`cip ${roadmapa ? "" : "aktivny"}`} aria-current={roadmapa ? undefined : "page"}>
            Kde hra je
          </Odkaz>
          <Odkaz href="/vyvoj/roadmapa" className={`cip ${roadmapa ? "aktivny" : ""}`} aria-current={roadmapa ? "page" : undefined}>
            Roadmapa
          </Odkaz>
        </nav>
      </header>

      {roadmapa ? (
        <Roadmapa />
      ) : (
        <>
          <section aria-labelledby="kde-hra-je">
            <h2 id="kde-hra-je">Kde hra je</h2>
            {chyba !== null ? <Hlaska>{chyba}</Hlaska> : vyvoj === null ? <Nacitavanie /> : <KdeHraJe vyvoj={vyvoj} />}
          </section>
          <section aria-labelledby="kam-sa-ubera">
            <h2 id="kam-sa-ubera">Kam sa má uberať</h2>
            <KamSaUbera vyvoj={vyvoj} />
            <p>
              <Odkaz href="/vyvoj/roadmapa" className="tlacidlo">
                Pozrieť roadmapu →
              </Odkaz>
            </p>
          </section>
        </>
      )}
    </div>
  );
}
