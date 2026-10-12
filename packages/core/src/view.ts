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
import { elderScore, obavanyHrac, podmienkyStarsieho } from "./elders.ts";
import type {
  BitkaKrok,
  CakajucaVolba,
  CielKola,
  GameState,
  KartaVolba,
  KoniecHry,
  PitkaStav,
  VyberStavby,
  ZhromazdenieStav,
} from "./engine.ts";
import { limitRukyHraca, mozeHrat, najdiNahradnikov, najdiNastroje, naTahu } from "./engine.ts";
import { MARKER_STRED } from "./elders.ts";
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
  /** Rozhodnutie mimo poradia (Policajtka) — kto a čo vyberá. */
  readonly volba: CakajucaVolba | null;
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
  /**
   * Policajtka: MOJ doberací balíček v poradí — len kým ho hráč podľa karty
   * preskúmava. Inak sa obsah doberacieho balíčka nikdy neposiela.
   */
  readonly volbaPolicajtka: readonly CardInstance[] | null;
  /** Veštica (Prehra): oba doberacie balíčky — len porazenému počas výberu. */
  readonly volbaVestica: { readonly moj: readonly CardInstance[]; readonly jeho: readonly CardInstance[] } | null;
  /**
   * Nepriznané kliatby v MOJOM doberacom balíčku (len počty, poradie nie).
   * Vlastné karty hráč pozná, len nevie, v akom poradí ich dobere — bez nich
   * by živý odhad bodov nevedel započítať záporné body za Dlh a Cirhózu.
   */
  readonly mojeKliatbyVBalicku: { readonly dlh: number; readonly cirhoza: number };
  readonly koniec: KoniecHry | null;
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
    volba: state.volba,
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
    volbaPolicajtka:
      state.volba?.typ === "policajtka" && state.volba.hrac === ja ? state.hraci[ja].doberaci : null,
    volbaVestica:
      mojaBitkovaVolba && bitka.krok === "vestica"
        ? { moj: state.hraci[ja].doberaci, jeho: state.hraci[ja === 0 ? 1 : 0].doberaci }
        : null,
    mojeKliatbyVBalicku: {
      dlh: state.hraci[ja].doberaci.filter((k) => k.defId === "dlh").length,
      cirhoza: state.hraci[ja].doberaci.filter((k) => k.defId === "cirhoza").length,
    },
    koniec: state.koniec,
  };
}

/** Body jedného staršieho, keby hra skončila teraz. */
export interface BodyStarsieho {
  readonly elderId: string;
  /** Koho sa starší bojí — len ten na konci boduje (null = nikoho). */
  readonly obavany: PlayerId | null;
  readonly body: number;
  readonly polozky: readonly BodPodmienky[];
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
    if (s === null) return { elderId: elder.elderId, obavany: obavanyHrac(elder), body: 0, polozky: [], neiste: false };
    const kliatbyRozhoduju = podmienkyStarsieho(data, elder).some(
      (p) => p.aktivna && p.hrac === su && (p.podmienka === "dlh" || p.podmienka === "cirhoza"),
    );
    const neisteTu = s.hrac === su && superMaSkryte && kliatbyRozhoduju;
    spolu[s.hrac] += s.body;
    if (neisteTu) neiste[su] = true;
    return { elderId: elder.elderId, obavany: s.hrac, body: s.body, polozky: s.polozky, neiste: neisteTu };
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
 * marker vráti do sivej zóny — body z toho staršieho zmiznú obom a víťazovi
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
