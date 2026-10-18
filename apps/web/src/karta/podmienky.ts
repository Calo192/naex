// Podmienky scorecardov — názvy a vysvetlenie pre tooltipy a tvorcu.

import type { Podmienka } from "@naex/core";

export const NAZOV_PODMIENKY: Record<Podmienka, string> = {
  znepokojenie: "Znepokojenie",
  strach: "Strach",
  vydesenie: "Vydesenie",
  lokality: "Ovládnuté lokality",
  starsi: "Získaní starší",
  cigarety: "Zvyšné cigarety",
  cirhoza: "Nepriznaná cirhóza",
  dlh: "Nepriznaný dlh",
};

function b(n: number): string {
  const abs = Math.abs(n);
  const slovo = abs === 1 ? "bod" : abs >= 2 && abs <= 4 ? "body" : "bodov";
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${abs} ${slovo}`;
}

/**
 * Čo aktívna podmienka dáva na konci hry — každému hráčovi zvlášť
 * (Michal 2026-10-16: starší pri bodovaní nemá strany).
 */
export function popisPodmienky(p: Podmienka, body: number): string {
  switch (p) {
    case "znepokojenie":
      return `${b(body)} za každého staršieho v hre (aj tohto), ktorý sa ťa bojí aspoň v žltej zóne.`;
    case "strach":
      return `${b(body)} za každého staršieho v hre (aj tohto), ktorý sa ťa bojí aspoň v oranžovej zóne.`;
    case "vydesenie":
      return `${b(body)} za každého staršieho v hre (aj tohto), ktorého si vydesil (červená zóna).`;
    case "lokality":
      return `${b(body)} za každú lokalitu, ktorú ovládaš.`;
    case "starsi":
      return `${b(body)} za každého staršieho, ktorého si získal náhradou.`;
    case "cigarety":
      return `${b(body)} za každú cigaretu, ktorá ti na konci ostane.`;
    case "cirhoza":
      return `${b(body)} za každú nepriznanú cirhózu.`;
    case "dlh":
      return `${b(body)} za každý nepriznaný dlh.`;
  }
}

/** Zónové podmienky sa pri jednom staršom nesčítajú — berie ho najvyššia splnená. */
export const POZN_ZONOVYCH =
  "Ak má scorecard aktívnych viac zónových podmienok, za každého staršieho sa ráta len najvyššia, ktorú jeho strach spĺňa.";
