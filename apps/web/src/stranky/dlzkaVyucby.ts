// Sľub dĺžky výučby na titulke (Michal 2026-11-10): z casti[].minuty scenára, aby po prestavbe
// časti nestál na titulke starý čas.

export function dlzkaVyucby(casti: readonly { readonly minuty: number }[]): string {
  const n = casti.length;
  const kolko = n === 1 ? "jedna časť" : n >= 2 && n <= 4 ? `${["dve", "tri", "štyri"][n - 2]} časti` : `${n} častí`;
  return `${kolko}, spolu asi ${casti.reduce((s, c) => s + c.minuty, 0)} minút`;
}
