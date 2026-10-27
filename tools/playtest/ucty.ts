// Heslá AI účtov („<meno> (AI)“) na jednom mieste pre všetky pracoviská.
//
// Predtým mal každý worktree vlastný playtest/ucty.json (mimo gitu). Agent na
// novom pracovisku heslo nenašiel, login bol obsadený, a tak vznikali na živom
// webe ai-admin-2…6. Spoločný súbor je preto v spoločnom git adresári všetkých
// worktree (F:\Projects\naex\.git\naex-ucty.json) — mimo gitu, prežije
// upratovanie naex-tmp aj zmazanie pracoviska. Inak ho určí NAEX_UCTY.
//
// Kľúč je adresa webu. Lokálny server však beží nad databázou data/ svojho
// pracoviska (NAEX_DATA), takže lokálne účty sú kľúčované jej cestou —
// rovnaký login v dvoch pracoviskách sú dva rôzne účty s rôznymi heslami.
//
// Pri prvom spustení (spoločný súbor ešte neexistuje) sa doň zlúčia
// playtest/ucty.json zo všetkých pracovísk F:\Projects\naex*; ručne:
//   node --experimental-strip-types --no-warnings tools/playtest/web.ts zluc-ucty

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export interface WebUcet {
  readonly login: string;
  readonly heslo: string;
  readonly meno: string;
}

/** Web → login → účet. */
export type Ucty = Readonly<Record<string, Readonly<Record<string, WebUcet>>>>;

/** Starý súbor účtov pracoviska (relatívne ku koreňu pracoviska). */
export const STARY_SUBOR = join("playtest", "ucty.json");
/** Kľúč, pod ktorým staré súbory držali všetky lokálne servery. */
const STARY_LOKALNY = "http://localhost:8787";

const jeLokalny = (url: string): boolean => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url);

let spolocnyGit: string | null | undefined;
/** Spoločný git adresár všetkých worktree (F:\Projects\naex\.git), alebo null mimo gitu. */
function spolocnyGitAdresar(): string | null {
  if (spolocnyGit === undefined) {
    try {
      const out = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
      spolocnyGit = out.trim() === "" ? null : resolve(out.trim());
    } catch {
      spolocnyGit = null;
    }
  }
  return spolocnyGit;
}

/** Cesta k spoločnému súboru účtov: NAEX_UCTY, inak <spoločný .git>/naex-ucty.json. */
export function suborUctov(): string {
  const env = process.env.NAEX_UCTY;
  if (env !== undefined && env.trim() !== "") return resolve(env.trim());
  const git = spolocnyGitAdresar();
  // Mimo gitu (napr. rozbalený archív) ostáva len súbor pracoviska.
  return git === null ? resolve(STARY_SUBOR) : join(git, "naex-ucty.json");
}

/** Kde hľadať pracoviská naex*: vedľa hlavného repozitára (F:\Projects). */
export function korenPracovisk(): string {
  const git = spolocnyGitAdresar();
  return git === null ? resolve("..") : dirname(dirname(git));
}

/** Databáza lokálneho servera tohto pracoviska (zhodne so serverom: NAEX_DATA, inak data/). */
export function datovyPriecinok(): string {
  return resolve(process.env.NAEX_DATA ?? "data");
}

function lokalnyKluc(dataDir: string): string {
  const cesta = resolve(dataDir).replace(/\\/g, "/");
  return `lokalny:${process.platform === "win32" ? cesta.toLowerCase() : cesta}`;
}

/**
 * Kľúč webu v súbore účtov. Všetky lokálne servery pracoviska (vývojový aj
 * server partie proti človeku na inom porte) bežia nad tou istou databázou.
 */
export function klucWebu(url: string, dataDir: string = datovyPriecinok()): string {
  return jeLokalny(url) ? lokalnyKluc(dataDir) : url;
}

export function citajUcty(subor: string): Ucty {
  if (!existsSync(subor)) return {};
  return JSON.parse(readFileSync(subor, "utf8")) as Ucty;
}

function zapis(subor: string, ucty: Ucty): void {
  mkdirSync(dirname(subor), { recursive: true });
  // Cez dočasný súbor — súbežné partie turnusu nesmú čítať napoly zapísaný JSON.
  const docasny = `${subor}.${process.pid}.tmp`;
  writeFileSync(docasny, JSON.stringify(ucty, null, 2));
  renameSync(docasny, subor);
}

/** Pridá do `ciel` účty zo `zdroj`; existujúce heslo sa nikdy neprepíše. */
export function zlucUcty(ciel: Ucty, zdroj: Ucty): { readonly ucty: Ucty; readonly pridane: number } {
  const out: Record<string, Record<string, WebUcet>> = {};
  for (const [web, ucty] of Object.entries(ciel)) out[web] = { ...ucty };
  let pridane = 0;
  for (const [web, ucty] of Object.entries(zdroj)) {
    const cielWebu = (out[web] ??= {});
    for (const [login, ucet] of Object.entries(ucty)) {
      if (cielWebu[login] !== undefined) continue;
      cielWebu[login] = ucet;
      pridane++;
    }
  }
  return { ucty: out, pridane };
}

/** Starý súbor pracoviska: lokálne účty patria databáze data/ toho pracoviska. */
export function preklucujStare(stare: Ucty, pracovisko: string): Ucty {
  const out: Record<string, Readonly<Record<string, WebUcet>>> = {};
  for (const [web, ucty] of Object.entries(stare)) {
    const kluc = web === STARY_LOKALNY ? lokalnyKluc(join(pracovisko, "data")) : web;
    out[kluc] = { ...out[kluc], ...ucty };
  }
  return out;
}

/** Pracoviská naex* v `koren`, ktoré majú starý playtest/ucty.json. */
export function pracoviskaSoStarymiUctami(koren: string): string[] {
  let mena: string[];
  try {
    mena = readdirSync(koren);
  } catch {
    return [];
  }
  return mena
    .filter((m) => m.startsWith("naex"))
    .sort()
    .map((m) => join(koren, m))
    .filter((p) => existsSync(join(p, STARY_SUBOR)));
}

/** Zlúči staré súbory pracovísk do spoločného (bez prepisovania hesiel). */
export function zlucPracoviska(subor: string, koren: string): { readonly pracoviska: number; readonly pridane: number } {
  let ucty = citajUcty(subor);
  let pridane = 0;
  const pracoviska = pracoviskaSoStarymiUctami(koren);
  for (const p of pracoviska) {
    let stare: Ucty;
    try {
      stare = citajUcty(join(p, STARY_SUBOR));
    } catch {
      continue; // poškodený súbor iného pracoviska nesmie zastaviť nástroj
    }
    const r = zlucUcty(ucty, preklucujStare(stare, p));
    ucty = r.ucty;
    pridane += r.pridane;
  }
  zapis(subor, ucty);
  return { pracoviska: pracoviska.length, pridane };
}

/** Účty zo spoločného súboru; pri prvom spustení doň najprv zlúči pracoviská. */
export function nacitajUcty(subor: string = suborUctov(), koren: string = korenPracovisk()): Ucty {
  if (!existsSync(subor)) {
    const r = zlucPracoviska(subor, koren);
    if (r.pridane > 0) console.error(`(Heslá AI účtov zlúčené do ${subor}: ${r.pridane} z ${r.pracoviska} pracovísk.)`);
  }
  const ucty = citajUcty(subor);
  // Mimo gitu je spoločným súborom ten starý — jeho lokálne účty majú ešte starý kľúč.
  return subor === resolve(STARY_SUBOR) ? preklucujStare(ucty, resolve(".")) : ucty;
}

/** Uloží nový účet; súbor znova prečíta, aby neprepísal, čo medzitým pridal iný proces. */
export function ulozUcet(kluc: string, ucet: WebUcet, subor: string = suborUctov()): void {
  zapis(subor, zlucUcty(citajUcty(subor), { [kluc]: { [ucet.login]: ucet } }).ucty);
}

/** Uložený účet agenta: presne `zaklad`, inak starší s príponou zaklad-2, zaklad-3… */
export function najdiUlozeny(ucty: Readonly<Record<string, WebUcet>> | undefined, zaklad: string): WebUcet | undefined {
  const vsetky = Object.values(ucty ?? {});
  // Login agenta je len [a-z0-9-]; „ai-dizajner-ui“ je iný agent ako „ai-dizajner“.
  const sPriponou = new RegExp(`^${zaklad}-\\d+$`);
  return vsetky.find((u) => u.login === zaklad) ?? vsetky.find((u) => sPriponou.test(u.login));
}
