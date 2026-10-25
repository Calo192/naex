// Náhľady ceny ťahu — kliatby oboch hráčov po zamýšľanom ťahu (NA EX,
// odpoveď na NA EX) a čo z nich prežije najbližšiu bitku. Návrh „Náhľady
// sľubujú inú cenu, než hra potom zúčtuje“ (playtest 20261021-143600, #1 B):
// Dlh ráta tým istým kódom ako motor (paleneDlhyVBitke), nie druhým vzorcom.
// Všetko z verejného stavu — súperovu ruku náhľad nepozná.

import type { PlayerId } from "./types.ts";
import type { GameData } from "./data.ts";
import { cigaretyZPitky, lineState, nahladPitky, paleneDlhyVBitke, pohorseniaVBitke, poskodenieBitky, silaPriazne, svokraZaNaex } from "./engine.ts";
import { silaDoDna } from "./effects.ts";
import { opponentOf } from "./types.ts";
import { evaluateLine } from "./partia.ts";
import { cenaPatronatu, MARKER_STRED } from "./elders.ts";
import type { ClientState } from "./view.ts";
import { hodnotaPohorseni } from "./view.ts";

/** Stôl pre náhľad — línia a pečeň po zamýšľanom ťahu (ako pre nahladPitky). */
export type StolNahladu = Parameters<typeof nahladPitky>[1];

/** Dlhy jedného hráča z Pitiek kola a čo z nich ostane po najbližšej bitke. */
export interface DlhyDoBitky {
  /** Nové Dlhy v tejto Pitke a v ďalších Pitkách kola (ak sa na stole nič nezmení). */
  readonly nove: number;
  /** Koľko priznaných Dlhov bitka najviac spáli (Robota, Dievčina na vydaj). */
  readonly kapacita: number;
  /** Priznané Dlhy po bitke. */
  readonly poBitke: number;
}

/** Výhľad Dlhov do bitky oboch hráčov — doska hráča v Zhromaždení a Pitke. */
export function vyhladDlhov(data: GameData, stol: StolNahladu, dalsiePitky: number): readonly [DlhyDoBitky, DlhyDoBitky] {
  const nahlad = nahladPitky(data, stol);
  const kapacita = paleneDlhyVBitke(data, stol);
  const pre = (p: PlayerId): DlhyDoBitky => {
    const n = nahlad[p];
    const nove = n.dlhy + Math.floor(n.zadlzenieZoStola / n.prahDlhu) * dalsiePitky;
    const teraz = stol.hraci[p].priznane.filter((k) => k.defId === "dlh").length;
    return { nove, kapacita: kapacita[p], poBitke: Math.max(0, teraz + nove - kapacita[p]) };
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
  /** Body na konci hry pri dnešných scorecardoch: Cirhózy ako nepriznané, Dlhy po bitke. */
  readonly body: number;
}

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
  dalsiePitky: number,
  ceny: readonly [CenyKliatob, CenyKliatob],
): readonly [KliatbyNahladu, KliatbyNahladu] {
  const np = [nahladPitky(data, pred), nahladPitky(data, po)] as const;
  const dl = [vyhladDlhov(data, pred, dalsiePitky), vyhladDlhov(data, po, dalsiePitky)] as const;
  const pre = (p: PlayerId): KliatbyNahladu => {
    const a = np[0][p];
    const b = np[1][p];
    const zaPitku = (n: typeof a): number => Math.floor(n.pecenZoStola / n.prahPecene);
    const cirhozy = b.cirhozy - a.cirhozy;
    const dalejCirhozy = (zaPitku(b) - zaPitku(a)) * dalsiePitky;
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
 * cigarety, Pohoršenia a mäkké poškodenie hráča po ťahu oproti stavu bez
 * neho. Cigarety a Pohoršenia rátajú tie isté funkcie ako zúčtovanie
 * (cigaretyZPitky, pohorseniaVBitke), mäkké poškodenieBitky.
 */
export interface DopadyNahladu {
  /** Cigarety navyše: priamo (patronát) a vo vyhodnotení tejto aj ďalších Pitiek kola. */
  readonly cigarety: number;
  /** Pohoršenia navyše v najbližšej bitke a koľko ich bude spolu. */
  readonly pohorsenia: number;
  readonly pohorseniaSpolu: number;
  /** ≈ o koľko Pohoršenia navyše pohnú rozdiel bodov hráča (on − súper), hltavo (hodnotaPohorseni). */
  readonly pohorseniaBody: number;
  /** Mäkké poškodenie navyše v najbližšej bitke. */
  readonly makke: number;
}

export function dopadyNahladu(data: GameData, pred: ClientState, po: ClientState, dalsiePitky: number): readonly [DopadyNahladu, DopadyNahladu] {
  const stav = (s: ClientState, p: PlayerId) => {
    const sums = evaluateLine(data, lineState(s)).sums;
    // Vo Vízii je táto Pitka už vyhodnotená — ako nahladPitky.
    const tato = s.vizia === null ? cigaretyZPitky(data, s, sums, s.pitkaCislo)[p] : 0;
    const dalej = cigaretyZPitky(data, s, sums, s.pitkaCislo + 1)[p] * dalsiePitky;
    const pohorsenia = pohorseniaVBitke(data, s, sums)[p];
    return {
      cigarety: s.hraci[p].cigarety + tato + dalej,
      pohorsenia,
      pohorseniaBody: hodnotaPohorseni(data, s, p, pohorsenia),
      makke: poskodenieBitky(data, s, sums, [0, 0]).makke[p],
    };
  };
  const pre = (p: PlayerId): DopadyNahladu => {
    const a = stav(pred, p);
    const b = stav(po, p);
    return {
      cigarety: b.cigarety - a.cigarety,
      pohorsenia: b.pohorsenia - a.pohorsenia,
      pohorseniaSpolu: b.pohorsenia,
      pohorseniaBody: b.pohorseniaBody - a.pohorseniaBody,
      makke: b.makke - a.makke,
    };
  };
  return [pre(0), pre(1)];
}

/**
 * Čo jedno ďalšie NA EX hráča p zúčtuje pri odkrytí (v5, NA EX naraz) — tým istým
 * poradím ako odhalNaex v motore: najprv súperove Svokry, potom Výpalné zo zvyšku
 * cigariet. `doDna`: poldeci z neho sa po bitke vráti plný (Na zdravie, Alkoholik).
 * Súperove skryté NA EX náhľad nepozná, preto zrážku (Výtržník) nesľubuje.
 */
export interface OdkrytieNaex {
  /** Cigarety, ktoré za toto NA EX ukradnú súperove Svokry. */
  readonly svokra: number;
  /** Cigarety, ktoré za toto NA EX zaplatíš súperovi (Výpalné), najviac koľko ti ostane. */
  readonly vypalne: number;
  readonly doDna: boolean;
}

export function odkrytieNaex(data: GameData, view: ClientState, p: PlayerId): OdkrytieNaex {
  const cig = view.hraci[p].cigarety;
  const svokra = svokraZaNaex(data, view, p, cig);
  const vypalne = Math.min(silaPriazne(data, view, "NEPRAJNIK", opponentOf(p)), cig - svokra);
  const linia = view.strany.flat();
  const naStole =
    linia.filter((pl) => pl.naexBy === p || pl.naexBy2 === p).length +
    view.zaverecne.filter((z) => z.naexBy === p && !linia.some((pl) => pl.card.uid === z.uid)).length;
  return { svokra, vypalne: Math.max(0, vypalne), doDna: naStole < silaDoDna(data, view, p) };
}

/**
 * Pohľad hráča `view.ja` s jeho skrytými NA EX (v5) tak, ako ich motor zúčtuje
 * pri odkrytí: poldeci na karte, pečeň +1, Svokra a Výpalné — základ náhľadu
 * ďalšieho NA EX a výhľadov Pitky. Súperove skryté NA EX klient nevidí.
 */
export function sMojimiSkrytymiNaex(data: GameData, view: ClientState): ClientState {
  const ja = view.ja;
  const skryte = (view.pitkaStav?.skryteNaex ?? []).filter((x) => x.hrac === ja);
  let v = view;
  for (const x of skryte) {
    const kde = v.strany.findIndex((st) => st.some((pl) => pl.card.uid === x.uid && pl.naexBy === undefined));
    // Súperova skrytá Záverečná nie je v strany — NA EX na ňu nesie jej náhradné uid.
    const naRub = kde === -1 && v.zaverecne.some((z) => z.uid === x.uid && z.naexBy === null);
    if (kde === -1 && !naRub) continue;
    const cena = odkrytieNaex(data, v, ja);
    const strany: [ClientState["strany"][0], ClientState["strany"][1]] = [v.strany[0], v.strany[1]];
    if (kde !== -1) strany[kde as PlayerId] = v.strany[kde as PlayerId].map((pl) => (pl.card.uid === x.uid ? { ...pl, naexBy: ja } : pl));
    const zaverecne = naRub ? v.zaverecne.map((z) => (z.uid === x.uid ? { ...z, naexBy: ja } : z)) : v.zaverecne;
    const hraci: [ClientState["hraci"][0], ClientState["hraci"][1]] = [v.hraci[0], v.hraci[1]];
    const su = opponentOf(ja);
    const h = hraci[ja];
    hraci[ja] = { ...h, poldeciPlne: Math.max(0, h.poldeciPlne - 1), pecen: h.pecen + 1, cigarety: h.cigarety - cena.svokra - cena.vypalne };
    hraci[su] = { ...hraci[su], cigarety: hraci[su].cigarety + cena.svokra + cena.vypalne };
    v = { ...v, strany, hraci, zaverecne };
  }
  return v;
}

/**
 * Stôl po patronáte hráča `view.ja` (bez karty na scorecarde — tá je
 * súperovi skrytá): marker do stredu, cigarety zaplatené, súper dostane
 * v bitke Pohoršenia. Pre dopadyNahladu.
 */
export function stavPoPatronate(view: ClientState, elderId: string): ClientState {
  const elder = view.starsi.find((e) => e.elderId === elderId);
  if (elder === undefined) return view;
  const cena = cenaPatronatu(elder);
  const ja = view.ja;
  const hraci: [ClientState["hraci"][0], ClientState["hraci"][1]] = [view.hraci[0], view.hraci[1]];
  hraci[ja] = { ...hraci[ja], cigarety: hraci[ja].cigarety - cena.cigarety };
  const patronat: [ClientState["patronat"][0], ClientState["patronat"][1]] = [view.patronat[0], view.patronat[1]];
  patronat[ja] = { elderId, pohorsenia: cena.pohorsenia };
  return {
    ...view,
    hraci,
    patronat,
    starsi: view.starsi.map((e) => (e.elderId === elderId ? { ...e, marker: MARKER_STRED, markerZaciatokKola: MARKER_STRED } : e)),
  };
}
