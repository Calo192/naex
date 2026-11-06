// Ukážka herného stola na snímky a UI inšpekciu (/hra/ukazka-stola, len správca):
// dva boti odohrajú partiu v prehliadači (to isté jadro ako server) a stôl ukáže
// zvolený okamih zo strany hráča ?ja=0|1 — bez živej partie a bez servera. Potom
// sa dá hrať ďalej, za súpera ťahá bot. Parametre:
//   ?seed=N        partia (predvolene 8), &lokalit=3|5|7 (predvolene 3)
//   &stop=finale   Zhromaždenie vo finále, keď v línii leží aspoň &karty=k kariet (3)
//   &stop=bitka    tesne pred k-tou bitkou (&i=k, od 0) — po načítaní ju bot dohrá,
//                  takže beží počítadlo a rekapitulácia
//   &stop=koniec   tesne pred koncom hry — posledný ťah sa dohrá po načítaní
//   &stop=suhrn    začiatok kola k-tej bitky (&i=k, od 0); po načítaní sa kolo rýchlo dohrá po bitku —
//                  po zavretí vyhodnotenia príde súhrn posunov starších
//                  &rucne=prebytok: bitka, po ktorej hráč ?ja rozdeľuje Nakladačku a súper hádku;
//                  &rucne=reci: súper Nakladačku, hráč ?ja hádku; len-prebytok, len-reci: hráč ?ja jedno,
//                  súper nič; oba: hráč ?ja oboje — dohrá sa len po hráčovo rozdelenie, to urobí hráč
//                  sám (k-ta taká bitka, hľadá sa aj v ďalších seedoch)
//   &stop=po-bitke súhrn po k-tej bitke (&i=k, od 0) hneď po načítaní — kolo sa dohrá po voľbu cieľa ďalšieho
//                  kola (súhrn krok po kroku na línii starších, R3)
//   &stop=zajatie  krok Nakladačka, v ktorom hráč ?ja smie zajať (v11.4): prvý starší sa ho bojí na červenej
//                  už pred Nakladačkou (v11.6) a Nakladačky je aspoň 8 — stôl ukáže pečiatku ZAJAŤ (stav sa na ukážku upraví)
//   &stop=presvedcenie  krok Reči, v ktorom hráč ?ja smie presvedčiť (v11.4): pri prvom staršom má strach 2,
//                  súper 3, hádka aspoň 10 — pečiatka PRESVEDČIŤ; &presvedceny=1 dá druhého staršieho
//                  presvedčeného súperom (značka pri staršom)
//   &stop=kolo     začiatok kola &i=k
//   &stop=draft    stavba šenku od kola &i=k (predvolene 2), hráč ?ja vyberá — po bitke s posunmi
//                  z prebytku (stopa v línii starších)
//   &stop=posuny   súper posúva starších po bitke, dohrá sa po stavbu šenku ďalšieho kola (hráč ?ja vyberá)
//   &stop=prebytok krok Nakladačka po bitke, keď ju na svoj strach rozdeľuje hráč ?ja (v11)
//   &stop=reci     krok Reči po bitke, keď hádku na svoje reči rozdeľuje hráč ?ja (&i=k: k-té také, od 0;
//                  v11, predtým stop=hadka a stop=pohorsenie — stále fungujú)
//   &stop=reci-super krok Reči, keď ich rozdeľuje súper (čakanie hráča ?ja; aj stop=hadka-super)
//   &pult=1        línia starších sa otvorí v rozložení Pult (mock 5) namiesto Teplomerov
//   &stop=posledna-pitka  posledná Pitka kola, hráč ?ja má prázdnu ruku a môže dať NA EX — súper
//                  odpovie a bitka sa vyhodnotí v jeho ťahu
//   &stop=vizia    Vízia: hráč ?ja rozhoduje o vrchnej karte balíčka (veľké okno, Michal 2026-11-02);
//                  &gula=1 mu dá do Dedičstva Krištáľovú guľu — okno ukáže dve karty
//   &stop=vestica  Veštica po prehratej bitke: hráč ?ja vyberá karty z oboch doberacích balíčkov; keď ju
//                  partia nemá, prvá prehratá bitka od 2. kola sa na ukážku prepne na krok Veštica (&vynut=0 nie)
//   &stop=pitka    Pitka od 2. kola, hrajú obaja naraz (cena fajčenia, nákupy na hrane stola)
//   &stop=bzdocha  ako pitka, hráč ?ja má v línii Bzdochu a súper už skončil so skrytým NA EX —
//                  stôl ukáže súperovu voľbu (Bzdocha, v7)
//   &stop=bzdocha-caka  ako pitka, hráč ?ja má Bzdochu a čaká, kým súper skončí Pitku
//   &stop=kseft    prvá Pitka, v ktorej hráč ?ja hrá: v línii Strýko z Ameriky, lokalita &lok=defId
//                  (predvolene predsedova_vila; sklad, obecny_urad, zberny_dvor), väzni &vazni=defId,…
//                  (predvolene hrobar,veterinar) — tlačidlá Kšeftov pod kartami a schopnosti väzňov (v11.2);
//                  na Strýkovi leží súperovo NA EX (Farár), súperov odhadzovací balíček nie je prázdny
//                  (Hrobár); &pouzite=defId,… tieto schopnosti väzňov sú už minuté
//   &stop=zaverecna koniec Pitky so súperovou Záverečnou lícom dole — po načítaní sa otočí;
//                  &dalsia=1 dohrá aj súperovu ďalšiu Záverečnú na tú istú stranu
//   &moment=typ    pečiatka momentu (napr. vyprask, zvrat) pri prvej dohranej bitke či Pitke — snímky
//                  pečiatky nad súhrnom; inak padajú momenty, ktoré vyberie jadro ako na serveri
//   &exekutor=1    hráčovi ?ja v prvej Pitke pridá 10 priznaných Dlhov (bar ukáže exekúciu v bitke)
//                  (voľba Záhradkára pri exekúcii)
//   &stop=autopas  ťah, po ktorom hra za hráča ?ja pasuje (nemá čo vyložiť) a súper vykladá ďalej —
//                  po načítaní sa dohrá, stôl ukáže okno „Pasuješ“ s dôvodmi (&i=k: k-tý taký, od 0);
//                  &kto=super: pasuje súper — hráč ?ja vidí pečiatku „nemá čo vyložiť“
//   &stop=nastroj  Zhromaždenie od 2. kola, hráč ?ja na ťahu — do ruky dostane Vidly
//                  a cigarety na Dedičstvo (tlačidlo „odkazujem“)
//   &stop=pecen    ako nastroj, ale do ruky dostane dvoch Pijanov a pečeň 2 — výstraha pečene
//                  pri vykladaní (štítok v ruke po kliku na +, miesto na stole pri ťahaní)
//   &stop=pecen-sused  ako pecen, ale do ruky dostane Silnú ženu a na koniec jeho strany príde Pijan
//                  v rozložení, v ktorom ona pridá Cirhózu — výstraha pri karte bez vlastnej Pečene
//   &stop=cigarety-pride  Pitka, v ktorej obom ešte príde prísun cigariet — čiarkované pečiatky na dlaždiciach
//   &stop=cigarety-dopad  ťah, po ktorom sa obom pohnú cigarety (výpalné, porazený…) — po načítaní sa dohrá
//                  a pečiatky krátko dopadnú; &zap=1: niekomu záporný rozdiel; &zdroj=pas: daný zdroj
//                  prísunu (NAZVY_ZDROJOV_PRISUNU); &i=k: k-tý taký ťah
//   &avatar=a,b    fotky hráča a súpera (id médií) namiesto iniciálok
//   &bot=0         súper po načítaní netiahne (snímka Pitky, v ktorej hrajú obaja naraz)
//   &zerava=1      žeravé ikony (Michal 2026-10-30): hráč ?ja má v Dedičstve Pušku a Vidly, súper
//                  Svätý text a Vidly; do ruky Hasič, Recidivista, Policajtka, Kulturista, do línie
//                  súperova Milujúca manželka a Pes
//   &hasic=1       v prvom Zhromaždení, keď je hráč ?ja na ťahu, mu dá Hasiča a pár kariet
//                  do odhadzovacieho balíčka a vyloží ho — stôl ukáže voľbu Hasiča; &hasic=prazdny:
//                  odhadzovací balíček prázdny, Hasič sa vyloží po načítaní — stôl ukáže hlásenie
//   &markery=i:s0.s1.r0.r1,… strach a reči i-teho staršieho (od 0): strach hráča 1 a 2, reči hráča 1 a 2
//                  (0–3; reči len nad strachom, inak 0) — snímky teplomerov a Pultu
//   &vazen=i:p,…   i-teho staršieho (od 0) zajme hráč p (0 / 1) — snímka väzňa s pečiatkou (R3)

import { useEffect, useMemo, useRef, useState } from "react";
import type { CardInstance, Command, Event, GameData, GameState, HistoriaLokalit, LokalitaVHistorii, PlacedCard, PlayerId, StavMomentov, Stupen, TypMomentu, Vazen } from "@naex/core";
import { MOMENTY, NOVE_MOMENTY, apply, applySPrisunom, nahladPitky, prisunZUdalosti, eventsFor, lokalityPreKlienta, novaHistoriaLokalit, zapisDoHistorie, momenty, moznostiNaex, mozeHrat, naTahu, obmedzMomenty, rngInt, rngSeed, sPrilozenou, setupGame, tahBota, viewFor, vystrahaPecene, opponentOf } from "@naex/core";
import { useSada } from "../lib/sada.tsx";
import { useHerneData } from "../stranky/Ukazky.tsx";
import { HernaPlocha } from "./HernaPlocha.tsx";
import { Momenty } from "./Momenty.tsx";
import { vzhladKarty } from "./HernaKarta.tsx";
import { mediaUrl } from "../lib/api.ts";
import type { HracInfo } from "./useHra.ts";
import { useStolNaSirku } from "./zariadenie.ts";
import { OtocTelefon } from "./OtocTelefon.tsx";
import { ULOZENY_REZIM_LINIE } from "./HernaPlocha.tsx";
import { zaciatokKola as zaciatokKolaSuhrnu } from "./krokySuhrnu.ts";

interface Krok {
  readonly stav: GameState;
  readonly cmd: Command;
  readonly kto: PlayerId;
  /** Ťah sa dohrá hneď za predošlým (dohranie celého kola pred bitkou). */
  readonly rychlo?: true;
}

interface Odohrane {
  readonly zaciatok: GameState;
  /** Ťahy, ktoré sa dohrajú po načítaní (bitka, koniec). */
  readonly dohraj: readonly Krok[];
  /** História lokalít k začiatku (súhrn lokality na nástenke) — ako ju skladá server. */
  readonly historia?: HistoriaLokalit;
  /** Začiatok kola s bitkou — súhrn po bitke sa ukáže hneď (stop=po-bitke). */
  readonly suhrn?: GameState;
}

const q = (): URLSearchParams => new URLSearchParams(window.location.search);

/** Strach a reči z parametra &markery=i:s0.s1.r0.r1,… (snímky teplomerov a Pultu). */
function sMarkermi(s: GameState, spec: string): GameState {
  const na = new Map<number, { strach: readonly [Stupen, Stupen]; reci: readonly [Stupen, Stupen] }>();
  const st = (x: number | undefined): Stupen => (x !== undefined && Number.isInteger(x) && x >= 0 && x <= 3 ? (x as Stupen) : 0);
  for (const cast of spec.split(",")) {
    const [i, m] = cast.split(":");
    const c = (m ?? "").split(".").map(Number);
    if (i === undefined || !Number.isInteger(Number(i))) continue;
    const strach: [Stupen, Stupen] = [st(c[0]), st(c[1])];
    const reci: [Stupen, Stupen] = [st(c[2]), st(c[3])];
    for (const p of [0, 1] as const) if (reci[p] <= strach[p]) reci[p] = 0;
    na.set(Number(i), { strach, reci });
  }
  if (na.size === 0) return s;
  return { ...s, starsi: s.starsi.map((e, i) => ({ ...e, ...(na.get(i) ?? {}) })) };
}

/** Starší z parametra &vazen=i:p,… idú do pivnice hráča p (i-ty v rade, od 0) — snímky väzňa (R3). */
function sVaznami(s: GameState, spec: string): GameState {
  let st = s;
  for (const cast of spec.split(",")) {
    const [i, p] = cast.split(":").map(Number);
    const e = s.starsi[i ?? -1];
    if (e === undefined || (p !== 0 && p !== 1)) continue;
    const vazen: Vazen = { elderId: e.elderId, hrac: p, poradie: st.vazni.length + 1, karta: e.karta, scorecard: e.scorecard, miesto: i ?? 0 };
    st = { ...st, starsi: st.starsi.filter((x) => x.elderId !== e.elderId), vazni: [...st.vazni, vazen] };
  }
  return st;
}

/** Hráčovi p dá do Dedičstva Krištáľovú guľu — Vízia ukáže dve vrchné karty. */
function sGulou(s: GameState, p: PlayerId): GameState {
  const gula: CardInstance = { uid: s.nextUid, defId: "kristalova_gula", leftLayout: 0, rightLayout: 0 };
  const h = { ...s.hraci[p], dedicstvo: [...s.hraci[p].dedicstvo, gula] };
  return { ...s, nextUid: s.nextUid + 1, hraci: p === 0 ? [h, s.hraci[1]] : [s.hraci[0], h] };
}

/**
 * Veštica na ukážku: bitka, ktorú hráč p prehral (súper rozdeľuje Nakladačku), sa prepne na krok
 * Veštica s hráčom p — Veštica v partii býva zriedka. Oba doberacie balíčky dostanú aj odhodené karty.
 */
function sVesticou(s: GameState, p: PlayerId): GameState {
  const b = s.bitkaStav;
  if (b === null) return s;
  const balicek = (h: GameState["hraci"][number]) => ({ ...h, doberaci: [...h.doberaci, ...h.odhadzovaci], odhadzovaci: [] });
  const hraci = [balicek(s.hraci[0]), balicek(s.hraci[1])] as unknown as GameState["hraci"];
  return { ...s, hraci, bitkaStav: { ...b, krok: "vestica", caka: p, vitaz: opponentOf(p), prebytokZostava: 0, vesticaHotova: false } };
}

/** Hráč p dostane do ruky Hasiča a pár kariet do odhadzovacieho balíčka (alebo ho má prázdny); `tah` Hasiča vyloží. */
function sHasicom(s: GameState, p: PlayerId, prazdny: boolean): { readonly stav: GameState; readonly tah: Command } {
  let uid = s.nextUid;
  const karta = (defId: string): CardInstance => ({ uid: uid++, defId, leftLayout: 0, rightLayout: 0 });
  const hasic = karta("hasic");
  const h = s.hraci[p];
  const novy = { ...h, ruka: [...h.ruka, hasic], odhadzovaci: prazdny ? [] : [...h.odhadzovaci, karta("cirhoza"), karta("ministrant"), karta("pijan")] };
  const stav: GameState = { ...s, nextUid: uid, hraci: p === 0 ? [novy, s.hraci[1]] : [s.hraci[0], novy] };
  return { stav, tah: { type: "place", uid: hasic.uid, target: "vlastna" } };
}

/**
 * Hráčovi p dá Bzdochu do línie (p čaká, kým súper skončí Pitku). Bez `caka` súper
 * dá skryté NA EX a Pitku skončí — p hrá po ňom a vidí ho.
 */
function sBzdochou(data: GameData, s: GameState, p: PlayerId, caka = false): GameState | null {
  const su = opponentOf(p);
  const bzdocha: CardInstance = { uid: s.nextUid, defId: "klebetnica", leftLayout: 0, rightLayout: 0 };
  const strany: GameState["strany"] = p === 0 ? [[...s.strany[0], { card: bzdocha, playedBy: p }], s.strany[1]] : [s.strany[0], [...s.strany[1], { card: bzdocha, playedBy: p }]];
  const t: GameState = { ...s, nextUid: s.nextUid + 1, strany };
  const pitka = t.pitkaStav;
  const ciel = moznostiNaex(data, t, su)[0];
  if (pitka === null || ciel === undefined) return null;
  if (caka) return { ...t, pitkaStav: { ...pitka, naTahu: su, bzdocha: p, hotovy: [false, false] } };
  const hotovy: [boolean, boolean] = [pitka.hotovy[0], pitka.hotovy[1]];
  hotovy[su] = true;
  return { ...t, pitkaStav: { ...pitka, naTahu: p, bzdocha: p, hotovy, skryteNaex: [...(pitka.skryteNaex ?? []), { hrac: su, uid: ciel }] } };
}

/** Hráčovi p dá do ruky Nástroj a cigarety aspoň na Dedičstvo — stôl ukáže voľbu „odkazujem“. */
function sNastrojom(s: GameState, p: PlayerId): GameState {
  const h = s.hraci[p];
  const vidly: CardInstance = { uid: s.nextUid, defId: "vidly", leftLayout: 0, rightLayout: 0 };
  const novy = { ...h, ruka: [...h.ruka, vidly], cigarety: Math.max(h.cigarety, s.dedicstvaVylozene + 3) };
  return { ...s, nextUid: s.nextUid + 1, hraci: p === 0 ? [novy, s.hraci[1]] : [s.hraci[0], novy] };
}

/** Výstraha pečene: hráčovi p dá do ruky dvoch Pijanov a pečeň tesne pod prahom Cirhózy. */
function sPecenou(s: GameState, p: PlayerId): GameState {
  const h = s.hraci[p];
  const pijani: CardInstance[] = [0, 1].map((i) => ({ uid: s.nextUid + i, defId: "pijan", leftLayout: 0, rightLayout: 0 }));
  const novy = { ...h, ruka: [...h.ruka, ...pijani], pecen: 2 };
  return { ...s, nextUid: s.nextUid + 2, hraci: p === 0 ? [novy, s.hraci[1]] : [s.hraci[0], novy] };
}

/** Výstraha pri karte bez vlastnej Pečene: prvé rozloženia Pijana a Silnej ženy, pri ktorých ona pridá hráčovi p Cirhózu. */
function sPecenouSuseda(data: GameData, s: GameState, p: PlayerId): GameState {
  const varianty = (defId: string): readonly [number, number][] => {
    const v = data.variants.get(defId);
    return (v?.left ?? []).flatMap((_, l) => (v?.right ?? []).map((_, r) => [l, r] as [number, number]));
  };
  const h = s.hraci[p];
  for (const [al, ar] of varianty("pijan")) {
    const pijan: PlacedCard = { card: { uid: s.nextUid, defId: "pijan", leftLayout: al, rightLayout: ar }, playedBy: p };
    const strana = [...s.strany[p], pijan];
    const strany: GameState["strany"] = p === 0 ? [strana, s.strany[1]] : [s.strany[0], strana];
    for (const [bl, br] of varianty("silna_nezavisla_zena")) {
      const zena: CardInstance = { uid: s.nextUid + 1, defId: "silna_nezavisla_zena", leftLayout: bl, rightLayout: br };
      const novy = { ...h, ruka: [...h.ruka, zena], pecen: 1 };
      const t: GameState = { ...s, nextUid: s.nextUid + 2, strany, hraci: p === 0 ? [novy, s.hraci[1]] : [s.hraci[0], novy] };
      const v = viewFor(data, t, p);
      if ((vystrahaPecene(data, v, sPrilozenou(data, v, p, zena, p))?.cirhozy[p] ?? 0) > 0) return t;
    }
  }
  return s;
}

/**
 * Kšefty v Pitke: hráčovi p dá do línie Strýka z Ameriky, lokalitu s Kšeftom (&lok, predvolene
 * Predsedova vila), väzňov zo starších (&vazni, predvolene Hrobár a Veterinár), Dlh, cigarety
 * a plné poldeci — každý Kšeft má tlačidlo pod svojou kartou.
 */
function sKseftami(s: GameState, p: PlayerId, lok: string, vazni: readonly string[], pouzite: readonly string[] = []): GameState {
  let uid = s.nextUid;
  const su = opponentOf(p);
  const stryko: CardInstance = { uid: uid++, defId: "stryko_z_ameriky", leftLayout: 0, rightLayout: 0 };
  const strany: [GameState["strany"][0], GameState["strany"][1]] = [[...s.strany[0]], [...s.strany[1]]];
  // Na Strýkovi leží súperovo NA EX — schopnosť Farára má čo odstrániť.
  strany[p] = [...strany[p], { card: stryko, playedBy: p, naexBy: su }];
  const zajati = s.starsi.filter((e) => vazni.includes(e.karta.defId));
  const noviVazni = zajati.map((e, i) => ({
    elderId: e.elderId,
    hrac: p,
    poradie: s.vazni.length + i + 1,
    karta: e.karta,
    scorecard: e.scorecard,
    miesto: s.starsi.indexOf(e),
    ...(pouzite.includes(e.karta.defId) ? { pouzita: true as const } : {}),
  }));
  const sOdh = s.hraci[su].odhadzovaci.length > 0 ? s.hraci[su] : { ...s.hraci[su], odhadzovaci: [{ uid: uid++, defId: "pijan", leftLayout: 0, rightLayout: 0 }, { uid: uid++, defId: "ministrant", leftLayout: 0, rightLayout: 0 }] };
  const h = { ...s.hraci[p], cigarety: Math.max(s.hraci[p].cigarety, 9), poldeciPlne: Math.max(s.hraci[p].poldeciPlne, 3), dlhy: Math.max(s.hraci[p].dlhy, 1) };
  const ciel = s.ciel === null || s.ciel.lokalita == null ? s.ciel : { ...s.ciel, lokalita: { ...s.ciel.lokalita, defId: lok } };
  return {
    ...s,
    nextUid: uid,
    strany,
    ciel,
    starsi: s.starsi.filter((e) => !zajati.includes(e)),
    vazni: [...s.vazni, ...noviVazni],
    hraci: p === 0 ? [h, sOdh] : [sOdh, h],
  };
}

/** Hráčovi p pridá priznané Dlhy — exekúcia v najbližšej bitke. */
function sExekuciou(s: GameState, p: PlayerId): GameState {
  const h = s.hraci[p];
  const novy = { ...h, dlhy: h.dlhy + 10 };
  return { ...s, hraci: p === 0 ? [novy, s.hraci[1]] : [s.hraci[0], novy] };
}

/** Žeravé ikony: Nástroje v Dedičstve oboch, karty s posilnenými akciami v ruke a línii. */
function sZeravou(s: GameState, p: PlayerId): GameState {
  let uid = s.nextUid;
  const karta = (defId: string): CardInstance => ({ uid: uid++, defId, leftLayout: 0, rightLayout: 0 });
  const su = opponentOf(p);
  const ja = { ...s.hraci[p], dedicstvo: [...s.hraci[p].dedicstvo, karta("puska"), karta("vidly")], ruka: [...s.hraci[p].ruka, karta("hasic"), karta("recidivista"), karta("policajtka"), karta("kulturista")] };
  const on = { ...s.hraci[su], dedicstvo: [...s.hraci[su].dedicstvo, karta("svaty_text"), karta("vidly")] };
  const strany: [GameState["strany"][0], GameState["strany"][1]] = [[...s.strany[0]], [...s.strany[1]]];
  strany[su] = [...strany[su], { card: karta("milujuca_manzelka"), playedBy: su }, { card: karta("pes"), playedBy: su }];

  return { ...s, nextUid: uid, strany, hraci: p === 0 ? [ja, on] : [on, ja] };
}

/** &rucne=…: kto čo po bitke rozdelí (ja = hráč ?ja, su = súper). */
const ROZDELENIA_UKAZKY: Readonly<Record<string, readonly string[]>> = {
  prebytok: ["ja:prebytok", "su:reci"],
  reci: ["su:prebytok", "ja:reci"],
  "len-prebytok": ["ja:prebytok"],
  "len-reci": ["ja:reci"],
  oba: ["ja:prebytok", "ja:reci"],
};

function tahy(data: GameData, s: GameState, rng: ReturnType<typeof rngSeed>, i: number): { cmd: Command; kto: PlayerId; rng: ReturnType<typeof rngSeed> } | null {
  const kto = naTahu(s);
  if (kto === null) return null;
  const [j, r] = rngInt(rng, 2 ** 31);
  return { cmd: tahBota(data, s, kto, j, { povaha: i % 2 === 0 ? "igor" : "chamtivy" }), kto, rng: r };
}

/** Ukážka zajatia (v11.4): hráča ja sa prvý starší bojí na červenej a Nakladačky je aspoň 8. */
function sZajatim(s: GameState, ja: PlayerId): GameState {
  const b = s.bitkaStav!;
  const starsi = s.starsi.map((e, i) => (i === 0 ? { ...e, strach: (ja === 0 ? [3, e.strach[1]] : [e.strach[0], 3]) as [Stupen, Stupen], reci: (ja === 0 ? [0, e.reci[1]] : [e.reci[0], 0]) as [Stupen, Stupen] } : e));
  return { ...s, starsi, bitkaStav: { ...b, prebytokZostava: Math.max(8, b.prebytokZostava) } };
}

/** Ukážka presvedčenia (v11.4): pri prvom staršom má hráč ja strach 2, súper 3; hádka aspoň 10. */
function sPresvedcenim(s: GameState, ja: PlayerId, druhyPresvedceny: boolean): GameState {
  const b = s.bitkaStav!;
  const su = opponentOf(ja);
  const strach = (moj: Stupen, jeho: Stupen): [Stupen, Stupen] => (ja === 0 ? [moj, jeho] : [jeho, moj]);
  const starsi = s.starsi.map((e, i) => {
    if (i === 0) return { ...e, strach: strach(2, 3), reci: [0, 0] as [Stupen, Stupen] };
    if (i === 1 && druhyPresvedceny) return { ...e, presvedcil: su };
    return e;
  });
  const hd = b.hadka!;
  const body = Math.max(10, hd.zostava);
  return { ...s, starsi, bitkaStav: { ...b, hadka: { ...hd, velkost: body, zostava: body } } };
}

function odohraj(data: GameData): Odohrane {
  const seed = Number(q().get("seed") ?? "8");
  const hlada = ["zaverecna", "reci", "reci-super", "hadka", "hadka-super", "pohorsenie", "vizia", "vestica", "cigarety-pride", "cigarety-dopad"].includes(q().get("stop") ?? "") || (q().get("stop") === "suhrn" && q().get("rucne") !== null);
  if (!hlada) return odohrajSeed(data, seed).odohrane;
  // Súperova Záverečná, hádka určitého víťaza, Vízia ani Veštica nepadnú v každej partii — skúša sa od zadaného seedu ďalej.
  for (let pokus = 0; pokus < 40; pokus++) {
    const x = odohrajSeed(data, seed + pokus);
    if (x.najdene) return x.odohrane;
  }
  return odohrajSeed(data, seed).odohrane;
}

function odohrajSeed(data: GameData, seed: number): { readonly odohrane: Odohrane; readonly najdene: boolean } {
  const p = q();
  const najdene = (odohrane: Odohrane) => ({ odohrane: { historia, ...odohrane }, najdene: true });
  const stop = p.get("stop") ?? "finale";
  const i = Number(p.get("i") ?? "0");
  const karty = Number(p.get("karty") ?? "3");
  const ja: PlayerId = p.get("ja") === "1" ? 1 : 0;
  let s = setupGame(data, seed, { lokalit: Number(p.get("lokalit") ?? "3") });
  let zaciatokKola = s;
  let historia = novaHistoriaLokalit(s);
  let historiaKola = historia;
  let tahyKola: Krok[] = [];
  let rng = rngSeed(seed ^ 0x5a);
  let bitiek = 0;
  let hadok = 0;
  let hadokSupera = 0;
  let autopasov = 0;
  let dopadov = 0;
  const autopasKto = p.get("kto") === "super" ? opponentOf(ja) : ja;
  const exekucia = p.get("exekutor") === "1";
  const hasic = p.get("hasic") === "1" || p.get("hasic") === "prazdny" ? p.get("hasic") : null;
  for (let n = 0; n < 8000 && s.koniec === null; n++) {
    if (hasic !== null && s.faza === "zhromazdenie" && naTahu(s) === ja) {
      const x = sHasicom(s, ja, hasic === "prazdny");
      // S prázdnym balíčkom sa Hasič vyloží až na stole, aby hráč videl hlásenie (pečiatku kroku).
      if (hasic === "prazdny") return najdene({ zaciatok: x.stav, dohraj: [{ stav: x.stav, cmd: x.tah, kto: ja }] });
      return najdene({ zaciatok: apply(data, x.stav, x.tah, ja).state, dohraj: [] });
    }
    if (exekucia && s.faza === "pitka") return najdene({ zaciatok: sExekuciou(s, ja), dohraj: [] });
    if (stop === "finale" && s.ciel?.typ === "finale" && s.faza === "zhromazdenie" && s.strany[0].length + s.strany[1].length >= karty && naTahu(s) === ja)
      return najdene({ zaciatok: s, dohraj: [] });
    if (stop === "nastroj" && s.kolo >= 2 && s.faza === "zhromazdenie" && naTahu(s) === ja && s.zhromazdenieStav?.pasoval[ja] === false)
      return najdene({ zaciatok: sNastrojom(s, ja), dohraj: [] });
    if (stop === "pecen" && s.kolo >= 2 && s.faza === "zhromazdenie" && naTahu(s) === ja && s.zhromazdenieStav?.pasoval[ja] === false)
      return najdene({ zaciatok: sPecenou(s, ja), dohraj: [] });
    if (stop === "pecen-sused" && s.kolo >= 2 && s.faza === "zhromazdenie" && naTahu(s) === ja && s.zhromazdenieStav?.pasoval[ja] === false)
      return najdene({ zaciatok: sPecenouSuseda(data, s, ja), dohraj: [] });
    if (stop === "kolo" && s.kolo === i && s.faza === "volbaCiela") return najdene({ zaciatok: s, dohraj: [] });
    if (stop === "draft" && s.kolo >= (p.get("i") === null ? 2 : i) && s.faza === "draft" && s.draftStav?.krok === "stavba" && s.draftStav.vyber[ja] === null)
      return najdene({ zaciatok: s, dohraj: [] });
    // Posledná Pitka kola: hráč ?ja dá NA EX, súper odpovie a hráč nemá čím (prázdna ruka) —
    // celé vyhodnotenie aj bitka prídu v jednom súperovom ťahu (hlásenie Michala 2026-10-28).
    if (
      stop === "posledna-pitka" &&
      s.kolo >= 2 &&
      s.faza === "pitka" &&
      s.pitkaCislo === s.pitkyCelkom &&
      s.pitkaStav !== null &&
      s.pitkaStav.reakcia === null &&
      s.vizia === null &&
      mozeHrat(s, ja) &&
      !s.pitkaStav.hotovy[opponentOf(ja)] &&
      moznostiNaex(data, s, ja).length > 0 &&
      s.hraci[opponentOf(ja)].ruka.length >= 2
    ) {
      const h = { ...s.hraci[ja], ruka: [] };
      return najdene({ zaciatok: { ...s, hraci: ja === 0 ? [h, s.hraci[1]] : [s.hraci[0], h] }, dohraj: [] });
    }
    if (stop === "prebytok" && s.faza === "bitka" && s.bitkaStav?.krok === "prebytok" && s.bitkaStav.caka === ja) return najdene({ zaciatok: s, dohraj: [] });
    if (stop === "zajatie" && s.faza === "bitka" && s.bitkaStav?.krok === "prebytok" && s.bitkaStav.caka === ja && s.ciel?.typ !== "finale") return najdene({ zaciatok: sZajatim(s, ja), dohraj: [] });
    if (stop === "presvedcenie" && s.faza === "bitka" && s.bitkaStav?.krok === "reci" && s.bitkaStav.caka === ja && s.ciel?.typ !== "finale")
      return najdene({ zaciatok: sPresvedcenim(s, ja, p.get("presvedceny") === "1"), dohraj: [] });
    // Súper rozdeľuje po bitke a stôl to vidí; dohrá sa po stavbu šenku ďalšieho kola, kde
    // vyberá hráč ?ja — starší ju nesmú zakryť (Michal 2026-10-30).
    const bsu = s.bitkaStav;
    if (stop === "posuny" && s.faza === "bitka" && bsu !== null && bsu.caka === opponentOf(ja) && (bsu.krok === "reci" || bsu.krok === "prebytok")) {
      const dohraj: Krok[] = [];
      let x = s;
      let r2 = rng;
      for (let k = 0; k < 400 && x.koniec === null; k++) {
        if (x.kolo > s.kolo && x.faza === "draft" && x.draftStav?.krok === "stavba" && x.draftStav.vyber[ja] === null) return najdene({ zaciatok: s, dohraj });
        const u = tahy(data, x, r2, n + 1 + k);
        if (u === null) break;
        r2 = u.rng;
        dohraj.push({ stav: x, cmd: u.cmd, kto: u.kto });
        x = apply(data, x, u.cmd, u.kto).state;
      }
    }
    if ((stop === "reci" || stop === "hadka" || stop === "pohorsenie") && s.faza === "bitka" && s.bitkaStav?.krok === "reci" && s.bitkaStav.caka === ja && (s.bitkaStav.hadka?.zostava ?? 0) > 0) {
      if (hadok++ === i) return najdene({ zaciatok: s, dohraj: [] });
    }
    if ((stop === "reci-super" || stop === "hadka-super") && s.faza === "bitka" && s.bitkaStav?.krok === "reci" && s.bitkaStav.caka === opponentOf(ja) && (s.bitkaStav.hadka?.zostava ?? 0) > 0) {
      if (hadokSupera++ === i) return najdene({ zaciatok: s, dohraj: [] });
    }
    if (stop === "vizia" && s.vizia !== null && naTahu(s) === ja && s.hraci[ja].doberaci.length >= 2)
      return najdene({ zaciatok: p.get("gula") === "1" ? sGulou(s, ja) : s, dohraj: [] });
    if (stop === "vestica" && s.faza === "bitka" && s.bitkaStav?.krok === "vestica" && s.bitkaStav.caka === ja) return najdene({ zaciatok: s, dohraj: [] });
    // Bez Veštice v partii: prvá prehratá bitka od 2. kola (balíčky už nie sú prázdne) sa na ukážku prepne na ňu.
    if (stop === "vestica" && p.get("vynut") !== "0" && s.kolo >= 2 && s.faza === "bitka" && s.bitkaStav?.krok === "prebytok" && s.bitkaStav.caka === opponentOf(ja))
      return najdene({ zaciatok: sVesticou(s, ja), dohraj: [] });
    if (stop === "cigarety-pride" && s.faza === "pitka" && mozeHrat(s, ja) && s.pitkaStav?.reakcia === null && s.vizia === null && nahladPitky(data, s).every((n) => n.cigarety.zisk > 0))
      return najdene({ zaciatok: s, dohraj: [] });
    if (stop === "pitka" && s.kolo >= 2 && s.faza === "pitka" && mozeHrat(s, ja) && s.pitkaStav?.hotovy[opponentOf(ja)] === false && s.pitkaStav.reakcia === null && s.vizia === null && s.hraci[ja].cigarety >= 1)
      return najdene({ zaciatok: s, dohraj: [] });
    if (stop === "kseft" && s.faza === "pitka" && s.ciel?.lokalita != null && mozeHrat(s, ja) && s.pitkaStav?.reakcia === null && !s.pitkaStav.hotovy[ja] && s.vizia === null) {
      const vazni = (p.get("vazni") ?? "hrobar,veterinar").split(",").filter((x) => x !== "");
      const pouzite = (p.get("pouzite") ?? "").split(",").filter((x) => x !== "");
      return najdene({ zaciatok: sKseftami(s, ja, p.get("lok") ?? "predsedova_vila", vazni, pouzite), dohraj: [] });
    }
    const bzdochaStop = stop === "bzdocha" || stop === "bzdocha-caka";
    if (bzdochaStop && s.faza === "pitka" && s.pitkaStav !== null && s.pitkaStav.reakcia === null && s.vizia === null && !s.pitkaStav.hotovy[0] && !s.pitkaStav.hotovy[1]) {
      const b = sBzdochou(data, s, ja, stop === "bzdocha-caka");
      if (b !== null) return najdene({ zaciatok: b, dohraj: [] });
    }
    if (s.faza === "volbaCiela" && s.kolo !== zaciatokKola.kolo) {
      zaciatokKola = s;
      historiaKola = historia;
      tahyKola = [];
    }
    const t = tahy(data, s, rng, n);
    if (t === null) break;
    rng = t.rng;
    const { state: po, events } = applySPrisunom(data, s, t.cmd, t.kto);
    if (stop === "cigarety-dopad") {
      const [a, b] = prisunZUdalosti(events);
      const zdroj = p.get("zdroj");
      const trafil =
        zdroj !== null
          ? [a, b].some((x) => x?.riadky.some((r) => r.zdroj === zdroj) === true)
          : p.get("zap") === "1"
            ? (a?.suma ?? 0) < 0 || (b?.suma ?? 0) < 0
            : (a?.suma ?? 0) !== 0 && (b?.suma ?? 0) !== 0;
      if (trafil && dopadov++ === i) return najdene({ zaciatok: s, dohraj: [{ stav: s, cmd: t.cmd, kto: t.kto }] });
    }
    const bitka = events.some((e) => e.type === "bitkaVysledok");
    const autopas = po.faza === "zhromazdenie" && events.some((e) => e.type === "autoPas" && e.hrac === autopasKto);
    if (stop === "autopas" && autopas && autopasov++ === i) return najdene({ zaciatok: s, dohraj: [{ stav: s, cmd: t.cmd, kto: t.kto }] });
    // Súhrn po bitke hneď (R3, návrh c): kolo sa dohrá po voľbu cieľa ďalšieho kola bez prehrávania.
    if (stop === "po-bitke" && bitka && bitiek++ === i) {
      let x = po;
      let r2 = rng;
      for (let k = 0; k < 200 && x.koniec === null && !(x.kolo > s.kolo && x.faza === "volbaCiela"); k++) {
        const u = tahy(data, x, r2, n + 1 + k);
        if (u === null) break;
        r2 = u.rng;
        x = apply(data, x, u.cmd, u.kto).state;
      }
      return najdene({ zaciatok: x, dohraj: [], suhrn: zaciatokKola });
    }
    const rucne = p.get("rucne");
    if (stop === "suhrn" && bitka && rucne !== null) {
      // Kto čo rozdelí, ukáže dohranie kola botmi; hráč ?ja potom svoje rozdelí sám.
      const dohraj: Krok[] = [...tahyKola, { stav: s, cmd: t.cmd, kto: t.kto }];
      const delenia = new Set<string>();
      let pred: number | null = null;
      let x = po;
      let r2 = rng;
      for (let k = 0; k < 60 && x.koniec === null && x.kolo === s.kolo; k++) {
        const u = tahy(data, x, r2, n + 1 + k);
        if (u === null) break;
        r2 = u.rng;
        if (u.cmd.type === "prebytok" || u.cmd.type === "reci") {
          delenia.add(`${u.kto === ja ? "ja" : "su"}:${u.cmd.type}`);
          if (u.kto === ja && pred === null) pred = dohraj.length;
        }
        dohraj.push({ stav: x, cmd: u.cmd, kto: u.kto });
        x = apply(data, x, u.cmd, u.kto).state;
      }
      const chcem = ROZDELENIA_UKAZKY[rucne] ?? ROZDELENIA_UKAZKY.prebytok!;
      if (pred !== null && chcem.length === delenia.size && chcem.every((d) => delenia.has(d)) && bitiek++ === i) return najdene({ zaciatok: zaciatokKola, dohraj: dohraj.slice(0, pred), historia: historiaKola });
    }
    if (stop === "suhrn" && bitka && rucne === null && bitiek++ === i) {
      // Za bitkou aj rozdeľovanie Nakladačky, kým kolo neskončí — súhrn ho má ukázať.
      const dohraj: Krok[] = [...tahyKola, { stav: s, cmd: t.cmd, kto: t.kto }];
      let x = po;
      let r2 = rng;
      for (let k = 0; k < 60 && x.koniec === null && x.kolo === s.kolo; k++) {
        const u = tahy(data, x, r2, n + 1 + k);
        if (u === null) break;
        r2 = u.rng;
        dohraj.push({ stav: x, cmd: u.cmd, kto: u.kto });
        x = apply(data, x, u.cmd, u.kto).state;
      }
      return najdene({ zaciatok: zaciatokKola, dohraj, historia: historiaKola });
    }
    tahyKola.push({ stav: s, cmd: t.cmd, kto: t.kto, rychlo: true });
    if (stop === "bitka" && bitka && bitiek++ === i) return najdene({ zaciatok: s, dohraj: [{ stav: s, cmd: t.cmd, kto: t.kto }] });
    if (stop === "koniec" && po.koniec !== null) return najdene({ zaciatok: s, dohraj: [{ stav: s, cmd: t.cmd, kto: t.kto }] });
    const superova = s.strany.findIndex((strana) => strana.some((pl) => pl.zaverecna === true && pl.playedBy !== ja));
    // S &dalsia=1 len na hráčovej strane — tak ako v hlásení Michala 2026-10-27.
    if (stop === "zaverecna" && superova >= 0 && (p.get("dalsia") !== "1" || superova === ja) && s.faza === "pitka" && po.faza === "zhromazdenie") {
      const dohraj: Krok[] = [{ stav: s, cmd: t.cmd, kto: t.kto }];
      if (p.get("dalsia") !== "1") return najdene({ zaciatok: s, dohraj });
      // Ďalej až po súperovu novú Záverečnú na tú istú stranu; inak sa ukážka hľadá ďalej.
      let x = po;
      let r2 = rng;
      for (let k = 0; k < 40 && x.faza === "zhromazdenie"; k++) {
        const u = tahy(data, x, r2, n + 1 + k);
        if (u === null) break;
        r2 = u.rng;
        dohraj.push({ stav: x, cmd: u.cmd, kto: u.kto });
        x = apply(data, x, u.cmd, u.kto).state;
        if (x.strany[superova]?.some((pl) => pl.zaverecna === true && pl.playedBy !== ja)) return najdene({ zaciatok: s, dohraj });
      }
    }
    historia = zapisDoHistorie(historia, s, t.cmd, t.kto, po, events);
    s = po;
  }
  return { odohrane: { zaciatok: s, dohraj: [], historia }, najdene: !["zaverecna", "vizia", "vestica", "cigarety-pride", "cigarety-dopad"].includes(stop) && !(stop === "suhrn" && p.get("rucne") !== null) };
}

export function UkazkaStola() {
  const { sada } = useSada();
  if (sada === null) return <p className="tlmene">Načítavam sadu…</p>;
  return <Ukazka sada={sada} />;
}

function Ukazka({ sada }: { readonly sada: NonNullable<ReturnType<typeof useSada>["sada"]> }) {
  const data = useHerneData(sada);
  const ja: PlayerId = q().get("ja") === "1" ? 1 : 0;
  const odohrane = useMemo(() => {
    const o = odohraj(data);
    const mk = q().get("markery");
    const sM0 = mk === null ? o : { ...o, zaciatok: sMarkermi(o.zaciatok, mk) };
    const vz = q().get("vazen");
    const sM = vz === null ? sM0 : { ...sM0, zaciatok: sVaznami(sM0.zaciatok, vz) };
    // Rozloženie línie starších sa pamätá v prehliadači — &pult=1 ho prepne pred prvým kreslením.
    if (q().get("pult") !== null) localStorage.setItem(ULOZENY_REZIM_LINIE, q().get("pult") === "1" ? "pult" : "teplomery");
    return q().get("zerava") === "1" ? { ...sM, zaciatok: sZeravou(sM.zaciatok, ja) } : sM;
  }, [data]);
  const [stav, setStav] = useState<GameState>(odohrane.zaciatok);
  // História lokalít ako na serveri — súhrn lokality po kliku na nástenke.
  const historia = useRef<HistoriaLokalit>(odohrane.historia ?? novaHistoriaLokalit(odohrane.zaciatok));
  const [lokality, setLokality] = useState<readonly LokalitaVHistorii[]>(() => lokalityPreKlienta(historia.current));
  // Ukážka je len pre správcu — na telefóne na šírku ukáže stôl „Pult“ ako partia (Michal 2026-10-31).
  const { naSirku, otoc } = useStolNaSirku(true);
  const [udalosti, setUdalosti] = useState<{ readonly id: number; readonly events: readonly Event[] }>({ id: 0, events: [] });
  const rng = useRef(rngSeed(Number(q().get("seed") ?? "8") ^ 0x77));
  // Kým sa nedohrá zastavená bitka či koniec, bot za súpera neťahá — inak by ťah predbehol dohranie.
  const [dohrate, setDohrate] = useState(odohrane.dohraj.length === 0);

  // Pečiatky momentov ako na serveri (momenty + strop); &moment=typ vynúti jednu pri prvej bitke či konci Pitky.
  const stavMomentov = useRef<StavMomentov>(NOVE_MOMENTY);
  const vynuteny = useRef(q().get("moment") as TypMomentu | null);
  const [suhrn, setSuhrn] = useState(false);
  const pouzi = (s: GameState, cmd: Command, kto: PlayerId): GameState => {
    try {
      const vysledok = applySPrisunom(data, s, cmd, kto);
      const state = vysledok.state;
      const events = vysledok.events;
      historia.current = zapisDoHistorie(historia.current, s, cmd, kto, state, events);
      setLokality(lokalityPreKlienta(historia.current));
      const strop = obmedzMomenty(momenty(data, s, state, events), stavMomentov.current, state);
      stavMomentov.current = strop.stav;
      const typ = vynuteny.current;
      const koniecPitky = events.some((e) => e.type === "bitkaVysledok") || (s.faza === "pitka" && state.faza !== "pitka");
      const pecate = typ !== null && typ in MOMENTY && koniecPitky ? [{ typ, ...MOMENTY[typ], hrac: 0 as PlayerId, popis: `${MOMENTY[typ].nazov} — ukážka pečiatky nad súhrnom.` }] : strop.vybrane;
      if (typ !== null && koniecPitky) vynuteny.current = null;
      setUdalosti((u) => ({ id: u.id + 1, events: [...eventsFor(events, ja), ...pecate.map((moment): Event => ({ type: "moment", moment }))] }));
      return state;
    } catch (e) {
      console.error(e);
      return s;
    }
  };

  // Dohranie bitky či konca po načítaní — stôl uvidí prechod (počítadlo, rekapitulácia, okno konca).
  useEffect(() => {
    if (odohrane.dohraj.length === 0) return;
    // Ťah po ťahu s pauzou ako bot na serveri — každý krok má vlastné udalosti (rekapitulácia
    // Pitky, súperova ďalšia Záverečná, kým rekapitulácia ešte svieti).
    let s = odohrane.zaciatok;
    let kedy = 500;
    const casovace = odohrane.dohraj.map((k, i) => {
      kedy += k.rychlo === true ? 40 : 700;
      return setTimeout(() => {
        s = pouzi(s, k.cmd, k.kto);
        setStav(s);
        if (i === odohrane.dohraj.length - 1) setDohrate(true);
      }, kedy);
    });
    return () => casovace.forEach(clearTimeout);
  }, [odohrane]);

  // Za súpera ťahá bot.
  useEffect(() => {
    const kto = opponentOf(ja);
    if (!dohrate || !mozeHrat(stav, kto) || q().get("bot") === "0") return;
    const t = setTimeout(() => {
      const [j, r] = rngInt(rng.current, 2 ** 31);
      rng.current = r;
      setStav((s) => (mozeHrat(s, kto) ? pouzi(s, tahBota(data, s, kto, j, { povaha: "igor" }), kto) : s));
    }, 700);
    return () => clearTimeout(t);
  }, [stav, ja, data, dohrate]);

  const view = useMemo(() => viewFor(data, stav, ja), [data, stav, ja]);
  const ukazkaSuhrnu = useMemo(() => (odohrane.suhrn === undefined ? undefined : zaciatokKolaSuhrnu(viewFor(data, odohrane.suhrn, ja))), [odohrane, data, ja]);
  // &avatar=<id médiá hráča>,<id médiá súpera> — snímky avatarov s fotkou (prstenec vo farbe hráča).
  const [avJa = null, avSu = null] = q().get("avatar")?.split(",") ?? [];
  const hraci: readonly [HracInfo, HracInfo] = ja === 0
    ? [{ meno: "Jano", avatar: avJa }, { meno: "Igor", avatar: avSu, bot: true, profil: "ziadny" }]
    : [{ meno: "Igor", avatar: avSu, bot: true, profil: "ziadny" }, { meno: "Jano", avatar: avJa }];
  return (
    <>
    {otoc && <OtocTelefon />}
    <HernaPlocha
      ukazkaSuhrnu={ukazkaSuhrnu}
      naSirku={naSirku}
      view={view}
      data={data}
      sada={sada}
      hraci={hraci}
      log={[]}
      udalosti={udalosti}
      lokality={lokality}
      chyba={null}
      superPripojeny
      kod="ukážka"
      cmd={(c) => setStav((s) => pouzi(s, c, ja))}
      opustit={() => undefined}
      onPocitadlo={setSuhrn}
    />
    <Momenty
      udalosti={udalosti}
      ja={ja}
      mena={hraci.map((h) => h.meno)}
      hovor={() => undefined}
      pocitadloBezi={suhrn}
      portret={(elderId) => {
        const o = vzhladKarty(sada, data, elderId).obrazok;
        return o === null ? null : mediaUrl(o.nahlad);
      }}
    />
    </>
  );
}
