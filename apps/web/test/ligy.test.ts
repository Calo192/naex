// Ligy v lobby (Michal 2026-10-28): zámok s podmienkou a postupom, predvolená liga.

import { describe, expect, it } from "vitest";
import { NAZOV_DLZKY } from "@naex/core";
import { popisZamku, smieLigu, stavLigyVProfile, volitelnaLiga, zvolenaLiga, type StavLigy } from "../src/hra/ligy.ts";

const NOVY: readonly StavLigy[] = [
  { liga: "kratka", smie: true, podmienka: null, postup: null },
  { liga: "stredna", smie: false, pristup: "zamknuta", podmienka: "Vyhraj 1 partiu Tretej ligy proti človeku (máš 0/1).", postup: { ma: 0, treba: 1 } },
  { liga: "dlha", smie: false, pristup: "zamknuta", podmienka: "Vyhraj 3 partie Druhej ligy proti človeku (máš 1/3) alebo získaj achievement „Maratón“ ★2.", postup: { ma: 1, treba: 3 } },
];
const VSETKO: readonly StavLigy[] = NOVY.map((l) => ({ ...l, smie: true, podmienka: null, postup: null }));
const DOSTUPNE = ["kratka", "stredna", "dlha"] as const;

describe("ligy v lobby", () => {
  it("hráč vidí ligy, nie dĺžky", () => {
    expect(NAZOV_DLZKY).toEqual({ kratka: "Tretia liga", stredna: "Druhá liga", dlha: "Prvá liga" });
  });

  it("zamknutá liga ukáže podmienku a postup, odomknutá nič", () => {
    expect(popisZamku(NOVY, "kratka")).toBeNull();
    expect(popisZamku(NOVY, "stredna")).toBe("Vyhraj 1 partiu Tretej ligy proti človeku (máš 0/1).");
    expect(popisZamku(NOVY, "dlha")).toBe("Vyhraj 3 partie Druhej ligy proti človeku (máš 1/3) alebo získaj achievement „Maratón“ ★2.");
    expect(popisZamku(VSETKO, "dlha")).toBeNull();
    expect(smieLigu(NOVY, "stredna")).toBe(false);
    // Kým stav nedošiel, lobby nič nezamyká — server aj tak overí.
    expect(smieLigu(null, "dlha")).toBe(true);
    expect(popisZamku(null, "dlha")).toBeNull();
  });

  it("zamknutá predvolená liga sa prepne na najvyššiu, ktorú hráč smie", () => {
    expect(zvolenaLiga(NOVY, true, DOSTUPNE, "stredna")).toBe("kratka");
    expect(zvolenaLiga(VSETKO, true, DOSTUPNE, "stredna")).toBe("stredna");
    expect(zvolenaLiga(NOVY.map((l) => (l.liga === "stredna" ? { ...l, smie: true } : l)), true, DOSTUPNE, "dlha")).toBe("stredna");
    // Sada bez Prvej ligy: najvyššia dostupná.
    expect(zvolenaLiga(VSETKO, true, ["kratka", "stredna"], "dlha")).toBe("stredna");
  });

  it("profil: odomknutá, voľná pre všetkých s budúcou podmienkou, zamknutá s podmienkou", () => {
    expect(stavLigyVProfile({ liga: "kratka", smie: true, pristup: "odomknuta", podmienka: null, postup: null, vyhry: 2 })).toEqual({ stav: "odomknutá", detail: null });
    expect(stavLigyVProfile({ liga: "stredna", smie: true, pristup: "vsetci", podmienka: "Vyhraj 1 partiu Tretej ligy proti človeku (máš 0/1).", postup: { ma: 0, treba: 1 } })).toEqual({
      stav: "zatiaľ voľná pre všetkých",
      detail: "Na odomknutie: Vyhraj 1 partiu Tretej ligy proti človeku (máš 0/1).",
    });
    expect(stavLigyVProfile(NOVY[2] as StavLigy)).toEqual({ stav: "zamknutá", detail: "Vyhraj 3 partie Druhej ligy proti človeku (máš 1/3) alebo získaj achievement „Maratón“ ★2." });
    expect(stavLigyVProfile({ liga: "dlha", smie: true, pristup: "vzdy", podmienka: "x", postup: null }).detail).toBeNull();
  });

  it("keď ligy neobmedzujú partie proti počítaču, zamknutá sa dá zvoliť (len na počítač)", () => {
    expect(volitelnaLiga(NOVY, true, "dlha")).toBe(false);
    expect(volitelnaLiga(NOVY, false, "dlha")).toBe(true);
    expect(zvolenaLiga(NOVY, false, DOSTUPNE, "dlha")).toBe("dlha");
  });
});
