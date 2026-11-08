// Register efektov kariet (M10).
//
// Žiadne DSL — jedna malá funkcia na kartu, zavesená na konkrétny háčik
// motora. Neimplementovaný efekt nie je blokujúci: karta beží v režime
// MANUAL — motor ju v správnej fáze pripomenie v logu a hráči ju vyhodnotia
// sami. Register MUSÍ pokrývať všetky id sady (kontroluje to test).

import type { Action, CardDef, Format, PlayerId, Tag } from "./types.ts";
import type { HraPata } from "./pata.ts";
import { opponentOf } from "./types.ts";
import type { GameData } from "./data.ts";
import { defOf, printedSides } from "./data.ts";
import type { GameState, KseftyKola } from "./engine.ts";
import type { ElderState } from "./elders.ts";
import type { CardInstance } from "./types.ts";
import type { LineEval, PlacedCard } from "./partia.ts";
import { evaluateLine, prevahaStran, silaVKraji, zvieratAUmlcane } from "./partia.ts";
import type { PlayerState } from "./player.ts";
import { limitVykladania } from "./player.ts";
import { KONSTANTY } from "./constants.ts";
import { efektyNavyse } from "./navyse.ts";

/**
 * Verejná časť stavu, z ktorej čítajú efekty ovplyvňujúce bitku a prahy.
 * Spĺňa ju GameState aj ClientState — klient z nej počíta živý odhad
 * poškodenia rovnakým kódom ako server.
 */
export interface VerejnyStav {
  readonly ciel: GameState["ciel"];
  readonly strany: GameState["strany"];
  readonly starsi: readonly ElderState[];
  readonly hraci: readonly [VerejnyHrac, VerejnyHrac];
  /** Formát partie — chýba v 1 na 1 (aj v archíve spred 2 na 2). */
  readonly format?: Format;
  /** Režim Päta, Lakeť, Otočka: rady starších; chýba = Kalamita. */
  readonly pata?: Pick<HraPata, "rady">;
  /** Špaky (Vidly v7) — chýba v syntetických stavoch testov. */
  readonly spaky?: readonly [number, number];
  /** Hráč dal v tomto kole NA EX (Šofér). */
  readonly naexVKole?: readonly [boolean, boolean];
  /** Účinky schopností väzňov do konca kola (v11.2: Starosta). */
  readonly kseftyKola?: KseftyKola;
  /** Koľkokrát súper v tomto kole priložil kartu ku karte hráča (Pasca v7). */
  readonly prilozeniaKu?: readonly [number, number];
}

export type VerejnyHrac = {
  readonly priznane: readonly CardInstance[];
  /** Priznané Dlhy — počítadlo (v8.2), nie karty. */
  readonly dlhy: number;
  readonly dedicstvo: readonly CardInstance[];
} & (
  /** Pohľad klienta: počet kariet Absťák v balíčku — poloha je skrytá (v9.1). */
  | { readonly abstaky: number }
  /** Stav na serveri: Absťáky sa rátajú z kariet (pocetAbstakov). */
  | Pick<PlayerState, "ruka" | "rukaDruheho" | "doberaci" | "odhadzovaci">
);

/**
 * native — pravidlo zabudované priamo v motore (nie je čo pripomínať)
 * impl   — efekt implementovaný v tomto súbore cez háčiky motora
 * manual — bez implementácie; motor ho pripomína v logu
 */
export type EfektStatus = "native" | "impl" | "manual";

export const REGISTER: Readonly<Record<string, EfektStatus>> = {
  // Texty podľa tlačovej sady (docs/KartyAI_PrintFile_20260716). Zmenený text
  // karty v tvorcovi → skontroluj, či implementácia ešte sedí.
  // Starší (v9, krok 2 revízie): v línii len akcie; od v11.2 schopnosť väzňa raz za hru
  // (elders.json, engine.ts cmdSchopnostVazna) — text karty v cards.json je z čias Kšeftu väzňa.
  autobusar: "impl", // Schopnosť väzňa: karty zo šenku po cigarete, potom koniec brania
  benzinka: "impl", // Pitka (v11.13): prvé fajčenie každého hráča v každej Pitke zadarmo (engine cenaFajcenia)
  cigorky: "impl", // Dedičstvo: Pitka (v7): za každé 2 cigarety, ktoré súper vyfajčí, karta (cmdSmoke)
  kocovnik: "native", // Furt: jeho akcie sa počítajú hráčovi s prevahou v jeho kraji (Michal 2026-10-24; evaluateLine)
  cirhoza: "native", // Bitka: dodatočná rana od súpera (cirhozaBonus)
  abstak: "native", // Bitka (v9.1): −1 tuhé za každý Absťák v balíčku, remíza v tuhom (stranyBitky); nedá sa priznať (cieleVykladania)
  opatrovatelka: "impl", // Furt (v11.5): aktívne akcie tvojich Pamätníkov v jej okolí posilnené (partia.ts kartoveEfekty)
  dievcina_na_vydaj: "impl", // Prehra (v7): spáli sa, súper získa Dlhy podľa jej aktívnych akcií (koniecBitky)
  farar: "impl", // Schopnosť väzňa: odstráni súperovo NA EX z karty, poldeci ostáva vypitý
  financna_poradkyna: "impl", // Pitka: Dlh z jej akcií dostáva súper, nie jej majiteľ (Michal 2026-10-18; spúšťač z Prestávky 2026-10-24)
  hasic: "impl", // Nástup: náhodná karta z odhadzovacieho — nechať v ruke, alebo vrátiť (príkaz hasic)
  hrobar: "impl", // Schopnosť väzňa: karta zo súperovho odhadzovacieho balíčka do ruky
  ihrisko: "impl", // Bitka: v každom kraji +2 tuhé tomu, kto tam má viac svojich Občanov, Zvierat a Starešinov (Michal 2026-10-20; Dvojčatá za dve, v8)
  krcma: "impl", // Pitka: s plným poldeci povinný NA EX (bez NA EX sa Pitka neskončí); prah Cirhózy +2
  krcmarka: "impl", // Schopnosť väzňa: nový plný poldeci
  lesna_cesta: "impl", // Bitka (v11.13): 2 tuhé za každé svoje Zviera v línii
  liberal: "impl", // Furt (v10.3): s rovnako ženami a chlapmi v partii majiteľa sú jeho aktívne akcie posilnené (partia.ts kartoveEfekty)
  milujuca_manzelka: "impl", // Pitka (v7, M2): tvoje poškodenie pečene v Pitke −1 (prirastkyPitky)
  ministrant: "impl", // Nástup (v7): ak vyvolá Konflikt, jeho Viera sa do konca kola ráta ako Pecka (partia.ts)
  nealko: "impl", // Dedičstvo: tvoj prah Cirhózy je o 2 vyšší (prahCirhozyBonus)
  niekoho_stryna: "impl", // Pitka (v7, Stryná): kto v Pitke nedal NA EX, +1 pečeň (prirastkyPitky)
  noviny: "impl", // Dedičstvo: Hádka (v11.5): víťaz hádky — súper odhodí 1 náhodnú kartu z ruky (engine novinyPoHadke)
  pasca: "impl", // Dedičstvo: Bitka (v7): súper v kole priložil kartu k tvojej → Rana navyše (bitkaMody; v zápise {Rana} evaluateLine)
  pijan: "impl", // Bitka (v7): Rana navyše za každé vlastné NA EX v kole (bitkaMody; v zápise {Rana} evaluateLine)
  policajtka: "impl", // Pitka (Michal 2026-11-02): súperovi zadĺženie za každú jeho akciu zrušenú tvojím Odporom (pokutaPolicajtky); sada so starým Konfliktom: Dlh, za Kriminála 2 cigarety (konflikt)
  postarka: "impl", // Schopnosť väzňa: 4 cigarety
  praudovravec: "impl", // Furt (v7, Dezinformátor): Odpor na jeho spojoch posilní (partia.ts)
  dvojcata: "impl", // Furt: do prevahy sa rátajú za dvoch (partia.ts, Michal 2026-10-20)
  puska: "impl", // Dedičstvo (Náradie 2026-10-30): prepojenú Petelicu namiesto zrušenia ráta za 2 (partia.ts puskaChrani)
  recidivista: "impl", // Prehra (v7): po bitke sa vráti do ruky (koniecBitky)
  silna_nezavisla_zena: "impl", // Furt: aktívne akcie susedných vlastných Občanov a Starešinov ×2, Zviera ani Nástroj nie (partia.ts, Michal 2026-11-08)
  starosta: "impl", // Schopnosť väzňa: do konca kola všetky akcie hrán lokality posilnené (partia.ts hranyPosilnene)
  svaty_text: "impl", // Dedičstvo: hodnota tvojej Viery o 1 vyššia v tlmení tuhého; Povery ruší 1 : 1 (computeDamage)
  veterinar: "impl", // Schopnosť väzňa: odhodí priznané Cirhózy a Cirhózy na ruke
  veteran: "impl", // Furt: NA EX naňho aktívne akcie zdvojí (nezruší), neaktívne nezdvojí (partia.ts, Michal 2026-10-23)
  velmi_smutiaca_vdova: "impl", // Konflikt: Chlap — súper odhodí 1 náhodnú kartu z ruky (2026-11-08); staré znenie z balíčka za Chlapov (konflikt)
  vestica: "impl", // Prehra: výmena kariet v balíčkoch
  vychovavatelka: "impl", // Schopnosť väzňa: súper v tomto Zhromaždení hneď pasuje bez cigariet
  vinko: "impl", // Dedičstvo: poldeci navyše; nedolieva poldeci za cigarety (Michal 2026-10-19)
  vyherny_automat: "impl", // Dedičstvo (v7): prah Dlhu +1, v poslednej Pitke kola 1 Dlh
  zastavka: "impl", // Pitka (v9.1): po prvej Pitke kola každý 1 karta zo šenku zadarmo, najprv útočník (engine dokonciPitku)
  // Náradie (Michal 2026-10-30, docs/napady/naradie-akcie.html): Nástroje do Dedičstva a Tipér.
  zapalovac: "impl", // Dedičstvo: tvoje aktívne Cigarety nemožno zrušiť NA EX (partia.ts applyNaex)
  vyherne_zreby: "impl", // Dedičstvo: Hazardy aktívne nespojené, spojené neaktívne; NA EX potom ako vždy (partia.ts)
  pistalka: "impl", // Dedičstvo: tvoje Obmedzenia uberajú aj cigarety za pas (cmdPass)
  hrable: "impl", // Dedičstvo: akcia zrušená tvojím Odporom sa ráta ako tvoja a je posilnená (partia.ts)
  zrkadlo: "impl", // Dedičstvo: tvoj Pakt kopíruje prepojenú akciu dvakrát (partia.ts)
  boxer: "impl", // Dedičstvo: tvoje Pecky o 1 poškodenie viac (nastrojeTuhe)
  telefon: "impl", // Dedičstvo (v10): tvoje Pohoršenia nemožno zrušiť Odporom a NA EX (partia.ts)
  jogurt: "impl", // Dedičstvo: tvoje Poldeci otáčajú vypitý poldeci hneď v Pitke (vyhodnotPitku)
  energetak: "impl", // Dedičstvo: tvoje Posilnenie nemožno zrušiť NA EX (partia.ts)
  horoskop: "impl", // Dedičstvo (v10): tvoje Povery majú silu 2 — mäkké (stranyBitky)
  furik: "impl", // Dedičstvo: tvoje Roboty pália o 1 Dlh viac (exekucieBitky)
  kristalova_gula: "impl", // Dedičstvo: Vízia ukáže 2 vrchné karty, jednu vezmi či spáľ, druhú vráť navrch (cmdVizia)
  profesionalny_tiper: "impl", // Furt: posilnené akcie na jeho spojoch — súperove posilnený Hazard, tvoje posilnená Robota (partia.ts)
  // Frakcie (Michal 2026-11-08, docs/napady/frakcie-final.json): Kšeft zanikol. Efekty „Spúšťač: Tag
  // {Akcia}“ vyhodnocuje jadro z textu (navyse.ts); staré efekty 14 kariet platia len pre staré sady.
  zberny_dvor: "impl", // Pitka (frakcie): na konci Pitky smie každý spáliť 1 kartu z ruky, nie kliatbu (zbernyDvor)
  zamocnik: "impl", // Furt: akcie nástrojov v okolí posilnené
  zivnostnik: "impl", // Nástup (v7): v tom istom ťahu smie za neho priložiť Nástroj z ruky (voľba nastroj)
  pes: "impl", // Furt (v7): aktívne akcie na spoji so súperovou kartou ×2 (partia.ts)
  kostol: "impl", // Zhromaždenie: nikto nevypije; Pitka (v11.7): NA EX len na poslednú kartu línie
  zahradkar: "impl", // Exekúcia (Michal 2026-10-28): v línii v tvojej partii ťa exekúcia v tomto kole obíde (zahradkarChrani)
  svokra: "impl", // Bitka: za každú tvoju kartu so súperovým NA EX súperovi Rana (Michal 2026-10-26)
  sarlatan: "impl", // Konflikt (v7): jeho Dlhy sú Viera a Povery Rana do konca kola (partia.ts)
  podvodnik: "impl", // Konflikt (v11.5): súper dá 1 cigaretu, bez cigarety 1 zadĺženie (engine konflikt)
  cierna_macka: "impl", // Furt (v8.3): tvoje Povery sa Vierou nerušia — vždy mäkké (computeDamage)
  anonymny_alkoholik: "impl", // Furt (v11.5): Poškodenie pečene tvojich kariet v jeho okolí sa ráta ako Viera (partia.ts)
  // Roadmapa #71 (2026-10-23).
  sofer: "impl", // Bitka (v11.5): bez NA EX v kole Pecka navyše (bitkaMody) a 1 cigareta (engine zacniBitku)
  snubenica: "impl", // Podpora (v11.3): z vlastného Chlapa vráti súperovo NA EX (podpora); do v11.2 Konflikt
  // Nové lokality (Michal 2026-10-20, docs/playtesty/navrh-lokality.html).
  most: "impl", // Zhromaždenie: karty len na vlastnú stranu
  cintorin: "impl", // Prehra (v11.13): porazený si smie vziať do ruky 1 kartu zo svojho odhadzovacieho balíčka (krok bitky cintorin)
  obecny_urad: "impl", // Pitka (v11.13): cigarety a Dlhy získané v Pitke sa rátajú dvakrát (nasobokPitky)
  jednota: "impl", // Pitka (v7): kto má viac priznaných Dlhov, nefajčí ani nedolieva
  kulturny_dom: "impl", // Bitka (v11.13): každý hráč dostane špaky len za svoje karty v línii, aj víťaz (spakyZaVyhru)
  vinna_pivnica: "impl", // Pitka: NA EX až dvakrát
  druzstvo: "impl", // Zhromaždenie (v11.13): karty s akciou Robota nemíňajú limit vykladania
  kar: "impl", // Pitka (v7): pečeň za NA EX dostane súper toho, kto ho dal (odhalNaex)
  // Sada v7 (revízia, Michal 2026-10-27) — schválené novinky, nové karty a lokality.
  vidly: "impl", // Dedičstvo (v7): Rany o 1 poškodenie viac (nastrojeTuhe)
  lievik: "impl", // Dedičstvo: NA EX aj na Zviera (naexCieleVLinii)
  krokodil: "impl", // Bitka (v7): na konci bitky spáli Občanov a Zvieratá v jeho okolí (koniecBitky)
  kapybara: "impl", // Nástup (v7): marker staršieho o 1 k stredu (voľba kapybara)
  kon: "impl", // Furt: Nástroj s ním tvorí spoj (partia.ts spojVznikne); v11.5 jeho Roboty pália o 1 Dlh viac (engine robotyKona)
  kohut: "impl", // Pitka (v7): posledné slovo pri odpovediach na NA EX má majiteľ (odhalNaex)
  degustatorka: "impl", // Nástup: súperovi s viac plnými poldeci otočí jeden na vypitý
  klebetnica: "impl", // Pitka (Bzdocha, Michal 2026-10-27): majiteľ hrá Pitku po súperovi a vidí jeho NA EX (zacniPitku, viewFor)
  dohadzovacka: "impl", // Nástup (Michal 2026-10-28): najvzdialenejší Občan opačného pohlavia ako jej sused z druhej strany sa presunie za ňu (presunDohadzovackou)
  vandal: "impl", // Nástup: otoč lokalitu o 180°
  stryko_z_ameriky: "native", // Nepriateľ: Autorita — 2 Rany navyše (navyse.ts)
  // Autority, kolo 2 (Michal 2026-11-02) — v sade ich pridá admin.
  polovnik: "impl", // Nástup: spáli súperovo Zviera na druhej strane, najďalej od lokality (spalPolovnikom)
  predavacka: "impl", // Podpora (frakcie): dober si 1 kartu (engine podpora)
  veducko: "impl", // Furt: Roboty susedných kariet sa rátajú ako Pecky (partia.ts robotaAkoPecka)
  masiar: "impl", // Furt (Michal 2026-10-28): efekty Zvierat v jeho okolí neplatia (partia.ts zvieratAUmlcane)
  kulturista: "impl", // Sypač, Podpora (v11.5): tvoj Chlap má do konca kola Rany ako Pecky (engine podpora, partia.ts ranyAkoPecky)
  traktoristka: "impl", // Bitka: s prevahou v jej kraji Pecka navyše, inak Dlh
  vymahac: "impl", // Bitka: za každé 2 priznané Dlhy Rana navyše
  sklad: "impl", // Zhromaždenie (frakcie): Nástroj zo šenku rovno do Dedičstva za cenu Dedičstva (zoSkladu)
  polovnicka_chata: "impl", // Furt: tuhé z hrán ×2 (partia.ts)
  predsedova_vila: "impl", // Pitka (frakcie): za každé 2 vyfajčené cigarety reči o stupeň (predsedovaVila)
  herna: "impl", // Bitka: víťaz + špaky za priznané Dlhy porazeného (vyplatSpaky)
};

export function jeEfektManual(defId: string): boolean {
  return (REGISTER[defId] ?? "manual") === "manual";
}

// ---------------------------------------------------------------------------
// Kde sa efekt nachádza a komu patrí

/** Lokalita aktuálneho kola. */
export function jeCielLokalita(state: Pick<VerejnyStav, "ciel">, defId: string): boolean {
  // Aj pinnacle vo finále (v7).
  return state.ciel?.lokalita?.defId === defId;
}

/**
 * Karty hráča p v línii — tie, ktoré zahral a sú natočené k nemu, v jeho aj
 * v súperovej partii. Akcie aj efekty karty patria jej majiteľovi; „tvoja
 * partia“ v texte karty znamená tvoje karty (pravidlá v3).
 */
export function partiaHraca(state: { readonly strany: VerejnyStav["strany"] }, p: PlayerId): PlacedCard[] {
  return [...state.strany[0], ...state.strany[1]].filter((pl) => pl.playedBy === p);
}

/**
 * Hráč p má v línii odkrytú kartu defId (natočenú k sebe, v ktorejkoľvek
 * partii). Skrytá Záverečná sa neráta — jej efekty mimo línie sa odložia na
 * otočenie, inak by ju prezradili (Michal 2026-10-23).
 */
export function vPartii(state: Pick<VerejnyStav, "strany">, p: PlayerId, defId: string): boolean {
  return partiaHraca(state, p).some((pl) => pl.card.defId === defId && pl.zaverecna !== true);
}

/**
 * Efekt Zvieraťa defId v partii hráča p platí: aspoň jedno odkryté také Zviera,
 * ktoré nesusedí s Mäsiarom (Michal 2026-10-28, zvieratAUmlcane).
 */
export function zvieraPlati(data: GameData, state: Pick<VerejnyStav, "strany" | "ciel">, p: PlayerId, defId: string): boolean {
  const umlcane = zvieratAUmlcane(data, { lokalita: state.ciel?.lokalita ?? null, strany: state.strany });
  return partiaHraca(state, p).some((pl) => pl.card.defId === defId && pl.zaverecna !== true && !umlcane.has(pl.card.uid));
}

export function vDedicstve(state: VerejnyStav, p: PlayerId, defId: string): boolean {
  return state.hraci[p].dedicstvo.some((k) => k.defId === defId);
}

/**
 * Efekt „patrí“ hráčovi p: je to jeho karta v línii alebo v jeho Dedičstve.
 * Prebudenie starších zaniklo (v9) — od v11.2 majú schopnosť väzňa.
 */
export function efektHraca(state: VerejnyStav, p: PlayerId, defId: string): boolean {
  return vPartii(state, p, defId) || vDedicstve(state, p, defId);
}

/**
 * Praudovravec: Autority v SÚPEROVEJ partii neuplatňujú efekt (Michal
 * 2026-10-18; predtým v tvojej). Kontroluje sa pri každom efekte karty
 * s tagom Autorita, ktorej majiteľom je hráč p.
 */
export function efektPotlaceny(data: GameData, state: Pick<VerejnyStav, "strany">, p: PlayerId, defId: string): boolean {
  const def = data.cards.get(defId);
  if (def === undefined || !def.tags.includes("Autorita" as Tag)) return false;
  // v7: Praudovravec je Dezinformátor (Odpor na jeho spojoch posilní, partia.ts) —
  // Autority už neumlčí. Umlčanie ostáva len pre sady s jeho starým textom.
  // Frakcie (2026-11-08): „Konflikt: Autorita“ je podmienka akcie navyše, nie umlčanie.
  const praudovravec = data.cards.get("praudovravec");
  return vPartii(state, opponentOf(p), "praudovravec") && praudovravec?.effectText.includes("Autorit") === true && efektyNavyse(praudovravec).length === 0;
}

/**
 * Zadĺženie z aktívnych akcií Dlh v línii, [hráč 0, hráč 1]. financna_poradkyna
 * (Michal 2026-10-18): Dlh z jej akcií dostáva súper, nie jej majiteľ. Jeden
 * výpočet pre Pitku (prirastkyPitky) aj náhľad vyloženia (nahladVylozenia) —
 * náhľad ho predtým pripísal majiteľovi (playtest 2026-10-22).
 */
export function zadlzenieZLinie(data: GameData, state: Pick<VerejnyStav, "strany">, vyhodnotenie: LineEval): readonly [number, number] {
  const poradkynaDlhy = [0, 0] as [number, number];
  for (const p of [0, 1] as const) {
    for (const placed of partiaHraca(state, p)) {
      if (placed.card.defId !== "financna_poradkyna" || efektPotlaceny(data, state, p, "financna_poradkyna")) continue;
      const ev = vyhodnotenie.cards.get(placed.card.uid);
      if (ev === undefined) continue;
      for (const strana of [ev.left, ev.right]) {
        for (const slot of strana) {
          if (slot?.action === "Dlh" && slot.stav === "aktivna") poradkynaDlhy[p] += slot.nasobok;
        }
      }
    }
  }
  const sums = vyhodnotenie.sums;
  const pre = (p: PlayerId): number => Math.max(0, (sums[p].Dlh ?? 0) - poradkynaDlhy[p]) + poradkynaDlhy[opponentOf(p)];
  return [pre(0), pre(1)];
}


/**
 * Policajtka (Pitka, „Pokutový blok“, Michal 2026-11-02): za každú súperovu akciu, ktorú v tejto
 * Pitke zruší tvoj Odpor, získa súper 1 zadĺženie — každá tvoja odkrytá Policajtka zvlášť.
 * Vráti zadĺženie pre [hráča 0, hráča 1]. Policajtka so starým Konfliktom (sada do v10.3) tu nie je.
 */
export function pokutaPolicajtky(data: GameData, s: Pick<VerejnyStav, "strany">, vyhodnotenie: LineEval): [number, number] {
  const out: [number, number] = [0, 0];
  if (data.cards.get("policajtka")?.triggers.includes("Pitka") !== true) return out;
  for (const p of [0, 1] as const) {
    const n = partiaHraca(s, p).filter((pl) => pl.card.defId === "policajtka" && pl.zaverecna !== true && !efektPotlaceny(data, s, p, "policajtka")).length;
    out[opponentOf(p)] += n * vyhodnotenie.zruseneOdporom[p];
  }
  return out;
}

/**
 * Celé zadĺženie, ktoré Pitka pripíše z kariet v línii: Dlh (aj presmerovaný Finančnou
 * poradkyňou) a pokuta Policajtky. Jeden výpočet pre Pitku (prirastkyPitky) aj náhľad
 * vyloženia — náhľad predtým pokutu Policajtky vynechal (vymyselník 2026-11-02).
 */
export function zadlzeniePitkyZLinie(data: GameData, state: Pick<VerejnyStav, "strany">, vyhodnotenie: LineEval): [number, number] {
  const zLinie = zadlzenieZLinie(data, state, vyhodnotenie);
  const pokuta = pokutaPolicajtky(data, state, vyhodnotenie);
  return [zLinie[0] + pokuta[0], zLinie[1] + pokuta[1]];
}

// ---------------------------------------------------------------------------
// Háčiky — motor ich volá na presne určených miestach

/** Prah Dlhu aj Cirhózy je v 2 na 2 o 1 vyšší (Michal 2026-10-28) — kliatby sú spoločné tímu. */
function prahNavyseFormatu(state: Pick<VerejnyStav, "format">): number {
  return state.format === "2na2" ? KONSTANTY.DVA_NA_DVA.PRAH_NAVYSE : 0;
}

/**
 * Prah Cirhózy navyše: nealko v Dedičstve hráča p (+2) a Krčma ako cieľ kola
 * (+2 obom — povinné NA EX tam už neznamená istú Cirhózu, Michal 2026-10-22).
 */
export function prahCirhozyBonus(state: VerejnyStav, p: PlayerId): number {
  return (
    prahNavyseFormatu(state) +
    (vDedicstve(state, p, "nealko") ? KONSTANTY.EFEKT.NEALKO_PRAH_CIRHOZY : 0) +
    (jeCielLokalita(state, "krcma") ? KONSTANTY.EFEKT.KRCMA_PRAH_CIRHOZY : 0)
  );
}

/** vinko: počíta sa ako nevypitý poldeci navyše (limit vykladania +1). */
export function limitBonus(state: VerejnyStav, p: PlayerId): number {
  return limitBonusDedicstva(state.hraci[p].dedicstvo);
}

/**
 * Bonus k limitu z Dedičstva samotného — engine aj plán ťahu ho porovnajú pred
 * a po vyložení, lebo Vínko vyložené v Zhromaždení platí hneď (návrh #26 B,
 * Michal 2026-10-28), nie až od ďalšieho Zhromaždenia.
 */
export function limitBonusDedicstva(dedicstvo: readonly { readonly defId: string }[]): number {
  return dedicstvo.some((k) => k.defId === "vinko") ? 1 : 0;
}

/** kostol: nikto nesmie vypiť (v Zhromaždení teda len jedna karta za ťah). */
export function zakazVypit(state: Pick<VerejnyStav, "ciel">): boolean {
  return jeCielLokalita(state, "kostol");
}

/**
 * Kostol (Pitka, v11.7, Michal 2026-11-06): NA EX len na poslednú kartu línie —
 * najďalej od Kostola, na jednej alebo druhej strane.
 */
export function naexLenNaKonci(line: { readonly lokalita: CardInstance | null }): boolean {
  return line.lokalita?.defId === "kostol";
}

/** Prečo hráč p teraz nesmie fajčiť, null = smie. Jednota: kto má viac priznaných Dlhov. */
export function dovodZakazuFajcit(_data: GameData, state: VerejnyStav, p: PlayerId): string | null {
  if (jednotaZakazuje(state, p)) return "Jednota: máš viac priznaných Dlhov — nesmieš fajčiť ani dolievať.";
  return null;
}

/** Benzínka (Pitka, v11.13): prvé fajčenie každého hráča v každej Pitke je zadarmo, ďalšie stoja ako inde. */
export function prveFajcenieZadarmo(state: Pick<VerejnyStav, "ciel">): boolean {
  return jeCielLokalita(state, "benzinka");
}

/**
 * Obecný úrad (Pitka, v11.13): koľkokrát sa rátajú cigarety a Dlhy získané v Pitke, z akcií aj
 * z efektov kariet. Platby, cigarety za pas a Dlhy mimo Pitky sa nenásobia.
 */
export function nasobokPitky(state: Pick<VerejnyStav, "ciel">): number {
  return jeCielLokalita(state, "obecny_urad") ? KONSTANTY.EFEKT.OBECNY_URAD_NASOBOK : 1;
}

/** Jednota (Pitka, v7): hráč s viac priznanými Dlhmi ako súper nesmie fajčiť ani dolievať. */
export function jednotaZakazuje(state: VerejnyStav, p: PlayerId): boolean {
  if (!jeCielLokalita(state, "jednota")) return false;
  return state.hraci[p].dlhy > state.hraci[opponentOf(p)].dlhy;
}

/** most: karty sa smú vykladať len na vlastnú stranu (aj odpoveď na NA EX). */
export function lenVlastnaStrana(lokalita: string | null): boolean {
  return lokalita === "most";
}

/** druzstvo (v11.13): karta s akciou Robota na ktorejkoľvek strane nemíňa limit vykladania. */
export function bezLimituDruzstva(lokalita: string | null, def: Pick<CardDef, "left" | "right">): boolean {
  return lokalita === "druzstvo" && ((def.left.actions.Robota ?? 0) > 0 || (def.right.actions.Robota ?? 0) > 0);
}

/** vinna_pivnica: koľko NA EX smie hráč dať za Pitku. */
export function naexZaPitku(state: VerejnyStav): number {
  return jeCielLokalita(state, "vinna_pivnica") ? 2 : 1;
}

/** Prah Dlhu hráča p (v7): Výherný automat v Dedičstve ho zvýši o 1. */
export function prahDlhuBonus(state: Pick<VerejnyStav, "hraci" | "format">, p: PlayerId): number {
  return prahNavyseFormatu(state) + (state.hraci[p].dedicstvo.some((k) => k.defId === "vyherny_automat") ? 1 : 0);
}

/** Kar (Pitka, v7): pečeň za NA EX dostane súper toho, kto ho dal. */
export function naexPecenSuperovi(state: Pick<VerejnyStav, "ciel">): boolean {
  return jeCielLokalita(state, "kar");
}

/** Verejný stav s poldeci hráčov — spĺňa ho GameState aj pohľad klienta. */
export interface StavPoldeci extends VerejnyStav {
  readonly hraci: readonly [VerejnyHrac & PoldeciHraca, VerejnyHrac & PoldeciHraca];
}
interface PoldeciHraca {
  readonly poldeciPlne: number;
  readonly poldeciVypite: number;
}

/**
 * Limit vykladania na začiatku Zhromaždenia tohto kola (PRAVIDLA §6) — pre
 * náhľad „limit po tomto ťahu“. `zmenaPoldeci` mení plné poldeci (−1 za
 * kartu zo šenku).
 */
export function limitZhromazdenia(state: StavPoldeci, p: PlayerId, zmenaPoldeci = 0): number {
  return limitVykladania({ poldeciPlne: Math.max(0, state.hraci[p].poldeciPlne + zmenaPoldeci) }) + limitBonus(state, p);
}

/**
 * Odhad limitu v ďalšom kole v poradí motora: poldeci na stole cez NA EX sa
 * pri bitke vypijú (vypiPoldeci), aktívne akcie Poldeci v línii otočia vypité
 * na plné a na začiatku kola sa dolejú (KONSTANTY.POLDECI_NA_ZACIATKU_KOLA).
 * Nevie o Krčmárke, doliatí cigaretami ani o budúcej Zastávke — ukazuje, s čím
 * hráč ráta, ak nič z toho nepríde. `naex` = dá teraz NA EX (na neznámu kartu;
 * kto ju pozná, pošle stav po NA EX a `naex` false). Akciu Poldeci ráta len
 * s dátami sady a so stavom, ktorý pozná otočenie lokality — predtým ju náhľad
 * vynechal a sľuboval limit o 1 nižší (playtest 20261026-173610-1).
 */
export function limitBuduceKolo(state: StavPoldeci & { readonly lokalitaOtocena?: boolean }, p: PlayerId, naex = false, data?: GameData): number {
  const h = state.hraci[p];
  // Zrážka NA EX (v5, Výtržník): druhý poldeci na karte je toho druhého hráča.
  const naStole = state.strany.flat().filter((pl) => pl.naexBy === p || pl.naexBy2 === p).length + (naex ? 1 : 0);
  const vypite = h.poldeciVypite + naStole;
  const otocia = data === undefined || state.lokalitaOtocena === undefined ? 0 : Math.min(vypite, akciePoldeci(data, state, state.lokalitaOtocena)[p]);
  const plne = h.poldeciPlne - (naex ? 1 : 0) + otocia;
  const dolieva = Math.min(KONSTANTY.POLDECI_NA_ZACIATKU_KOLA, vypite - otocia);
  return plne + dolieva + 1 + limitBonus(state, p);
}

/** Aktívne akcie Poldeci v línii — v bitke otočia toľko vypitých poldeci na plné (vypiPoldeci). */
function akciePoldeci(data: GameData, state: VerejnyStav, lokalitaOtocena: boolean): readonly [number, number] {
  const sums = evaluateLine(data, { lokalita: state.ciel?.lokalita ?? null, lokalitaOtocena, strany: state.strany }).sums;
  return [sums[0].Poldeci ?? 0, sums[1].Poldeci ?? 0];
}

/**
 * vinko: nemôžeš dolievať poldeci za cigarety (Michal 2026-10-19 — predtým
 * zakazovalo stokársky barter; ten je s Vínkom povolený).
 */
export function doliatieZakazane(state: GameState, p: PlayerId): boolean {
  return vDedicstve(state, p, "vinko");
}


/** Bitkové modifikátory závislé od kariet v hre. */
export interface BitkaMody {
  /** Dodatočné tuhé poškodenie hráča (Svokra, Pijan, Pasca, Lesná cesta, Ihrisko…). */
  readonly tuheBonus: number;
  /** Z čoho sa tuheBonus skladá — pre nápovedu v paneli bitky. */
  readonly tuheZdroje: readonly { readonly zdroj: string; readonly tuhe: number }[];
}

/**
 * svokra (Bitka, Michal 2026-10-26 — predtým kradla cigarety za NA EX): za
 * každú kartu hráča p so súperovým NA EX — na ktorejkoľvek strane, aj pri
 * zrážke (Výtržník) — dostane súper Ranu (+1 tuhé pre p). Poldeci z NA EX
 * ležia na kartách do kroku 5 bitky, takže sa rátajú rovno zo stola; každá
 * Svokra zvlášť. Autorita — súperov Praudovravec ju umlčí.
 */
export function svokraRany(data: GameData, state: VerejnyStav, p: PlayerId): number {
  if (!efektHraca(state, p, "svokra") || efektPotlaceny(data, state, p, "svokra")) return 0;
  const opp = opponentOf(p);
  const moje = partiaHraca(state, p);
  const svokry = Math.max(1, moje.filter((pl) => pl.card.defId === "svokra" && pl.zaverecna !== true).length);
  const sNaexSupera = moje.filter((pl) => pl.naexBy === opp || pl.naexBy2 === opp).length;
  return svokry * sNaexSupera * KONSTANTY.EFEKT.SVOKRA_RANY;
}

/**
 * Traktoristky hráča p, ktoré ležia v kraji, kde má prevahu (v7, Na leasing).
 * Vo finále bez lokality kraje nie sú — prevahu tam nemá nikto.
 */
export function traktoristkySPrevahou(data: GameData, state: Pick<VerejnyStav, "strany" | "ciel">, p: PlayerId): number {
  if (state.ciel?.lokalita == null) return 0;
  const prevaha = prevahaStran(data, state.strany);
  let n = 0;
  for (const strana of [0, 1] as const) {
    for (const pl of state.strany[strana]) if (pl.card.defId === "traktoristka" && pl.playedBy === p && pl.zaverecna !== true && prevaha[strana] === p) n++;
  }
  return n;
}

/** Traktoristky hráča p bez prevahy v ich kraji — každá mu v bitke dá Dlh. */
export function traktoristkyBezPrevahy(data: GameData, state: Pick<VerejnyStav, "strany" | "ciel">, p: PlayerId): number {
  const vsetky = partiaHraca(state, p).filter((pl) => pl.card.defId === "traktoristka" && pl.zaverecna !== true).length;
  return vsetky - traktoristkySPrevahou(data, state, p);
}

/** lievik (Dedičstvo, v7): NA EX smie hráč dať aj na Zviera. */
export function naexNaZviera(state: VerejnyStav, p: PlayerId): boolean {
  return vDedicstve(state, p, "lievik");
}

/**
 * Šoféri hráča p (odkrytí, v jeho partii), keď v tomto kole nedal NA EX — každý v bitke udelí
 * Pecku navyše (bitkaMody) a dá majiteľovi 1 cigaretu (v11.5, engine zacniBitku).
 */
export function soferiBezNaex(state: Pick<VerejnyStav, "strany" | "naexVKole">, p: PlayerId): number {
  if (state.naexVKole?.[p] === true) return 0;
  return partiaHraca(state, p).filter((pl) => pl.card.defId === "sofer" && pl.zaverecna !== true).length;
}

/**
 * Karta má efekt Bitka v zápise akcie navyše (skryté akcie, Michal 2026-11-08) — Rany a Pecky
 * ráta evaluateLine v súčtoch (zosilní ich Vidly a Valaška), nie bitkaMody. Starý text
 * karty platí ako tuhé navyše, kým admin nezapíše nový.
 */
export function bitkaVZapise(data: GameData, defId: string): boolean {
  const def = data.cards.get(defId);
  return def !== undefined && efektyNavyse(def).some((e) => e.spustac === "Bitka");
}

export function bitkaMody(data: GameData, state: VerejnyStav, p: PlayerId): BitkaMody {
  const opp = opponentOf(p);
  const tuheZdroje: { zdroj: string; tuhe: number }[] = [];
  const pridaj = (zdroj: string, tuhe: number): void => {
    if (tuhe > 0 && !bitkaVZapise(data, zdroj)) tuheZdroje.push({ zdroj, tuhe });
  };

  pridaj("svokra", svokraRany(data, state, p));
  const mojeKarty = partiaHraca(state, p).filter((pl) => pl.zaverecna !== true);
  // lesna_cesta (v11.13): 2 tuhé za každé svoje Zviera v línii, na ktorejkoľvek strane.
  if (jeCielLokalita(state, "lesna_cesta")) {
    pridaj("lesna_cesta", KONSTANTY.EFEKT.LESNA_CESTA_TUHE * mojeKarty.filter((pl) => defOf(data, pl.card).tags.includes("Zviera")).length);
  }
  const pocetKariet = (defId: string): number => mojeKarty.filter((pl) => pl.card.defId === defId).length;
  // sofer: bez NA EX v tomto kole udelí Pecku navyše (2 tuhé).
  pridaj("sofer", 2 * soferiBezNaex(state, p));
  // pijan (Bitka, v7): Rana navyše za každé NA EX majiteľa v tomto kole — poldeci z nich
  // ležia na kartách do kroku 5 bitky, takže sa rátajú zo stola ako pri Svokre.
  const naexMoje = [...state.strany[0], ...state.strany[1]].reduce((n, pl) => n + (pl.naexBy === p ? 1 : 0) + (pl.naexBy2 === p ? 1 : 0), 0);
  pridaj("pijan", pocetKariet("pijan") * naexMoje);
  // traktoristka (v7, Na leasing): s prevahou v jej kraji Pecka navyše; bez nej Dlh (engine, začiatok bitky).
  pridaj("traktoristka", 2 * traktoristkySPrevahou(data, state, p));
  // vymahac (v7): za každé 2 priznané Dlhy majiteľa 1 Rana navyše.
  pridaj("vymahac", pocetKariet("vymahac") * Math.floor(state.hraci[p].dlhy / 2));
  // pasca (Dedičstvo: Bitka, v7): súper v tomto kole priložil kartu k tvojej → Rana navyše
  // (v9.1 podľa textu karty v tvorcovi od sady v36; predtým Pecka).
  if (vDedicstve(state, p, "pasca") && (state.prilozeniaKu?.[p] ?? 0) > 0) pridaj("pasca", state.hraci[p].dedicstvo.filter((k) => k.defId === "pasca").length);
  // ihrisko (Michal 2026-10-20): v každom kraji +2 tuhé tomu, kto tam má viac svojich Občanov, Zvierat
  // a Starešinov — rátajú sa ako do prevahy, Dvojčatá za dve (v8, Michal 2026-10-28, návrh #32).
  if (jeCielLokalita(state, "ihrisko")) {
    for (const strana of state.strany) {
      const sila = silaVKraji(data, strana);
      if (sila[p] > sila[opp]) pridaj("ihrisko", KONSTANTY.EFEKT.IHRISKO_TUHE);
    }
  }

  return {
    tuheBonus: tuheZdroje.reduce((a, z) => a + z.tuhe, 0),
    tuheZdroje,
  };
}

/** Ako Nástroj v Dedičstve mení akciu hráča — verejné, Dedičstvo leží na stole. */
export interface VplyvNaAkciu {
  readonly akcia: Action;
  /** defId Nástroja v Dedičstve. */
  readonly zdroj: string;
  /** O koľko viac dá jedna taká akcia: poškodenie Petelice, Pecky či Rany, hodnota Viery, Dlhy Roboty. */
  readonly o: number;
  /** Zmena, ktorá nie je číslom (Zapaľovač: nemožno zrušiť NA EX) — veta do popisu ikony. */
  readonly popis?: string;
  /** Len na tejto karte v línii (Zámočník: Nástroje v jeho okolí); chýba = všetky karty hráča. */
  readonly uid?: number;
}

/**
 * Zámočník (Furt): aktívne akcie Nástrojov v jeho okolí (sused vľavo a vpravo v línii)
 * sa rátajú dvakrát (partia.ts kartoveEfekty) — žeravá ikona na tých Nástrojoch, aj na
 * súperových (Náradie 2026-10-30). Vplyv patrí majiteľovi Nástroja, len na jeho karte.
 */
function vplyvyZamocnika(data: GameData, state: Pick<VerejnyStav, "strany">, p: PlayerId): VplyvNaAkciu[] {
  const out: VplyvNaAkciu[] = [];
  for (const strana of state.strany) {
    strana.forEach((pl, i) => {
      if (pl.card.defId !== "zamocnik") return;
      for (const sused of [strana[i - 1], strana[i + 1]]) {
        if (sused === undefined || sused.playedBy !== p || !defOf(data, sused.card).tags.includes("Nástroj")) continue;
        const strany = printedSides(data, sused.card);
        const akcie = new Set([...strany.left, ...strany.right].filter((a): a is Action => a !== null));
        for (const akcia of akcie) out.push({ akcia, zdroj: "zamocnik", o: 0, popis: "Zámočník vedľa: aktívna akcia Nástroja sa ráta dvakrát", uid: sused.card.uid });
      }
    });
  }
  return out;
}

/** Nástroje, ktoré akciu menia inak než číslom (Náradie 2026-10-30) — žeravá ikona s vetou. */
const VPLYVY_BEZ_CISLA: readonly { readonly zdroj: string; readonly akcia: Action; readonly popis: string }[] = [
  { zdroj: "puska", akcia: "Petelica", popis: "prepojenú Petelicu namiesto zrušenia (Odpor, NA EX) udelí o 1 poškodenie menej" },
  { zdroj: "zapalovac", akcia: "Cigareta", popis: "aktívnu Cigaretu nemožno zrušiť NA EX" },
  { zdroj: "energetak", akcia: "Posilnenie", popis: "Posilnenie nemožno zrušiť NA EX" },
  { zdroj: "vyherne_zreby", akcia: "Dlh", popis: "Hazard je aktívny bez spoja, spojený neaktívny" },
  { zdroj: "pistalka", akcia: "Obmedzenie", popis: "Obmedzenie uberie aj cigarety za pas" },
  { zdroj: "hrable", akcia: "Odpor", popis: "akcia zrušená Odporom je tvoja a posilnená" },
  { zdroj: "zrkadlo", akcia: "Pakt", popis: "Pakt kopíruje prepojenú akciu dvakrát" },
  { zdroj: "telefon", akcia: "Pohoršenie", popis: "Pohoršenie nemožno zrušiť Odporom ani NA EX" },
  { zdroj: "jogurt", akcia: "Poldeci", popis: "Poldeci otočí vypitý poldeci hneď v Pitke" },
  { zdroj: "horoskop", akcia: "Povera", popis: "Povera má silu 2 (2 mäkké)" },
  { zdroj: "kristalova_gula", akcia: "Vízia", popis: "Vízia ukáže 2 vrchné karty" },
];

/**
 * Akcie hráča p posilnené Nástrojmi v jeho Dedičstve (§12): Boxer Pecky, Vidly Rany
 * (každý kus o 1 poškodenie), Svätý text Vieru, Fúrik Robotu; Puška a ostatné Náradie
 * menia akciu inak než číslom (popis). Jeden zdroj pre
 * bitku (nastrojeTuhe) aj pre žeravé ikony akcií na stole.
 */
export function vplyvyNaAkcie(state: Pick<VerejnyStav, "hraci"> & Partial<Pick<VerejnyStav, "strany">>, p: PlayerId, data?: GameData): readonly VplyvNaAkciu[] {
  const kusov = (defId: string): number => state.hraci[p].dedicstvo.filter((k) => k.defId === defId).length;
  const out: VplyvNaAkciu[] = [];
  if (kusov("boxer") > 0) out.push({ akcia: "Pecka", zdroj: "boxer", o: kusov("boxer") });
  if (kusov("vidly") > 0) out.push({ akcia: "Rana", zdroj: "vidly", o: kusov("vidly") });
  if (kusov("furik") > 0) out.push({ akcia: "Robota", zdroj: "furik", o: kusov("furik"), popis: `Robota spáli o ${kusov("furik")} Dlh viac (bez Dlhu špak)` });
  for (const v of VPLYVY_BEZ_CISLA) if (kusov(v.zdroj) > 0) out.push({ akcia: v.akcia, zdroj: v.zdroj, o: 0, popis: v.popis });
  if (data !== undefined && state.strany !== undefined) out.push(...vplyvyZamocnika(data, { strany: state.strany }, p));
  // Rovnako ako hodnotaViery v bitke (engine): druhý Svätý text Vieru nezvýši.
  if (kusov("svaty_text") > 0) out.push({ akcia: "Viera", zdroj: "svaty_text", o: KONSTANTY.EFEKT.SVATY_TEXT_VIERA });
  return out;
}

/**
 * Vidly a Valaška (Dedičstvo, v7, Náradie): každá aktívna Rana, resp. Pecka hráča p udelí
 * o 1 poškodenie viac — zo súčtov, teda aj akcie navyše (frakcie a skryté akcie Pijana,
 * Svokry, Vymáhača, Šoféra, Traktoristu a Pascy, Michal 2026-11-08). Tie isté karty so
 * starým textom dávajú tuhé navyše (bitkaMody) a Náradie ich nezosilní. Jeden výpočet pre
 * bitku aj rozpis poškodenia.
 */
export function nastrojeTuhe(state: VerejnyStav, p: PlayerId, sums: { readonly Rana?: number; readonly Pecka?: number; readonly Petelica?: number }): readonly { readonly zdroj: string; readonly tuhe: number }[] {
  const out: { zdroj: string; tuhe: number }[] = [];
  for (const v of vplyvyNaAkcie(state, p)) {
    if (v.uid !== undefined) continue;
    // Boxer (Náradie 2026-10-30): Pecky o 1 poškodenie viac, ako Puška pri Petelici.
    if (v.akcia !== "Rana" && v.akcia !== "Pecka" && v.akcia !== "Petelica") continue;
    const tuhe = v.o * (sums[v.akcia] ?? 0);
    if (tuhe > 0) out.push({ zdroj: v.zdroj, tuhe });
  }
  return out;
}
