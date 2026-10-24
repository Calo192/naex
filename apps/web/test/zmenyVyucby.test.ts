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

/** Pohľad hráča pred a po každom ťahu scenára — bot, hra za hráča aj hráč (zmenyStola ich nerozlišuje). */
function tahySoZmenami(): { readonly krok: KrokScenara; readonly pred: ClientState; readonly po: ClientState }[] {
  let state = zacniVyucbu(data, scenar);
  const out: { krok: KrokScenara; pred: ClientState; po: ClientState }[] = [];
  for (const krok of scenar.kroky) {
    if (krok.kto === "info" || krok.kto === "otazka" || krok.prikaz === undefined) continue;
    const kto = ktoVykona(krok);
    const pred = viewFor(data, state, VYUCBA_HRAC);
    state = apply(data, state, prikazZoScenara(state, kto, krok.prikaz), kto).state;
    out.push({ krok, pred, po: viewFor(data, state, VYUCBA_HRAC) });
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
    const { po, kluce } = tah("k-zh-bot1");
    const zamocnik = po.strany[1].find((pl) => pl.card.defId === "zamocnik");
    expect(zamocnik).toBeDefined();
    expect(kluce).toContain(`uid:${zamocnik?.card.uid}`);
  });

  it("cigarety za kúpu Štamgasta svietia na jeho bare, za tvoju na tvojom", () => {
    expect(tah("k-kupa-bot").kluce).toContain("bar-supera:cigarety");
    expect(tah("k-kup-hasic").kluce).toContain("bar:cigarety");
    // Pas s plným limitom nedal cigaretu — nič sa nerozsvieti.
    expect(tah("k-pas-bot").kluce).toEqual([]);
  });

  it("kúpu Štamgasta zo šenku ukáže jeho dlaždica Karty — karta v jeho ruke je skrytá", () => {
    const { kluce } = tah("k-kupa-bot");
    expect(kluce).toContain("bar-supera:karty");
  });

  it("posun markera za prebytok rozsvieti staršieho", () => {
    expect(tah("k-prebytok1").kluce).toContain("starsi:farar");
  });

  it("NA EX na kartu v línii ju rozsvieti", () => {
    const { po, kluce } = tah("k-naex");
    const hasic = po.strany[0].find((pl) => pl.card.defId === "hasic");
    expect(hasic).toBeDefined();
    expect(kluce).toContain(`uid:${hasic?.card.uid}`);
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
    const { pred } = tah("k-zh-bot1");
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
