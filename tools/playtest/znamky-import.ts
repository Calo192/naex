// Import známok z doterajších playtestov do časovej osi na /vyvoj (Michal 2026-10-21).
//
// Prejde playtest/<id>/hra.json a hracN/feedback.md, z tabuľky „Hodnotenie podľa
// kritérií“ vezme 12 známok a zapíše ich za účet AI postavy („<meno> (AI)“)
// s časom partie a zdrojom = id playtestu. Opakovaný import záznam prepíše,
// neduplikuje (server: jeden záznam na postavu a playtest).
//
//   node --experimental-strip-types --no-warnings tools/playtest/znamky-import.ts [--zivy | --url <adresa>] [--nasucho]

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { prihlasAgenta, webUrl, znamkyZFeedbacku } from "./web.ts";

interface Hra {
  readonly id?: string;
  readonly zalozena?: string;
  readonly hraci?: readonly { readonly meno: string }[];
}

const ID_RE = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})/;

/** Čas partie: z hra.json, inak z id playtestu (miestny čas, október = UTC+2). */
function casPartie(id: string, hra: Hra): number | null {
  if (hra.zalozena !== undefined && !Number.isNaN(Date.parse(hra.zalozena))) return Date.parse(hra.zalozena);
  const m = ID_RE.exec(id);
  return m === null ? null : Date.parse(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}+02:00`);
}

async function main(): Promise<void> {
  const url = webUrl();
  const nasucho = process.argv.includes("--nasucho");
  const zaznamy: { id: string; meno: string; cas: number; znamky: Record<string, number> }[] = [];
  for (const id of readdirSync("playtest").filter((d) => ID_RE.test(d)).sort()) {
    const subor = join("playtest", id, "hra.json");
    if (!existsSync(subor)) continue;
    const hra = JSON.parse(readFileSync(subor, "utf8")) as Hra;
    const cas = casPartie(id, hra);
    if (cas === null) continue;
    (hra.hraci ?? []).forEach((h, i) => {
      const feedback = join("playtest", id, `hrac${i + 1}`, "feedback.md");
      // Testovacie behy („Hráč“) a už označené účty („… (AI)“) nie sú postavy playtestu.
      if (!existsSync(feedback) || h.meno === "Hráč" || h.meno.endsWith("(AI)")) return;
      const znamky = znamkyZFeedbacku(readFileSync(feedback, "utf8"));
      if (Object.keys(znamky).length === 12) zaznamy.push({ id, meno: h.meno, cas, znamky });
      else if (Object.keys(znamky).length > 0) console.error(`(${id} ${h.meno}: len ${Object.keys(znamky).length} známok, preskakujem.)`);
    });
  }
  console.log(`Našiel som ${zaznamy.length} hodnotení z ${new Set(zaznamy.map((z) => z.id)).size} playtestov.`);
  if (nasucho) {
    for (const z of zaznamy) console.log(`  ${z.id} ${z.meno}: ${Object.values(z.znamky).join(" ")}`);
    return;
  }
  const cookies = new Map<string, string>();
  for (const z of zaznamy) {
    let cookie = cookies.get(z.meno);
    if (cookie === undefined) {
      cookie = (await prihlasAgenta(url, z.meno)).cookie;
      cookies.set(z.meno, cookie);
    }
    const r = await fetch(`${url}/api/znamky`, {
      method: "PUT",
      headers: { "x-naex": "1", "content-type": "application/json", cookie },
      body: JSON.stringify({ znamky: z.znamky, zdroj: z.id, cas: z.cas }),
    });
    if (!r.ok) throw new Error(`${z.id} ${z.meno}: ${r.status} ${await r.text()}`);
  }
  console.log(`Zapísané na ${url}/vyvoj.`);
}

await main();
