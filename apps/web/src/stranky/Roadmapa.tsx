// Roadmapa hry (Michal 2026-10-21): stĺpce sú abstraktné horizonty, poradie
// v stĺpci je priorita. Vidí ju každý; admin a subadmin ju upravujú —
// ťahaním myšou, klávesmi Alt+šípky alebo v detaile položky. Schválené
// návrhy z playtestov sa do Prijímača dostanú samy (server, roadmapa.ts).

import { useCallback, useEffect, useRef, useState, type DragEvent, type FormEvent, type KeyboardEvent } from "react";
import { api } from "../lib/api.ts";
import { Odkaz } from "../lib/router.tsx";
import { Hlaska, Nacitavanie } from "../komponenty.tsx";

type Oblast = "pravidla" | "ui" | "karty" | "2v2" | "platforma" | "komunita";
type Narocnost = "S" | "M" | "L";
type StavPolozky = "napad" | "nove" | "rozhodnute" | "overit" | "rozpracovane" | "hotove";

interface Stlpec {
  readonly kluc: string;
  readonly nazov: string;
  readonly horizont: string;
  readonly zamer: string;
  readonly verejny: boolean;
}

interface Polozka {
  readonly id: number;
  readonly stlpec: string;
  readonly poradie: number;
  readonly nazov: string;
  readonly kratko: string;
  readonly preco: string;
  readonly hotovo: string;
  readonly oblast: Oblast;
  readonly narocnost: Narocnost;
  readonly stav: StavPolozky;
  readonly zdroj: { readonly typ: string; readonly text: string; readonly odkaz: string } | null;
  readonly zavisi: readonly number[];
  readonly commit: string;
  readonly navrh: number | null;
  readonly verejna: boolean;
  readonly dokoncena: number | null;
}

const OBLASTI: Readonly<Record<Oblast, string>> = {
  pravidla: "Pravidlá a balans",
  ui: "Rozhranie",
  karty: "Karty",
  "2v2": "2 na 2",
  platforma: "Platforma",
  komunita: "Ľudia a komunita",
};
const NAROCNOSTI: Readonly<Record<Narocnost, string>> = { S: "malá", M: "stredná", L: "veľká" };
const STAVY: Readonly<Record<StavPolozky, string>> = {
  napad: "nápad",
  nove: "na rozhodnutie",
  rozhodnute: "rozhodnuté",
  overit: "treba overiť",
  rozpracovane: "rozpracované",
  hotove: "hotové",
};

const datum = (cas: number): string => new Date(cas).toLocaleDateString("sk-SK", { day: "numeric", month: "numeric" });

function Karta({
  p,
  poradie,
  upravuje,
  otvor,
  presunKlavesom,
  tahaj,
}: {
  readonly p: Polozka;
  readonly poradie: number;
  readonly upravuje: boolean;
  readonly otvor: () => void;
  readonly presunKlavesom: (smer: "hore" | "dole" | "vlavo" | "vpravo") => void;
  readonly tahaj: (id: number | null) => void;
}) {
  const hotova = p.stlpec === "hotove";
  const klavesy = (e: KeyboardEvent<HTMLElement>): void => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      otvor();
      return;
    }
    if (!upravuje || !e.altKey) return;
    const smer = ({ ArrowUp: "hore", ArrowDown: "dole", ArrowLeft: "vlavo", ArrowRight: "vpravo" } as const)[e.key as "ArrowUp"];
    if (smer !== undefined) {
      e.preventDefault();
      presunKlavesom(smer);
    }
  };
  return (
    <article
      className={`rm-polozka obl-${p.oblast} ${hotova ? "hotova" : ""} ${p.verejna ? "" : "skryta"}`}
      data-id={p.id}
      tabIndex={0}
      aria-label={`${poradie}. ${p.nazov}`}
      draggable={upravuje}
      onClick={otvor}
      onKeyDown={klavesy}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(p.id));
        tahaj(p.id);
      }}
      onDragEnd={() => tahaj(null)}
    >
      <div className="rm-polozka-hlava">
        <span className="rm-poradie">{poradie}.</span>
        <span className="rm-oblast">
          <i aria-hidden="true" />
          {OBLASTI[p.oblast]}
        </span>
        <span className="rm-narocnost" title={`náročnosť ${NAROCNOSTI[p.narocnost]}`}>
          {p.narocnost}
        </span>
      </div>
      <h4>{p.nazov}</h4>
      {p.kratko !== "" && <p className="rm-kratko">{p.kratko}</p>}
      <div className="rm-stitky">
        {p.zdroj !== null && <span className={`rm-stitok zdroj-${p.zdroj.typ}`}>{p.zdroj.text}</span>}
        {!hotova && <span className={`rm-stitok stav-${p.stav}`}>{STAVY[p.stav]}</span>}
        {p.zavisi.length > 0 && !hotova && <span className="rm-stitok zavisi">↳ po {p.zavisi.length}</span>}
        {hotova && p.dokoncena !== null && <span className="rm-stitok">{datum(p.dokoncena)}</span>}
        {!p.verejna && <span className="rm-stitok">skrytá</span>}
      </div>
    </article>
  );
}

function Detail({
  p,
  vsetky,
  stlpce,
  upravuje,
  zavri,
  otvor,
  ulozene,
  presun,
}: {
  readonly p: Polozka | "nova";
  readonly vsetky: readonly Polozka[];
  readonly stlpce: readonly Stlpec[];
  readonly upravuje: boolean;
  readonly zavri: () => void;
  readonly otvor: (id: number) => void;
  readonly ulozene: () => void;
  readonly presun: (id: number, stlpec: string, pred: number | null) => void;
}) {
  const nova = p === "nova";
  const [uprava, setUprava] = useState(nova);
  const [chyba, setChyba] = useState<string | null>(null);
  const zavriet = useRef<HTMLButtonElement>(null);
  useEffect(() => zavriet.current?.focus(), [p]);
  useEffect(() => setUprava(nova), [p, nova]);
  useEffect(() => {
    const esc = (e: globalThis.KeyboardEvent) => e.key === "Escape" && zavri();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [zavri]);

  const nazovPolozky = (id: number) => vsetky.find((q) => q.id === id)?.nazov ?? `#${id}`;

  const uloz = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const telo = {
      nazov: f.get("nazov"),
      kratko: f.get("kratko"),
      preco: f.get("preco"),
      hotovo: f.get("hotovo"),
      oblast: f.get("oblast"),
      narocnost: f.get("narocnost"),
      stav: f.get("stav"),
      verejna: f.get("verejna") === "on",
      ...(nova ? { stlpec: f.get("stlpec") } : {}),
    };
    (nova ? api.post("/roadmapa", telo) : api.patch(`/roadmapa/${p.id}`, telo))
      .then(() => {
        ulozene();
        if (nova) zavri();
        else setUprava(false);
      })
      .catch((err: unknown) => setChyba(err instanceof Error ? err.message : String(err)));
  };

  const zmaz = () => {
    if (nova) return;
    api
      .del(`/roadmapa/${p.id}`)
      .then(() => {
        ulozene();
        zavri();
      })
      .catch((err: unknown) => setChyba(err instanceof Error ? err.message : String(err)));
  };

  const vStlpci = nova ? [] : vsetky.filter((q) => q.stlpec === p.stlpec);
  const index = nova ? -1 : vStlpci.indexOf(p);
  const stlpec = nova ? undefined : stlpce.find((s) => s.kluc === p.stlpec);
  const cakaju = nova ? [] : vsetky.filter((q) => q.zavisi.includes(p.id));

  return (
    <>
      <div className="rm-detail-pozadie" onClick={zavri} />
      <aside className="rm-detail" role="dialog" aria-modal="true" aria-labelledby="rm-detail-nadpis">
        <button ref={zavriet} type="button" className="rm-zavriet tlacidlo-jemne" onClick={zavri} aria-label="Zavrieť">
          ×
        </button>
        {chyba !== null && <Hlaska>{chyba}</Hlaska>}
        {uprava ? (
          <form className="rm-formular" onSubmit={uloz}>
            <h3 id="rm-detail-nadpis">{nova ? "Nová položka" : "Upraviť položku"}</h3>
            <label className="pole">
              <span className="pole-label">Názov</span>
              <input name="nazov" required maxLength={120} defaultValue={nova ? "" : p.nazov} />
            </label>
            <label className="pole">
              <span className="pole-label">Krátko (jedna veta na kartu)</span>
              <input name="kratko" maxLength={300} defaultValue={nova ? "" : p.kratko} />
            </label>
            <label className="pole">
              <span className="pole-label">Prečo</span>
              <textarea name="preco" rows={3} maxLength={2000} defaultValue={nova ? "" : p.preco} />
            </label>
            <label className="pole">
              <span className="pole-label">Hotovo, keď</span>
              <textarea name="hotovo" rows={2} maxLength={2000} defaultValue={nova ? "" : p.hotovo} />
            </label>
            <div className="rm-dva">
              <label className="pole">
                <span className="pole-label">Oblasť</span>
                <select name="oblast" defaultValue={nova ? "pravidla" : p.oblast}>
                  {(Object.keys(OBLASTI) as Oblast[]).map((o) => (
                    <option key={o} value={o}>
                      {OBLASTI[o]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="pole">
                <span className="pole-label">Náročnosť</span>
                <select name="narocnost" defaultValue={nova ? "M" : p.narocnost}>
                  {(Object.keys(NAROCNOSTI) as Narocnost[]).map((n) => (
                    <option key={n} value={n}>
                      {n} — {NAROCNOSTI[n]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="pole">
                <span className="pole-label">Stav</span>
                <select name="stav" defaultValue={nova ? "napad" : p.stav}>
                  {(Object.keys(STAVY) as StavPolozky[]).map((s) => (
                    <option key={s} value={s}>
                      {STAVY[s]}
                    </option>
                  ))}
                </select>
              </label>
              {nova && (
                <label className="pole">
                  <span className="pole-label">Stĺpec</span>
                  <select name="stlpec" defaultValue="prijimac">
                    {stlpce
                      .filter((s) => s.kluc !== "hotove")
                      .map((s) => (
                        <option key={s.kluc} value={s.kluc}>
                          {s.nazov}
                        </option>
                      ))}
                  </select>
                </label>
              )}
            </div>
            <label className="rm-zaskrtnutie">
              <input type="checkbox" name="verejna" defaultChecked={nova ? true : p.verejna} /> Vidia ju hráči (okrem Prijímača)
            </label>
            <div className="riadok-tlacidiel">
              <button type="submit" className="tlacidlo-hlavne">
                {nova ? "Pridať na koniec stĺpca" : "Uložiť"}
              </button>
              {!nova && (
                <button type="button" className="tlacidlo-jemne" onClick={() => setUprava(false)}>
                  Zrušiť
                </button>
              )}
            </div>
          </form>
        ) : (
          !nova && (
            <>
              <div className={`rm-detail-meta obl-${p.oblast}`}>
                <span className="rm-oblast">
                  <i aria-hidden="true" />
                  {OBLASTI[p.oblast]}
                </span>
                <span>
                  {stlpec?.nazov}, {index + 1}. miesto
                </span>
              </div>
              <h3 id="rm-detail-nadpis">{p.nazov}</h3>
              {p.kratko !== "" && <p>{p.kratko}</p>}
              <dl className="rm-udaje">
                <dt>Stav</dt>
                <dd>{STAVY[p.stav]}</dd>
                <dt>Náročnosť</dt>
                <dd>
                  {p.narocnost}, {NAROCNOSTI[p.narocnost]}
                </dd>
                {p.zdroj !== null && (
                  <>
                    <dt>Zdroj</dt>
                    <dd>{p.zdroj.odkaz !== "" ? <Odkaz href={p.zdroj.odkaz}>{p.zdroj.text}</Odkaz> : p.zdroj.text}</dd>
                  </>
                )}
                {p.dokoncena !== null && (
                  <>
                    <dt>Dokončené</dt>
                    <dd>{datum(p.dokoncena)}</dd>
                  </>
                )}
                {p.commit !== "" && (
                  <>
                    <dt>Commit</dt>
                    <dd>
                      <code>{p.commit}</code>
                    </dd>
                  </>
                )}
              </dl>
              {p.preco !== "" && (
                <>
                  <h5>Prečo</h5>
                  <p>{p.preco}</p>
                </>
              )}
              {p.hotovo !== "" && (
                <>
                  <h5>Hotovo, keď</h5>
                  <p>{p.hotovo}</p>
                </>
              )}
              {p.zavisi.length > 0 && (
                <>
                  <h5>Závisí od</h5>
                  <ul>
                    {p.zavisi.map((z) => (
                      <li key={z}>
                        <button type="button" className="rm-odkaz" onClick={() => otvor(z)}>
                          {nazovPolozky(z)}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {cakaju.length > 0 && (
                <>
                  <h5>Čaká na to</h5>
                  <ul>
                    {cakaju.map((q) => (
                      <li key={q.id}>
                        <button type="button" className="rm-odkaz" onClick={() => otvor(q.id)}>
                          {q.nazov}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {upravuje && (
                <>
                  <h5>Presunúť</h5>
                  <div className="rm-presun">
                    <button type="button" className="tlacidlo-male" disabled={index <= 0} onClick={() => presun(p.id, p.stlpec, vStlpci[index - 1]?.id ?? null)}>
                      ↑ Vyššie
                    </button>
                    <button
                      type="button"
                      className="tlacidlo-male"
                      disabled={index >= vStlpci.length - 1}
                      onClick={() => presun(p.id, p.stlpec, vStlpci[index + 2]?.id ?? null)}
                    >
                      ↓ Nižšie
                    </button>
                    <select
                      aria-label="Presunúť do stĺpca"
                      value={p.stlpec}
                      onChange={(e) => {
                        if (e.target.value !== p.stlpec) presun(p.id, e.target.value, null);
                      }}
                    >
                      {stlpce.map((s) => (
                        <option key={s.kluc} value={s.kluc}>
                          {s.nazov}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="riadok-tlacidiel rm-spravca">
                    <button type="button" className="tlacidlo-male" onClick={() => setUprava(true)}>
                      Upraviť
                    </button>
                    {p.navrh !== null && (
                      <Odkaz href="/playtest" className="tlacidlo tlacidlo-male tlacidlo-jemne">
                        Návrh z playtestu
                      </Odkaz>
                    )}
                    <ZmazTlacidlo zmaz={zmaz} />
                  </div>
                </>
              )}
            </>
          )
        )}
      </aside>
    </>
  );
}

function ZmazTlacidlo({ zmaz }: { readonly zmaz: () => void }) {
  const [pyta, setPyta] = useState(false);
  useEffect(() => {
    if (!pyta) return;
    const t = setTimeout(() => setPyta(false), 4000);
    return () => clearTimeout(t);
  }, [pyta]);
  return (
    <button type="button" className={`tlacidlo-male tlacidlo-jemne ${pyta ? "tlacidlo-nebezpecne" : ""}`} onClick={() => (pyta ? zmaz() : setPyta(true))}>
      {pyta ? "naozaj zmazať?" : "Zmazať"}
    </button>
  );
}

export function Roadmapa() {
  const [data, setData] = useState<{ stlpce: Stlpec[]; polozky: Polozka[]; upravuje: boolean } | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);
  const [filter, setFilter] = useState<Oblast | null>(null);
  const [hotoveOtvorene, setHotoveOtvorene] = useState(false);
  const [detail, setDetail] = useState<number | "nova" | null>(null);
  const [tahana, setTahana] = useState<number | null>(null);
  const [miesto, setMiesto] = useState<{ stlpec: string; pred: number | null } | null>(null);
  const poslednyFokus = useRef<HTMLElement | null>(null);

  const nacitaj = useCallback(() => {
    api
      .get<{ stlpce: Stlpec[]; polozky: Polozka[]; upravuje: boolean }>("/roadmapa")
      .then((d) => {
        setData(d);
        setChyba(null);
      })
      .catch((e: unknown) => setChyba(e instanceof Error ? e.message : String(e)));
  }, []);
  useEffect(nacitaj, [nacitaj]);

  const presun = useCallback(
    (id: number, stlpec: string, pred: number | null) => {
      if (data === null || pred === id) return;
      // Hneď prekreslí, server dopočíta poradie a načíta sa znova.
      const bez = data.polozky.filter((q) => q.id !== id);
      const p = data.polozky.find((q) => q.id === id);
      if (p === undefined) return;
      const kam = pred === null ? bez.length : bez.findIndex((q) => q.id === pred);
      const nove = [...bez.slice(0, kam), { ...p, stlpec }, ...bez.slice(kam)];
      setData({ ...data, polozky: nove });
      api
        .post(`/roadmapa/${id}/presun`, { stlpec, pred })
        .then(nacitaj)
        .catch((e: unknown) => {
          setChyba(e instanceof Error ? e.message : String(e));
          nacitaj();
        });
      requestAnimationFrame(() => document.querySelector<HTMLElement>(`.rm-polozka[data-id="${id}"]`)?.focus());
    },
    [data, nacitaj],
  );

  const zavri = useCallback(() => {
    setDetail(null);
    poslednyFokus.current?.focus();
  }, []);

  if (data === null) return chyba !== null ? <Hlaska>{chyba}</Hlaska> : <Nacitavanie />;

  const stlpce = data.stlpce.filter((s) => s.verejny || data.upravuje);
  const vStlpci = (k: string) => data.polozky.filter((p) => p.stlpec === k);
  const viditelna = (p: Polozka) => filter === null || p.oblast === filter;

  const presunKlavesom = (p: Polozka, smer: "hore" | "dole" | "vlavo" | "vpravo") => {
    const v = vStlpci(p.stlpec);
    const i = v.indexOf(p);
    if (smer === "hore" && i > 0) presun(p.id, p.stlpec, v[i - 1]!.id);
    else if (smer === "dole" && i < v.length - 1) presun(p.id, p.stlpec, v[i + 2]?.id ?? null);
    else if (smer === "vlavo" || smer === "vpravo") {
      const kluce = stlpce.map((s) => s.kluc);
      const j = kluce.indexOf(p.stlpec) + (smer === "vlavo" ? -1 : 1);
      const ciel = kluce[j];
      if (ciel !== undefined) presun(p.id, ciel, null);
    }
  };

  const nadStlpcom = (e: DragEvent<HTMLDivElement>, stlpec: string) => {
    if (tahana === null) return;
    e.preventDefault();
    const karty = [...e.currentTarget.querySelectorAll<HTMLElement>(".rm-polozka")].filter((k) => k.dataset.id !== String(tahana));
    const pred = karty.find((k) => {
      const r = k.getBoundingClientRect();
      return e.clientY < r.top + r.height / 2;
    });
    const predId = pred === undefined ? null : Number(pred.dataset.id);
    if (miesto?.stlpec !== stlpec || miesto.pred !== predId) setMiesto({ stlpec, pred: predId });
  };

  const otvor = (id: number | "nova") => {
    if (detail === null) poslednyFokus.current = document.activeElement as HTMLElement | null;
    setDetail(id);
  };
  const otvorena = detail === null ? null : detail === "nova" ? "nova" : (data.polozky.find((p) => p.id === detail) ?? null);

  return (
    <div className="roadmapa">
      {chyba !== null && <Hlaska>{chyba}</Hlaska>}
      <div className="rm-nastroje">
        <div className="cipy" role="group" aria-label="Filtrovať podľa oblasti">
          <button type="button" className={`cip ${filter === null ? "aktivny" : ""}`} aria-pressed={filter === null} onClick={() => setFilter(null)}>
            Všetko
          </button>
          {(Object.keys(OBLASTI) as Oblast[]).map((o) => (
            <button key={o} type="button" className={`cip rm-cip obl-${o} ${filter === o ? "aktivny" : ""}`} aria-pressed={filter === o} onClick={() => setFilter(filter === o ? null : o)}>
              <i aria-hidden="true" />
              {OBLASTI[o]}
            </button>
          ))}
        </div>
        {data.upravuje && (
          <button type="button" className="tlacidlo-hlavne" onClick={() => otvor("nova")}>
            + Položka
          </button>
        )}
      </div>

      <div className="rm-tabula">
        {stlpce.map((s) => {
          const vsetky = vStlpci(s.kluc);
          const viditelne = vsetky.filter(viditelna);
          const zbaleny = s.kluc === "hotove" && !hotoveOtvorene;
          const cielTahu = data.upravuje && tahana !== null;
          return (
            <section key={s.kluc} className={`rm-stlpec rm-${s.kluc}`} aria-labelledby={`rm-stlpec-${s.kluc}`}>
              <header className="rm-stlpec-hlava">
                <h3 id={`rm-stlpec-${s.kluc}`}>
                  {s.nazov} <span className="rm-pocet">{vsetky.length}</span>
                  {s.horizont !== "" && <span className="rm-horizont">{s.horizont}</span>}
                </h3>
                <p>{s.zamer}</p>
                {s.kluc === "hotove" && (
                  <button type="button" className="rm-zbal" onClick={() => setHotoveOtvorene(!hotoveOtvorene)} aria-expanded={hotoveOtvorene}>
                    {zbaleny ? `Ukázať ${vsetky.length} hotových` : "Zbaliť"}
                  </button>
                )}
              </header>
              <div
                className={`rm-stlpec-telo ${cielTahu && miesto?.stlpec === s.kluc ? "nad" : ""}`}
                onDragOver={cielTahu ? (e) => nadStlpcom(e, s.kluc) : undefined}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setMiesto(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (tahana !== null && miesto !== null) presun(tahana, miesto.stlpec, miesto.pred);
                  setTahana(null);
                  setMiesto(null);
                }}
              >
                {!zbaleny && viditelne.length === 0 && (
                  <p className="rm-prazdny">{vsetky.length > 0 ? "Nič nevyhovuje filtru." : data.upravuje ? "Sem potiahni položku." : "Zatiaľ prázdne."}</p>
                )}
                {!zbaleny &&
                  viditelne.map((p) => (
                    <div key={p.id} className="rm-obal">
                      {cielTahu && miesto?.stlpec === s.kluc && miesto.pred === p.id && <div className="rm-miesto" />}
                      <Karta
                        p={p}
                        poradie={vsetky.indexOf(p) + 1}
                        upravuje={data.upravuje}
                        otvor={() => otvor(p.id)}
                        presunKlavesom={(smer) => presunKlavesom(p, smer)}
                        tahaj={(id) => {
                          setTahana(id);
                          if (id === null) setMiesto(null);
                        }}
                      />
                    </div>
                  ))}
                {cielTahu && miesto?.stlpec === s.kluc && miesto.pred === null && <div className="rm-miesto" />}
              </div>
            </section>
          );
        })}
      </div>
      <p className="tlmene rm-napoveda">
        {data.upravuje
          ? "Kartu presunieš ťahaním, v detaile, alebo klávesmi Alt + šípky (hore a dole v stĺpci, vľavo a vpravo medzi stĺpcami). Prijímač a skryté položky hráči nevidia."
          : "Stĺpce sú horizonty, nie dátumy: čo je v stĺpci vyššie, príde na rad skôr."}
      </p>

      {otvorena !== null && (
        <Detail
          p={otvorena}
          vsetky={data.polozky}
          stlpce={stlpce}
          upravuje={data.upravuje}
          zavri={zavri}
          otvor={(id) => setDetail(id)}
          ulozene={nacitaj}
          presun={presun}
        />
      )}
    </div>
  );
}
