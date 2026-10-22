// Prehrávač partie (roadmapa #18, Michal 2026-10-22): odohraná partia krok po
// kroku zo seedu a príkazov v archíve. Viditeľnosť (CLAUDE.md, pravidlo 2):
// účastník vidí partiu len zo svojho miesta — súperovu ruku ani poradie balíčka
// nedostane, lebo stav ide cez viewFor a udalosti cez eventsFor. Cudzí nič,
// správca si vyberie miesto. Prehrať sa dá len partia z tej istej verzie jadra.

import type { ClientState, Command, Event, PlayerId } from "@naex/core";
import { DLZKY_HRY, eventsFor, prehrajPartiu, viewFor } from "@naex/core";
import type { Db } from "./db.ts";
import type { Obsah } from "./obsah.ts";

export interface KrokVZozname {
  readonly n: number;
  readonly miesto: PlayerId;
  /** Typ príkazu len pri vlastnom ťahu (alebo pre správcu) — súperove voľby (stavba šenku, Vízia) sú skryté. */
  readonly typ: string | null;
}

export interface ZoznamKrokov {
  readonly pocet: number;
  /** Dá sa partia prehrať na tomto serveri? */
  readonly dostupny: boolean;
  readonly dovod: string | null;
  /** Miesto toho, kto sa pozerá; null = správca, ktorý nehral. */
  readonly ja: PlayerId | null;
  readonly kroky: readonly KrokVZozname[];
}

export interface StavKroku {
  readonly n: number;
  readonly pocet: number;
  /** Z ktorého miesta je pohľad. */
  readonly miesto: PlayerId;
  readonly view: ClientState;
  /** Udalosti kroku n z pohľadu miesta (log). */
  readonly log: readonly Event[];
  readonly koniec: boolean;
}

interface RiadokPartie {
  readonly seed: number | null;
  readonly prikazy: string | null;
  readonly verzia_jadra: string | null;
  readonly verzia_sady: number | null;
  readonly dlzka: string | null;
}

export class Prehravac {
  private readonly db: Db;
  private readonly obsah: Obsah;
  private readonly verziaJadra: string;

  constructor(db: Db, obsah: Obsah, verziaJadra: string) {
    this.db = db;
    this.obsah = obsah;
    this.verziaJadra = verziaJadra;
  }

  /** Riadok partie a miesto volajúceho; null = partia neexistuje alebo ju volajúci vidieť nesmie. */
  private pristup(partia: number, volajuci: number, spravca: boolean): { riadok: RiadokPartie; ja: PlayerId | null } | null {
    const riadok = this.db.prepare("SELECT seed, prikazy, verzia_jadra, verzia_sady, dlzka FROM partie WHERE id = ?").get(partia) as RiadokPartie | undefined;
    if (riadok === undefined) return null;
    const m = (this.db.prepare("SELECT miesto FROM partie_hraci WHERE partia = ? AND pouzivatel = ?").get(partia, volajuci) as { miesto: number } | undefined)?.miesto;
    const ja = m === 0 || m === 1 ? m : null;
    if (ja === null && !spravca) return null;
    return { riadok, ja };
  }

  private prikazy(r: RiadokPartie): [PlayerId, Command][] {
    try {
      const p = r.prikazy === null ? [] : (JSON.parse(r.prikazy) as unknown);
      return Array.isArray(p) ? (p as [PlayerId, Command][]) : [];
    } catch {
      return [];
    }
  }

  private dovodNedostupnosti(r: RiadokPartie): string | null {
    if (r.seed === null || r.prikazy === null) return "Partia je zo starého archívu bez záznamu ťahov.";
    if (r.verzia_jadra !== this.verziaJadra) return "Partia sa hrala na inej verzii hry — prehrať sa dá len na tej istej.";
    if (r.verzia_sady === null || this.obsah.dataSady(r.verzia_sady) === null) return "Sada kariet, na ktorej sa partia hrala, už nie je k dispozícii.";
    return null;
  }

  kroky(partia: number, volajuci: number, spravca: boolean): ZoznamKrokov | null {
    const p = this.pristup(partia, volajuci, spravca);
    if (p === null) return null;
    const prikazy = this.prikazy(p.riadok);
    const dovod = this.dovodNedostupnosti(p.riadok);
    return {
      pocet: prikazy.length,
      dostupny: dovod === null,
      dovod,
      ja: p.ja,
      kroky: prikazy.map(([miesto, cmd], i) => ({ n: i + 1, miesto, typ: p.ja === null || miesto === p.ja ? cmd.type : null })),
    };
  }

  /**
   * Stav po kroku n z pohľadu jedného miesta. Účastník vždy zo svojho miesta,
   * správca z miesta `ziadaneMiesto` (predvolene 0). `chyba` = partiu nemožno prehrať.
   */
  krok(partia: number, n: number, volajuci: number, spravca: boolean, ziadaneMiesto: PlayerId | null): StavKroku | { readonly chyba: string } | null {
    const p = this.pristup(partia, volajuci, spravca);
    if (p === null) return null;
    const dovod = this.dovodNedostupnosti(p.riadok);
    if (dovod !== null) return { chyba: dovod };
    const prikazy = this.prikazy(p.riadok);
    const data = this.obsah.dataSady(p.riadok.verzia_sady as number);
    if (data === null) return { chyba: "Sada kariet, na ktorej sa partia hrala, už nie je k dispozícii." };
    const miesto: PlayerId = p.ja ?? ziadaneMiesto ?? 0;
    const lokalit = DLZKY_HRY[(p.riadok.dlzka ?? "stredna") as keyof typeof DLZKY_HRY] ?? DLZKY_HRY.stredna;
    const k = Math.max(0, Math.min(n, prikazy.length));
    try {
      const { state, events } = prehrajPartiu(data, p.riadok.seed as number, lokalit, prikazy, k);
      return { n: k, pocet: prikazy.length, miesto, view: viewFor(data, state, miesto), log: k === 0 ? [] : eventsFor(events, miesto), koniec: state.koniec !== null };
    } catch {
      return { chyba: "Partiu sa nepodarilo prehrať — záznam nesedí s touto verziou hry." };
    }
  }
}
