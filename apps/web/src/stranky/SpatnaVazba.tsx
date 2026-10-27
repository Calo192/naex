// Spätná väzba (/spatna-vazba): hráči píšu, čo si o hre myslia, ostatní
// komentujú a dávajú cigarety (obdoba „páči sa mi“). Správca mení stav názoru.
//
// Variant S-A (Michal 2026-10-27): hore jedno „Napísať názor“ (formulár až po
// kliknutí, kategória povinná a bez predvoľby), záložky stavu s počtami zo servera,
// filter kategórie, triedenie, prepínač „Od ľudí / Aj od AI playtesterov“ (AI
// predvolene skryté) a čistý zoznam; v boku kompaktné „Ohodnoť hru“.

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "../lib/api.ts";
import { Odkaz, useTitulok } from "../lib/router.tsx";
import { jeSpravca, maPravo, useUcet, type Pouzivatel } from "../lib/ucet.tsx";
import { Avatar, Hlaska, Nacitavanie } from "../komponenty.tsx";
import { HlavaStranky } from "../HlavaStranky.tsx";
import { tvar } from "./Statistiky.tsx";
import { HodnotenieHry } from "./HodnotenieHry.tsx";
import "./statistiky.css";

/** Poradie = poradie vo formulári „O čom píšeš?“. Kľúče sú tie isté ako pred 2026-10-27 — staré názory ostávajú. */
const KATEGORIE = {
  chyba: "Chyba",
  pravidla: "Pravidlá a balans",
  karty: "Karty",
  hranie: "Hranie a ovládanie",
  web: "Web a vzhľad",
  napad: "Nápad",
  ine: "Iné",
} as const;
type Kategoria = keyof typeof KATEGORIE;

const STAVY = {
  nove: "nové",
  prijate: "prečítané",
  planovane: "plánujeme",
  hotove: "hotovo",
  zamietnute: "nebudeme robiť",
} as const;
type Stav = keyof typeof STAVY;

/** Záložky stavu; Otvorené = nové + prečítané (server). */
const ZALOZKY = { otvorene: "Otvorené", planovane: "Plánujeme", hotove: "Hotovo", zamietnute: "Nebudeme" } as const;
type Zalozka = keyof typeof ZALOZKY;
type Pocty = Readonly<Record<Zalozka, { readonly ludia: number; readonly ai: number }>>;

type Triedenie = "nove" | "cigarety" | "diskusia";

interface Autor {
  readonly id: number;
  readonly meno: string;
  readonly avatar: string | null;
  readonly rola: string;
  readonly ai: boolean;
}

interface Komentar {
  readonly id: number;
  readonly autor: Autor;
  readonly text: string;
  readonly vytvoreny: number;
  readonly cigarety: number;
  readonly mojaCigareta: boolean;
}

interface Nazor {
  readonly id: number;
  readonly autor: Autor;
  readonly kategoria: Kategoria;
  readonly nadpis: string;
  readonly text: string;
  readonly stav: Stav;
  readonly dovod: string;
  readonly novinka: { readonly id: number; readonly datum: string; readonly nadpis: string } | null;
  readonly vytvoreny: number;
  readonly upraveny: number | null;
  readonly cigarety: number;
  readonly mojaCigareta: boolean;
  readonly komentare: readonly Komentar[];
}

/** Novinka na výber pri „hotovo“. */
interface NovinkaVyber {
  readonly id: number;
  readonly datum: string;
  readonly nadpis: string;
}

const MAX_NAZOR = 3000;
const MAX_KOMENTAR = 1000;
const MAX_NADPIS = 120;
const MAX_DOVOD = 200;

/** Spätná väzba AI agentov je predvolene skrytá (Michal 2026-10-21); voľba sa pamätá v prehliadači. */
const KLUC_AI = "naex-spatna-vazba-ai";

function citajUkazAi(): boolean {
  try {
    return localStorage.getItem(KLUC_AI) === "1";
  } catch {
    return false;
  }
}

function ulozUkazAi(v: boolean): void {
  try {
    localStorage.setItem(KLUC_AI, v ? "1" : "0");
  } catch {
    // súkromné okno — voľba platí len do obnovenia stránky
  }
}

const kratkyDen = (datum: string): string => {
  const d = new Date(`${datum}T12:00:00`);
  return `${d.getDate()}. ${d.getMonth() + 1}.`;
};

/** Titul názoru bez nadpisu (pred 2026-10-27): prvá veta textu, zvyšok je ukážka. */
function titulZTextu(text: string): { readonly titul: string; readonly ukazka: string } {
  const t = text.trim();
  const m = /^([\s\S]{8,160}?[.!?…])(\s|$)/.exec(t);
  if (m?.[1] !== undefined && !m[1].includes("\n")) return { titul: m[1], ukazka: t.slice(m[1].length).trim() };
  const riadok = t.split("\n")[0] ?? t;
  if (riadok.length <= 160) return { titul: riadok, ukazka: t.slice(riadok.length).trim() };
  return { titul: `${riadok.slice(0, 157).trimEnd()}…`, ukazka: t };
}

function kedy(cas: number): string {
  const s = Math.round((Date.now() - cas) / 1000);
  if (s < 60) return "práve teraz";
  const min = Math.round(s / 60);
  if (min < 60) return `pred ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `pred ${h} h`;
  const dni = Math.round(h / 24);
  if (dni === 1) return "včera";
  if (dni < 7) return `pred ${dni} ${tvar(dni, "dňom", "dňami", "dňami")}`;
  return new Date(cas).toLocaleDateString("sk-SK", { day: "numeric", month: "numeric", year: "numeric" });
}

/** Cigareta ako „páči sa mi“: zapálená, keď si ju dal ty. */
export function TlacidloCigarety({
  pocet,
  moja,
  vlastne,
  prepni,
  navstevnik = false,
}: {
  readonly pocet: number;
  readonly moja: boolean;
  readonly vlastne: boolean;
  readonly prepni: () => void;
  readonly navstevnik?: boolean;
}) {
  const popis = navstevnik
    ? "Cigarety tvoj rank zatiaľ dávať nesmie."
    : vlastne
    ? "Sám sebe cigaretu nedáš."
    : moja
      ? "Zobrať cigaretu späť"
      : "Dať cigaretu — páči sa mi to";
  return (
    <button
      type="button"
      className={`cigareta-tlacidlo ${moja ? "zapalena" : ""}`}
      onClick={prepni}
      disabled={vlastne || navstevnik}
      aria-pressed={moja}
      title={popis}
      aria-label={`${popis} (${pocet} ${tvar(pocet, "cigareta", "cigarety", "cigariet")})`}
    >
      <svg viewBox="0 0 40 20" aria-hidden="true">
        <g className="dym">
          <path d="M4.5 10c-2-2.2 1.6-3.2 0-5.4S6 1.4 4.5 0" />
        </g>
        <rect className="tabak" x="6" y="11" width="23" height="8" rx="1.2" />
        <rect className="filter" x="29" y="11" width="10" height="8" rx="1.2" />
        <rect className="ohen" x="3" y="11" width="3.4" height="8" rx="1.2" />
      </svg>
      <span>{pocet}</span>
    </button>
  );
}

/** Tlačidlo, ktoré pred nevratnou akciou chce druhé kliknutie. */
function PotvrdTlacidlo({ text, potvrdenie, akcia }: { readonly text: string; readonly potvrdenie: string; readonly akcia: () => void }) {
  const [pyta, setPyta] = useState(false);
  useEffect(() => {
    if (!pyta) return;
    const t = setTimeout(() => setPyta(false), 4000);
    return () => clearTimeout(t);
  }, [pyta]);
  return (
    <button
      type="button"
      className={`tlacidlo-male tlacidlo-jemne ${pyta ? "tlacidlo-nebezpecne" : ""}`}
      onClick={() => {
        if (pyta) {
          setPyta(false);
          akcia();
        } else setPyta(true);
      }}
    >
      {pyta ? potvrdenie : text}
    </button>
  );
}

function MenoAutora({ autor }: { readonly autor: Autor }) {
  return (
    <span className="nazor-autor">
      <Odkaz href={`/hrac/${autor.id}`}>{autor.meno}</Odkaz>
      {autor.rola === "admin" && <span className="odznak odznak-admin">tvorca hry</span>}
      {autor.rola === "subadmin" && <span className="odznak">subadmin</span>}
      {autor.ai && (
        <span className="odznak odznak-ai" title="Napísal AI agent (playtester alebo protihráč)">
          AI
        </span>
      )}
    </span>
  );
}

function KomentarPolozka({ k, ja, obnov, chyba }: { readonly k: Komentar; readonly ja: Pouzivatel; readonly obnov: () => void; readonly chyba: (e: unknown) => void }) {
  const [stav, setStav] = useState({ pocet: k.cigarety, moja: k.mojaCigareta });
  useEffect(() => setStav({ pocet: k.cigarety, moja: k.mojaCigareta }), [k.cigarety, k.mojaCigareta]);
  const prepni = () => {
    const dat = !stav.moja;
    api[dat ? "put" : "del"]<{ cigarety: number }>(`/nazory/komentare/${k.id}/cigareta`)
      .then((r) => setStav({ pocet: r.cigarety, moja: dat }))
      .catch(chyba);
  };
  return (
    <li className="komentar">
      <Avatar meno={k.autor.meno} avatar={k.autor.avatar} velkost={30} />
      <div className="komentar-telo">
        <div className="nazor-meta">
          <MenoAutora autor={k.autor} />
          <span className="tlmene">{kedy(k.vytvoreny)}</span>
        </div>
        <p className="nazor-text">{k.text}</p>
        <div className="nazor-akcie">
          <TlacidloCigarety pocet={stav.pocet} moja={stav.moja} vlastne={k.autor.id === ja.id} prepni={prepni} navstevnik={!maPravo(ja, "spatna_vazba_reagovat")} />
          {(k.autor.id === ja.id || jeSpravca(ja.rola)) && (
            <PotvrdTlacidlo
              text="zmazať"
              potvrdenie="naozaj zmazať?"
              akcia={() => {
                api.del(`/nazory/komentare/${k.id}`).then(obnov).catch(chyba);
              }}
            />
          )}
        </div>
      </div>
    </li>
  );
}


function IkonaBubliny() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" className="ikona-bubliny">
      <path d="M3 4.5A2.5 2.5 0 0 1 5.5 2h9A2.5 2.5 0 0 1 17 4.5v6a2.5 2.5 0 0 1-2.5 2.5H9l-4 4v-4h0.5A2.5 2.5 0 0 1 3 10.5z" />
    </svg>
  );
}

/** Stav pre hráča: plánujeme, hotovo (s odkazom na novinku) a nebudeme robiť (s vetou prečo). */
function StavNazoru({ n }: { readonly n: Nazor }) {
  if (n.stav === "nove" || n.stav === "prijate") return null;
  return (
    <span className={`nazor-stav ${n.stav}`}>
      {STAVY[n.stav]}
      {n.stav === "hotove" && n.novinka !== null && (
        <>
          {" · "}
          <Odkaz href={`/novinky#novinka-${n.novinka.id}`} title={n.novinka.nadpis}>
            v Novinkách {kratkyDen(n.novinka.datum)} →
          </Odkaz>
        </>
      )}
      {n.stav === "zamietnute" && n.dovod !== "" && <span className="nazor-dovod"> — prečo: {n.dovod}</span>}
    </span>
  );
}

/** Správca mení stav výberom ako doteraz; pri „hotovo“ vyberie novinku, pri „nebudeme robiť“ napíše prečo. */
function SpravaStavu({
  n,
  novinky,
  obnov,
  chyba,
}: {
  readonly n: Nazor;
  readonly novinky: readonly NovinkaVyber[];
  readonly obnov: () => void;
  readonly chyba: (e: unknown) => void;
}) {
  const [stav, setStav] = useState<Stav>(n.stav);
  const [novinka, setNovinka] = useState(n.novinka === null ? "" : String(n.novinka.id));
  const [dovod, setDovod] = useState(n.dovod);
  useEffect(() => {
    setStav(n.stav);
    setNovinka(n.novinka === null ? "" : String(n.novinka.id));
    setDovod(n.dovod);
  }, [n.stav, n.novinka, n.dovod]);

  const uloz = (telo: Record<string, unknown>): void => {
    api.patch(`/nazory/${n.id}`, telo).then(obnov).catch(chyba);
  };
  const zmenene =
    stav !== n.stav || (stav === "hotove" && novinka !== (n.novinka === null ? "" : String(n.novinka.id))) || (stav === "zamietnute" && dovod.trim() !== n.dovod);

  return (
    <div className="nazor-sprava">
      <select
        className="nazor-stav-vyber"
        value={stav}
        aria-label="Stav názoru"
        onChange={(e) => {
          const s = e.target.value as Stav;
          setStav(s);
          // Hotovo a nebudeme sa uložia až s novinkou alebo dôvodom.
          if (s !== "hotove" && s !== "zamietnute") uloz({ stav: s });
        }}
      >
        {(Object.keys(STAVY) as Stav[]).map((s) => (
          <option key={s} value={s}>
            {STAVY[s]}
          </option>
        ))}
      </select>
      {stav === "hotove" && (
        <select className="nazor-stav-vyber" value={novinka} aria-label="Novinka, v ktorej je to hotové" onChange={(e) => setNovinka(e.target.value)}>
          <option value="">bez novinky</option>
          {novinky.map((v) => (
            <option key={v.id} value={v.id}>
              {kratkyDen(v.datum)} · {v.nadpis}
            </option>
          ))}
        </select>
      )}
      {stav === "zamietnute" && (
        <input
          className="nazor-dovod-pole"
          value={dovod}
          maxLength={MAX_DOVOD}
          onChange={(e) => setDovod(e.target.value)}
          placeholder="Prečo nie — jednou vetou (hráč ju uvidí)"
          aria-label="Prečo to nebudeme robiť"
        />
      )}
      {(stav === "hotove" || stav === "zamietnute") && zmenene && (
        <button
          type="button"
          className="tlacidlo-hlavne tlacidlo-male"
          disabled={stav === "zamietnute" && dovod.trim() === ""}
          onClick={() => uloz(stav === "hotove" ? { stav, novinka: novinka === "" ? null : Number(novinka) } : { stav, dovod })}
        >
          Uložiť stav
        </button>
      )}
    </div>
  );
}

function NazorRiadok({
  n,
  ja,
  ukazAi,
  novinky,
  obnov,
  chyba,
}: {
  readonly n: Nazor;
  readonly ja: Pouzivatel;
  readonly ukazAi: boolean;
  readonly novinky: readonly NovinkaVyber[];
  readonly obnov: () => void;
  readonly chyba: (e: unknown) => void;
}) {
  const komentare = ukazAi ? n.komentare : n.komentare.filter((k) => !k.autor.ai);
  const [cig, setCig] = useState({ pocet: n.cigarety, moja: n.mojaCigareta });
  const [otvoreny, setOtvoreny] = useState(false);
  const [komentar, setKomentar] = useState("");
  const [uprava, setUprava] = useState<{ readonly nadpis: string; readonly text: string } | null>(null);
  const [posiela, setPosiela] = useState(false);
  useEffect(() => setCig({ pocet: n.cigarety, moja: n.mojaCigareta }), [n.cigarety, n.mojaCigareta]);
  const moj = n.autor.id === ja.id;
  const admin = jeSpravca(ja.rola);
  // Komentáre a cigarety podľa práva ranku (Michal 2026-10-22).
  const pise = maPravo(ja, "spatna_vazba_reagovat");
  const { titul, ukazka } = n.nadpis !== "" ? { titul: n.nadpis, ukazka: n.text } : titulZTextu(n.text);

  const prepniCigaretu = () => {
    const dat = !cig.moja;
    api[dat ? "put" : "del"]<{ cigarety: number }>(`/nazory/${n.id}/cigareta`)
      .then((r) => setCig({ pocet: r.cigarety, moja: dat }))
      .catch(chyba);
  };

  const pridajKomentar = (e: FormEvent) => {
    e.preventDefault();
    setPosiela(true);
    api
      .post(`/nazory/${n.id}/komentare`, { text: komentar })
      .then(() => {
        setKomentar("");
        obnov();
      })
      .catch(chyba)
      .finally(() => setPosiela(false));
  };

  const ulozUpravu = (e: FormEvent) => {
    e.preventDefault();
    if (uprava === null) return;
    api
      .patch(`/nazory/${n.id}`, { nadpis: uprava.nadpis, text: uprava.text })
      .then(() => {
        setUprava(null);
        obnov();
      })
      .catch(chyba);
  };

  return (
    <article id={`nazor-${n.id}`} tabIndex={-1} className={`panel nazor-riadok stav-${n.stav}`} aria-labelledby={`nazor-${n.id}-titul`}>
      <h3 id={`nazor-${n.id}-titul`} className="nazor-titul">
        <button type="button" aria-expanded={otvoreny} aria-controls={`nazor-${n.id}-telo`} onClick={() => setOtvoreny(!otvoreny)}>
          {titul}
        </button>
      </h3>
      <div className="nazor-meta">
        <span className={`nazor-kategoria kat-${n.kategoria}`}>{KATEGORIE[n.kategoria]}</span>
        <MenoAutora autor={n.autor} />
        <span className="tlmene">
          {kedy(n.vytvoreny)}
          {n.upraveny !== null && " · upravené"}
        </span>
      </div>

      {!otvoreny ? (
        ukazka !== "" && <p className="nazor-ukazka">{ukazka}</p>
      ) : (
        <div id={`nazor-${n.id}-telo`} className="nazor-telo">
          {uprava === null ? (
            <p className="nazor-text">{n.text}</p>
          ) : (
            <form className="nazor-uprava" onSubmit={ulozUpravu}>
              <input value={uprava.nadpis} onChange={(e) => setUprava({ ...uprava, nadpis: e.target.value })} maxLength={MAX_NADPIS} aria-label="Jednou vetou" placeholder="Jednou vetou (nepovinné)" />
              <textarea value={uprava.text} onChange={(e) => setUprava({ ...uprava, text: e.target.value })} maxLength={MAX_NAZOR} rows={5} autoFocus aria-label="Podrobnosti" />
              <div className="riadok-tlacidiel">
                <button type="submit" className="tlacidlo-hlavne tlacidlo-male" disabled={uprava.text.trim().length < 3}>
                  Uložiť
                </button>
                <button type="button" className="tlacidlo-male tlacidlo-jemne" onClick={() => setUprava(null)}>
                  Zrušiť
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      <div className="nazor-pata">
        <TlacidloCigarety pocet={cig.pocet} moja={cig.moja} vlastne={moj} prepni={prepniCigaretu} navstevnik={!pise} />
        <button
          type="button"
          className="tlacidlo-male tlacidlo-jemne nazor-komentare-tlacidlo"
          onClick={() => setOtvoreny(!otvoreny)}
          aria-expanded={otvoreny}
          aria-label={`${komentare.length} ${tvar(komentare.length, "komentár", "komentáre", "komentárov")}${otvoreny ? "" : " — otvoriť"}`}
        >
          <IkonaBubliny /> {komentare.length}
        </button>
        <StavNazoru n={n} />
        {admin && <SpravaStavu n={n} novinky={novinky} obnov={obnov} chyba={chyba} />}
        {otvoreny && moj && uprava === null && (
          <button type="button" className="tlacidlo-male tlacidlo-jemne" onClick={() => setUprava({ nadpis: n.nadpis, text: n.text })}>
            upraviť
          </button>
        )}
        {otvoreny && (moj || admin) && (
          <PotvrdTlacidlo
            text="zmazať"
            potvrdenie="naozaj zmazať?"
            akcia={() => {
              api.del(`/nazory/${n.id}`).then(obnov).catch(chyba);
            }}
          />
        )}
      </div>

      {otvoreny && (komentare.length > 0 || pise) && (
        <div className="komentare">
          {komentare.length > 0 && (
            <ul>
              {komentare.map((k) => (
                <KomentarPolozka key={k.id} k={k} ja={ja} obnov={obnov} chyba={chyba} />
              ))}
            </ul>
          )}
          {pise && (
            <form className="komentar-novy" onSubmit={pridajKomentar}>
              <Avatar meno={ja.meno} avatar={ja.avatar} velkost={30} />
              <textarea
                value={komentar}
                onChange={(e) => setKomentar(e.target.value)}
                maxLength={MAX_KOMENTAR}
                rows={komentar.length > 80 ? 3 : 1}
                placeholder="Napíš komentár…"
                aria-label="Nový komentár"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && komentar.trim().length >= 3) {
                    e.preventDefault();
                    e.currentTarget.form?.requestSubmit();
                  }
                }}
              />
              <button type="submit" className="tlacidlo-male" disabled={posiela || komentar.trim().length < 3}>
                Odoslať
              </button>
            </form>
          )}
        </div>
      )}
    </article>
  );
}

function NovyNazor({ pridany, zrus, chyba }: { readonly pridany: (id: number) => void; readonly zrus: () => void; readonly chyba: (e: unknown) => void }) {
  const [kategoria, setKategoria] = useState<Kategoria | null>(null);
  const [nadpis, setNadpis] = useState("");
  const [text, setText] = useState("");
  const [bezKategorie, setBezKategorie] = useState(false);
  const [kratky, setKratky] = useState(false);
  const podrobnosti = useRef<HTMLTextAreaElement>(null);
  const [posiela, setPosiela] = useState(false);
  const prva = useRef<HTMLInputElement>(null);
  useEffect(() => {
    prva.current?.focus();
    prva.current?.closest("form")?.scrollIntoView({ block: "nearest" });
  }, []);

  const odosli = (e: FormEvent) => {
    e.preventDefault();
    if (kategoria === null) {
      setBezKategorie(true);
      prva.current?.focus();
      return;
    }
    if (text.trim().length < 3) {
      setKratky(true);
      podrobnosti.current?.focus();
      return;
    }
    setPosiela(true);
    api
      .post<{ id: number }>("/nazory", { kategoria, nadpis, text })
      .then((r) => pridany(r.id))
      .catch(chyba)
      .finally(() => setPosiela(false));
  };

  return (
    <form className="panel novy-nazor" onSubmit={odosli} aria-labelledby="novy-nazor-nadpis" noValidate>
      <h2 id="novy-nazor-nadpis">Napísať názor</h2>
      <fieldset className="novy-nazor-kategorie">
        <legend>O čom píšeš?</legend>
        <div className="cipy" role="radiogroup" aria-label="O čom píšeš?" aria-required="true" aria-invalid={bezKategorie} aria-describedby={bezKategorie ? "novy-nazor-bez-kategorie" : undefined}>
          {(Object.keys(KATEGORIE) as Kategoria[]).map((k, i) => (
            <label key={k} className={`cip ${kategoria === k ? "aktivny" : ""}`}>
              <input
                ref={i === 0 ? prva : undefined}
                type="radio"
                name="kategoria-nazoru"
                value={k}
                checked={kategoria === k}
                onChange={() => {
                  setKategoria(k);
                  setBezKategorie(false);
                }}
              />
              {KATEGORIE[k]}
            </label>
          ))}
        </div>
        {bezKategorie && (
          <p id="novy-nazor-bez-kategorie" className="novy-nazor-chyba" role="alert">
            Vyber, o čom píšeš.
          </p>
        )}
      </fieldset>
      <label className="novy-nazor-pole">
        <span>
          Jednou vetou <span className="tlmene">(nepovinné)</span>
        </span>
        <input value={nadpis} onChange={(e) => setNadpis(e.target.value)} maxLength={MAX_NADPIS} placeholder="napr. „Puška v Dedičstve sa nesčítava“" />
      </label>
      <label className="novy-nazor-pole">
        <span>Podrobnosti</span>
        <textarea
          ref={podrobnosti}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setKratky(false);
          }}
          maxLength={MAX_NAZOR}
          rows={5}
          aria-invalid={kratky}
          aria-describedby={kratky ? "novy-nazor-kratky" : undefined}
          placeholder={kategoria === "chyba" ? "Čo si robil, čo si čakal a čo sa stalo…" : "Čo ťa bavilo, čo nedáva zmysel, ktorá karta je prisilná, čo by si zmenil…"}
        />
        {kratky && (
          <span id="novy-nazor-kratky" className="novy-nazor-chyba" role="alert">
            Napíš aspoň pár slov.
          </span>
        )}
      </label>
      <div className="novy-nazor-spodok">
        <span className="tlmene">
          {text.length} / {MAX_NAZOR}
        </span>
        <div className="riadok-tlacidiel">
          <button type="button" className="tlacidlo-jemne" onClick={zrus}>
            Zrušiť
          </button>
          <button type="submit" className="tlacidlo-hlavne" disabled={posiela}>
            {posiela ? "Posielam…" : "Zverejniť"}
          </button>
        </div>
      </div>
    </form>
  );
}

export function SpatnaVazba() {
  useTitulok("Spätná väzba");
  const { ja, obnov: obnovUcet } = useUcet();
  const [nazory, setNazory] = useState<readonly Nazor[] | null>(null);
  const [pocty, setPocty] = useState<Pocty | null>(null);
  const [zalozka, setZalozka] = useState<Zalozka>("otvorene");
  const [triedenie, setTriedenie] = useState<Triedenie>("nove");
  const [filter, setFilter] = useState<Kategoria | null>(null);
  const [ukazAi, setUkazAi] = useState(citajUkazAi);
  const [pise, setPise] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const [oznam, setOznam] = useState("");
  const [fokus, setFokus] = useState<number | null>(null);
  const [novinky, setNovinky] = useState<readonly NovinkaVyber[]>([]);
  const tlacidloPisat = useRef<HTMLButtonElement>(null);
  const spravca = ja !== null && jeSpravca(ja.rola);

  const ukazChybu = useCallback((e: unknown) => setChyba(e instanceof Error ? e.message : String(e)), []);

  const obnov = useCallback(() => {
    const q = new URLSearchParams({ triedenie, stav: zalozka });
    if (filter !== null) q.set("kategoria", filter);
    if (!ukazAi) q.set("ai", "0");
    api
      .get<{ nazory: Nazor[]; pocty: Pocty }>(`/nazory?${q.toString()}`)
      .then((r) => {
        setNazory(r.nazory);
        setPocty(r.pocty);
        setChyba(null);
      })
      .catch(ukazChybu);
  }, [triedenie, zalozka, filter, ukazAi, ukazChybu]);

  useEffect(obnov, [obnov]);
  // Úroveň sa mení počas partie (hráčom po prvej dohratej partii) — klient mohol mať starú.
  useEffect(obnovUcet, [obnovUcet]);
  // Správca pri „hotovo“ vyberá novinku.
  useEffect(() => {
    if (!spravca) return;
    api
      .get<{ novinky: NovinkaVyber[] }>("/novinky")
      .then((r) => setNovinky(r.novinky))
      .catch(() => undefined);
  }, [spravca]);
  // Po zverejnení ide fokus na nový názor (aria-live ho oznámi).
  useEffect(() => {
    if (fokus === null || nazory === null) return;
    const el = document.getElementById(`nazor-${fokus}`);
    if (el === null) return;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: "center" });
    setFokus(null);
  }, [fokus, nazory]);

  if (ja === null) return null;
  const smiePisat = maPravo(ja, "spatna_vazba_pisat");
  const pocet = (z: Zalozka): number | null => (pocty === null ? null : pocty[z].ludia + (ukazAi ? pocty[z].ai : 0));
  const ludiaTu = pocty?.[zalozka].ludia ?? 0;
  const aiTu = pocty?.[zalozka].ai ?? 0;
  const spolu = pocty === null ? null : (Object.keys(ZALOZKY) as Zalozka[]).reduce((s, z) => s + (pocet(z) ?? 0), 0);

  const prepniAi = (v: boolean): void => {
    setUkazAi(v);
    ulozUkazAi(v);
  };
  const otvorPisanie = (): void => {
    setOznam("");
    setPise(true);
  };
  const pridany = (id: number): void => {
    setPise(false);
    setFilter(null);
    setTriedenie("nove");
    setZalozka("otvorene");
    if (ja.ai === true) prepniAi(true);
    setOznam("Názor je zverejnený. Ďakujeme — tvorca ho uvidí medzi novými.");
    setFokus(id);
    obnov();
  };

  const napisatPrvy = smiePisat && (
    <button type="button" className="tlacidlo" onClick={otvorPisanie}>
      Napísať prvý názor
    </button>
  );

  return (
    <div className="spatna-vazba">
      <HlavaStranky
        nadpis="Spätná väzba"
        uvod="Čo funguje, čo nie a čo by si zmenil. Tvorca pri každom názore označí, čo s ním urobí."
        akcia={
          <>
            {spolu !== null && (
              <span>
                {spolu} {tvar(spolu, "názor", "názory", "názorov")} · {pocet("hotove") ?? 0} {tvar(pocet("hotove") ?? 0, "hotový", "hotové", "hotových")}
              </span>
            )}
            {smiePisat ? (
              <button ref={tlacidloPisat} type="button" className="tlacidlo-hlavne" onClick={otvorPisanie} aria-expanded={pise}>
                ✎ Napísať názor
              </button>
            ) : (
              <span>Tvoj rank spätnú väzbu zatiaľ len číta — písať môžeš po prvej dohratej partii.</span>
            )}
          </>
        }
      />
      <p className="len-citacka" aria-live="polite">
        {oznam}
      </p>

      <div className="mriezka">
        <div className="st-obsah nazory-obsah">
          {pise && (
            <NovyNazor
              pridany={pridany}
              zrus={() => {
                setPise(false);
                tlacidloPisat.current?.focus();
              }}
              chyba={ukazChybu}
            />
          )}

          <div className="nazory-zalozky" role="group" aria-label="Stav názorov">
            {(Object.keys(ZALOZKY) as Zalozka[]).map((z) => (
              <button key={z} type="button" className={zalozka === z ? "aktivna" : undefined} aria-pressed={zalozka === z} onClick={() => setZalozka(z)}>
                {ZALOZKY[z]}
                <small>{pocet(z) ?? ""}</small>
              </button>
            ))}
          </div>

          <div className="nazory-filtre">
            <label>
              <span className="tlmene">Kategória</span>
              <select value={filter ?? ""} onChange={(e) => setFilter(e.target.value === "" ? null : (e.target.value as Kategoria))}>
                <option value="">všetky</option>
                {(Object.keys(KATEGORIE) as Kategoria[]).map((k) => (
                  <option key={k} value={k}>
                    {KATEGORIE[k]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="tlmene">Zoradiť</span>
              <select value={triedenie} onChange={(e) => setTriedenie(e.target.value as Triedenie)}>
                <option value="nove">najnovšie</option>
                <option value="cigarety">najviac cigariet</option>
                <option value="diskusia">najživšia diskusia</option>
              </select>
            </label>
            <div className="nazory-ai" role="group" aria-label="Kto písal">
              <button type="button" aria-pressed={!ukazAi} onClick={() => prepniAi(false)}>
                Od ľudí <small>{ludiaTu}</small>
              </button>
              <button type="button" aria-pressed={ukazAi} onClick={() => prepniAi(true)}>
                Aj od AI playtesterov <small>{ludiaTu + aiTu}</small>
              </button>
            </div>
          </div>

          {chyba !== null && <Hlaska>{chyba}</Hlaska>}

          {nazory === null ? (
            chyba === null && <Nacitavanie />
          ) : nazory.length === 0 ? (
            <div className="panel nazory-prazdne">
              {!ukazAi && aiTu > 0 ? (
                <>
                  <p>
                    Od ľudí tu zatiaľ nič nie je. AI playtesteri po partiách napísali {aiTu} {tvar(aiTu, "postreh", "postrehy", "postrehov")}.
                  </p>
                  <div className="riadok-tlacidiel">
                    <button type="button" className="tlacidlo" onClick={() => prepniAi(true)}>
                      Ukázať ich
                    </button>
                    {napisatPrvy}
                  </div>
                </>
              ) : (
                <>
                  <p>{zalozka === "otvorene" && filter === null ? "Zatiaľ tu nie je žiadny názor." : "V tejto záložke zatiaľ nič nie je."}</p>
                  {zalozka === "otvorene" && napisatPrvy}
                </>
              )}
            </div>
          ) : (
            <div className="nazory">
              {nazory.map((n) => (
                <NazorRiadok key={n.id} n={n} ja={ja} ukazAi={ukazAi} novinky={novinky} obnov={obnov} chyba={ukazChybu} />
              ))}
            </div>
          )}
        </div>

        <aside className="st-bok nazory-bok">
          <HodnotenieHry kompaktne smiePisat={maPravo(ja, "hodnotit_hru") || ja.ai === true} />
        </aside>
      </div>
    </div>
  );
}
