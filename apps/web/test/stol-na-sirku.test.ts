// Stôl pre telefón na šírku (Michal 2026-10-31): zatiaľ len pre správcov. Ostatní na telefóne
// vidia oznam ako doteraz, počítač sa nemení; správca na telefóne hrá vždy na šírku a na výšku
// dostane výzvu otočiť telefón (stôl pod ňou ostáva). Tabuľa ty | súper ukazuje všetky čísla barov.

import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { dovodNepodporovania, jeIPhone, stolNaSirku, vyzvaTelefonu, type Zhoda } from "../src/hra/zariadenie.ts";
import { detailZdroja, riadkyTabule, type CislaHraca, type ZdrojStlpca } from "../src/hra/tabula.ts";
import { preDotyk, preDotykUzol } from "../src/hra/dotyk.ts";

/** Zariadenie podľa rozmeru a vstupu — vyhodnotí dotazy z zariadenie.ts ako prehliadač. */
function zariadenie(sirka: number, vyska: number, dotyk: boolean): Zhoda {
  const podmienka = (p: string): boolean => {
    const m = /\((min|max)-(width|height): (\d+)px\)/.exec(p);
    if (m !== null) {
      const hodnota = m[2] === "width" ? sirka : vyska;
      return m[1] === "max" ? hodnota <= Number(m[3]) : hodnota >= Number(m[3]);
    }
    if (p === "(pointer: coarse)") return dotyk;
    if (p === "(orientation: landscape)") return sirka > vyska;
    if (p === "(orientation: portrait)") return vyska >= sirka;
    throw new Error(`neznámy dotaz ${p}`);
  };
  return (dotaz) => dotaz.split(",").some((cast) => cast.trim().split(" and ").every((p) => podmienka(p.trim())));
}

describe("telefón na šírku len pre správcu", () => {
  const telefonSirka = zariadenie(844, 390, true);
  const telefonVyska = zariadenie(390, 844, true);

  it("hráč na telefóne vidí oznam ako doteraz", () => {
    expect(dovodNepodporovania(telefonSirka, false)).toBe("dotyk");
    expect(dovodNepodporovania(telefonVyska, false)).toBe("dotyk");
    expect(stolNaSirku(telefonSirka, false)).toEqual({ naSirku: false, otoc: false });
  });

  it("správca hrá na telefóne na šírku, na výšku dostane výzvu otočiť (stôl ostáva)", () => {
    for (const [w, h] of [
      [844, 390],
      [932, 430],
      [780, 360],
    ] as const) {
      expect(dovodNepodporovania(zariadenie(w, h, true), true)).toBeNull();
      expect(stolNaSirku(zariadenie(w, h, true), true)).toEqual({ naSirku: true, otoc: false });
    }
    expect(dovodNepodporovania(telefonVyska, true)).toBeNull();
    expect(stolNaSirku(telefonVyska, true)).toEqual({ naSirku: true, otoc: true });
  });

  it("počítač a notebook sa nemenia ani správcovi", () => {
    for (const [w, h] of [
      [1920, 1080],
      [1366, 650],
      [1440, 800],
    ] as const) {
      for (const spravca of [false, true]) {
        expect(dovodNepodporovania(zariadenie(w, h, false), spravca)).toBeNull();
        expect(stolNaSirku(zariadenie(w, h, false), spravca).naSirku).toBe(false);
      }
    }
    // Úzke okno počítača ostáva „roztiahni ho“ aj správcovi.
    expect(dovodNepodporovania(zariadenie(844, 390, false), true)).toBe("uzke");
  });

  it("tablet na šírku hrá ako doteraz, na výšku správcovi radí otočiť", () => {
    expect(dovodNepodporovania(zariadenie(1180, 820, true), true)).toBeNull();
    expect(stolNaSirku(zariadenie(1180, 820, true), true).naSirku).toBe(false);
    expect(dovodNepodporovania(zariadenie(820, 1180, true), false)).toBe("dotyk");
    expect(dovodNepodporovania(zariadenie(820, 1180, true), true)).toBe("otoc");
  });
});

const cisla = (x: Partial<CislaHraca>): CislaHraca => ({
  karty: 5,
  balicek: 10,
  odhodene: 2,
  poldeci: 2,
  vypite: 1,
  limit: 3,
  chut: 2,
  nerestiDnes: 1,
  chutHrozi: false,
  abstaky: 0,
  dlhy: 0,
  exekucia: 0,
  zadlzenie: 1,
  prahDlhu: 3,
  cigarety: 4,
  pecen: 0,
  prahPecene: 3,
  spaky: 7,
  zaStarsich: 0,
  priznane: 0,
  dedicstvo: 1,
  vazni: 0,
  cirhozyNepriznane: 0,
  ...x,
});

describe("tabuľa ty | súper", () => {
  it("má riadok pre každé číslo baru a hodnoty oboch hráčov", () => {
    const r = riadkyTabule(cisla({ spaky: 12 }), cisla({ spaky: 3, cigarety: 9 }));
    const podla = new Map(r.map((x) => [x.kluc, x]));
    for (const k of ["karty", "poldeci", "limit", "cigarety", "spaky", "chut", "dlhy", "zadlzenie", "pecen", "balicek", "priznane", "dedicstvo", "vazni"]) {
      expect(podla.has(k), k).toBe(true);
    }
    expect(podla.get("spaky")).toMatchObject({ ja: "12", su: "3" });
    expect(podla.get("cigarety")).toMatchObject({ ja: "4", su: "9" });
    expect(podla.get("vazni")?.ja).toMatch(/^0\/\d$/);
  });

  it("zvýrazní, čo hráčovi škodí (exekúcia, hrozba Absťáku, pečeň pred Cirhózou)", () => {
    const r = riadkyTabule(cisla({ dlhy: 4, exekucia: 2, chutHrozi: true }), cisla({ pecen: 2 }));
    const podla = new Map(r.map((x) => [x.kluc, x]));
    expect(podla.get("dlhy")).toMatchObject({ ja: "4 (−2 š.)", zleJa: true, zleSu: false });
    expect(podla.get("chut")?.zleJa).toBe(true);
    expect(podla.get("pecen")).toMatchObject({ zleJa: false, zleSu: true });
  });

  it("bez Chuti v partii riadok Chuť vynechá", () => {
    expect(riadkyTabule(cisla({ chut: null }), cisla({ chut: null })).some((x) => x.kluc === "chut")).toBe(false);
  });
});

describe("okno zdroja v stĺpci hráča", () => {
  it("každý zdroj má nadpis, vysvetlenie a riadky s číslami", () => {
    for (const z of ["karty", "poldeci", "chut", "pecen", "dlhy", "cigarety", "spaky"] as const satisfies readonly ZdrojStlpca[]) {
      const d = detailZdroja(z, cisla({}), true);
      expect(d.nadpis.length, z).toBeGreaterThan(0);
      expect(d.text.length, z).toBeGreaterThan(20);
      expect(d.riadky.length, z).toBeGreaterThan(0);
    }
  });

  it("cigarety ukážu ceny: fajčenie teraz, nový poldeci, Dedičstvo", () => {
    const d = detailZdroja("cigarety", cisla({ cigarety: 7, cenaFajcenia: 3, cenaBarteru: 5, cenaDedicstva: 4 }), true);
    const r = new Map(d.riadky);
    expect(r.get("cigarety")).toBe("7");
    expect(r.get("fajčenie teraz")).toBe("3 cig.");
    expect(r.get("nový poldeci")).toBe("5 cig.");
    expect(r.get("Nástroj do Dedičstva")).toBe("4 cig.");
  });

  it("poldeci ukážu plné, vypité a limit", () => {
    const r = new Map(detailZdroja("poldeci", cisla({ poldeci: 3, vypite: 1, limit: 4 }), false).riadky);
    expect([r.get("plné"), r.get("vypité"), r.get("limit kariet")]).toEqual(["3", "1", "4"]);
  });
});

describe("pokyn na dotyku", () => {
  it("klik a klikni nahradí ťukom, iné slová nechá", () => {
    expect(preDotyk("Klikni na nástenke na lokalitu.")).toBe("Ťukni na nástenke na lokalitu.");
    expect(preDotyk("Klikom vyber 4 karty — ďalší klik vráti.")).toBe("Ťukom vyber 4 karty — ďalší ťuk vráti.");
    expect(preDotyk("kliknutím otočíš")).toBe("kliknutím otočíš");
  });

  it("pravý klik a Esc telefón nemá — dovetky o nich vypadnú", () => {
    expect(preDotyk("Skončiť bez NA EX? Máš plný poldeci — klikni ešte raz, alebo Esc.")).toBe("Skončiť bez NA EX? Máš plný poldeci — ťukni ešte raz.");
    expect(preDotyk("potvrdíš „hotovo“, ✕ (alebo pravý klik na kartu v ruke) ju vráti do šenku.")).toBe("potvrdíš „hotovo“, ✕ ju vráti do šenku.");
    expect(preDotyk("Zrušíš opätovným klikom, pravým klikom alebo Esc.")).toBe("Zrušíš opätovným ťukom.");
  });

  it("prepíše aj texty v JSX pokyne (strong, span), komponenty nechá", () => {
    const uzol = createElement("span", null, "Klikni na ", createElement("strong", null, "kartu"), " — pravým klikom ju vrátiš.");
    expect(renderToStaticMarkup(createElement("p", null, preDotykUzol(uzol)))).toBe("<p><span>Ťukni na <strong>kartu</strong> — ťukom ju vrátiš.</span></p>");
  });
});

describe("telefón: povinne celá obrazovka (Michal 2026-10-31)", () => {
  it("kým nie je celá obrazovka, stôl prekryje výzva — aj na výšku najprv celá obrazovka", () => {
    expect(vyzvaTelefonu({ telefon: true, naVysku: false, celaMozna: true, celaZapnuta: false })).toBe("cela");
    expect(vyzvaTelefonu({ telefon: true, naVysku: true, celaMozna: true, celaZapnuta: false })).toBe("cela");
    expect(vyzvaTelefonu({ telefon: true, naVysku: false, celaMozna: true, celaZapnuta: true })).toBeNull();
  });

  it("zámok na šírku zlyhal a telefón je na výšku — výzva otočiť", () => {
    expect(vyzvaTelefonu({ telefon: true, naVysku: true, celaMozna: true, celaZapnuta: true })).toBe("otoc");
  });

  it("prehliadač bez celej obrazovky (či ju odmietol) chce len šírku; počítač nič", () => {
    expect(vyzvaTelefonu({ telefon: true, naVysku: false, celaMozna: false, celaZapnuta: false })).toBeNull();
    expect(vyzvaTelefonu({ telefon: true, naVysku: true, celaMozna: false, celaZapnuta: false })).toBe("otoc");
    expect(vyzvaTelefonu({ telefon: false, naVysku: false, celaMozna: true, celaZapnuta: false })).toBeNull();
  });
});

describe("iPhone: hra zatiaľ zablokovaná pre všetkých (Michal 2026-10-31)", () => {
  const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
  const IPAD = "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
  const IPADOS = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
  const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";

  it("spozná iPhone a iPod, iPad ani Android nie", () => {
    expect(jeIPhone(IPHONE)).toBe(true);
    expect(jeIPhone("Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0 like Mac OS X)")).toBe(true);
    expect(jeIPhone(IPAD)).toBe(false);
    expect(jeIPhone(IPADOS)).toBe(false);
    expect(jeIPhone(ANDROID)).toBe(false);
  });

  it("na iPhone sa nehrá ani správca, na šírku ani na výšku — stôl pre telefón sa neotvorí", () => {
    for (const z of [zariadenie(844, 390, true), zariadenie(390, 844, true)]) {
      for (const spravca of [false, true]) {
        expect(dovodNepodporovania(z, spravca, true)).toBe("iphone");
        expect(stolNaSirku(z, spravca, true).naSirku).toBe(false);
      }
    }
  });

  it("Android telefón správcu hrá ďalej, iPad sa správa ako doteraz", () => {
    expect(dovodNepodporovania(zariadenie(844, 390, true), true, false)).toBeNull();
    expect(dovodNepodporovania(zariadenie(1180, 820, true), false, false)).toBeNull();
    expect(dovodNepodporovania(zariadenie(820, 1180, true), false, false)).toBe("dotyk");
  });
});
