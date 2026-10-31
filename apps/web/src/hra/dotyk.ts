// Texty stola na dotyku (telefón na šírku): ťuk namiesto kliku, bez pravého kliku a Esc.

import { Children, Fragment, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";

/** Pokyn na dotyku (telefón na šírku): ťuk namiesto kliku; pravý klik ani Esc telefón nemá. */
export function preDotyk(text: string): string {
  return (
    text
      // Zátvorky a dovetky, ktoré hovoria len o myši a klávesnici, vypadnú celé.
      .replace(/\s*\((?:alebo |aj )?pravý klik[^)]*\)/g, "")
      .replace(/\s*\((?:aj )?Esc[^)]*\)/g, "")
      .replace(/,?\s*(?:alebo|či) Esc\b/g, "")
      .replace(/,?\s*(?:alebo |či )?(?:pravým klikom|pravý klik)(?=[.,)]|$)/g, "")
      .replace(/\bpravým klikom\b/g, "ťukom")
      .replace(/\bpravý klik\b/g, "ťuk")
      .replace(/\bKlikni\b/g, "Ťukni")
      .replace(/\bklikni\b/g, "ťukni")
      .replace(/\bKlikom\b/g, "Ťukom")
      .replace(/\bklikom\b/g, "ťukom")
      .replace(/\bklik\b/g, "ťuk")
  );
}

/**
 * Pokyn na dotyku aj keď je to JSX: prepíše texty v prvkoch (strong, span…), do komponentov
 * nevojde — tie si texty pre dotyk riešia samy.
 */
export function preDotykUzol(uzol: ReactNode): ReactNode {
  if (typeof uzol === "string") return preDotyk(uzol);
  if (Array.isArray(uzol)) return Children.map(uzol, preDotykUzol);
  if (!isValidElement(uzol) || (typeof uzol.type !== "string" && uzol.type !== Fragment)) return uzol;
  const el = uzol as ReactElement<{ readonly children?: ReactNode }>;
  if (el.props.children === undefined) return el;
  return cloneElement(el, undefined, ...Children.toArray(el.props.children).map(preDotykUzol));
}
