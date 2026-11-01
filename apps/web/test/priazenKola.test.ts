// Priazeň staršieho v tomto kole (Michal 2026-10-31, mockup „Priazeň podľa Michala“, pravidlá v10
// „Hádka“): poloha prsteňa a bodky, lístok Hádky vo farbe víťaza hádky, texty nápovedy a súhrnu.
// Hádka posúva silu priazne len k víťazovi — v pohľade sú to klebety kola (kladné k hráčovi 0).

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import cardsJson from "../../../packages/core/data/cards.json";
import eldersJson from "../../../packages/core/data/elders.json";
import scorecardsJson from "../../../packages/core/data/scorecards.json";
import type { BitkaNaNastenke, ElderState, MarkerPos } from "@naex/core";
import { loadGameData, setupGame } from "@naex/core";
import {
  bodkaPoBode,
  dvojityMarker,
  favourPodlaId,
  hadkaBitky,
  kratkeMeno,
  listokHadky,
  obsahNapovedy,
  pocetPriazniKola,
  popisListka,
  prechodPriazne,
  priazenKola,
  priazenSuhrnu,
  riadkyKruzkov,
  spakyOdStarsieho,
  textListka,
  vetaHadky,
} from "../src/hra/priazenKola.ts";
import { KruzokPriazne, ObsahNapovedyStarsieho } from "../src/hra/KruzokPriazne.tsx";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);
const s0 = setupGame(data, 5);
const e0 = s0.starsi[0] as ElderState;
const id = e0.elderId;
const na = (marker: number): ElderState => ({ ...e0, marker: marker as MarkerPos });
const FERO = "Bot Rapavý Fero";

describe("dvojitý marker: prsteň = marker, bodka = priazeň tohto kola", () => {
  it("bez hádky sú prsteň aj bodka na markeri, farba podľa priazne", () => {
    expect(dvojityMarker(na(1), undefined, 0)).toEqual({ prsten: 1, bodka: 1, komu: "ja", posunute: false });
    // Súper vidí stupnicu zrkadlovo: jeho polovica vľavo.
    expect(dvojityMarker(na(1), undefined, 1)).toEqual({ prsten: 5, bodka: 5, komu: "su", posunute: false });
    expect(dvojityMarker(na(3), undefined, 0)).toEqual({ prsten: 3, bodka: 3, komu: null, posunute: false });
  });

  it("hádka mi požičala staršieho zo stredu: prsteň v strede, bodka na mojej žltej", () => {
    expect(dvojityMarker(na(3), { [id]: 1 }, 0)).toEqual({ prsten: 3, bodka: 2, komu: "ja", posunute: true });
  });

  it("súperova hádka znížila moju oranžovú na žltú", () => {
    expect(dvojityMarker(na(1), { [id]: -1 }, 0)).toEqual({ prsten: 1, bodka: 2, komu: "ja", posunute: true });
  });

  it("preklopenie mojej oranžovej do súperovej oranžovej", () => {
    expect(dvojityMarker(na(1), { [id]: -4 }, 0)).toEqual({ prsten: 1, bodka: 5, komu: "su", posunute: true });
    expect(priazenKola(na(1), { [id]: -4 }, 0)).toEqual({ komu: "su", hrac: 1, sila: 2 });
  });

  it("hádka, ktorá priazeň zruší, dá sivú bodku do stredu", () => {
    expect(dvojityMarker(na(4), { [id]: 1 }, 0)).toEqual({ prsten: 4, bodka: 3, komu: null, posunute: true });
  });

  it("strop sily 3: ďalší bod hádky už bodku neposunie", () => {
    expect(bodkaPoBode(na(1), undefined, 0)).toBe(0);
    expect(bodkaPoBode(na(0), undefined, 0)).toBeNull();
    expect(bodkaPoBode(na(3), undefined, 1)).toBe(2);
  });
});

describe("lístok Hádky: príčina vo farbe víťaza hádky", () => {
  it("bez posunu lístok nie je", () => {
    expect(listokHadky(id, undefined, 0)).toBeNull();
    expect(listokHadky(id, { [id]: 0 }, 0)).toBeNull();
  });

  it("znamienko klebiet povie víťaza — aj keď mi súper priazeň len znížil", () => {
    expect(listokHadky(id, { [id]: 2 }, 0)).toEqual({ hrac: 0, komu: "ja", stupne: 2 });
    expect(listokHadky(id, { [id]: -1 }, 0)).toEqual({ hrac: 1, komu: "su", stupne: 1 });
    // Ten istý lístok zo strany súpera.
    expect(listokHadky(id, { [id]: -1 }, 1)).toEqual({ hrac: 1, komu: "ja", stupne: 1 });
  });

  it("text a popis lístka", () => {
    const l = { hrac: 1 as const, komu: "su" as const, stupne: 4 };
    expect(textListka(l)).toBe("Hádka +4");
    expect(popisListka(l, FERO)).toBe("Hádka +4: hádka — vyhral Fero, priazeň posunutá hádkou do konca kola");
    expect(popisListka({ hrac: 0, komu: "ja", stupne: 1 }, FERO)).toBe("Hádka +1: tvoja hádka, priazeň posunutá hádkou do konca kola");
  });
});

describe("nápoveda nad staršom a nad krúžkami", () => {
  const vstup = (marker: number, klebety: Record<string, number> | undefined) =>
    obsahNapovedy({ data, elder: na(marker), meno: "Autobusár", klebety, ja: 0, mena: ["Jano", FERO], spaky: 0, naUdrzanie: 0 });

  it("bez hádky nemá riadok Hádka; strach je podľa markera", () => {
    const o = vstup(5, undefined);
    expect(o.hadka).toBeNull();
    expect(o.priazen).toEqual({ komu: "su", hrac: 1, sila: 2 });
    expect(o.strach.komu).toBe("ja");
    expect(o.stupen).toBe("stupeň 2, oranžová — vystrašený");
  });

  it("riadok Hádka: z markera → toto kolo, číslo z pohľadu hráča", () => {
    const o = vstup(1, { [id]: -1 });
    expect(o.hadka).not.toBeNull();
    const h = o.hadka!;
    expect(vetaHadky(h.zMarkera, h.listok, h.teraz, FERO)).toBe("z markera ty +2 · Fero v hádke −1 · toto kolo ty +1");
    // Strach sa hádkou nemení — bojí sa stále súpera.
    expect(o.strach.komu).toBe("su");
    const html = renderToStaticMarkup(createElement(ObsahNapovedyStarsieho, { o, menoSupera: FERO }));
    expect(html).toContain("Hádka");
    expect(html).toContain("po kole zase");
    expect(html).not.toContain("Povera");
  });

  it("moja hádka zo stredu", () => {
    const h = vstup(3, { [id]: 1 }).hadka!;
    expect(vetaHadky(h.zMarkera, h.listok, h.teraz, FERO)).toBe("z markera nikto · ty v hádke +1 · toto kolo ty +1");
  });

  it("nad krúžkami 1 riadok, druhý len keď hádka bodku odsunula", () => {
    expect(riadkyKruzkov(false)).toHaveLength(1);
    expect(riadkyKruzkov(true)).toEqual(["Prsteň: strach (skóruje sa) · bodka: komu patrí priazeň v tomto kole.", "Bodku posunula hádka, do konca kola."]);
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

describe("priazne kola v súhrnoch", () => {
  it("dlaždica Starší ráta priazne po hádke", () => {
    expect(pocetPriazniKola([na(3)], { [id]: 1 }, 0)).toBe(1);
    expect(pocetPriazniKola([na(1)], { [id]: -4 }, 0)).toBe(0);
  });

  it("hádka v rekapitulácii a prechod priazne", () => {
    const h = hadkaBitky([na(5)], { hracov: [{ [id]: 3 }, {}] }, 0);
    expect(h).toEqual([{ elderId: id, hrac: 0, komu: "ja", stupne: 3, z: { komu: "su", hrac: 1, sila: 2 }, teraz: { komu: "ja", hrac: 0, sila: 1 } }]);
    expect(prechodPriazne(h[0]!.z, h[0]!.teraz, FERO)).toBe("Fero 2 → ty");
    // Kým bitka beží, pohľad má len súčet.
    expect(hadkaBitky([na(3)], { sucet: { [id]: -1 } }, 0).map((x) => [x.hrac, x.stupne])).toEqual([[1, 1]]);
  });

  it("bublina súhrnu: priazeň v kole po hádke → po kole, bodka začne mimo prsteňa", () => {
    const s = priazenSuhrnu(na(3), [{ hrac: 1, stupne: 2 }], 0);
    expect(s.vKole).toEqual({ komu: "su", hrac: 1, sila: 2 });
    expect(s.poKole).toEqual({ komu: null, hrac: null, sila: 0 });
    expect(s.dm).toMatchObject({ prsten: 3, bodka: 5, posunute: true });
  });

  it("pás na konci partie: špaky od staršieho za celú partiu", () => {
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

  it("krátke meno na lístok", () => {
    expect(kratkeMeno("Bot Rapavý Fero")).toBe("Fero");
    expect(kratkeMeno("Dizajnér (AI)")).toBe("Dizajnér");
    expect(kratkeMeno("Teta Gizka")).toBe("Gizka");
  });
});
