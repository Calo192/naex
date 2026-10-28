// Tvar odpovedí API profilov (server: archiv.ts, profily.ts, suhrn.ts).
// Čo kto vidí, rozhoduje server (Michal 2026-10-22) — klient len kreslí.

import type { KoloKroniky, StatistikyHraca, UcetSpakov } from "@naex/core";
import type { BodyTeraz } from "../../hra/bodyPodmienok.tsx";
import type { VitrinaApi } from "../../achievementy/data.ts";
import type { ProfilHraca } from "../Statistiky.tsx";

export type Vysledok = "vyhra" | "prehra" | "remiza";
export type FilterPartii = "ludia" | "boti" | "spolu";
export type PohladProfilu = "vlastny" | "cudzi" | "spravca";

export interface Bilancia {
  readonly partie: number;
  readonly vyhry: number;
  readonly prehry: number;
  readonly remizy: number;
}

export interface Metrika {
  readonly kluc: string;
  readonly nazov: string;
  readonly popis: string;
  readonly jednotka: "b" | "%" | "x";
  readonly lepsie: "viac" | "menej";
  readonly hodnota: number | null;
  readonly partii: number;
  readonly porovnanie: { readonly superi: number | null; readonly hraci: number | null };
  readonly trend: number | null;
}

export interface Stranka {
  readonly kluc: string;
  readonly text: string;
  readonly dokaz: string;
}

export interface Suhrn {
  readonly partii: number;
  readonly metriky: readonly Metrika[];
  readonly silne: readonly Stranka[];
  readonly slabe: readonly Stranka[];
}

export interface HracVerejny {
  readonly id: number | null;
  readonly meno: string;
  readonly avatar: string | null;
}

/** Profil z /api/hraci/:id — pôvodné polia (Statistiky.tsx) a k nim viditeľnosť a súhrn. */
export type ProfilApi = ProfilHraca & {
  readonly pohlad: PohladProfilu;
  /** AI playtester pre správcu — pás „Skrytý profil“. */
  readonly skryty: boolean;
  readonly hrac: { readonly ai: boolean };
  readonly bilancia: { readonly ludia: Bilancia; readonly boti: Bilancia };
  /** 5 posledných výsledkov s ľuďmi, najnovší prvý. */
  readonly forma: readonly Vysledok[];
  readonly vyDvaja: Bilancia | null;
  readonly suhrnSkryty: boolean;
  readonly suhrn: Suhrn | null;
  /** Vitrína achievementov; null, kým nie sú zapnuté alebo keď si cudzí hráč skryl súhrn. */
  readonly achievementy?: VitrinaApi | null;
  /** Len vo vlastnom profile: hviezdy (★) achievementov a koľko treba na ďalší rank; null bez achievementov. */
  readonly postupRanku?: PostupRanku | null;
};

export interface PostupRanku {
  readonly hviezdy: number;
  readonly spolu: number;
  /** Ďalší rank a jeho prah v hviezdach; null na Sedmičke (alebo u správcu). */
  readonly dalsi: { readonly rank: "deci" | "sedmicka"; readonly prah: number } | null;
}

export interface SuperVPartii extends HracVerejny {
  readonly bot?: string;
  readonly ai?: true;
}

export interface RiadokPartie {
  readonly id: number;
  readonly koniec: number;
  readonly trvanie: number;
  readonly dlzka: string | null;
  readonly kola: number;
  readonly dovod: string;
  readonly dohrata: boolean;
  readonly verziaPravidiel: string | null;
  readonly vysledok: Vysledok;
  readonly body: readonly [number, number] | null;
  readonly frajerina: { readonly pred: number; readonly po: number } | null;
  readonly super: SuperVPartii;
}

export interface PartieApi {
  readonly pocet: number;
  readonly partie: readonly RiadokPartie[];
}

export interface HracVPartii extends SuperVPartii {
  readonly vysledok: Vysledok;
  readonly body: number | null;
  readonly frajerina: { readonly pred: number; readonly po: number } | null;
}

export interface DetailPartieApi {
  readonly id: number;
  readonly koniec: number;
  readonly trvanie: number;
  readonly dlzka: string | null;
  readonly verziaPravidiel: string | null;
  readonly dovod: string;
  readonly dohrata: boolean;
  readonly ja: 0 | 1 | null;
  readonly hraci: readonly [HracVPartii, HracVPartii];
  readonly kola: readonly KoloKroniky[];
  readonly strany: readonly [Partial<StatistikyHraca>, Partial<StatistikyHraca>];
  /** Záverečný účet: v6 špaky, do v5 bodovanie po starších (archív). */
  readonly zaverecne: UcetSpakov | BodyTeraz | null;
  readonly menaStarsich: Readonly<Record<string, string>>;
}

export const TEXT_VYSLEDKU: Readonly<Record<Vysledok, string>> = { vyhra: "výhra", prehra: "prehra", remiza: "remíza" };
export const SKRATKA_VYSLEDKU: Readonly<Record<Vysledok, string>> = { vyhra: "V", prehra: "P", remiza: "R" };

export const datum = (cas: number): string => new Date(cas).toLocaleDateString("sk-SK", { day: "numeric", month: "numeric", year: "numeric" });

export function trvanie(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 1) return "< 1 min";
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
}

export const znamienko = (d: number): string => (d > 0 ? `+${d}` : d < 0 ? `−${-d}` : "±0");

/** Hodnota metriky s jednotkou: „70 %“, „2,9“, „12 b“. */
export function hodnotaMetriky(m: Pick<Metrika, "jednotka">, v: number | null): string {
  if (v === null) return "—";
  const c = v.toLocaleString("sk-SK", { maximumFractionDigits: 1 });
  return m.jednotka === "%" ? `${c} %` : m.jednotka === "b" ? `${c} b` : c;
}
