// Lokalizácia, vlna 3c: dlhé texty v samostatných súboroch po oblastiach (i18n/dlhe.ts) —
// pravidlá, slovník pojmov, výučba, nápovedy a achievementy. Zdroj výučby, nápoved
// a achievementov musí sedieť s dátami jadra (zmena scenára = dorovnaj.ts a preklad sa ukáže
// ako zastaraný), preklady majú tie isté id a polia ako zdroj.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { JAZYKY, rozober, type Uzol } from "../src/i18n/preklad.ts";
import { OBLASTI, dorovnajDlhe, prelozDlhy, textyAchievementov, textyNapovied, textyVyucby, type SuborDlhych, type ZdrojDlhych } from "../src/i18n/dlhe.ts";

const koren = join(import.meta.dirname, "..", "..", "..");
const citaj = (cesta: string): Record<string, unknown> => JSON.parse(readFileSync(join(koren, cesta), "utf8")) as Record<string, unknown>;
const bezMeta = (o: Record<string, unknown>): ZdrojDlhych => Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith("_"))) as ZdrojDlhych;
const zdroj = (o: string): ZdrojDlhych => bezMeta(citaj(`apps/web/src/i18n/${o}/sk.json`));

describe("prelozDlhy", () => {
  const subor: SuborDlhych = {
    krok: { melichar: "Hello.", "zle.1": "Wrong.", inak: "", sk: { melichar: "Ahoj.", "zle.1": "Zle.", inak: "Inak." } },
    ach: { popis: "Deal at least {prah} hard.", sk: { popis: "V jednej bitke udeľ aspoň {prah} tuhého." } },
  };

  it("preklad platí len pre originál, z ktorého vznikol", () => {
    expect(prelozDlhy(subor, "krok", "melichar", "Ahoj.")).toBe("Hello.");
    expect(prelozDlhy(subor, "krok", "melichar", "Ahoj, zmenené.")).toBe("Ahoj, zmenené.");
    // Prázdny preklad = slovenčina; neznáme id = slovenčina; bez súboru = slovenčina.
    expect(prelozDlhy(subor, "krok", "inak", "Inak.")).toBe("Inak.");
    expect(prelozDlhy(subor, "iny", "melichar", "Ahoj.")).toBe("Ahoj.");
    expect(prelozDlhy(null, "krok", "melichar", "Ahoj.")).toBe("Ahoj.");
  });

  it("pole sa nájde podľa originálu (rada, možnosť) aj pri inom poradí", () => {
    expect(prelozDlhy(subor, "krok", null, "Zle.")).toBe("Wrong.");
    expect(prelozDlhy(subor, "krok", "zle.2", "Zle.")).toBe("Wrong.");
  });

  it("text s dosadeným prahom dostane preklad s tým istým číslom", () => {
    expect(prelozDlhy(subor, "ach", "popis", "V jednej bitke udeľ aspoň 12 tuhého.")).toBe("Deal at least 12 hard.");
    expect(prelozDlhy(subor, "ach", "popis", "Iný text 12.")).toBe("Iný text 12.");
  });

  it("dorovnanie nechá hotový preklad s jeho originálom a zastaraný ohlási", () => {
    const novyZdroj: ZdrojDlhych = { krok: { melichar: "Ahoj, nové.", "zle.1": "Zle.", inak: "Inak." }, novy: { melichar: "Nový." } };
    const { subor: d, zastarane } = dorovnajDlhe(novyZdroj, subor);
    expect(zastarane).toEqual(["krok.melichar"]);
    expect(d.krok).toEqual({ melichar: "Hello.", "zle.1": "Wrong.", inak: "", sk: { melichar: "Ahoj.", "zle.1": "Zle.", inak: "Inak." } });
    expect(d.novy).toEqual({ melichar: "", sk: { melichar: "Nový." } });
    expect("ach" in d).toBe(false);
  });
});

describe("súbory oblastí", () => {
  it("zdroj výučby, nápoved a achievementov sedí s dátami jadra (inak spusti tools/preklady/dorovnaj.ts)", () => {
    expect(zdroj("vyucba")).toEqual(textyVyucby(citaj("packages/core/data/vyucba/prva-hra.json") as unknown as Parameters<typeof textyVyucby>[0]));
    expect(zdroj("napovedy")).toEqual(textyNapovied(citaj("packages/core/data/vyucba/napovedy.json") as unknown as Parameters<typeof textyNapovied>[0]));
    expect(zdroj("achievementy")).toEqual(textyAchievementov(citaj("packages/core/data/achievementy.json") as unknown as Parameters<typeof textyAchievementov>[0]));
  });

  it("preklady majú tie isté id a polia ako zdroj, originál pri každom poli", () => {
    for (const o of OBLASTI) {
      const z = zdroj(o);
      for (const j of JAZYKY.filter((x) => x !== "sk")) {
        const p = bezMeta(citaj(`apps/web/src/i18n/${o}/${j}.json`)) as unknown as SuborDlhych;
        expect(Object.keys(p), `${o}/${j}`).toEqual(Object.keys(z));
        for (const [id, polia] of Object.entries(z)) {
          const x = p[id];
          expect(Object.keys(x ?? {}).filter((k) => k !== "sk"), `${o}/${j}: ${id}`).toEqual(Object.keys(polia));
          expect(Object.keys(x?.sk ?? {}), `${o}/${j}: ${id}`).toEqual(Object.keys(polia));
          for (const pole of Object.keys(polia)) expect(typeof x?.[pole], `${o}/${j}: ${id}.${pole}`).toBe("string");
        }
      }
    }
  });
});

/** Všetky .tsx v priečinku pravidiel. */
function subory(dir: string): string[] {
  return readdirSync(dir).flatMap((m) => {
    const c = join(dir, m);
    return statSync(c).isDirectory() ? subory(c) : /\.tsx?$/u.test(m) ? [c] : [];
  });
}

const ZNACKY_PRAVIDIEL = ["b", "strong", "i", "em", "kod", "p", "a", "odkaz"];
/** Text bez rozpoznaných značiek — nesmie v ňom ostať nič, čo vyzerá ako značka. */
const lenText = (uzly: readonly Uzol[]): string => uzly.map((u) => (typeof u === "string" ? u : lenText(u.deti))).join("");
const pojmyVTexte = (uzly: readonly Uzol[]): string[] => uzly.flatMap((u) => (typeof u === "string" ? [] : [...(u.znacka === "p" && u.atribut !== null ? [u.atribut] : []), ...pojmyVTexte(u.deti)]));

describe("texty pravidiel", () => {
  const pravidla = zdroj("pravidla");
  const pojmy = zdroj("pojmy");

  it("každý kľúč tp(…) v kóde stránky je v i18n/pravidla/sk.json", () => {
    const chyba: string[] = [];
    for (const f of subory(join(koren, "apps/web/src/stranky/pravidla"))) {
      for (const m of readFileSync(f, "utf8").matchAll(/\btp\(\s*"([^".]+)\.([^"]+)"/gu)) if (pravidla[m[1]!]?.[m[2]!] === undefined) chyba.push(`${f}: ${m[1]}.${m[2]}`);
    }
    expect(chyba).toEqual([]);
  });

  it("značky sú celé a pojem v texte je v slovníku", () => {
    for (const [id, polia] of Object.entries(pravidla)) {
      for (const [pole, text] of Object.entries(polia)) {
        const uzly = rozober(text, ZNACKY_PRAVIDIEL);
        expect(lenText(uzly), `${id}.${pole}`).not.toMatch(/<\/?[a-z]+[ >]/u);
        for (const k of pojmyVTexte(uzly)) expect(pojmy[k], `${id}.${pole}: pojem ${k}`).toBeDefined();
      }
    }
  });

  it("rozober: vnorená značka s atribútom", () => {
    expect(rozober('Karty tvoria <strong>jednu <p k="linia">líniu</p></strong>, <a href="#x">viac</a>.', ZNACKY_PRAVIDIEL)).toEqual([
      "Karty tvoria ",
      { znacka: "strong", atribut: null, deti: ["jednu ", { znacka: "p", atribut: "linia", deti: ["líniu"] }] },
      ", ",
      { znacka: "a", atribut: "#x", deti: ["viac"] },
      ".",
    ]);
  });

  it("jadro pojmov má krátku vetu a tvary", () => {
    for (const id of ["spak", "bitka", "lokalita", "akcia", "udery", "senok", "cigareta", "zhromazdenie", "linia", "poldeci", "spoj", "pitka", "naex", "starsi", "strach"]) {
      expect(pojmy[id]?.kratko, id).toBeTruthy();
      expect(pojmy[id]?.tvary, id).toBeTruthy();
    }
  });
});
