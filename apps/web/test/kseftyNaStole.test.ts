// Kšeft pod kartou, ktorá ho ponúka (Michal 2026-11-02): tlačidlo nie je na hrane stola medzi
// Fajčiť a Doliať, ale celé pod Strýkom v línii a pod lokalitou; väzni majú Kšeft v okne Pivnica.
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
import { klucVily } from "../src/hra/volbaVily.ts";

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
    s = apply(data, s, tahBota(data, s, kto, n * 7919, { povaha: "stamgast" }), kto).state;
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
  it("každý Kšeft má tlačidlo pod svojou kartou: Strýko, lokalita a každý väzeň", () => {
    const { s, stryko } = sKseftami(zaklad, { lok: "predsedova_vila", vazni: ["hrobar", "veterinar"] });
    const ksefty = kseftyNaStole(data, viewFor(data, s, ja));
    const lok = s.ciel?.lokalita?.uid;
    expect(ksefty.map((k) => [k.druh, k.uid])).toEqual([
      ["karta", stryko],
      ["lokalita", lok],
      ...s.vazni.map((v) => ["vazen", v.karta.uid]),
    ]);
    expect(ksefty.every((k) => k.dovod === null)).toBe(true);
    expect(ksefty.find((k) => k.druh === "karta")).toMatchObject({ cena: { cigarety: 2 }, zisk: "+1 Rana" });
    expect(ksefty.filter((k) => k.druh === "vazen").every((k) => "poldeci" in k.cena)).toBe(true);
  });

  it("ponúka presne príkazy, ktoré jadro dovolí (legalCommands)", () => {
    for (const lok of ["predsedova_vila", "sklad", "obecny_urad"]) {
      const { s } = sKseftami(zaklad, { lok, vazni: ["hrobar", "autobusar", "postarka"] });
      const legalne = legalCommands(data, s, ja).map((c) => JSON.stringify(c));
      for (const k of kseftyNaStole(data, viewFor(data, s, ja)).filter((x) => x.dovod === null))
        for (const c of prikazy(k)) expect(legalne, `${k.defId}: ${JSON.stringify(c)}`).toContain(JSON.stringify(c));
    }
  });

  it("Kšeft vily otvorí voľbu staršieho a smeru s kľúčmi výučby", () => {
    const { s } = sKseftami(zaklad, { lok: "predsedova_vila", vazni: [] });
    const vila = kseftyNaStole(data, viewFor(data, s, ja)).find((k) => k.druh === "lokalita");
    expect(vila?.akcia.typ).toBe("volba");
    if (vila?.akcia.typ !== "volba") return;
    const e = s.starsi[0]?.elderId ?? "";
    const riadok = vila.akcia.riadky.find((r) => r.kluc === e);
    expect(riadok?.vlavo?.vyucba).toBe(klucVily(e, true));
    expect(riadok?.vpravo.vyucba).toBe(klucVily(e, false));
    expect(klucVyucbyKseftu(vila)).toBe("tlacidlo:kseft");
  });

  it("málo cigariet a bez plného poldeci: tlačidlo ostane, povie prečo", () => {
    const { s } = sKseftami(zaklad, { lok: "obecny_urad", vazni: ["hrobar"], cigarety: 1, poldeci: 0 });
    const ksefty = kseftyNaStole(data, viewFor(data, s, ja));
    expect(ksefty.find((k) => k.druh === "karta")?.dovod).toMatch(/2 cigarety, máš 1/);
    expect(ksefty.find((k) => k.druh === "lokalita")?.dovod).toMatch(/3 cigarety, máš 1/);
    expect(ksefty.find((k) => k.druh === "vazen")?.dovod).toMatch(/plný poldeci/);
  });

  it("použitý Kšeft ostane pod kartou ako použitý", () => {
    const { s, stryko } = sKseftami(zaklad, { lok: "sklad", vazni: ["hrobar"] });
    const po = apply(data, s, { type: "kseft", uid: stryko }, ja).state;
    const k = kseftyNaStole(data, viewFor(data, po, ja)).find((x) => x.uid === stryko);
    expect(k?.pouzity).toBe(true);
    expect(k?.dovod).toMatch(/už použil/);
  });

  it("Strýko podstrčený k súperovi je hráčov; súperov Strýko nie", () => {
    const podstrceny = sKseftami(zaklad, { lok: "sklad", vazni: [], strykoNa: su });
    expect(kseftyNaStole(data, viewFor(data, podstrceny.s, ja)).some((k) => k.uid === podstrceny.stryko)).toBe(true);
    const superov = sKseftami(zaklad, { lok: "sklad", vazni: [], strykoOd: su, strykoNa: su });
    expect(kseftyNaStole(data, viewFor(data, superov.s, ja)).some((k) => k.uid === superov.stryko)).toBe(false);
  });

  it("po „Skončiť Pitku“ Kšefty nie sú — ani v Pivnici (ikona nesvieti)", () => {
    const { s } = sKseftami(zaklad, { lok: "sklad", vazni: ["hrobar"] });
    expect(kseftyNaStole(data, viewFor(data, s, ja)).filter((k) => k.druh === "vazen" && k.dovod === null)).toHaveLength(1);
    const po = apply(data, s, { type: "skipNaex" }, ja).state;
    expect(kseftyNaStole(data, viewFor(data, po, ja))).toEqual([]);
  });
});

describe("tlačidlo Kšeftu", () => {
  const { s } = sKseftami(zaklad, { lok: "predsedova_vila", vazni: ["hrobar"], cigarety: 1 });
  const ksefty = kseftyNaStole(data, viewFor(data, s, ja));
  const vila = sKseftami(zaklad, { lok: "predsedova_vila", vazni: [] });
  const vilaK = kseftyNaStole(data, viewFor(data, vila.s, ja)).find((k) => k.druh === "lokalita") as KseftNaStole;

  it("nedostupné je obrys; zisk a dôvod nesie aj popis pre čítačku", () => {
    const stryko = ksefty.find((k) => k.druh === "karta") as KseftNaStole;
    const html = renderToStaticMarkup(createElement(KseftPodKartou, { kseft: stryko, cmd: () => {} }));
    expect(html).toContain("+1 Rana");
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain("máš 1");
  });

  it("na tlačidle len „Kšeft“ a cena — zisk a celé znenie sú v nápovede (Michal 2026-11-02)", () => {
    const stryko = ksefty.find((k) => k.druh === "karta") as KseftNaStole;
    const html = renderToStaticMarkup(createElement(KseftPodKartou, { kseft: { ...stryko, dovod: null }, cmd: () => {} }));
    const text = html.replace(/<[^>]*>/g, "");
    expect(text).toBe("Kšeft−2");
    expect(html).not.toContain("title=");
    expect(stryko.nazov).toBe("Strýko z Ameriky");
  });

  it("na telefóne ťuk na nedostupný Kšeft ukáže detail s dôvodom, bez tlačidla Kšeftu", () => {
    const stryko = ksefty.find((k) => k.druh === "karta") as KseftNaStole;
    const html = renderToStaticMarkup(createElement(KseftPodKartou, { kseft: stryko, cmd: () => {}, naDotyk: true, otvorena: true }));
    expect(html).toContain("máš 1");
    expect(html).toContain("1 Ranu navyše");
    expect(html).not.toContain("kseft-ponuka-hlavne");
  });

  it("Kšeft vily je tlačidlo s ponukou starších (v11: reči o stupeň), nie rozbaľovač", () => {
    const zavreta = renderToStaticMarkup(createElement(KseftPodKartou, { kseft: vilaK, cmd: () => {} }));
    expect(zavreta).not.toContain("<select");
    expect(zavreta).toContain('data-vyucba="tlacidlo:kseft"');
    const otvorena = renderToStaticMarkup(createElement(KseftPodKartou, { kseft: vilaK, cmd: () => {}, otvorena: true }));
    const e = vila.s.starsi[0]?.elderId ?? "";
    expect(otvorena).toContain(`data-vyucba="${klucVily(e, true)}"`);
    expect(otvorena).toContain(`data-vyucba="${klucVily(e, false)}"`);
    expect(otvorena).toContain("reči ↑");
  });

  it("na telefóne ťuk otvorí ponuku s celým znením a veľkým tlačidlom", () => {
    const hrobar = kseftyNaStole(data, viewFor(data, sKseftami(zaklad, { lok: "sklad", vazni: ["hrobar"] }).s, ja)).find((k) => k.druh === "vazen") as KseftNaStole;
    const html = renderToStaticMarkup(createElement(KseftPodKartou, { kseft: hrobar, cmd: () => {}, naDotyk: true, otvorena: true }));
    expect(html).toContain("kseft-ponuka-hlavne");
    expect(html).toContain("súper odhodí náhodnú kartu");
  });
});
