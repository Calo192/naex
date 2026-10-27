// Štítok partie a menu „Partia ▾“ v hlavičke webu (Michal 2026-10-26, #22 A).
// Rozhodnutia sú tu bez Reactu, nech sa dajú otestovať.

import type { ClientState } from "@naex/core";

/** Po koľkých ms odpojenia súpera smie hráč žiadať kontumáciu — rovnako stráži server (KONTUMACIA_PO_MS). */
export const KONTUMACIA_PO_MS = 3 * 60 * 1000;

/** Tlačidlo „Partia ▾“ — fokus sa naň vráti po zatvorení pultu Melichara. */
export const ID_TLACIDLA_PARTIE = "partia-menu-tlacidlo";

/** Ako dlho svieti posledná zmena špakov v štítku. */
export const ZMENA_SVIETI_MS = 2_500;

/** Krok partie pre štítok: „Bitka 2 z 4“, posledná bitka je „Finále“. */
export function krokPartie(view: Pick<ClientState, "nastenka" | "lokalitCelkom" | "ciel" | "koniec">): {
  readonly text: string;
  readonly kratko: string;
  readonly finale: boolean;
} {
  if (view.koniec !== null) return { text: "Koniec partie", kratko: "Koniec", finale: false };
  const celkom = view.lokalitCelkom + 1;
  // Kým sa vyberá cieľ, ciel je null — ráta sa najbližšia bitka.
  const cislo = Math.min(celkom, view.nastenka.length + 1);
  if (view.ciel?.typ === "finale" || cislo >= celkom) return { text: "Finále", kratko: "Finále", finale: true };
  return { text: `Bitka ${cislo} z ${celkom}`, kratko: `Bitka ${cislo}/${celkom}`, finale: false };
}

export type StavKontumacie =
  /** Súper je pri stole (alebo je to bot) — položka je sivá. */
  | { readonly druh: "pripojeny" }
  /** Súper chýba, no ešte nie 3 minúty — sivá s odpočtom. */
  | { readonly druh: "caka"; readonly zostavaMs: number }
  /** Súper chýba aspoň 3 minúty — zvýraznená, bodka na tlačidle Partia. */
  | { readonly druh: "mozna" };

export function stavKontumacie(pripojeny: boolean, odpojenyOd: number | null, teraz: number): StavKontumacie {
  if (pripojeny) return { druh: "pripojeny" };
  const od = odpojenyOd ?? teraz;
  const zostava = KONTUMACIA_PO_MS - (teraz - od);
  return zostava > 0 ? { druh: "caka", zostavaMs: zostava } : { druh: "mozna" };
}

/** „1:48“ — odpočet na celé sekundy nahor (0:01 je ešte čakanie). */
export function minSek(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export interface ZmenaSpakov {
  /** 0 = ja, 1 = súper (poradie v štítku). */
  readonly kto: 0 | 1;
  readonly n: number;
}

/** Čo sa v popolníkoch zmenilo — po bitke „+2“, po Exekútorovi aj záporné. */
export function zmenySpakov(pred: readonly [number, number], po: readonly [number, number]): ZmenaSpakov[] {
  const zmeny: ZmenaSpakov[] = [];
  for (const kto of [0, 1] as const) {
    const n = po[kto] - pred[kto];
    if (n !== 0) zmeny.push({ kto, n });
  }
  return zmeny;
}

/** „+2“, „−1“ (typografické mínus). */
export const textZmeny = (n: number): string => (n > 0 ? `+${n}` : `−${-n}`);

/**
 * Čo spraví klik na krok osi kola: Bitka ukáže účet poslednej bitky, Draft mimo Draftu šenok
 * na pozretie (Michal 2026-10-27 — tlačidlo Šenok v lište zaniklo); v Drafte je šenok na stole.
 */
export function klikKrokuOsi(id: string, faza: ClientState["faza"]): "ucetBitky" | "senok" | null {
  if (id === "bitka") return "ucetBitky";
  if (id === "draft" && faza !== "draft") return "senok";
  return null;
}
