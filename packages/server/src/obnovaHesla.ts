// Obnova zabudnutého hesla (Michal 2026-11-01): hráč zadá e-mail z profilu,
// dostane odkaz platný 1 hodinu, použiteľný raz. Odpoveď na žiadosť je vždy
// rovnaká — nik nezistí, kto je registrovaný. V databáze je len hash tokenu.

import { createHash, randomBytes } from "node:crypto";
import type { Db } from "./db.ts";
import type { Pouzivatel, Ucty } from "./auth.ts";
import { ChybaVstupu } from "./auth.ts";

export const PLATNOST_ODKAZU_MS = 60 * 60 * 1000;
/** Brzda proti spamu: žiadosti z jednej IP a na jeden e-mail za OKNO_LIMITU_MS. */
export const LIMIT_NA_IP = 5;
export const LIMIT_NA_EMAIL = 3;
export const OKNO_LIMITU_MS = 60 * 60 * 1000;

/** Text, ktorý dostane každý žiadateľ — aj keď účet s e-mailom neexistuje. */
export const ODPOVED_ZIADOSTI = "Ak účet s týmto e-mailom existuje, poslali sme naň odkaz na obnovu hesla.";

const NEPLATNY_ODKAZ = "Odkaz na obnovu hesla je neplatný alebo už vypršal. Požiadaj o nový.";

const hashTokenu = (t: string): string => createHash("sha256").update(t).digest("hex");

export interface ZiadostOObnovu {
  readonly pouzivatel: Pouzivatel;
  readonly email: string;
  /** Token do odkazu — v databáze je len jeho hash, preto ho treba poslať hneď. */
  readonly token: string;
}

export class ObnovaHesla {
  private readonly db: Db;
  private readonly ucty: Ucty;
  /** Časy žiadostí podľa IP a podľa e-mailu (malými písmenami) — len v pamäti ako brzda prihlásenia. */
  private readonly podlaIp = new Map<string, number[]>();
  private readonly podlaEmailu = new Map<string, number[]>();

  constructor(db: Db, ucty: Ucty) {
    this.db = db;
    this.ucty = ucty;
  }

  /**
   * Žiadosť o odkaz. Príliš veľa žiadostí z IP → 429 (nezávisí od účtu, nič neprezradí).
   * Príliš veľa na ten istý e-mail → potichu nič, aby sa schránka nedala zasypať.
   * Vráti token na odoslanie, alebo null (neznámy e-mail alebo brzda e-mailu).
   */
  poziadaj(email: string, ip: string, teraz: number): ZiadostOObnovu | null {
    this.uprac(teraz);
    if (!zapocitaj(this.podlaIp, ip, LIMIT_NA_IP, teraz)) {
      throw new ChybaVstupu("Príliš veľa žiadostí o obnovu hesla. Skús to o hodinu.", 429);
    }
    const token = randomBytes(32).toString("base64url");
    const hash = hashTokenu(token);
    if (!zapocitaj(this.podlaEmailu, email.toLowerCase(), LIMIT_NA_EMAIL, teraz)) return null;
    const p = this.ucty.podlaEmailu(email);
    if (p === null) return null;
    this.db.prepare("DELETE FROM obnova_hesla WHERE plati_do < ?").run(teraz);
    this.db.prepare("INSERT INTO obnova_hesla (token, pouzivatel, vytvoreny, plati_do) VALUES (?, ?, ?, ?)").run(hash, p.id, teraz, teraz + PLATNOST_ODKAZU_MS);
    return { pouzivatel: p, email: this.ucty.email(p.id) ?? email, token };
  }

  /** Účet, ktorému odkaz patrí, ak ešte platí; inak null. */
  private ucetOdkazu(token: unknown, teraz: number): number | null {
    if (typeof token !== "string" || token.length < 20 || token.length > 200) return null;
    const r = this.db.prepare("SELECT pouzivatel, plati_do FROM obnova_hesla WHERE token = ?").get(hashTokenu(token)) as
      | { pouzivatel: number; plati_do: number }
      | undefined;
    return r === undefined || r.plati_do < teraz ? null : r.pouzivatel;
  }

  /** Či odkaz ešte platí — stránka nového hesla to povie hneď, nie až po vyplnení. */
  platny(token: unknown, teraz: number): boolean {
    return this.ucetOdkazu(token, teraz) !== null;
  }

  /**
   * Nové heslo z odkazu. Odkaz aj všetky ostatné odkazy účtu zaniknú a všetky relácie
   * sa zrušia (Ucty.nastavHesloPoObnove). Vráti účet — volajúci ho prihlási novou reláciou.
   */
  nastavHeslo(token: unknown, heslo: string, teraz: number): Pouzivatel {
    const id = this.ucetOdkazu(token, teraz);
    const p = id === null ? null : this.ucty.podlaId(id);
    if (id === null || p === null) throw new ChybaVstupu(NEPLATNY_ODKAZ, 400);
    this.ucty.nastavHesloPoObnove(id, heslo);
    return p;
  }

  private uprac(teraz: number): void {
    for (const m of [this.podlaIp, this.podlaEmailu]) {
      for (const [k, casy] of m) if (casy.every((c) => teraz - c >= OKNO_LIMITU_MS)) m.delete(k);
    }
  }
}

/** Zapíše žiadosť do okna; false = limit je vyčerpaný (žiadosť sa nezapíše). */
function zapocitaj(m: Map<string, number[]>, kluc: string, limit: number, teraz: number): boolean {
  const casy = (m.get(kluc) ?? []).filter((c) => teraz - c < OKNO_LIMITU_MS);
  if (casy.length >= limit) {
    m.set(kluc, casy);
    return false;
  }
  m.set(kluc, [...casy, teraz]);
  return true;
}

/** Text e-mailu s odkazom; adresa = verejná adresa webu (NAEX_ADRESA), bez nej len cesta. */
export function textEmailuObnovy(p: Pick<Pouzivatel, "meno" | "login">, token: string, adresa: string | null): { predmet: string; text: string } {
  const odkaz = `${adresa === null ? "" : adresa.replace(/\/+$/, "")}/obnova-hesla?t=${token}`;
  return {
    predmet: "NA EX! — obnova hesla",
    text: [
      `Ahoj ${p.meno},`,
      "",
      `niekto (dúfame, že ty) požiadal o obnovu hesla k účtu ${p.login} na webe NA EX!.`,
      "Nové heslo si nastavíš na tomto odkaze — platí 1 hodinu a dá sa použiť len raz:",
      "",
      odkaz,
      "",
      "Ak si o obnovu nežiadal, tento e-mail ignoruj — heslo ostáva bez zmeny.",
    ].join("\n"),
  };
}
