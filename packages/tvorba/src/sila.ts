// Hromadná simulácia sily kariet: tisíce náhodných línií vyhodnotených jadrom
// (evaluateLine), rovnako ako v bitke. Ukazuje, koľko karta v priemere
// spraví, keď leží v línii — podklad pre rebalans popri štatistikách
// z partií. Čistá funkcia so seedovaným generátorom (bez I/O a Math.random).

import type { CardInstance, GameData, PlacedCard, PlayerId } from "@naex/core";
import { evaluateLine, prispevkyKariet, rngInt, rngSeed } from "@naex/core";
import type { RngState } from "@naex/core";

export interface SilaKarty {
  readonly defId: string;
  readonly nazov: string;
  /** Koľkokrát karta ležala v simulovanej línii. */
  readonly vyskytov: number;
  /** Priemerné tuhé poškodenie z jej aktívnych akcií na výskyt. */
  readonly tuhe: number;
  /** Priemer aktívnych akcií na výskyt (s násobkami). */
  readonly aktivne: number;
  /** Podiel vytlačených akcií, ktoré sa aktivovali (0–1, násobky sa neštepia). */
  readonly aktivacia: number;
  /** Priemer aktívnych kliatbových akcií (Dlh, Poškodenie pečene) na výskyt. */
  readonly zle: number;
}

export interface NastaveniaSimulacie {
  readonly pokusov: number;
  readonly seed: number;
  /** Najviac kariet na jednej strane línie (1–4). */
  readonly naStranu?: number;
}

const MIMO_LINIE = ["Lokalita", "Kliatba", "Starešina"];

/**
 * Náhodné línie: náhodná lokalita a otočenie, na každej strane 1–naStranu
 * náhodných kariet z balíčka (bez lokalít, kliatob a starších) v náhodnom
 * variante, každá patrí hráčovi svojej strany.
 */
export function silaKariet(data: GameData, nastavenia: NastaveniaSimulacie): SilaKarty[] {
  const pool = [...data.cards.values()].filter((c) => !c.tags.some((t) => MIMO_LINIE.includes(t)) && (data.variants.get(c.id)?.total ?? 0) > 0);
  if (pool.length === 0) return [];
  const naStranu = Math.min(4, Math.max(1, nastavenia.naStranu ?? 4));
  let rng: RngState = rngSeed(nastavenia.seed);
  const nahodne = (n: number): number => {
    const [x, r] = rngInt(rng, n);
    rng = r;
    return x;
  };
  const sucty = new Map<string, { vyskytov: number; tuhe: number; aktivne: number; akcii: number; aktivovane: number; zle: number }>();
  let uid = 1;

  for (let i = 0; i < nastavenia.pokusov; i++) {
    const lokalita = data.lokality.length === 0 ? null : (data.lokality[nahodne(data.lokality.length)] ?? null);
    const lokInst: CardInstance | null = lokalita === null ? null : { uid: uid++, defId: lokalita.id, leftLayout: 0, rightLayout: 0 };
    const strana = (p: PlayerId): PlacedCard[] =>
      Array.from({ length: 1 + nahodne(naStranu) }, () => {
        const def = pool[nahodne(pool.length)];
        const v = def === undefined ? undefined : data.variants.get(def.id);
        if (def === undefined || v === undefined) throw new Error("Prázdny výber kariet.");
        const card: CardInstance = { uid: uid++, defId: def.id, leftLayout: nahodne(Math.max(1, v.left.length)), rightLayout: nahodne(Math.max(1, v.right.length)) };
        return { card, playedBy: p };
      });
    const line = { lokalita: lokInst, lokalitaOtocena: nahodne(2) === 1, strany: [strana(0), strana(1)] as const };
    const ev = evaluateLine(data, line);
    for (const k of prispevkyKariet(line, ev)) {
      const s = sucty.get(k.defId) ?? { vyskytov: 0, tuhe: 0, aktivne: 0, akcii: 0, aktivovane: 0, zle: 0 };
      const slotov = [...(ev.cards.get(k.uid)?.left ?? []), ...(ev.cards.get(k.uid)?.right ?? [])].filter(
        (x) => x !== null && x.stav === "aktivna" && x.nasobok > 0 && x.action !== "Posilnenie" && x.action !== "Odpor",
      ).length;
      sucty.set(k.defId, {
        vyskytov: s.vyskytov + 1,
        tuhe: s.tuhe + k.tuhe,
        aktivne: s.aktivne + k.aktivne,
        akcii: s.akcii + k.akcii,
        aktivovane: s.aktivovane + slotov,
        zle: s.zle + k.zle,
      });
    }
  }

  return [...sucty.entries()]
    .map(([defId, s]) => ({
      defId,
      nazov: data.cards.get(defId)?.name ?? defId,
      vyskytov: s.vyskytov,
      tuhe: s.tuhe / s.vyskytov,
      aktivne: s.aktivne / s.vyskytov,
      aktivacia: s.akcii === 0 ? 0 : s.aktivovane / s.akcii,
      zle: s.zle / s.vyskytov,
    }))
    .sort((a, b) => b.tuhe - a.tuhe || b.aktivne - a.aktivne);
}
