// REST API pod /api. Bez frameworku — pár ciest a prísna kontrola vstupu.
//
// Bezpečnosť:
// * relácia v HttpOnly cookie (SameSite=Lax),
// * každá zmena (nie GET) musí niesť hlavičku X-Naex: 1 — formulár z cudzej
//   stránky ju poslať nevie, takže CSRF neprejde,
// * admin cesty overujú rolu na serveri pri každej požiadavke.

import type { IncomingMessage, ServerResponse } from "node:http";
import type { DlzkaHry, Podmienka } from "@naex/core";
import { ALL_PODMIENKY, dostupneDlzky, prazdneStatistiky } from "@naex/core";
import type { KartaNavrh, Pozicia, StranaNavrhu, AkciaDef, KlucoveSlovo, Kategoria, BodovaciaKarta, IkonaBodovania, Nastavenia } from "@naex/tvorba";
import { MAX_TEXTU_KARTY, exportTxt, importTxt, sTextamiZImportu, slug, textyKarty, PREDVOLENE_NASTAVENIA } from "@naex/tvorba";
import type { Pouzivatel, Rola, Ucty } from "./auth.ts";
import type { Achievementy } from "./achievementy.ts";
import { ChybaVstupu, cookieOdhlasenia, cookieRelacie, overHesloVstup, overLogin, overHlasitost, overLupu, overMeno, overSchemu, overPrepinac, overPohlavie, overIdNapovedy, citajCookie, jeSpravca } from "./auth.ts";
import type { DruhMedia, Media } from "./media.ts";
import type { Hudba } from "./hudba.ts";
import type { Obsah } from "./obsah.ts";
import type { Archiv } from "./archiv.ts";
import type { TempoPartii } from "./tempo.ts";
import type { Prava } from "./prava.ts";
import type { FilterPartii, Profily } from "./profily.ts";
import { FILTRE_PARTII } from "./profily.ts";
import type { Prehravac } from "./prehravac.ts";
import { POPIS_PRAVA, PRAVA, RANKY_HRACOV, dalsiRank, jeRankHraca, prahyRankov } from "./prava.ts";
import type { KategoriaNazoru, Nazory, Triedenie } from "./nazory.ts";
import type { Playtesty } from "./playtesty.ts";
import type { Navrhy } from "./navrhy.ts";
import type { Roadmapa } from "./roadmapa.ts";
import type { Novinky } from "./novinky.ts";
import type { Dielna } from "./dielna.ts";
import { KRABICKA, MAX_OTVORENYCH } from "./dielna.ts";
import type { Hodnotenia } from "./znamky.ts";
import { overKategoriu as overKategoriuNazoru, overSkupinu } from "./nazory.ts";

/** Rozohraná partia hráča — pilulka „Partia beží · Späť ku stolu“ v hlavičke mimo stola. */
export interface RozohranaPartia {
  readonly kod: string;
  readonly vyucba: boolean;
}

export interface OtvorenaHra {
  readonly kod: string;
  readonly hostitel: { readonly meno: string; readonly avatar: string | null; readonly frajerina: number | null };
  readonly dlzka: DlzkaHry;
  readonly vytvorena: number;
}

/** Čo beží na serveri — podklad pre bezpečné nasadenie (skill naex-nasad) a prehľad naex-stav. */
export interface StavServera {
  /** Nasadená verzia (VERZIA.json, ktorý zapíše deploy/nahraj.sh); null = nenasadené (vývoj). */
  readonly verzia: { readonly commit: string; readonly vetva: string; readonly necommitnute: boolean; readonly nahrate: string } | null;
  readonly spusteny: number;
  /** Rozohrané partie — reštart servera ich zhodí. */
  readonly partie: {
    readonly ludia: number;
    readonly sBotom: number;
    readonly cakajuce: number;
    readonly poslednaAktivita: number | null;
    /** Rozohrané s ťahom za posledných 30 min — na tieto nasadenie čaká; ostatné sú opustené. */
    readonly aktivne: number;
    readonly opustene: number;
  };
  /** Uzávierka pred nasadením (od kedy), alebo null. */
  readonly uzavierka: Uzavierka | null;
}

/**
 * Uzávierka pred nasadením (Michal 2026-10-23): nové partie ani pripojenie do novej
 * miestnosti, rozohrané bežia ďalej. Len v pamäti servera — reštart (nasadenie) ju zruší.
 */
export interface Uzavierka {
  readonly od: number;
}

/** Oznam hráčom počas uzávierky — v lobby aj ako chyba pri zakladaní partie. */
export const OZNAM_UZAVIERKY = "Pripravujeme aktualizáciu hry — nové partie pôjdu založiť o chvíľu. Rozohrané partie dohrajte v pokoji.";

export interface ApiKontext {
  readonly ucty: Ucty;
  readonly obsah: Obsah;
  readonly media: Media;
  /** Predvolené avatary (dedinské trosky), z ktorých si hráč môže vybrať. */
  readonly predvoleneAvatary: readonly string[];
  /** Hudba počas partie (skladby z playlistu na Suno). */
  readonly hudba: Hudba;
  /** Hlášky majstra Melichara v partii proti počítaču. */
  readonly melichar: Hudba;
  readonly archiv: Archiv;
  /** Achievementy (Michal 2026-10-23) — null, keď sa katalóg nepodarilo načítať. */
  readonly achievementy: Achievementy | null;
  /** Čas a príkazy po fázach každej dohratej partie (roadmapa #9). */
  readonly tempoPartii: TempoPartii;
  /** Ranky a práva (Michal 2026-10-22) — matica rank × právo a pravidlá postupu. */
  readonly prava: Prava;
  /** Zoznam a detail partií pre profily (Michal 2026-10-22). */
  readonly profily: Profily;
  /** Prehrávač partie zo seedu a príkazov (roadmapa #18). */
  readonly prehravac: Prehravac;
  readonly nazory: Nazory;
  readonly playtesty: Playtesty;
  /** Návrhy zlepšení z playtestov a rozhodnutia o nich (sekcia Playtest). */
  readonly navrhy: Navrhy;
  /** Roadmapa hry — verejná, upravuje správca. */
  readonly roadmapa: Roadmapa;
  /** Novinky pre hráčov — verejné, píše správca. */
  readonly novinky: Novinky;
  /** Dielňa — návrhy kariet od hráčov, hlasovanie cigaretami, posudok správcu. */
  readonly dielna: Dielna;
  /** Známky hry podľa 12 kritérií a ich vývoj v čase. */
  readonly hodnotenia: Hodnotenia;
  readonly teraz: () => number;
  readonly bezpecneCookie: boolean;
  /** Verejné hry čakajúce na súpera (z herného servera). */
  readonly otvoreneHry: () => readonly OtvorenaHra[];
  /** Partia v miestnosti s kódom, v ktorej hráč sedí a ktorá ešte beží; inak null. */
  readonly rozohranaPartia: (kod: string, hracId: number) => RozohranaPartia | null;
  /** Po zverejnení novej sady — nové hry pobežia na nej. */
  readonly poZverejneni: () => void;
  readonly stavServera: () => StavServera;
  /** Počet krokov scenára výučby „Prvá hra“ (Michal 2026-10-23). */
  readonly vyucbaKrokov: number;
  /** Verzia scenára výučby — uložený postup inej verzie začne odznova (ScenarVyucby.verzia). */
  readonly vyucbaVerzia: string | null;
  /** Vypínač výučby: false = hráčom sa nezobrazí (ponuka ani tlačidlo), správcom áno. */
  readonly vyucbaPreHracov: boolean;
  /** Zapne alebo vypne uzávierku; vráti nový stav. */
  readonly nastavUzavierku: (zapnut: boolean) => Uzavierka | null;
}

const JSON_LIMIT = 2 * 1024 * 1024;

// Brzda proti hádaniu hesiel: najviac 10 neúspechov z jednej IP za 10 minút.
const neuspechy = new Map<string, { pocet: number; od: number }>();
function brzda(req: IncomingMessage, teraz: number, zlyhanie: boolean): void {
  const ip = String(req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "").split(",")[0]?.trim() ?? "";
  const z = neuspechy.get(ip);
  if (z !== undefined && teraz - z.od > 10 * 60 * 1000) neuspechy.delete(ip);
  const aktualny = neuspechy.get(ip);
  if (!zlyhanie) {
    if (aktualny !== undefined && aktualny.pocet >= 10) {
      throw new ChybaVstupu("Príliš veľa neúspešných pokusov. Skús to o pár minút.", 429);
    }
    return;
  }
  neuspechy.set(ip, { pocet: (aktualny?.pocet ?? 0) + 1, od: aktualny?.od ?? teraz });
}
const MEDIA_LIMIT = 12 * 1024 * 1024;
const AVATAR_LIMIT = 2 * 1024 * 1024;

function odpoved(res: ServerResponse, status: number, telo: unknown, hlavicky: Record<string, string> = {}): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...hlavicky });
  res.end(JSON.stringify(telo));
}

function citajTelo(req: IncomingMessage, limit: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const kusy: Buffer[] = [];
    let n = 0;
    req.on("data", (k: Buffer) => {
      n += k.length;
      if (n > limit) {
        reject(new ChybaVstupu(`Súbor je príliš veľký (max ${Math.round(limit / 1024 / 1024)} MB).`, 413));
        req.destroy();
        return;
      }
      kusy.push(k);
    });
    req.on("end", () => resolve(Buffer.concat(kusy)));
    req.on("error", reject);
  });
}

async function citajJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const buf = await citajTelo(req, JSON_LIMIT);
  try {
    const v = JSON.parse(buf.toString("utf8")) as unknown;
    if (typeof v === "object" && v !== null && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch {
    // spadne nižšie
  }
  throw new ChybaVstupu("Neplatné JSON telo požiadavky.");
}

async function citajJsonPole(req: IncomingMessage): Promise<unknown[]> {
  const buf = await citajTelo(req, JSON_LIMIT);
  try {
    const v = JSON.parse(buf.toString("utf8")) as unknown;
    if (Array.isArray(v)) return v;
  } catch {
    // spadne nižšie
  }
  throw new ChybaVstupu("Očakávam JSON pole.");
}

// ---------------------------------------------------------------------------
// Kontrola tvaru dát od klienta

const str = (v: unknown, max: number, pole: string): string => {
  if (typeof v !== "string") throw new ChybaVstupu(`${pole}: očakávam text.`);
  if (v.length > max) throw new ChybaVstupu(`${pole}: najviac ${max} znakov.`);
  return v;
};
const num = (v: unknown, min: number, max: number, pole: string): number => {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max) {
    throw new ChybaVstupu(`${pole}: číslo ${min} – ${max}.`);
  }
  return v;
};
const hex = (v: unknown, pole: string): string | null => {
  if (v === null) return null;
  if (typeof v !== "string" || !/^#[0-9a-fA-F]{6}$/.test(v)) throw new ChybaVstupu(`${pole}: farba #rrggbb.`);
  return v.toLowerCase();
};
const mediaId = (v: unknown, pole: string): string => {
  if (typeof v !== "string" || !/^[0-9a-f]{40}$/.test(v)) throw new ChybaVstupu(`${pole}: neplatný obrázok.`);
  return v;
};
const pozicie = (v: unknown, pole: string): Pozicia[] => {
  if (!Array.isArray(v)) throw new ChybaVstupu(`${pole}: očakávam pole pozícií.`);
  return [...new Set(v.map((p) => num(p, 0, 3, pole)))].filter((p) => Number.isInteger(p)).sort() as Pozicia[];
};

function overStranu(v: unknown, pole: string): StranaNavrhu {
  if (typeof v !== "object" || v === null) throw new ChybaVstupu(`${pole}: chýba.`);
  const s = v as Record<string, unknown>;
  const akcie: Record<string, number> = {};
  for (const [k, n] of Object.entries((s.akcie ?? {}) as Record<string, unknown>)) {
    const pocet = num(n, 0, 4, `${pole}.akcie`);
    if (pocet > 0) akcie[str(k, 64, `${pole}.akcie`)] = Math.round(pocet);
  }
  const povolene: Partial<Record<Pozicia, string[]>> = {};
  for (const [p, zoz] of Object.entries((s.povolene ?? {}) as Record<string, unknown>)) {
    const poz = num(Number(p), 0, 3, `${pole}.povolene`) as Pozicia;
    if (!Array.isArray(zoz)) continue;
    const kluce = zoz.map((k) => str(k, 64, `${pole}.povolene`));
    if (kluce.length > 0) povolene[poz] = kluce;
  }
  const kraj = typeof s.kraj === "string" ? str(s.kraj, 40, `${pole}.kraj`).trim() : "";
  return { blokovane: pozicie(s.blokovane ?? [], `${pole}.blokovane`), akcie, povolene, ...(kraj === "" ? {} : { kraj }) };
}

export function overNavrh(v: Record<string, unknown>, id: string, teraz: number): KartaNavrh {
  const obr = v.obrazok as Record<string, unknown> | null | undefined;
  return {
    id,
    nazov: str(v.nazov, 80, "Názov").trim(),
    tagy: (Array.isArray(v.tagy) ? v.tagy : []).map((t) => str(t, 40, "Tag").trim()).filter((t) => t !== "").slice(0, 8),
    efekt: str(v.efekt ?? "", 600, "Efekt"),
    obrazok:
      obr === null || obr === undefined
        ? null
        : { plny: mediaId(obr.plny, "Obrázok"), nahlad: mediaId(obr.nahlad, "Obrázok") },
    farba: hex(v.farba ?? null, "Farba"),
    mierkaTextu: num(v.mierkaTextu, 0.6, 1.8, "Mierka textu"),
    mierkaIkon: num(v.mierkaIkon, 0.5, 1.8, "Mierka ikon"),
    sirkaMm: num(v.sirkaMm, 20, 200, "Šírka"),
    vyskaMm: num(v.vyskaMm, 20, 300, "Výška"),
    kopie: Math.round(num(v.kopie, 1, 1000, "Kópie")),
    lava: overStranu(v.lava, "Ľavá strana"),
    prava: overStranu(v.prava, "Pravá strana"),
    upravene: teraz,
    ...textyKarty(textKarty(v.pribeh, "Príbeh"), textKarty(v.ucel, "Účel v hre")),
  };
}

/** Príbeh či účel karty: nepovinný text, konce riadkov ako v prehliadači. */
function textKarty(v: unknown, pole: string): string | undefined {
  if (v === undefined || v === null) return undefined;
  return str(v, MAX_TEXTU_KARTY, pole).replace(/\r\n?/g, "\n");
}

function overAkciu(v: Record<string, unknown>, kluc: string, existujuca: AkciaDef | null): AkciaDef {
  const ikona = v.ikona as Record<string, unknown> | undefined;
  return {
    kluc,
    nazov: str(v.nazov, 40, "Názov akcie").trim() || kluc,
    popis: str(v.popis ?? "", 400, "Popis akcie"),
    // Vstavaná akcia si nechá vstavanú ikonu, ak admin nenahrá vlastnú.
    ikona:
      ikona?.typ === "svg"
        ? { typ: "svg", media: mediaId(ikona.media, "Ikona") }
        : existujuca?.ikona ?? { typ: "vstavana" },
    poradie: num(v.poradie ?? existujuca?.poradie ?? 99, 0, 10000, "Poradie"),
  };
}

function overKlucoveSlovo(v: unknown): KlucoveSlovo {
  const o = (v ?? {}) as Record<string, unknown>;
  return {
    slovo: str(o.slovo, 40, "Kľúčové slovo").trim(),
    tucne: o.tucne === true,
    kurziva: o.kurziva === true,
    novyRiadok: o.novyRiadok === true,
    tvary: (Array.isArray(o.tvary) ? o.tvary : []).map((t) => str(t, 40, "Tvar").trim()).filter((t) => t !== "").slice(0, 20),
    popis: str(o.popis ?? "", 400, "Popis"),
  };
}

function overKategoriu(v: unknown): Kategoria {
  const o = (v ?? {}) as Record<string, unknown>;
  return { nazov: str(o.nazov, 40, "Kategória").trim(), odtien: num(o.odtien, 0, 360, "Odtieň"), zapnuta: o.zapnuta === true };
}

function overBodovaciu(v: Record<string, unknown>, id: string, teraz: number): BodovaciaKarta {
  const ikony = (x: unknown) =>
    [0, 1, 2, 3].map((i) => {
      const z = Array.isArray(x) ? x[i] : null;
      return z === null || z === undefined ? null : str(z, 64, "Ikona");
    });
  return {
    id,
    nazov: str(v.nazov, 80, "Názov").trim(),
    sirkaMm: num(v.sirkaMm, 20, 200, "Šírka"),
    vyskaMm: num(v.vyskaMm, 20, 300, "Výška"),
    mierkaIkon: num(v.mierkaIkon, 0.5, 1.8, "Mierka ikon"),
    farba: hex(v.farba ?? null, "Farba"),
    pozadie: v.pozadie === null || v.pozadie === undefined ? null : mediaId(v.pozadie, "Pozadie"),
    lava: ikony(v.lava),
    prava: ikony(v.prava),
    upravene: teraz,
  };
}

const ID_RE = /^[a-z0-9_]{1,64}$/;

// ---------------------------------------------------------------------------

export async function spracujApi(ctx: ApiKontext, req: IncomingMessage, res: ServerResponse, cesta: string, query: URLSearchParams): Promise<void> {
  const metoda = req.method ?? "GET";
  if (metoda !== "GET" && req.headers["x-naex"] !== "1") {
    odpoved(res, 403, { chyba: "Chýba hlavička X-Naex." });
    return;
  }
  const teraz = ctx.teraz();
  const ja = ctx.ucty.zRequestu(req, teraz);
  const prihlaseny = (): Pouzivatel => {
    if (ja === null) throw new ChybaVstupu("Musíš sa prihlásiť.", 401);
    return ja;
  };
  // Správa (tvorba kariet, hráči) patrí adminovi aj subadminom (Michal 2026-10-12).
  const spravca = (): Pouzivatel => {
    const p = prihlaseny();
    if (!jeSpravca(p.rola)) throw new ChybaVstupu("Len pre admina a subadminov.", 403);
    return p;
  };
  const ok = (telo: unknown, status = 200, hlavicky: Record<string, string> = {}) => odpoved(res, status, telo, hlavicky);
  const casti = cesta.split("/").filter((c) => c !== "").map(decodeURIComponent);
  const r = `${metoda} /${casti.slice(1).join("/")}`;

  try {
    // ----- účet ----------------------------------------------------------
    // Počet dohratých partií — návštevník vidí, koľko mu chýba do úrovne hráč.
    if (r === "GET /ja") {
      // Neprihlásený má práva Nealka — klient podľa nich skryje odkazy (Vývoj), ktoré by server odmietol.
      if (ja === null) return ok({ pouzivatel: null, prava: ctx.prava.zoznam(null) });
      return ok({ pouzivatel: { ...ja, dohrate: ctx.ucty.dohrate(ja.id), prava: ctx.prava.zoznam(ja) } });
    }

    if (r === "POST /registracia") {
      const b = await citajJson(req);
      const p = ctx.ucty.registruj(overLogin(b.login), overHesloVstup(b.heslo), overMeno(b.meno), teraz);
      const token = ctx.ucty.novaRelacia(p.id, teraz);
      return ok({ pouzivatel: p }, 201, { "set-cookie": cookieRelacie(token, ctx.bezpecneCookie) });
    }

    if (r === "POST /prihlasenie") {
      brzda(req, teraz, false);
      const b = await citajJson(req);
      const p = ctx.ucty.prihlas(String(b.login ?? "").trim(), String(b.heslo ?? ""));
      if (p === null) {
        brzda(req, teraz, true);
        throw new ChybaVstupu("Nesprávne meno alebo heslo.", 401);
      }
      const token = ctx.ucty.novaRelacia(p.id, teraz);
      return ok({ pouzivatel: p }, 200, { "set-cookie": cookieRelacie(token, ctx.bezpecneCookie) });
    }

    if (r === "POST /odhlasenie") {
      const token = citajCookie(req);
      if (token !== null) ctx.ucty.zrusRelaciu(token);
      return ok({ ok: true }, 200, { "set-cookie": cookieOdhlasenia(ctx.bezpecneCookie) });
    }

    if (r === "PATCH /profil") {
      const p = prihlaseny();
      const b = await citajJson(req);
      // Meno, zväčšenie lupy, hlasitosť hudby aj farebná schéma sa ukladajú samostatne — posiela sa len to, čo sa mení.
      return ok({
        pouzivatel: ctx.ucty.upravProfil(p.id, {
          ...(b.meno !== undefined ? { meno: overMeno(b.meno) } : {}),
          ...(b.lupa !== undefined ? { lupa: overLupu(b.lupa) } : {}),
          ...(b.hudba !== undefined ? { hudba: overHlasitost(b.hudba) } : {}),
          ...(b.melichar !== undefined ? { melichar: overHlasitost(b.melichar, "hlášok") } : {}),
          ...(b.schema !== undefined ? { schema: overSchemu(b.schema) } : {}),
          ...(b.skratky !== undefined ? { skratky: overPrepinac(b.skratky, "Klávesové skratky") } : {}),
          ...(b.napovedy !== undefined ? { napovedy: overPrepinac(b.napovedy, "Nápovedy Melichara") } : {}),
          ...(b.pohlavie !== undefined ? { pohlavie: overPohlavie(b.pohlavie) } : {}),
          ...(b.skrytySuhrn !== undefined ? { skrytySuhrn: overPrepinac(b.skrytySuhrn, "Skryť môj súhrn") } : {}),
        }),
      });
    }

    // ----- nápovedy Melichara v partii (Michal 2026-10-24) -----------------
    // Ktorú nápovedu ukázať, rozpozná klient z vlastného pohľadu (napovedy.ts v jadre);
    // server si pamätá len videné id a vypínač (PATCH /profil napovedy).
    if (r === "GET /napovedy") {
      const p = prihlaseny();
      return ok({ zapnute: p.napovedy, videne: ctx.ucty.videneNapovedy(p.id) });
    }

    if (r === "POST /napovedy/videna") {
      const p = prihlaseny();
      const b = await citajJson(req);
      return ok({ videne: ctx.ucty.pridajVidenuNapovedu(p.id, overIdNapovedy(b.id)) });
    }

    if (r === "POST /napovedy/reset") {
      const p = prihlaseny();
      ctx.ucty.resetujNapovedy(p.id);
      return ok({ videne: [] });
    }

    // ----- výučba „Prvá hra“ (Michal 2026-10-23) ----------------------------
    // Ponuka novému hráčovi pri prvom kliku na Hrať: návštevník, ktorý ju ešte
    // nezačal, nedokončil ani nepreskočil. Partia samotná ide cez WebSocket.
    if (r === "GET /vyucba") {
      const p = prihlaseny();
      const v = ctx.ucty.vyucba(p.id, ctx.vyucbaVerzia);
      // dostupna: či ukázať tlačidlo „Prvá hra“; kým je vypínač vypnutý, len správcom (skúšanie).
      const dostupna = ctx.vyucbaPreHracov || jeSpravca(p.rola);
      // Dokončené časti podľa hviezdičky achievementu Prvá hra (#104); bez achievementov podľa stavu účtu.
      const castiHotove = ctx.achievementy?.castiVyucby(p.id) ?? (v.stav === "hotova" ? 1 : 0);
      // Ponuka „Najprv výučba?“ pri zakladaní prvej partie: návštevník bez 1. časti, ktorý ju nepreskočil.
      const ponuknut = ctx.vyucbaPreHracov && castiHotove === 0 && v.stav === null && p.rola === "navstevnik";
      return ok({ krok: v.krok, spolu: ctx.vyucbaKrokov, stav: v.stav, dostupna, ponuknut, castiHotove });
    }

    // Prvé odpovede na kontrolné otázky výučby (metrika pre Navrhára, Michal 2026-10-23).
    if (r === "GET /admin/vyucba/odpovede") {
      spravca();
      return ok({ odpovede: ctx.ucty.odpovedeVyucby() });
    }

    if (r === "POST /vyucba/preskocit") {
      const p = prihlaseny();
      ctx.ucty.ulozVyucbu(p.id, ctx.ucty.vyucba(p.id, ctx.vyucbaVerzia).krok, "preskocena", ctx.vyucbaVerzia);
      return ok({ ok: true });
    }

    // Začať odznova (aj po dokončení či preskočení).
    if (r === "POST /vyucba/znova") {
      const p = prihlaseny();
      ctx.ucty.ulozVyucbu(p.id, 0, null);
      return ok({ ok: true });
    }

    if (r === "POST /profil/heslo") {
      const p = prihlaseny();
      const b = await citajJson(req);
      ctx.ucty.zmenHeslo(p.id, String(b.stare ?? ""), overHesloVstup(b.nove));
      return ok({ ok: true });
    }

    if (r === "PUT /profil/avatar") {
      const p = prihlaseny();
      // Vlastná fotka podľa práva ranku; predvolený avatar si vyberie každý.
      ctx.prava.vyzaduj(p, "vlastna_fotka");
      const buf = await citajTelo(req, AVATAR_LIMIT);
      const m = ctx.media.uloz(buf, "avatar", `avatar-${p.id}`, teraz, ["image/jpeg", "image/png", "image/webp"]);
      return ok({ pouzivatel: ctx.ucty.upravProfil(p.id, { avatar: m.id }) });
    }

    // Michal 2026-10-19: namiesto vlastnej fotky si hráč vyberie jednu z trosiek.
    if (r === "GET /hudba") return ok({ skladby: ctx.hudba.zoznam() });

    if (r === "GET /melichar") return ok({ hlasky: ctx.melichar.hlasky(), skupiny: ctx.melichar.skupiny() });

    if (r === "GET /avatary") return ok({ avatary: ctx.predvoleneAvatary });

    if (r === "PUT /profil/avatar-predvoleny") {
      const p = prihlaseny();
      const b = await citajJson(req);
      const id = String(b.avatar ?? "");
      if (!ctx.predvoleneAvatary.includes(id)) throw new ChybaVstupu("Taký predvolený avatar neexistuje.");
      return ok({ pouzivatel: ctx.ucty.upravProfil(p.id, { avatar: id }) });
    }

    if (r === "DELETE /profil/avatar") {
      const p = prihlaseny();
      // Bez vlastnej fotky dostane hráč náhodnú dedinskú trosku.
      return ok({ pouzivatel: ctx.ucty.upravProfil(p.id, { avatar: ctx.ucty.predvolenyAvatar() }) });
    }

    // ----- verejné -------------------------------------------------------
    if (r === "GET /sada") return ok(ctx.obsah.aktualnaSada().sada);

    // Kód je z prehliadača hráča; cudziu ani skončenú partiu server neprezradí.
    if (r === "GET /hry/moja") {
      const kod = (query.get("kod") ?? "").trim().toUpperCase();
      return ok({ partia: ja === null || !/^[A-Z0-9]{1,8}$/.test(kod) ? null : ctx.rozohranaPartia(kod, ja.id) });
    }
    if (r === "GET /hry/otvorene") {
      prihlaseny();
      return ok({
        hry: ctx.otvoreneHry(),
        dlzky: dostupneDlzky(ctx.obsah.aktualnaSada().data),
        uzavierka: ctx.stavServera().uzavierka === null ? null : OZNAM_UZAVIERKY,
      });
    }

    // ----- známky hry a roadmapa (stránka Vývoj) --------------------------
    // Von idú len priemery; ľudia až od MIN_LUDI hodnotiteľov (znamky.ts).
    // Kto Vývoj vidí, určuje admin rankom (právo vidiet_vyvoj, Michal 2026-10-26);
    // kritériá na hodnotenie dáva aj /znamky/moje, aby hodnotiť šlo aj bez Vývoja.
    if (r === "GET /znamky") {
      ctx.prava.vyzaduj(ja, "vidiet_vyvoj");
      return ok({ ...ctx.hodnotenia.vyvoj(), udalosti: ctx.roadmapa.udalosti() });
    }
    if (r === "GET /znamky/moje") return ok(ctx.hodnotenia.moje(prihlaseny()));
    if (r === "PUT /znamky") return ok(ctx.hodnotenia.uloz(prihlaseny(), await citajJson(req), teraz));

    if (casti[1] === "roadmapa") {
      if (r === "GET /roadmapa") {
        ctx.prava.vyzaduj(ja, "vidiet_vyvoj");
        return ok(ctx.roadmapa.zoznam(ja));
      }
      const p = prihlaseny();
      if (r === "POST /roadmapa") return ok({ id: ctx.roadmapa.pridaj(p, await citajJson(req), teraz) }, 201);
      const id = Number(casti[2]);
      if (Number.isInteger(id)) {
        if (metoda === "PATCH" && casti.length === 3) {
          ctx.roadmapa.uprav(p, id, await citajJson(req), teraz);
          return ok({ ok: true });
        }
        if (metoda === "DELETE" && casti.length === 3) {
          ctx.roadmapa.zmaz(p, id);
          return ok({ ok: true });
        }
        if (metoda === "POST" && casti[3] === "presun" && casti.length === 4) {
          ctx.roadmapa.presun(p, id, await citajJson(req), teraz);
          return ok({ ok: true });
        }
      }
      throw new ChybaVstupu("Neznáma cesta.", 404);
    }

    // Novinky čítajú aj návštevníci; zápis je v /admin/novinky. Kedy ich kto
    // naposledy videl, pamätá server len prihláseným — návštevník posiela `od`
    // zo svojho prehliadača.
    if (r === "GET /novinky") return ok({ novinky: ctx.novinky.zoznam(), videne: ja === null ? null : ctx.novinky.videne(ja.id) });
    if (r === "GET /novinky/nove") {
      const od = ja !== null ? ctx.novinky.videne(ja.id) : Number(query.get("od"));
      return ok({ pocet: Number.isFinite(od) && od > 0 ? ctx.novinky.pocetOd(od) : 0 });
    }
    // Volá ho až „Mám prečítané“ (Michal 2026-10-27); GET /novinky čas videného nemení.
    // Telo { po } je voliteľné — starší klient posiela prázdne.
    if (r === "POST /novinky/videne") {
      const p = prihlaseny();
      const buf = await citajTelo(req, JSON_LIMIT);
      let po: unknown;
      try {
        po = buf.length === 0 ? undefined : (JSON.parse(buf.toString("utf8")) as { po?: unknown } | null)?.po;
      } catch {
        throw new ChybaVstupu("Neplatné JSON telo požiadavky.");
      }
      ctx.novinky.oznacVidene(p.id, teraz, po);
      return ok({ ok: true });
    }

    // ----- Dielňa: čítanie verejné, písanie podľa práva navrhovat_karty -----
    if (casti[1] === "dielna") {
      if (r === "GET /dielna") {
        return ok({
          navrhy: ctx.dielna.zoznam(ja, teraz),
          krabicka: KRABICKA,
          maxOtvorenych: MAX_OTVORENYCH,
          smiem: ja !== null && ctx.prava.smie(ja, "navrhovat_karty"),
          noveRozhodnutia: ja === null ? 0 : ctx.dielna.noveRozhodnutia(ja),
        });
      }
      // Obrázky knižnice na čítanie pre editor Dielne (nahrávať smie len správca).
      if (r === "GET /dielna/kniznica") return ok({ media: ctx.media.zoznam("kniznica").map((m) => ({ id: m.id, nazov: m.nazov })) });
      if (r === "GET /dielna/autori") return ok({ autori: ctx.dielna.autoriKariet() });
      // Značka pri Kartách: koľko rozhodnutí o mojich návrhoch som ešte nevidel.
      if (r === "GET /dielna/znacka") return ok({ pocet: ja === null ? 0 : ctx.dielna.noveRozhodnutia(ja) });
      if (r === "POST /dielna") return ok({ id: ctx.dielna.vytvor(prihlaseny(), await citajJson(req), teraz) }, 201);
      if (metoda === "DELETE" && casti[2] === "komentare" && casti.length === 4) {
        ctx.dielna.zmazKomentar(prihlaseny(), Number(casti[3]));
        return ok({ ok: true });
      }
      const id = Number(casti[2]);
      if (!Number.isInteger(id)) throw new ChybaVstupu("Neznáma cesta.", 404);
      const akcia = casti.length === 3 ? "" : (casti[3] ?? "");
      if (casti.length > 4) throw new ChybaVstupu("Neznáma cesta.", 404);
      if (metoda === "GET" && akcia === "") {
        const d = ctx.dielna.detail(ja, id, teraz);
        if (ja !== null && d.autor.id === ja.id) ctx.dielna.videl(ja, id, teraz);
        return ok({ navrh: d });
      }
      const p = prihlaseny();
      if (metoda === "PATCH" && akcia === "") {
        ctx.dielna.uprav(p, id, await citajJson(req), teraz);
        return ok({ ok: true });
      }
      if (metoda === "DELETE" && akcia === "") {
        ctx.dielna.zmaz(p, id);
        return ok({ ok: true });
      }
      if (metoda === "POST" && akcia === "odoslat") {
        ctx.dielna.odosli(p, id, teraz);
        return ok({ ok: true });
      }
      if ((metoda === "PUT" || metoda === "DELETE") && akcia === "cigareta") return ok({ cigarety: ctx.dielna.cigareta(p, id, metoda === "PUT", teraz) });
      if (metoda === "POST" && akcia === "komentare") return ok({ id: ctx.dielna.komentuj(p, id, (await citajJson(req)).text, teraz) }, 201);
      if (metoda === "POST" && akcia === "nahlasit") {
        ctx.dielna.nahlas(p, id, (await citajJson(req)).dovod, teraz);
        return ok({ ok: true });
      }
      if (metoda === "GET" && akcia === "nahlasenia") return ok({ nahlasenia: ctx.dielna.nahlasenia(p, id) });
      if (metoda === "POST" && akcia === "skryt") {
        ctx.dielna.skry(p, id, (await citajJson(req)).skryty === true);
        return ok({ ok: true });
      }
      if (metoda === "POST" && akcia === "posudok") return ok(ctx.dielna.posud(p, id, await citajJson(req), teraz));
      throw new ChybaVstupu("Neznáma cesta.", 404);
    }

    // ----- profily hráčov a rebríček (pre prihlásených) -----------------
    // Partie hráča (Michal 2026-10-22): len vlastník a správca — ostatným 404, akoby neboli.
    if (metoda === "GET" && casti[1] === "hraci" && casti[3] === "partie" && casti.length === 4) {
      const p = prihlaseny();
      const id = Number(casti[2]);
      if (!Number.isInteger(id) || (id !== p.id && !jeSpravca(p.rola)) || ctx.ucty.podlaId(id) === null) throw new ChybaVstupu("Taký hráč neexistuje.", 404);
      const f = query.get("filter") ?? "spolu";
      if (!(FILTRE_PARTII as readonly string[]).includes(f)) throw new ChybaVstupu("Filter: ludia, boti alebo spolu.");
      const od = Math.max(0, Math.floor(Number(query.get("od") ?? 0)) || 0);
      const limit = Math.min(100, Math.max(1, Math.floor(Number(query.get("limit") ?? 20)) || 20));
      return ok(ctx.profily.partieHraca(id, f as FilterPartii, od, limit, jeSpravca(p.rola)));
    }
    // Prehrávač partie (roadmapa #18): účastník len zo svojho miesta, správca si ho vyberie, cudzí 404.
    if (metoda === "GET" && casti[1] === "partie" && casti[3] === "kroky" && casti.length === 4) {
      const p = prihlaseny();
      const zoznam = ctx.prehravac.kroky(Number(casti[2]), p.id, jeSpravca(p.rola));
      if (zoznam === null) throw new ChybaVstupu("Taká partia neexistuje.", 404);
      return ok(zoznam);
    }
    if (metoda === "GET" && casti[1] === "partie" && casti[3] === "krok" && casti.length === 5) {
      const p = prihlaseny();
      const n = Number(casti[4]);
      if (!Number.isInteger(n) || n < 0) throw new ChybaVstupu("Krok: celé číslo od 0.");
      const m = query.get("miesto");
      if (m !== null && m !== "0" && m !== "1") throw new ChybaVstupu("Miesto: 0 alebo 1.");
      const krok = ctx.prehravac.krok(Number(casti[2]), n, p.id, jeSpravca(p.rola), m === null ? null : (Number(m) as 0 | 1));
      if (krok === null) throw new ChybaVstupu("Taká partia neexistuje.", 404);
      if ("chyba" in krok) throw new ChybaVstupu(krok.chyba, 409);
      return ok(krok);
    }
    // Detail partie: účastník (svoja strana plná, súperova verejná) a správca.
    if (metoda === "GET" && casti[1] === "partie" && casti.length === 3) {
      const p = prihlaseny();
      const id = Number(casti[2]);
      const detail = Number.isInteger(id) ? ctx.profily.detail(id, p.id, jeSpravca(p.rola)) : null;
      if (detail === null) throw new ChybaVstupu("Taká partia neexistuje.", 404);
      return ok(detail);
    }

    if (metoda === "GET" && casti[1] === "hraci" && casti.length === 3) {
      const p = prihlaseny();
      const id = Number(casti[2]);
      // Vlastný profil vidí každý; cudzie podľa práva ranku. AI playtester je
      // hráčom skrytý — odpoveď sa nelíši od neexistujúceho účtu (Michal 2026-10-22).
      if (id !== p.id) ctx.prava.vyzaduj(p, "profily_inych");
      const ciel = Number.isInteger(id) ? ctx.ucty.podlaId(id) : null;
      if (ciel === null || (ciel.ai && !jeSpravca(p.rola) && ciel.id !== p.id)) throw new ChybaVstupu("Taký hráč neexistuje.", 404);
      const pohlad = id === p.id ? "vlastny" : jeSpravca(p.rola) ? "spravca" : "cudzi";
      const profil = ctx.archiv.profil(id, pohlad, p.id);
      if (profil === null) throw new ChybaVstupu("Taký hráč neexistuje.", 404);
      // Súhrn: cudzí len z partií s ľuďmi, bez silných a slabých stránok, a vôbec nie,
      // keď si ho hráč skryl (hodnotenie ostáva viditeľné) — Michal 2026-10-22.
      const cudzi = pohlad === "cudzi";
      const f = cudzi ? "ludia" : (query.get("filter") ?? "ludia");
      if (!(FILTRE_PARTII as readonly string[]).includes(f)) throw new ChybaVstupu("Filter: ludia, boti alebo spolu.");
      const suhrnSkryty = ciel.skrytySuhrn;
      if (cudzi && suhrnSkryty) {
        // Skrytý súhrn: ani staré súčty štatistík (pole statistiky) ani vitrínu achievementov cudziemu nepošleme.
        return ok({ ...profil, statistiky: prazdneStatistiky(), casSpolu: 0, suhrnSkryty, suhrn: null, achievementy: null });
      }
      // Hviezdy a cesta k ďalšiemu ranku len vo vlastnom profile (Michal 2026-10-25).
      const h = ctx.ucty.hviezdy(id);
      const postupRanku =
        pohlad === "vlastny" && h.spolu > 0
          ? { hviezdy: h.hviezdy, spolu: h.spolu, dalsi: jeRankHraca(ciel.rola) ? dalsiRank(ctx.prava.nastavenie().postup, ciel.rola, h) : null }
          : null;
      return ok({ ...profil, suhrnSkryty, suhrn: ctx.profily.suhrn(id, f as FilterPartii, !cudzi), achievementy: ctx.achievementy?.vitrina(id) ?? null, postupRanku });
    }

    // Vlastná vitrína achievementov (Michal 2026-10-23); cudzie sú v GET /hraci/:id.
    if (r === "GET /achievementy") {
      const p = prihlaseny();
      return ok({ achievementy: ctx.achievementy?.vitrina(p.id) ?? null });
    }

    if (r === "GET /rebricek") {
      const p = prihlaseny();
      ctx.prava.vyzaduj(p, "profily_inych");
      return ok({ hraci: ctx.archiv.rebricek(100, jeSpravca(p.rola)) });
    }

    // Reporty playtestov pre ranky s právom (správcovia ich majú aj v /admin/playtesty).
    if (r === "GET /playtesty") {
      ctx.prava.vyzaduj(prihlaseny(), "reporty_playtestov");
      return ok({ token: ctx.playtesty.token(teraz), reporty: ctx.playtesty.zoznam() });
    }

    // ----- spätná väzba --------------------------------------------------
    if (casti[1] === "nazory") {
      const p = prihlaseny();
      const id = Number(casti[2]);
      const kom = casti[2] === "komentare" ? Number(casti[3]) : Number.NaN;

      if (r === "GET /nazory") {
        const t = query.get("triedenie");
        const triedenie: Triedenie = t === "cigarety" || t === "diskusia" ? t : "nove";
        const k = query.get("kategoria");
        const kategoria: KategoriaNazoru | null = k === null || k === "" ? null : overKategoriuNazoru(k);
        // Záložka stavu (otvorene | planovane | hotove | zamietnute) a ai=0 len od ľudí / ai=1 len od AI;
        // bez nich všetko (nástroje agentov). Počty sú pre záložky a prepínač AI.
        const s = query.get("stav");
        const a = query.get("ai");
        const filter = { kategoria, skupina: s === null || s === "" ? null : overSkupinu(s), ai: a === "0" ? false : a === "1" ? true : null };
        return ok({ nazory: ctx.nazory.zoznam(p, triedenie, filter), pocty: ctx.nazory.pocty(kategoria) });
      }
      if (r === "POST /nazory") {
        const b = await citajJson(req);
        return ok({ id: ctx.nazory.pridaj(p, b.kategoria, b.text, teraz, b.nadpis) }, 201);
      }
      if (Number.isInteger(kom)) {
        if (metoda === "DELETE" && casti.length === 4) {
          ctx.nazory.zmazKomentar(p, kom);
          return ok({ ok: true });
        }
        if (casti[4] === "cigareta" && casti.length === 5 && (metoda === "PUT" || metoda === "DELETE")) {
          return ok({ cigarety: ctx.nazory.cigareta(p, "komentar", kom, metoda === "PUT") });
        }
      }
      if (Number.isInteger(id)) {
        if (metoda === "PATCH" && casti.length === 3) {
          ctx.nazory.uprav(p, id, await citajJson(req), teraz);
          return ok({ ok: true });
        }
        if (metoda === "DELETE" && casti.length === 3) {
          ctx.nazory.zmaz(p, id);
          return ok({ ok: true });
        }
        if (metoda === "POST" && casti[3] === "komentare" && casti.length === 4) {
          const b = await citajJson(req);
          return ok({ id: ctx.nazory.komentuj(p, id, b.text, teraz) }, 201);
        }
        if (casti[3] === "cigareta" && casti.length === 4 && (metoda === "PUT" || metoda === "DELETE")) {
          return ok({ cigarety: ctx.nazory.cigareta(p, "nazor", id, metoda === "PUT") });
        }
      }
      throw new ChybaVstupu("Neznáma cesta.", 404);
    }

    // ----- admin ---------------------------------------------------------
    if (casti[1] !== "admin") throw new ChybaVstupu("Neznáma cesta.", 404);
    const ja2 = spravca();
    const sub = `${metoda} /${casti.slice(2).join("/")}`;
    const id = casti[3] ?? "";

    if (casti[2] === "novinky") {
      if (sub === "POST /novinky") return ok({ novinka: ctx.novinky.pridaj(await citajJson(req), ja2.id, teraz) }, 201);
      const n = Number(id);
      if (casti.length === 4 && Number.isInteger(n)) {
        if (metoda === "PATCH") return ok({ novinka: ctx.novinky.uprav(n, await citajJson(req), teraz) });
        if (metoda === "DELETE") {
          ctx.novinky.zmaz(n);
          return ok({ ok: true });
        }
      }
      throw new ChybaVstupu("Neznáma cesta.", 404);
    }

    if (sub === "GET /obsah") {
      return ok({
        karty: ctx.obsah.karty.vsetky(),
        nastavenia: ctx.obsah.nastavenia(),
        ...ctx.obsah.vzhlad(),
        bodovacie: ctx.obsah.bodovacie.vsetky(),
        ikonyBodovania: ctx.obsah.ikonyBodovania.vsetky(),
        zverejnenaVerzia: ctx.obsah.aktualnaSada().sada.verzia,
      });
    }

    if (metoda === "PUT" && casti[2] === "karty" && casti.length === 4) {
      if (!ID_RE.test(id)) throw new ChybaVstupu("Neplatné id karty.");
      const k = overNavrh(await citajJson(req), id, teraz);
      ctx.obsah.ulozKartu(k);
      return ok(k);
    }
    if (metoda === "DELETE" && casti[2] === "karty" && casti.length === 4) {
      if (!ctx.obsah.karty.zmaz(id)) throw new ChybaVstupu("Karta neexistuje.", 404);
      return ok({ ok: true });
    }
    if (sub === "POST /karty/poradie") {
      const b = await citajJson(req);
      const ids = Array.isArray(b.ids) ? b.ids.map((x) => String(x)) : [];
      ids.forEach((kid, i) => {
        const k = ctx.obsah.karty.jeden(kid);
        if (k !== null) ctx.obsah.ulozKartu(k, i);
      });
      return ok({ ok: true });
    }

    if (metoda === "PUT" && casti[2] === "akcie" && casti.length === 4) {
      if (!/^[\p{L}\p{N}_]{1,64}$/u.test(id)) throw new ChybaVstupu("Neplatný kľúč akcie.");
      const a = overAkciu(await citajJson(req), id, ctx.obsah.akcie.jeden(id));
      ctx.obsah.akcie.uloz(id, a);
      return ok(a);
    }
    if (metoda === "DELETE" && casti[2] === "akcie" && casti.length === 4) {
      const a = ctx.obsah.akcie.jeden(id);
      if (a === null) throw new ChybaVstupu("Akcia neexistuje.", 404);
      if (a.ikona.typ === "vstavana" && !id.startsWith("vlastna_")) throw new ChybaVstupu("Vstavanú akciu nemožno zmazať.");
      const pouzita = ctx.obsah.karty.vsetky().filter((k) => (k.lava.akcie[id] ?? 0) + (k.prava.akcie[id] ?? 0) > 0);
      if (pouzita.length > 0) throw new ChybaVstupu(`Akciu používajú karty: ${pouzita.map((k) => k.nazov).join(", ")}.`);
      ctx.obsah.akcie.zmaz(id);
      return ok({ ok: true });
    }

    if (sub === "PUT /klucove-slova") {
      const zoznam = (await citajJsonPole(req)).map(overKlucoveSlovo).filter((k) => k.slovo !== "");
      for (const k of ctx.obsah.klucoveSlova.vsetky()) ctx.obsah.klucoveSlova.zmaz(k.slovo);
      for (const k of zoznam) ctx.obsah.klucoveSlova.uloz(k.slovo, k);
      return ok(zoznam);
    }

    if (sub === "PUT /kategorie") {
      const zoznam = (await citajJsonPole(req)).map(overKategoriu).filter((k) => k.nazov !== "");
      for (const k of ctx.obsah.kategorie.vsetky()) ctx.obsah.kategorie.zmaz(k.nazov);
      for (const k of zoznam) ctx.obsah.kategorie.uloz(k.nazov, k);
      return ok(zoznam);
    }

    if (sub === "PUT /nastavenia") {
      const b = await citajJson(req);
      const n: Nastavenia = {
        sirkaMm: num(b.sirkaMm ?? PREDVOLENE_NASTAVENIA.sirkaMm, 20, 200, "Šírka"),
        vyskaMm: num(b.vyskaMm ?? PREDVOLENE_NASTAVENIA.vyskaMm, 20, 300, "Výška"),
        mierkaTextu: num(b.mierkaTextu ?? PREDVOLENE_NASTAVENIA.mierkaTextu, 0.6, 1.8, "Mierka textu"),
        mierkaIkon: num(b.mierkaIkon ?? PREDVOLENE_NASTAVENIA.mierkaIkon, 0.5, 1.8, "Mierka ikon"),
      };
      ctx.obsah.ulozNastavenia(n);
      return ok(n);
    }

    if (metoda === "PUT" && casti[2] === "bodovacie" && casti.length === 4) {
      if (!ID_RE.test(id)) throw new ChybaVstupu("Neplatné id.");
      const k = overBodovaciu(await citajJson(req), id, teraz);
      ctx.obsah.bodovacie.uloz(id, k);
      return ok(k);
    }
    if (metoda === "DELETE" && casti[2] === "bodovacie" && casti.length === 4) {
      ctx.obsah.bodovacie.zmaz(id);
      return ok({ ok: true });
    }

    if (metoda === "PUT" && casti[2] === "ikony-bodovania" && casti.length === 4) {
      if (!ID_RE.test(id)) throw new ChybaVstupu("Neplatné id.");
      const b = await citajJson(req);
      const podmienka = b.podmienka === null || b.podmienka === undefined ? null : str(b.podmienka, 20, "Význam");
      if (podmienka !== null && !(ALL_PODMIENKY as readonly string[]).includes(podmienka)) throw new ChybaVstupu("Neznámy význam ikony.");
      const ikona: IkonaBodovania = {
        id,
        nazov: str(b.nazov, 40, "Názov").trim(),
        media: mediaId(b.media, "Ikona"),
        podmienka: podmienka as Podmienka | null,
      };
      ctx.obsah.ikonyBodovania.uloz(id, ikona);
      return ok(ikona);
    }
    if (metoda === "DELETE" && casti[2] === "ikony-bodovania" && casti.length === 4) {
      ctx.obsah.ikonyBodovania.zmaz(id);
      return ok({ ok: true });
    }

    if (sub === "POST /media") {
      const druh = (query.get("druh") ?? "karta") as DruhMedia;
      if (!["karta", "ikona", "kniznica", "pozadie"].includes(druh)) throw new ChybaVstupu("Neznámy druh súboru.");
      const typy = druh === "ikona" ? ["image/svg+xml", "image/png"] : ["image/jpeg", "image/png", "image/webp"];
      const buf = await citajTelo(req, MEDIA_LIMIT);
      return ok(ctx.media.uloz(buf, druh, query.get("nazov") ?? "", teraz, typy), 201);
    }
    // Náhľady veľkých obrázkov (Michal 2026-10-22): zoznam bez náhľadu a nahratie
    // menšej kópie, ktorú vyrobí prehliadač admina (Tvorba → Prehľad).
    if (sub === "GET /media-bez-nahladu") return ok({ media: ctx.media.bezNahladu() });
    if (metoda === "PUT" && casti[2] === "media" && casti[4] === "nahlad" && casti.length === 5) {
      if (!/^[0-9a-f]{40}$/.test(id)) throw new ChybaVstupu("Neplatné id obrázka.");
      const buf = await citajTelo(req, MEDIA_LIMIT);
      return ok(ctx.media.nastavNahlad(id, buf, teraz));
    }
    if (sub === "GET /media") {
      const druh = (query.get("druh") ?? "kniznica") as DruhMedia;
      return ok({ media: ctx.media.zoznam(druh) });
    }

    if (sub === "POST /zverejnit") {
      const sada = ctx.obsah.zverejni(ja2.id, teraz);
      ctx.poZverejneni();
      return ok({ verzia: sada.verzia, kariet: sada.karty.length });
    }
    if (sub === "GET /sady") return ok({ sady: ctx.obsah.historiaSad() });
    // Návrat na staršiu sadu = jej opätovné zverejnenie ako nová verzia.
    if (metoda === "POST" && casti[2] === "sady" && casti[4] === "obnovit" && casti.length === 5) {
      const verzia = Number(casti[3]);
      if (!Number.isInteger(verzia)) throw new ChybaVstupu("Neplatná verzia sady.");
      const b = await citajJson(req);
      const r = ctx.obsah.obnovSadu(verzia, ja2.id, teraz, b.navrhy === true);
      ctx.poZverejneni();
      return ok(r);
    }

    if (sub === "GET /export") {
      const txt = exportTxt(ctx.obsah.karty.vsetky(), ctx.obsah.vzhlad().akcie, new Date(teraz));
      res.writeHead(200, {
        "content-type": "text/plain; charset=utf-8",
        "content-disposition": `attachment; filename="kartyai_cards_${new Date(teraz).toISOString().slice(0, 10)}.txt"`,
        "cache-control": "no-store",
      });
      res.end(txt);
      return;
    }
    if (sub === "POST /import") {
      const text = (await citajTelo(req, JSON_LIMIT)).toString("utf8");
      const { karty, nezname } = importTxt(text, ctx.obsah.vzhlad().akcie);
      if (karty.length === 0) throw new ChybaVstupu("V súbore nie je žiadna karta (očakávam export KartyAI).");
      const existujuce = ctx.obsah.karty.vsetky();
      const n = ctx.obsah.nastavenia();
      let pridane = 0;
      let upravene = 0;
      for (const ik of karty) {
        const k = existujuce.find((e) => e.nazov.toLocaleLowerCase("sk") === ik.nazov.toLocaleLowerCase("sk"));
        if (k !== undefined) {
          ctx.obsah.ulozKartu(sTextamiZImportu({ ...k, tagy: ik.tagy, efekt: ik.efekt, lava: ik.lava, prava: ik.prava, upravene: teraz }, ik));
          upravene++;
        } else {
          let nove = slug(ik.nazov) || "karta";
          while (ctx.obsah.karty.jeden(nove) !== null) nove += "_2";
          ctx.obsah.ulozKartu(
            sTextamiZImportu(
              {
                id: nove,
                nazov: ik.nazov,
                tagy: ik.tagy,
                efekt: ik.efekt,
                obrazok: null,
                farba: null,
                ...n,
                kopie: 1,
                lava: ik.lava,
                prava: ik.prava,
                upravene: teraz,
              },
              ik,
            ),
          );
          pridane++;
        }
      }
      return ok({ kariet: karty.length, pridane, upravene, nezname });
    }

    if (sub === "GET /pouzivatelia") return ok({ pouzivatelia: ctx.ucty.zoznam() });
    // Tempo partií — kde ide čas (roadmapa #9, admin.ts tempo).
    if (sub === "GET /tempo") return ok({ partie: ctx.tempoPartii.zoznam() });
    // Štatistiky kariet z odohraných partií (rebalans); ?od=<verzia sady>.
    if (sub === "GET /statistiky-kariet") {
      const od = query.get("od");
      return ok(ctx.archiv.statistikyKariet(od === null || od === "" ? null : Math.round(num(Number(od), 0, 1e9, "Verzia")), query.get("ludia") === "1"));
    }
    // Reporty playtestov: zoznam a token na ich izolované zobrazenie (/playtesty/<token>/…).
    if (sub === "GET /playtesty") return ok({ token: ctx.playtesty.token(teraz), reporty: ctx.playtesty.zoznam() });
    // Nahratie reportu turnusu na živý web (agent Admin po playteste); telo = obsah súboru.
    if (metoda === "PUT" && casti[2] === "playtesty" && casti[3] === "subor" && casti.length >= 5) {
      ctx.playtesty.uloz(casti.slice(4).join("/"), await citajTelo(req, MEDIA_LIMIT));
      return ok({ ok: true });
    }
    // Návrhy zlepšení z playtestov — sekcia Playtest.
    if (sub === "GET /navrhy") return ok({ navrhy: ctx.navrhy.zoznam() });
    if (sub === "GET /navrhy/pocet") return ok({ naRozhodnutie: ctx.navrhy.naRozhodnutie() });
    if (sub === "POST /navrhy") return ok({ ids: ctx.navrhy.nahraj(ja2, await citajJson(req), teraz) }, 201);
    if (casti[2] === "navrhy" && casti.length === 4 && /^\d+$/.test(id)) {
      if (metoda === "PATCH") {
        const b = await citajJson(req);
        ctx.navrhy.uprav(ja2, Number(id), b, teraz);
        // Rozhodnutie aj hlásenie Developera sa premietne do roadmapy.
        const n = typeof b.stav === "string" ? ctx.navrhy.zoznam().find((x) => x.id === Number(id)) : undefined;
        if (n !== undefined) ctx.roadmapa.zNavrhu(n, n.stav, teraz);
        return ok({ ok: true });
      }
      if (metoda === "DELETE") {
        ctx.navrhy.zmaz(ja2, Number(id));
        return ok({ ok: true });
      }
    }
    if (sub === "GET /stav-servera") return ok(ctx.stavServera());
    if (sub === "PUT /uzavierka") {
      const b = await citajJson(req);
      if (typeof b.zapnut !== "boolean") throw new ChybaVstupu("Uzávierka: zapnut musí byť true alebo false.");
      return ok({ uzavierka: ctx.nastavUzavierku(b.zapnut) });
    }
    // Ranky a práva (Michal 2026-10-22): matica rank × právo a pravidlá postupu.
    if (sub === "GET /prava") {
      const n = ctx.prava.nastavenie();
      const spolu = ctx.achievementy?.spoluHviezd() ?? 0;
      // Prahy v hviezdach k percentám — admin vidí, čo percentá dnes znamenajú (null = achievementy vypnuté).
      return ok({ ...n, prava: PRAVA, popis: POPIS_PRAVA, ranky: RANKY_HRACOV, hviezdySpolu: spolu, prahyHviezd: prahyRankov(n.postup, spolu) });
    }
    if (sub === "PUT /prava") {
      const nove = ctx.prava.uloz(ja2, await citajJson(req));
      ctx.ucty.prepocitajRanky(nove.postup);
      return ok(nove);
    }
    if (metoda === "PATCH" && casti[2] === "pouzivatelia" && casti.length === 4) {
      const b = await citajJson(req);
      const ciel = ctx.ucty.podlaId(Number(id));
      if (ciel === null) throw new ChybaVstupu("Taký účet neexistuje.", 404);
      if (ciel.rola === "admin") throw new ChybaVstupu("Úroveň admina sa nemení.");
      // Subadmin mení len hráčske ranky hráčov — nikoho nepovýši na správcu a správcov nemení.
      if (ja2.rola !== "admin" && !jeRankHraca(ciel.rola)) throw new ChybaVstupu("Úroveň subadmina mení len admin.", 403);
      if (b.rola !== undefined) {
        // Admin je len jeden — nikoho ďalšieho na admina povýšiť nemožno.
        const povolene: readonly unknown[] = ja2.rola === "admin" ? [...RANKY_HRACOV, "subadmin"] : RANKY_HRACOV;
        if (!povolene.includes(b.rola)) {
          if (ja2.rola !== "admin" && b.rola === "subadmin") throw new ChybaVstupu("Na subadmina povyšuje len admin.", 403);
          throw new ChybaVstupu(b.rola === "admin" ? "Admin je len jeden." : "Neznáma úroveň účtu.");
        }
      }
      if (b.automaticky !== undefined && b.automaticky !== true) throw new ChybaVstupu("Automatický rank: len true.");
      if (b.ai !== undefined && typeof b.ai !== "boolean") throw new ChybaVstupu("Príznak AI musí byť áno/nie.");
      if (b.ai !== undefined && ja2.rola !== "admin") throw new ChybaVstupu("Príznak AI mení len admin.", 403);
      if (b.rola === undefined && b.ai === undefined && b.automaticky === undefined) throw new ChybaVstupu("Chýba úroveň účtu, automatický rank alebo príznak AI.");
      if (b.rola !== undefined) ctx.ucty.nastavRolu(ciel.id, b.rola as Rola);
      if (b.automaticky === true) ctx.ucty.automatickyRank(ciel.id, ctx.prava.nastavenie().postup);
      if (b.ai !== undefined) ctx.ucty.nastavAi(ciel.id, b.ai);
      return ok({ ok: true });
    }

    throw new ChybaVstupu("Neznáma cesta.", 404);
  } catch (err) {
    if (err instanceof ChybaVstupu) {
      ok({ chyba: err.message }, err.status);
    } else {
      console.error("Chyba API:", err);
      ok({ chyba: "Vnútorná chyba servera." }, 500);
    }
  }
}
