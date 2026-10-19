// Predvolené avatary: kto nemá vlastnú fotku, dostane náhodnú dedinskú
// trosku — pri štarte, pri registrácii aj po zmazaní fotky. Boti majú svoje.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { Avatary } from "../src/avatary.ts";
import { Ucty } from "../src/auth.ts";
import { otvorDb } from "../src/db.ts";
import { Media } from "../src/media.ts";

/** Najmenší „JPEG“, ktorý média prijmú (podľa hlavičky); obsah odlišuje id. */
const jpeg = (n: number): Buffer => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from(`troska-${n}`)]);

const adresare: string[] = [];
const databazy: { close(): void }[] = [];
afterEach(() => {
  for (const db of databazy.splice(0)) db.close();
  for (const d of adresare.splice(0)) rmSync(d, { recursive: true, force: true });
});

function priprav(pocet: number): { ucty: Ucty; avatary: Avatary } {
  const dir = mkdtempSync(join(tmpdir(), "naex-avatary-"));
  adresare.push(dir);
  const seed = join(dir, "seed");
  mkdirSync(join(seed, "boti"), { recursive: true });
  for (let i = 1; i <= pocet; i++) writeFileSync(join(seed, `avatar-${String(i).padStart(2, "0")}.jpg`), jpeg(i));
  writeFileSync(join(seed, "boti", "stamgast.jpg"), jpeg(100));
  const db = otvorDb(join(dir, "naex.sqlite"));
  databazy.push(db);
  const media = new Media(db, dir);
  const ucty = new Ucty(db, { login: "Admin", heslo: null });
  return { ucty, avatary: new Avatary(media, 1, seed) };
}

describe("predvolené avatary", () => {
  it("načíta trosky aj podobizne botov a nový účet dostane jednu z nich", () => {
    const { ucty, avatary } = priprav(3);
    expect(avatary.hracov).toHaveLength(3);
    expect(avatary.bota("stamgast")).not.toBeNull();
    expect(avatary.hracov).not.toContain(avatary.bota("stamgast"));
    expect(avatary.bota("neznamy")).toBeNull();

    ucty.pouziPredvoleneAvatary(() => avatary.nahodny());
    const p = ucty.registruj("jozo", "tajneheslo", "Jožo", 1);
    expect(avatary.hracov).toContain(p.avatar);
    // „Zmazanie“ fotky vráti náhodnú trosku, nie prázdne miesto.
    expect(avatary.hracov).toContain(ucty.upravProfil(p.id, { avatar: ucty.predvolenyAvatar() })?.avatar);
  });

  it("starým účtom bez fotky ju doplní pri štarte, vlastnú fotku nechá", () => {
    const { ucty, avatary } = priprav(2);
    const bez = ucty.registruj("fero", "tajneheslo", "Fero", 1);
    const s = ucty.registruj("gizka", "tajneheslo", "Gizka", 1);
    ucty.upravProfil(s.id, { avatar: "vlastna-fotka" });
    expect(ucty.podlaId(bez.id)?.avatar).toBeNull();

    ucty.pouziPredvoleneAvatary(() => avatary.nahodny());
    expect(avatary.hracov).toContain(ucty.podlaId(bez.id)?.avatar);
    expect(ucty.podlaId(s.id)?.avatar).toBe("vlastna-fotka");
  });

  it("bez obrázkov ostáva avatar prázdny (iniciály)", () => {
    const { ucty, avatary } = priprav(0);
    ucty.pouziPredvoleneAvatary(() => avatary.nahodny());
    expect(ucty.registruj("nikto", "tajneheslo", "Nikto", 1).avatar).toBeNull();
  });
});
