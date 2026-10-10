// Spoločné pre serverové testy: dočasný dátový adresár a registrácia hráča.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createGameServer, type GameServer } from "../src/server.ts";

export async function testovaciServer(admini: string[] = []): Promise<{ server: GameServer; zmaz: () => Promise<void> }> {
  const dir = mkdtempSync(join(tmpdir(), "naex-test-"));
  const server = await createGameServer({ port: 0, dataDir: dir, admini, staticDir: join(dir, "nic") });
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
