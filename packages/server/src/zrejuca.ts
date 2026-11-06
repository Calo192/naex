// Dve inštancie hry na jednom serveri a jednej adrese (Michal 2026-11-02): Vypálená je
// oficiálna hra, Zrejúca pokusná — hrá ju len ten, kto má vo Vypálenej oprávnenie
// hrat_zrejucu (prava.ts). Kód je ten istý, líši sa prostredím (NAEX_INSTANCIA). Bežia ako
// dva procesy, aby nasadenie Zrejúcej nezhodilo partie Vypálenej; Caddy ich rozlišuje podľa
// cookie naex_instancia (prepínač na stránke Hrať), nástroje agentov podľa cesty /zrejuca/.
// Účty a tvorca kariet sú len vo Vypálenej: Zrejúca overí reláciu prehliadača (tá istá
// cookie naex_sid, pôvod je spoločný) cez /api/ja Vypálenej a hrá rozpracovaný stav jej
// tvorcu (/api/admin/obsah).

import type { ServerResponse } from "node:http";
import type { Pohlavie } from "@naex/core";
import type { Rola } from "./auth.ts";
import type { ObsahTvorcu } from "./obsah.ts";

export type Instancia = "vypalena" | "zrejuca";

export const LEN_PRE_TESTEROV =
  "Zrejúca je pokusná verzia hry len pre hráčov s oprávnením (admin ho udeľuje; predvolene Sedmička, správcovia a AI playtesteri). Hrať môžeš vo Vypálenej.";

/** Cookie, podľa ktorej Caddy posiela prehliadač do Zrejúcej; bez nej (alebo prázdna) Vypálená. */
export const COOKIE_INSTANCIE = "naex_instancia";

/** Prepnutie inštancie v prehliadači — cookie čítajú len Caddy a server, preto HttpOnly. */
export function cookieInstancie(zrejuca: boolean, bezpecne: boolean): string {
  const zivot = zrejuca ? `Max-Age=${30 * 24 * 60 * 60}` : "Max-Age=0";
  return `${COOKIE_INSTANCIE}=${zrejuca ? "zrejuca" : ""}; Path=/; HttpOnly; SameSite=Lax; ${zivot}${bezpecne ? "; Secure" : ""}`;
}

/** Účet z Vypálenej tak, ako ho vráti jej /api/ja — aj s právami (oprávnenie hrat_zrejucu). */
export interface UcetVypalenej {
  readonly login: string;
  readonly meno: string;
  readonly rola: Rola;
  readonly ai: boolean;
  readonly avatar: string | null;
  readonly pohlavie: Pohlavie | null;
  readonly prava: readonly string[];
}

const CAKAJ_MS = 10_000;

const cookieZOdpovede = (r: Response): string => (r.headers.get("set-cookie") ?? "").split(";")[0] ?? "";

/** Spojenie Zrejúcej s Vypálenou. */
export class Vypalena {
  /** Adresa, na ktorej ju Zrejúca volá (v Dockeri http://naex:8787). */
  readonly url: string;
  /**
   * Adresa Vypálenej pre prehliadač; null = tá istá adresa (Caddy, prepína cookie). Vo vývoji
   * bežia na rôznych portoch, vtedy sem ide napr. http://localhost:8789.
   */
  readonly adresa: string | null;
  private readonly admin: { readonly login: string; readonly heslo: string | null };
  private cookieAdmina: string | null = null;

  constructor(url: string, adresa: string | null, admin: { readonly login: string; readonly heslo: string | null }) {
    this.url = url.replace(/\/+$/, "");
    this.adresa = adresa === null ? null : adresa.replace(/\/+$/, "");
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

  /** Kto je prihlásený reláciou `cookie` (hlavička Cookie prehliadača); null = nikto alebo Vypálená neodpovedá. */
  async relacia(cookie: string): Promise<UcetVypalenej | null> {
    try {
      const r = await this.volaj("GET", "/ja", cookie);
      if (!r.ok) return null;
      const p = ((await r.json()) as { pouzivatel: (Partial<UcetVypalenej> & { login: string }) | null }).pouzivatel;
      if (p === null) return null;
      return {
        login: p.login,
        meno: p.meno ?? p.login,
        rola: p.rola ?? "navstevnik",
        ai: p.ai === true,
        avatar: p.avatar ?? null,
        pohlavie: p.pohlavie ?? null,
        prava: Array.isArray(p.prava) ? p.prava : [],
      };
    } catch {
      return null;
    }
  }

  /**
   * Prihlásenie a odhlásenie v Zrejúcej robí Vypálená — jej odpoveď (aj Set-Cookie relácie)
   * ide prehliadaču bez zmeny; adresa je spoločná, relácia platí v oboch.
   */
  preposli(cesta: "/prihlasenie" | "/odhlasenie", cookie: string, telo: unknown, ip: string): Promise<Response> {
    return this.volaj("POST", cesta, cookie, telo, ip);
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

/**
 * Režimy, ktoré sú len v Zrejúcej (Michal 2026-11-06: hráči dostanú len novú verziu Kalamity 1 na 1).
 * Vypálená ich odmieta a kým tu niečo je, Zrejúca nie je „bez zmien“, aj keď je na tom istom
 * commite. Keď režim pôjde hráčom, vyškrtni ho tu a zapni ho aj vo Vypálenej (index.ts).
 */
export const REZIMY_LEN_V_ZREJUCEJ: readonly string[] = ["2 na 2", "Päta, Lakeť, Otočka"];

/** Čo povie server tomu, kto chce taký režim tam, kde nie je. */
export const REZIM_LEN_V_ZREJUCEJ = "Tento režim je len v Zrejúcej.";

/** Nastavenie inštancie z prostredia (index.ts). */
export function instanciaZProstredia(env: Readonly<Record<string, string | undefined>>): Instancia {
  const v = env.NAEX_INSTANCIA ?? "vypalena";
  if (v !== "vypalena" && v !== "zrejuca") throw new Error(`NAEX_INSTANCIA=${v}: povolené je vypalena alebo zrejuca.`);
  return v;
}
