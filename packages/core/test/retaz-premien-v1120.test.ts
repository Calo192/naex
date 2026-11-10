// Reťaz premien (v11.20, Michal 2026-11-10: „Áno, reťazí sa všetko.“, PRAVIDLA §6 a §12): reťazia
// sa aj dvaja Školitelia na tej istej karte a dva Nástroje pod Zámočníkom. Poradie: Školitelia
// (Podpora a Konflikt v poradí spustenia, potom Furt — skôr sused bližšie k lokalite), potom
// Nástroje v poradí podloženia; každá premena pracuje na výsledku predošlej.

import { describe, expect, it } from "vitest";
import type { CardInstance, LineState, PlacedCard, PlayerId, PodlozenyNastroj } from "../src/index.ts";
import { evaluateLine, ponukaPodlozenia, preskoleniaHostitela } from "../src/index.ts";
import type { Layout4 } from "./helpers.ts";
import { EMPTY, instanceFor, makeDef, syntheticData } from "./helpers.ts";

const RANY: Layout4 = ["Rana", "Rana", "Rana", "Rana"];
const PECEN: Layout4 = ["PoškodeniePečene", "PoškodeniePečene", "PoškodeniePečene", "PoškodeniePečene"];
const CIGARETY: Layout4 = ["Cigareta", "Cigareta", "Cigareta", "Cigareta"];

const d = syntheticData([
  makeDef("cil", RANY, RANY, { tags: ["Občan"] }),
  makeDef("partner", RANY, RANY, { tags: ["Občan"] }),
  makeDef("zamocnik", PECEN, PECEN, { tags: ["Občan"] }),
  makeDef("furt_rana", CIGARETY, CIGARETY, { tags: ["Občan"], triggers: ["Furt"], effectText: "Furt: Preškolenie {Rana}→{Pecka}." }),
  makeDef("furt_pecka", CIGARETY, CIGARETY, { tags: ["Občan"], triggers: ["Furt"], effectText: "Furt: Preškolenie {Pecka}→{Petelica}." }),
  makeDef("klieste", EMPTY, EMPTY, { tags: ["Nástroj"], effectText: "Hore: {Pečeň}→{Rana}. Dole: {Rana}→{Pečeň}." }),
  makeDef("vidly", EMPTY, EMPTY, { tags: ["Nástroj"], effectText: "Hore: {Rana}→{Pecka}. Dole: {Pecka}→{Rana}." }),
]);

const lezi = (card: CardInstance, playedBy: PlayerId, x: Partial<PlacedCard> = {}): PlacedCard => ({ card, playedBy, ...x });
const linia = (strana0: PlacedCard[]): LineState => ({ lokalita: null, lokalitaOtocena: false, strany: [strana0, []] });
const sloty = (ev: ReturnType<typeof evaluateLine>, uid: number) => [...(ev.cards.get(uid)?.left ?? []), ...(ev.cards.get(uid)?.right ?? [])].filter((x) => x !== null);
const pod = (card: CardInstance, hrana: "horna" | "dolna" = "horna"): PodlozenyNastroj => ({ card, majitel: 0, hrana });

describe("dvaja Školitelia na tej istej karte sa reťazia (v11.20)", () => {
  const sypac = 880001;
  const tiper = 880002;
  const ranaPecka = { z: "Rana", na: "Pecka", od: sypac, spustac: "Podpora" } as const;
  const peckaPetelica = { z: "Pecka", na: "Petelica", od: tiper, spustac: "Konflikt" } as const;

  it("Podpora Rana → Pecka, potom Konflikt Pecka → Petelica: z Rany je Petelica, v slote celá reťaz", () => {
    const cil = instanceFor(d, "cil", RANY, RANY);
    const ev = evaluateLine(d, linia([lezi(cil, 0, { preskolenia: [ranaPecka, peckaPetelica] }), lezi(instanceFor(d, "partner", RANY, RANY), 1)]));
    for (const s of sloty(ev, cil.uid)) {
      expect(s).toMatchObject({ action: "Petelica", povodna: "Rana", preskolil: sypac });
      expect(s.retaz).toEqual([
        { uid: sypac, na: "Pecka" },
        { uid: tiper, na: "Petelica" },
      ]);
    }
    // Obe premeny sa rátajú na všetkých ôsmich akciách — obe pečate svietia.
    expect(ev.cards.get(cil.uid)?.preskolena?.map((p) => [p.zdroj, p.z, p.na, p.akcii])).toEqual([
      ["Podpora", "Rana", "Pecka", 8],
      ["Konflikt", "Pecka", "Petelica", 8],
    ]);
  });

  it("opačné poradie spustenia: Pecka → Petelica prišla skôr, Rane nič nespraví — ostane Pecka", () => {
    const cil = instanceFor(d, "cil", RANY, RANY);
    const ev = evaluateLine(d, linia([lezi(cil, 0, { preskolenia: [peckaPetelica, ranaPecka] }), lezi(instanceFor(d, "partner", RANY, RANY), 1)]));
    for (const s of sloty(ev, cil.uid)) expect(s).toMatchObject({ action: "Pecka", povodna: "Rana", preskolil: sypac });
    expect(ev.cards.get(cil.uid)?.preskolena?.map((p) => [p.zdroj, p.akcii])).toEqual([
      ["Konflikt", 0],
      ["Podpora", 8],
    ]);
  });

  it("dvaja Furt susedia: najprv ten bližšie k lokalite (ležal skôr), potom vonkajší", () => {
    const cil = instanceFor(d, "cil", RANY, RANY);
    const vnutri = (id: string) => instanceFor(d, id, CIGARETY, CIGARETY);
    // strany[0][0] leží pri lokalite; cieľ je medzi vnútorným [0] a vonkajším [2] susedom.
    const ev = (vnutorny: string, vonkajsi: string) => evaluateLine(d, linia([lezi(vnutri(vnutorny), 1), lezi(cil, 0), lezi(vnutri(vonkajsi), 1)]));
    expect(sloty(ev("furt_rana", "furt_pecka"), cil.uid).map((s) => s.action)).toEqual(Array(8).fill("Petelica"));
    expect(sloty(ev("furt_pecka", "furt_rana"), cil.uid).map((s) => s.action)).toEqual(Array(8).fill("Pecka"));
  });
});

describe("dva Nástroje pod Zámočníkom sa reťazia v poradí podloženia (v11.20)", () => {
  const zamocnik = (): CardInstance => instanceFor(d, "zamocnik", PECEN, PECEN);
  const klieste = instanceFor(d, "klieste", EMPTY, EMPTY);
  const vidly = instanceFor(d, "vidly", EMPTY, EMPTY);

  it("Kliešte Pečeň → Rana, potom Vidly Rana → Pecka: z Pečene je Pecka; opačne len Rana", () => {
    expect(preskoleniaHostitela(d, { podlozene: [pod(klieste), pod(vidly)] }).get("PoškodeniePečene")).toEqual({
      na: "Pecka",
      uid: klieste.uid,
      retaz: [
        { uid: klieste.uid, na: "Rana" },
        { uid: vidly.uid, na: "Pecka" },
      ],
    });
    expect(preskoleniaHostitela(d, { podlozene: [pod(vidly), pod(klieste)] }).get("PoškodeniePečene")).toEqual({ na: "Rana", uid: klieste.uid });
    const z = zamocnik();
    const ev = evaluateLine(d, linia([lezi(z, 0, { podlozene: [pod(klieste), pod(vidly)] }), lezi(instanceFor(d, "partner", RANY, RANY), 1)]));
    for (const s of sloty(ev, z.uid)) expect(s).toMatchObject({ action: "Pecka", povodna: "PoškodeniePečene", preskolil: klieste.uid, retaz: [{ uid: klieste.uid, na: "Rana" }, { uid: vidly.uid, na: "Pecka" }] });
  });

  it("ponuka podloženia ukáže celú reťaz: Vidly hore pod Zámočníkom s Kliešťami premenia Pečeň cez Ranu na Pecku", () => {
    const z = zamocnik();
    const line = linia([lezi(z, 0, { podlozene: [pod(klieste)] }), lezi(instanceFor(d, "partner", RANY, RANY), 1)]);
    const ponuka = ponukaPodlozenia(d, line, vidly, 0).filter((m) => m.hostitel === z.uid);
    expect(ponuka.map((m) => [m.hrana, m.maCoRobit, m.popis])).toEqual([
      ["horna", true, "Pečeň ×8 → Rana ×8 → Pecka ×8"],
      ["dolna", false, "nemá Pecka"],
    ]);
  });
});
