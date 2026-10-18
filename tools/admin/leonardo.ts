// Generovanie ilustrácií cez Leonardo.Ai API (kľúč NAEX_LEONARDO_KEY v .env).
// API sa platí z vlastného kreditu (pay-as-you-go), nie z webového predplatného —
// preto tvrdé limity na kartu a záznam o každom kole aj s cenou.
//
// Postup podľa docs.leonardo.ai: referenčné obrázky sa nahrajú cez presigned URL
// (POST /v1/init-image), generuje sa cez POST /v2/generations (model Nano Banana)
// a výsledok sa čaká cez GET /v1/generations/<id>.

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { setTimeout as cakaj } from "node:timers/promises";

const API = "https://cloud.leonardo.ai/api/rest";

/** Model tlačovej sady (Nano Banana) — v API sa volá takto. */
export const MODEL_API = "gemini-2.5-flash-image";

/** Najviac obrázkov v jednom kole a kôl na kartu bez súhlasu Michala. */
export const MAX_OBRAZKOV_V_KOLE = 2;
export const MAX_KOL_NA_KARTU = 3;

export type Sila = "LOW" | "MID" | "HIGH";

export interface Zadanie {
  readonly prompt: string;
  readonly kategoria: string;
  readonly referencie: readonly string[];
}

export interface Kolo {
  readonly kolo: number;
  readonly cas: string;
  readonly generationId: string;
  readonly pocet: number;
  readonly sila: Sila;
  readonly cena: string | null;
  readonly subory: readonly string[];
}

interface Zaznam {
  readonly kola: readonly Kolo[];
}

function kluc(): string {
  const k = process.env.NAEX_LEONARDO_KEY;
  if (k === undefined || k.trim() === "") throw new Error("Chýba NAEX_LEONARDO_KEY v .env (API kľúč z app.leonardo.ai → API).");
  return k.trim();
}

async function leonardo<T>(metoda: string, cesta: string, telo?: unknown): Promise<T> {
  const r = await fetch(`${API}${cesta}`, {
    method: metoda,
    headers: {
      accept: "application/json",
      authorization: `Bearer ${kluc()}`,
      ...(telo === undefined ? {} : { "content-type": "application/json" }),
    },
    body: telo === undefined ? null : JSON.stringify(telo),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`Leonardo ${metoda} ${cesta}: ${r.status} ${t.slice(0, 400)}`);
  return JSON.parse(t) as T;
}

// ---- referencie --------------------------------------------------------------------

// Nahraté referencie si pamätáme (id v Leonarde), aby sa každá tlačová ilustrácia
// nahrávala len raz. Kľúč zahŕňa veľkosť a čas zmeny — nový súbor = nové nahratie.
const CACHE = (pracovny: string): string => join(pracovny, "leonardo-referencie.json");

function citajCache(pracovny: string): Record<string, string> {
  try {
    return JSON.parse(readFileSync(CACHE(pracovny), "utf8")) as Record<string, string>;
  } catch {
    return {};
  }
}

async function nahrajReferenciu(subor: string, pracovny: string): Promise<string> {
  const s = statSync(subor);
  const k = `${basename(subor)}|${s.size}|${Math.round(s.mtimeMs)}`;
  const cache = citajCache(pracovny);
  const zname = cache[k];
  if (zname !== undefined) return zname;

  const pripona = extname(subor).slice(1).toLowerCase().replace("jpeg", "jpg");
  const { uploadInitImage: u } = await leonardo<{ uploadInitImage: { id: string; url: string; fields: string } }>(
    "POST",
    "/v1/init-image",
    { extension: pripona },
  );
  const form = new FormData();
  for (const [meno, hodnota] of Object.entries(JSON.parse(u.fields) as Record<string, string>)) form.append(meno, hodnota);
  form.append("file", new Blob([new Uint8Array(readFileSync(subor))]), basename(subor));
  // Presigned URL nesmie dostať autorizačnú hlavičku.
  const r = await fetch(u.url, { method: "POST", body: form });
  if (!r.ok) throw new Error(`Nahratie referencie ${subor}: ${r.status} ${(await r.text()).slice(0, 300)}`);

  mkdirSync(pracovny, { recursive: true });
  writeFileSync(CACHE(pracovny), `${JSON.stringify({ ...cache, [k]: u.id }, null, 2)}\n`);
  return u.id;
}

// ---- záznam kôl --------------------------------------------------------------------

const ZAZNAM = (adr: string): string => join(adr, "leonardo.json");

export function nacitajZaznam(adr: string): Zaznam {
  try {
    return JSON.parse(readFileSync(ZAZNAM(adr), "utf8")) as Zaznam;
  } catch {
    return { kola: [] };
  }
}

export function nacitajZadanie(adr: string): Zadanie {
  const f = join(adr, "zadanie.json");
  if (!existsSync(f)) throw new Error(`Chýba ${f} — najprv: admin.ts prompt <id> "<námet>"`);
  return JSON.parse(readFileSync(f, "utf8")) as Zadanie;
}

/** Cena z odpovede — API ju vracia ako { amount, unit } (pri PAYG v dolároch). */
function cenaZ(o: unknown): string | null {
  if (o === null || typeof o !== "object") return null;
  const c = (o as { cost?: { amount?: unknown; unit?: unknown } }).cost;
  if (c !== undefined && c.amount !== undefined) return `${String(c.amount)} ${String(c.unit ?? "")}`.trim();
  for (const v of Object.values(o)) {
    const z = cenaZ(v);
    if (z !== null) return z;
  }
  return null;
}

// ---- generovanie -------------------------------------------------------------------

export async function generuj(moznosti: {
  readonly id: string;
  readonly adr: string;
  readonly pracovny: string;
  readonly pocet: number;
  readonly sila: Sila;
  readonly navyse: boolean;
  readonly seed?: number;
}): Promise<Kolo> {
  const { id, adr, pracovny, pocet, sila, navyse } = moznosti;
  if (!Number.isInteger(pocet) || pocet < 1 || pocet > MAX_OBRAZKOV_V_KOLE) {
    throw new Error(`--pocet musí byť 1 až ${MAX_OBRAZKOV_V_KOLE}.`);
  }
  const zaznam = nacitajZaznam(adr);
  if (zaznam.kola.length >= MAX_KOL_NA_KARTU && !navyse) {
    throw new Error(
      `Karta ${id} má už ${zaznam.kola.length} kolá generovania (limit ${MAX_KOL_NA_KARTU}). ` +
        "Ďalšie len so súhlasom Michala (--navyse).",
    );
  }
  const zadanie = nacitajZadanie(adr);

  const refs: { image: { id: string; type: "UPLOADED" }; strength: Sila }[] = [];
  for (const r of zadanie.referencie) {
    if (!existsSync(r)) throw new Error(`Referencia ${r} neexistuje.`);
    refs.push({ image: { id: await nahrajReferenciu(r, pracovny), type: "UPLOADED" }, strength: sila });
  }

  const odp = await leonardo<{ generate?: { generationId?: string } }>("POST", "/v2/generations", {
    model: MODEL_API,
    parameters: {
      width: 1024,
      height: 1024,
      prompt: zadanie.prompt,
      quantity: pocet,
      ...(moznosti.seed === undefined ? {} : { seed: moznosti.seed }),
      ...(refs.length === 0 ? {} : { guidances: { image_reference: refs } }),
      prompt_enhance: "OFF",
    },
    public: false,
  });
  const generationId = odp.generate?.generationId;
  if (generationId === undefined) throw new Error(`Leonardo nevrátil generationId: ${JSON.stringify(odp).slice(0, 400)}`);
  const cena = cenaZ(odp);

  // Čakanie: Nano Banana zvyčajne do minúty; dlhšie než 4 min je chyba.
  let urls: string[] = [];
  for (let i = 0; i < 48; i++) {
    await cakaj(5000);
    const g = await leonardo<{ generations_by_pk: { status: string; generated_images: { url: string }[] } | null }>(
      "GET",
      `/v1/generations/${generationId}`,
    );
    const s = g.generations_by_pk?.status;
    if (s === "FAILED") throw new Error(`Generovanie ${generationId} zlyhalo.`);
    if (s === "COMPLETE") {
      urls = (g.generations_by_pk?.generated_images ?? []).map((x) => x.url);
      break;
    }
  }
  if (urls.length === 0) throw new Error(`Generovanie ${generationId} nedobehlo do 4 minút — skús neskôr: GET /v1/generations/${generationId}.`);

  const kolo = zaznam.kola.length + 1;
  const subory: string[] = [];
  for (const [i, u] of urls.entries()) {
    const r = await fetch(u);
    if (!r.ok) throw new Error(`Stiahnutie ${u}: ${r.status}`);
    const pripona = extname(new URL(u).pathname) || ".jpg";
    const f = join(adr, `kolo${kolo}-${i + 1}${pripona}`);
    writeFileSync(f, new Uint8Array(await r.arrayBuffer()));
    subory.push(f);
  }

  const novy: Kolo = { kolo, cas: new Date().toISOString(), generationId, pocet, sila, cena, subory };
  writeFileSync(ZAZNAM(adr), `${JSON.stringify({ kola: [...zaznam.kola, novy] }, null, 2)}\n`);
  return novy;
}
