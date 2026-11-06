// Odhad špakov po kole musí sedieť so skutočnou výplatou. Bitka beží v jednom apply, preto sa
// odhad ráta zo stavu tesne pred ňou s Dlhmi a poškodením, s ktorými do nej vstúpila, a porovná
// sa so záznamom na nástenke. Krádež pri zajatí v odhade zámerne nie je a nástenka ju nemá.

import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import type { BitkaNaNastenke, Command, Event, GameState, OdhadSpakov } from "../src/index.ts";
import { apply, evaluateLine, kartyBitky, legalCommands, lineState, loadGameData, naTahu, odhadSpakovKola, rngInt, rngSeed, setupGame } from "../src/index.ts";

const data = loadGameData(cardsJson, eldersJson, scorecardsJson);

type VysledokBitky = Extract<Event, { readonly type: "bitkaVysledok" }>;
const jeVysledok = (e: Event): e is VysledokBitky => e.type === "bitkaVysledok";

/** Prejde náhodné partie; pre každú porovnateľnú bitku zavolá `pri` s odhadom a hotovým záznamom. */
function prejdiBitky(pri: (o: OdhadSpakov, z: BitkaNaNastenke) => void): number {
  let pocet = 0;
  for (let seed = 1; seed <= 40; seed++) {
    let state: GameState = setupGame(data, seed * 37, { lokalit: 3 });
    let rng = rngSeed(seed ^ 0x5eed);
    let cakajuci: { readonly o: OdhadSpakov; readonly index: number } | null = null;
    for (let i = 0; i < 8000 && state.koniec === null; i++) {
      const hrac = naTahu(state);
      if (hrac === null) break;
      const cmds = legalCommands(data, state, hrac);
      if (cmds.length === 0) break;
      const [idx, dalsi] = rngInt(rng, cmds.length);
      rng = dalsi;
      const { state: po, events } = apply(data, state, cmds[idx] as Command, hrac);
      const vysledok = events.find(jeVysledok);
      if (vysledok?.rekap !== undefined && po.koniec === null) {
        const linia = evaluateLine(data, lineState(state));
        // Efekty na začiatku bitky a skryté NA EX menia súčty oproti stavu pred ťahom — také bitky sa nedajú porovnať.
        // Skrytá Záverečná sa otočí až v bitke a jej efekt (Kôň páli viac Dlhov) súčty nezmení, ale čísla áno.
        const rovnakaLinia = JSON.stringify(linia.sums) === JSON.stringify(vysledok.sums) && !state.strany.some((st) => st.some((pl) => pl.zaverecna === true));
        const zaznam = po.nastenka[po.nastenka.length - 1];
        if (rovnakaLinia && zaznam !== undefined && zaznam.karty === kartyBitky(state).spolu) {
          const hraci = [
            { ...state.hraci[0], dlhy: vysledok.rekap.priznaneDlhy[0] },
            { ...state.hraci[1], dlhy: vysledok.rekap.priznaneDlhy[1] },
          ] as unknown as GameState["hraci"];
          cakajuci = { o: odhadSpakovKola(data, { ...state, hraci }, linia, vysledok.damage), index: po.nastenka.length - 1 };
        }
      }
      if (cakajuci !== null && po.faza !== "bitka") {
        const z = po.nastenka[cakajuci.index];
        if (z !== undefined && po.koniec === null) {
          pri(cakajuci.o, z);
          pocet++;
        }
        cakajuci = null;
      }
      state = po;
    }
  }
  return pocet;
}

describe("odhadSpakovKola", () => {
  it("rozpis sedí so súčtom", () => {
    prejdiBitky((o) => {
      for (const r of o.hraci) expect(r.spolu).toBe(r.zaBitku + r.nakladacka + r.hadka + r.starsi + r.robota - r.exekutor);
    });
  });

  it("každá položka sedí so záznamom bitky na nástenke", () => {
    const pocet = prejdiBitky((o, z) => {
      expect(o.vitaz).toBe(z.vitaz);
      for (const p of [0, 1] as const) {
        const r = o.hraci[p];
        expect(r.zaBitku).toBe(z.zaBitku[p]);
        expect(r.nakladacka).toBe(z.prebytok[p]);
        expect(r.hadka).toBe(z.hadkaSpaky?.[p] ?? 0);
        expect(r.starsi).toBe(z.zaStarsich[p]);
        expect(r.robota).toBe(z.robota?.[p] ?? 0);
        expect(r.exekutor).toBe(z.exekutor[p]);
      }
    });
    expect(pocet).toBeGreaterThan(20);
  });
});
