// Výber súpera proti počítaču (Michal 2026-11-06). Zoznam povah posiela server
// (/api/hry/otvorene, z POVAHY) a zvolené id pri založení overí sám — tu sa len kreslí.

export interface BotNaVyber {
  readonly id: string;
  readonly meno: string;
  /** Veta o štýle; povaha bez nej sa ukáže len s menom. */
  readonly popis: string | null;
  readonly avatar: string | null;
}

/**
 * Voľba, ktorá sa pošle pri založení: null = Náhodný. Povaha, ktorú server medzitým
 * prestal ponúkať (nasadenie počas čakania v lobby), sa vráti na Náhodného.
 */
export function platnaVolbaBota(boti: readonly BotNaVyber[], volba: string | null): string | null {
  return boti.some((b) => b.id === volba) ? volba : null;
}

/** Klik na dlaždicu bota: označí ho; klik na už označeného vráti Náhodného (null). */
export function prepniVolbuBota(volba: string | null, id: string): string | null {
  return volba === id ? null : id;
}
