// Prehrávač dohratej partie (roadmapa #18, Michal 2026-10-22): ten istý herný
// stôl ako počas hry, len na čítanie, krok po kroku. Stav každého kroku počíta
// server zo seedu a príkazov a posiela ho cez viewFor — účastník vidí partiu
// zo svojho miesta, súperovu ruku nedostane. Krok je v adrese (?krok=n), dá sa
// naň odkázať.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadGameData, opponentOf, type ClientState, type Event, type PlayerId } from "@naex/core";
import eldersJson from "@naex/core/data/elders.json";
import scorecardsJson from "@naex/core/data/scorecards.json";
import { api, textChyby } from "../lib/api.ts";
import { Odkaz, chod, useTitulok } from "../lib/router.tsx";
import { useSada } from "../lib/sada.tsx";
import { Nacitavanie } from "../komponenty.tsx";
import type { DetailPartieApi, HracVPartii } from "../stranky/profil/typy.ts";
import { HernaPlocha } from "./HernaPlocha.tsx";
import { textUdalosti, type HracInfo } from "./useHra.ts";
import { useNepodporovaneZariadenie } from "./zariadenie.ts";
import { prelozHlasku, t } from "../i18n/jazyk.tsx";

interface ZoznamKrokov {
  readonly pocet: number;
  readonly dostupny: boolean;
  readonly dovod: string | null;
  readonly ja: PlayerId | null;
  readonly kroky: readonly { readonly n: number; readonly miesto: PlayerId; readonly typ: string | null }[];
}

interface StavKroku {
  readonly n: number;
  readonly pocet: number;
  readonly miesto: PlayerId;
  readonly view: ClientState;
  readonly log: readonly Event[];
  readonly koniec: boolean;
}

/** Krok za krokom pri prehrávaní. */
const TEMPO_MS = 1200;

/** Ťahy hráča (typ príkazu z jadra) — texty v sk.json pod prehravac.tah.<typ>. */
const TAHY: ReadonlySet<string> = new Set(["chooseLocation", "natocLokalitu", "patronat", "bezPatronatu", "pokus", "bezPokusu", "kseftVazna", "schopnostVazna", "stavbaSenku", "draftBer", "draftStop", "place", "pass", "naex", "skipNaex", "bezReakcie", "postarka", "starosta", "benzinka", "vestica", "vizia", "vykup", "cintorin", "zivnostnik", "senok", "nastroj", "smoke", "barter", "refillPoldeci", "hasic", "pohorsenie", "prebytok", "kar"]);
const nazovTahu = (typ: string): string => (TAHY.has(typ) ? t(`prehravac.tah.${typ}`) : typ);

const krokZAdresy = (): number => {
  const n = Number(new URLSearchParams(location.search).get("krok"));
  return Number.isInteger(n) && n >= 0 ? n : 0;
};

function info(h: HracVPartii): HracInfo {
  return {
    ...(h.id !== null ? { id: h.id } : {}),
    meno: h.meno,
    avatar: h.avatar,
    ...(h.bot !== undefined ? { bot: true } : {}),
    profil: h.bot !== undefined ? "ziadny" : h.ai === true || h.id === null ? "skryty" : "verejny",
  };
}

export function Prehravac({ id }: { readonly id: number }) {
  useTitulok(t("prehravac.titul"));
  const { sada } = useSada();
  const nepodporovane = useNepodporovaneZariadenie();
  const [zoznam, setZoznam] = useState<ZoznamKrokov | null>(null);
  const [detail, setDetail] = useState<DetailPartieApi | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);
  const [n, setN] = useState(krokZAdresy);
  const [miesto, setMiesto] = useState<PlayerId>(0);
  const [stav, setStav] = useState<StavKroku | null>(null);
  const [hra, setHra] = useState(false);
  // Navštívené kroky netreba počítať znova — server prehráva partiu od začiatku.
  const cache = useRef(new Map<string, StavKroku>());

  useEffect(() => {
    let zive = true;
    Promise.all([api.get<ZoznamKrokov>(`/partie/${id}/kroky`), api.get<DetailPartieApi>(`/partie/${id}`)])
      .then(([z, d]) => {
        if (!zive) return;
        setZoznam(z);
        setDetail(d);
        if (z.ja !== null) setMiesto(z.ja);
        setN((x) => Math.min(x, z.pocet));
      })
      .catch((e: unknown) => zive && setChyba(textChyby(e)));
    return () => {
      zive = false;
    };
  }, [id]);

  const nacitaj = useCallback(
    (k: number, m: PlayerId): Promise<StavKroku> => {
      const kluc = `${k}:${m}`;
      const z = cache.current.get(kluc);
      if (z !== undefined) return Promise.resolve(z);
      return api.get<StavKroku>(`/partie/${id}/krok/${k}?miesto=${m}`).then((s) => {
        cache.current.set(kluc, s);
        return s;
      });
    },
    [id],
  );

  useEffect(() => {
    if (zoznam === null || !zoznam.dostupny) return;
    let zive = true;
    nacitaj(n, miesto)
      .then((s) => {
        if (!zive) return;
        setStav(s);
        // Ďalší krok vopred, nech prehrávanie nečaká na server.
        if (n < zoznam.pocet) void nacitaj(n + 1, miesto).catch(() => undefined);
      })
      .catch((e: unknown) => zive && setChyba(textChyby(e)));
    history.replaceState(null, "", `${location.pathname}?krok=${n}`);
    return () => {
      zive = false;
    };
  }, [n, miesto, zoznam, nacitaj]);

  const pocet = zoznam?.pocet ?? 0;
  const posun = useCallback((d: number) => setN((x) => Math.max(0, Math.min(pocet, x + d))), [pocet]);

  // Prehrávanie zastane na konci partie.
  useEffect(() => {
    if (!hra) return;
    if (n >= pocet) {
      setHra(false);
      return;
    }
    const t = window.setTimeout(() => posun(1), TEMPO_MS);
    return () => window.clearTimeout(t);
  }, [hra, n, pocet, posun]);

  // ← → krok, Home/End začiatok a koniec, medzerník prehrávanie.
  useEffect(() => {
    const klaves = (e: KeyboardEvent): void => {
      const t = e.target as HTMLElement | null;
      if (t !== null && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.key === "ArrowLeft") posun(-1);
      else if (e.key === "ArrowRight") posun(1);
      else if (e.key === "Home") setN(0);
      else if (e.key === "End") setN(pocet);
      else if (e.key === " ") setHra((h) => !h);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", klaves);
    return () => window.removeEventListener("keydown", klaves);
  }, [posun, pocet]);

  const data = useMemo(() => (sada === null ? null : loadGameData(sada.cardsJson, eldersJson, sada.scorecardsJson ?? scorecardsJson)), [sada]);
  const hraci = useMemo((): readonly [HracInfo | null, HracInfo | null] => (detail === null ? [null, null] : [info(detail.hraci[0]), info(detail.hraci[1])]), [detail]);
  const mena = useMemo(() => hraci.map((h, i) => h?.meno ?? t("prehravac.hrac", { cislo: i + 1 })), [hraci]);
  const log = useMemo(
    () => (stav === null ? [] : stav.log.map((e) => textUdalosti(e, mena, [null, null])).filter((t): t is string => t !== null)),
    [stav, mena],
  );

  const spat = (
    <Odkaz href={`/partia/${id}`} className="tlacidlo">
      {t("prehravac.detailPartie")}
    </Odkaz>
  );
  if (chyba !== null) {
    return (
      <div className="formular-stred panel" style={{ textAlign: "center" }}>
        <h1>{t("prehravac.nepodarilo")}</h1>
        <p className="tlmene">{prelozHlasku(chyba)}</p>
        {spat}
      </div>
    );
  }
  if (zoznam !== null && !zoznam.dostupny) {
    return (
      <div className="formular-stred panel" style={{ textAlign: "center" }}>
        <h1>{t("prehravac.nemozno")}</h1>
        <p className="tlmene">{zoznam.dovod === null ? null : prelozHlasku(zoznam.dovod)}</p>
        {spat}
      </div>
    );
  }
  if (nepodporovane !== null) {
    return (
      <div className="formular-stred panel" style={{ textAlign: "center" }}>
        <h1>{t("prehravac.sirokaObrazovka")}</h1>
        <p>{t("prehravac.nezmesti")}</p>
        {spat}
      </div>
    );
  }
  if (zoznam === null || detail === null || data === null || sada === null || stav === null) return <Nacitavanie text={t("prehravac.prehravam")} />;

  const krok = zoznam.kroky[n - 1];
  const kto = krok === undefined ? null : mena[krok.miesto];
  const popis = krok === undefined ? t("prehravac.zaciatok") : `${kto}: ${krok.typ === null ? t("prehravac.tah") : nazovTahu(krok.typ)}`;

  const ovladanie = (
    <div className="prehravac-ovladanie" role="group" aria-label={t("prehravac.titul")}>
      <button type="button" className="tlacidlo-male" onClick={() => setN(0)} disabled={n === 0} title={t("prehravac.naZaciatokTitul")} aria-label={t("prehravac.naZaciatok")}>
        ⏮
      </button>
      <button type="button" className="tlacidlo-male" onClick={() => posun(-1)} disabled={n === 0} title={t("prehravac.krokSpatTitul")} aria-label={t("prehravac.krokSpat")}>
        ◀
      </button>
      <button
        type="button"
        className="tlacidlo-male prehravac-hraj"
        onClick={() => {
          if (n >= pocet) setN(0);
          setHra((h) => !h);
        }}
        title={t("prehravac.prehravat")}
        aria-pressed={hra}
      >
        {hra ? "❚❚" : "▶"}
      </button>
      <button type="button" className="tlacidlo-male" onClick={() => posun(1)} disabled={n >= pocet} title={t("prehravac.krokVpredTitul")} aria-label={t("prehravac.krokVpred")}>
        ▶|
      </button>
      <button type="button" className="tlacidlo-male" onClick={() => setN(pocet)} disabled={n >= pocet} title={t("prehravac.naKoniecTitul")} aria-label={t("prehravac.naKoniec")}>
        ⏭
      </button>
      <input
        type="range"
        className="prehravac-posuvnik"
        min={0}
        max={pocet}
        value={n}
        onChange={(e) => {
          setHra(false);
          setN(Number(e.target.value));
        }}
        aria-label={t("prehravac.krokPartie")}
      />
      <span className="prehravac-krok" title={popis}>
        <strong>
          {n} / {pocet}
        </strong>{" "}
        <span className="tlmene">{popis}</span>
      </span>
      {zoznam.ja === null && (
        <button type="button" className="tlacidlo-male tlacidlo-jemne" onClick={() => setMiesto((m) => opponentOf(m))} title={t("prehravac.pohladTitul")}>
          {t("prehravac.pohlad", { meno: mena[miesto] ?? "" })}
        </button>
      )}
      <Odkaz href={`/partia/${id}`} className="opustit tlacidlo-male tlacidlo-jemne">
        {t("prehravac.zavriet")}
      </Odkaz>
    </div>
  );

  return (
    <HernaPlocha
      view={stav.view}
      data={data}
      sada={sada}
      hraci={hraci}
      log={log}
      udalosti={{ id: n, events: stav.log }}
      chyba={null}
      superPripojeny
      kod={`#${id}`}
      cmd={() => undefined}
      opustit={() => chod(`/partia/${id}`)}
      prehravanie={ovladanie}
    />
  );
}
