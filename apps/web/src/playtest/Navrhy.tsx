// Návrhy zlepšení z playtestov (Michal 2026-10-21). Navrhár so stratégom ich
// nahrá po playteste; admin pri každom vyberie možnosť, dopíše poznámku a
// rozhodne. Návrhy na implementáciu potom spracuje skill naex-implementacia
// (agent Developer) a označí ich ako implementované; ďalší playtest ich potom
// overí (zabralo / nezabralo). Rovnako sem chodia návrhy dizajnérov webu.

import { useEffect, useState, type FormEvent } from "react";
import { api } from "../lib/api.ts";
import { Odkaz, useTitulok } from "../lib/router.tsx";
import { useUcet } from "../lib/ucet.tsx";
import { Hlaska, Nacitavanie } from "../komponenty.tsx";
import { kedy, odkazNaReport } from "./Reporty.tsx";

type Stav = "nove" | "implementovat" | "odlozene" | "zamietnute" | "rozpracovane" | "implementovane" | "overene" | "nezabralo";
type Kritickost = "kriticka" | "vysoka" | "stredna" | "nizka";

interface Moznost {
  readonly kluc: string;
  readonly nazov: string;
  readonly popis: string;
  readonly dopad: string;
  readonly narocnost: string;
  readonly odporucana: boolean;
}

export interface Navrh {
  readonly id: number;
  readonly davka: string;
  readonly podklady: readonly string[];
  readonly kluc: string;
  readonly nazov: string;
  readonly kritickost: Kritickost;
  readonly oblast: string;
  readonly problem: string;
  readonly pricina: string;
  readonly prejav: string;
  readonly dokazy: readonly string[];
  readonly moznosti: readonly Moznost[];
  readonly odporucanie: string;
  readonly otazky: readonly string[];
  readonly overenie: readonly string[];
  readonly zdroj: "playtest" | "dizajn" | "rozhodca";
  readonly stav: Stav;
  readonly volba: string | null;
  readonly poznamka: string;
  readonly rozhodol: { readonly id: number; readonly meno: string; readonly ai: boolean } | null;
  readonly rozhodnuty: number | null;
  readonly vysledok: string;
  readonly verdikt: string;
}

const STAVY: Readonly<Record<Stav, string>> = {
  nove: "čaká na rozhodnutie",
  implementovat: "implementovať",
  odlozene: "odložené",
  zamietnute: "zamietnuté",
  rozpracovane: "Developer na tom pracuje",
  implementovane: "implementované, čaká na overenie",
  overene: "overené — zabralo",
  nezabralo: "nezabralo — rozhodni znova",
};

const ZDROJE: Readonly<Record<Navrh["zdroj"], string>> = {
  playtest: "Playtest",
  dizajn: "Dizajn",
  rozhodca: "Rozhodca (pravidlá vs. kód)",
};

const KRITICKOSTI: Readonly<Record<Kritickost, string>> = {
  kriticka: "kritické",
  vysoka: "vysoká priorita",
  stredna: "stredná priorita",
  nizka: "nízka priorita",
};

const FILTRE = [
  { kluc: "rozhodnut", text: "Na rozhodnutie", stavy: ["nove", "nezabralo"] },
  { kluc: "implementovat", text: "Na implementáciu", stavy: ["implementovat", "rozpracovane"] },
  { kluc: "overit", text: "Na overenie", stavy: ["implementovane"] },
  { kluc: "hotove", text: "Overené", stavy: ["overene"] },
  { kluc: "odlozene", text: "Odložené", stavy: ["odlozene"] },
  { kluc: "zamietnute", text: "Zamietnuté", stavy: ["zamietnute"] },
  { kluc: "vsetky", text: "Všetky", stavy: null },
] as const satisfies readonly { kluc: string; text: string; stavy: readonly Stav[] | null }[];

function popisPodkladu(p: string): string {
  if (p.startsWith("strategia-")) return "rozbor stratéga";
  if (p.startsWith("navrhy-")) return "návrhy (HTML)";
  if (p.startsWith("dizajn-")) return p.endsWith("-ui.html") ? "ukážky UI" : p.endsWith("-ux.html") ? "ukážky UX" : "dizajn";
  return "report";
}

/** Vlastné odseky z textu navrhára (prázdny riadok = nový odsek). */
function Text({ children }: { readonly children: string }) {
  return (
    <>
      {children.split(/\n{2,}/).map((odsek, i) => (
        <p key={i} className="navrh-text">
          {odsek}
        </p>
      ))}
    </>
  );
}

function NavrhKarta({ n, zmenene }: { readonly n: Navrh; readonly zmenene: (n: Navrh) => void }) {
  const odporucana = n.moznosti.find((m) => m.odporucana)?.kluc ?? n.moznosti[0]?.kluc ?? null;
  const [volba, setVolba] = useState<string | null>(n.volba ?? odporucana);
  const [poznamka, setPoznamka] = useState(n.poznamka);
  const [posiela, setPosiela] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [dokazy, setDokazy] = useState(false);
  // Na návrhu, na ktorom Developer pracuje alebo ho dokončil, sa rozhodnutie nemení.
  const uzavrety = n.stav === "rozpracovane" || n.stav === "implementovane" || n.stav === "overene";

  const rozhodni = async (stav: Stav, e?: FormEvent) => {
    e?.preventDefault();
    setPosiela(true);
    setChyba(null);
    try {
      await api.patch(`/admin/navrhy/${n.id}`, { stav, volba, poznamka });
      zmenene({ ...n, stav, volba, poznamka });
    } catch (err) {
      setChyba(err instanceof Error ? err.message : String(err));
    } finally {
      setPosiela(false);
    }
  };

  return (
    <article className={`panel navrh krit-${n.kritickost} stav-${n.stav}`}>
      <header className="navrh-hlava">
        <div className="nazor-znacky">
          <span className={`navrh-kritickost ${n.kritickost}`}>{KRITICKOSTI[n.kritickost]}</span>
          {n.oblast !== "" && <span className="nazor-kategoria">{n.oblast}</span>}
          <span className={`navrh-stav ${n.stav}`}>{STAVY[n.stav]}</span>
        </div>
        <h3>{n.nazov}</h3>
      </header>

      <div className="navrh-rozbor">
        <section>
          <h4>Problém</h4>
          <Text>{n.problem}</Text>
        </section>
        <section>
          <h4>Čo ho spôsobuje</h4>
          <Text>{n.pricina}</Text>
        </section>
        <section>
          <h4>Ako sa prejavuje</h4>
          <Text>{n.prejav}</Text>
        </section>
      </div>

      {n.dokazy.length > 0 && (
        <div className="navrh-dokazy">
          <button type="button" className="tlacidlo-male tlacidlo-jemne" onClick={() => setDokazy(!dokazy)} aria-expanded={dokazy}>
            {dokazy ? "Skryť dôkazy" : `Dôkazy z playtestov (${n.dokazy.length})`}
          </button>
          {dokazy && (
            <ul>
              {n.dokazy.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <form onSubmit={(e) => void rozhodni("implementovat", e)}>
        <fieldset className="navrh-moznosti" disabled={uzavrety || posiela}>
          <legend>Ako to zlepšiť</legend>
          {n.moznosti.map((m) => (
            <label key={m.kluc} className={`navrh-moznost ${volba === m.kluc ? "vybrana" : ""}`}>
              <input type="radio" name={`volba-${n.id}`} value={m.kluc} checked={volba === m.kluc} onChange={() => setVolba(m.kluc)} />
              <span className="navrh-moznost-telo">
                <span className="navrh-moznost-nazov">
                  <strong>
                    {m.kluc}. {m.nazov}
                  </strong>
                  {m.odporucana && <span className="odznak">odporúča navrhár</span>}
                  {m.narocnost !== "" && <span className="tlmene">náročnosť: {m.narocnost}</span>}
                </span>
                <span className="navrh-text">{m.popis}</span>
                {m.dopad !== "" && <span className="navrh-dopad">Dopad: {m.dopad}</span>}
              </span>
            </label>
          ))}
          <label className={`navrh-moznost ${volba === "vlastne" ? "vybrana" : ""}`}>
            <input type="radio" name={`volba-${n.id}`} value="vlastne" checked={volba === "vlastne"} onChange={() => setVolba("vlastne")} />
            <span className="navrh-moznost-telo">
              <strong>Vlastné riešenie</strong>
              <span className="tlmene">opíš ho v poznámke nižšie</span>
            </span>
          </label>
        </fieldset>

        {n.odporucanie !== "" && (
          <div className="navrh-odporucanie">
            <h4>Odporúčanie navrhára</h4>
            <Text>{n.odporucanie}</Text>
          </div>
        )}
        {n.otazky.length > 0 && (
          <div className="navrh-otazky">
            <h4>Otázky na teba</h4>
            <ol>
              {n.otazky.map((o, i) => (
                <li key={i}>{o}</li>
              ))}
            </ol>
          </div>
        )}
        {n.overenie.length > 0 && (
          <div className="navrh-otazky">
            <h4>Ako ďalší playtest overí, že to zabralo</h4>
            <ul>
              {n.overenie.map((o, i) => (
                <li key={i}>{o}</li>
              ))}
            </ul>
          </div>
        )}

        <label className="navrh-poznamka">
          <span>Poznámka pre Developera (odpovede na otázky, úpravy, obmedzenia)</span>
          <textarea rows={3} value={poznamka} onChange={(e) => setPoznamka(e.target.value)} disabled={uzavrety || posiela} maxLength={6000} />
        </label>

        {chyba !== null && <Hlaska>{chyba}</Hlaska>}
        {n.vysledok !== "" && (uzavrety || n.stav === "nezabralo") && (
          <div className="navrh-vysledok">
            <h4>Čo Developer spravil</h4>
            <Text>{n.vysledok}</Text>
          </div>
        )}
        {n.verdikt !== "" && (
          <div className={`navrh-vysledok verdikt-${n.stav}`}>
            <h4>{n.stav === "nezabralo" ? "Playtest: nezabralo" : "Playtest: zabralo"}</h4>
            <Text>{n.verdikt}</Text>
          </div>
        )}
        {!uzavrety && (
          <div className="riadok-tlacidiel">
            <button type="submit" className="tlacidlo-hlavne" disabled={posiela || volba === null}>
              {n.stav === "implementovat" ? "Uložiť zmeny" : n.stav === "nezabralo" ? "Implementovať znova" : "Implementovať"}
            </button>
            <button type="button" className="tlacidlo-jemne" disabled={posiela} onClick={() => void rozhodni("odlozene")}>
              Odložiť
            </button>
            <button type="button" className="tlacidlo-jemne" disabled={posiela} onClick={() => void rozhodni("zamietnute")}>
              Zamietnuť
            </button>
            {n.stav !== "nove" && (
              <button type="button" className="tlacidlo-jemne" disabled={posiela} onClick={() => void rozhodni("nove")}>
                Vrátiť na rozhodnutie
              </button>
            )}
          </div>
        )}
        {n.rozhodol !== null && n.rozhodnuty !== null && n.stav !== "nove" && (
          <p className="tlmene navrh-kto">
            Rozhodol {n.rozhodol.meno}
            {n.rozhodol.ai ? " (AI — Developer také rozhodnutie nevezme)" : ""}, {kedy(n.rozhodnuty)}
          </p>
        )}
      </form>
    </article>
  );
}

export function Navrhy() {
  useTitulok("Playtest — návrhy");
  const { ja } = useUcet();
  const [navrhy, setNavrhy] = useState<readonly Navrh[] | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof FILTRE)[number]["kluc"]>("rozhodnut");

  useEffect(() => {
    api
      .get<{ navrhy: Navrh[] }>("/admin/navrhy")
      .then((d) => setNavrhy(d.navrhy))
      .catch((e: unknown) => setChyba(e instanceof Error ? e.message : String(e)));
  }, []);

  if (navrhy === null) return chyba !== null ? <Hlaska>{chyba}</Hlaska> : <Nacitavanie />;

  const zmenene = (novy: Navrh) =>
    setNavrhy((stare) =>
      (stare ?? []).map((n) =>
        n.id === novy.id ? { ...novy, rozhodol: ja === null ? n.rozhodol : { id: ja.id, meno: ja.meno, ai: false }, rozhodnuty: Date.now() } : n,
      ),
    );
  const aktivny = FILTRE.find((f) => f.kluc === filter) ?? FILTRE[0];
  const zobrazene = navrhy.filter((n) => aktivny.stavy === null || (aktivny.stavy as readonly Stav[]).includes(n.stav));
  const davky = [...new Set(zobrazene.map((n) => n.davka))];
  const pocet = (stavy: readonly Stav[] | null) => navrhy.filter((n) => stavy === null || stavy.includes(n.stav)).length;

  return (
    <div>
      <p className="tlmene">
        Návrhy, ktoré po playteste spoločne pripravili navrhár a stratég, a návrhy dizajnérov webu. Pri každom vyber riešenie, dopíš poznámku a rozhodni.
        Návrhy na implementáciu spracuje skill <code>/naex-implementacia</code> — agent Developer ich naprogramuje, commitne a označí tu ako implementované.
        Ďalší playtest potom overí, či zmena zabrala; ak nie, návrh sa vráti sem na rozhodnutie.
      </p>
      <div className="cipy" role="tablist" aria-label="Stav návrhov">
        {FILTRE.map((f) => (
          <button key={f.kluc} type="button" role="tab" aria-selected={filter === f.kluc} className={`cip ${filter === f.kluc ? "aktivny" : ""}`} onClick={() => setFilter(f.kluc)}>
            {f.text} ({pocet(f.stavy)})
          </button>
        ))}
      </div>
      {davky.length === 0 && <p className="tlmene navrhy-prazdne">Tu nič nie je. Návrhy pribudnú po playteste s parametrom max (/naex-playtest 2 max).</p>}
      {davky.map((d) => {
        const vDavke = zobrazene.filter((n) => n.davka === d);
        const podklady = vDavke[0]?.podklady ?? [];
        return (
          <section key={d} className="navrhy-davka">
            <h2>
              {ZDROJE[vDavke[0]?.zdroj ?? "playtest"]} {d}
              {podklady.map((p) => (
                <Odkaz key={p} href={odkazNaReport(p)} className="navrhy-podklad">
                  {popisPodkladu(p)}
                </Odkaz>
              ))}
            </h2>
            {vDavke.map((n) => (
              <NavrhKarta key={n.id} n={n} zmenene={zmenene} />
            ))}
          </section>
        );
      })}
    </div>
  );
}
