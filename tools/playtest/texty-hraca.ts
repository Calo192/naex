// Texty konzolového klienta AI playtesterov (hrac.ts), ktoré sa dajú otestovať
// bez servera: čísla berú z jadra (stavkaBitky, poOdkrytiNaex, evaluateLine),
// aby sa výpis nerozišiel s pravidlami, keď sa jadro zmení (playtest
// 20261028-090549: −5 za Cirhózu, Bzdocha naslepo, Noviny v odhade, „kolo 7“).

import type { ClientState, GameData, PlayerId } from "@naex/core";
import {
  dalsiePitkyKola,
  efektHraca,
  efektPotlaceny,
  evaluateLine,
  lineState,
  opponentOf,
  partiaHraca,
  poOdkrytiNaex,
  sMojimiSkrytymiNaex,
  spakov,
  stavkaBitky,
  stolPriPoskodeni,
  vidiVolbuSupera,
} from "@naex/core";

/** Súperove skryté NA EX, ktoré hráč vidí — server ich pošle len majiteľovi Bzdochy (vidiVolbuSupera). */
export function superoveSkryteNaex(v: ClientState): readonly { readonly hrac: PlayerId; readonly uid: number }[] {
  return (v.pitkaStav?.skryteNaex ?? []).filter((x) => x.hrac !== v.ja);
}

/**
 * Stôl tak, ako ho motor zúčtuje pri odkrytí: moje skryté NA EX (ako web)
 * a s Bzdochou aj súperove, ktoré mi server poslal. Zrážku (obaja na tej istej
 * karte) náhľad nemodeluje — poOdkrytiNaex na kartu s NA EX vráti null.
 */
export function sVidenymiSkrytymiNaex(data: GameData, v: ClientState): ClientState {
  let s = sMojimiSkrytymiNaex(data, v);
  const su = opponentOf(v.ja);
  for (const x of superoveSkryteNaex(v)) {
    const po = poOdkrytiNaex(data, { ...s, ja: su }, x.uid);
    if (po !== null) s = { ...po.view, ja: v.ja };
  }
  return s;
}

/** Názov karty pod NA EX: v línii podľa uid, súperova skrytá Záverečná pod náhradným uid. */
function kartaPodNaex(data: GameData, v: ClientState, uid: number): string {
  for (const p of [0, 1] as const) {
    const pl = v.strany[p].find((x) => x.card.uid === uid);
    if (pl !== undefined) {
      const meno = data.cards.get(pl.card.defId)?.name ?? pl.card.defId;
      return `${pl.playedBy === v.ja ? "tvoju" : "svoju"} kartu ${meno} [${uid}] (na ${p === v.ja ? "tvojej" : "jeho"} strane)`;
    }
  }
  const z = v.zaverecne.find((x) => x.uid === uid);
  if (z !== undefined) return `${z.majitel === v.ja ? "tvoju" : "svoju"} Záverečnú lícom dole (na ${z.strana === v.ja ? "tvojej" : "jeho"} strane)`;
  return `kartu [${uid}]`;
}

/**
 * Bzdocha (§7): jej majiteľ hrá Pitku po súperovi a vidí jeho skryté NA EX —
 * riadok „súper dal NA EX na X / nedal“. Mimo toho null.
 */
export function bzdochaText(data: GameData, v: ClientState): string | null {
  if (v.pitkaStav === null || v.faza !== "pitka" || !vidiVolbuSupera(data, v, v.ja)) return null;
  const jeho = superoveSkryteNaex(v);
  const moje = new Set((v.pitkaStav.skryteNaex ?? []).filter((x) => x.hrac === v.ja).map((x) => x.uid));
  if (jeho.length === 0) return "Bzdocha: súper skončil Pitku bez NA EX (vidíš to skôr, než sa rozhodneš ty).";
  const kam = jeho.map((x) => `${kartaPodNaex(data, v, x.uid)}${moje.has(x.uid) ? " — aj tvoje NA EX, zrážka: z karty bude Výtržník" : ""}`);
  return `Bzdocha: súper dal skryto NA EX na ${kam.join(" a na ")}. Odkryje sa, keď skončíš; stôl a odhad bitky ho už rátajú.`;
}

/**
 * Stávka bitky z jadra (stavkaBitky — ten istý výpočet ako výplata a web):
 * Noviny, Herňa, sekera, Kultúrny dom a starší. Priznané Dlhy (Noviny, Herňa)
 * také, aké budú pri poškodení — s Dlhmi z Pitiek kola, exekúcia príde až po
 * špakoch za bitku (stolPriPoskodeni). Bez cieľa null.
 */
export function stavkaText(data: GameData, v: ClientState): string | null {
  const st = stavkaBitky(data, stolPriPoskodeni(data, v, dalsiePitkyKola(data, v)));
  if (st === null) return null;
  const rozpis = (sekera: number, herna: number, starsi: number): string => {
    const casti = [
      sekera > 0 ? `${sekera} zo sekery` : "",
      herna > 0 ? `${herna} z Herne` : "",
      starsi > 0 ? `${starsi} od starších` : "",
    ].filter((x) => x !== "");
    return casti.length > 0 ? ` (z toho ${casti.join(", ")})` : "";
  };
  const noviny = [
    st.noviny[0] > 0 ? ` Keď prehráš, dostaneš +${spakov(st.noviny[0])} — tvoje Noviny, súper má o toľko priznaných Dlhov viac.` : "",
    st.noviny[1] > 0 ? ` Keď prehrá súper, dostane +${spakov(st.noviny[1])} — jeho Noviny, máš o toľko priznaných Dlhov viac.` : "",
  ].join("");
  const kd =
    st.porazenemu[0] + st.porazenemu[1] > 0
      ? ` Kultúrny dom: aj porazený dostane 1 špak za každú svoju kartu v línii — ty pri prehre +${st.porazenemu[0]}, súper pri prehre +${st.porazenemu[1]}.`
      : "";
  return `Stávka (${st.karty} ${st.karty === 1 ? "karta" : st.karty <= 4 ? "karty" : "kariet"} v línii): tvoja výhra +${spakov(st.vyhra)}${rozpis(st.naSekere, st.herna[0], st.starsi[0])}, súperova výhra +${spakov(-st.prehra)}${rozpis(st.naSekere, st.herna[1], st.starsi[1])}.${noviny}${kd}`;
}

/**
 * Kedy rozhodne ohlásené vydesenie (§1): na konci kola po ohlásení. Finále je
 * posledné kolo — ohlásenie z kola pred ním rozhodne na konci finále, ešte pred
 * konečnými špakmi (skontrolujVydesenie), ohlásené vo finále už nedozreje (null).
 */
export function kedyRozhodneVydesenie(v: Pick<ClientState, "lokalitCelkom" | "rozpis">, ohlasene: number): string | null {
  const finale = v.rozpis !== undefined;
  const posledne = finale ? v.lokalitCelkom + 1 : v.lokalitCelkom;
  if (ohlasene >= posledne) return null;
  if (ohlasene + 1 === posledne) return finale ? "na konci finále (ešte pred konečnými špakmi)" : `na konci kola ${ohlasene + 1} (posledného)`;
  return `na konci kola ${ohlasene + 1}`;
}

/** Efekty Prehra kariet v línii — index = porazený, čísla dostane víťaz. */
export interface EfektyPrehry {
  /** Dievčina na vydaj: víťaz získa toľko Dlhov, koľko mala aktívnych akcií. */
  readonly dievcina: readonly [number, number];
  /** Farár: víťaz získa zadĺženie za každú svoju aktívnu Poveru. */
  readonly farar: readonly [number, number];
  /** Podvodník: toľko priznaných Dlhov porazeného prejde k víťazovi. */
  readonly podvodnik: readonly [number, number];
}

/**
 * Efekty Prehra podľa stola teraz — ten istý výber kariet ako koniecBitky
 * (odkrytá karta v partii porazeného, nie spálená Benzínkou ani umlčaná) a tie
 * isté aktívne akcie (evaluateLine). Motor ich ráta až po tom, čo sa poldeci
 * z NA EX vypijú a zmiznú z kariet — NA EX ich teda nemení, Výtržník áno.
 */
export function efektyPrehry(data: GameData, v: ClientState): EfektyPrehry {
  const bezNaex = (pl: ClientState["strany"][0][number]): ClientState["strany"][0][number] => {
    if (pl.naexBy === undefined && pl.naexBy2 === undefined) return pl;
    const { naexBy: _a, naexBy2: _b, ...zvysok } = pl;
    return zvysok;
  };
  const linia = evaluateLine(data, lineState({ ...v, strany: [v.strany[0].map(bezNaex), v.strany[1].map(bezNaex)] }));
  const spalit = new Set(v.bitkaStav?.spalit ?? []);
  const aktivne = (uid: number): number => {
    const ev = linia.cards.get(uid);
    return ev === undefined ? 0 : [...ev.left, ...ev.right].reduce((a, x) => a + (x?.stav === "aktivna" ? x.nasobok : 0), 0);
  };
  const pre = (porazeny: PlayerId): [number, number, number] => {
    const vitaz = opponentOf(porazeny);
    const partia = partiaHraca(v, porazeny).filter((pl) => pl.zaverecna !== true);
    const dievcina = partia
      .filter((pl) => pl.card.defId === "dievcina_na_vydaj" && !spalit.has(pl.card.uid) && !efektPotlaceny(data, v, porazeny, pl.card.defId))
      .reduce((a, pl) => a + aktivne(pl.card.uid), 0);
    const farar = efektHraca(v, porazeny, "farar") && !efektPotlaceny(data, v, porazeny, "farar") ? (linia.sums[vitaz].Povera ?? 0) : 0;
    const dlhy = v.hraci[porazeny].dlhy;
    const podvodnik = Math.min(dlhy, partia.filter((pl) => pl.card.defId === "podvodnik").length);
    return [dievcina, farar, podvodnik];
  };
  const [a, b] = [pre(0), pre(1)];
  return { dievcina: [a[0], b[0]], farar: [a[1], b[1]], podvodnik: [a[2], b[2]] };
}

/** Efekty Prehra porazeného `porazeny` slovami z pohľadu v.ja; prázdne pole, keď nič. */
function textyPrehry(e: EfektyPrehry, porazeny: PlayerId, ja: PlayerId): string[] {
  const vitaz = porazeny === ja ? "súper" : "ty";
  const ziska = porazeny === ja ? "získa" : "získaš";
  return [
    e.dievcina[porazeny] > 0 ? `Dievčina na vydaj: ${vitaz} ${ziska} ${e.dievcina[porazeny]} Dlh${e.dievcina[porazeny] === 1 ? "" : e.dievcina[porazeny] <= 4 ? "y" : "ov"}` : "",
    e.farar[porazeny] > 0 ? `Farár: ${vitaz} ${ziska} zadĺženie ${e.farar[porazeny]}` : "",
    e.podvodnik[porazeny] > 0 ? `Podvodník: ${e.podvodnik[porazeny]} priznaný Dlh ${porazeny === ja ? "tvoj prejde k súperovi" : "súpera prejde k tebe"}` : "",
  ].filter((x) => x !== "");
}

/** Riadok „PO BITKE (efekty Prehra)“ pod odhadom bitky; null, keď na stole nič také nie je. */
export function prehraText(data: GameData, v: ClientState): string | null {
  const e = efektyPrehry(data, v);
  const su = opponentOf(v.ja);
  const casti = [
    textyPrehry(e, v.ja, v.ja).length > 0 ? `keď prehráš: ${textyPrehry(e, v.ja, v.ja).join(", ")}` : "",
    textyPrehry(e, su, v.ja).length > 0 ? `keď prehrá súper: ${textyPrehry(e, su, v.ja).join(", ")}` : "",
  ].filter((x) => x !== "");
  return casti.length === 0 ? null : `PO BITKE (efekty Prehra, podľa stola teraz): ${casti.join("; ")}.`;
}

/** Karty s efektom Prehra, ktorý efektyPrehry ráta. */
const KARTY_PREHRY: ReadonlySet<string> = new Set(["dievcina_na_vydaj", "farar", "podvodnik"]);

/**
 * Náhľad NA EX na kartu `uid`: efekty Prehra po bitke (playtest
 * 20261028-090549-2, Eva: náhľad NA EX na Dievčinu na vydaj ukázal len
 * „súper Dlh +1“ z Pitky, po prehre prišli 3 Dlhy). Keď ich ťah zmení, oboje;
 * pri NA EX na kartu s Prehrou aj to, že ich nezmení. Inak prázdny reťazec.
 */
export function prehraNaexText(data: GameData, pred: ClientState, po: ClientState, uid: number): string {
  const a = efektyPrehry(data, pred);
  const b = efektyPrehry(data, po);
  const ja = pred.ja;
  const strany = [ja, opponentOf(ja)] as const;
  const kto = (p: PlayerId): string => (p === ja ? "keď prehráš" : "keď prehrá súper");
  const zmena = strany.flatMap((p) => {
    const ta = textyPrehry(a, p, ja).join(", ");
    const tb = textyPrehry(b, p, ja).join(", ");
    return ta === tb ? [] : [`${kto(p)}: ${tb === "" ? "nič" : tb} (bez tohto NA EX ${ta === "" ? "nič" : ta})`];
  });
  if (zmena.length > 0) return `; efekty Prehra po bitke: ${zmena.join("; ")}`;
  const defId = pred.strany.flat().find((pl) => pl.card.uid === uid)?.card.defId;
  if (defId === undefined || !KARTY_PREHRY.has(defId)) return "";
  const teraz = strany.flatMap((p) => (textyPrehry(b, p, ja).length > 0 ? [`${kto(p)}: ${textyPrehry(b, p, ja).join(", ")}`] : []));
  return `; efekty Prehra po bitke (toto NA EX ich nezmení — poldeci z NA EX sa vypijú skôr, rátajú sa všetky aktívne akcie karty): ${teraz.length > 0 ? teraz.join("; ") : "nič"}`;
}
