// Výučba, playtest kolo 4 (U2): ťah Štamgasta či hry za hráča bez textu ubehne sám —
// stĺpec Melichara a stôl musia ukázať, čo sa zmenilo. Overuje sa na skutočnom scenári
// „Prvá hra“ z pohľadu hráča (viewFor), takže kľúče smú siahať len na to, čo hráč vidí.

import { describe, expect, it } from "vitest";
import cardsJson from "../../../packages/core/data/cards.json";
import eldersJson from "../../../packages/core/data/elders.json";
import scorecardsJson from "../../../packages/core/data/scorecards.json";
import scenarJson from "../../../packages/core/data/vyucba/prva-hra.json";
import type { ClientState, KrokVyucby as KrokScenara, ScenarVyucby } from "@naex/core";
import { apply, ktoVykona, loadGameData, prikazZoScenara, viewFor, VYUCBA_HRAC, zacniVyucbu } from "@naex/core";
import { stitokTahu, zmenyStola } from "../src/hra/zmenyVyucby.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);
const scenar = scenarJson as unknown as ScenarVyucby;

/** Pohľad hráča pred a po každom ťahu bota a hry za hráča zo scenára. */
function tahySoZmenami(): { readonly krok: KrokScenara; readonly pred: ClientState; readonly po: ClientState }[] {
  let state = zacniVyucbu(data, scenar);
  const out: { krok: KrokScenara; pred: ClientState; po: ClientState }[] = [];
  for (const krok of scenar.kroky) {
    if (krok.kto === "info" || krok.kto === "otazka" || krok.prikaz === undefined) continue;
    const kto = ktoVykona(krok);
    const pred = viewFor(data, state, VYUCBA_HRAC);
    state = apply(data, state, prikazZoScenara(state, kto, krok.prikaz), kto).state;
    if (krok.kto !== "hrac") out.push({ krok, pred, po: viewFor(data, state, VYUCBA_HRAC) });
  }
  return out;
}
const tahy = tahySoZmenami();
const tah = (id: string) => {
  const t = tahy.find((x) => x.krok.id === id);
  if (t === undefined) throw new Error(`Scenár nemá ťah ${id}`);
  return { ...t, kluce: zmenyStola(t.pred, t.po) };
};

describe("zmeny na stole po ťahu bota či hry vo výučbe", () => {
  it("karta, ktorú Štamgast priložil, svieti na stole", () => {
    const { po, kluce } = tah("k39");
    const pes = po.strany[1].find((pl) => pl.card.defId === "pes");
    expect(pes).toBeDefined();
    expect(kluce).toContain(`uid:${pes?.card.uid}`);
  });

  it("pas Štamgasta rozsvieti jeho cigarety, pas hry za hráča tvoje", () => {
    expect(tah("k43").kluce).toContain("bar-supera:cigarety");
    expect(tah("k44").kluce).toContain("bar:cigarety");
  });

  it("kúpu Štamgasta zo šenku ukáže jeho dlaždica Karty — karta v jeho ruke je skrytá", () => {
    const { kluce } = tah("k33");
    expect(kluce).toContain("bar-supera:karty");
  });

  it("Pohoršenie rozsvieti staršieho, ktorého posunulo", () => {
    expect(tah("k25").kluce).toContain("starsi:starosta");
  });

  it("NA EX na kartu v línii ju rozsvieti", () => {
    const { po, kluce } = tah("k48");
    const pijan = po.strany[1].find((pl) => pl.card.defId === "pijan");
    expect(kluce).toContain(`uid:${pijan?.card.uid}`);
  });

  it("každá karta v kľúčoch je v pohľade hráča — zvýraznenie neprezradí skrytú kartu", () => {
    for (const t of tahy) {
      const pohlad = JSON.stringify(t.po);
      for (const k of zmenyStola(t.pred, t.po)) {
        if (!k.startsWith("uid:")) continue;
        expect(pohlad, `${t.krok.id}: ${k}`).toMatch(new RegExp(`"uid":${k.slice(4)}[,}]`));
      }
    }
  });

  it("ťah, ktorý nič nezmenil, nič nerozsvieti", () => {
    const { pred } = tah("k39");
    expect(zmenyStola(pred, pred)).toEqual([]);
  });
});

describe("štítok ťahu bez textu", () => {
  it("prvá veta logu, bez varovaní a momentov", () => {
    expect(stitokTahu(["⚠ EFEKT (vyhodnoťte ručne): X", "★ Moment", "Bot Štamgast pasuje do Pitky.", "Pitka 1/2."], "bot")).toBe("Bot Štamgast pasuje do Pitky.");
  });

  it("za hráča ťahala hra — povie to", () => {
    expect(stitokTahu(["Michal už neberie zo šenku (spolu 1)."], "auto")).toBe("Hra za teba: Michal už neberie zo šenku (spolu 1).");
  });

  it("bez vety nič", () => {
    expect(stitokTahu([], "bot")).toBeNull();
  });
});
