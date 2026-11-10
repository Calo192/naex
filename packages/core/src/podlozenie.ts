// Podloženie Nástroja (rework Náradia, Michal 2026-11-08, PRAVIDLA §12): kam a ktorou hranou
// smie hráč Nástroj z ruky podložiť. Spoločné pre server (cmdPodloz), legalCommands, bota
// aj klienta — pravidlá podloženia sú tak len raz.

import type { Action, CardInstance, PlayerId } from "./types.ts";
import type { GameData } from "./data.ts";
import { defOf, printedSides } from "./data.ts";
import type { LineState, PlacedCard } from "./partia.ts";
import { cestaAkcie, evaluateLine, krokyNastrojov, premenyVLinii, zvieratAUmlcane } from "./partia.ts";
import type { KrokPremeny } from "./partia.ts";
import type { HranaNastroja, KtoraHrana } from "./naradie.ts";
import { KTORE_HRANY, aktivnaHrana, hranaSlovami, hranyNastroja, posilnenaSlovami, posilneniaHostitela, preskolStranu, preskoleniaHostitela, ucinkyNastrojov } from "./naradie.ts";
import { menoAkcie } from "./preskolenie.ts";


const BEZ_PREMIEN: ReadonlyMap<Action, { readonly na: Action; readonly uid: number }> = new Map();

/** Pod Zámočníka smie ľubovoľne veľa Nástrojov, pod ostatné karty jeden. */
export const BEZ_LIMITU_NASTROJOV = "zamocnik";

/** Hostiteľ v línii a jeho kraj. */
function najdi(line: Pick<LineState, "strany">, uid: number): PlacedCard | null {
  for (const strana of line.strany) for (const pl of strana) if (pl.card.uid === uid) return pl;
  return null;
}

/** Čo sa z línie ráta raz pre celú ponuku (legalCommands ju volá pri každom ťahu). */
const pamat = new WeakMap<LineState, { kon?: boolean; vzbury?: ReadonlySet<number> }>();

function pamatLinie(line: LineState): { kon?: boolean; vzbury?: ReadonlySet<number> } {
  let p = pamat.get(line);
  if (p === undefined) {
    p = {};
    pamat.set(line, p);
  }
  return p;
}

/** Leží v línii odkrytý Kôň, ktorého neumlčal Mäsiar? Potom smie Nástroj aj pod Zviera. */
function konPusta(data: GameData, line: LineState): boolean {
  const p = pamatLinie(line);
  if (p.kon === undefined) {
    const umlcane = zvieratAUmlcane(data, line);
    p.kon = [...line.strany[0], ...line.strany[1]].some((pl) => pl.card.defId === "kon" && pl.zaverecna !== true && !umlcane.has(pl.card.uid));
  }
  return p.kon;
}

/**
 * Má karta na tejto hrane čo robiť pod hostiteľom (preškolenie či posilnenie nájde svoju akciu, účinok ešte nemá)?
 * Nový Nástroj ide na koniec reťaze (v11.20) — preškolí výstup Školiteľov v línii aj Nástrojov pod kartou.
 */
export function hranaMaCoRobit(data: GameData, hostitel: PlacedCard, hrana: HranaNastroja, line?: Pick<LineState, "lokalita" | "strany">): boolean {
  if (hrana.druh === "karta") return !ucinkyNastrojov(data, hostitel).has(hrana.ucinok);
  if (hrana.druh === "posilnenie") return !posilneniaHostitela(data, hostitel).has(hrana.akcia) && pocetPoPreskoleni(data, hostitel, hrana.akcia, line) > 0;
  return pocetPoPreskoleni(data, hostitel, hrana.z, line) > 0;
}

/** Koľko akcií `a` má karta na oboch hranách po preškolení (Školitelia v línii, Nástroje pod ňou) — tie posilnenie posilní. */
function pocetPoPreskoleni(data: GameData, pl: PlacedCard, a: string, line?: Pick<LineState, "lokalita" | "strany">): number {
  const p = printedSides(data, pl.card);
  const premeny = line === undefined ? preskoleniaHostitela(data, pl) : (premenyVLinii(data, line).get(pl.card.uid)?.hrany ?? BEZ_PREMIEN);
  return [...preskolStranu(premeny, p.left), ...preskolStranu(premeny, p.right)].filter((x) => x?.akcia === a).length;
}

/** Premeny karty v poradí reťaze — s líniou aj Školitelia, inak len Nástroje pod ňou. */
function krokyKarty(data: GameData, pl: PlacedCard, line?: Pick<LineState, "lokalita" | "strany">): readonly KrokPremeny[] {
  return line === undefined ? krokyNastrojov(data, pl) : (premenyVLinii(data, line).get(pl.card.uid)?.kroky ?? []);
}

/**
 * Prečo hráč (tím) `kto` nemôže podložiť Nástroj pod kartu `hostitelUid` hranou `hrana`; null = smie.
 * Cigaretu a ťah stráži volajúci. Hrana, ktorá pod kartou nemá čo robiť, je dovolená
 * (pravidlá v5: „podložiť ho smieš, je to tvoj ťah“) — ponuka ju len označí.
 */
export function dovodNepodlozenia(data: GameData, line: LineState, nastroj: CardInstance, hostitelUid: number, hrana: KtoraHrana, kto: PlayerId): string | null {
  const def = defOf(data, nastroj);
  if (!def.tags.includes("Nástroj")) return "Podložiť možno len Nástroj.";
  const hrany = hranyNastroja(def);
  if (hrany === null) return `${def.name} nemá v sade hrany — smie len do Dedičstva.`;
  const hostitel = najdi(line, hostitelUid);
  if (hostitel === null) return "Karta nie je v línii.";
  // v11.16 (Michal 2026-11-09): „hráč nesmie podkladať náradie pod súperove karty, len pod svoje“.
  if (hostitel.playedBy !== kto) return "Nástroj sa podkladá len pod vlastné karty.";
  // Karta lícom dole: súper nevie, čo to je — odmietnutie by prezradilo jej tagy.
  if (hostitel.zaverecna === true) return "Pod kartu lícom dole sa nepodkladá.";
  const tags = defOf(data, hostitel.card).tags;
  const clovek = tags.includes("Občan") || tags.includes("Starešina");
  if (!clovek && !(tags.includes("Zviera") && konPusta(data, line))) {
    return tags.includes("Zviera") ? "Pod Zviera smie Nástroj len, kým v línii leží Kôň." : "Nástroj sa podkladá len pod Občana alebo Starešinu.";
  }
  if ((hostitel.podlozene?.length ?? 0) > 0 && hostitel.card.defId !== BEZ_LIMITU_NASTROJOV) return "Pod kartou už leží Nástroj — viac ich smie len pod Zámočníka.";
  const h = hrany[hrana];
  if (h.druh === "karta" && h.ucinok === "NA EX") {
    // Vínko (Michal 2026-11-08, P3): ako NA EX — nie na kartu s poldecom, so Vzburou ani na Výtržníka.
    if (hostitel.naexBy !== undefined || hostitel.naexBy2 !== undefined) return "Na karte leží poldeci — NA EX z Vínka pod ňu nejde.";
    const ucinky = ucinkyNastrojov(data, hostitel);
    if (hostitel.vytrznik === true || ucinky.has("Výtržník")) return "Výtržník NA EX nedostane.";
    if (vzburaVidno(data, line, hostitel)) return "Karta má Vzburu — NA EX z Vínka pod ňu nejde.";
  }
  return null;
}

/** Vzbura karty z toho, čo vidia obaja — skryté Záverečné sa nerátajú (naexMaZmysel). */
function vzburaVidno(data: GameData, line: LineState, pl: PlacedCard): boolean {
  const p = pamatLinie(line);
  if (p.vzbury === undefined) {
    const verejne = line.strany.map((strana) => strana.filter((x) => x.zaverecna !== true)) as unknown as LineState["strany"];
    p.vzbury = new Set([...evaluateLine(data, { ...line, strany: verejne }).cards.values()].filter((k) => k.vzbura).map((k) => k.uid));
  }
  return p.vzbury.has(pl.card.uid);
}

export interface MoznostPodlozenia {
  readonly hostitel: number;
  readonly hrana: KtoraHrana;
  /** Hrana pod touto kartou niečo urobí; inak je podloženie len stratený ťah. */
  readonly maCoRobit: boolean;
  /** Čo hrana spraví na tejto karte: „Rana ×2 → Pecka ×2“, „Vzbura“, „nemá Ranu“. */
  readonly popis: string;
}

/** Všetky dovolené podloženia Nástroja `nastroj` hráča (tímu) `kto` — jeho karty v línii × hrana, v poradí línie. */
export function ponukaPodlozenia(data: GameData, line: LineState, nastroj: CardInstance, kto: PlayerId): MoznostPodlozenia[] {
  const hrany = hranyNastroja(defOf(data, nastroj));
  if (hrany === null) return [];
  const out: MoznostPodlozenia[] = [];
  for (const strana of line.strany) {
    for (const pl of strana) {
      for (const hrana of KTORE_HRANY) {
        if (dovodNepodlozenia(data, line, nastroj, pl.card.uid, hrana, kto) !== null) continue;
        out.push({ hostitel: pl.card.uid, hrana, maCoRobit: hranaMaCoRobit(data, pl, hrany[hrana], line), popis: popisHrany(data, pl, hrany[hrana], line) });
      }
    }
  }
  return out;
}

/** Čo hrana spraví na karte — text pre ponuku hrany a log. */
export function popisHrany(data: GameData, hostitel: PlacedCard, hrana: HranaNastroja, line?: Pick<LineState, "lokalita" | "strany">): string {
  if (hrana.druh === "karta") return hrana.ucinok;
  if (hrana.druh === "posilnenie") {
    const n = pocetPoPreskoleni(data, hostitel, hrana.akcia, line);
    return n === 0 ? `nemá ${menoAkcie(hrana.akcia)}` : `${posilnenaSlovami(hrana.akcia)}${n > 1 ? ` (${n}×)` : ""}`;
  }
  // Celá reťaz (v11.20): z vytlačenej akcie cez Školiteľov a Nástroje pod kartou až po túto hranu.
  const kroky = krokyKarty(data, hostitel, line);
  const p = printedSides(data, hostitel.card);
  const cesty = new Map<string, number>();
  for (const a of [...p.left, ...p.right]) {
    if (a === null) continue;
    const cesta = cestaAkcie(kroky, a);
    if ((cesta[cesta.length - 1]?.na ?? a) !== hrana.z) continue;
    const k = [a, ...cesta.map((x) => x.na), hrana.na].join("|");
    cesty.set(k, (cesty.get(k) ?? 0) + 1);
  }
  if (cesty.size === 0) return `nemá ${menoAkcie(hrana.z)}`;
  return [...cesty]
    .map(([k, n]) => {
      const krat = n > 1 ? ` ×${n}` : "";
      return k.split("|").map((a) => `${menoAkcie(a as Action)}${krat}`).join(" → ");
    })
    .join(", ");
}

/** Pretŕčajúce hrany Nástrojov pod kartou, ako ich ukazuje log a klient: „Vidly (Rana → Pecka)“. */
export function popisPodlozenych(data: GameData, pl: PlacedCard): string[] {
  return (pl.podlozene ?? []).map((n) => {
    const h = aktivnaHrana(data, n);
    const meno = defOf(data, n.card).name;
    return h === null ? meno : `${meno} (${hranaSlovami(h)})`;
  });
}
