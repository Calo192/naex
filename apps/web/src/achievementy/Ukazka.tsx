// Ukážka UI achievementov na snímky a UI inšpekciu (/achievementy/ukazka): vitrína a oznam
// s vymyslenými dátami. API je napojené (profil, okno konca, oznam v partii), ale kým má
// katalóg „zapnute“: false, je to jediné miesto, kde sa dá oznam pozrieť bez partie;
// zmažeme ju, keď sa achievementy zapnú.

import { useState } from "react";
import { useSada } from "../lib/sada.tsx";
import { OznamAchievementu, type ZiskVOzname } from "./OznamAchievementu.tsx";
import { piktogramPodtacka } from "./piktogram.ts";
import { Vitrina, type KategoriaVitriny, type PolozkaVitriny } from "./Vitrina.tsx";

const KATEGORIE: readonly KategoriaVitriny[] = [
  { id: "bitka", nazov: "Bitka" },
  { id: "krcma", nazov: "Krčma" },
  { id: "starsi", nazov: "Starší" },
  { id: "tajne", nazov: "Tajné" },
];

const DEN = 86_400_000;
const TERAZ = Date.UTC(2026, 9, 24, 9);

type Vzor = Omit<PolozkaVitriny, "ikona" | "obrazok"> & { readonly piktogram: string | null };

const VZORY: readonly Vzor[] = [
  { id: "prva-krv", nazov: "Prvá krv", popis: "Vyhraj prvú bitku.", kategoria: "bitka", tajny: false, piktogram: "akcia:Rana", rank: "bronz", rankCiela: "bronz", ziskane: TERAZ - 2 * DEN, postup: null },
  { id: "petelica", nazov: "Petelica", popis: "Daj 10 rán Petelicou v jednej partii.", kategoria: "bitka", tajny: false, piktogram: "akcia:Petelica", rank: "striebro", rankCiela: "bronz", ziskane: TERAZ - DEN, postup: null },
  { id: "na-ex", nazov: "Na ex!", popis: "Vyhraj partiu s NA EX v každej Pitke.", kategoria: "krcma", tajny: false, piktogram: "akcia:Poldeci", rank: "zlato", rankCiela: "bronz", ziskane: TERAZ, postup: null },
  { id: "komin", nazov: "Komín", popis: "Vyfajč 30 cigariet v jednej partii.", kategoria: "krcma", tajny: false, piktogram: "akcia:Cigareta", rank: null, rankCiela: "striebro", ziskane: null, postup: { hodnota: 21, prah: 30 } },
  { id: "na-sekeru", nazov: "Na sekeru", popis: "Prizná 5 Dlhov a aj tak vyhraj.", kategoria: "krcma", tajny: false, piktogram: "akcia:Dlh", rank: null, rankCiela: "bronz", ziskane: null, postup: { hodnota: 2, prah: 5 } },
  { id: "strasiak", nazov: "Strašiak", popis: "Vydes štyroch starších v jednej partii.", kategoria: "starsi", tajny: false, piktogram: "podmienka:vydesenie", rank: "bronz", rankCiela: "bronz", ziskane: TERAZ - 5 * DEN, postup: null },
  { id: "farar", nazov: "Farár ťa miluje", popis: "Maj Farára v najvyššej zóne strachu na konci hry.", kategoria: "starsi", tajny: false, piktogram: "akcia:Viera", rank: null, rankCiela: "zlato", ziskane: null, postup: null },
  { id: "tajny-1", nazov: "???", popis: "???", kategoria: "tajne", tajny: true, piktogram: null, rank: null, rankCiela: "zlato", ziskane: null, postup: null },
  { id: "tajny-2", nazov: "Pivný kráľ", popis: "Vyhraj s Cirhózou v Dedičstve aj v ruke.", kategoria: "tajne", tajny: true, piktogram: "podmienka:cirhoza", rank: "zlato", rankCiela: "zlato", ziskane: TERAZ - 3 * DEN, postup: null },
];

export function UkazkaAchievementov() {
  const { sada } = useSada();
  const ikony = sada?.ikonyBodovania ?? [];
  const polozky: PolozkaVitriny[] = VZORY.map(({ piktogram, ...p }) => ({ ...p, ...piktogramPodtacka(piktogram, ikony) }));
  const [zisky, setZisky] = useState<readonly ZiskVOzname[]>([]);
  const ukaz = (): void => {
    const p = polozky.filter((x) => x.rank !== null);
    setZisky((z) => [
      ...z,
      ...p.slice(0, 2).map((x, i) => ({ kluc: `${x.id}-${z.length + i}`, nazov: x.nazov, rank: x.rank ?? "bronz", tajny: x.tajny, ikona: x.ikona, obrazok: x.obrazok })),
    ]);
  };
  return (
    <div className="panel" style={{ display: "grid", gap: 20 }}>
      <header className="stranka-hlava">
        <h1>Achievementy — ukážka</h1>
        <p className="tlmene">Vymyslené dáta na snímky a UI inšpekciu. Skutočná vitrína bude v Profile po napojení API.</p>
        <button className="tlacidlo-hlavne" onClick={ukaz} data-ukazka-oznam="">
          Ukázať oznam v partii (2 zisky po sebe)
        </button>
      </header>
      <Vitrina polozky={polozky} kategorie={KATEGORIE} vlastna />
      <h2>Verejný profil (cudzí hráč)</h2>
      <Vitrina polozky={polozky} kategorie={KATEGORIE} vlastna={false} />
      <OznamAchievementu zisky={zisky} />
    </div>
  );
}
