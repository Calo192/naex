// Priazeň staršieho a nápoveda (v11 Strach a reči, Michal 2026-11-02): priazeň dáva starší tomu,
// koho sa bojí menej, sila je rozdiel strachov; nápoveda ukáže strach a reči oboch a špaky po bitke;
// rekapitulácia bitky ukáže reči, ktoré víťaz hádky rozdelil.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import cardsJson from "../../../packages/core/data/cards.json";
import eldersJson from "../../../packages/core/data/elders.json";
import scorecardsJson from "../../../packages/core/data/scorecards.json";
import type { BitkaNaNastenke, ElderState, Stupen, ZmenaMarkera } from "@naex/core";
import { loadGameData, setupGame } from "@naex/core";
import { favourPodlaId, kratkeMeno, obsahNapovedy, pocetPriazniKola, priazenKola, reciZHadky, spakyOdStarsieho, textMarkerov } from "../src/hra/priazenKola.ts";
import { KruzokPriazne, ObsahNapovedyStarsieho } from "../src/hra/KruzokPriazne.tsx";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);
const s0 = setupGame(data, 5);
const e0 = s0.starsi[0] as ElderState;
const id = e0.elderId;
const s = (strach: readonly [Stupen, Stupen], reci: readonly [Stupen, Stupen] = [0, 0]): ElderState => ({ ...e0, strach, reci });
const FERO = "Bot Rapavý Fero";

describe("priazeň z rozdielu strachov", () => {
  it("komu a akú silnú — z pohľadu toho, kto sa pozerá", () => {
    expect(priazenKola(s([0, 2]), 0)).toEqual({ komu: "ja", hrac: 0, sila: 2 });
    expect(priazenKola(s([0, 2]), 1)).toEqual({ komu: "su", hrac: 0, sila: 2 });
    expect(priazenKola(s([3, 3]), 0)).toEqual({ komu: null, hrac: null, sila: 0 });
  });

  it("dlaždica Starší ráta priazne hráča", () => {
    expect(pocetPriazniKola([s([0, 1]), s([2, 1]), s([1, 1])], 0)).toBe(1);
    expect(pocetPriazniKola([s([0, 1]), s([2, 1]), s([1, 1])], 1)).toBe(1);
  });
});

describe("nápoveda nad staršom", () => {
  it("strach a reči oboch hráčov a špaky po bitke pri výhre a prehre", () => {
    const o = obsahNapovedy({ data, elder: s([1, 0], [3, 2]), meno: "Farár", ja: 0, mena: ["Jano", FERO] });
    expect(o.priazen).toEqual({ komu: "su", hrac: 1, sila: 1 });
    expect(o.stav).toBe("znepokojený");
    expect(o.hraci[0]).toEqual({ komu: "ja", kto: "ty", markery: "strach žltá, reči červená", vyhra: 5, prehra: 5 });
    expect(o.hraci[1]).toEqual({ komu: "su", kto: FERO, markery: "reči oranžová", vyhra: 3, prehra: 3 });
    const html = renderToStaticMarkup(createElement(ObsahNapovedyStarsieho, { o, menoSupera: FERO }));
    expect(html).toContain("výhra <b>5</b> / prehra <b>5</b>");
    expect(html).toContain(">Fero<");
  });

  it("markery slovami", () => {
    expect(textMarkerov(0, 0)).toBe("nič");
    expect(textMarkerov(2, 0)).toBe("strach oranžová");
    expect(textMarkerov(0, 1)).toBe("reči žltá");
  });
});

describe("krúžok priazne", () => {
  it("má ikonu akcie a číslo vo farbe toho, komu priazeň patrí; nikto = sivý bez čísla", () => {
    const html = renderToStaticMarkup(createElement(KruzokPriazne, { fav: "BITKAR", p: { komu: "su", sila: 2 } }));
    expect(html).toContain('class="kr su"');
    expect(html).toContain("+2");
    const nikto = renderToStaticMarkup(createElement(KruzokPriazne, { fav: "BITKAR", p: { komu: null, sila: 0 } }));
    expect(nikto).toContain('class="kr nikto"');
    expect(nikto).not.toContain("+");
  });
});

describe("reči z hádky v rekapitulácii", () => {
  it("kým bitka beží, zo stavu hádky; potom zo zmien markerov", () => {
    const hadka = { vitaz: 1 as const, zdvihy: [{ elderId: id, z: 0, na: 2 }] };
    expect(reciZHadky({ hadka, zmeny: [] }, 0)).toEqual([{ elderId: id, hrac: 1, komu: "su", z: 0, na: 2 }]);
    const zmeny: ZmenaMarkera[] = [
      { elderId: id, hrac: 0, marker: "reci", z: 1, na: 3, zdroj: "hadka", kto: 0 },
      { elderId: id, hrac: 0, marker: "strach", z: 0, na: 1, zdroj: "nakladacka", kto: 0 },
    ];
    expect(reciZHadky({ zmeny }, 0)).toEqual([{ elderId: id, hrac: 0, komu: "ja", z: 1, na: 3 }]);
  });
});

describe("pás na konci partie a pomocné", () => {
  it("špaky od staršieho za celú partiu", () => {
    const b = (r0: number, r1: number): Pick<BitkaNaNastenke, "zaStarsichRozpis"> => ({
      zaStarsichRozpis: [[{ elderId: id, defId: e0.karta.defId, spaky: r0 }], [{ elderId: id, defId: e0.karta.defId, spaky: r1 }]],
    });
    expect(spakyOdStarsieho([b(2, 0), b(1, 3), {}], id)).toEqual([3, 3]);
  });

  it("priazeň podľa id staršieho aj väzňa", () => {
    const fav = data.scorecards.find((x) => x.id === e0.scorecard)?.favour;
    expect(favourPodlaId(data, { starsi: [e0], vazni: [] }, id)).toBe(fav);
    expect(favourPodlaId(data, { starsi: [], vazni: [{ elderId: id, scorecard: e0.scorecard }] }, id)).toBe(fav);
    expect(favourPodlaId(data, { starsi: [], vazni: [] }, id)).toBeNull();
  });

  it("krátke meno", () => {
    expect(kratkeMeno("Bot Rapavý Fero")).toBe("Fero");
    expect(kratkeMeno("Dizajnér (AI)")).toBe("Dizajnér");
    expect(kratkeMeno("Teta Gizka")).toBe("Gizka");
  });
});
