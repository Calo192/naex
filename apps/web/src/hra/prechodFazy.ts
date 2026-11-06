// Prechody fáz na stole (Michal 2026-10-27): línia starších zmizne, hneď ako prestane byť
// aktuálna, a pri prechode do novej fázy sa ukáže medziobrazovka (nadpis a 1–2 vety).

import { cigariet, KONSTANTY, opponentOf } from "@naex/core";
import type { ClientState, PlayerId } from "@naex/core";
import { CENA_POLA } from "./textyStarsich.ts";

/**
 * Kľúč fázy stola: mení sa pri každom prechode, ktorý hráča posúva k ďalšej práci —
 * nové kolo, výber lokality, šenok, Zhromaždenie, Pitka, bitka.
 */
export function klucPrechodu(view: Pick<ClientState, "kolo" | "faza" | "draftStav" | "pitkaCislo">): string {
  const krok = view.faza === "draft" ? "senok" : "";
  return `${view.kolo}|${view.faza}|${krok}|${view.faza === "pitka" ? view.pitkaCislo : ""}`;
}

/** Medziobrazovka pri prechode fázy: veľký nadpis a 1–2 vety, čo sa ide diať a čo má hráč urobiť. */
export interface Medziobrazovka {
  readonly kluc: string;
  /** Malý riadok nad nadpisom (kolo, finále). */
  readonly nadnadpis: string;
  readonly nadpis: string;
  readonly text: string;
}

/**
 * Medziobrazovka pre to, čo sa na stole práve začína (Michal 2026-10-27: výber lokality,
 * šenok, Zhromaždenie, Pitka, hádka (v10), bitka, prebytok, nové kolo, finále). Finále nahradilo
 * starý oznam finále.
 * `bitkaKola` = kolo bitky, ktorej počítadlo čaká na stole — bitka sa často vyhodnotí
 * naraz s koncom kola a stôl je už v ďalšom kole, kým počítadlo len začína.
 */
export function medziobrazovka(
  view: Pick<ClientState, "kolo" | "faza" | "utocnik" | "pitkaCislo" | "pitkyCelkom" | "lokalitCelkom" | "rozpis" | "bitkaStav" | "koniec" | "ciel" | "spaky" | "vitazPoslednejHadky"> & {
    readonly pitkaStav?: { readonly bzdocha?: PlayerId | null } | null;
    readonly draftStav?: { readonly krok: string } | null;
  },
  ja: PlayerId,
  menoSupera: string,
  bitkaKola: number | null,
): Medziobrazovka | null {
  if (view.koniec !== null) return null;
  const S = menoSupera;
  // Vo finále sa kolo nepočíta — nad nadpisom stojí „Finále“.
  const kolo = view.rozpis !== undefined && view.kolo > view.lokalitCelkom ? "Finále" : `Kolo ${view.kolo}`;
  /** Poradie Zhromaždenia či Pitky v kole ide nad nadpis — dlhý nadpis by sa zalomil. */
  const poradie = (n: number): string => (view.pitkyCelkom > 1 ? `${kolo} · ${n} z ${view.pitkyCelkom}` : kolo);
  // Hádka (v10): jednorazové okno, keď víťaz hádky rozdeľuje — pred poškodením, ešte bez počítadla.
  const hd = view.bitkaStav?.hadka;
  if (bitkaKola === null && view.faza === "bitka" && view.bitkaStav?.krok === "hadka" && hd !== undefined && hd.vitaz !== null && hd.zostava > 0) {
    const skore = `${hd.makke[hd.vitaz]} : ${hd.makke[opponentOf(hd.vitaz)]}`;
    return {
      kluc: `${view.kolo}|hadka`,
      nadnadpis: kolo,
      nadpis: "Hádka",
      text:
        hd.vitaz === ja
          ? `Vyhral si hádku ${skore} — o ${hd.velkost}. Po bitke ju rozdelíš na svoje reči pri starších (${CENA_POLA}). Priazne sa nemenia.`
          : `${S} vyhral hádku ${skore} — o ${hd.velkost} — a po bitke ju rozdelí na svoje reči pri starších. Priazne sa nemenia; teraz príde poškodenie.`,
    };
  }
  if (bitkaKola !== null || (view.faza === "bitka" && view.bitkaStav?.krok !== "prebytok")) {
    return {
      kluc: `${bitkaKola ?? view.kolo}|bitka`,
      nadnadpis: `Kolo ${bitkaKola ?? view.kolo}`,
      nadpis: "Bitka",
      text: "Najprv hádka: Pohoršenia a Povery sú mäkké poškodenie — kto ho má viac, vyhral hádku a po bitke ju rozdelí na svoje reči. Potom poškodenie: viac tuhého (Rana, Pecka, Petelica) vyhráva bitku a špaky, rozdiel tuhého je Nakladačka na strach víťaza.",
    };
  }
  const obranca = view.utocnik !== ja;
  // v11.11: minulú hádku vyhral útočník, takže lokalitu vyberá obranca a natáča útočník.
  const natacaUtocnik = view.vitazPoslednejHadky === view.utocnik;
  const vyberas = natacaUtocnik ? "vyberáš" : "vyberáš a natáčaš";
  const vybera = natacaUtocnik ? "vyberá" : "vyberá a natáča";
  const ktoNataca = !natacaUtocnik ? "" : obranca ? ` Natočí ju ${S}, víťaz minulej hádky.` : " Natočíš ju ty, víťaz minulej hádky.";
  switch (view.faza) {
    case "volbaCiela": {
      // Pred finále (§14b): vedúci vyberá vrcholovú lokalitu, útočí zaostávajúci. Okno Finále
      // príde až s vybranou lokalitou (návrh #32) — teraz len kto vyberá.
      if (view.rozpis !== undefined && view.kolo > view.lokalitCelkom) {
        const rovnako = view.spaky[0] === view.spaky[1];
        const kto = rovnako
          ? obranca
            ? `Špakov máte rovnako, útočí ${S} — po prehre v poslednej bitke; ty ${vyberas} vrcholovú lokalitu.${ktoNataca}`
            : `Špakov máte rovnako, útočíš ty — po prehre v poslednej bitke; ${S} ${vybera} vrcholovú lokalitu.${ktoNataca}`
          : obranca
            ? `Vedieš, preto ${vyberas} vrcholovú lokalitu; ${S} má menej špakov a útočí.${ktoNataca}`
            : `Máš menej špakov, preto útočíš; ${S} vedie a ${vybera} vrcholovú lokalitu.${ktoNataca}`;
        return {
          kluc: `${view.kolo}|lokalita-finale`,
          nadnadpis: "Posledná bitka",
          nadpis: "Výber vrcholovej lokality",
          text: kto,
        };
      }
      return {
        kluc: `${view.kolo}|lokalita`,
        nadnadpis: kolo,
        nadpis: "Výber lokality",
        text: obranca
            ? natacaUtocnik
              ? `Vyber lokalitu, o ktorú sa v tomto kole bije.${ktoNataca}`
              : "Vyber lokalitu, o ktorú sa v tomto kole bije, a natoč ju — natočenie určí, ktorá jej hrana pripadne ktorému kraju línie."
            : `${S} ako obranca ${vybera} lokalitu.${ktoNataca} Ty útočíš: zo šenku berieš druhý, vykladáš prvý a na NA EX odpovedáš prvý.`,
      };
    }
    case "natocenieCiela":
      return {
        kluc: `${view.kolo}|natocenie`,
        nadnadpis: kolo,
        nadpis: "Natočenie lokality",
        text: !obranca
          ? `Minulá hádka je tvoja, preto lokalitu natáčaš ty — natočenie určí, ktorá jej hrana pripadne ktorému kraju línie.`
          : `Lokalita je vybraná. Natáča ju ${S}, víťaz minulej hádky.`,
      };
    case "draft":
      // Finále sa ohlási až s vybranou vrcholovou lokalitou (návrh #32), namiesto šenku.
      if (view.ciel?.typ === "finale") {
        return {
          kluc: `${view.kolo}|finale`,
          nadnadpis: "Posledná bitka",
          nadpis: "Finále",
          text:
            "Bije sa o vrcholovú lokalitu ako o každú inú: Pitiek je podľa spojov s lokalitou, víťaz dostane 1 špak za každú kartu v línii. " +
            "Nakladačka ani hádka sa nerozdeľujú — víťaz ich dostane v špakoch; starší po finále bodujú ako po každej bitke.",
        };
      }
      return {
        kluc: `${view.kolo}|senok`,
        nadnadpis: kolo,
        nadpis: "Šenok",
        text:
          `Každý dostane ${KONSTANTY.STAVBA_NARADIE} karty z Náradia a ${KONSTANTY.STAVBA_OBCANIA} z Občanov a tajne ich rozdelí: polovica pôjde do šenku, polovica naspodok. ` +
          `Potom beriete zo šenku striedavo, začína obranca (na prvom ťahu len 1 kartu) — 1 karta za ${cigariet(KONSTANTY.CENA_SENKU[1] ?? 1)}, 2 karty za ${cigariet(KONSTANTY.CENA_SENKU[2] ?? 3)}.`,
      };
    case "zhromazdenie": {
      const n = view.pitkaCislo + 1;
      return {
        kluc: `${view.kolo}|zhromazdenie|${n}`,
        nadnadpis: poradie(n),
        nadpis: "Zhromaždenie",
        text:
          (obranca ? `${S} vykladá prvý, potom sa striedate.` : "Vykladáš prvý, potom sa so súperom striedate.") +
          " Kladieš karty z ruky k lokalite tak, aby sa ich akcie spojili; keď už nechceš, pasuj — za každú kartu, ktorú si ešte smel vyložiť, dostaneš cigaretu.",
      };
    }
    case "pitka":
      return {
        kluc: `${view.kolo}|pitka|${view.pitkaCislo}`,
        nadnadpis: poradie(view.pitkaCislo),
        nadpis: "Pitka",
        // Pitka naraz (Michal 2026-10-27): hrajú obaja súčasne, len Bzdocha čaká na súpera.
        text:
          view.pitkaStav?.bzdocha === ja
            ? `Máš Bzdochu: počkáš, kým ${S} skončí Pitku, potom hráš a vidíš jeho NA EX.`
            : `Hráte obaja naraz: fajči, dolievaj a skryto vyber NA EX, potom „Skončiť Pitku“. ${
                view.pitkaStav?.bzdocha != null ? `${S} má Bzdochu — hrá až po tebe a uvidí tvoje NA EX.` : "NA EX sa odkryjú, keď skončíte obaja"
              }${view.pitkaStav?.bzdocha != null ? "" : obranca ? ` — ${S} na ne odpovie prvý lícom dole, ty potom na druhý kraj; otočia sa naraz.` : " — na ne odpovieš prvý lícom dole, súper potom na druhý kraj; otočia sa naraz."}`,
      };
    case "bitka": {
      // v11: Nakladačku rozdeľuje víťaz bitky na svoj strach (vo finále sa nerozdeľuje).
      const drzi = view.bitkaStav?.prebytokDrzi ?? null;
      const vyberam = view.bitkaStav?.caka === ja;
      const text =
        drzi === ja
          ? vyberam
            ? `Vyhral si bitku. Rozdeľ Nakladačku na svoj strach — klikni na stupeň v teplomeri pri staršom (${CENA_POLA}); staršieho na červenom strachu smieš za ${KONSTANTY.CENA_ZAJATIA} zajať. Čo už nikam nestačí, prepadne.`
            : "Vyhral si bitku — Nakladačka ide na tvoj strach."
          : `${S} vyhral bitku a rozdeľuje Nakladačku na svoj strach — starší sa ho začnú báť viac a priazeň sa posunie k tebe.`;
      return { kluc: `${view.kolo}|Nakladačka`, nadnadpis: kolo, nadpis: "Nakladačka", text };
    }
    default:
      return null;
  }
}

/** Krok, ktorý sa robí na staršom (hádka, Nakladačka) — vtedy stôl ukazuje líniu starších. */
export interface KrokNaStarsich {
  readonly typ: "reci" | "prebytok";
  readonly kto: PlayerId;
}

export function krokNaStarsich(view: Pick<ClientState, "koniec" | "faza" | "bitkaStav" | "draftStav">): KrokNaStarsich | null {
  if (view.koniec !== null) return null;
  const bs = view.bitkaStav;
  if (view.faza === "bitka" && bs !== null && bs.caka !== null && (bs.krok === "reci" || bs.krok === "prebytok")) {
    return { typ: bs.krok, kto: bs.caka };
  }
  return null;
}

/**
 * Hráč má ťah, ktorý sa robí na stole — voľba cieľa na nástenke, stavba a branie šenku,
 * Zhromaždenie, Pitka, kroky bitky na kartách. Línia starších by ho zakryla.
 */
export function tahNaStole(view: Pick<ClientState, "koniec" | "faza" | "bitkaStav" | "draftStav">, somNaTahu: boolean): boolean {
  return somNaTahu && view.koniec === null && krokNaStarsich(view) === null;
}

/**
 * Či stôl ukazuje líniu starších (bez pauzy, ťahania a počítadla bitky, tie rieši stôl): len
 * v kroku na staršom, po kliku na Starší a vo výučbe. Po súperovom posune markerov ani po
 * skončenom kroku sa sama neotvorí — hráč na nej zastal, hoci mal ťah na stole (Michal 2026-10-30:
 * pred stavbou šenku); posuny neskôr ukáže animácia.
 */
export function starsiNaStole(o: { readonly krok: boolean; readonly nahliadnutie: boolean; readonly rucne: boolean; readonly vyucba: boolean }): boolean {
  return o.krok ? !o.nahliadnutie : o.rucne || o.vyucba;
}
