// viewFor — BEZPEČNOSTNÁ HRANICA (M6).
//
// Toto je jediné miesto, ktoré rozhoduje, čo hráč vidí. Zo stavu sa NIKDY
// nesmie dostať von: obsah súperovej ruky, obsah ani poradie ŽIADNEHO
// doberacieho balíčka (vlastného, súperovho, spoločného), súperov balíček
// stavby šenku a jeho výber v kroku stavby, jeho
// karta z Vízie, jeho karta lícom dole pri patronáte (náhrada staršieho)
// a jeho skryto vybrané NA EX (v5, NA EX naraz — do odkrytia ani ich počet).
// Posielajú sa len počty (aj počet súperových nepriznaných kliatob — ten sa
// dá odvodiť z verejného logu). Skryť kartu v rozhraní je bezcenné — filtruje
// sa TU a testuje sa to. Súperova skrytá Záverečná (lícom dole) v strany
// vôbec nie je — súper dostane len jej stranu a náhradné uid (zaverecne).

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
import { cenaDedicstva, mozeHrat, najdiNastroje, naTahu, pohorsenieMozne, uidZaverecnej } from "./engine.ts";
import { KONSTANTY } from "./constants.ts";
import { MARKER_STRED, posunMarker, prekraciaHranicu, priazenHraca, priazenSila } from "./elders.ts";
import type { MarkerPos } from "./elders.ts";
import type { DamageResult } from "./battle.ts";
import { partiaHraca, pohorsenieNaKraj } from "./effects.ts";

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
  /** Absťáky získané za hru (v5, podmienka Absťák) — verejné, Absťák sa priznáva hneď. */
  readonly abstakyZiskane: number;
}

export interface BitkaVerejne {
  readonly krok: BitkaKrok | null;
  readonly caka: PlayerId | null;
  readonly damage: DamageResult | null;
  readonly vitaz: PlayerId | null;
  readonly prebytokDrzi: PlayerId | null;
  readonly prebytokZostava: number;
  /** Starší, ktorých prebytok už posunul — za každého porazený raz dostane cigaretu (verejné). */
  readonly prebytokPosunute: readonly string[];
  readonly pohorsenieZostava: readonly [number, number];
  /** Koľko hraníc zón už Pohoršenia hráča prekročili s markerom (kľúč `hráč:elderId`). */
  readonly pohorsenieHranice: Readonly<Record<string, number>>;
  readonly benzinkaZostava: readonly [number, number];
  /** Karty v línii, ktoré sa po bitke spália (Dievčina na vydaj). */
  readonly spalit: readonly number[];
}

/**
 * Draft z pohľadu hráča: z balíčkov stavby šenku vidí len svoj; súperov
 * výber v kroku len ako „vybral“ (karty sa odhalia, až keď vyberú obaja).
 */
export interface DraftVerejne {
  readonly krok: "stavba" | "beranie" | "patronat";
  readonly mojBalicek: readonly CardInstance[];
  readonly balicekPocet: readonly [number, number];
  readonly mojVyber: VyberStavby | null;
  readonly vybral: readonly [boolean, boolean];
  readonly naTahu: PlayerId;
  readonly hotovo: readonly [boolean, boolean];
  readonly noveKarty: readonly [number, number];
}

/** Patronát hráča v kole — verejné je, koho si vzal a koľko Pohoršení dostane súper. */
export interface PatronatVerejne {
  readonly elderId: string;
  readonly pohorsenia: number;
}

/**
 * Skrytá Záverečná v línii (roadmapa #83). Majiteľ ju má aj v strany a tu
 * jej skutočné uid; súper ju v strany nemá a uid je náhradné (uidZaverecnej) —
 * cez neho na ňu dáva NA EX.
 */
export interface ZaverecnaVerejna {
  readonly strana: PlayerId;
  readonly majitel: PlayerId;
  readonly uid: number;
  readonly naexBy: PlayerId | null;
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
  /** Cena ďalšieho Nástroja do Dedičstva v cigaretách — rastie pre oboch (verejné). */
  readonly cenaDedicstva: number;
  /** Nástroje vyložené do Dedičstva za celú hru (verejné) — z nich je cena. */
  readonly dedicstvaVylozene: number;
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
  readonly naexVKole: readonly [boolean, boolean];
  readonly starsi: readonly ElderState[];
  readonly ciel: CielKola | null;
  readonly lokalitaOtocena: boolean;
  readonly strany: readonly [readonly PlacedCard[], readonly PlacedCard[]];
  /** Skryté Záverečné — najviac jedna na stranu; za ňu sa nedá priložiť (zablokovaneStrany). */
  readonly zaverecne: readonly ZaverecnaVerejna[];
  /** Smiem teraz zahrať Záverečnú (Zhromaždenie, nepasoval som, mám cigaretu)? */
  readonly zaverecnaMozna: boolean;
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
  /** Patronáty oboch hráčov v tomto kole (verejné, bez karty lícom dole). */
  readonly patronat: readonly [PatronatVerejne | null, PatronatVerejne | null];
  /** Moja karta lícom dole na scorecarde (patronát) — súper ju nevidí. */
  readonly mojaNahrada: CardInstance | null;
  /** Veštica (Prehra): oba doberacie balíčky — len porazenému počas výberu. */
  readonly volbaVestica: { readonly moj: readonly CardInstance[]; readonly jeho: readonly CardInstance[] } | null;
  /** Vízia: koľko vrchných kariet ešte kto prezrie (verejné, null = Vízia neprebieha). */
  readonly vizia: { readonly zostava: readonly [number, number] } | null;
  /** Vízia: vrchná karta MÔJHO balíčka, o ktorej práve rozhodujem — len mne. */
  readonly volbaVizia: CardInstance | null;
  /**
   * Nepriznané kliatby v MOJOM doberacom balíčku (len počty, poradie nie).
   * Vlastné karty hráč pozná, len nevie, v akom poradí ich dobere — bez nich
   * by živý odhad bodov nevedel započítať záporné body za Dlh a Cirhózu.
   */
  readonly mojeKliatbyVBalicku: { readonly dlh: number; readonly cirhoza: number };
  /**
   * Zloženie MÔJHO doberacieho balíčka: defId a počet, zoradené podľa defId.
   * Svoje karty hráč pozná, poradie je tajné — preto bez uid a nie v poradí
   * balíčka (uid by prezradilo, ktorá inštancia kde leží). Súperov sa neposiela.
   */
  readonly mojBalicekZlozenie: readonly ZlozeniePolozka[];
  /**
   * Nepriznané kliatby OBOCH hráčov spolu (ruka, doberací aj odhadzovací
   * balíček) — len počty (Michal 2026-10-21). Každý vznik, priznanie aj
   * zahodenie kliatby je vo verejnom logu, takže si ich hráč s dobrou pamäťou
   * spočíta sám; server mu len odpustí daň za pamätanie. Ktoré karty a kde
   * ležia, sa neposiela. Test: view-kliatby.test.ts.
   */
  readonly nepriznaneKliatby: readonly [KliatbyHraca, KliatbyHraca];
  /** Lokality na sekere — z remíz, berie ich víťaz najbližšej bitky (verejné). */
  readonly naSekeru: readonly CardInstance[];
  readonly koniec: KoniecHry | null;
  /** Ohlásené vydesenie: kolo, v ktorom hráč vydesil polovicu starších (verejné). */
  readonly ohlaseneVydesenie: readonly [number | null, number | null];
}

export interface KliatbyHraca {
  readonly dlh: number;
  readonly cirhoza: number;
}

export interface ZlozeniePolozka {
  readonly defId: string;
  readonly pocet: number;
}

/** Karty zgrupené podľa defId a zoradené podľa neho — poradie vstupu sa stratí. */
export function zlozenie(karty: readonly CardInstance[]): ZlozeniePolozka[] {
  const pocty = new Map<string, number>();
  for (const k of karty) pocty.set(k.defId, (pocty.get(k.defId) ?? 0) + 1);
  return [...pocty]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([defId, pocet]) => ({ defId, pocet }));
}

/** Nepriznané kliatby hráča — v ruke a v oboch balíčkoch. */
export function nepriznaneKliatbyHraca(hrac: GameState["hraci"][number]): KliatbyHraca {
  const vsetky = [...hrac.ruka, ...hrac.doberaci, ...hrac.odhadzovaci];
  return {
    dlh: vsetky.filter((k) => k.defId === "dlh").length,
    cirhoza: vsetky.filter((k) => k.defId === "cirhoza").length,
  };
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
      abstakyZiskane: hrac.abstakyZiskane ?? 0,
    };
  };

  const verejnyPatronat = (p: PlayerId): PatronatVerejne | null => {
    const x = state.patronat[p];
    return x === null ? null : { elderId: x.elderId, pohorsenia: x.pohorsenia };
  };
  // Záverečná súpera: v strany nie je, súper vie len, že na konci strany leží rub.
  const skryta = (pl: PlacedCard): boolean => pl.zaverecna === true && pl.playedBy !== ja;
  const skrySuperove = (strana: PlayerId): readonly PlacedCard[] =>
    state.strany[strana].some(skryta) ? state.strany[strana].filter((pl) => !skryta(pl)) : state.strany[strana];
  const zaverecne: ZaverecnaVerejna[] = [];
  for (const strana of [0, 1] as const) {
    for (const pl of state.strany[strana]) {
      if (pl.zaverecna !== true) continue;
      zaverecne.push({ strana, majitel: pl.playedBy, uid: skryta(pl) ? uidZaverecnej(strana) : pl.card.uid, naexBy: pl.naexBy ?? null });
    }
  }
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
    cenaDedicstva: cenaDedicstva(state),
    dedicstvaVylozene: state.dedicstvaVylozene,
    ruka: state.hraci[ja].ruka,
    hraci: [publicPlayer(0), publicPlayer(1)],
    spolocnyBalicekPocet: state.spolocnyBalicek.length,
    senok: state.senok,
    lokalityVHre: state.lokalityVHre,
    lokalitCelkom: state.lokalitCelkom,
    ovladnute: state.ovladnute,
    prepadnute: state.prepadnute,
    naexVKole: state.naexVKole,
    starsi: state.starsi,
    ciel: state.ciel,
    lokalitaOtocena: state.lokalitaOtocena,
    strany: [skrySuperove(0), skrySuperove(1)],
    zaverecne,
    zaverecnaMozna:
      state.faza === "zhromazdenie" &&
      state.zhromazdenieStav !== null &&
      mozeHrat(state, ja) &&
      !state.zhromazdenieStav.pasoval[ja] &&
      state.hraci[ja].cigarety >= KONSTANTY.CENA_ZAVERECNEJ,
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
    // NA EX naraz (v5): súperove skryté NA EX sa neposielajú — ani že nejaké dal.
    pitkaStav:
      state.pitkaStav === null
        ? null
        : {
            ...state.pitkaStav,
            // Moje NA EX na súperovu skrytú Záverečnú nesie jej náhradné uid — skutočné by ju prezradilo.
            skryteNaex: (state.pitkaStav.skryteNaex ?? [])
              .filter((x) => x.hrac === ja)
              .map((x) => {
                const strana = ([0, 1] as const).find((q) => state.strany[q].some((pl) => pl.card.uid === x.uid && skryta(pl)));
                return strana === undefined ? x : { ...x, uid: uidZaverecnej(strana) };
              }),
          },
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
            prebytokPosunute: bitka.prebytokPosunute,
            pohorsenieZostava: bitka.pohorsenieZostava,
            pohorsenieHranice: bitka.pohorsenieHranice,
            benzinkaZostava: bitka.benzinkaZostava,
            spalit: bitka.spalit,
          },
    volbyExekutor:
      mojaBitkovaVolba && bitka.krok === "exekutor" ? najdiNastroje(state, data, ja) : null,
    patronat: [verejnyPatronat(0), verejnyPatronat(1)],
    mojaNahrada: state.patronat[ja]?.nahrada ?? null,
    volbaVestica:
      mojaBitkovaVolba && bitka.krok === "vestica"
        ? { moj: state.hraci[ja].doberaci, jeho: state.hraci[ja === 0 ? 1 : 0].doberaci }
        : null,
    vizia: state.vizia,
    volbaVizia: state.vizia !== null && naTahu(state) === ja ? (state.hraci[ja].doberaci[0] ?? null) : null,
    mojeKliatbyVBalicku: {
      dlh: state.hraci[ja].doberaci.filter((k) => k.defId === "dlh").length,
      cirhoza: state.hraci[ja].doberaci.filter((k) => k.defId === "cirhoza").length,
    },
    mojBalicekZlozenie: zlozenie(state.hraci[ja].doberaci),
    nepriznaneKliatby: [nepriznaneKliatbyHraca(state.hraci[0]), nepriznaneKliatbyHraca(state.hraci[1])],
    naSekeru: state.naSekeru,
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
}

export interface BodyTeraz {
  readonly spolu: readonly [number, number];
  readonly starsi: readonly BodyStarsieho[];
}

/** Stand-in karty pre bodovanie — za kliatby, ktorých počet je známy, no karty nie. */
function nahradne(defId: string, pocet: number): CardInstance[] {
  return Array.from({ length: Math.max(0, pocet) }, (_, i) => ({ uid: -1 - i, defId, leftLayout: 0, rightLayout: 0 }));
}

/**
 * Živý odhad záverečného bodovania z pohľadu hráča — tým istým elderScore
 * ako na konci hry, pre oboch presný: súperove nepriznané kliatby sa
 * dopočítajú z verejného počtu (nepriznaneKliatby), nie len z odhadzovacieho
 * balíčka, takže premiešanie balíčka už body súpera nezmení.
 */
export function bodyTeraz(data: GameData, view: ClientState): BodyTeraz {
  const hrac = (p: PlayerId) => {
    const h = view.hraci[p];
    const vOdhadzovacom = (defId: string): number => h.odhadzovaci.filter((k) => k.defId === defId).length;
    const kliatby = view.nepriznaneKliatby[p];
    return {
      cigarety: h.cigarety,
      ruka: [],
      doberaci: [...nahradne("dlh", kliatby.dlh - vOdhadzovacom("dlh")), ...nahradne("cirhoza", kliatby.cirhoza - vOdhadzovacom("cirhoza"))],
      odhadzovaci: h.odhadzovaci,
      priznane: h.priznane,
      poldeciPlne: h.poldeciPlne,
      dedicstvo: h.dedicstvo,
      abstakyZiskane: h.abstakyZiskane,
    };
  };
  const stav = { ovladnute: view.ovladnute, starsi: view.starsi, hraci: [hrac(0), hrac(1)] };
  const spolu: [number, number] = [0, 0];
  const starsi = view.starsi.map((elder): BodyStarsieho => {
    const s = elderScore(data, stav, elder);
    spolu[0] += s.body[0];
    spolu[1] += s.body[1];
    return { elderId: elder.elderId, body: s.body, polozky: s.polozky };
  });
  return { spolu, starsi };
}

/**
 * Body jednej kliatby navyše — koľko by hráča p stál ďalší Dlh či Cirhóza
 * pri dnešných scorecardoch (záporné číslo). Pre náhľad ceny NA EX a Vypiť.
 */
export function cenaKliatby(data: GameData, view: ClientState, p: PlayerId, defId: "dlh" | "cirhoza"): number {
  const pred = bodyTeraz(data, view).spolu[p];
  const kliatby: [KliatbyHraca, KliatbyHraca] = [view.nepriznaneKliatby[0], view.nepriznaneKliatby[1]];
  kliatby[p] = { ...kliatby[p], [defId]: kliatby[p][defId] + 1 };
  return bodyTeraz(data, { ...view, nepriznaneKliatby: kliatby }).spolu[p] - pred;
}

/** Body oboch hráčov pri patronáte: teraz, po vzatí (aj pri prehre) a pri výhre patróna. */
export interface NahladPatronatu {
  readonly teraz: readonly [number, number];
  /** Marker v strede, starší sa vráti na scorecard — body pri prehre bitky. */
  readonly prehra: readonly [number, number];
  /** Patrón vyhrá: starší je jeho, na scorecarde leží karta lícom dole. */
  readonly vyhra: readonly [number, number];
}

/**
 * Náhľad patronátu (Michal 2026-10-20) z pohľadu patróna `view.ja`: marker
 * pôjde do stredu a pri výhre na scorecard ľahne `karta` (ožijú podmienky
 * podľa jej akcií). Pohoršenia, ktoré dostane súper, náhľad nezohľadňuje —
 * tými si strach môže vrátiť.
 */
export function nahladPatronatu(
  data: GameData,
  view: ClientState,
  elderId: string,
  karta: Pick<CardInstance, "defId" | "leftLayout" | "rightLayout"> | null,
): NahladPatronatu {
  const po = (vyhral: boolean): [number, number] => {
    const starsi = view.starsi.map((e): ElderState => {
      if (e.elderId !== elderId) return e;
      const stred = { ...e, marker: MARKER_STRED, markerZaciatokKola: MARKER_STRED };
      return vyhral ? { ...stred, karta: karta === null ? e.karta : { uid: -1, ...karta }, nahradeny: true, ziskal: view.ja } : stred;
    });
    const spolu = bodyTeraz(data, { ...view, starsi }).spolu;
    return [spolu[0], spolu[1]];
  };
  return { teraz: bodyTeraz(data, view).spolu, prehra: po(false), vyhra: po(true) };
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

/**
 * Náhľad jedného posunu prebytkom k porazenému: to isté ako nahladPosunuMarkera
 * a navyše cigareta, ktorú porazený dostane za prvý posun každého staršieho
 * (§9.4) — cigarety bodujú na scorecardoch. Spoločné pre web aj konzolový
 * klient agentov (predtým ju neukazoval ani jeden).
 */
export function nahladPosunuPrebytkom(data: GameData, view: ClientState, elderId: string): NahladPosunu | null {
  const drzi = view.bitkaStav?.prebytokDrzi ?? null;
  if (drzi === null) return null;
  const porazeny: PlayerId = drzi === 0 ? 1 : 0;
  const n = nahladPosunuMarkera(data, view, elderId, porazeny, false);
  if (n === null || (view.bitkaStav?.prebytokPosunute ?? []).includes(elderId)) return n;
  const elder = view.starsi.find((e) => e.elderId === elderId);
  const marker = elder === undefined ? null : posunMarker(elder, porazeny, false);
  if (marker === null) return n;
  const hraci: [HracVerejne, HracVerejne] = [view.hraci[0], view.hraci[1]];
  hraci[porazeny] = { ...hraci[porazeny], cigarety: hraci[porazeny].cigarety + 1 };
  const pred = bodyTeraz(data, view).spolu;
  const po = bodyTeraz(data, { ...view, hraci, starsi: view.starsi.map((e) => (e.elderId === elderId ? { ...e, marker } : e)) }).spolu;
  return { ...n, body: [po[0], po[1]], zmena: [po[0] - pred[0], po[1] - pred[1]] };
}

/** Stávka bitky z pohľadu `view.ja` — o koľko sa pohne rozdiel bodov (ja − súper). */
export interface StavkaBitky {
  /** Prebytok, s ktorým sa ráta výhra aj prehra. */
  readonly prebytok: number;
  /** Výhra s týmto prebytkom: lokalita (aj zo sekery) a posuny markerov k súperovi. */
  readonly vyhra: number;
  /** Prehra s týmto prebytkom — súper rozdelí prebytok proti mne (záporné číslo). */
  readonly prehra: number;
  /** Len v poslednej bitke: najviac, čo môže súper získať (prebytok 1 – 5); inak null. */
  readonly superNajviac: number | null;
}

/** Prebytok, pre ktorý sa ukazuje stávka bitky (návrh 3 A z playtestu 20261021-143600). */
export const STAVKA_PREBYTOK = 3;
const STAVKA_PREBYTOK_NAJVIAC = 5;

/**
 * Ako sa pohne rozdiel bodov (vitaz − porazený), keď `vitaz` vyhrá bitku
 * s prebytkom `prebytok`. Víťaz rozdeľuje prebytok hltavo — každý posun tam,
 * kde mu najviac pridá (to isté bodyTeraz ako náhľad posunu markera);
 * porazený dostane cigaretu za každého posunutého staršieho (§9.4).
 * Pohoršenia ani patronát nerieši — platia bez ohľadu na výsledok, resp.
 * súperova karta pri patronáte je skrytá. Preto „≈“.
 */
function zmenaPoVyhre(data: GameData, view: ClientState, vitaz: PlayerId, prebytok: number): number {
  const porazeny: PlayerId = vitaz === 0 ? 1 : 0;
  const rozdiel = (v: ClientState): number => {
    const b = bodyTeraz(data, v).spolu;
    return b[vitaz] - b[porazeny];
  };
  const lokalita = view.ciel?.typ === "lokalita" ? view.ciel.lokalita : null;
  const ziskane = [...(lokalita === null ? [] : [lokalita]), ...view.naSekeru.filter((k) => k.uid !== lokalita?.uid)];
  const poLokalite: ClientState = { ...view, ovladnute: [...view.ovladnute, ...ziskane.map((karta) => ({ karta, hrac: vitaz }))] };
  // Miňištrant vo víťazovej partii zdraží každý posun (§9.4).
  const cena = 1 + partiaHraca(view, vitaz).filter((pl) => pl.card.defId === "ministrant").length;
  const { kroky, view: v } = hltavyPrebytok(data, poLokalite, vitaz, prebytok, cena);
  const hraci: [HracVerejne, HracVerejne] = [v.hraci[0], v.hraci[1]];
  hraci[porazeny] = { ...hraci[porazeny], cigarety: hraci[porazeny].cigarety + new Set(kroky).size };
  return rozdiel({ ...v, hraci }) - rozdiel(view);
}

/**
 * Hltavé rozdelenie prebytku: `drzi` posúva markery k súperovi a každý posun
 * dá tam, kde rozdielu bodov (drzi − súper, bodyTeraz) najviac pridá — aj keď je
 * najlepší posun záporný, prebytok sa rozdeliť musí. Vráti poradie starších
 * (posuny po jednom, starší sa môže opakovať) a stav po nich. Stávka bitky
 * z toho počíta zisk výhry, klient návrh rozdelenia na jeden klik (roadmapa #9 B).
 */
export function hltavyPrebytok(
  data: GameData,
  view: ClientState,
  drzi: PlayerId,
  prebytok: number,
  cena: number,
): { readonly kroky: readonly string[]; readonly view: ClientState } {
  const super_: PlayerId = drzi === 0 ? 1 : 0;
  const rozdiel = (v: ClientState): number => {
    const b = bodyTeraz(data, v).spolu;
    return b[drzi] - b[super_];
  };
  let v = view;
  const kroky: string[] = [];
  for (let zostava = prebytok; zostava >= cena; zostava -= cena) {
    let najlepsi: { readonly v: ClientState; readonly hodnota: number; readonly elderId: string } | null = null;
    for (const e of v.starsi) {
      const marker = posunMarker(e, super_, false);
      if (marker === null) continue;
      const po: ClientState = { ...v, starsi: v.starsi.map((x) => (x.elderId === e.elderId ? { ...x, marker } : x)) };
      const hodnota = rozdiel(po);
      if (najlepsi === null || hodnota > najlepsi.hodnota) najlepsi = { v: po, hodnota, elderId: e.elderId };
    }
    if (najlepsi === null) break;
    v = najlepsi.v;
    kroky.push(najlepsi.elderId);
  }
  return { kroky, view: v };
}

/**
 * Hltavé Pohoršenia: hráč `p` posunie `pocet` markerov k súperovi alebo k sebe (v5), každý tam,
 * kde rozdielu bodov (p − súper, bodyTeraz) najviac pridá, a len kam smie
 * (pohorsenieMozne — hranice zón, krajná pozícia). Vráti, o koľko sa rozdiel
 * pohne. Pre „≈ b“ v náhľade NA EX a patronátu (návrh #1, playtest
 * 20261024-075830); súperove Pohoršenia v tej istej bitke nerieši, preto „≈“.
 */
export function hodnotaPohorseni(data: GameData, view: ClientState, p: PlayerId, pocet: number): number {
  const super_: PlayerId = p === 0 ? 1 : 0;
  const rozdiel = (v: ClientState): number => {
    const b = bodyTeraz(data, v).spolu;
    return b[p] - b[super_];
  };
  const hranice: Record<string, number> = { ...(view.bitkaStav?.pohorsenieHranice ?? {}) };
  let v = view;
  for (let zostava = pocet; zostava > 0; zostava--) {
    let najlepsi: { readonly v: ClientState; readonly hodnota: number; readonly elderId: string; readonly hranica: boolean } | null = null;
    // v5: Pohoršenie smie aj k sebe — hltavo sa vyberá lepší z oboch smerov.
    for (const e of v.starsi) {
      for (const kSebe of [false, true]) {
        if (!pohorsenieMozne({ ...v, bitkaStav: { pohorsenieHranice: hranice } }, p, e, kSebe)) continue;
        const marker = posunMarker(e, kSebe ? p : super_, true, pohorsenieNaKraj(v, p));
        if (marker === null) continue;
        const po: ClientState = { ...v, starsi: v.starsi.map((x) => (x.elderId === e.elderId ? { ...x, marker } : x)) };
        const hodnota = rozdiel(po);
        if (najlepsi === null || hodnota > najlepsi.hodnota) najlepsi = { v: po, hodnota, elderId: e.elderId, hranica: prekraciaHranicu(e.marker, marker) };
      }
    }
    if (najlepsi === null) break;
    if (najlepsi.hranica) hranice[`${p}:${najlepsi.elderId}`] = (hranice[`${p}:${najlepsi.elderId}`] ?? 0) + 1;
    v = najlepsi.v;
  }
  return rozdiel(v) - rozdiel(view);
}

/**
 * Hodnota lokality (Michal 2026-10-22): o koľko bodov si každý hráč polepší,
 * keď lokalitu ovládne — podľa dnešného rozdania scorecardov, každá aktívna
 * podmienka „lokality“ zvlášť (ten istý výpočet ako bodyTeraz). So `sSekerou`
 * aj lokality na sekere, ktoré víťaz bitky berie spolu s cieľom.
 */
export function hodnotaLokality(data: GameData, view: ClientState, karta: CardInstance, sSekerou = false): readonly [number, number] {
  const ziskane = [karta, ...(sSekerou ? view.naSekeru.filter((k) => k.uid !== karta.uid) : [])];
  const teraz = bodyTeraz(data, view).spolu;
  const pre = (p: PlayerId): number =>
    bodyTeraz(data, { ...view, ovladnute: [...view.ovladnute, ...ziskane.map((k) => ({ karta: k, hrac: p }))] }).spolu[p] - teraz[p];
  return [pre(0), pre(1)];
}

/**
 * Stávka bitky (Michal 2026-10-22, návrh 3 A): čo hráč získa výhrou a stratí
 * prehrou s prebytkom STAVKA_PREBYTOK, a pred poslednou bitkou, koľko najviac
 * môže súper získať. Rozdiel bodov ja − súper, ten istý výpočet ako bodyTeraz.
 */
export function stavkaBitky(data: GameData, view: ClientState, prebytok = STAVKA_PREBYTOK): StavkaBitky | null {
  if (view.ciel?.typ !== "lokalita" || view.koniec !== null) return null;
  const ja = view.ja;
  const super_: PlayerId = ja === 0 ? 1 : 0;
  const posledna = view.lokalityVHre.length === 0;
  let superNajviac: number | null = null;
  if (posledna) {
    for (let n = 1; n <= STAVKA_PREBYTOK_NAJVIAC; n++) {
      const zisk = zmenaPoVyhre(data, view, super_, n);
      if (superNajviac === null || zisk > superNajviac) superNajviac = zisk;
    }
  }
  return {
    prebytok,
    vyhra: zmenaPoVyhre(data, view, ja, prebytok),
    prehra: -zmenaPoVyhre(data, view, super_, prebytok),
    superNajviac,
  };
}
