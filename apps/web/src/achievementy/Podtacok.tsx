// Achievement ako pivný podtácok (Michal 2026-10-23, ukážka dizajn-achievementy-20261023-1500):
// kartónový kruh s vrúbkovaným okrajom, kovový prstenec farby ranku, v strede piktogram
// z hry a hviezdičky podľa ranku (bronz 1, striebro 2, zlato 3). Nezískaný je sivý,
// tajný „???“. Názov po obvode len vo veľkých veľkostiach (88 px a viac).

import { useId } from "react";
import { PRIESVITNOST_PODKLADU, cestyStrachu } from "../hra/tvaryStrachu.ts";
import { IKONY } from "../karta/ikony.ts";
import "./podtacok.css";

export type RankPodtacka = "bronz" | "striebro" | "zlato";

const FARBY: Readonly<Record<RankPodtacka | "tajny", { readonly okraj: string; readonly svetly: string; readonly tmavy: string }>> = {
  bronz: { okraj: "#b06a34", svetly: "#e0a06a", tmavy: "#6e3d17" },
  striebro: { okraj: "#9aa3ab", svetly: "#e4e9ee", tmavy: "#5b636b" },
  zlato: { okraj: "#d4a017", svetly: "#ffe08a", tmavy: "#8a6208" },
  tajny: { okraj: "#6b6359", svetly: "#9a9086", tmavy: "#3f3933" },
};

/** Zónové podmienky kreslí podtácok výkričníkmi z hry (mriežka 100 ako piktogramy akcií), nie nahratou ikonou. */
const IKONY_STRACHU: Readonly<Record<string, readonly { d: string; evenOdd: boolean; podklad?: boolean }[]>> = {
  "podmienka:znepokojenie": cestyStrachu(1, 100 / 24),
  "podmienka:strach": cestyStrachu(2, 100 / 24),
  "podmienka:vydesenie": cestyStrachu(3, 100 / 24),
};

export const HVIEZDY_RANKU: Readonly<Record<RankPodtacka, number>> = { bronz: 1, striebro: 2, zlato: 3 };
export const NAZOV_RANKU: Readonly<Record<RankPodtacka, string>> = { bronz: "bronz", striebro: "striebro", zlato: "zlato" };

/** Od tejto veľkosti je nápis po obvode čitateľný (Michal: 120 a 88 px áno, 48 a 32 nie). */
const NAPIS_OD = 80;

/** Vrúbkovaný okraj — 48 zúbkov (rovnaký pre všetky podtácky, počíta sa raz). */
const OKRAJ = (() => {
  const zuby = 48;
  let d = "";
  for (let i = 0; i <= zuby * 2; i++) {
    const a = (i / (zuby * 2)) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? 98 : 94.5;
    d += `${i === 0 ? "M" : "L"}${(100 + r * Math.cos(a)).toFixed(2)},${(100 + r * Math.sin(a)).toFixed(2)}`;
  }
  return `${d}Z`;
})();

/**
 * Nápis po obvode: oblúk má ~204 jednotiek, bezpečne sa zmestí 176 (konce oblúka sú pri
 * prstenci). Pri 14 px verzálkach s rozostupom 2 px je to ~12,5 na znak — dlhší názov dostane
 * menšie písmo a natvrdo dĺžku oblúka (UI inšpekcia: „CELÁ KRČMA PORAZENÁ“ sa orezal z oboch strán).
 */
const NAPIS_DLZKA = 176;
const NAPIS_ZNAK = 12.5;

function rozmerNapisu(text: string): { readonly fontSize: number; readonly textLength?: number } {
  const dlzka = text.length * NAPIS_ZNAK;
  if (dlzka <= NAPIS_DLZKA) return { fontSize: 14 };
  return { fontSize: Math.max(10, Math.floor((14 * NAPIS_DLZKA) / dlzka)), textLength: NAPIS_DLZKA };
}

const HVIEZDA = "M0,-10 L2.9,-3.1 10,-3.1 4.3,1.4 6.5,9 0,4.6 -6.5,9 -4.3,1.4 -10,-3.1 -2.9,-3.1Z";

export interface PodtacokProps {
  readonly rank: RankPodtacka;
  /**
   * Piktogram: „akcia:<Akcia>“ (cesty z karta/ikony.ts), samotná akcia (Rana, Petelica…), alebo
   * null; ikonu podmienky („podmienka:…“) dá obrazok (nahraté ikony bodovania). Bez nej začiatočné písmeno.
   */
  readonly ikona: string | null;
  /** URL obrázka piktogramu (ikona podmienky zo sady) — prednosť pred ikona. */
  readonly obrazok?: string | null;
  readonly nazov: string;
  readonly ziskany: boolean;
  /** Tajný a nezískaný: „???“ bez názvu a piktogramu. */
  readonly tajny?: boolean;
  /** Šírka v px (štvorec). */
  readonly velkost?: number;
}

export function Podtacok({ rank, ikona, obrazok = null, nazov, ziskany, tajny = false, velkost = 120 }: PodtacokProps) {
  const id = useId().replace(/:/g, "");
  const skryty = tajny && !ziskany;
  const f = FARBY[skryty ? "tajny" : rank];
  const kluc = ikona?.startsWith("akcia:") ? ikona.slice(6) : ikona;
  const cesty = kluc === null ? undefined : (IKONY_STRACHU[kluc] ?? (IKONY as Readonly<Record<string, readonly { d: string; evenOdd: boolean; podklad?: boolean }[]>>)[kluc]);
  const napis = velkost >= NAPIS_OD;
  const textNapisu = skryty ? "TAJNÝ" : nazov;
  const rozmer = rozmerNapisu(textNapisu);
  const hviezdy = HVIEZDY_RANKU[rank];
  return (
    <svg
      className={`podtacok ${ziskany ? "ziskany" : "neziskany"}${skryty ? " tajny" : ""}`}
      viewBox="0 0 200 200"
      width={velkost}
      height={velkost}
      role="img"
      aria-label={skryty ? "Tajný achievement" : `${nazov} — ${NAZOV_RANKU[rank]}${ziskany ? "" : ", nezískaný"}`}
    >
      <defs>
        <radialGradient id={`${id}k`} cx="42%" cy="38%" r="70%">
          <stop offset="0" stopColor="#f4e6c8" />
          <stop offset="0.7" stopColor="#e2cfa6" />
          <stop offset="1" stopColor="#c9b083" />
        </radialGradient>
        <linearGradient id={`${id}m`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={f.svetly} />
          <stop offset="0.45" stopColor={f.okraj} />
          <stop offset="1" stopColor={f.tmavy} />
        </linearGradient>
        {napis && <path id={`${id}o`} d="M35,100 A65,65 0 0,1 165,100" />}
        {/* Ikony bodovania sú biele na čiernom štvorci — orezané na stredový kruh, štvorec zmizne v jeho tme. */}
        <clipPath id={`${id}c`}>
          <circle cx="100" cy="100" r={napis ? 47 : 56} />
        </clipPath>
      </defs>
      <path className="podtacok-karton" d={OKRAJ} fill={`url(#${id}k)`} />
      <circle cx="100" cy="100" r="86" fill="none" stroke={`url(#${id}m)`} strokeWidth="11" />
      <circle cx="100" cy="100" r="80" fill="none" stroke={f.tmavy} strokeWidth="1" opacity="0.6" />
      <circle cx="100" cy="100" r={napis ? 49 : 58} fill={f.tmavy} />
      <circle cx="100" cy="100" r={napis ? 49 : 58} fill="none" stroke={`url(#${id}m)`} strokeWidth="3" />
      {napis && (
        <text className="podtacok-napis" fill={f.tmavy} textAnchor="middle" style={{ fontSize: rozmer.fontSize }}>
          <textPath
            href={`#${id}o`}
            startOffset="50%"
            {...(rozmer.textLength === undefined ? {} : { textLength: rozmer.textLength, lengthAdjust: "spacingAndGlyphs" })}
          >
            {textNapisu}
          </textPath>
        </text>
      )}
      {skryty ? (
        <text className="podtacok-otazniky" x="100" y={napis ? 114 : 118} textAnchor="middle">
          ???
        </text>
      ) : obrazok !== null ? (
        <image
          className="podtacok-obrazok"
          href={obrazok}
          x={napis ? 62 : 52}
          y={napis ? 58 : 52}
          width={napis ? 76 : 96}
          height={napis ? 76 : 96}
          preserveAspectRatio="xMidYMid meet"
          clipPath={`url(#${id}c)`}
        />
      ) : cesty !== undefined ? (
        <g className="podtacok-piktogram" transform={napis ? "translate(64 60) scale(0.72)" : "translate(57 55) scale(0.86)"}>
          {cesty.map((c, i) => (
            <path key={i} d={c.d} fillRule={c.evenOdd ? "evenodd" : "nonzero"} fillOpacity={c.podklad === true ? PRIESVITNOST_PODKLADU : undefined} />
          ))}
        </g>
      ) : (
        <text className="podtacok-otazniky" x="100" y="116" textAnchor="middle">
          {nazov.charAt(0)}
        </text>
      )}
      {!skryty &&
        [0, 1, 2].map((k) => (
          <path
            key={k}
            className={`podtacok-hviezda${k < hviezdy ? " plna" : ""}`}
            transform={`translate(${100 + (k - 1) * 24} ${k === 1 ? 171 : 167}) scale(1.05)`}
            d={HVIEZDA}
          />
        ))}
      <path d="M40,58 Q100,10 160,58" fill="none" stroke="#fff" strokeOpacity="0.18" strokeWidth="10" strokeLinecap="round" />
    </svg>
  );
}
