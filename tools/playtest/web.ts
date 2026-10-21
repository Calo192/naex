// Agent na skutočnom webe NA EX!: účet, spätná väzba, komentáre a cigarety.
//
// Playtest beží na dočasnom serveri, ktorý po partii zanikne — spätná väzba
// agentov preto ide na skutočný web: --zivy = živý web (doména z
// deploy/.env.produkcia, Michal 2026-10-21), inak --url, NAEX_WEB_URL alebo
// vývojový server http://localhost:8787. Každý agent tam má
// vlastný účet „<meno> (AI)“; heslá sú len v playtest/ucty.json (mimo gitu).
// Nový účet je na webe návštevník (spätnú väzbu len číta) — nástroj ho preto
// heslom admina (lokálne z .env, na živom webe z deploy/.env.produkcia) zaradí
// ako hráča so značkou AI; jeho príspevky web predvolene skrýva (Michal 2026-10-21).
//
// Použitie (z koreňa repozitára):
//   node --experimental-strip-types --no-warnings tools/playtest/web.ts dostupny
//   node ... web.ts nazory   --ako "<meno>"                          zoznam názorov s komentármi
//   node ... web.ts nazor    --ako "<meno>" <kategoria> <subor.txt>   zverejní názor
//   node ... web.ts komentar --ako "<meno>" <id-nazoru> <subor.txt>   komentár k názoru
//   node ... web.ts cigareta --ako "<meno>" <id-nazoru>               dá cigaretu (páči sa mi)
//   node ... web.ts avatar   --ako "<meno>" <obrazok.jpg|png|webp>    nastaví agentovi avatar (do 2 MB)
//   node ... web.ts znamky   --ako "<meno>" <feedback.md> [--zdroj <id-playtestu>] [--cas <ISO>]
//                            12 známok z tabuľky „Hodnotenie podľa kritérií“ do časovej osi na /vyvoj
// Všade možno pridať --zivy (živý web) alebo --url <adresa>.
// Kategórie: pravidla, karty, hranie, web, chyba, napad, ine.

import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname } from "node:path";

const SUBOR_UCTOV = "playtest/ucty.json";
const PRODUKCIA = "deploy/.env.produkcia";

/** Nastavenia živého webu (kópia deploy/.env zo servera, mimo gitu) — vytvára ju deploy/nahraj.sh. */
function produkcia(): Record<string, string> {
  if (!existsSync(PRODUKCIA)) return {};
  const out: Record<string, string> = {};
  for (const riadok of readFileSync(PRODUKCIA, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z_]+)=(.*)$/.exec(riadok.trim());
    if (m?.[1] !== undefined && m[2] !== undefined) out[m[1]] = m[2];
  }
  return out;
}

/** Adresa živého webu, napr. https://15-235-242-12.sslip.io. */
export function zivyWeb(): string {
  const domena = produkcia().DOMENA;
  if (domena === undefined || domena === "") throw new Error(`Živý web nepoznám — chýba DOMENA v ${PRODUKCIA} (vytvorí ho deploy/nahraj.sh).`);
  return `https://${domena}`;
}

const jeLokalny = (url: string): boolean => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url);

export function webUrl(argv: readonly string[] = process.argv): string {
  if (argv.includes("--zivy")) return zivyWeb();
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
  return jeLokalny(url) ? "http://localhost:8787" : url;
}

/** Prihlasovacie údaje admina pre daný web: lokálne z .env, živý web z deploy/.env.produkcia. */
export function adminWebu(url: string): { login: string; heslo: string | undefined } {
  const p = produkcia();
  if (!jeLokalny(url) && p.DOMENA !== undefined && url === `https://${p.DOMENA}`) {
    return { login: p.NAEX_ADMIN_LOGIN ?? "Admin", heslo: p.NAEX_ADMIN_HESLO };
  }
  nacitajEnv();
  return { login: process.env.NAEX_ADMIN_LOGIN ?? "Admin", heslo: process.env.NAEX_ADMIN_HESLO };
}

function nacitajUcty(): Record<string, Record<string, WebUcet>> {
  if (!existsSync(SUBOR_UCTOV)) return {};
  return JSON.parse(readFileSync(SUBOR_UCTOV, "utf8")) as Record<string, Record<string, WebUcet>>;
}

export function nacitajEnv(): void {
  try {
    if (existsSync(".env")) process.loadEnvFile(".env");
  } catch {
    // .env je nepovinný
  }
}

async function volaj(url: string, metoda: string, cesta: string, cookie: string, telo?: unknown): Promise<Response> {
  return fetch(`${url}/api${cesta}`, {
    method: metoda,
    headers: { "x-naex": "1", cookie, ...(telo === undefined ? {} : { "content-type": "application/json" }) },
    body: telo === undefined ? null : JSON.stringify(telo),
  });
}

/** Kľúče 12 kritérií v poradí tabuľky z tools/playtest/kriteria.md (zhodne so server/src/znamky.ts). */
export const KLUCE_KRITERII = [
  "zabava", "rozhodnutia", "rovnovaha", "nahoda", "interakcia", "tempo",
  "zrozumitelnost", "hlbka", "znovuhratelnost", "tema", "napatie", "originalita",
] as const;

/**
 * Známky z feedback.md playtestera: tabuľka pod nadpisom „Hodnotenie podľa kritérií“,
 * riadky „| číslo | kritérium | známka | …“. Kritérium sa určí podľa čísla 1–12.
 */
export function znamkyZFeedbacku(text: string): Record<string, number> {
  const od = text.search(/^##\s+Hodnotenie podľa kritérií/m);
  if (od === -1) return {};
  const zvysok = text.slice(od).split(/\r?\n/).slice(1);
  const koniec = zvysok.findIndex((r) => /^##\s/.test(r));
  const out: Record<string, number> = {};
  for (const riadok of koniec === -1 ? zvysok : zvysok.slice(0, koniec)) {
    const m = /^\|\s*(\d{1,2})\s*\|[^|]*\|\s*(\d{1,2})\s*\|/.exec(riadok);
    const kluc = m === null ? undefined : KLUCE_KRITERII[Number(m[1]) - 1];
    const z = m === null ? Number.NaN : Number(m[2]);
    if (kluc !== undefined && z >= 1 && z <= 10) out[kluc] = z;
  }
  return out;
}

/** Úroveň, ktorú agent na webe potrebuje: hráč píše spätnú väzbu, subadmin tvorí karty. */
export type UrovenAgenta = "hrac" | "subadmin";

const PORADIE_UROVNI = ["navstevnik", "hrac", "subadmin", "admin"];

/**
 * Zaradí účet agenta: aspoň `uroven` a značka AI. Treba heslo admina z .env;
 * bez neho účet ostane, aký je, a nástroj to len oznámi.
 */
async function zaradAgenta(url: string, cookie: string, uroven: UrovenAgenta): Promise<void> {
  const r = await volaj(url, "GET", "/ja", cookie);
  const ja = r.ok ? ((await r.json()) as { pouzivatel: { id: number; meno: string; rola: string; ai?: boolean } | null }).pouzivatel : null;
  if (ja === null) return;
  const nizsia = PORADIE_UROVNI.indexOf(ja.rola) < PORADIE_UROVNI.indexOf(uroven);
  if (!nizsia && ja.ai === true) return;

  const { login, heslo } = adminWebu(url);
  if (heslo === undefined || heslo === "") {
    console.error(`(Účet „${ja.meno}“ je ${ja.rola}${ja.ai === true ? "" : " bez značky AI"} — bez hesla admina (.env, živý web deploy/.env.produkcia) ho treba zaradiť ručne v Tvorba → Hráči.)`);
    return;
  }
  const p = await volaj(url, "POST", "/prihlasenie", "", { login, heslo });
  if (!p.ok) throw new Error(`Prihlásenie admina na ${url}: ${await p.text()}`);
  const adminCookie = (p.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
  try {
    const zmena = await volaj(url, "PATCH", `/admin/pouzivatelia/${ja.id}`, adminCookie, nizsia ? { rola: uroven, ai: true } : { ai: true });
    if (!zmena.ok) throw new Error(`Zaradenie účtu „${ja.meno}“: ${await zmena.text()}`);
  } finally {
    await volaj(url, "POST", "/odhlasenie", adminCookie);
  }
  console.error(`(Účet „${ja.meno}“ zaradený: ${nizsia ? uroven : ja.rola}, značka AI.)`);
}

/**
 * Prihlási agenta na web; pri prvom použití mu založí účet a zaradí ho
 * (aspoň `uroven`, značka AI). Vracia údaje účtu a cookie relácie.
 */
export async function prihlasAgenta(url: string, meno: string, uroven: UrovenAgenta = "hrac"): Promise<WebUcet & { cookie: string }> {
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
  const cookie = (r.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
  await zaradAgenta(url, cookie, uroven);
  return { ...ucet, cookie };
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
  const hodnota = (prepinac: string): string | undefined => {
    const k = argv.indexOf(prepinac);
    return k === -1 ? undefined : argv[k + 1];
  };
  const sHodnotou = new Set(["--url", "--zdroj", "--cas"]);
  const volne = argv.filter((a, j) => (i === -1 || (j !== i && j !== i + 1)) && a !== "--zivy" && !sHodnotou.has(a) && !sHodnotou.has(argv[j - 1] ?? ""));
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
    // Zaradenie zlyhalo (chýba heslo admina) — účet ostal návštevník a spätnú väzbu len číta.
    if (r.status === 403 && t.includes("Návštevník")) {
      throw new Error(`Účet „${ucet.meno}“ je na webe návštevník a nemôže písať. Daj NAEX_ADMIN_HESLO do .env, alebo ho admin povýši v Tvorba → Hráči; spätná väzba ostáva v feedback.md.`);
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
    case "avatar": {
      const typy: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
      const typ = typy[extname(a1 ?? "").toLowerCase()];
      if (a1 === undefined || !existsSync(a1) || typ === undefined) throw new Error('Použitie: avatar --ako "<meno>" <obrazok.jpg|png|webp>');
      const r = await fetch(`${url}/api/profil/avatar`, {
        method: "PUT",
        headers: { "x-naex": "1", cookie: ucet.cookie, "content-type": typ },
        body: new Blob([new Uint8Array(readFileSync(a1))], { type: typ }),
      });
      await over(r);
      console.log(`Avatar účtu „${ucet.meno}“ nastavený na ${url}.`);
      break;
    }
    case "znamky": {
      const znamky = znamkyZFeedbacku(citajText(a1));
      if (Object.keys(znamky).length === 0) throw new Error(`V ${a1 ?? ""} nie je tabuľka „## Hodnotenie podľa kritérií“ so známkami 1–10.`);
      const zdroj = hodnota("--zdroj");
      const cas = hodnota("--cas");
      await over(await api("PUT", "/znamky", { znamky, ...(zdroj !== undefined ? { zdroj } : {}), ...(cas !== undefined ? { cas: Date.parse(cas) } : {}) }));
      console.log(`${Object.keys(znamky).length} známok od ${ucet.meno} zapísaných na ${url}/vyvoj${zdroj !== undefined ? ` (playtest ${zdroj})` : ""}.`);
      break;
    }
    default:
      throw new Error("Príkazy: dostupny | nazory | nazor | komentar | cigareta | avatar | znamky (pozri hlavičku súboru).");
  }
}

// Spúšťa sa len ako príkaz — zaloz-clovek.ts importuje funkcie vyššie.
if (process.argv[1]?.replace(/\\/g, "/").endsWith("tools/playtest/web.ts")) {
  main().catch((err: unknown) => {
    console.error(`CHYBA: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  });
}
