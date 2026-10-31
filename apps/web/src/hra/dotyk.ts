// Texty stola na dotyku (telefón na šírku): ťuk namiesto kliku.

/** Pokyn na dotyku (telefón na šírku): ťuk namiesto kliku. */
export function preDotyk(text: string): string {
  return text
    .replace(/\bKlikni\b/g, "Ťukni")
    .replace(/\bklikni\b/g, "ťukni")
    .replace(/\bKlikom\b/g, "Ťukom")
    .replace(/\bklikom\b/g, "ťukom")
    .replace(/\bklik\b/g, "ťuk");
}
