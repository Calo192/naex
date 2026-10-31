// Na telefóne sa hrá len na šírku (Michal 2026-10-31: „forcnúť hru na šírku za každých okolností“):
// na výšku stôl prekryje táto výzva. Stôl pod ňou ostáva v DOM aj so spojením — po otočení
// pokračuje presne tam, kde bol (návrh ťahu, otvorená vrstva).

export function OtocTelefon() {
  return (
    <div className="otoc-telefon" role="alertdialog" aria-modal="true" aria-labelledby="otoc-telefon-nadpis">
      <svg className="otoc-telefon-ikona" viewBox="0 0 120 120" aria-hidden="true">
        <rect className="telefon" x="42" y="18" width="36" height="64" rx="6" />
        <rect className="telefon-sirka" x="28" y="52" width="64" height="36" rx="6" />
        <path className="sipka" d="M86 26a34 34 0 0 1 14 30" />
        <path className="sipka-hrot" d="M93 54l7 6 5-8" />
      </svg>
      <strong id="otoc-telefon-nadpis">Otoč telefón na šírku</strong>
      <span>Stôl NA EX! sa na telefóne hrá len na šírku. Partia ťa počká presne tam, kde si skončil.</span>
    </div>
  );
}
