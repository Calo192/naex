// Texty konzolového klienta AI playtesterov (hrac.ts), ktoré sa dajú otestovať
// bez servera: čísla berú z jadra (stavkaBitky, poOdkrytiNaex, evaluateLine),
// aby sa výpis nerozišiel s pravidlami, keď sa jadro zmení (playtest
// 20261028-090549: −5 za Cirhózu, Bzdocha naslepo, Noviny v odhade, „kolo 7“).

import type { ClientState, ElderState, GameData, PlayerId } from "@naex/core";
import {
  dalsiePitkyKola,
  efektyPrehry,
  opponentOf,
  poOdkrytiNaex,
  prebytokNaStarsieho,
  sMojimiSkrytymiNaex,
  spakov,
  stavkaBitky,
  stolPriPoskodeni,
  textyEfektovPrehry,
  vidiVolbuSupera,
} from "@naex/core";

// Efekty Prehra ráta jadro (návrh #38 B) — test klienta ich berie odtiaľto.
export { efektyPrehry } from "@naex/core";

/** Súperove skryté NA EX, ktoré hráč vidí — server ich pošle len majiteľovi Bzdochy (vidiVolbuSupera). */
export function superoveSkryteNaex(v: ClientState): readonly { readonly hrac: PlayerId; readonly uid: number }[] {
  return (v.pitkaStav?.skryteNaex ?? []).filter((x) => x.hrac !== v.ja);
}

/**
 * Starší, ktorých marker smie Nakladačka teraz posunúť — ten istý filter ako ponuka
 * servera (prebytokNaStarsieho): starší v ohrození (pokus o zajatie, §9.4 bod 7, §10)
 * nie (playtest 20261030-184957: výpis ho ponúkal). Mimo kroku Nakladačky prázdne.
 */
export function starsiNaNakladacku(v: ClientState): readonly ElderState[] {
  const b = v.bitkaStav;
  if (b === null || b.krok !== "prebytok" || b.prebytokDrzi === null || b.prebytokZostava < 1) return [];
  const drzi = b.prebytokDrzi;
  return v.starsi.filter((e) => prebytokNaStarsieho(v, e, drzi, b.prebytokZostava));
}

/**
 * Stôl tak, ako ho motor zúčtuje pri odkrytí: moje skryté NA EX (ako web)
 * a s Bzdochou aj súperove, ktoré mi server poslal. Zrážku (obaja na tej istej
 * karte) skladá poOdkrytiNaex už pri mojom NA EX — súperovo na tú kartu sa
 * potom preskočí (karta už NA EX nesie).
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
 * Noviny, Herňa, sekera a Kultúrny dom (strach starších v stávke od v8.3 nie je). Priznané Dlhy (Noviny, Herňa)
 * také, aké budú pri poškodení — s Dlhmi z Pitiek kola, exekúcia príde až po
 * špakoch za bitku (stolPriPoskodeni). Bez cieľa null.
 */
export function stavkaText(data: GameData, v: ClientState): string | null {
  const st = stavkaBitky(stolPriPoskodeni(data, v, dalsiePitkyKola(data, v)));
  if (st === null) return null;
  const rozpis = (sekera: number, herna: number): string => {
    const casti = [
      sekera > 0 ? `${sekera} zo sekery` : "",
      herna > 0 ? `${herna} z Herne` : "",
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
  return `Stávka (${st.karty} ${st.karty === 1 ? "karta" : st.karty <= 4 ? "karty" : "kariet"} v línii): tvoja výhra +${spakov(st.vyhra)}${rozpis(st.naSekere, st.herna[0])}, súperova výhra +${spakov(-st.prehra)}${rozpis(st.naSekere, st.herna[1])}.${noviny}${kd}`;
}

/** Efekty Prehra porazeného slovami — ten istý text ako web (jadro, návrh #38 B). */
const textyPrehry = textyEfektovPrehry;

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
