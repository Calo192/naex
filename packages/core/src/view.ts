// viewFor — BEZPEČNOSTNÁ HRANICA (M6).
//
// Toto je jediné miesto, ktoré rozhoduje, čo hráč vidí. Zo stavu sa NIKDY
// nesmie dostať von: obsah súperovej ruky, obsah ani poradie ŽIADNEHO
// doberacieho balíčka (vlastného, súperovho, spoločného), súperov balíček
// stavby šenku a jeho výber v kroku stavby, jeho
// karta z Vízie
// a jeho skryto vybrané NA EX (v5, NA EX naraz — do odkrytia ani ich počet).
// Posielajú sa len počty (aj počet súperových nepriznaných kliatob — ten sa
// dá odvodiť z verejného logu). Skryť kartu v rozhraní je bezcenné — filtruje
// sa TU a testuje sa to. Súperova skrytá Záverečná (lícom dole) v strany
// vôbec nie je — súper dostane len jej stranu a náhradné uid (zaverecne).
// Špaky, ich história (nástenka) a sekera sú verejné (v6).
//
// 2 na 2 (Michal 2026-10-28): pohľad je pre miesto pri stole. Tím vidí všetko svoje —
// ruku partnera, jeho balíček stavby a výber, skryté NA EX, odpovede a Záverečnú tímu;
// zo súperského tímu len to, čo súper v 1 na 1 (ruky len počtom). Test: view-2na2.test.ts.

import type { CardInstance, Clen, Favour, Miesto, Phase, PlayerId } from "./types.ts";
import { opponentOf, timMiesta } from "./types.ts";
import type { GameData } from "./data.ts";
import type { PlacedCard } from "./partia.ts";
import type { DruhMarkera, ElderState, Stupen, Vazen, Zdvih, ZmenaMarkera } from "./elders.ts";
import type {
  BitkaKrok,
  BitkaNaNastenke,
  CielKola,
  Command,
  GameState,
  HasicVolba,
  KoniecHry,
  KseftyKola,
  PitkaStav,
  StavSchopnostiVazna,
  StavHadky,
  ZdvihVBitke,
  Vykupne,
  VyberStavby,
  ZhromazdenieStav,
} from "./engine.ts";
import { balicekMiesta, cenaDedicstva, cervenychHraca, cirhozyPreVeterinara, hotovoMiesta, lokalityNaVyber, majitelPresvedcenej, miestaHry, miestoNaTahu, partnerMiesta, rukaMiesta, skoncilVykladanie, vyberMiesta, vykupneHraca, mozeHrat, naTahu, kartyBitky, spakyZaVyhru, uidZaverecnej, vazniHraca } from "./engine.ts";
import type { HraPata } from "./pata.ts";
import { hraPataPre, maDost } from "./pata.ts";
import { KONSTANTY, vazniNaVyhru } from "./constants.ts";
import { kartyVRukach, pocetAbstakov, rukaClena } from "./player.ts";
import { efektHraca, efektPotlaceny, vplyvyNaAkcie } from "./effects.ts";
import type { VerejnyStav, VplyvNaAkciu } from "./effects.ts";
import { favourStarsieho, kradezZaZajatie, priazenHraca, priazenSila, sMarkerom, spakyOdStarsieho, stupenStavu } from "./elders.ts";
import { kandidatiRozdelenia, krokRozdelenia, bodyRozdelenia, markerRozdelenia, prikazRozdelenia } from "./rozdelenie.ts";
import type { DamageResult } from "./battle.ts";

export interface HracVerejne {
  /** Karty v ruke — v 2 na 2 v oboch rukách tímu. */
  readonly rukaPocet: number;
  /** 2 na 2: karty v ruke každého člena tímu [prvý, druhý]. */
  readonly rukyPocet?: readonly [number, number];
  readonly doberaciPocet: number;
  /** Odhadzovací balíček je verejný — karty doň padajú lícom nahor. */
  readonly odhadzovaci: readonly CardInstance[];
  readonly priznane: readonly CardInstance[];
  /** Priznané Dlhy — počítadlo (v8.2, Michal 2026-10-30), verejné. */
  readonly dlhy: number;
  /**
   * Karty Absťák v balíčku hráča (ruka, doberací, odhadzovací; v9.1) — len počet, poloha
   * je skrytá ako ostatné karty v ruke a doberacom balíčku. Verejné ako nepriznané Cirhózy.
   */
  readonly abstaky: number;
  /** Chuť (v9.1) — latka nerestí na konci kola, verejná. */
  readonly chut: number;
  readonly dedicstvo: readonly CardInstance[];
  readonly poldeciPlne: number;
  readonly poldeciVypite: number;
  readonly cigarety: number;
  readonly pecen: number;
  readonly zadlzenie: number;
  /**
   * Neresti tohto kola (v9.1: porovnajú sa s Chuťou). Verejné — pitie,
   * fajčenie aj NA EX vidí každý pri stole.
   */
  readonly nerestiTotoKolo: number;
  /** Absťáky získané za hru — verejné, karta Absťák pribúda pred očami oboch. */
  readonly abstakyZiskane: number;
}

export interface BitkaVerejne {
  readonly krok: BitkaKrok | null;
  readonly caka: PlayerId | null;
  readonly damage: DamageResult | null;
  readonly vitaz: PlayerId | null;
  readonly prebytokDrzi: PlayerId | null;
  /** Nakladačka, ktorú víťaz bitky ešte rozdeľuje na svoj strach (v11, krok prebytok). */
  readonly prebytokZostava: number;
  /** Nakladačka rozdelená na strach víťaza (v11) a body, ktoré prepadli. */
  readonly prebytokZdvihy: readonly ZdvihVBitke[];
  readonly prebytokPrepadlo: number;
  /**
   * Hádka tohto kola (v10) — mäkké, víťaz, veľkosť, zvyšok na reči a rozdelené reči (v11,
   * krok reci); verejné.
   */
  readonly hadka?: StavHadky;
  /** Starší zajatí pri rozdelení Nakladačky (v11.4) — verejné. */
  readonly zajatia?: readonly string[];
  /** Špaky, ktoré hráčom v tejto bitke zhoreli pri exekúcii (v6). */
  readonly exekutor: readonly [number, number];
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
  /** Vybral hráč (v 2 na 2 obaja členovia tímu) v tomto kroku stavby? */
  readonly vybral: readonly [boolean, boolean];
  readonly naTahu: PlayerId;
  /** Hráč (v 2 na 2 celý tím) už zo šenku neberie. */
  readonly hotovo: readonly [boolean, boolean];
  /**
   * 2 na 2: balíček stavby a výber partnera — tím vidí svoje karty (Michal 2026-10-28);
   * súperove nie. Po miestach: veľkosť balíčka stavby, či vybral a či už neberie.
   */
  readonly partner?: { readonly balicek: readonly CardInstance[]; readonly vyber: VyberStavby | null };
  readonly miesta?: { readonly balicekPocet: readonly number[]; readonly vybral: readonly boolean[]; readonly hotovo: readonly boolean[] };
  readonly miestoNaTahu?: Miesto;
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
  /** Odpoveď na NA EX lícom dole (v9.2), nie Záverečná — otočí sa ešte v tejto Pitke. */
  readonly odpoved?: true;
}

/**
 * Starší tak, ako ho vidí hráč (v11): strach a reči oboch hráčov (ElderState) a priazeň,
 * ktorú dáva (v6, Michal 2026-10-26: „ostala len priazeň a na tú scorecard netreba“). Komu
 * a akú silu priazne starší dáva, ráta priazenHraca / priazenSila z rozdielu strachov.
 */
export interface StarsiVerejne extends ElderState {
  readonly priazen: Favour;
}

/**
 * Okamžité výhry (v11, Michal 2026-11-02), obe len vo vyhratej bitke: červené strachy
 * (väzni držiteľa sa rátajú) aspoň cervenychNaVyhru, alebo väzni aspoň vazniNaVyhru (podľa
 * ligy). Verejné — odvodené z markerov a väzňov.
 */
export interface StavVyhier {
  readonly cervene: readonly [number, number];
  readonly cervenychNaVyhru: number;
  readonly vazni: readonly [number, number];
  readonly vazniNaVyhru: number;
}

/** Stav okamžitých výhier z verejného stavu (GameState aj ClientState). */
export function stavVyhier(state: { readonly starsi: readonly Pick<ElderState, "strach">[]; readonly vazni: readonly Vazen[]; readonly lokalitCelkom: number }): StavVyhier {
  return {
    cervene: [cervenychHraca(state, 0), cervenychHraca(state, 1)],
    cervenychNaVyhru: KONSTANTY.CERVENYCH_NA_VYHRU,
    vazni: [vazniHraca(state, 0).length, vazniHraca(state, 1).length],
    vazniNaVyhru: vazniNaVyhru(state.lokalitCelkom),
  };
}

export interface ClientState {
  /** Môj hráč — v 2 na 2 môj tím. */
  readonly ja: PlayerId;
  /** 2 na 2: formát, moje miesto pri stole a kapitáni kola (chýbajú v 1 na 1). */
  readonly format?: "2na2";
  readonly miesto?: Miesto;
  readonly kapitani?: readonly [Clen, Clen];
  /** 2 na 2: miesto na ťahu (naTahu je tím). */
  readonly miestoNaTahu?: Miesto | null;
  /** 2 na 2: ruka partnera — tím vidí obe svoje ruky, súperove len počtom. */
  readonly rukaPartnera?: readonly CardInstance[];
  /** Päta, Lakeť, Otočka: stav režimu bez súperových skrytých výberov; chýba = Kalamita. */
  readonly pata?: HraPata;
  /** Má dosť Poštárky: súperova ruka je pre teba odkrytá. Ide len tomu, kto ju smie vidieť. */
  readonly rukaSupera?: readonly CardInstance[];
  readonly faza: Phase;
  /** Partia bez Chuti a Absťáku (výučba Prvá hra, v9.1). */
  readonly bezChuti?: true;
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
  /**
   * Akcie oboch hráčov posilnené Nástrojmi v Dedičstve (žeravé ikony). Verejné —
   * Dedičstvo leží na stole, súperove posilnené akcie žhnú tiež.
   */
  readonly vplyvyAkcii: readonly [readonly VplyvNaAkciu[], readonly VplyvNaAkciu[]];
  /** Počty kariet v balíčkoch Náradie a Občania (v8.5) — verejné, poradie a obsah nie. */
  readonly naradiePocet: number;
  readonly obcaniaPocet: number;
  readonly senok: readonly CardInstance[];
  /**
   * Lokality, z ktorých sa vyberá cieľ: v7 neodohrané lokality úrovne tohto
   * (vo Voľbe cieľa) alebo ďalšieho kola, vo finále žiadne; bez rozpisu všetky
   * nevybrané. Nie sú to všetky lokality v hre — tie ráta lokalitNevybranych.
   */
  readonly lokalityVHre: readonly CardInstance[];
  /** Počet lokalít hry; po nich príde finále (ciel.typ === "finale"). */
  readonly lokalitCelkom: number;
  /** Rozpis úrovní lokalít po kolách s finále na konci (v7); chýba = žreb ako do v6. */
  readonly rozpis?: readonly number[];
  /** Rany navyše z Kšeftu Strýka z Ameriky v tomto kole (v7) — verejné. */
  readonly kseftRany?: readonly [number, number];
  /** Účinky schopností väzňov do konca kola (v11.2: Starosta); verejné. */
  readonly kseftyKola?: KseftyKola;
  /** Priloženia súpera ku kartám hráča v tomto kole (Pasca v7); verejné. */
  readonly prilozeniaKu?: readonly [number, number];
  /** Špaky oboch hráčov teraz (v6) — popolníky. */
  readonly spaky: readonly [number, number];
  /** Špaky na sekere — vezme ich víťaz ďalšej bitky, vo finále prepadnú. */
  readonly spakyNaSekere: number;
  /** Odohrané bitky v poradí: lokalita, víťaz a špaky — krčmová nástenka. */
  readonly nastenka: readonly BitkaNaNastenke[];
  readonly naexVKole: readonly [boolean, boolean];
  /** Starší na stupnici so strachom a rečami oboch hráčov (v11) — väzni sú vo `vazni`. */
  readonly starsi: readonly StarsiVerejne[];
  /** Okamžité výhry (v11): červené a väzni oboch a koľko treba. */
  readonly vyhry: StavVyhier;
  readonly ciel: CielKola | null;
  readonly lokalitaOtocena: boolean;
  /** v11.11: víťaz hádky minulého kola; natáča ďalšiu lokalitu. Pri remíze null, v K1 chýba. */
  readonly vitazPoslednejHadky?: PlayerId | null;
  readonly strany: readonly [readonly PlacedCard[], readonly PlacedCard[]];
  /** Skryté Záverečné — najviac jedna na stranu; za ňu sa nedá priložiť (zablokovaneStrany). */
  readonly zaverecne: readonly ZaverecnaVerejna[];
  /** Poldeci, ktoré akcie Poldeci v tomto kole už otočili v Pitke (Jogurt). */
  readonly poldeciOtoceneVKole?: readonly [number, number];
  /** Smiem teraz zahrať Záverečnú (Zhromaždenie, nepasoval som, mám cigaretu)? */
  readonly zaverecnaMozna: boolean;
  readonly draftStav: DraftVerejne | null;
  readonly zhromazdenieStav: ZhromazdenieStav | null;
  readonly pitkaStav: PitkaStav | null;
  readonly bitkaStav: BitkaVerejne | null;

  /** Väzni oboch hráčov v poradí zajatia (v9) — verejné. */
  readonly vazni: readonly Vazen[];
  /** Veštica (Prehra): oba doberacie balíčky — len porazenému počas výberu. */
  readonly volbaVestica: { readonly moj: readonly CardInstance[]; readonly jeho: readonly CardInstance[] } | null;
  /** Vízia: koľko vrchných kariet ešte kto prezrie (verejné, null = Vízia neprebieha). */
  readonly vizia: { readonly zostava: readonly [number, number] } | null;
  /** Vízia: vrchná karta MÔJHO balíčka, o ktorej práve rozhodujem — len mne. */
  readonly volbaVizia: CardInstance | null;
  /** Krištáľová guľa (Náradie 2026-10-30): druhá karta zhora — len majiteľovi počas jeho Vízie. */
  readonly volbaViziaDruha?: CardInstance | null;
  /**
   * Hasič: kto rozhoduje o vytiahnutej karte a ktorá to je. Verejné obom —
   * karta leží v jeho odhadzovacom balíčku, ten je verejný. null = nikto
   * nerozhoduje; karta null = medzitým z odhadzovacieho zmizla.
   */
  readonly hasicVolba: { readonly hrac: PlayerId; readonly karta: CardInstance | null } | null;
  /** Voľba, ktorá čaká ako Hasič: karta zo šenku (Zastávka), Nástroj za Živnostníka, starší pre Kapybaru. */
  readonly volbaNastupu: { readonly typ: NonNullable<HasicVolba["typ"]>; readonly hrac: PlayerId } | null;
  /**
   * Nepriznané kliatby v MOJOM doberacom balíčku (len počty, poradie nie).
   * Vlastné karty hráč pozná, len nevie, v akom poradí ich dobere. Od v8.2 len
   * Cirhóza — Dlh je počítadlo, do balíčka nejde.
   */
  readonly mojeKliatbyVBalicku: { readonly cirhoza: number };
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
  /** Zmeny strachu a rečí od poslednej bitky do konca Zhromaždenia (v11; verejné, stopa na stupnici). */
  readonly zmenyMarkerov: readonly ZmenaMarkera[];
}

/** Nepriznané kliatby hráča — od v8.2 len Cirhózy (Dlh a Absťák sú počítadlá). */
export interface KliatbyHraca {
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

/** Nepriznané kliatby hráča — v ruke (v 2 na 2 v oboch rukách tímu) a v oboch balíčkoch. */
export function nepriznaneKliatbyHraca(hrac: GameState["hraci"][number]): KliatbyHraca {
  const vsetky = [...kartyVRukach(hrac), ...hrac.doberaci, ...hrac.odhadzovaci];
  return { cirhoza: vsetky.filter((k) => k.defId === "cirhoza").length };
}

/**
 * Bzdocha (Pitka, Michal 2026-10-27): hráč ja vidí súperove skryté NA EX, keď súper
 * už svoju časť Pitky skončil a ja ešte hrám — s Bzdochou naňho čakám (hraVPitke).
 * Všetko z verejného stavu, takže to klient vie aj z pohľadu (štítky na stole).
 */
export function vidiVolbuSupera(data: GameData, state: VerejnyStav & { readonly pitkaStav: Pick<PitkaStav, "hotovy"> | null }, ja: PlayerId): boolean {
  const pitka = state.pitkaStav;
  if (pitka === null || pitka.hotovy[ja] || !pitka.hotovy[ja === 0 ? 1 : 0]) return false;
  return efektHraca(state, ja, "klebetnica") && !efektPotlaceny(data, state, ja, "klebetnica");
}

export function viewFor(data: GameData, state: GameState, miesto: Miesto): ClientState {
  // Všetko tímové (strany, NA EX, balíčky, voľby) patrí tímu; osobná je len ruka a ťah.
  const ja = timMiesta(miesto);
  const dva = state.format === "2na2";
  const publicPlayer = (p: PlayerId): HracVerejne => {
    const hrac = state.hraci[p];
    return {
      rukaPocet: kartyVRukach(hrac).length,
      ...(dva ? { rukyPocet: [rukaClena(hrac, 0).length, rukaClena(hrac, 1).length] as const } : {}),
      doberaciPocet: hrac.doberaci.length,
      odhadzovaci: hrac.odhadzovaci,
      priznane: hrac.priznane,
      dlhy: hrac.dlhy,
      abstaky: pocetAbstakov(hrac),
      chut: hrac.chut,
      dedicstvo: hrac.dedicstvo,
      poldeciPlne: hrac.poldeciPlne,
      poldeciVypite: hrac.poldeciVypite,
      cigarety: hrac.cigarety,
      pecen: hrac.pecen,
      zadlzenie: hrac.zadlzenie,
      nerestiTotoKolo: hrac.nerestiTotoKolo,
      abstakyZiskane: hrac.abstakyZiskane ?? 0,
    };
  };

  // Záverečná súpera: v strany nie je, súper vie len, že na konci strany leží rub.
  const skryta = (pl: PlacedCard): boolean => pl.zaverecna === true && pl.playedBy !== ja;
  const skrySuperove = (strana: PlayerId): readonly PlacedCard[] =>
    state.strany[strana].some(skryta) ? state.strany[strana].filter((pl) => !skryta(pl)) : state.strany[strana];
  const zaverecne: ZaverecnaVerejna[] = [];
  for (const strana of [0, 1] as const) {
    for (const pl of state.strany[strana]) {
      if (pl.zaverecna !== true) continue;
      zaverecne.push({ strana, majitel: pl.playedBy, uid: skryta(pl) ? uidZaverecnej(strana) : pl.card.uid, naexBy: pl.naexBy ?? null, ...(pl.odpoved === true ? { odpoved: true as const } : {}) });
    }
  }
  const d = state.draftStav;
  const pocetTimu = (t: PlayerId, f: (m: Miesto) => number): number => f(t) + f((t + 2) as Miesto);
  const bitka = state.bitkaStav;
  const mojaBitkovaVolba = bitka !== null && bitka.caka === ja;
  const hasic = state.hasicVolby?.[0];
  const partner = partnerMiesta(miesto);
  return {
    ja,
    ...(dva ? { format: "2na2" as const, miesto, kapitani: state.kapitani ?? [0, 0], miestoNaTahu: miestoNaTahu(state), rukaPartnera: rukaMiesta(state, partner) } : {}),
    ...(state.pata === undefined ? {} : { pata: hraPataPre(state.pata, ja) }),
    ...(state.pata !== undefined && maDost(state.pata, ja, "postarka") ? { rukaSupera: state.hraci[ja === 0 ? 1 : 0].ruka } : {}),
    faza: state.faza,
    kolo: state.kolo,
    utocnik: state.utocnik,
    naTahu: naTahu(state),
    mozemHrat: mozeHrat(state, miesto),
    pitkaCislo: state.pitkaCislo,
    pitkyCelkom: state.pitkyCelkom,
    cenaDedicstva: cenaDedicstva(state),
    dedicstvaVylozene: state.dedicstvaVylozene,
    ruka: rukaMiesta(state, miesto),
    hraci: [publicPlayer(0), publicPlayer(1)],
    vplyvyAkcii: [vplyvyNaAkcie(state, 0, data), vplyvyNaAkcie(state, 1, data)],
    naradiePocet: state.naradie.length,
    obcaniaPocet: state.obcania.length,
    senok: state.senok,
    lokalityVHre: lokalityNaVyber(data, state),
    lokalitCelkom: state.lokalitCelkom,
    ...(state.rozpis !== undefined ? { rozpis: state.rozpis } : {}),
    ...(state.kseftRany !== undefined ? { kseftRany: state.kseftRany } : {}),
    ...(state.kseftyKola !== undefined ? { kseftyKola: state.kseftyKola } : {}),
    ...(state.prilozeniaKu !== undefined ? { prilozeniaKu: state.prilozeniaKu } : {}),
    spaky: state.spaky,
    spakyNaSekere: state.spakyNaSekere,
    nastenka: state.nastenka,
    naexVKole: state.naexVKole,
    ...(state.bezChuti === true ? { bezChuti: true as const } : {}),
    starsi: state.starsi.map((e) => ({ ...e, priazen: favourStarsieho(data, e) })),
    vyhry: stavVyhier(state),
    ciel: state.ciel,
    lokalitaOtocena: state.lokalitaOtocena,
    ...(state.vitazPoslednejHadky === undefined ? {} : { vitazPoslednejHadky: state.vitazPoslednejHadky }),
    strany: [skrySuperove(0), skrySuperove(1)],
    zaverecne,
    // Jogurt otočil poldeci z verejných akcií — pečiatka nesmie sľúbiť to isté druhýkrát.
    ...(state.poldeciOtoceneVKole === undefined ? {} : { poldeciOtoceneVKole: state.poldeciOtoceneVKole }),
    zaverecnaMozna:
      state.faza === "zhromazdenie" &&
      state.zhromazdenieStav !== null &&
      mozeHrat(state, miesto) &&
      !skoncilVykladanie(state.zhromazdenieStav, miesto) &&
      state.hraci[ja].cigarety >= KONSTANTY.CENA_ZAVERECNEJ,
    draftStav:
      d === null
        ? null
        : {
            krok: d.krok,
            mojBalicek: balicekMiesta(d, miesto),
            balicekPocet: dva ? [pocetTimu(0, (m) => balicekMiesta(d, m).length), pocetTimu(1, (m) => balicekMiesta(d, m).length)] : [d.balicky[0].length, d.balicky[1].length],
            mojVyber: vyberMiesta(d, miesto),
            vybral: dva ? [pocetTimu(0, (m) => (vyberMiesta(d, m) === null ? 1 : 0)) === 0, pocetTimu(1, (m) => (vyberMiesta(d, m) === null ? 1 : 0)) === 0] : [d.vyber[0] !== null, d.vyber[1] !== null],
            naTahu: timMiesta(d.naTahu),
            hotovo: dva ? [hotovoMiesta(d, 0) && hotovoMiesta(d, 2), hotovoMiesta(d, 1) && hotovoMiesta(d, 3)] : d.hotovo,
            ...(dva
              ? {
                  partner: { balicek: balicekMiesta(d, partner), vyber: vyberMiesta(d, partner) },
                  miesta: {
                    balicekPocet: miestaHry(state).map((m) => balicekMiesta(d, m).length),
                    vybral: miestaHry(state).map((m) => vyberMiesta(d, m) !== null),
                    hotovo: miestaHry(state).map((m) => hotovoMiesta(d, m)),
                  },
                  miestoNaTahu: d.naTahu,
                }
              : {}),
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
            // Bzdocha: kto hrá Pitku po súperovi, vidí jeho NA EX.
            skryteNaex: (state.pitkaStav.skryteNaex ?? [])
              .filter((x) => x.hrac === ja || vidiVolbuSupera(data, state, ja))
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
            prebytokZdvihy: bitka.prebytokZdvihy,
            prebytokPrepadlo: bitka.prebytokPrepadlo,
            ...(bitka.hadka === undefined ? {} : { hadka: bitka.hadka }),
            ...(bitka.zajatia === undefined ? {} : { zajatia: bitka.zajatia }),
            exekutor: bitka.exekutor,
            spalit: bitka.spalit,
          },

    vazni: state.vazni,
    volbaVestica:
      mojaBitkovaVolba && bitka.krok === "vestica"
        ? { moj: state.hraci[ja].doberaci, jeho: state.hraci[opponentOf(ja)].doberaci }
        : null,
    vizia: state.vizia,
    volbaVizia: state.vizia !== null && naTahu(state) === ja ? (state.hraci[ja].doberaci[0] ?? null) : null,
    volbaViziaDruha:
      state.vizia !== null && naTahu(state) === ja && state.hraci[ja].dedicstvo.some((k) => k.defId === "kristalova_gula") ? (state.hraci[ja].doberaci[1] ?? null) : null,
    hasicVolba:
      hasic === undefined || hasic.typ !== undefined ? null : { hrac: hasic.hrac, karta: state.hraci[hasic.hrac].odhadzovaci.find((k) => k.uid === hasic.uid) ?? null },
    volbaNastupu: hasic?.typ === undefined ? null : { typ: hasic.typ, hrac: hasic.hrac },
    mojeKliatbyVBalicku: { cirhoza: state.hraci[ja].doberaci.filter((k) => k.defId === "cirhoza").length },
    mojBalicekZlozenie: zlozenie(state.hraci[ja].doberaci),
    nepriznaneKliatby: [nepriznaneKliatbyHraca(state.hraci[0]), nepriznaneKliatbyHraca(state.hraci[1])],
    koniec: state.koniec,
    zmenyMarkerov: state.zmenyMarkerov,
  };
}

// ---------------------------------------------------------------------------
// Špaky a odhady (v6) — z verejného pohľadu, rovnako pre web, konzolový
// klient AI hráčov aj kroniku.

/** Stav, z ktorého sa rátajú špaky — ClientState ho spĺňa. */
export type PohladSpakov = Pick<ClientState, "spaky" | "nepriznaneKliatby" | "koniec" | "pitkaStav"> & {
  readonly hraci: readonly [Pick<HracVerejne, "poldeciPlne" | "cigarety" | "dedicstvo">, Pick<HracVerejne, "poldeciPlne" | "cigarety" | "dedicstvo">];
  readonly starsi: readonly Pick<ElderState, "elderId" | "strach" | "reci" | "reciOd">[];
};

/**
 * Bodovanie jedného staršieho po najbližšej bitke (v11): koľko dá ktorému hráčovi, keď
 * bitku vyhrá (najvyšší marker — reči, inak strach), a keď ju prehrá alebo pri sekere
 * (len reči). [hráč 0, hráč 1].
 */
export interface SpakyStarsieho {
  readonly elderId: string;
  readonly vyhra: readonly [number, number];
  readonly prehra: readonly [number, number];
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
  /** Starší po najbližšej bitke spolu [hráč 0, hráč 1], keď ju ten hráč vyhrá (v11). */
  readonly zaStarsichVyhra: readonly [number, number];
  /** Starší po najbližšej bitke spolu, keď ju ten hráč prehrá alebo pri sekere — len reči (v11). */
  readonly zaStarsichPrehra: readonly [number, number];
  readonly starsi: readonly SpakyStarsieho[];
}

const BEZ_VYKUPNEHO: Vykupne = { poldeci: 0, cigarety: 0, spaky: 0 };

/** Bodovanie staršieho po bitke pre oboch hráčov (SpakyStarsieho). */
export function spakyStarsieho(e: Pick<ElderState, "elderId" | "strach" | "reci" | "reciOd">): SpakyStarsieho {
  return {
    elderId: e.elderId,
    vyhra: [spakyOdStarsieho(e, 0, true), spakyOdStarsieho(e, 1, true)],
    prehra: [spakyOdStarsieho(e, 0, false), spakyOdStarsieho(e, 1, false)],
  };
}

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
  const starsi = view.starsi.map(spakyStarsieho);
  const sucet = (f: (x: SpakyStarsieho) => number): number => starsi.reduce((a, x) => a + f(x), 0);
  return {
    spaky: view.spaky,
    cirhozy,
    vykupne,
    spolu,
    zaStarsichVyhra: [sucet((x) => x.vyhra[0]), sucet((x) => x.vyhra[1])],
    zaStarsichPrehra: [sucet((x) => x.prehra[0]), sucet((x) => x.prehra[1])],
    starsi,
  };
}

/**
 * Riadok pultu starších (v11, mock 5 Pult): strach a reči oboch, priazeň z rozdielu
 * strachov, stav, presvedčenie a špaky pri výhre a prehre.
 */
export interface RiadokStarsieho extends SpakyStarsieho {
  readonly defId: string;
  readonly priazen: Favour;
  readonly strach: readonly [Stupen, Stupen];
  readonly reci: readonly [Stupen, Stupen];
  /** Komu starší dáva priazeň (null = strachy sú rovnaké) a akú silu. */
  readonly priazenHrac: PlayerId | null;
  readonly priazenSila: number;
  /** Stav staršieho podľa vyššieho strachu — index do STAV_STARSIEHO. */
  readonly stav: Stupen;
  /** Kto ho presvedčil (v11.4), alebo null. */
  readonly presvedcil: PlayerId | null;
}

/** Pult starších (v11): riadky, súčty pri výhre a prehre a stav okamžitých výhier. */
export interface PultStarsich {
  readonly riadky: readonly RiadokStarsieho[];
  readonly vyhra: readonly [number, number];
  readonly prehra: readonly [number, number];
  readonly vyhry: StavVyhier;
}

export function pultStarsich(view: Pick<ClientState, "starsi" | "vazni" | "lokalitCelkom">): PultStarsich {
  const riadky = view.starsi.map((e): RiadokStarsieho => {
    return {
      ...spakyStarsieho(e),
      defId: e.karta.defId,
      priazen: e.priazen,
      strach: e.strach,
      reci: e.reci,
      priazenHrac: priazenHraca(e),
      priazenSila: priazenSila(e),
      stav: stupenStavu(e),
      presvedcil: e.presvedcil ?? null,
    };
  });
  const sucet = (f: (x: RiadokStarsieho) => number): number => riadky.reduce((a, x) => a + f(x), 0);
  return {
    riadky,
    vyhra: [sucet((x) => x.vyhra[0]), sucet((x) => x.vyhra[1])],
    prehra: [sucet((x) => x.prehra[0]), sucet((x) => x.prehra[1])],
    vyhry: stavVyhier(view),
  };
}

/** Rozpis špakov hráča — popolník (z nástenky a konca hry). */
export interface RozpisSpakov {
  readonly zaBitky: number;
  readonly zaStarsich: number;
  /** Prebytok zmenený na špaky (len archívne partie do v7). */
  readonly prebytok: number;
  /** Zhorené pri exekúcii (záporné). */
  readonly exekutor: number;
  /** Nepriznané Cirhózy na konci hry (záporné). */
  readonly cirhoza: number;
  /** Výkupné plných poldeci a cigariet na konci hry. */
  readonly vykupne: number;
  /** Väzni po finále (v9). */
  readonly vazni: number;
  readonly spolu: number;
}

export function rozpisSpakov(view: Pick<ClientState, "nastenka" | "koniec" | "spaky">): readonly [RozpisSpakov, RozpisSpakov] {
  const pre = (p: PlayerId): RozpisSpakov => {
    const sucet = (f: (b: BitkaNaNastenke) => number): number => view.nastenka.reduce((a, b) => a + f(b), 0);
    return {
      zaBitky: sucet((b) => b.zaBitku[p] + (b.robota?.[p] ?? 0)),
      zaStarsich: sucet((b) => b.zaStarsich[p]),
      prebytok: sucet((b) => b.prebytok[p]),
      exekutor: -sucet((b) => b.exekutor[p]),
      cirhoza: -(view.koniec?.cirhozy?.[p] ?? 0) * KONSTANTY.SPAKY_ZA_CIRHOZU,
      vykupne: view.koniec?.vykupne?.[p]?.spaky ?? 0,
      vazni: view.koniec?.vazni?.[p] ?? 0,
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
export function cenaKliatby(defId: "dlh" | "cirhoza"): number {
  return defId === "cirhoza" ? -KONSTANTY.SPAKY_ZA_CIRHOZU : 0;
}

/** Schopnosti väzňa z pohľadu hráča (v11.2) — ten istý výpočet ako legalCommands (ponukaSchopnostiVazna). */
export function stavSchopnostiVaznaZPohladu(view: ClientState): StavSchopnostiVazna {
  return {
    faza: view.faza,
    hra: view.mozemHrat && view.hasicVolba === null && view.volbaNastupu === null,
    vizia: view.vizia,
    draftStav: view.draftStav,
    zhromazdenieStav: view.zhromazdenieStav,
    pitkaStav: view.pitkaStav,
    ciel: view.ciel,
    senok: view.senok,
    vazni: view.vazni,
    ...(view.kseftyKola !== undefined ? { kseftyKola: view.kseftyKola } : {}),
    strany: view.strany,
    cigarety: view.hraci[view.ja].cigarety,
    // Hrobár presvedčeného staršieho nevezme (v11.4) — ako stavSchopnostiVazna v jadre.
    superovOdhadzovaci: view.hraci[view.ja === 0 ? 1 : 0].odhadzovaci.filter((k) => majitelPresvedcenej(view, k.uid) === null),
    cirhozy: cirhozyPreVeterinara({ ruka: [...view.ruka, ...(view.rukaPartnera ?? [])], priznane: view.hraci[view.ja].priznane }).length,
  };
}

/** Náhľad zajatia (v11.4) z pohľadu `view.ja`: čo väzeň dá, ak ho hráč teraz zajme. */
export interface NahladZajatia {
  /** Poradie zajatia v partii, ak zajme teraz. */
  readonly poradie: number;
  /** Krádež: špaky, ktoré súper odovzdá za reči pri tomto staršom teraz (v11.12), najviac toľko, koľko má. */
  readonly kradez: number;
  /** Koľkého väzňa by mal hráč — vazniNaVyhru = výhra hneď. */
  readonly mojichVaznov: number;
  readonly vazniNaVyhru: number;
  readonly vyhra: boolean;
}

export function nahladZajatia(view: Pick<ClientState, "vazni" | "ja" | "starsi" | "spaky" | "lokalitCelkom">, elderId?: string): NahladZajatia {
  const poradie = view.vazni.length + 1;
  const mojichVaznov = view.vazni.filter((v) => v.hrac === view.ja).length + 1;
  const naVyhru = vazniNaVyhru(view.lokalitCelkom);
  const su = opponentOf(view.ja);
  const elder = elderId === undefined ? undefined : view.starsi.find((e) => e.elderId === elderId);
  const kradez = elder === undefined ? 0 : Math.max(0, Math.min(kradezZaZajatie(elder, view.ja), view.spaky[su]));
  return { poradie, kradez, mojichVaznov, vazniNaVyhru: naVyhru, vyhra: mojichVaznov >= naVyhru };
}

/** Pohľad po rozdelení (v11): markery hráča p zdvihnuté podľa zdvihov — náhľad pred potvrdením. */
export function pohladPoRozdeleni<V extends { readonly starsi: readonly StarsiVerejne[] }>(view: V, p: PlayerId, marker: DruhMarkera, zdvihy: readonly Zdvih[]): V {
  return { ...view, starsi: view.starsi.map((e) => {
    const zd = zdvihy.find((x) => x.elderId === e.elderId);
    return zd === undefined ? e : sMarkerom(e, p, marker, zd.na);
  }) };
}

/**
 * Hodnota markerov pre hráča p pri návrhu rozdelenia: bodovanie po bitke (priemer výhry
 * a prehry) jeho mínus súperovo, červené strachy (výhra strachom) a ako slabé priazne dáva
 * súperovi.
 */
function hodnotaPohladu(view: Pick<ClientState, "starsi" | "vazni">, p: PlayerId): number {
  const su: PlayerId = p === 0 ? 1 : 0;
  let v = 0;
  for (const e of view.starsi) {
    const x = spakyStarsieho(e);
    v += (x.vyhra[p] + x.prehra[p]) / 2 - (x.vyhra[su] + x.prehra[su]) / 2;
    v -= 0.5 * Math.max(0, e.strach[p] - e.strach[su]);
  }
  return v + 2 * cervenychHraca(view, p);
}

/**
 * Návrh rozdelenia na jeden klik (roadmapa #9 B; v11): hráč, ktorý práve rozdeľuje
 * Nakladačku alebo hádku, dostane úplné rozdelenie — z ponuky úplných rozdelení
 * (kandidatiRozdelenia) to, po ktorom má najlepšiu hodnotu markerov. null, keď nerozdeľuje.
 * Akcie (zajatia / presvedčenia, v11.4) vyberá hráč sám — návrh rozdelí zvyšok popri nich.
 */
export function navrhRozdelenia(view: ClientState, akcie: readonly string[] = []): { readonly zdvihy: readonly Zdvih[]; readonly prikaz: Command } | null {
  const ja = view.ja;
  const krok = krokRozdelenia(view, ja);
  if (view.faza !== "bitka" || krok === null || !view.mozemHrat) return null;
  const marker = markerRozdelenia(krok);
  let najlepsie: { readonly zdvihy: readonly Zdvih[]; readonly v: number } | null = null;
  for (const zdvihy of kandidatiRozdelenia(view, ja, marker, bodyRozdelenia(view, ja), 64, akcie)) {
    const v = hodnotaPohladu(pohladPoRozdeleni(view, ja, marker, zdvihy), ja);
    if (najlepsie === null || v > najlepsie.v) najlepsie = { zdvihy, v };
  }
  return najlepsie === null ? null : { zdvihy: najlepsie.zdvihy, prikaz: prikazRozdelenia(krok, najlepsie.zdvihy, akcie) };
}

/** Stávka bitky z pohľadu `view.ja` (v6) — špaky za výhru a čo dostane súper, keď vyhrá on. */
export interface StavkaBitky {
  /** Karty v línii teraz (v8) — víťaz dostane 1 špak za každú. */
  readonly karty: number;
  /** Moje špaky za výhru: karty v línii (aspoň 1), sekera a Herňa. */
  readonly vyhra: number;
  /** Súperove špaky, keď vyhrá on (záporné číslo z môjho pohľadu). */
  readonly prehra: number;
  /** Kultúrny dom (v11.13): špaky porazeného za jeho karty v línii [moje pri prehre, súperove pri jeho prehre]. */
  readonly porazenemu: readonly [number, number];
  /** Herňa (v7): koľko z výhry [moja, súperova] je za priznané Dlhy porazeného. */
  readonly herna: readonly [number, number];
  /** Špaky na sekere, ktoré vezme víťaz (vo finále pri sekere prepadnú). */
  readonly naSekere: number;
  /**
   * Starší po bitke (v11, krok 4b): [moje, súperove], keď bitku vyhrá ten hráč (najvyšší
   * marker), a keď ju prehrá (len reči).
   */
  readonly starsiVyhra: readonly [number, number];
  readonly starsiPrehra: readonly [number, number];
}

/**
 * Stávka bitky (Michal 2026-10-22, návrh 3 A; v6 v špakoch): čo hráč získa
 * výhrou a čo získa súper, keď vyhrá on. Špaky za bitku ráta spakyZaVyhru ako
 * výplata (Herňa), s priznanými Dlhmi teraz. Absťáky špaky za bitku od
 * v8.1 neuberajú. Starší (v11) bodujú víťazovi najvyšší marker, porazenému len reči.
 */
export function stavkaBitky(view: ClientState): StavkaBitky | null {
  if (view.ciel === null || view.koniec !== null) return null;
  const ja = view.ja;
  const su = opponentOf(ja);
  const karty = kartyBitky(view);
  const moja = spakyZaVyhru(view, ja, karty);
  const jeho = spakyZaVyhru(view, su, karty);
  const st = spakyTeraz(view);
  return {
    starsiVyhra: [st.zaStarsichVyhra[ja], st.zaStarsichVyhra[su]],
    starsiPrehra: [st.zaStarsichPrehra[ja], st.zaStarsichPrehra[su]],
    karty: karty.spolu,
    porazenemu: [jeho.porazenemu, moja.porazenemu],
    vyhra: moja.spolu,
    prehra: -jeho.spolu,
    naSekere: view.spakyNaSekere,
    herna: [moja.herna, jeho.herna],
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
