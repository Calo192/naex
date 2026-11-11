// Formát 2 na 2 (Michal 2026-10-28, roadmapa #24): tím je hráč z 1 na 1 s dvoma
// rukami — zdroje, balíčky a kliatby sú tímu, osobná je len ruka a ťah.
// Miesto pri stole: tím = miesto % 2, člen = miesto ÷ 2.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import predFrakciamiJson from "./data/cards-pred-frakciami.json";
import {
  DLZKY_HRY,
  KONSTANTY,
  apply,
  balicekMiesta,
  cirhozyPreVeterinara,
  clenMiesta,
  kapitan,
  kartyVRukach,
  legalCommands,
  loadGameData,
  miestaHry,
  miestoClena,
  miestoNaTahu,
  opponentOf,
  partnerMiesta,
  poradieSenku,
  poradieVykladania,
  tahBotaNaMieste,
  pohladPreBota,
  prahCirhozyBonus,
  prahDlhuBonus,
  rukaMiesta,
  setupGame,
  timMiesta,
} from "../src/index.ts";
import type { GameState, Miesto } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);
const stara = loadGameData(predFrakciamiJson, eldersJson, scorecardsJson);

describe("miesta pri stole", () => {
  it("miesta 0 a 1 sú prví členovia tímov — v 1 na 1 je miesto hráč", () => {
    const miesta: Miesto[] = [0, 1, 2, 3];
    expect(miesta.map(timMiesta)).toEqual([0, 1, 0, 1]);
    expect(miesta.map(clenMiesta)).toEqual([0, 0, 1, 1]);
    for (const m of miesta) expect(miestoClena(timMiesta(m), clenMiesta(m))).toBe(m);
  });
});

describe("príprava 2 na 2", () => {
  const s = setupGame(data, 7, { format: "2na2" });

  it("štyri miesta, každý hráč má štartovacie karty vo vlastnej ruke", () => {
    expect(s.format).toBe("2na2");
    expect(miestaHry(s)).toEqual([0, 1, 2, 3]);
    const start = Object.values(KONSTANTY.START_RUKA).reduce((a, b) => a + b, 0);
    for (const m of miestaHry(s)) expect(rukaMiesta(s, m)).toHaveLength(start);
    const uid = new Set(miestaHry(s).flatMap((m) => rukaMiesta(s, m).map((k) => k.uid)));
    expect(uid.size).toBe(4 * start);
    expect(kartyVRukach(s.hraci[0])).toHaveLength(2 * start);
  });

  it("tím začína so 6 poldeci (3 za člena, v12.2) a 4 cigaretami, prahy Dlhu a Cirhózy o 1 vyššie", () => {
    for (const h of s.hraci) {
      expect(h.poldeciPlne).toBe(6);
      expect(h.cigarety).toBe(4);
    }
    expect(prahDlhuBonus(s, 0)).toBe(1);
    expect(prahCirhozyBonus(s, 1)).toBe(1);
  });

  it("predvolená je Tretia liga", () => {
    expect(s.lokalitCelkom).toBe(DLZKY_HRY.kratka);
  });

  it("kapitáni zo semienka — v každom tíme jeden člen", () => {
    expect(s.kapitani).toBeDefined();
    expect(timMiesta(kapitan(s, 0))).toBe(0);
    expect(timMiesta(kapitan(s, 1))).toBe(1);
  });
});

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
    // Limit vykladania = plné poldeci tímu (v12.2).
    hraci: [{ ...s.hraci[0], poldeciPlne: limit }, { ...s.hraci[1], poldeciPlne: limit }],
    zhromazdenieStav: {
      naTahu: kapitan(s, s.utocnik),
      zostavaLimit: [limit, limit],
      pasoval: [false, false],
      navyse: [0, 0],
      skoncili: [false, false, false, false],
    },
  };
}

/** Miesto na ťahu vyloží svoju Pijana na vlastnú stranu. */
function vylozPijana(s: GameState): GameState {
  const kto = miestoNaTahu(s);
  if (kto === null) throw new Error("Nikto nie je na ťahu.");
  const pijan = rukaMiesta(s, kto).find((k) => k.defId === "pijan");
  if (pijan === undefined) throw new Error("Bez Pijana.");
  return apply(data, s, { type: "place", uid: pijan.uid, target: "vlastna" }, kto).state;
}

describe("Zhromaždenie 2 na 2", () => {
  it("poradie U1 → O1 → U2 → O2, prví sú kapitáni; karta ide z ruky toho, kto vykladá", () => {
    let s = vZhromazdeni(3);
    const poradie = poradieVykladania(s);
    const u = s.utocnik;
    expect(poradie).toEqual([kapitan(s, u), kapitan(s, opponentOf(u)), partnerMiesta(kapitan(s, u)), partnerMiesta(kapitan(s, opponentOf(u)))]);
    const tahy: Miesto[] = [];
    for (let i = 0; i < 4; i++) {
      const kto = miestoNaTahu(s) as Miesto;
      tahy.push(kto);
      const pred = rukaMiesta(s, kto).length;
      const partnera = rukaMiesta(s, partnerMiesta(kto));
      s = vylozPijana(s);
      expect(rukaMiesta(s, kto)).toHaveLength(pred - 1);
      expect(rukaMiesta(s, partnerMiesta(kto))).toEqual(partnera);
    }
    expect(tahy).toEqual(poradie);
    // Limit je tímový: každý tím vyložil dve karty z troch.
    expect(s.zhromazdenieStav?.zostavaLimit).toEqual([1, 1]);
  });

  it("cudzie miesto ťahať nesmie", () => {
    const s = vZhromazdeni(3);
    const partner = partnerMiesta(miestoNaTahu(s) as Miesto);
    const karta = rukaMiesta(s, partner)[0];
    expect(() => apply(data, s, { type: "place", uid: karta?.uid ?? -1, target: "vlastna" }, partner)).toThrow();
  });

  it("pas člena aj tímu je bez cigariet (v12.2)", () => {
    let s = vZhromazdeni(3);
    const u = s.utocnik;
    const u1 = miestoNaTahu(s) as Miesto;
    const cig = s.hraci[u].cigarety;
    s = apply(data, s, { type: "pass" }, u1).state;
    expect(s.hraci[u].cigarety).toBe(cig);
    expect(s.zhromazdenieStav?.pasoval[u]).toBe(false);
    // O1 vyloží, U1 už nehrá — na ťahu je U2, potom O2.
    s = vylozPijana(s);
    expect(miestoNaTahu(s)).toBe(partnerMiesta(u1));
    s = apply(data, s, { type: "pass" }, partnerMiesta(u1)).state;
    // v12.2: pas cigarety nedáva — ani tímu, ktorý nevyložil nič.
    expect(s.hraci[u].cigarety).toBe(cig);
    expect(s.zhromazdenieStav?.pasoval[u]).toBe(true);
    expect(miestoNaTahu(s)).toBe(partnerMiesta(kapitan(s, opponentOf(u))));
  });

  it("keď skončia ostatní, hrá posledný sám a potom príde Pitka", () => {
    let s = vZhromazdeni(4);
    for (let i = 0; i < 3; i++) s = apply(data, s, { type: "pass" }, miestoNaTahu(s) as Miesto).state;
    const posledny = miestoNaTahu(s) as Miesto;
    s = vylozPijana(s);
    expect(miestoNaTahu(s)).toBe(posledny);
    s = apply(data, s, { type: "pass" }, posledny).state;
    expect(s.faza).toBe("pitka");
  });

  it("Záverečná ukončí vykladanie celého tímu", () => {
    let s = vZhromazdeni(3);
    const u1 = miestoNaTahu(s) as Miesto;
    const karta = rukaMiesta(s, u1).find((k) => k.defId === "pijan");
    s = apply(data, s, { type: "zaverecna", uid: karta?.uid ?? -1, target: "vlastna" }, u1).state;
    expect(s.zhromazdenieStav?.skoncili?.[partnerMiesta(u1)]).toBe(true);
    s = vylozPijana(s);
    // Útočný tím skončil — po O1 je na ťahu O2.
    expect(miestoNaTahu(s)).toBe(partnerMiesta(kapitan(s, opponentOf(s.utocnik))));
  });
});

/**
 * Pitka 2 na 2 po odkrytí NA EX: každý vyložil Pijana, všetci pasovali, kapitán obranného
 * tímu dal NA EX a odpovedá útočný tím. `uprav` zmení stav tesne pred odkrytím.
 */
function vOdpovedi(uprav: (s: GameState) => GameState = (s) => s): GameState {
  let s = vZhromazdeni(3);
  for (let i = 0; i < 4; i++) s = vylozPijana(s);
  while (s.faza === "zhromazdenie") s = apply(data, s, { type: "pass" }, miestoNaTahu(s) as Miesto).state;
  expect(s.faza).toBe("pitka");
  const u = s.utocnik;
  const o = opponentOf(u);
  const naex = legalCommands(data, s, kapitan(s, o)).find((c) => c.type === "naex");
  if (naex === undefined) throw new Error("Bez NA EX.");
  s = apply(data, s, naex, kapitan(s, o)).state;
  // v12.2: bez doliatia za cigarety má tím po NA EX často len „hotovo“ — hra ho urobí sama.
  if (s.pitkaStav?.hotovy[o] === false) s = apply(data, s, { type: "skipNaex" }, kapitan(s, o)).state;
  s = uprav(s);
  return apply(data, s, { type: "skipNaex" }, kapitan(s, u)).state;
}

/** Stav s vyprázdnenou rukou miesta. */
function bezRuky(s: GameState, m: Miesto): GameState {
  const t = timMiesta(m);
  const h = s.hraci[t];
  const hraci = [...s.hraci] as [GameState["hraci"][0], GameState["hraci"][1]];
  hraci[t] = clenMiesta(m) === 0 ? { ...h, ruka: [] } : { ...h, rukaDruheho: [] };
  return { ...s, hraci };
}

describe("odpoveď na NA EX 2 na 2 — kapitán určí (Michal 2026-11-02, Q10)", () => {
  it("odpovedá kapitán; partner bez odovzdania nehrá", () => {
    const s = vOdpovedi();
    expect(s.pitkaStav?.reakcia).toBe(s.utocnik);
    const u1 = kapitan(s, s.utocnik);
    const u2 = partnerMiesta(u1);
    expect(miestoNaTahu(s)).toBe(u1);
    expect(s.pitkaStav?.odpoveda).toBe(u1);
    const typy = legalCommands(data, s, u1).map((c) => c.type);
    expect(typy).toContain("bezReakcie");
    expect(typy).toContain("odovzdatOdpoved");
    expect(typy).toContain("place");
    expect(legalCommands(data, s, u2)).toEqual([]);
    const karta = rukaMiesta(s, u2)[0];
    expect(() => apply(data, s, { type: "place", uid: karta?.uid ?? -1, target: "vlastna" }, u2)).toThrow();
    expect(() => apply(data, s, { type: "odovzdatOdpoved" }, u2)).toThrow();
  });

  it("kapitán odpovie sám kartou zo svojej ruky", () => {
    let s = vOdpovedi();
    const u1 = kapitan(s, s.utocnik);
    const cmd = legalCommands(data, s, u1).find((c) => c.type === "place");
    if (cmd?.type !== "place") throw new Error("Bez odpovede.");
    const partnera = rukaMiesta(s, partnerMiesta(u1));
    s = apply(data, s, cmd, u1).state;
    expect(rukaMiesta(s, u1).some((k) => k.uid === cmd.uid)).toBe(false);
    expect(rukaMiesta(s, partnerMiesta(u1))).toEqual(partnera);
    expect(s.pitkaStav?.odpoveda).toBeUndefined();
  });

  it("kapitán odovzdá odpoveď jedným príkazom — partner odpovie zo svojej ruky", () => {
    let s = vOdpovedi();
    const u1 = kapitan(s, s.utocnik);
    const u2 = partnerMiesta(u1);
    s = apply(data, s, { type: "odovzdatOdpoved" }, u1).state;
    expect(miestoNaTahu(s)).toBe(u2);
    expect(legalCommands(data, s, u1)).toEqual([]);
    expect(legalCommands(data, s, u2).map((c) => c.type)).not.toContain("odovzdatOdpoved");
    const kapitana = rukaMiesta(s, u1);
    const cmd = legalCommands(data, s, u2).find((c) => c.type === "place");
    if (cmd?.type !== "place") throw new Error("Bez odpovede.");
    s = apply(data, s, cmd, u2).state;
    expect(rukaMiesta(s, u2).some((k) => k.uid === cmd.uid)).toBe(false);
    expect(rukaMiesta(s, u1)).toEqual(kapitana);
  });

  it("kapitán bez odpovede v ruke: hra za tím neodpovie, kým má čím partner", () => {
    const s = vOdpovedi((x) => bezRuky(x, kapitan(x, x.utocnik)));
    const u1 = kapitan(s, s.utocnik);
    expect(miestoNaTahu(s)).toBe(u1);
    expect(legalCommands(data, s, u1).map((c) => c.type).sort()).toEqual(["bezReakcie", "odovzdatOdpoved"]);
  });

  it("partner bez odpovede v ruke: odovzdať sa nedá", () => {
    const s = vOdpovedi((x) => bezRuky(x, partnerMiesta(kapitan(x, x.utocnik))));
    const u1 = kapitan(s, s.utocnik);
    expect(legalCommands(data, s, u1).map((c) => c.type)).not.toContain("odovzdatOdpoved");
    expect(() => apply(data, s, { type: "odovzdatOdpoved" }, u1)).toThrow();
  });

  it("nikto z tímu nemá čím odpovedať — tím sa preskočí ako v 1 na 1", () => {
    const s = vOdpovedi((x) => bezRuky(bezRuky(x, kapitan(x, x.utocnik)), partnerMiesta(kapitan(x, x.utocnik))));
    expect(s.pitkaStav?.reakcia ?? null).toBeNull();
    expect(s.pitkaStav?.odpoveda).toBeUndefined();
  });
});

/** Partia 2 na 2 po voľbe cieľa — v drafte (pokus o zajatie nikto nemá, hra ho preskočí). */
function vDrafte(): GameState {
  const s = setupGame(data, 7, { format: "2na2" });
  const kto = miestoNaTahu(s) as Miesto;
  expect(kto).toBe(kapitan(s, opponentOf(s.utocnik)));
  const ciel = legalCommands(data, s, timMiesta(kto))[0];
  if (ciel === undefined) throw new Error("Bez voľby cieľa.");
  return apply(data, s, ciel, kto).state;
}

/** Všetci štyria postavia šenok: prvé 2 karty do šenku, zvyšok naspodok. */
function postavSenok(s: GameState): GameState {
  for (const m of poradieSenku(s)) {
    const d = s.draftStav;
    if (d === null) throw new Error("Bez draftu.");
    const b = balicekMiesta(d, m).map((k) => k.uid);
    s = apply(data, s, { type: "stavbaSenku", doSenku: b.slice(0, 2), odhod: b.slice(2) }, m).state;
  }
  return s;
}

describe("draft 2 na 2", () => {
  it("stavba: každý hráč 1 Nástroj + 3 Občania, 2 do šenku; šenok má 8", () => {
    const s = vDrafte();
    expect(s.draftStav?.krok).toBe("stavba");
    for (const m of poradieSenku(s)) {
      const b = balicekMiesta(s.draftStav ?? { balicky: [[], []] }, m);
      expect(b).toHaveLength(4);
      expect(b.filter((k) => data.cards.get(k.defId)?.tags.includes("Nástroj"))).toHaveLength(1);
    }
    const po = postavSenok(s);
    expect(po.senok).toHaveLength(8);
    expect(po.draftStav?.krok).toBe("beranie");
    expect(miestoNaTahu(po)).toBe(kapitan(po, opponentOf(po.utocnik)));
  });

  it("každý stavia naraz a len zo svojho balíčka", () => {
    const s = vDrafte();
    const [o1, u1] = poradieSenku(s) as Miesto[];
    const cudzi = balicekMiesta(s.draftStav ?? { balicky: [[], []] }, o1 as Miesto).map((k) => k.uid);
    expect(() => apply(data, s, { type: "stavbaSenku", doSenku: cudzi.slice(0, 2), odhod: cudzi.slice(2) }, u1 as Miesto)).toThrow();
  });

  it("každý dá 2 do šenku a 2 naspodok, nikto si nič nenechá (karta zadarmo zanikla vo v11.4)", () => {
    const s = postavSenok(vDrafte());
    expect(s.senok).toHaveLength(8);
    for (const m of [0, 1, 2, 3] as const) expect(rukaMiesta(s, m)).toHaveLength(4);
  });

  it("branie O1 → U1 → O2 → U2, O1 na prvom ťahu len 1 karta, karta do ruky toho, kto berie", () => {
    let s = postavSenok(vDrafte());
    const poradie = poradieSenku(s);
    const o1 = poradie[0] as Miesto;
    const prve = s.senok.slice(0, 2).map((k) => k.uid);
    expect(() => apply(data, s, { type: "draftBer", uids: prve }, o1)).toThrow();
    for (const m of poradie) {
      expect(miestoNaTahu(s)).toBe(m);
      const uid = s.senok[0]?.uid ?? -1;
      s = apply(data, s, { type: "draftBer", uids: [uid] }, m).state;
      expect(rukaMiesta(s, m).some((k) => k.uid === uid)).toBe(true);
    }
    expect(miestoNaTahu(s)).toBe(o1);
  });

  it("keď prestane celý tím, každý člen druhého tímu má poslednú šancu", () => {
    let s = postavSenok(vDrafte());
    const [o1, u1, o2, u2] = poradieSenku(s) as Miesto[];
    s = apply(data, s, { type: "draftStop" }, o1 as Miesto).state;
    expect(miestoNaTahu(s)).toBe(u1);
    s = apply(data, s, { type: "draftStop" }, u1 as Miesto).state;
    expect(miestoNaTahu(s)).toBe(o2);
    s = apply(data, s, { type: "draftStop" }, o2 as Miesto).state;
    // Obranný tím prestal — U2 má jeden posledný ťah, potom draft končí.
    expect(miestoNaTahu(s)).toBe(u2);
    s = apply(data, s, { type: "draftBer", uids: [s.senok[0]?.uid ?? -1] }, u2 as Miesto).state;
    expect(s.faza).toBe("zhromazdenie");
  });
});

describe("celá partia 2 na 2", () => {
  it.each([1, 2, 3, 4, 5])("náhodné legálne ťahy všetkých štyroch dohrajú partiu (semienko %i)", (seed) => {
    let s = setupGame(data, seed, { format: "2na2" });
    let x = seed * 7919;
    const nahoda = (n: number): number => {
      x = (x * 1103515245 + 12345) % 2147483648;
      return x % n;
    };
    let krokov = 0;
    for (; s.koniec === null && krokov < 4000; krokov++) {
      const moznosti = miestaHry(s).flatMap((m) => legalCommands(data, s, m).map((cmd) => ({ m, cmd })));
      expect(moznosti.length, `faza ${s.faza}, krok ${krokov}`).toBeGreaterThan(0);
      const { m, cmd } = moznosti[nahoda(moznosti.length)] as (typeof moznosti)[number];
      s = apply(data, s, cmd, m).state;
      // Tímové zdroje, ruky oboch členov — karty sa nestrácajú ani nezdvojujú.
      const uid = miestaHry(s).flatMap((q) => rukaMiesta(s, q).map((k) => k.uid));
      expect(new Set(uid).size).toBe(uid.length);
    }
    expect(s.koniec).not.toBeNull();
  });
});

describe("karta „do ruky“ ide tomu, kto efekt spustil (Q4)", () => {
  const karta = (defId: string, uid: number) => ({ uid, defId, leftLayout: 0, rightLayout: 0 });

  /** Partner kapitána útočiaceho tímu má v ruke danú kartu a je na ťahu. */
  function partnerNaTahu(defId: string, doOdhadzovacieho: readonly string[] = []): { s: GameState; partner: Miesto } {
    const z = vZhromazdeni(3);
    const tim = z.utocnik;
    const partner = partnerMiesta(kapitan(z, tim));
    const hraci = [...z.hraci] as [GameState["hraci"][0], GameState["hraci"][1]];
    const clen = clenMiesta(partner);
    hraci[tim] = {
      ...hraci[tim],
      ...(clen === 0 ? { ruka: [karta(defId, 90001), karta("pijan", 90002)] } : { rukaDruheho: [karta(defId, 90001), karta("pijan", 90002)] }),
      odhadzovaci: doOdhadzovacieho.map((id, i) => karta(id, 90100 + i)),
    };
    const zh = z.zhromazdenieStav;
    if (zh === null) throw new Error("Bez Zhromaždenia.");
    return { s: { ...z, hraci, zhromazdenieStav: { ...zh, naTahu: partner } }, partner };
  }

  it("karta v línii si pamätá člena, ktorý ju vyložil", () => {
    const { s, partner } = partnerNaTahu("pijan");
    const po = apply(data, s, { type: "place", uid: 90001, target: "vlastna" }, partner).state;
    expect(po.strany[timMiesta(partner)].at(-1)?.miesto).toBe(partner);
  });

  it("Hasič: rozhoduje člen, ktorý ho vyložil, nie kapitán, a karta ide do jeho ruky", () => {
    const { s: s0, partner } = partnerNaTahu("hasic", ["pijan"]);
    // Hasič má Podporu (frakcie 2026-11-08): priloží sa k Pijanovi, ktorého vyložil kapitán tímu.
    const tim = timMiesta(partner);
    const pijan = { card: karta("pijan", 90004), playedBy: tim, miesto: kapitan(s0, tim) };
    const s: GameState = { ...s0, strany: s0.strany.map((st, q) => (q === tim ? [...st, pijan] : st)) as unknown as GameState["strany"] };
    const po = apply(data, s, { type: "place", uid: 90001, target: "vlastna" }, partner).state;
    expect(po.hasicVolby?.[0]?.miesto).toBe(partner);
    expect(miestoNaTahu(po)).toBe(partner);
    const pocetPred = rukaMiesta(po, partner).length;
    const kap = kapitan(po, timMiesta(partner));
    const rukaKapitana = rukaMiesta(po, kap).length;
    expect(() => apply(data, po, { type: "hasic", nechat: true }, kap)).toThrow();
    const koniec = apply(data, po, { type: "hasic", nechat: true }, partner).state;
    expect(rukaMiesta(koniec, partner).length).toBe(pocetPred + 1);
    expect(rukaMiesta(koniec, kap).length).toBe(rukaKapitana);
  });

  it("Predavačka a Živnostník: z ponuky vyberá člen, ktorý kartu vyložil; Živnostník do jeho ruky, Predavačka navrch balíčka tímu", () => {
    // Podpora (Michal 2026-11-09; Predavačka v12): k Pijanovi, ktorého vyložil kapitán tímu.
    for (const [defId, vziat, ina] of [["predavacka", "vandal", "vidly"], ["zivnostnik", "vidly", "vandal"]] as const) {
      const { s: s0, partner } = partnerNaTahu(defId);
      const tim = timMiesta(partner);
      const kap = kapitan(s0, tim);
      const pijan = { card: karta("pijan", 90004), playedBy: tim, miesto: kap };
      const dobra = karta(vziat, 90005);
      const s: GameState = {
        ...s0,
        senok: [karta(ina, 90006), dobra],
        strany: s0.strany.map((st, q) => (q === tim ? [...st, pijan] : st)) as unknown as GameState["strany"],
      };
      const po = apply(data, s, { type: "place", uid: 90001, target: "vlastna" }, partner).state;
      expect(po.hasicVolby?.[0]).toMatchObject({ typ: "senok", zdroj: defId, miesto: partner });
      expect(miestoNaTahu(po)).toBe(partner);
      // Predavačka smie hocijakú kartu z ponuky, Živnostník len Nástroj.
      expect(legalCommands(data, po, partner)).toEqual(defId === "predavacka" ? s.senok.map((k) => ({ type: "senok", uid: k.uid })) : [{ type: "senok", uid: dobra.uid }]);
      expect(() => apply(data, po, { type: "senok", uid: dobra.uid }, kap)).toThrow();
      const rukaKapitana = rukaMiesta(po, kap).length;
      const rukaPartnera = rukaMiesta(po, partner).length;
      const koniec = apply(data, po, { type: "senok", uid: dobra.uid }, partner).state;
      if (defId === "predavacka") {
        expect(koniec.hraci[tim].doberaci[0]).toEqual(dobra);
        expect(rukaMiesta(koniec, partner).length).toBe(rukaPartnera);
      } else expect(rukaMiesta(koniec, partner)).toContainEqual(dobra);
      expect(rukaMiesta(koniec, kap).length).toBe(rukaKapitana);
    }
  });

  it("Veterinár vidí Cirhózy v oboch rukách tímu", () => {
    const h = setupGame(data, 7, { format: "2na2" }).hraci[0];
    const c = karta("cirhoza", 90200);
    const c2 = karta("cirhoza", 90201);
    expect(cirhozyPreVeterinara({ ...h, ruka: [c], rukaDruheho: [c2], priznane: [] }).map((k) => k.uid)).toEqual([90200, 90201]);
  });
});

describe("boti na každom mieste (#27)", () => {
  const dohraj = (s0: GameState, seed: number): GameState => {
    let s = s0;
    let x = seed;
    for (let krok = 0; s.koniec === null && krok < 6000; krok++) {
      const m = miestaHry(s).find((q) => legalCommands(data, s, q).length > 0);
      if (m === undefined) throw new Error(`Nikto nemá ťah vo fáze ${s.faza}.`);
      x = (x * 1103515245 + 12345) % 2147483648;
      s = apply(data, s, tahBotaNaMieste(data, s, m, x, { vzorky: 1 }), m).state;
    }
    return s;
  };

  it.each([11, 12, 13])("štyria boti dohrajú partiu (semienko %i)", (seed) => {
    expect(dohraj(setupGame(data, seed, { format: "2na2" }), seed).koniec).not.toBeNull();
  }, 120000);

  it("kapitán s odpoveďou na NA EX: pohľad bota mu dá ťahy, aj keď je druhým členom tímu", () => {
    const s = vOdpovedi();
    const tim = s.pitkaStav?.reakcia;
    if (tim == null) throw new Error("Bez odpovede.");
    const kap = kapitan(s, tim);
    const skutocne = legalCommands(data, s, kap);
    expect(skutocne.length).toBeGreaterThan(0);
    for (const m of [kap, partnerMiesta(kap)]) {
      const clen = clenMiesta(m);
      const st: GameState = { ...s, kapitani: tim === 0 ? [clen, s.kapitani?.[1] ?? 0] : [s.kapitani?.[0] ?? 0, clen] };
      const pk = st.pitkaStav;
      if (pk === null) throw new Error("Bez Pitky.");
      const so: GameState = { ...st, pitkaStav: { ...pk, odpoveda: m } };
      const pohlad = pohladPreBota(so, m);
      expect(pohlad.pitkaStav?.odpoveda).toBe(tim);
      expect(legalCommands(data, pohlad, tim).length).toBeGreaterThan(0);
    }
  });

  it("pohľad pre bota je 1 na 1 a ruka je len jeho", () => {
    const s = vZhromazdeni(3);
    const p = pohladPreBota(s, 2);
    expect(p.format).toBeUndefined();
    expect(p.kapitani).toBeUndefined();
    expect(p.hraci[0].ruka.map((k) => k.uid)).toEqual(rukaMiesta(s, 2).map((k) => k.uid));
    expect(p.hraci[0].rukaDruheho).toBeUndefined();
    expect(p.zhromazdenieStav?.skoncili).toBeUndefined();
    expect(p.hraci[1].ruka).toHaveLength(rukaMiesta(s, 1).length + rukaMiesta(s, 3).length);
  });

  it("v tíme človek + bot je kapitánom vždy človek, aj v ďalších kolách", () => {
    const s = setupGame(data, 3, { format: "2na2", ludia: [2] });
    expect(kapitan(s, 0)).toBe(2);
    expect(s.kapitanPevny).toEqual([true, false]);
    const k1 = kapitan(s, 1);
    let po: GameState = s;
    let x = 3;
    while (po.koniec === null && po.kolo === 1) {
      const m = miestaHry(po).find((q) => legalCommands(data, po, q).length > 0) as Miesto;
      x = (x * 1103515245 + 12345) % 2147483648;
      po = apply(data, po, tahBotaNaMieste(data, po, m, x, { vzorky: 1 }), m).state;
    }
    if (po.koniec === null) {
      expect(kapitan(po, 0)).toBe(2);
      expect(kapitan(po, 1)).toBe(partnerMiesta(k1));
    }
  }, 120000);

  it("dvaja ľudia v tíme sa v kapitánovi striedajú", () => {
    const s = setupGame(data, 3, { format: "2na2", ludia: [0, 2, 1] });
    expect(s.kapitanPevny).toEqual([false, true]);
    expect(kapitan(s, 1)).toBe(1);
  });
});

describe("1 na 1 sa nemení", () => {
  const s = setupGame(data, 7);

  it("bez formátu, kapitánov a druhej ruky; prahy a zdroje ako doteraz", () => {
    expect(s.format).toBeUndefined();
    expect(s.kapitani).toBeUndefined();
    expect(miestaHry(s)).toEqual([0, 1]);
    for (const h of s.hraci) {
      expect(h.rukaDruheho).toBeUndefined();
      expect(h.poldeciPlne).toBe(KONSTANTY.START_POLDECI);
      expect(h.cigarety).toBe(KONSTANTY.START_CIGARETY);
    }
    expect(prahDlhuBonus(s, 0)).toBe(0);
    expect(kapitan(s, 1)).toBe(1);
  });
});
