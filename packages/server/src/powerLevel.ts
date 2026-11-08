// Power level kariet (Michal 2026-11-08): váhy akcií (spoločné) a efektov (každá karta
// zvlášť). Číta každý, nastavuje len admin — subadmin nie (Michal: „len admini“,
// a admin je jeden). Samotný výpočet je v @naex/tvorba, tu sú len uložené váhy.

import type { VahyPowerLevelu } from "@naex/tvorba";
import { platnaVaha, zlucVahy } from "@naex/tvorba";
import type { Db } from "./db.ts";
import { transakcia } from "./db.ts";
import { ChybaVstupu } from "./auth.ts";

const DRUHY = { akcie: "akcia", efekty: "efekt" } as const;
/** Sada má desiatky akcií a okolo sto kariet; viac v jednej požiadavke je omyl alebo útok. */
const MAX_ZMIEN = 1000;

function kluc(k: string): string {
  // Kľúč akcie (aj s diakritikou, PoškodeniePečene) alebo id karty — bez riadiacich znakov a rozumne dlhý.
  if (k.length === 0 || k.length > 80 || /[\u0000-\u001f\u007f]/.test(k)) throw new ChybaVstupu("Neplatný kľúč akcie alebo karty.");
  return k;
}

export interface StavPowerLevelu {
  /** Platné váhy: predvolené prepísané uloženými. */
  readonly vahy: VahyPowerLevelu;
  /** Kedy admin naposledy menil váhy; null = všetko predvolené. */
  readonly upravene: number | null;
}

export class PowerLevely {
  private readonly db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  stav(): StavPowerLevelu {
    const riadky = this.db.prepare("SELECT druh, kluc, vaha, upravene FROM power_level").all() as { druh: string; kluc: string; vaha: number; upravene: number }[];
    const akcie: Record<string, number> = {};
    const efekty: Record<string, number> = {};
    let upravene: number | null = null;
    for (const r of riadky) {
      (r.druh === DRUHY.akcie ? akcie : efekty)[r.kluc] = Number(r.vaha);
      upravene = Math.max(upravene ?? 0, Number(r.upravene));
    }
    return { vahy: zlucVahy({ akcie, efekty }), upravene };
  }

  /**
   * Telo `{ akcie?: { kľúč: váha | null }, efekty?: { idKarty: váha | null } }`; null vráti
   * predvolenú váhu. Mení len vymenované kľúče, všetko naraz alebo nič.
   */
  uloz(telo: Record<string, unknown>, kto: number, teraz: number): StavPowerLevelu {
    const zmeny: { druh: string; kluc: string; vaha: number | null }[] = [];
    for (const pole of ["akcie", "efekty"] as const) {
      const v = telo[pole];
      if (v === undefined) continue;
      if (v === null || typeof v !== "object" || Array.isArray(v)) throw new ChybaVstupu(`${pole}: objekt { kľúč: váha }.`);
      for (const [k, hodnota] of Object.entries(v as Record<string, unknown>)) {
        if (hodnota === null) {
          zmeny.push({ druh: DRUHY[pole], kluc: kluc(k), vaha: null });
          continue;
        }
        const vaha = platnaVaha(hodnota);
        if (vaha === null) throw new ChybaVstupu(`Váha ${k}: číslo od -10 do 10 po 0,5.`);
        zmeny.push({ druh: DRUHY[pole], kluc: kluc(k), vaha });
      }
    }
    if (zmeny.length > MAX_ZMIEN) throw new ChybaVstupu(`Najviac ${MAX_ZMIEN} váh naraz.`);
    const zapis = this.db.prepare(
      `INSERT INTO power_level (druh, kluc, vaha, upravil, upravene) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(druh, kluc) DO UPDATE SET vaha = excluded.vaha, upravil = excluded.upravil, upravene = excluded.upravene`,
    );
    const zmaz = this.db.prepare("DELETE FROM power_level WHERE druh = ? AND kluc = ?");
    transakcia(this.db, () => {
      for (const z of zmeny) {
        if (z.vaha === null) zmaz.run(z.druh, z.kluc);
        else zapis.run(z.druh, z.kluc, z.vaha, kto, teraz);
      }
    });
    return this.stav();
  }
}
