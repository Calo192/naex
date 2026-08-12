// viewFor — BEZPEČNOSTNÁ HRANICA (M6).
//
// Toto je jediné miesto, ktoré rozhoduje, čo hráč vidí. Zo stavu sa NIKDY
// nesmie dostať von: obsah súperovej ruky, obsah ani poradie ŽIADNEHO
// doberacieho balíčka (vlastného, súperovho, spoločného). Posielajú sa len
// počty. Skryť kartu v rozhraní je bezcenné — filtruje sa TU a testuje sa to.

import type { CardInstance, Phase, PlayerId } from "./types.ts";
import type { GameData } from "./data.ts";
import type { PlacedCard } from "./partia.ts";
import type { ElderState } from "./elders.ts";
import type {
  BitkaKrok,
  CielKola,
  DraftStav,
  GameState,
  KartaVolba,
  KoniecHry,
  PitkaStav,
  ZhromazdenieStav,
} from "./engine.ts";
import { najdiNahradnikov, najdiNastroje, naTahu } from "./engine.ts";
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
}

export interface ClientState {
  readonly ja: PlayerId;
  readonly faza: Phase;
  readonly kolo: number;
  readonly utocnik: PlayerId;
  readonly naTahu: PlayerId | null;
  readonly pitkaCislo: number;
  readonly pitkyCelkom: number;
  /** Moja ruka — jediná ruka, ktorá sa posiela celá. */
  readonly ruka: readonly CardInstance[];
  readonly hraci: readonly [HracVerejne, HracVerejne];
  readonly spolocnyBalicekPocet: number;
  readonly senok: readonly CardInstance[];
  readonly lokalityVHre: readonly CardInstance[];
  readonly ovladnute: readonly { readonly karta: CardInstance; readonly hrac: PlayerId }[];
  readonly starsi: readonly ElderState[];
  readonly ciel: CielKola | null;
  readonly lokalitaOtocena: boolean;
  readonly partie: readonly [readonly PlacedCard[], readonly PlacedCard[]];
  readonly draftStav: DraftStav | null;
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
    };
  };

  const bitka = state.bitkaStav;
  const mojaBitkovaVolba = bitka !== null && bitka.caka === ja;
  return {
    ja,
    faza: state.faza,
    kolo: state.kolo,
    utocnik: state.utocnik,
    naTahu: naTahu(state),
    pitkaCislo: state.pitkaCislo,
    pitkyCelkom: state.pitkyCelkom,
    ruka: state.hraci[ja].ruka,
    hraci: [publicPlayer(0), publicPlayer(1)],
    spolocnyBalicekPocet: state.spolocnyBalicek.length,
    senok: state.senok,
    lokalityVHre: state.lokalityVHre,
    ovladnute: state.ovladnute,
    starsi: state.starsi,
    ciel: state.ciel,
    lokalitaOtocena: state.lokalitaOtocena,
    partie: state.partie,
    draftStav: state.draftStav,
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
          },
    volbyExekutor:
      mojaBitkovaVolba && bitka.krok === "exekutor" ? najdiNastroje(state, data, ja) : null,
    volbyNahrada:
      mojaBitkovaVolba && bitka.krok === "nahrada" ? najdiNahradnikov(state, data, ja) : null,
    koniec: state.koniec,
  };
}
