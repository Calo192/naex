// Karta v hre: inštancia zo stavu hry → líce karty so živým vyhodnotením.
//
// Hráči sedia oproti sebe: kartu, ktorú zahral súper, vidíš otočenú o 180°,
// takže sa na spoji stretávajú akcie otočené proti sebe ako na stole.
// Kreslí sa vždy vytlačené rozloženie (v ňom je aj vyhodnotenie línie)
// a otočenie robí CSS — ľavá strana sa tak sama stane pravou s obráteným
// poradím slotov. Na čítanie ju narovná lupa (Lupa.tsx).

import { createContext, useContext } from "react";
import type { CardInstance, CardLineEval, ClientState, GameData, KtoraHrana, NavyseStav, PlayerId, PodlozenyNastroj } from "@naex/core";
import { akciaVytrznika, cieleVykladania, defOf, efektyNavyse, menoAkcie, printedSides, stavNavyseVRuke, ucinkyNastrojov } from "@naex/core";
import type { KartaNavrh, RozlozenieStrany, Sada } from "@naex/tvorba";
import { PREDVOLENE_NASTAVENIA } from "@naex/tvorba";
import { KartaLico, type NavyseNaKarte, type PreskolenieNaKarte, type RohSlotu, type SlotStav, type ZarNaKarte } from "../karta/KartaLico.tsx";
import { preskoleniaZTextu } from "../karta/preskolenie.ts";
import { zarSlotu } from "../karta/zar.ts";
import { vzhladSady } from "../lib/sada.tsx";
import { nazovKarty, t } from "../i18n/jazyk.tsx";
import { PeciatkyKarty, type NaexNaKarte, type StavNaKarte } from "./PeciatkaNaex.tsx";

/**
 * Stôl pre žeravé ikony: komu karta patrí (ruka, línia) a čo mu posilňuje
 * Dedičstvo. Mimo stola (náhľady, šenok, tvorca) karta nežhne.
 */
export interface ZarStola {
  readonly view: Pick<ClientState, "ja" | "ruka" | "strany" | "vplyvyAkcii" | "hraci">;
  /** Kedy sa ktorá zmena ikony ukázala prvý raz — iskra odletí len pri prvom zobrazení. */
  readonly videne: Map<string, number>;
  /** Pečate Nástrojov v Dedičstve (LineEval.navyseDedicstva) podľa uid karty. */
  readonly navyseDedicstva?: ReadonlyMap<number, readonly NavyseStav[]>;
  /** Vyhodnotenie línie podľa uid — pečať Preškolenia počíta, koľko akcií susedov práve mení. */
  readonly evaly?: ReadonlyMap<number, CardLineEval>;
}

export const ZarStolaKontext = createContext<ZarStola | null>(null);

/** Ako dlho po prvom zobrazení beží iskra (karta.css kl-iskra-let) — prekreslenie ju nepreruší. */
const TRVANIE_ISKRY_MS = 1200;

/** Kde karta leží a komu patrí — ruka hráča, línia a Dedičstvo. */
function miestoKarty(view: ZarStola["view"], uid: number): { readonly majitel: PlayerId; readonly miesto: "ruka" | "linia" | "dedicstvo" } | null {
  for (const strana of view.strany) {
    const pl = strana.find((x) => x.card.uid === uid);
    if (pl !== undefined) return { majitel: pl.playedBy, miesto: "linia" };
  }
  if (view.ruka.some((k) => k.uid === uid)) return { majitel: view.ja, miesto: "ruka" };
  for (const p of [0, 1] as const) if (view.hraci[p].dedicstvo.some((k) => k.uid === uid)) return { majitel: p, miesto: "dedicstvo" };
  return null;
}

/**
 * Šípky pečate pri Podpore a Konflikte (Michal 2026-11-08): ktorá vytlačená strana karty
 * susedí s kartou, s ktorou sa efekt spustil. V globálnom ráme leží hráč 0 vľavo od lokality
 * (vnútorný sused vpravo), hráč 1 vpravo; karta hráča 1 je otočená, jej vytlačená ľavá je vpravo.
 */
function sipkyKSusedom(view: ZarStola["view"], uid: number, od: readonly number[]): { readonly lava: boolean; readonly prava: boolean } {
  const out = { lava: false, prava: false };
  for (const s of [0, 1] as const) {
    const strana = view.strany[s];
    const i = strana.findIndex((x) => x.card.uid === uid);
    const pl = strana[i];
    if (pl === undefined) continue;
    const vnutorny = strana[i - 1]?.card.uid;
    const vonkajsi = strana[i + 1]?.card.uid;
    const otocena = pl.playedBy === 1;
    for (const u of od) {
      // Globálne vľavo: pri hráčovi 0 vonkajší sused, pri hráčovi 1 vnútorný.
      const vlavo = u === (s === 0 ? vonkajsi : vnutorny);
      const vpravo = u === (s === 0 ? vnutorny : vonkajsi);
      if (vlavo) out[otocena ? "prava" : "lava"] = true;
      if (vpravo) out[otocena ? "lava" : "prava"] = true;
    }
  }
  return out;
}

export function vzhladKarty(sada: Sada, data: GameData, defId: string): KartaNavrh {
  const k = sada.karty.find((x) => x.id === defId);
  if (k !== undefined) return k;
  const def = data.cards.get(defId);
  return {
    id: defId,
    nazov: def?.name ?? defId,
    tagy: def?.tags ?? [],
    efekt: def?.effectText ?? "",
    obrazok: null,
    farba: null,
    ...PREDVOLENE_NASTAVENIA,
    kopie: 1,
    lava: { blokovane: [], akcie: {}, povolene: {} },
    prava: { blokovane: [], akcie: {}, povolene: {} },
    upravene: 0,
  };
}

export interface HernaKartaProps {
  readonly karta: CardInstance;
  readonly sada: Sada;
  readonly data: GameData;
  readonly sirka: number;
  readonly otocena?: boolean;
  readonly eval?: CardLineEval | null;
  readonly onClick?: (() => void) | undefined;
  readonly vybrana?: boolean;
  readonly bezPopisov?: boolean;
  /** Vytlačená strana, ktorou sa karta páruje k lokalite (návrh vyloženia). */
  readonly hranaVnutorna?: "left" | "right" | undefined;
  /** Sloty vytlačených strán (indexy zhora), ktoré vytvoria spoj — výber miesta na stole. */
  readonly spoj?: { readonly left: readonly number[]; readonly right: readonly number[] } | undefined;
  /** Vytlačené strany s jamkami na prázdnych indexoch (ruka, otvorená hrana línie). */
  readonly jamky?: { readonly left: boolean; readonly right: boolean } | undefined;
  /** Zrážka NA EX (v5): karta je počas bitky Výtržník — každá jej akcia je Rana pre majiteľa. */
  readonly vytrznik?: boolean | undefined;
  /** Prepínač výberu (stavba šenku): aria-pressed a pri plnom výbere aria-disabled. */
  readonly stlacena?: boolean | undefined;
  readonly zakazana?: boolean | undefined;
  /** Nástroje pod kartou v línii (aj zasunutý v návrhu) — nápoveda premeneného slotu povie, ktorý ho zmenil. */
  readonly podlozene?: readonly PodlozenyNastroj[] | undefined;
  /** Karta Nástroja v lupe podloženého Nástroja: pretŕčajúca hrana. */
  readonly aktivnaHrana?: KtoraHrana | undefined;
  /** NA EX na karte v línii — pečiatka cez ilustráciu, aj v lupe. */
  readonly naex?: NaexNaKarte | undefined;
  /** Stavy z línie, ktoré karta sama nevie (Výtržník s menom, VYHRAL! na lokalite) — pečiatky medzi NA EX. */
  readonly stavy?: readonly StavNaKarte[] | undefined;
  /** Komu sú Rany Výtržníka („teba“ či meno) — riadok pod pečiatkou VÝTRŽNÍK!. */
  readonly komuRany?: string | undefined;
}

/**
 * Pečiatky stavov karty: z línie (zLinie — Výtržník s menom, VYHRAL! na lokalite) a z vyhodnotenia —
 * Vzbura, Forsáž. NA EX zahasené či posilnené a Záverečná pečiatku nemajú (Michal 2026-11-11:
 * „Zahasené, Posilnené a Záverečná rušíme“).
 */
export function stavyKarty(ev: CardLineEval | null | undefined, vytrznik: boolean, zLinie: readonly StavNaKarte[] = []): StavNaKarte[] {
  const out: StavNaKarte[] = [...zLinie];
  if (vytrznik && !out.some((s) => s.druh === "vytrznik")) out.push({ druh: "vytrznik", text: t("peciatka.vytrznik"), titul: t("peciatka.vytrznik") });
  if (ev?.vzbura === true) out.push({ druh: "vzbura", text: t("peciatka.vzbura"), titul: t("peciatka.vzburaTitul") });
  if (ev?.forsaz === true) out.push({ druh: "forsaz", text: t("peciatka.forsaz"), titul: t("peciatka.forsazTitul") });
  return out;
}

/**
 * Stav pečatí Preškolenia karty v línii z jadra (CardLineEval.skolitel): koľko akcií práve
 * preškoľuje a ku ktorému susedovi svieti šípka — len k tomu, komu niečo preškolil (preskolena).
 * Mimo línie undefined (pečať ako vytlačená).
 */
function stavPreskoleni(efekt: string, stol: ZarStola | null, uid: number): PreskolenieNaKarte[] | undefined {
  const presk = preskoleniaZTextu(efekt);
  if (presk.length === 0 || stol === null || stol.evaly === undefined) return undefined;
  const skolitel = stol.evaly.get(uid)?.skolitel;
  if (skolitel === undefined) return undefined;
  return presk.map((p) => {
    const s = skolitel.find((x) => x.z === p.z && x.na === p.na && x.spustac === p.spustac);
    if (s === undefined) return { krat: 0 };
    const od = s.ku.filter((k) => (stol.evaly?.get(k)?.preskolena ?? []).some((x) => x.od === uid && x.z === p.z && x.akcii > 0));
    return { krat: s.akcii, sipky: sipkyKSusedom(stol.view, uid, od) };
  });
}

/**
 * Pečiatka Výtržníka: zrážka NA EX (vytrznik) alebo Injekcia pod kartou, ktorá z nej robí Výtržníka
 * tou istou cestou; null = karta Výtržník nie je. komuRany = riadok pod pečiatkou a titulok.
 */
export function vytrznikNaKarte(data: GameData, zrazka: boolean, podlozene: readonly PodlozenyNastroj[] | undefined, komuRany: string | undefined): StavNaKarte | null {
  const injekcia = (podlozene ?? []).find((n) => ucinkyNastrojov(data, { podlozene: [n] }).has("Výtržník"));
  if (!zrazka && injekcia === undefined) return null;
  const titul =
    komuRany === undefined
      ? t("peciatka.vytrznik")
      : injekcia === undefined || zrazka
        ? t("plocha.vytrznikTitul", { koho: komuRany })
        : t("peciatka.vytrznikNastrojTitul", { nastroj: nazovKarty(data.cards.get(injekcia.card.defId)?.name ?? injekcia.card.defId), koho: komuRany });
  return { druh: "vytrznik", text: t("peciatka.vytrznik"), pod: komuRany === undefined ? undefined : t("peciatka.ranyPre", { koho: komuRany }), titul };
}

/**
 * Karty, ktoré sa na stôl nehrajú (kliatba, ktorá nie je Občan, Absťák), nemajú jamky na prázdnych
 * indexoch (Michal 2026-11-11: „nemusia mať dierky“). Pravidlo vykladania je len v jadre
 * (cieleVykladania) — tu sa pýta na prázdnej línii s voľným limitom. Nástroj ostáva, ako je:
 * jeho hrany kreslí karta inak a jamky mu nedáva už KartaLico.
 */
export function bezJamiek(data: GameData, karta: CardInstance): boolean {
  if (defOf(data, karta).tags.includes("Nástroj")) return false;
  return !cieleVykladania(data, [[], []], 0, karta, 1).some((c) => c === "vlastna" || c === "superova");
}

export function HernaKarta({ karta, sada, data, sirka, otocena = false, eval: ev, onClick, vybrana, bezPopisov, hranaVnutorna, spoj, jamky, vytrznik = false, stlacena, zakazana, podlozene, aktivnaHrana, naex, stavy: stavyZLinie, komuRany }: HernaKartaProps) {
  const stavVytrznika = vytrznikNaKarte(data, vytrznik, podlozene, komuRany);
  const vytrznikTu = stavVytrznika !== null;
  const vytlacene = printedSides(data, karta);
  const stol = useContext(ZarStolaKontext);
  const vzhladK = vzhladKarty(sada, data, karta.defId);
  // Kto premenil akciu — Nástroj pod kartou alebo Školiteľ v línii — do nápovedy rohu (D2).
  const menoPremeny = (uid: number | undefined): string | null => {
    if (uid === undefined) return null;
    const k = podlozene?.find((x) => x.card.uid === uid)?.card ?? stol?.view.strany.flat().find((x) => x.card.uid === uid)?.card;
    return k === undefined ? null : (data.cards.get(k.defId)?.name ?? null);
  };
  // Lupa a karta na stole majú rovnaký kľúč — lupa otvorená po iskre ju už nezopakuje.
  const teraz = Date.now();
  const strana = (ps: "left" | "right"): { roz: RozlozenieStrany; sloty: (SlotStav | null)[] | null; rohy: (RohSlotu | null)[] } => {
    // Výtržník kreslí Rany na miestach vytlačených akcií; preškolenie efektom karty či Nástrojom
    // kreslí slot (Michal 2026-11-08) — hráč má vidieť, čo karta naozaj robí, a v rohu, čo bolo (D2).
    const rohy: (RohSlotu | null)[] = [null, null, null, null];
    const roz = [0, 1, 2, 3].map((k) => {
      const a = vytlacene[ps][k] ?? null;
      const se = ev?.[ps][k];
      if (a === null) return null;
      if (vytrznikTu) {
        const r = akciaVytrznika();
        if (r !== a) rohy[k] = { akcia: a, preco: "Výtržník" };
        return r;
      }
      if (se?.povodna !== undefined) {
        // Reťaz (v11.20): celá cesta akcie s menami tých, čo ju menili — „Rana → Pecka (Sypač) → Petelica (Valaška)“.
        const meno = menoPremeny(se.preskolil);
        rohy[k] = {
          akcia: se.povodna,
          preco:
            se.retaz !== undefined
              ? `Preškolenie: ${[menoAkcie(se.povodna), ...se.retaz.map((x) => `${menoAkcie(x.na)}${((m) => (m === null ? "" : ` (${m})`))(menoPremeny(x.uid))}`)].join(" → ")}`
              : meno === null
                ? "Preškolenie"
                : `Preškolenie: ${meno}`,
        };
        return se.action;
      }
      if (se?.naKarte === true && se.ako !== undefined) {
        rohy[k] = { akcia: a, preco: "Preškolenie" };
        return se.ako;
      }
      return a;
    }) as unknown as RozlozenieStrany;
    const sloty =
      ev === undefined || ev === null
        ? null
        : [0, 1, 2, 3].map((k) => {
            const se = ev[ps][k];
            return se === null || se === undefined ? null : { stav: se.stav, nasobok: se.nasobok };
          });
    return { roz, sloty, rohy };
  };
  const l = strana("left");
  const p = strana("right");
  const kde = stol === null ? null : miestoKarty(stol.view, karta.uid);
  const zar = (ps: "left" | "right", roz: RozlozenieStrany): (ZarNaKarte | null)[] =>
    [0, 1, 2, 3].map((k) => {
      const a = roz[k] ?? null;
      if (stol === null || kde === null || a === null) return null;
      const z = zarSlotu(a, stol.view.vplyvyAkcii?.[kde.majitel] ?? [], (id) => data.cards.get(id)?.name ?? id, karta.uid);
      if (z === null) return null;
      const kluc = `${karta.uid}:${kde.miesto}:${ps}${k}:${z.pricina}`;
      const prvy = stol.videne.get(kluc) ?? teraz;
      if (!stol.videne.has(kluc)) stol.videne.set(kluc, prvy);
      return { ...z, nova: teraz - prvy < TRVANIE_ISKRY_MS };
    });
  const zarL = zar("left", l.roz);
  const zarP = zar("right", p.roz);
  // Akcie navyše (frakcie): v línii stav z vyhodnotenia, v Dedičstve z línie stola, v ruke či by
  // Spoločník a Nepriateľ platili teraz.
  const efekty = efektyNavyse(defOf(data, karta));
  const stavy =
    efekty.length === 0
      ? undefined
      : ev?.navyse ??
        (kde?.miesto === "dedicstvo" ? stol?.navyseDedicstva?.get(karta.uid) : undefined) ??
        (stol !== null && kde?.miesto === "ruka" ? stavNavyseVRuke((id) => data.cards.get(id)?.tags ?? [], efekty, stol.view.strany, karta.uid, kde.majitel) : undefined);
  const navyse: NavyseNaKarte[] | undefined = stavy?.map((e, ei) => ({
    krat: e.krat,
    ...(e.ako === undefined ? {} : { ako: e.ako }),
    ...(e.nasobok === undefined ? {} : { nasobok: e.nasobok }),
    ...(e.od !== undefined && stol !== null && kde?.miesto === "linia" ? { sipky: sipkyKSusedom(stol.view, karta.uid, e.od) } : {}),
    zar: e.akcie.map((a0, ai) => {
      if (stol === null || kde === null) return null;
      const a = e.ako?.[ai] ?? a0;
      const z = zarSlotu(a, stol.view.vplyvyAkcii?.[kde.majitel] ?? [], (id) => data.cards.get(id)?.name ?? id, karta.uid);
      if (z === null) return null;
      const kluc = `${karta.uid}:${kde.miesto}:navyse${ei}-${ai}:${z.pricina}`;
      const prvy = stol.videne.get(kluc) ?? teraz;
      if (!stol.videne.has(kluc)) stol.videne.set(kluc, prvy);
      return { ...z, nova: teraz - prvy < TRVANIE_ISKRY_MS };
    }),
  }));
  const peciatky = stavyKarty(ev, vytrznikTu, [...(stavVytrznika === null ? [] : [stavVytrznika]), ...(stavyZLinie ?? [])]);

  const preskolenia = kde?.miesto === "linia" ? stavPreskoleni(vzhladK.efekt, stol, karta.uid) : undefined;
  const sRohmi = l.rohy.some((r) => r !== null) || p.rohy.some((r) => r !== null);
  return (
    <KartaLico
      karta={vzhladK}
      preskolenia={preskolenia}
      rohy={sRohmi ? { lava: l.rohy, prava: p.rohy } : undefined}
      aktivnaHrana={aktivnaHrana}
      lava={l.roz}
      prava={p.roz}
      vzhlad={vzhladSady(sada)}
      sirka={sirka}
      sloty={l.sloty !== null && p.sloty !== null ? { lava: l.sloty, prava: p.sloty } : null}
      zar={zarL.some((z) => z !== null) || zarP.some((z) => z !== null) ? { lava: zarL, prava: zarP } : undefined}
      peciatka={naex === undefined && peciatky.length === 0 ? undefined : <PeciatkyKarty naex={naex} stavy={peciatky} />}
      navyse={navyse}
      onClick={onClick}
      vybrana={vybrana ?? false}
      stlacena={stlacena}
      zakazana={zakazana}
      otocena={otocena}
      hranaVnutorna={hranaVnutorna === undefined ? undefined : hranaVnutorna === "left" ? "lava" : "prava"}
      bezPopisov={bezPopisov ?? false}
      slotyBezFokusu
      spoj={spoj === undefined ? undefined : { lava: spoj.left, prava: spoj.right }}
      jamky={jamky === undefined || bezJamiek(data, karta) ? undefined : { lava: jamky.left, prava: jamky.right }}
      idKarty={karta.defId}
      uidKarty={karta.uid}
    />
  );
}
