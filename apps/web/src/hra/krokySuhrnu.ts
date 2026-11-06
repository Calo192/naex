// Súhrn po bitke krok po kroku na doske (Michal 2026-11-02, docs/napady/suhrn-po-bitke-mocky.html,
// návrh c): žiadne okno — na línii starších sa prejde v poradí pravidiel (§10, krok 4b → 4e)
// 1 starší bodujú, 2 reči klesnú, 3 Nakladačka, 4 hádka, 5 priazeň a ďalšie kolo. Kroky bez zmeny
// sa preskočia, posledný ukáže stav po bitke s hladinami pred ňou. Bez Reactu, aby sa dalo otestovať.
//
// Stav pred bitkou sa ráta spätne zo zmien markerov: tie sa mažú až na začiatku ďalšej Pitky, takže
// v prvom pohľade nového kola nesú celú bitku (bodovanie, zánik, Nakladačka, hádka, presvedčenie). Zmeny
// z Kšeftov poslednej Pitky sú pred bitkou a ostanú v stave „pred“.

import type { BitkaNaNastenke, ClientState, ElderState, PlayerId, Stupen, Vazen, ZmenaMarkera } from "@naex/core";
import { cenaZdvihu, investovaneReci, kradezZaZajatie, najvyssiMarker, noveReci, pocet, priazenHraca, priazenSila, spakyOdStarsieho } from "@naex/core";
import { slovoStupna, type Rod } from "./textyStarsich.ts";

/** Strach a reči oboch hráčov. */
export interface Markery {
  readonly strach: readonly [Stupen, Stupen];
  readonly reci: readonly [Stupen, Stupen];
  /** Spodok bloku rečí (v11.12); chýba vo výučbe, ktorá hrá reči do v11.11. */
  readonly reciOd?: readonly [Stupen, Stupen];
}

/** Starší a väzni na začiatku kola — prvý pohľad kola (voľba cieľa); z neho starší zajatý v bitke. */
export interface ZaciatokKola {
  readonly kolo: number;
  readonly starsi: readonly ({ readonly elderId: string; readonly karta: ElderState["karta"]; readonly scorecard: string } & Markery)[];
  /** Starší, ktorí už boli väzňami. */
  readonly vazni: readonly string[];
}

export function zaciatokKola(view: Pick<ClientState, "kolo" | "starsi" | "vazni">): ZaciatokKola {
  return {
    kolo: view.kolo,
    starsi: view.starsi.map((e) => ({ elderId: e.elderId, karta: e.karta, scorecard: e.scorecard, strach: e.strach, reci: e.reci, ...(e.reciOd !== undefined ? { reciOd: e.reciOd } : {}) })),
    vazni: view.vazni.map((v) => v.elderId),
  };
}

/** Krok súhrnu v poradí pravidiel; koniec = priazeň a ďalšie kolo (vždy posledný). */
export type KrokSuhrnu = "bodovanie" | "reci" | "nakladacka" | "hadka" | "koniec";

export const NAZOV_KROKU: Readonly<Record<KrokSuhrnu, string>> = {
  bodovanie: "Starší bodujú",
  reci: "Reči klesnú",
  nakladacka: "Nakladačka",
  hadka: "Hádka",
  koniec: "Priazeň a ďalšie kolo",
};

const PORADIE: readonly KrokSuhrnu[] = ["bodovanie", "reci", "nakladacka", "hadka", "koniec"];

/** Priazeň: komu (null = nikto) a akú silnú. */
export interface PriazenSuhrnu {
  readonly hrac: PlayerId | null;
  readonly sila: number;
}

export interface StarsiVSuhrne {
  readonly elderId: string;
  readonly defId: string;
  readonly scorecard: string;
  /** Teplomery po fázach: 0 pred bitkou, 1 po poklese rečí, 2 po Nakladačke, 3 po hádke, 4 po presvedčení (v11.4). */
  readonly fazy: readonly [Markery, Markery, Markery, Markery, Markery];
  /** Zajatý v tejto bitke — kto ho má v pivnici. */
  readonly vazen: PlayerId | null;
  /** Bodovanie (krok 4b): špaky a za aký stupeň (reči = len reči). */
  readonly bod: readonly [number, number];
  readonly bodStupen: readonly [Stupen, Stupen];
  readonly bodZaReci: readonly [boolean, boolean];
  readonly pokles: readonly { readonly hrac: PlayerId; readonly z: Stupen; readonly na: Stupen }[];
  readonly nakladacka: { readonly hrac: PlayerId; readonly z: Stupen; readonly na: Stupen; readonly cena: number; readonly zanikli: boolean } | null;
  readonly hadka: { readonly hrac: PlayerId; readonly z: Stupen; readonly na: Stupen; readonly cena: number } | null;
  /** Presvedčený v tejto bitke (v11.4): kto ho presvedčil — jeho reči pri ňom zanikli. */
  readonly presvedcil: PlayerId | null;
  readonly priazen: { readonly od: PriazenSuhrnu; readonly na: PriazenSuhrnu; readonly zmena: boolean };
  /** Kto ho v ďalšej vyhratej bitke smie Nakladačkou zajať (strach 3) a koľko by mu súper odovzdal. */
  readonly ohrozenie: readonly { readonly hrac: PlayerId; readonly kradez: number }[];
}

export interface SuhrnBitky {
  readonly kolo: number;
  readonly vitaz: PlayerId | null;
  readonly starsi: readonly StarsiVSuhrne[];
  /** Kroky so zmenou v poradí pravidiel a na konci vždy „koniec“. */
  readonly kroky: readonly KrokSuhrnu[];
  /** Špaky od starších spolu. */
  readonly spolu: readonly [number, number];
  /** Nakladačka a hádka: kto dvíhal a koľko stáli zdvihy spolu. */
  readonly nakladacka: { readonly hrac: PlayerId; readonly cena: number } | null;
  readonly hadka: { readonly hrac: PlayerId; readonly cena: number } | null;
}

const ZDROJE_BITKY: ReadonlySet<ZmenaMarkera["zdroj"]> = new Set(["bodovanie", "zanik", "nakladacka", "hadka", "presvedcenie", "posun"]);

type Mut = { strach: [Stupen, Stupen]; reci: [Stupen, Stupen]; reciOd?: [Stupen, Stupen] };
const kopia = (m: Markery): Mut => ({
  strach: [m.strach[0], m.strach[1]],
  reci: [m.reci[0], m.reci[1]],
  ...(m.reciOd !== undefined ? { reciOd: [m.reciOd[0], m.reciOd[1]] as [Stupen, Stupen] } : {}),
});
/** Stav pred zmenou (smer = z) alebo po nej (smer = na). */
const nastav = (m: Mut, z: Pick<ZmenaMarkera, "hrac" | "marker" | "z" | "na" | "odZ" | "odNa">, smer: "z" | "na"): void => {
  if (z.marker === "strach") {
    m.strach[z.hrac] = z[smer];
    return;
  }
  m.reci[z.hrac] = z[smer];
  const od = smer === "z" ? z.odZ : z.odNa;
  if (m.reciOd !== undefined && od !== undefined) m.reciOd[z.hrac] = od;
};
const priazenZ = (m: Markery): PriazenSuhrnu => ({ hrac: priazenHraca(m), sila: priazenSila(m) });
const rovnakaPriazen = (a: PriazenSuhrnu, b: PriazenSuhrnu): boolean => a.hrac === b.hrac && a.sila === b.sila;

/**
 * Súhrn bitky kola `zaciatok.kolo` z prvého pohľadu nového kola. null = bitka nie je na nástenke
 * (koniec hry, archív) alebo sa so staršími nič nestalo.
 */
export function suhrnBitky(zaciatok: ZaciatokKola, view: Pick<ClientState, "starsi" | "vazni" | "zmenyMarkerov" | "nastenka">): SuhrnBitky | null {
  const bitka: BitkaNaNastenke | undefined = view.nastenka.find((b) => b.kolo === zaciatok.kolo);
  if (bitka === undefined) return null;
  const zmeny = view.zmenyMarkerov.filter((z) => ZDROJE_BITKY.has(z.zdroj));
  const starsi: StarsiVSuhrne[] = [];
  for (const a of zaciatok.starsi) {
    const teraz = view.starsi.find((e) => e.elderId === a.elderId);
    const vazen: Vazen | undefined = teraz === undefined && !zaciatok.vazni.includes(a.elderId) ? view.vazni.find((v) => v.elderId === a.elderId) : undefined;
    if (teraz === undefined && vazen === undefined) continue;
    const jeho = zmeny.filter((z) => z.elderId === a.elderId);
    // Zajatému zmizli markery — stav pri zajatí je začiatok kola so zmenami, ktoré prešli.
    let koniec: Mut;
    if (teraz !== undefined) koniec = kopia(teraz);
    else {
      koniec = kopia(a);
      for (const z of view.zmenyMarkerov.filter((x) => x.elderId === a.elderId)) nastav(koniec, z, "na");
    }
    const f0 = kopia(koniec);
    for (const z of [...jeho].reverse()) nastav(f0, z, "z");
    const dalej = (od: Mut, zdroje: readonly ZmenaMarkera["zdroj"][]): Mut => {
      const m = kopia(od);
      for (const z of jeho) if (zdroje.includes(z.zdroj)) nastav(m, z, "na");
      return m;
    };
    const f1 = dalej(f0, ["bodovanie"]);
    const f2 = dalej(f1, ["nakladacka", "zanik", "posun"]);
    const f3 = dalej(f2, ["hadka"]);
    const f4 = dalej(f3, ["presvedcenie"]);

    const zaznam = bitka.bodovanie?.find((x) => x.elderId === a.elderId);
    const bodStupen: [Stupen, Stupen] = zaznam !== undefined ? [zaznam.stupen[0], zaznam.stupen[1]] : [0, 1].map((p) => (bitka.vitaz === p ? najvyssiMarker(f0, p as PlayerId) : f0.reci[p as PlayerId])) as [Stupen, Stupen];
    const bodZaReci: [boolean, boolean] = zaznam !== undefined ? [zaznam.reci[0], zaznam.reci[1]] : [f0.reci[0] > 0 && bodStupen[0] === f0.reci[0], f0.reci[1] > 0 && bodStupen[1] === f0.reci[1]];
    const bod: [number, number] = zaznam !== undefined ? [zaznam.spaky[0], zaznam.spaky[1]] : [spakyOdStarsieho(f0, 0, bitka.vitaz === 0), spakyOdStarsieho(f0, 1, bitka.vitaz === 1)];

    const nakl = jeho.find((z) => z.zdroj === "nakladacka" && z.marker === "strach");
    const hadka = jeho.find((z) => z.zdroj === "hadka" && z.marker === "reci");
    const presvedcenie = jeho.find((z) => z.zdroj === "presvedcenie");
    const od = priazenZ(f0);
    const na: PriazenSuhrnu = vazen !== undefined ? { hrac: null, sila: 0 } : priazenZ(f4);
    starsi.push({
      elderId: a.elderId,
      defId: (teraz ?? vazen)?.karta.defId ?? a.karta.defId,
      scorecard: (teraz ?? vazen)?.scorecard ?? a.scorecard,
      fazy: [f0, f1, f2, f3, f4],
      vazen: vazen?.hrac ?? null,
      bod,
      bodStupen,
      bodZaReci,
      pokles: jeho.filter((z) => z.zdroj === "bodovanie").map((z) => ({ hrac: z.hrac, z: z.z, na: z.na })),
      nakladacka: nakl === undefined ? null : { hrac: nakl.hrac, z: nakl.z, na: nakl.na, cena: cenaZdvihu(f1, nakl.hrac, "strach", nakl.na) ?? 0, zanikli: jeho.some((z) => z.zdroj === "zanik" && z.hrac === nakl.hrac) },
      hadka: hadka === undefined ? null : { hrac: hadka.hrac, z: najvyssiMarker(f2, hadka.hrac), na: hadka.na, cena: noveReci(f2) ? investovaneReci(f3, hadka.hrac) - investovaneReci(f2, hadka.hrac) : (cenaZdvihu(f2, hadka.hrac, "reci", hadka.na) ?? 0) },
      presvedcil: presvedcenie === undefined ? null : presvedcenie.hrac,
      priazen: { od, na, zmena: !rovnakaPriazen(od, na) },
      ohrozenie: vazen !== undefined ? [] : ([0, 1] as const).filter((p) => f4.strach[p] === 3).map((p) => ({ hrac: p, kradez: kradezZaZajatie(f4, p) })),
    });
  }
  const kroky = PORADIE.filter((k) => starsi.some((e) => dotknuty(e, k)));
  if (kroky.length === 0) return null;
  const sucet = (f: (e: StarsiVSuhrne) => number): number => starsi.reduce((a, e) => a + f(e), 0);
  const kto = (f: (e: StarsiVSuhrne) => { readonly hrac: PlayerId; readonly cena: number } | null): { readonly hrac: PlayerId; readonly cena: number } | null => {
    const xs = starsi.flatMap((e) => {
      const x = f(e);
      return x === null ? [] : [x];
    });
    return xs.length === 0 ? null : { hrac: xs[0]!.hrac, cena: xs.reduce((a, x) => a + x.cena, 0) };
  };
  return {
    kolo: zaciatok.kolo,
    vitaz: bitka.vitaz,
    starsi,
    kroky: kroky.includes("koniec") ? kroky : [...kroky, "koniec"],
    spolu: [sucet((e) => e.bod[0]), sucet((e) => e.bod[1])],
    nakladacka: kto((e) => e.nakladacka),
    hadka: kto((e) => e.hadka),
  };
}

/** Čo si stôl pamätá z pohľadov servera: začiatok kola a súhrn bitky, ktorý sa práve má spustiť. */
export interface PohladSuhrnu {
  readonly zaciatok: ZaciatokKola | null;
  readonly suhrn: SuhrnBitky | null;
}

/**
 * Spúšťanie súhrnu (pohľady servera v poradí, ako prídu). Začiatok kola je prvý pohľad kola pred
 * Zhromaždením; súhrn bitky príde s prvým pohľadom ďalšieho kola — bez ohľadu na to, kto čo rozdeľoval.
 * Stačí aj Draft: keď súper ako obranca vyberie lokalitu hneď, pohľad s voľbou cieľa môže prísť
 * neskoro (pomalé spojenie, návrat po výpadku) a súhrn by sa stratil spolu so začiatkom ďalšieho kola.
 * Do Zhromaždenia sa markery nemenia (Kapybara až pri Nástupe) a zmeny markerov z bitky sa mažú až
 * na začiatku Pitky.
 */
export function dalsiPohladSuhrnu(zaciatok: ZaciatokKola | null, v: Pick<ClientState, "kolo" | "faza" | "koniec" | "starsi" | "vazni" | "zmenyMarkerov" | "nastenka">): PohladSuhrnu {
  if (zaciatok !== null && zaciatok.kolo === v.kolo) return { zaciatok, suhrn: null };
  const predZhromazdenim = v.koniec === null && (v.faza === "volbaCiela" || v.faza === "natocenieCiela" || v.faza === "draft");
  return {
    zaciatok: predZhromazdenim ? zaciatokKola(v) : null,
    suhrn: predZhromazdenim && zaciatok !== null && v.kolo === zaciatok.kolo + 1 ? suhrnBitky(zaciatok, v) : null,
  };
}

/** Starší sa v kroku pohol (svieti), ostatní stmavnú. */
export function dotknuty(e: StarsiVSuhrne, k: KrokSuhrnu): boolean {
  if (k === "bodovanie") return e.bod[0] + e.bod[1] > 0;
  if (k === "reci") return e.pokles.length > 0;
  if (k === "nakladacka") return e.nakladacka !== null;
  if (k === "hadka") return e.hadka !== null;
  return e.priazen.zmena || e.ohrozenie.length > 0 || e.vazen !== null || e.presvedcil !== null;
}

/**
 * Čo teplomer v kroku ukáže: stav (index fázy), predošlý stav pre pohyb (null = nič sa nehýbe)
 * a či nechať prerušovanú hladinu spred bitky (koniec).
 */
export function fazaKroku(k: KrokSuhrnu): { readonly stav: number; readonly od: number | null; readonly duch: boolean } {
  if (k === "bodovanie") return { stav: 0, od: null, duch: false };
  if (k === "reci") return { stav: 1, od: 0, duch: false };
  if (k === "nakladacka") return { stav: 2, od: 1, duch: false };
  if (k === "hadka") return { stav: 3, od: 2, duch: false };
  return { stav: 4, od: 0, duch: true };
}

/** Mená a slová, z ktorých sa skladajú vety súhrnu. */
export interface KontextSuhrnu {
  /** Krátke mená hráčov podľa miesta (0, 1). */
  readonly mena: readonly [string, string];
  readonly menoStarsieho: (defId: string) => string;
  readonly rod: (defId: string) => Rod;
  /** Meno priazne staršieho („Bitkár“) podľa scorecardu. */
  readonly nazovPriazne: (scorecard: string) => string;
}

const spakov = (n: number): string => pocet(n, "špak", "špaky", "špakov");

/** Štítok nad portrétom v kroku: text, kratší na telefón a farba (hráč, chip = plný). */
export interface StitokSuhrnu {
  readonly text: string;
  readonly kratko: string;
  readonly trieda: "ja" | "su" | "chip-ja" | "chip-su" | "ne";
}

export function stitkyKroku(e: StarsiVSuhrne, k: KrokSuhrnu, ja: PlayerId, c: KontextSuhrnu): readonly StitokSuhrnu[] {
  const rod = c.rod(e.defId);
  const t = (p: PlayerId): "ja" | "su" => (p === ja ? "ja" : "su");
  if (k === "bodovanie") return ([0, 1] as const).filter((p) => e.bod[p] > 0).map((p) => ({ text: `+${spakov(e.bod[p])}`, kratko: `+${e.bod[p]}`, trieda: p === ja ? "chip-ja" : "chip-su" }));
  if (k === "reci") return e.pokles.map((x) => ({ text: `▼ reči ${x.na === 0 ? "zanikli" : slovoStupna(x.na, rod)}`, kratko: `▼ reči ${x.na === 0 ? "zanikli" : slovoStupna(x.na, rod)}`, trieda: t(x.hrac) }));
  if (k === "nakladacka") return e.nakladacka === null ? [] : [{ text: `▲ strach ${slovoStupna(e.nakladacka.na, rod)} · za ${e.nakladacka.cena}`, kratko: `▲ strach ${slovoStupna(e.nakladacka.na, rod)}`, trieda: t(e.nakladacka.hrac) }];
  if (k === "hadka") return e.hadka === null ? [] : [{ text: `▲ reči ${slovoStupna(e.hadka.na, rod)} · za ${e.hadka.cena}`, kratko: `▲ reči ${slovoStupna(e.hadka.na, rod)}`, trieda: t(e.hadka.hrac) }];
  const out: StitokSuhrnu[] = [];
  if (e.vazen !== null) return out;
  if (e.priazen.zmena) {
    const na = e.priazen.na;
    const komu = na.hrac === null ? "nikto" : `${c.mena[na.hrac]} +${na.sila}`;
    out.push({ text: `${c.nazovPriazne(e.scorecard)} → ${komu}`, kratko: `${c.nazovPriazne(e.scorecard)} → ${na.hrac === null ? "nikto" : `+${na.sila}`}`, trieda: na.hrac === null ? "ne" : t(na.hrac) });
  }
  if (e.presvedcil !== null) out.push({ text: `✦ presvedčený · ${c.mena[e.presvedcil]}`, kratko: "✦", trieda: t(e.presvedcil) });
  for (const z of e.ohrozenie) out.push({ text: `⛓ ${c.mena[z.hrac]} môže zajať`, kratko: "⛓", trieda: "ne" });
  return out;
}

/** Riadky pod menom staršieho (veľký stôl): krátko, čo sa v kroku stalo; v konci všetko spolu. */
export function riadkyKroku(e: StarsiVSuhrne, k: KrokSuhrnu, c: KontextSuhrnu): readonly string[] {
  const rod = c.rod(e.defId);
  const m = c.mena;
  const nakl = (): string[] => (e.nakladacka === null ? [] : [`▲ ${m[e.nakladacka.hrac]} strach → ${slovoStupna(e.nakladacka.na, rod)}${k === "koniec" ? "" : ` · za ${e.nakladacka.cena}`}`]);
  const hadka = (): string[] => (e.hadka === null ? [] : [`▲ ${m[e.hadka.hrac]} reči → ${slovoStupna(e.hadka.na, rod)}${k === "koniec" ? "" : ` · za ${e.hadka.cena}`}`]);
  const pokles = (): string[] => e.pokles.map((x) => `▼ ${m[x.hrac]} reči ${x.na === 0 ? "zanikli" : `→ ${slovoStupna(x.na, rod)}`}`);
  if (k === "bodovanie") return ([0, 1] as const).filter((p) => e.bod[p] > 0).map((p) => `${m[p]} +${e.bod[p]} (${e.bodZaReci[p] ? `${slovoStupna(e.bodStupen[p], rod)} — reči` : slovoStupna(e.bodStupen[p], rod)})`);
  if (k === "reci") return pokles();
  if (k === "nakladacka") return [...nakl(), ...(e.nakladacka?.zanikli === true ? [`${m[e.nakladacka.hrac]}: reči zanikli pod strachom`] : [])];
  if (k === "hadka") return hadka();
  if (e.vazen !== null) return [`⛓ v pivnici u ${m[e.vazen]}`];
  const pr = (p: PriazenSuhrnu): string => (p.hrac === null ? "nikto" : `${m[p.hrac]} +${p.sila}`);
  return [
    ...nakl(),
    ...hadka(),
    ...(e.priazen.zmena ? [`priazeň: ${pr(e.priazen.od)} → ${pr(e.priazen.na)}`] : []),
    ...pokles(),
    ...(e.presvedcil !== null ? [`✦ ${m[e.presvedcil]} ho presvedčil — karta staršieho je jeho, jeho reči zanikli`] : []),
    ...e.ohrozenie.map((z) => `⛓ ${m[z.hrac]} môže zajať`),
  ];
}

/** Veta kroku v páse nad radom starších. */
export function opisKroku(s: SuhrnBitky, k: KrokSuhrnu, c: KontextSuhrnu): string {
  const m = c.mena;
  const zoznam = (f: (e: StarsiVSuhrne) => number | null): string =>
    s.starsi
      .flatMap((e) => {
        const x = f(e);
        return x === null ? [] : [`${c.menoStarsieho(e.defId)} (${x})`];
      })
      .join(", ");
  if (k === "bodovanie") {
    const nove = s.starsi.some((e) => e.fazy[0] !== undefined && noveReci(e.fazy[0]));
    const ako = nove
      ? s.vitaz === null
        ? "Na sekeru — obaja len za stupne, ktoré držia rečami."
        : "Reči bodujú obom, víťaz navyše za svoj strach bez stupňov, ktoré drží súper."
      : s.vitaz === null
        ? "Na sekeru — obaja len za reči."
        : "Víťaz za vrch teplomera, porazený len za reči.";
    return `Starší bodujú podľa stavu pred bitkou. ${ako} Spolu ${m[0]} +${s.spolu[0]}, ${m[1]} +${s.spolu[1]}.`;
  }
  if (k === "reci") return s.starsi.some((e) => e.fazy[0] !== undefined && noveReci(e.fazy[0])) ? "Kto prehral hádku, tomu reči klesnú zospodu: spodný stupeň zanikne." : "Reči, ktoré bodovali, klesnú o stupeň. Kde by klesli na vlastný strach, zaniknú.";
  if (k === "nakladacka" && s.nakladacka !== null)
    return `${m[s.nakladacka.hrac]} dvíha Nakladačkou (${s.nakladacka.cena}) svoj strach: ${zoznam((e) => e.nakladacka?.cena ?? null)}. Plná časť rastie a hladina ide hore.`;
  if (k === "hadka" && s.hadka !== null) return `${m[s.hadka.hrac]} dvíha hádkou (${s.hadka.cena}) svoje reči: ${zoznam((e) => e.hadka?.cena ?? null)}. Šrafy rastú nad strachom.`;
  const vety = ["Zátvorka medzi hladinami je priazeň, prerušovaná čiara je hladina pred bitkou."];
  for (const e of s.starsi) if (e.vazen !== null) vety.push(`${c.menoStarsieho(e.defId)} je v pivnici u ${m[e.vazen]}.`);
  const ohr = [0, 1].flatMap((p) => {
    const kto = s.starsi.filter((e) => e.ohrozenie.some((z) => z.hrac === p)).map((e) => c.menoStarsieho(e.defId));
    return kto.length === 0 ? [] : [`${m[p as PlayerId]} môže ďalšou Nakladačkou zajať: ${kto.join(", ")}.`];
  });
  return [...vety, ...ohr].join(" ");
}
