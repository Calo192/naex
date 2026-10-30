// Zastávka v9.1 (Michal 2026-10-30, quick wins z ULTRA playtestu 20261030-115654):
// „Pitka: Po prvej Pitke kola si každý hráč vezme zadarmo 1 kartu zo šenku — najprv
// útočník, potom obranca. Z prázdneho šenku sa neberie nič.“ Nahrádza spoločný limit.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { CardInstance, Command, GameState, PlayerId } from "../src/index.ts";
import { apply, legalCommands, limitZhromazdenia, loadGameData, mozeHrat, naTahu, opponentOf, setupGame } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

/** Partia v Zhromaždení na Zastávke — cez voľbu cieľa, stavbu šenku a koniec brania. */
function naZastavke(seed: number): GameState {
  let s = setupGame(data, seed);
  const zastavka: CardInstance = { uid: 990001, defId: "zastavka", leftLayout: 0, rightLayout: 0 };
  s = { ...s, lokalityVHre: [zastavka, ...s.lokalityVHre.filter((k) => k.defId !== "zastavka")] };
  s = apply(data, s, { type: "chooseLocation", uid: zastavka.uid, otocena: false }, (1 - s.utocnik) as PlayerId).state;
  while (s.draftStav?.krok === "stavba") {
    for (const p of [0, 1] as const) {
      const b = s.draftStav!.balicky[p];
      const cmd: Command = { type: "stavbaSenku", doSenku: b.slice(0, b.length / 2).map((k) => k.uid), odhod: b.slice(b.length / 2).map((k) => k.uid) };
      s = apply(data, s, cmd, p).state;
    }
  }
  while (s.faza === "draft") s = apply(data, s, { type: "draftStop" }, naTahu(s)!).state;
  return s;
}

/** Obaja pasujú a Pitku prejdú bez NA EX, kým nečaká voľba alebo neskončí prvá Pitka. */
function poPrvejPitke(s0: GameState): GameState {
  let s = s0;
  for (let i = 0; i < 40 && (s.hasicVolby?.length ?? 0) === 0 && (s.faza === "zhromazdenie" || s.faza === "pitka") && s.pitkaCislo <= 1; i++) {
    const p = ([0, 1] as const).find((q) => mozeHrat(s, q)) ?? naTahu(s)!;
    const cmds = legalCommands(data, s, p);
    const cmd = cmds.find((c) => c.type === "pass" || c.type === "skipNaex" || c.type === "bezReakcie") ?? cmds.find((c) => c.type === "vizia") ?? cmds[0]!;
    s = apply(data, s, cmd, p).state;
  }
  return s;
}

describe("§15 Zastávka (v9.1): po prvej Pitke kola karta zo šenku zadarmo", () => {
  it("limit vykladania nie je spoločný — každý má svoj", () => {
    const s = naZastavke(3);
    expect(s.faza).toBe("zhromazdenie");
    expect(s.zhromazdenieStav!.zostavaLimit).toEqual([limitZhromazdenia(s, 0), limitZhromazdenia(s, 1)]);
  });

  it("najprv útočník, potom obranca; každý 1 kartu zadarmo, šenok sa medzi nimi nedopĺňa", () => {
    const s = poPrvejPitke(naZastavke(3));
    const u = s.utocnik;
    const o = opponentOf(u);
    expect(s.hasicVolby?.[0]).toMatchObject({ hrac: u, typ: "senok" });
    expect(naTahu(s)).toBe(u);
    expect(legalCommands(data, s, u)).toEqual(s.senok.map((k) => ({ type: "senok", uid: k.uid })));
    const karta = s.senok[0]!;
    const cig = s.hraci[u].cigarety;
    const s1 = apply(data, s, { type: "senok", uid: karta.uid }, u).state;
    expect(s1.hraci[u].ruka.some((k) => k.uid === karta.uid)).toBe(true);
    expect(s1.hraci[u].cigarety).toBe(cig);
    expect(s1.senok).toHaveLength(s.senok.length - 1);
    expect(s1.hasicVolby?.[0]).toMatchObject({ hrac: o, typ: "senok" });
    const druha = s1.senok[0]!;
    const s2 = apply(data, s1, { type: "senok", uid: druha.uid }, o).state;
    expect(s2.hraci[o].ruka.some((k) => k.uid === druha.uid)).toBe(true);
    expect(s2.senok).toHaveLength(s.senok.length - 2);
    expect(s2.hasicVolby ?? []).toHaveLength(0);
    expect(s2.faza === "pitka" && s2.pitkaCislo === 1).toBe(false);
  });

  it("jediná karta v šenku patrí útočníkovi, obranca nedostane nič; prázdny šenok nič", () => {
    const z = naZastavke(5);
    const jedna = poPrvejPitke({ ...z, senok: z.senok.slice(0, 1) });
    const u = jedna.utocnik;
    const s1 = apply(data, jedna, { type: "senok", uid: jedna.senok[0]!.uid }, u).state;
    expect(s1.senok).toHaveLength(0);
    expect(s1.hasicVolby ?? []).toHaveLength(0);
    const prazdny = poPrvejPitke({ ...z, senok: [] });
    expect(prazdny.hasicVolby ?? []).toHaveLength(0);
    expect(prazdny.pitkaCislo === 1 && prazdny.faza === "pitka").toBe(false);
  });
});
