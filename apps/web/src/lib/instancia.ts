// Prepínanie Vypálená ↔ Zrejúca (Michal 2026-11-02): obe sú na jednej adrese a Caddy posiela
// prehliadač podľa cookie naex_instancia, ktorú nastaví server (do Zrejúcej len s oprávnením).

import { api } from "./api.ts";

/**
 * Prepne inštanciu a načíta stránku nanovo — klient druhej inštancie je iný build.
 * Bez `cesta` ide tam, kam povie server (Zrejúca: /hra, Vypálená: titulka). Keď Zrejúca
 * nemá oproti Vypálenej nič nové, server neprepne a vráti hlášku pre hráča.
 */
export async function prepniInstanciu(nazov: "vypalena" | "zrejuca", cesta?: string): Promise<string | null> {
  const r = await api.post<{ kam?: string; bezZmien?: boolean; sprava?: string }>("/instancia", { nazov });
  if (r.bezZmien === true || r.kam === undefined) return r.sprava ?? "Zrejúca nemá žiadne zmeny — hraj Vypálenú.";
  location.href = cesta === undefined ? r.kam : `${r.kam.replace(/\/[^/]*$/, "")}${cesta}`;
  return null;
}
