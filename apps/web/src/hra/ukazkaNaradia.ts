// Ukážka Náradia na stole (/hra/ukazka-stola?stop=naradie): kým admin nezadá hrany Nástrojov
// do tvorcu (rozpracovaný stav, cards.json podľa pravidla 5), dostane ich sada len v prehliadači —
// texty zo zoznamu pre admina (packages/core/test/data/naradie-hrany.json, v5) a Nástroje bez slotov.
// Vedúcko, Sypač, Anonymný alkoholik a Tipér dostanú zápis Preškolenia na líci aj v hre (jadro ho
// číta z textu, packages/core/src/preskolenie.ts) — kým ho admin nezapíše do tvorcu.

import type { CardInstance, GameState, PlayerId } from "@naex/core";
import { opponentOf } from "@naex/core";
import type { Sada } from "@naex/tvorba";

const HRANY_NASTROJOV: Readonly<Record<string, string>> = {
  energetak: "Dedičstvo: Tvoje Posilnenie nemožno zrušiť NA EX. Hore: Forsáž. Dole: {Posilnenie}→{Pečeň}.",
  furik: "Dedičstvo: Tvoje Roboty pália o 1 Dlh viac. Hore: {Hazard}→{Robota}. Dole: {Robota}→{Hazard}.",
  horoskop: "Dedičstvo: Tvoje Povery majú silu 2. Hore: {Hazard}→{Povera}. Dole: {Povera}→{Hazard}.",
  hrable: "Dedičstvo: Akcia zrušená tvojím Odporom sa ráta ako tvoja a je posilnená. Hore: {Odpor}→{Posilnenie}. Dole: {Posilnenie}→{Odpor}.",
  lievik: "Dedičstvo: NA EX smieš dať aj na Zviera. Hore: Výtržník. Dole: {Poldeci}→{Pečeň}.",
  pistalka: "Dedičstvo: Tvoje Obmedzenia uberajú aj cigarety, ktoré súper dostane za pas. Hore: {Pečeň}→{Obmedzenie}. Dole: {Pecka}→{Obmedzenie}.",
  jogurt: "Dedičstvo: Tvoje Poldeci otáčajú vypitý poldeci hneď v Pitke, nie až v bitke. Hore: {Pečeň}→{Posilnenie}. Dole: {Pečeň}→{Hazard}.",
  cigorky: "Dedičstvo: Pitka: Za každé 2 cigarety, ktoré súper vyfajčí, si dober 1 kartu. Nie je to nerest. Hore: {Pečeň}→{Cigareta}. Dole: {Hazard}→{Cigareta}.",
  kristalova_gula: "Dedičstvo: Tvoje Vízie ukážu 2 vrchné karty — jednu si vezmi alebo spáľ, druhú vráť navrch. Hore: {Povera}→{Vízia}. Dole: {Vízia}→{Povera}.",
  nealko: "Dedičstvo: Tvoj prah Cirhózy je o 2 vyšší. Hore: {Pečeň}→{Viera}. Dole: {Poldeci}→{Viera}.",
  noviny: "Dedičstvo: Hádka: Ak vyhráš hádku, súper odhodí 1 náhodnú kartu z ruky. Hore: {Viera}→{Pohoršenie}. Dole: {Pohoršenie}→{Povera}.",
  pasca: "Dedičstvo: Bitka: Ak súper v tomto kole priložil kartu k tvojej {Rana}. Hore: {Pečeň}→{Rana}. Dole: {Pecka}→{Rana}.",
  puska: "Dedičstvo: Keď by tvoju prepojenú Petelicu zrušil iný efekt (Odpor, NA EX…), namiesto zrušenia udeľuje o 1 poškodenie menej. Hore: Posilnená {Petelica}. Dole: Posilnená {Pecka}.",
  svaty_text: "Dedičstvo: Hodnota tvojej Viery je o 1 vyššia. Hore: {Povera}→{Viera}. Dole: {Viera}→{Povera}.",
  telefon: "Dedičstvo: Tvoje Pohoršenia nemožno zrušiť Odporom a NA EX. Hore: {Povera}→{Pohoršenie}. Dole: {Odpor}→{Povera}.",
  boxer: "Dedičstvo: Tvoje Pecky udeľujú o 1 poškodenie viac. Hore: {Pecka}→{Petelica}. Dole: {Petelica}→{Pecka}.",
  vidly: "Dedičstvo: Tvoje Rany udeľujú o 1 poškodenie viac. Hore: Vzbura. Dole: {Rana}→{Pecka}.",
  vinko: "Dedičstvo: Počíta sa, akoby si mal plný poldeci navyše. Nemôžeš dolievať poldeci za cigarety. Hore: NA EX. Dole: {Pečeň}→{Poldeci}.",
  vyherne_zreby: "Dedičstvo: Tvoje Hazardy sú aktívne, keď nie sú spojené, a neaktívne, keď sú spojené. Hore: {Hazard}→{Vízia}. Dole: {Vízia}→{Hazard}.",
  vyherny_automat: "Dedičstvo: Tvoj prah Dlhu je o 1 vyšší. Posledná Pitka kola: {Hazard}. Hore: {Hazard}→{Poldeci}. Dole: {Cigareta}→{Hazard}.",
  zapalovac: "Dedičstvo: Tvoje aktívne Cigarety nemožno zrušiť NA EX. Hore: {Cigareta}→{Rana}. Dole: {Cigareta}→{Pečeň}.",
  zrkadlo: "Dedičstvo: Tvoj Pakt kopíruje prepojenú akciu dvakrát. Hore: {Odpor}→{Pakt}. Dole: {Pakt}→{Odpor}.",
};

/** Školitelia v zápise jadra (docs/napady/obcania-kategorie.json): text efektu a jeho spúšťač. */
const LICE_PRESKOLENIA: Readonly<Record<string, string>> = {
  veducko: "Podpora: Preškolenie {Robota}→{Pecka}.",
  kulturista: "Podpora: Preškolenie {Rana}→{Pecka}.",
  anonymny_alkoholik: "Podpora: Preškolenie {PoškodeniePečene}→{Viera}.",
  profesionalny_tiper: "Konflikt: Preškolenie {Cigareta}→{Dlh}.",
};
const SPUSTAC_PRESKOLENIA: Readonly<Record<string, string>> = { veducko: "Podpora", kulturista: "Podpora", anonymny_alkoholik: "Podpora", profesionalny_tiper: "Konflikt" };

/** Sada s hranami Nástrojov a so zápisom Preškolenia štyroch Občanov (hra aj líce). */
export function sadaSNaradim(sada: Sada): Sada {
  const bezSlotov = { blocked: [], actions: {} };
  const cards = (sada.cardsJson as { cards: { id: string; effect_text: string }[] }).cards.map((c) => {
    const lice = LICE_PRESKOLENIA[c.id];
    if (lice !== undefined) return { ...c, effect_text: lice, triggers: [SPUSTAC_PRESKOLENIA[c.id]] };
    const text = HRANY_NASTROJOV[c.id];
    return text === undefined ? c : { ...c, effect_text: text, left: bezSlotov, right: bezSlotov, permutations: { total: 1, left: 1, right: 1 } };
  });
  const prazdna = { blokovane: [], akcie: {}, povolene: {} };
  return {
    ...sada,
    karty: sada.karty.map((k) => {
      const hrany = HRANY_NASTROJOV[k.id];
      if (hrany !== undefined) return { ...k, efekt: hrany, lava: prazdna, prava: prazdna };
      const lice = LICE_PRESKOLENIA[k.id];
      return lice === undefined ? k : { ...k, efekt: lice };
    }),
    cardsJson: { ...(sada.cardsJson as object), cards },
  };
}

/**
 * Stôl s podloženými Nástrojmi: moje Vedúcko so Živnostníkom (Preškolenie Robota → Pecka),
 * môj Hasič s mojimi Vidlami (Rana → Pecka, trčí dole), Zámočník s dvoma Nástrojmi (môj Krabička
 * cigariet, súperov Zapaľovač), súperova Dievčina na vydaj s mojím Automatom (Cigareta → Hazard,
 * trčí hore), jeho Vandal s jeho Puškou (Posilnená Petelica) a Veštica s jeho Vínkom (NA EX); môj Sypač
 * a za ním Šofér so súperovým NA EX a mojou Puškou dole — Rany ako Pecky, posilnené, Valaška v Dedičstve: na jednej
 * akcii pôvodná akcia, iskra aj ×N naraz (Michal 2026-11-11), v pečati Pecka navyše ×2 (v11.22).
 * V ruke Puška, Energeťák a Pasca na zasunutie.
 */
export function sNaradim(s: GameState, p: PlayerId): GameState {
  let uid = s.nextUid;
  const su = opponentOf(p);
  const k = (defId: string): CardInstance => ({ uid: uid++, defId, leftLayout: 0, rightLayout: 0 });
  const strany: [GameState["strany"][0], GameState["strany"][1]] = [[], []];
  const veducko = k("veducko");
  const sypac = k("kulturista");
  strany[p] = [
    { card: veducko, playedBy: p },
    // Vedúcko je od v11.18 Podpora — Živnostník sa s ním stretol priložením.
    { card: k("zivnostnik"), playedBy: p, preskolenia: [{ z: "Robota", na: "Pecka", od: veducko.uid, spustac: "Podpora" }] },
    { card: k("hasic"), playedBy: p, podlozene: [{ card: k("vidly"), majitel: p, hrana: "dolna" }] },
    {
      card: k("zamocnik"),
      playedBy: p,
      podlozene: [
        { card: k("cigorky"), majitel: p, hrana: "horna" },
        { card: k("zapalovac"), majitel: su, hrana: "horna" },
      ],
    },
    { card: sypac, playedBy: p },
    { card: k("sofer"), playedBy: p, naexBy: su, podlozene: [{ card: k("puska"), majitel: p, hrana: "dolna" }], preskolenia: [{ z: "Rana", na: "Pecka", od: sypac.uid, spustac: "Podpora" }] },
  ];
  strany[su] = [
    { card: k("dievcina_na_vydaj"), playedBy: su, podlozene: [{ card: k("vyherny_automat"), majitel: p, hrana: "dolna" }] },
    { card: k("vandal"), playedBy: su, podlozene: [{ card: k("puska"), majitel: su, hrana: "horna" }] },
    { card: k("vestica"), playedBy: su, podlozene: [{ card: k("vinko"), majitel: su, hrana: "horna" }] },
  ];
  const h = { ...s.hraci[p], ruka: [k("puska"), k("energetak"), k("pasca"), ...s.hraci[p].ruka.slice(0, 2)], cigarety: Math.max(3, s.hraci[p].cigarety), dedicstvo: [...s.hraci[p].dedicstvo, k("boxer")] };
  return { ...s, nextUid: uid, strany, hraci: p === 0 ? [h, s.hraci[su]] : [s.hraci[su], h] };
}
