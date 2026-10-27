// Náhľady ceny ťahu — kliatby oboch hráčov po zamýšľanom ťahu (NA EX,
// odpoveď na NA EX) a čo z nich prežije najbližšiu bitku. Návrh „Náhľady
// sľubujú inú cenu, než hra potom zúčtuje“ (playtest 20261021-143600, #1 B):
// Dlh ráta tým istým kódom ako motor (paleneDlhyVBitke), nie druhým vzorcom.
// Všetko z verejného stavu — súperovu ruku náhľad nepozná.

import type { CardInstance, PlayerId } from "./types.ts";
import type { GameData } from "./data.ts";
import {
  cigaretyZPitky,
  dlhyPolicajtky,
  lineState,
  nahladPitky,
  paleneDlhyVBitke,
  pocetPitiek,
  pohorseniaVBitke,
  poskodenieBitky,
  prebytokNaRozdelenie,
  silaPriazne,
  verejneAbstaky,
} from "./engine.ts";
import { efektHraca, efektPotlaceny, exekutorLokality, partiaHraca, silaDoDna, svokraRany } from "./effects.ts";
import { opponentOf } from "./types.ts";
import type { LineEval } from "./partia.ts";
import { evaluateLine } from "./partia.ts";
import type { DamageResult } from "./battle.ts";
import { battleOutcome, exekutorCheck, zhoriPriExekucii } from "./battle.ts";
import { cenaPatronatu, MARKER_STRED } from "./elders.ts";
import type { ClientState } from "./view.ts";
import { hodnotaPohorseni } from "./view.ts";

/** Stôl pre náhľad — línia a pečeň po zamýšľanom ťahu (ako pre nahladPitky). */
export type StolNahladu = Parameters<typeof nahladPitky>[1];

/** Dlhy jedného hráča z Pitiek kola a čo z nich ostane po najbližšej bitke. */
export interface DlhyDoBitky {
  /** Nové Dlhy v tejto Pitke a v ďalších Pitkách kola (ak sa na stole nič nezmení). */
  readonly nove: number;
  /** Koľko priznaných Dlhov bitka najviac spáli (Robota, Dievčina na vydaj). */
  readonly kapacita: number;
  /** Koľko Dlhov (a toľko špakov) zhorí pri exekúcii (v6). */
  readonly exekucia: number;
  /** Priznané Dlhy po bitke. */
  readonly poBitke: number;
}

/**
 * Výhľad Dlhov do bitky oboch hráčov — doska hráča v Zhromaždení a Pitke.
 * Po páleni (Dievčina na vydaj, Robota) príde Exekútor: v6 je exekúcia
 * automatická, zhorí polovica (Záhradkár zachráni len špaky, nie Dlhy).
 */
export function vyhladDlhov(data: GameData, stol: StolNahladu, dalsiePitky: number): readonly [DlhyDoBitky, DlhyDoBitky] {
  const nahlad = nahladPitky(data, stol);
  const kapacita = paleneDlhyVBitke(data, stol);
  const urad = exekutorLokality(stol);
  const pre = (p: PlayerId): DlhyDoBitky => {
    const n = nahlad[p];
    const nove = n.dlhy + Math.floor(n.zadlzenieZoStola / n.prahDlhu) * dalsiePitky;
    const teraz = stol.hraci[p].priznane.filter((k) => k.defId === "dlh").length;
    const poPaleni = Math.max(0, teraz + nove - kapacita[p]);
    const exekucia = exekutorCheck(poPaleni + urad.zlava, silaPriazne(data, stol, "EXEKUTOR", opponentOf(p))) ? zhoriPriExekucii(poPaleni) : 0;
    return { nove, kapacita: kapacita[p], exekucia, poBitke: poPaleni - exekucia };
  };
  return [pre(0), pre(1)];
}

/** Čo zamýšľaný ťah zmení na kliatbach hráča — rozdiel „po“ mínus „pred“. */
export interface KliatbyNahladu {
  /** Cirhózy a Dlhy navyše v tejto Pitke. */
  readonly cirhozy: number;
  readonly dlhy: number;
  /** Navyše v ďalších Pitkách kola (karty na stole sa vyhodnotia znova). */
  readonly dalejCirhozy: number;
  readonly dalejDlhy: number;
  /** O koľko viac priznaných Dlhov ostane po najbližšej bitke — toľko Dlhov naozaj stojí body. */
  readonly dlhyPoBitke: number;
  /** Špaky na konci hry (v6): Cirhózy ako nepriznané (cenaKliatby), Dlhy po bitke. */
  readonly body: number;
}

/**
 * Ďalšie Pitky kola [pred ťahom, po ňom] — odpoveď či vyloženie smie počet
 * Pitiek zmeniť (§7 Počet Pitiek), preto ho náhľad ráta pre každý stôl zvlášť.
 */
export type DalsiePitky = readonly [number, number];

export interface CenyKliatob {
  readonly cirhoza: number;
  readonly dlh: number;
}

/**
 * Kliatby oboch hráčov po ťahu oproti stavu bez neho. `ceny` sú body jednej
 * kliatby pri dnešných scorecardoch (cenaKliatby), [hráč 0, hráč 1].
 */
export function kliatbyNahladu(
  data: GameData,
  pred: StolNahladu,
  po: StolNahladu,
  dalsiePitky: number | DalsiePitky,
  ceny: readonly [CenyKliatob, CenyKliatob],
): readonly [KliatbyNahladu, KliatbyNahladu] {
  const [dPred, dPo] = typeof dalsiePitky === "number" ? [dalsiePitky, dalsiePitky] : dalsiePitky;
  const np = [nahladPitky(data, pred), nahladPitky(data, po)] as const;
  const dl = [vyhladDlhov(data, pred, dPred), vyhladDlhov(data, po, dPo)] as const;
  const pre = (p: PlayerId): KliatbyNahladu => {
    const a = np[0][p];
    const b = np[1][p];
    const zaPitku = (n: typeof a): number => Math.floor(n.pecenZoStola / n.prahPecene);
    const cirhozy = b.cirhozy - a.cirhozy;
    const dalejCirhozy = zaPitku(b) * dPo - zaPitku(a) * dPred;
    const dlhy = b.dlhy - a.dlhy;
    const dalejDlhy = dl[1][p].nove - b.dlhy - (dl[0][p].nove - a.dlhy);
    const dlhyPoBitke = dl[1][p].poBitke - dl[0][p].poBitke;
    return {
      cirhozy,
      dlhy,
      dalejCirhozy,
      dalejDlhy,
      dlhyPoBitke,
      body: (cirhozy + dalejCirhozy) * ceny[p].cirhoza + dlhyPoBitke * ceny[p].dlh,
    };
  };
  return [pre(0), pre(1)];
}

/**
 * Zvyšok ceny ťahu mimo kliatob a tuhého (návrh #1, playtest 20261024-075830):
 * cigarety, Pohoršenia a mäkké poškodenie hráča po ťahu oproti stavu bez
 * neho. Cigarety a Pohoršenia rátajú tie isté funkcie ako zúčtovanie
 * (cigaretyZPitky, pohorseniaVBitke), mäkké poškodenieBitky.
 */
export interface DopadyNahladu {
  /** Cigarety navyše: priamo (patronát) a vo vyhodnotení tejto aj ďalších Pitiek kola. */
  readonly cigarety: number;
  /** Pohoršenia navyše v najbližšej bitke a koľko ich bude spolu. */
  readonly pohorsenia: number;
  readonly pohorseniaSpolu: number;
  /** ≈ o koľko Pohoršenia navyše pohnú rozdiel bodov hráča (on − súper), hltavo (hodnotaPohorseni). */
  readonly pohorseniaBody: number;
  /** Mäkké poškodenie navyše v najbližšej bitke. */
  readonly makke: number;
}

export function dopadyNahladu(
  data: GameData,
  pred: ClientState,
  po: ClientState,
  dalsiePitky: number | DalsiePitky,
): readonly [DopadyNahladu, DopadyNahladu] {
  const [dPred, dPo] = typeof dalsiePitky === "number" ? [dalsiePitky, dalsiePitky] : dalsiePitky;
  const stav = (s: ClientState, p: PlayerId, dalsie: number) => {
    const sums = evaluateLine(data, lineState(s)).sums;
    // Vo Vízii je táto Pitka už vyhodnotená — ako nahladPitky.
    const tato = s.vizia === null ? cigaretyZPitky(data, s, sums, s.pitkaCislo)[p] : 0;
    const dalej = cigaretyZPitky(data, s, sums, s.pitkaCislo + 1)[p] * dalsie;
    const pohorsenia = pohorseniaVBitke(data, s, sums)[p];
    return {
      cigarety: s.hraci[p].cigarety + tato + dalej,
      pohorsenia,
      pohorseniaBody: hodnotaPohorseni(data, s, p, pohorsenia),
      makke: poskodenieBitky(data, stolPriPoskodeni(data, s, dalsie), sums, [0, 0]).makke[p],
    };
  };
  const pre = (p: PlayerId): DopadyNahladu => {
    const a = stav(pred, p, dPred);
    const b = stav(po, p, dPo);
    return {
      cigarety: b.cigarety - a.cigarety,
      pohorsenia: b.pohorsenia - a.pohorsenia,
      pohorseniaSpolu: b.pohorsenia,
      pohorseniaBody: b.pohorseniaBody - a.pohorseniaBody,
      makke: b.makke - a.makke,
    };
  };
  return [pre(0), pre(1)];
}

/**
 * Stôl tak, ako ho bitka uvidí pri poškodení: priznané Dlhy po Pitkách kola
 * (Dlh sa hneď prizná), po pálení (Dievčina na vydaj na začiatku bitky,
 * Robota v kroku Exekútora) a po Exekútorovi (zhorí polovica, v6).
 * Priznané Dlhy súpera sú strop mäkkého — náhľad ich predtým bral spred Pitky.
 * Benzínku nepredvída.
 */
export function stolPriPoskodeni(data: GameData, s: ClientState, dalsiePitky: number): ClientState {
  if (s.faza !== "pitka" && s.faza !== "zhromazdenie") return s;
  if (s.ciel === null) return s;
  const vyhlad = vyhladDlhov(data, s, dalsiePitky);
  const hraci: [ClientState["hraci"][0], ClientState["hraci"][1]] = [s.hraci[0], s.hraci[1]];
  for (const p of [0, 1] as const) {
    const d = vyhlad[p].poBitke;
    const h = s.hraci[p];
    const stare = h.priznane.filter((k) => k.defId === "dlh");
    if (stare.length === d) continue;
    const nove: CardInstance[] = Array.from({ length: Math.max(0, d - stare.length) }, (_, i) => ({ uid: -1000 - 100 * p - i, defId: "dlh", leftLayout: 0, rightLayout: 0 }));
    hraci[p] = { ...h, priznane: [...h.priznane.filter((k) => k.defId !== "dlh"), ...stare.slice(0, d), ...nove] };
  }
  return { ...s, hraci };
}

/** Ďalšie Pitky kola na stole `s` — ten istý výpočet ako aktualizujPitky a koniec Pitky v motore. */
export function dalsiePitkyKola(data: GameData, s: ClientState): number {
  if (s.faza !== "pitka" && s.faza !== "zhromazdenie") return 0;
  const zacate = s.faza === "pitka" ? s.pitkaCislo : s.pitkaCislo + 1;
  return Math.max(zacate, pocetPitiek(data, s)) - zacate;
}

/** Prebytok bitky a čo z neho držiteľ naozaj rozdelí (Puška, Miňištrant). */
export interface PrebytokNahladu {
  readonly drzi: PlayerId | null;
  readonly prebytok: number;
  /** Po Puške v súperovom Dedičstve (prebytokNaRozdelenie). */
  readonly naRozdelenie: number;
  /** Cena jedného posunu markera — víťazovi ju zdvíha každý jeho Miňištrant. */
  readonly cenaPosunu: number;
  /** Koľko posunov markera z prebytku vyjde. */
  readonly posuny: number;
}

export function prebytokNahladu(s: ClientState, damage: DamageResult): PrebytokNahladu {
  const outcome = battleOutcome(damage);
  const drzi = outcome.prebytokDrzi;
  const naRozdelenie = prebytokNaRozdelenie(s, outcome);
  const cenaPosunu = drzi !== null && drzi === outcome.vitaz ? 1 + partiaHraca(s, drzi).filter((pl) => pl.card.defId === "ministrant").length : 1;
  return { drzi, prebytok: outcome.prebytok, naRozdelenie, cenaPosunu, posuny: Math.floor(naRozdelenie / cenaPosunu) };
}

/**
 * Celá cena ťahu (návrh #49, Michal 2026-10-26 „áno, celá cena“): bitka pred
 * a po (tuhé, mäkké, prebytok), kliatby a ostatné dopady oboch hráčov. Klient
 * aj konzolový klient ju berú odtiaľto, aby sa stôl „po ťahu“ neskladal na
 * dvoch miestach inak. Moje Absťáky v ruke poznám, súperove nie.
 */
export interface CenaTahu {
  readonly pred: DamageResult;
  readonly po: DamageResult;
  readonly prebytokPred: PrebytokNahladu;
  readonly prebytokPo: PrebytokNahladu;
  readonly kliatby: readonly [KliatbyNahladu, KliatbyNahladu];
  readonly dopady: readonly [DopadyNahladu, DopadyNahladu];
  readonly dalsiePitky: DalsiePitky;
  /** Línia po ťahu — z nej klient ukáže zmeny akcií a vzorec karty. */
  readonly liniaPo: LineEval;
  readonly liniaPred: LineEval;
}

export function cenaTahu(data: GameData, pred: ClientState, po: ClientState, ceny: readonly [CenyKliatob, CenyKliatob]): CenaTahu {
  const ja = pred.ja;
  const abstaky = (s: ClientState): readonly [number, number] => {
    const naStole = new Set(s.strany.flat().map((pl) => pl.card.uid));
    const n = s.ruka.filter((k) => k.defId === "abstak" && !naStole.has(k.uid)).length;
    return ja === 0 ? [n, 0] : [0, n];
  };
  const liniaPred = evaluateLine(data, lineState(pred));
  const liniaPo = evaluateLine(data, lineState(po));
  // Pred ťahom platí počet Pitiek zo servera — súperovu Záverečnú lícom dole pohľad v línii nemá.
  // Po ťahu sa pripočíta, o koľko ťah počet Pitiek zmení.
  const zacate = pred.faza === "pitka" ? pred.pitkaCislo : pred.pitkaCislo + 1;
  const dPred = pred.faza === "pitka" || pred.faza === "zhromazdenie" ? Math.max(0, pred.pitkyCelkom - zacate) : 0;
  const dalsie: DalsiePitky = [dPred, Math.max(0, dPred + dalsiePitkyKola(data, po) - dalsiePitkyKola(data, pred))];
  const bitkaPred = stolPriPoskodeni(data, pred, dalsie[0]);
  const bitkaPo = stolPriPoskodeni(data, po, dalsie[1]);
  const poskPred = poskodenieBitky(data, bitkaPred, liniaPred.sums, abstaky(pred));
  const poskPo = poskodenieBitky(data, bitkaPo, liniaPo.sums, abstaky(po));
  return {
    pred: poskPred,
    po: poskPo,
    prebytokPred: prebytokNahladu(bitkaPred, poskPred),
    prebytokPo: prebytokNahladu(bitkaPo, poskPo),
    kliatby: kliatbyNahladu(data, pred, po, dalsie, ceny),
    dopady: dopadyNahladu(data, pred, po, dalsie),
    dalsiePitky: dalsie,
    liniaPo,
    liniaPred,
  };
}

/**
 * Čo jedno ďalšie NA EX hráča p zúčtuje pri odkrytí (v5, NA EX naraz) — tým istým
 * poradím ako odhalNaex v motore: Výpalné z jeho cigariet. `doDna`: poldeci z neho
 * sa po bitke vráti plný (Na zdravie, Alkoholik). Súperove skryté NA EX náhľad
 * nepozná, preto zrážku (Výtržník) nesľubuje.
 */
export interface OdkrytieNaex {
  /** Cigarety, ktoré za toto NA EX zaplatíš súperovi (Výpalné), najviac koľko máš. */
  readonly vypalne: number;
  readonly doDna: boolean;
}

export function odkrytieNaex(data: GameData, view: ClientState, p: PlayerId): OdkrytieNaex {
  const vypalne = Math.min(silaPriazne(data, view, "NEPRAJNIK", opponentOf(p)), view.hraci[p].cigarety);
  const linia = view.strany.flat();
  const naStole =
    linia.filter((pl) => pl.naexBy === p || pl.naexBy2 === p).length +
    view.zaverecne.filter((z) => z.naexBy === p && !linia.some((pl) => pl.card.uid === z.uid)).length;
  return { vypalne: Math.max(0, vypalne), doDna: naStole < silaDoDna(data, view, p) };
}

/**
 * Pohľad hráča `view.ja` s jeho skrytými NA EX (v5) tak, ako ich motor zúčtuje
 * pri odkrytí: poldeci na karte, pečeň +1, Výpalné — základ náhľadu
 * ďalšieho NA EX a výhľadov Pitky. Súperove skryté NA EX klient nevidí.
 */
export function sMojimiSkrytymiNaex(data: GameData, view: ClientState): ClientState {
  const skryte = (view.pitkaStav?.skryteNaex ?? []).filter((x) => x.hrac === view.ja);
  let v = view;
  for (const x of skryte) v = poOdkrytiNaex(data, v, x.uid)?.view ?? v;
  return v;
}

/** Náhradné uid Dlhov od Policajtky v náhľade — pod nimi, aby ich Vychovávateľka nebrala. */
const UID_DLHU_POLICAJTKY = -950000;

/** Pohľad po odkrytí jedného NA EX hráča `view.ja` a čo pri ňom motor zúčtoval. */
export interface PoOdkrytiNaex extends OdkrytieNaex {
  readonly view: ClientState;
  /**
   * Svokra súpera (Michal 2026-10-26): Rany, ktoré ti v bitke udelí za toto NA EX
   * na jeho kartu — tuhé po ťahu ich už ráta, toto ich len pomenuje.
   */
  readonly svokra: number;
  /**
   * Policajtka súpera (Michal 2026-10-26): Dlhy, ktoré dostaneš pri odkrytí, lebo
   * týmto NA EX dáš v Pitke viac NA EX ako súper — ak on žiadne nedá (jeho skryté
   * NA EX náhľad nevidí). V pohľade sú už priznané.
   */
  readonly policajtka: number;
  /** Vychovávateľka: jeden môj priznaný Dlh odíde súperovi do doberacieho balíčka. */
  readonly vychovavatelka: boolean;
  /**
   * Krčmárka: bez NA EX v kole by ti na začiatku bitky otočila vypitý poldeci
   * na plný — toto NA EX ju o to pripraví.
   */
  readonly krcmarka: boolean;
}

/**
 * Pohľad hráča `view.ja` po odkrytí jeho NA EX na kartu `uid` — v poradí
 * odhalNaex v motore: poldeci na kartu (zo zásoby plných), pečeň +1,
 * Vychovávateľka, Výpalné, nakoniec Policajtka súpera. Vychovávateľka sa
 * posudzuje až s poldeci na karte, ako v motore. Na kartu s poldeci či mimo
 * línie null.
 */
export function poOdkrytiNaex(data: GameData, view: ClientState, uid: number): PoOdkrytiNaex | null {
  const ja = view.ja;
  const su = opponentOf(ja);
  const kde = view.strany.findIndex((st) => st.some((pl) => pl.card.uid === uid && pl.naexBy === undefined));
  // Súperova skrytá Záverečná nie je v strany — NA EX na ňu nesie jej náhradné uid.
  const naRub = kde === -1 && view.zaverecne.some((z) => z.uid === uid && z.naexBy === null);
  if (kde === -1 && !naRub) return null;
  const doDna = odkrytieNaex(data, view, ja).doDna;
  const strany: [ClientState["strany"][0], ClientState["strany"][1]] = [view.strany[0], view.strany[1]];
  if (kde !== -1) strany[kde as PlayerId] = view.strany[kde as PlayerId].map((pl) => (pl.card.uid === uid ? { ...pl, naexBy: ja } : pl));
  const zaverecne = naRub ? view.zaverecne.map((z) => (z.uid === uid ? { ...z, naexBy: ja } : z)) : view.zaverecne;
  const naexVKole: [boolean, boolean] = [view.naexVKole[0], view.naexVKole[1]];
  naexVKole[ja] = true;
  const sKartou: ClientState = { ...view, strany, zaverecne, naexVKole };
  const h = view.hraci[ja];
  // Ako zacniBitku: Krčmárka len bez Absťáku (verejného ani v ruke) a s vypitým poldeci.
  const abstaky = verejneAbstaky(view, ja) + view.ruka.filter((k) => k.defId === "abstak").length;
  const krcmarka =
    !view.naexVKole[ja] && efektHraca(view, ja, "krcmarka") && !efektPotlaceny(data, view, ja, "krcmarka") && abstaky === 0 && h.poldeciVypite > 0;
  // Dlh od Policajtky príde v motore až po všetkých NA EX — Vychovávateľka ho nepresunie.
  const presunie = (k: CardInstance): boolean => k.defId === "dlh" && k.uid > UID_DLHU_POLICAJTKY;
  const vychovavatelka =
    efektHraca(sKartou, ja, "vychovavatelka") && !efektPotlaceny(data, sKartou, ja, "vychovavatelka") && h.priznane.some(presunie);
  const indexDlhu = vychovavatelka ? h.priznane.findIndex(presunie) : -1;
  const svokra = svokraRany(data, sKartou, su) - svokraRany(data, view, su);
  const vypalne = Math.max(0, Math.min(silaPriazne(data, sKartou, "NEPRAJNIK", su), h.cigarety));
  // Počet NA EX Pitky: moje zúčtované navyše o toto, súperove skryté nevidno (ráta sa, že nedá).
  const pitka = view.pitkaStav;
  const moje = pitka?.naexPocet?.[ja] ?? 0;
  const jeho = pitka?.naexPocet?.[su] ?? 0;
  const policajtka = pitka === null ? 0 : dlhyPolicajtky(data, sKartou, su, moje + 1, jeho) - dlhyPolicajtky(data, sKartou, su, moje, jeho);
  const odPolicajtky: CardInstance[] = Array.from({ length: policajtka }, (_, i) => ({ uid: UID_DLHU_POLICAJTKY - 10 * ja - i, defId: "dlh", leftLayout: 0, rightLayout: 0 }));
  const hraci: [ClientState["hraci"][0], ClientState["hraci"][1]] = [view.hraci[0], view.hraci[1]];
  hraci[ja] = {
    ...h,
    poldeciPlne: Math.max(0, h.poldeciPlne - 1),
    pecen: h.pecen + 1,
    cigarety: h.cigarety - vypalne,
    priznane: [...(indexDlhu === -1 ? h.priznane : h.priznane.filter((_, i) => i !== indexDlhu)), ...odPolicajtky],
  };
  hraci[su] = { ...hraci[su], cigarety: hraci[su].cigarety + vypalne };
  const naexPocet: [number, number] = [pitka?.naexPocet?.[0] ?? 0, pitka?.naexPocet?.[1] ?? 0];
  naexPocet[ja] += 1;
  const pitkaStav = pitka === null ? null : { ...pitka, naexPocet };
  return { view: { ...sKartou, hraci, pitkaStav }, svokra, policajtka, vypalne, doDna, vychovavatelka, krcmarka };
}

/** Náhľad NA EX na jednu kartu: celá cena a čo sa zúčtuje pri odkrytí. */
export interface NahladNaexNaKartu extends CenaTahu {
  readonly odkrytie: PoOdkrytiNaex;
}

/**
 * Náhľad NA EX hráča `view.ja` na kartu `uid` (návrh #49): základom je pohľad
 * s jeho už skrytými NA EX (sMojimiSkrytymiNaex), stôl po NA EX skladá
 * poOdkrytiNaex — tie isté kroky ako motor. Platí, ak súper NA EX nedá na tú
 * istú kartu (zrážka) a neodpovie.
 */
export function nahladNaexNaKartu(data: GameData, view: ClientState, uid: number, ceny: readonly [CenyKliatob, CenyKliatob]): NahladNaexNaKartu | null {
  const zaklad = sMojimiSkrytymiNaex(data, view);
  const odkrytie = poOdkrytiNaex(data, zaklad, uid);
  if (odkrytie === null) return null;
  return { ...cenaTahu(data, zaklad, odkrytie.view, ceny), odkrytie };
}

/**
 * Stôl po patronáte hráča `view.ja` (bez karty na scorecarde — tá je
 * súperovi skrytá): marker do stredu, cigarety zaplatené, súper dostane
 * v bitke Pohoršenia. Pre dopadyNahladu.
 */
export function stavPoPatronate(view: ClientState, elderId: string): ClientState {
  const elder = view.starsi.find((e) => e.elderId === elderId);
  if (elder === undefined) return view;
  const cena = cenaPatronatu(elder);
  const ja = view.ja;
  const hraci: [ClientState["hraci"][0], ClientState["hraci"][1]] = [view.hraci[0], view.hraci[1]];
  hraci[ja] = { ...hraci[ja], cigarety: hraci[ja].cigarety - cena.cigarety };
  const patronat: [ClientState["patronat"][0], ClientState["patronat"][1]] = [view.patronat[0], view.patronat[1]];
  patronat[ja] = { elderId, pohorsenia: cena.pohorsenia };
  return {
    ...view,
    hraci,
    patronat,
    starsi: view.starsi.map((e) => (e.elderId === elderId ? { ...e, marker: MARKER_STRED } : e)),
  };
}
