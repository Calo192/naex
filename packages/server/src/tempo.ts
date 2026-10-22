// Tempo partie (roadmapa #9, Michal 2026-10-22): kde v partii ide čas.
//
// Po každom príkaze sa čas od poslednej zmeny stavu pripíše fáze, v ktorej sa
// na príkaz čakalo, a hráčovi, ktorý ho poslal — súčet za fázu je teda čas
// na hodinách. Pri stavbe šenku hrajú obaja naraz, tam sa čas oboch prekrýva.
// Ukladajú sa aj partie s botom a vzdané partie; Frajerinu ani archív to nemení.

import type { Event, GameState, PlayerId } from "@naex/core";
import type { Db } from "./db.ts";

export interface TempoFazy {
  readonly prikazy: readonly [number, number];
  readonly ms: readonly [number, number];
}

export interface StavTempa {
  /** Kedy sa naposledy zmenil stav (začiatok partie alebo posledný príkaz). */
  readonly posledny: number;
  readonly fazy: Readonly<Record<string, TempoFazy>>;
  readonly pitky: number;
  readonly bitky: number;
}

export function noveTempo(zaciatok: number): StavTempa {
  return { posledny: zaciatok, fazy: {}, pitky: 0, bitky: 0 };
}

/** Fáza, v ktorej sa na príkaz čakalo; draft a bitka aj s krokom. */
export function fazaPrikazu(state: GameState): string {
  if (state.faza === "draft" && state.draftStav !== null) return `draft:${state.draftStav.krok}`;
  if (state.faza === "bitka" && state.bitkaStav?.krok != null) return `bitka:${state.bitkaStav.krok}`;
  return state.faza;
}

export function zapisPrikaz(t: StavTempa, faza: string, seat: PlayerId, teraz: number, events: readonly Event[]): StavTempa {
  const ms = Math.max(0, teraz - t.posledny);
  const f = t.fazy[faza] ?? { prikazy: [0, 0], ms: [0, 0] };
  const prikazy: [number, number] = [f.prikazy[0], f.prikazy[1]];
  const cas: [number, number] = [f.ms[0], f.ms[1]];
  prikazy[seat] += 1;
  cas[seat] += ms;
  return {
    posledny: teraz,
    fazy: { ...t.fazy, [faza]: { prikazy, ms: cas } },
    pitky: t.pitky + events.filter((e) => e.type === "faza" && e.faza === "pitka").length,
    bitky: t.bitky + events.filter((e) => e.type === "bitkaVysledok").length,
  };
}

export interface ZaznamTempa {
  readonly kod: string;
  readonly zaciatok: number;
  readonly koniec: number;
  readonly dlzka: string;
  readonly sBotom: boolean;
  /** Hrali účty AI playtesterov (pouzivatelia.ai) — nie ľudia. */
  readonly ai: boolean;
  readonly dohrata: boolean;
  readonly kola: number;
  readonly tempo: StavTempa;
}

export interface RiadokTempa {
  readonly kod: string;
  readonly zaciatok: number;
  readonly koniec: number;
  readonly dlzka: string;
  readonly sBotom: boolean;
  readonly ai: boolean;
  readonly dohrata: boolean;
  readonly kola: number;
  readonly bitky: number;
  readonly pitky: number;
  readonly prikazy: number;
  readonly fazy: Readonly<Record<string, TempoFazy>>;
}

export class TempoPartii {
  private readonly db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  zapis(z: ZaznamTempa): void {
    const prikazy = Object.values(z.tempo.fazy).reduce((a, f) => a + f.prikazy[0] + f.prikazy[1], 0);
    this.db
      .prepare(
        `INSERT INTO tempo_partii (kod, zaciatok, koniec, dlzka, s_botom, ai, dohrata, kola, bitky, pitky, prikazy, fazy)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(z.kod, z.zaciatok, z.koniec, z.dlzka, z.sBotom ? 1 : 0, z.ai ? 1 : 0, z.dohrata ? 1 : 0, z.kola, z.tempo.bitky, z.tempo.pitky, prikazy, JSON.stringify(z.tempo.fazy));
  }

  /** Najnovšie partie navrchu. */
  zoznam(limit = 500): RiadokTempa[] {
    const riadky = this.db
      .prepare("SELECT * FROM tempo_partii ORDER BY koniec DESC LIMIT ?")
      .all(limit) as {
      kod: string;
      zaciatok: number;
      koniec: number;
      dlzka: string;
      s_botom: number;
      ai: number;
      dohrata: number;
      kola: number;
      bitky: number;
      pitky: number;
      prikazy: number;
      fazy: string;
    }[];
    return riadky.map((r) => ({
      kod: r.kod,
      zaciatok: r.zaciatok,
      koniec: r.koniec,
      dlzka: r.dlzka,
      sBotom: r.s_botom === 1,
      ai: r.ai === 1,
      dohrata: r.dohrata === 1,
      kola: r.kola,
      bitky: r.bitky,
      pitky: r.pitky,
      prikazy: r.prikazy,
      fazy: JSON.parse(r.fazy) as Record<string, TempoFazy>,
    }));
  }
}
