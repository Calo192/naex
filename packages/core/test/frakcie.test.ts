// Frakcie (Michal 2026-11-08, docs/napady/frakcie-final.json): akcie navyše podmienené tagom
// (Spoločník, Nepriateľ, Podpora a Konflikt s tagom), nové efekty Vdovy, Predavačky, Hasiča
// a lokalít bez Kšeftu (Zberný dvor, Sklad, Predsedova vila). Kšeft zanikol úplne.
// Očakávané hodnoty sú z pravidla (špecifikácia), nie z kódu.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import frakcieJson from "./data/frakcie-karty.json";
import predFrakciamiJson from "./data/cards-pred-frakciami.json";
import { naexOdkryte } from "./helpers.ts";
import type { CardInstance, Command, GameData, GameState, PlacedCard, PlayerId } from "../src/index.ts";
import {
  apply,
  cardVariants,
  cenaDedicstva,
  efektyNavyse,
  evaluateLine,
  legalCommands,
  lineState,
  loadGameData,
  parseCards,
  poskodenieBitky,
  rozborNavyse,
  sPrilozenou,
  setupGame,
  stavNavyseVRuke,
  tahBota,
  textBezAkcii,
  viewFor,
} from "../src/index.ts";

type Surova = Record<string, unknown> & { id: string };

/** Sada z cards.json so zmenami zo špecifikácie frakcií (texty v zápise tvorcu, nové strany). */
function frakcieData(): GameData {
  const zmeny = new Map((frakcieJson.karty as Surova[]).map((k) => [k.id, k]));
  const cards = (cardsJson as { cards: Surova[] }).cards.map((c) => {
    const z = zmeny.get(c.id);
    if (z === undefined) return c;
    const novy: Surova = { ...c, ...z };
    const def = parseCards({ cards: [novy] }).get(c.id);
    if (def === undefined) throw new Error(c.id);
    const v = cardVariants(def);
    return { ...novy, permutations: { total: v.total, left: v.left.length, right: v.right.length } };
  });
  return loadGameData({ ...cardsJson, cards }, eldersJson, scorecardsJson);
}

const data = frakcieData();
// Sada pred frakciami (cards.json pred 2026-11-08) — staré efekty pre staré sady.
const stara = loadGameData(predFrakciamiJson, eldersJson, scorecardsJson);

let uidSeq = 970000;
const inst = (defId: string): CardInstance => ({ uid: ++uidSeq, defId, leftLayout: 0, rightLayout: 0 });
const lezi = (card: CardInstance, playedBy: PlayerId, x: Partial<PlacedCard> = {}): PlacedCard => ({ card, playedBy, ...x });
const linia = (strany: GameState["strany"]) => evaluateLine(data, { lokalita: null, lokalitaOtocena: false, strany });
const zdroj = (strany: GameState["strany"], p: PlayerId, uid: number) =>
  Object.values(linia(strany).zdroje[p]).flat().filter((z) => z?.uid === uid && z.dovody.some((d) => d.startsWith("akcia navyše")));
const navyseKarty = (strany: GameState["strany"], uid: number) => linia(strany).cards.get(uid)?.navyse;

function sHracom(s: GameState, p: PlayerId, h: Partial<GameState["hraci"][number]>): GameState {
  return { ...s, hraci: (p === 0 ? [{ ...s.hraci[0], ...h }, s.hraci[1]] : [s.hraci[0], { ...s.hraci[1], ...h }]) as unknown as GameState["hraci"] };
}

/** Zhromaždenie na lokalite `lok`, hráč 0 na ťahu s `ruka`. */
function zhromazdenie(lok: string, strany: GameState["strany"], ruka: CardInstance[]): GameState {
  const s0 = setupGame(data, 7);
  const lokalita = s0.lokalityVHre.find((k) => k.defId === lok) ?? inst(lok);
  return {
    ...sHracom(s0, 0, { ruka, cigarety: 6 }),
    faza: "zhromazdenie",
    utocnik: 0,
    ciel: { typ: "lokalita", lokalita },
    lokalityVHre: s0.lokalityVHre.filter((k) => k !== lokalita),
    strany,
    pitkyCelkom: 1,
    pitkaCislo: 0,
    pitkaStav: null,
    zhromazdenieStav: { naTahu: 0, zostavaLimit: [3, 3], pasoval: [false, false], navyse: [0, 0] },
  };
}

function vPitke(lok: string, strany: GameState["strany"] = [[], []]): GameState {
  const s0 = setupGame(data, 7);
  const lokalita = s0.lokalityVHre.find((k) => k.defId === lok) ?? inst(lok);
  const hraci = s0.hraci.map((h) => ({ ...h, cigarety: 9, ruka: [inst("pijan"), inst("cirhoza")], doberaci: [inst("masiar"), inst("vandal"), inst("pijan"), inst("pijan")] })) as unknown as GameState["hraci"];
  return {
    ...s0,
    hraci,
    faza: "pitka",
    utocnik: 1,
    ciel: { typ: "lokalita", lokalita },
    lokalityVHre: s0.lokalityVHre.filter((k) => k !== lokalita),
    strany,
    pitkyCelkom: 2,
    pitkaCislo: 1,
    pitkaStav: { naTahu: 0, hotovy: [false, false], naexPouzity: [false, false], fajcenie: [0, 0], reakcia: null, postarka: [false, false], starosta: [false, false], naexPocet: [0, 0] },
  };
}

describe("zápis efektu v tvorcovi: „Spúšťač: Tag {Akcia}.“", () => {
  it("prečíta spúšťač, tag a akcie; text bez piktogramov ostane na pole efektu", () => {
    expect(rozborNavyse("Spoločník: Pamätník {Povera} {Povera}.")).toEqual({ efekty: [{ spustac: "Spoločník", tag: "Pamätník", akcie: ["Povera", "Povera"] }], chyby: [] });
    expect(rozborNavyse("Podpora: {Robota}.").efekty).toEqual([{ spustac: "Podpora", tag: null, akcie: ["Robota"] }]);
    // Názov z tvorcu namiesto kľúča: Hazard je akcia Dlh, medzery nevadia.
    expect(rozborNavyse("Nepriateľ: Kriminál {Hazard} {Poškodenie pečene}.").efekty[0]?.akcie).toEqual(["Dlh", "PoškodeniePečene"]);
    expect(textBezAkcii("Spoločník: Pamätník {Povera} {Povera}.")).toBe("Spoločník: Pamätník.");
    // Efekt slovami (Vdova, Hasič) nie je efekt navyše.
    expect(rozborNavyse("Konflikt: Chlap — Súper odhodí 1 kartu z ruky.").efekty).toEqual([]);
  });

  it("preklep spadne pri načítaní sady, nie potichu v partii", () => {
    expect(rozborNavyse("Spoločník: Pamatnik {Povera}.").chyby).toHaveLength(1);
    expect(rozborNavyse("Spoločník: Pamätník {Pověra}.").chyby).toHaveLength(1);
    expect(rozborNavyse("Spoločník: Pamätník {Posilnenie}.").chyby).toHaveLength(1);
    expect(rozborNavyse("Nástup: Dostaneš {Rana}.").chyby).toHaveLength(1);
    const zla = { ...(cardsJson as { cards: Surova[] }).cards[0], effect_text: "Spoločník: Autorta {Rana}." };
    expect(() => parseCards({ cards: [zla] })).toThrow(/Autorta/);
  });

  it("celá sada zo špecifikácie sa načíta a 21 kariet má efekt navyše (14 frakcií, 7 skrytých akcií)", () => {
    const s = [...data.cards.values()].filter((d) => efektyNavyse(d).length > 0).map((d) => d.id);
    expect(s).toHaveLength(21);
    expect(efektyNavyse(data.cards.get("vestica")!)).toEqual([{ spustac: "Spoločník", tag: "Pamätník", akcie: ["Povera", "Povera"] }]);
  });
});

describe("Spoločník a Nepriateľ — raz, kým platí podmienka", () => {
  it("Spoločník: iná vlastná odkrytá karta s tagom kdekoľvek v línii; dve také karty stále 1×", () => {
    const vest = inst("vestica");
    const bez: GameState["strany"] = [[lezi(vest, 0)], []];
    expect(zdroj(bez, 0, vest.uid)).toEqual([]);
    expect(navyseKarty(bez, vest.uid)?.[0]?.krat).toBe(0);
    // Milujúca manželka je Pamätník; leží podstrčená na súperovej strane — stále moja partia.
    const s: GameState["strany"] = [[lezi(vest, 0), lezi(inst("milujuca_manzelka"), 0)], [lezi(inst("milujuca_manzelka"), 0)]];
    expect(linia(s).sums[0].Povera ?? 0).toBe((linia([[lezi(vest, 0), lezi(inst("milujuca_manzelka"), 0)], []]).sums[0].Povera ?? 0) + 0);
    expect(zdroj(s, 0, vest.uid)).toEqual([{ defId: "vestica", uid: vest.uid, hodnota: 2, vStrede: false, dovody: ["akcia navyše (Spoločník: Pamätník)"] }]);
    // Súperov Pamätník Spoločníka nesplní.
    expect(zdroj([[lezi(vest, 0)], [lezi(inst("milujuca_manzelka"), 1)]], 0, vest.uid)).toEqual([]);
  });

  it("Nepriateľ: súperova odkrytá karta s tagom; akcia navyše patrí majiteľovi karty, aj podstrčenej", () => {
    const pol = inst("policajtka");
    const krim = inst("podvodnik");
    const s: GameState["strany"] = [[lezi(krim, 1)], [lezi(pol, 0)]];
    expect(zdroj(s, 0, pol.uid)).toEqual([expect.objectContaining({ hodnota: 1 })]);
    expect(linia(s).sums[0].Petelica ?? 0).toBeGreaterThanOrEqual(1);
    expect(zdroj([[lezi(krim, 0)], [lezi(pol, 0)]], 0, pol.uid)).toEqual([]);
  });

  it("skrytá Záverečná nič nesplní ani nedostane, kým sa neotočí", () => {
    const pol = inst("policajtka");
    expect(zdroj([[lezi(inst("podvodnik"), 1, { zaverecna: true })], [lezi(pol, 0)]], 0, pol.uid)).toEqual([]);
    expect(zdroj([[lezi(inst("podvodnik"), 1)], [lezi(pol, 0, { zaverecna: true })]], 0, pol.uid)).toEqual([]);
  });

  it("Mäsiar: Nepriateľ Recidivistu (je aj Zviera) vedľa neho neplatí", () => {
    const rec = inst("recidivista");
    const zahr = lezi(inst("kocovnik"), 1);
    expect(zdroj([[lezi(rec, 0)], [zahr]], 0, rec.uid)).toHaveLength(1);
    expect(zdroj([[lezi(rec, 0), lezi(inst("masiar"), 1)], [zahr]], 0, rec.uid)).toEqual([]);
  });

  it("NA EX na karte akciu navyše nezdvojí (nie je na spoji); Vidly ju zosilnia (mení všetky Rany hráča)", () => {
    const stryko = inst("stryko_z_ameriky");
    const s: GameState["strany"] = [[lezi(stryko, 0, { naexBy: 0 })], [lezi(inst("policajtka"), 1)]];
    expect(zdroj(s, 0, stryko.uid)).toEqual([expect.objectContaining({ hodnota: 2 })]);
    const s0 = setupGame(data, 3);
    const stav = { ...s0, strany: s } as GameState;
    const sVidlami = sHracom(stav, 0, { dedicstvo: [inst("vidly")] });
    const sums = linia(s).sums;
    expect(poskodenieBitky(data, sVidlami, sums).tuhe[0] - poskodenieBitky(data, stav, sums).tuhe[0]).toBe(sums[0].Rana ?? 0);
  });

  it("v ruke: Spoločník podľa toho, čo teraz leží v línii; Podpora sivá", () => {
    const e = efektyNavyse(data.cards.get("vestica")!);
    const tagy = (id: string) => data.cards.get(id)?.tags ?? [];
    expect(stavNavyseVRuke(tagy, e, [[lezi(inst("milujuca_manzelka"), 0)], []], 1, 0)[0]?.krat).toBe(1);
    expect(stavNavyseVRuke(tagy, e, [[], []], 1, 0)[0]?.krat).toBe(0);
    const op = efektyNavyse(data.cards.get("opatrovatelka")!);
    expect(stavNavyseVRuke(tagy, op, [[lezi(inst("milujuca_manzelka"), 0)], []], 1, 0)[0]?.krat).toBe(0);
  });
});

describe("Podpora a Konflikt s tagom — pri každom stretnutí, do konca kola", () => {
  it("Podpora: Pamätník — priloženie k vlastnému Pamätníkovi pridá Robotu; k inej karte nie", () => {
    const op = inst("opatrovatelka");
    const man = lezi(inst("milujuca_manzelka"), 0);
    const po = apply(data, zhromazdenie("zastavka", [[man], []], [op]), { type: "place", uid: op.uid, target: "vlastna" }, 0).state;
    expect(po.strany[0].find((pl) => pl.card.uid === op.uid)?.navyse).toEqual([1]);
    expect(zdroj(po.strany, 0, op.uid)).toEqual([expect.objectContaining({ hodnota: 1 })]);
    const ina = apply(data, zhromazdenie("zastavka", [[lezi(inst("pijan"), 0)], []], [op]), { type: "place", uid: op.uid, target: "vlastna" }, 0).state;
    expect(ina.strany[0].find((pl) => pl.card.uid === op.uid)?.navyse).toBeUndefined();
  });

  it("aj keď sa k nej Pamätník priloží neskôr; dve stretnutia = ×2", () => {
    const op = lezi(inst("opatrovatelka"), 0, { navyse: [1] });
    const man = inst("milujuca_manzelka");
    const po = apply(data, zhromazdenie("zastavka", [[op], []], [man]), { type: "place", uid: man.uid, target: "vlastna" }, 0).state;
    expect(po.strany[0].find((pl) => pl.card.uid === op.card.uid)?.navyse).toEqual([2]);
    expect(zdroj(po.strany, 0, op.card.uid)).toEqual([expect.objectContaining({ hodnota: 2 })]);
  });

  it("Konflikt: Influencer — Podvodník pri súperovom Influencerovi; náhľad a bot (sPrilozenou) vidia to isté", () => {
    const pod = inst("podvodnik");
    const s = zhromazdenie("zastavka", [[lezi(inst("sarlatan"), 1)], []], [pod]);
    const po = apply(data, s, { type: "place", uid: pod.uid, target: "vlastna" }, 0).state;
    expect(po.strany[0].find((pl) => pl.card.uid === pod.uid)?.navyse).toEqual([1]);
    expect(sPrilozenou(data, s, 0, pod, 0).strany[0].find((pl) => pl.card.uid === pod.uid)?.navyse).toEqual([1]);
    // Bez Influencera nič.
    const bez = apply(data, zhromazdenie("zastavka", [[lezi(inst("pijan"), 1)], []], [pod]), { type: "place", uid: pod.uid, target: "vlastna" }, 0).state;
    expect(bez.strany[0].find((pl) => pl.card.uid === pod.uid)?.navyse).toBeUndefined();
  });

  it("Predavačka (Podpora bez tagu): pri vlastnej karte si majiteľ doberie 1 kartu", () => {
    const pr = inst("predavacka");
    const s = sHracom(zhromazdenie("zastavka", [[lezi(inst("pijan"), 0)], []], [pr]), 0, { doberaci: [inst("vandal")] });
    const po = apply(data, s, { type: "place", uid: pr.uid, target: "vlastna" }, 0).state;
    expect(po.hraci[0].ruka.map((k) => k.defId)).toEqual(["vandal"]);
    // K súperovej karte nič (Podpora je medzi vlastnými).
    const su = sHracom(zhromazdenie("zastavka", [[lezi(inst("pijan"), 1)], []], [pr]), 0, { doberaci: [inst("vandal")] });
    expect(apply(data, su, { type: "place", uid: pr.uid, target: "vlastna" }, 0).state.hraci[0].ruka).toEqual([]);
  });

  it("Hasič: Podpora namiesto Nástupu — k súperovej karte nič, k vlastnej voľba ako predtým", () => {
    const h = inst("hasic");
    const s = sHracom(zhromazdenie("zastavka", [[lezi(inst("pijan"), 1)], []], [h]), 0, { odhadzovaci: [inst("vandal")] });
    expect(apply(data, s, { type: "place", uid: h.uid, target: "vlastna" }, 0).state.hasicVolby ?? []).toEqual([]);
    const v = sHracom(zhromazdenie("zastavka", [[lezi(inst("pijan"), 0)], []], [h]), 0, { odhadzovaci: [inst("vandal")] });
    expect(apply(data, v, { type: "place", uid: h.uid, target: "vlastna" }, 0).state.hasicVolby).toHaveLength(1);
  });

  it("Hasič ako odpoveď na NA EX v Pitke: voľbu vidí stôl, ponúka legal, vyrieši ju bot a Pitka sa potom vyhodnotí", () => {
    // NA EX hráča 1 na Pijana hráča 2; hráč 2 odpovedá Hasičom vedľa neho (Podpora).
    const pijan = lezi(inst("pijan"), 1);
    const h = inst("hasic");
    const vandal = inst("vandal");
    let s = vPitke("jednota", [[], [pijan]]);
    s = sHracom(s, 1, { ruka: [h], odhadzovaci: [vandal], poldeciPlne: 1 });
    s = sHracom(s, 0, { poldeciPlne: 1 });
    const naex = naexOdkryte(data, s, pijan.card.uid, 0).state;
    expect(naex.pitkaStav?.reakcia).toBe(1);
    const odpoved = apply(data, naex, { type: "place", uid: h.uid, target: "vlastna" }, 1);
    expect(odpoved.state.hasicVolby?.[0]).toMatchObject({ hrac: 1, uid: vandal.uid, potom: "odpovede" });
    expect(odpoved.events.some((e) => e.type === "pitkaVysledok")).toBe(false);
    // Stôl: voľbu a vytiahnutú kartu vidia obaja (odhadzovací balíček je verejný), rozhoduje hráč 2.
    expect(viewFor(data, odpoved.state, 1).hasicVolba).toEqual({ hrac: 1, karta: vandal });
    expect(viewFor(data, odpoved.state, 0).hasicVolba).toEqual({ hrac: 1, karta: vandal });
    expect(legalCommands(data, odpoved.state, 1)).toEqual([
      { type: "hasic", nechat: true },
      { type: "hasic", nechat: false },
    ]);
    expect(() => apply(data, odpoved.state, { type: "skipNaex" }, 1)).toThrow("Hasič");
    const bot = tahBota(data, odpoved.state, 1, 3);
    expect(bot).toEqual({ type: "hasic", nechat: true });
    const po = apply(data, odpoved.state, bot, 1);
    expect(po.events.some((e) => e.type === "pitkaVysledok")).toBe(true);
    expect(po.state.hraci[1].ruka.map((k) => k.uid)).toContain(vandal.uid);
  });

  it("Vdova (Konflikt: Chlap): súper odhodí 1 náhodnú kartu z ruky — vyberie ju generátor partie (Michal 2026-11-08); pri Žene nič", () => {
    const vd = inst("velmi_smutiaca_vdova");
    const jehoRuka = [inst("vandal"), inst("masiar"), inst("hasic")];
    const s = sHracom(zhromazdenie("zastavka", [[lezi(inst("pijan"), 1)], []], [vd]), 1, { ruka: jehoRuka });
    const r = apply(data, s, { type: "place", uid: vd.uid, target: "vlastna" }, 0);
    const po = r.state;
    // Nikto nevyberá: hra nečaká na voľbu a hráč 0 hrá ďalej.
    expect(po.hasicVolby ?? []).toEqual([]);
    expect(legalCommands(data, po, 1).some((c) => (c.type as string) === "odhod")).toBe(false);
    expect(po.hraci[1].ruka).toHaveLength(2);
    const odhodena = po.hraci[1].odhadzovaci.find((k) => jehoRuka.some((x) => x.uid === k.uid));
    expect(odhodena).toBeDefined();
    // Deterministická náhoda: rovnaký stav a semienko = rovnaká karta.
    const znova = apply(data, s, { type: "place", uid: vd.uid, target: "vlastna" }, 0).state;
    expect(znova.hraci[1].odhadzovaci.map((k) => k.uid)).toEqual(po.hraci[1].odhadzovaci.map((k) => k.uid));
    // Iné semienko vyberie inú kartu aspoň niekedy — volí náhoda, nie poradie v ruke.
    const vybrane = new Set<number>();
    for (let seed = 1; seed <= 12; seed++) {
      const sx = { ...s, rng: setupGame(data, seed).rng };
      const px = apply(data, sx, { type: "place", uid: vd.uid, target: "vlastna" }, 0).state;
      for (const k of px.hraci[1].odhadzovaci) if (jehoRuka.some((x) => x.uid === k.uid)) vybrane.add(k.uid);
    }
    expect(vybrane.size).toBeGreaterThan(1);
    // Ktorú kartu stratil, vie len on: súper vidí v logu len počet.
    const pre0 = r.events.filter((e) => e.type === "log" && (e as { pre?: number }).pre !== 1).map((e) => (e as { text: string }).text).join(" ");
    expect(pre0).not.toContain(data.cards.get(odhodena!.defId)!.name);
    const zena = sHracom(zhromazdenie("zastavka", [[lezi(inst("snubenica"), 1)], []], [vd]), 1, { ruka: jehoRuka });
    expect(apply(data, zena, { type: "place", uid: vd.uid, target: "vlastna" }, 0).state.hraci[1].ruka).toHaveLength(3);
  });

  it("staré efekty platia len pre staré sady: Kočovník bez Furtu, Vdova so starým znením", () => {
    expect(efektyNavyse(stara.cards.get("kocovnik")!)).toEqual([]);
    const koc = inst("kocovnik");
    // Nový Kočovník: akcie majiteľovi, aj keď súper v kraji prevláda.
    const strany: GameState["strany"] = [[lezi(koc, 0), lezi(inst("pijan"), 1), lezi(inst("pijan"), 1)], []];
    const ev = evaluateLine(data, { lokalita: null, lokalitaOtocena: false, strany });
    expect(Object.values(ev.zdroje[1]).flat().some((z) => z?.uid === koc.uid)).toBe(false);
  });
});

describe("lokality bez Kšeftu", () => {
  it("Kšeft zanikol: príkaz kseft hra nepozná", () => {
    const s = vPitke("predsedova_vila");
    expect(legalCommands(data, s, 0).some((c) => (c.type as string) === "kseft")).toBe(false);
    expect(() => apply(data, s, { type: "kseft", uid: 1 } as unknown as Command, 0)).toThrow();
  });

  it("Zberný dvor: na konci Pitky najprv obranca, potom útočník smie spáliť 1 kartu z ruky, nie kliatbu", () => {
    let s = vPitke("zberny_dvor");
    s = apply(data, s, { type: "skipNaex" }, 0).state;
    s = apply(data, s, { type: "skipNaex" }, 1).state;
    while (s.vizia !== null) s = apply(data, s, { type: "vizia", vziat: true }, s.hasicVolby?.[0]?.hrac ?? (s.vizia.zostava[0] > 0 ? 0 : 1)).state;
    expect(s.hasicVolby?.map((v) => [v.hrac, v.typ])).toEqual([
      [0, "dvor"],
      [1, "dvor"],
    ]);
    const legal = legalCommands(data, s, 0);
    const cirhoza = s.hraci[0].ruka.find((k) => k.defId === "cirhoza")!;
    expect(legal).toContainEqual({ type: "spal", uid: null });
    expect(legal).not.toContainEqual({ type: "spal", uid: cirhoza.uid });
    const pijan = s.hraci[0].ruka.find((k) => k.defId === "pijan")!;
    const po = apply(data, s, { type: "spal", uid: pijan.uid }, 0);
    expect(po.state.hraci[0].ruka.some((k) => k.uid === pijan.uid)).toBe(false);
    expect(po.state.hraci[0].odhadzovaci.some((k) => k.uid === pijan.uid)).toBe(false);
    // Súper vidí len to, že hráč kartu spálil.
    expect(JSON.stringify(viewFor(data, po.state, 1))).not.toContain(`"uid":${pijan.uid}`);
    const koniec = apply(data, po.state, { type: "spal", uid: null }, 1).state;
    expect(koniec.hasicVolby ?? []).toEqual([]);
    expect(koniec.pitkaStav).toBeNull();
  });

  it("Predsedova vila: za každé 2 vyfajčené cigarety v Pitke reči o stupeň pri staršom, ktorého hráč vyberie", () => {
    let s = vPitke("predsedova_vila");
    s = apply(data, s, { type: "smoke" }, 0).state;
    expect(s.hasicVolby ?? []).toEqual([]);
    s = apply(data, s, { type: "smoke" }, 0).state;
    // 1 + 2 = 3 cigarety = 1 stupeň.
    expect(s.hasicVolby?.map((v) => v.typ)).toEqual(["vila"]);
    const e = s.starsi[0]!;
    const po = apply(data, s, { type: "vila", elderId: e.elderId }, 0).state;
    expect(po.starsi[0]!.reci[0]).toBeGreaterThan(e.reci[0]);
    expect(po.hasicVolby ?? []).toEqual([]);
  });

  it("Sklad: v Zhromaždení Nástroj zo šenku rovno do Dedičstva za cenu Dedičstva; do šenku príde nový", () => {
    const vidly = inst("vidly");
    const dalsi = inst("furik");
    const s0 = zhromazdenie("sklad", [[], []], [inst("pijan")]);
    const s = { ...s0, senok: [inst("pijan"), vidly], naradie: [dalsi, ...s0.naradie] };
    const cmd: Command = { type: "place", uid: vidly.uid, target: "dedicstvo" };
    expect(legalCommands(data, s, 0)).toContainEqual(cmd);
    const cena = cenaDedicstva(s);
    const po = apply(data, s, cmd, 0).state;
    expect(po.hraci[0].dedicstvo.map((k) => k.uid)).toContain(vidly.uid);
    expect(po.hraci[0].cigarety).toBe(6 - cena);
    expect(po.senok.map((k) => k.uid)).toEqual([s.senok[0]!.uid, dalsi.uid]);
    expect(cenaDedicstva(po)).toBe(cena + 1);
    // Občana zo šenku nie; na inej lokalite nie.
    expect(() => apply(data, s, { type: "place", uid: s.senok[0]!.uid, target: "dedicstvo" }, 0)).toThrow();
    const inde = { ...zhromazdenie("zastavka", [[], []], []), senok: [vidly] };
    expect(legalCommands(data, inde, 0)).not.toContainEqual(cmd);
  });
});

describe("viewFor — akcie navyše neprezradia skrytú kartu", () => {
  it("súperova skrytá Záverečná s tagom: klient aj server rátajú Nepriateľa rovnako (nesplnený)", () => {
    const pol = inst("policajtka");
    const s0 = vPitke("zastavka", [[lezi(inst("podvodnik"), 1, { zaverecna: true })], [lezi(pol, 0)]]);
    const server = evaluateLine(data, lineState(s0)).cards.get(pol.uid)?.navyse;
    const v = viewFor(data, s0, 0);
    const klient = evaluateLine(data, lineState({ ...s0, strany: v.strany })).cards.get(pol.uid)?.navyse;
    expect(server?.[0]?.krat).toBe(0);
    expect(klient).toEqual(server);
    expect(JSON.stringify(v)).not.toContain('"podvodnik"');
  });
});

describe("partia botov so sadou frakcií", () => {
  it("dobehne do konca — voľby Vdovy, Zberného dvora a vily bot vyrieši", () => {
    for (const seed of [3, 11]) {
      let s = setupGame(data, seed, { lokalit: 5 });
      for (let n = 0; n < 20000 && s.koniec === null; n++) {
        const p = ([0, 1] as const).find((q) => legalCommands(data, s, q).length > 0 && (s.hasicVolby?.[0]?.hrac ?? q) === q) ?? null;
        if (p === null) break;
        s = apply(data, s, tahBota(data, s, p, n * 7919 + seed), p).state;
      }
      expect(s.koniec, `seed ${seed}`).not.toBeNull();
    }
  }, 120_000);
});
