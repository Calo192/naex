// Agent na skutočnom webe NA EX!: účet, spätná väzba, komentáre a cigarety.
//
// Playtest beží na dočasnom serveri, ktorý po partii zanikne — spätná väzba
// agentov preto ide na skutočný web (predvolene vývojový server
// http://localhost:8787, inak --url alebo NAEX_WEB_URL). Každý agent tam má
// vlastný účet „<meno> (AI)“; heslá sú len v playtest/ucty.json (mimo gitu).
//
// Použitie (z koreňa repozitára):
//   node --experimental-strip-types --no-warnings tools/playtest/web.ts dostupny
//   node ... web.ts nazory   --ako "<meno>"                          zoznam názorov s komentármi
//   node ... web.ts nazor    --ako "<meno>" <kategoria> <subor.txt>   zverejní názor
//   node ... web.ts komentar --ako "<meno>" <id-nazoru> <subor.txt>   komentár k názoru
//   node ... web.ts cigareta --ako "<meno>" <id-nazoru>               dá cigaretu (páči sa mi)
// Kategórie: pravidla, karty, hranie, web, chyba, napad, ine.

import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const SUBOR_UCTOV = "playtest/ucty.json";

export function webUrl(argv: readonly string[] = process.argv): string {
  const i = argv.indexOf("--url");
  const url = (i !== -1 ? argv[i + 1] : undefined) ?? process.env.NAEX_WEB_URL ?? "http://localhost:8787";
  return url.replace(/\/+$/, "");
}

export interface WebUcet {
  readonly login: string;
  readonly heslo: string;
  readonly meno: string;
}

/** Herné meno AI účtu — vidno ho na webe pri názoroch aj v partii. */
export function menoAgenta(meno: string): string {
  const pripona = " (AI)";
  return meno.trim().slice(0, 24 - pripona.length).trim() + pripona;
}

function loginAgenta(meno: string): string {
  const slug = meno
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 28);
  return `ai-${slug || "agent"}`;
}

/**
 * Kľúč účtov v ucty.json. Všetky lokálne servery (vývojový :8787 aj server
 * partie proti človeku) bežia nad tou istou databázou data/, teda aj nad
 * tými istými účtami.
 */
function klucWebu(url: string): string {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url) ? "http://localhost:8787" : url;
}

function nacitajUcty(): Record<string, Record<string, WebUcet>> {
  if (!existsSync(SUBOR_UCTOV)) return {};
  return JSON.parse(readFileSync(SUBOR_UCTOV, "utf8")) as Record<string, Record<string, WebUcet>>;
}

async function volaj(url: string, metoda: string, cesta: string, cookie: string, telo?: unknown): Promise<Response> {
  return fetch(`${url}/api${cesta}`, {
    method: metoda,
    headers: { "x-naex": "1", cookie, ...(telo === undefined ? {} : { "content-type": "application/json" }) },
    body: telo === undefined ? null : JSON.stringify(telo),
  });
}

/**
 * Prihlási agenta na web; pri prvom použití mu založí účet. Vracia údaje
 * účtu a cookie relácie.
 */
export async function prihlasAgenta(url: string, meno: string): Promise<WebUcet & { cookie: string }> {
  const ucty = nacitajUcty();
  const kluc = klucWebu(url);
  const zaklad = loginAgenta(meno);
  // Uložený účet nájde podľa mena; ak je login na webe obsadený (napr. stratené
  // heslá), skúsi zaklad-2, zaklad-3…
  let ucet = Object.values(ucty[kluc] ?? {}).find((u) => u.login === zaklad || u.login.startsWith(`${zaklad}-`));
  for (let n = 1; ucet === undefined && n <= 9; n++) {
    const novy = { login: n === 1 ? zaklad : `${zaklad}-${n}`, heslo: randomBytes(12).toString("base64url"), meno: menoAgenta(meno) };
    const r = await volaj(url, "POST", "/registracia", "", novy);
    if (r.ok) {
      ucet = novy;
      const aktualne = nacitajUcty();
      mkdirSync("playtest", { recursive: true });
      writeFileSync(SUBOR_UCTOV, JSON.stringify({ ...aktualne, [kluc]: { ...aktualne[kluc], [novy.login]: novy } }, null, 2));
    } else if (!(await r.text()).includes("obsadené")) {
      throw new Error(`Registrácia ${novy.login} na ${url} zlyhala.`);
    }
  }
  if (ucet === undefined) throw new Error(`Pre agenta „${meno}“ sa nepodarilo založiť účet na ${url}.`);
  const r = await volaj(url, "POST", "/prihlasenie", "", { login: ucet.login, heslo: ucet.heslo });
  if (!r.ok) throw new Error(`Prihlásenie ${ucet.login} na ${url}: ${await r.text()}`);
  return { ...ucet, cookie: (r.headers.get("set-cookie") ?? "").split(";")[0] ?? "" };
}

export async function webDostupny(url: string): Promise<boolean> {
  try {
    return (await fetch(`${url}/api/ja`, { signal: AbortSignal.timeout(4000) })).ok;
  } catch {
    return false;
  }
}

// ---- príkazový riadok ------------------------------------------------------------

interface Nazor {
  id: number;
  autor: { meno: string };
  kategoria: string;
  stav: string;
  text: string;
  cigarety: number;
  komentare: { id: number; autor: { meno: string }; text: string; cigarety: number }[];
}

function citajText(subor: string | undefined): string {
  if (subor === undefined || !existsSync(subor)) throw new Error(`Súbor s textom „${subor ?? ""}“ neexistuje.`);
  return readFileSync(subor, "utf8").trim();
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const url = webUrl(argv);
  const i = argv.indexOf("--ako");
  const ako = i !== -1 ? argv[i + 1] : undefined;
  const volne = argv.filter((a, j) => (i === -1 || (j !== i && j !== i + 1)) && a !== "--url" && argv[j - 1] !== "--url");
  const [prikaz, a1, a2] = volne;

  if (prikaz === "dostupny") {
    const ok = await webDostupny(url);
    console.log(ok ? `Web ${url} beží.` : `Web ${url} nebeží — spätnú väzbu nemožno zverejniť (spusti npm run dev).`);
    // exitCode namiesto exit(): na Windows exit() počas zatvárania spojenia padá v libuv.
    process.exitCode = ok ? 0 : 1;
    return;
  }
  if (ako === undefined) throw new Error("Chýba --ako \"<meno agenta>\".");
  const ucet = await prihlasAgenta(url, ako);
  const api = (metoda: string, cesta: string, telo?: unknown) => volaj(url, metoda, cesta, ucet.cookie, telo);
  const over = async (r: Response): Promise<Record<string, unknown>> => {
    const t = await r.text();
    // Nový AI účet je návštevník a spätnú väzbu len číta — povýšiť ho musí admin.
    if (r.status === 403 && t.includes("Návštevník")) {
      throw new Error(`Účet „${ucet.meno}“ je na webe návštevník a nemôže písať. Admin ho musí v Tvorba → Hráči povýšiť na hráča; spätná väzba ostáva v feedback.md.`);
    }
    if (!r.ok) throw new Error(`${r.status}: ${t}`);
    return JSON.parse(t) as Record<string, unknown>;
  };

  switch (prikaz) {
    case "nazory": {
      const { nazory } = (await over(await api("GET", "/nazory?triedenie=nove"))) as unknown as { nazory: Nazor[] };
      if (nazory.length === 0) console.log("Zatiaľ žiadne názory.");
      for (const n of nazory) {
        console.log(`#${n.id} [${n.kategoria}, ${n.stav}] ${n.autor.meno} — ${n.cigarety} cig.\n  ${n.text.replace(/\n/g, "\n  ")}`);
        for (const k of n.komentare) console.log(`    ↳ #${k.id} ${k.autor.meno} (${k.cigarety} cig.): ${k.text.replace(/\n/g, " ")}`);
      }
      break;
    }
    case "nazor": {
      const r = await over(await api("POST", "/nazory", { kategoria: a1, text: citajText(a2) }));
      console.log(`Názor #${String(r.id)} zverejnený na ${url}/spatna-vazba ako ${ucet.meno}.`);
      break;
    }
    case "komentar": {
      const r = await over(await api("POST", `/nazory/${Number(a1)}/komentare`, { text: citajText(a2) }));
      console.log(`Komentár #${String(r.id)} pridaný k názoru #${a1 ?? ""}.`);
      break;
    }
    case "cigareta": {
      const r = await over(await api("PUT", `/nazory/${Number(a1)}/cigareta`));
      console.log(`Cigareta daná, názor #${a1 ?? ""} má ${String(r.cigarety)}.`);
      break;
    }
    default:
      throw new Error("Príkazy: dostupny | nazory | nazor | komentar | cigareta (pozri hlavičku súboru).");
  }
}

// Spúšťa sa len ako príkaz — zaloz-clovek.ts importuje funkcie vyššie.
if (process.argv[1]?.replace(/\\/g, "/").endsWith("tools/playtest/web.ts")) {
  main().catch((err: unknown) => {
    console.error(`CHYBA: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  });
}
