// Patronát a nové Pohoršenie (Michal 2026-10-20): bitku o staršieho nahradil
// patronát — hráč, ktorému starší prejavuje priazeň, si ho po šenku vezme do
// ruky, na scorecard dá lícom dole kartu z ruky a marker ide do stredu.
// Pohoršenie smie ten istý marker posunúť viackrát, najviac cez dve hranice zón.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { BitkaStav, CardInstance, GameState, MarkerPos, PlacedCard, PlayerId } from "../src/index.ts";
import {
  KONSTANTY,
  apply,
  legalCommands,
  loadGameData,
  naTahu,
  opponentOf,
  setupGame,
  viewFor,
  zahmliStav,
  rngSeed,
} from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

let uidSeq = 70000;
const inst = (defId: string): CardInstance => ({ uid: ++uidSeq, defId, leftLayout: 0, rightLayout: 0 });
const lezi = (card: CardInstance, playedBy: PlayerId): PlacedCard => ({ card, playedBy });

/** Marker na polovici hráča p v danej zóne (1 žltá, 2 oranžová, 3 červená). */
const naPolovici = (p: PlayerId, zona: 1 | 2 | 3): MarkerPos => (p === 0 ? 3 - zona : 5 + zona) as MarkerPos;

/** Stav v kroku patronátu: útočník u je na ťahu, starší[0] mu prejavuje priazeň v danej zóne. */
function vPatronate(zona: 1 | 2 | 3, uprav: (s: GameState, u: PlayerId) => GameState = (s) => s): { s: GameState; u: PlayerId; obcan: CardInstance } {
  const s0 = setupGame(data, 31);
  const u = s0.utocnik;
  const obcan = inst("pijan");
  const marker = naPolovici(u, zona);
  const hraci = s0.hraci.map((h, i) =>
    // 7 štartoviek (Michal 2026-10-22): doberací doplnený na 5, aby balíček neklesol pod 5.
    i === u
      ? { ...h, ruka: [obcan, inst("noviny")], cigarety: 3, doberaci: [...h.doberaci, inst("pijan"), inst("pijan"), inst("pijan")] }
      : { ...h, ruka: [inst("pijan")], doberaci: [...h.doberaci, inst("pijan"), inst("pijan"), inst("pijan")] },
  ) as unknown as GameState["hraci"];
  const s: GameState = {
    ...s0,
    faza: "draft",
    ciel: { typ: "lokalita", lokalita: s0.lokalityVHre[0]! },
    lokalityVHre: s0.lokalityVHre.slice(1),
    starsi: s0.starsi.map((e, i) => (i === 0 ? { ...e, marker, markerZaciatokKola: marker } : e)),
    hraci,
    draftStav: {
      krok: "patronat",
      balicky: [[], []],
      vyber: [null, null],
      naTahu: u,
      hotovo: [false, false],
      noveKarty: [0, 0],
    },
  };
  return { s: uprav(s, u), u, obcan };
}

function bitka(c: Partial<BitkaStav>): BitkaStav {
  return {
    krok: null,
    caka: null,
    sums: [{}, {}],
    exekutorHotovy: [true, true],
    pohorsenieZostava: [0, 0],
    pohorsenieHranice: {},
    damage: null,
    vitaz: null,
    prebytokDrzi: null,
    prebytokZostava: 0,
    prebytokPosunute: [],
    liecbaHotova: [true, true],
    benzinkaZostava: [0, 0],
    spalit: [],
    vesticaHotova: true,
    ...c,
  };
}

/** Obaja pasujú a končia Pitky (Vízia do ruky), kým nezačne bitka. */
function doBitky(s: GameState): GameState {
  let st = s;
  for (let i = 0; i < 40 && st.faza !== "bitka"; i++) {
    const p = naTahu(st)!;
    const legal = legalCommands(data, st, p);
    const cmd = legal.find((c) => c.type === "pass" || c.type === "skipNaex" || (c.type === "vizia" && c.vziat)) ?? legal[0]!;
    st = apply(data, st, cmd, p).state;
  }
  return st;
}

describe("patronát — vzatie staršieho do ruky", () => {
  it("patrón zaplatí cigarety, starší ide do ruky, karta lícom dole, marker do stredu", () => {
    const { s, u, obcan } = vPatronate(2);
    const elder = s.starsi[0]!;
    const legal = legalCommands(data, s, u);
    expect(legal).toContainEqual({ type: "patronat", elderId: elder.elderId, uid: obcan.uid });
    // Nástroj na scorecard nejde.
    expect(legal.some((c) => c.type === "patronat" && c.uid !== obcan.uid)).toBe(false);

    const po = apply(data, s, { type: "patronat", elderId: elder.elderId, uid: obcan.uid }, u).state;
    expect(po.hraci[u].cigarety).toBe(3 - 1);
    expect(po.hraci[u].ruka.map((k) => k.uid)).toContain(elder.karta.uid);
    expect(po.hraci[u].ruka.map((k) => k.uid)).not.toContain(obcan.uid);
    expect(po.starsi[0]!.marker).toBe(4);
    expect(po.patronat[u]).toEqual({ elderId: elder.elderId, nahrada: obcan, pohorsenia: 3 });
    // Obranca nemá koho vziať — hra jeho rozhodnutie preskočí a začína Zhromaždenie.
    expect(po.faza).toBe("zhromazdenie");
    expect(naTahu(po)).toBe(u);
  });

  it("súper kartu lícom dole nevidí, patrón áno", () => {
    const { s, u, obcan } = vPatronate(1);
    const po = apply(data, s, { type: "patronat", elderId: s.starsi[0]!.elderId, uid: obcan.uid }, u).state;
    const jeho = viewFor(data, po, opponentOf(u));
    expect(JSON.stringify(jeho)).not.toContain(`"uid":${obcan.uid},`);
    expect(jeho.mojaNahrada).toBeNull();
    expect(jeho.patronat[u]).toEqual({ elderId: s.starsi[0]!.elderId, pohorsenia: 2 });
    expect(viewFor(data, po, u).mojaNahrada).toEqual(obcan);
  });

  it("bez cigariet, bez poldeci alebo bez Občana či Zvieraťa sa staršieho vziať nedá", () => {
    const bezCigariet = vPatronate(1, (s, u) => ({ ...s, hraci: s.hraci.map((h, i) => (i === u ? { ...h, cigarety: 1 } : h)) as unknown as GameState["hraci"] }));
    expect(legalCommands(data, bezCigariet.s, bezCigariet.u).some((c) => c.type === "patronat")).toBe(false);
    const bezPoldeci = vPatronate(2, (s, u) => ({ ...s, hraci: s.hraci.map((h, i) => (i === u ? { ...h, poldeciPlne: 0, poldeciVypite: 0 } : h)) as unknown as GameState["hraci"] }));
    expect(legalCommands(data, bezPoldeci.s, bezPoldeci.u).some((c) => c.type === "patronat")).toBe(false);
    const bezObcana = vPatronate(2, (s, u) => ({ ...s, hraci: s.hraci.map((h, i) => (i === u ? { ...h, ruka: [inst("noviny")] } : h)) as unknown as GameState["hraci"] }));
    expect(legalCommands(data, bezObcana.s, bezObcana.u)).toEqual([{ type: "bezPatronatu" }]);
  });

  it("z červenej zadarmo, súper dostane 4 Pohoršenia; obávaný hráč patrónom nie je", () => {
    const { s, u, obcan } = vPatronate(3);
    const elderId = s.starsi[0]!.elderId;
    expect(legalCommands(data, s, opponentOf(u))).toEqual([]);
    const po = apply(data, s, { type: "patronat", elderId, uid: obcan.uid }, u).state;
    expect(po.hraci[u].cigarety).toBe(3);
    expect(po.patronat[u]?.pohorsenia).toBe(4);
  });

  it("súper dostane Pohoršenia v bitke a vráti nimi marker toho istého staršieho až do oranžovej", () => {
    const { s, u, obcan } = vPatronate(2);
    const elderId = s.starsi[0]!.elderId;
    let st = apply(data, s, { type: "patronat", elderId, uid: obcan.uid }, u).state;
    st = doBitky(st);
    const o = opponentOf(u);
    expect(st.bitkaStav?.krok).toBe("pohorsenie");
    expect(st.bitkaStav?.pohorsenieZostava[o]).toBe(3);
    for (let i = 0; i < 3; i++) st = apply(data, st, { type: "pohorsenie", elderId }, o).state;
    expect(st.starsi[0]!.marker).toBe(naPolovici(u, 2));
  });

  it("Policajtka patróna zruší aj Pohoršenia z patronátu", () => {
    const { s, u, obcan } = vPatronate(2);
    const elderId = s.starsi[0]!.elderId;
    let st = apply(data, s, { type: "patronat", elderId, uid: obcan.uid }, u).state;
    st = { ...st, strany: (u === 0 ? [[lezi(inst("policajtka"), 0)], []] : [[], [lezi(inst("policajtka"), 1)]]) as GameState["strany"] };
    st = doBitky(st);
    expect(st.bitkaStav?.pohorsenieZostava[opponentOf(u)] ?? 0).toBe(0);
  });
});

describe("patronát — po bitke", () => {
  /** Stav tesne pred koncom bitky: patrón u drží staršieho, `kde` je jeho karta. */
  function predKoncom(vitaz: PlayerId, vLinii: boolean): { s: GameState; u: PlayerId; elderUid: number; obcan: CardInstance } {
    const { s, u, obcan } = vPatronate(2);
    const elderId = s.starsi[0]!.elderId;
    let st = apply(data, s, { type: "patronat", elderId, uid: obcan.uid }, u).state;
    const elderKarta = st.starsi[0]!.karta;
    if (vLinii) {
      st = {
        ...st,
        hraci: st.hraci.map((h, i) => (i === u ? { ...h, ruka: h.ruka.filter((k) => k.uid !== elderKarta.uid) } : h)) as unknown as GameState["hraci"],
        strany: (u === 0 ? [[lezi(elderKarta, 0)], []] : [[], [lezi(elderKarta, 1)]]) as GameState["strany"],
      };
    }
    st = {
      ...st,
      faza: "bitka",
      draftStav: null,
      hraci: st.hraci.map((h) => ({ ...h, poldeciPlne: 1, poldeciVypite: 1 })) as unknown as GameState["hraci"],
      bitkaStav: bitka({ krok: "liecba", caka: 0, liecbaHotova: [false, true], vitaz, prebytokDrzi: vitaz }),
    };
    return { s: st, u, elderUid: elderKarta.uid, obcan };
  }

  it("výhra: starší ostáva patrónovi, karta lícom dole sa otáča na scorecarde", () => {
    for (const vLinii of [false, true]) {
      const { s, u, elderUid, obcan } = predKoncom(vPatronate(2).u, vLinii);
      const po = apply(data, s, { type: "skipLiecba" }, 0).state;
      const e = po.starsi[0]!;
      expect(e.karta).toEqual(obcan);
      expect(e.nahradeny).toBe(true);
      expect(e.ziskal).toBe(u);
      const h = po.hraci[u];
      expect([...h.ruka, ...h.odhadzovaci].some((k) => k.uid === elderUid)).toBe(true);
      expect(po.patronat).toEqual([null, null]);
      expect(h.poldeciPlne + h.poldeciVypite).toBeGreaterThanOrEqual(2);
    }
  });

  it("prehra: starší sa vracia na scorecard, náhrada do ruky, patrón odhodí vypitý poldeci", () => {
    for (const vLinii of [false, true]) {
      const u0 = vPatronate(2).u;
      const { s, u, elderUid, obcan } = predKoncom(opponentOf(u0), vLinii);
      const po = apply(data, s, { type: "skipLiecba" }, 0).state;
      const e = po.starsi[0]!;
      expect(e.karta.uid).toBe(elderUid);
      expect(e.nahradeny).toBe(false);
      expect(e.marker).toBe(4);
      const h = po.hraci[u];
      expect(h.ruka.some((k) => k.uid === obcan.uid)).toBe(true);
      expect([...h.ruka, ...h.odhadzovaci, ...h.doberaci].some((k) => k.uid === elderUid)).toBe(false);
      // Odhodený (nie vypitý) poldeci: z 1 plného a 1 vypitého ostane len plný
      // (na začiatku kola sa nemá čo doliať).
      expect([h.poldeciPlne, h.poldeciVypite]).toEqual([1, 0]);
    }
  });

  it("staršieho z patronátu nemožno pochovať", () => {
    const { s, u, elderUid } = predKoncom(0, true);
    const st: GameState = {
      ...s,
      hraci: s.hraci.map((h, i) => (i === u ? { ...h, priznane: [...h.priznane, inst("cirhoza")] } : h)) as unknown as GameState["hraci"],
      bitkaStav: bitka({ krok: "liecba", caka: u, liecbaHotova: [u === 1, u === 0], vitaz: 0 }),
    };
    expect(legalCommands(data, st, u).some((c) => c.type === "pohreb" && c.kartaUid === elderUid)).toBe(false);
  });
});

describe("Pohoršenie: viac posunov, najviac dve hranice zón (Michal 2026-10-20)", () => {
  function vPohorseni(lokalita: string, marker: MarkerPos): GameState {
    const s0 = setupGame(data, 32);
    const lok = { uid: 69999, defId: lokalita, leftLayout: 0, rightLayout: 0 };
    return {
      ...s0,
      faza: "bitka",
      ciel: { typ: "lokalita", lokalita: lok },
      starsi: s0.starsi.map((e, i) => (i === 0 ? { ...e, marker, markerZaciatokKola: marker } : e)),
      bitkaStav: bitka({ krok: "pohorsenie", caka: 1, pohorsenieZostava: [0, 6] }),
    };
  }
  const posuvaj = (s: GameState): GameState => {
    let st = s;
    const id = s.starsi[0]!.elderId;
    for (let i = 0; i < 6; i++) {
      if (!legalCommands(data, st, 1).some((c) => c.type === "pohorsenie" && c.elderId === id)) break;
      st = apply(data, st, { type: "pohorsenie", elderId: id }, 1).state;
    }
    return st;
  };

  it("pravá sivá → ľavá oranžová (4 posuny) smie", () => {
    expect(posuvaj(vPohorseni("krcma", 5)).starsi[0]!.marker).toBe(1);
  });

  it("z pravej oranžovej len po ľavú sivú — tretia hranica nie", () => {
    expect(posuvaj(vPohorseni("krcma", 7)).starsi[0]!.marker).toBe(3);
  });

  it("Kultúrny dom limit ruší, na krajnú však Pohoršenie nesmie", () => {
    expect(posuvaj(vPohorseni("kulturny_dom", 7)).starsi[0]!.marker).toBe(1);
    expect(KONSTANTY.POHORSENIE_MAX_HRANIC).toBe(2);
  });
});

describe("bot nevidí súperovu kartu lícom dole", () => {
  it("zahmlenie nezávisí od toho, ktorá skrytá karta leží na scorecarde", () => {
    const { s, u, obcan } = vPatronate(2);
    const po = apply(data, s, { type: "patronat", elderId: s.starsi[0]!.elderId, uid: obcan.uid }, u).state;
    const druha = po.hraci[u].ruka.find((k) => k.defId === "noviny")!;
    // Vymeň kartu lícom dole s kartou v ruke — pre súpera je to ten istý stav.
    const vymeneny: GameState = {
      ...po,
      hraci: po.hraci.map((h, i) => (i === u ? { ...h, ruka: h.ruka.map((k) => (k.uid === druha.uid ? obcan : k)) } : h)) as unknown as GameState["hraci"],
      patronat: po.patronat.map((x, i) => (i === u && x !== null ? { ...x, nahrada: druha } : x)) as unknown as GameState["patronat"],
    };
    const a = zahmliStav(po, opponentOf(u), rngSeed(5))[0];
    const b = zahmliStav(vymeneny, opponentOf(u), rngSeed(5))[0];
    expect(a.patronat).toEqual(b.patronat);
    expect(a.hraci[u].ruka).toEqual(b.hraci[u].ruka);
  });
});
