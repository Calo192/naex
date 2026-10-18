// REST API pod /api. Bez frameworku — pár ciest a prísna kontrola vstupu.
//
// Bezpečnosť:
// * relácia v HttpOnly cookie (SameSite=Lax),
// * každá zmena (nie GET) musí niesť hlavičku X-Naex: 1 — formulár z cudzej
//   stránky ju poslať nevie, takže CSRF neprejde,
// * admin cesty overujú rolu na serveri pri každej požiadavke.

import type { IncomingMessage, ServerResponse } from "node:http";
import type { DlzkaHry, Podmienka } from "@naex/core";
import { ALL_PODMIENKY, dostupneDlzky } from "@naex/core";
import type { KartaNavrh, Pozicia, StranaNavrhu, AkciaDef, KlucoveSlovo, Kategoria, BodovaciaKarta, IkonaBodovania, Nastavenia } from "@naex/tvorba";
import { exportTxt, importTxt, slug, PREDVOLENE_NASTAVENIA } from "@naex/tvorba";
import type { Pouzivatel, Ucty } from "./auth.ts";
import { ChybaVstupu, cookieOdhlasenia, cookieRelacie, overHesloVstup, overLogin, overMeno, citajCookie, jeSpravca } from "./auth.ts";
import type { DruhMedia, Media } from "./media.ts";
import type { Obsah } from "./obsah.ts";
import type { Archiv } from "./archiv.ts";
import type { KategoriaNazoru, Nazory, Triedenie } from "./nazory.ts";
import type { Playtesty } from "./playtesty.ts";
import { overKategoriu as overKategoriuNazoru } from "./nazory.ts";

export interface OtvorenaHra {
  readonly kod: string;
  readonly hostitel: { readonly meno: string; readonly avatar: string | null; readonly frajerina: number | null };
  readonly dlzka: DlzkaHry;
  readonly vytvorena: number;
}

export interface ApiKontext {
  readonly ucty: Ucty;
  readonly obsah: Obsah;
  readonly media: Media;
  readonly archiv: Archiv;
  readonly nazory: Nazory;
  readonly playtesty: Playtesty;
  readonly teraz: () => number;
  readonly bezpecneCookie: boolean;
  /** Verejné hry čakajúce na súpera (z herného servera). */
  readonly otvoreneHry: () => readonly OtvorenaHra[];
  /** Po zverejnení novej sady — nové hry pobežia na nej. */
  readonly poZverejneni: () => void;
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
  return { blokovane: pozicie(s.blokovane ?? [], `${pole}.blokovane`), akcie, povolene };
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
  };
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
    if (r === "GET /ja") return ok({ pouzivatel: ja === null ? null : { ...ja, dohrate: ctx.ucty.dohrate(ja.id) } });

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
      return ok({ pouzivatel: ctx.ucty.upravProfil(p.id, { meno: overMeno(b.meno) }) });
    }

    if (r === "POST /profil/heslo") {
      const p = prihlaseny();
      const b = await citajJson(req);
      ctx.ucty.zmenHeslo(p.id, String(b.stare ?? ""), overHesloVstup(b.nove));
      return ok({ ok: true });
    }

    if (r === "PUT /profil/avatar") {
      const p = prihlaseny();
      const buf = await citajTelo(req, AVATAR_LIMIT);
      const m = ctx.media.uloz(buf, "avatar", `avatar-${p.id}`, teraz, ["image/jpeg", "image/png", "image/webp"]);
      return ok({ pouzivatel: ctx.ucty.upravProfil(p.id, { avatar: m.id }) });
    }

    if (r === "DELETE /profil/avatar") {
      const p = prihlaseny();
      return ok({ pouzivatel: ctx.ucty.upravProfil(p.id, { avatar: null }) });
    }

    // ----- verejné -------------------------------------------------------
    if (r === "GET /sada") return ok(ctx.obsah.aktualnaSada().sada);

    if (r === "GET /hry/otvorene") {
      prihlaseny();
      return ok({ hry: ctx.otvoreneHry(), dlzky: dostupneDlzky(ctx.obsah.aktualnaSada().data) });
    }

    // ----- profily hráčov a rebríček (pre prihlásených) -----------------
    if (metoda === "GET" && casti[1] === "hraci" && casti.length === 3) {
      prihlaseny();
      const id = Number(casti[2]);
      const profil = Number.isInteger(id) ? ctx.archiv.profil(id) : null;
      if (profil === null) throw new ChybaVstupu("Taký hráč neexistuje.", 404);
      return ok(profil);
    }

    if (r === "GET /rebricek") {
      prihlaseny();
      return ok({ hraci: ctx.archiv.rebricek() });
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
        return ok({ nazory: ctx.nazory.zoznam(p, triedenie, kategoria) });
      }
      if (r === "POST /nazory") {
        const b = await citajJson(req);
        return ok({ id: ctx.nazory.pridaj(p, b.kategoria, b.text, teraz) }, 201);
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
          ctx.obsah.ulozKartu({ ...k, tagy: ik.tagy, efekt: ik.efekt, lava: ik.lava, prava: ik.prava, upravene: teraz });
          upravene++;
        } else {
          let nove = slug(ik.nazov) || "karta";
          while (ctx.obsah.karty.jeden(nove) !== null) nove += "_2";
          ctx.obsah.ulozKartu({
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
          });
          pridane++;
        }
      }
      return ok({ kariet: karty.length, pridane, upravene, nezname });
    }

    if (sub === "GET /pouzivatelia") return ok({ pouzivatelia: ctx.ucty.zoznam() });
    // Štatistiky kariet z odohraných partií (rebalans); ?od=<verzia sady>.
    if (sub === "GET /statistiky-kariet") {
      const od = query.get("od");
      return ok(ctx.archiv.statistikyKariet(od === null || od === "" ? null : Math.round(num(Number(od), 0, 1e9, "Verzia"))));
    }
    // Reporty playtestov: zoznam a token na ich izolované zobrazenie (/playtesty/<token>/…).
    if (sub === "GET /playtesty") return ok({ token: ctx.playtesty.token(teraz), reporty: ctx.playtesty.zoznam() });
    if (metoda === "PATCH" && casti[2] === "pouzivatelia" && casti.length === 4) {
      if (ja2.rola !== "admin") throw new ChybaVstupu("Úroveň účtu mení len admin.", 403);
      const b = await citajJson(req);
      // Admin je len jeden — nikoho ďalšieho na admina povýšiť nemožno.
      if (b.rola !== "subadmin" && b.rola !== "hrac" && b.rola !== "navstevnik") throw new ChybaVstupu("Neznáma úroveň účtu.");
      const ciel = ctx.ucty.podlaId(Number(id));
      if (ciel === null) throw new ChybaVstupu("Taký účet neexistuje.", 404);
      if (ciel.rola === "admin") throw new ChybaVstupu("Úroveň admina sa nemení.");
      ctx.ucty.nastavRolu(ciel.id, b.rola);
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
