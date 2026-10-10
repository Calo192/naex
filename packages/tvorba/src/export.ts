// Textový export a import kariet — presne formát MAUI CardExportService /
// CardImportService (kartyai_cards_*.txt). Ten istý súbor číta aj
// tools/parse_cards.py, takže výmena s MAUI aplikáciou funguje oboma smermi.

import type { AkciaDef, KartaNavrh, Pozicia, StranaNavrhu } from "./typy.ts";
import { POZICIE } from "./typy.ts";
import { rozlozeniaStrany } from "./varianty.ts";

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
    sb.push(`Total permutations: ${l * r} (left ${l} x right ${r})`, "");
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
}

export interface ImportVysledok {
  readonly karty: readonly ImportKarta[];
  /** Názvy akcií, ktoré sa nepodarilo priradiť (preskočené). */
  readonly nezname: readonly string[];
}

function najdiAkciu(nazov: string, akcie: readonly AkciaDef[]): string | null {
  const n = nazov.trim().toLocaleLowerCase("sk");
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
    });
  }
  return { karty, nezname: [...nezname] };
}
