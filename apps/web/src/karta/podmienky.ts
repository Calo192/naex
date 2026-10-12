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

/** Čo podmienka dáva obávanému hráčovi na konci hry. */
export function popisPodmienky(p: Podmienka, body: number): string {
  switch (p) {
    case "znepokojenie":
      return `${b(body)}, ak je marker aspoň v žltej zóne.`;
    case "strach":
      return `${b(body)}, ak je marker aspoň v oranžovej zóne.`;
    case "vydesenie":
      return `${b(body)}, ak je marker v červenej zóne.`;
    case "lokality":
      return `${b(body)} za každú lokalitu, ktorú ovládaš — len ak je marker aspoň v oranžovej zóne.`;
    case "starsi":
      return `${b(body)} za každého staršieho, ktorého si získal náhradou — len ak je marker aspoň v oranžovej zóne.`;
    case "cigarety":
      return `${b(body)} za každú cigaretu, ktorá ti na konci ostane — len ak je marker aspoň v oranžovej zóne.`;
    case "cirhoza":
      return `${b(body)} za každú nepriznanú cirhózu.`;
    case "dlh":
      return `${b(body)} za každý nepriznaný dlh.`;
  }
}
