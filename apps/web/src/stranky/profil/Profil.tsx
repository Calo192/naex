// Profil hráča (Michal 2026-10-22, dizajn profily-20261022-1409): hlavička
// s Frajerinou, záložky Prehľad · Súhrn · Partie a prepínač ľudia / boti / spolu.
// Čo kto vidí, rozhoduje server: cudzí len formu z 5 partií, bilanciu, „vy dvaja“
// a súhrn bez silných a slabých stránok (ak si ho hráč neskryl); zoznam
// a detail partií len vlastník a správca. AI playtester je hráčom skrytý (404).

import { useEffect, useState, type ReactNode } from "react";
import { api } from "../../lib/api.ts";
import { Odkaz, useTitulok } from "../../lib/router.tsx";
import { NAZOV_UROVNE, RANKY_HRACOV, useUcet, type Pouzivatel, type Rola } from "../../lib/ucet.tsx";
import { Avatar, Hlaska, Nacitavanie } from "../../komponenty.tsx";
import { BilanciaPruh, CisloFrajeriny, GrafFrajeriny, Statistiky, tvar } from "../Statistiky.tsx";
import {
  SKRATKA_VYSLEDKU,
  TEXT_VYSLEDKU,
  datum,
  hodnotaMetriky,
  trvanie,
  znamienko,
  type Bilancia,
  type FilterPartii,
  type Metrika,
  type PartieApi,
  type ProfilApi,
  type RiadokPartie,
  type Vysledok,
} from "./typy.ts";
import "./profil.css";

type Zalozka = "prehlad" | "suhrn" | "partie";

/** Štyri čísla do Prehľadu — zvyšok je v záložke Súhrn. */
const HLAVNE_METRIKY = ["vyhry", "body", "lokality", "bitkyVyhrane"];

function useProfilApi(id: number, filter: FilterPartii, obnov: number): { profil: ProfilApi | null; chyba: string | null } {
  const [profil, setProfil] = useState<ProfilApi | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);
  useEffect(() => {
    let zive = true;
    setChyba(null);
    api
      .get<ProfilApi>(`/hraci/${id}?filter=${filter}`)
      .then((p) => zive && setProfil(p))
      .catch((e: unknown) => zive && setChyba(e instanceof Error ? e.message : String(e)));
    return () => {
      zive = false;
    };
  }, [id, filter, obnov]);
  return { profil, chyba };
}

function usePartie(id: number, filter: FilterPartii, limit: number, povolene: boolean): { data: PartieApi | null; chyba: string | null } {
  const [data, setData] = useState<PartieApi | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);
  useEffect(() => {
    if (!povolene) return;
    let zive = true;
    api
      .get<PartieApi>(`/hraci/${id}/partie?filter=${filter}&od=0&limit=${limit}`)
      .then((d) => zive && setData(d))
      .catch((e: unknown) => zive && setChyba(e instanceof Error ? e.message : String(e)));
    return () => {
      zive = false;
    };
  }, [id, filter, limit, povolene]);
  return { data, chyba };
}

function Forma({ vysledky, nadpis, pozn }: { readonly vysledky: readonly Vysledok[]; readonly nadpis: string; readonly pozn?: ReactNode }) {
  return (
    <section className="panel profil-karta">
      <header className="profil-karta-hlava">
        <h2>{nadpis}</h2>
        {pozn !== undefined && <span className="tlmene">{pozn}</span>}
      </header>
      {vysledky.length === 0 ? <p className="tlmene">Zatiaľ žiadna dohratá partia.</p> : <FormaStvorce vysledky={vysledky} nazov={nadpis} />}
    </section>
  );
}

/** Výsledky ako štvorčeky V/R/P; vstup je najnovší prvý. */
export function FormaStvorce({ vysledky, nazov }: { readonly vysledky: readonly Vysledok[]; readonly nazov: string }) {
  return (
    <ol className="forma" aria-label={`${nazov}: ${vysledky.map((v) => TEXT_VYSLEDKU[v]).join(", ")}`}>
      {/* Najstaršia vľavo, najnovšia vpravo — ako sa číta čas. */}
      {[...vysledky].reverse().map((v, i) => (
        <li key={i} className={`forma-stvorcek ${v}`} title={TEXT_VYSLEDKU[v]}>
          {SKRATKA_VYSLEDKU[v]}
        </li>
      ))}
    </ol>
  );
}

function Porovnanie({ m }: { readonly m: Metrika }) {
  const s = m.porovnanie.superi;
  if (m.hodnota === null || s === null) return null;
  const rozdiel = Math.round((m.hodnota - s) * 10) / 10;
  const lepsie = m.lepsie === "viac" ? rozdiel > 0 : rozdiel < 0;
  const trieda = rozdiel === 0 ? "" : lepsie ? "lepsie" : "horsie";
  return (
    <span className={`metrika-porovnanie ${trieda}`} title={`Súperi v tých istých partiách: ${hodnotaMetriky(m, s)} (rozdiel ${znamienko(rozdiel)})`}>
      {rozdiel === 0 ? "= ako súperi" : `${lepsie ? "▲" : "▼"} súperi ${hodnotaMetriky(m, s)}`}
    </span>
  );
}

function KartaMetriky({ m }: { readonly m: Metrika }) {
  return (
    <div className="metrika" title={m.popis}>
      <span className="metrika-hodnota">{hodnotaMetriky(m, m.hodnota)}</span>
      <span className="metrika-nazov">{m.nazov}</span>
      <span className="metrika-zdroj">{m.partii === 0 ? "zatiaľ bez dát" : `z ${m.partii} ${tvar(m.partii, "partie", "partií", "partií")}`}</span>
      <Porovnanie m={m} />
    </div>
  );
}

function SilneSlabe({ profil }: { readonly profil: ProfilApi }) {
  const s = profil.suhrn;
  if (s === null || profil.pohlad === "cudzi") return null;
  return (
    <section className="panel profil-karta">
      <header className="profil-karta-hlava">
        <h2>{profil.pohlad === "vlastny" ? "Tvoje silné a slabé stránky" : "Silné a slabé stránky"}</h2>
        <span className="tlmene">voči súperom v tých istých partiách</span>
      </header>
      {s.partii < 5 ? (
        <p className="tlmene">Ukážu sa od 5 partií — zatiaľ {s.partii}. Každá partia im dodá istotu.</p>
      ) : (
        <div className="stranky-mriezka">
          <div>
            <h3 className="stranky-nadpis dobre">▲ Čo ti ide</h3>
            {s.silne.length === 0 ? <p className="tlmene">Zatiaľ nič výrazné.</p> : s.silne.map((x) => <Stranka key={x.kluc} text={x.text} dokaz={x.dokaz} dobra />)}
          </div>
          <div>
            <h3 className="stranky-nadpis zle">▼ Kde to tečie</h3>
            {s.slabe.length === 0 ? <p className="tlmene">Zatiaľ nič výrazné.</p> : s.slabe.map((x) => <Stranka key={x.kluc} text={x.text} dokaz={x.dokaz} />)}
          </div>
        </div>
      )}
    </section>
  );
}

function Stranka({ text, dokaz, dobra = false }: { readonly text: string; readonly dokaz: string; readonly dobra?: boolean }) {
  return (
    <div className={`stranka-hraca ${dobra ? "dobra" : "zla"}`}>
      <strong>{text}</strong>
      <span className="tlmene">{dokaz}</span>
    </div>
  );
}

function RiadokPartieEl({ p }: { readonly p: RiadokPartie }) {
  return (
    <li className="partia-riadok">
      <span className={`vysledok-stitok ${p.vysledok}`}>{TEXT_VYSLEDKU[p.vysledok]}</span>
      <span className="partia-super">
        <Avatar meno={p.super.meno} avatar={p.super.avatar} velkost={28} />
        <span>
          {p.super.id === null ? <strong>{p.super.meno}</strong> : <Odkaz href={`/hrac/${p.super.id}`}>{p.super.meno}</Odkaz>}
          {p.super.bot !== undefined && <span className="odznak">bot</span>}
          <small className="tlmene">
            {datum(p.koniec)} · {p.kola} {tvar(p.kola, "kolo", "kolá", "kôl")} · {trvanie(p.trvanie)}
            {!p.dohrata && " · nedohraná"}
          </small>
        </span>
      </span>
      <span className="partia-body">{p.body === null ? "—" : `${p.body[0]} : ${p.body[1]}`}</span>
      <span className={`partia-frajerina ${p.frajerina === null ? "" : p.frajerina.po >= p.frajerina.pred ? "plus" : "minus"}`}>
        {p.frajerina === null ? "" : znamienko(p.frajerina.po - p.frajerina.pred)}
      </span>
      <Odkaz href={`/partia/${p.id}`} className="partia-detail" aria-label={`Detail partie s ${p.super.meno}`}>
        detail ›
      </Odkaz>
    </li>
  );
}

function ZoznamPartii({ id, filter, limit }: { readonly id: number; readonly filter: FilterPartii; readonly limit: number }) {
  const [kolko, setKolko] = useState(limit);
  const { data, chyba } = usePartie(id, filter, kolko, true);
  if (chyba !== null) return <Hlaska>{chyba}</Hlaska>;
  if (data === null) return <Nacitavanie text="Načítavam partie…" />;
  if (data.partie.length === 0) return <p className="tlmene">V tomto výbere zatiaľ žiadna partia.</p>;
  return (
    <>
      <ol className="partie-zoznam">
        {data.partie.map((p) => (
          <RiadokPartieEl key={p.id} p={p} />
        ))}
      </ol>
      {data.pocet > data.partie.length && limit > 5 && (
        <button type="button" className="tlacidlo-male" onClick={() => setKolko((k) => k + 20)}>
          načítať ďalšie ({data.pocet - data.partie.length})
        </button>
      )}
    </>
  );
}

function BilanciaRiadok({ b, nazov }: { readonly b: Bilancia; readonly nazov: string }) {
  return (
    <div className="bilancia-riadok">
      <span className="bilancia-nazov">{nazov}</span>
      <span>
        <b>{b.partie}</b> {tvar(b.partie, "partia", "partie", "partií")} · <span className="dobre">{b.vyhry} V</span> · {b.remizy} R ·{" "}
        <span className="zle">{b.prehry} P</span>
      </span>
      <BilanciaPruh vyhry={b.vyhry} remizy={b.remizy} prehry={b.prehry} />
    </div>
  );
}

/** Profil hráča (/hrac/:id). */
export function HracProfil({ id }: { readonly id: number }) {
  const { nastav } = useUcet();
  const [filter, setFilter] = useState<FilterPartii>("ludia");
  const [zalozka, setZalozka] = useState<Zalozka>("prehlad");
  const [obnov, setObnov] = useState(0);
  const { profil, chyba } = useProfilApi(id, filter, obnov);
  useTitulok(profil?.hrac.meno ?? "Hráč");
  const plny = profil !== null && profil.pohlad !== "cudzi";
  const forma20 = usePartie(id, filter, 20, plny);

  if (chyba !== null) {
    return (
      <div className="formular-stred" style={{ textAlign: "center" }}>
        <h1>Hráč sa nenašiel</h1>
        <p className="tlmene">{chyba}</p>
        <Odkaz href="/rebricek" className="tlacidlo">
          Rebríček
        </Odkaz>
      </div>
    );
  }
  if (profil === null) return <Nacitavanie />;

  const f = profil.frajerina;
  const vlastny = profil.pohlad === "vlastny";
  const skrySuhrn = (skryty: boolean): void => {
    api
      .patch<{ pouzivatel: Pouzivatel }>("/profil", { skrytySuhrn: skryty })
      .then((r) => {
        nastav(r.pouzivatel);
        setObnov((o) => o + 1);
      })
      .catch(() => undefined);
  };
  const metriky = profil.suhrn?.metriky ?? [];
  const hlavne = HLAVNE_METRIKY.flatMap((k) => metriky.filter((m) => m.kluc === k));
  const nova = profil.bilancia.ludia.partie + profil.bilancia.boti.partie === 0;

  return (
    <div className="profil-hraca">
      {profil.skryty && <p className="profil-skryty-pas">Skrytý profil — AI playtester. Hráči ho nevidia, správcovia áno.</p>}
      <section className="panel profil-hlavicka">
        <Avatar meno={profil.hrac.meno} avatar={profil.hrac.avatar} velkost={96} />
        <div className="profil-hlavicka-texty">
          <h1>{profil.hrac.meno}</h1>
          <div className="profil-odznaky">
            <span className="odznak">{f.titul}</span>
            {profil.hrac.rola === "admin" && <span className="odznak odznak-admin">tvorca hry</span>}
            {profil.hrac.rola === "subadmin" && <span className="odznak">subadmin</span>}
            {RANKY_HRACOV.includes(profil.hrac.rola as Rola) && <span className="odznak">{NAZOV_UROVNE[profil.hrac.rola as Rola]}</span>}
            <span className="tlmene">v krčme od {datum(profil.hrac.vytvoreny)}</span>
          </div>
          {vlastny && (
            <div className="profil-vlastne">
              <Odkaz href="/profil">Upraviť profil a nastavenia</Odkaz>
              <label className="profil-prepinac" title="Ostatní uvidia len Frajerinu, bilanciu a formu.">
                <input type="checkbox" checked={profil.suhrnSkryty} onChange={(e) => skrySuhrn(e.target.checked)} /> skryť môj súhrn pred ostatnými
              </label>
            </div>
          )}
        </div>
        <div className="profil-frajerina">
          <span className="profil-frajerina-nazov">Frajerina</span>
          <CisloFrajeriny f={f} velke />
          <span className="tlmene">
            {f.poradie !== null && (
              <>
                <Odkaz href="/rebricek">{f.poradie}. v rebríčku</Odkaz> ·{" "}
              </>
            )}
            najvyššia {f.najvyssia}
          </span>
        </div>
      </section>

      <div className="profil-ovladanie">
        <nav className="zalozky" aria-label="Časti profilu">
          {(
            [
              ["prehlad", "Prehľad"],
              ["suhrn", "Súhrn"],
              ...(plny ? ([["partie", "Partie"]] as const) : []),
            ] as const
          ).map(([k, nazov]) => (
            <button key={k} type="button" className={zalozka === k ? "zalozka aktivna" : "zalozka"} aria-pressed={zalozka === k} onClick={() => setZalozka(k)}>
              {nazov}
            </button>
          ))}
        </nav>
        {plny ? (
          <div className="segment" role="group" aria-label="Partie">
            {(
              [
                ["ludia", "S ľuďmi", profil.bilancia.ludia.partie],
                ["boti", "S botmi", profil.bilancia.boti.partie],
                ["spolu", "Spolu", profil.bilancia.ludia.partie + profil.bilancia.boti.partie],
              ] as const
            ).map(([k, nazov, n]) => (
              <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>
                {nazov} <small>{n}</small>
              </button>
            ))}
          </div>
        ) : (
          <span className="tlmene">
            {profil.bilancia.boti.partie > 0 && `+ ${profil.bilancia.boti.partie} ${tvar(profil.bilancia.boti.partie, "partia", "partie", "partií")} s botmi · `}
            čísla len z partií s ľuďmi
          </span>
        )}
      </div>

      {zalozka === "prehlad" && (
        <div className="profil-prehlad">
          {nova && (
            <section className="panel profil-karta profil-novy">
              <h2>Prvých päť poldecí</h2>
              <p>
                {vlastny
                  ? "Zatiaľ nemáš dohranú partiu. Po prvej uvidíš tu výsledky a čísla, od piatej silné a slabé stránky a od desiatej trend."
                  : "Tento hráč zatiaľ nedohral žiadnu partiu."}
              </p>
              {vlastny && (
                <Odkaz href="/hra" className="tlacidlo tlacidlo-hlavne">
                  Zahrať si partiu
                </Odkaz>
              )}
            </section>
          )}
          {plny ? (
            <Forma
              vysledky={(forma20.data?.partie ?? []).map((p) => p.vysledok)}
              nadpis={`Forma · posledných ${Math.min(20, forma20.data?.partie.length ?? 0)}`}
              pozn="najstaršia vľavo · detail je v Partiách"
            />
          ) : (
            <Forma vysledky={profil.forma} nadpis="Forma · posledných 5 s ľuďmi" />
          )}
          {profil.vyDvaja !== null && profil.vyDvaja.partie > 0 && (
            <section className="panel profil-karta">
              <h2>Vy dvaja</h2>
              <BilanciaRiadok b={profil.vyDvaja} nazov="tvoje partie s ním" />
            </section>
          )}
          {profil.suhrnSkryty && profil.pohlad === "cudzi" ? (
            <section className="panel profil-karta">
              <p className="tlmene">Hráč si súhrn čísel skryl — vidno len Frajerinu, bilanciu a formu.</p>
            </section>
          ) : (
            hlavne.length > 0 && (
              <section className="panel profil-karta">
                <header className="profil-karta-hlava">
                  <h2>V číslach</h2>
                  <span className="tlmene">porovnanie: súperi v tých istých partiách</span>
                </header>
                <div className="metriky-mriezka">
                  {hlavne.map((m) => (
                    <KartaMetriky key={m.kluc} m={m} />
                  ))}
                </div>
              </section>
            )
          )}
          <SilneSlabe profil={profil} />
          <section className="panel profil-karta">
            <h2>Bilancia</h2>
            <BilanciaRiadok b={profil.bilancia.ludia} nazov="s ľuďmi" />
            <BilanciaRiadok b={profil.bilancia.boti} nazov="s botmi" />
          </section>
          {plny && (
            <div className="profil-dva-stlpce">
              <section className="panel profil-karta">
                <header className="profil-karta-hlava">
                  <h2>Posledné partie</h2>
                  <button type="button" className="tlacidlo-male tlacidlo-jemne" onClick={() => setZalozka("partie")}>
                    všetky ›
                  </button>
                </header>
                <ZoznamPartii id={id} filter={filter} limit={5} />
              </section>
              {profil.superi.length > 0 && (
                <section className="panel profil-karta">
                  <h2>Súperi</h2>
                  <ul className="superi-zoznam">
                    {profil.superi.map((s, i) => (
                      <li key={s.id ?? `b${i}`}>
                        <Avatar meno={s.meno} avatar={s.avatar} velkost={28} />
                        {s.id === null ? <strong>{s.meno}</strong> : <Odkaz href={`/hrac/${s.id}`}>{s.meno}</Odkaz>}
                        <span className="tlmene">
                          {s.partie} {tvar(s.partie, "partia", "partie", "partií")}
                        </span>
                        <span>
                          <span className="dobre">{s.vyhry} V</span> · {s.remizy} R · <span className="zle">{s.prehry} P</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}
          {profil.historia.length > 1 && (
            <section className="panel profil-karta">
              <h2>Vývoj Frajeriny</h2>
              <GrafFrajeriny historia={profil.historia} />
            </section>
          )}
        </div>
      )}

      {zalozka === "suhrn" && (
        <div className="profil-prehlad">
          {profil.suhrn === null ? (
            <section className="panel profil-karta">
              <p className="tlmene">{profil.suhrnSkryty ? "Hráč si súhrn čísel skryl." : "Súhrn zatiaľ nie je."}</p>
            </section>
          ) : (
            <section className="panel profil-karta">
              <header className="profil-karta-hlava">
                <h2>Súhrn · {profil.suhrn.partii} {tvar(profil.suhrn.partii, "partia", "partie", "partií")}</h2>
                <span className="tlmene">trend od 10 partií · priemer hráčov od 10 ľudí s 5+ partiami</span>
              </header>
              <table className="suhrn-tabulka">
                <thead>
                  <tr>
                    <th>Čo</th>
                    <th>Hodnota</th>
                    <th>Súperi</th>
                    <th>Hráči</th>
                    <th>Trend</th>
                    <th>Z partií</th>
                  </tr>
                </thead>
                <tbody>
                  {metriky.map((m) => (
                    <tr key={m.kluc} title={m.popis}>
                      <th scope="row">{m.nazov}</th>
                      <td className="cislo">
                        <b>{hodnotaMetriky(m, m.hodnota)}</b> <Porovnanie m={m} />
                      </td>
                      <td className="cislo">{hodnotaMetriky(m, m.porovnanie.superi)}</td>
                      <td className="cislo">{hodnotaMetriky(m, m.porovnanie.hraci)}</td>
                      <td className="cislo">{m.trend === null ? "—" : znamienko(Math.round(m.trend * 10) / 10)}</td>
                      <td className="cislo">{m.partii}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
          <SilneSlabe profil={profil} />
          {plny && (
            <details className="panel profil-karta">
              <summary>Všetky počítadlá (celá história)</summary>
              <Statistiky profil={profil} vlastny={vlastny} />
            </details>
          )}
        </div>
      )}

      {zalozka === "partie" && plny && (
        <section className="panel profil-karta">
          <h2>Partie</h2>
          <ZoznamPartii id={id} filter={filter} limit={20} />
        </section>
      )}
    </div>
  );
}
