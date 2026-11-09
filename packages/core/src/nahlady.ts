// Náhľady ceny ťahu — kliatby oboch hráčov po zamýšľanom ťahu (NA EX,
// odpoveď na NA EX) a čo z nich prežije najbližšiu bitku. Návrh „Náhľady
// sľubujú inú cenu, než hra potom zúčtuje“ (playtest 20261021-143600, #1 B):
// Dlh ráta tým istým kódom ako motor (paleneDlhyVBitke), nie druhým vzorcom.
// Všetko z verejného stavu — súperovu ruku náhľad nepozná.

import type { CardInstance, PlayerId } from "./types.ts";
import type { GameData } from "./data.ts";
import { defOf } from "./data.ts";
import { efektyNavyse } from "./navyse.ts";
import {
  cielLokalitaId,
  cieleVykladania,
  cigaretyZPitky,
  lineState,
  naexCieleVLinii,
  nahladPitky,
  paleneDlhyVBitke,
  pocetPitiek,
  poskodenieBitky,
  prebytokNaRozdelenie,
  sPrilozenou,
  zablokovaneStrany,
} from "./engine.ts";
import { efektPotlaceny, naexPecenSuperovi, nasobokPitky, partiaHraca, svokraRany } from "./effects.ts";
import { opponentOf } from "./types.ts";
import { KONSTANTY } from "./constants.ts";
import type { LineEval } from "./partia.ts";
import { dlhyPoslednejPitky, evaluateLine } from "./partia.ts";
import type { BattleOutcome, DamageResult } from "./battle.ts";
import { battleOutcome, zhoriPriExekucii } from "./battle.ts";
import { zahradkarChrani } from "./engine.ts";
import type { ClientState } from "./view.ts";
import { cenaKliatby } from "./view.ts";
import { pocet } from "./jazyk.ts";
import { mozeEsteNaex } from "./hrozba.ts";

/** Stôl pre náhľad — línia a pečeň po zamýšľanom ťahu (ako pre nahladPitky). */
export type StolNahladu = Parameters<typeof nahladPitky>[1];

/** Dlhy jedného hráča z Pitiek kola a čo z nich ostane po najbližšej bitke. */
export interface DlhyDoBitky {
  /** Nové Dlhy v tejto Pitke a v ďalších Pitkách kola (ak sa na stole nič nezmení). */
  readonly nove: number;
  /** Priznané Dlhy pri poškodení — remíza, Herňa a Noviny (pred Robotou a Exekútorom, 2026-10-28). */
  readonly priPoskodeni: number;
  /** Koľko priznaných Dlhov bitka najviac spáli (Robota). */
  readonly kapacita: number;
  /** Koľko Dlhov (a toľko špakov) zhorí pri exekúcii (v6). */
  readonly exekucia: number;
  /** Priznané Dlhy po bitke. */
  readonly poBitke: number;
}

/**
 * Výhľad Dlhov do bitky oboch hráčov — doska hráča v Zhromaždení a Pitke.
 * Po poškodení a špakoch za bitku (Michal 2026-10-28) Robota spáli Dlhy a príde
 * Exekútor bez prahu; Záhradkár v partii ho obíde.
 */
export function vyhladDlhov(data: GameData, stol: StolNahladu, dalsiePitky: number): readonly [DlhyDoBitky, DlhyDoBitky] {
  const nahlad = nahladPitky(data, stol);
  // D6 (v7): zvyšok zadĺženia sa medzi Pitkami nemaže — sčíta sa za všetky Pitky.
  // Výherný automat (Dedičstvo, v7) a Hazard navyše „Posledná Pitka kola“ z línie (Traktorista bez
  // prevahy v jeho kraji, 2026-11-08): v poslednej Pitke kola Dlh za kus (engine pokracujPoPitke).
  const zLinie = dlhyPoslednejPitky(data, lineState(stol));
  const automat = (p: PlayerId): number =>
    (stol.hraci[p].dedicstvo.filter((k) => k.defId === "vyherny_automat").length + zLinie.reduce((n, d) => n + (d.hrac === p ? d.dlhy : 0), 0)) * nasobokPitky(stol);
  const noveDlhy = ([0, 1] as const).map((p) => Math.floor((nahlad[p].zadlzenie + nahlad[p].zadlzenieZoStola * (1 + dalsiePitky)) / nahlad[p].prahDlhu) + automat(p)) as [number, number];
  const kapacita = paleneDlhyVBitke(data, stol);
  const pre = (p: PlayerId): DlhyDoBitky => {
    const nove = noveDlhy[p];
    const teraz = stol.hraci[p].dlhy;
    const poPaleni = Math.max(0, teraz + nove - kapacita[p]);
    // Exekúcia bez prahu (Michal 2026-10-28); Záhradkár v partii ju obíde.
    const exekucia = zahradkarChrani(data, stol, p) ? 0 : zhoriPriExekucii(poPaleni);
    return { nove, priPoskodeni: teraz + nove, kapacita: kapacita[p], exekucia, poBitke: poPaleni - exekucia };
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
 * cigarety a mäkké poškodenie hráča po ťahu oproti stavu bez neho. Cigarety ráta tá istá
 * funkcia ako zúčtovanie (cigaretyZPitky) a Šofér na začiatku bitky, mäkké poškodenieBitky (hádka v10).
 */
export interface DopadyNahladu {
  /** Cigarety navyše: priamo (patronát) a vo vyhodnotení tejto aj ďalších Pitiek kola. */
  readonly cigarety: number;
  /** Mäkké poškodenie navyše v najbližšej bitke a koľko ho bude spolu (v10). */
  readonly makke: number;
  readonly makkeSpolu: number;
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
    const tato = s.vizia === null ? cigaretyZPitky(sums, nasobokPitky(s))[p] : 0;
    const dalej = cigaretyZPitky(sums, nasobokPitky(s))[p] * dalsie;
    return {
      cigarety: s.hraci[p].cigarety + tato + dalej,
      makke: poskodenieBitky(data, stolPriPoskodeni(data, s, dalsie), sums).makke[p],
    };
  };
  const pre = (p: PlayerId): DopadyNahladu => {
    const a = stav(pred, p, dPred);
    const b = stav(po, p, dPo);
    return {
      cigarety: b.cigarety - a.cigarety,
      makke: b.makke - a.makke,
      makkeSpolu: b.makke,
    };
  };
  return [pre(0), pre(1)];
}

/**
 * Stôl tak, ako ho bitka uvidí pri poškodení: priznané Dlhy po Pitkách kola
 * (Dlh sa hneď prizná); Robota a Exekútor prídu až po poškodení (Michal 2026-10-28).
 * Priznané Dlhy súpera sú strop mäkkého — náhľad ich predtým bral spred Pitky.
 */
export function stolPriPoskodeni(data: GameData, s: ClientState, dalsiePitky: number): ClientState {
  if (s.faza !== "pitka" && s.faza !== "zhromazdenie") return s;
  if (s.ciel === null) return s;
  const vyhlad = vyhladDlhov(data, s, dalsiePitky);
  const hraci: [ClientState["hraci"][0], ClientState["hraci"][1]] = [s.hraci[0], s.hraci[1]];
  for (const p of [0, 1] as const) {
    const d = vyhlad[p].priPoskodeni;
    if (hraci[p].dlhy !== d) hraci[p] = { ...hraci[p], dlhy: d };
  }
  return { ...s, hraci };
}

/**
 * Poškodenie bitky na stole zo stolPriPoskodeni: línia sa vyhodnotí s Dlhmi po Pitkách kola —
 * Vymáhač (Rana za každé 2 priznané Dlhy) ich v bitke ráta tiež (playtest 2026-11-09).
 */
export function poskodenieStola(data: GameData, stol: ClientState): DamageResult {
  return poskodenieBitky(data, stol, evaluateLine(data, lineState(stol)).sums);
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
  // Od v7 stojí posun vždy 1 (Miňištrant ho už nezdražuje).
  const cenaPosunu = 1;
  return { drzi, prebytok: outcome.prebytok, naRozdelenie, cenaPosunu, posuny: Math.floor(naRozdelenie / cenaPosunu) };
}

/**
 * Celá cena ťahu (návrh #49, Michal 2026-10-26 „áno, celá cena“): bitka pred
 * a po (tuhé, mäkké, prebytok), kliatby a ostatné dopady oboch hráčov. Klient
 * aj konzolový klient ju berú odtiaľto, aby sa stôl „po ťahu“ neskladal na
 * dvoch miestach inak.
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
  const liniaPred = evaluateLine(data, lineState(pred));
  const liniaPo = evaluateLine(data, lineState(po));
  // Pred ťahom platí počet Pitiek zo servera — súperovu Záverečnú lícom dole pohľad v línii nemá.
  // Po ťahu sa pripočíta, o koľko ťah počet Pitiek zmení.
  const zacate = pred.faza === "pitka" ? pred.pitkaCislo : pred.pitkaCislo + 1;
  const dPred = pred.faza === "pitka" || pred.faza === "zhromazdenie" ? Math.max(0, pred.pitkyCelkom - zacate) : 0;
  const dalsie: DalsiePitky = [dPred, Math.max(0, dPred + dalsiePitkyKola(data, po) - dalsiePitkyKola(data, pred))];
  const bitkaPred = stolPriPoskodeni(data, pred, dalsie[0]);
  const bitkaPo = stolPriPoskodeni(data, po, dalsie[1]);
  const poskPred = poskodenieStola(data, bitkaPred);
  const poskPo = poskodenieStola(data, bitkaPo);
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
 * Pohľad hráča `view.ja` s jeho skrytými NA EX (v5) tak, ako ich motor zúčtuje
 * pri odkrytí: poldeci na karte, pečeň +1 — základ náhľadu
 * ďalšieho NA EX a výhľadov Pitky. Súperove skryté NA EX klient nevidí.
 */
export function sMojimiSkrytymiNaex(data: GameData, view: ClientState): ClientState {
  const skryte = (view.pitkaStav?.skryteNaex ?? []).filter((x) => x.hrac === view.ja);
  let v = view;
  for (const x of skryte) v = poOdkrytiNaex(data, v, x.uid)?.view ?? v;
  return v;
}

/**
 * Súperove skryté NA EX, ktoré hráč s Bzdochou vidí (server ich pošle len jemu), odkryté tak,
 * ako ich odkryje motor — bitka „pred“ v náhľade NA EX je potom tá z odhadu bitky (playtest
 * 2026-11-09, Vilo N7). NA EX na kartu `okrem` ostáva skryté: zrážku na nej zloží poOdkrytiNaex.
 */
export function sVidenymiSuperovymiNaex(data: GameData, view: ClientState, okrem?: number): ClientState {
  const su = opponentOf(view.ja);
  let v = view;
  for (const x of (view.pitkaStav?.skryteNaex ?? []).filter((y) => y.hrac === su && y.uid !== okrem)) {
    const po = poOdkrytiNaex(data, { ...v, ja: su }, x.uid);
    if (po !== null) v = { ...po.view, ja: view.ja };
  }
  return v;
}

/** Pohľad po odkrytí jedného NA EX hráča `view.ja` a čo pri ňom motor zúčtoval. */
export interface PoOdkrytiNaex {
  readonly view: ClientState;
  /**
   * Svokra súpera (Michal 2026-10-26): Rany, ktoré ti v bitke udelí za toto NA EX
   * na jeho kartu — tuhé po ťahu ich už ráta, toto ich len pomenuje.
   */
  readonly svokra: number;
  /** Kar (Pitka, v7): pečeň za toto NA EX dostane súper, nie ty. */
  readonly kar: boolean;
}

/**
 * Pohľad hráča `view.ja` po odkrytí jeho NA EX na kartu `uid` — v poradí
 * odhalNaex v motore: poldeci na kartu (zo zásoby plných), pečeň +1 (na Kare
 * súperovi). Na kartu s poldeci či mimo línie null.
 */
export function poOdkrytiNaex(data: GameData, view: ClientState, uid: number): PoOdkrytiNaex | null {
  const ja = view.ja;
  const su = opponentOf(ja);
  const kde = view.strany.findIndex((st) => st.some((pl) => pl.card.uid === uid && pl.naexBy === undefined));
  // Súperova skrytá Záverečná nie je v strany — NA EX na ňu nesie jej náhradné uid.
  const naRub = kde === -1 && view.zaverecne.some((z) => z.uid === uid && z.naexBy === null);
  if (kde === -1 && !naRub) return null;
  // Bzdocha: súperovo skryté NA EX na tú istú kartu hráč vidí — pri odkrytí bude zrážka
  // a z karty Výtržník (playtest 20261030-184957, Šimon: náhľad sľuboval bežné NA EX).
  // Poradie ako odhalNaex: naexBy obranca, naexBy2 útočník.
  const zrazka = kde !== -1 && (view.pitkaStav?.skryteNaex ?? []).some((x) => x.hrac === su && x.uid === uid);
  const obr = opponentOf(view.utocnik);
  const sNaex = (pl: ClientState["strany"][0][number]): ClientState["strany"][0][number] =>
    zrazka ? { ...pl, naexBy: obr, naexBy2: view.utocnik, vytrznik: true } : { ...pl, naexBy: ja };
  const strany: [ClientState["strany"][0], ClientState["strany"][1]] = [view.strany[0], view.strany[1]];
  if (kde !== -1) strany[kde as PlayerId] = view.strany[kde as PlayerId].map((pl) => (pl.card.uid === uid ? sNaex(pl) : pl));
  const zaverecne = naRub ? view.zaverecne.map((z) => (z.uid === uid ? { ...z, naexBy: ja } : z)) : view.zaverecne;
  const naexVKole: [boolean, boolean] = [view.naexVKole[0], view.naexVKole[1]];
  naexVKole[ja] = true;
  const sKartou: ClientState = { ...view, strany, zaverecne, naexVKole };
  const h = view.hraci[ja];
  const svokra = svokraRany(data, sKartou, su) - svokraRany(data, view, su);
  const kar = naexPecenSuperovi(view);
  const pitka = view.pitkaStav;
  const hraci: [ClientState["hraci"][0], ClientState["hraci"][1]] = [view.hraci[0], view.hraci[1]];
  hraci[ja] = { ...h, poldeciPlne: Math.max(0, h.poldeciPlne - 1), pecen: h.pecen + (kar ? 0 : 1) };
  hraci[su] = { ...hraci[su], pecen: hraci[su].pecen + (kar ? 1 : 0) };
  const naexPocet: [number, number] = [pitka?.naexPocet?.[0] ?? 0, pitka?.naexPocet?.[1] ?? 0];
  naexPocet[ja] += 1;
  if (zrazka) {
    // Pri zrážke sa odkryje aj súperovo NA EX na tej karte — karta ho už nesie, takže ho nikto
    // neodkryje znova: jeho poldeci a pečeň (na Kare tebe) sa zúčtujú tu (playtest 2026-11-09, Šimon N7).
    const s = hraci[su];
    hraci[su] = { ...s, poldeciPlne: Math.max(0, s.poldeciPlne - 1), pecen: s.pecen + (kar ? 0 : 1) };
    hraci[ja] = { ...hraci[ja], pecen: hraci[ja].pecen + (kar ? 1 : 0) };
    naexPocet[su] += 1;
    naexVKole[su] = true;
  }
  const pitkaStav = pitka === null ? null : { ...pitka, naexPocet };
  return { view: { ...sKartou, hraci, pitkaStav }, svokra, kar };
}

/** Náhľad NA EX na jednu kartu: celá cena a čo sa zúčtuje pri odkrytí. */
export interface NahladNaexNaKartu extends CenaTahu {
  readonly odkrytie: PoOdkrytiNaex;
}

/**
 * Najhoršia odpoveď súpera na NA EX z náhľadu `n` (najhorsiaOdpoved) — zvlášť,
 * lebo skúša celú sadu (≈ 7 ms na kartu): klient ju ráta len pre vybranú kartu.
 */
export function najhorsiaOdpovedNaNaex(data: GameData, n: NahladNaexNaKartu): NajhorsiaOdpoved | null {
  return najhorsiaOdpoved(data, n.odkrytie.view, n.dalsiePitky[1]);
}

/** Odpoveď súpera, ktorá by hráčovi `ja` dopadla najhoršie. */
export interface NajhorsiaOdpoved {
  /** Vzorová karta (druh a rozloženie strán) — súper ju mať nemusí. */
  readonly karta: CardInstance;
  /** Na koniec čej strany ju súper vyloží. */
  readonly strana: PlayerId;
  readonly damage: DamageResult;
  readonly vysledok: BattleOutcome;
}

/**
 * Najhoršia verejne možná odpoveď súpera na NA EX (playtest 20261026-173610-3,
 * N5: náhľad 6 : 3, po Dievčine na vydaj 6 : 4). Súperova ruka je skrytá, preto
 * sa skúša každý druh karty sady, ktorý smie do línie, v každom rozložení
 * vnútornej hrany, na koniec oboch strán — ako bežné vyloženie (cieleVykladania,
 * Most, skrytá Záverečná). Hodnotí sa ako hrozba: víťaz, potom prebytok.
 * `po` je pohľad hráča `po.ja` po jeho NA EX (poOdkrytiNaex). Nástup odpovede
 * (Snúbenica) nepredvída.
 */
export function najhorsiaOdpoved(
  data: GameData,
  po: ClientState,
  dalsiePitky: number,
): NajhorsiaOdpoved | null {
  const ja = po.ja;
  const su = opponentOf(ja);
  // Odpoveď stojí plný poldeci (v11.16) — bez neho súper neodpovie.
  if (po.ciel === null || po.hraci[su].rukaPocet <= 0 || po.hraci[su].poldeciPlne < KONSTANTY.CENA_ODPOVEDE_POLDECI) return null;
  const hodnotaPreMna = (v: BattleOutcome): number =>
    (v.vitaz === null ? 0 : v.vitaz === ja ? 1000 : -1000) + (v.prebytokDrzi === null ? 0 : v.prebytokDrzi === ja ? v.prebytok : -v.prebytok);
  // Odpoveď smie zmeniť počet Pitiek (spáruje hranu lokality) — ďalšie Pitky ako cenaTahu, inak by
  // náhľad nezarátal Dlhy z pridanej Pitky (napr. aktívny Dlh, ktorý NA EX pri neaktívnom Posilnení nezruší).
  const pitkyPo = dalsiePitkyKola(data, po);
  const bitka = (s: ClientState): DamageResult => poskodenieStola(data, stolPriPoskodeni(data, s, Math.max(0, dalsiePitky + dalsiePitkyKola(data, s) - pitkyPo)));
  let najhorsia: NajhorsiaOdpoved | null = null;
  let najhorsiaHodnota = hodnotaPreMna(battleOutcome(bitka(po)));
  const lokalita = cielLokalitaId(po);
  const zablokovane = zablokovaneStrany(po);
  for (const def of data.cards.values()) {
    if (def.tags.includes("Lokalita") || def.tags.includes("Starešina")) continue;
    const varianty = data.variants.get(def.id);
    if (varianty === undefined) continue;
    // Pri konci strany sa páruje len vnútorná hrana — stačí meniť jednu stranu karty.
    const rozlozenia: [number, number][] = [
      ...Array.from({ length: varianty.left.length }, (_, l): [number, number] => [l, 0]),
      ...Array.from({ length: Math.max(0, varianty.right.length - 1) }, (_, r): [number, number] => [0, r + 1]),
    ];
    for (const [leftLayout, rightLayout] of rozlozenia) {
      const karta: CardInstance = { uid: -900, defId: def.id, leftLayout, rightLayout };
      const ciele = cieleVykladania(data, po.strany, su, karta, Number.POSITIVE_INFINITY, true, lokalita, zablokovane);
      for (const ciel of ciele) {
        if (ciel !== "vlastna" && ciel !== "superova") continue;
        const strana: PlayerId = ciel === "vlastna" ? su : ja;
        // Konflikt (v7) môže pri odpovedi zmeniť bitku — ten istý výpočet ako vylozDoLinie.
        const damage = bitka(sPrilozenou(data, po, strana, karta, su));
        const vysledok = battleOutcome(damage);
        const h = hodnotaPreMna(vysledok);
        if (h < najhorsiaHodnota) {
          najhorsiaHodnota = h;
          najhorsia = { karta, strana, damage, vysledok };
        }
      }
    }
  }
  return najhorsia;
}

/**
 * Náhľad NA EX hráča `view.ja` na kartu `uid` (návrh #49): základom je pohľad
 * s jeho už skrytými NA EX (sMojimiSkrytymiNaex), stôl po NA EX skladá
 * poOdkrytiNaex — tie isté kroky ako motor. Zrážku ráta, len keď súperovo NA EX
 * na tú istú kartu hráč vidí (Bzdocha); platí, ak súper neodpovie.
 */
export function nahladNaexNaKartu(data: GameData, view: ClientState, uid: number, ceny: readonly [CenyKliatob, CenyKliatob]): NahladNaexNaKartu | null {
  const zaklad = sVidenymiSuperovymiNaex(data, sMojimiSkrytymiNaex(data, view), uid);
  const odkrytie = poOdkrytiNaex(data, zaklad, uid);
  if (odkrytie === null) return null;
  return { ...cenaTahu(data, zaklad, odkrytie.view, ceny), odkrytie };
}

// ---------------------------------------------------------------------------
// Návrh #38 B (Michal 2026-10-28): náhľady ukážu celú cenu — kliatby z cudzieho
// NA EX a efekty Prehra. Jeden výpočet pre web aj klienta AI hráčov.

/** Efekty Prehra kariet v línii — index = porazený, čísla dostane víťaz. */
export interface EfektyPrehry {
  /** Dievčina na vydaj: víťaz získa toľko Dlhov, koľko mala aktívnych akcií. */
  readonly dievcina: readonly [number, number];
}

/**
 * Efekty Prehra podľa stola teraz — ten istý výber kariet ako koniecBitky
 * (odkrytá karta v partii porazeného, nie spálená ani umlčaná) a tie
 * isté aktívne akcie (evaluateLine). Motor ich ráta až po tom, čo sa poldeci
 * z NA EX vypijú a zmiznú z kariet — NA EX ich teda nemení, Výtržník áno.
 */
export function efektyPrehry(data: GameData, v: ClientState): EfektyPrehry {
  const bezNaex = (pl: ClientState["strany"][0][number]): ClientState["strany"][0][number] => {
    if (pl.naexBy === undefined && pl.naexBy2 === undefined) return pl;
    const { naexBy: _a, naexBy2: _b, ...zvysok } = pl;
    return zvysok;
  };
  const linia = evaluateLine(data, lineState({ ...v, strany: [v.strany[0].map(bezNaex), v.strany[1].map(bezNaex)] }));
  const spalit = new Set(v.bitkaStav?.spalit ?? []);
  const aktivne = (uid: number): number => {
    const ev = linia.cards.get(uid);
    return ev === undefined ? 0 : [...ev.left, ...ev.right].reduce((a, x) => a + (x?.stav === "aktivna" ? x.nasobok : 0), 0);
  };
  const pre = (porazeny: PlayerId): number => {
    const partia = partiaHraca(v, porazeny).filter((pl) => pl.zaverecna !== true);
    return partia
      .filter((pl) => pl.card.defId === "dievcina_na_vydaj" && efektyNavyse(defOf(data, pl.card)).length === 0 && !spalit.has(pl.card.uid) && !efektPotlaceny(data, v, porazeny, pl.card.defId))
      .reduce((a, pl) => a + aktivne(pl.card.uid), 0);
  };
  return { dievcina: [pre(0), pre(1)] };
}

/** Efekty Prehra porazeného `porazeny` slovami z pohľadu hráča `ja`; prázdne pole, keď nič. */
export function textyEfektovPrehry(e: EfektyPrehry, porazeny: PlayerId, ja: PlayerId): string[] {
  const vitaz = porazeny === ja ? "súper" : "ty";
  const ziska = porazeny === ja ? "získa" : "získaš";
  return [
    e.dievcina[porazeny] > 0 ? `Dievčina na vydaj: ${vitaz} ${ziska} ${pocet(e.dievcina[porazeny], "Dlh", "Dlhy", "Dlhov")}` : "",
  ].filter((x) => x !== "");
}

/** Kliatby, ktoré by hráčovi `obet` pridalo NA EX hráča `hrac` z kariet na stole. */
export interface HrozbaKliatob {
  readonly hrac: PlayerId;
  readonly obet: PlayerId;
  /** Karta v línii (alebo náhradné uid skrytej Záverečnej), na ktorú by NA EX dal. */
  readonly uid: number;
  /** Cirhózy a Dlhy obete navyše do konca kola (táto aj ďalšie Pitky). */
  readonly cirhozy: number;
  readonly dlhy: number;
  /** Špaky obete (záporné): nepriznané Cirhózy na konci, exekúcia v bitke, Herňa súperovi. */
  readonly spaky: number;
}

/**
 * Hrozba kliatob na stole (#38 A, Michal 2026-10-28 „od 1 Cirhózy alebo 1 Dlhu“): NA EX
 * hráča `hrac` na kartu z verejnej línie, ktoré by jeho súperovi pridalo najviac kliatob
 * do konca kola — aj keď víťaza bitky nezmení. Ten istý výpočet ako náhľad NA EX
 * (kliatbyNahladu, vyhladDlhov); ruka sa neráta. Null, keď také NA EX nie je.
 * `smie` = hráč ešte smie pred bitkou dať NA EX (mozeEsteNaex).
 */
export function hrozbaKliatob(data: GameData, view: ClientState, hrac: PlayerId, smie: boolean): HrozbaKliatob | null {
  if (!smie || view.ciel === null || (view.faza !== "zhromazdenie" && view.faza !== "pitka")) return null;
  const obet = opponentOf(hrac);
  const ceny = ([0, 1] as const).map(() => ({ cirhoza: cenaKliatby("cirhoza"), dlh: cenaKliatby("dlh") })) as [CenyKliatob, CenyKliatob];
  const zacate = view.faza === "pitka" ? view.pitkaCislo : view.pitkaCislo + 1;
  const dPred = Math.max(0, view.pitkyCelkom - zacate);
  const dlhyPred = vyhladDlhov(data, view, dPred);
  // Odkrytie NA EX hráča `hrac` tým istým kódom ako jeho náhľad (poOdkrytiNaex) — z verejného stavu.
  const zaHraca: ClientState = { ...view, ja: hrac };
  let najhorsia: HrozbaKliatob | null = null;
  for (const uid of naexCieleVLinii(data, lineState(view), hrac, false, zablokovaneStrany(view))) {
    const odkryte = poOdkrytiNaex(data, zaHraca, uid);
    if (odkryte === null) continue;
    const po: ClientState = { ...odkryte.view, ja: view.ja };
    const dPo = Math.max(0, dPred + dalsiePitkyKola(data, po) - dalsiePitkyKola(data, view));
    const k = kliatbyNahladu(data, view, po, [dPred, dPo], ceny)[obet];
    const cirhozy = k.cirhozy + k.dalejCirhozy;
    const dlhy = k.dlhy + k.dalejDlhy;
    if (cirhozy < 1 && dlhy < 1) continue;
    const dlhyPo = vyhladDlhov(data, po, dPo);
    let spaky = k.body - (dlhyPo[obet].exekucia - dlhyPred[obet].exekucia);
    // Herňa (Bitka, v7): víťaz dostane navyše toľko špakov, koľko má porazený priznaných Dlhov.
    if (view.ciel.lokalita?.defId === "herna") {
      const vitaz = battleOutcome(poskodenieStola(data, stolPriPoskodeni(data, po, dPo))).vitaz;
      if (vitaz === hrac) spaky -= dlhyPo[obet].priPoskodeni - dlhyPred[obet].priPoskodeni;
    }
    const h: HrozbaKliatob = { hrac, obet, uid, cirhozy, dlhy, spaky };
    if (najhorsia === null || cirhozy + dlhy > najhorsia.cirhozy + najhorsia.dlhy || (cirhozy + dlhy === najhorsia.cirhozy + najhorsia.dlhy && spaky < najhorsia.spaky)) najhorsia = h;
  }
  return najhorsia;
}

export interface VystrahaPecene {
  /** Cirhózy navyše do konca kola z tohto vyloženia, [hráč 0, hráč 1]. */
  readonly cirhozy: readonly [number, number];
  /** Špaky za ne na konci hry (záporné). */
  readonly spaky: readonly [number, number];
  /**
   * Súperovo NA EX z verejnej línie: Cirhózy, ktoré by hráčovi pridalo ešte navyše. Len keď
   * ho vyloženie zhorší — hrozbu, ktorá platí aj bez karty, by si hráč pripísal na jej vrub.
   */
  readonly naex: HrozbaKliatob | null;
}

/**
 * Výstraha pečene pred vyložením (Michal 2026-11-06; playtest 20261106: chodila až po vyložení).
 * Platí pre každú kartu, aj bez vlastnej Pečene či Poldeci: Silná žena zdvojí Pečeň suseda.
 * `pred` je pohľad hráča bez karty, `po` s ňou. Počíta to isté čo náhľad ťahu (cenaTahu)
 * a HROZBA KLIATOB, len z pohľadu, takže súperovu ruku ani jeho skryté NA EX nepozná.
 * Null, keď karta žiadnu Cirhózu nehrozí.
 */
export function vystrahaPecene(data: GameData, pred: ClientState, po: ClientState): VystrahaPecene | null {
  const su = opponentOf(pred.ja);
  const cena = cenaKliatby("cirhoza");
  const k = cenaTahu(data, pred, po, [{ cirhoza: cena, dlh: 0 }, { cirhoza: cena, dlh: 0 }]).kliatby;
  const navyse = (p: PlayerId): number => Math.max(0, k[p].cirhozy + k[p].dalejCirhozy);
  const cirhozy = [navyse(0), navyse(1)] as const;
  const hrozba = (v: ClientState): HrozbaKliatob | null =>
    hrozbaKliatob(data, v, su, mozeEsteNaex(v, { faza: v.faza, pitkaStav: v.pitkaStav, pitkaCislo: v.pitkaCislo, pitkyCelkom: v.pitkyCelkom, poldeciPlne: [v.hraci[0].poldeciPlne, v.hraci[1].poldeciPlne] }, su));
  const hrozbaPo = hrozba(po);
  const naex = hrozbaPo !== null && hrozbaPo.cirhozy > (hrozba(pred)?.cirhozy ?? 0) ? hrozbaPo : null;
  if (cirhozy[0] === 0 && cirhozy[1] === 0 && naex === null) return null;
  return { cirhozy, spaky: [cirhozy[0] * cena, cirhozy[1] * cena], naex };
}

/** „Cirhóza +1, Dlh +2, −3 špaky“ — ten istý text hrozby kliatob pre web aj klienta AI hráčov. */
export function textHrozbyKliatob(h: Pick<HrozbaKliatob, "cirhozy" | "dlhy" | "spaky">): string {
  return [
    h.cirhozy > 0 ? `Cirhóza +${h.cirhozy}` : "",
    h.dlhy > 0 ? `Dlh +${h.dlhy}` : "",
    h.spaky < 0 ? `−${pocet(-h.spaky, "špak", "špaky", "špakov")}` : "",
  ]
    .filter((x) => x !== "")
    .join(", ");
}
