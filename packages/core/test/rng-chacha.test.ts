// Náhoda ostrých partií (strážca 2026-11-04): 31-bitové semienko mulberry32 sa
// dalo z prvého pohľadu dopočítať hrubou silou a s ním celé rozdanie. Server
// preto rozdáva so 256-bitovým kľúčom ChaCha20; číselné semienka (testy, boti,
// odtlačok hry, staré partie v archíve) musia ostať bit po bite rovnaké.

import { createCipheriv, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import cardsJson from "../data/cards.json";
import eldersJson from "../data/elders.json";
import scorecardsJson from "../data/scorecards.json";
import { chachaBlok, loadGameData, rngInt, rngNext, rngSeed, rngShuffle, semienkoChacha, setupGame } from "../src/index.ts";
import type { RngState } from "../src/index.ts";

/** n čísel z generátora ako uint32. */
const slova = (s0: RngState, n: number): number[] => {
  const out: number[] = [];
  let s = s0;
  for (let i = 0; i < n; i++) {
    const [v, d] = rngNext(s);
    out.push(v * 4294967296);
    s = d;
  }
  return out;
};

describe("rng — ChaCha20 pre ostré partie", () => {
  it("blok sedí s ChaCha20 z OpenSSL (node:crypto) pre ten istý kľúč, počítadlo aj nonce", () => {
    const kluc = randomBytes(32);
    const nonce = randomBytes(12);
    const iv = Buffer.concat([Buffer.from([7, 0, 0, 0]), nonce]);
    const prud = createCipheriv("chacha20", kluc, iv).update(Buffer.alloc(64));
    const k = Array.from({ length: 8 }, (_, i) => kluc.readUInt32LE(i * 4));
    const n = [nonce.readUInt32LE(0), nonce.readUInt32LE(4), nonce.readUInt32LE(8)] as const;
    const ocakavane = Array.from({ length: 16 }, (_, i) => prud.readUInt32LE(i * 4));
    expect(chachaBlok(k, 7, n)).toEqual(ocakavane);
  });

  it("prúd čísel zo semienka je keystream ChaCha20 (blok po bloku, cez hranicu 16 slov)", () => {
    const kluc = randomBytes(32);
    const prud = createCipheriv("chacha20", kluc, Buffer.alloc(16)).update(Buffer.alloc(64 * 3));
    const ocakavane = Array.from({ length: 48 }, (_, i) => prud.readUInt32LE(i * 4));
    expect(slova(rngSeed(semienkoChacha(kluc)), 48)).toEqual(ocakavane);
  });

  it("je deterministický a nemenný: ten istý stav dá vždy to isté číslo", () => {
    const s = rngSeed(semienkoChacha(randomBytes(32)));
    const [a, s1] = rngInt(s, 1000);
    const [b] = rngInt(s, 1000);
    expect(a).toBe(b);
    expect(slova(s1, 40)).toEqual(slova(s1, 40));
    expect(JSON.parse(JSON.stringify(s1))).toEqual(s1);
  });

  it("číselné semienko ostáva mulberry32 (odtlačok hry, staré partie)", () => {
    // Pôvodný mulberry32 doslova — stav je číslo a postupnosť sa nesmie zmeniť.
    const mulberry = (seed: number, n: number): number[] => {
      const out: number[] = [];
      let st = seed >>> 0;
      for (let i = 0; i < n; i++) {
        let t = (st + 0x6d2b79f5) >>> 0;
        st = t;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        out.push((t ^ (t >>> 14)) >>> 0);
      }
      return out;
    };
    expect(rngSeed(26)).toBe(26);
    for (const seed of [0, 1, 26, 2 ** 31 - 1, 123456789]) expect(slova(rngSeed(seed), 50)).toEqual(mulberry(seed, 50));
    const [zamiesane, po] = rngShuffle(rngSeed(12345), [1, 2, 3, 4, 5, 6, 7, 8]);
    expect(zamiesane).toHaveLength(8);
    expect(typeof po).toBe("number");
  });

  it("semienko má presný tvar; iné odmietne", () => {
    expect(semienkoChacha(new Uint8Array(32).fill(0xab))).toBe(`c20:${"ab".repeat(32)}`);
    expect(() => semienkoChacha(new Uint8Array(16))).toThrow();
    expect(() => rngSeed("c20:abc")).toThrow();
    expect(() => rngSeed(`c20:${"AB".repeat(32)}`)).toThrow();
  });

  it("partia sa rozdá zo semienka ChaCha20 a rovnaké semienko dá rovnaké rozdanie", () => {
    const data = loadGameData(cardsJson, eldersJson, scorecardsJson);
    const seed = semienkoChacha(randomBytes(32));
    const a = setupGame(data, seed);
    expect(setupGame(data, seed)).toEqual(a);
    expect(typeof a.rng).toBe("object");
    const ine = setupGame(data, semienkoChacha(randomBytes(32)));
    expect(ine.obcania.map((k) => k.defId)).not.toEqual(a.obcania.map((k) => k.defId));
  });
});
