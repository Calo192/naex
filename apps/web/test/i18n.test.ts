// Lokalizácia (Michal 2026-11-10): preklad kľúčov, tvary počítaných slov, jazyk z prehliadača,
// úplnosť slovníkov a preklad kariet na zobrazenie (jadro číta slovenský text).

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { textBezAkcii, textBezHran } from "@naex/core";
import { JAZYKY, dosad, jazykZPrehliadaca, preloz, tvarPoctu, useky, type Slovnik } from "../src/i18n/preklad.ts";
import { efektNaZobrazenie, prelozVzhlad, zostavPreklad, PRAZDNY_PREKLAD } from "../src/i18n/karty.ts";
import { textBezPreskolenia } from "../src/karta/preskolenie.ts";
import { JAZYKY_ROZHRANIA } from "../../../packages/server/src/auth.ts";

const koren = join(import.meta.dirname, "..", "..", "..");
const citaj = (cesta: string): Record<string, unknown> => JSON.parse(readFileSync(join(koren, cesta), "utf8")) as Record<string, unknown>;
const sk = citaj("apps/web/src/i18n/sk.json") as Slovnik;

describe("preloz", () => {
  const zdroj: Slovnik = { pozdrav: "Ahoj, {meno}!", karty: { "1": "{n} karta", "2": "{n} karty", "5": "{n} kariet" }, len: "len po slovensky" };
  it("cieľový jazyk, chýbajúci či prázdny kľúč = slovenčina, neznámy kľúč = kľúč", () => {
    const en: Slovnik = { pozdrav: "Hi, {meno}!", len: "" };
    expect(preloz("en", en, zdroj, "pozdrav", { meno: "Eva" })).toBe("Hi, Eva!");
    expect(preloz("en", en, zdroj, "len")).toBe("len po slovensky");
    expect(preloz("en", null, zdroj, "pozdrav", { meno: "Eva" })).toBe("Ahoj, Eva!");
    expect(preloz("sk", en, zdroj, "pozdrav", { meno: "Eva" })).toBe("Ahoj, Eva!");
    expect(preloz("en", en, zdroj, "nikde")).toBe("nikde");
  });

  it("tvary: sk a cs 1 / 2–4 / 5+, pl s 22–24 a 12–14, en a hu 1 / ostatné", () => {
    expect([1, 2, 4, 5, 0, 22, -3, 1.5].map((n) => tvarPoctu("sk", n))).toEqual(["1", "2", "2", "5", "5", "5", "2", "5"]);
    expect([1, 3, 12, 14, 22, 24, 25, 112, 102].map((n) => tvarPoctu("pl", n))).toEqual(["1", "2", "5", "5", "2", "2", "5", "5", "2"]);
    expect([1, 2, 5].map((n) => tvarPoctu("en", n))).toEqual(["1", "5", "5"]);
    expect(preloz("sk", null, zdroj, "karty", { n: 3 })).toBe("3 karty");
    expect(preloz("sk", null, zdroj, "karty", { n: 7 })).toBe("7 kariet");
    // Angličtina „2“ nemá — berie „5“; maďarčina smie mať jeden text pre všetky čísla.
    expect(preloz("en", { karty: { "1": "{n} card", "5": "{n} cards" } }, zdroj, "karty", { n: 3 })).toBe("3 cards");
    expect(preloz("hu", { karty: "{n} kártya" }, zdroj, "karty", { n: 3 })).toBe("3 kártya");
    expect(preloz("pl", { karty: { "1": "{n} karta", "2": "{n} karty", "5": "{n} kart" } }, zdroj, "karty", { n: 22 })).toBe("22 karty");
  });

  it("dosad necháva zápis kariet {Rana} a značky delia text", () => {
    expect(dosad("Za {n} {Rana}", { n: 2 })).toBe("Za 2 {Rana}");
    expect(useky("Partia <b>{kod}</b> beží", ["b"])).toEqual([
      { text: "Partia ", znacka: null },
      { text: "{kod}", znacka: "b" },
      { text: " beží", znacka: null },
    ]);
    expect(useky("a <x>b</x>", ["b"])).toEqual([{ text: "a <x>b</x>", znacka: null }]);
  });
});

describe("jazyk z prehliadača", () => {
  it("prvý známy jazyk, neznámy = angličtina, bez údaja slovenčina", () => {
    expect(jazykZPrehliadaca(["sk-SK", "en"])).toBe("sk");
    expect(jazykZPrehliadaca(["de-AT", "pl-PL"])).toBe("pl");
    expect(jazykZPrehliadaca(["cs"])).toBe("cs");
    expect(jazykZPrehliadaca(["de-DE"])).toBe("en");
    expect(jazykZPrehliadaca([])).toBe("sk");
  });

  it("klient a server poznajú tie isté jazyky", () => {
    expect([...JAZYKY]).toEqual([...JAZYKY_ROZHRANIA]);
  });
});

/** Všetky .ts/.tsx v src klienta. */
function subory(dir: string): string[] {
  return readdirSync(dir).flatMap((m) => {
    const c = join(dir, m);
    return statSync(c).isDirectory() ? subory(c) : /\.tsx?$/u.test(m) ? [c] : [];
  });
}

describe("slovníky", () => {
  it("každý kľúč t(…) / tr(…) v kóde je v sk.json", () => {
    const chyba: string[] = [];
    for (const f of subory(join(koren, "apps/web/src"))) {
      const kod = readFileSync(f, "utf8");
      for (const m of kod.matchAll(/\btr?\(\s*"([a-zA-Z0-9_.]+)"/gu)) if (!(m[1]! in sk)) chyba.push(`${f}: ${m[1]}`);
    }
    expect(chyba).toEqual([]);
  });

  it("preklady majú len kľúče zo sk.json a tvary tam, kde ich má slovenčina", () => {
    for (const j of JAZYKY.filter((x) => x !== "sk")) {
      const p = citaj(`apps/web/src/i18n/${j}.json`);
      for (const [k, v] of Object.entries(p)) {
        if (k.startsWith("_")) continue;
        expect(k in sk, `${j}: ${k} nie je v sk.json`).toBe(true);
        expect(typeof v === "string", `${j}: ${k}`).toBe(typeof sk[k] === "string");
      }
    }
  });

  it("parametre prekladu sedia so slovenčinou", () => {
    const parametre = (v: unknown): string[] => [...new Set([...JSON.stringify(v).matchAll(/\{([a-zA-Z0-9_]+)\}/gu)].map((m) => m[1]!))].sort();
    for (const j of JAZYKY.filter((x) => x !== "sk")) {
      const p = citaj(`apps/web/src/i18n/${j}.json`);
      for (const [k, v] of Object.entries(p)) {
        if (k.startsWith("_") || JSON.stringify(v).replace(/"[^"]*":/gu, "") === '""') continue;
        const prazdne = typeof v === "object" && v !== null && Object.values(v).every((x) => x === "");
        if (typeof v === "string" ? v === "" : prazdne) continue;
        expect(parametre(v), `${j}: ${k}`).toEqual(parametre(sk[k]));
      }
    }
  });
});

describe("preklad kariet na zobrazenie", () => {
  const en = { karty: citaj("docs/preklady/karty/en.json"), vzhlad: citaj("docs/preklady/vzhlad/en.json") };
  const p = zostavPreklad(en, { hore: "Top", dole: "Bottom" });
  const opt = { hore: "Top", dole: "Bottom", menoAkcie: (k: string) => p.akcie.get(k)?.nazov ?? k };

  it("preklad platí len pre ten slovenský text, z ktorého vznikol", () => {
    expect(p.nazvy.get("Krčma")).toBe("Pub");
    expect(p.kraje.get("krcma")).toEqual(["by the tap", "by the door"]);
    expect(p.tagy.get("Lokalita")).toBe("Location");
    const zmena = zostavPreklad({ karty: { x: { nazov: "X", efekt: "New text.", sk: { nazov: "Iks", efekt: "Starý text." } } }, vzhlad: {} }, { hore: "Top", dole: "Bottom" });
    expect(zmena.efekty.get("Starý text.")).toBe("New text.");
    expect(zmena.efekty.get("Nový text.")).toBeUndefined();
  });

  it("hrany Nástroja zmiznú pod rámom, Preškolenie a piktogramy pod pečaťou — ako v slovenčine", () => {
    const sNastrojom = "Heirloom: Argument: If you win the argument, your opponent discards 1 random card from their hand. Top: {Viera}→{Pohoršenie}. Bottom: {Pečeň}→{Pohoršenie}.";
    expect(efektNaZobrazenie(sNastrojom, { ...opt, nastroj: true, sNavyse: false })).toBe("Heirloom: Argument: If you win the argument, your opponent discards 1 random card from their hand.");
    expect(textBezPreskolenia(textBezHran("Dedičstvo: Hádka: Ak vyhráš hádku. Hore: {Viera}→{Pohoršenie}. Dole: {Pečeň}→{Pohoršenie}."))).toBe("Dedičstvo: Hádka: Ak vyhráš hádku.");
    expect(efektNaZobrazenie("Support: Retraining {Robota}→{Pecka}.", { ...opt, nastroj: false, sNavyse: false })).toBe("Support: Retraining.");
    expect(textBezPreskolenia("Podpora: Preškolenie {Robota}→{Pecka}.")).toBe("Podpora: Preškolenie.");
    expect(efektNaZobrazenie("Clash: {Pohoršenie}.", { ...opt, nastroj: false, sNavyse: true })).toBe("Clash.");
    expect(textBezAkcii("Konflikt: {Pohoršenie}.")).toBe("Konflikt.");
    expect(efektNaZobrazenie("Ally: Old-timer {Povera} {Povera}.", { ...opt, nastroj: false, sNavyse: true })).toBe("Ally: Old-timer.");
  });

  it("vzhľad: preložené mená akcií a kľúčové slová, kategórie (farby kariet) ostávajú", () => {
    const vzhlad = {
      akcie: [{ kluc: "Rana", nazov: "Rana", popis: "1 tuhé poškodenie.", ikona: { typ: "vstavana" as const }, poradie: 0 }],
      klucoveSlova: [{ slovo: "Nástup", tucne: true, kurziva: false, novyRiadok: true, tvary: ["Nástup:"], popis: "Vyhodnotí sa pri zahraní karty." }],
      kategorie: [{ nazov: "Lokalita", odtien: 30, zapnuta: true }],
    };
    const v = prelozVzhlad(vzhlad, p);
    expect(v.akcie[0]?.nazov).toBe("Punch");
    expect(v.klucoveSlova[0]).toMatchObject({ slovo: "Arrival", tvary: ["Arrival:"], tucne: true, novyRiadok: true });
    expect(v.kategorie).toBe(vzhlad.kategorie);
    expect(prelozVzhlad(vzhlad, PRAZDNY_PREKLAD)).toBe(vzhlad);
  });
});

describe("titulky Melichara", () => {
  it("kľúč je skupina/meno súboru, prázdny titulok sa neukáže", async () => {
    const { klucTitulku, textTitulku, ukazTitulok, skryTitulok, praveZnie } = await import("../src/hra/titulky.ts");
    expect(klucTitulku({ skupina: "pohoda", meno: "a_smeje_sa" })).toBe("pohoda/a_smeje_sa");
    expect(klucTitulku({ skupina: "pohoda" })).toBeNull();
    const titulky = { _meta: { jazyk: "en" }, "pohoda/a_smeje_sa": "And he's laughing.", "udiv/nic": "" };
    expect(textTitulku(titulky, "pohoda/a_smeje_sa")).toBe("And he's laughing.");
    expect(textTitulku(titulky, "udiv/nic")).toBeNull();
    expect(textTitulku(titulky, "_meta")).toBeNull();
    expect(textTitulku(null, "pohoda/a_smeje_sa")).toBeNull();
    ukazTitulok({ skupina: "pohoda", meno: "a_smeje_sa" });
    expect(praveZnie()).toBe("pohoda/a_smeje_sa");
    skryTitulok();
    expect(praveZnie()).toBeNull();
  });

  it("súbory titulkov sú pre všetky jazyky okrem slovenčiny a majú len texty", () => {
    for (const j of JAZYKY.filter((x) => x !== "sk")) {
      const t = citaj(`apps/web/src/i18n/melichar/${j}.json`);
      for (const [k, v] of Object.entries(t)) if (!k.startsWith("_")) expect(typeof v, `${j}: ${k}`).toBe("string");
    }
  });
});
