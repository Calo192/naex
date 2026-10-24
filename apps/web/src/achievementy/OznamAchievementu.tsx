// Oznam získaného achievementu v partii (Michal 2026-10-23, ukážka dizajn-achievementy):
// malá pilulka v pravom hornom rohu stola — podtácok 48 px, názov a rank. Pribehne,
// o pár sekúnd odíde a nič neblokuje (pointer-events: none). Viac ziskov ide po sebe.

import { useEffect, useRef, useState } from "react";
import { NAZOV_RANKU, Podtacok, type RankPodtacka } from "./Podtacok.tsx";
import "./podtacok.css";

/** Ako dlho je jeden oznam na stole. */
const NA_STOLE_MS = 4_000;

export interface ZiskVOzname {
  /** Jedinečný kľúč zisku (id achievementu + rank). */
  readonly kluc: string;
  /** Id achievementu — vyšší rank toho istého v rade nahradí nižší, čo ešte nebol na stole. */
  readonly id?: string;
  readonly nazov: string;
  readonly rank: RankPodtacka;
  readonly tajny: boolean;
  readonly ikona: string | null;
  readonly obrazok: string | null;
}

export function OznamAchievementu({ zisky }: { readonly zisky: readonly ZiskVOzname[] }) {
  // Rad: zisky, ktoré ešte neboli ukázané, idú po jednom.
  const ukazane = useRef(new Set<string>());
  const [rad, setRad] = useState<readonly ZiskVOzname[]>([]);
  useEffect(() => {
    const nove = zisky.filter((z) => !ukazane.current.has(z.kluc));
    if (nove.length === 0) return;
    for (const z of nove) ukazane.current.add(z.kluc);
    setRad((r) => {
      let out = [...r];
      for (const z of nove) {
        // Prvý v rade je práve na stole — ten ostáva; čakajúci nižší rank toho istého zmizne.
        out = out.filter((x, i) => i === 0 || z.id === undefined || x.id !== z.id);
        out.push(z);
      }
      return out;
    });
  }, [zisky]);
  const teraz = rad[0];
  useEffect(() => {
    if (teraz === undefined) return;
    const t = setTimeout(() => setRad((r) => r.slice(1)), NA_STOLE_MS);
    return () => clearTimeout(t);
  }, [teraz?.kluc]);
  if (teraz === undefined) return null;
  const hviezdy = teraz.rank === "zlato" ? "★★★" : teraz.rank === "striebro" ? "★★" : "★";
  return (
    <div className="oznam-achievementu" role="status" aria-live="polite" key={teraz.kluc}>
      <Podtacok rank={teraz.rank} ikona={teraz.ikona} obrazok={teraz.obrazok} nazov={teraz.nazov} ziskany tajny={false} velkost={48} />
      <div>
        <b>{teraz.nazov}</b>
        <span>
          {teraz.tajny ? "tajný achievement" : "achievement"} · {NAZOV_RANKU[teraz.rank]} {hviezdy}
          {rad.length > 1 && <> · ďalšie {rad.length - 1}</>}
        </span>
      </div>
    </div>
  );
}
