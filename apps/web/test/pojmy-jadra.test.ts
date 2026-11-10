// Pojmy jadra pod myšou v bubline Melichara (Michal 2026-11-10, docs/napady/prvy-dojem-navstevnika.html
// časť 9) a pojmy, ktoré hráč nikdy nevidí (šenok → Ponuka, bar, Draft).

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import katalog from "@naex/core/data/vyucba/napovedy.json";
import { castiSPojmami, JADRO_POJMOV, pojemSlovnika, prvePojmy } from "../src/stranky/pravidla/slovnik.ts";
import { medziobrazovka } from "../src/hra/prechodFazy.ts";

describe("pojmy jadra", () => {
  it("13 slov jadra má každé krátku vetu (do 25 slov) a heslo v slovníku Pravidiel", () => {
    expect(JADRO_POJMOV.map((p) => p.id)).toEqual([
      "spak", "bitka", "lokalita", "akcia", "udery", "senok", "cigareta", "zhromazdenie", "linia", "poldeci", "spoj", "pitka", "naex", "starsi", "strach",
    ]);
    for (const p of JADRO_POJMOV) {
      expect(pojemSlovnika(p.id), p.id).not.toBeNull();
      expect(p.kratko.split(/\s+/).length, p.id).toBeLessThanOrEqual(25);
    }
    expect(pojemSlovnika("senok")?.pojem).toBe("Ponuka");
  });

  it("každý pojem sa podčiarkne len pri prvom výskyte, aj naprieč vetami", () => {
    const vety = ["Kúp si z ponuky Hasiča za cigaretu.", "Ponuka sa potom doplní; cigarety šetri na Pitku."];
    const prve = prvePojmy(vety);
    expect([...(prve[0] ?? [])].sort()).toEqual(["cigareta", "senok"]);
    expect([...(prve[1] ?? [])]).toEqual(["pitka"]);
    expect(castiSPojmami(vety[0] ?? "", prve[0] ?? new Set())).toEqual([
      { text: "Kúp si z " },
      { text: "ponuky", pojem: "senok" },
      { text: " Hasiča za " },
      { text: "cigaretu", pojem: "cigareta" },
      { text: "." },
    ]);
  });

  it("tvar musí byť celé slovo: spojené ani bitkár nie sú pojmy", () => {
    expect([...(prvePojmy(["Spojené akcie platia, Bitkár sa bije."])[0] ?? [])]).toEqual(["akcia"]);
    expect([...(prvePojmy(["Dal ti NA EX! na Šoféra."])[0] ?? [])]).toEqual(["naex"]);
  });
});

describe("slová, ktoré hráč nevidí", () => {
  it("nápovedy prvej partie sú zverejnené a nepíšu šenok ani bar", () => {
    expect(katalog.zverejnena).toBe(true);
    const texty = katalog.napovedy.flatMap((n) => (typeof n.melichar === "string" ? [n.melichar] : Object.values(n.melichar)));
    for (const t of texty) expect(t).not.toMatch(/(?<!\p{L})(šen(ok|ku|kom)|bare?|baru)(?!\p{L})/iu);
  });

  it("nadpisy fáz: O čo sa bijeme, Ponuka, Zhromaždenie — kladenie kariet", () => {
    const z = { kolo: 2, utocnik: 1, pitkaCislo: 0, pitkyCelkom: 1, lokalitCelkom: 3, bitkaStav: null, koniec: null, ciel: null, spaky: [0, 0], vitazPoslednejHadky: null } as const;
    expect(medziobrazovka({ ...z, faza: "volbaCiela" }, 0, "Jano", null)?.nadpis).toBe("O čo sa bijeme");
    expect(medziobrazovka({ ...z, faza: "draft" }, 0, "Jano", null)?.nadpis).toBe("Ponuka");
    expect(medziobrazovka({ ...z, faza: "zhromazdenie" }, 0, "Jano", null)?.nadpis).toBe("Zhromaždenie — kladenie kariet");
  });

  it("stôl a stránka Pravidlá nepíšu šenok (identifikátory senok ostávajú)", () => {
    const subory = ["../src/hra/HernaPlocha.tsx", "../src/hra/Panely.tsx", "../src/hra/prechodFazy.ts", "../src/stranky/pravidla/kapitoly.tsx", "../src/stranky/pravidla/slovnik.ts"];
    for (const s of subory) {
      const kod = readFileSync(new URL(s, import.meta.url), "utf8")
        .split("\n")
        .filter((r) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(r));
      expect(kod.filter((r) => /[šŠ]en(ok|ku|kom)(?!\p{L})/u.test(r)), s).toEqual([]);
    }
  });
});
