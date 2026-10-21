// Spätná väzba (/spatna-vazba): hráči píšu, čo si o hre myslia, ostatní
// komentujú a dávajú cigarety (obdoba „páči sa mi“). Admin mení stav názoru.

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "../lib/api.ts";
import { Odkaz, useTitulok } from "../lib/router.tsx";
import { jeSpravca, useUcet, type Pouzivatel } from "../lib/ucet.tsx";
import { Avatar, Hlaska, Nacitavanie } from "../komponenty.tsx";
import { tvar } from "./Statistiky.tsx";
import { HodnotenieHry } from "./HodnotenieHry.tsx";
import "./statistiky.css";

const KATEGORIE = {
  pravidla: "Pravidlá a balans",
  karty: "Karty",
  hranie: "Hranie a ovládanie",
  web: "Web a vzhľad",
  chyba: "Chyba",
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
  readonly text: string;
  readonly stav: Stav;
  readonly vytvoreny: number;
  readonly upraveny: number | null;
  readonly cigarety: number;
  readonly mojaCigareta: boolean;
  readonly komentare: readonly Komentar[];
}

const MAX_NAZOR = 3000;
const MAX_KOMENTAR = 1000;

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
    ? "Cigarety dávajú hráči — hráčom si po prvej odohranej bitke."
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
          <TlacidloCigarety pocet={stav.pocet} moja={stav.moja} vlastne={k.autor.id === ja.id} prepni={prepni} navstevnik={ja.rola === "navstevnik"} />
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

function NazorKarta({
  n,
  ja,
  ukazAi,
  obnov,
  chyba,
}: {
  readonly n: Nazor;
  readonly ja: Pouzivatel;
  readonly ukazAi: boolean;
  readonly obnov: () => void;
  readonly chyba: (e: unknown) => void;
}) {
  const komentare = ukazAi ? n.komentare : n.komentare.filter((k) => !k.autor.ai);
  const [cig, setCig] = useState({ pocet: n.cigarety, moja: n.mojaCigareta });
  const [otvorene, setOtvorene] = useState(komentare.length > 0 && komentare.length <= 3);
  const [komentar, setKomentar] = useState("");
  const [uprava, setUprava] = useState<string | null>(null);
  const [posiela, setPosiela] = useState(false);
  useEffect(() => setCig({ pocet: n.cigarety, moja: n.mojaCigareta }), [n.cigarety, n.mojaCigareta]);
  const moj = n.autor.id === ja.id;
  const admin = jeSpravca(ja.rola);
  const pise = ja.rola !== "navstevnik";

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
    api
      .patch(`/nazory/${n.id}`, { text: uprava })
      .then(() => {
        setUprava(null);
        obnov();
      })
      .catch(chyba);
  };

  return (
    <article className={`panel nazor stav-${n.stav}`}>
      <header className="nazor-hlava">
        <Avatar meno={n.autor.meno} avatar={n.autor.avatar} velkost={40} />
        <div>
          <div className="nazor-meta">
            <MenoAutora autor={n.autor} />
            <span className="tlmene">
              {kedy(n.vytvoreny)}
              {n.upraveny !== null && " · upravené"}
            </span>
          </div>
          <div className="nazor-znacky">
            <span className={`nazor-kategoria kat-${n.kategoria}`}>{KATEGORIE[n.kategoria]}</span>
            {n.stav !== "nove" && <span className={`nazor-stav ${n.stav}`}>{STAVY[n.stav]}</span>}
          </div>
        </div>
        {admin && (
          <select
            className="nazor-stav-vyber"
            value={n.stav}
            aria-label="Stav názoru"
            onChange={(e) => {
              api.patch(`/nazory/${n.id}`, { stav: e.target.value }).then(obnov).catch(chyba);
            }}
          >
            {(Object.keys(STAVY) as Stav[]).map((s) => (
              <option key={s} value={s}>
                {STAVY[s]}
              </option>
            ))}
          </select>
        )}
      </header>

      {uprava === null ? (
        <p className="nazor-text">{n.text}</p>
      ) : (
        <form className="nazor-uprava" onSubmit={ulozUpravu}>
          <textarea value={uprava} onChange={(e) => setUprava(e.target.value)} maxLength={MAX_NAZOR} rows={5} autoFocus aria-label="Upraviť názor" />
          <div className="riadok-tlacidiel">
            <button type="submit" className="tlacidlo-hlavne tlacidlo-male" disabled={uprava.trim().length < 3}>
              Uložiť
            </button>
            <button type="button" className="tlacidlo-male tlacidlo-jemne" onClick={() => setUprava(null)}>
              Zrušiť
            </button>
          </div>
        </form>
      )}

      <div className="nazor-akcie">
        <TlacidloCigarety pocet={cig.pocet} moja={cig.moja} vlastne={moj} prepni={prepniCigaretu} navstevnik={!pise} />
        <button type="button" className="tlacidlo-male tlacidlo-jemne" onClick={() => setOtvorene(!otvorene)} aria-expanded={otvorene}>
          {komentare.length === 0 ? (pise ? "komentovať" : "0 komentárov") : `${komentare.length} ${tvar(komentare.length, "komentár", "komentáre", "komentárov")}`}
        </button>
        {moj && uprava === null && (
          <button type="button" className="tlacidlo-male tlacidlo-jemne" onClick={() => setUprava(n.text)}>
            upraviť
          </button>
        )}
        {(moj || admin) && (
          <PotvrdTlacidlo
            text="zmazať"
            potvrdenie="naozaj zmazať?"
            akcia={() => {
              api.del(`/nazory/${n.id}`).then(obnov).catch(chyba);
            }}
          />
        )}
      </div>

      {otvorene && (
        <div className="komentare">
          {komentare.length > 0 && (
            <ul>
              {komentare.map((k) => (
                <KomentarPolozka key={k.id} k={k} ja={ja} obnov={obnov} chyba={chyba} />
              ))}
            </ul>
          )}
          {pise && <form className="komentar-novy" onSubmit={pridajKomentar}>
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
          </form>}
        </div>
      )}
    </article>
  );
}

function NovyNazor({ pridany, chyba }: { readonly pridany: () => void; readonly chyba: (e: unknown) => void }) {
  const [kategoria, setKategoria] = useState<Kategoria>("pravidla");
  const [text, setText] = useState("");
  const [posiela, setPosiela] = useState(false);

  const odosli = (e: FormEvent) => {
    e.preventDefault();
    setPosiela(true);
    api
      .post("/nazory", { kategoria, text })
      .then(() => {
        setText("");
        pridany();
      })
      .catch(chyba)
      .finally(() => setPosiela(false));
  };

  return (
    <form className="panel novy-nazor" onSubmit={odosli}>
      <h2>Napíš, čo si myslíš</h2>
      <div className="cipy" role="radiogroup" aria-label="Kategória">
        {(Object.keys(KATEGORIE) as Kategoria[]).map((k) => (
          <button key={k} type="button" role="radio" aria-checked={kategoria === k} className={`cip ${kategoria === k ? "aktivny" : ""}`} onClick={() => setKategoria(k)}>
            {KATEGORIE[k]}
          </button>
        ))}
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={MAX_NAZOR}
        rows={4}
        placeholder="Čo ťa bavilo, čo nedáva zmysel, ktorá karta je prisilná, čo by si zmenil…"
        aria-label="Text názoru"
      />
      <div className="novy-nazor-spodok">
        <span className="tlmene">
          {text.length} / {MAX_NAZOR}
        </span>
        <button type="submit" className="tlacidlo-hlavne" disabled={posiela || text.trim().length < 3}>
          {posiela ? "Posielam…" : "Zverejniť"}
        </button>
      </div>
    </form>
  );
}

export function SpatnaVazba() {
  useTitulok("Spätná väzba");
  const { ja, obnov: obnovUcet } = useUcet();
  const [nazory, setNazory] = useState<readonly Nazor[] | null>(null);
  const [triedenie, setTriedenie] = useState<Triedenie>("nove");
  const [filter, setFilter] = useState<Kategoria | null>(null);
  const [ukazAi, setUkazAi] = useState(citajUkazAi);
  const [chyba, setChyba] = useState<string | null>(null);

  const ukazChybu = useCallback((e: unknown) => setChyba(e instanceof Error ? e.message : String(e)), []);

  const obnov = useCallback(() => {
    const q = new URLSearchParams({ triedenie });
    if (filter !== null) q.set("kategoria", filter);
    api
      .get<{ nazory: Nazor[] }>(`/nazory?${q.toString()}`)
      .then((r) => {
        setNazory(r.nazory);
        setChyba(null);
      })
      .catch(ukazChybu);
  }, [triedenie, filter, ukazChybu]);

  useEffect(obnov, [obnov]);
  // Úroveň sa mení počas partie (hráčom po prvej bitke) — klient mohol mať starú.
  useEffect(obnovUcet, [obnovUcet]);

  if (ja === null) return null;
  const odAi = nazory?.filter((n) => n.autor.ai).length ?? 0;
  const viditelne = nazory === null || ukazAi ? nazory : nazory.filter((n) => !n.autor.ai);

  return (
    <div className="spatna-vazba">
      <header className="stranka-hlava">
        <h1>Spätná väzba</h1>
        <p className="tlmene">
          NA EX! sa ešte ladí a tvoj názor ho posunie. Napíš, čo funguje a čo nie. Ostatní hráči môžu komentovať a za dobrý postreh ti dať{" "}
          <strong>cigaretu</strong>. Tvorca hry pri každom názore označí, či ho plánuje.
        </p>
      </header>

      {chyba !== null && <Hlaska>{chyba}</Hlaska>}
      <HodnotenieHry smiePisat={ja.rola !== "navstevnik" || ja.ai === true} />
      {ja.rola === "navstevnik" ? (
        <p className="panel tlmene">
          Ako <strong>návštevník</strong> spätnú väzbu zatiaľ len čítaš. Písať názory, komentovať, dávať cigarety a hodnotiť hru môžeš po prvej
          odohranej bitke — stačí aj partia proti botovi. Vtedy sa staneš hráčom.
        </p>
      ) : (
        <NovyNazor pridany={obnov} chyba={ukazChybu} />
      )}

      <div className="nazory-ovladanie">
        <div className="cipy" aria-label="Filter kategórie">
          <button type="button" className={`cip ${filter === null ? "aktivny" : ""}`} onClick={() => setFilter(null)}>
            Všetko
          </button>
          {(Object.keys(KATEGORIE) as Kategoria[]).map((k) => (
            <button key={k} type="button" className={`cip ${filter === k ? "aktivny" : ""}`} onClick={() => setFilter(filter === k ? null : k)}>
              {KATEGORIE[k]}
            </button>
          ))}
        </div>
        <label className="nazory-triedenie">
          <span className="tlmene">Zoradiť</span>
          <select value={triedenie} onChange={(e) => setTriedenie(e.target.value as Triedenie)}>
            <option value="nove">najnovšie</option>
            <option value="cigarety">najviac cigariet</option>
            <option value="diskusia">najživšia diskusia</option>
          </select>
        </label>
        <label className="nazory-ai" title="Názory a komentáre AI agentov z playtestov">
          <input
            type="checkbox"
            checked={ukazAi}
            onChange={(e) => {
              setUkazAi(e.target.checked);
              ulozUkazAi(e.target.checked);
            }}
          />
          <span>
            Zobraziť aj spätnú väzbu od AI{odAi > 0 && <span className="tlmene"> ({odAi})</span>}
          </span>
        </label>
      </div>

      {viditelne === null ? (
        <Nacitavanie />
      ) : viditelne.length === 0 ? (
        <p className="tlmene nazory-prazdne">
          {filter === null ? "Zatiaľ tu nie je žiadny názor. Napíš prvý." : "V tejto kategórii zatiaľ nič nie je."}
          {odAi > 0 && !ukazAi && ` Skrytých názorov od AI: ${odAi}.`}
        </p>
      ) : (
        <div className="nazory">
          {viditelne.map((n) => (
            <NazorKarta key={n.id} n={n} ja={ja} ukazAi={ukazAi} obnov={obnov} chyba={ukazChybu} />
          ))}
        </div>
      )}
    </div>
  );
}
