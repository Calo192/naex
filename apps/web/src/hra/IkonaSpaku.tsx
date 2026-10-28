// Piktogram špaku (ohorok: filter a típnutý papier s popolom) v štýle piktogramov
// akcií — plná silueta v súradniciach 0..100, farba cez currentColor (CSS fill).
// viewBox je orezaný na pás 2 : 1 — ohorok je podlhovastý a v štvorci by bol drobný.
// Michal 2026-10-26: na stole stačí piktogram, nadpis a číslo; ilustrácia popolníka
// bola navyše. Samostatný súbor bez závislostí, nech ho hlavička webu použije bez stola.

/** Ikona špaku — do textu („+3 ◦“), na dlaždicu Špaky aj do štítka partie. */
export function IkonaSpaku({ trieda }: { readonly trieda?: string }) {
  return (
    <svg className={`ikona-spaku${trieda === undefined ? "" : ` ${trieda}`}`} viewBox="0 25 100 50" aria-hidden="true">
      <g transform="translate(50 50) rotate(-25) scale(0.93) translate(-50 -58)">
        <rect x={4} y={40} width={34} height={22} rx={3} />
        <path d="M43 40H66L84 52L87 56L82.5 59L86 63L79.5 64.5L78 69.5L71.8 70.3L59.4 62H43Z" />
        <circle cx={92} cy={72} r={4} />
        <circle cx={95} cy={62} r={2.6} />
        <circle cx={86} cy={79} r={2.4} />
      </g>
    </svg>
  );
}
