// Kedy hráč naposledy videl Novinky — pre značku „nové“ na stránke aj počet
// v navigácii. Prihlásenému to pamätá server, návštevníkovi prehliadač.

const KLUC_VIDENE = "naex.novinkyVidene";

/** Udalosť na window — hráč klikol „Mám prečítané“, značka v navigácii zhasne. */
export const NOVINKY_VIDENE = "naex:novinky-videne";

/** Čas najnovšej videnej novinky; null = prvá návšteva alebo bez úložiska. */
export function citajVidene(): number | null {
  try {
    const v = Number(localStorage.getItem(KLUC_VIDENE));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

export function ulozVidene(cas: number): void {
  try {
    localStorage.setItem(KLUC_VIDENE, String(cas));
  } catch {
    // Súkromné okno či zakázané úložisko — značka „nové“ len nebude fungovať.
  }
}
