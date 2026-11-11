// Vrstva Karty ako galéria s detailom (Michal 2026-11-09, mock M7 v docs/napady/karty-hraca-mocky.html):
// vľavo hráč a počítadlá, v strede všetky jeho karty ako dlaždice s ilustráciou, vpravo veľká karta
// s efektom slovami. Priznané kliatby a Dedičstvo vidno naraz — záložky ukázali vždy len jedno.

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { CardInstance, ClientState, GameData, PlayerId } from "@naex/core";
import { akciaZTokenu, hranySlovami, menoAkcie, vazniNaVyhru } from "@naex/core";
import type { Sada } from "@naex/tvorba";
import { farbaKarty, formatujEfekt } from "@naex/tvorba";
import { Avatar } from "../komponenty.tsx";
import { mediaUrl } from "../lib/api.ts";
import { nazovSkupiny, skupinyBalicka } from "./doberaciBalicek.ts";
import { vzhladKarty } from "./HernaKarta.tsx";
import { IkonaCigareta } from "./ikonyZdrojov.tsx";
import { Vrstva } from "./Vrstva.tsx";
import { t } from "../i18n/jazyk.tsx";
import "./galeria-kariet.css";

/** Sekcia, pri ktorej sa galéria otvorí (dlaždica Karty, tlačidlá Balíček a Odhodené pri ruke). */
export type SekciaKariet = "balicek" | "odhodene" | "priznane" | "dedicstvo";

type Sekcia = SekciaKariet | "pivnica";

interface Polozka {
  readonly kluc: string;
  readonly sekcia: Sekcia;
  readonly karta: CardInstance;
  /** Kde karta leží — štítok pod veľkou kartou. */
  readonly kde: string;
  readonly pocet: number;
}

export interface GaleriaKarietProps {
  readonly view: ClientState;
  readonly data: GameData;
  readonly sada: Sada;
  readonly hrac: PlayerId;
  readonly moje: boolean;
  readonly meno: string;
  readonly avatar: string | null;
  readonly sekcia: SekciaKariet;
  /** Veľká karta v detaile — stôl ju obalí lupou, klik ju zväčší ako všade inde. */
  readonly velka: (karta: CardInstance, sirka: number) => ReactNode;
  readonly skryta: boolean;
  readonly onZavri: () => void;
}

/** Pomer strán vytlačenej karty (63 × 88 mm) — z výšky stĺpca sa ráta šírka veľkej karty. */
const POMER_KARTY = 88 / 63;
/** Miesto pod veľkou kartou na štítok, názov a text efektu. */
const VYSKA_TEXTU = 190;
/** Telefón na šírku: detail je nízky, text dostane menej a posúva sa. */
const NIZKY_DETAIL = 360;
const VYSKA_TEXTU_NIZKA = 110;
const NAJMENSIA_VELKA = 100;

/** Efekt karty slovami: hrany Nástroja a piktogramy {Akcia} karta kreslí, tu ich hráč číta. */
function efektSlovami(efekt: string): string {
  return hranySlovami(efekt).replace(/\{([^{}]+)\}/gu, (cely: string, token: string) => {
    const a = akciaZTokenu(token);
    return a === null ? cely : menoAkcie(a);
  });
}

export function GaleriaKariet({ view, data, sada, hrac, moje, meno, avatar, sekcia, velka, skryta, onZavri }: GaleriaKarietProps) {
  const h = view.hraci[hrac];
  const vazni = view.vazni.filter((v) => v.hrac === hrac);
  const skupiny = useMemo(() => (moje ? skupinyBalicka(data, view.mojBalicekZlozenie) : []), [moje, data, view.mojBalicekZlozenie]);

  const polozka = (s: Sekcia, karta: CardInstance, kde: string, pocet = 1): Polozka => ({ kluc: `${s}:${karta.uid}`, sekcia: s, karta, kde, pocet });
  const priznane = h.priznane.map((k) => polozka("priznane", k, t("galeria.priznana")));
  const dedicstvo = h.dedicstvo.map((k) => polozka("dedicstvo", k, t("galeria.dedicstvo")));
  const pivnica = vazni.map((v) => polozka("pivnica", v.karta, t("galeria.vazen", { n: v.poradie })));
  const balicek = skupiny.map((s) => ({ nazov: s.nazov, pocet: s.pocet, karty: s.karty.map((k) => polozka("balicek", k.karta, t("galeria.doberaci"), k.pocet)) }));
  const odhodene = moje ? h.odhadzovaci.map((k) => polozka("odhodene", k, t("galeria.odhadzovaci"))) : [];
  const vsetky = [...priznane, ...dedicstvo, ...pivnica, ...balicek.flatMap((s) => s.karty), ...odhodene];

  const prvaVSekcii = (s: Sekcia): string | null => vsetky.find((p) => p.sekcia === s)?.kluc ?? null;
  const [vybranaKluc, setVybranaKluc] = useState<string | null>(() => prvaVSekcii(sekcia));
  // Karta, ktorá medzitým odišla (odhodená, priznaná inam), detail neudrží — vezme prvú, čo je.
  const vybrana = vsetky.find((p) => p.kluc === vybranaKluc) ?? vsetky.find((p) => p.sekcia === sekcia) ?? vsetky[0] ?? null;

  // Tlačidlá Balíček a Odhodené pri ruke otvoria galériu pri svojej sekcii.
  const stred = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setVybranaKluc(prvaVSekcii(sekcia));
    stred.current?.querySelector(`[data-sekcia="${sekcia}"]`)?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- len pri zmene sekcie, nie pri každom prekreslení stola
  }, [sekcia]);

  // Veľká karta je taká veľká, ako dovolí výška okna: na notebooku 650 px sa zmestí aj s textom pod ňou.
  const detail = useRef<HTMLDivElement>(null);
  const [sirkaVelkej, setSirkaVelkej] = useState(220);
  useLayoutEffect(() => {
    const el = detail.current;
    if (el === null) return;
    const zmeraj = (): void => {
      const podlaVysky = (el.clientHeight - (el.clientHeight < NIZKY_DETAIL ? VYSKA_TEXTU_NIZKA : VYSKA_TEXTU)) / POMER_KARTY;
      const sirka = Math.round(Math.min(300, el.clientWidth - 36, podlaVysky));
      // Do veľmi nízkeho okna sa karta nezmestí čitateľne — ostane text efektu, kartu zväčší lupa na stole.
      setSirkaVelkej(sirka < NAJMENSIA_VELKA ? 0 : sirka);
    };
    zmeraj();
    const ro = new ResizeObserver(zmeraj);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const dlazdica = (p: Polozka): ReactNode => {
    const vz = vzhladKarty(sada, data, p.karta.defId);
    return (
      <button
        key={p.kluc}
        type="button"
        className={p.kluc === vybrana?.kluc ? "gk-dlazdica vybrana" : "gk-dlazdica"}
        aria-pressed={p.kluc === vybrana?.kluc}
        style={{ "--farba": farbaKarty(vz, sada.kategorie) } as React.CSSProperties}
        onMouseEnter={() => setVybranaKluc(p.kluc)}
        onFocus={() => setVybranaKluc(p.kluc)}
        onClick={() => setVybranaKluc(p.kluc)}
      >
        <span className="gk-obraz">{vz.obrazok !== null && <img src={mediaUrl(vz.obrazok.nahlad, true)} alt="" draggable={false} loading="lazy" />}</span>
        <span className="gk-nazov">{vz.nazov}</span>
        {p.pocet > 1 && <span className="gk-kusov">×{p.pocet}</span>}
      </button>
    );
  };
  const nadpis = (text: string, pocet: ReactNode, pozn?: ReactNode): ReactNode => (
    <h3>
      {text} <b>{pocet}</b>
      {pozn !== undefined && <span>{pozn}</span>}
    </h3>
  );
  const nic = <span className="popis">{t("galeria.zatialNic")}</span>;

  const nepriznane = view.nepriznaneKliatby[hrac].cirhoza;
  const prahVaznov = vazniNaVyhru(view.lokalitCelkom);
  const riadok = (text: string, hodnota: ReactNode): ReactNode => (
    <div className="gk-riadok">
      <span>{text}</span>
      <b>{hodnota}</b>
    </div>
  );
  const vzVybranej = vybrana === null ? null : vzhladKarty(sada, data, vybrana.karta.defId);
  const riadkyEfektu = useMemo(() => (vzVybranej === null ? [] : formatujEfekt(efektSlovami(vzVybranej.efekt), sada.klucoveSlova)), [vzVybranej, sada.klucoveSlova]);

  return (
    <Vrstva nazov={moje ? t("galeria.tvojeKarty") : t("galeria.kartyHraca", { meno })} skryta={skryta} onZavri={onZavri} trieda={moje ? "galeria-kariet" : "galeria-kariet supera"}>
      <div className="gk">
        <aside className="gk-hrac">
          <Avatar meno={meno} avatar={avatar} velkost={96} farba={moje ? "ja" : "su"} />
          <div className="gk-pocitadla">
            {riadok(t("tabula.priznaneKliatby"), h.priznane.length)}
            {nepriznane > 0 && riadok(t("galeria.cirhozyNepriznane"), nepriznane)}
            {h.dlhy > 0 && riadok(t("pult.dlhy"), h.dlhy)}
            {h.abstaky > 0 && riadok(t("pocitadlo.abstak"), h.abstaky)}
            {vazni.length > 0 && riadok(t("tabula.vazni"), `${vazni.length}/${prahVaznov}`)}
            {riadok(t("galeria.dedicstvo"), h.dedicstvo.length)}
            {moje ? (
              <>
                {riadok(t("galeria.balicek"), h.doberaciPocet)}
                {riadok(t("galeria.odhodene"), h.odhadzovaci.length)}
                {riadok(
                  t("galeria.dalsiNastroj"),
                  <span className="gk-cena" title={t("galeria.cenaNastroja")}>
                    {view.cenaDedicstva}
                    <IkonaCigareta />
                  </span>,
                )}
              </>
            ) : (
              riadok(t("galeria.vRuke"), h.rukaPocet)
            )}
          </div>
        </aside>

        <div className="gk-stred" ref={stred}>
          <div className="gk-dvojica">
            <section data-sekcia="priznane">
              {nadpis(t("tabula.priznaneKliatby"), h.priznane.length, t("galeria.natrvalo"))}
              <div className="gk-dlazdice hlavne">{priznane.length === 0 ? nic : priznane.map(dlazdica)}</div>
            </section>
            <section data-sekcia="dedicstvo">
              {nadpis(t("galeria.dedicstvoNaradie"), h.dedicstvo.length)}
              <div className="gk-dlazdice hlavne">{dedicstvo.length === 0 ? nic : dedicstvo.map(dlazdica)}</div>
            </section>
          </div>
          {pivnica.length > 0 && (
            <section data-sekcia="pivnica" data-vyucba="pivnica">
              {nadpis(t("galeria.pivnica"), `${vazni.length}/${prahVaznov}`)}
              <p className="popis">
                {t("galeria.vazenPopis")} {moje ? t("galeria.vazenKseftJa") : t("galeria.vazenKseftSu")}
              </p>
              <div className="gk-dlazdice hlavne">{pivnica.map(dlazdica)}</div>
            </section>
          )}
          {moje && (
            <>
              <section data-sekcia="balicek">
                {nadpis(t("galeria.doberaci"), h.doberaciPocet, t("galeria.podlaTypu"))}
                {h.doberaciPocet === 0 && <span className="popis">{t("galeria.prazdny")}</span>}
                <div className="gk-skupiny">
                  {balicek.map((s) => (
                    <div key={s.nazov} className="gk-skupina">
                      <h4>
                        {nazovSkupiny(s.nazov)} <b>{s.pocet}</b>
                      </h4>
                      <div className="gk-dlazdice">{s.karty.map(dlazdica)}</div>
                    </div>
                  ))}
                </div>
              </section>
              <section data-sekcia="odhodene">
                {nadpis(t("galeria.odhadzovaci"), h.odhadzovaci.length, t("galeria.zamiesaSa"))}
                <div className="gk-dlazdice">{odhodene.length === 0 ? nic : odhodene.map(dlazdica)}</div>
              </section>
            </>
          )}
        </div>

        <div className="gk-detail" ref={detail} aria-live="polite">
          {vybrana === null || vzVybranej === null ? (
            <span className="popis">{t("galeria.ziadneKarty")}</span>
          ) : (
            <>
              {sirkaVelkej > 0 && velka(vybrana.karta, sirkaVelkej)}
              <span className="gk-kde">
                {vybrana.kde}
                {vybrana.pocet > 1 && ` · ×${vybrana.pocet}`}
              </span>
              <div className="gk-efekt">
                <b className="gk-meno">{vzVybranej.nazov}</b>
                {riadkyEfektu.map((r, i) => (
                  <p key={i}>
                    {r.map((u, j) => {
                      if (u.tucne) return <b key={j}>{u.text}</b>;
                      if (u.kurziva) return <i key={j}>{u.text}</i>;
                      return <span key={j}>{u.text}</span>;
                    })}
                  </p>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </Vrstva>
  );
}
