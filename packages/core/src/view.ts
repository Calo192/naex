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
// Špaky, ich história (nástenka) a sekera sú verejné (v6).

import type { CardInstance, Favour, Phase, PlayerId } from "./types.ts";
import type { GameData } from "./data.ts";
import type { PlacedCard } from "./partia.ts";
import type { ElderState, PosunMarkera } from "./elders.ts";
import type {
  BitkaKrok,
  BitkaNaNastenke,
  CielKola,
  GameState,
  KoniecHry,
  PitkaStav,
  Vykupne,
  VyberStavby,
  ZhromazdenieStav,
} from "./engine.ts";
import { abstakyVBitke, cenaDedicstva, lokalityNaVyber, vykupneHraca, mozeHrat, naTahu, stranaStreduFinale, uidZaverecnej, vyplatZaStarsich } from "./engine.ts";
import { KONSTANTY } from "./constants.ts";
import { MARKER_STRED, favourStarsieho, posunMarker, priazenHraca, priazenSila, spakyZaStarsich, strachZ, vydesil } from "./elders.ts";
import type { DamageResult } from "./battle.ts";
import { spakyZaBitku } from "./battle.ts";

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
  /** Absťáky získané za hru — verejné, Absťák sa priznáva hneď. */
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
  /** Z toho Pohoršenia zo súperovho patronátu — nesmú na jeho patróna (pohorsenieMozne, v6). */
  readonly pohorseniaPatronatu: readonly [number, number];
  /** Špaky, ktoré hráčom v tejto bitke zhoreli pri exekúcii (v6). */
  readonly exekutor: readonly [number, number];
  readonly benzinkaZostava: readonly [number, number];
  /** Karty v línii, ktoré sa po bitke spália (Dievčina na vydaj). */
  readonly spalit: readonly number[];
  /** Živnostník (Výhra): koľko súperových Dedičstiev víťaz ešte zahodí (0 mimo kroku). */
  readonly zivnostnikZostava: number;
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
  /**
   * Karty vzaté zo šenku v tomto drafte (#111) — branie je verejné, karta ležala
   * lícom hore. Bez uid: karta je už v ruke, stačí, čo na nej bolo vidieť.
   */
  readonly zobrate: readonly ZobrataVerejne[];
}

/** Karta vzatá zo šenku — kto ju vzal a na ktorom mieste šenku ležala (ZobrataZoSenku v engine.ts). */
export interface ZobrataVerejne {
  readonly karta: Pick<CardInstance, "defId" | "leftLayout" | "rightLayout">;
  readonly hrac: PlayerId;
  readonly miesto: number;
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

/**
 * Starší tak, ako ho vidí hráč: stav ukazovateľa a priazeň, ktorú dáva (v6,
 * Michal 2026-10-26: „ostala len priazeň a na tú scorecard netreba“).
 */
export interface StarsiVerejne extends ElderState {
  readonly priazen: Favour;
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
  /**
   * Lokality, z ktorých sa vyberá cieľ: v7 neodohrané lokality úrovne tohto
   * (vo Voľbe cieľa) alebo ďalšieho kola; bez rozpisu všetky nevybrané.
   */
  readonly lokalityVHre: readonly CardInstance[];
  /** Počet lokalít hry; po nich príde finále (ciel.typ === "finale"). */
  readonly lokalitCelkom: number;
  /** Rozpis úrovní lokalít po kolách s finále na konci (v7); chýba = žreb ako do v6. */
  readonly rozpis?: readonly number[];
  /** Špaky oboch hráčov teraz (v6) — popolníky. */
  readonly spaky: readonly [number, number];
  /** Špaky na sekere — vezme ich víťaz ďalšej bitky, vo finále prepadnú. */
  readonly spakyNaSekere: number;
  /** Odohrané bitky v poradí: lokalita, víťaz a špaky — krčmová nástenka. */
  readonly nastenka: readonly BitkaNaNastenke[];
  /** Finále: strana, ktorej prvá karta leží v strede línie (stranaStreduFinale); inak null. */
  readonly stredFinale: PlayerId | null;
  readonly naexVKole: readonly [boolean, boolean];
  readonly starsi: readonly StarsiVerejne[];
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
   * Hasič: kto rozhoduje o vytiahnutej karte a ktorá to je. Verejné obom —
   * karta leží v jeho odhadzovacom balíčku, ten je verejný. null = nikto
   * nerozhoduje; karta null = medzitým z odhadzovacieho zmizla.
   */
  readonly hasicVolba: { readonly hrac: PlayerId; readonly karta: CardInstance | null } | null;
  /**
   * Nepriznané kliatby v MOJOM doberacom balíčku (len počty, poradie nie).
   * Vlastné karty hráč pozná, len nevie, v akom poradí ich dobere.
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
  readonly koniec: KoniecHry | null;
  /** Ohlásené vydesenie: kolo, v ktorom hráč vydesil polovicu starších (verejné). */
  readonly ohlaseneVydesenie: readonly [number | null, number | null];
  /** Posuny markerov od poslednej bitky do konca Zhromaždenia (verejné, stopa na stupnici). */
  readonly posunyMarkerov: readonly PosunMarkera[];
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
  const hasic = state.hasicVolby?.[0];
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
    lokalityVHre: lokalityNaVyber(data, state),
    lokalitCelkom: state.lokalitCelkom,
    ...(state.rozpis !== undefined ? { rozpis: state.rozpis } : {}),
    spaky: state.spaky,
    spakyNaSekere: state.spakyNaSekere,
    nastenka: state.nastenka,
    stredFinale: stranaStreduFinale(state),
    naexVKole: state.naexVKole,
    starsi: state.starsi.map((e) => ({ ...e, priazen: favourStarsieho(data, e) })),
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
            zobrate: (d.zobrate ?? []).map((z) => ({
              karta: { defId: z.karta.defId, leftLayout: z.karta.leftLayout, rightLayout: z.karta.rightLayout },
              hrac: z.hrac,
              miesto: z.miesto,
            })),
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
            pohorseniaPatronatu: bitka.pohorseniaPatronatu ?? [0, 0],
            exekutor: bitka.exekutor,
            benzinkaZostava: bitka.benzinkaZostava,
            spalit: bitka.spalit,
            zivnostnikZostava: bitka.zivnostnikZostava ?? 0,
          },
    patronat: [verejnyPatronat(0), verejnyPatronat(1)],
    mojaNahrada: state.patronat[ja]?.nahrada ?? null,
    volbaVestica:
      mojaBitkovaVolba && bitka.krok === "vestica"
        ? { moj: state.hraci[ja].doberaci, jeho: state.hraci[ja === 0 ? 1 : 0].doberaci }
        : null,
    vizia: state.vizia,
    volbaVizia: state.vizia !== null && naTahu(state) === ja ? (state.hraci[ja].doberaci[0] ?? null) : null,
    hasicVolba:
      hasic === undefined ? null : { hrac: hasic.hrac, karta: state.hraci[hasic.hrac].odhadzovaci.find((k) => k.uid === hasic.uid) ?? null },
    mojeKliatbyVBalicku: {
      dlh: state.hraci[ja].doberaci.filter((k) => k.defId === "dlh").length,
      cirhoza: state.hraci[ja].doberaci.filter((k) => k.defId === "cirhoza").length,
    },
    mojBalicekZlozenie: zlozenie(state.hraci[ja].doberaci),
    nepriznaneKliatby: [nepriznaneKliatbyHraca(state.hraci[0]), nepriznaneKliatbyHraca(state.hraci[1])],
    koniec: state.koniec,
    ohlaseneVydesenie: state.ohlaseneVydesenie,
    posunyMarkerov: state.posunyMarkerov,
  };
}

// ---------------------------------------------------------------------------
// Špaky a odhady (v6) — z verejného pohľadu, rovnako pre web, konzolový
// klient AI hráčov aj kroniku.

/** Stav, z ktorého sa rátajú špaky — ClientState ho spĺňa. */
export type PohladSpakov = Pick<ClientState, "spaky" | "nepriznaneKliatby" | "lokalityVHre" | "ciel" | "koniec" | "pitkaStav" | "kolo" | "lokalitCelkom" | "rozpis"> & {
  readonly hraci: readonly [Pick<HracVerejne, "poldeciPlne" | "cigarety">, Pick<HracVerejne, "poldeciPlne" | "cigarety">];
  readonly starsi: readonly ElderState[];
  readonly bitkaStav: { readonly damage: DamageResult | null } | null;
};

/**
 * Špaky za jedného staršieho po bitke: [hráč 0, hráč 1] — dá ich tomu, koho sa
 * bojí, ak ten bitku vyhrá (pri sekere aj tak, v6.1).
 */
export interface SpakyStarsieho {
  readonly elderId: string;
  readonly spaky: readonly [number, number];
}

export interface SpakyTeraz {
  /** Špaky v popolníkoch teraz. */
  readonly spaky: readonly [number, number];
  /** Nepriznané Cirhózy (ruka aj balíčky) — na konci každá SPAKY_ZA_CIRHOZU menej. */
  readonly cirhozy: readonly [number, number];
  /**
   * Výkupné, keby sa hra skončila teraz: plné poldeci a cigarety (verejné; vlastný
   * poldeci pod skrytým NA EX sa nevykúpi). Po konci hry výkupné z konca.
   */
  readonly vykupne: readonly [Vykupne, Vykupne];
  /** Keby sa hra skončila teraz: špaky mínus nepriznané Cirhózy plus výkupné. */
  readonly spolu: readonly [number, number];
  /**
   * Koľko špakov dajú starší hráčovi po najbližšej bitke, ak ju vyhrá (v6.1 —
   * porazený za starších nedostane nič, pri sekere obaja), keby sa markery nepohli.
   */
  readonly zaStarsich: readonly [number, number];
  readonly starsi: readonly SpakyStarsieho[];
  /** Koľkokrát ešte starší vyplatia špaky (bitky do konca vrátane finále). */
  readonly vyplat: number;
  /**
   * Odhad konečných špakov, keby sa markery už nepohli a hráč vyhral každú
   * zvyšnú bitku: spolu + vyplat × zaStarsich — strop toho, čo mu starší ešte
   * dajú. Špaky za bitky ani prebytok nepredvída — je to podklad pre náhľady,
   * nie sľub (bot si strach váži sám, rozdielBodov).
   */
  readonly odhad: readonly [number, number];
}

const BEZ_VYKUPNEHO: Vykupne = { poldeci: 0, cigarety: 0, spaky: 0 };

export function spakyTeraz(view: PohladSpakov): SpakyTeraz {
  const cirhozy: [number, number] = [view.nepriznaneKliatby[0].cirhoza, view.nepriznaneKliatby[1].cirhoza];
  // Po konci hry sú Cirhózy aj výkupné už v popolníku.
  const odpocet = (p: PlayerId): number => (view.koniec === null ? cirhozy[p] * KONSTANTY.SPAKY_ZA_CIRHOZU : 0);
  const skryte = (p: PlayerId): number => (view.pitkaStav?.skryteNaex ?? []).filter((x) => x.hrac === p).length;
  const vykupne: [Vykupne, Vykupne] =
    view.koniec === null
      ? [vykupneHraca(view.hraci[0], skryte(0)), vykupneHraca(view.hraci[1], skryte(1))]
      : [view.koniec.vykupne?.[0] ?? BEZ_VYKUPNEHO, view.koniec.vykupne?.[1] ?? BEZ_VYKUPNEHO];
  const navyse = (p: PlayerId): number => (view.koniec === null ? vykupne[p].spaky : 0);
  const spolu: [number, number] = [view.spaky[0] - odpocet(0) + navyse(0), view.spaky[1] - odpocet(1) + navyse(1)];
  const zaStarsich: [number, number] = [spakyZaStarsich(view.starsi, 0), spakyZaStarsich(view.starsi, 1)];
  const vyplat = vyplatZaStarsich(view);
  return {
    spaky: view.spaky,
    cirhozy,
    vykupne,
    spolu,
    zaStarsich,
    starsi: view.starsi.map((e) => ({ elderId: e.elderId, spaky: [strachZ(e, 0), strachZ(e, 1)] })),
    vyplat,
    odhad: [spolu[0] + vyplat * zaStarsich[0], spolu[1] + vyplat * zaStarsich[1]],
  };
}

/** Rozpis špakov hráča — popolník (z nástenky a konca hry). */
export interface RozpisSpakov {
  readonly zaBitky: number;
  readonly zaStarsich: number;
  /** Prebytok vo finále a na Kultúrnom dome. */
  readonly prebytok: number;
  /** Zhorené pri exekúcii (záporné). */
  readonly exekutor: number;
  /** Nepriznané Cirhózy na konci hry (záporné). */
  readonly cirhoza: number;
  /** Výkupné plných poldeci a cigariet na konci hry. */
  readonly vykupne: number;
  readonly spolu: number;
}

export function rozpisSpakov(view: Pick<ClientState, "nastenka" | "koniec" | "spaky">): readonly [RozpisSpakov, RozpisSpakov] {
  const pre = (p: PlayerId): RozpisSpakov => {
    const sucet = (f: (b: BitkaNaNastenke) => number): number => view.nastenka.reduce((a, b) => a + f(b), 0);
    return {
      zaBitky: sucet((b) => b.zaBitku[p]),
      zaStarsich: sucet((b) => b.zaStarsich[p]),
      prebytok: sucet((b) => b.prebytok[p]),
      exekutor: -sucet((b) => b.exekutor[p]),
      cirhoza: -(view.koniec?.cirhozy?.[p] ?? 0) * KONSTANTY.SPAKY_ZA_CIRHOZU,
      vykupne: view.koniec?.vykupne?.[p]?.spaky ?? 0,
      spolu: view.spaky[p],
    };
  };
  return [pre(0), pre(1)];
}

/**
 * Cena jednej kliatby navyše v konečných špakoch (záporné číslo) — pre náhľad
 * NA EX a Vypiť. Nepriznaná Cirhóza stojí na konci SPAKY_ZA_CIRHOZU; Dlh sám
 * špaky neberie (trestá ho Exekútor a remíza).
 */
export function cenaKliatby(_data: GameData, _view: ClientState, _p: PlayerId, defId: "dlh" | "cirhoza"): number {
  return defId === "cirhoza" ? -KONSTANTY.SPAKY_ZA_CIRHOZU : 0;
}

/** Odhad konečných špakov pri patronáte: teraz, pri prehre a pri výhre patróna. */
export interface NahladPatronatu {
  readonly teraz: readonly [number, number];
  /** Marker v strede, starší sa vráti na scorecard. */
  readonly prehra: readonly [number, number];
  /** Patrón vyhrá: starší je jeho, na scorecarde leží karta lícom dole. */
  readonly vyhra: readonly [number, number];
}

/**
 * Náhľad patronátu z pohľadu patróna `view.ja`: marker pôjde do stredu, takže
 * súper prestane dostávať špaky za strach tohto staršieho (odhad). Pohoršenia,
 * ktoré dostane súper, náhľad nezohľadňuje.
 */
export function nahladPatronatu(
  _data: GameData,
  view: ClientState,
  elderId: string,
  karta: Pick<CardInstance, "defId" | "leftLayout" | "rightLayout"> | null,
): NahladPatronatu {
  const po = (vyhral: boolean): readonly [number, number] => {
    const starsi = view.starsi.map((e) => {
      if (e.elderId !== elderId) return e;
      const stred = { ...e, marker: MARKER_STRED };
      return vyhral ? { ...stred, karta: karta === null ? e.karta : { uid: -1, ...karta }, nahradeny: true, ziskal: view.ja } : stred;
    });
    return spakyTeraz({ ...view, starsi }).odhad;
  };
  return { teraz: spakyTeraz(view).odhad, prehra: po(false), vyhra: po(true) };
}

/** Odhad špakov a priazeň po posune markera jedného staršieho (prebytok, Pohoršenie). */
export interface NahladPosunu {
  /** Odhad konečných špakov [hráč 0, hráč 1] po posune (spakyTeraz.odhad). */
  readonly odhad: readonly [number, number];
  /** Zmena odhadu oproti stavu pred posunom. */
  readonly zmena: readonly [number, number];
  /** Špaky za tohto staršieho po každej ďalšej bitke [hráč 0, hráč 1]. */
  readonly spakyZaStarsieho: readonly [number, number];
  /** Komu patrí priazeň staršieho po posune a s akou silou. */
  readonly priazen: PlayerId | null;
  readonly sila: number;
}

/**
 * Náhľad posunu markera o jedno pole k hráčovi k (Michal 2026-10-19 —
 * hráči nevedeli, komu posun pomôže). null, keď je marker na kraji.
 */
export function nahladPosunuMarkera(_data: GameData, view: ClientState, elderId: string, k: PlayerId): NahladPosunu | null {
  const elder = view.starsi.find((e) => e.elderId === elderId);
  if (elder === undefined) return null;
  const marker = posunMarker(elder, k);
  if (marker === null) return null;
  const posunuty = { ...elder, marker };
  const pred = spakyTeraz(view).odhad;
  const po = spakyTeraz({ ...view, starsi: view.starsi.map((e) => (e.elderId === elderId ? posunuty : e)) }).odhad;
  return {
    odhad: po,
    zmena: [po[0] - pred[0], po[1] - pred[1]],
    spakyZaStarsieho: [strachZ(posunuty, 0), strachZ(posunuty, 1)],
    priazen: priazenHraca(posunuty),
    sila: priazenSila(posunuty),
  };
}

/** Náhľad jedného posunu prebytkom k súperovi držiteľa (porazený za prvý posun staršieho dostane cigaretu). */
export function nahladPosunuPrebytkom(data: GameData, view: ClientState, elderId: string): NahladPosunu | null {
  const drzi = view.bitkaStav?.prebytokDrzi ?? null;
  if (drzi === null) return null;
  return nahladPosunuMarkera(data, view, elderId, drzi === 0 ? 1 : 0);
}

/**
 * Hodnota posunu pre hráča p pri hltavom výbere: rozdiel odhadov (p − súper),
 * pri zhode radšej posun, ktorý vydesí staršieho (výhra vydesením), a ten, po
 * ktorom má súper slabšie priazne.
 */
function hodnotaPohladu(view: ClientState, p: PlayerId): number {
  const su: PlayerId = p === 0 ? 1 : 0;
  const o = spakyTeraz(view).odhad;
  const vydeseni = view.starsi.filter((e) => vydesil(e, p)).length;
  const priazneSupera = view.starsi.reduce((a, e) => a + (priazenHraca(e) === su ? priazenSila(e) : 0), 0);
  return o[p] - o[su] + 0.5 * vydeseni - 0.01 * priazneSupera;
}

/**
 * Hltavé rozdelenie prebytku: `drzi` posúva markery k súperovi a každý posun
 * dá tam, kde mu najviac pridá (hodnotaPohladu). Vráti poradie starších
 * (posuny po jednom, starší sa môže opakovať) a stav po nich — klient z toho
 * robí návrh rozdelenia na jeden klik (roadmapa #9 B).
 */
export function hltavyPrebytok(
  _data: GameData,
  view: ClientState,
  drzi: PlayerId,
  prebytok: number,
  cena: number,
): { readonly kroky: readonly string[]; readonly view: ClientState } {
  const super_: PlayerId = drzi === 0 ? 1 : 0;
  let v = view;
  const kroky: string[] = [];
  for (let zostava = prebytok; zostava >= cena; zostava -= cena) {
    let najlepsi: { readonly v: ClientState; readonly hodnota: number; readonly elderId: string } | null = null;
    for (const e of v.starsi) {
      const marker = posunMarker(e, super_);
      if (marker === null) continue;
      const po: ClientState = { ...v, starsi: v.starsi.map((x) => (x.elderId === e.elderId ? { ...x, marker } : x)) };
      const hodnota = hodnotaPohladu(po, drzi);
      if (najlepsi === null || hodnota > najlepsi.hodnota) najlepsi = { v: po, hodnota, elderId: e.elderId };
    }
    if (najlepsi === null) break;
    v = najlepsi.v;
    kroky.push(najlepsi.elderId);
  }
  return { kroky, view: v };
}

/**
 * Hltavé Pohoršenia: hráč `p` posunie `pocet` markerov k súperovi alebo k sebe,
 * každý tam, kde odhadu špakov (p − súper) najviac pridá. Vráti, o koľko sa
 * rozdiel odhadov pohne — pre „≈ špakov“ v náhľade NA EX a patronátu; súperove
 * Pohoršenia v tej istej bitke nerieši, preto „≈“.
 */
export function hodnotaPohorseni(_data: GameData, view: ClientState, p: PlayerId, pocet: number): number {
  const super_: PlayerId = p === 0 ? 1 : 0;
  const rozdiel = (v: ClientState): number => {
    const o = spakyTeraz(v).odhad;
    return o[p] - o[super_];
  };
  let v = view;
  for (let zostava = pocet; zostava > 0; zostava--) {
    let najlepsi: { readonly v: ClientState; readonly hodnota: number } | null = null;
    for (const e of v.starsi) {
      // Súperov patrón: Pohoršenia z patronátu naňho nesmú (v6) — odhad ho vynechá celý.
      if (e.elderId === v.patronat[super_]?.elderId) continue;
      for (const smer of [super_, p] as const) {
        const marker = posunMarker(e, smer);
        if (marker === null) continue;
        const po: ClientState = { ...v, starsi: v.starsi.map((x) => (x.elderId === e.elderId ? { ...x, marker } : x)) };
        const hodnota = hodnotaPohladu(po, p);
        if (najlepsi === null || hodnota > najlepsi.hodnota) najlepsi = { v: po, hodnota };
      }
    }
    if (najlepsi === null) break;
    v = najlepsi.v;
  }
  return rozdiel(v) - rozdiel(view);
}

/** Stávka bitky z pohľadu `view.ja` (v6) — špaky za výhru a čo dostane súper, keď vyhrá on. */
export interface StavkaBitky {
  /** Pitky kola, s ktorými sa ráta (odohrané a ešte chystané). */
  readonly pitky: number;
  /** Moje špaky za výhru: Pitky mínus rozdiel Absťákov (aspoň 1), sekera a starší, ktorí sa ma boja. */
  readonly vyhra: number;
  /** Súperove špaky, keď vyhrá on (záporné číslo z môjho pohľadu). */
  readonly prehra: number;
  /** Špaky na sekere, ktoré vezme víťaz (vo finále pri sekere prepadnú). */
  readonly naSekere: number;
  /** Z toho od starších [ja, súper] — dostane ich len víťaz (v6.1), podľa markerov teraz. */
  readonly starsi: readonly [number, number];
}

/**
 * Stávka bitky (Michal 2026-10-22, návrh 3 A; v6 v špakoch): čo hráč získa
 * výhrou a čo získa súper, keď vyhrá on — od v6.1 aj so špakmi za starších,
 * ktoré dostane len víťaz. Súperove Absťáky v ruke nevidno — rátajú sa len
 * verejné; Autobusár jeden ignoruje.
 */
export function stavkaBitky(data: GameData, view: ClientState): StavkaBitky | null {
  if (view.ciel === null || view.koniec !== null) return null;
  const ja = view.ja;
  const su: PlayerId = ja === 0 ? 1 : 0;
  const pitky = Math.max(view.pitkyCelkom, view.pitkaCislo, 1);
  const abstaky: [number, number] = [0, 0];
  abstaky[ja] = abstakyVBitke(data, view, ja, view.ruka.filter((k) => k.defId === "abstak").length);
  abstaky[su] = abstakyVBitke(data, view, su, 0);
  const starsi: [number, number] = [spakyZaStarsich(view.starsi, ja), spakyZaStarsich(view.starsi, su)];
  return {
    pitky,
    vyhra: spakyZaBitku(pitky, abstaky[ja], abstaky[su]) + view.spakyNaSekere + starsi[0],
    prehra: -(spakyZaBitku(pitky, abstaky[su], abstaky[ja]) + view.spakyNaSekere + starsi[1]),
    naSekere: view.spakyNaSekere,
    starsi,
  };
}

/**
 * Záverečný účet partie v6 do archívu (kronika): popolníky oboch hráčov
 * a nástenka bitiek. Partie do v5 majú v archíve záverečné bodovanie po
 * starších (bez poľa `verzia`) — číta ho klient po starom.
 */
export interface UcetSpakov {
  readonly verzia: "v6";
  readonly spolu: readonly [number, number];
  readonly rozpis: readonly [RozpisSpakov, RozpisSpakov];
  readonly nastenka: readonly BitkaNaNastenke[];
}

export function ucetSpakov(view: Pick<ClientState, "nastenka" | "koniec" | "spaky">): UcetSpakov {
  return { verzia: "v6", spolu: [view.spaky[0], view.spaky[1]], rozpis: rozpisSpakov(view), nastenka: view.nastenka };
}
