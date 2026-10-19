// Spoločné pre serverové testy: dočasný dátový adresár a registrácia hráča.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WebSocket } from "ws";
import { createGameServer, type GameServer, type ServerOpts } from "../src/server.ts";

/** Testovací admin — heslo len pre dočasnú databázu testu. */
export const TEST_ADMIN = { login: "sefko", heslo: "sefkovo-testovacie" } as const;

export async function testovaciServer(
  admin: { login: string; heslo: string | null } = TEST_ADMIN,
  navyse: Partial<ServerOpts> = {},
): Promise<{ server: GameServer; zmaz: () => Promise<void> }> {
  const dir = mkdtempSync(join(tmpdir(), "naex-test-"));
  const server = await createGameServer({ ...navyse, port: 0, dataDir: dir, admin, staticDir: join(dir, "nic") });
  return {
    server,
    zmaz: async () => {
      await server.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

let pocitadlo = 0;

/** Zaregistruje nového hráča a vráti jeho cookie. */
export async function registruj(port: number, login?: string): Promise<{ cookie: string; login: string }> {
  const meno = login ?? `hrac${Date.now() % 100000}${++pocitadlo}`;
  const res = await fetch(`http://127.0.0.1:${port}/api/registracia`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-naex": "1" },
    body: JSON.stringify({ login: meno, heslo: "tajneheslo", meno: `Hráč ${meno}` }),
  });
  if (res.status !== 201) throw new Error(`registrácia zlyhala: ${res.status} ${await res.text()}`);
  const cookie = (res.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
  return { cookie, login: meno };
}

/** Prihlási existujúci účet a vráti jeho cookie. */
export async function prihlas(port: number, login: string, heslo: string): Promise<string> {
  const res = await fetch(`http://127.0.0.1:${port}/api/prihlasenie`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-naex": "1" },
    body: JSON.stringify({ login, heslo }),
  });
  if (res.status !== 200) throw new Error(`prihlásenie zlyhalo: ${res.status} ${await res.text()}`);
  return (res.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
}

/** Admin nastaví úroveň účtu s danou cookie (napr. návštevníka spraví hráčom). */
export async function nastavUroven(port: number, adminCookie: string, cookie: string, rola: string): Promise<void> {
  const hlavicky = { "content-type": "application/json", "x-naex": "1" };
  const ja = (await (await fetch(`http://127.0.0.1:${port}/api/ja`, { headers: { cookie } })).json()) as { pouzivatel: { id: number } };
  const res = await fetch(`http://127.0.0.1:${port}/api/admin/pouzivatelia/${ja.pouzivatel.id}`, {
    method: "PATCH",
    headers: { ...hlavicky, cookie: adminCookie },
    body: JSON.stringify({ rola }),
  });
  if (res.status !== 200) throw new Error(`zmena úrovne zlyhala: ${res.status} ${await res.text()}`);
}

export interface Msg {
  type: string;
  [k: string]: unknown;
}

/** Testovací klient: fronta správ + čakanie na konkrétny typ. */
export class Klient {
  private readonly ws: WebSocket;
  private readonly fronta: Msg[] = [];
  private cakajuci: { rieš: (m: Msg) => void; typ: string } | null = null;

  constructor(port: number, cookie: string) {
    this.ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, { headers: { cookie } });
    this.ws.on("message", (raw) => {
      const msg = JSON.parse(String(raw)) as Msg;
      if (this.cakajuci !== null && msg.type === this.cakajuci.typ) {
        const { rieš } = this.cakajuci;
        this.cakajuci = null;
        rieš(msg);
      } else {
        this.fronta.push(msg);
      }
    });
  }

  async otvorene(): Promise<void> {
    if (this.ws.readyState === WebSocket.OPEN) return;
    await new Promise<void>((rieš, zamietni) => {
      this.ws.once("open", rieš);
      this.ws.once("error", zamietni);
    });
  }

  posli(msg: unknown): void {
    this.ws.send(JSON.stringify(msg));
  }

  /** Vráti najbližšiu správu daného typu (z fronty alebo počká, max 5 s). */
  async cakaj(typ: string): Promise<Msg> {
    const vFronte = this.fronta.findIndex((m) => m.type === typ);
    if (vFronte !== -1) return this.fronta.splice(vFronte, 1)[0] as Msg;
    return await new Promise<Msg>((rieš, zamietni) => {
      const timeout = setTimeout(() => {
        this.cakajuci = null;
        zamietni(new Error(`Nedošla správa typu ${typ}`));
      }, 5000);
      this.cakajuci = {
        typ,
        rieš: (m) => {
          clearTimeout(timeout);
          rieš(m);
        },
      };
    });
  }

  zavri(): void {
    this.ws.close();
  }
}

