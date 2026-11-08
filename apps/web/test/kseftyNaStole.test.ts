// Efekt pod kartou, ktorá ho ponúka (Michal 2026-11-02): väzni majú v okne Pivnica schopnosť
// (v11.2, raz za hru), Sklad pod lokalitou Nástroj zo šenku do Dedičstva (frakcie 2026-11-08).
// Kšeft zanikol (frakcie 2026-11-08) — Strýko ani lokality ho nemajú.
// Ponuka musí sedieť s jadrom (legalCommands) a čo sa nedá, povie prečo.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import cardsJson from "../../../packages/core/data/cards.json";
import eldersJson from "../../../packages/core/data/elders.json";
import scorecardsJson from "../../../packages/core/data/scorecards.json";
import type { CardInstance, Command, GameState, PlayerId } from "@naex/core";
import { apply, legalCommands, loadGameData, mozeHrat, naTahu, opponentOf, setupGame, tahBota, viewFor } from "@naex/core";
import { kseftyNaStole, type KseftNaStole } from "../src/hra/kseftyNaStole.ts";
import { KseftPodKartou, klucVyucbyKseftu } from "../src/hra/KseftPodKartou.tsx";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);
const ja: PlayerId = 0;
const su = opponentOf(ja);

/** Prvá Pitka, v ktorej hráč 0 hrá (nie odpoveď na NA EX, nie Vízia) — partia botov. */
function pitka(): GameState {
  let s = setupGame(data, 8);
  for (let n = 0; n < 4000; n++) {
    if (s.faza === "pitka" && s.ciel?.lokalita != null && mozeHrat(s, ja) && s.pitkaStav?.reakcia === null && !s.pitkaStav.hotovy[ja] && s.vizia === null) return s;
    const kto = naTahu(s);
    if (kto === null) break;
    s = apply(data, s, tahBota(data, s, kto, n * 7919, { povaha: "igor" }), kto).state;
  }
  throw new Error("Pitka sa nenašla");
}

/** Ako ukážka stola &stop=kseft: Strýko v línii, lokalita s Kšeftom, väzni, cigarety, poldeci a Dlh. */
function sKseftami(s: GameState, o: { readonly lok: string; readonly vazni: readonly string[]; readonly cigarety?: number; readonly poldeci?: number; readonly strykoNa?: PlayerId; readonly strykoOd?: PlayerId }): { readonly s: GameState; readonly stryko: number } {
  const stryko: CardInstance = { uid: s.nextUid, defId: "stryko_z_ameriky", leftLayout: 0, rightLayout: 0 };
  const strany: [GameState["strany"][0], GameState["strany"][1]] = [[...s.strany[0]], [...s.strany[1]]];
  const na = o.strykoNa ?? ja;
  strany[na] = [...strany[na], { card: stryko, playedBy: o.strykoOd ?? ja }];
  const zajati = s.starsi.filter((e) => o.vazni.includes(e.karta.defId));
  const h = { ...s.hraci[ja], cigarety: o.cigarety ?? 9, poldeciPlne: o.poldeci ?? 3, dlhy: 1 };
  const ciel = s.ciel === null || s.ciel.lokalita == null ? s.ciel : { ...s.ciel, lokalita: { ...s.ciel.lokalita, defId: o.lok } };
  return {
    stryko: stryko.uid,
    s: {
      ...s,
      nextUid: s.nextUid + 1,
      strany,
      ciel,
      starsi: s.starsi.filter((e) => !zajati.includes(e)),
      vazni: [...s.vazni, ...zajati.map((e, i) => ({ elderId: e.elderId, hrac: ja, poradie: s.vazni.length + i + 1, karta: e.karta, scorecard: e.scorecard, miesto: i }))],
      hraci: [h, s.hraci[su]],
    },
  };
}

const prikazy = (k: KseftNaStole): Command[] =>
  k.akcia.typ === "prikaz" ? [k.akcia.prikaz] : k.akcia.typ === "volba" ? k.akcia.riadky.flatMap((r) => [...(r.vlavo === undefined ? [] : [r.vlavo.prikaz]), r.vpravo.prikaz]) : [];

const zaklad = pitka();

describe("Kšefty pod kartou", () => {
  it("Kšeft zanikol: pod Strýkom ani pod lokalitou nič, väzni majú schopnosť", () => {
    const { s } = sKseftami(zaklad, { lok: "predsedova_vila", vazni: ["postarka", "krcmarka"] });
    const ksefty = kseftyNaStole(data, viewFor(data, s, ja));
    expect(ksefty.map((k) => [k.druh, k.uid])).toEqual(s.vazni.map((v) => ["vazen", v.karta.uid]));
    expect(ksefty.every((k) => k.dovod === null && "raz" in k.cena)).toBe(true);
  });

  it("ponúka presne príkazy, ktoré jadro dovolí (legalCommands)", () => {
    for (const lok of ["predsedova_vila", "sklad", "obecny_urad"]) {
      const { s } = sKseftami(zaklad, { lok, vazni: ["hrobar", "autobusar", "postarka"] });
      const legalne = legalCommands(data, s, ja).map((c) => JSON.stringify(c));
      for (const k of kseftyNaStole(data, viewFor(data, s, ja)).filter((x) => x.dovod === null))
        for (const c of prikazy(k)) expect(legalne, `${k.defId}: ${JSON.stringify(c)}`).toContain(JSON.stringify(c));
    }
  });

  it("schopnosť väzňa nič nestojí ani bez cigariet", () => {
    const { s } = sKseftami(zaklad, { lok: "sklad", vazni: ["postarka"], cigarety: 1, poldeci: 0 });
    const ksefty = kseftyNaStole(data, viewFor(data, s, ja));
    expect(ksefty.find((k) => k.druh === "vazen")?.dovod).toBeNull();
  });

  it("po „Skončiť Pitku“ Kšefty nie sú a schopnosť väzňa čaká na môj ťah (ikona nesvieti)", () => {
    const { s } = sKseftami(zaklad, { lok: "sklad", vazni: ["postarka"] });
    expect(kseftyNaStole(data, viewFor(data, s, ja)).filter((k) => k.druh === "vazen" && k.dovod === null)).toHaveLength(1);
    const po = apply(data, s, { type: "skipNaex" }, ja).state;
    const ksefty = kseftyNaStole(data, viewFor(data, po, ja));
    expect(ksefty.filter((k) => k.druh !== "vazen")).toEqual([]);
    expect(ksefty.filter((k) => k.dovod === null)).toEqual([]);
    expect(ksefty.find((k) => k.druh === "vazen")?.dovod).toMatch(/vo svojom ťahu/);
  });

  it("schopnosť väzňa: Farár a Hrobár ponúknu voľbu, Autobusár výber kariet; použitá nesie značku", () => {
    const { s, stryko } = sKseftami(zaklad, { lok: "sklad", vazni: ["farar", "hrobar", "postarka"] });
    const odh: CardInstance = { uid: 99500, defId: "pijan", leftLayout: 0, rightLayout: 0 };
    const sNaex: GameState = {
      ...s,
      strany: s.strany.map((st) => st.map((pl) => (pl.card.uid === stryko ? { ...pl, naexBy: su } : pl))) as unknown as GameState["strany"],
      hraci: [s.hraci[ja], { ...s.hraci[su], odhadzovaci: [odh] }],
    };
    const ksefty = kseftyNaStole(data, viewFor(data, sNaex, ja));
    const farar = ksefty.find((k) => k.defId === "farar");
    expect(farar?.akcia.typ).toBe("volba");
    expect(farar === undefined ? [] : prikazy(farar)).toEqual([{ type: "schopnostVazna", elderId: "farar", uid: stryko }]);
    const hrobar = ksefty.find((k) => k.defId === "hrobar");
    expect(hrobar === undefined ? [] : prikazy(hrobar)).toEqual([{ type: "schopnostVazna", elderId: "hrobar", uid: 99500 }]);
    const legalne = legalCommands(data, sNaex, ja).map((c) => JSON.stringify(c));
    for (const k of ksefty.filter((x) => x.druh === "vazen")) for (const c of prikazy(k)) expect(legalne).toContain(JSON.stringify(c));
    const po = apply(data, sNaex, { type: "schopnostVazna", elderId: "postarka" }, ja).state;
    const postarka = kseftyNaStole(data, viewFor(data, po, ja)).find((k) => k.defId === "postarka") as KseftNaStole;
    expect(postarka.pouzity).toBe(true);
    expect(renderToStaticMarkup(createElement(KseftPodKartou, { kseft: postarka, cmd: () => {} })).replace(/<[^>]*>/g, "")).toBe("použitá");
  });

  it("Autobusár pri braní zo šenku: výber kariet a jeden príkaz s cenou", () => {
    const { s } = sKseftami(zaklad, { lok: "sklad", vazni: ["autobusar"], cigarety: 2 });
    const draft: GameState = { ...s, faza: "draft", pitkaStav: null, senok: s.naradie.slice(0, 3), draftStav: { krok: "beranie", balicky: [[], []], vyber: [null, null], naTahu: ja, hotovo: [false, false], noveKarty: [0, 0] } };
    const k = kseftyNaStole(data, viewFor(data, draft, ja)).find((x) => x.defId === "autobusar") as KseftNaStole;
    expect(k.dovod).toBeNull();
    expect(k.akcia.typ).toBe("karty");
    if (k.akcia.typ !== "karty") return;
    expect(k.akcia.najviac).toBe(2);
    expect(k.akcia.karty).toHaveLength(3);
    const cmd = k.akcia.prikaz([k.akcia.karty[0]!.uid, k.akcia.karty[1]!.uid]);
    const po = apply(data, draft, cmd, ja).state;
    expect(po.hraci[ja].cigarety).toBe(0);
    const html = renderToStaticMarkup(createElement(KseftPodKartou, { kseft: k, cmd: () => {}, otvorena: true }));
    expect(html).toContain("vyber karty");
  });
});

describe("tlačidlo pod kartou", () => {
  it("na telefóne ťuk otvorí ponuku s celým znením a veľkým tlačidlom", () => {
    const postarka = kseftyNaStole(data, viewFor(data, sKseftami(zaklad, { lok: "sklad", vazni: ["postarka"] }).s, ja)).find((k) => k.druh === "vazen") as KseftNaStole;
    const html = renderToStaticMarkup(createElement(KseftPodKartou, { kseft: postarka, cmd: () => {}, naDotyk: true, otvorena: true }));
    expect(html).toContain("kseft-ponuka-hlavne");
    expect(html).toContain("Dostaneš 4 cigarety.");
    expect(html).toContain("Schopnosť · Poštárka");
  });
});

describe("Sklad (Zhromaždenie, frakcie 2026-11-08)", () => {
  // Sada so Skladom zo špecifikácie frakcií — strany ostávajú, mení sa len efekt.
  const surove = (cardsJson as { cards: { id: string }[] }).cards.map((c) =>
    c.id === "sklad" ? { ...c, effect_text: "Zhromaždenie: Nástroj zo šenku smieš vyložiť rovno do Dedičstva za cenu Dedičstva. Do šenku sa dotiahne nový Nástroj.", triggers: ["Zhromaždenie"] } : c,
  );
  const sData = loadGameData({ ...cardsJson, cards: surove }, eldersJson, scorecardsJson);
  const vidly: CardInstance = { uid: 99600, defId: "vidly", leftLayout: 0, rightLayout: 0 };
  const { s: sp } = sKseftami(zaklad, { lok: "sklad", vazni: [], cigarety: 9 });
  const s: GameState = {
    ...sp,
    faza: "zhromazdenie",
    pitkaStav: null,
    vizia: null,
    senok: [vidly],
    zhromazdenieStav: { naTahu: ja, zostavaLimit: [2, 2], pasoval: [false, false], navyse: [0, 0] },
  };

  it("pod lokalitou ponuka Nástroja zo šenku do Dedičstva — príkaz, ktorý jadro dovolí", () => {
    const k = kseftyNaStole(sData, viewFor(sData, s, ja)).find((x) => x.druh === "lokalita") as KseftNaStole;
    expect(k.dovod).toBeNull();
    expect(prikazy(k)).toEqual([{ type: "place", uid: vidly.uid, target: "dedicstvo" }]);
    expect(legalCommands(sData, s, ja)).toContainEqual({ type: "place", uid: vidly.uid, target: "dedicstvo" });
    const html = renderToStaticMarkup(createElement(KseftPodKartou, { kseft: k, cmd: () => {} }));
    expect(html.replace(/<[^>]*>/g, "")).toContain("Sklad");
  });

  it("stará sada (Kšeft Skladu) ani Pitka ponuku nemá", () => {
    expect(kseftyNaStole(data, viewFor(data, s, ja)).some((x) => x.druh === "lokalita")).toBe(false);
    expect(kseftyNaStole(sData, viewFor(sData, sp, ja)).some((x) => x.druh === "lokalita")).toBe(false);
  });
});
