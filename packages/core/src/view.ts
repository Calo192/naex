// viewFor — BEZPEČNOSTNÁ HRANICA (M6).
//
// Toto je jediné miesto, ktoré rozhoduje, čo hráč vidí. Zo stavu sa NIKDY
// nesmie dostať von: obsah súperovej ruky, obsah ani poradie ŽIADNEHO
// doberacieho balíčka (vlastného, súperovho, spoločného), súperov balíček
// stavby šenku a jeho výber v kroku stavby. Posielajú sa len počty. Skryť kartu v rozhraní je bezcenné — filtruje sa TU a testuje sa to.

import type { CardInstance, Phase, PlayerId } from "./types.ts";
import type { GameData } from "./data.ts";
import type { PlacedCard } from "./partia.ts";
import type { BodPodmienky, ElderState } from "./elders.ts";
import { elderScore } from "./elders.ts";
import type {
  BitkaKrok,
  CielKola,
  GameState,
  KartaVolba,
  KoniecHry,
  PitkaStav,
  VyberStavby,
  ZhromazdenieStav,
} from "./engine.ts";
import { limitRukyHraca, mozeHrat, najdiNahradnikov, najdiNastroje, naTahu } from "./engine.ts";
import { MARKER_STRED, posunMarker, priazenHraca, priazenSila } from "./elders.ts";
import type { DamageResult } from "./battle.ts";

export interface HracVerejne {
  readonly rukaPocet: number;
  readonly doberaciPocet: number;
  /** Odhadzovací balíček je verejný — karty doň padajú lícom nahor. */
  readonly odhadzovaci: readonly CardInstance[];
  readonly priznane: readonly CardInstance[];
  readonly dedicstvo: readonly CardInstance[];
  readonly poldeciPlne: number;
  readonly poldeciVypite: number;
  readonly cigarety: number;
  readonly pecen: number;
  readonly zadlzenie: number;
  /**
   * Neresti tohto a predošlého kola (Absťák). Verejné — pitie, fajčenie aj
   * NA EX vidí každý pri stole.
   */
  readonly nerestiTotoKolo: number;
  readonly nerestiMinuleKolo: number;
}

export interface BitkaVerejne {
  readonly krok: BitkaKrok | null;
  readonly caka: PlayerId | null;
  readonly damage: DamageResult | null;
  readonly vitaz: PlayerId | null;
  readonly prebytokDrzi: PlayerId | null;
  readonly prebytokZostava: number;
  readonly pohorsenieZostava: readonly [number, number];
  readonly pohnuteMarkery: readonly string[];
  readonly benzinkaZostava: readonly [number, number];
  readonly lokalitaPrepadne: boolean;
  /** Karty v línii, ktoré sa po bitke spália (Dievčina na vydaj). */
  readonly spalit: readonly number[];
}

/**
 * Draft z pohľadu hráča: z balíčkov stavby šenku vidí len svoj; súperov
 * výber v kroku len ako „vybral“ (karty sa odhalia, až keď vyberú obaja).
 */
export interface DraftVerejne {
  readonly krok: "stavba" | "beranie";
  readonly mojBalicek: readonly CardInstance[];
  readonly balicekPocet: readonly [number, number];
  readonly mojVyber: VyberStavby | null;
  readonly vybral: readonly [boolean, boolean];
  readonly naTahu: PlayerId;
  readonly hotovo: readonly [boolean, boolean];
  readonly noveKarty: readonly [number, number];
  /** Karty zaplatené poldeci, ktoré si hráč ešte vezme (verejné). */
  readonly kredit: readonly [number, number];
}

export interface ClientState {
  readonly ja: PlayerId;
  readonly faza: Phase;
  readonly kolo: number;
  readonly utocnik: PlayerId;
  readonly naTahu: PlayerId | null;
  /** Smiem teraz hrať? Pri stavbe šenku hrajú obaja naraz, inak = naTahu === ja. */
  readonly mozemHrat: boolean;
  readonly pitkaCislo: number;
  readonly pitkyCelkom: number;
  /** „Ešte jednu!“ — hráč, ktorý práve smie objednať ďalšiu rundu (verejné). */
  readonly ponukaRundy: PlayerId | null;
  /** Moja ruka — jediná ruka, ktorá sa posiela celá. */
  readonly ruka: readonly CardInstance[];
  readonly hraci: readonly [HracVerejne, HracVerejne];
  readonly spolocnyBalicekPocet: number;
  readonly senok: readonly CardInstance[];
  readonly lokalityVHre: readonly CardInstance[];
  readonly lokalitCelkom: number;
  readonly ovladnute: readonly { readonly karta: CardInstance; readonly hrac: PlayerId }[];
  /** Lokality, ktoré nikto nevyhral (Benzínka). */
  readonly prepadnute: readonly CardInstance[];
  /** Limit ruky na konci kola (6 + priazeň Zberateľa). */
  readonly limitRuky: readonly [number, number];
  readonly naexVKole: readonly [boolean, boolean];
  readonly starsi: readonly ElderState[];
  readonly ciel: CielKola | null;
  readonly lokalitaOtocena: boolean;
  readonly strany: readonly [readonly PlacedCard[], readonly PlacedCard[]];
  readonly draftStav: DraftVerejne | null;
  readonly zhromazdenieStav: ZhromazdenieStav | null;
  readonly pitkaStav: PitkaStav | null;
  readonly bitkaStav: BitkaVerejne | null;
  /**
   * Voľby čakajúceho rozhodnutia, ktoré siahajú do vlastného balíčka
   * (Exekútor, náhrada staršieho) — len defId + zóna, nikdy uid.
   * Naplnené len vtedy, keď rozhodnutie patrí hráčovi `ja`.
   */
  readonly volbyExekutor: readonly KartaVolba[] | null;
  readonly volbyNahrada: readonly KartaVolba[] | null;
  /** Veštica (Prehra): oba doberacie balíčky — len porazenému počas výberu. */
  readonly volbaVestica: { readonly moj: readonly CardInstance[]; readonly jeho: readonly CardInstance[] } | null;
  /**
   * Nepriznané kliatby v MOJOM doberacom balíčku (len počty, poradie nie).
   * Vlastné karty hráč pozná, len nevie, v akom poradí ich dobere — bez nich
   * by živý odhad bodov nevedel započítať záporné body za Dlh a Cirhózu.
   */
  readonly mojeKliatbyVBalicku: { readonly dlh: number; readonly cirhoza: number };
  readonly koniec: KoniecHry | null;
  /** Ohlásené vydesenie: kolo, v ktorom hráč vydesil polovicu starších (verejné). */
  readonly ohlaseneVydesenie: readonly [number | null, number | null];
}

export function viewFor(data: GameData, state: GameState, ja: PlayerId): ClientState {
  const publicPlayer = (p: PlayerId): HracVerejne => {
    const hrac = state.hraci[p];
    return {
      rukaPocet: hrac.ruka.length,
      doberaciPocet: hrac.doberaci.length,
      odhadzovaci: hrac.odhadzovaci,
      priznane: hrac.priznane,
      dedicstvo: hrac.dedicstvo,
      poldeciPlne: hrac.poldeciPlne,
      poldeciVypite: hrac.poldeciVypite,
      cigarety: hrac.cigarety,
      pecen: hrac.pecen,
      zadlzenie: hrac.zadlzenie,
      nerestiTotoKolo: hrac.nerestiTotoKolo,
      nerestiMinuleKolo: hrac.nerestiMinuleKolo,
    };
  };

  const d = state.draftStav;
  const bitka = state.bitkaStav;
  const mojaBitkovaVolba = bitka !== null && bitka.caka === ja;
  return {
    ja,
    faza: state.faza,
    kolo: state.kolo,
    utocnik: state.utocnik,
    naTahu: naTahu(state),
    mozemHrat: mozeHrat(state, ja),
    pitkaCislo: state.pitkaCislo,
    pitkyCelkom: state.pitkyCelkom,
    ponukaRundy: state.ponukaRundy,
    ruka: state.hraci[ja].ruka,
    hraci: [publicPlayer(0), publicPlayer(1)],
    spolocnyBalicekPocet: state.spolocnyBalicek.length,
    senok: state.senok,
    lokalityVHre: state.lokalityVHre,
    lokalitCelkom: state.lokalitCelkom,
    ovladnute: state.ovladnute,
    prepadnute: state.prepadnute,
    limitRuky: [limitRukyHraca(data, state, 0), limitRukyHraca(data, state, 1)],
    naexVKole: state.naexVKole,
    starsi: state.starsi,
    ciel: state.ciel,
    lokalitaOtocena: state.lokalitaOtocena,
    strany: state.strany,
    draftStav:
      d === null
        ? null
        : {
            krok: d.krok,
            mojBalicek: d.balicky[ja],
            balicekPocet: [d.balicky[0].length, d.balicky[1].length],
            mojVyber: d.vyber[ja],
            vybral: [d.vyber[0] !== null, d.vyber[1] !== null],
            naTahu: d.naTahu,
            hotovo: d.hotovo,
            noveKarty: d.noveKarty,
            kredit: d.kredit,
          },
    zhromazdenieStav: state.zhromazdenieStav,
    pitkaStav: state.pitkaStav,
    bitkaStav:
      bitka === null
        ? null
        : {
            krok: bitka.krok,
            caka: bitka.caka,
            damage: bitka.damage,
            vitaz: bitka.vitaz,
            prebytokDrzi: bitka.prebytokDrzi,
            prebytokZostava: bitka.prebytokZostava,
            pohorsenieZostava: bitka.pohorsenieZostava,
            pohnuteMarkery: bitka.pohnuteMarkery,
            benzinkaZostava: bitka.benzinkaZostava,
            lokalitaPrepadne: bitka.lokalitaPrepadne,
            spalit: bitka.spalit,
          },
    volbyExekutor:
      mojaBitkovaVolba && bitka.krok === "exekutor" ? najdiNastroje(state, data, ja) : null,
    volbyNahrada:
      mojaBitkovaVolba && bitka.krok === "nahrada" ? najdiNahradnikov(state, data, ja) : null,
    volbaVestica:
      mojaBitkovaVolba && bitka.krok === "vestica"
        ? { moj: state.hraci[ja].doberaci, jeho: state.hraci[ja === 0 ? 1 : 0].doberaci }
        : null,
    mojeKliatbyVBalicku: {
      dlh: state.hraci[ja].doberaci.filter((k) => k.defId === "dlh").length,
      cirhoza: state.hraci[ja].doberaci.filter((k) => k.defId === "cirhoza").length,
    },
    koniec: state.koniec,
    ohlaseneVydesenie: state.ohlaseneVydesenie,
  };
}

/** Body z jedného scorecardu, keby hra skončila teraz — pre oboch hráčov. */
export interface BodyStarsieho {
  readonly elderId: string;
  /** body[p] = body hráča p z tohto scorecardu. */
  readonly body: readonly [number, number];
  /** polozky[p] = každá aktívna podmienka a koľko z nej má hráč p. */
  readonly polozky: readonly [readonly BodPodmienky[], readonly BodPodmienky[]];
  /** Súperove body tu závisia aj od jeho skrytých kliatob (ruka, balíček). */
  readonly neiste: boolean;
}

export interface BodyTeraz {
  readonly spolu: readonly [number, number];
  /** Súčet môže byť nepresný — súperove skryté Dlhy a Cirhózy ho ešte znížia. */
  readonly neiste: readonly [boolean, boolean];
  readonly starsi: readonly BodyStarsieho[];
}

/**
 * Živý odhad záverečného bodovania z pohľadu hráča — tým istým elderScore
 * ako na konci hry. Vlastné kliatby hráč pozná presne; pri súperovi vidí len
 * verejný odhadzovací balíček, takže súperove body môžu byť ešte nižšie.
 */
export function bodyTeraz(data: GameData, view: ClientState): BodyTeraz {
  const ja = view.ja;
  const su: PlayerId = ja === 0 ? 1 : 0;
  const nahradne = (defId: string, pocet: number): CardInstance[] =>
    Array.from({ length: pocet }, (_, i) => ({ uid: -1 - i, defId, leftLayout: 0, rightLayout: 0 }));
  const hrac = (p: PlayerId) =>
    p === ja
      ? {
          cigarety: view.hraci[p].cigarety,
          ruka: view.ruka,
          doberaci: [...nahradne("dlh", view.mojeKliatbyVBalicku.dlh), ...nahradne("cirhoza", view.mojeKliatbyVBalicku.cirhoza)],
          odhadzovaci: view.hraci[p].odhadzovaci,
        }
      : { cigarety: view.hraci[p].cigarety, ruka: [], doberaci: [], odhadzovaci: view.hraci[p].odhadzovaci };
  const stav = { ovladnute: view.ovladnute, starsi: view.starsi, hraci: [hrac(0), hrac(1)] };
  const superMaSkryte = view.hraci[su].rukaPocet + view.hraci[su].doberaciPocet > 0;
  const spolu: [number, number] = [0, 0];
  const neiste: [boolean, boolean] = [false, false];
  const starsi = view.starsi.map((elder): BodyStarsieho => {
    const s = elderScore(data, stav, elder);
    const kliatbyRozhoduju = s.polozky[su].some((p) => p.podmienka === "dlh" || p.podmienka === "cirhoza");
    const neisteTu = superMaSkryte && kliatbyRozhoduju;
    spolu[0] += s.body[0];
    spolu[1] += s.body[1];
    if (neisteTu) neiste[su] = true;
    return { elderId: elder.elderId, body: s.body, polozky: s.polozky, neiste: neisteTu };
  });
  return { spolu, neiste, starsi };
}

/** Body oboch hráčov teraz a po bitke o staršieho, ak ju vyhrá jeden či druhý. */
export interface NahladBitkyOStarsieho {
  readonly teraz: readonly [number, number];
  /** vyhra[w] = body [hráč 0, hráč 1], keď bitku vyhrá hráč w. */
  readonly vyhra: readonly [readonly [number, number], readonly [number, number]];
}

/**
 * Náhľad bitky o staršieho (Michal 2026-10-12): víťaz staršieho získa a jeho
 * marker vráti do sivej zóny — jeho strach prestane bodovať a víťazovi
 * pribudne získaný starší. Prebytok z bitky náhľad nezohľadňuje.
 */
export function nahladBitkyOStarsieho(data: GameData, view: ClientState, elderId: string): NahladBitkyOStarsieho {
  const po = (w: PlayerId): [number, number] => {
    const starsi = view.starsi.map((e) =>
      e.elderId === elderId ? { ...e, marker: MARKER_STRED, nahradeny: true, ziskal: w } : e,
    );
    const spolu = bodyTeraz(data, { ...view, starsi }).spolu;
    return [spolu[0], spolu[1]];
  };
  return { teraz: bodyTeraz(data, view).spolu, vyhra: [po(0), po(1)] };
}

/** Body a priazeň po posune markera jedného staršieho (prebytok, Pohoršenie). */
export interface NahladPosunu {
  /** Body [hráč 0, hráč 1] spolu, keby hra skončila hneď po posune. */
  readonly body: readonly [number, number];
  /** Zmena bodov oproti stavu pred posunom. */
  readonly zmena: readonly [number, number];
  /** Komu patrí priazeň staršieho po posune a s akou silou. */
  readonly priazen: PlayerId | null;
  readonly sila: number;
}

/**
 * Náhľad posunu markera o jedno pole k hráčovi k (Michal 2026-10-19 —
 * playtest 20261018-185541: hráči nevedeli, komu posun pomôže). Ten istý
 * výpočet ako bodyTeraz; null, keď sa marker posunúť nedá.
 */
export function nahladPosunuMarkera(
  data: GameData,
  view: ClientState,
  elderId: string,
  k: PlayerId,
  cezPohorsenie: boolean,
  pohorsenieNaKraj = false,
): NahladPosunu | null {
  const elder = view.starsi.find((e) => e.elderId === elderId);
  if (elder === undefined) return null;
  const marker = posunMarker(elder, k, cezPohorsenie, pohorsenieNaKraj);
  if (marker === null) return null;
  const posunuty = { ...elder, marker };
  const pred = bodyTeraz(data, view).spolu;
  const po = bodyTeraz(data, { ...view, starsi: view.starsi.map((e) => (e.elderId === elderId ? posunuty : e)) }).spolu;
  return {
    body: [po[0], po[1]],
    zmena: [po[0] - pred[0], po[1] - pred[1]],
    priazen: priazenHraca(posunuty),
    sila: priazenSila(posunuty),
  };
}
