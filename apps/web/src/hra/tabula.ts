// Čísla pultu a tabule ty | súper na šírku telefónu (PultHraca.tsx) — čisté funkcie bez DOM.

import type { ClientState, PlayerId, RiadokPrisunu, StavZavislosti } from "@naex/core";
import { KONSTANTY, cenaFajceniaHraca, limitZhromazdenia, sumaPrisunu } from "@naex/core";
import { nazovZdrojaPrisunu, spakov } from "../i18n/pocty.ts";
import type { PrisunDlazdice } from "./PeciatkaZdroja.tsx";
import type { SpakyTeraz } from "@naex/core";
import { titulBezExekucie, hroziVyhraStrachom, textCervenych } from "./vyhraStrachom.ts";
import { t } from "../i18n/jazyk.tsx";

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
  /** Niekto má dosť červených — pri výhre strachom sa exekúcia nekoná (krok 4c pred 4d). */
  readonly bezExekucie: boolean;
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
  /** Ďalšia vyfajčená cigareta v tejto Pitke (1, 2, 3…; Benzínka 0, 2, 3…). */
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
export const naStoleVysvetlenie = (): string => t("tabula.naStole");

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
    bezExekucie: prahy.exekucia > 0 && view.pata === undefined && hroziVyhraStrachom(view.vyhry),
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
    r("karty", t("tabula.kartyVRuke"), (c) => String(c.karty)),
    r("poldeci", t("tabula.poldeciPlneVypite"), (c) => `${c.poldeci} · ${c.vypite + c.naStole}`),
    r("limit", t("tabula.limitKariet"), (c) => String(c.limit)),
    r("cigarety", t("pult.cigarety"), (c) => String(c.cigarety)),
    r("spaky", t("pult.spaky"), (c) => String(c.spaky)),
    r("zaStarsich", t("tabula.zaStarsich"), (c) => `+${c.zaStarsich} · +${c.zaStarsichPrehra}`),
  ];
  if (ja.chut !== null || su.chut !== null) {
    riadky.push(r("chut", t("tabula.chutNeresti"), (c) => (c.chut === null ? "–" : `${c.chut} · ${c.nerestiDnes}`), (c) => c.chutHrozi));
  }
  riadky.push(
    r("abstaky", t("tabula.abstakyVBalicku"), (c) => String(c.abstaky), (c) => c.abstaky > 0),
    r("dlhy", t("pult.dlhy"), (c) => (c.exekucia > 0 ? t("tabula.dlhyExekucia", { dlhy: c.dlhy, n: c.exekucia }) : String(c.dlhy)), (c) => c.exekucia > 0),
    ...(ukazZadlzenie(ja.zadlzenie, ja.prahDlhu) || ukazZadlzenie(su.zadlzenie, su.prahDlhu)
      ? [r("zadlzenie", t("tabula.zadlzenie"), (c) => (ukazZadlzenie(c.zadlzenie, c.prahDlhu) ? `${c.zadlzenie}/${c.prahDlhu}` : "–"), (c) => zadlzenieHrozi(c.zadlzenie, c.prahDlhu))]
      : []),
    r("pecen", t("pult.pecen"), (c) => `${c.pecen}/${c.prahPecene}`, (c) => c.pecen >= c.prahPecene - 1),
    r("cirhozy", t("tabula.nepriznanaCirhoza"), (c) => String(c.cirhozyNepriznane), (c) => c.cirhozyNepriznane > 0),
    r("balicek", t("tabula.balicekOdhodene"), (c) => `${c.balicek} · ${c.odhodene}`),
    r("priznane", t("tabula.priznaneKliatby"), (c) => String(c.priznane)),
    r("dedicstvo", t("tabula.dedicstvo"), (c) => String(c.dedicstvo)),
    r("cervene", t("tabula.cervene"), (c) => textCervenych(c.cervene, c.vazni, c.cervenychNaVyhru).odznak),
    r("vazni", t("tabula.vazni"), (c) => `${c.vazni}/${c.vazniNaVyhru}`),
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
  const riadky = (rr: readonly RiadokPrisunu[], kedy: string) => rr.map((r) => [`${kedy} ${nazovZdrojaPrisunu(r.zdroj)}`, sumaPrisunu(r.suma)] as const);
  const { cakajuci, nedavny, hodnota } = prisun;
  const pride = cakajuci?.riadky ?? [];
  return [
    ...riadky(pride, t("tabula.pride")),
    ...(pride.length > 0 && cakajuci !== null ? [[cakajuci.po, `${hodnota} ▸ ${hodnota + cakajuci.suma}`] as const] : []),
    ...(nedavny === null ? [] : riadky(nedavny.riadky, t("tabula.naposledy"))),
  ];
}

export function detailZdroja(zdroj: ZdrojStlpca, c: CislaHraca, ja: boolean, prisun?: PrisunDlazdice): DetailZdroja {
  const cig = (n: number): string => t("tabula.cig", { n });
  switch (zdroj) {
    case "karty":
      return {
        nadpis: t("nav.karty"),
        text: ja ? t("tabula.kartyTextJa", { n: c.karty }) : t("tabula.kartyTextSu", { n: c.karty }),
        riadky: [
          [t("tabula.vRuke"), String(c.karty)],
          [t("tabula.doberaci"), String(c.balicek)],
          [t("tabula.odhodene"), String(c.odhodene)],
          [t("tabula.priznaneKliatbyMale"), String(c.priznane)],
          [t("tabula.dedicstvo"), String(c.dedicstvo)],
        ],
      };
    case "poldeci":
      return {
        nadpis: t("pult.poldeci"),
        text: t("tabula.poldeciText", { dolieva: KONSTANTY.POLDECI_NA_ZACIATKU_KOLA, spaky: KONSTANTY.SPAKY_ZA_POLDECI }) + (c.naStole > 0 ? ` ${naStoleVysvetlenie()}` : ""),
        riadky: [
          [t("tabula.plne"), String(c.poldeci)],
          [t("tabula.vypite"), String(c.vypite + c.naStole)],
          ...(c.naStole > 0 ? [[t("tabula.zTohoNaStole"), String(c.naStole)] as const] : []),
          [t("tabula.limitKarietMale"), String(c.limit)],
          ...riadkyPrisunu(prisun),
          [t("tabula.doliatVypity"), cig(KONSTANTY.REFILL_CENA)],
          [t("tabula.novyPoldeci"), cig(c.cenaBarteru)],
        ],
      };
    case "chut":
      return {
        nadpis: t("pult.chut"),
        text: t("tabula.chutText", { naex: KONSTANTY.NEREST_NAEX, ubytok: KONSTANTY.CHUT_UBYTOK }),
        riadky: [
          [t("pult.chut"), c.chut === null ? "–" : String(c.chut)],
          [t("tabula.nerestiDnes"), String(c.nerestiDnes)],
          [t("tabula.abstakyVBalicku"), String(c.abstaky)],
          [t("tabula.hroziAbstak"), c.chutHrozi ? t("tabula.ano") : t("tabula.nie")],
        ],
      };
    case "pecen":
      return {
        nadpis: t("pult.pecen"),
        text: t("tabula.pecenText", { prah: c.prahPecene, spaky: spakov(KONSTANTY.SPAKY_ZA_CIRHOZU) }),
        riadky: [
          [t("tabula.pecenMale"), t("tabula.zPrahu", { a: c.pecen, b: c.prahPecene })],
          [t("tabula.nepriznanaCirhozaMale"), String(c.cirhozyNepriznane)],
        ],
      };
    case "dlhy":
      return {
        nadpis: t("pult.dlhy"),
        text:
          (c.prahDlhu > 1 ? t("tabula.dlhyPrah", { n: c.prahDlhu }) : t("tabula.dlhyHazard")) +
          t("tabula.dlhyExekutor") +
          (c.bezExekucie ? ` ${titulBezExekucie()}` : ""),
        riadky: [
          [t("tabula.priznaneDlhy"), String(c.dlhy)],
          ...(ukazZadlzenie(c.zadlzenie, c.prahDlhu) ? [[t("tabula.zadlzenieMale"), t("tabula.zPrahu", { a: c.zadlzenie, b: c.prahDlhu })] as const] : []),
          [
            t("tabula.exekuciaVBitke"),
            c.exekucia > 0 ? `−${spakov(c.exekucia)}${c.bezExekucie ? t("tabula.niePriVyhreStrachom") : ""}` : t("tabula.nie"),
          ],
        ],
      };
    case "cigarety":
      return {
        nadpis: t("pult.cigarety"),
        text: t("tabula.cigaretyText", { jedna: KONSTANTY.CENA_SENKU[1] ?? 1, dve: KONSTANTY.CENA_SENKU[2] ?? 3, zaSpak: KONSTANTY.CIGARIET_ZA_SPAK }),
        riadky: [
          [t("tabula.cigaretyMale"), String(c.cigarety)],
          ...riadkyPrisunu(prisun),
          [t("tabula.fajcenieTeraz"), c.cenaFajcenia === 0 ? t("tabula.zadarmo") : cig(c.cenaFajcenia)],
          [t("tabula.doliatPoldeci"), cig(KONSTANTY.REFILL_CENA)],
          [t("tabula.novyPoldeci"), cig(c.cenaBarteru)],
          [t("tabula.nastrojDoDedicstva"), cig(c.cenaDedicstva)],
        ],
      };
    case "spaky":
      return {
        nadpis: t("pult.spaky"),
        text: t("tabula.spakyText"),
        riadky: [
          [t("tabula.spakyMale"), String(c.spaky)],
          [t("tabula.zaStarsichPoVyhre"), `+${c.zaStarsich}`],
          [t("tabula.zaStarsichPoPrehre"), `+${c.zaStarsichPrehra}`],
          [t("tabula.priazenStarsich"), String(c.priazen)],
          [t("tabula.cerveneMale"), textCervenych(c.cervene, c.vazni, c.cervenychNaVyhru).kratko],
          [t("tabula.vazniMale"), t("tabula.zPrahu", { a: c.vazni, b: c.vazniNaVyhru })],
        ],
      };
  }
}
