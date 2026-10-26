// Prehrávač dohratej partie (roadmapa #18, Michal 2026-10-22): ten istý herný
// stôl ako počas hry, len na čítanie, krok po kroku. Stav každého kroku počíta
// server zo seedu a príkazov a posiela ho cez viewFor — účastník vidí partiu
// zo svojho miesta, súperovu ruku nedostane. Krok je v adrese (?krok=n), dá sa
// naň odkázať.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadGameData, type ClientState, type Event, type PlayerId } from "@naex/core";
import eldersJson from "@naex/core/data/elders.json";
import scorecardsJson from "@naex/core/data/scorecards.json";
import { api } from "../lib/api.ts";
import { Odkaz, chod, useTitulok } from "../lib/router.tsx";
import { useSada } from "../lib/sada.tsx";
import { Nacitavanie } from "../komponenty.tsx";
import type { DetailPartieApi, HracVPartii } from "../stranky/profil/typy.ts";
import { HernaPlocha } from "./HernaPlocha.tsx";
import { textUdalosti, type HracInfo } from "./useHra.ts";
import { useNepodporovaneZariadenie } from "./zariadenie.ts";

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

/** Ťahy hráča po slovensky (typ príkazu z jadra). */
const NAZOV_TAHU: Readonly<Record<string, string>> = {
  chooseLocation: "volí cieľ kola",
  patronat: "patronát staršieho",
  bezPatronatu: "bez patronátu",
  stavbaSenku: "stavia šenok",
  draftBer: "berie zo šenku",
  draftStop: "končí so šenkom",
  place: "vykladá kartu",
  pass: "pas",
  naex: "NA EX!",
  skipNaex: "bez NA EX",
  bezReakcie: "bez reakcie",
  postarka: "Poštárka",
  starosta: "Starosta",
  benzinka: "Benzínka",
  vestica: "Veštica",
  vizia: "Vízia",
  vykup: "výkup",
  cintorin: "Cintorín",
  zivnostnik: "Živnostník",
  smoke: "cigareta",
  barter: "výmena",
  refillPoldeci: "dolieva poldeci",
  zahradkar: "Exekútor (Záhradkár)",
  hasic: "Hasič",
  pohorsenie: "Pohoršenie",
  prebytok: "rozdeľuje prebytok",
  pohreb: "Pohreb",
  kar: "Kar",
};

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
  useTitulok("Prehrávač partie");
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
      .catch((e: unknown) => zive && setChyba(e instanceof Error ? e.message : String(e)));
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
      .catch((e: unknown) => zive && setChyba(e instanceof Error ? e.message : String(e)));
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
  const mena = useMemo(() => hraci.map((h, i) => h?.meno ?? `Hráč ${i + 1}`), [hraci]);
  const log = useMemo(
    () => (stav === null ? [] : stav.log.map((e) => textUdalosti(e, mena, [null, null])).filter((t): t is string => t !== null)),
    [stav, mena],
  );

  const spat = (
    <Odkaz href={`/partia/${id}`} className="tlacidlo">
      Detail partie
    </Odkaz>
  );
  if (chyba !== null) {
    return (
      <div className="formular-stred panel" style={{ textAlign: "center" }}>
        <h1>Partiu sa nepodarilo prehrať</h1>
        <p className="tlmene">{chyba}</p>
        {spat}
      </div>
    );
  }
  if (zoznam !== null && !zoznam.dostupny) {
    return (
      <div className="formular-stred panel" style={{ textAlign: "center" }}>
        <h1>Túto partiu nemožno prehrať</h1>
        <p className="tlmene">{zoznam.dovod}</p>
        {spat}
      </div>
    );
  }
  if (nepodporovane !== null) {
    return (
      <div className="formular-stred panel" style={{ textAlign: "center" }}>
        <h1>Prehrávač potrebuje širokú obrazovku</h1>
        <p>Herný stôl sa sem nezmestí. Priebeh po kolách a záverečný účet nájdeš v detaile partie.</p>
        {spat}
      </div>
    );
  }
  if (zoznam === null || detail === null || data === null || sada === null || stav === null) return <Nacitavanie text="Prehrávam partiu…" />;

  const krok = zoznam.kroky[n - 1];
  const kto = krok === undefined ? null : mena[krok.miesto];
  const popis = krok === undefined ? "začiatok partie" : `${kto}: ${krok.typ === null ? "ťah" : (NAZOV_TAHU[krok.typ] ?? krok.typ)}`;

  const ovladanie = (
    <div className="prehravac-ovladanie" role="group" aria-label="Prehrávač partie">
      <button type="button" className="tlacidlo-male" onClick={() => setN(0)} disabled={n === 0} title="Na začiatok (Home)" aria-label="Na začiatok">
        ⏮
      </button>
      <button type="button" className="tlacidlo-male" onClick={() => posun(-1)} disabled={n === 0} title="Krok späť (←)" aria-label="Krok späť">
        ◀
      </button>
      <button
        type="button"
        className="tlacidlo-male prehravac-hraj"
        onClick={() => {
          if (n >= pocet) setN(0);
          setHra((h) => !h);
        }}
        title="Prehrávať (medzerník)"
        aria-pressed={hra}
      >
        {hra ? "❚❚" : "▶"}
      </button>
      <button type="button" className="tlacidlo-male" onClick={() => posun(1)} disabled={n >= pocet} title="Krok vpred (→)" aria-label="Krok vpred">
        ▶|
      </button>
      <button type="button" className="tlacidlo-male" onClick={() => setN(pocet)} disabled={n >= pocet} title="Na koniec (End)" aria-label="Na koniec">
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
        aria-label="Krok partie"
      />
      <span className="prehravac-krok" title={popis}>
        <strong>
          {n} / {pocet}
        </strong>{" "}
        <span className="tlmene">{popis}</span>
      </span>
      {zoznam.ja === null && (
        <button type="button" className="tlacidlo-male tlacidlo-jemne" onClick={() => setMiesto((m) => (m === 0 ? 1 : 0))} title="Správca: pohľad druhého hráča">
          pohľad: {mena[miesto]}
        </button>
      )}
      <Odkaz href={`/partia/${id}`} className="opustit tlacidlo-male tlacidlo-jemne">
        zavrieť
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
