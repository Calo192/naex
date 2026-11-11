// Rozloženie A (Michal 2026-11-11): kartu riadi výška stola, dlhá línia sa posúva
// a lokalita je po načítaní v strede bez napoly odrezanej karty.

import { describe, expect, it } from "vitest";
import { cielPosunu, sirkaPosuvnejLinie, skryteKarty, type Usek } from "../src/hra/posunLinie.ts";

const MOZNOSTI = { min: 72, strop: 340, zmensenie: 0.9 };
/** n kariet širokých `w` vedľa seba od 0. */
const rad = (n: number, w: number): Usek[] => Array.from({ length: n }, (_, i) => ({ lavo: i * w, pravo: (i + 1) * w }));

describe("šírka karty v posúvanej línii", () => {
  it("dlhá línia na notebooku: karta má výšku stola a línia sa posúva", () => {
    // 1512 × 860: výška stola dovolí 172 px, celá línia s 9 kartami by chcela ~110 px.
    expect(sirkaPosuvnejLinie(172, 1440, 9, MOZNOSTI)).toBe(172);
  });

  it("keď sa celá línia vojde pri karte menšej najviac o desatinu, karta sa zmenší", () => {
    // 2560 × 1080: 222 px z výšky, celá línia s 9 kartami pri 2480 px → 204 px (−8 %).
    expect(sirkaPosuvnejLinie(222, 2480, 9, MOZNOSTI)).toBe(204);
  });

  it("krátka línia ostane pri karte z výšky stola", () => {
    expect(sirkaPosuvnejLinie(222, 2480, 2, MOZNOSTI)).toBe(222);
  });

  it("strop a čitateľné minimum", () => {
    expect(sirkaPosuvnejLinie(900, 6000, 2, MOZNOSTI)).toBe(340);
    expect(sirkaPosuvnejLinie(40, 1400, 9, MOZNOSTI)).toBe(72);
  });
});

describe("karty za okrajom", () => {
  it("karta je skrytá, keď je jej stred mimo okna", () => {
    expect(skryteKarty(rad(10, 100), { lavo: 240, pravo: 760 })).toEqual({ vlavo: 2, vpravo: 2 });
  });

  it("celá línia v okne nemá nič za okrajom", () => {
    expect(skryteKarty(rad(4, 100), { lavo: 0, pravo: 500 })).toEqual({ vlavo: 0, vpravo: 0 });
  });
});

describe("vycentrovanie lokality", () => {
  it("lokalita v strede okna", () => {
    // obsah 2000, okno 800, lokalita 1000–1100 → stred 1050 − 400.
    expect(cielPosunu({ lavo: 1000, pravo: 1100 }, 2000, 800, 100)).toBe(650);
  });

  it("línia, ktorá sa vojde, sa neposúva", () => {
    expect(cielPosunu({ lavo: 300, pravo: 400 }, 700, 800, 100)).toBe(0);
  });

  it("kratší koniec, ktorý by vytŕčal o menej než kartu, sa ukáže celý", () => {
    // Stred by bol 60 px od začiatku — karta by bola odrezaná napoly, línia sa zarovná na začiatok.
    expect(cielPosunu({ lavo: 410, pravo: 510 }, 2000, 800, 100)).toBe(0);
    // Na druhom konci to isté.
    expect(cielPosunu({ lavo: 1500, pravo: 1600 }, 2000, 800, 100)).toBe(1200);
  });

  it("oba konce kratšie než karta: zarovná sa na kratší", () => {
    expect(cielPosunu({ lavo: 410, pravo: 510 }, 950, 800, 100)).toBe(0);
    expect(cielPosunu({ lavo: 440, pravo: 540 }, 950, 800, 100)).toBe(150);
  });
});
