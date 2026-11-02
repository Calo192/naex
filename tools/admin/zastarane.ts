// Kandidáti na skrytie pri vypálení Zrejúcej (skill vypalit, krok 7): texty,
// ktoré menujú kartu, čo v rozpracovanej sade už nie je, alebo zrušenú
// mechaniku zo zastarane.json. Len návrh na kontrolu — nič neskrýva.
//
// Hľadá sa v texte bez diakritiky a malými písmenami, od začiatku slova; meno
// karty aj s pádovou koncovkou („Kohúta“, „Injekciou“).

export interface ZrusenyPojem {
  readonly pojem: string;
  /** Regulárne výrazy bez diakritiky, malými písmenami — začiatok slova. */
  readonly vzory: readonly string[];
  readonly pozn: string;
}

export interface KonfiguraciaZastaranych {
  readonly mechaniky: readonly ZrusenyPojem[];
  /** Vyradené karty, ktoré v žiadnej zverejnenej sade webu neboli. */
  readonly karty: readonly string[];
}

export interface Hladane {
  readonly pojem: string;
  readonly druh: "karta" | "mechanika";
  readonly re: RegExp;
}

export interface Zmienka {
  readonly pojem: string;
  readonly druh: "karta" | "mechanika";
  readonly pocet: number;
}

export const normalizuj = (t: string): string =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const escape = (t: string): string => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Kmeň mena karty: posledné slovo bez koncovej samohlásky, aby sedeli pády. */
export function kmenMena(meno: string): string {
  const slova = normalizuj(meno).trim().split(/\s+/);
  const posledne = slova.pop() ?? "";
  const kmen = posledne.length >= 4 ? posledne.replace(/[aeiouy]$/, "") : posledne;
  return [...slova, kmen].join(" ");
}

/** Meno kratšie ako 4 písmená (napr. „Dlh“) by sa našlo v každom texte — vynechá sa. */
const MIN_DLZKA = 4;

/**
 * Karty, ktoré boli v niektorej zverejnenej sade alebo v konfigurácii, ale
 * v rozpracovanej sade nie sú. Kmeň zhodný s kmeňom živej karty sa vynechá —
 * zmienka by mohla patriť jej.
 */
export function zaniknuteKarty(historicke: readonly string[], aktualne: readonly string[]): string[] {
  const zive = new Set(aktualne.map(kmenMena));
  const out = new Map<string, string>();
  for (const meno of historicke) {
    const kmen = kmenMena(meno);
    if (kmen.replace(/\s/g, "").length < MIN_DLZKA || zive.has(kmen) || out.has(kmen)) continue;
    out.set(kmen, meno.trim());
  }
  return [...out.values()].sort((a, b) => a.localeCompare(b, "sk"));
}

export function hladane(konf: KonfiguraciaZastaranych, zaniknute: readonly string[]): Hladane[] {
  const karty = zaniknute.map((meno): Hladane => ({
    pojem: meno,
    druh: "karta",
    re: new RegExp(`(?<![a-z0-9])${escape(kmenMena(meno)).replace(/ /g, "\\s+")}[a-z]{0,4}(?![a-z0-9])`, "g"),
  }));
  const mechaniky = konf.mechaniky.map((m): Hladane => ({
    pojem: m.pojem,
    druh: "mechanika",
    re: new RegExp(m.vzory.map((v) => `(?<![a-z0-9])(?:${v.replace(/ /g, "\\s+")})`).join("|"), "g"),
  }));
  return [...karty, ...mechaniky];
}

/** Zmienky v texte, najčastejšie prvé; prázdne = nič zastarané. */
export function zmienky(text: string, co: readonly Hladane[]): Zmienka[] {
  const t = normalizuj(text);
  const out: Zmienka[] = [];
  for (const h of co) {
    const pocet = t.match(h.re)?.length ?? 0;
    if (pocet > 0) out.push({ pojem: h.pojem, druh: h.druh, pocet });
  }
  return out.sort((a, b) => b.pocet - a.pocet || a.pojem.localeCompare(b.pojem, "sk"));
}

/** Text HTML reportu bez značiek, skriptov a štýlov. */
export function textZHtml(html: string): string {
  return html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)));
}

/** Prvá veta (najviac 100 znakov) — do zoznamu kandidátov. */
export function prvaVeta(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  const veta = /^(.+?[.!?])(\s|$)/.exec(t)?.[1] ?? t;
  return veta.length > 100 ? `${veta.slice(0, 99)}…` : veta;
}

export const popisZmienok = (z: readonly Zmienka[]): string => z.map((x) => `${x.pojem}${x.pocet > 1 ? ` ×${x.pocet}` : ""}`).join(", ");
