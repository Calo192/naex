// Novinky (Michal 2026-10-22): čo sa v hre a na webe zmenilo, napísané pre
// hráča. Verejné aj pre návštevníkov; píše ich správca (agent Admin), až keď
// je zmena na živom webe. Značka „nové“ = pribudla od poslednej návštevy
// tejto stránky (prihlásenému to pamätá server, návštevníkovi prehliadač).

import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api.ts";
import { NOVINKY_VIDENE, citajVidene, ulozVidene } from "../lib/novinky.ts";
import { Odkaz, useTitulok } from "../lib/router.tsx";
import { Hlaska, Nacitavanie } from "../komponenty.tsx";
import { HlavaStranky } from "../HlavaStranky.tsx";
import "./novinky.css";

const KATEGORIE = { pravidla: "Pravidlá", karty: "Karty", dizajn: "Dizajn", web: "Web", opravy: "Opravy" } as const;
type Kategoria = keyof typeof KATEGORIE;

interface Novinka {
  readonly id: number;
  readonly datum: string;
  readonly kategoria: Kategoria;
  readonly nadpis: string;
  readonly text: string;
  readonly odkaz: string;
  readonly vytvorena: number;
}

const textOdkazu = (odkaz: string): string =>
  odkaz.startsWith("/pravidla") ? "V pravidlách"
  : odkaz.startsWith("/karty") ? "Pozrieť karty"
  : odkaz.startsWith("/vyvoj") ? "Vo Vývoji"
  : odkaz.startsWith("/profil") ? "V profile"
  : "Viac";

// Poludnie, aby deň neposunulo časové pásmo.
const den = (datum: string): string =>
  new Date(`${datum}T12:00:00`).toLocaleDateString("sk-SK", { day: "numeric", month: "long", year: "numeric" });

export function Novinky() {
  useTitulok("Novinky");
  const [novinky, setNovinky] = useState<readonly Novinka[] | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);
  const [filter, setFilter] = useState<Kategoria | null>(null);
  // Zistí sa raz pri otvorení — kým je stránka otvorená, značky ostanú.
  const [videne, setVidene] = useState<number | null>(null);

  useEffect(() => {
    api
      .get<{ novinky: Novinka[]; videne: number | null }>("/novinky")
      .then((r) => {
        setNovinky(r.novinky);
        if (r.videne !== null) {
          setVidene(r.videne);
          api.post("/novinky/videne").catch(() => undefined);
        } else {
          setVidene(citajVidene());
          const najnovsia = Math.max(0, ...r.novinky.map((n) => n.vytvorena));
          if (najnovsia > 0) ulozVidene(najnovsia);
        }
        window.dispatchEvent(new Event(NOVINKY_VIDENE));
      })
      .catch((e: unknown) => setChyba(e instanceof Error ? e.message : String(e)));
  }, []);

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
  const novych = videne === null ? 0 : (novinky?.filter((n) => n.vytvorena > videne).length ?? 0);

  return (
    <div className="novinky">
      <HlavaStranky
        nadpis="Novinky"
        uvod="Čo sa v hre a na webe zmenilo — pravidlá, karty, vzhľad aj opravy. Najnovšie hore."
        akcia={<Odkaz href="/vyvoj#roadmapa">Kam hra smeruje → Roadmapa</Odkaz>}
      />

      {chyba !== null && <Hlaska>{chyba}</Hlaska>}

      {novinky !== null && novinky.length > 0 && (
        <div className="novinky-ovladanie">
          <div className="cipy" role="group" aria-label="Filter kategórie">
            <button type="button" className={`cip ${filter === null ? "aktivny" : ""}`} aria-pressed={filter === null} onClick={() => setFilter(null)}>
              Všetko
            </button>
            {(Object.keys(KATEGORIE) as Kategoria[])
              .filter((k) => pocet(k) > 0)
              .map((k) => (
                <button
                  key={k}
                  type="button"
                  className={`cip ${filter === k ? "aktivny" : ""}`}
                  aria-pressed={filter === k}
                  onClick={() => setFilter(filter === k ? null : k)}
                >
                  {KATEGORIE[k]} <span className="novinky-pocet">{pocet(k)}</span>
                </button>
              ))}
          </div>
          {novych > 0 && (
            <span className="tlmene">
              Od tvojej poslednej návštevy {novych === 1 ? "pribudla 1 novinka" : novych < 5 ? `pribudli ${novych} novinky` : `pribudlo ${novych} noviniek`}.
            </span>
          )}
        </div>
      )}

      {novinky === null ? (
        chyba === null && <Nacitavanie />
      ) : novinky.length === 0 ? (
        <p className="tlmene">Zatiaľ tu nič nie je. Prvé novinky pribudnú s najbližšou zmenou hry.</p>
      ) : (
        <div className="novinky-dni">
          {dni.map((d) => (
            <section key={d.datum} className="novinky-den">
              <h2>
                <time dateTime={d.datum}>{den(d.datum)}</time>
              </h2>
              <ul className="novinky-zoznam">
                {d.novinky.map((n) => (
                  <li key={n.id} className="panel novinka">
                    <div className="novinka-znacky">
                      <span className={`novinka-kategoria kat-${n.kategoria}`}>{KATEGORIE[n.kategoria]}</span>
                      {videne !== null && n.vytvorena > videne && <span className="novinka-nova">nové</span>}
                    </div>
                    <h3>{n.nadpis}</h3>
                    <p className="novinka-text">{n.text}</p>
                    {n.odkaz !== "" && (
                      <Odkaz href={n.odkaz} className="novinka-odkaz">
                        {textOdkazu(n.odkaz)} →
                      </Odkaz>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
