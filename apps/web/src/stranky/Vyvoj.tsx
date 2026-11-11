// Vývoj hry (/vyvoj, Michal 2026-10-21) — jedna stránka (dizajn 2026-10-26,
// návrh #20 B): súhrn známok, roadmapa na celú šírku okna, pás hotových a
// zásady s cieľmi; lepkavý pás nad nimi skáče na časti a ukazuje, kde čitateľ je.
// /vyvoj/roadmapa vedie na tú istú stránku na kotvu #roadmapa. Kto stránku
// vidí, určuje admin rankom (právo vidiet_vyvoj) a server to vynúti.
// Známky sú len priemery, nikdy jednotlivci.

import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { api, ChybaApi, textChyby } from "../lib/api.ts";
import { chod, Odkaz, useTitulok } from "../lib/router.tsx";
import { maPravo, useUcet } from "../lib/ucet.tsx";
import { Hlaska, Nacitavanie } from "../komponenty.tsx";
import { HlavaStranky } from "../HlavaStranky.tsx";
import { kratkyDen } from "../lib/datum.ts";
import { GrafZnamok, MiniGraf, TabulkaVyvoja, cislo, hodnota, terajsiaHodnota, type BodVyvoja, type Vyvoj } from "./GrafZnamok.tsx";
import { Roadmapa, type PoctyRoadmapy } from "./Roadmapa.tsx";
import "./vyvoj.css";
import { aktualnyJazyk, t, tr, tZoServera } from "../i18n/jazyk.tsx";

/** Zásady na ďalšie obdobie (návrh roadmapy, Michal 2026-10-21) — nadpis a jeden riadok (dizajn 2026-10-26); texty vyvoj.zasada.N. */
const ZASADY: readonly { readonly nazov: string; readonly text: string }[] = [1, 2, 3, 4, 5].map((n) => ({
  get nazov() {
    return t(`vyvoj.zasada.${n}.nazov`);
  },
  get text() {
    return t(`vyvoj.zasada.${n}.text`);
  },
}));

interface Ciel {
  /** Kľúč textov cieľa (vyvoj.ciel.<id>). */
  readonly id: string;
  /** Kritérium známok, z ktorého sa „dnes“ počíta naživo („#ludia“ = počet ľudí); inak pevná hodnota. */
  readonly kriterium?: string;
  readonly dnes?: number;
  readonly jednotka?: string;
  readonly smer: "≥" | "≤" | "=";
  readonly ciel: number;
  /** Koniec stupnice odrážkového grafu. */
  readonly max: number;
  /** Horizont roadmapy (vyvoj.horizont.<…>) a čo hodnotu meria (vyvoj.meria.<…>). */
  readonly horizont: "teraz" | "dalej";
  readonly meria: "znamky" | "turnaj" | "strateg" | "duplikat" | "log" | "statistiky";
}

const CIELE: readonly Ciel[] = [
  { id: "rovnovaha", kriterium: "rovnovaha", smer: "≥", ciel: 6.5, max: 10, horizont: "teraz", meria: "znamky" },
  { id: "zrozumitelnost", kriterium: "zrozumitelnost", smer: "≥", ciel: 6.5, max: 10, horizont: "teraz", meria: "znamky" },
  { id: "poslednaBitka", dnes: 85, jednotka: " %", smer: "≤", ciel: 65, max: 100, horizont: "teraz", meria: "turnaj" },
  { id: "rebrik", dnes: 67, jednotka: " %", smer: "≥", ciel: 72, max: 100, horizont: "teraz", meria: "strateg" },
  { id: "predurcenost", dnes: 0.37, smer: "≤", ciel: 0.2, max: 1, horizont: "teraz", meria: "duplikat" },
  { id: "dlzka", dnes: 83, jednotka: " min", smer: "≤", ciel: 60, max: 120, horizont: "teraz", meria: "log" },
  { id: "nezahrate", dnes: 3, smer: "=", ciel: 0, max: 10, horizont: "dalej", meria: "statistiky" },
  { id: "ludia", kriterium: "#ludia", smer: "≥", ciel: 10, max: 10, horizont: "dalej", meria: "znamky" },
];

/** Názov a otázka kritéria známok zo servera v jazyku hráča (kriterium.<kľúč>.*). */
const nazovKriteria = (k: { readonly kluc: string; readonly nazov: string }): string => tZoServera(`kriterium.${k.kluc}.nazov`, k.nazov);
const otazkaKriteria = (k: { readonly kluc: string; readonly otazka: string }): string => tZoServera(`kriterium.${k.kluc}.otazka`, k.otazka);

/** Časti stránky v poradí — pás nad nimi ich ukazuje a skáče na ne. */
const SEKCIE = ["znamky", "roadmapa", "hotove", "zasady"] as const;
type Sekcia = (typeof SEKCIE)[number];

/** Najnovšia hodnota „dnes“ — spoločný priemer, a kým nie sú ľudia, priemer AI. */
function terajsia(body: readonly BodVyvoja[], kriterium: string): number | null {
  const b = body.at(-1);
  return b === undefined ? null : terajsiaHodnota(b, kriterium);
}

const formatCisla = (v: number): string => v.toLocaleString(aktualnyJazyk(), { maximumFractionDigits: 2 });

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
        {tr("vyvoj.nikto", { odkaz: <Odkaz href="/spatna-vazba#hodnotenie">{t("nav.spatnaVazba")}</Odkaz> })}
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
  const vybrane = vyvoj.kriteria.find((k) => k.kluc === kriterium);
  const nazovVybraneho = kriterium === "celkom" ? t("vyvoj.priemerVsetkychMale") : vybrane === undefined ? kriterium : nazovKriteria(vybrane);
  const riadky = [
    { kluc: "celkom", nazov: t("vyvoj.priemerVsetkych"), otazka: t("vyvoj.priemerOtazka", { n: vyvoj.kriteria.length }) },
    ...vyvoj.kriteria.map((k) => ({ ...k, nazov: nazovKriteria(k), otazka: otazkaKriteria(k) })),
  ];

  return (
    <>
      <div className="vyvoj-dlazdice">
        <div className="vyvoj-dlazdica">
          <span className="vyvoj-cap">{t("vyvoj.priemernaZnamka")}</span>
          <b className="vyvoj-velke">
            {terazCelkom === null ? "—" : cislo(terazCelkom)}
            {posun !== null && (
              <em className={posun >= 0 ? "hore" : "dole"}>
                {posun >= 0 ? "▲" : "▼"} {t("vyvoj.zaTyzden", { n: cislo(Math.abs(posun)) })}
              </em>
            )}
          </b>
          <span className="vyvoj-pop">
            {t("vyvoj.zoVsetkych", { n: vyvoj.kriteria.length })}
            {lenAi ? t("vyvoj.aiPlaytesteriZatvorka") : ""}
          </span>
        </div>
        <div className="vyvoj-dlazdica">
          <span className="vyvoj-cap">{t("vyvoj.hodnotitelia")}</span>
          <dl className="vyvoj-dvojice">
            <dt>{t("vyvoj.ludia")}</dt>
            <dd>{lenAi ? `${ludi} / ${vyvoj.minLudi}` : ludi}</dd>
            <dt>{t("vyvoj.aiPlaytesteri")}</dt>
            <dd>{ai}</dd>
          </dl>
          {lenAi && <span className="vyvoj-pop">{t("vyvoj.ludiaOd", { n: vyvoj.minLudi })}</span>}
        </div>
        {silne.length > 0 && (
          <div className="vyvoj-dlazdica">
            <span className="vyvoj-cap silne">{t("vyvoj.najsilnejsie")}</span>
            <dl className="vyvoj-dvojice">
              {silne.map((k) => (
                <div key={k.kluc}>
                  <dt>{nazovKriteria(k)}</dt>
                  <dd>{cislo(k.v)}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
        {slabe.length > 0 && (
          <div className="vyvoj-dlazdica">
            <span className="vyvoj-cap slabe">{t("vyvoj.najslabsie")}</span>
            <dl className="vyvoj-dvojice">
              {slabe.map((k) => (
                <div key={k.kluc}>
                  <dt>{nazovKriteria(k)}</dt>
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
            {t("vyvoj.znamkyVCase")} <span>{nazovVybraneho}</span>
          </h3>
          <GrafZnamok vyvoj={vyvoj} kriterium={kriterium} />
          <TabulkaVyvoja vyvoj={vyvoj} kriterium={kriterium} />
        </div>
        <div className="vyvoj-krit">
          <div className="vyvoj-krit-hlava" aria-hidden="true">
            <span>{t("vyvoj.kriterium")}</span>
            <span title={body[0] === undefined ? undefined : `${kratkyDen(body[0].den)}–${kratkyDen(posledny.den)}`}>{t("vyvoj.vCase")}</span>
            <span className="cislo">{t("vyvoj.ludia")}</span>
            <span className="cislo">{t("vyvoj.ai")}</span>
            <span className="cislo">{t("vyvoj.spolu")}</span>
          </div>
          <ul aria-label={t("vyvoj.kriteriaK", { den: kratkyDen(posledny.den) })}>
            {riadky.map((k) => {
              const stitok = silne.some((s) => s.kluc === k.kluc) ? "silne" : slabe.some((s) => s.kluc === k.kluc) ? "slabe" : null;
              return (
                <li key={k.kluc}>
                  <button type="button" className={`vyvoj-krit-riadok ${k.kluc === "celkom" ? "celkom" : ""}`} aria-pressed={kriterium === k.kluc} title={k.otazka} onClick={() => setKriterium(k.kluc)}>
                    <span className="krit-nazov">
                      {k.nazov}
                      {stitok !== null && <small className={`krit-stitok ${stitok}`}>{stitok === "silne" ? t("vyvoj.najsilnejsieMale") : t("vyvoj.najslabsieMale")}</small>}
                    </span>
                    <MiniGraf body={body} kriterium={k.kluc} />
                    {(["ludia", "ai", "spolu"] as const).map((s) => {
                      const h = hodnota(posledny, s, k.kluc);
                      return (
                        <span key={s} className="cislo">
                          <span className="vyvoj-skryte">{s === "ludia" ? t("vyvoj.skryteLudia") : s === "ai" ? t("vyvoj.skryteAi") : t("vyvoj.skryteSpolu")}</span>
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
        <h3>{t("vyvoj.cieleNadpis")}</h3>
        <ul>
          {CIELE.map((c) => {
            const v = dnes(c);
            const znamka = c.kriterium !== undefined && c.kriterium !== "#ludia";
            const text = (x: number): string => (znamka ? cislo(x) : formatCisla(x)) + (c.jednotka ?? "");
            const splnene = v !== null && (c.smer === "≥" ? v >= c.ciel : c.smer === "≤" ? v <= c.ciel : v === c.ciel);
            return (
              <li key={c.id} className="vyvoj-ciel">
                <span className="vyvoj-ciel-nazov">
                  {t(`vyvoj.ciel.${c.id}`)}
                  <small>
                    {t(`vyvoj.horizont.${c.horizont}`)} · {t(`vyvoj.meria.${c.meria}`)}
                  </small>
                </span>
                <span className="odrazkovy-graf" aria-hidden="true">
                  <i style={{ width: `${v === null ? 0 : Math.min(100, (v / c.max) * 100)}%` }} />
                  <u style={{ left: `${Math.min(100, (c.ciel / c.max) * 100)}%` }} />
                </span>
                <span className="vyvoj-ciel-hodnoty">
                  <b>{v === null ? "—" : text(v)}</b> → {c.smer === "=" ? "" : `${c.smer} `}
                  {text(c.ciel)}
                  {splnene && <span className="vyvoj-splnene">{t("vyvoj.splnene")}</span>}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="tlmene vyvoj-pozn">{t("vyvoj.hodnotyStratega")}</p>
      </div>
    </div>
  );
}

export function Vyvoj({ cesta }: { readonly cesta: string }) {
  useTitulok(t("vyvoj.titul"));
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
      .catch((e: unknown) => setChyba({ text: textChyby(e), status: e instanceof ChybaApi ? e.status : 0 }));
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
        <HlavaStranky nadpis={t("vyvoj.nadpis")} />
        <div className="panel vyvoj-zamknute">
          {ja === null ? (
            <>
              <p>{t("vyvoj.lenPrihlaseni")}</p>
              <Odkaz href={`/prihlasenie?spat=${encodeURIComponent("/vyvoj")}`} className="tlacidlo tlacidlo-hlavne">
                {t("vyvoj.prihlasitSa")}
              </Odkaz>
            </>
          ) : (
            <p>{tr("vyvoj.rankNevidi", { odkaz: <Odkaz href="/novinky">{t("vyvoj.novinkach")}</Odkaz> })}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="vyvoj-stranka">
      <HlavaStranky
        nadpis={t("vyvoj.nadpis")}
        uvod={t("vyvoj.uvod")}
      />

      <nav className="sekcny-pas" aria-label={t("vyvoj.casti")}>
        <div className="sekcny-pas-odkazy">
          {(
            [
              ["znamky", t("vyvoj.sekcia.znamky"), priemer === null ? null : cislo(priemer)],
              ["roadmapa", t("vyvoj.sekcia.roadmapa"), pocty === null ? null : String(pocty.aktivne)],
              ["hotove", t("vyvoj.sekcia.hotove"), pocty === null ? null : String(pocty.hotove)],
              ["zasady", t("vyvoj.sekcia.zasady"), null],
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
            {t("vyvoj.ohodnotit")}
          </Odkaz>
        )}
      </nav>

      <section id="znamky" className="vyvoj-sekcia" aria-labelledby="znamky-nadpis">
        <div className="vyvoj-sekcia-hlava">
          <h2 id="znamky-nadpis">{t("vyvoj.kdeHraJe")}</h2>
          {vyvoj !== null && vyvoj.body.length > 0 && (
            <span className="tlmene">
              {t("vyvoj.kDnu", { den: kratkyDen(vyvoj.body.at(-1)!.den) })}
              {(vyvoj.body.at(-1)?.ludia.celkom.n ?? 0) < vyvoj.minLudi && t("vyvoj.zatialLenAi", { n: vyvoj.minLudi })}
            </span>
          )}
        </div>
        {chyba !== null ? <Hlaska>{chyba.text}</Hlaska> : vyvoj === null ? <Nacitavanie /> : <KdeHraJe vyvoj={vyvoj} />}
      </section>

      {chyba === null && <Roadmapa onPocty={naPocty} />}

      <section id="zasady" className="vyvoj-sekcia" aria-labelledby="zasady-nadpis">
        <div className="vyvoj-sekcia-hlava">
          <h2 id="zasady-nadpis">{t("vyvoj.sekcia.zasady")}</h2>
          <span className="tlmene">{t("vyvoj.zasadyPopis")}</span>
        </div>
        <ZasadyACiele vyvoj={vyvoj} />
      </section>
    </div>
  );
}
