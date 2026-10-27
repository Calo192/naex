// Agent Admin na webe NA EX!: tvorba kariet cez admin API (to isté, čo robí
// človek v sekcii Tvorba), podklady pre rebalans, zálohy, overenie pred
// zverejnením a zverejnenie.
//
// Agent má vlastný účet „Admin (AI)“ s úrovňou subadmin — tvorba kariet áno,
// meniť úrovne účtov nie. Pri prvom použití ho nástroj založí a povýši
// heslom admina z .env (NAEX_ADMIN_LOGIN / NAEX_ADMIN_HESLO). Heslo účtu je
// v playtest/ucty.json (mimo gitu). Web: --url, NAEX_WEB_URL, inak :8787.
//
// Použitie (z koreňa repozitára):
//   node --experimental-strip-types --no-warnings tools/admin/admin.ts <príkaz> [argumenty]
//
// Karty
//   prehlad                       všetky návrhy: akcie, permutácie, kópie, obrázok, efekt, problémy
//   karta <id>                    návrh karty ako JSON (vzor na úpravu)
//   ako-vidi <id>                 karta tak, ako ju vidí hráč a agent playtester (všetky varianty)
//   uloz <subor.json>             uloží návrh (id je v súbore) — nová karta alebo úprava
//   zmaz <id> --potvrdene         zmaže návrh (predtým zálohuje)
//   zaloha [poznamka]             celý obsah tvorcu do admin-agent/zalohy/
//   obnov <zaloha.json> <id>…     vráti návrhy kariet zo zálohy (všetky: --vsetky)
// Rebalans a kontrola
//   karty-v-partiach [--od N] [--ludia] [--playtesty]   štatistiky kariet z odohraných partií (web, playtesty);
//                                 --ludia = len partie bez AI účtu (rebalans podľa ľudí: --zivy --ludia)
//   texty                         kontrola textov efektov (spúšťač, preklepy, zmenený implementovaný efekt)
//   zmienky <id>                  kde v pravidlách, webe a inštrukciách agentov sa karta spomína
//   starsi                        starší, ich karty a bodovacie karty s bodmi za podmienky
// Vzhľad
//   vzhlad                        akcie, kľúčové slová, kategórie, predvolené nastavenia
//   akcia <kluc> [--nazov T] [--popis T]       zobrazí alebo upraví akciu
//   slovo <slovo> [--popis T]     zobrazí alebo upraví vysvetlenie kľúčového slova (tooltip)
//   ikona <kluc> <subor.svg>      nová SVG ikona akcie
//   bodovacie                     bodovacie karty starších a ikony bodovania
// Ilustrácie (generujú sa cez Leonardo.Ai API, kľúč NAEX_LEONARDO_KEY v .env)
//   prompt <id> [--kategoria K] "<námet>"      prompt a referenčné obrázky; uloží zadanie
//   generuj <id> [--pocet 1|2] [--sila LOW|MID|HIGH] [--seed N] [--navyse]
//                                 jedno kolo v Leonarde (Nano Banana, 1024²) — stojí kredit!
//                                 najviac 3 kolá na kartu; --navyse len so súhlasom Michala
//   pas-generuj <kluc> "<námet>" [--sila LOW|MID|HIGH] [--seed N]
//                                 pás nad kapitolou pravidiel (1536×672, orež na 2,5 : 1) — stojí kredit!
//   leonardo                      kolá generovania a cena po kartách
//   obrazok <id-karty> <subor>    ilustrácia do knižnice aj ku karte
//   nahraj <subor> [druh]         nahrá obrázok (karta | kniznica | pozadie | ikona), vypíše id média
//   stiahni <id-media> <subor>    stiahne obrázok z webu (napr. ilustráciu karty)
//   kniznica                      obrázky v knižnici
//   nahlady                       doplní náhľady veľkých obrázkov (headless Chrome, Tvorba → Prehľad) —
//                                 po nasadení: nahlady --zivy (server obrázky sám nezmenší)
// Zverejnenie
//   overit                        nanečisto to, čo urobí zverejnenie, + karty zmenené od poslednej sady
//   zverejni --potvrdene          zverejní VŠETKY návrhy ako novú sadu (len so súhlasom Michala)
//   sady                          história zverejnených sád
//   vrat <verzia> --potvrdene [--aj-navrhy]   zverejní staršiu sadu znova (návrat po neúspešnom rebalanse)
// Spätná väzba a web
//   nazory [kategoria]            spätná väzba hráčov
//   komentar <id-nazoru> <subor>  komentár k názoru (ako Admin (AI))
//   stav <id-nazoru> <stav>       nove | prijate | planovane | hotove | zamietnute
//   playtesty                     reporty playtestov
//   pouzivatelia                  účty na webe
//   tempo [--json]                koľko trvajú partie a kde ide čas (fázy, príkazy) — roadmapa #9
//   ucet                          prihlási agenta (prvýkrát založí a povýši účet)
//   avatar <subor>                avatar účtu Admin (AI)
// Playtest (sekcia Playtest na webe — reporty a návrhy, Michal 2026-10-21)
//   report-nahraj <subor>…        nahrá report / rozbor / návrhy z docs/playtesty (aj obrázky v podpriečinku)
//   navrhy [stav] [--json]        návrhy zlepšení; stav: nove | implementovat | odlozene | zamietnute | rozpracovane
//                                 | implementovane (čaká na overenie) | overene | nezabralo
//   navrhy-nahraj <subor.json>    nahrá dávku návrhov od navrhára alebo z dizajnu (tvar v .claude/agents/naex-navrhar.md)
//   navrh <id> <stav> [--vysledok "text"]   Developer: rozpracovane | implementovane (+ čo spravil, commit) | spat
//                                 organizátor playtestu: overene | nezabralo (--vysledok = verdikt: čo playtest ukázal)
// Server a prehľad
//   server-stav [--json]          nasadená verzia (commit), rozohrané partie a uzávierka — pred nasadením (skill naex-nasad)
//   uzavierka zapni|vypni|stav    uzávierka pred nasadením: nové partie nie, rozohrané dohrajú (reštart ju zruší)
//   linka                         čo čaká na Michala, Developera a nasadenie (skill naex-stav); s --zivy aj nenasadené commity
// Roadmapa (stránka Vývoj → Roadmapa, Michal 2026-10-21)
//   roadmapa [stlpec] [--json]    poradie položiek; stĺpce prijimac | teraz | dalej | potom | neskor | hotove
//                                 Developer berie schválené návrhy v poradí stĺpca Teraz zhora
//   roadmapa-pridaj <subor.json>  nová položka do Prijímača ({nazov, kratko, preco, hotovo, oblast, narocnost, zdroj})
// Novinky (stránka /novinky, Michal 2026-10-22) — píšu sa až po nasadení na živý web
//   novinky [--json]              všetky novinky, najnovšie hore
//   novinka-pridaj <subor.json> [--vydanie "Pravidlá v6"]   nová novinka alebo pole noviniek
//                                 ({datum RRRR-MM-DD, kategoria pravidla|karty|dizajn|web|opravy, nadpis, text, odkaz?, vydanie?});
//                                 --vydanie dá vydanie novinkám, ktoré ho v súbore nemajú (nadpis dňa „26. 10. · Pravidlá v6“)
//   novinka-uprav <id> <subor.json>   zmení len polia zo súboru (aj vydanie; "" ho zmaže)
//   novinka-zmaz <id> --potvrdene zmaže novinku
// Avatary AI účtov (Leonardo.Ai, v štýle avatarov offline protihráčov)
//   avatar-generuj <kluc> "<námet po anglicky>" [--seed N]   jedno kolo (2 obrázky) do admin-agent/avatary/<kluc>/
//
// Na živý web (https://<DOMENA z deploy/.env.produkcia>) prepínač --zivy.

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { GameData, Podmienka, StatKarty, StatistikyKariet } from "@naex/core";
import { REGISTER, loadGameData, normalizujStatistikyKariet, printedSides, scitajStatistikyKariet } from "@naex/core";
import eldersJson from "../../packages/core/data/elders.json" with { type: "json" };
import scorecardsJson from "../../packages/core/data/scorecards.json" with { type: "json" };
import type { AkciaDef, BodovaciaKarta, IkonaBodovania, KartaNavrh, Kategoria, KlucoveSlovo, Nastavenia } from "@naex/tvorba";
import { chybyNavrhu, doCardsJson, doScorecardsJson, kontrolaTextov, neznameAkcie, variantyKarty } from "@naex/tvorba";
import { nacitajEnv, prihlasAgenta, webUrl } from "../playtest/web.ts";
import { MAX_KOL_NA_KARTU, generuj, nacitajZaznam } from "./leonardo.ts";
import type { Sila } from "./leonardo.ts";
import { MODEL, REFERENCIE, REFERENCIE_PASU, STYL_PASU, cestyReferencii, kategoriaPodlaTagov, zostavPrompt } from "./styl.ts";
import type { PartiaTempa } from "./tempo.ts";
import { prehladTempa } from "./tempo.ts";
import { doplnNahladyCezChrome } from "./nahlady.ts";

export const MENO_AGENTA = "Admin";
export const PRACOVNY = "admin-agent";

interface Novinka {
  readonly id: number;
  readonly datum: string;
  readonly kategoria: string;
  readonly nadpis: string;
  readonly text: string;
  readonly odkaz: string;
  readonly vydanie?: string;
}

interface ObsahTvorcu {
  readonly karty: readonly KartaNavrh[];
  readonly nastavenia: Nastavenia;
  readonly akcie: readonly AkciaDef[];
  readonly klucoveSlova: readonly KlucoveSlovo[];
  readonly kategorie: readonly Kategoria[];
  readonly bodovacie: readonly BodovaciaKarta[];
  readonly ikonyBodovania: readonly IkonaBodovania[];
  readonly zverejnenaVerzia: number;
}

async function volaj(url: string, metoda: string, cesta: string, cookie: string, telo?: unknown, typ?: string): Promise<Response> {
  const surove = telo instanceof Uint8Array;
  return fetch(`${url}${cesta}`, {
    method: metoda,
    headers: {
      "x-naex": "1",
      cookie,
      ...(telo === undefined ? {} : { "content-type": typ ?? (surove ? "application/octet-stream" : "application/json") }),
    },
    body: telo === undefined ? null : surove ? new Blob([telo as Uint8Array<ArrayBuffer>]) : JSON.stringify(telo),
  });
}

async function json<T>(r: Response): Promise<T> {
  const t = await r.text();
  if (!r.ok) {
    let chyba = t;
    try {
      chyba = (JSON.parse(t) as { chyba?: string }).chyba ?? t;
    } catch {
      // nie je JSON
    }
    throw new Error(`${r.status}: ${chyba}`);
  }
  return JSON.parse(t) as T;
}

/**
 * Prihlási agenta. Nový účet je návštevník — prihlasAgenta ho heslom admina
 * z .env povýši na subadmina (tvorba kariet a správa obsahu, nie úrovne účtov).
 */
export async function prihlasAdmina(url: string): Promise<{ cookie: string; meno: string }> {
  const ucet = await prihlasAgenta(url, MENO_AGENTA, "subadmin");
  const ja = await json<{ pouzivatel: { rola: string } | null }>(await volaj(url, "GET", "/api/ja", ucet.cookie));
  const rola = ja.pouzivatel?.rola;
  if (rola !== "subadmin" && rola !== "admin") {
    throw new Error(`Účet „${ucet.meno}“ je ${rola ?? "?"}, nie subadmin. Povýš ho v Tvorba → Hráči, alebo daj NAEX_ADMIN_HESLO do .env.`);
  }
  return { cookie: ucet.cookie, meno: ucet.meno };
}

// ---- výpisy ----------------------------------------------------------------------

const strana = (s: KartaNavrh["lava"]): string => {
  const akcie = Object.entries(s.akcie)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => (n > 1 ? `${k}×${n}` : k))
    .join(" ");
  const blok = s.blokovane.length > 0 ? ` [blok ${s.blokovane.join(",")}]` : "";
  const povolene = Object.keys(s.povolene).length > 0 ? " [obmedzené pozície]" : "";
  return (akcie || "—") + blok + povolene;
};

function problemyKarty(k: KartaNavrh): string[] {
  const out = [...chybyNavrhu(k)];
  const nezname = neznameAkcie(k);
  if (nezname.length > 0) out.push(`akcie bez pravidiel: ${nezname.join(", ")}`);
  if (k.obrazok === null) out.push("bez ilustrácie");
  return out;
}

/** Stav efektu v jadre: native/impl = hra ho vyhodnocuje, manual = len pripomenie v logu. */
export function stavEfektu(k: Pick<KartaNavrh, "id" | "efekt">): string {
  if (k.efekt.trim() === "") return "bez efektu";
  return REGISTER[k.id] ?? "manual (jadro ho nepozná)";
}

function vypisPrehlad(o: ObsahTvorcu): void {
  const kopii = o.karty.reduce((s, k) => s + k.kopie * Math.max(1, variantyKarty(k).pocet), 0);
  console.log(`Návrhov: ${o.karty.length}, vytlačených kariet: ${kopii}. Zverejnená sada: verzia ${o.zverejnenaVerzia}.`);
  for (const k of o.karty) {
    const v = variantyKarty(k);
    console.log(`\n${k.id} — ${k.nazov} [${k.tagy.join(", ")}] · ${v.pocet} permutácií × ${k.kopie} kópií`);
    console.log(`  ľavá: ${strana(k.lava)} | pravá: ${strana(k.prava)}`);
    if (k.efekt.trim() !== "") console.log(`  efekt (${stavEfektu(k)}): ${k.efekt.replace(/\s+/g, " ")}`);
    const p = problemyKarty(k);
    if (p.length > 0) console.log(`  ⚠ ${p.join("; ")}`);
  }
}

/** Herné dáta z rozpracovaných návrhov (karty s neznámymi akciami vynechá). */
function dataZNavrhov(o: ObsahTvorcu): GameData {
  const hratelne = o.karty.filter((k) => neznameAkcie(k).length === 0 && variantyKarty(k).pocet > 0);
  return loadGameData(doCardsJson(hratelne, "admin-agent"), eldersJson, scorecardsJson);
}

/** To isté, čo kontroluje server pri zverejnení (Obsah.zverejni) — bez zápisu. */
export function overZverejnenie(o: ObsahTvorcu): string[] {
  const problemy: string[] = [];
  for (const k of o.karty) {
    for (const ch of chybyNavrhu(k)) problemy.push(`${k.nazov}: ${ch}`);
    const nezname = neznameAkcie(k);
    if (nezname.length > 0) problemy.push(`${k.nazov}: akcia ${nezname.join(", ")} nemá v hre pravidlá — najprv ju treba naprogramovať v jadre.`);
  }
  const body = (scorecardsJson as { body: Record<Podmienka, number> }).body;
  const sc = doScorecardsJson(o.bodovacie, o.ikonyBodovania, body);
  problemy.push(...sc.problemy);
  if (problemy.length === 0) {
    try {
      loadGameData(doCardsJson(o.karty, "overenie"), eldersJson, sc.json);
    } catch (err) {
      problemy.push(err instanceof Error ? err.message : String(err));
    }
  }
  return problemy;
}

function zalohuj(o: ObsahTvorcu, poznamka: string): string {
  mkdirSync(join(PRACOVNY, "zalohy"), { recursive: true });
  const cas = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const slug = poznamka.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
  const subor = join(PRACOVNY, "zalohy", `${cas}${slug === "" ? "" : `-${slug}`}.json`);
  writeFileSync(subor, JSON.stringify({ poznamka, cas: Date.now(), ...o }, null, 2));
  return subor;
}

const TYP_OBRAZKA: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml" };

const f1 = (x: number): string => x.toFixed(1);
const pct = (x: number): string => `${Math.round(x * 100)} %`;

/** Jednoduchá textová tabuľka so zarovnanými stĺpcami. */
function tabulka(hlavicka: readonly string[], riadky: readonly (readonly string[])[]): string {
  const sirky = hlavicka.map((h, i) => Math.max(h.length, ...riadky.map((r) => (r[i] ?? "").length)));
  const riadok = (r: readonly string[]) => r.map((c, i) => (i === 0 ? c.padEnd(sirky[i] ?? 0) : c.padStart(sirky[i] ?? 0))).join("  ");
  return [riadok(hlavicka), sirky.map((s) => "-".repeat(s)).join("  "), ...riadky.map(riadok)].join("\n");
}

/** Štatistiky kariet z databáz playtestov (playtest/<id>/server-data/naex.sqlite). */
function statistikyPlaytestov(): { partie: number; relacie: number; karty: StatistikyKariet } {
  let karty: StatistikyKariet = {};
  let partie = 0;
  let relacie = 0;
  if (!existsSync("playtest")) return { partie, relacie, karty };
  for (const r of readdirSync("playtest")) {
    const subor = join("playtest", r, "server-data", "naex.sqlite");
    if (!existsSync(subor)) continue;
    const db = new DatabaseSync(subor, { readOnly: true });
    try {
      const stlpce = db.prepare("PRAGMA table_info(partie)").all() as { name: string }[];
      if (!stlpce.some((c) => c.name === "karty")) continue;
      const rows = db.prepare("SELECT karty FROM partie WHERE karty IS NOT NULL").all() as { karty: string }[];
      if (rows.length > 0) relacie++;
      for (const row of rows) {
        karty = scitajStatistikyKariet(karty, normalizujStatistikyKariet(JSON.parse(row.karty) as unknown));
        partie++;
      }
    } finally {
      db.close();
    }
  }
  return { partie, relacie, karty };
}

function vypisStatistikyKariet(karty: StatistikyKariet, nazov: (id: string) => string): void {
  const naBitku = (s: StatKarty, x: number) => (s.bitky === 0 ? "—" : f1(x / s.bitky));
  const riadky = Object.entries(karty)
    .sort(([, a], [, b]) => b.bitky - a.bitky || b.zoSenku - a.zoSenku)
    .map(([id, s]) => [
      `${nazov(id)} (${id})`,
      String(s.partie),
      String(s.zoSenku),
      String(s.vylozene),
      String(s.podstrcene),
      String(s.priznane),
      String(s.naex),
      String(s.bitky),
      s.bitky === 0 ? "—" : pct(s.vyhrateBitky / s.bitky),
      naBitku(s, s.aktivne),
      naBitku(s, s.tuhe),
      naBitku(s, s.zle),
    ]);
  console.log(tabulka(["karta", "partie", "šenok", "vyložená", "podstrčená", "priznaná", "NA EX", "v bitke", "výhry", "⌀akt", "⌀tuhé", "⌀kliat"], riadky));
}

/** Súbory, v ktorých sa spomínajú karty: pravidlá, stránky webu, inštrukcie agentov, efekty. */
function suboryZmienok(): string[] {
  const out: string[] = ["docs/PRAVIDLA.md", "packages/core/src/effects.ts", "packages/core/src/engine.ts", "tools/playtest/hrac.ts"];
  for (const adr of ["apps/web/src/stranky", ".claude/agents", ".claude/skills/playtest", ".claude/skills/protihrac"]) {
    if (!existsSync(adr)) continue;
    for (const f of readdirSync(adr)) {
      const cesta = join(adr, f);
      if (statSync(cesta).isFile() && /\.(md|tsx?|txt)$/.test(f)) out.push(cesta);
    }
  }
  return out.filter((f) => existsSync(f));
}

const bezDiakritiky = (s: string): string => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// ---- príkazový riadok ------------------------------------------------------------

const S_HODNOTOU = new Set(["--url", "--od", "--seed", "--popis", "--nazov", "--kategoria", "--pocet", "--sila", "--vysledok", "--vydanie"]);

/** Štýl avatarov AI účtov — ako avatary offline protihráčov (seed/avatary/boti): dedinčan napoly robot. */
const STYL_AVATARA =
  "Square portrait avatar, head and shoulders, subject centered and looking at the viewer. A rural Slovak villager who is half human, " +
  "half crude home-made robot: rusty metal plates, exposed wires, a glowing cybernetic eye — 'peasant AI anarchy'. " +
  "Gritty adult comic book illustration matching the reference images: bold black ink outlines, cross-hatching, grainy texture, " +
  "muted dirty palette of browns, olive, slate blue and grey with one warm bulb light, slightly grotesque caricatured expressive face, " +
  "run-down post-socialist village interior. No text, no letters, no logos, no watermark, no frame, no border.";
const REFERENCIE_AVATARA = ["stamgast", "rapavy_fero", "teta_gizka"].map((b) => join("packages/server/seed/avatary/boti", `${b}.jpg`));

/** GET /api/admin/stav-servera (StavServera v packages/server/src/api.ts). */
interface StavServeraCli {
  readonly verzia: { readonly commit: string; readonly vetva: string; readonly necommitnute: boolean; readonly nahrate: string } | null;
  readonly spusteny: number;
  readonly partie: {
    readonly ludia: number;
    readonly sBotom: number;
    readonly cakajuce: number;
    readonly poslednaAktivita: number | null;
    readonly aktivne: number;
    readonly opustene: number;
  };
  readonly uzavierka: { readonly od: number } | null;
}

function vypisStavServera(s: StavServeraCli): void {
  const kedy = (t: number) => new Date(t).toLocaleString("sk-SK");
  console.log(
    s.verzia === null
      ? "  Verzia: neznáma (server bez VERZIA.json)."
      : `  Verzia: ${s.verzia.commit.slice(0, 7)} (${s.verzia.vetva}${s.verzia.necommitnute ? ", s necommitnutými zmenami!" : ""}), nahraté ${s.verzia.nahrate}`,
  );
  console.log(`  Spustený: ${kedy(s.spusteny)}`);
  const p = s.partie;
  console.log(
    `  Rozohrané partie: ${p.ludia} ľudia proti sebe, ${p.sBotom} s botom; čakajúce miestnosti: ${p.cakajuce}` +
      (p.poslednaAktivita === null ? "" : `; posledný ťah ${Math.round((Date.now() - p.poslednaAktivita) / 60000)} min dozadu`),
  );
  if (p.ludia + p.sBotom > 0) {
    console.log(`  Z toho aktívne (ťah za posledných 30 min): ${p.aktivne}, opustené: ${p.opustene}.`);
    console.log("  Reštart servera (nasadenie) tieto partie zhodí.");
  }
  console.log(
    s.uzavierka === null
      ? "  Uzávierka: vypnutá — nové partie sa dajú zakladať."
      : `  Uzávierka: ZAPNUTÁ od ${kedy(s.uzavierka.od)} — nové partie nie, rozohrané dohrajú; reštart ju zruší.`,
  );
}

function rozober(argv: readonly string[]): { poz: string[]; prep: Map<string, string | true> } {
  const poz: string[] = [];
  const prep = new Map<string, string | true>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? "";
    if (!a.startsWith("--")) poz.push(a);
    else if (S_HODNOTOU.has(a)) prep.set(a, argv[++i] ?? "");
    else prep.set(a, true);
  }
  return { poz, prep };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const url = webUrl(argv);
  const { poz, prep } = rozober(argv);
  const hodnota = (k: string): string | undefined => {
    const v = prep.get(k);
    return typeof v === "string" ? v : undefined;
  };
  const potvrdene = prep.has("--potvrdene");
  const [prikaz, ...arg] = poz;
  if (prikaz === undefined) throw new Error("Chýba príkaz (pozri hlavičku tools/admin/admin.ts).");

  // Príkazy bez webu.
  if (prikaz === "zmienky") {
    const id = arg[0];
    if (id === undefined) throw new Error("Použitie: zmienky <id-karty>");
    const def = (JSON.parse(readFileSync("packages/core/data/cards.json", "utf8")) as { cards: { id: string; name: string }[] }).cards.find((c) => c.id === id);
    const hladane = [id, ...(def === undefined ? [] : [def.name])].map(bezDiakritiky);
    let pocet = 0;
    for (const f of suboryZmienok()) {
      readFileSync(f, "utf8")
        .split(/\r?\n/)
        .forEach((riadok, i) => {
          const r = bezDiakritiky(riadok);
          if (hladane.some((h) => new RegExp(`(^|[^a-z0-9_])${h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9_]|$)`).test(r))) {
            pocet++;
            console.log(`${f}:${i + 1}: ${riadok.trim().slice(0, 180)}`);
          }
        });
    }
    console.log(pocet === 0 ? `Karta ${id} sa nikde nespomína.` : `\n${pocet} zmienok — po zmene karty skontroluj, či ešte sedia.`);
    return;
  }

  if (prikaz === "avatar-generuj") {
    const [kluc, namet] = arg;
    if (kluc === undefined || namet === undefined || !/^[a-z0-9-]{2,32}$/.test(kluc)) {
      throw new Error('Použitie: avatar-generuj <kluc> "<námet po anglicky>" [--seed N]');
    }
    nacitajEnv();
    const adr = join(PRACOVNY, "avatary", kluc);
    mkdirSync(adr, { recursive: true });
    const prompt = `${namet.trim().replace(/\.$/, "")}. ${STYL_AVATARA}`;
    writeFileSync(join(adr, "zadanie.json"), `${JSON.stringify({ prompt, kategoria: "avatar", referencie: REFERENCIE_AVATARA }, null, 2)}\n`);
    const seed = hodnota("--seed");
    const kolo = await generuj({
      id: `avatar ${kluc}`,
      adr,
      pracovny: PRACOVNY,
      pocet: 2,
      sila: "MID",
      navyse: prep.has("--navyse"),
      ...(seed === undefined ? {} : { seed: Number(seed) }),
    });
    console.log(`Kolo ${kolo.kolo}/${MAX_KOL_NA_KARTU} avatara ${kluc} (cena ${kolo.cena ?? "neuvedená"}):`);
    for (const f of kolo.subory) console.log(`  ${f}`);
    console.log("\nPozri ich (Read) a najlepší nastav: web.ts avatar --ako \"<meno>\" <subor> (Admin: admin.ts avatar <subor>).");
    return;
  }

  if (prikaz === "pas-generuj") {
    const [kluc, namet] = arg;
    if (kluc === undefined || namet === undefined || !/^[a-z0-9-]{2,40}$/.test(kluc)) {
      throw new Error('Použitie: pas-generuj <kluc> "<námet po anglicky>" [--sila LOW|MID|HIGH] [--seed N]');
    }
    nacitajEnv();
    const sila = (hodnota("--sila") ?? "LOW").toUpperCase();
    if (sila !== "LOW" && sila !== "MID" && sila !== "HIGH") throw new Error("--sila je LOW, MID alebo HIGH.");
    const adr = join(PRACOVNY, "pravidla", kluc);
    mkdirSync(adr, { recursive: true });
    const prompt = `${namet.trim().replace(/\.$/, "")}. ${STYL_PASU}`;
    // Leonardo berie najviac 6 referencií — každý pás dostane inú šesticu, aby sa vystriedali všetky.
    const posun = [...kluc].reduce((a, c) => a + c.charCodeAt(0), 0) % REFERENCIE_PASU.length;
    const referencie = Array.from({ length: Math.min(6, REFERENCIE_PASU.length) }, (_, i) =>
      join("packages/server/seed/karty", `${REFERENCIE_PASU[(posun + i) % REFERENCIE_PASU.length]}.jpg`),
    );
    writeFileSync(join(adr, "zadanie.json"), `${JSON.stringify({ prompt, kategoria: "pas", referencie }, null, 2)}\n`);
    const seed = hodnota("--seed");
    // 21:9 je najširší pomer Nano Banana; pás 2,5 : 1 sa z neho vyreže.
    const kolo = await generuj({
      id: `pás ${kluc}`,
      adr,
      pracovny: PRACOVNY,
      pocet: 2,
      sila: sila as Sila,
      navyse: prep.has("--navyse"),
      sirka: 1536,
      vyska: 672,
      ...(seed === undefined ? {} : { seed: Number(seed) }),
    });
    console.log(`Kolo ${kolo.kolo}/${MAX_KOL_NA_KARTU} pásu ${kluc} (cena ${kolo.cena ?? "neuvedená"}):`);
    for (const f of kolo.subory) console.log(`  ${f}`);
    return;
  }

  if (prikaz === "generuj") {
    const id = arg[0];
    if (id === undefined) throw new Error("Použitie: generuj <id-karty> [--pocet 1|2] [--sila LOW|MID|HIGH] [--seed N] [--navyse]");
    nacitajEnv();
    const sila = (hodnota("--sila") ?? "MID").toUpperCase();
    if (sila !== "LOW" && sila !== "MID" && sila !== "HIGH") throw new Error("--sila je LOW, MID alebo HIGH.");
    const seed = hodnota("--seed");
    const kolo = await generuj({
      id,
      adr: join(PRACOVNY, "obrazky", id),
      pracovny: PRACOVNY,
      pocet: Number(hodnota("--pocet") ?? "2"),
      sila: sila as Sila,
      navyse: prep.has("--navyse"),
      ...(seed === undefined ? {} : { seed: Number(seed) }),
    });
    console.log(`Kolo ${kolo.kolo}/${MAX_KOL_NA_KARTU} pre ${id} (sila ${kolo.sila}, cena ${kolo.cena ?? "neuvedená"}):`);
    for (const f of kolo.subory) console.log(`  ${f}`);
    console.log(`\nPozri ich (Read) vedľa referencií a najlepší nastav: admin.ts obrazok ${id} <subor>`);
    return;
  }

  if (prikaz === "leonardo") {
    const koren = join(PRACOVNY, "obrazky");
    const riadky: string[][] = [];
    let spolu = 0;
    for (const id of existsSync(koren) ? readdirSync(koren) : []) {
      const { kola } = nacitajZaznam(join(koren, id));
      if (kola.length === 0) continue;
      const ceny = kola.map((k) => Number.parseFloat(k.cena ?? "")).filter((x) => Number.isFinite(x));
      const suma = ceny.reduce((a, b) => a + b, 0);
      spolu += suma;
      riadky.push([id, `${kola.length}/${MAX_KOL_NA_KARTU}`, String(kola.reduce((a, k) => a + k.pocet, 0)), suma.toFixed(4)]);
    }
    if (riadky.length === 0) console.log("Zatiaľ nič negenerované cez API.");
    else console.log(`${tabulka(["karta", "kolá", "obrázky", "cena"], riadky)}\nSpolu: ${spolu.toFixed(4)} (jednotka podľa API, pri PAYG USD)`);
    return;
  }

  const { cookie, meno } = await prihlasAdmina(url);
  const api = <T>(metoda: string, cesta: string, telo?: unknown, typ?: string): Promise<T> =>
    volaj(url, metoda, `/api${cesta}`, cookie, telo, typ).then((r) => json<T>(r));
  const obsah = (): Promise<ObsahTvorcu> => api<ObsahTvorcu>("GET", "/admin/obsah");
  const nahraj = async (subor: string, druh: string, nazov: string): Promise<string> => {
    if (!existsSync(subor)) throw new Error(`Súbor ${subor} neexistuje.`);
    const typ = TYP_OBRAZKA[extname(subor).toLowerCase()];
    if (typ === undefined) throw new Error("Obrázok musí byť .jpg, .png, .webp (ikona .svg).");
    const m = await api<{ id: string }>("POST", `/admin/media?druh=${druh}&nazov=${encodeURIComponent(nazov)}`, new Uint8Array(readFileSync(subor)), typ);
    return m.id;
  };
  const karta = async (id: string | undefined): Promise<{ o: ObsahTvorcu; k: KartaNavrh }> => {
    const o = await obsah();
    const k = o.karty.find((x) => x.id === id);
    if (k === undefined) throw new Error(`Karta „${id ?? ""}“ v tvorcovi nie je.`);
    return { o, k };
  };

  switch (prikaz) {
    case "nahlady": {
      const v = await doplnNahladyCezChrome(url, cookie);
      console.log(`Náhľady na ${url}: čakalo ${v.cakalo}. ${v.text}`);
      break;
    }

    case "ucet":
      console.log(`Prihlásený ako „${meno}“ (subadmin) na ${url}.`);
      break;

    case "prehlad":
      vypisPrehlad(await obsah());
      break;

    case "karta": {
      const { k } = await karta(arg[0]);
      console.log(JSON.stringify(k, null, 2));
      console.log(`\n(efekt: ${stavEfektu(k)}; permutácií: ${variantyKarty(k).pocet})`);
      break;
    }

    case "ako-vidi": {
      const { o, k } = await karta(arg[0]);
      const data = dataZNavrhov(o);
      const v = data.variants.get(k.id);
      if (v === undefined) throw new Error(`Karta ${k.id} sa do hry nedá načítať (neznáme akcie alebo žiadna permutácia).`);
      console.log(`Takto kartu vypíše klient playtestera (tools/playtest/hrac.ts), ${v.total} variantov:`);
      let n = 0;
      for (let l = 0; l < v.left.length; l++) {
        for (let r = 0; r < v.right.length; r++) {
          if (++n > 8) continue;
          const s = printedSides(data, { defId: k.id, leftLayout: l, rightLayout: r });
          const f = (a: readonly (string | null)[]) => a.map((x) => x ?? "—").join(", ");
          console.log(`#${n} ${k.nazov} [${k.tagy.join(", ")}] — ${k.efekt}\n      ľavá strana (zhora): ${f(s.left)} | pravá strana: ${f(s.right)}`);
        }
      }
      if (n > 8) console.log(`… a ďalších ${n - 8} variantov.`);
      console.log("\nV línii: karta podstrčená na súperovu stranu sa číta podľa PRAVIDIEL §6 — over, ktorá hrana sa dotkne lokality.");
      break;
    }

    case "uloz": {
      const subor = arg[0];
      if (subor === undefined || !existsSync(subor)) throw new Error("Chýba súbor s návrhom karty (JSON).");
      const navrh = JSON.parse(readFileSync(subor, "utf8")) as Partial<KartaNavrh>;
      if (typeof navrh.id !== "string" || !/^[a-z0-9_]{1,64}$/.test(navrh.id)) throw new Error("Návrh potrebuje id: malé písmená, číslice, _ (napr. stary_mlynar).");
      const o = await obsah();
      const stara = o.karty.find((k) => k.id === navrh.id);
      // Nová karta preberá predvolené rozmery a mierky z nastavení tvorcu.
      const plny = { obrazok: null, farba: null, kopie: 1, efekt: "", tagy: [], ...o.nastavenia, ...stara, ...navrh };
      const ulozena = await api<KartaNavrh>("PUT", `/admin/karty/${navrh.id}`, plny);
      console.log(`${stara === undefined ? "Nová karta" : "Upravená karta"} ${ulozena.id} — ${ulozena.nazov} (${variantyKarty(ulozena).pocet} permutácií, efekt: ${stavEfektu(ulozena)}).`);
      const p = problemyKarty(ulozena);
      if (p.length > 0) console.log(`⚠ ${p.join("; ")}`);
      for (const t of kontrolaTextov([ulozena], { klucoveSlova: o.klucoveSlova, akcie: o.akcie, zverejnene: (await api<{ karty: KartaNavrh[] }>("GET", "/sada")).karty })) {
        console.log(`⚠ text: ${t.text}`);
      }
      break;
    }

    case "zmaz": {
      const id = arg[0];
      if (id === undefined) throw new Error("Chýba id karty.");
      if (!potvrdene) throw new Error("Mazanie karty treba potvrdiť: --potvrdene (a mať na to súhlas Michala).");
      console.log(`Záloha: ${zalohuj(await obsah(), `pred zmazanim ${id}`)}`);
      await api("DELETE", `/admin/karty/${id}`);
      console.log(`Návrh ${id} zmazaný (zverejnená sada sa nemení, kým sa nezverejní nová).`);
      break;
    }

    case "zaloha":
      console.log(`Záloha: ${zalohuj(await obsah(), arg.join(" "))}`);
      break;

    case "obnov": {
      const subor = arg[0];
      if (subor === undefined || !existsSync(subor)) throw new Error("Chýba súbor zálohy.");
      const zaloha = JSON.parse(readFileSync(subor, "utf8")) as ObsahTvorcu;
      const ids = prep.has("--vsetky") ? zaloha.karty.map((k) => k.id) : arg.slice(1);
      if (ids.length === 0) throw new Error("Povedz, ktoré karty obnoviť (id…), alebo --vsetky.");
      console.log(`Záloha pred obnovou: ${zalohuj(await obsah(), "pred obnovou")}`);
      for (const id of ids) {
        const k = zaloha.karty.find((x) => x.id === id);
        if (k === undefined) {
          console.log(`  ${id}: v zálohe nie je`);
          continue;
        }
        await api("PUT", `/admin/karty/${id}`, k);
        console.log(`  ${id}: obnovená`);
      }
      break;
    }

    // ---- rebalans a kontrola

    case "karty-v-partiach": {
      const o = await obsah();
      const nazov = (id: string) => o.karty.find((k) => k.id === id)?.nazov ?? id;
      const od = hodnota("--od");
      const ludia = prep.has("--ludia");
      const q = [...(od === undefined ? [] : [`od=${od}`]), ...(ludia ? ["ludia=1"] : [])].join("&");
      const web = await api<{ partie: number; karty: StatistikyKariet }>("GET", `/admin/statistiky-kariet${q === "" ? "" : `?${q}`}`);
      let karty = web.karty;
      let popis = `Web ${url}: ${web.partie} partií${ludia ? " ľudí (bez AI účtov)" : ""}${od === undefined ? "" : ` od sady v${od}`}.`;
      // Pod ~20 partií je rozptyl kariet väčší než rozdiel medzi nimi — čísla sú len náznak.
      if (web.partie < 20) popis += " Málo partií — ber to ako náznak, nie dôkaz.";
      if (prep.has("--playtesty")) {
        const p = statistikyPlaytestov();
        karty = scitajStatistikyKariet(karty, p.karty);
        popis += ` Playtesty: ${p.partie} partií z ${p.relacie} relácií (verziu sady nefiltrujem).`;
      }
      console.log(popis);
      if (Object.keys(karty).length === 0) {
        console.log("Zatiaľ žiadne partie so štatistikami kariet (zapisujú sa od 2026-10-16).");
        break;
      }
      console.log("Stĺpce ⌀ sú na jednu bitku, v ktorej karta ležala v línii. Jedna partia je jeden údaj.\n");
      vypisStatistikyKariet(karty, nazov);
      break;
    }

    case "texty": {
      const o = await obsah();
      const sada = await api<{ karty: KartaNavrh[] }>("GET", "/sada");
      const problemy = kontrolaTextov(o.karty, { klucoveSlova: o.klucoveSlova, akcie: o.akcie, zverejnene: sada.karty });
      if (problemy.length === 0) console.log("Texty efektov sú v poriadku.");
      for (const p of problemy) console.log(`${p.id} [${p.uroven}] ${p.text}`);
      break;
    }

    case "starsi": {
      const o = await obsah();
      const body = (scorecardsJson as { body: Record<string, number> }).body;
      const ids = (eldersJson as { elders: { id: string }[] }).elders.map((e) => e.id);
      console.log("STARŠÍ (karty ležia na ukazovateľoch; priazeň a body dáva bodovacia karta, ktorú starší dostane náhodne):");
      for (const id of ids) {
        const k = o.karty.find((x) => x.id === id);
        console.log(`  ${id} — ${k?.nazov ?? "?"}: ľavá ${k === undefined ? "?" : strana(k.lava)} | pravá ${k === undefined ? "?" : strana(k.prava)}${k !== undefined && k.efekt !== "" ? `\n      efekt (${stavEfektu(k)}): ${k.efekt}` : ""}`);
      }
      const ikona = (id: string | null) => (id === null ? "—" : (o.ikonyBodovania.find((i) => i.id === id)?.podmienka ?? id));
      console.log("\nBODOVACIE KARTY (názov = priazeň; podmienky vľavo | vpravo):");
      for (const b of o.bodovacie) console.log(`  ${b.nazov}: ${b.lava.map(ikona).join(" ")} | ${b.prava.map(ikona).join(" ")}`);
      console.log(`\nBODY ZA PODMIENKY (jadro, scorecards.json): ${Object.entries(body).map(([k, v]) => `${k} ${v}`).join(", ")}`);
      console.log("Hodnoty priazní (sila 1/2/3 × 2) a pravidlá strachu: PRAVIDLÁ §10; body: §14.");
      break;
    }

    // ---- vzhľad

    case "vzhlad": {
      const o = await obsah();
      console.log("AKCIE (kľúč — názov: popis):");
      for (const a of [...o.akcie].sort((x, y) => x.poradie - y.poradie)) console.log(`  ${a.kluc} — ${a.nazov}${a.ikona.typ === "svg" ? " [SVG ikona]" : ""}: ${a.popis.replace(/\s+/g, " ")}`);
      console.log("\nKĽÚČOVÉ SLOVÁ (formátovanie textu efektu):");
      for (const k of o.klucoveSlova) console.log(`  ${k.slovo}${k.tucne ? " [tučné]" : ""}${k.kurziva ? " [kurzíva]" : ""}${k.novyRiadok ? " [nový riadok]" : ""}${k.tvary.length > 0 ? ` tvary: ${k.tvary.join(", ")}` : ""} — ${k.popis.replace(/\s+/g, " ")}`);
      console.log("\nKATEGÓRIE (farba karty podľa prvého zapnutého tagu):");
      for (const k of o.kategorie) console.log(`  ${k.nazov}: odtieň ${k.odtien}${k.zapnuta ? "" : " (vypnutá)"}`);
      console.log(`\nPREDVOLENÉ: ${JSON.stringify(o.nastavenia)}`);
      break;
    }

    case "akcia": {
      const kluc = arg[0];
      const o = await obsah();
      const a = o.akcie.find((x) => x.kluc === kluc);
      if (a === undefined) throw new Error(`Akcia „${kluc ?? ""}“ neexistuje (pozri vzhlad).`);
      const nazov = hodnota("--nazov");
      const popis = hodnota("--popis");
      if (nazov === undefined && popis === undefined) {
        console.log(JSON.stringify(a, null, 2));
        break;
      }
      console.log(`Záloha: ${zalohuj(o, `pred upravou akcie ${a.kluc}`)}`);
      const nova = await api<AkciaDef>("PUT", `/admin/akcie/${encodeURIComponent(a.kluc)}`, { ...a, nazov: nazov ?? a.nazov, popis: popis ?? a.popis });
      console.log(`Akcia ${nova.kluc}: ${nova.nazov} — ${nova.popis}`);
      break;
    }

    case "slovo": {
      const slovo = arg[0];
      const o = await obsah();
      const k = o.klucoveSlova.find((x) => x.slovo === slovo);
      if (k === undefined) throw new Error(`Kľúčové slovo „${slovo ?? ""}“ neexistuje (pozri vzhlad).`);
      const popis = hodnota("--popis");
      if (popis === undefined) {
        console.log(JSON.stringify(k, null, 2));
        break;
      }
      console.log(`Záloha: ${zalohuj(o, `pred upravou slova ${k.slovo}`)}`);
      await api("PUT", "/admin/klucove-slova", o.klucoveSlova.map((x) => (x.slovo === k.slovo ? { ...x, popis } : x)));
      console.log(`Kľúčové slovo ${k.slovo}: ${popis}`);
      break;
    }

    case "ikona": {
      const [kluc, subor] = arg;
      if (kluc === undefined || subor === undefined || extname(subor).toLowerCase() !== ".svg") throw new Error("Použitie: ikona <kluc> <subor.svg>");
      const o = await obsah();
      const a = o.akcie.find((x) => x.kluc === kluc);
      if (a === undefined) throw new Error(`Akcia „${kluc}“ neexistuje (pozri vzhlad).`);
      console.log(`Záloha: ${zalohuj(o, `pred ikonou ${kluc}`)}`);
      const media = await nahraj(subor, "ikona", `${a.nazov}.svg`);
      await api("PUT", `/admin/akcie/${encodeURIComponent(kluc)}`, { ...a, ikona: { typ: "svg", media } });
      console.log(`Akcia ${kluc} má novú ikonu (médium ${media}). Vrátiť vstavanú ikonu vie Michal v Tvorba → Akcie a ikony.`);
      break;
    }

    case "bodovacie": {
      const o = await obsah();
      const ikona = (id: string | null) => (id === null ? "—" : (o.ikonyBodovania.find((i) => i.id === id)?.podmienka ?? id));
      for (const b of o.bodovacie) console.log(`${b.id} — ${b.nazov}: ľavá ${b.lava.map(ikona).join(" ")} | pravá ${b.prava.map(ikona).join(" ")}`);
      break;
    }

    // ---- ilustrácie

    case "prompt": {
      const [id, namet] = arg;
      if (id === undefined || namet === undefined) throw new Error('Použitie: prompt <id-karty> [--kategoria K] "<námet po anglicky>"');
      const k = (await obsah()).karty.find((x) => x.id === id);
      const kat = hodnota("--kategoria") ?? (k === undefined ? null : kategoriaPodlaTagov(k.tagy));
      if (kat === null || REFERENCIE[kat] === undefined) throw new Error(`Povedz --kategoria (${Object.keys(REFERENCIE).join(", ")}).`);
      const prompt = zostavPrompt(namet);
      const refs = cestyReferencii(kat);
      const adr = join(PRACOVNY, "obrazky", id);
      mkdirSync(adr, { recursive: true });
      writeFileSync(join(adr, "prompt.txt"), `${prompt}\n`);
      writeFileSync(join(adr, "zadanie.json"), `${JSON.stringify({ prompt, kategoria: kat, referencie: refs }, null, 2)}\n`);
      console.log(`Model v Leonardo.Ai: ${MODEL}, pomer 1:1 (1024 × 1024), 2 obrázky.\n`);
      console.log(`PROMPT (uložený v ${join(adr, "prompt.txt")}):\n${prompt}\n`);
      console.log(`REFERENČNÉ OBRÁZKY (Image Reference, sila Mid; kategória ${kat}):`);
      for (const r of refs) console.log(`  ${r}`);
      console.log(`\nGeneruj: admin.ts generuj ${id}   (alebo hotové obrázky ulož do ${adr}/ a vyber: admin.ts obrazok ${id} <subor>)`);
      break;
    }

    case "nahraj": {
      const subor = arg[0] ?? "";
      const druh = arg[1] ?? "kniznica";
      console.log(await nahraj(subor, druh, basename(subor)));
      break;
    }

    case "obrazok": {
      const [id, subor] = arg;
      if (id === undefined || subor === undefined) throw new Error("Použitie: obrazok <id-karty> <subor>");
      const { k } = await karta(id);
      // Do knižnice, aby si ju Michal v tvorcovi vedel orezať (náhľad 512 px robí
      // prehliadač). Médium je jedno na obsah, takže to isté id slúži aj karte.
      const media = await nahraj(subor, "kniznica", `${k.nazov} (${basename(subor)})`);
      // Bez knižníc na obrázky nevieme zmenšiť — náhľad je zatiaľ ten istý súbor.
      await api("PUT", `/admin/karty/${id}`, { ...k, obrazok: { plny: media, nahlad: media } });
      console.log(`Ilustrácia karty ${id} nastavená (médium ${media}); je aj v knižnici tvorcu.`);
      break;
    }

    case "stiahni": {
      const [id, subor] = arg;
      if (id === undefined || subor === undefined) throw new Error("Použitie: stiahni <id-media> <subor>");
      const r = await fetch(`${url}/media/${id}`);
      if (!r.ok) throw new Error(`Médium ${id}: ${r.status}`);
      writeFileSync(subor, new Uint8Array(await r.arrayBuffer()));
      console.log(`Uložené: ${subor}`);
      break;
    }

    case "kniznica": {
      const { media } = await api<{ media: { id: string; nazov: string }[] }>("GET", "/admin/media?druh=kniznica");
      for (const m of media) console.log(`${m.id}  ${m.nazov}`);
      break;
    }

    // ---- zverejnenie

    case "overit": {
      const o = await obsah();
      const problemy = overZverejnenie(o);
      console.log(problemy.length === 0 ? "Sada sa dá zverejniť — žiadne problémy." : `Zverejnenie by zlyhalo:\n${problemy.map((p) => `  - ${p}`).join("\n")}`);
      const sada = await api<{ karty: KartaNavrh[] }>("GET", "/sada");
      const texty = kontrolaTextov(o.karty, { klucoveSlova: o.klucoveSlova, akcie: o.akcie, zverejnene: sada.karty });
      if (texty.length > 0) console.log(`Texty efektov (${texty.length}): ${texty.map((t) => `${t.id}: ${t.text}`).join(" · ")}`);
      // Zverejnenie vydá VŠETKY návrhy — aj rozpracované od Michala či subadminov.
      const { sady } = await api<{ sady: { verzia: number; cas: number }[] }>("GET", "/admin/sady");
      const od = sady[0]?.cas ?? 0;
      const zmenene = o.karty.filter((k) => k.upravene > od);
      console.log(
        zmenene.length === 0
          ? `Od zverejnenia v${sady[0]?.verzia ?? "?"} sa žiadna karta nezmenila.`
          : `Zmenené od zverejnenia v${sady[0]?.verzia ?? "?"} (zverejnenie ich vydá všetky): ${zmenene.map((k) => `${k.id} (${new Date(k.upravene).toISOString().slice(0, 16)})`).join(", ")}`,
      );
      process.exitCode = problemy.length === 0 ? 0 : 1;
      break;
    }

    case "zverejni": {
      if (!potvrdene) throw new Error("Zverejnenie mení hru pre všetkých hráčov — treba --potvrdene a súhlas Michala.");
      const o = await obsah();
      const problemy = overZverejnenie(o);
      if (problemy.length > 0) throw new Error(`Zverejnenie by zlyhalo:\n${problemy.join("\n")}`);
      console.log(`Záloha: ${zalohuj(o, "pred zverejnenim")}`);
      const r = await api<{ verzia: number; kariet: number }>("POST", "/admin/zverejnit");
      console.log(`Zverejnená sada verzia ${r.verzia} (${r.kariet} kariet). Nové partie pobežia na nej.`);
      break;
    }

    case "sady": {
      const { sady } = await api<{ sady: { verzia: number; cas: number; autor: number | null; kariet: number }[] }>("GET", "/admin/sady");
      for (const s of sady) console.log(`v${s.verzia}  ${new Date(s.cas).toISOString().slice(0, 16)}  autor #${s.autor ?? "systém"}  ${s.kariet} kariet`);
      break;
    }

    case "vrat": {
      const verzia = Number(arg[0]);
      if (!Number.isInteger(verzia)) throw new Error("Použitie: vrat <verzia> --potvrdene [--aj-navrhy]");
      if (!potvrdene) throw new Error("Návrat na staršiu sadu mení hru pre všetkých hráčov — treba --potvrdene a súhlas Michala.");
      console.log(`Záloha: ${zalohuj(await obsah(), `pred navratom na v${verzia}`)}`);
      const r = await api<{ verzia: number; kariet: number; mimoSady: string[] }>("POST", `/admin/sady/${verzia}/obnovit`, { navrhy: prep.has("--aj-navrhy") });
      console.log(`Sada v${verzia} je znova v hre ako v${r.verzia} (${r.kariet} kariet).`);
      if (prep.has("--aj-navrhy")) {
        console.log(`Návrhy kariet vrátené na stav v${verzia}.${r.mimoSady.length > 0 ? ` Návrhy mimo tej sady ostali: ${r.mimoSady.join(", ")}.` : ""}`);
      } else {
        console.log("Návrhy v tvorcovi ostali, ako boli (ďalšie zverejnenie by ich vydalo).");
      }
      break;
    }

    // ---- spätná väzba a web

    case "nazory": {
      const k = arg[0] === undefined ? "" : `&kategoria=${arg[0]}`;
      const { nazory } = await api<{ nazory: { id: number; autor: { meno: string }; kategoria: string; stav: string; text: string; cigarety: number; komentare: { autor: { meno: string }; text: string }[] }[] }>("GET", `/nazory?triedenie=nove${k}`);
      for (const n of nazory) {
        console.log(`#${n.id} [${n.kategoria}, ${n.stav}] ${n.autor.meno} — ${n.cigarety} cig.\n  ${n.text.replace(/\n/g, "\n  ")}`);
        for (const c of n.komentare) console.log(`    ↳ ${c.autor.meno}: ${c.text.replace(/\n/g, " ")}`);
      }
      break;
    }

    case "komentar": {
      const [id, subor] = arg;
      if (id === undefined || subor === undefined || !existsSync(subor)) throw new Error("Použitie: komentar <id-nazoru> <subor.txt>");
      const r = await api<{ id: number }>("POST", `/nazory/${Number(id)}/komentare`, { text: readFileSync(subor, "utf8").trim() });
      console.log(`Komentár #${r.id} k názoru #${id} pridaný ako ${meno}.`);
      break;
    }

    case "stav": {
      const [id, stav] = arg;
      if (id === undefined || stav === undefined) throw new Error("Použitie: stav <id-nazoru> <nove|prijate|planovane|hotove|zamietnute>");
      await api("PATCH", `/nazory/${Number(id)}`, { stav });
      console.log(`Názor #${id}: stav ${stav}.`);
      break;
    }

    case "playtesty": {
      const { reporty } = await api<{ reporty: unknown[] }>("GET", "/admin/playtesty");
      console.log(JSON.stringify(reporty, null, 2));
      break;
    }

    case "avatar": {
      const subor = arg[0];
      const typ = subor === undefined ? undefined : TYP_OBRAZKA[extname(subor).toLowerCase()];
      if (subor === undefined || !existsSync(subor) || typ === undefined || typ === "image/svg+xml") throw new Error("Použitie: avatar <obrazok.jpg|png|webp>");
      await api("PUT", "/profil/avatar", new Uint8Array(readFileSync(subor)), typ);
      console.log(`Avatar účtu „${meno}“ nastavený na ${url}.`);
      break;
    }

    // ---- playtest: reporty a návrhy

    case "report-nahraj": {
      if (arg.length === 0) throw new Error("Použitie: report-nahraj <subor v docs/playtesty>…");
      for (const subor of arg) {
        if (!existsSync(subor) || !statSync(subor).isFile()) throw new Error(`Súbor ${subor} neexistuje.`);
        // Cesta na webe = cesta v docs/playtesty (obrázky reportu v podpriečinku <id>/).
        const rel = subor.replace(/\\/g, "/").replace(/^(\.\/)?docs\/playtesty\//, "");
        const cesta = rel.split("/").map(encodeURIComponent).join("/");
        await api("PUT", `/admin/playtesty/subor/${cesta}`, new Uint8Array(readFileSync(subor)));
        console.log(`Nahraté: ${url}/playtest/reporty/${encodeURIComponent(rel)}`);
      }
      break;
    }

    case "navrhy": {
      const { navrhy } = await api<{
        navrhy: { id: number; davka: string; nazov: string; kritickost: string; stav: string; volba: string | null; poznamka: string; rozhodol: { meno: string; ai: boolean } | null; vysledok: string; overenie?: string[]; verdikt?: string }[];
      }>("GET", "/admin/navrhy");
      const vybrane = navrhy.filter((n) => arg[0] === undefined || n.stav === arg[0]);
      if (prep.has("--json")) {
        console.log(JSON.stringify(vybrane, null, 2));
        break;
      }
      if (vybrane.length === 0) console.log(arg[0] === undefined ? "Žiadne návrhy." : `Žiadne návrhy v stave ${arg[0]}.`);
      for (const n of vybrane) {
        const kto = n.rozhodol === null ? "" : `, rozhodol ${n.rozhodol.meno}${n.rozhodol.ai ? " (AI!)" : ""}`;
        console.log(`#${n.id} [${n.stav}${n.volba === null ? "" : `, možnosť ${n.volba}`}${kto}] ${n.davka} · ${n.kritickost} · ${n.nazov}`);
        if (n.poznamka !== "") console.log(`    poznámka: ${n.poznamka.replace(/\n/g, " ")}`);
        if (n.vysledok !== "") console.log(`    výsledok: ${n.vysledok.replace(/\n/g, " ")}`);
        for (const o of n.overenie ?? []) console.log(`    overiť: ${o}`);
        if ((n.verdikt ?? "") !== "") console.log(`    verdikt: ${(n.verdikt ?? "").replace(/\n/g, " ")}`);
      }
      break;
    }

    case "navrhy-nahraj": {
      const subor = arg[0];
      if (subor === undefined || !existsSync(subor)) throw new Error("Použitie: navrhy-nahraj <navrhy-<id>.json>");
      const r = await api<{ ids: number[] }>("POST", "/admin/navrhy", JSON.parse(readFileSync(subor, "utf8")) as unknown);
      console.log(`Nahratých ${r.ids.length} návrhov (#${r.ids.join(", #")}) — ${url}/playtest`);
      break;
    }

    case "navrh": {
      const [id, stav] = arg;
      if (id === undefined || stav === undefined || !/^\d+$/.test(id)) throw new Error('Použitie: navrh <id> <rozpracovane|implementovane|spat> [--vysledok "text"]');
      // Agent rozhodnutia admina nemení — len hlási priebeh implementácie;
      // „spat“ vráti nedokončený návrh z rozpracovaného na implementovať (rozhodnutie ostane).
      if (stav !== "rozpracovane" && stav !== "implementovane" && stav !== "spat" && stav !== "overene" && stav !== "nezabralo") {
        throw new Error("Agent nastavuje len rozpracovane, implementovane, spat, overene alebo nezabralo; rozhoduje Michal na webe.");
      }
      // Verdikt overenia: playtest po implementácii ukázal, či zmena zabrala.
      if (stav === "overene" || stav === "nezabralo") {
        const verdikt = hodnota("--vysledok");
        if (verdikt === undefined || verdikt.trim() === "") throw new Error(`Použitie: navrh <id> ${stav} --vysledok "<čo playtest ukázal, odkaz na report>"`);
        await api("PATCH", `/admin/navrhy/${id}`, { stav, verdikt });
        console.log(`Návrh #${id}: ${stav === "overene" ? "overené — zabralo" : "nezabralo, vrátený Michalovi na rozhodnutie"}.`);
        break;
      }
      if (stav === "spat") {
        const { navrhy } = await api<{ navrhy: { id: number; stav: string }[] }>("GET", "/admin/navrhy");
        if (navrhy.find((n) => n.id === Number(id))?.stav !== "rozpracovane") throw new Error(`Návrh #${id} nie je rozpracovaný.`);
        await api("PATCH", `/admin/navrhy/${id}`, { stav: "implementovat", ...(hodnota("--vysledok") === undefined ? {} : { vysledok: hodnota("--vysledok") }) });
        console.log(`Návrh #${id}: späť na implementovať.`);
        break;
      }
      const vysledok = hodnota("--vysledok");
      await api("PATCH", `/admin/navrhy/${id}`, { stav, ...(vysledok === undefined ? {} : { vysledok }) });
      console.log(`Návrh #${id}: ${stav}.`);
      break;
    }

    case "uzavierka": {
      const co = arg[0] ?? "stav";
      if (co === "zapni" || co === "vypni") {
        const r = await api<{ uzavierka: { od: number } | null }>("PUT", "/admin/uzavierka", { zapnut: co === "zapni" });
        console.log(r.uzavierka === null ? "Uzávierka vypnutá — nové partie sa dajú zakladať." : "Uzávierka zapnutá — nové partie nie, rozohrané dohrajú.");
      } else if (co !== "stav") {
        throw new Error("Použitie: uzavierka zapni|vypni|stav");
      }
      vypisStavServera(await api<StavServeraCli>("GET", "/admin/stav-servera"));
      break;
    }

    case "server-stav": {
      const s = await api<StavServeraCli>("GET", "/admin/stav-servera");
      if (prep.has("--json")) {
        console.log(JSON.stringify(s, null, 2));
        break;
      }
      vypisStavServera(s);
      break;
    }

    case "linka": {
      // Ranný prehľad celej linky (skill naex-stav): kto na čom čaká.
      const { spawnSync } = await import("node:child_process");
      const git = (...a: string[]): string => {
        const r = spawnSync("git", a, { encoding: "utf8" });
        return r.status === 0 ? r.stdout.trim() : "";
      };
      const { navrhy } = await api<{ navrhy: { id: number; nazov: string; stav: string; davka: string; rozhodol: { ai: boolean } | null }[] }>("GET", "/admin/navrhy");
      const { polozky } = await api<{ polozky: { id: number; stlpec: string; nazov: string; stav: string; navrh: number | null }[] }>("GET", "/roadmapa");
      const { nazory } = await api<{ nazory: { id: number; stav: string; text: string; autor: { meno: string; ai: boolean } }[] }>("GET", "/nazory?triedenie=nove");
      const s = await api<StavServeraCli>("GET", "/admin/stav-servera");
      const riadok = (n: { id: number; nazov: string; davka: string }) => `    #${n.id} ${n.nazov} (${n.davka})`;
      const skupina = (nadpis: string, zoznam: readonly string[]) => {
        console.log(`\n${nadpis} (${zoznam.length})`);
        for (const z of zoznam.slice(0, 8)) console.log(z);
        if (zoznam.length > 8) console.log(`    … a ďalších ${zoznam.length - 8}`);
      };
      console.log(`Web: ${url}`);

      console.log("\n== Čaká na Michala");
      skupina("  Návrhy na rozhodnutie (/playtest)", navrhy.filter((n) => n.stav === "nove").map(riadok));
      skupina("  Nezabrali — rozhodnúť znova", navrhy.filter((n) => n.stav === "nezabralo").map(riadok));
      skupina("  Prijímač roadmapy — zaradiť do horizontu", polozky.filter((p) => p.stlpec === "prijimac").map((p) => `    #${p.id} ${p.nazov}`));
      const ludske = nazory.filter((n) => n.stav === "nove" && !n.autor.ai);
      skupina("  Nové názory ľudí na Spätnej väzbe", ludske.map((n) => `    #${n.id} ${n.autor.meno}: ${n.text.replace(/\s+/g, " ").slice(0, 90)}`));

      console.log("\n== Čaká na Developera (/naex-implementacia)");
      const vTeraz = polozky.filter((p) => p.stlpec === "teraz" && p.stav !== "hotove");
      skupina("  Stĺpec Teraz zhora", vTeraz.map((p) => `    #${p.id} ${p.nazov}${p.navrh === null ? "" : ` [návrh #${p.navrh}]`} · ${p.stav}`));
      skupina("  Návrhy na implementáciu", navrhy.filter((n) => n.stav === "implementovat" || n.stav === "rozpracovane").map((n) => `${riadok(n)} · ${n.stav}${n.rozhodol?.ai === true ? " · rozhodol účet AI — Developer nevezme!" : ""}`));

      console.log("\n== Čaká na playtest (overenie zmien)");
      skupina("  Implementované, neoverené", navrhy.filter((n) => n.stav === "implementovane").map(riadok));

      console.log("\n== Server a nasadenie");
      vypisStavServera(s);
      if (s.verzia !== null && git("rev-parse", "--verify", "--quiet", `${s.verzia.commit}^{commit}`) !== "") {
        const nenasadene = git("log", "--oneline", `${s.verzia.commit}..origin/master`).split("\n").filter((r) => r !== "");
        skupina("  Commity v origin/master, ktoré nie sú nasadené (/naex-nasad)", nenasadene.map((r) => `    ${r}`));
      } else if (s.verzia === null) {
        console.log("  Server nevie svoju verziu (nasadený pred VERZIA.json, alebo vývojový) — nenasadené commity nezistím.");
      }

      console.log("\n== Pracovný strom");
      const zmeny = git("status", "--porcelain").split("\n").filter((r) => r !== "");
      console.log(`  vetva ${git("rev-parse", "--abbrev-ref", "HEAD")}, necommitnuté súbory: ${zmeny.length}`);
      const vpred = git("rev-list", "--count", "origin/master..master");
      if (vpred !== "" && vpred !== "0") console.log(`  master je ${vpred} commitov pred origin/master — chýba push.`);
      const todo = git("grep", "-c", "TODO", "--", "packages/core/data").split("\n").filter((r) => r !== "");
      if (todo.length > 0) console.log(`  TODO v herných dátach: ${todo.join(", ")}`);
      break;
    }

    case "roadmapa": {
      const { stlpce, polozky } = await api<{
        stlpce: { kluc: string; nazov: string; zamer: string }[];
        polozky: { id: number; stlpec: string; nazov: string; kratko: string; stav: string; oblast: string; narocnost: string; navrh: number | null; zavisi: number[] }[];
      }>("GET", "/roadmapa");
      const vybrane = stlpce.filter((s) => arg[0] === undefined || s.kluc === arg[0]);
      if (vybrane.length === 0) throw new Error(`Neznámy stĺpec „${arg[0] ?? ""}“: ${stlpce.map((s) => s.kluc).join(" | ")}.`);
      if (prep.has("--json")) {
        console.log(JSON.stringify(polozky.filter((p) => vybrane.some((s) => s.kluc === p.stlpec)), null, 2));
        break;
      }
      for (const s of vybrane) {
        const v = polozky.filter((p) => p.stlpec === s.kluc);
        console.log(`\n${s.nazov.toUpperCase()} (${v.length}) — ${s.zamer}`);
        v.forEach((p, i) => {
          const navrh = p.navrh === null ? "" : ` [návrh #${p.navrh}]`;
          const zavisi = p.zavisi.length === 0 ? "" : ` (po #${p.zavisi.join(", #")})`;
          console.log(`  ${i + 1}. #${p.id} ${p.nazov} · ${p.oblast}, ${p.narocnost}, ${p.stav}${navrh}${zavisi}`);
        });
      }
      break;
    }

    case "roadmapa-pridaj": {
      const subor = arg[0];
      if (subor === undefined || !existsSync(subor)) throw new Error("Použitie: roadmapa-pridaj <polozka.json>");
      // Agent pridáva len do Prijímača — stĺpec a poradie určí Michal na webe.
      const telo = { ...(JSON.parse(readFileSync(subor, "utf8")) as Record<string, unknown>), stlpec: "prijimac" };
      const r = await api<{ id: number }>("POST", "/roadmapa", telo);
      console.log(`Položka #${r.id} je v Prijímači — ${url}/vyvoj/roadmapa`);
      break;
    }

    case "novinky": {
      const { novinky } = await api<{ novinky: Novinka[] }>("GET", "/novinky");
      if (prep.has("--json")) console.log(JSON.stringify(novinky, null, 2));
      else if (novinky.length === 0) console.log("Zatiaľ žiadne novinky.");
      else for (const n of novinky) console.log(`#${n.id}  ${n.datum}${n.vydanie ? ` (${n.vydanie})` : ""}  ${n.kategoria.padEnd(8)} ${n.nadpis}${n.odkaz === "" ? "" : `  → ${n.odkaz}`}`);
      break;
    }

    case "novinka-pridaj": {
      const subor = arg[0];
      if (subor === undefined || !existsSync(subor)) throw new Error("Použitie: novinka-pridaj <novinka.json> (objekt alebo pole objektov)");
      const zoSuboru = JSON.parse(readFileSync(subor, "utf8")) as unknown;
      const vydanie = hodnota("--vydanie");
      for (const telo of Array.isArray(zoSuboru) ? zoSuboru : [zoSuboru]) {
        const s = telo as Record<string, unknown>;
        const { novinka } = await api<{ novinka: Novinka }>("POST", "/admin/novinky", vydanie !== undefined && s.vydanie === undefined ? { ...s, vydanie } : s);
        console.log(`Novinka #${novinka.id} (${novinka.datum}${novinka.vydanie ? ` · ${novinka.vydanie}` : ""}, ${novinka.kategoria}) — ${novinka.nadpis}`);
      }
      console.log(`${url}/novinky`);
      break;
    }

    case "novinka-uprav": {
      const id = Number(arg[0]);
      const subor = arg[1];
      if (!Number.isInteger(id) || subor === undefined || !existsSync(subor)) throw new Error("Použitie: novinka-uprav <id> <zmeny.json> (len polia, ktoré meníš)");
      const { novinka } = await api<{ novinka: Novinka }>("PATCH", `/admin/novinky/${id}`, JSON.parse(readFileSync(subor, "utf8")));
      console.log(`Novinka #${novinka.id} upravená: ${novinka.datum}, ${novinka.kategoria} — ${novinka.nadpis}`);
      break;
    }

    case "novinka-zmaz": {
      const id = Number(arg[0]);
      if (!Number.isInteger(id)) throw new Error("Použitie: novinka-zmaz <id> --potvrdene");
      if (!potvrdene) throw new Error("Zmazanie novinky treba potvrdiť: --potvrdene.");
      await api("DELETE", `/admin/novinky/${id}`);
      console.log(`Novinka #${id} zmazaná.`);
      break;
    }

    case "tempo": {
      const { partie } = await api<{ partie: PartiaTempa[] }>("GET", "/admin/tempo");
      if (prep.has("--json")) console.log(JSON.stringify(partie, null, 2));
      else console.log(prehladTempa(partie));
      break;
    }

    case "pouzivatelia": {
      const { pouzivatelia } = await api<{ pouzivatelia: { id: number; login: string; meno: string; rola: string; dohrate: number }[] }>("GET", "/admin/pouzivatelia");
      for (const p of pouzivatelia) console.log(`${p.id}  ${p.rola.padEnd(10)} ${p.meno} (${p.login}), dohraté ${p.dohrate}`);
      break;
    }

    default:
      throw new Error(`Neznámy príkaz „${prikaz}“ (pozri hlavičku tools/admin/admin.ts).`);
  }
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("tools/admin/admin.ts")) {
  main().catch((err: unknown) => {
    console.error(`CHYBA: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  });
}
