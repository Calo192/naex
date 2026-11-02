// Kšefty pod kartou (Michal 2026-11-02: „Chcem, aby to bolo vidno pod kartou, ktorá Kšeft
// ponúka.“) — predtým stáli na hrane stola medzi Fajčiť a Doliať. Tu je bez Reactu, čo pod
// ktorou kartou leží: Strýko v línii a lokalita s Kšeftom; schopnosti väzňov (v11.2, namiesto
// Kšeftu väzňa) v okne Pivnica. Ponuka je tá istá ako v legalCommands (jadro); čo sa nedá,
// ostane ako obrys s dôvodom.

import {
  KONSTANTY,
  NAZVY_ZON,
  VILA_CENA,
  jeCoTahat,
  opponentOf,
  ponukaSchopnostiVazna,
  schopnostBezUcinku,
  stavSchopnostiVaznaZPohladu,
  tahSchopnosti,
  type ClientState,
  type Command,
  type GameData,
} from "@naex/core";
import { klucVily, moznostiVily } from "./volbaVily.ts";

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
  /** Zberný dvor: karta z odhadzovacieho balíčka sa vyberá v pilulke (mode vykup). */
  | { readonly typ: "vykup" }
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

const KSEFT_KARTY: Readonly<Record<string, { readonly cena: number; readonly zisk: string; readonly tip: string }>> = {
  stryko_z_ameriky: { cena: KONSTANTY.EFEKT.STRYKO_CENA, zisk: "+1 Rana", tip: "Kšeft Strýka: za 2 cigarety udelíš v bitke tohto kola súperovi 1 Ranu navyše." },
  predavacka: { cena: KONSTANTY.EFEKT.PREDAVACKA_CENA, zisk: "+1 karta", tip: "Kšeft Predavačky: za 1 cigaretu si doberieš 1 kartu." },
};

const cigariet = (n: number): string => (n === 1 ? "1 cigaretu" : n >= 2 && n <= 4 ? `${n} cigarety` : `${n} cigariet`);

/**
 * Kšefty, ktoré má hráč teraz na stole — každý pod svojou kartou, a schopnosti jeho väzňov.
 * Kšefty sú prázdne mimo jeho Pitky (odpoveď na NA EX, po „Skončiť Pitku“); použitý Kšeft
 * ostane ako obrys s dôvodom.
 */
export function kseftyNaStole(data: GameData, view: ClientState): KseftNaStole[] {
  return [...kseftyPitky(data, view), ...schopnostiVaznov(data, view)];
}

function kseftyPitky(data: GameData, view: ClientState): KseftNaStole[] {
  const ja = view.ja;
  const su = opponentOf(ja);
  const pitka = view.pitkaStav;
  if (view.faza !== "pitka" || pitka === null || pitka.reakcia !== null || pitka.hotovy[ja]) return [];
  const h = view.hraci[ja];
  const meno = (defId: string): string => data.cards.get(defId)?.name ?? defId;
  const pouzite = pitka.kseft?.[ja] ?? [];
  const vizia = view.vizia !== null ? "Najprv dokonči Víziu." : null;
  const pouzityText = "Tento Kšeft si v tejto Pitke už použil.";
  const out: KseftNaStole[] = [];

  // Kšeft karty (v7): karta odkrytá v hráčovej partii, aj podstrčená k súperovi; skrytá Záverečná nie.
  for (const pl of [...view.strany[0], ...view.strany[1]]) {
    const k = KSEFT_KARTY[pl.card.defId];
    if (k === undefined || pl.playedBy !== ja || pl.zaverecna === true) continue;
    const uid = pl.card.uid;
    const pouzity = pouzite.includes(uid);
    out.push({
      uid,
      druh: "karta",
      defId: pl.card.defId,
      nazov: meno(pl.card.defId),
      cena: { cigarety: k.cena },
      zisk: k.zisk,
      tip: k.tip,
      dovod: pouzity
        ? pouzityText
        : vizia ??
          (h.cigarety < k.cena
            ? `${meno(pl.card.defId)} chce ${cigariet(k.cena)}, máš ${h.cigarety}.`
            : pl.card.defId === "predavacka" && !jeCoTahat(h.doberaciPocet, h.odhadzovaci.length)
              ? "Nemáš z čoho ťahať."
              : null),
      pouzity,
      akcia: { typ: "prikaz", prikaz: { type: "kseft", uid } },
    });
  }

  // Kšeft lokality — smie ho každý hráč, každý raz za Pitku.
  const lok = view.ciel?.lokalita ?? null;
  if (lok !== null) {
    const uid = lok.uid;
    const pouzity = pouzite.includes(uid);
    const spolu = (cena: number, zisk: string, tip: string, inak: string | null, akcia: AkciaKseftu): KseftNaStole => ({
      uid,
      druh: "lokalita",
      defId: lok.defId,
      nazov: meno(lok.defId),
      cena: { cigarety: cena },
      zisk,
      tip,
      dovod: pouzity ? pouzityText : vizia ?? (h.cigarety < cena ? `${meno(lok.defId)}: Kšeft stojí ${cigariet(cena)}, máš ${h.cigarety}.` : inak),
      pouzity,
      akcia,
    });
    if (lok.defId === "sklad")
      out.push(
        spolu(1, "karta súpera", "Kšeft Skladu: za cigaretu vrchná karta súperovho odhadzovacieho balíčka do tvojej ruky.", view.hraci[su].odhadzovaci.length === 0 ? "Súperov odhadzovací balíček je prázdny." : null, {
          typ: "prikaz",
          prikaz: { type: "kseft", uid },
        }),
      );
    if (lok.defId === "obecny_urad") {
      const c = KONSTANTY.EFEKT.URAD_CENA;
      out.push(spolu(c, "Dlh súperovi", `Kšeft Obecného úradu: za ${cigariet(c)} presunieš 1 svoj priznaný Dlh medzi súperove priznané.`, h.dlhy > 0 ? null : "Nemáš priznaný Dlh.", { typ: "prikaz", prikaz: { type: "kseft", uid } }));
    }
    if (lok.defId === "zberny_dvor") {
      const c = KONSTANTY.EFEKT.ZBERNY_DVOR_CENA;
      out.push(spolu(c, "karta zo šrotu", "Kšeft Zberného dvora: za cigaretu ľubovoľná karta z tvojho odhadzovacieho balíčka do ruky — vyberieš ju klikom.", h.odhadzovaci.length === 0 ? "Tvoj odhadzovací balíček je prázdny." : null, { typ: "vykup" }));
    }
    if (lok.defId === "predsedova_vila") {
      const moznosti = moznostiVily(view);
      out.push(
        spolu(VILA_CENA, "reči", `Kšeft Predsedovej vily: za ${cigariet(VILA_CENA)} zdvihneš svoje reči pri jednom staršom o stupeň — vyberieš ktorého.`, moznosti.length === 0 ? "Niet staršieho, pri ktorom by Vila smela zdvihnúť tvoje reči." : null, {
          typ: "volba",
          nadpis: "Kšeft vily · reči o stupeň",
          riadky: moznosti.map((m) => ({
            kluc: m.elderId,
            meno: meno(m.defId),
            // Jedno tlačidlo na staršieho (v11): reči o stupeň — zo stupňa na stupeň, nech je vidno, čo kúpi.
            vpravo: { text: `reči ${m.z === 0 ? "nič" : NAZVY_ZON[m.z]} → ${NAZVY_ZON[m.na]}`, prikaz: { type: "kseft", uid, elderId: m.elderId }, vyucba: klucVily(m.elderId) },
          })),
        }),
      );
    }
  }

  return out;
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
