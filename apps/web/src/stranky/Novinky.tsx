// Novinky (Michal 2026-10-22): čo sa v hre a na webe zmenilo, napísané pre
// hráča. Verejné aj pre návštevníkov; píše ich správca (agent Admin), až keď
// je zmena na živom webe.
//
// Variant N-B (Michal 2026-10-27): hore box „Odkedy si tu nebol — pred ďalšou
// partiou vedz“ (Mení hru = pravidlá a karty, Ostatné zbalené), pod ním Hlásnik
// obce — vydania podľa dňa s kompaktnými riadkami, ktoré sa rozbaľujú. Čo je
// „nové“, sa uloží až po „Mám prečítané“, nie pri otvorení stránky (prihlásenému
// server, návštevníkovi bez účtu prehliadač).

import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { api } from "../lib/api.ts";
import { NOVINKY_VIDENE, citajVidene, ulozVidene } from "../lib/novinky.ts";
import { Odkaz, useTitulok } from "../lib/router.tsx";
import { Hlaska, Nacitavanie } from "../komponenty.tsx";
import { HlavaStranky } from "../HlavaStranky.tsx";
import { tvar } from "./Statistiky.tsx";
import "./novinky.css";

const KATEGORIE = { pravidla: "Pravidlá", karty: "Karty", dizajn: "Dizajn", web: "Web", opravy: "Opravy" } as const;
type Kategoria = keyof typeof KATEGORIE;

/** Čo mení hru — to musí hráč vedieť pred ďalšou partiou. */
const MENI_HRU: readonly Kategoria[] = ["pravidla", "karty"];
/** Koľko zmien z „Mení hru“ ukáže box, kým hráč neklikne „a N ďalších“. */
const PRVE = 3;

interface Novinka {
  readonly id: number;
  readonly datum: string;
  readonly kategoria: Kategoria;
  readonly nadpis: string;
  readonly text: string;
  readonly odkaz: string;
  readonly vydanie: string;
  readonly vytvorena: number;
}

const textOdkazu = (odkaz: string): string =>
  odkaz.startsWith("/pravidla") ? "V pravidlách"
  : odkaz.startsWith("/karty") ? "Pozrieť karty"
  : odkaz.startsWith("/vyvoj") ? "Vo Vývoji"
  : odkaz.startsWith("/profil") ? "V profile"
  : "Viac";

// Poludnie, aby deň neposunulo časové pásmo.
const denZDatumu = (datum: string): Date => new Date(`${datum}T12:00:00`);
const kratky = (d: Date): string => `${d.getDate()}. ${d.getMonth() + 1}.`;
const najnovsia = (n: readonly Novinka[]): number => Math.max(0, ...n.map((x) => x.vytvorena));

function KategoriaZnacka({ k }: { readonly k: Kategoria }) {
  return <span className={`novinka-kategoria kat-${k}`}>{KATEGORIE[k]}</span>;
}

export function Novinky() {
  useTitulok("Novinky");
  const [novinky, setNovinky] = useState<readonly Novinka[] | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);
  const [filter, setFilter] = useState<Kategoria | null>(null);
  // Od kedy sú novinky „nové“; null = návštevník bez účtu tu je prvýkrát.
  const [videne, setVidene] = useState<number | null>(null);
  const [naUcte, setNaUcte] = useState(false);
  const [otvorene, setOtvorene] = useState<ReadonlySet<number>>(() => new Set());
  const [vsetkyMeniHru, setVsetkyMeniHru] = useState(false);
  const [ukazOstatne, setUkazOstatne] = useState(false);
  const [posiela, setPosiela] = useState(false);
  const [oznam, setOznam] = useState("");

  useEffect(() => {
    api
      .get<{ novinky: Novinka[]; videne: number | null }>("/novinky")
      .then((r) => {
        setNovinky(r.novinky);
        if (r.videne !== null) {
          setNaUcte(true);
          setVidene(r.videne);
          return;
        }
        const v = citajVidene();
        setVidene(v);
        // Prvá návšteva bez účtu: niet od čoho rátať, inak by bolo všetko „nové“ — východisko sa uloží hneď.
        if (v === null && r.novinky.length > 0) ulozVidene(najnovsia(r.novinky));
      })
      .catch((e: unknown) => setChyba(e instanceof Error ? e.message : String(e)));
  }, []);

  // Odkaz zvonka (#novinka-12, napr. „hotovo · v Novinkách“ v Spätnej väzbe) novinku rozbalí.
  useEffect(() => {
    if (novinky === null) return;
    const m = /^#novinka-(\d+)$/.exec(location.hash);
    if (m === null) return;
    const id = Number(m[1]);
    setOtvorene((o) => new Set(o).add(id));
    requestAnimationFrame(() => document.getElementById(`novinka-${id}`)?.scrollIntoView({ block: "center" }));
  }, [novinky]);

  const nove = useMemo(() => (videne === null || novinky === null ? [] : novinky.filter((n) => n.vytvorena > videne)), [novinky, videne]);
  const meniHru = nove.filter((n) => MENI_HRU.includes(n.kategoria));
  const ostatne = nove.filter((n) => !MENI_HRU.includes(n.kategoria));

  const dni = useMemo(() => {
    const out: { datum: string; novinky: Novinka[] }[] = [];
    for (const n of novinky ?? []) {
      if (filter !== null && n.kategoria !== filter) continue;
      const posledny = out[out.length - 1];
      if (posledny?.datum === n.datum) posledny.novinky.push(n);
      else out.push({ datum: n.datum, novinky: [n] });
    }
    return out;
  }, [novinky, filter]);

  const pocet = (k: Kategoria): number => novinky?.filter((n) => n.kategoria === k).length ?? 0;

  const prepni = (id: number): void =>
    setOtvorene((o) => {
      const s = new Set(o);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });

  /** Z boxu na riadok v Hlásniku — rozbalí ho a ukáže, aj keby ho skrýval filter. */
  const chodNa = (id: number) => (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    setFilter(null);
    setOtvorene((o) => new Set(o).add(id));
    history.replaceState(null, "", `#novinka-${id}`);
    requestAnimationFrame(() => {
      const el = document.getElementById(`novinka-${id}`);
      el?.scrollIntoView({ block: "center" });
      el?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    });
  };

  const mamPrecitane = (): void => {
    if (novinky === null) return;
    const po = najnovsia(novinky);
    const hotovo = (): void => {
      setVidene(po);
      setVsetkyMeniHru(false);
      setUkazOstatne(false);
      setOznam("Novinky sú označené ako prečítané.");
      window.dispatchEvent(new Event(NOVINKY_VIDENE));
    };
    if (!naUcte) {
      ulozVidene(po);
      hotovo();
      return;
    }
    setPosiela(true);
    api
      .post("/novinky/videne", { po })
      .then(hotovo)
      .catch((e: unknown) => setChyba(e instanceof Error ? e.message : String(e)))
      .finally(() => setPosiela(false));
  };

  const polozkaBoxu = (n: Novinka) => (
    <li key={n.id}>
      <KategoriaZnacka k={n.kategoria} />
      <a href={`#novinka-${n.id}`} onClick={chodNa(n.id)}>
        {n.nadpis}
      </a>
      {n.odkaz !== "" && (
        <Odkaz href={n.odkaz} className="novinky-odkedy-ciel">
          → {textOdkazu(n.odkaz).toLocaleLowerCase("sk")}
        </Odkaz>
      )}
    </li>
  );

  const nicSaNezmenilo = (
    <div className="novinky-odkedy-nic">
      <p>Od tvojej poslednej návštevy sa v pravidlách ani kartách nič nezmenilo. Môžeš rovno hrať.</p>
      <Odkaz href="/hra" className="tlacidlo tlacidlo-hlavne">
        Hrať
      </Odkaz>
    </div>
  );

  return (
    <div className="novinky">
      <HlavaStranky
        nadpis="Novinky"
        uvod="Čo sa v hre a na webe zmenilo — pravidlá, karty, vzhľad aj opravy. Najnovšie hore."
        akcia={<Odkaz href="/vyvoj#roadmapa">Kam hra smeruje → Roadmapa</Odkaz>}
      />
      <p className="len-citacka" aria-live="polite">
        {oznam}
      </p>

      {chyba !== null && <Hlaska>{chyba}</Hlaska>}

      {novinky === null ? (
        chyba === null && <Nacitavanie />
      ) : novinky.length === 0 ? (
        <p className="tlmene">Zatiaľ tu nič nie je. Prvé novinky pribudnú s najbližšou zmenou hry.</p>
      ) : (
        <div className="mriezka">
          <div className="st-obsah novinky-obsah">
            {videne !== null && (
              <section className="panel novinky-odkedy" aria-labelledby="novinky-odkedy-nadpis">
                <h2 id="novinky-odkedy-nadpis">Odkedy si tu nebol ({kratky(new Date(videne))}) — pred ďalšou partiou vedz:</h2>
                {nove.length === 0 ? (
                  nicSaNezmenilo
                ) : (
                  <>
                    <div className="novinky-odkedy-stlpce">
                      <div className="novinky-odkedy-meni">
                        <h3>Mení hru · {meniHru.length}</h3>
                        {meniHru.length === 0 ? (
                          nicSaNezmenilo
                        ) : (
                          <ul>{(vsetkyMeniHru ? meniHru : meniHru.slice(0, PRVE)).map(polozkaBoxu)}</ul>
                        )}
                        {meniHru.length > PRVE && (
                          <button type="button" className="tlacidlo-jemne tlacidlo-male" aria-expanded={vsetkyMeniHru} onClick={() => setVsetkyMeniHru(!vsetkyMeniHru)}>
                            {vsetkyMeniHru ? "Menej ▴" : `a ${meniHru.length - PRVE} ${tvar(meniHru.length - PRVE, "ďalšia", "ďalšie", "ďalších")} ▸`}
                          </button>
                        )}
                      </div>
                      <div className="novinky-odkedy-ostatne">
                        <h3>Ostatné · {ostatne.length}</h3>
                        <p className="tlmene">vzhľad, web, opravy</p>
                        {ostatne.length > 0 && (
                          <button
                            type="button"
                            className="tlacidlo-jemne tlacidlo-male"
                            aria-expanded={ukazOstatne}
                            aria-controls="novinky-odkedy-ostatne"
                            onClick={() => setUkazOstatne(!ukazOstatne)}
                          >
                            {ukazOstatne ? "Skryť ▴" : "Ukázať ▸"}
                          </button>
                        )}
                        {ukazOstatne && <ul id="novinky-odkedy-ostatne">{ostatne.map(polozkaBoxu)}</ul>}
                      </div>
                    </div>
                    <div className="novinky-odkedy-spodok">
                      <button type="button" className="tlacidlo-hlavne" onClick={mamPrecitane} disabled={posiela}>
                        Mám prečítané
                      </button>
                      <span className="tlmene">Kým neklikneš, zmeny ostanú označené ako nové.</span>
                    </div>
                  </>
                )}
              </section>
            )}

            <div className="hlasnik">
              <div className="hlasnik-hlavicka" aria-hidden="true">
                <span className="hlasnik-titul">Hlásnik obce</span>
                <span className="hlasnik-podtitul">čo sa v krčme zmenilo</span>
              </div>
              <div className="hlasnik-pas">
                <span>
                  {dni.length} {tvar(dni.length, "vydanie", "vydania", "vydaní")}
                </span>
                <span>
                  {novinky.length} {tvar(novinky.length, "správa", "správy", "správ")}
                </span>
              </div>
              {dni.length === 0 && <p className="tlmene">V tejto kategórii zatiaľ nič nie je.</p>}
              {dni.map((d) => {
                const den = denZDatumu(d.datum);
                const vydania = [...new Set(d.novinky.map((n) => n.vydanie).filter((v) => v !== ""))];
                return (
                  <section key={d.datum} className="hlasnik-den" aria-labelledby={`den-${d.datum}`}>
                    <div className="hlasnik-den-hlava">
                      <h2 id={`den-${d.datum}`}>
                        <time dateTime={d.datum}>{kratky(den)}</time>
                        {vydania.length > 0 && ` · ${vydania.join(" · ")}`}
                      </h2>
                      <span className="tlmene">
                        {den.toLocaleDateString("sk-SK", { weekday: "long" })} · {d.novinky.length} {tvar(d.novinky.length, "zmena", "zmeny", "zmien")}
                      </span>
                    </div>
                    <ul className="hlasnik-riadky">
                      {d.novinky.map((n) => {
                        const otvorena = otvorene.has(n.id);
                        const nova = videne !== null && n.vytvorena > videne;
                        return (
                          <li key={n.id} id={`novinka-${n.id}`} className={`hlasnik-zaznam${otvorena ? " otvoreny" : ""}`}>
                            <h3>
                              <button type="button" aria-expanded={otvorena} aria-controls={`novinka-${n.id}-text`} onClick={() => prepni(n.id)}>
                                <KategoriaZnacka k={n.kategoria} />
                                <span className="hlasnik-nadpis">{n.nadpis}</span>
                                {nova && <span className="novinka-nova">nové</span>}
                                <span className="hlasnik-sipka" aria-hidden="true">
                                  ▸
                                </span>
                              </button>
                            </h3>
                            {otvorena && (
                              <div id={`novinka-${n.id}-text`} className="hlasnik-text">
                                <p>{n.text}</p>
                                {n.odkaz !== "" && <Odkaz href={n.odkaz}>{textOdkazu(n.odkaz)} →</Odkaz>}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </div>
          </div>

          <aside className="st-bok novinky-bok" aria-label="Filter noviniek">
            <div className="panel novinky-filtre" role="group" aria-label="Kategória">
              <button type="button" className={filter === null ? "aktivny" : undefined} aria-pressed={filter === null} onClick={() => setFilter(null)}>
                <span>Všetko</span>
                <small>{novinky.length}</small>
              </button>
              {(Object.keys(KATEGORIE) as Kategoria[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  className={filter === k ? "aktivny" : undefined}
                  aria-pressed={filter === k}
                  disabled={pocet(k) === 0}
                  onClick={() => setFilter(filter === k ? null : k)}
                >
                  <KategoriaZnacka k={k} />
                  <small>{pocet(k)}</small>
                </button>
              ))}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
