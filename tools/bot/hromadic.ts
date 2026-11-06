// Súper „hromadič“ (Michal 2026-11-06): človek, ktorý bitky pred finále neženie, zbiera cigarety
// a karty a všetko dá do finále, kde Nakladačka platí 1 špak za bod bez stropu.
//
// Hrá len z verejného stavu a svojej ruky a bota zámerne nevolá — musí to byť rovnaký súper
// pre starého aj nového bota. Bitku berie vážne len vo finále a keď súperovi chýba jediný krok
// k okamžitej výhre (strach, väzni), lebo tú by žiadny rozumný človek nedaroval.

import type { Action, CardInstance, Command, GameData, GameState, PlayerId } from "../../packages/core/src/index.ts";
import {
  KONSTANTY,
  apply,
  cervenychHraca,
  evaluateLine,
  krokStavby,
  legalCommands,
  lineState,
  poskodenieBitky,
  printedSides,
  sNaexNaKartach,
  vazniHraca,
  vazniNaVyhru,
} from "../../packages/core/src/index.ts";
import { defOf } from "../../packages/core/src/index.ts";

const TUHE: Partial<Record<Action, number>> = { Rana: 1, Pecka: 2, Petelica: 3 };

/** Sila karty vo finále: tuhé akcie a to, čo ich násobí; kliatby na konci. */
function silaKarty(data: GameData, karta: CardInstance): number {
  const tags = defOf(data, karta).tags;
  if (tags.includes("Kliatba") && !tags.includes("Občan")) return -5;
  const strany = printedSides(data, karta);
  let v = 0;
  for (const slot of [...strany.left, ...strany.right]) {
    if (slot === null) continue;
    v += TUHE[slot] ?? (slot === "Posilnenie" ? 1.5 : slot === "Cigareta" ? 0.5 : slot === "Dlh" || slot === "PoškodeniePečene" ? -0.5 : 0.2);
  }
  return v;
}

/** Rozdiel tuhého v línii z pohľadu p (vlastné skryté NA EX odkryté). */
function rozdielTuheho(data: GameData, s: GameState, p: PlayerId): number {
  const st = sNaexNaKartach(s);
  const d = poskodenieBitky(data, st, evaluateLine(data, lineState(st)).sums);
  return d.tuhe[p] - d.tuhe[p === 0 ? 1 : 0];
}

/** Chýba súperovi jediný krok k okamžitej výhre? */
function hroziKoniec(s: GameState, p: PlayerId): boolean {
  const su: PlayerId = p === 0 ? 1 : 0;
  return cervenychHraca(s, su) >= KONSTANTY.CERVENYCH_NA_VYHRU - 1 || vazniHraca(s, su).length >= vazniNaVyhru(s.lokalitCelkom) - 1;
}

/** Príkaz s najväčším zlepšením tuhého o viac než `prah`; null, keď žiadny. */
function najlepsiNaTuhe(data: GameData, s: GameState, p: PlayerId, cmds: readonly Command[], prah: number): Command | null {
  let best: Command | null = null;
  let bestV = rozdielTuheho(data, s, p) + prah;
  for (const c of cmds) {
    let v: number;
    try {
      v = rozdielTuheho(data, apply(data, s, c, p).state, p);
    } catch {
      continue;
    }
    if (v > bestV) {
      bestV = v;
      best = c;
    }
  }
  return best;
}

const doLinie = (c: Command): boolean => c.type === "place" && (c.target === "vlastna" || c.target === "superova");

/** Čo línia hráčovi p sype v každej Pitke: cigarety a Vízie mínus Dlhy a pečeň. */
function prijemLinie(data: GameData, s: GameState, p: PlayerId): number {
  const su = evaluateLine(data, lineState(s)).sums[p];
  return (su.Cigareta ?? 0) + (su["Vízia"] ?? 0) - 0.5 * (su.Dlh ?? 0) - 0.5 * (su.PoškodeniePečene ?? 0);
}

/** Karta, ktorá najviac zvýši príjem línie, aspoň o 1; bitka ho pritom nezaujíma. */
function najlepsiNaPrijem(data: GameData, s: GameState, p: PlayerId, cmds: readonly Command[]): Command | null {
  let best: Command | null = null;
  let bestV = prijemLinie(data, s, p) + 0.9;
  for (const c of cmds) {
    let v: number;
    try {
      v = prijemLinie(data, apply(data, s, c, p).state, p);
    } catch {
      continue;
    }
    if (v > bestV) {
      bestV = v;
      best = c;
    }
  }
  return best;
}

/** Sila karty pre ekonóma pred finále: hlavne to, čo sype cigarety a karty. */
function prijemKarty(data: GameData, karta: CardInstance): number {
  const strany = printedSides(data, karta);
  let v = 0.1 * silaKarty(data, karta);
  for (const slot of [...strany.left, ...strany.right]) if (slot === "Cigareta" || slot === "Vízia") v += 1;
  return v;
}

/**
 * Ekonóm: to isté čo hromadič, ale pred finále si kupuje a vykladá karty, ktoré sypú cigarety a
 * Vízie (ako Michal v partii 17: 23 aktívnych Cigariet a 15 Vízií, cigarety mimo pasov 38 : 3).
 */
export function ekonom(data: GameData, s: GameState, p: PlayerId, seed: number): Command {
  const finale = s.ciel?.typ === "finale";
  if (finale || hroziKoniec(s, p)) return hromadic(data, s, p, seed);
  const cmds = legalCommands(data, s, p).filter((c) => c.type !== "schopnostVazna");
  if (s.faza === "draft" && s.draftStav?.krok === "beranie") {
    const [a] = [...s.senok].sort((x, y) => prijemKarty(data, y) - prijemKarty(data, x));
    const stop = cmds.find((c) => c.type === "draftStop");
    if (a !== undefined && prijemKarty(data, a) >= 1 && s.hraci[p].cigarety >= 1) {
      const jedna = cmds.find((c) => c.type === "draftBer" && c.uids.length === 1 && c.uids[0] === a.uid);
      if (jedna !== undefined) return jedna;
    }
    if (stop !== undefined && (s.hraci[p].cigarety < 3 || a === undefined)) return stop;
  }
  if (s.faza === "zhromazdenie") {
    const karta = najlepsiNaPrijem(data, s, p, cmds.filter(doLinie));
    if (karta !== null) return karta;
  }
  return hromadic(data, s, p, seed);
}

/** Ťah hotového bota — budovateľ ním hrá kolá, v ktorých už bojuje. */
export type TahBota = (data: GameData, s: GameState, p: PlayerId, seed: number, nastavenia: { povaha: string }) => Command;

/**
 * Budovateľ (Michal, partia 17): prvú tretinu kôl obetuje za cigarety a karty ako ekonóm, potom hrá
 * kartami rozumne — výpočtom bota z pevnej kópie, aby to bol rovnaký súper pre starého aj nového.
 * Po K2 prehrával 3 : 21, vyhral K3, K4 a finále: vedenie z prvých kôl nič neznamená.
 */
export function budovatel(data: GameData, s: GameState, p: PlayerId, seed: number, bot: TahBota): Command {
  const koloObety = Math.ceil((s.rozpis?.length ?? 6) / 3);
  if (s.kolo <= koloObety && !hroziKoniec(s, p)) return ekonom(data, s, p, seed);
  return bot(data, s, p, seed, { povaha: "stamgast" });
}

export function hromadic(data: GameData, s: GameState, p: PlayerId, seed: number): Command {
  const cmds = legalCommands(data, s, p).filter((c) => c.type !== "schopnostVazna");
  const nahodny = (): Command => cmds[seed % cmds.length] as Command;
  const h = s.hraci[p];
  const finale = s.ciel?.typ === "finale";
  const vazne = finale || hroziKoniec(s, p);

  switch (s.faza) {
    case "draft": {
      const d = s.draftStav;
      if (d?.krok === "stavba") {
        // Najslabšie do šenku, silné naspodok vlastného balíčka — dofajčí si ich za 1 cigaretu.
        const moje = [...d.balicky[p]].sort((a, b) => silaKarty(data, a) - silaKarty(data, b));
        const krok = krokStavby(moje.length);
        return { type: "stavbaSenku", doSenku: moje.slice(0, krok.doSenku).map((x) => x.uid), odhod: moje.slice(krok.doSenku).map((x) => x.uid) };
      }
      const podlaSily = [...s.senok].sort((a, b) => silaKarty(data, b) - silaKarty(data, a));
      const [a, b] = podlaSily;
      const stop = cmds.find((c) => c.type === "draftStop");
      if (finale && a !== undefined && b !== undefined && h.cigarety >= 4) {
        const dve = cmds.find((c) => c.type === "draftBer" && c.uids.length === 2 && c.uids.includes(a.uid) && c.uids.includes(b.uid));
        if (dve !== undefined) return dve;
      }
      // Pred finále berie silnú kartu po 1 cigarete a drží si rezervu na fajčenie a doliatie.
      if (a !== undefined && silaKarty(data, a) >= 2 && h.cigarety >= (finale ? 1 : 3)) {
        const jedna = cmds.find((c) => c.type === "draftBer" && c.uids.length === 1 && c.uids[0] === a.uid);
        if (jedna !== undefined) return jedna;
      }
      return stop ?? nahodny();
    }
    case "zhromazdenie": {
      const pas = cmds.find((c) => c.type === "pass");
      // Pas je celý plán: cigareta za každú kartu, ktorú ešte smel vyložiť.
      if (!vazne) return pas ?? nahodny();
      return najlepsiNaTuhe(data, s, p, cmds.filter(doLinie), 0) ?? pas ?? nahodny();
    }
    case "pitka": {
      if (s.vizia !== null) return cmds.find((c) => c.type === "vizia" && c.vziat) ?? nahodny();
      if (s.pitkaStav?.reakcia === p) {
        const odpoved = vazne ? najlepsiNaTuhe(data, s, p, cmds.filter(doLinie), 0) : null;
        return odpoved ?? cmds.find((c) => c.type === "bezReakcie") ?? nahodny();
      }
      const refill = cmds.find((c) => c.type === "refillPoldeci");
      const barter = cmds.find((c) => c.type === "barter");
      const smoke = cmds.find((c) => c.type === "smoke");
      const fajcil = s.pitkaStav?.fajcenie[p] ?? 0;
      // Vypité poldeci dolieva: vo finále každý plný znamená kartu navyše v limite (alebo špak z výkupného).
      if (refill !== undefined && h.cigarety >= 4) return refill;
      if (barter !== undefined && h.cigarety >= 9) return barter;
      // Prvé fajčenie v Pitke stojí 1 cigaretu; vo finále dofajčí aj druhé, ak mu ostane z čoho.
      if (smoke !== undefined && (fajcil === 0 ? h.cigarety >= (finale ? 1 : 3) : finale && fajcil === 1 && h.cigarety >= 3)) return smoke;
      if (vazne) {
        // NA EX, keď pohne rozdielom tuhého aspoň o 2 — vo finále je každý bod špak.
        const naex = najlepsiNaTuhe(data, s, p, cmds.filter((c) => c.type === "naex"), 1);
        if (naex !== null) return naex;
      }
      return cmds.find((c) => c.type === "skipNaex") ?? nahodny();
    }
    default:
      return nahodny();
  }
}
