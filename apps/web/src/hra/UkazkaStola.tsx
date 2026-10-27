// Ukážka herného stola na snímky a UI inšpekciu (/hra/ukazka-stola, len správca):
// dva boti odohrajú partiu v prehliadači (to isté jadro ako server) a stôl ukáže
// zvolený okamih zo strany hráča ?ja=0|1 — bez živej partie a bez servera. Potom
// sa dá hrať ďalej, za súpera ťahá bot. Parametre:
//   ?seed=N        partia (predvolene 8), &lokalit=3|5|7 (predvolene 3)
//   &stop=finale   Zhromaždenie vo finále, keď v línii leží aspoň &karty=k kariet (3)
//   &stop=bitka    tesne pred k-tou bitkou (&i=k, od 0) — po načítaní ju bot dohrá,
//                  takže beží počítadlo a rekapitulácia
//   &stop=koniec   tesne pred koncom hry — posledný ťah sa dohrá po načítaní
//   &stop=kolo     začiatok kola &i=k
//   &stop=zaverecna koniec Pitky so súperovou Záverečnou lícom dole — po načítaní sa otočí;
//                  &dalsia=1 dohrá aj súperovu ďalšiu Záverečnú na tú istú stranu
//   &exekutor=1    hráčovi ?ja pred prvou bitkou pridá Záhradkára a 10 priznaných Dlhov
//                  (voľba Záhradkára pri exekúcii)

import { useEffect, useMemo, useRef, useState } from "react";
import type { CardInstance, Command, Event, GameData, GameState, PlayerId } from "@naex/core";
import { apply, mozeHrat, naTahu, rngInt, rngSeed, setupGame, tahBota, viewFor } from "@naex/core";
import { useSada } from "../lib/sada.tsx";
import { useHerneData } from "../stranky/Ukazky.tsx";
import { HernaPlocha } from "./HernaPlocha.tsx";
import type { HracInfo } from "./useHra.ts";

interface Krok {
  readonly stav: GameState;
  readonly cmd: Command;
  readonly kto: PlayerId;
}

interface Odohrane {
  readonly zaciatok: GameState;
  /** Ťahy, ktoré sa dohrajú po načítaní (bitka, koniec). */
  readonly dohraj: readonly Krok[];
}

const q = (): URLSearchParams => new URLSearchParams(window.location.search);

/** Hráčovi p pridá Záhradkára do ruky a priznané Dlhy — exekúcia v najbližšej bitke. */
function sExekuciou(s: GameState, p: PlayerId): GameState {
  let uid = s.nextUid;
  const karta = (defId: string): CardInstance => ({ uid: uid++, defId, leftLayout: 0, rightLayout: 0 });
  const h = s.hraci[p];
  const novy = { ...h, ruka: [...h.ruka, karta("zahradkar")], priznane: [...h.priznane, ...Array.from({ length: 10 }, () => karta("dlh"))] };
  return { ...s, nextUid: uid, hraci: p === 0 ? [novy, s.hraci[1]] : [s.hraci[0], novy] };
}

function tahy(data: GameData, s: GameState, rng: ReturnType<typeof rngSeed>, i: number): { cmd: Command; kto: PlayerId; rng: ReturnType<typeof rngSeed> } | null {
  const kto = naTahu(s);
  if (kto === null) return null;
  const [j, r] = rngInt(rng, 2 ** 31);
  return { cmd: tahBota(data, s, kto, j, { povaha: i % 2 === 0 ? "stamgast" : "chamtivy" }), kto, rng: r };
}

function odohraj(data: GameData): Odohrane {
  const seed = Number(q().get("seed") ?? "8");
  if (q().get("stop") !== "zaverecna") return odohrajSeed(data, seed).odohrane;
  // Súperova Záverečná nepadne v každej partii — skúša sa od zadaného seedu ďalej.
  for (let pokus = 0; pokus < 40; pokus++) {
    const x = odohrajSeed(data, seed + pokus);
    if (x.najdene) return x.odohrane;
  }
  return odohrajSeed(data, seed).odohrane;
}

function odohrajSeed(data: GameData, seed: number): { readonly odohrane: Odohrane; readonly najdene: boolean } {
  const p = q();
  const najdene = (odohrane: Odohrane) => ({ odohrane, najdene: true });
  const stop = p.get("stop") ?? "finale";
  const i = Number(p.get("i") ?? "0");
  const karty = Number(p.get("karty") ?? "3");
  const ja = (p.get("ja") === "1" ? 1 : 0) as PlayerId;
  let s = setupGame(data, seed, { lokalit: Number(p.get("lokalit") ?? "3") });
  let rng = rngSeed(seed ^ 0x5a);
  let bitiek = 0;
  let exekucia = p.get("exekutor") === "1";
  for (let n = 0; n < 8000 && s.koniec === null; n++) {
    if (exekucia && s.faza === "pitka") {
      s = sExekuciou(s, ja);
      exekucia = false;
    }
    if (stop === "finale" && s.ciel?.typ === "finale" && s.faza === "zhromazdenie" && s.strany[0].length + s.strany[1].length >= karty && naTahu(s) === ja)
      return najdene({ zaciatok: s, dohraj: [] });
    if (stop === "kolo" && s.kolo === i && s.faza === "volbaCiela") return najdene({ zaciatok: s, dohraj: [] });
    const t = tahy(data, s, rng, n);
    if (t === null) break;
    rng = t.rng;
    const { state: po, events } = apply(data, s, t.cmd, t.kto);
    const bitka = events.some((e) => e.type === "bitkaVysledok");
    if (stop === "bitka" && bitka && bitiek++ === i) return najdene({ zaciatok: s, dohraj: [{ stav: s, cmd: t.cmd, kto: t.kto }] });
    if (stop === "koniec" && po.koniec !== null) return najdene({ zaciatok: s, dohraj: [{ stav: s, cmd: t.cmd, kto: t.kto }] });
    const superova = s.strany.findIndex((strana) => strana.some((pl) => pl.zaverecna === true && pl.playedBy !== ja));
    // S &dalsia=1 len na hráčovej strane — tak ako v hlásení Michala 2026-10-27.
    if (stop === "zaverecna" && superova >= 0 && (p.get("dalsia") !== "1" || superova === ja) && s.faza === "pitka" && po.faza === "zhromazdenie") {
      const dohraj: Krok[] = [{ stav: s, cmd: t.cmd, kto: t.kto }];
      if (p.get("dalsia") !== "1") return najdene({ zaciatok: s, dohraj });
      // Ďalej až po súperovu novú Záverečnú na tú istú stranu; inak sa ukážka hľadá ďalej.
      let x = po;
      let r2 = rng;
      for (let k = 0; k < 40 && x.faza === "zhromazdenie"; k++) {
        const u = tahy(data, x, r2, n + 1 + k);
        if (u === null) break;
        r2 = u.rng;
        dohraj.push({ stav: x, cmd: u.cmd, kto: u.kto });
        x = apply(data, x, u.cmd, u.kto).state;
        if (x.strany[superova]?.some((pl) => pl.zaverecna === true && pl.playedBy !== ja)) return najdene({ zaciatok: s, dohraj });
      }
    }
    // Zahradkár: zastaví sa, keď exekúcia čaká na hráčovu voľbu.
    if (p.get("exekutor") === "1" && po.bitkaStav?.krok === "exekutor" && po.bitkaStav.caka === ja) return najdene({ zaciatok: po, dohraj: [] });
    s = po;
  }
  return { odohrane: { zaciatok: s, dohraj: [] }, najdene: stop !== "zaverecna" };
}

export function UkazkaStola() {
  const { sada } = useSada();
  if (sada === null) return <p className="tlmene">Načítavam sadu…</p>;
  return <Ukazka sada={sada} />;
}

function Ukazka({ sada }: { readonly sada: NonNullable<ReturnType<typeof useSada>["sada"]> }) {
  const data = useHerneData(sada);
  const ja = (q().get("ja") === "1" ? 1 : 0) as PlayerId;
  const odohrane = useMemo(() => odohraj(data), [data]);
  const [stav, setStav] = useState<GameState>(odohrane.zaciatok);
  const [udalosti, setUdalosti] = useState<{ readonly id: number; readonly events: readonly Event[] }>({ id: 0, events: [] });
  const rng = useRef(rngSeed(Number(q().get("seed") ?? "8") ^ 0x77));
  // Kým sa nedohrá zastavená bitka či koniec, bot za súpera neťahá — inak by ťah predbehol dohranie.
  const [dohrate, setDohrate] = useState(odohrane.dohraj.length === 0);

  const pouzi = (s: GameState, cmd: Command, kto: PlayerId): GameState => {
    try {
      const { state, events } = apply(data, s, cmd, kto);
      setUdalosti((u) => ({ id: u.id + 1, events }));
      return state;
    } catch (e) {
      console.error(e);
      return s;
    }
  };

  // Dohranie bitky či konca po načítaní — stôl uvidí prechod (počítadlo, rekapitulácia, okno konca).
  useEffect(() => {
    if (odohrane.dohraj.length === 0) return;
    const t = setTimeout(() => {
      let s = odohrane.zaciatok;
      for (const k of odohrane.dohraj) s = pouzi(s, k.cmd, k.kto);
      setStav(s);
      setDohrate(true);
    }, 1200);
    return () => clearTimeout(t);
  }, [odohrane]);

  // Za súpera ťahá bot.
  useEffect(() => {
    const kto: PlayerId = ja === 0 ? 1 : 0;
    if (!dohrate || !mozeHrat(stav, kto)) return;
    const t = setTimeout(() => {
      const [j, r] = rngInt(rng.current, 2 ** 31);
      rng.current = r;
      setStav((s) => (mozeHrat(s, kto) ? pouzi(s, tahBota(data, s, kto, j, { povaha: "stamgast" }), kto) : s));
    }, 700);
    return () => clearTimeout(t);
  }, [stav, ja, data, dohrate]);

  const view = useMemo(() => viewFor(data, stav, ja), [data, stav, ja]);
  const hraci: readonly [HracInfo, HracInfo] = ja === 0
    ? [{ meno: "Jano", avatar: null }, { meno: "Rapavý Fero", avatar: null, bot: true, profil: "ziadny" }]
    : [{ meno: "Rapavý Fero", avatar: null, bot: true, profil: "ziadny" }, { meno: "Jano", avatar: null }];
  return (
    <HernaPlocha
      view={view}
      data={data}
      sada={sada}
      hraci={hraci}
      log={[]}
      udalosti={udalosti}
      chyba={null}
      superPripojeny
      kod="ukážka"
      cmd={(c) => setStav((s) => pouzi(s, c, ja))}
      opustit={() => undefined}
    />
  );
}
