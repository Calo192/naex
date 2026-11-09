// viewFor pre štyroch (2 na 2, roadmapa #26; nemenné pravidlo 2): tím vidí všetko svoje —
// ruku partnera, jeho balíček stavby a výber, skryté NA EX, odpovede a Záverečnú tímu;
// zo súperského tímu len to, čo súper v 1 na 1 (ruky len počtom).

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import {
  apply,
  balicekMiesta,
  cigaretyZaPas,
  clenMiesta,
  kapitan,
  kartyVRukach,
  legalCommands,
  loadGameData,
  miestaHry,
  miestoNaTahu,
  mozeHrat,
  opponentOf,
  partnerMiesta,
  poradieSenku,
  rukaMiesta,
  setupGame,
  timMiesta,
  uidZaverecnej,
  vidiVolbuSupera,
  viewFor,
  vyberMiesta,
} from "../src/index.ts";
import type { GameState, Miesto, PlayerId } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

/** Miesta tímu. */
function miestaTimu(t: PlayerId): readonly Miesto[] {
  return [t, (t + 2) as Miesto];
}

/**
 * Uid kariet, ktoré súperský tím miesta `m` drží v tajnosti: obe jeho ruky, jeho balíčky
 * stavby šenku (aj výber) a jeho skryté karty v línii (Záverečná, odpoveď lícom dole).
 * Karty starších a väzňov sú verejné (Boss v ruke — ktorá je to karta, vie každý).
 */
function tajneSupera(s: GameState, m: Miesto): Set<number> {
  const su = opponentOf(timMiesta(m));
  const tajne = new Set<number>();
  for (const q of miestaTimu(su)) {
    for (const k of rukaMiesta(s, q)) tajne.add(k.uid);
    if (s.draftStav !== null) for (const k of balicekMiesta(s.draftStav, q)) tajne.add(k.uid);
  }
  for (const strana of s.strany) for (const pl of strana) if (pl.zaverecna === true && pl.playedBy === su) tajne.add(pl.card.uid);
  for (const e of s.starsi) tajne.delete(e.karta.uid);
  for (const v of s.vazni) tajne.delete(v.karta.uid);
  return tajne;
}

/** Uid v serializovanom pohľade (každý výskyt „"uid":N“). */
function uidVJsone(json: string): Set<number> {
  return new Set([...json.matchAll(/"uid":(-?\d+)[,}]/g)].map((x) => Number(x[1])));
}

/** Pohľad miesta neprezradí nič zo súperského tímu a ukáže všetko z vlastného. */
function overPohlad(s: GameState, m: Miesto): void {
  const v = viewFor(data, s, m);
  const ja = timMiesta(m);
  const uid = uidVJsone(JSON.stringify(v));
  for (const t of tajneSupera(s, m)) expect(uid.has(t), `miesto ${m} vidí súperovu kartu ${t} (fáza ${s.faza})`).toBe(false);
  // Skryté NA EX súpera len s Bzdochou (vidiVolbuSupera), ako v 1 na 1.
  if (!vidiVolbuSupera(data, s, ja)) {
    for (const x of v.pitkaStav?.skryteNaex ?? []) expect(x.hrac, `miesto ${m} vidí súperovo NA EX`).toBe(ja);
  }
  // Vlastný tím: obe ruky, skryté NA EX tímu, Záverečná tímu v línii.
  expect(v.ja).toBe(ja);
  expect(v.miesto).toBe(m);
  expect(v.ruka).toEqual(rukaMiesta(s, m));
  expect(v.rukaPartnera).toEqual(rukaMiesta(s, partnerMiesta(m)));
  expect(v.mozemHrat).toBe(mozeHrat(s, m));
  for (const x of s.pitkaStav?.skryteNaex ?? []) if (x.hrac === ja) expect(v.pitkaStav?.skryteNaex?.some((y) => y.hrac === ja)).toBe(true);
  for (const strana of [0, 1] as const) {
    for (const pl of s.strany[strana]) {
      const vidim = v.strany[strana].some((x) => x.card.uid === pl.card.uid);
      expect(vidim, `miesto ${m}, karta ${pl.card.uid}`).toBe(pl.zaverecna !== true || pl.playedBy === ja);
    }
  }
  // Súperove ruky len počtom — po členoch aj spolu.
  const su = opponentOf(ja);
  expect(v.hraci[su].rukaPocet).toBe(kartyVRukach(s.hraci[su]).length);
  expect(v.hraci[su].rukyPocet).toEqual([rukaMiesta(s, su).length, rukaMiesta(s, (su + 2) as Miesto).length]);
}

/** Partia 2 na 2 po voľbe cieľa — v drafte (stavba šenku). */
function vDrafte(seed = 7): GameState {
  const s = setupGame(data, seed, { format: "2na2" });
  const kto = miestoNaTahu(s) as Miesto;
  const ciel = legalCommands(data, s, kto)[0];
  if (ciel === undefined) throw new Error("Bez voľby cieľa.");
  return apply(data, s, ciel, kto).state;
}

/** Zhromaždenie 2 na 2 s tímovým limitom `limit`, na ťahu kapitán útočného tímu. */
function vZhromazdeni(limit: number): GameState {
  const s = setupGame(data, 7, { format: "2na2" });
  const lokalita = s.lokalityVHre[0];
  if (lokalita === undefined) throw new Error("Bez lokality.");
  return {
    ...s,
    faza: "zhromazdenie",
    ciel: { typ: "lokalita", lokalita },
    pitkyCelkom: 1,
    pitkaCislo: 0,
    zhromazdenieStav: {
      naTahu: kapitan(s, s.utocnik),
      zostavaLimit: [limit, limit],
      pasoval: [false, false],
      navyse: [0, 0],
      skoncili: [false, false, false, false],
    },
  };
}

/** Miesto na ťahu vyloží svoju kartu `defId` na vlastnú stranu. */
function vyloz(s: GameState, defId = "pijan"): GameState {
  const kto = miestoNaTahu(s) as Miesto;
  const karta = rukaMiesta(s, kto).find((k) => k.defId === defId);
  if (karta === undefined) throw new Error(`Bez ${defId}.`);
  return apply(data, s, { type: "place", uid: karta.uid, target: "vlastna" }, kto).state;
}

describe("viewFor 2 na 2 — moja ruka, ruka partnera, súperove počtom", () => {
  const s = setupGame(data, 7, { format: "2na2" });

  it("každé miesto vidí svoju ruku a ruku partnera, súperove ruky len počtom", () => {
    for (const m of miestaHry(s)) overPohlad(s, m);
  });

  it("formát, miesto a kapitáni sú v pohľade; v 1 na 1 nie", () => {
    const v = viewFor(data, s, 3);
    expect(v.format).toBe("2na2");
    expect(v.miesto).toBe(3);
    expect(v.ja).toBe(1);
    expect(v.kapitani).toEqual(s.kapitani);
    expect(v.miestoNaTahu).toBe(miestoNaTahu(s));
    const jeden = viewFor(data, setupGame(data, 7), 1);
    for (const kluc of ["format", "miesto", "kapitani", "miestoNaTahu", "rukaPartnera"]) expect(jeden).not.toHaveProperty(kluc);
    expect(jeden.hraci[0]).not.toHaveProperty("rukyPocet");
  });
});

describe("viewFor 2 na 2 — stavba šenku", () => {
  it("balíček stavby a výber partnera vidím, súperove nie", () => {
    let s = vDrafte();
    expect(s.draftStav?.krok).toBe("stavba");
    for (const m of miestaHry(s)) overPohlad(s, m);
    const [o1, u1] = poradieSenku(s) as [Miesto, Miesto];
    const d = s.draftStav;
    if (d === null) throw new Error("Bez draftu.");
    const b = balicekMiesta(d, o1).map((k) => k.uid);
    s = apply(data, s, { type: "stavbaSenku", doSenku: b.slice(0, 2), odhod: b.slice(2) }, o1).state;
    // Partner O1 vidí jeho balíček aj výber; súperský tím len to, že O1 vybral.
    const partnera = viewFor(data, s, partnerMiesta(o1)).draftStav;
    expect(partnera?.partner?.balicek).toEqual(balicekMiesta(s.draftStav ?? d, o1));
    expect(partnera?.partner?.vyber).toEqual(vyberMiesta(s.draftStav ?? d, o1));
    expect(partnera?.partner?.vyber).not.toBeNull();
    const supera = viewFor(data, s, u1).draftStav;
    expect(supera?.partner?.balicek).toEqual(balicekMiesta(s.draftStav ?? d, partnerMiesta(u1)));
    expect(supera?.miesta?.vybral[o1]).toBe(true);
    expect(supera?.miesta?.balicekPocet).toEqual([4, 4, 4, 4]);
    expect(supera?.vybral[timMiesta(o1)]).toBe(false);
    expect(JSON.stringify(supera)).not.toContain(`"doSenku":[${b[0]}`);
    for (const m of miestaHry(s)) overPohlad(s, m);
  });
});

describe("viewFor 2 na 2 — Zhromaždenie a Pitka", () => {
  it("Záverečnú partnera vidím v línii, súperský tím len rub s náhradným uid", () => {
    let s = vZhromazdeni(3);
    s = vyloz(s);
    s = vyloz(s);
    // Na ťahu je U2 (partner kapitána útočného tímu) — Záverečná lícom dole.
    const u2 = miestoNaTahu(s) as Miesto;
    expect(clenMiesta(u2)).not.toBe(clenMiesta(kapitan(s, timMiesta(u2))));
    const karta = rukaMiesta(s, u2).find((k) => k.defId === "pijan");
    s = apply(data, s, { type: "zaverecna", uid: karta?.uid ?? -1, target: "vlastna" }, u2).state;
    const u = timMiesta(u2);
    const u1 = partnerMiesta(u2);
    expect(viewFor(data, s, u1).strany[u].some((pl) => pl.card.uid === karta?.uid)).toBe(true);
    for (const m of miestaTimu(opponentOf(u))) {
      const v = viewFor(data, s, m);
      expect(v.strany[u].some((pl) => pl.card.uid === karta?.uid)).toBe(false);
      expect(v.zaverecne.find((z) => z.majitel === u)?.uid).toBe(uidZaverecnej(u));
    }
    for (const m of miestaHry(s)) overPohlad(s, m);
  });

  it("skryté NA EX kapitána vidí partner, súperský tím nie", () => {
    let s = vZhromazdeni(3);
    for (let i = 0; i < 4; i++) s = vyloz(s);
    while (s.faza === "zhromazdenie") s = apply(data, s, { type: "pass" }, miestoNaTahu(s) as Miesto).state;
    const o = opponentOf(s.utocnik);
    const naex = legalCommands(data, s, kapitan(s, o)).find((c) => c.type === "naex");
    if (naex === undefined) throw new Error("Bez NA EX.");
    s = apply(data, s, naex, kapitan(s, o)).state;
    expect(viewFor(data, s, partnerMiesta(kapitan(s, o))).pitkaStav?.skryteNaex).toHaveLength(1);
    for (const m of miestaTimu(s.utocnik)) expect(viewFor(data, s, m).pitkaStav?.skryteNaex).toEqual([]);
    for (const m of miestaHry(s)) overPohlad(s, m);
  });

  it("náhľad cigariet za pas: kým partner vykladá, pas nedá nič", () => {
    let s = vZhromazdeni(3);
    const u1 = miestoNaTahu(s) as Miesto;
    const zaPas = (m: Miesto): number => {
      const v = viewFor(data, s, m);
      return cigaretyZaPas(data, v, m);
    };
    expect(zaPas(u1)).toBe(0);
    const cig = s.hraci[timMiesta(u1)].cigarety;
    s = apply(data, s, { type: "pass" }, u1).state;
    expect(s.hraci[timMiesta(u1)].cigarety).toBe(cig);
    s = vyloz(s);
    const u2 = partnerMiesta(u1);
    expect(miestoNaTahu(s)).toBe(u2);
    // Posledný z tímu: zvyšok limitu 3, v oboch rukách 8 kariet → 3 — ako motor.
    expect(zaPas(u2)).toBe(3);
    s = apply(data, s, { type: "pass" }, u2).state;
    expect(s.hraci[timMiesta(u1)].cigarety).toBe(cig + 3);
  });
});

describe("viewFor 2 na 2 — celé partie bez úniku", () => {
  it.each([11, 12, 13])("pri každom kroku náhodnej partie a každom mieste (semienko %i)", (seed) => {
    let s = setupGame(data, seed, { format: "2na2" });
    let x = seed * 7919;
    const nahoda = (n: number): number => {
      x = (x * 1103515245 + 12345) % 2147483648;
      return x % n;
    };
    for (let krok = 0; s.koniec === null && krok < 4000; krok++) {
      for (const m of miestaHry(s)) overPohlad(s, m);
      const moznosti = miestaHry(s).flatMap((m) => legalCommands(data, s, m).map((cmd) => ({ m, cmd })));
      const { m, cmd } = moznosti[nahoda(moznosti.length)] as (typeof moznosti)[number];
      s = apply(data, s, cmd, m).state;
    }
    expect(s.koniec).not.toBeNull();
  });
});
