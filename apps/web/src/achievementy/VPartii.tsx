// Achievementy počas partie a po nej: oznam zisku (pilulka vpravo hore, hra.achievementy)
// a súhrn v okne konca (získané podtácky a „chýbalo málo“, hra.suhrnAchievementov).

import { useMemo } from "react";
import { Odkaz } from "../lib/router.tsx";
import { useSada } from "../lib/sada.tsx";
import { useUcet } from "../lib/ucet.tsx";
import type { SuhrnAchievementov, ZiskAchievementu } from "../hra/useHra.ts";
import { rankPodtacka, textVzacnosti } from "./data.ts";
import { OznamAchievementu, type ZiskVOzname } from "./OznamAchievementu.tsx";
import { NAZOV_RANKU, Podtacok } from "./Podtacok.tsx";
import { piktogramPodtacka } from "./piktogram.ts";
import "./podtacok.css";

/** Najviac toľko podtáckov v okne konca; zvyšok je vo vitríne. */
const V_OKNE = 6;

export function OznamZiskov({ zisky }: { readonly zisky: readonly ZiskAchievementu[] }) {
  const { sada } = useSada();
  const ikony = sada?.ikonyBodovania;
  const oznamy = useMemo(
    (): readonly ZiskVOzname[] =>
      zisky.map((z) => ({ kluc: `${z.id}-${z.rank}`, id: z.id, nazov: z.nazov, rank: rankPodtacka(z.rank), tajny: z.tajny, ...piktogramPodtacka(z.piktogram, ikony ?? []) })),
    [zisky, ikony],
  );
  return <OznamAchievementu zisky={oznamy} />;
}

/** Súhrn v okne konca partie; bez ziskov aj bez „chýbalo málo“ sa neukáže. */
export function SuhrnPoPartii({ suhrn }: { readonly suhrn: SuhrnAchievementov }) {
  const { sada } = useSada();
  const ja = useUcet().ja;
  const ikony = sada?.ikonyBodovania ?? [];
  // Bronz aj striebro toho istého v jednej partii = jeden podtácok s vyšším rankom.
  const najvyssie = new Map<string, ZiskAchievementu>();
  for (const z of suhrn.ziskane) if ((najvyssie.get(z.id)?.rank ?? 0) < z.rank) najvyssie.set(z.id, z);
  const ziskane = [...najvyssie.values()];
  const { chybaloMalo } = suhrn;
  if (ziskane.length === 0 && chybaloMalo.length === 0) return null;
  return (
    <section className="koniec-achievementy" aria-label="Achievementy z partie">
      {ziskane.length > 0 && (
        <>
          <h3>
            {ziskane.length === 1 ? "Nový podtácok" : `Nové podtácky (${ziskane.length})`}
          </h3>
          <ul className="podtacky-rad">
            {ziskane.slice(0, V_OKNE).map((z) => {
              const vzacnost = textVzacnosti(z, z.rank);
              return (
                <li key={`${z.id}-${z.rank}`} title={z.popis}>
                  <Podtacok rank={rankPodtacka(z.rank)} {...piktogramPodtacka(z.piktogram, ikony)} nazov={z.nazov} ziskany tajny={z.tajny} velkost={88} />
                  <span>{z.nazov}</span>
                  <small className="tlmene">{NAZOV_RANKU[rankPodtacka(z.rank)]}</small>
                  {vzacnost !== null && <small className="tlmene">{vzacnost}</small>}
                </li>
              );
            })}
          </ul>
          {ziskane.length > V_OKNE && (
            <p className="tlmene">
              a ďalšie {ziskane.length - V_OKNE} — všetky sú {ja == null ? "v profile" : <Odkaz href={`/hrac/${ja.id}`}>v profile</Odkaz>}.
            </p>
          )}
        </>
      )}
      {chybaloMalo.length > 0 && (
        <>
          <h3>Chýbalo málo</h3>
          <ul className="chybalo-malo">
            {chybaloMalo.map((p) => (
              <li key={`${p.id}-${p.rank}`}>
                <Podtacok rank={rankPodtacka(p.rank)} {...piktogramPodtacka(p.piktogram, ikony)} nazov={p.nazov} ziskany={false} tajny={false} velkost={32} />
                <span>
                  <b>{p.nazov}</b> ({NAZOV_RANKU[rankPodtacka(p.rank)]}) — {p.hodnota} z {p.prah}
                  <span className="tlmene"> · {p.popis}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
