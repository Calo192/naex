// Kšefty pod kartou (Michal 2026-11-02: „Chcem, aby to bolo vidno pod kartou, ktorá Kšeft
// ponúka.“) — predtým stáli na hrane stola medzi Fajčiť a Doliať. Tu je bez Reactu, čo pod
// ktorou kartou leží: Strýko v línii, lokalita s Kšeftom a väzni v pivnici. Ponuka je tá istá
// ako v legalCommands (jadro); čo sa nedá, ostane pod kartou ako obrys s dôvodom.

import {
  KONSTANTY,
  VILA_CENA,
  jeCoTahat,
  opponentOf,
  ponukaKseftuVazna,
  stavKseftuVaznaZPohladu,
  zakazVypit,
  type CardInstance,
  type ClientState,
  type Command,
  type GameData,
} from "@naex/core";
import { klucVily, moznostiVily } from "./volbaVily.ts";

/** Čím sa Kšeft platí: cigarety (karty, lokality) alebo vypitý plný poldeci (väzeň). */
export type CenaKseftu = { readonly cigarety: number } | { readonly poldeci: 1 };

/** Tlačidlo v ponuke Kšeftu — jeden presný príkaz. */
export interface TlacidloVolby {
  readonly text: string;
  readonly prikaz: Command;
  /** Kľúč pre výučbu (Kšeft vily: kseft:<starší>:<1|0>). */
  readonly vyucba?: string;
}

/** Riadok ponuky: pri vile starší s „k sebe“ a „od seba“, pri väzňovi karta, ktorú vezme či zahodí. */
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
  | { readonly typ: "vykup" };

export interface KseftNaStole {
  /** Karta, pod ktorou tlačidlo leží (pri väzňovi karta staršieho). */
  readonly uid: number;
  readonly druh: "karta" | "lokalita" | "vazen";
  readonly defId: string;
  readonly cena: CenaKseftu;
  /** Čo hráč dostane — krátko na tlačidle. */
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

/** Krátky zisk Kšeftu väzňa na tlačidle — celé znenie je v texte karty staršieho. */
const ZISK_VAZNA: Readonly<Record<string, string>> = {
  hrobar: "súper odhodí",
  farar: "Viera = Hazard",
  autobusar: "karta zo šenku",
  starosta: "hrany posilnené",
  postarka: "Dlh súperovi",
  krcmarka: "súper bez NA EX",
  vychovavatelka: "Petelica za NA EX",
  veterinar: "bez pečene",
};

/** Prečo väzeň Kšeft neponúkne, hoci poldeci je (Nie naprázdno, §7). */
const NAPRAZDNO: Readonly<Record<string, string>> = {
  hrobar: "Súper nemá v ruke kartu.",
  farar: "Farár už platí do konca kola.",
  autobusar: "Šenok je prázdny.",
  starosta: "Starosta už platí do konca kola (alebo nie je lokalita).",
  postarka: "Nemáš priznaný Dlh.",
  krcmarka: "Súper v tejto Pitke NA EX dať nemôže.",
  vychovavatelka: "Súper v tejto Pitke NA EX nedá (Krčma, Krčmárka alebo bez plného poldeci).",
};

const cigariet = (n: number): string => (n === 1 ? "1 cigaretu" : n >= 2 && n <= 4 ? `${n} cigarety` : `${n} cigariet`);

/**
 * Kšefty, ktoré má hráč teraz na stole — každý pod svojou kartou. Prázdne mimo jeho Pitky
 * (odpoveď na NA EX, po „Skončiť Pitku“); použitý Kšeft ostane ako obrys s dôvodom.
 */
export function kseftyNaStole(data: GameData, view: ClientState): KseftNaStole[] {
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
        spolu(VILA_CENA, "posun staršieho", `Kšeft Predsedovej vily: za ${cigariet(VILA_CENA)} posunieš marker jedného staršieho o pole k sebe alebo od seba — vyberieš ktorého a kam.`, moznosti.length === 0 ? "Niet staršieho, ktorého by Vila smela posunúť." : null, {
          typ: "volba",
          nadpis: "Kšeft vily · posuň marker o pole",
          riadky: moznosti.map((m) => ({
            kluc: m.elderId,
            meno: meno(m.defId),
            vlavo: { text: "‹ k sebe", prikaz: { type: "kseft", uid, elderId: m.elderId, kSebe: true }, vyucba: klucVily(m.elderId, true) },
            vpravo: { text: "od seba ›", prikaz: { type: "kseft", uid, elderId: m.elderId, kSebe: false }, vyucba: klucVily(m.elderId, false) },
          })),
        }),
      );
    }
  }

  // Kšeft väzňa (v9): len držiteľ, za vypitý plný poldeci, každý väzeň raz za Pitku.
  const ponuka = ponukaKseftuVazna(stavKseftuVaznaZPohladu(view), ja);
  const volnePoldeci = h.poldeciPlne - (pitka.skryteNaex ?? []).filter((x) => x.hrac === ja).length;
  const karty: readonly CardInstance[] = [...view.senok, ...view.ruka, ...h.priznane];
  for (const v of view.vazni.filter((x) => x.hrac === ja)) {
    const defId = v.karta.defId;
    const uid = v.karta.uid;
    const pouzity = pouzite.includes(uid);
    const moznosti = ponuka.filter((c): c is Extract<Command, { type: "kseftVazna" }> => c.type === "kseftVazna" && c.elderId === v.elderId);
    const dovod = pouzity
      ? "Kšeft tohto väzňa si v tejto Pitke už použil."
      : vizia ??
        (zakazVypit(view)
          ? "Kostol: nikto nesmie vypiť — Kšeft väzňa nejde."
          : volnePoldeci <= 0
            ? "Kšeft väzňa chce plný poldeci zo zásoby (nie ten na NA EX) — nemáš."
            : moznosti.length === 0
              ? (NAPRAZDNO[defId] ?? "Kšeft by teraz nemal čo urobiť.")
              : null);
    const sKartou = moznosti.filter((c) => c.kartaUid !== undefined);
    const bezKarty = moznosti.find((c) => c.kartaUid === undefined);
    // Autobusár (karta zo šenku) a Veterinár (Cirhóza z ruky či priznaná) — najprv voľba karty.
    const akcia: AkciaKseftu =
      sKartou.length > 0
        ? {
            typ: "volba",
            nadpis: `Kšeft väzňa ${meno(defId)} · za vypitý poldeci`,
            riadky: [
              ...(bezKarty === undefined ? [] : [{ kluc: "bez", meno: "bez karty", vpravo: { text: "len pečeň", prikaz: bezKarty } }]),
              ...sKartou.map((c) => ({
                kluc: String(c.kartaUid),
                meno: meno(karty.find((k) => k.uid === c.kartaUid)?.defId ?? ""),
                vpravo: { text: defId === "autobusar" ? "vziať" : "zahodiť", prikaz: c },
              })),
            ],
          }
        : { typ: "prikaz", prikaz: bezKarty ?? { type: "kseftVazna", elderId: v.elderId } };
    out.push({
      uid,
      druh: "vazen",
      defId,
      cena: { poldeci: 1 },
      zisk: defId === "veterinar" && sKartou.length > 0 ? "Cirhóza preč" : (ZISK_VAZNA[defId] ?? "Kšeft"),
      tip: `Kšeft väzňa — za vypitý plný poldeci (nerest, pečeň +1, v ďalšom Zhromaždení limit −1): ${(data.cards.get(defId)?.effectText ?? "").replace(/^Väzeň — Kšeft:\s*/, "")}`,
      dovod,
      pouzity,
      akcia,
    });
  }
  return out;
}

/** Väzni hráča, ktorých pivnica leží na stole — len v jeho Pitke, keď smie Kšeftovať. */
export function vazniNaStole(view: ClientState): readonly ClientState["vazni"][number][] {
  const pitka = view.pitkaStav;
  if (view.faza !== "pitka" || pitka === null || pitka.reakcia !== null || pitka.hotovy[view.ja]) return [];
  return view.vazni.filter((v) => v.hrac === view.ja);
}
