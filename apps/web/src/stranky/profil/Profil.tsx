// Profil hráča (Michal 2026-10-22, dizajn profily-20261022-1409): hlavička
// s Frajerinou, záložky Prehľad · Súhrn · Partie a prepínač ľudia / boti / spolu.
// Čo kto vidí, rozhoduje server: cudzí len formu z 5 partií, bilanciu, „vy dvaja“
// a súhrn bez silných a slabých stránok (ak si ho hráč neskryl); zoznam
// a detail partií len vlastník a správca. AI playtester je hráčom skrytý (404).

import { useEffect, useState, type ReactNode } from "react";
import { api, textChyby } from "../../lib/api.ts";
import { Odkaz, useTitulok } from "../../lib/router.tsx";
import { RANKY_HRACOV, nazovUrovne, useUcet, type Pouzivatel, type Rola } from "../../lib/ucet.tsx";
import { Avatar, Hlaska, Nacitavanie } from "../../komponenty.tsx";
import { HlavaStranky } from "../../HlavaStranky.tsx";
import { datum } from "../../lib/datum.ts";
import { BilanciaPruh, CisloFrajeriny, GrafFrajeriny, Statistiky } from "../Statistiky.tsx";
import {
  SKRATKA_VYSLEDKU,
  TEXT_VYSLEDKU,
  hodnotaMetriky,
  trvanie,
  znamienko,
  type Bilancia,
  type FilterPartii,
  type Metrika,
  type PartieApi,
  type PostupRanku,
  type ProfilApi,
  type RiadokPartie,
  type Vysledok,
} from "./typy.ts";
import { PoslednePodtacky, VitrinaHraca } from "../../achievementy/VitrinaHraca.tsx";
import { DLZKY_HRY, NAZOV_DLZKY } from "@naex/core";
import { stavLigyVProfile, type StavLigy } from "../../hra/ligy.ts";
import { t } from "../../i18n/jazyk.tsx";
import "./profil.css";

type Zalozka = "prehlad" | "suhrn" | "partie" | "achievementy";

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
      .catch((e: unknown) => zive && setChyba(textChyby(e)));
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
      .catch((e: unknown) => zive && setChyba(textChyby(e)));
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
      {vysledky.length === 0 ? <p className="tlmene">{t("hrac.ziadnaPartia")}</p> : <FormaStvorce vysledky={vysledky} nazov={nadpis} />}
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
    <span className={`metrika-porovnanie ${trieda}`} title={t("hrac.superiTitul", { hodnota: hodnotaMetriky(m, s), rozdiel: znamienko(rozdiel) })}>
      {rozdiel === 0 ? t("hrac.akoSuperi") : `${lepsie ? "▲" : "▼"} ${t("hrac.superiN", { hodnota: hodnotaMetriky(m, s) })}`}
    </span>
  );
}

function KartaMetriky({ m }: { readonly m: Metrika }) {
  return (
    <div className="metrika" title={m.popis}>
      <span className="metrika-hodnota">{hodnotaMetriky(m, m.hodnota)}</span>
      <span className="metrika-nazov">{m.nazov}</span>
      <span className="metrika-zdroj">{m.partii === 0 ? t("hrac.bezDat") : t("hrac.zPartii", { n: m.partii })}</span>
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
        <h2>{profil.pohlad === "vlastny" ? t("hrac.tvojeStranky") : t("hrac.stranky")}</h2>
        <span className="tlmene">{t("hrac.vociSuperom")}</span>
      </header>
      {s.partii < 5 ? (
        <p className="tlmene">{t("hrac.ukazuSaOd", { n: s.partii })}</p>
      ) : (
        <div className="stranky-mriezka">
          <div>
            <h3 className="stranky-nadpis dobre">▲ {t("hrac.coTiIde")}</h3>
            {s.silne.length === 0 ? <p className="tlmene">{t("hrac.nicVyrazne")}</p> : s.silne.map((x) => <Stranka key={x.kluc} text={x.text} dokaz={x.dokaz} dobra />)}
          </div>
          <div>
            <h3 className="stranky-nadpis zle">▼ {t("hrac.kdeTecie")}</h3>
            {s.slabe.length === 0 ? <p className="tlmene">{t("hrac.nicVyrazne")}</p> : s.slabe.map((x) => <Stranka key={x.kluc} text={x.text} dokaz={x.dokaz} />)}
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
          {p.super.bot !== undefined && <span className="odznak">{t("hrac.bot")}</span>}
          <small className="tlmene">
            {datum(p.koniec)} · {t("hrac.kol", { n: p.kola })} · {trvanie(p.trvanie)}
            {!p.dohrata && t("hrac.nedohrana")}
          </small>
        </span>
      </span>
      <span className="partia-body">{p.body === null ? "—" : `${p.body[0]} : ${p.body[1]}`}</span>
      <span className={`partia-frajerina ${p.frajerina === null ? "" : p.frajerina.po >= p.frajerina.pred ? "plus" : "minus"}`}>
        {p.frajerina === null ? "" : znamienko(p.frajerina.po - p.frajerina.pred)}
      </span>
      <Odkaz href={`/partia/${p.id}`} className="partia-detail" aria-label={t("hrac.detailS", { meno: p.super.meno })}>
        {t("hrac.detail")} ›
      </Odkaz>
    </li>
  );
}

function ZoznamPartii({ id, filter, limit }: { readonly id: number; readonly filter: FilterPartii; readonly limit: number }) {
  const [kolko, setKolko] = useState(limit);
  const { data, chyba } = usePartie(id, filter, kolko, true);
  if (chyba !== null) return <Hlaska>{chyba}</Hlaska>;
  if (data === null) return <Nacitavanie text={t("hrac.nacitavamPartie")} />;
  if (data.partie.length === 0) return <p className="tlmene">{t("hrac.vyberPrazdny")}</p>;
  return (
    <>
      <ol className="partie-zoznam">
        {data.partie.map((p) => (
          <RiadokPartieEl key={p.id} p={p} />
        ))}
      </ol>
      {data.pocet > data.partie.length && limit > 5 && (
        <button type="button" className="tlacidlo-male" onClick={() => setKolko((k) => k + 20)}>
          {t("hrac.nacitatDalsie", { n: data.pocet - data.partie.length })}
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
        <b>{b.partie}</b> {t("hrac.partiaSlovo", { n: b.partie })} · <span className="dobre">{b.vyhry} {t("hrac.V")}</span> · {b.remizy} {t("hrac.R")} ·{" "}
        <span className="zle">{b.prehry} {t("hrac.P")}</span>
      </span>
      <BilanciaPruh vyhry={b.vyhry} remizy={b.remizy} prehry={b.prehry} />
    </div>
  );
}

/** Ligy hráča (Michal 2026-10-28): stav každej, výhry proti ľuďom v nej a čo chýba do odomknutia. */
function Ligy({ ligy, vlastny }: { readonly ligy: readonly StavLigy[]; readonly vlastny: boolean }) {
  return (
    <section className="panel profil-karta">
      <header className="profil-karta-hlava">
        <h2>{t("hrac.ligy")}</h2>
        <span className="tlmene">{t("hrac.ligyPozn")}</span>
      </header>
      <ul className="profil-ligy">
        {ligy.map((l) => {
          const { stav, detail } = stavLigyVProfile(l);
          return (
            <li key={l.liga} className={`profil-liga profil-liga-${l.pristup ?? (l.smie ? "odomknuta" : "zamknuta")}`}>
              <div className="profil-liga-hlava">
                <strong>{NAZOV_DLZKY[l.liga]}</strong>
                <span className="tlmene">
                  {t("lobby.lokalit", { n: DLZKY_HRY[l.liga] })}
                </span>
                <span className="odznak">{stav}</span>
              </div>
              <div className="tlmene">
                {t("hrac.vyhier", { n: l.vyhry ?? 0 })}
                {detail !== null && <> · {vlastny ? detail : detail.replace("(máš ", "(má ")}</>}
              </div>
              {l.postup !== null && l.pristup !== "odomknuta" && (
                <span className="profil-liga-pruh" aria-hidden="true">
                  <span style={{ width: `${Math.min(100, (100 * l.postup.ma) / Math.max(1, l.postup.treba))}%` }} />
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Hviezdy achievementov a cesta k ďalšiemu ranku (Michal 2026-10-25) — „Deci: 40 / 66 ★“. */
function PostupRankuOdznak({ p }: { readonly p: PostupRanku }) {
  const dalsi = p.dalsi;
  const title =
    dalsi === null
      ? t("hrac.hviezdy", { n: p.hviezdy, spolu: p.spolu })
      : t("hrac.hviezdyDalsi", { n: p.hviezdy, spolu: p.spolu, rank: nazovUrovne(dalsi.rank), prah: dalsi.prah, chyba: Math.max(0, dalsi.prah - p.hviezdy) });
  return (
    <span className="profil-postup-ranku" title={title}>
      {dalsi === null ? (
        <>
          {p.hviezdy} / {p.spolu} ★
        </>
      ) : (
        <>
          {nazovUrovne(dalsi.rank)}: {p.hviezdy} / {dalsi.prah} ★
          <span className="profil-postup-pruh" aria-hidden="true">
            <span style={{ width: `${Math.min(100, (100 * p.hviezdy) / dalsi.prah)}%` }} />
          </span>
        </>
      )}
    </span>
  );
}

/** Profil hráča (/hrac/:id). */
export function HracProfil({ id }: { readonly id: number }) {
  const { nastav } = useUcet();
  const [filter, setFilter] = useState<FilterPartii>("ludia");
  const [zalozka, setZalozka] = useState<Zalozka>("prehlad");
  const [obnov, setObnov] = useState(0);
  const { profil, chyba } = useProfilApi(id, filter, obnov);
  useTitulok(profil?.hrac.meno ?? t("hrac.hrac"));
  const plny = profil !== null && profil.pohlad !== "cudzi";
  const forma20 = usePartie(id, filter, 20, plny);

  if (chyba !== null) {
    return (
      <HlavaStranky
        nadpis={t("hrac.nenasielSa")}
        uvod={chyba}
        akcia={
          <Odkaz href="/rebricek" className="tlacidlo">
            {t("nav.rebricek")}
          </Odkaz>
        }
      />
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
  const vitrina = profil.achievementy;

  return (
    <div className="profil-hraca">
      <HlavaStranky nadpis={profil.hrac.meno} uvod={vlastny ? t("hrac.uvodVlastny") : t("hrac.uvod")} />
      {profil.skryty && <p className="profil-skryty-pas">{t("hrac.skryty")}</p>}
      <section className="panel profil-hlavicka">
        <Avatar meno={profil.hrac.meno} avatar={profil.hrac.avatar} velkost={96} />
        <div className="profil-hlavicka-texty">
          <strong className="profil-meno">{profil.hrac.meno}</strong>
          <div className="profil-odznaky">
            <span className="odznak">{f.titul}</span>
            {profil.hrac.rola === "admin" && <span className="odznak odznak-admin">{t("hrac.tvorca")}</span>}
            {profil.hrac.rola === "subadmin" && <span className="odznak">subadmin</span>}
            {RANKY_HRACOV.includes(profil.hrac.rola as Rola) && <span className="odznak">{nazovUrovne(profil.hrac.rola as Rola)}</span>}
            {profil.postupRanku != null && <PostupRankuOdznak p={profil.postupRanku} />}
            <span className="tlmene">{t("hrac.vKrcmeOd", { datum: datum(profil.hrac.vytvoreny) })}</span>
          </div>
          {vlastny && (
            <div className="profil-vlastne">
              <Odkaz href="/profil">{t("hrac.upravit")}</Odkaz>
              <label className="profil-prepinac" title={t("hrac.ostatniUvidia")}>
                <input type="checkbox" checked={profil.suhrnSkryty} onChange={(e) => skrySuhrn(e.target.checked)} /> {t("hrac.skrytSuhrn")}
              </label>
            </div>
          )}
        </div>
        <div className="profil-frajerina">
          <span className="profil-frajerina-nazov">{t("lobby.frajerina")}</span>
          <CisloFrajeriny f={f} velke />
          <span className="tlmene">
            {f.poradie !== null && (
              <>
                <Odkaz href="/rebricek">{t("hrac.vRebricku", { n: f.poradie })}</Odkaz> ·{" "}
              </>
            )}
            {t("hrac.najvyssia", { n: f.najvyssia })}
          </span>
        </div>
      </section>

      <div className="profil-ovladanie">
        <nav className="zalozky" aria-label={t("hrac.casti")}>
          {(
            [
              ["prehlad", t("hrac.prehlad")],
              ["suhrn", t("hrac.suhrn")],
              ...(plny ? ([["partie", t("hrac.partie")]] as const) : []),
              ...(vitrina != null ? ([["achievementy", t("hrac.achievementy")]] as const) : []),
            ] as const
          ).map(([k, nazov]) => (
            <button key={k} type="button" className={zalozka === k ? "zalozka aktivna" : "zalozka"} aria-pressed={zalozka === k} onClick={() => setZalozka(k)}>
              {nazov}
            </button>
          ))}
        </nav>
        {plny ? (
          <div className="segment" role="group" aria-label={t("hrac.partie")}>
            {(
              [
                ["ludia", t("hrac.sLudmi"), profil.bilancia.ludia.partie],
                ["boti", t("hrac.sBotmi"), profil.bilancia.boti.partie],
                ["spolu", t("linia.spolu"), profil.bilancia.ludia.partie + profil.bilancia.boti.partie],
              ] as const
            ).map(([k, nazov, n]) => (
              <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>
                {nazov} <small>{n}</small>
              </button>
            ))}
          </div>
        ) : (
          <span className="tlmene">
            {profil.bilancia.boti.partie > 0 && t("hrac.sBotmiPlus", { n: profil.bilancia.boti.partie })}
            {t("hrac.cislaLen")}
          </span>
        )}
      </div>

      {zalozka === "prehlad" && (
        <div className="profil-prehlad">
          {nova && (
            <section className="panel profil-karta profil-novy">
              <h2>{t("hrac.prvychPat")}</h2>
              <p>
                {vlastny
                  ? t("hrac.novyVlastny")
                  : t("hrac.novyCudzi")}
              </p>
              {vlastny && (
                <Odkaz href="/hra" className="tlacidlo tlacidlo-hlavne">
                  {t("hrac.zahrat")}
                </Odkaz>
              )}
            </section>
          )}
          {plny ? (
            <Forma
              vysledky={(forma20.data?.partie ?? []).map((p) => p.vysledok)}
              nadpis={t("hrac.formaPoslednych", { n: Math.min(20, forma20.data?.partie.length ?? 0) })}
              pozn={t("hrac.formaPozn")}
            />
          ) : (
            <Forma vysledky={profil.forma} nadpis={t("hrac.forma5")} />
          )}
          {profil.vyDvaja !== null && profil.vyDvaja.partie > 0 && (
            <section className="panel profil-karta">
              <h2>{t("hrac.vyDvaja")}</h2>
              <BilanciaRiadok b={profil.vyDvaja} nazov={t("hrac.tvojePartieSNim")} />
            </section>
          )}
          {profil.suhrnSkryty && profil.pohlad === "cudzi" ? (
            <section className="panel profil-karta">
              <p className="tlmene">{t("hrac.suhrnSkryty")}</p>
            </section>
          ) : (
            hlavne.length > 0 && (
              <section className="panel profil-karta">
                <header className="profil-karta-hlava">
                  <h2>{t("hrac.vCislach")}</h2>
                  <span className="tlmene">{t("hrac.porovnanie")}</span>
                </header>
                <div className="metriky-mriezka">
                  {hlavne.map((m) => (
                    <KartaMetriky key={m.kluc} m={m} />
                  ))}
                </div>
              </section>
            )
          )}
          {vitrina != null && <PoslednePodtacky vitrina={vitrina} vlastna={vlastny} vsetky={() => setZalozka("achievementy")} />}
          <SilneSlabe profil={profil} />
          <section className="panel profil-karta">
            <h2>{t("hrac.bilancia")}</h2>
            <BilanciaRiadok b={profil.bilancia.ludia} nazov={t("hrac.sLudmiMale")} />
            <BilanciaRiadok b={profil.bilancia.boti} nazov={t("hrac.sBotmiMale")} />
          </section>
          {profil.ligy !== undefined && <Ligy ligy={profil.ligy} vlastny={vlastny} />}
          {plny && (
            <div className="profil-dva-stlpce">
              <section className="panel profil-karta">
                <header className="profil-karta-hlava">
                  <h2>{t("hrac.poslednePartie")}</h2>
                  <button type="button" className="tlacidlo-male tlacidlo-jemne" onClick={() => setZalozka("partie")}>
                    {t("hrac.vsetky")} ›
                  </button>
                </header>
                <ZoznamPartii id={id} filter={filter} limit={5} />
              </section>
              {profil.superi.length > 0 && (
                <section className="panel profil-karta">
                  <h2>{t("hrac.superi")}</h2>
                  <ul className="superi-zoznam">
                    {profil.superi.map((s, i) => (
                      <li key={s.id ?? `b${i}`}>
                        <Avatar meno={s.meno} avatar={s.avatar} velkost={28} />
                        {s.id === null ? <strong>{s.meno}</strong> : <Odkaz href={`/hrac/${s.id}`}>{s.meno}</Odkaz>}
                        <span className="tlmene">
                          {t("hrac.partii", { n: s.partie })}
                        </span>
                        <span>
                          <span className="dobre">{s.vyhry} {t("hrac.V")}</span> · {s.remizy} {t("hrac.R")} · <span className="zle">{s.prehry} {t("hrac.P")}</span>
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
              <h2>{t("hrac.vyvojFrajeriny")}</h2>
              <GrafFrajeriny historia={profil.historia} />
            </section>
          )}
        </div>
      )}

      {zalozka === "suhrn" && (
        <div className="profil-prehlad">
          {profil.suhrn === null ? (
            <section className="panel profil-karta">
              <p className="tlmene">{profil.suhrnSkryty ? t("hrac.suhrnSkrytyKratko") : t("hrac.suhrnNie")}</p>
            </section>
          ) : (
            <section className="panel profil-karta">
              <header className="profil-karta-hlava">
                <h2>{t("hrac.suhrn")} · {t("hrac.partii", { n: profil.suhrn.partii })}</h2>
                <span className="tlmene">{t("hrac.trendPozn")}</span>
              </header>
              <table className="suhrn-tabulka">
                <thead>
                  <tr>
                    <th>Čo</th>
                    <th>{t("hrac.hodnota")}</th>
                    <th>{t("hrac.superi")}</th>
                    <th>{t("hrac.hraci")}</th>
                    <th>{t("hrac.trend")}</th>
                    <th>{t("hrac.zPartiiNadpis")}</th>
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
              <summary>{t("hrac.vsetkyPocitadla")}</summary>
              <Statistiky profil={profil} vlastny={vlastny} />
            </details>
          )}
        </div>
      )}

      {zalozka === "achievementy" && vitrina != null && (
        <section className="panel profil-karta">
          <VitrinaHraca vitrina={vitrina} vlastna={vlastny} />
        </section>
      )}

      {zalozka === "partie" && plny && (
        <section className="panel profil-karta">
          <h2>{t("hrac.partie")}</h2>
          <ZoznamPartii id={id} filter={filter} limit={20} />
        </section>
      )}
    </div>
  );
}
