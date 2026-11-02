// Dve inštancie hry na jednom serveri (Michal 2026-11-02): Vypálená je oficiálna hra
// pre všetkých, Zrejúca pokusná — len admin, subadmini a AI playtesteri. Kód je ten
// istý, líši sa len prostredím (NAEX_INSTANCIA). Účty a tvorca kariet sú len vo
// Vypálenej: Zrejúca overí heslo cez Vypálenú (server–server, jej bežné /api/prihlasenie)
// a hrá rozpracovaný stav jej tvorcu (/api/admin/obsah). Vypálená o Zrejúcej nevie —
// netreba ju kvôli tomu meniť ani nasadzovať.

import type { ServerResponse } from "node:http";
import type { Pohlavie } from "@naex/core";
import type { Rola } from "./auth.ts";
import { jeSpravca } from "./auth.ts";
import type { ObsahTvorcu } from "./obsah.ts";

export type Instancia = "vypalena" | "zrejuca";

/** Kto smie do Zrejúcej: admin, subadmin a účet AI (playtesteri, agenti). */
export function jeTester(p: { readonly rola: Rola; readonly ai: boolean }): boolean {
  return jeSpravca(p.rola) || p.ai;
}

export const LEN_PRE_TESTEROV = "Zrejúca je pokusná verzia len pre testerov (admin, subadmini a AI playtesteri). Hrať môžeš vo Vypálenej.";

/** Účet z Vypálenej tak, ako ho vráti jej /api/ja. */
export interface UcetVypalenej {
  readonly login: string;
  readonly meno: string;
  readonly rola: Rola;
  readonly ai: boolean;
  readonly avatar: string | null;
  readonly pohlavie: Pohlavie | null;
}

export type OverenieVypalenej =
  | { readonly stav: "ok"; readonly ucet: UcetVypalenej }
  | { readonly stav: "zle" }
  | { readonly stav: "brzda" }
  | { readonly stav: "nedostupna" };

const CAKAJ_MS = 10_000;

const cookieZOdpovede = (r: Response): string => (r.headers.get("set-cookie") ?? "").split(";")[0] ?? "";

/** Spojenie Zrejúcej s Vypálenou. */
export class Vypalena {
  /** Adresa, na ktorej ju Zrejúca volá (v Dockeri http://naex:8787). */
  readonly url: string;
  /** Verejná adresa pre odkazy hráčom (https://15-235-242-12.sslip.io). */
  readonly adresa: string;
  private readonly admin: { readonly login: string; readonly heslo: string | null };
  private cookieAdmina: string | null = null;

  constructor(url: string, adresa: string, admin: { readonly login: string; readonly heslo: string | null }) {
    this.url = url.replace(/\/+$/, "");
    this.adresa = adresa.replace(/\/+$/, "");
    this.admin = admin;
  }

  private volaj(metoda: string, cesta: string, cookie: string, telo?: unknown, ip?: string): Promise<Response> {
    return fetch(`${this.url}/api${cesta}`, {
      method: metoda,
      headers: {
        "x-naex": "1",
        cookie,
        // Brzda proti hádaniu hesiel vo Vypálenej počíta pokusy podľa IP hráča, nie Zrejúcej.
        ...(ip === undefined || ip === "" ? {} : { "x-forwarded-for": ip }),
        ...(telo === undefined ? {} : { "content-type": "application/json" }),
      },
      body: telo === undefined ? null : JSON.stringify(telo),
      signal: AbortSignal.timeout(CAKAJ_MS),
    });
  }

  /**
   * Overí meno a heslo vo Vypálenej. Reláciu, ktorú tam prihlásenie založí, hneď zruší —
   * hráč je prihlásený len v Zrejúcej.
   */
  async overPrihlasenie(login: string, heslo: string, ip: string): Promise<OverenieVypalenej> {
    try {
      const r = await this.volaj("POST", "/prihlasenie", "", { login, heslo }, ip);
      if (r.status === 401) return { stav: "zle" };
      if (r.status === 429) return { stav: "brzda" };
      if (!r.ok) return { stav: "nedostupna" };
      const cookie = cookieZOdpovede(r);
      try {
        const ja = await this.volaj("GET", "/ja", cookie);
        const p = ja.ok ? ((await ja.json()) as { pouzivatel: (Partial<UcetVypalenej> & { login: string }) | null }).pouzivatel : null;
        if (p === null) return { stav: "nedostupna" };
        return {
          stav: "ok",
          ucet: { login: p.login, meno: p.meno ?? p.login, rola: p.rola ?? "navstevnik", ai: p.ai === true, avatar: p.avatar ?? null, pohlavie: p.pohlavie ?? null },
        };
      } finally {
        await this.volaj("POST", "/odhlasenie", cookie).catch(() => undefined);
      }
    } catch {
      return { stav: "nedostupna" };
    }
  }

  private async prihlasAdmina(): Promise<string> {
    if (this.admin.heslo === null || this.admin.heslo === "") throw new Error("Zrejúca nemá heslo admina Vypálenej (NAEX_ADMIN_HESLO) — tvorcu nenačíta.");
    const r = await this.volaj("POST", "/prihlasenie", "", { login: this.admin.login, heslo: this.admin.heslo });
    if (!r.ok) throw new Error(`Prihlásenie admina do Vypálenej: ${r.status} ${await r.text()}`);
    this.cookieAdmina = cookieZOdpovede(r);
    return this.cookieAdmina;
  }

  /** Rozpracovaný stav tvorcu Vypálenej (GET /api/admin/obsah). Reláciu admina drží a pri vypršaní sa prihlási znova. */
  async tvorca(): Promise<ObsahTvorcu> {
    for (let pokus = 0; pokus < 2; pokus++) {
      const cookie = this.cookieAdmina ?? (await this.prihlasAdmina());
      const r = await this.volaj("GET", "/admin/obsah", cookie);
      if (r.status === 401 || r.status === 403) {
        this.cookieAdmina = null;
        continue;
      }
      if (!r.ok) throw new Error(`Tvorca Vypálenej: ${r.status} ${await r.text()}`);
      return (await r.json()) as ObsahTvorcu;
    }
    throw new Error("Tvorca Vypálenej: admin nemá prístup.");
  }

  /**
   * Obrázok, ktorý Zrejúca nemá (ilustrácie kariet a avatary sú vo Vypálenej) — prepošle
   * ho zo svojho pôvodu, lebo stránka smie načítať obrázky len odtiaľ (CSP img-src 'self').
   */
  async posliMedia(id: string, query: string, res: ServerResponse): Promise<void> {
    try {
      const r = await fetch(`${this.url}/media/${encodeURIComponent(id)}${query}`, { signal: AbortSignal.timeout(CAKAJ_MS) });
      const hlavicky: Record<string, string> = {};
      for (const h of ["content-type", "cache-control", "x-content-type-options", "content-security-policy"]) {
        const v = r.headers.get(h);
        if (v !== null) hlavicky[h] = v;
      }
      res.writeHead(r.status, hlavicky);
      res.end(Buffer.from(await r.arrayBuffer()));
    } catch {
      if (!res.headersSent) res.writeHead(502);
      res.end();
    }
  }
}

/** Nastavenie inštancie z prostredia (index.ts). */
export function instanciaZProstredia(env: Readonly<Record<string, string | undefined>>): Instancia {
  const v = env.NAEX_INSTANCIA ?? "vypalena";
  if (v !== "vypalena" && v !== "zrejuca") throw new Error(`NAEX_INSTANCIA=${v}: povolené je vypalena alebo zrejuca.`);
  return v;
}
