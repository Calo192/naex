// Štatistiky kariet z partií — podklad pre rebalans v tvorcovi. Čistá funkcia
// nad ťahmi motora ako statistiky.ts: server po každom apply() zavolá
// zapisTahKariet() a pri konci partie uloží výsledok do archívu.

import type { PlayerId } from "./types.ts";
import type { Command, Event, GameState } from "./engine.ts";

export interface StatKarty {
  /** Partie, v ktorých sa karta objavila (jedna partia = 1). */
  readonly partie: number;
  /** Koľkokrát si ju hráč vzal zo šenku. */
  readonly zoSenku: number;
  /** Vyložená na vlastnú stranu línie. */
  readonly vylozene: number;
  /** Vyložená na súperovu stranu (podstrčená). */
  readonly podstrcene: number;
  /** Priznaná (kliatby) alebo položená do Dedičstva (Nástroje). */
  readonly priznane: number;
  readonly naex: number;
  /** Ležala v línii pri vyhodnotení bitky. */
  readonly bitky: number;
  /** …a jej majiteľ bitku vyhral. */
  readonly vyhrateBitky: number;
  /** Súčty z bitiek: vytlačené akcie, aktívne akcie, tuhé poškodenie, kliatbové akcie. */
  readonly akcii: number;
  readonly aktivne: number;
  readonly tuhe: number;
  readonly zle: number;
}

export type StatistikyKariet = Readonly<Record<string, StatKarty>>;

const POLIA = ["partie", "zoSenku", "vylozene", "podstrcene", "priznane", "naex", "bitky", "vyhrateBitky", "akcii", "aktivne", "tuhe", "zle"] as const;

export function prazdnaStatKarty(): StatKarty {
  return { partie: 0, zoSenku: 0, vylozene: 0, podstrcene: 0, priznane: 0, naex: 0, bitky: 0, vyhrateBitky: 0, akcii: 0, aktivne: 0, tuhe: 0, zle: 0 };
}

function pridaj(stat: Record<string, StatKarty>, defId: string, zmena: Partial<StatKarty>): void {
  const s = stat[defId] ?? prazdnaStatKarty();
  const nova = { ...s, partie: 1 } as Record<(typeof POLIA)[number], number>;
  for (const [k, v] of Object.entries(zmena) as [(typeof POLIA)[number], number][]) nova[k] = (nova[k] ?? 0) + v;
  stat[defId] = nova as StatKarty;
}

function vRuke(s: GameState, p: PlayerId, uid: number): string | undefined {
  return s.hraci[p].ruka.find((k) => k.uid === uid)?.defId;
}

/** Započíta jeden ťah (príkaz hráča `autor`) do štatistík kariet partie. */
export function zapisTahKariet(stat: StatistikyKariet, pred: GameState, cmd: Command, autor: PlayerId, events: readonly Event[]): StatistikyKariet {
  const out: Record<string, StatKarty> = { ...stat };
  if (cmd.type === "draftBer") {
    const defId = pred.senok.find((k) => k.uid === cmd.uid)?.defId;
    if (defId !== undefined) pridaj(out, defId, { zoSenku: 1 });
  } else if (cmd.type === "place") {
    const defId = vRuke(pred, autor, cmd.uid);
    if (defId !== undefined) {
      const pole = cmd.target === "vlastna" ? "vylozene" : cmd.target === "superova" ? "podstrcene" : "priznane";
      pridaj(out, defId, { [pole]: 1 });
    }
  } else if (cmd.type === "naex") {
    const defId = [...pred.strany[0], ...pred.strany[1]].find((pl) => pl.card.uid === cmd.uid)?.card.defId;
    if (defId !== undefined) pridaj(out, defId, { naex: 1 });
  }
  for (const e of events) {
    if (e.type !== "bitkaVysledok") continue;
    for (const k of e.karty) {
      pridaj(out, k.defId, { bitky: 1, vyhrateBitky: k.majitel === e.vitaz ? 1 : 0, akcii: k.akcii, aktivne: k.aktivne, tuhe: k.tuhe, zle: k.zle });
    }
  }
  return out;
}

/** Súčet štatistík viacerých partií (partie sa sčítajú — v jednej je karta najviac raz). */
export function scitajStatistikyKariet(a: StatistikyKariet, b: StatistikyKariet): StatistikyKariet {
  const out: Record<string, StatKarty> = { ...a };
  for (const [defId, s] of Object.entries(b)) {
    const z = (out[defId] ?? prazdnaStatKarty()) as Record<(typeof POLIA)[number], number>;
    const n = { ...z };
    for (const k of POLIA) n[k] = z[k] + s[k];
    out[defId] = n as StatKarty;
  }
  return out;
}

/** Načítanie z archívu — neznáme alebo chýbajúce polia sú 0. */
export function normalizujStatistikyKariet(v: unknown): StatistikyKariet {
  if (typeof v !== "object" || v === null) return {};
  const out: Record<string, StatKarty> = {};
  for (const [defId, s] of Object.entries(v as Record<string, unknown>)) {
    const z = (typeof s === "object" && s !== null ? s : {}) as Record<string, unknown>;
    const n = prazdnaStatKarty() as Record<(typeof POLIA)[number], number>;
    for (const k of POLIA) n[k] = typeof z[k] === "number" && Number.isFinite(z[k]) ? (z[k] as number) : 0;
    out[defId] = n as StatKarty;
  }
  return out;
}
