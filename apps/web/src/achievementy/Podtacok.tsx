// Achievement ako pivný podtácok (Michal 2026-10-23, ukážka dizajn-achievementy-20261023-1500):
// kartónový kruh s vrúbkovaným okrajom, kovový prstenec farby ranku, v strede piktogram
// z hry a hviezdičky podľa ranku (bronz 1, striebro 2, zlato 3). Nezískaný je sivý,
// tajný „???“. Názov po obvode len vo veľkých veľkostiach (88 px a viac).

import { useId } from "react";
import { IKONY } from "../karta/ikony.ts";
import "./podtacok.css";

export type RankPodtacka = "bronz" | "striebro" | "zlato";

const FARBY: Readonly<Record<RankPodtacka | "tajny", { readonly okraj: string; readonly svetly: string; readonly tmavy: string }>> = {
  bronz: { okraj: "#b06a34", svetly: "#e0a06a", tmavy: "#6e3d17" },
  striebro: { okraj: "#9aa3ab", svetly: "#e4e9ee", tmavy: "#5b636b" },
  zlato: { okraj: "#d4a017", svetly: "#ffe08a", tmavy: "#8a6208" },
  tajny: { okraj: "#6b6359", svetly: "#9a9086", tmavy: "#3f3933" },
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

const HVIEZDA = "M0,-10 L2.9,-3.1 10,-3.1 4.3,1.4 6.5,9 0,4.6 -6.5,9 -4.3,1.4 -10,-3.1 -2.9,-3.1Z";

export interface PodtacokProps {
  readonly rank: RankPodtacka;
  /** Kľúč piktogramu z hry (Rana, Petelica, Poldeci, Cigareta …); neznámy = začiatočné písmeno názvu. */
  readonly ikona: string;
  readonly nazov: string;
  readonly ziskany: boolean;
  /** Tajný a nezískaný: „???“ bez názvu a piktogramu. */
  readonly tajny?: boolean;
  /** Šírka v px (štvorec). */
  readonly velkost?: number;
}

export function Podtacok({ rank, ikona, nazov, ziskany, tajny = false, velkost = 120 }: PodtacokProps) {
  const id = useId().replace(/:/g, "");
  const skryty = tajny && !ziskany;
  const f = FARBY[skryty ? "tajny" : rank];
  const cesty = (IKONY as Readonly<Record<string, readonly { d: string; evenOdd: boolean }[]>>)[ikona];
  const napis = velkost >= NAPIS_OD;
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
      </defs>
      <path className="podtacok-karton" d={OKRAJ} fill={`url(#${id}k)`} />
      <circle cx="100" cy="100" r="86" fill="none" stroke={`url(#${id}m)`} strokeWidth="11" />
      <circle cx="100" cy="100" r="80" fill="none" stroke={f.tmavy} strokeWidth="1" opacity="0.6" />
      <circle cx="100" cy="100" r={napis ? 49 : 58} fill={f.tmavy} />
      <circle cx="100" cy="100" r={napis ? 49 : 58} fill="none" stroke={`url(#${id}m)`} strokeWidth="3" />
      {napis && (
        <text className="podtacok-napis" fill={f.tmavy} textAnchor="middle">
          <textPath href={`#${id}o`} startOffset="50%">
            {skryty ? "TAJNÝ" : nazov}
          </textPath>
        </text>
      )}
      {skryty ? (
        <text className="podtacok-otazniky" x="100" y={napis ? 114 : 118} textAnchor="middle">
          ???
        </text>
      ) : cesty !== undefined ? (
        <g className="podtacok-piktogram" transform={napis ? "translate(64 60) scale(0.72)" : "translate(57 55) scale(0.86)"}>
          {cesty.map((c, i) => (
            <path key={i} d={c.d} fillRule={c.evenOdd ? "evenodd" : "nonzero"} />
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
            transform={`translate(${100 + (k - 1) * 20} ${k === 1 ? 168 : 165}) scale(0.82)`}
            d={HVIEZDA}
          />
        ))}
      <path d="M40,58 Q100,10 160,58" fill="none" stroke="#fff" strokeOpacity="0.18" strokeWidth="10" strokeLinecap="round" />
    </svg>
  );
}
