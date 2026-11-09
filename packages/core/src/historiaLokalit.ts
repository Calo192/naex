// História lokalít (Michal 2026-10-31: „kliknúť a zobraziť súmar Pitiek a bitky“): čo sa
// v kole o lokalitu stalo — rekapitulácie Pitiek, bitka, posuny starších a zdroje hráčov
// po každej Pitke. Len evidencia: skladá sa z výsledku príkazu tak ako kronika, motor ju
// nečíta a do GameState nejde (bot by ju klonoval pri každom výpočte dopredu).
// Berie len verejné udalosti a verejné počty zo stavu — server ju posiela obom hráčom
// (nemenné pravidlo 2), preto žiadna súkromná udalosť (pre) ani karta z ruky.

import type { ZmenaMarkera } from "./elders.ts";
import type { CielVykladania, Command, Event, GameState } from "./engine.ts";
import { pocetAbstakov } from "./player.ts";
import type { RekapitulaciaBitky, RekapitulaciaPitky } from "./rekapitulacia.ts";
import type { PlayerId } from "./types.ts";

/** Verejné zdroje hráča — z nich klient ráta, čo kto v Pitke získal či stratil. */
export interface ZdrojeVHistorii {
  readonly cigarety: number;
  /** Plné poldeci. */
  readonly poldeci: number;
  /** Priznané Dlhy. */
  readonly dlhy: number;
  readonly chut: number;
  /** Karty Absťák v balíčku (verejný počet). */
  readonly abstaky: number;
  readonly spaky: number;
}

export interface OdpovedVHistorii {
  readonly hrac: PlayerId;
  readonly defId: string | null;
  readonly ciel: CielVykladania | null;
}

export interface PasVHistorii {
  readonly kto: PlayerId;
  /** Cigarety, ktoré pas dal (0 = pas za karty v ruke alebo bez odmeny). */
  readonly cigarety: number;
}

export interface PitkaVHistorii {
  readonly pitka: number;
  readonly rekap: RekapitulaciaPitky;
  readonly odpovede: readonly OdpovedVHistorii[];
  /** Pasy v Zhromaždení pred touto Pitkou. */
  readonly pasy: readonly PasVHistorii[];
  /** Zdroje oboch po Pitke (zmena = od konca predošlej Pitky, prvá od začiatku kola). */
  readonly po: readonly [ZdrojeVHistorii, ZdrojeVHistorii];
}

/** Zmena strachu či rečí v kole (v11) s kartou staršieho, ktorá vtedy ležala na ukazovateli. */
export interface PosunVHistorii extends ZmenaMarkera {
  readonly defId: string | null;
}

export interface LokalitaVHistorii {
  readonly kolo: number;
  readonly utocnik: PlayerId;
  /** Karta lokality (defId) — kolo sa s nástenkou páruje cez `kolo`. */
  readonly lokalita: string | null;
  readonly zaciatok: readonly [ZdrojeVHistorii, ZdrojeVHistorii];
  readonly pitky: readonly PitkaVHistorii[];
  /** Rekapitulácia bitky (null, kým sa nebilo). Špaky v nej sú z okamihu výsledku — konečné nesie nástenka. */
  readonly bitka: RekapitulaciaBitky | null;
  /** Posuny markerov počas kola (zajatie, Kšeft, do 2026-11-09 Kapybara, po bitke Nakladačka; do v9 aj Pohoršenie). */
  /** Zmeny strachu a rečí v kole (v11; do v10 posuny markerov). */
  readonly posuny: readonly PosunVHistorii[];
  /** Zdroje oboch po konci kola; null, kým kolo beží. */
  readonly koniec: readonly [ZdrojeVHistorii, ZdrojeVHistorii] | null;
}

export interface HistoriaLokalit {
  readonly kola: readonly LokalitaVHistorii[];
  readonly kolo: LokalitaVHistorii;
  /** Pasy a odpovede na NA EX od poslednej Pitky — pripíšu sa k najbližšej. */
  readonly pasy: readonly PasVHistorii[];
  readonly odpovede: readonly OdpovedVHistorii[];
}

function zdroje(s: GameState): readonly [ZdrojeVHistorii, ZdrojeVHistorii] {
  const z = (p: PlayerId): ZdrojeVHistorii => {
    const h = s.hraci[p];
    return { cigarety: h.cigarety, poldeci: h.poldeciPlne, dlhy: h.dlhy, chut: h.chut, abstaky: pocetAbstakov(h), spaky: s.spaky[p] };
  };
  return [z(0), z(1)];
}

const noveKolo = (s: GameState): LokalitaVHistorii => ({
  kolo: s.kolo,
  utocnik: s.utocnik,
  lokalita: s.ciel?.lokalita?.defId ?? null,
  zaciatok: zdroje(s),
  pitky: [],
  bitka: null,
  posuny: [],
  koniec: null,
});

export function novaHistoriaLokalit(s: GameState): HistoriaLokalit {
  return { kola: [], kolo: noveKolo(s), pasy: [], odpovede: [] };
}

const verejna = (e: Event): boolean => !("pre" in e) || e.pre === undefined;

/**
 * Zapíše jeden vykonaný príkaz (pred → po). Keď sa nič, čo história eviduje, nezmenilo,
 * vráti ten istý objekt — server podľa toho vie, či ju má poslať znova.
 */
export function zapisDoHistorie(h: HistoriaLokalit, pred: GameState, cmd: Command, autor: PlayerId, po: GameState, events: readonly Event[]): HistoriaLokalit {
  let kolo = h.kolo;
  let pasy = h.pasy;
  let odpovede = h.odpovede;
  let zmena = false;
  if (kolo.lokalita === null && po.ciel?.lokalita != null && po.kolo === kolo.kolo) {
    kolo = { ...kolo, lokalita: po.ciel.lokalita.defId };
    zmena = true;
  }
  const kroky = cmd.type === "tah" ? cmd.kroky : [cmd];
  for (const c of kroky) {
    if (c.type !== "pass") continue;
    pasy = [...pasy, { kto: autor, cigarety: Math.max(0, po.hraci[autor].cigarety - pred.hraci[autor].cigarety) }];
    zmena = true;
  }
  for (const e of events) {
    if (!verejna(e)) continue;
    if (e.type === "odpovedNaNaex") {
      odpovede = [...odpovede, { hrac: e.hrac, defId: e.defId, ciel: e.ciel }];
      zmena = true;
    } else if (e.type === "pitkaRekap") {
      // Hasič môže Pitku dokončiť na dvakrát — rekapitulácia tej istej Pitky nahradí predošlú.
      const ina = kolo.pitky.filter((x) => x.pitka !== e.rekap.pitka);
      const stara = kolo.pitky.find((x) => x.pitka === e.rekap.pitka);
      const pitka: PitkaVHistorii = {
        pitka: e.rekap.pitka,
        rekap: e.rekap,
        odpovede: [...(stara?.odpovede ?? []), ...odpovede],
        pasy: [...(stara?.pasy ?? []), ...pasy],
        po: zdroje(po),
      };
      kolo = { ...kolo, pitky: [...ina, pitka] };
      pasy = [];
      odpovede = [];
      zmena = true;
    } else if (e.type === "bitkaVysledok" && e.rekap !== undefined) {
      kolo = { ...kolo, bitka: e.rekap };
      zmena = true;
    } else if (e.type === "zmenaMarkera") {
      const elder = po.starsi.find((x) => x.elderId === e.elderId) ?? pred.starsi.find((x) => x.elderId === e.elderId);
      const posun: PosunVHistorii = { elderId: e.elderId, hrac: e.hrac, marker: e.marker, z: e.z, na: e.na, zdroj: e.zdroj, kto: e.kto, defId: elder?.karta.defId ?? null };
      kolo = { ...kolo, posuny: [...kolo.posuny, posun] };
      zmena = true;
    }
  }
  // Koniec kola (nové kolo alebo koniec hry): zdroje po kole a ďalšie kolo.
  if (po.kolo !== pred.kolo || (po.koniec !== null && pred.koniec === null)) {
    const hotove: LokalitaVHistorii = { ...kolo, koniec: zdroje(po) };
    return { kola: [...h.kola, hotove], kolo: noveKolo(po), pasy: [], odpovede: [] };
  }
  return zmena ? { kola: h.kola, kolo, pasy, odpovede } : h;
}

/** Kolá, v ktorých už bola bitka (aj to, ktoré práve dobieha) — to dostane klient. */
export function lokalityPreKlienta(h: HistoriaLokalit | null): readonly LokalitaVHistorii[] {
  return h === null ? [] : [...h.kola, h.kolo].filter((k) => k.bitka !== null);
}

/** Zmenilo sa to, čo dostane klient? Pasy a Pitky kola pred bitkou klient ešte nevidí — neposielajú sa. */
export function lokalityZmenene(pred: HistoriaLokalit | null, po: HistoriaLokalit | null): boolean {
  if (pred === po) return false;
  const a = lokalityPreKlienta(pred);
  const b = lokalityPreKlienta(po);
  return a.length !== b.length || a.some((k, i) => k !== b[i]);
}
