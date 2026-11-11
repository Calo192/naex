import { t } from "../i18n/jazyk.tsx";
// Sľub dĺžky výučby na titulke (Michal 2026-11-10): z casti[].minuty scenára, aby po prestavbe
// časti nestál na titulke starý čas.

export function dlzkaVyucby(casti: readonly { readonly minuty: number }[]): string {
  const n = casti.length;
  const kolko = n >= 1 && n <= 4 ? t(`domov.casti${n}`) : t("domov.castiN", { n });
  return t("domov.dlzkaVyucby", { kolko, minuty: casti.reduce((s, c) => s + c.minuty, 0) });
}
