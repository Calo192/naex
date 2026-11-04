// Deterministická náhoda.
//
// Jediný zdroj náhody v celej hre. Stav generátora žije v GameState a každé
// použitie vracia NOVÝ stav (žiadna mutácia) — rovnaké semienko + rovnaké
// príkazy = rovnaká hra, čo je podmienka reprodukovania chýb aj replayov.
//
// Dva generátory podľa druhu semienka:
// - číslo → mulberry32 (testy, boti, odtlačok hry, staré partie v archíve);
//   32-bitový stav sa dá z rozdania dopočítať hrubou silou, preto ho server
//   na ostré partie nepoužíva;
// - reťazec „c20:<64 hex>“ → ChaCha20 s 256-bitovým kľúčom (ostré partie na
//   serveri). Z toho, čo hráč vidí, sa stav uhádnuť nedá (strážca 2026-11-04).

/** Semienko rozdania: číslo (mulberry32) alebo „c20:<64 hex>“ (ChaCha20). */
export type Semienko = number | string;

/** Stav ChaCha20: kľúč, číslo bloku, jeho výstup a index ďalšieho nepoužitého slova. */
export interface ChachaStav {
  readonly k: readonly number[];
  readonly n: number;
  readonly b: readonly number[];
  readonly i: number;
}

export type RngState = number | ChachaStav;

const PREDPONA_CHACHA = "c20:";
const CHACHA_HEX = /^c20:[0-9a-f]{64}$/;

/** Semienko pre ChaCha20 z 32 bajtov náhody (server ich berie z node:crypto). */
export function semienkoChacha(bajty: ArrayLike<number>): string {
  if (bajty.length !== 32) throw new Error("Semienko ChaCha20 potrebuje 32 bajtov.");
  let hex = "";
  for (let i = 0; i < 32; i++) hex += ((bajty[i] ?? 0) & 0xff).toString(16).padStart(2, "0");
  return PREDPONA_CHACHA + hex;
}

export function rngSeed(seed: Semienko): RngState {
  if (typeof seed === "number") {
    // >>> 0 normalizuje na uint32, aby bol stav vždy rovnaký typ hodnoty.
    return seed >>> 0;
  }
  if (!CHACHA_HEX.test(seed)) throw new Error(`Neplatné semienko: ${seed.slice(0, 12)}…`);
  const k: number[] = [];
  // Slová kľúča little-endian, ako v RFC 8439.
  for (let w = 0; w < 8; w++) {
    let slovo = 0;
    for (let j = 3; j >= 0; j--) {
      const o = PREDPONA_CHACHA.length + (w * 4 + j) * 2;
      slovo = (slovo << 8) | parseInt(seed.slice(o, o + 2), 16);
    }
    k.push(slovo >>> 0);
  }
  return { k, n: 0, b: chachaBlok(k, 0), i: 0 };
}

const rotl = (x: number, c: number): number => (x << c) | (x >>> (32 - c));

/** Jeden 64-bajtový blok ChaCha20 (RFC 8439) ako 16 slov uint32. */
export function chachaBlok(k: readonly number[], pocitadlo: number, nonce: readonly [number, number, number] = [0, 0, 0]): number[] {
  const vstup = [
    0x61707865, 0x3320646e, 0x79622d32, 0x6b206574,
    ...k,
    pocitadlo >>> 0, nonce[0], nonce[1], nonce[2],
  ];
  const x = vstup.slice();
  const qr = (a: number, b: number, c: number, d: number): void => {
    x[a] = (x[a]! + x[b]!) | 0; x[d] = rotl(x[d]! ^ x[a]!, 16);
    x[c] = (x[c]! + x[d]!) | 0; x[b] = rotl(x[b]! ^ x[c]!, 12);
    x[a] = (x[a]! + x[b]!) | 0; x[d] = rotl(x[d]! ^ x[a]!, 8);
    x[c] = (x[c]! + x[d]!) | 0; x[b] = rotl(x[b]! ^ x[c]!, 7);
  };
  for (let r = 0; r < 10; r++) {
    qr(0, 4, 8, 12); qr(1, 5, 9, 13); qr(2, 6, 10, 14); qr(3, 7, 11, 15);
    qr(0, 5, 10, 15); qr(1, 6, 11, 12); qr(2, 7, 8, 13); qr(3, 4, 9, 14);
  }
  return x.map((v, i) => (v + vstup[i]!) >>> 0);
}

/** Vráti [náhodné číslo z [0,1), nový stav]. */
export function rngNext(state: RngState): [number, RngState] {
  if (typeof state !== "number") {
    // Blok sa zdieľa medzi stavmi (je nemenný) — nový sa počíta raz za 16 čísel.
    const s = state.i < 16 ? state : { k: state.k, n: state.n + 1, b: chachaBlok(state.k, state.n + 1), i: 0 };
    return [(s.b[s.i] ?? 0) / 4294967296, { k: s.k, n: s.n, b: s.b, i: s.i + 1 }];
  }
  let t = (state + 0x6d2b79f5) >>> 0;
  const next = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, next];
}

/** Celé číslo z [0, n). */
export function rngInt(state: RngState, n: number): [number, RngState] {
  const [value, next] = rngNext(state);
  return [Math.floor(value * n), next];
}

/** Fisher–Yates — vráti nové pole, vstup nemení. */
export function rngShuffle<T>(state: RngState, items: readonly T[]): [T[], RngState] {
  const result = [...items];
  let s = state;
  for (let i = result.length - 1; i > 0; i--) {
    const [j, next] = rngInt(s, i + 1);
    s = next;
    const a = result[i] as T;
    result[i] = result[j] as T;
    result[j] = a;
  }
  return [result, s];
}
