// Výučba „Prvá hra“, playtest výučby kolo 4 (U2): ťah Štamgasta či hry za hráča bez
// textu Melichara ubehne sám a hráč nevedel, čo sa stalo. Tu sa z dvoch pohľadov
// zistí, čo sa na stole pohlo (kľúče zvýraznenia ako v Vyucba.tsx), a z udalostí
// krátky štítok do stĺpca Melichara.

import type { CardInstance, ClientState, PlayerId } from "@naex/core";

/** Kde karta leží — zmena miesta (aj NA EX na karte v línii) = karta sa pohla. */
function miestaKariet(v: ClientState): Map<number, string> {
  const m = new Map<number, string>();
  const daj = (karty: readonly CardInstance[], zona: string): void => {
    for (const k of karty) m.set(k.uid, zona);
  };
  // NA EX naraz (v5): moje skryté NA EX ešte neleží na karte, ale hráč ho vidí.
  const skryte = new Set((v.pitkaStav?.skryteNaex ?? []).map((x) => x.uid));
  for (const p of [0, 1] as const) {
    for (const pl of v.strany[p]) m.set(pl.card.uid, `strana${p}|${pl.naexBy ?? ""}${skryte.has(pl.card.uid) ? "|skryte" : ""}`);
    daj(v.hraci[p].priznane, `priznane${p}`);
    daj(v.hraci[p].dedicstvo, `dedicstvo${p}`);
    daj(v.hraci[p].odhadzovaci, `odhadzovaci${p}`);
  }
  daj(v.ruka, "ruka");
  daj(v.senok, "senok");
  daj(v.lokalityVHre, "lokality");
  // v6: odohrané lokality ležia na nástenke.
  daj(
    v.nastenka.flatMap((b) => (b.lokalita === null ? [] : [b.lokalita])),
    "nastenka",
  );
  if (v.ciel?.lokalita != null) m.set(v.ciel.lokalita.uid, "ciel");
  return m;
}

/** Dlaždice baru (data-vyucba-prvok v Panely.tsx) a čím sa merajú. */
const DLAZDICE: readonly (readonly [string, (v: ClientState, p: PlayerId) => number | string])[] = [
  ["poldeci", (v, p) => `${v.hraci[p].poldeciPlne}/${v.hraci[p].poldeciVypite}`],
  ["cigarety", (v, p) => v.hraci[p].cigarety],
  ["pecen", (v, p) => v.hraci[p].pecen],
  ["zadlzenie", (v, p) => v.hraci[p].zadlzenie],
  ["dlhy", (v, p) => v.hraci[p].dlhy],
  ["karty", (v, p) => `${v.hraci[p].rukaPocet}/${v.hraci[p].doberaciPocet}/${v.hraci[p].odhadzovaci.length}`],
];

/**
 * Kľúče zvýraznenia toho, čo sa medzi pohľadmi zmenilo: karty, ktoré sa pohli
 * (uid:N — súperova ruka je skrytá, tam svieti jeho dlaždica Karty), dlaždice barov
 * so zmeneným číslom (bar:… / bar-supera:…) a starší, ktorým sa pohol marker.
 */
export function zmenyStola(pred: ClientState, po: ClientState): string[] {
  const out: string[] = [];
  const predtym = miestaKariet(pred);
  for (const [uid, miesto] of miestaKariet(po)) if (predtym.get(uid) !== miesto) out.push(`uid:${uid}`);
  for (const p of [0, 1] as const) {
    const zona = p === po.ja ? "bar" : "bar-supera";
    for (const [prvok, hodnota] of DLAZDICE) if (hodnota(pred, p) !== hodnota(po, p)) out.push(`${zona}:${prvok}`);
  }
  for (const s of po.starsi) {
    const a = pred.starsi.find((x) => x.elderId === s.elderId);
    if (a !== undefined && a.marker !== s.marker) out.push(`starsi:${s.elderId}`);
  }
  return out;
}

/**
 * Štítok ťahu bez textu Melichara: prvá veta z logu ťahu (bez varovaní a momentov).
 * Za hráča ťahala hra — povie to, inak by hráč nevedel, prečo sa pohla jeho karta.
 */
export function stitokTahu(riadky: readonly string[], kto: "bot" | "auto"): string | null {
  const veta = riadky.find((r) => r.trim() !== "" && !r.startsWith("⚠") && !r.startsWith("★"));
  if (veta === undefined) return null;
  return kto === "auto" ? `Hra za teba: ${veta}` : veta;
}
