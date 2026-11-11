// Dlhé texty v jazyku hráča (lokalizácia, vlna 3c): kapitoly pravidiel, slovník pojmov,
// výučba Prvá hra, nápovedy Melichara a achievementy. Sú dlhé a čítajú sa zriedka, preto nie
// sú v sk.json (hlavný balík), ale v samostatných súboroch po oblastiach (i18n/<oblasť>/<jazyk>.json),
// ktoré sa načítajú, až keď ich hráč v inom jazyku potrebuje.
//
// Tvar ako preklad kariet (docs/preklady/karty): pri každom preklade je slovenský originál, z ktorého
// vznikol — { id: { pole: preklad, sk: { pole: originál } } }. Preklad platí, len kým sa slovenský
// text nezmenil; zastaraný ostane po slovensky, kým ho prekladateľ neopraví. Zdroj sk.json oblasti
// je { id: { pole: text } }; pri výučbe, nápovedách a achievementoch ho tools/preklady/dorovnaj.ts
// vytiahne z dát jadra (test stráži, že sedí). Čisté funkcie — žiadny prehliadač ani React.

/** Zdroj oblasti: id → pole → slovenský text. */
export type ZdrojDlhych = Readonly<Record<string, Readonly<Record<string, string>>>>;

/** Preklad jedného id: polia s prekladom a pod `sk` originály, z ktorých vznikli. */
export type PolozkaPrekladu = Readonly<Record<string, unknown>> & { readonly sk?: Readonly<Record<string, string>> };
export type SuborDlhych = Readonly<Record<string, PolozkaPrekladu>>;

export const OBLASTI = ["pravidla", "pojmy", "vyucba", "napovedy", "achievementy"] as const;
export type Oblast = (typeof OBLASTI)[number];

const neprazdny = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";

/**
 * Preklad poľa id: preklad, ktorého originál je presne `sk`; inak `sk`. Keď pole nesedí (scenár
 * prečísloval možnosti, odsek pribudol), hľadá sa ten istý originál v inom poli toho istého id.
 */
export function prelozDlhy(subor: SuborDlhych | null, id: string, pole: string | null, sk: string): string {
  const p = subor?.[id];
  if (p === undefined || p.sk === undefined) return sk;
  if (pole !== null && p.sk[pole] === sk && neprazdny(p[pole])) return p[pole];
  for (const [k, v] of Object.entries(p.sk)) if (v === sk && neprazdny(p[k])) return p[k];
  // Text s dosadenými hodnotami (popis achievementu „aspoň 12“ zo vzoru „aspoň {prah}“).
  const vzor = pole === null ? undefined : p.sk[pole];
  const preklad = pole === null ? undefined : p[pole];
  if (vzor === undefined || !vzor.includes("{") || !neprazdny(preklad)) return sk;
  const mena: string[] = [];
  const re = new RegExp(
    `^${vzor.replace(/\{([\p{L}\p{N}_]+)\}|[.*+?^${}()|[\]\\]/gu, (m: string, meno: string | undefined) => {
      if (meno === undefined) return `\\${m}`;
      mena.push(meno);
      return "(.+?)";
    })}$`,
    "u",
  );
  const m = re.exec(sk);
  if (m === null) return sk;
  return preklad.replace(/\{([\p{L}\p{N}_]+)\}/gu, (cely: string, meno: string) => {
    const i = mena.indexOf(meno);
    return i === -1 ? cely : (m[i + 1] ?? cely);
  });
}

/** Polia oblasti id → pole → text bez prázdnych (prázdny text sa neprekladá). */
function pridaj(out: Record<string, Record<string, string>>, id: string, pole: string, text: string | undefined | null): void {
  if (typeof text !== "string" || text.trim() === "") return;
  (out[id] ??= {})[pole] = text;
}

interface KrokDat {
  readonly id: string;
  readonly melichar?: string;
  readonly tlacidlo?: string;
  readonly moznosti?: readonly { readonly text: string; readonly vysvetlenie: string }[];
  readonly volba?: { readonly zle?: readonly { readonly text: string }[]; readonly inak: string };
}

/** Texty výučby (prva-hra.json): časti, Melichar, nápis tlačidla, otázky a rady pri zlom ťahu. */
export function textyVyucby(scenar: { readonly casti?: readonly { readonly cast: number; readonly nazov: string }[]; readonly kroky: readonly KrokDat[] }): ZdrojDlhych {
  const out: Record<string, Record<string, string>> = {};
  for (const c of scenar.casti ?? []) pridaj(out, `cast-${c.cast}`, "nazov", c.nazov);
  for (const k of scenar.kroky) {
    pridaj(out, k.id, "melichar", k.melichar);
    pridaj(out, k.id, "tlacidlo", k.tlacidlo);
    k.moznosti?.forEach((m, i) => {
      pridaj(out, k.id, `moznost.${i + 1}`, m.text);
      pridaj(out, k.id, `vysvetlenie.${i + 1}`, m.vysvetlenie);
    });
    k.volba?.zle?.forEach((z, i) => pridaj(out, k.id, `zle.${i + 1}`, z.text));
    pridaj(out, k.id, "inak", k.volba?.inak);
  }
  return out;
}

/** Texty nápoved (napovedy.json): jeden text, alebo text podľa variantu spúšťača. */
export function textyNapovied(katalog: { readonly napovedy: readonly { readonly id: string; readonly melichar: string | Readonly<Record<string, string>> }[] }): ZdrojDlhych {
  const out: Record<string, Record<string, string>> = {};
  for (const n of katalog.napovedy) {
    if (typeof n.melichar === "string") pridaj(out, n.id, "melichar", n.melichar);
    else for (const [v, text] of Object.entries(n.melichar)) pridaj(out, n.id, `melichar.${v}`, text);
  }
  return out;
}

/** Texty achievementov (achievementy.json): kategórie, názov, popis s {prah} a text tajného. */
export function textyAchievementov(data: {
  readonly kategorie: readonly { readonly id: string; readonly nazov: string }[];
  readonly achievementy: readonly { readonly id: string; readonly nazov: string; readonly popis: string; readonly tajnyText?: string | null }[];
}): ZdrojDlhych {
  const out: Record<string, Record<string, string>> = {};
  for (const k of data.kategorie) pridaj(out, `kategoria.${k.id}`, "nazov", k.nazov);
  for (const a of data.achievementy) {
    pridaj(out, a.id, "nazov", a.nazov);
    pridaj(out, a.id, "popis", a.popis);
    pridaj(out, a.id, "tajnyText", a.tajnyText);
  }
  return out;
}

/**
 * Preklad oblasti dorovnaný na zdroj: id a polia v poradí zdroja, nové prázdne, zmiznuté preč.
 * Hotový preklad si nechá originál, z ktorého vznikol (zastaraný sa tak dá nájsť); prázdny
 * dostane aktuálny originál.
 */
export function dorovnajDlhe(zdroj: ZdrojDlhych, stary: SuborDlhych): { readonly subor: Record<string, unknown>; readonly zastarane: readonly string[] } {
  const subor: Record<string, unknown> = {};
  const zastarane: string[] = [];
  for (const [k, v] of Object.entries(stary)) if (k.startsWith("_")) subor[k] = v;
  for (const [id, polia] of Object.entries(zdroj)) {
    const s = stary[id];
    const novy: Record<string, unknown> = {};
    const sk: Record<string, string> = {};
    for (const [pole, text] of Object.entries(polia)) {
      const preklad = s?.[pole];
      const povodny = s?.sk?.[pole];
      if (neprazdny(preklad)) {
        novy[pole] = preklad;
        sk[pole] = povodny ?? text;
        if (povodny !== text) zastarane.push(`${id}.${pole}`);
      } else {
        novy[pole] = "";
        sk[pole] = text;
      }
    }
    subor[id] = { ...novy, sk };
  }
  return { subor, zastarane };
}
