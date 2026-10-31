// Heslá AI účtov na jednom mieste pre všetky pracoviská (tools/playtest/ucty.ts).
// Na živom webe vzniklo ai-admin-2…6, lebo každé pracovisko malo vlastný
// playtest/ucty.json a nové pracovisko heslo nenašlo (2026-10-26).

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type Ucty,
  type WebUcet,
  citajUcty,
  klucWebu,
  nacitajUcty,
  najdiUlozeny,
  zlucPracoviska,
  zlucUcty,
} from "../../../tools/playtest/ucty.ts";
import { prihlasAgenta } from "../../../tools/playtest/web.ts";

const ZIVY = "https://zivy.test";
const ucet = (login: string, heslo: string, meno = "Admin (AI)"): WebUcet => ({ login, heslo, meno });

let koren: string;
beforeEach(() => {
  koren = mkdtempSync(join(tmpdir(), "naex-ucty-test-"));
});
afterEach(() => {
  rmSync(koren, { recursive: true, force: true });
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function pracovisko(meno: string, ucty: Ucty): string {
  const p = join(koren, meno);
  mkdirSync(join(p, "playtest"), { recursive: true });
  writeFileSync(join(p, "playtest", "ucty.json"), JSON.stringify(ucty));
  return p;
}

describe("spoločný súbor hesiel AI účtov", () => {
  it("zlúčenie neprepíše existujúce heslo", () => {
    const r = zlucUcty({ [ZIVY]: { "ai-admin": ucet("ai-admin", "prve") } }, { [ZIVY]: { "ai-admin": ucet("ai-admin", "druhe"), "ai-navrhar": ucet("ai-navrhar", "n") } });
    expect(r.ucty[ZIVY]?.["ai-admin"]?.heslo).toBe("prve");
    expect(r.ucty[ZIVY]?.["ai-navrhar"]?.heslo).toBe("n");
    expect(r.pridane).toBe(1);
  });

  it("zlúči playtest/ucty.json všetkých pracovísk naex*, lokálne účty podľa databázy pracoviska", () => {
    const a = pracovisko("naex", { [ZIVY]: { "ai-admin": ucet("ai-admin", "zivy-1") }, "http://localhost:8787": { "ai-admin": ucet("ai-admin", "lok-a") } });
    const b = pracovisko("naex-navrhar", { [ZIVY]: { "ai-admin-2": ucet("ai-admin-2", "zivy-2") }, "http://localhost:8787": { "ai-admin": ucet("ai-admin", "lok-b") } });
    pracovisko("ine", { [ZIVY]: { "ai-cudzi": ucet("ai-cudzi", "x") } });
    const subor = join(koren, "spolocne", "naex-ucty.json");

    expect(zlucPracoviska(subor, koren)).toEqual({ pracoviska: 2, pridane: 4 });
    const u = citajUcty(subor);
    expect(Object.keys(u[ZIVY] ?? {}).sort()).toEqual(["ai-admin", "ai-admin-2"]);
    expect(u[klucWebu("http://localhost:8787", join(a, "data"))]?.["ai-admin"]?.heslo).toBe("lok-a");
    expect(u[klucWebu("http://localhost:5174", join(b, "data"))]?.["ai-admin"]?.heslo).toBe("lok-b");
    expect(u["http://localhost:8787"]).toBeUndefined();
  });

  it("pri prvom spustení zlúči pracoviská, potom už nie", () => {
    pracovisko("naex", { [ZIVY]: { "ai-admin": ucet("ai-admin", "zivy-1") } });
    const subor = join(koren, "naex-ucty.json");
    expect(nacitajUcty(subor, koren)[ZIVY]?.["ai-admin"]?.heslo).toBe("zivy-1");

    pracovisko("naex-nove", { [ZIVY]: { "ai-navrhar": ucet("ai-navrhar", "n") } });
    expect(nacitajUcty(subor, koren)[ZIVY]?.["ai-navrhar"]).toBeUndefined();
  });

  it("uložený účet: presný login má prednosť, iný agent s podobným loginom sa nezamení", () => {
    const ulozene = { "ai-dizajner-ui": ucet("ai-dizajner-ui", "ui"), "ai-dizajner-2": ucet("ai-dizajner-2", "d2"), "ai-dizajner": ucet("ai-dizajner", "d") };
    expect(najdiUlozeny(ulozene, "ai-dizajner")?.heslo).toBe("d");
    expect(najdiUlozeny({ "ai-dizajner-ui": ulozene["ai-dizajner-ui"], "ai-dizajner-2": ulozene["ai-dizajner-2"] }, "ai-dizajner")?.heslo).toBe("d2");
    expect(najdiUlozeny({ "ai-dizajner-ui": ulozene["ai-dizajner-ui"] }, "ai-dizajner")).toBeUndefined();
  });
});

describe("prihlasAgenta bez uloženého hesla", () => {
  /** Web, na ktorom sú zadané loginy obsadené; zaznamená pokusy o registráciu. */
  function webSObsadenymi(obsadene: readonly string[]): string[] {
    const registracie: string[] = [];
    vi.stubGlobal("fetch", async (adresa: string, init?: { body?: string | null }) => {
      const cesta = new URL(adresa).pathname;
      if (cesta === "/api/registracia") {
        const login = (JSON.parse(init?.body ?? "{}") as { login: string }).login;
        registracie.push(login);
        return obsadene.includes(login) ? new Response("Toto prihlasovacie meno je obsadené.", { status: 400 }) : new Response("{}");
      }
      if (cesta === "/api/prihlasenie") return new Response("{}", { headers: { "set-cookie": "naex=relacia; Path=/" } });
      if (cesta === "/api/ja") return new Response(JSON.stringify({ pouzivatel: { id: 1, meno: "x", rola: "subadmin", ai: true, pohlavie: "muz" } }));
      return new Response("{}");
    });
    return registracie;
  }

  it("Admin (AI) nezaloží účet s príponou a skončí s návodom", async () => {
    const subor = join(koren, "naex-ucty.json");
    writeFileSync(subor, "{}");
    vi.stubEnv("NAEX_UCTY", subor);
    const registracie = webSObsadenymi(["ai-admin"]);

    await expect(prihlasAgenta(ZIVY, "Admin", "subadmin")).rejects.toThrow(/nový s príponou sa nezakladá[\s\S]*zluc-ucty/);
    expect(registracie).toEqual(["ai-admin"]);
    expect(citajUcty(subor)).toEqual({});
  });

  it("Admin (AI) s uloženým heslom sa prihlási bez registrácie", async () => {
    const subor = join(koren, "naex-ucty.json");
    writeFileSync(subor, JSON.stringify({ [ZIVY]: { "ai-admin": ucet("ai-admin", "tajne") } }));
    vi.stubEnv("NAEX_UCTY", subor);
    const registracie = webSObsadenymi(["ai-admin"]);

    expect((await prihlasAgenta(ZIVY, "Admin", "subadmin")).login).toBe("ai-admin");
    expect(registracie).toEqual([]);
  });

  it("ani postava playtestera pri obsadenom logine nezaloží ďalší s príponou", async () => {
    const subor = join(koren, "naex-ucty.json");
    writeFileSync(subor, "{}");
    vi.stubEnv("NAEX_UCTY", subor);
    const registracie = webSObsadenymi(["ai-jano-bitkar"]);

    await expect(prihlasAgenta(ZIVY, "Jano Bitkár")).rejects.toThrow(/nový s príponou sa nezakladá/);
    expect(registracie).toEqual(["ai-jano-bitkar"]);
    expect(citajUcty(subor)).toEqual({});
  });

  it("nová postava si založí účet bez prípony", async () => {
    const subor = join(koren, "naex-ucty.json");
    writeFileSync(subor, "{}");
    vi.stubEnv("NAEX_UCTY", subor);
    const registracie = webSObsadenymi([]);

    expect((await prihlasAgenta(ZIVY, "Jano Bitkár")).login).toBe("ai-jano-bitkar");
    expect(registracie).toEqual(["ai-jano-bitkar"]);
  });
});
