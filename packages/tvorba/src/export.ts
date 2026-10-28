// Textový export a import kariet — presne formát MAUI CardExportService /
// CardImportService (kartyai_cards_*.txt). Ten istý súbor číta aj
// tools/parse_cards.py, takže výmena s MAUI aplikáciou funguje oboma smermi.
// Príbeh a účel karty (STORY, PURPOSE) idú až za „Total permutations“ — tam ich
// MAUI aj parse_cards.py preskočia; riadky textu sú odsadené, aby žiadny nevyzeral
// ako hlavička karty.

import type { AkciaDef, KartaNavrh, Pozicia, StranaNavrhu } from "./typy.ts";
import { POZICIE } from "./typy.ts";
import { rozlozeniaStrany } from "./varianty.ts";
import { MAX_TEXTU_KARTY, sTextomKarty } from "./pribeh.ts";

const CIARA = "============================================================";
const POMLCKY = "------------------------------------------------------------";

function nazovAkcie(kluc: string, akcie: readonly AkciaDef[]): string {
  return akcie.find((a) => a.kluc === kluc)?.nazov ?? kluc;
}

function strana(sb: string[], label: string, s: StranaNavrhu, lava: boolean, akcie: readonly AkciaDef[]): void {
  const pre = lava ? "L" : "R";
  const blok = [...s.blokovane].sort();
  const zoznam = Object.entries(s.akcie).filter(([, n]) => n > 0);
  sb.push(`${label} side:`);
  sb.push(`  Blocked positions: ${blok.length === 0 ? "none" : blok.map((p) => `${pre}${p}`).join(", ")}`);
  sb.push(`  Available slots: ${4 - blok.length} of 4`);
  sb.push(
    `  Actions: ${zoznam.length === 0 ? "none" : zoznam.map(([k, n]) => `${nazovAkcie(k, akcie)} x${n}`).join(", ")}`,
  );
  const obmedzenia = POZICIE.filter((p) => !blok.includes(p) && (s.povolene[p]?.length ?? 0) > 0).map(
    (p) => `${pre}${p}: only ${(s.povolene[p] ?? []).map((k) => nazovAkcie(k, akcie)).join(", ")}`,
  );
  sb.push(
    `  Position restrictions: ${obmedzenia.length === 0 ? "none (all positions allow every action)" : obmedzenia.join("; ")}`,
  );
}

function textovyBlok(sb: string[], hlavicka: string, text: string | undefined): void {
  const t = text?.trim() ?? "";
  if (t === "") {
    sb.push(`${hlavicka}: (none)`);
    return;
  }
  sb.push(`${hlavicka}:`, ...t.split("\n").map((r) => (r.trim() === "" ? "" : `  ${r.trimEnd()}`)));
}

export function exportTxt(karty: readonly KartaNavrh[], akcie: readonly AkciaDef[], teraz: Date): string {
  const zoradene = [...karty].sort((a, b) => a.nazov.localeCompare(b.nazov, "sk"));
  const dva = (n: number) => String(n).padStart(2, "0");
  const sb: string[] = [
    "KARTYAI CARD EXPORT",
    `Generated: ${teraz.getFullYear()}-${dva(teraz.getMonth() + 1)}-${dva(teraz.getDate())} ${dva(teraz.getHours())}:${dva(teraz.getMinutes())}`,
    `Total cards: ${zoradene.length}`,
    "",
    CIARA,
    "HOW CARD PERMUTATIONS ARE GENERATED",
    CIARA,
    "Each card has two independent sides: LEFT and RIGHT.",
    "Each side has 4 slot positions, index 0 (top) to 3 (bottom).",
    "A position may be BLOCKED or RESTRICT which actions can occupy it.",
    "The actions of a side form a multiset placed into its available",
    "positions; every DISTINCT arrangement counts once.",
    "",
    "    total permutations = (left arrangements) x (right arrangements)",
    CIARA,
    "",
  ];
  zoradene.forEach((k, i) => {
    sb.push(POMLCKY, `CARD ${i + 1}: ${k.nazov.trim() || "Untitled"}`, POMLCKY);
    sb.push(`Tags: ${k.tagy.length === 0 ? "none" : k.tagy.join(", ")}`);
    sb.push(`EFECT: ${k.efekt.trim() === "" ? "(none)" : k.efekt.trim()}`, "");
    strana(sb, "LEFT", k.lava, true, akcie);
    sb.push("");
    strana(sb, "RIGHT", k.prava, false, akcie);
    sb.push("");
    const l = rozlozeniaStrany(k.lava).length;
    const r = rozlozeniaStrany(k.prava).length;
    sb.push(`Total permutations: ${l * r} (left ${l} x right ${r})`);
    textovyBlok(sb, "STORY", k.pribeh);
    textovyBlok(sb, "PURPOSE", k.ucel);
    sb.push("");
  });
  return sb.join("\n");
}

/** Jedna karta z importovaného súboru (len polia, ktoré súbor nesie). */
export interface ImportKarta {
  readonly nazov: string;
  readonly tagy: readonly string[];
  readonly efekt: string;
  readonly lava: StranaNavrhu;
  readonly prava: StranaNavrhu;
  /** Príbeh a účel len vtedy, keď ich súbor nesie (export z MAUI ich nemá — karte ostanú). "" = zmazať. */
  readonly pribeh?: string;
  readonly ucel?: string;
}

export interface ImportVysledok {
  readonly karty: readonly ImportKarta[];
  /** Názvy akcií, ktoré sa nepodarilo priradiť (preskočené). */
  readonly nezname: readonly string[];
}

/** Staré názvy akcií v exportoch spred 2026-10-19 (jednotné názvy). */
const STARE_NAZVY: Readonly<Record<string, string>> = { hazard: "Dlh", "pečeň": "PoškodeniePečene", poldecko: "Poldeci", cigaretka: "Cigareta" };

function najdiAkciu(nazov: string, akcie: readonly AkciaDef[]): string | null {
  const povodny = nazov.trim().toLocaleLowerCase("sk");
  const n = (STARE_NAZVY[povodny] ?? povodny).toLocaleLowerCase("sk");
  const a = akcie.find((x) => x.nazov.toLocaleLowerCase("sk") === n || x.kluc.toLocaleLowerCase("sk") === n);
  return a?.kluc ?? null;
}

function parseStrana(blok: string, akcie: readonly AkciaDef[], nezname: Set<string>): StranaNavrhu {
  const riadok = (meno: string) => new RegExp(`^\\s*${meno}:\\s*(.*)$`, "m").exec(blok)?.[1]?.trim() ?? "none";
  const blokovane = riadok("Blocked positions")
    .split(",")
    .map((s) => /[LR]([0-3])/.exec(s)?.[1])
    .filter((s): s is string => s !== undefined)
    .map((s) => Number(s) as Pozicia);
  const akcieMap: Record<string, number> = {};
  const akcieRiadok = riadok("Actions");
  if (akcieRiadok !== "none") {
    for (const kus of akcieRiadok.split(",")) {
      const m = /^(.*?)\s+x(\d+)$/.exec(kus.trim());
      if (m === null) continue;
      const kluc = najdiAkciu(m[1] ?? "", akcie);
      if (kluc === null) {
        nezname.add((m[1] ?? "").trim());
        continue;
      }
      akcieMap[kluc] = (akcieMap[kluc] ?? 0) + Number(m[2]);
    }
  }
  const povolene: Partial<Record<Pozicia, string[]>> = {};
  const obm = riadok("Position restrictions");
  if (!obm.startsWith("none")) {
    for (const kus of obm.split(";")) {
      const m = /[LR]([0-3]):\s*only\s+(.*)$/.exec(kus.trim());
      if (m === null) continue;
      const kluce = (m[2] ?? "")
        .split(",")
        .map((n) => najdiAkciu(n, akcie))
        .filter((k): k is string => k !== null);
      if (kluce.length > 0) povolene[Number(m[1]) as Pozicia] = kluce;
    }
  }
  return { blokovane, akcie: akcieMap, povolene };
}

/** Texty, ktoré súbor nesie — aj prázdne (zmazanie), na rozdiel od textyKarty v pribeh.ts. */
function textyZoSuboru(pribeh: string | undefined, ucel: string | undefined): { pribeh?: string; ucel?: string } {
  return { ...(pribeh === undefined ? {} : { pribeh }), ...(ucel === undefined ? {} : { ucel }) };
}

/** Karta s príbehom a účelom z importu; súbor bez STORY/PURPOSE (export z MAUI) jej texty nechá. */
export function sTextamiZImportu(k: KartaNavrh, ik: Pick<ImportKarta, "pribeh" | "ucel">): KartaNavrh {
  const sPribehom = ik.pribeh === undefined ? k : sTextomKarty(k, "pribeh", ik.pribeh.slice(0, MAX_TEXTU_KARTY));
  return ik.ucel === undefined ? sPribehom : sTextomKarty(sPribehom, "ucel", ik.ucel.slice(0, MAX_TEXTU_KARTY));
}

/** Odsadený blok textu pod hlavičkou; undefined = hlavička v súbore nie je. */
function citajTextovyBlok(telo: string, hlavicka: string): string | undefined {
  const riadky = telo.split("\n");
  const i = riadky.findIndex((r) => r.startsWith(`${hlavicka}:`));
  if (i < 0) return undefined;
  const hned = (riadky[i] ?? "").slice(hlavicka.length + 1).trim();
  if (hned === "(none)") return "";
  const text = hned === "" ? [] : [hned];
  for (const r of riadky.slice(i + 1)) {
    if (r.trim() !== "" && !/^\s/.test(r)) break;
    text.push(r.replace(/^ {2}/, "").trimEnd());
  }
  return text.join("\n").trim();
}

export function importTxt(text: string, akcie: readonly AkciaDef[]): ImportVysledok {
  const nezname = new Set<string>();
  const karty: ImportKarta[] = [];
  const casti = text.replace(/\r\n/g, "\n").split(/-{20,}\nCARD \d+: (.+)\n-{20,}\n/);
  for (let i = 1; i < casti.length; i += 2) {
    const nazov = (casti[i] ?? "").trim();
    const telo = casti[i + 1] ?? "";
    const tagyRiadok = /^Tags:\s*(.*)$/m.exec(telo)?.[1]?.trim() ?? "none";
    const efekt = /^EFECT:\s*([\s\S]*?)(?=\n\s*\nLEFT side:|\nLEFT side:)/m.exec(telo)?.[1]?.replace(/\s*\n\s*/g, " ").trim() ?? "";
    const lavyBlok = /LEFT side:\n([\s\S]*?)(?=\nRIGHT side:)/.exec(telo)?.[1] ?? "";
    const pravyBlok = /RIGHT side:\n([\s\S]*?)(?=\nTotal permutations:|$)/.exec(telo)?.[1] ?? "";
    karty.push({
      nazov,
      tagy: tagyRiadok === "none" ? [] : tagyRiadok.split(/[,;]/).map((t) => t.trim()).filter((t) => t !== ""),
      efekt: efekt === "(none)" ? "" : efekt,
      lava: parseStrana(lavyBlok, akcie, nezname),
      prava: parseStrana(pravyBlok, akcie, nezname),
      ...textyZoSuboru(citajTextovyBlok(telo, "STORY"), citajTextovyBlok(telo, "PURPOSE")),
    });
  }
  return { karty, nezname: [...nezname] };
}
