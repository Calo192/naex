// Herná obrazovka (M8): partia súpera hore, lokalita v strede, vlastná
// partia a ruka dole, starší a šenok bokom, stav hráčov a log.
//
// Živé zvýraznenie: evaluateLine z @naex/core sa volá na klientskom pohľade
// pri každom prekreslení — hráč okamžite vidí, čo mu na spoji chytilo.

import { useMemo, useState, type ReactNode } from "react";
import type {
  ClientState,
  Command,
  ElderState,
  KartaZdroj,
  LineEval,
  PlayerId,
} from "@naex/core";
import { STUPNICA_ZONY, evaluateLine, prebudenyPre, priazenHraca } from "@naex/core";
import { DATA } from "./data.ts";
import { Karta } from "./Karta.tsx";

type Mode =
  | { typ: "ziadny" }
  | { typ: "draft"; cigarety: number; vybrane: number[] }
  | { typ: "ruka"; uid: number }
  | { typ: "naexCiel" }
  | { typ: "liecbaZavisly"; cirhozaUid: number }
  | { typ: "liecbaSenok"; cirhozaUid: number; zavislyUid: number }
  | { typ: "pohrebKarta"; cirhozaUid: number }
  | { typ: "nahradaMarker"; defId: string; kde: KartaZdroj };

const FAZY: Record<string, string> = {
  volbaCiela: "Voľba cieľa",
  draft: "Cigaretový draft",
  zhromazdenie: "Zhromaždenie",
  pitka: "Pitka",
  bitka: "Bitka",
  koniec: "Koniec hry",
};

function menoKarty(defId: string): string {
  return DATA.cards.get(defId)?.name ?? defId;
}

export interface GameViewProps {
  readonly view: ClientState;
  readonly log: readonly string[];
  readonly chyba: string | null;
  readonly superPripojeny: boolean;
  readonly kod: string;
  readonly cmd: (c: Command) => void;
  readonly opustit: () => void;
}

export function GameView({ view, log, chyba, superPripojeny, kod, cmd, opustit }: GameViewProps) {
  const ja = view.ja;
  const super_ = (ja === 0 ? 1 : 0) as PlayerId;
  const [mode, setMode] = useState<Mode>({ typ: "ziadny" });
  const somNaTahu = view.naTahu === ja;

  const lineEval: LineEval = useMemo(
    () =>
      evaluateLine(DATA, {
        lokalita: view.ciel?.typ === "lokalita" ? view.ciel.lokalita : null,
        lokalitaOtocena: view.lokalitaOtocena,
        partie: view.partie,
      }),
    [view.ciel, view.lokalitaOtocena, view.partie],
  );

  const posli = (c: Command): void => {
    cmd(c);
    setMode({ typ: "ziadny" });
  };

  // ---- klikanie na karty v partiách (NA EX cieľ, Liečba, Pohreb) ----------
  const klikPartia = (partia: PlayerId, uid: number): (() => void) | undefined => {
    if (mode.typ === "naexCiel") {
      return () => posli({ type: "naex", uid });
    }
    if (mode.typ === "liecbaZavisly" && partia === ja) {
      return () => setMode({ typ: "liecbaSenok", cirhozaUid: mode.cirhozaUid, zavislyUid: uid });
    }
    if (mode.typ === "pohrebKarta" && partia === ja) {
      return () => posli({ type: "pohreb", cirhozaUid: mode.cirhozaUid, kartaUid: uid });
    }
    return undefined;
  };

  const klikSenok = (uid: number): (() => void) | undefined => {
    if (mode.typ === "draft") {
      return () =>
        setMode({
          ...mode,
          vybrane: mode.vybrane.includes(uid)
            ? mode.vybrane.filter((u) => u !== uid)
            : [...mode.vybrane, uid],
        });
    }
    if (mode.typ === "liecbaSenok") {
      return () =>
        posli({
          type: "liecba",
          cirhozaUid: mode.cirhozaUid,
          zavislyUid: mode.zavislyUid,
          senokUid: uid,
        });
    }
    return undefined;
  };

  const partiaRow = (p: PlayerId): ReactNode => (
    <div className={`partia ${p === ja ? "moja" : "superova"}`}>
      <span className="popis">{p === ja ? "tvoja partia" : "partia súpera"}</span>
      {view.partie[p].length === 0 && <span className="prazdna">— prázdna —</span>}
      {view.partie[p].map((placed) => (
        <Karta
          key={placed.card.uid}
          card={placed.card}
          rotated={placed.playedBy !== p}
          evalInfo={lineEval.cards.get(placed.card.uid) ?? null}
          naexBy={placed.naexBy}
          onClick={klikPartia(p, placed.card.uid)}
        />
      ))}
    </div>
  );

  // ---- akčný panel podľa fázy ---------------------------------------------
  const akcie: ReactNode = (() => {
    if (view.koniec !== null) {
      return (
        <div className="akcie koniec">
          <strong>
            {view.koniec.vitaz === null
              ? "Remíza."
              : view.koniec.vitaz === ja
                ? "Vyhral si!"
                : "Prehral si."}
          </strong>{" "}
          {view.koniec.dovod}
          {view.koniec.body !== null && ` Body ${view.koniec.body[0]}:${view.koniec.body[1]}.`}
          <button onClick={opustit}>Nová hra</button>
        </div>
      );
    }
    if (!somNaTahu) {
      return <div className="akcie cakanie">Čaká sa na súpera…</div>;
    }

    switch (view.faza) {
      case "volbaCiela":
        return (
          <div className="akcie">
            <strong>Vyber cieľ kola:</strong> lokalitu (a natočenie) alebo bitku o staršieho
            v paneli starších.
            {view.lokalityVHre.map((lok) => (
              <span key={lok.uid} className="volba-lokality">
                {menoKarty(lok.defId)}
                <button onClick={() => posli({ type: "chooseLocation", uid: lok.uid, otocena: false })}>
                  vybrať
                </button>
                <button onClick={() => posli({ type: "chooseLocation", uid: lok.uid, otocena: true })}>
                  vybrať otočenú
                </button>
              </span>
            ))}
          </div>
        );

      case "draft": {
        if (mode.typ !== "draft") {
          return (
            <div className="akcie">
              <strong>Draft:</strong> koľko cigariet si berieš? (zvyšok do 3 doberieš zo šenku)
              {[0, 1, 2, 3].map((n) => (
                <button key={n} onClick={() => setMode({ typ: "draft", cigarety: n, vybrane: [] })}>
                  {n}
                </button>
              ))}
            </div>
          );
        }
        const treba = Math.min(3 - mode.cigarety, view.senok.length);
        return (
          <div className="akcie">
            <strong>Draft:</strong> {mode.cigarety} cigariet — vyber {treba} kariet zo šenku
            (vybrané: {mode.vybrane.length})
            <button
              disabled={mode.vybrane.length !== treba}
              onClick={() => posli({ type: "draft", cigarety: mode.cigarety, karty: mode.vybrane })}
            >
              potvrdiť
            </button>
            <button onClick={() => setMode({ typ: "ziadny" })}>zrušiť</button>
          </div>
        );
      }

      case "zhromazdenie": {
        const zostava = view.zhromazdenieStav?.zostavaLimit[ja] ?? 0;
        const vybrana = mode.typ === "ruka" ? view.ruka.find((k) => k.uid === mode.uid) : undefined;
        const def = vybrana === undefined ? undefined : DATA.cards.get(vybrana.defId);
        return (
          <div className="akcie">
            <strong>Zhromaždenie</strong> (limit: {zostava}){" "}
            {vybrana === undefined || def === undefined ? (
              <em>klikni na kartu v ruke…</em>
            ) : (
              <>
                <em>{def.name}:</em>
                <button onClick={() => posli({ type: "place", uid: vybrana.uid, target: "vlastna" })}>
                  do svojej partie
                </button>
                <button onClick={() => posli({ type: "place", uid: vybrana.uid, target: "superova" })}>
                  do súperovej (otočená)
                </button>
                {def.tags.includes("Kliatba") && (
                  <button onClick={() => posli({ type: "place", uid: vybrana.uid, target: "priznanie" })}>
                    priznať
                  </button>
                )}
                {def.tags.includes("Nástroj") && (
                  <button onClick={() => posli({ type: "place", uid: vybrana.uid, target: "dedicstvo" })}>
                    do Dedičstva
                  </button>
                )}
              </>
            )}
            <button onClick={() => posli({ type: "pass" })}>pasovať</button>
          </div>
        );
      }

      case "pitka": {
        const hracJa = view.hraci[ja];
        const naexBol = view.pitkaStav?.naexPouzity[ja] === true;
        return (
          <div className="akcie">
            <strong>
              Pitka {view.pitkaCislo}/{view.pitkyCelkom}
            </strong>
            {mode.typ === "naexCiel" ? (
              <>
                <em>klikni na Občana/Starešinu v ľubovoľnej partii…</em>
                <button onClick={() => setMode({ typ: "ziadny" })}>zrušiť</button>
              </>
            ) : (
              <>
                <button
                  disabled={naexBol || hracJa.poldeciPlne === 0}
                  onClick={() => setMode({ typ: "naexCiel" })}
                >
                  NA EX! 🥃
                </button>
                <button
                  disabled={hracJa.cigarety === 0}
                  onClick={() => cmd({ type: "smoke", pocet: 1 })}
                >
                  fajčiť 1 🚬
                </button>
                <button
                  disabled={hracJa.cigarety < 5}
                  onClick={() => cmd({ type: "barter" })}
                  title="5 cigariet → nový plný poldeci"
                >
                  barter (5 🚬)
                </button>
                <button
                  disabled={hracJa.cigarety < 2 || hracJa.poldeciVypite === 0}
                  onClick={() => cmd({ type: "refillPoldeci" })}
                  title="2 cigarety → otočiť vypitý poldeci"
                >
                  otočiť poldeci (2 🚬)
                </button>
                <button onClick={() => posli({ type: "skipNaex" })}>hotovo</button>
              </>
            )}
          </div>
        );
      }

      case "bitka": {
        const b = view.bitkaStav;
        if (b === null) return null;
        if (b.krok === "exekutor") {
          return (
            <div className="akcie">
              <strong>Exekútor!</strong> Odovzdaj Nástroj:
              {(view.volbyExekutor ?? []).map((v, i) => (
                <button key={i} onClick={() => posli({ type: "exekutorTool", defId: v.defId, kde: v.kde })}>
                  {menoKarty(v.defId)} ({v.kde})
                </button>
              ))}
            </div>
          );
        }
        if (b.krok === "pohorsenie") {
          return (
            <div className="akcie">
              <strong>Pohoršenie</strong> (zostáva {b.pohorsenieZostava[ja]}): vyber staršieho
              v paneli — marker sa posunie k súperovi.
            </div>
          );
        }
        if (b.krok === "prebytok") {
          return (
            <div className="akcie">
              <strong>Prebytok</strong> (zostáva {b.prebytokZostava}): vyber staršieho v paneli.
            </div>
          );
        }
        if (b.krok === "nahrada") {
          if (mode.typ === "nahradaMarker") {
            return (
              <div className="akcie">
                <strong>Náhrada:</strong> {menoKarty(mode.defId)} — kam s markerom?
                {[3, 4, 5].map((m) => (
                  <button
                    key={m}
                    onClick={() =>
                      posli({ type: "nahrada", defId: mode.defId, kde: mode.kde, marker: m as 3 | 4 | 5 })
                    }
                  >
                    pozícia {m}
                  </button>
                ))}
              </div>
            );
          }
          return (
            <div className="akcie">
              <strong>Náhrada staršieho:</strong> vyber Občana/Zviera:
              {(view.volbyNahrada ?? []).map((v, i) => (
                <button key={i} onClick={() => setMode({ typ: "nahradaMarker", defId: v.defId, kde: v.kde })}>
                  {menoKarty(v.defId)} ({v.kde})
                </button>
              ))}
            </div>
          );
        }
        if (b.krok === "liecba") {
          const cirhoza = view.hraci[ja].priznane.find((k) => k.defId === "cirhoza");
          if (mode.typ === "liecbaZavisly") {
            return (
              <div className="akcie">
                <em>Liečba: klikni na kartu s tagom Závislý vo svojej partii…</em>
                <button onClick={() => setMode({ typ: "ziadny" })}>zrušiť</button>
              </div>
            );
          }
          if (mode.typ === "liecbaSenok") {
            return (
              <div className="akcie">
                <em>Liečba: klikni na kartu v šenku, ktorú si berieš…</em>
                <button onClick={() => setMode({ typ: "ziadny" })}>zrušiť</button>
              </div>
            );
          }
          if (mode.typ === "pohrebKarta") {
            return (
              <div className="akcie">
                <em>Pohreb: klikni na kartu vo svojej partii, ktorú spáliš…</em>
                <button onClick={() => setMode({ typ: "ziadny" })}>zrušiť</button>
              </div>
            );
          }
          return (
            <div className="akcie">
              <strong>Priznaná Cirhóza:</strong>
              <button
                disabled={cirhoza === undefined}
                onClick={() =>
                  cirhoza !== undefined && setMode({ typ: "liecbaZavisly", cirhozaUid: cirhoza.uid })
                }
              >
                Liečba
              </button>
              <button
                disabled={cirhoza === undefined}
                onClick={() =>
                  cirhoza !== undefined && setMode({ typ: "pohrebKarta", cirhozaUid: cirhoza.uid })
                }
              >
                Pohreb
              </button>
              <button onClick={() => posli({ type: "skipLiecba" })}>preskočiť</button>
            </div>
          );
        }
        return null;
      }

      default:
        return null;
    }
  })();

  // ---- starší -------------------------------------------------------------
  const klikStarsi = (elder: ElderState): (() => void) | undefined => {
    if (!somNaTahu) return undefined;
    if (view.faza === "volbaCiela" && !elder.nahradeny && STUPNICA_ZONY[elder.marker] >= 2) {
      return () => posli({ type: "chooseElder", elderId: elder.elderId });
    }
    const b = view.bitkaStav;
    if (view.faza === "bitka" && b?.caka === ja) {
      if (b.krok === "pohorsenie" && !b.pohnuteMarkery.includes(elder.elderId)) {
        return () => cmd({ type: "pohorsenie", elderId: elder.elderId });
      }
      if (b.krok === "prebytok") {
        return () => cmd({ type: "prebytok", elderId: elder.elderId });
      }
    }
    return undefined;
  };

  return (
    <div className="hra">
      <header>
        <span className="kod" title="kód miestnosti — pošli súperovi">
          {kod}
        </span>
        <span>
          kolo {view.kolo} · <strong>{FAZY[view.faza]}</strong>
          {view.faza === "pitka" || view.faza === "zhromazdenie"
            ? ` · pitka ${Math.max(1, view.pitkaCislo)}/${view.pitkyCelkom}`
            : ""}
        </span>
        <span>
          si hráč {ja + 1}
          {view.utocnik === ja ? " (útočník)" : " (obranca)"} ·{" "}
          {somNaTahu ? <strong className="na-tahu">si na ťahu</strong> : "na ťahu je súper"}
        </span>
        <span className={superPripojeny ? "online" : "offline"}>
          {superPripojeny ? "● súper pripojený" : "○ súper odpojený"}
        </span>
        <button className="opustit" onClick={opustit}>
          opustiť hru
        </button>
      </header>

      {chyba !== null && <div className="chyba">{chyba}</div>}

      <div className="plocha">
        <div className="stred">
          <StavHraca view={view} p={super_} ja={ja} />
          {partiaRow(super_)}

          <div className="lokalita-riadok">
            {view.ciel?.typ === "lokalita" && view.ciel.lokalita !== null ? (
              <>
                <Karta
                  card={view.ciel.lokalita}
                  rotated={view.lokalitaOtocena}
                  evalInfo={lineEval.cards.get(view.ciel.lokalita.uid) ?? null}
                />
                <span className="popis">
                  lokalita — ľavý stĺpec hráč 1, pravý hráč 2
                </span>
              </>
            ) : view.ciel?.typ === "starsi" ? (
              <span className="popis">bitka o staršieho: {view.ciel.elderId}</span>
            ) : (
              <span className="popis">— cieľ kola sa ešte len vyberá —</span>
            )}
          </div>

          {partiaRow(ja)}
          <StavHraca view={view} p={ja} ja={ja} />

          <div className="ruka">
            <span className="popis">tvoja ruka ({view.ruka.length})</span>
            {view.ruka.map((karta) => (
              <Karta
                key={karta.uid}
                card={karta}
                onClick={
                  somNaTahu && view.faza === "zhromazdenie"
                    ? () => setMode({ typ: "ruka", uid: karta.uid })
                    : undefined
                }
                selected={mode.typ === "ruka" && mode.uid === karta.uid}
              />
            ))}
          </div>

          {akcie}
        </div>

        <aside>
          <section className="starsi-panel">
            <h3>Starší</h3>
            {view.starsi.map((elder) => (
              <StarsiRiadok key={elder.elderId} elder={elder} onClick={klikStarsi(elder)} />
            ))}
          </section>

          <section className="senok-panel">
            <h3>
              Šenok ({view.senok.length}) · spoločný balíček {view.spolocnyBalicekPocet}
            </h3>
            <div className="senok">
              {view.senok.map((karta) => (
                <Karta
                  key={karta.uid}
                  card={karta}
                  mala
                  onClick={klikSenok(karta.uid)}
                  selected={mode.typ === "draft" && mode.vybrane.includes(karta.uid)}
                />
              ))}
            </div>
          </section>

          <section className="log-panel">
            <h3>Log</h3>
            <div className="log">
              {log.slice(-60).map((riadok, i) => (
                <div key={i} className={riadok.startsWith("⚠") ? "manual" : ""}>
                  {riadok}
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function StavHraca({ view, p, ja }: { view: ClientState; p: PlayerId; ja: PlayerId }) {
  const hrac = view.hraci[p];
  return (
    <div className="stav-hraca">
      <span className="popis">{p === ja ? "ty" : "súper"}:</span>
      <span title="plné / vypité poldeci">🥃 {hrac.poldeciPlne}/{hrac.poldeciVypite}</span>
      <span title="fyzické cigarety">🚬 {hrac.cigarety}</span>
      <span title="poškodenie pečene">🫀 {hrac.pecen}</span>
      <span title="ruka">✋ {hrac.rukaPocet}</span>
      <span title="doberací / odhadzovací">🂠 {hrac.doberaciPocet}/{hrac.odhadzovaci.length}</span>
      {hrac.priznane.length > 0 && (
        <span title="priznané kliatby">
          priznané: {hrac.priznane.map((k) => menoKarty(k.defId)).join(", ")}
        </span>
      )}
      {hrac.dedicstvo.length > 0 && (
        <span title="Dedičstvo">
          dedičstvo: {hrac.dedicstvo.map((k) => menoKarty(k.defId)).join(", ")}
        </span>
      )}
    </div>
  );
}

const ZONA_TRIEDY = ["cervena", "oranzova", "zlta", "siva", "siva", "siva", "zlta", "oranzova", "cervena"];

function StarsiRiadok({ elder, onClick }: { elder: ElderState; onClick?: (() => void) | undefined }) {
  const priazen = priazenHraca(elder);
  const prebudeny = prebudenyPre(elder);
  return (
    <div className={`starsi ${onClick !== undefined ? "klikatelny" : ""}`} onClick={onClick}>
      <div className="meno">
        {menoKarty(elder.karta.defId)}
        {elder.nahradeny && " (náhrada)"}
        {priazen !== null && ` · priazeň H${priazen + 1}`}
        {prebudeny !== null && ` · PREBUDENÝ pre H${prebudeny + 1}`}
      </div>
      <div className="stupnica">
        {ZONA_TRIEDY.map((zona, i) => (
          <span key={i} className={`pozicia ${zona} ${elder.marker === i ? "marker" : ""}`}>
            {elder.marker === i ? "●" : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
