// Dielňa (/karty/dielna, Michal 2026-10-22): hráči navrhujú nové karty aj
// úpravy kariet v hre, ostatní dávajú cigarety a komentujú, správca návrh
// schváli (prevezme do tvorcu), vráti na úpravu alebo zamietne. Čítať smie
// každý; písať podľa práva navrhovat_karty — server to overí sám.

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { KartaNavrh, Sada, Vzhlad } from "@naex/tvorba";
import { farbaKarty, variant, variantyKarty } from "@naex/tvorba";
import { ALL_TRIGGERS } from "@naex/core";
import { api, mediaUrl } from "../lib/api.ts";
import { Odkaz, chod, useTitulok } from "../lib/router.tsx";
import { useSada, vzhladSady } from "../lib/sada.tsx";
import { jeSpravca, maPravo, useUcet } from "../lib/ucet.tsx";
import { Hlaska, Nacitavanie } from "../komponenty.tsx";
import { HlavaStranky } from "../HlavaStranky.tsx";
import { KartaLico } from "../karta/KartaLico.tsx";
import { IkonaAkcie } from "../karta/IkonaAkcie.tsx";
import { TlacidloCigarety } from "../stranky/SpatnaVazba.tsx";
import { tvar } from "../stranky/Statistiky.tsx";
import type { DetailNavrhu, NavrhDielne, ObsahNavrhu, Pozicie, StavZobrazeny, ZoznamDielne } from "./typy.ts";
import { STAVY, kartaZNavrhu, kedy, poziciZoStrany, stranaZPozicii } from "./typy.ts";
import "./dielna.css";

/** Záložky stránky Karty: glosár a Dielňa (Michal 2026-10-22: nie nová položka navigácie). */
export function KartyZalozky({ aktivna }: { readonly aktivna: "karty" | "dielna" }) {
  return (
    <nav className="karty-zalozky" aria-label="Karty">
      <Odkaz href="/karty" className={aktivna === "karty" ? "aktivna" : undefined} aria-current={aktivna === "karty" ? "page" : undefined}>
        Karty v hre
      </Odkaz>
      <Odkaz href="/karty/dielna" className={aktivna === "dielna" ? "aktivna" : undefined} aria-current={aktivna === "dielna" ? "page" : undefined}>
        Dielňa
      </Odkaz>
    </nav>
  );
}

function StavCip({ stav }: { readonly stav: StavZobrazeny }) {
  const s = STAVY[stav];
  return (
    <span className={`stav-navrhu stav-${stav}`}>
      <span aria-hidden="true">{s.znak}</span> {s.nazov}
    </span>
  );
}

function NahladKarty({ karta, vzhlad, sirka, bezPopisov = false }: { readonly karta: KartaNavrh; readonly vzhlad: Vzhlad; readonly sirka: number; readonly bezPopisov?: boolean }) {
  const roz = variant(variantyKarty(karta), 0);
  if (roz === null) return <div className="dielna-karta-chyba" style={{ width: sirka }}>Karta sa nedá zložiť</div>;
  return <KartaLico karta={karta} lava={roz.lava} prava={roz.prava} vzhlad={vzhlad} sirka={sirka} bezPopisov={bezPopisov} />;
}

function Autor({ a }: { readonly a: NavrhDielne["autor"] }) {
  return (
    <span className="dielna-autor">
      <Odkaz href={`/hrac/${a.id}`}>{a.meno}</Odkaz>
      {a.odznak && (
        <span className="odznak odznak-dielna" title="Má v hre kartu z Dielne">
          ✦ dielňa
        </span>
      )}
      {a.ai && <span className="odznak odznak-ai">AI</span>}
    </span>
  );
}

/** Úzke okno (ako zlom v dielna.css) — editor vtedy ukáže plávajúci náhľad. */
function useMobil(): boolean {
  const [mobil, setMobil] = useState(() => window.matchMedia("(max-width: 760px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 760px)");
    const zmena = (): void => setMobil(mq.matches);
    mq.addEventListener("change", zmena);
    return () => mq.removeEventListener("change", zmena);
  }, []);
  return mobil;
}

const PRAVIDLO_LUDI = "Žiadne karty o skutočných súkromných ľuďoch (susedia, známi, spolužiaci) — také návrhy správca skryje.";

// ---------------------------------------------------------------------------
// Zoznam

type Filter = "vsetko" | "hlasovanie" | "moje" | "prevzate" | "posudene" | "archiv";
const FILTRE: readonly { readonly kluc: Filter; readonly nazov: string }[] = [
  { kluc: "vsetko", nazov: "Všetko" },
  { kluc: "hlasovanie", nazov: "V hlasovaní" },
  { kluc: "prevzate", nazov: "V tvorcovi a v hre" },
  { kluc: "posudene", nazov: "Vrátené a zamietnuté" },
  { kluc: "archiv", nazov: "Archív" },
  { kluc: "moje", nazov: "Moje" },
];

function patri(n: NavrhDielne, f: Filter, ja: number | null): boolean {
  switch (f) {
    case "vsetko":
      return n.stav !== "archiv";
    case "hlasovanie":
      return n.stav === "hlasovanie";
    case "prevzate":
      return n.stav === "v_tvorcovi" || n.stav === "v_hre";
    case "posudene":
      return n.stav === "vratene" || n.stav === "zamietnute";
    case "archiv":
      return n.stav === "archiv";
    case "moje":
      return n.autor.id === ja;
  }
}

function Zoznam({ sada }: { readonly sada: Sada }) {
  useTitulok("Dielňa");
  const { ja } = useUcet();
  const vzhlad = vzhladSady(sada);
  const [data, setData] = useState<ZoznamDielne | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("vsetko");
  const [triedenie, setTriedenie] = useState<"nove" | "cigarety">("nove");

  useEffect(() => {
    api
      .get<ZoznamDielne>("/dielna")
      .then(setData)
      .catch((e: unknown) => setChyba(e instanceof Error ? e.message : String(e)));
  }, []);

  const viditelne = useMemo(() => {
    const v = (data?.navrhy ?? []).filter((n) => patri(n, filter, ja?.id ?? null));
    return triedenie === "cigarety" ? [...v].sort((a, b) => b.cigarety - a.cigarety || b.id - a.id) : v;
  }, [data, filter, triedenie, ja]);

  const moje = data?.navrhy.filter((n) => n.autor.id === ja?.id && ["koncept", "hlasovanie", "vratene"].includes(n.stav)).length ?? 0;
  const smiem = data?.smiem === true;

  return (
    <div className="dielna">
      <HlavaStranky
        nadpis="Dielňa"
        uvod="Navrhni novú kartu alebo úpravu karty, ktorá už je v hre."
        akcia={
          <>
            {data !== null && ja !== null && smiem && (
              <span>
                Otvorené návrhy: {moje} z {data.maxOtvorenych}
              </span>
            )}
            {smiem ? (
              <Odkaz href="/karty/dielna/novy" className={`tlacidlo tlacidlo-hlavne ${data !== null && moje >= data.maxOtvorenych ? "zakazane" : ""}`}>
                Navrhnúť kartu
              </Odkaz>
            ) : ja === null ? (
              <Odkaz href="/prihlasenie?spat=/karty/dielna" className="tlacidlo">
                Prihlás sa a navrhni kartu
              </Odkaz>
            ) : (
              <span>Navrhovať karty tvoj rank zatiaľ nesmie.</span>
            )}
          </>
        }
        zalozky={<KartyZalozky aktivna="dielna" />}
        viac={
          <p>
            Ostatní hráči ti dajú cigaretu a napíšu, čo si myslia, a tvorca hry návrh prevezme do hry, vráti ti ho na úpravu, alebo ho zamietne —
            vždy s dôvodom. {PRAVIDLO_LUDI}
          </p>
        }
      />

      <div className="mriezka">
      <aside className="st-bok dielna-bok">
      <div className="dielna-filtre">
        <div className="cipy" role="group" aria-label="Filter stavu">
          {FILTRE.filter((f) => f.kluc !== "moje" || ja !== null).map((f) => (
            <button key={f.kluc} type="button" className={`cip ${filter === f.kluc ? "aktivny" : ""}`} aria-pressed={filter === f.kluc} onClick={() => setFilter(f.kluc)}>
              {f.nazov} <span className="dielna-pocet">{data?.navrhy.filter((n) => patri(n, f.kluc, ja?.id ?? null)).length ?? ""}</span>
            </button>
          ))}
        </div>
        <label className="dielna-triedenie">
          <span className="tlmene">Zoradiť</span>
          <select value={triedenie} onChange={(e) => setTriedenie(e.target.value as "nove" | "cigarety")}>
            <option value="nove">najnovšie</option>
            <option value="cigarety">najviac cigariet</option>
          </select>
        </label>
      </div>
      </aside>
      <div className="st-obsah">
      {chyba !== null && <Hlaska>{chyba}</Hlaska>}
      {data !== null && data.noveRozhodnutia > 0 && (
        <button type="button" className="cip dielna-nove-rozhodnutie" onClick={() => setFilter("moje")}>
          Nové rozhodnutie o tvojom návrhu: {data.noveRozhodnutia}
        </button>
      )}
      {data === null ? (
        chyba === null && <Nacitavanie />
      ) : viditelne.length === 0 ? (
        <p className="tlmene dielna-prazdne">
          {data.navrhy.length === 0 ? "Dielňa je zatiaľ prázdna. Prvý návrh môže byť tvoj." : "V tomto filtri nič nie je."}
        </p>
      ) : (
        <ul className="dielna-stol">
          {viditelne.map((n) => (
            <li key={n.id} className={`panel dielna-polozka pas-${n.stav}`}>
              <Odkaz href={`/karty/dielna/${n.id}`} className="dielna-polozka-karta" aria-label={`Otvoriť návrh ${n.obsah.nazov || "bez názvu"}`}>
                <NahladKarty karta={kartaZNavrhu(n.obsah, n.zakladKarta)} vzhlad={vzhlad} sirka={112} bezPopisov />
              </Odkaz>
              <div className="dielna-polozka-text">
                <div className="dielna-znacky">
                  <StavCip stav={n.stav} />
                  <span className="dielna-typ">{n.typ === "nova" ? "nová karta" : `úprava: ${n.zakladKarta?.nazov ?? n.zaklad ?? ""}`}</span>
                  {n.skryty && <span className="odznak">skrytý</span>}
                  {n.nahlaseni > 0 && <span className="odznak odznak-ai">nahlásený {n.nahlaseni}×</span>}
                  {n.noveRozhodnutie && <span className="novinka-nova">nové rozhodnutie</span>}
                </div>
                <h2>
                  <Odkaz href={`/karty/dielna/${n.id}`}>{n.obsah.nazov || "Bez názvu"}</Odkaz>
                </h2>
                {n.obsah.efekt !== "" && <p className="dielna-efekt">{n.obsah.efekt}</p>}
                <p className="tlmene dielna-meta">
                  <Autor a={n.autor} /> · {kedy(n.odoslany ?? n.vytvoreny)} · {n.komentarov} {tvar(n.komentarov, "komentár", "komentáre", "komentárov")}
                </p>
              </div>
              <div className={`dielna-cigarety ${n.cigarety >= data.krabicka ? "krabicka" : ""}`} title={n.cigarety >= data.krabicka ? `Plná krabička — aspoň ${data.krabicka} cigariet` : undefined}>
                <strong>{n.cigarety}</strong>
                <span>{tvar(n.cigarety, "cigareta", "cigarety", "cigariet")}</span>
                {n.cigarety >= data.krabicka && <span className="dielna-krabicka">krabička</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
      </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail

function RozdielUpravy({ n, vzhlad }: { readonly n: NavrhDielne; readonly vzhlad: Vzhlad }) {
  const z = n.zakladKarta;
  if (z === null) return null;
  const o = n.obsah;
  const zmeny: string[] = [];
  if (o.nazov !== z.nazov) zmeny.push(`Názov: ${z.nazov} → ${o.nazov}`);
  if (JSON.stringify(o.tagy) !== JSON.stringify(z.tagy)) zmeny.push(`Tagy: ${z.tagy.join(", ")} → ${o.tagy.join(", ")}`);
  if (o.efekt !== z.efekt) zmeny.push(`Efekt: „${z.efekt || "—"}“ → „${o.efekt || "—"}“`);
  const akcie = (s: KartaNavrh["lava"]): string =>
    Object.entries(s.akcie)
      .map(([k, c]) => `${vzhlad.akcie.find((a) => a.kluc === k)?.nazov ?? k}${c > 1 ? ` ×${c}` : ""}`)
      .join(", ") || "nič";
  const pozicie = (s: KartaNavrh["lava"]): string => JSON.stringify(poziciZoStrany(s));
  if (pozicie(o.lava) !== pozicie(z.lava) || JSON.stringify(o.lava.akcie) !== JSON.stringify(z.lava.akcie)) zmeny.push(`Ľavá strana: ${akcie(z.lava)} → ${akcie(o.lava)}`);
  if (pozicie(o.prava) !== pozicie(z.prava) || JSON.stringify(o.prava.akcie) !== JSON.stringify(z.prava.akcie)) zmeny.push(`Pravá strana: ${akcie(z.prava)} → ${akcie(o.prava)}`);
  if (o.obrazok !== (z.obrazok?.plny ?? null)) zmeny.push("Iná ilustrácia");
  return (
    <section className="dielna-rozdiel">
      <h3>Čo sa mení oproti karte v hre</h3>
      <div className="dielna-rozdiel-karty">
        <figure>
          <NahladKarty karta={z} vzhlad={vzhlad} sirka={190} />
          <figcaption className="tlmene">Teraz v hre</figcaption>
        </figure>
        <span className="dielna-sipka" aria-hidden="true">
          →
        </span>
        <figure>
          <NahladKarty karta={kartaZNavrhu(o, z)} vzhlad={vzhlad} sirka={190} />
          <figcaption className="tlmene">Návrh</figcaption>
        </figure>
      </div>
      {zmeny.length > 0 && (
        <ul className="dielna-zmeny">
          {zmeny.map((z) => (
            <li key={z}>{z}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Podobné karty v hre (spoločné akcie a tagy) — podklad pre posudok správcu. */
function podobne(o: ObsahNavrhu, sada: Sada, okrem: string | null): { karta: KartaNavrh; zhoda: number }[] {
  const akcie = (k: Pick<KartaNavrh, "lava" | "prava">): string[] => [...Object.keys(k.lava.akcie), ...Object.keys(k.prava.akcie)];
  const moje = new Set([...akcie(o), ...o.tagy]);
  if (moje.size === 0) return [];
  return sada.karty
    .filter((k) => k.id !== okrem)
    .map((k) => {
      const ich = new Set([...akcie(k), ...k.tagy]);
      const spolu = [...moje].filter((x) => ich.has(x)).length;
      return { karta: k, zhoda: Math.round((100 * spolu) / new Set([...moje, ...ich]).size) };
    })
    .filter((x) => x.zhoda > 0)
    .sort((a, b) => b.zhoda - a.zhoda)
    .slice(0, 3);
}

function Posudok({ n, sada, obnov }: { readonly n: DetailNavrhu; readonly sada: Sada; readonly obnov: () => void }) {
  const vzhlad = vzhladSady(sada);
  const [dovod, setDovod] = useState("");
  const [chyba, setChyba] = useState<string | null>(null);
  const [vysledok, setVysledok] = useState<string | null>(null);
  const [nahlasenia, setNahlasenia] = useState<readonly { meno: string; dovod: string; cas: number }[] | null>(null);
  const moze = n.stav === "hlasovanie" || n.stav === "vratene";

  useEffect(() => {
    if (n.nahlaseni === 0) return;
    api
      .get<{ nahlasenia: { meno: string; dovod: string; cas: number }[] }>(`/dielna/${n.id}/nahlasenia`)
      .then((r) => setNahlasenia(r.nahlasenia))
      .catch(() => undefined);
  }, [n.id, n.nahlaseni]);

  const rozhodni = (rozhodnutie: "schvalit" | "vratit" | "zamietnut") => {
    setChyba(null);
    api
      .post<{ kartaId: string | null; roadmapa: number | null }>(`/dielna/${n.id}/posudok`, { rozhodnutie, dovod })
      .then((r) => {
        setVysledok(
          rozhodnutie === "schvalit"
            ? `Prevzaté do tvorcu ako karta „${r.kartaId ?? ""}“${r.roadmapa !== null ? ` a v Prijímači roadmapy je položka #${r.roadmapa}` : ""}. Zverejní sa s najbližšou sadou.`
            : rozhodnutie === "vratit"
              ? "Vrátené autorovi na úpravu."
              : "Zamietnuté.",
        );
        setDovod("");
        obnov();
      })
      .catch((e: unknown) => setChyba(e instanceof Error ? e.message : String(e)));
  };
  const skry = () => {
    api
      .post(`/dielna/${n.id}/skryt`, { skryty: !n.skryty })
      .then(obnov)
      .catch((e: unknown) => setChyba(e instanceof Error ? e.message : String(e)));
  };
  const zhody = podobne(n.obsah, sada, n.zaklad);

  return (
    <section className="panel dielna-posudok" aria-labelledby="posudok-nadpis">
      <h2 id="posudok-nadpis">Posudok</h2>
      {chyba !== null && <Hlaska>{chyba}</Hlaska>}
      {vysledok !== null && <Hlaska druh="ok">{vysledok}</Hlaska>}
      {zhody.length > 0 && (
        <>
          <h3>Podobné karty v hre</h3>
          <ul className="dielna-podobne">
            {zhody.map(({ karta, zhoda }) => (
              <li key={karta.id}>
                <NahladKarty karta={karta} vzhlad={vzhlad} sirka={96} bezPopisov />
                <span>
                  <strong>{karta.nazov}</strong>
                  <span className="tlmene"> zhoda {zhoda} %</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      {nahlasenia !== null && nahlasenia.length > 0 && (
        <>
          <h3>Nahlásenia</h3>
          <ul className="dielna-nahlasenia">
            {nahlasenia.map((h, i) => (
              <li key={i}>
                <strong>{h.meno}:</strong> {h.dovod}
              </li>
            ))}
          </ul>
        </>
      )}
      {moze ? (
        <>
          <p className="tlmene">
            Schválenie {n.typ === "nova" ? "založí novú kartu" : `zmení kartu „${n.zakladKarta?.nazov ?? n.zaklad ?? ""}“`} v tvorcovi (do hry ide až so
            zverejnením sady){n.obsah.efekt !== "" || n.obsah.novaAkcia !== "" ? " a v Prijímači roadmapy založí položku „naprogramovať“" : ""}. Pri vrátení a
            zamietnutí autorovi napíš dôvod — uvidí ho pri návrhu.
          </p>
          <label className="dielna-pole">
            <span>Dôvod (pri schválení voliteľný)</span>
            <textarea value={dovod} onChange={(e) => setDovod(e.target.value)} maxLength={1000} rows={3} />
          </label>
          <div className="riadok-tlacidiel">
            <button type="button" className="tlacidlo-hlavne" onClick={() => rozhodni("schvalit")}>
              Schváliť a prevziať do tvorcu
            </button>
            <button type="button" onClick={() => rozhodni("vratit")} disabled={dovod.trim().length < 3}>
              Vrátiť na úpravu
            </button>
            <button type="button" className="tlacidlo-nebezpecne" onClick={() => rozhodni("zamietnut")} disabled={dovod.trim().length < 3}>
              Zamietnuť
            </button>
          </div>
        </>
      ) : (
        <p className="tlmene">Posudzuje sa návrh v hlasovaní alebo vrátený na úpravu.</p>
      )}
      <div className="riadok-tlacidiel">
        <button type="button" className="tlacidlo-male tlacidlo-jemne" onClick={skry}>
          {n.skryty ? "Znova zobraziť hráčom" : "Skryť pred hráčmi"}
        </button>
        {n.kartaId !== null && (
          <Odkaz href={`/admin/karty/${n.kartaId}`} className="tlacidlo tlacidlo-male">
            Otvoriť v tvorcovi
          </Odkaz>
        )}
      </div>
    </section>
  );
}

function Detail({ id, sada }: { readonly id: number; readonly sada: Sada }) {
  const { ja } = useUcet();
  const vzhlad = vzhladSady(sada);
  const [n, setN] = useState<DetailNavrhu | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);
  const [komentar, setKomentar] = useState("");
  const [nahlasenie, setNahlasenie] = useState<string | null>(null);
  useTitulok(n === null ? "Dielňa" : `${n.obsah.nazov || "Návrh"} · Dielňa`);
  const ukaz = (e: unknown) => setChyba(e instanceof Error ? e.message : String(e));

  const obnov = useCallback(() => {
    api
      .get<{ navrh: DetailNavrhu }>(`/dielna/${id}`)
      .then((r) => setN(r.navrh))
      .catch(ukaz);
  }, [id]);
  useEffect(obnov, [obnov]);

  if (n === null) return chyba !== null ? <Hlaska>{chyba}</Hlaska> : <Nacitavanie />;
  const autor = ja !== null && ja.id === n.autor.id;
  const smiem = maPravo(ja, "navrhovat_karty");
  const spravca = ja !== null && jeSpravca(ja.rola);
  const karta = kartaZNavrhu(n.obsah, n.zakladKarta);
  const akcie = [...new Set([...Object.keys(karta.lava.akcie), ...Object.keys(karta.prava.akcie)])];

  const cigareta = () => {
    api
      .put<{ cigarety: number }>(`/dielna/${id}/cigareta`)
      .then(obnov)
      .catch(ukaz);
  };
  const cigaretaSpat = () => {
    api
      .del<{ cigarety: number }>(`/dielna/${id}/cigareta`)
      .then(obnov)
      .catch(ukaz);
  };
  const odosli = () => {
    api
      .post(`/dielna/${id}/odoslat`)
      .then(obnov)
      .catch(ukaz);
  };
  const zmaz = () => {
    api
      .del(`/dielna/${id}`)
      .then(() => chod("/karty/dielna"))
      .catch(ukaz);
  };
  const pridajKomentar = (e: FormEvent) => {
    e.preventDefault();
    api
      .post(`/dielna/${id}/komentare`, { text: komentar })
      .then(() => {
        setKomentar("");
        obnov();
      })
      .catch(ukaz);
  };
  const nahlas = (e: FormEvent) => {
    e.preventDefault();
    api
      .post(`/dielna/${id}/nahlasit`, { dovod: nahlasenie ?? "" })
      .then(() => {
        setNahlasenie(null);
        obnov();
      })
      .catch(ukaz);
  };
  const hlasuje = n.stav === "hlasovanie" || n.stav === "vratene";

  return (
    <div className="dielna dielna-detail">
      <HlavaStranky
        nadpis={n.obsah.nazov || "Bez názvu"}
        uvod={
          <>
            {n.typ === "nova" ? "Návrh novej karty" : `Návrh úpravy karty ${n.zakladKarta?.nazov ?? ""}`} — navrhol(a) <Autor a={n.autor} />{" "}
            {kedy(n.odoslany ?? n.vytvoreny)}
            {n.upraveny > (n.odoslany ?? n.vytvoreny) && ", upravené"}
          </>
        }
        akcia={
          <Odkaz href="/karty/dielna" className="tlacidlo">
            ← Dielňa
          </Odkaz>
        }
      />
      {chyba !== null && <Hlaska>{chyba}</Hlaska>}
      <div className="dielna-detail-mriezka">
        <div className="dielna-detail-karta">
          <NahladKarty karta={karta} vzhlad={vzhlad} sirka={Math.min(320, window.innerWidth - 48)} />
        </div>
        <div className="dielna-detail-info">
          <div className="dielna-znacky">
            <StavCip stav={n.stav} />
            <span className="dielna-typ">{n.typ === "nova" ? "nová karta" : `úprava karty ${n.zakladKarta?.nazov ?? ""}`}</span>
            {n.skryty && <span className="odznak">skrytý pred hráčmi</span>}
          </div>
          {n.obsah.tagy.length > 0 && <p className="tlmene">{n.obsah.tagy.join(" · ")}</p>}
          {n.obsah.efekt !== "" && <p className="glosar-efekt">{n.obsah.efekt}</p>}

          {n.dovod !== "" && (
            <div className={`dielna-dovod dovod-${n.stav}`}>
              <strong>{n.stav === "vratene" ? "Vrátené na úpravu:" : n.stav === "zamietnute" ? "Zamietnuté:" : "Tvorca hry:"}</strong> {n.dovod}
            </div>
          )}
          {(n.stav === "v_tvorcovi" || n.stav === "v_hre") && (
            <p className="dielna-dovod dovod-v_tvorcovi">
              {n.stav === "v_hre" ? (
                <>
                  Karta je v hre — <Odkaz href="/karty">pozri ju medzi kartami</Odkaz>.
                </>
              ) : (
                "Karta je v tvorcovi kariet. Do hry príde so zverejnením sady; ak má nový efekt, najprv ho treba naprogramovať."
              )}
            </p>
          )}

          <div className="dielna-hlas">
            {hlasuje ? (
              <TlacidloCigarety
                pocet={n.cigarety}
                moja={n.mojaCigareta}
                vlastne={autor}
                navstevnik={ja === null || !smiem}
                prepni={n.mojaCigareta ? cigaretaSpat : cigareta}
              />
            ) : (
              <span className="tlmene">
                {n.cigarety} {tvar(n.cigarety, "cigareta", "cigarety", "cigariet")}
              </span>
            )}
            {ja === null && hlasuje && (
              <Odkaz href={`/prihlasenie?spat=/karty/dielna/${id}`} className="tlmene">
                Prihlás sa a daj cigaretu
              </Odkaz>
            )}
          </div>

          {autor && (
            <div className="riadok-tlacidiel">
              {n.stav !== "v_tvorcovi" && n.stav !== "v_hre" && (
                <Odkaz href={`/karty/dielna/${id}/uprava`} className="tlacidlo">
                  Upraviť
                </Odkaz>
              )}
              {(n.stav === "koncept" || n.stav === "vratene" || n.stav === "zamietnute") && (
                <button type="button" className="tlacidlo-hlavne" onClick={odosli}>
                  {n.stav === "koncept" ? "Odoslať na hlasovanie" : "Poslať znova"}
                </button>
              )}
              {n.stav !== "v_tvorcovi" && n.stav !== "v_hre" && (
                <button type="button" className="tlacidlo-jemne" onClick={zmaz}>
                  Zmazať
                </button>
              )}
            </div>
          )}

          {akcie.length > 0 && (
            <>
              <h2 className="dielna-podnadpis">Akcie na karte</h2>
              <ul className="legenda legenda-uzka">
                {akcie.map((k) => {
                  const a = vzhlad.akcie.find((x) => x.kluc === k);
                  return (
                    <li key={k}>
                      <span className="legenda-ikona" style={{ background: farbaKarty(karta, vzhlad.kategorie) }}>
                        <IkonaAkcie kluc={k} akcia={a} />
                      </span>
                      <div>
                        <strong>{a?.nazov ?? k}</strong>
                        <span>{a?.popis}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          {n.obsah.novaAkcia !== "" && (
            <p>
              <strong>Nápad na novú akciu:</strong> {n.obsah.novaAkcia}
            </p>
          )}
          {n.obsah.zdovodnenie !== "" && (
            <p>
              <strong>Prečo:</strong> {n.obsah.zdovodnenie}
            </p>
          )}
          {n.obsah.popisIlustracie !== "" && (
            <p className="tlmene">
              <strong>Ilustrácia:</strong> {n.obsah.popisIlustracie}
            </p>
          )}
        </div>
      </div>

      {n.typ === "uprava" && <RozdielUpravy n={n} vzhlad={vzhlad} />}
      {spravca && <Posudok n={n} sada={sada} obnov={obnov} />}

      <section className="dielna-komentare" aria-labelledby="komentare-nadpis">
        <h2 id="komentare-nadpis">
          Komentáre <span className="tlmene">{n.komentare.length}</span>
        </h2>
        {n.komentare.length === 0 && <p className="tlmene">Zatiaľ nikto nič nenapísal.</p>}
        <ul className="dielna-komentare-zoznam">
          {n.komentare.map((k) => (
            <li key={k.id} className="panel">
              <p className="tlmene dielna-meta">
                <Autor a={k.autor} /> · {kedy(k.vytvoreny)}
                {ja !== null && (ja.id === k.autor.id || spravca) && (
                  <button
                    type="button"
                    className="tlacidlo-male tlacidlo-jemne"
                    onClick={() => {
                      api.del(`/dielna/komentare/${k.id}`).then(obnov).catch(ukaz);
                    }}
                  >
                    Zmazať
                  </button>
                )}
              </p>
              <p>{k.text}</p>
            </li>
          ))}
        </ul>
        {ja !== null && smiem && n.stav !== "koncept" && (
          <form className="dielna-komentar-novy" onSubmit={pridajKomentar}>
            <label className="dielna-pole">
              <span>Tvoj komentár</span>
              <textarea value={komentar} onChange={(e) => setKomentar(e.target.value)} maxLength={1000} rows={3} placeholder="Čo je na karte dobré, čo by si zmenil?" />
            </label>
            <button type="submit" className="tlacidlo-male" disabled={komentar.trim().length < 3}>
              Pridať komentár
            </button>
          </form>
        )}
      </section>

      {ja !== null && !autor && n.stav !== "koncept" && (
        <section className="dielna-nahlasit">
          {n.mojeNahlasenie ? (
            <p className="tlmene">Návrh si nahlásil(a) — správca sa naň pozrie.</p>
          ) : nahlasenie === null ? (
            <button type="button" className="tlacidlo-male tlacidlo-jemne" onClick={() => setNahlasenie("")}>
              Nahlásiť návrh
            </button>
          ) : (
            <form onSubmit={nahlas}>
              <label className="dielna-pole">
                <span>Čo je na návrhu zlé? {PRAVIDLO_LUDI}</span>
                <textarea value={nahlasenie} onChange={(e) => setNahlasenie(e.target.value)} maxLength={500} rows={2} />
              </label>
              <div className="riadok-tlacidiel">
                <button type="submit" className="tlacidlo-male" disabled={nahlasenie.trim().length < 3}>
                  Nahlásiť
                </button>
                <button type="button" className="tlacidlo-male tlacidlo-jemne" onClick={() => setNahlasenie(null)}>
                  Zrušiť
                </button>
              </div>
            </form>
          )}
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Editor

interface StavEditora {
  readonly nazov: string;
  readonly tagy: readonly string[];
  readonly efekt: string;
  /** null = strana upravovanej karty ostáva, ako je (viac rozložení). */
  readonly lava: Pozicie | null;
  readonly prava: Pozicie | null;
  readonly obrazok: string | null;
  readonly popisIlustracie: string;
  readonly novaAkcia: string;
  readonly zdovodnenie: string;
}

const PRAZDNE: Pozicie = [null, null, null, null];

function stavZObsahu(o: ObsahNavrhu): StavEditora {
  return {
    nazov: o.nazov,
    tagy: o.tagy,
    efekt: o.efekt,
    lava: poziciZoStrany(o.lava),
    prava: poziciZoStrany(o.prava),
    obrazok: o.obrazok,
    popisIlustracie: o.popisIlustracie,
    novaAkcia: o.novaAkcia,
    zdovodnenie: o.zdovodnenie,
  };
}

function EditorStrany({
  nazov,
  pozicie,
  povodna,
  vzhlad,
  zmen,
}: {
  readonly nazov: string;
  readonly pozicie: Pozicie | null;
  readonly povodna: KartaNavrh["lava"] | null;
  readonly vzhlad: Vzhlad;
  readonly zmen: (p: Pozicie) => void;
}) {
  if (pozicie === null && povodna !== null) {
    const prve = variant(variantyKarty({ lava: povodna, prava: povodna }), 0)?.lava ?? PRAZDNE;
    return (
      <fieldset className="dielna-strana">
        <legend>{nazov}</legend>
        <p className="tlmene">
          Táto strana má v hre viac rozložení akcií. Ak ju zmeníš, dostane jedno pevné — začneš z prvého.
        </p>
        <button type="button" className="tlacidlo-male" onClick={() => zmen(prve)}>
          Upraviť túto stranu
        </button>
      </fieldset>
    );
  }
  const p = pozicie ?? PRAZDNE;
  return (
    <fieldset className="dielna-strana">
      <legend>{nazov}</legend>
      {[0, 1, 2, 3].map((i) => (
        <label key={i} className="dielna-pozicia">
          <span className="tlmene">{["hore", "2.", "3.", "dole"][i]}</span>
          <select
            value={p[i] ?? ""}
            onChange={(e) => {
              const nove = [...p];
              nove[i] = e.target.value === "" ? null : e.target.value;
              zmen(nove);
            }}
          >
            <option value="">— prázdna —</option>
            {vzhlad.akcie.map((a) => (
              <option key={a.kluc} value={a.kluc}>
                {a.nazov}
              </option>
            ))}
          </select>
        </label>
      ))}
    </fieldset>
  );
}

function Kniznica({ vybrany, vyber }: { readonly vybrany: string | null; readonly vyber: (id: string | null) => void }) {
  const [media, setMedia] = useState<readonly { id: string; nazov: string }[] | null>(null);
  const [otvorena, setOtvorena] = useState(false);
  const [hladat, setHladat] = useState("");
  useEffect(() => {
    if (!otvorena || media !== null) return;
    api
      .get<{ media: { id: string; nazov: string }[] }>("/dielna/kniznica")
      .then((r) => setMedia(r.media))
      .catch(() => setMedia([]));
  }, [otvorena, media]);
  const f = hladat.trim().toLocaleLowerCase("sk");
  return (
    <div className="dielna-kniznica">
      <div className="riadok-tlacidiel">
        {vybrany !== null && <img src={mediaUrl(vybrany, true)} alt="" className="dielna-vybrany-obrazok" />}
        <button type="button" className="tlacidlo-male" onClick={() => setOtvorena(!otvorena)} aria-expanded={otvorena}>
          {otvorena ? "Zavrieť knižnicu" : vybrany === null ? "Vybrať z knižnice" : "Vybrať iný"}
        </button>
        {vybrany !== null && (
          <button type="button" className="tlacidlo-male tlacidlo-jemne" onClick={() => vyber(null)}>
            Bez ilustrácie
          </button>
        )}
      </div>
      {otvorena &&
        (media === null ? (
          <Nacitavanie />
        ) : (
          <>
            <input type="search" placeholder="Hľadať v knižnici…" value={hladat} onChange={(e) => setHladat(e.target.value)} />
            <ul className="dielna-kniznica-mriezka">
              {media
                .filter((m) => f === "" || m.nazov.toLocaleLowerCase("sk").includes(f))
                .slice(0, 120)
                .map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      className={vybrany === m.id ? "vybrany" : undefined}
                      aria-pressed={vybrany === m.id}
                      title={m.nazov}
                      onClick={() => {
                        vyber(m.id);
                        setOtvorena(false);
                      }}
                    >
                      <img src={mediaUrl(m.id, true)} alt={m.nazov} loading="lazy" />
                    </button>
                  </li>
                ))}
            </ul>
          </>
        ))}
    </div>
  );
}

function Editor({ id, zaklad, sada }: { readonly id: number | null; readonly zaklad: string | null; readonly sada: Sada }) {
  useTitulok(id === null ? "Nový návrh · Dielňa" : "Úprava návrhu · Dielňa");
  const { ja } = useUcet();
  const vzhlad = vzhladSady(sada);
  const zakladKarta = useMemo(() => (zaklad === null ? null : (sada.karty.find((k) => k.id === zaklad) ?? null)), [zaklad, sada]);
  const [povodny, setPovodny] = useState<DetailNavrhu | null>(null);
  const [s, setS] = useState<StavEditora | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);
  const [uklada, setUklada] = useState(false);
  const mobil = useMobil();
  const [zvacseny, setZvacseny] = useState(false);
  const ukaz = (e: unknown) => setChyba(e instanceof Error ? e.message : String(e));

  useEffect(() => {
    if (!zvacseny) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZvacseny(false);
    };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [zvacseny]);

  useEffect(() => {
    if (id !== null) {
      api
        .get<{ navrh: DetailNavrhu }>(`/dielna/${id}`)
        .then((r) => {
          setPovodny(r.navrh);
          setS(stavZObsahu(r.navrh.obsah));
        })
        .catch(ukaz);
    } else if (zakladKarta !== null) {
      setS({
        nazov: zakladKarta.nazov,
        tagy: zakladKarta.tagy,
        efekt: zakladKarta.efekt,
        lava: poziciZoStrany(zakladKarta.lava),
        prava: poziciZoStrany(zakladKarta.prava),
        obrazok: zakladKarta.obrazok?.plny ?? null,
        popisIlustracie: "",
        novaAkcia: "",
        zdovodnenie: "",
      });
    } else {
      setS({ nazov: "", tagy: [], efekt: "", lava: PRAZDNE, prava: PRAZDNE, obrazok: null, popisIlustracie: "", novaAkcia: "", zdovodnenie: "" });
    }
  }, [id, zakladKarta]);

  if (ja === null) {
    return (
      <div className="formular-stred panel">
        <p>Navrhovať karty môžeš po prihlásení.</p>
        <Odkaz href="/prihlasenie?spat=/karty/dielna" className="tlacidlo tlacidlo-hlavne">
          Prihlásiť sa
        </Odkaz>
      </div>
    );
  }
  if (s === null) return chyba !== null ? <Hlaska>{chyba}</Hlaska> : <Nacitavanie />;

  const zakladK = povodny?.zakladKarta ?? zakladKarta;
  const obsah: ObsahNavrhu = {
    nazov: s.nazov,
    tagy: s.tagy,
    efekt: s.efekt,
    lava: s.lava === null ? (zakladK?.lava ?? stranaZPozicii(PRAZDNE)) : stranaZPozicii(s.lava),
    prava: s.prava === null ? (zakladK?.prava ?? stranaZPozicii(PRAZDNE)) : stranaZPozicii(s.prava),
    obrazok: s.obrazok,
    popisIlustracie: s.popisIlustracie,
    novaAkcia: s.novaAkcia,
    zdovodnenie: s.zdovodnenie,
  };
  const vsetkyTagy = [...new Set([...sada.kategorie.map((k) => k.nazov), ...sada.karty.flatMap((k) => k.tagy)])].sort((a, b) => a.localeCompare(b, "sk"));
  const spustac = /^\s*([\p{L}]+):/u.exec(s.efekt)?.[1] ?? null;
  const zmen = (z: Partial<StavEditora>) => setS({ ...s, ...z });

  const telo = (): Record<string, unknown> => ({
    nazov: s.nazov,
    tagy: s.tagy,
    efekt: s.efekt,
    ...(s.lava === null ? {} : { lava: s.lava }),
    ...(s.prava === null ? {} : { prava: s.prava }),
    obrazok: s.obrazok,
    popisIlustracie: s.popisIlustracie,
    novaAkcia: s.novaAkcia,
    zdovodnenie: s.zdovodnenie,
  });

  const uloz = async (odoslat: boolean): Promise<void> => {
    setChyba(null);
    setUklada(true);
    try {
      let cielId = id;
      if (cielId === null) cielId = (await api.post<{ id: number }>("/dielna", { ...telo(), ...(zaklad === null ? {} : { zaklad }) })).id;
      else await api.patch(`/dielna/${cielId}`, telo());
      const stav = povodny?.stav ?? "koncept";
      if (odoslat && (stav === "koncept" || stav === "vratene" || stav === "zamietnute")) await api.post(`/dielna/${cielId}/odoslat`);
      chod(`/karty/dielna/${cielId}`);
    } catch (e) {
      ukaz(e);
      // Nový koncept je uložený, aj keď odoslanie neprešlo — ďalej sa upravuje on.
    } finally {
      setUklada(false);
    }
  };
  const uzHlasuje = povodny?.stav === "hlasovanie";

  return (
    <div className="dielna dielna-editor">
      <HlavaStranky
        nadpis={id !== null ? "Úprava návrhu" : zakladK !== null ? `Úprava karty ${zakladK.nazov}` : "Nová karta"}
        uvod={uzHlasuje ? "Návrh je v hlasovaní — zmeny uvidia všetci a cigarety ostanú." : "Koncept vidíš len ty, kým ho neodošleš na hlasovanie."}
        akcia={
          <Odkaz href={id === null ? "/karty/dielna" : `/karty/dielna/${id}`} className="tlacidlo">
            ← späť
          </Odkaz>
        }
      />
      <p className="tlmene">{PRAVIDLO_LUDI}</p>
      {chyba !== null && <Hlaska>{chyba}</Hlaska>}
      <div className="dielna-editor-mriezka">
        <form
          className="dielna-editor-form"
          onSubmit={(e) => {
            e.preventDefault();
            void uloz(false);
          }}
        >
          <section className="panel">
            <h2>1. Názov a tagy</h2>
            <label className="dielna-pole">
              <span>Názov karty</span>
              <input value={s.nazov} onChange={(e) => zmen({ nazov: e.target.value })} maxLength={40} required />
            </label>
            <div className="cipy" role="group" aria-label="Tagy">
              {vsetkyTagy.map((t) => {
                const ma = s.tagy.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    className={`cip ${ma ? "aktivny" : ""}`}
                    aria-pressed={ma}
                    disabled={!ma && s.tagy.length >= 5}
                    onClick={() => zmen({ tagy: ma ? s.tagy.filter((x) => x !== t) : [...s.tagy, t] })}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="panel">
            <h2>2. Akcie po stranách</h2>
            <p className="tlmene">Každá strana má 4 pozície zhora nadol. Akcia sa aktivuje, keď sa na spoji so susednou kartou stretne s akciou na tej istej výške.</p>
            <div className="dielna-strany">
              <EditorStrany nazov="Ľavá strana" pozicie={s.lava} povodna={zakladK?.lava ?? null} vzhlad={vzhlad} zmen={(p) => zmen({ lava: p })} />
              <EditorStrany nazov="Pravá strana" pozicie={s.prava} povodna={zakladK?.prava ?? null} vzhlad={vzhlad} zmen={(p) => zmen({ prava: p })} />
            </div>
            <label className="dielna-pole">
              <span>Nápad na novú akciu (voliteľné) — hra ju zatiaľ nepozná, opíš, čo by robila</span>
              <textarea value={s.novaAkcia} onChange={(e) => zmen({ novaAkcia: e.target.value })} maxLength={600} rows={2} />
            </label>
          </section>

          <section className="panel">
            <h2>3. Efekt</h2>
            <div className="cipy" role="group" aria-label="Spúšťač efektu">
              {ALL_TRIGGERS.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`cip ${spustac === t ? "aktivny" : ""}`}
                  aria-pressed={spustac === t}
                  onClick={() => zmen({ efekt: `${t}: ${s.efekt.replace(/^\s*[\p{L}]+:\s*/u, "")}` })}
                >
                  {t}
                </button>
              ))}
            </div>
            <label className="dielna-pole">
              <span>
                Text efektu — začína spúšťačom (napr. „Bitka: …“). Voliteľný. <span className="tlmene">{s.efekt.length}/300</span>
              </span>
              <textarea value={s.efekt} onChange={(e) => zmen({ efekt: e.target.value })} maxLength={300} rows={3} />
            </label>
          </section>

          <section className="panel">
            <h2>4. Ilustrácia (voliteľné)</h2>
            <Kniznica vybrany={s.obrazok} vyber={(o) => zmen({ obrazok: o })} />
            <label className="dielna-pole">
              <span>Alebo ju opíš slovami — po schválení podľa toho vznikne nová</span>
              <textarea value={s.popisIlustracie} onChange={(e) => zmen({ popisIlustracie: e.target.value })} maxLength={400} rows={2} />
            </label>
          </section>

          <section className="panel">
            <h2>5. Prečo (voliteľné)</h2>
            <label className="dielna-pole">
              <span>Čo karta hre pridá, aký problém rieši</span>
              <textarea value={s.zdovodnenie} onChange={(e) => zmen({ zdovodnenie: e.target.value })} maxLength={1000} rows={3} />
            </label>
          </section>

          <div className="riadok-tlacidiel dielna-editor-tlacidla">
            <button type="submit" disabled={uklada}>
              {uzHlasuje ? "Uložiť zmeny" : "Uložiť koncept"}
            </button>
            {!uzHlasuje && (
              <button type="button" className="tlacidlo-hlavne" disabled={uklada} onClick={() => void uloz(true)}>
                {povodny === null || povodny.stav === "koncept" ? "Uložiť a odoslať na hlasovanie" : "Uložiť a poslať znova"}
              </button>
            )}
          </div>
        </form>
        {/* Na mobile je náhľad malá karta plávajúca vpravo dole — ostane na očiach
            aj pri úprave akcií; klik ju zväčší. */}
        <aside className={mobil ? "dielna-editor-nahlad plavajuci" : "dielna-editor-nahlad"} aria-label="Náhľad karty">
          {mobil ? (
            <button type="button" className="dielna-nahlad-mini" onClick={() => setZvacseny(true)} aria-label="Zväčšiť náhľad karty">
              <NahladKarty karta={kartaZNavrhu(obsah, zakladK)} vzhlad={vzhlad} sirka={76} bezPopisov />
            </button>
          ) : (
            <NahladKarty karta={kartaZNavrhu(obsah, zakladK)} vzhlad={vzhlad} sirka={260} />
          )}
        </aside>
      </div>
      {mobil && zvacseny && (
        <div className="modal" onClick={() => setZvacseny(false)} role="dialog" aria-modal="true" aria-label="Náhľad karty">
          <div className="modal-obsah dielna-nahlad-velky" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="modal-zavriet tlacidlo-jemne" onClick={() => setZvacseny(false)} aria-label="Zavrieť">
              ✕
            </button>
            <NahladKarty karta={kartaZNavrhu(obsah, zakladK)} vzhlad={vzhlad} sirka={Math.min(300, window.innerWidth - 64)} />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

/** Stránka /karty/dielna/… — zoznam, nový návrh, detail a úprava. */
export function Dielna({ cesta }: { readonly cesta: string }): ReactNode {
  const { sada, chyba } = useSada();
  if (chyba !== null) return <Hlaska>{chyba}</Hlaska>;
  if (sada === null) return <Nacitavanie />;
  const casti = cesta.split("/").filter((c) => c !== "").slice(2);
  if (casti.length === 0) return <Zoznam sada={sada} />;
  if (casti[0] === "novy") return <Editor key="novy" id={null} zaklad={new URLSearchParams(location.search).get("zaklad")} sada={sada} />;
  const id = Number(casti[0]);
  if (!Number.isInteger(id)) return <Hlaska>Taký návrh v Dielni nie je.</Hlaska>;
  if (casti[1] === "uprava") return <Editor key={`u${id}`} id={id} zaklad={null} sada={sada} />;
  return <Detail key={id} id={id} sada={sada} />;
}
