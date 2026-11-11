// Rework Náradia (Michal 2026-11-08, docs/napady/naradie-hrany-zoznam.html v5, PRAVIDLA §12):
// Nástroj sa do línie nevykladá — podkladá sa pod Občana či Starešinu za cigaretu, pretŕča jedna
// z dvoch hrán. Akciová hrana preškolí akcie hostiteľa pred spojmi, kartová mu dá Vzburu, Forsáž,
// NA EX či Výtržníka tou istou cestou ako inak. Po bitke ide Nástroj majiteľovi Nástroja.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import scenarJson from "../data/vyucba/prva-hra.json";
import zoznam from "./data/naradie-hrany.json";
import type { CardDef, CardInstance, Command, GameData, GameState, LineState, PlacedCard, PlayerId, PodlozenyNastroj, ScenarVyucby } from "../src/index.ts";
import {
  NASTROJ_DO_LINIE,
  apply,
  chybyHran,
  evaluateLine,
  hranySlovami,
  hranyNastroja,
  popisPodlozenych,
  legalCommands,
  loadGameData,
  naexCieleVLinii,
  ponukaPodlozenia,
  prehrajVyucbu,
  rozborHran,
  rozborNavyse,
  rozborPreskolenia,
  setupGame,
  tahBota,
  textBezHran,
  viewFor,
} from "../src/index.ts";
import { EMPTY, instanceFor, makeDef, syntheticData } from "./helpers.ts";
import type { Layout4 } from "./helpers.ts";
import { dataSHranami } from "./naradieData.ts";

const dataH = dataSHranami();

describe("zápis hrán v texte efektu", () => {
  it("Hore a Dole: preškolenie {X}→{Y} alebo účinok; Dedičstvo a akcie navyše ostávajú", () => {
    const r = rozborHran("Dedičstvo: Tvoje Rany udeľujú o 1 poškodenie viac. Hore: Vzbura. Dole: {Rana}→{Pecka}.");
    expect(r).toEqual({ horna: { druh: "karta", ucinok: "Vzbura" }, dolna: { druh: "akcia", z: "Rana", na: "Pecka" }, chyby: [] });
    // Hazard je Dlh, Pečeň Poškodenie pečene; šípka aj „->“; NA EX bez ohľadu na veľkosť písmen.
    expect(rozborHran("Hore: {Hazard} -> {Pečeň}. Dole: na ex.")).toMatchObject({ horna: { z: "Dlh", na: "PoškodeniePečene" }, dolna: { ucinok: "NA EX" } });
    // Pasca: efekt Dedičstva s piktogramom navyše a hrany s piktogramami sa nepomýlia.
    const pasca = "Dedičstvo: Bitka: Ak súper v tomto kole priložil kartu k tvojej {Rana}. Hore: {Pečeň}→{Rana}. Dole: {Pecka}→{Rana}.";
    expect(rozborNavyse(pasca)).toEqual({ efekty: [{ spustac: "Bitka", tag: null, akcie: ["Rana"], podmienka: "Ak súper v tomto kole priložil kartu k tvojej", dedicstvo: true }], chyby: [] });
    expect(textBezHran(pasca)).toBe("Dedičstvo: Bitka: Ak súper v tomto kole priložil kartu k tvojej {Rana}.");
    expect(hranySlovami("Hore: {Hazard}→{Robota}. Dole: Forsáž.")).toBe("Hore: Hazard → Robota. Dole: Forsáž.");
  });

  it("hrana posilnenia „Posilnená {X}“ (Puška, Michal 2026-11-09): tvar podľa rodu, preklep je chyba", () => {
    const puska = "Dedičstvo: Keď by tvoju prepojenú Petelicu zrušil iný efekt (Odpor, NA EX…), namiesto zrušenia udeľuje o 1 poškodenie menej. Hore: Posilnená {Petelica}. Dole: Posilnená {Pecka}.";
    expect(rozborHran(puska)).toEqual({ horna: { druh: "posilnenie", akcia: "Petelica" }, dolna: { druh: "posilnenie", akcia: "Pecka" }, chyby: [] });
    expect(rozborHran("Hore: Posilnený {Hazard}. Dole: Posilnené {Obmedzenie}.")).toMatchObject({ horna: { akcia: "Dlh" }, dolna: { akcia: "Obmedzenie" } });
    expect(chybyHran({ effectText: "Hore: Posilnená {Petelicka}. Dole: Vzbura.", tags: ["Nástroj"] })[0]).toMatch(/Petelicka/);
    expect(chybyHran({ effectText: puska, tags: ["Nástroj"] })).toEqual([]);
    // Dedičstvo s piktogramom nie je akcia navyše; hrany slovami pre text bez rámu.
    expect(rozborNavyse(puska)).toEqual({ efekty: [], chyby: [] });
    expect(hranySlovami("Hore: Posilnená {Petelica}. Dole: Posilnený {Hazard}.")).toBe("Hore: Posilnená Petelica. Dole: Posilnený Hazard.");
  });

  it("preškolenie {X}→{Y} je spoločná funkcia — nie len pre Nástroj", () => {
    expect(rozborPreskolenia("{Robota}→{Pecka}")).toEqual({ preskolenie: { z: "Robota", na: "Pecka" }, chyby: [] });
    expect(rozborPreskolenia("{Rana}→{Rana}")?.preskolenie).toBeNull();
    expect(rozborPreskolenia("Vzbura")).toBeNull();
  });

  it("chyby zápisu: neznáma akcia či účinok, hrana dvakrát, hrany mimo Nástroja, chýbajúca hrana", () => {
    const nastroj = (effectText: string): Pick<CardDef, "effectText" | "tags"> => ({ effectText, tags: ["Nástroj"] });
    expect(chybyHran(nastroj("Hore: {Ranka}→{Pecka}. Dole: Vzbura."))[0]).toMatch(/Ranka/);
    expect(chybyHran(nastroj("Hore: Vzburka. Dole: Vzbura."))[0]).toMatch(/Forsáž, NA EX, Výtržník, Vzbura/);
    expect(chybyHran(nastroj("Hore: Vzbura. Hore: Forsáž. Dole: Vzbura."))[0]).toMatch(/dvakrát/);
    expect(chybyHran(nastroj("Hore: Vzbura."))).toEqual([expect.stringMatching(/chýba dolná hrana/)]);
    expect(chybyHran(nastroj("Dedičstvo: Tvoj prah Cirhózy je o 2 vyšší."))).toHaveLength(2);
    expect(chybyHran({ effectText: "Furt: Nič. Hore: Vzbura. Dole: Forsáž.", tags: ["Občan"] })).toEqual(["Hrany „Hore:“ a „Dole:“ má len Nástroj."]);
    // Preklep padne pri načítaní sady; Nástroj bez hrán načítanie prejde (nemožno ho len podložiť).
    const sTextom = (text: (t: string) => string) => ({ ...cardsJson, cards: cardsJson.cards.map((c) => (c.id === "vidly" ? { ...c, effect_text: text(c.effect_text) } : c)) });
    expect(() => loadGameData(sTextom((t) => `${textBezHran(t)} Hore: Vzbura. Dole: {Rana}→{Pecky}.`), eldersJson, scorecardsJson)).toThrow(/Pecky/);
    expect(() => loadGameData(sTextom(textBezHran), eldersJson, scorecardsJson)).not.toThrow();
    expect(() => loadGameData(cardsJson, eldersJson, scorecardsJson)).not.toThrow();
  });
});

describe("zoznam hrán pre admina (packages/core/test/data/naradie-hrany.json)", () => {
  const nastroje = cardsJson.cards.filter((c) => c.tags.includes("Nástroj"));

  it("22 Nástrojov zo sady, každý s oboma hranami bez chyby a s textom zo sady", () => {
    expect(zoznam.nastroje.map((n) => n.id).sort()).toEqual(nastroje.map((c) => c.id).sort());
    for (const n of zoznam.nastroje) {
      expect(chybyHran({ effectText: n.effect_text, tags: ["Nástroj"] }), n.id).toEqual([]);
      expect(rozborHran(n.effect_text), n.id).toMatchObject({ horna: expect.anything(), dolna: expect.anything() });
      expect(n.effect_text, n.id).toBe(nastroje.find((c) => c.id === n.id)?.effect_text);
    }
  });

  it("štyri kartové účinky (P1), hrany posilnenia (Puška 2026-11-09; Pasca, Fúrik, Horoskop, Izolačka v11.17) a každé preškolenie X → Y v sade raz", () => {
    const ucinky = zoznam.nastroje.flatMap((n) => {
      const h = hranyNastroja({ effectText: n.effect_text, tags: ["Nástroj"] });
      return [h?.horna, h?.dolna].flatMap((x) => (x?.druh === "karta" ? [`${n.id}:${x.ucinok}`] : []));
    });
    expect(ucinky.sort()).toEqual(["energetak:Forsáž", "lievik:Výtržník", "vidly:Vzbura", "vinko:NA EX"]);
    const posilnenia = zoznam.nastroje.flatMap((n) => {
      const h = hranyNastroja({ effectText: n.effect_text, tags: ["Nástroj"] });
      return [h?.horna, h?.dolna].flatMap((x) => (x?.druh === "posilnenie" ? [`${n.id}:${x.akcia}`] : []));
    });
    expect(posilnenia.sort()).toEqual(["furik:Robota", "horoskop:Povera", "pasca:Rana", "pistalka:Obmedzenie", "puska:Pecka", "puska:Petelica"]);
    const dvojice = zoznam.nastroje.flatMap((n) => {
      const h = hranyNastroja({ effectText: n.effect_text, tags: ["Nástroj"] });
      return [h?.horna, h?.dolna].flatMap((x) => (x?.druh === "akcia" ? [`${x.z}>${x.na}`] : []));
    });
    expect(dvojice).toHaveLength(34);
    expect(new Set(dvojice).size).toBe(34);
  });

  it("keď cards.json hrany už má, sedia so zoznamom (pravidlo 5: prepisuje ich admin v tvorcovi)", () => {
    for (const c of nastroje) {
      const h = hranyNastroja({ effectText: c.effect_text, tags: ["Nástroj"] });
      if (h === null) continue;
      const n = zoznam.nastroje.find((x) => x.id === c.id);
      expect(h, c.id).toEqual(hranyNastroja({ effectText: n?.effect_text ?? "", tags: ["Nástroj"] }));
    }
  });
});

// --- Vyhodnotenie línie: syntetické karty --------------------------------------

const H_L: Layout4 = ["Odpor", "Rana", null, "Rana"];
const H_R: Layout4 = ["Viera", null, "Posilnenie", null];
const nastrojDef = (id: string, hore: string, dole: string): CardDef => makeDef(id, EMPTY, EMPTY, { tags: ["Nástroj"], effectText: `Hore: ${hore}. Dole: ${dole}.` });
const sd: GameData = syntheticData([
  makeDef("host", H_L, H_R),
  makeDef("sused_odpor", EMPTY, ["Odpor", "Pecka", null, "Viera"]),
  makeDef("sused_rana", EMPTY, ["Rana", "Pecka", null, "Viera"]),
  makeDef("sused_posil", EMPTY, ["Rana", "Pecka", "Posilnenie", null]),
  makeDef("lavy_posil", [null, null, "Posilnenie", null], EMPTY),
  nastrojDef("puska", "{Rana}→{Petelica}", "{Petelica}→{Rana}"),
  nastrojDef("hrable", "{Odpor}→{Posilnenie}", "{Posilnenie}→{Odpor}"),
  nastrojDef("vidly", "Vzbura", "{Rana}→{Pecka}"),
  nastrojDef("energetak", "Forsáž", "{Posilnenie}→{Pečeň}"),
  nastrojDef("vinko", "NA EX", "{Pečeň}→{Poldeci}"),
  nastrojDef("lievik", "Výtržník", "{Poldeci}→{Pečeň}"),
  makeDef("zamocnik", H_L, H_R),
  makeDef("strelec", ["Petelica", "Pecka", null, "Rana"], ["Pecka", null, "Posilnenie", null]),
  nastrojDef("puska_posil", "Posilnená {Petelica}", "Posilnená {Pecka}"),
  nastrojDef("boxer", "{Pecka}→{Petelica}", "{Petelica}→{Pecka}"),
]);
const host = instanceFor(sd, "host", H_L, H_R);
const kartaS = (id: string, right: Layout4): CardInstance => instanceFor(sd, id, EMPTY, right);
const nastroj = (id: string): CardInstance => instanceFor(sd, id, EMPTY, EMPTY);
/** Hráč 0: hostiteľ pri lokalite (null), sused za ním — ľavá hrana hostiteľa proti pravej susedovej. */
const linia = (hostitel: PlacedCard, sused: CardInstance): LineState => ({ lokalita: null, lokalitaOtocena: false, strany: [[hostitel, { card: sused, playedBy: 0 }], []] });
const pod = (id: string, hrana: "horna" | "dolna" = "horna", majitel: PlayerId = 1): readonly PodlozenyNastroj[] => [{ card: nastroj(id), majitel, hrana }];

describe("preškolenie akciovou hranou", () => {
  it("mení všetky výskyty na oboch hranách hostiteľa ešte pred spojmi; slot nesie vytlačenú akciu", () => {
    const sused = kartaS("sused_rana", ["Rana", "Pecka", null, "Viera"]);
    const bez = evaluateLine(sd, linia({ card: host, playedBy: 0 }, sused));
    const s = evaluateLine(sd, linia({ card: host, playedBy: 0, podlozene: pod("puska") }, sused));
    // Rany na indexe 1 (proti Pecke) aj 3 (proti Viere) sú Petelice; Ranu suseda ruší Odpor hostiteľa.
    expect(bez.sums[0]).toEqual({ Rana: 2, Pecka: 1, Viera: 1 });
    expect(s.sums[0]).toEqual({ Petelica: 2, Pecka: 1, Viera: 1 });
    const left = s.cards.get(host.uid)?.left;
    expect(left?.[1]).toMatchObject({ action: "Petelica", povodna: "Rana", stav: "aktivna" });
    expect(left?.[3]).toMatchObject({ action: "Petelica", povodna: "Rana" });
    expect(left?.[0]).not.toHaveProperty("povodna");
  });

  it("preškolený Odpor na Posilnenie súsedovu akciu zdvojí namiesto zrušenia (Hrable)", () => {
    const sused = kartaS("sused_rana", ["Rana", "Pecka", null, "Viera"]);
    expect(evaluateLine(sd, linia({ card: host, playedBy: 0 }, sused)).sums[0].Rana).toBe(2);
    // Odpor hostiteľa proti Rane suseda: zrušená; z Posilnenia je Rana ×2 (+ Rana hostiteľa na indexe 3).
    expect(evaluateLine(sd, linia({ card: host, playedBy: 0, podlozene: pod("hrable") }, sused)).sums[0].Rana).toBe(4);
  });

  // v11.20 reťaz (Michal 2026-11-10): Vidly idú po Puške a Ranu, z ktorej je už Petelica, nenájdu.
  it("pod Zámočníkom pracuje druhý Nástroj na výstupe prvého — Vidly Ranu po Puške nenájdu", () => {
    const zam = instanceFor(sd, "zamocnik", H_L, H_R);
    const sused = kartaS("sused_rana", ["Rana", "Pecka", null, "Viera"]);
    const dva: PlacedCard = { card: zam, playedBy: 0, podlozene: [...pod("puska"), ...pod("vidly", "dolna")] };
    expect(evaluateLine(sd, linia(dva, sused)).cards.get(zam.uid)?.left[1]).toMatchObject({ action: "Petelica", povodna: "Rana" });
  });
});

describe("hrana posilnenia (Puška, Michal 2026-11-09)", () => {
  const S_L: Layout4 = ["Petelica", "Pecka", null, "Rana"];
  const S_R: Layout4 = ["Pecka", null, "Posilnenie", null];
  const strelec = instanceFor(sd, "strelec", S_L, S_R);
  const sused = (): CardInstance => kartaS("sused_rana", ["Rana", "Pecka", null, "Viera"]);

  it("hore posilní aktívne Petelice hostiteľa ×2, dole Pecky; iné akcie ani suseda nemení", () => {
    const bez = evaluateLine(sd, linia({ card: strelec, playedBy: 0 }, sused()));
    expect(bez.sums[0]).toEqual({ Petelica: 1, Pecka: 2, Rana: 2, Viera: 1 });
    const hore = evaluateLine(sd, linia({ card: strelec, playedBy: 0, podlozene: pod("puska_posil", "horna") }, sused()));
    expect(hore.sums[0]).toEqual({ Petelica: 2, Pecka: 2, Rana: 2, Viera: 1 });
    expect(hore.cards.get(strelec.uid)?.left[0]).toMatchObject({ action: "Petelica", stav: "aktivna", nasobok: 2 });
    expect(hore.cards.get(strelec.uid)?.forsaz).toBe(false);
    expect(hore.zdroje[0].Petelica?.[0]?.dovody).toEqual(["karta:puska_posil"]);
    const dole = evaluateLine(sd, linia({ card: strelec, playedBy: 0, podlozene: pod("puska_posil", "dolna") }, sused()));
    // Pecka hostiteľa na spoji ×2, Pecka suseda ×1; Pecka na voľnej pravej hrane ostáva neaktívna.
    expect(dole.sums[0]).toEqual({ Petelica: 1, Pecka: 3, Rana: 2, Viera: 1 });
    expect(dole.cards.get(strelec.uid)?.right[0]).toMatchObject({ action: "Pecka", stav: "neaktivna", nasobok: 0 });
  });

  it("násobí sa s Forsážou (×4); NA EX hostiteľa aktívne zruší a neaktívne aktivuje ×2, posilnené potom ×4 (v11.21)", () => {
    const lavy = instanceFor(sd, "lavy_posil", [null, null, "Posilnenie", null], EMPTY);
    const sForsazou = (podlozene: readonly PodlozenyNastroj[], naexBy?: PlayerId): LineState => ({
      lokalita: null,
      lokalitaOtocena: false,
      strany: [[{ card: lavy, playedBy: 0 }, { card: strelec, playedBy: 0, podlozene, ...(naexBy === undefined ? {} : { naexBy }) }, { card: sused(), playedBy: 0 }], []],
    });
    expect(evaluateLine(sd, sForsazou([])).cards.get(strelec.uid)?.left[0]?.nasobok).toBe(2);
    const f = evaluateLine(sd, sForsazou(pod("puska_posil", "horna"))).cards.get(strelec.uid);
    expect(f?.left[0]?.nasobok).toBe(4);
    expect(f?.left[1]?.nasobok).toBe(2);
    // Posilnenie strelca na spoji s ľavým (bez neho by neaktívne Posilnenie NA EX podržalo, v11.17).
    const naex = evaluateLine(sd, sForsazou(pod("puska_posil", "dolna"), 1));
    expect(naex.cards.get(strelec.uid)?.left[1]).toMatchObject({ action: "Pecka", stav: "zrusena" });
    expect(naex.cards.get(strelec.uid)?.right[0]).toMatchObject({ action: "Pecka", stav: "aktivna", nasobok: 4 });
  });

  it("posilní akciu po preškolení: Rana → Petelica áno, Petelica → Pecka už nie", () => {
    const zam = instanceFor(sd, "zamocnik", H_L, H_R);
    const sRanou = kartaS("sused_rana", ["Rana", "Pecka", null, "Viera"]);
    // Zámočník: Rany na indexe 1 a 3 aktívne (Rana suseda na indexe 0 zrušil Odpor hostiteľa).
    const preskolene = evaluateLine(sd, linia({ card: zam, playedBy: 0, podlozene: [...pod("puska_posil", "horna"), ...pod("puska")] }, sRanou));
    expect(preskolene.sums[0].Petelica).toBe(4);
    expect(preskolene.cards.get(zam.uid)?.left[1]).toMatchObject({ action: "Petelica", povodna: "Rana", nasobok: 2 });
    const zrusene = evaluateLine(sd, linia({ card: strelec, playedBy: 0, podlozene: [...pod("boxer", "dolna"), ...pod("puska_posil", "horna")] }, sused()));
    expect(zrusene.sums[0].Petelica).toBeUndefined();
    expect(zrusene.sums[0].Pecka).toBe(3);
  });
});

describe("kartové účinky — presne ako dnešnou cestou", () => {
  it("Vzbura z Vidiel = Vzbura zo spoja (Odpor proti Odporu); so spojovou sa karta obráti raz", () => {
    const zoSpoja = evaluateLine(sd, linia({ card: host, playedBy: 0 }, kartaS("sused_odpor", ["Odpor", "Pecka", null, "Viera"])));
    const zVidiel = evaluateLine(sd, linia({ card: host, playedBy: 0, podlozene: pod("vidly") }, kartaS("sused_rana", ["Rana", "Pecka", null, "Viera"])));
    expect(zoSpoja.cards.get(host.uid)?.vzbura).toBe(true);
    expect(zVidiel.cards.get(host.uid)).toEqual({ ...zoSpoja.cards.get(host.uid), uid: host.uid });
    const oboje = evaluateLine(sd, linia({ card: host, playedBy: 0, podlozene: pod("vidly") }, kartaS("sused_odpor", ["Odpor", "Pecka", null, "Viera"])));
    expect(oboje.cards.get(host.uid)).toEqual(zoSpoja.cards.get(host.uid));
  });

  it("Forsáž z Energeťáka: aktívne ×2, so spojovou Forsážou ×4; NA EX ju nezruší, akcie aktívne po NA EX ×4 (v11.21)", () => {
    const sused = kartaS("sused_rana", ["Rana", "Pecka", null, "Viera"]);
    // Obe aktívne Rany hostiteľa ×2; akcie suseda nie.
    expect(evaluateLine(sd, linia({ card: host, playedBy: 0, podlozene: pod("energetak") }, sused)).sums[0]).toEqual({ Rana: 4, Pecka: 1, Viera: 1 });
    // Pri lokalite (bližšie) karta s Posilnením proti Posilneniu na pravej hrane hostiteľa: spojová Forsáž; s Energeťákom ×4.
    const lavy = instanceFor(sd, "lavy_posil", [null, null, "Posilnenie", null], EMPTY);
    const sForsazou = (podlozene: readonly PodlozenyNastroj[]): LineState => ({ lokalita: null, lokalitaOtocena: false, strany: [[{ card: lavy, playedBy: 0 }, { card: host, playedBy: 0, podlozene }, { card: sused, playedBy: 0 }], []] });
    expect(evaluateLine(sd, sForsazou([])).cards.get(host.uid)?.left[1]?.nasobok).toBe(2);
    expect(evaluateLine(sd, sForsazou(pod("energetak"))).cards.get(host.uid)?.left[1]?.nasobok).toBe(4);
    // Posilnenie hostiteľa na spoji s ľavým — neaktívne by NA EX podržalo (v11.17).
    const sNaex = evaluateLine(sd, { ...sForsazou(pod("energetak")), strany: [[{ card: lavy, playedBy: 0 }, { card: host, playedBy: 0, naexBy: 1, podlozene: pod("energetak") }, { card: sused, playedBy: 0 }], []] });
    expect(sNaex.cards.get(host.uid)?.left[1]).toMatchObject({ stav: "zrusena" });
    expect(sNaex.cards.get(host.uid)?.right[0]).toMatchObject({ action: "Viera", stav: "aktivna", nasobok: 4 });
    expect(sNaex.cards.get(host.uid)?.forsaz).toBe(true);
  });

  it("NA EX z Vínka = NA EX s poldecom; skutočné NA EX ani na kartu so Vzburou či Výtržníkom nejde", () => {
    const sused = kartaS("sused_rana", ["Rana", "Pecka", null, "Viera"]);
    const sPoldecom = evaluateLine(sd, linia({ card: host, playedBy: 0, naexBy: 1 }, sused));
    const zVinka = evaluateLine(sd, linia({ card: host, playedBy: 0, podlozene: pod("vinko") }, sused));
    expect(zVinka.cards.get(host.uid)).toEqual(sPoldecom.cards.get(host.uid));
    expect(zVinka.sums).toEqual(sPoldecom.sums);
    const lok = makeDef("lok", ["Viera", "Viera", "Viera", "Viera"], ["Viera", "Viera", "Viera", "Viera"], { tags: ["Lokalita"] });
    // Hostiteľ bez Odporu na voľnej hrane — nespárovaný Odpor NA EX zahasí a cieľom by nebol (v11.17).
    const R3: Layout4 = ["Rana", "Rana", null, "Rana"];
    const sl = syntheticData([...sd.cards.values(), lok, makeDef("host_ciel", R3, H_R)]);
    const lokalita = instanceFor(sl, "lok", ["Viera", "Viera", "Viera", "Viera"], ["Viera", "Viera", "Viera", "Viera"]);
    const hc = instanceFor(sl, "host_ciel", R3, H_R);
    const ciele = (pl: PlacedCard): number[] => naexCieleVLinii(sl, { lokalita, lokalitaOtocena: false, strany: [[pl], []] }, 1);
    expect(ciele({ card: host, playedBy: 0 })).toEqual([]);
    expect(ciele({ card: hc, playedBy: 0 })).toEqual([hc.uid]);
    expect(ciele({ card: hc, playedBy: 0, podlozene: pod("vinko") })).toEqual([]);
    expect(ciele({ card: hc, playedBy: 0, podlozene: pod("lievik") })).toEqual([]);
    expect(ciele({ card: hc, playedBy: 0, podlozene: pod("vidly") })).toEqual([]);
  });

  it("Výtržník z Injekcie = Výtržník zo zrážky NA EX", () => {
    const sused = kartaS("sused_posil", ["Rana", "Pecka", "Posilnenie", null]);
    const zoZrazky = evaluateLine(sd, linia({ card: host, playedBy: 0, naexBy: 0, naexBy2: 1, vytrznik: true }, sused));
    const zInjekcie = evaluateLine(sd, linia({ card: host, playedBy: 0, podlozene: pod("lievik") }, sused));
    expect(zInjekcie.cards.get(host.uid)).toEqual(zoZrazky.cards.get(host.uid));
    expect(zInjekcie.sums).toEqual(zoZrazky.sums);
  });
});

// --- Podloženie v hre (sada s hranami) ----------------------------------------

let uidSeq = 880000;
const inst = (defId: string): CardInstance => ({ uid: ++uidSeq, defId, leftLayout: 0, rightLayout: 0 });

/** Zhromaždenie na Zastávke, hráč 0 na ťahu s rukou `ruka`. */
function vZhromazdeni(strany: GameState["strany"], ruka: CardInstance[], cigarety = 5): GameState {
  const s0 = setupGame(dataH, 7);
  const lokalita = s0.lokalityVHre.find((k) => k.defId === "zastavka")!;
  const hraci = s0.hraci.map((h, i) => ({ ...h, cigarety, poldeciPlne: 2, doberaci: [inst("masiar"), inst("pijan")], ...(i === 0 ? { ruka } : {}) })) as unknown as GameState["hraci"];
  return {
    ...s0,
    hraci,
    faza: "zhromazdenie",
    utocnik: 0,
    ciel: { typ: "lokalita", lokalita },
    lokalityVHre: s0.lokalityVHre.filter((k) => k !== lokalita),
    strany,
    pitkaStav: null,
    pitkaCislo: 0,
    zhromazdenieStav: { naTahu: 0, zostavaLimit: [3, 3], pasoval: [false, false], navyse: [0, 0] },
  };
}
const lezi = (card: CardInstance, playedBy: PlayerId, ine: Partial<PlacedCard> = {}): PlacedCard => ({ card, playedBy, ...ine });

describe("ťah podloženia (§12)", () => {
  it("pod vlastnú kartu za 1 cigaretu: ťah v striedaní, limit nemíňa, Nástroj je verejný (v11.16 len pod vlastné)", () => {
    const vidly = inst("vidly");
    const jeho = inst("pijan");
    const s = vZhromazdeni([[lezi(jeho, 0)], []], [vidly, inst("masiar")]);
    const cmd: Command = { type: "podloz", nastrojId: vidly.uid, hostitelId: jeho.uid, hrana: "horna" };
    expect(legalCommands(dataH, s, 0)).toContainEqual(cmd);
    const po = apply(dataH, s, cmd, 0).state;
    expect(po.strany[0][0]?.podlozene).toEqual([{ card: vidly, majitel: 0, hrana: "horna" }]);
    expect(po.hraci[0].cigarety).toBe(4);
    expect(po.hraci[0].ruka.map((k) => k.uid)).not.toContain(vidly.uid);
    expect(po.zhromazdenieStav?.zostavaLimit[0]).toBe(3);
    expect(po.zhromazdenieStav?.naTahu).toBe(1);
    // viewFor: obaja vidia Nástroj aj hranu; v súperovej ruke pritom nič nepribudlo.
    for (const p of [0, 1] as const) expect(viewFor(dataH, po, p).strany[0][0]?.podlozene).toEqual([{ card: vidly, majitel: 0, hrana: "horna" }]);
    expect(JSON.stringify(viewFor(dataH, s, 1))).not.toContain(`"uid":${vidly.uid}`);
  });

  it("do línie ani do odpovede Nástroj nejde; bez cigarety ani bez hrán sa nepodkladá", () => {
    const vidly = inst("vidly");
    const moj = inst("pijan");
    const s = vZhromazdeni([[lezi(moj, 0)], []], [vidly]);
    expect(() => apply(dataH, s, { type: "place", uid: vidly.uid, target: "vlastna" }, 0)).toThrow(NASTROJ_DO_LINIE);
    expect(() => apply(dataH, vZhromazdeni([[lezi(moj, 0)], []], [vidly], 0), { type: "podloz", nastrojId: vidly.uid, hostitelId: moj.uid, hrana: "horna" }, 0)).toThrow(/cigaret/);
    const bezHran = { ...cardsJson, cards: cardsJson.cards.map((c) => (c.id === "vidly" ? { ...c, effect_text: textBezHran(c.effect_text) } : c)) };
    expect(() => apply(loadGameData(bezHran, eldersJson, scorecardsJson), s, { type: "podloz", nastrojId: vidly.uid, hostitelId: moj.uid, hrana: "horna" }, 0)).toThrow(/nemá v sade hrany/);
  });

  it("len pod Občana a Starešinu, pod Zviera len s Kôňom; jeden Nástroj na kartu, pod Zámočníka viac", () => {
    const vidly = inst("vidly");
    const pes = inst("pes");
    const line = (strany: LineState["strany"]): LineState => ({ lokalita: null, lokalitaOtocena: false, strany });
    expect(ponukaPodlozenia(dataH, line([[lezi(pes, 0)], []]), vidly, 0)).toEqual([]);
    expect(ponukaPodlozenia(dataH, line([[lezi(pes, 0), lezi(inst("kon"), 1)], []]), vidly, 0).map((m) => m.hostitel)).toContain(pes.uid);
    const pijan = inst("pijan");
    const obsadeny = lezi(pijan, 1, { podlozene: [{ card: inst("puska"), majitel: 1, hrana: "horna" }] });
    expect(ponukaPodlozenia(dataH, line([[obsadeny], []]), vidly, 1)).toEqual([]);
    const zam = inst("zamocnik");
    const zamObsadeny = lezi(zam, 1, { podlozene: [{ card: inst("puska"), majitel: 1, hrana: "horna" }] });
    expect(ponukaPodlozenia(dataH, line([[zamObsadeny], []]), vidly, 1).map((m) => m.hostitel)).toEqual([zam.uid, zam.uid]);
    // Karta lícom dole: tagy nevidno, nepodkladá sa.
    expect(ponukaPodlozenia(dataH, line([[lezi(inst("pijan"), 1, { zaverecna: true })], []]), vidly, 1)).toEqual([]);
  });

  it("Vínko nie pod kartu s poldecom; hrana bez zdrojovej akcie je dovolená, ale ponuka ju označí", () => {
    const vinko = inst("vinko");
    const pijan = inst("pijan");
    const line = (pl: PlacedCard): LineState => ({ lokalita: null, lokalitaOtocena: false, strany: [[pl], []] });
    expect(ponukaPodlozenia(dataH, line(lezi(pijan, 0, { naexBy: 1 })), vinko, 0).map((m) => m.hrana)).not.toContain("horna");
    const puska = inst("puska");
    const masiar = inst("masiar");
    const ponuka = ponukaPodlozenia(dataH, line(lezi(masiar, 0)), puska, 0);
    expect(ponuka).toHaveLength(2);
    for (const m of ponuka) expect(m.maCoRobit).toBe(!m.popis.startsWith("nemá"));
    // Puška: Mäsiar nemá Petelicu, má dve Pecky.
    expect(ponuka.map((m) => m.popis)).toEqual(["nemá Petelica", "Posilnená Pecka (2×)"]);
    expect(popisPodlozenych(dataH, lezi(masiar, 0, { podlozene: [{ card: puska, majitel: 0, hrana: "dolna" }] }))).toEqual(["Puška (Posilnená Pecka)"]);
  });
});

describe("návrat Nástroja a hra s podkladaním", () => {
  it("Poľovník spáli Zviera s Nástrojom — Nástroj ide hneď majiteľovi Nástroja", () => {
    const pes = inst("pes");
    const puska = inst("puska");
    const polovnik = inst("polovnik");
    const s = vZhromazdeni([[], [lezi(pes, 1, { podlozene: [{ card: puska, majitel: 0, hrana: "horna" }] })]], [polovnik]);
    const po = apply(dataH, s, { type: "place", uid: polovnik.uid, target: "vlastna" }, 0).state;
    expect(po.strany[1]).toEqual([]);
    expect(po.hraci[0].odhadzovaci.map((k) => k.uid)).toContain(puska.uid);
    expect(po.hraci[1].odhadzovaci.map((k) => k.uid)).not.toContain(puska.uid);
  });

  it("boti podkladajú len pod vlastné karty (v11.16) a po každej bitke je každý Nástroj u svojho majiteľa", () => {
    let podlozeni = 0;
    let podSuperovu = 0;
    for (const seed of [3, 4]) {
      let s = setupGame(dataH, seed);
      for (let krok = 0; s.koniec === null && krok < 3000; krok++) {
        const p = ([0, 1] as const).find((q) => legalCommands(dataH, s, q).length > 0);
        if (p === undefined) break;
        const cmd = tahBota(dataH, s, p, seed * 1000 + krok, { vzorky: 1 });
        const po = apply(dataH, s, cmd, p).state;
        if (cmd.type === "podloz") {
          podlozeni++;
          const hostitel = [...po.strany[0], ...po.strany[1]].find((pl) => pl.card.uid === cmd.hostitelId);
          if (hostitel?.playedBy !== p) podSuperovu++;
        }
        const pred = [...s.strany[0], ...s.strany[1]];
        const ostali = new Set([...po.strany[0], ...po.strany[1]].flatMap((pl) => (pl.podlozene ?? []).map((n) => n.card.uid)));
        for (const pl of pred) {
          for (const n of pl.podlozene ?? []) {
            if (ostali.has(n.card.uid)) continue;
            const kde = (q: PlayerId): number[] => [...po.hraci[q].odhadzovaci, ...po.hraci[q].doberaci, ...po.hraci[q].ruka].map((k) => k.uid);
            expect(kde(n.majitel)).toContain(n.card.uid);
            expect(kde((1 - n.majitel) as PlayerId)).not.toContain(n.card.uid);
          }
        }
        s = po;
      }
      expect(s.koniec).not.toBeNull();
    }
    expect(podlozeni).toBeGreaterThan(0);
    expect(podSuperovu).toBe(0);
  }, 240000);

  it("výučba prejde aj so sadou s hranami (Nástroje bez slotov, varianty 0/0)", () => {
    const scenar = scenarJson as unknown as ScenarVyucby;
    expect(prehrajVyucbu(dataH, scenar, scenar.kroky.length).koniec?.vitaz).toBe(0);
  });
});
