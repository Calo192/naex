// Prehľad tempa partií (roadmapa #9): koľko trvajú partie a kde ide čas.
// Dáta z GET /api/admin/tempo, výpis pre admin.ts tempo.

export interface PartiaTempa {
  readonly kod: string;
  readonly zaciatok: number;
  readonly koniec: number;
  readonly dlzka: string;
  readonly sBotom: boolean;
  readonly ai: boolean;
  readonly dohrata: boolean;
  readonly kola: number;
  readonly bitky: number;
  readonly pitky: number;
  readonly prikazy: number;
  readonly fazy: Readonly<Record<string, { readonly prikazy: readonly number[]; readonly ms: readonly number[] }>>;
}

const median = (xs: readonly number[]): number => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

export const druhPartie = (p: Pick<PartiaTempa, "sBotom" | "ai">): string => (p.ai ? "AI playtest" : p.sBotom ? "človek s botom" : "dvaja ľudia");

/** Skupiny podľa dĺžky a druhu partie; len dohraté partie. */
export function prehladTempa(partie: readonly PartiaTempa[]): string {
  const dohrate = partie.filter((p) => p.dohrata);
  if (dohrate.length === 0) return "Zatiaľ žiadna dohratá partia s meraním tempa.";
  const skupiny = new Map<string, PartiaTempa[]>();
  for (const p of dohrate) {
    const k = `${p.dlzka} · ${druhPartie(p)}`;
    skupiny.set(k, [...(skupiny.get(k) ?? []), p]);
  }
  const out: string[] = [];
  for (const [k, ps] of [...skupiny].sort()) {
    const min = median(ps.map((p) => (p.koniec - p.zaciatok) / 60000));
    out.push(
      `${k}: ${ps.length} ${ps.length === 1 ? "partia" : ps.length <= 4 ? "partie" : "partií"} · medián ${min.toFixed(0)} min, ${median(ps.map((p) => p.prikazy)).toFixed(0)} príkazov, ${median(ps.map((p) => p.pitky)).toFixed(0)} Pitiek, ${median(ps.map((p) => p.bitky)).toFixed(0)} bitiek`,
    );
    // Podiel fáz na čase: súčet cez partie skupiny.
    const fazy = new Map<string, { ms: number; prikazy: number }>();
    for (const p of ps) {
      for (const [f, v] of Object.entries(p.fazy)) {
        const x = fazy.get(f) ?? { ms: 0, prikazy: 0 };
        fazy.set(f, { ms: x.ms + (v.ms[0] ?? 0) + (v.ms[1] ?? 0), prikazy: x.prikazy + (v.prikazy[0] ?? 0) + (v.prikazy[1] ?? 0) });
      }
    }
    const spolu = [...fazy.values()].reduce((a, f) => a + f.ms, 0);
    for (const [f, v] of [...fazy].sort((a, b) => b[1].ms - a[1].ms)) {
      out.push(
        `   ${f.padEnd(22)} ${((100 * v.ms) / Math.max(1, spolu)).toFixed(0).padStart(3)} % času · ${(v.ms / ps.length / 60000).toFixed(1).padStart(5)} min/partia · ${(v.prikazy / ps.length).toFixed(0).padStart(4)} príkazov/partia · ${(v.ms / Math.max(1, v.prikazy) / 1000).toFixed(0).padStart(3)} s/príkaz`,
      );
    }
  }
  return out.join("\n");
}
