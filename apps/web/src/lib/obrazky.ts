// Úprava obrázkov v prehliadači (server nemá knižnicu na obrázky): orez na
// štvorec a zmenšenie cez <canvas>, výstup JPEG.

export async function nacitajObrazok(zdroj: Blob | string): Promise<HTMLImageElement> {
  const url = typeof zdroj === "string" ? zdroj : URL.createObjectURL(zdroj);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    if (typeof zdroj !== "string") setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/**
 * Celý obrázok zmenšený tak, aby dlhšia strana mala najviac `strana` px —
 * náhľad na zobrazenie (Michal 2026-10-22). WebP, ak ho prehliadač vie
 * zapísať (inak by vrátil PNG — väčšie), inak JPEG.
 */
export async function zmensene(img: HTMLImageElement, strana: number, kvalita = 0.8): Promise<Blob> {
  const mierka = Math.min(1, strana / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * mierka));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * mierka));
  const ctx = canvas.getContext("2d");
  if (ctx === null) throw new Error("Prehliadač nevie kresliť do canvasu.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const doBlobu = (typ: string): Promise<Blob | null> => new Promise((resolve) => canvas.toBlob(resolve, typ, kvalita));
  const webp = await doBlobu("image/webp");
  if (webp !== null && webp.type === "image/webp") return webp;
  const jpeg = await doBlobu("image/jpeg");
  if (jpeg === null) throw new Error("Obrázok sa nepodarilo uložiť.");
  return jpeg;
}

/**
 * Štvorcový výrez (stred, alebo zadaný posun 0..1) zmenšený na `strana` px.
 * Menší obrázok sa nezväčšuje.
 */
export async function stvorec(img: HTMLImageElement, strana: number, posun = { x: 0.5, y: 0.5 }, kvalita = 0.86): Promise<Blob> {
  const s = Math.min(img.naturalWidth, img.naturalHeight);
  const ciel = Math.min(strana, s);
  const sx = (img.naturalWidth - s) * posun.x;
  const sy = (img.naturalHeight - s) * posun.y;
  const canvas = document.createElement("canvas");
  canvas.width = ciel;
  canvas.height = ciel;
  const ctx = canvas.getContext("2d");
  if (ctx === null) throw new Error("Prehliadač nevie kresliť do canvasu.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, s, s, 0, 0, ciel, ciel);
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b === null ? reject(new Error("Obrázok sa nepodarilo uložiť.")) : resolve(b)), "image/jpeg", kvalita),
  );
}
