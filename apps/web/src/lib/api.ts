// Volania REST API. Každá zmena nesie hlavičku X-Naex (ochrana pred CSRF —
// server bez nej zmenu odmietne).

export class ChybaApi extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function volaj<T>(metoda: string, cesta: string, telo?: unknown, typ?: string): Promise<T> {
  const headers: Record<string, string> = { "x-naex": "1" };
  let body: BodyInit | null = null;
  if (telo instanceof Blob || telo instanceof ArrayBuffer) {
    body = telo;
    headers["content-type"] = typ ?? (telo instanceof Blob ? telo.type : "application/octet-stream");
  } else if (typeof telo === "string" && typ !== undefined) {
    body = telo;
    headers["content-type"] = typ;
  } else if (telo !== undefined) {
    body = JSON.stringify(telo);
    headers["content-type"] = "application/json";
  }
  const res = await fetch(`/api${cesta}`, { method: metoda, headers, body, credentials: "same-origin" });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text === "" ? null : (JSON.parse(text) as unknown);
  } catch {
    data = text;
  }
  if (!res.ok) {
    const chyba = (data as { chyba?: string } | null)?.chyba ?? `Chyba ${res.status}`;
    throw new ChybaApi(chyba, res.status);
  }
  return data as T;
}

export const api = {
  get: <T>(cesta: string) => volaj<T>("GET", cesta),
  post: <T>(cesta: string, telo?: unknown, typ?: string) => volaj<T>("POST", cesta, telo, typ),
  put: <T>(cesta: string, telo?: unknown, typ?: string) => volaj<T>("PUT", cesta, telo, typ),
  patch: <T>(cesta: string, telo?: unknown) => volaj<T>("PATCH", cesta, telo),
  del: <T>(cesta: string) => volaj<T>("DELETE", cesta),
};

/**
 * `nahlad` = menšia kópia na zobrazenie, ak ju obrázok má (server ju vyberie;
 * inak pošle originál). Lupa a tlač berú originál.
 */
export const mediaUrl = (id: string, nahlad = false): string => `/media/${id}${nahlad ? "?n" : ""}`;
