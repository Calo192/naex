// Priazeň staršieho a nápoveda (v11 Strach a reči, R3 Michal 2026-11-02): priazeň dáva starší tomu,
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
import { favourPodlaId, kradezPriZajati, kratkeMeno, obsahNapovedy, obsahNapovedyVazna, pocetPriazniKola, priazenKola, reciZHadky, silaPriazne, spakyOdStarsieho, textMarkerov, vetaPriazne, vetaSpakov, vetaZajatia } from "../src/hra/priazenKola.ts";
import { KruzokPriazne, ObsahNapovedyStarsieho } from "../src/hra/KruzokPriazne.tsx";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);
const s0 = setupGame(data, 5);
const e0 = s0.starsi[0] as ElderState;
const id = e0.elderId;
// Reči na jedinom stupni (spodok bloku = vrch, v11.12).
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
  const text = (html: string): string => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  it("R3: strach a reči oboch menom hráča, špaky vetou s dôvodom, stupne slovami, nikdy farbou", () => {
    // Janove reči na Ferovom teplomere žltá až oranžová (1 + 2), Ferove na Janovej žltej (1), ktorú Jano drží strachom.
    const o = obsahNapovedy({ data, elder: { ...s([1, 0], [2, 1]), reciOd: [1, 1], karta: { ...e0.karta, defId: "farar" } }, meno: "Farár", ja: 0, mena: ["Jano", FERO] });
    expect(o.priazen).toEqual({ komu: "su", hrac: 1, sila: 1 });
    expect(o.hraci[0]).toMatchObject({ komu: "ja", kto: "Jano", strach: 1, reci: 2, reciOd: 1, vyhra: 3, prehra: 3 });
    expect(o.hraci[1]).toMatchObject({ komu: "su", kto: "Fero", strach: 0, reci: 1, reciOd: 1, vyhra: 1, prehra: 1 });
    expect(vetaSpakov(o.hraci[0])).toBe("pri výhre +3, pri prehre +3 (reči; keď prehráš hádku, klesnú zospodu)");
    expect(vetaSpakov({ reci: 0, vyhra: 3, prehra: 0 })).toBe("pri výhre +3, pri prehre 0");
    const t = text(renderToStaticMarkup(createElement(ObsahNapovedyStarsieho, { o })));
    expect(t).toContain("Jano znepokojený znepokojený až vystrašený");
    expect(t).toContain("Fero pokojný znepokojený");
    expect(t).not.toMatch(/\bty\b|žltá|oranžová|červená/);
  });

  it("priazeň komu a všetky tri sily celou vetou, aktuálna zvýraznená; bez priazne „Zatiaľ ju nemá nikto“", () => {
    const o = obsahNapovedy({ data, elder: s([0, 2]), meno: "Farár", ja: 0, mena: ["Jano", FERO] });
    expect(vetaPriazne(o)).toBe(`Má ju Jano, sila +2. Strach: Jano žiadny, Fero vystrašený. Sila je rozdiel strachov, reči sa nerátajú.`);
    expect(o.sily).toEqual([1, 2, 3].map((x) => silaPriazne(o.favour, x)));
    const html = renderToStaticMarkup(createElement(ObsahNapovedyStarsieho, { o }));
    expect(html).toMatch(/<li class="on ja"><b>sila 2<\/b>/);
    const nikto = obsahNapovedy({ data, elder: s([1, 1]), meno: "Farár", ja: 0, mena: ["Jano", FERO] });
    expect(vetaPriazne(nikto)).toMatch(/^Zatiaľ ju nemá nikto\./);
  });

  it("riziko zajatia s krádežou: súperove reči pri ňom", () => {
    const o = obsahNapovedy({ data, elder: s([3, 1], [0, 3]), meno: "Farár", ja: 1, mena: ["Jano", FERO] });
    // Ferove reči na Janovej červenej: investované 3.
    expect(o.zajatie).toEqual([{ hrac: 0, komu: "su", kto: "Jano", obet: "Fero", kradez: 3 }]);
    expect(vetaZajatia(o.zajatie[0]!, "m")).toBe("Jano ho môže po vyhratej bitke zajať za 5 z Nakladačky (strach vydesený). Fero mu vtedy odovzdá 3 špaky za svoje reči pri ňom (dnes).");
  });

  it("väzeň: v pivnici u koho, krádež z nástenky a schopnosť väzňa doslova (v11.2)", () => {
    const vazen = { elderId: id, hrac: 1 as const, karta: { ...e0.karta, defId: "starosta" }, scorecard: e0.scorecard };
    const o = obsahNapovedyVazna({
      data,
      vazen,
      meno: "Starosta",
      ja: 0,
      mena: ["Jano", FERO],
      vyhry: { cervene: [0, 1], cervenychNaVyhru: 4, vazni: [0, 1], vazniNaVyhru: 2 },
      nastenka: [
        { kolo: 1, bodovanie: [{ elderId: id, defId: "starosta", stupen: [0, 0], reci: [false, false], spaky: [0, 0] }] },
        { kolo: 2, bodovanie: [{ elderId: id, defId: "starosta", stupen: [2, 3], reci: [true, false], spaky: [3, 5] }], kradez: [-3, 3] },
      ],
    });
    expect(o).toMatchObject({ druh: "vazen", kto: "Fero", komu: "su", kradez: { kolo: 2, spaky: 3, obet: "Jano" } });
    expect(o.schopnost).toBe("Do konca kola sú všetky aktívne akcie lokality posilnené.");
    expect(o.pouzita).toBe(false);
    expect(obsahNapovedyVazna({ data, vazen: { ...vazen, pouzita: true }, meno: "Starosta", ja: 0, mena: ["Jano", FERO], vyhry: { cervene: [0, 1], cervenychNaVyhru: 4, vazni: [0, 1], vazniNaVyhru: 2 }, nastenka: [] }).pouzita).toBe(true);
    const t = text(renderToStaticMarkup(createElement(ObsahNapovedyStarsieho, { o })));
    expect(t).toContain("Fero: je z neho stále vydesený");
    expect(t).toContain("Krádež pri zajatí (bitka 2): Jano → Fero 3 špaky");
    expect(kradezPriZajati([], id, 1)).toBeNull();
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
