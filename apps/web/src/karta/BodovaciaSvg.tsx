// Bodovacia karta (scorecard) staršieho: podložka, do ktorej sa vkladá karta
// staršieho. Bočné ikony ležia presne na výškach slotov karty, pod ňou
// stupnica strachu a názov. Kreslí sa ako SVG v bodoch — rovnaký výstup
// v tvorcovi, v tlači aj v hre (tam navyše marker a stav podmienok).

import type { BodovaciaKarta, IkonaBodovania } from "@naex/tvorba";
import { FARBY_STUPNICE, geometriaBodovacej } from "@naex/tvorba";
import { mediaUrl } from "../lib/api.ts";

/** Stav podmienky v hre — zvýraznenie bočnej pozície. */
export interface StavSlotuBodovania {
  /** neaktivna = karta tu nemá akciu; aktivna = má; plati = teraz by bodovala. */
  readonly stav: "neaktivna" | "aktivna" | "plati";
  /** Farba hráča, ktorému strana patrí. */
  readonly farba: string;
}

export function BodovaciaSvg({
  karta,
  ikony,
  sirka,
  znacky = false,
  onSlot,
  marker,
  stavSlotu,
}: {
  readonly karta: BodovaciaKarta;
  readonly ikony: readonly IkonaBodovania[];
  readonly sirka?: number | string;
  /** Prázdne sloty ako „+“ (len v editore). */
  readonly znacky?: boolean;
  readonly onSlot?: (strana: "lava" | "prava", i: number) => void;
  /** Pozícia markera na stupnici (0..8, zľava). */
  readonly marker?: number;
  readonly stavSlotu?: (strana: "lava" | "prava", i: number) => StavSlotuBodovania | null;
}) {
  const g = geometriaBodovacej(karta);
  const o = g.odtlacok;
  const sloty = (strana: "lava" | "prava") =>
    (strana === "lava" ? g.slotyLave : g.slotyPrave).map((r, i) => {
      const id = karta[strana][i] ?? null;
      const ik = id === null ? undefined : ikony.find((x) => x.id === id);
      const klik = onSlot === undefined ? undefined : () => onSlot(strana, i);
      if (ik === undefined) {
        if (!znacky) return null;
        const s = r.w * 0.22;
        return (
          <g key={`${strana}${i}`} onClick={klik} style={{ cursor: klik === undefined ? undefined : "pointer" }}>
            <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={g.polomer} fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.66)" strokeWidth={1} />
            <path d={`M${r.x + r.w / 2 - s} ${r.y + r.h / 2}h${2 * s}M${r.x + r.w / 2} ${r.y + r.h / 2 - s}v${2 * s}`} stroke="rgba(255,255,255,0.66)" strokeWidth={1} strokeLinecap="round" />
          </g>
        );
      }
      const pad = r.w * 0.12;
      const st = stavSlotu?.(strana, i) ?? null;
      const okraj = r.w * 0.16;
      return (
        <g key={`${strana}${i}`} onClick={klik} style={{ cursor: klik === undefined ? undefined : "pointer" }}>
          {st !== null && st.stav !== "neaktivna" && (
            <rect
              x={r.x - okraj}
              y={r.y - okraj}
              width={r.w + 2 * okraj}
              height={r.h + 2 * okraj}
              rx={g.polomer + okraj}
              fill={st.stav === "plati" ? st.farba : "none"}
              fillOpacity={0.35}
              stroke={st.farba}
              strokeWidth={st.stav === "plati" ? 2.6 : 1.8}
              strokeDasharray={st.stav === "plati" ? undefined : "3 2"}
            />
          )}
          <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={g.polomer} fill="#fff" stroke="#cbd5e1" strokeWidth={1.13} />
          <image href={mediaUrl(ik.media)} x={r.x + pad} y={r.y + pad} width={r.w - 2 * pad} height={r.h - 2 * pad} preserveAspectRatio="xMidYMid meet" />
          {st?.stav === "neaktivna" && <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={g.polomer} fill="#111" fillOpacity={0.6} />}
        </g>
      );
    });

  return (
    <svg
      className="bodovacia-svg"
      viewBox={`0 0 ${g.sirka} ${g.vyska}`}
      width={sirka}
      style={{ aspectRatio: `${g.sirka} / ${g.vyska}` }}
      role="img"
      aria-label={`Bodovacia karta ${karta.nazov}`}
    >
      <defs>
        <clipPath id={`bk-${karta.id}`}>
          <rect width={g.sirka} height={g.vyska} />
        </clipPath>
      </defs>
      <rect width={g.sirka} height={g.vyska} fill="#374151" />
      {karta.pozadie !== null && (
        <image href={mediaUrl(karta.pozadie)} width={g.sirka} height={g.vyska} preserveAspectRatio="xMidYMid slice" clipPath={`url(#bk-${karta.id})`} />
      )}
      <rect x={o.x} y={o.y} width={o.w} height={o.h} fill="none" stroke={karta.farba ?? "#94a3b8"} strokeWidth={0.5 * 2.835} />
      {sloty("lava")}
      {sloty("prava")}
      {g.kruzky.map((c, i) => (
        <circle key={i} cx={c.x + c.w / 2} cy={c.y + c.h / 2} r={c.w / 2} fill={FARBY_STUPNICE[i]} stroke="#fff" strokeWidth={1.13} />
      ))}
      {marker !== undefined &&
        (() => {
          const c = g.kruzky[marker];
          if (c === undefined) return null;
          return (
            <g>
              <circle cx={c.x + c.w / 2} cy={c.y + c.h / 2} r={c.w * 0.62} fill="none" stroke="#fff" strokeWidth={2.2} />
              <circle cx={c.x + c.w / 2} cy={c.y + c.h / 2} r={c.w * 0.3} fill="#111" stroke="#fff" strokeWidth={1.4} />
            </g>
          );
        })()}
      {karta.nazov !== "" && (
        <>
          <rect
            x={g.nazov.x + g.nazov.w / 2 - Math.min(g.nazov.w, karta.nazov.length * g.velkostNazvu * 0.6 + 1.4 * g.velkostNazvu) / 2}
            y={g.nazov.y - g.nazov.h * 0.075}
            width={Math.min(g.nazov.w, karta.nazov.length * g.velkostNazvu * 0.6 + 1.4 * g.velkostNazvu)}
            height={g.nazov.h * 1.15}
            rx={1.7}
            fill="#374151"
          />
          <text
            x={g.nazov.x + g.nazov.w / 2}
            y={g.nazov.y + g.nazov.h / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#f8fafc"
            fontFamily="Roboto, sans-serif"
            fontWeight={700}
            fontSize={g.velkostNazvu}
          >
            {karta.nazov}
          </text>
        </>
      )}
    </svg>
  );
}
