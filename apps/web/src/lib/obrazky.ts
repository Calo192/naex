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
