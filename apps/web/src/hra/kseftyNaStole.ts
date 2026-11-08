// Efekty pod kartou (Michal 2026-11-02: „Chcem, aby to bolo vidno pod kartou, ktorá to
// ponúka.“): Sklad pod lokalitou v Zhromaždení (frakcie 2026-11-08) a schopnosti väzňov (v11.2)
// v okne Pivnica. Kšeft zanikol (frakcie 2026-11-08). Ponuka je tá istá ako v legalCommands
// (jadro); čo sa nedá, ostane ako obrys s dôvodom.

import {
  KONSTANTY,
  opponentOf,
  ponukaSchopnostiVazna,
  schopnostBezUcinku,
  skladPonuka,
  stavSchopnostiVaznaZPohladu,
  tahSchopnosti,
  type ClientState,
  type Command,
  type GameData,
} from "@naex/core";

/** Čím sa Kšeft platí: cigarety (karty, lokality); schopnosť väzňa nestojí nič, je raz za hru (v11.2). */
export type CenaKseftu = { readonly cigarety: number } | { readonly raz: true };

/** Tlačidlo v ponuke Kšeftu — jeden presný príkaz. */
export interface TlacidloVolby {
  readonly text: string;
  readonly prikaz: Command;
  /** Kľúč pre výučbu (Kšeft vily: kseft:<starší>:<1|0>). */
  readonly vyucba?: string;
}

/** Riadok ponuky: pri vile starší, pri Farárovi karta s NA EX, pri Hrobárovi karta zo šrotu. */
export interface RiadokVolby {
  readonly kluc: string;
  readonly meno: string;
  /** Tlačidlo vľavo od mena (vila: „‹ k sebe“ — ako na stupnici, kde je tvoja polovica vľavo). */
  readonly vlavo?: TlacidloVolby;
  readonly vpravo: TlacidloVolby;
}

export type AkciaKseftu =
  | { readonly typ: "prikaz"; readonly prikaz: Command }
  /** Najprv voľba (starší a smer, karta) — ponuka nad tlačidlom. */
  | { readonly typ: "volba"; readonly nadpis: string; readonly riadky: readonly RiadokVolby[] }
  /** Autobusár (v11.2): ľubovoľne veľa kariet, každá za cenaZaKus cigariet — výber, potom potvrdenie. */
  | {
      readonly typ: "karty";
      readonly nadpis: string;
      readonly karty: readonly { readonly uid: number; readonly meno: string }[];
      readonly cenaZaKus: number;
      readonly najviac: number;
      readonly prikaz: (uids: readonly number[]) => Command;
    };

export interface KseftNaStole {
  /** Karta, pod ktorou tlačidlo leží (pri väzňovi karta staršieho). */
  readonly uid: number;
  readonly druh: "karta" | "lokalita" | "vazen";
  readonly defId: string;
  /** Meno karty, ktorá Kšeft ponúka — nadpis nápovedy. */
  readonly nazov: string;
  readonly cena: CenaKseftu;
  /** Čo hráč dostane — krátko, v nápovede a v ponuke (na tlačidle je len cena). */
  readonly zisk: string;
  /** Celé znenie do nápovedy. */
  readonly tip: string;
  /** Prečo teraz nie — null = dá sa. */
  readonly dovod: string | null;
  /** Kšeft tejto karty už v tejto Pitke bol. */
  readonly pouzity: boolean;
  readonly akcia: AkciaKseftu;
}

const cigariet = (n: number): string => (n === 1 ? "1 cigaretu" : n >= 2 && n <= 4 ? `${n} cigarety` : `${n} cigariet`);

/**
 * Efekty pod kartou, ktoré hráč teraz smie použiť — Sklad pod lokalitou (Zhromaždenie, frakcie
 * 2026-11-08) a schopnosti jeho väzňov. Kšeft zanikol (frakcie 2026-11-08).
 */
export function kseftyNaStole(data: GameData, view: ClientState): KseftNaStole[] {
  return [...efektyLokality(data, view), ...schopnostiVaznov(data, view)];
}

/** Sklad: Nástroj zo šenku rovno do Dedičstva za cenu Dedičstva — v Zhromaždení na mojom ťahu. */
function efektyLokality(data: GameData, view: ClientState): KseftNaStole[] {
  const lok = view.ciel?.lokalita ?? null;
  if (lok === null || !skladPonuka(data, view) || view.faza !== "zhromazdenie" || !view.mozemHrat) return [];
  const meno = (defId: string): string => data.cards.get(defId)?.name ?? defId;
  const cena = view.cenaDedicstva;
  const nastroje = view.senok.filter((k) => data.cards.get(k.defId)?.tags.includes("Nástroj") === true);
  const h = view.hraci[view.ja];
  return [
    {
      uid: lok.uid,
      druh: "lokalita",
      defId: lok.defId,
      nazov: meno(lok.defId),
      cena: { cigarety: cena },
      zisk: "Nástroj do Dedičstva",
      tip: `Sklad: Nástroj zo šenku vyložíš rovno do Dedičstva za cenu Dedičstva (teraz ${cigariet(cena)}). Do šenku sa dotiahne nový Nástroj.`,
      dovod: nastroje.length === 0 ? "V šenku nie je Nástroj." : h.cigarety < cena ? `Dedičstvo stojí ${cigariet(cena)}, máš ${h.cigarety}.` : null,
      pouzity: false,
      akcia: {
        typ: "volba",
        nadpis: "Sklad · Nástroj zo šenku do Dedičstva",
        riadky: nastroje.map((k) => ({ kluc: String(k.uid), meno: meno(k.defId), vpravo: { text: "do Dedičstva", prikaz: { type: "place", uid: k.uid, target: "dedicstvo" } } })),
      },
    },
  ];
}

/** Krátky zisk schopnosti väzňa na tlačidle — celé znenie (elders.json) je v nápovede. */
const ZISK_SCHOPNOSTI: Readonly<Record<string, string>> = {
  postarka: `+${KONSTANTY.POSTARKA_CIGARETY} cigarety`,
  krcmarka: "nový poldeci",
  farar: "preč súperovo NA EX",
  starosta: "lokalita posilnená",
  veterinar: "Cirhózy preč",
  vychovavatelka: "súper pasuje",
  autobusar: "karty zo šenku",
  hrobar: "karta zo šrotu súpera",
};

/**
 * Schopnosti mojich väzňov (v11.2, Michal 2026-11-02) — v okne Pivnica pod kartou väzňa a pri
 * pečiatke „V PIVNICI“ na línii starších. Ponuka je tá istá ako v legalCommands (jadro); minutá
 * schopnosť ostane so značkou „použitá“, nedostupná ako obrys s dôvodom.
 */
export function schopnostiVaznov(data: GameData, view: ClientState): KseftNaStole[] {
  const ja = view.ja;
  const su = opponentOf(ja);
  const stav = stavSchopnostiVaznaZPohladu(view);
  const ponuka = ponukaSchopnostiVazna(stav, ja);
  const meno = (defId: string): string => data.cards.get(defId)?.name ?? defId;
  const out: KseftNaStole[] = [];
  for (const v of view.vazni.filter((x) => x.hrac === ja)) {
    const defId = v.karta.defId;
    const elderId = v.elderId;
    const pouzity = v.pouzita === true;
    const dovod = pouzity
      ? "Schopnosť je minutá — väzeň ostáva v pivnici."
      : !tahSchopnosti(stav, ja)
        ? "Schopnosť použiješ vo svojom ťahu — pri braní zo šenku, v Zhromaždení alebo v Pitke."
        : schopnostBezUcinku(stav, ja, defId);
    const moje = ponuka.filter((c): c is Extract<Command, { type: "schopnostVazna" }> => c.type === "schopnostVazna" && c.elderId === elderId);
    const nadpis = `Schopnosť väzňa ${meno(defId)}`;
    const akcia: AkciaKseftu =
      defId === "farar"
        ? {
            typ: "volba",
            nadpis: `${nadpis} · ktoré NA EX`,
            riadky: moje.map((c) => {
              const pl = [...view.strany[0], ...view.strany[1]].find((x) => x.card.uid === c.uid);
              const kde = pl === undefined ? "" : pl.playedBy === ja ? " (tvoja)" : " (jeho)";
              return { kluc: String(c.uid), meno: `${meno(pl?.card.defId ?? "")}${kde}`, vpravo: { text: "zrušiť NA EX", prikaz: c } };
            }),
          }
        : defId === "hrobar"
          ? {
              typ: "volba",
              nadpis: `${nadpis} · karta zo súperovho šrotu`,
              riadky: moje.map((c) => ({ kluc: String(c.uid), meno: meno(view.hraci[su].odhadzovaci.find((k) => k.uid === c.uid)?.defId ?? ""), vpravo: { text: "vziať", prikaz: c } })),
            }
          : defId === "autobusar"
            ? {
                typ: "karty",
                nadpis: `${nadpis} · koľko kariet zo šenku`,
                karty: view.senok.map((k) => ({ uid: k.uid, meno: meno(k.defId) })),
                cenaZaKus: KONSTANTY.AUTOBUSAR_CENA,
                najviac: Math.floor(view.hraci[ja].cigarety / KONSTANTY.AUTOBUSAR_CENA),
                prikaz: (uids) => ({ type: "schopnostVazna", elderId, uids }),
              }
            : { typ: "prikaz", prikaz: { type: "schopnostVazna", elderId } };
    out.push({
      uid: v.karta.uid,
      druh: "vazen",
      defId,
      nazov: meno(defId),
      cena: { raz: true },
      zisk: ZISK_SCHOPNOSTI[defId] ?? "schopnosť",
      tip: `Schopnosť väzňa — raz za hru, kedy chceš (vo svojom ťahu): ${data.elders.get(elderId)?.schopnost ?? ""}`,
      dovod,
      pouzity,
      akcia,
    });
  }
  return out;
}
