// Ako sa akcie zmestia do strán baru (Michal 2026-11-06: hráč môže aktivovať všetkých 13).
// Pevné poradie ústupkov podľa skutočnej šírky: jeden rad → dva rady menších piktogramov →
// stred bez slov → čo sa nezmestí ani tak, zbalí sa do „+N“ pri strede. Stred akcie
// neprekrýva a výška baru sa nemení, aby stôl neposkočil.

function pretecie(el: HTMLElement): boolean {
  return el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
}

/** Vráti obe strany do základu; po vykreslení React tieto značky sám neupraví. */
function vratDoZakladu(bar: HTMLElement, strany: readonly HTMLElement[]): void {
  bar.querySelector<HTMLElement>(".jbar-stred")?.removeAttribute("data-uzky");
  for (const a of strany) {
    a.removeAttribute("data-husto");
    for (const c of a.querySelectorAll<HTMLElement>(":scope > .efekt")) c.hidden = c.classList.contains("jbar-vic");
  }
}

function zbalDoVic(a: HTMLElement): void {
  const vic = a.querySelector<HTMLElement>(":scope > .jbar-vic");
  if (vic === null) return;
  const cipy = [...a.querySelectorAll<HTMLElement>(":scope > .efekt:not(.jbar-vic)")];
  const skryte: string[] = [];
  vic.hidden = false;
  while (pretecie(a) && cipy.length > 1) {
    const c = cipy.pop();
    if (c === undefined) break;
    c.hidden = true;
    skryte.unshift(c.dataset.nazov ?? "");
    vic.textContent = `+${skryte.length}`;
    vic.title = skryte.filter((n) => n !== "").join(", ");
  }
  if (skryte.length === 0) vic.hidden = true;
}

export function rozmiestniAkcie(bar: HTMLElement): void {
  const strany = [...bar.querySelectorAll<HTMLElement>(".jbar-strana > .jbar-akcie")];
  // Keď hovorí Melichar, riadok je skrytý a nedá sa merať.
  if (strany.length === 0 || strany[0]?.offsetParent === null) return;
  vratDoZakladu(bar, strany);
  for (const a of strany) if (pretecie(a)) a.setAttribute("data-husto", "");
  if (strany.some(pretecie)) bar.querySelector<HTMLElement>(".jbar-stred")?.setAttribute("data-uzky", "");
  for (const a of strany) if (pretecie(a)) zbalDoVic(a);
}
