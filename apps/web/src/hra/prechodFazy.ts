// Prechody fáz na stole (Michal 2026-10-27): línia starších zmizne, hneď ako prestane byť
// aktuálna, a pri prechode do novej fázy sa ukáže medziobrazovka (nadpis a 1–2 vety).

import { cigariet, KONSTANTY } from "@naex/core";
import type { ClientState, PlayerId } from "@naex/core";

/**
 * Kľúč fázy stola: mení sa pri každom prechode, ktorý hráča posúva k ďalšej práci —
 * nové kolo, výber lokality, šenok, patronát, Zhromaždenie, Pitka, bitka.
 */
export function klucPrechodu(view: Pick<ClientState, "kolo" | "faza" | "draftStav" | "pitkaCislo">): string {
  const krok = view.faza === "draft" ? (view.draftStav?.krok === "patronat" ? "patronat" : "senok") : "";
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
 * šenok, Zhromaždenie, Pitka, bitka, prebytok, nové kolo, finále). Patronát a Pohoršenie
 * ju nemajú — sú to kroky vnútri fáz. Finále nahradilo starý oznam finále.
 * `bitkaKola` = kolo bitky, ktorej počítadlo čaká na stole — bitka sa často vyhodnotí
 * naraz s koncom kola a stôl je už v ďalšom kole, kým počítadlo len začína.
 */
export function medziobrazovka(
  view: Pick<ClientState, "kolo" | "faza" | "utocnik" | "pitkaCislo" | "pitkyCelkom" | "lokalitCelkom" | "rozpis" | "bitkaStav" | "koniec" | "ciel" | "spaky"> & {
    readonly pitkaStav?: { readonly bzdocha?: PlayerId | null } | null;
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
  if (bitkaKola !== null || (view.faza === "bitka" && view.bitkaStav?.krok !== "prebytok")) {
    return {
      kluc: `${bitkaKola ?? view.kolo}|bitka`,
      nadnadpis: `Kolo ${bitkaKola ?? view.kolo}`,
      nadpis: "Bitka",
      text: "Spočíta sa poškodenie z línie. Delí sa na tuhé (Rana, Pecka, Petelica) a mäkké (Povera): viac tuhého vyhráva bitku a špaky, viac celkového dáva prebytok na posun starších. Sleduj počítadlo — rozhoduješ až pri Pohoršení či prebytku.",
    };
  }
  const obranca = view.utocnik !== ja;
  switch (view.faza) {
    case "volbaCiela": {
      // Pred finále (§14b): vedúci vyberá vrcholovú lokalitu, útočí zaostávajúci. Okno Finále
      // príde až s vybranou lokalitou (návrh #32) — teraz len kto vyberá.
      if (view.rozpis !== undefined && view.kolo > view.lokalitCelkom) {
        const rovnako = view.spaky[0] === view.spaky[1];
        const kto = rovnako
          ? obranca
            ? `Špakov máte rovnako, útočí ${S} — po prehre v poslednej bitke; ty vyberáš a natáčaš vrcholovú lokalitu.`
            : `Špakov máte rovnako, útočíš ty — po prehre v poslednej bitke; ${S} vyberá a natáča vrcholovú lokalitu.`
          : obranca
            ? `Vedieš, preto vyberáš a natáčaš vrcholovú lokalitu; ${S} má menej špakov a útočí.`
            : `Máš menej špakov, preto útočíš; ${S} vedie a vyberá a natáča vrcholovú lokalitu.`;
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
            ? "Vyber lokalitu, o ktorú sa v tomto kole bije, a natoč ju — natočenie určí, ktorá jej hrana pripadne ktorému kraju línie."
            : `${S} ako obranca vyberá a natáča lokalitu. Ty útočíš: zo šenku berieš prvý, vykladáš prvý a v Pitke máš posledné slovo.`,
      };
    }
    case "draft":
      // Finále sa ohlási až s vybranou vrcholovou lokalitou (návrh #32), namiesto šenku.
      if (view.ciel?.typ === "finale") {
        return {
          kluc: `${view.kolo}|finale`,
          nadnadpis: "Posledná bitka",
          nadpis: "Finále",
          text:
            "Bije sa o vrcholovú lokalitu ako o každú inú: Pitiek je podľa spojov s lokalitou, víťaz dostane 1 špak za každú kartu v línii. " +
            "Prebytok rozdelí jeho držiteľ a nové zóny strachu sa vyplatia ešte po finále.",
        };
      }
      return {
        kluc: `${view.kolo}|senok`,
        nadnadpis: kolo,
        nadpis: "Šenok",
        text:
          "Každý dostane karty zo spoločného balíčka a tajne ich rozdelí: polovica pôjde do šenku, polovica naspodok. " +
          `Potom beriete zo šenku striedavo, začína útočník — 1 karta za ${cigariet(KONSTANTY.CENA_SENKU[1] ?? 1)}, 2 karty za ${cigariet(KONSTANTY.CENA_SENKU[2] ?? 3)}.`,
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
              }${view.pitkaStav?.bzdocha != null ? "" : obranca ? ` — na ne odpovedáš prvý, ${S} má posledné slovo.` : " — posledné slovo máš ty."}`,
      };
    case "bitka": {
      // v8: prebytok rozdeľuje ten, proti komu sa ráta (vo finále držiteľ).
      const drzi = view.bitkaStav?.prebytokDrzi ?? null;
      const vyberam = view.bitkaStav?.caka === ja;
      const text =
        drzi === ja
          ? vyberam
            ? "Máš vyššie celkové poškodenie. Rozdeľ prebytok medzi starších — každý bod posunie marker o pole k súperovi; nové zóny strachu sa vyplatia ešte po finále."
            : `Máš vyššie celkové poškodenie: každý bod prebytku posunie marker o pole k súperovi a starší sa začnú báť teba. Ktorých, vyberá ${S}.`
          : vyberam
            ? `${S} má vyššie celkové poškodenie: prebytok posunie markery k tebe, ale ktorých starších, vyberáš ty — vezmi si priazne, ktoré sa ti hodia. Za každého posunutého staršieho dostaneš cigaretu.`
            : `${S} má vyššie celkové poškodenie a rozdeľuje prebytok medzi starších — ich markery pôjdu k tebe.`;
      return { kluc: `${view.kolo}|prebytok`, nadnadpis: kolo, nadpis: "Prebytok", text };
    }
    default:
      return null;
  }
}
