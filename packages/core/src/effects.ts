// Register efektov kariet (M10).
//
// Žiadne DSL — jedna malá funkcia na kartu, zavesená na konkrétny háčik
// motora. Neimplementovaný efekt nie je blokujúci: karta beží v režime
// MANUAL — motor ju v správnej fáze pripomenie v logu a hráči ju vyhodnotia
// sami. Register MUSÍ pokrývať všetkých 51 id (kontroluje to test).

import type { Action, PlayerId, Tag } from "./types.ts";
import { opponentOf } from "./types.ts";
import type { GameData } from "./data.ts";
import { defOf } from "./data.ts";
import type { GameState } from "./engine.ts";
import type { ElderState } from "./elders.ts";
import { favourStarsieho, prebudenyPre, priazenHraca, priazenSila } from "./elders.ts";
import type { CardInstance } from "./types.ts";
import type { LineEval, PlacedCard } from "./partia.ts";
import { evaluateLine, prevahaStran, rataSaDoPrevahy, silaVKraji, zvieratAUmlcane } from "./partia.ts";
import { limitVykladania } from "./player.ts";
import { KONSTANTY } from "./constants.ts";

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
  /** Špaky (Vidly v7) — chýba v syntetických stavoch testov. */
  readonly spaky?: readonly [number, number];
  /** Hráč dal v tomto kole NA EX (Šofér v7). */
  readonly naexVKole?: readonly [boolean, boolean];
  /** Rany navyše kúpené Kšeftom v tomto kole (Strýko z Ameriky v7). */
  readonly kseftRany?: readonly [number, number];
  /** Povery navyše kúpené Kšeftom v tomto kole (Vychovávateľka v7). */
  readonly kseftPovery?: readonly [number, number];
  /** Koľkokrát súper v tomto kole priložil kartu ku karte hráča (Pasca v7). */
  readonly prilozeniaKu?: readonly [number, number];
}

export interface VerejnyHrac {
  readonly priznane: readonly CardInstance[];
  readonly dedicstvo: readonly CardInstance[];
}

/**
 * native — pravidlo zabudované priamo v motore (nie je čo pripomínať)
 * impl   — efekt implementovaný v tomto súbore cez háčiky motora
 * manual — bez implementácie; motor ho pripomína v logu
 */
export type EfektStatus = "native" | "impl" | "manual";

export const REGISTER: Readonly<Record<string, EfektStatus>> = {
  // Texty podľa tlačovej sady (docs/KartyAI_PrintFile_20260716). Zmenený text
  // karty v tvorcovi → skontroluj, či implementácia ešte sedí.
  autobusar: "impl", // Zhromaždenie (v7): súper, ktorý pasuje po majiteľovi, nedostane cigarety za pas (cmdPass)
  benzinka: "impl", // Pitka (v7): fajčí len hráč, ktorého Občan či Starešina leží najďalej od lokality (dovodZakazuFajcit)
  cigorky: "impl", // Dedičstvo: Pitka (v7): za každé 2 cigarety, ktoré súper vyfajčí, karta (cmdSmoke)
  kocovnik: "native", // Furt: jeho akcie sa počítajú hráčovi s prevahou v jeho kraji (Michal 2026-10-24; evaluateLine)
  cirhoza: "native", // Bitka: dodatočná rana od súpera (cirhozaBonus)
  dievcina_na_vydaj: "impl", // Prehra (v7): zahodí sa, súper získa Dlhy podľa jej aktívnych akcií (koniecBitky)
  dlh: "native", // Bitka: krok Exekútora
  farar: "impl", // Prehra (v7): víťaz získa zadĺženie za každú svoju aktívnu Poveru (koniecBitky)
  financna_poradkyna: "impl", // Pitka: Dlh z jej akcií dostáva súper, nie jej majiteľ (Michal 2026-10-18; spúšťač z Prestávky 2026-10-24)
  hasic: "impl", // Nástup: náhodná karta z odhadzovacieho — nechať v ruke, alebo vrátiť (príkaz hasic)
  hrobar: "impl", // Konflikt (v7): priložená karta je posledná na strane, po bitke z hry (konflikt)
  ihrisko: "impl", // Bitka: v každom kraji +2 tuhé tomu, kto tam má viac svojich Občanov, Zvierat a Starešinov (Michal 2026-10-20; Dvojčatá za dve, v8)
  krcma: "impl", // Pitka: s plným poldeci povinný NA EX (bez NA EX sa Pitka neskončí); prah Cirhózy +2
  krcmarka: "impl", // Pitka (v7): na NA EX majiteľa súper neodpovedá kartou (odhalNaex)
  lesna_cesta: "impl", // Bitka (v7): +1 tuhé za každé svoje Zviera v súperovom kraji
  liberal: "impl", // Pitka (v7): súper bez rovnováhy žien a chlapov získa 1 zadĺženie (prirastkyPitky)
  milujuca_manzelka: "impl", // Pitka (v7, M2): tvoje poškodenie pečene v Pitke −1 (prirastkyPitky)
  ministrant: "impl", // Nástup (v7): ak vyvolá Konflikt, jeho Viera sa do konca kola ráta ako Pecka (partia.ts)
  nealko: "impl", // Dedičstvo: tvoj prah Cirhózy je o 2 vyšší (prahCirhozyBonus)
  niekoho_stryna: "impl", // Pitka (v7, Stryná): kto v Pitke nedal NA EX, +1 pečeň (prirastkyPitky)
  noviny: "impl", // Dedičstvo: Prehra (Titulka, 2026-10-28): porazený +1 špak za každý Dlh víťaza navyše (spakyZaVyhru)
  pasca: "impl", // Dedičstvo: Bitka (v7): súper v kole priložil kartu k tvojej → Pecka navyše (bitkaMody)
  pijan: "impl", // Bitka (v7): Rana navyše za každé vlastné NA EX v kole (bitkaMody)
  policajtka: "impl", // Konflikt (v7): súper Dlh, za Kriminála namiesto toho 2 cigarety (konflikt)
  postarka: "impl", // Kšeft (v7): za 1 Dlh 1 karta
  praudovravec: "impl", // Furt (v7, Dezinformátor): Odpor na jeho spojoch posilní (partia.ts)
  dvojcata: "impl", // Furt: do prevahy sa rátajú za dvoch (partia.ts, Michal 2026-10-20)
  puska: "impl", // Dedičstvo (v7): Petelice o 1 poškodenie viac (nastrojeTuhe)
  recidivista: "impl", // Prehra (v7): po bitke sa vráti do ruky (koniecBitky)
  silna_nezavisla_zena: "impl", // Furt: akcie len s podporou dvoch chlapov
  starosta: "impl", // Nástup (v7): karta zo šenku (voľba senok)
  svaty_text: "impl", // Dedičstvo: Viera chráni pred mäkkým
  veterinar: "impl", // Pitka (v7): karty v jeho okolí nepridávajú pečeň (prirastkyPitky)
  veteran: "impl", // Furt: NA EX naňho aktívne akcie zdvojí (nezruší), neaktívne nezdvojí (partia.ts, Michal 2026-10-23)
  velmi_smutiaca_vdova: "impl", // Konflikt (v7): priložený Chlap ide po bitke z hry (konflikt)
  vestica: "impl", // Prehra: výmena kariet v balíčkoch
  vychovavatelka: "impl", // Kšeft (v7): za 2 cigarety Povera navyše v bitke
  vinko: "impl", // Dedičstvo: poldeci navyše; nedolieva poldeci za cigarety (Michal 2026-10-19)
  vyherny_automat: "impl", // Dedičstvo (v7): prah Dlhu +1, v poslednej Pitke kola 1 Dlh
  zastavka: "impl", // Zhromaždenie: spoločný limit vykladania — súčet limitov oboch (Michal 2026-10-20)
  zberny_dvor: "impl", // Kšeft: za cigaretu ľubovoľná karta z vlastného odhadzovacieho balíčka
  zamocnik: "impl", // Furt: akcie nástrojov v okolí posilnené
  zivnostnik: "impl", // Nástup (v7): v tom istom ťahu smie za neho priložiť Nástroj z ruky (voľba nastroj)
  abstak: "native", // Bitka: o ranu menej (−1 tuhé za kus)
  pes: "impl", // Furt (v7): aktívne akcie na spoji so súperovou kartou ×2 (partia.ts)
  kostol: "impl", // Zhromaždenie: nikto nevypije; Pitka (v7): NA EX len na kartu v kraji pri oltári
  zahradkar: "impl", // Exekúcia (Michal 2026-10-28): v línii v tvojej partii ťa exekúcia v tomto kole obíde (zahradkarChrani)
  svokra: "impl", // Bitka: za každú tvoju kartu so súperovým NA EX súperovi Rana (Michal 2026-10-26)
  sarlatan: "impl", // Konflikt (v7): jeho Dlhy sú Viera a Povery Rana do konca kola (partia.ts)
  podvodnik: "impl", // Prehra (v7): jeden tvoj priznaný Dlh prejde k súperovi
  cierna_macka: "impl", // Furt: tvoje Povery dávajú mäkké poškodenie aj bez súperových priznaných Dlhov
  anonymny_alkoholik: "impl", // Nástup (v7): prizná nepriznané Cirhózy z odhadzovacieho balíčka
  // Roadmapa #71 (2026-10-23).
  sofer: "impl", // Bitka (v7): bez NA EX v kole Pecka navyše (bitkaMody)
  snubenica: "impl", // Konflikt (v7): priložený Chlap ide po bitke k majiteľovi Snúbenice (konflikt)
  // Nové lokality (Michal 2026-10-20, docs/playtesty/navrh-lokality.html).
  most: "impl", // Zhromaždenie: karty len na vlastnú stranu
  cintorin: "impl", // Prehra (Michal 2026-10-27): Nástroj z ruky alebo zo šenku do Dedičstva zadarmo (krok bitky cintorin)
  obecny_urad: "impl", // Kšeft (v7): za 3 cigarety vlastný priznaný Dlh k súperovi
  jednota: "impl", // Pitka (v7): kto má viac priznaných Dlhov, nefajčí ani nedolieva
  kulturny_dom: "impl", // Bitka (v6): prebytok sa nerozdeľuje — držiteľ dostane toľko špakov
  vinna_pivnica: "impl", // Pitka: NA EX až dvakrát
  druzstvo: "impl", // Zhromaždenie: Pracujúci nemíňajú limit vykladania
  kar: "impl", // Pitka (v7): pečeň za NA EX dostane súper toho, kto ho dal (odhalNaex)
  // Sada v7 (revízia, Michal 2026-10-27) — schválené novinky, nové karty a lokality.
  vidly: "impl", // Dedičstvo (v7): Rany o 1 poškodenie viac (nastrojeTuhe)
  lievik: "impl", // Dedičstvo: NA EX aj na Zviera (naexCieleVLinii)
  krokodil: "impl", // Bitka (v7): na konci bitky z hry Občania a Zvieratá v jeho okolí (koniecBitky)
  kapybara: "impl", // Nástup (v7): marker staršieho o 1 k stredu (voľba kapybara)
  kon: "impl", // Furt: Nástroj s ním tvorí spoj (partia.ts spojVznikne)
  kohut: "impl", // Pitka (v7): posledné slovo pri odpovediach na NA EX má majiteľ (odhalNaex)
  degustatorka: "impl", // Nástup: súperovi s viac plnými poldeci otočí jeden na vypitý
  klebetnica: "impl", // Pitka (Bzdocha, Michal 2026-10-27): majiteľ hrá Pitku po súperovi a vidí jeho NA EX (zacniPitku, viewFor)
  dohadzovacka: "impl", // Nástup (Michal 2026-10-28): najvzdialenejší Občan opačného pohlavia ako jej sused z druhej strany sa presunie za ňu (presunDohadzovackou)
  vandal: "impl", // Nástup: otoč lokalitu o 180°
  stryko_z_ameriky: "impl", // Kšeft: za 2 cigarety Rana navyše v bitke kola
  masiar: "impl", // Furt (Michal 2026-10-28): efekty Zvierat v jeho okolí neplatia (partia.ts zvieratAUmlcane)
  kulturista: "impl", // Úplatok (v7): súper cigaretou zníži jeho útoky o stupeň (príkaz uplatok)
  traktoristka: "impl", // Bitka: s prevahou v jej kraji Pecka navyše, inak Dlh
  vymahac: "impl", // Bitka: za každé 2 priznané Dlhy Rana navyše
  sklad: "impl", // Kšeft: za cigaretu vrchná karta zo súperovho odhadzovacieho balíčka
  polovnicka_chata: "impl", // Furt: tuhé z hrán ×2 (partia.ts)
  predsedova_vila: "impl", // Kšeft: za 2 cigarety posun markera o 1
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
 * Efekt „patrí“ hráčovi p: je to jeho karta v línii, v jeho Dedičstve,
 * alebo je to prebudený starší vydesený hráčom p.
 */
export function efektHraca(state: VerejnyStav, p: PlayerId, defId: string): boolean {
  if (vPartii(state, p, defId) || vDedicstve(state, p, defId)) return true;
  return state.starsi.some((e) => e.karta.defId === defId && prebudenyPre(e) === p);
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
  return vPartii(state, opponentOf(p), "praudovravec") && data.cards.get("praudovravec")?.effectText.includes("Autorit") === true;
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
 * Liberál (Pitka, v7): súper, ktorého partia nemá rovnako žien a chlapov,
 * získa 1 zadĺženie za každého Liberála — [hráč 0, hráč 1]. Skrytá Záverečná sa
 * neráta. Pre Pitku (prirastkyPitky) aj náhľad vyloženia.
 */
export function liberalZadlzenie(data: GameData, state: Pick<VerejnyStav, "strany">): readonly [number, number] {
  const out: [number, number] = [0, 0];
  for (const p of [0, 1] as const) {
    const liberali = partiaHraca(state, p).filter((pl) => pl.card.defId === "liberal" && pl.zaverecna !== true).length;
    if (liberali === 0 || efektPotlaceny(data, state, p, "liberal")) continue;
    const opp = opponentOf(p);
    const jeho = partiaHraca(state, opp).filter((pl) => pl.zaverecna !== true).map((pl) => defOf(data, pl.card).tags);
    if (jeho.filter((t) => t.includes("Žena")).length !== jeho.filter((t) => t.includes("Chlap")).length) out[opp] += liberali;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Háčiky — motor ich volá na presne určených miestach

/**
 * Prah Cirhózy navyše: nealko v Dedičstve hráča p (+2) a Krčma ako cieľ kola
 * (+2 obom — povinné NA EX tam už neznamená istú Cirhózu, Michal 2026-10-22).
 */
export function prahCirhozyBonus(state: VerejnyStav, p: PlayerId): number {
  return (
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

/** zastavka (Michal 2026-10-20): obaja hráči majú spoločný limit vykladania — súčet ich limitov. */
export function spolocnyLimit(state: VerejnyStav): boolean {
  return jeCielLokalita(state, "zastavka");
}

/** kostol: nikto nesmie vypiť (v Zhromaždení teda len jedna karta za ťah). */
export function zakazVypit(state: Pick<VerejnyStav, "ciel">): boolean {
  return jeCielLokalita(state, "kostol");
}

/**
 * Kostol (Pitka, v7): NA EX len na kartu v kraji pri oltári — pri ľavej
 * vytlačenej hrane; s otočenou lokalitou je ten kraj pri strane hráča 1.
 * null = NA EX smie na obe strany.
 */
export function stranaOltara(line: { readonly lokalita: CardInstance | null; readonly lokalitaOtocena: boolean }): PlayerId | null {
  if (line.lokalita?.defId !== "kostol") return null;
  return line.lokalitaOtocena ? 1 : 0;
}

/** Najväčšia vzdialenosť hráčovho Občana či Starešinu od lokality (Benzínka); −1 = žiadny. */
function najdalej(data: GameData, state: Pick<VerejnyStav, "strany">, p: PlayerId): number {
  let max = -1;
  for (const strana of state.strany) {
    strana.forEach((pl, i) => {
      if (pl.playedBy !== p || pl.zaverecna === true) return;
      const tagy = defOf(data, pl.card).tags;
      if (tagy.includes("Občan") || tagy.includes("Starešina")) max = Math.max(max, i);
    });
  }
  return max;
}

/**
 * Prečo hráč p teraz nesmie fajčiť (v7), null = smie. Benzínka: len hráč,
 * ktorého Občan alebo Starešina leží najďalej od lokality — pri rovnosti nikto
 * (Michal 2026-10-27); skrytá Záverečná sa
 * neráta, inak by ju prezradila. Jednota: kto má viac priznaných Dlhov.
 */
export function dovodZakazuFajcit(data: GameData, state: VerejnyStav, p: PlayerId): string | null {
  const opp = opponentOf(p);
  if (jeCielLokalita(state, "benzinka") && najdalej(data, state, p) <= najdalej(data, state, opp)) {
    return "Benzínka: fajčiť smie len hráč, ktorého Občan alebo Starešina leží najďalej od lokality.";
  }
  if (jednotaZakazuje(state, p)) return "Jednota: máš viac priznaných Dlhov — nesmieš fajčiť ani dolievať.";
  return null;
}

/** Jednota (Pitka, v7): hráč s viac priznanými Dlhmi ako súper nesmie fajčiť ani dolievať. */
export function jednotaZakazuje(state: VerejnyStav, p: PlayerId): boolean {
  if (!jeCielLokalita(state, "jednota")) return false;
  const dlhy = (q: PlayerId): number => state.hraci[q].priznane.filter((k) => k.defId === "dlh").length;
  return dlhy(p) > dlhy(opponentOf(p));
}

/** most: karty sa smú vykladať len na vlastnú stranu (aj odpoveď na NA EX). */
export function lenVlastnaStrana(lokalita: string | null): boolean {
  return lokalita === "most";
}

/** druzstvo: karty s tagom Pracujúci nemíňajú limit vykladania. */
export function bezLimituPracujuci(lokalita: string | null, tagy: readonly Tag[]): boolean {
  return lokalita === "druzstvo" && tagy.includes("Pracujúci");
}

/** vinna_pivnica: koľko NA EX smie hráč dať za Pitku. */
export function naexZaPitku(state: VerejnyStav): number {
  return jeCielLokalita(state, "vinna_pivnica") ? 2 : 1;
}

/** Prah Dlhu hráča p (v7): Výherný automat v Dedičstve ho zvýši o 1. */
export function prahDlhuBonus(state: Pick<VerejnyStav, "hraci">, p: PlayerId): number {
  return state.hraci[p].dedicstvo.some((k) => k.defId === "vyherny_automat") ? 1 : 0;
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
  // Zastávka: spoločný limit oboch — súčet ich limitov.
  if (spolocnyLimit(state)) {
    return vlastnyLimitZhromazdenia(state, 0, p === 0 ? zmenaPoldeci : 0) + vlastnyLimitZhromazdenia(state, 1, p === 1 ? zmenaPoldeci : 0);
  }
  return vlastnyLimitZhromazdenia(state, p, zmenaPoldeci);
}

/** Limit hráča bez Zastávky — na Zastávke z neho platí pas (Michal 2026-10-22). */
export function vlastnyLimitZhromazdenia(state: StavPoldeci, p: PlayerId, zmenaPoldeci = 0): number {
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
  // Na zdravie „do dna“ (Alkoholik v5): poldeci z toľkých NA EX, aká je sila priazne, sa po bitke
  // vráti plný (vypiPoldeci) — bez dát sady sa priazeň nepozná, náhľad ju neráta.
  const vratia = data === undefined ? 0 : Math.min(naStole, silaDoDna(data, state, p));
  const vypite = h.poldeciVypite + naStole - vratia;
  const otocia = data === undefined || state.lokalitaOtocena === undefined ? 0 : Math.min(vypite, akciePoldeci(data, state, state.lokalitaOtocena)[p]);
  const plne = h.poldeciPlne - (naex ? 1 : 0) + vratia + otocia;
  const dolieva = Math.min(KONSTANTY.POLDECI_NA_ZACIATKU_KOLA, vypite - otocia);
  return plne + dolieva + 1 + limitBonus(state, p);
}

/** Aktívne akcie Poldeci v línii — v bitke otočia toľko vypitých poldeci na plné (vypiPoldeci). */
function akciePoldeci(data: GameData, state: VerejnyStav, lokalitaOtocena: boolean): readonly [number, number] {
  const sums = evaluateLine(data, { lokalita: state.ciel?.lokalita ?? null, lokalitaOtocena, strany: state.strany }).sums;
  return [sums[0].Poldeci ?? 0, sums[1].Poldeci ?? 0];
}

/** Sila priazne Alkoholika („do dna“) hráča p — koľko poldeci z jeho NA EX sa za kolo vráti plných. */
export function silaDoDna(data: GameData, state: Pick<VerejnyStav, "starsi">, p: PlayerId): number {
  const e = state.starsi.find((x) => favourStarsieho(data, x) === "ALKOHOLIK" && priazenHraca(x) === p);
  return e === undefined ? 0 : priazenSila(e);
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

export function bitkaMody(data: GameData, state: VerejnyStav, p: PlayerId): BitkaMody {
  const opp = opponentOf(p);
  const tuheZdroje: { zdroj: string; tuhe: number }[] = [];
  const pridaj = (zdroj: string, tuhe: number): void => {
    if (tuhe > 0) tuheZdroje.push({ zdroj, tuhe });
  };

  pridaj("svokra", svokraRany(data, state, p));
  // lesna_cesta (v7, Michal 2026-10-27): +1 tuhé za každé svoje Zviera v súperovom kraji, bez stropu (7.5 body 1–2).
  if (jeCielLokalita(state, "lesna_cesta")) {
    pridaj("lesna_cesta", state.strany[opp].filter((pl) => pl.playedBy === p && pl.zaverecna !== true && defOf(data, pl.card).tags.includes("Zviera")).length);
  }
  const mojeKarty = partiaHraca(state, p).filter((pl) => pl.zaverecna !== true);
  const pocetKariet = (defId: string): number => mojeKarty.filter((pl) => pl.card.defId === defId).length;
  // sofer (v7): bez NA EX v tomto kole udelí Pecku navyše (2 tuhé).
  if (state.naexVKole?.[p] !== true) pridaj("sofer", 2 * pocetKariet("sofer"));
  // pijan (Bitka, v7): Rana navyše za každé NA EX majiteľa v tomto kole — poldeci z nich
  // ležia na kartách do kroku 5 bitky, takže sa rátajú zo stola ako pri Svokre.
  const naexMoje = [...state.strany[0], ...state.strany[1]].reduce((n, pl) => n + (pl.naexBy === p ? 1 : 0) + (pl.naexBy2 === p ? 1 : 0), 0);
  pridaj("pijan", pocetKariet("pijan") * naexMoje);
  // traktoristka (v7, Na leasing): s prevahou v jej kraji Pecka navyše; bez nej Dlh (engine, začiatok bitky).
  pridaj("traktoristka", 2 * traktoristkySPrevahou(data, state, p));
  // vymahac (v7): za každé 2 priznané Dlhy majiteľa 1 Rana navyše.
  const dlhy = state.hraci[p].priznane.filter((k) => k.defId === "dlh").length;
  pridaj("vymahac", pocetKariet("vymahac") * Math.floor(dlhy / 2));
  // pasca (Dedičstvo: Bitka, v7): súper v tomto kole priložil kartu k tvojej → Pecka navyše.
  if (vDedicstve(state, p, "pasca") && (state.prilozeniaKu?.[p] ?? 0) > 0) pridaj("pasca", 2 * state.hraci[p].dedicstvo.filter((k) => k.defId === "pasca").length);
  // stryko_z_ameriky (Kšeft, v7): Rany kúpené v Pitkách tohto kola.
  pridaj("stryko_z_ameriky", state.kseftRany?.[p] ?? 0);
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
  /** O koľko viac dá jedna taká akcia: poškodenie Petelice či Rany, hodnota Viery. */
  readonly o: number;
}

/**
 * Akcie hráča p posilnené Nástrojmi v jeho Dedičstve (§12): Puška Petelice,
 * Vidly Rany (každý kus o 1 poškodenie), Svätý text Vieru. Jeden zdroj pre
 * bitku (nastrojeTuhe) aj pre žeravé ikony akcií na stole.
 */
export function vplyvyNaAkcie(state: Pick<VerejnyStav, "hraci">, p: PlayerId): readonly VplyvNaAkciu[] {
  const kusov = (defId: string): number => state.hraci[p].dedicstvo.filter((k) => k.defId === defId).length;
  const out: VplyvNaAkciu[] = [];
  if (kusov("puska") > 0) out.push({ akcia: "Petelica", zdroj: "puska", o: kusov("puska") });
  if (kusov("vidly") > 0) out.push({ akcia: "Rana", zdroj: "vidly", o: kusov("vidly") });
  // Rovnako ako hodnotaViery v bitke (engine): druhý Svätý text Vieru nezvýši.
  if (kusov("svaty_text") > 0) out.push({ akcia: "Viera", zdroj: "svaty_text", o: KONSTANTY.EFEKT.SVATY_TEXT_VIERA });
  return out;
}

/**
 * Puška a Vidly (Dedičstvo, v7): každá aktívna Petelica, resp. Rana hráča p
 * z vyložených akcií udelí o 1 poškodenie viac; Rany navyše z efektov kariet
 * (Svokra, Pijan, Vymáhač, Strýko) nie (Michal 2026-10-27). Jeden výpočet pre
 * bitku aj rozpis poškodenia.
 */
export function nastrojeTuhe(state: VerejnyStav, p: PlayerId, sums: { readonly Rana?: number; readonly Petelica?: number }): readonly { readonly zdroj: string; readonly tuhe: number }[] {
  const out: { zdroj: string; tuhe: number }[] = [];
  for (const v of vplyvyNaAkcie(state, p)) {
    if (v.akcia !== "Rana" && v.akcia !== "Petelica") continue;
    const tuhe = v.o * (sums[v.akcia] ?? 0);
    if (tuhe > 0) out.push({ zdroj: v.zdroj, tuhe });
  }
  return out;
}
