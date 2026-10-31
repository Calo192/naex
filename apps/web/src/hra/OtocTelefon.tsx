// Na telefóne sa hrá len na šírku (Michal 2026-10-31: „forcnúť hru na šírku za každých okolností“):
// na výšku stôl prekryje táto výzva. Stôl pod ňou ostáva v DOM aj so spojením — po otočení
// pokračuje presne tam, kde bol (návrh ťahu, otvorená vrstva).

export function OtocTelefon() {
  return (
    <div className="otoc-telefon" role="alertdialog" aria-modal="true" aria-labelledby="otoc-telefon-nadpis">
      <svg className="otoc-telefon-ikona" viewBox="0 0 120 120" aria-hidden="true">
        <path className="sipka" d="M24 40a42 42 0 0 1 52-22" />
        <path className="sipka" d="M70 10l7 8-9 6" />
        <g className="telefon">
          <rect x="40" y="26" width="40" height="72" rx="7" />
          <path d="M54 90h12" />
        </g>
      </svg>
      <strong id="otoc-telefon-nadpis">Otoč telefón na šírku</strong>
      <span>Stôl NA EX! sa na telefóne hrá len na šírku. Partia beží ďalej a počká ťa presne v tomto stave.</span>
    </div>
  );
}
