// Čísla pultu a tabule ty | súper na šírku telefónu (PultHraca.tsx) — čisté funkcie bez DOM.

import type { ClientState, PlayerId, RiadokPrisunu, StavZavislosti } from "@naex/core";
import { KONSTANTY, NAZVY_ZDROJOV_PRISUNU, cenaFajceniaHraca, limitZhromazdenia, spakov, sumaPrisunu } from "@naex/core";
import type { PrisunDlazdice } from "./PeciatkaZdroja.tsx";
import type { SpakyTeraz } from "@naex/core";

/** Prahy hráča (prahyHraca) — to, čo z nich pult a tabuľa ukazujú. */
export interface PrahyPultu {
  readonly cirhoza: number;
  readonly dlh: number;
  readonly exekucia: number;
  readonly priznaneDlhy: number;
}

/** Čísla jedného hráča pre pult a tabuľu. */
export interface CislaHraca {
  readonly karty: number;
  readonly balicek: number;
  readonly odhodene: number;
  readonly poldeci: number;
  readonly vypite: number;
  /** Poldeci z NA EX na stole — rátajú sa k vypitým (poldeciNaStole). */
  readonly naStole: number;
  readonly limit: number;
  readonly chut: number | null;
  readonly nerestiDnes: number;
  /** Chuť hrozí Absťákom (neresti pod latkou). */
  readonly chutHrozi: boolean;
  readonly abstaky: number;
  readonly dlhy: number;
  readonly exekucia: number;
  readonly zadlzenie: number;
  readonly prahDlhu: number;
  readonly cigarety: number;
  readonly pecen: number;
  readonly prahPecene: number;
  readonly spaky: number;
  /** Špaky od starších po najbližšej bitke, keď ju hráč vyhrá (v11). */
  readonly zaStarsich: number;
  /** … a keď ju prehrá — len reči. */
  readonly zaStarsichPrehra: number;
  readonly priznane: number;
  readonly dedicstvo: number;
  readonly vazni: number;
  readonly vazniNaVyhru: number;
  /** Červené strachy (väzni sa rátajú) a koľko treba na výhru (v11). */
  readonly cervene: number;
  readonly cervenychNaVyhru: number;
  readonly cirhozyNepriznane: number;
  /** Ďalšia vyfajčená cigareta v tejto Pitke (1, 2, 3…). */
  readonly cenaFajcenia: number;
  /** Nový plný poldeci za cigarety. */
  readonly cenaBarteru: number;
  /** Ďalší Nástroj do Dedičstva (cena rastie pre oboch). */
  readonly cenaDedicstva: number;
  /** Priazeň starších, ktorí sú na strane hráča. */
  readonly priazen: number;
}

/** Čo z pohľadu treba na poldeci hráča na stole. */
export type PohladNaPoldeci = Pick<ClientState, "strany" | "pitkaStav" | "zaverecne">;

/**
 * Poldeci, ktoré hráč dal cez NA EX a ešte ležia na stole. Plné už nie sú — v bitke sa
 * vypijú (§9.5), preto ich bar ráta k vypitým (Michal 2026-11-03).
 * `skryte` = NA EX lícom dole v Pitke: z plných sa odpíše až pri odkrytí. Súperove skryté
 * pohľad obsahuje len s Bzdochou, takže sa tu neprezradí nič, čo hráč nevidí.
 */
export function poldeciNaStole(view: PohladNaPoldeci, p: PlayerId): { readonly naStole: number; readonly skryte: number } {
  const skryte = (view.pitkaStav?.skryteNaex ?? []).filter((x) => x.hrac === p).length;
  const strany = view.strany[0].concat(view.strany[1]);
  const vLinii = strany.reduce((n, pl) => n + (pl.naexBy === p ? 1 : 0) + (pl.naexBy2 === p ? 1 : 0), 0);
  // Súperova Záverečná lícom dole v strany nie je — NA EX na jej rube je len v zaverecne.
  const naRube = view.zaverecne.filter((z) => z.naexBy === p && !strany.some((pl) => pl.card.uid === z.uid)).length;
  return { naStole: vLinii + naRube + skryte, skryte };
}

/** Do vysvetlenia poldeci, keď hráč má NA EX na stole (§9.5). */
export const NA_STOLE_VYSVETLENIE = "Poldeci z NA EX leží na stole a ráta sa k vypitým: v bitke sa vypije a vráti sa vypitý.";

/**
 * Čísla hráča z pohľadu: plné poldeci bez skrytých NA EX (tie už ležia na stole,
 * ako v bare na počítači), Chuť len keď ju partia má.
 */
export function cislaHraca(
  view: ClientState,
  p: PlayerId,
  prahy: PrahyPultu,
  z: StavZavislosti,
  body: SpakyTeraz,
  ine: { readonly cenaBarteru: number; readonly priazen: number } = { cenaBarteru: KONSTANTY.BARTER_CENA, priazen: 0 },
): CislaHraca {
  const h = view.hraci[p];
  const { naStole, skryte } = poldeciNaStole(view, p);
  return {
    karty: h.rukaPocet,
    balicek: h.doberaciPocet,
    odhodene: h.odhadzovaci.length,
    poldeci: Math.max(0, h.poldeciPlne - skryte),
    vypite: h.poldeciVypite,
    naStole,
    limit: limitZhromazdenia(view, p),
    chut: view.bezChuti === true ? null : z.chut,
    nerestiDnes: z.teraz,
    chutHrozi: z.vyhlad === "ziska",
    abstaky: z.abstaky,
    dlhy: prahy.priznaneDlhy,
    exekucia: prahy.exekucia,
    zadlzenie: h.zadlzenie,
    prahDlhu: prahy.dlh,
    cigarety: h.cigarety,
    pecen: h.pecen,
    prahPecene: prahy.cirhoza,
    spaky: view.spaky[p],
    zaStarsich: body.zaStarsichVyhra[p],
    zaStarsichPrehra: body.zaStarsichPrehra[p],
    priznane: h.priznane.length,
    dedicstvo: h.dedicstvo.length,
    vazni: view.vyhry.vazni[p],
    vazniNaVyhru: view.vyhry.vazniNaVyhru,
    cervene: view.vyhry.cervene[p],
    cervenychNaVyhru: view.vyhry.cervenychNaVyhru,
    cirhozyNepriznane: view.nepriznaneKliatby[p].cirhoza,
    cenaFajcenia: cenaFajceniaHraca(view, p),
    cenaBarteru: ine.cenaBarteru,
    cenaDedicstva: view.cenaDedicstva,
    priazen: ine.priazen,
  };
}

/**
 * Zadĺženie je samostatné číslo len pri prahu nad 1 (Výherný automat); pri prahu 1 je každý
 * Hazard hneď Dlh a „0/1“ by bol falošný počet (v11.8). Zvyšok z rozohranej partie sa ukáže.
 */
export function ukazZadlzenie(zadlzenie: number, prah: number): boolean {
  return prah > 1 || zadlzenie > 0;
}

/** Ďalší Hazard dá Dlh a zadĺženie k nemu už rastie — pri prahu 1 nie je k čomu rásť. */
export function zadlzenieHrozi(zadlzenie: number, prah: number): boolean {
  return prah > 1 && zadlzenie >= prah - 1;
}

/** Riadok tabule: popis a hodnoty oboch; `zle` = hodnota, ktorá hráčovi škodí. */
export interface RiadokTabule {
  readonly kluc: string;
  readonly popis: string;
  readonly ja: string;
  readonly su: string;
  readonly zleJa?: boolean;
  readonly zleSu?: boolean;
}

/** Riadky tabule ty | súper — všetko, čo na počítači ukazujú dlaždice oboch barov. */
export function riadkyTabule(ja: CislaHraca, su: CislaHraca): RiadokTabule[] {
  const r = (kluc: string, popis: string, f: (c: CislaHraca) => string, zle?: (c: CislaHraca) => boolean): RiadokTabule => ({
    kluc,
    popis,
    ja: f(ja),
    su: f(su),
    ...(zle === undefined ? {} : { zleJa: zle(ja), zleSu: zle(su) }),
  });
  const riadky: RiadokTabule[] = [
    r("karty", "Karty v ruke", (c) => String(c.karty)),
    r("poldeci", "Poldeci plné · vypité", (c) => `${c.poldeci} · ${c.vypite + c.naStole}`),
    r("limit", "Limit kariet", (c) => String(c.limit)),
    r("cigarety", "Cigarety", (c) => String(c.cigarety)),
    r("spaky", "Špaky", (c) => String(c.spaky)),
    r("zaStarsich", "Za starších (výhra · prehra)", (c) => `+${c.zaStarsich} · +${c.zaStarsichPrehra}`),
  ];
  if (ja.chut !== null || su.chut !== null) {
    riadky.push(r("chut", "Chuť · neresti dnes", (c) => (c.chut === null ? "–" : `${c.chut} · ${c.nerestiDnes}`), (c) => c.chutHrozi));
  }
  riadky.push(
    r("abstaky", "Absťáky v balíčku", (c) => String(c.abstaky), (c) => c.abstaky > 0),
    r("dlhy", "Dlhy", (c) => (c.exekucia > 0 ? `${c.dlhy} (−${c.exekucia} š.)` : String(c.dlhy)), (c) => c.exekucia > 0),
    ...(ukazZadlzenie(ja.zadlzenie, ja.prahDlhu) || ukazZadlzenie(su.zadlzenie, su.prahDlhu)
      ? [r("zadlzenie", "Zadĺženie", (c) => (ukazZadlzenie(c.zadlzenie, c.prahDlhu) ? `${c.zadlzenie}/${c.prahDlhu}` : "–"), (c) => zadlzenieHrozi(c.zadlzenie, c.prahDlhu))]
      : []),
    r("pecen", "Pečeň", (c) => `${c.pecen}/${c.prahPecene}`, (c) => c.pecen >= c.prahPecene - 1),
    r("cirhozy", "Nepriznaná Cirhóza", (c) => String(c.cirhozyNepriznane), (c) => c.cirhozyNepriznane > 0),
    r("balicek", "Balíček · odhodené", (c) => `${c.balicek} · ${c.odhodene}`),
    r("priznane", "Priznané kliatby", (c) => String(c.priznane)),
    r("dedicstvo", "Dedičstvo (náradie)", (c) => String(c.dedicstvo)),
    r("cervene", "Červené", (c) => `${c.cervene}/${c.cervenychNaVyhru}`),
    r("vazni", "Väzni", (c) => `${c.vazni}/${c.vazniNaVyhru}`),
  );
  return riadky;
}

/** Zdroj v stĺpci hráča na šírku telefónu — ťuk otvorí okno s podrobnosťami. */
export type ZdrojStlpca = "karty" | "poldeci" | "chut" | "pecen" | "dlhy" | "cigarety" | "spaky";

/** Obsah okna zdroja: to, čo na počítači hovorí dlaždica baru a jej nápoveda. */
export interface DetailZdroja {
  readonly nadpis: string;
  readonly text: string;
  readonly riadky: readonly (readonly [string, string])[];
}

/** Rozpis prísunu do okna zdroja: to isté, čo na počítači ukazuje nápoveda dlaždice. */
function riadkyPrisunu(prisun: PrisunDlazdice | undefined): readonly (readonly [string, string])[] {
  if (prisun === undefined) return [];
  const riadky = (rr: readonly RiadokPrisunu[], kedy: string) => rr.map((r) => [`${kedy} ${NAZVY_ZDROJOV_PRISUNU[r.zdroj]}`, sumaPrisunu(r.suma)] as const);
  const { cakajuci, nedavny, hodnota } = prisun;
  const pride = cakajuci?.riadky ?? [];
  return [
    ...riadky(pride, "príde:"),
    ...(pride.length > 0 && cakajuci !== null ? [[cakajuci.po, `${hodnota} ▸ ${hodnota + cakajuci.suma}`] as const] : []),
    ...(nedavny === null ? [] : riadky(nedavny.riadky, "naposledy:")),
  ];
}

export function detailZdroja(zdroj: ZdrojStlpca, c: CislaHraca, ja: boolean, prisun?: PrisunDlazdice): DetailZdroja {
  const kto = ja ? "Máš" : "Má";
  switch (zdroj) {
    case "karty":
      return {
        nadpis: "Karty",
        text: `${kto} v ruke ${c.karty}. Priznané kliatby a Nástroje v Dedičstve ukáže zoznam kariet.`,
        riadky: [
          ["v ruke", String(c.karty)],
          ["doberací balíček", String(c.balicek)],
          ["odhodené", String(c.odhodene)],
          ["priznané kliatby", String(c.priznane)],
          ["Dedičstvo (náradie)", String(c.dedicstvo)],
        ],
      };
    case "poldeci":
      return {
        nadpis: "Poldeci",
        text: `Limit vykladania = plné + 1; na začiatku kola sa ${KONSTANTY.POLDECI_NA_ZACIATKU_KOLA} vypitý doleje sám. Plný poldeci platí ďalšiu kartu v ťahu Zhromaždenia alebo NA EX v Pitke. Na konci hry je každý plný ${KONSTANTY.SPAKY_ZA_POLDECI} špak.${c.naStole > 0 ? ` ${NA_STOLE_VYSVETLENIE}` : ""}`,
        riadky: [
          ["plné", String(c.poldeci)],
          ["vypité", String(c.vypite + c.naStole)],
          ...(c.naStole > 0 ? [["z toho na stole (NA EX)", String(c.naStole)] as const] : []),
          ["limit kariet", String(c.limit)],
          ...riadkyPrisunu(prisun),
          ["doliať vypitý", `${KONSTANTY.REFILL_CENA} cig.`],
          ["nový poldeci", `${c.cenaBarteru} cig.`],
        ],
      };
    case "chut":
      return {
        nadpis: "Chuť",
        text: `Nerest je len to, čo vypiješ a vyfajčíš: Vypiť 1, NA EX ${KONSTANTY.NEREST_NAEX}, každá vyfajčená cigareta 1. Na konci kola: menej nerestí než Chuť = karta Absťák do balíčka (každá uberie v bitke 1 tuhé); potom Chuť = väčšie z (Chuť, neresti) − ${KONSTANTY.CHUT_UBYTOK}.`,
        riadky: [
          ["Chuť", c.chut === null ? "–" : String(c.chut)],
          ["neresti dnes", String(c.nerestiDnes)],
          ["Absťáky v balíčku", String(c.abstaky)],
          ["hrozí Absťák", c.chutHrozi ? "áno" : "nie"],
        ],
      };
    case "pecen":
      return {
        nadpis: "Pečeň",
        text: `Za každé ${c.prahPecene} poškodenia pečene vznikne v Pitke Cirhóza: nepriznaná na konci hry zoberie ${spakov(KONSTANTY.SPAKY_ZA_CIRHOZU)}, priznaná dá súperovi +1 tuhé v bitke. Po každej Pitke sa pečeň vynuluje.`,
        riadky: [
          ["pečeň", `${c.pecen} z ${c.prahPecene}`],
          ["nepriznaná Cirhóza", String(c.cirhozyNepriznane)],
        ],
      };
    case "dlhy":
      return {
        nadpis: "Dlhy",
        text: `${c.prahDlhu > 1 ? `Každé ${c.prahDlhu} zadĺženia v Pitke = Dlh, hneď priznaný; zvyšok zadĺženia ostáva na ďalší.` : "Každá akcia Hazard v Pitke = Dlh, hneď priznaný."} Za priznané Dlhy príde v každej bitke Exekútor: zhorí polovica Dlhov (nahor) a toľko špakov.`,
        riadky: [
          ["priznané Dlhy", String(c.dlhy)],
          ...(ukazZadlzenie(c.zadlzenie, c.prahDlhu) ? [["zadĺženie", `${c.zadlzenie} z ${c.prahDlhu}`] as const] : []),
          ["exekúcia v bitke", c.exekucia > 0 ? `−${spakov(c.exekucia)}` : "nie"],
        ],
      };
    case "cigarety":
      return {
        nadpis: "Cigarety",
        text: `Platíš nimi šenok (1 karta = ${KONSTANTY.CENA_SENKU[1] ?? 1}, 2 karty = ${KONSTANTY.CENA_SENKU[2] ?? 3}) a Dedičstvo; v Pitke fajčíš: karta za 1, ďalšia v tej istej Pitke za 2, potom 3… Na konci hry každých ${KONSTANTY.CIGARIET_ZA_SPAK} cigariet = 1 špak.`,
        riadky: [
          ["cigarety", String(c.cigarety)],
          ...riadkyPrisunu(prisun),
          ["fajčenie teraz", `${c.cenaFajcenia} cig.`],
          ["doliať poldeci", `${KONSTANTY.REFILL_CENA} cig.`],
          ["nový poldeci", `${c.cenaBarteru} cig.`],
          ["Nástroj do Dedičstva", `${c.cenaDedicstva} cig.`],
        ],
      };
    case "spaky":
      return {
        nadpis: "Špaky",
        text: "Špaky sú body: za vyhraté bitky, za karty v línii, za starších, ktorí sa boja, a na konci hry výkupné. Odkiaľ prišli, ukáže krčmová nástenka.",
        riadky: [
          ["špaky", String(c.spaky)],
          ["za starších po výhre", `+${c.zaStarsich}`],
          ["za starších po prehre", `+${c.zaStarsichPrehra}`],
          ["priazeň starších", String(c.priazen)],
          ["červené", `${c.cervene} z ${c.cervenychNaVyhru}`],
          ["väzni", `${c.vazni} z ${c.vazniNaVyhru}`],
        ],
      };
  }
}
