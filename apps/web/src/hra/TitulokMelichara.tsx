// Titulok práve znejúcej hlášky majstra Melichara (lokalizácia, Michal 2026-11-10): hlášky
// ostávajú zvukom po slovensky, hráč v inom jazyku pod nimi číta titulok. Po slovensky sa text
// neukazuje (Michal 2026-10-22). Titulky píše prekladateľ do apps/web/src/i18n/melichar/<jazyk>.json,
// kľúč „skupina/súbor“ — priečinok a meno súboru hlášky bez prípony (data/majster_melichar).

import { useEffect, useState, useSyncExternalStore } from "react";
import { aktualnyJazyk, useJazyk, type Jazyk } from "../i18n/jazyk.tsx";
import { odoberTitulky, praveZnie, textTitulku, type Titulky } from "./titulky.ts";
import "./titulok-melichara.css";

const SUBORY: Readonly<Record<Exclude<Jazyk, "sk">, () => Promise<{ default: Titulky }>>> = {
  en: () => import("../i18n/melichar/en.json"),
  pl: () => import("../i18n/melichar/pl.json"),
  cs: () => import("../i18n/melichar/cs.json"),
  hu: () => import("../i18n/melichar/hu.json"),
};

const nacitane = new Map<Jazyk, Promise<Titulky | null>>();
function titulkyJazyka(j: Jazyk): Promise<Titulky | null> {
  if (j === "sk") return Promise.resolve(null);
  let p = nacitane.get(j);
  if (p === undefined) {
    p = SUBORY[j]().then((m): Titulky | null => m.default, () => null);
    nacitane.set(j, p);
  }
  return p;
}

export function TitulokMelichara() {
  const jazyk = useJazyk();
  const kluc = useSyncExternalStore(odoberTitulky, praveZnie);
  const [titulky, setTitulky] = useState<Titulky | null>(null);
  useEffect(() => {
    let zive = true;
    void titulkyJazyka(jazyk).then((x) => {
      if (zive && aktualnyJazyk() === jazyk) setTitulky(x);
    });
    return () => {
      zive = false;
    };
  }, [jazyk]);
  const text = textTitulku(titulky, kluc);
  if (text === null) return null;
  return (
    <p className="mel-titulok" lang={jazyk} aria-live="polite">
      {text}
    </p>
  );
}
