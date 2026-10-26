// Ukážka rekapitulácie bitky a Pitky na snímky a UI inšpekciu (/hra/ukazka-rekapitulacie,
// len správca): dva boti odohrajú partiu v prehliadači (to isté jadro ako server) a vrstva
// ukáže ich skutočnú bitku či Pitku — bez živej partie. Parametre: ?druh=bitka|pitka,
// &seed=N (partia), &i=k (k-ta bitka či Pitka; inak tá s najviac riadkami), &ja=0|1.

import { useMemo, useState } from "react";
import type { Command, Event, GameState, PlayerId, RekapitulaciaBitky, RekapitulaciaPitky } from "@naex/core";
import { apply, evaluateLine, lineState, naTahu, pocitadloBitky, rngInt, rngSeed, setupGame, tahBota } from "@naex/core";
import { IkonaAkcie } from "../karta/IkonaAkcie.tsx";
import { useSada } from "../lib/sada.tsx";
import { useHerneData } from "../stranky/Ukazky.tsx";
import { HernaKarta } from "./HernaKarta.tsx";
import { PocitadloSLiniou } from "./PocitadloBitky.tsx";
import { RekapitulaciaPitkyVrstva, riadkovRekapitulacieBitky, type PiktogramyRekapitulacie } from "./Rekapitulacia.tsx";
import type { GameData } from "@naex/core";

interface Najdene {
  readonly bitky: { readonly stol: GameState; readonly rekap: RekapitulaciaBitky; readonly tuhe: readonly [number, number] }[];
  readonly pitky: { readonly stol: GameState; readonly rekap: RekapitulaciaPitky }[];
}

function odohraj(data: GameData, seed: number): Najdene {
  let s = setupGame(data, seed, { lokalit: 4 });
  let rng = rngSeed(seed ^ 0x5a);
  const bitky: Najdene["bitky"][number][] = [];
  const pitky: Najdene["pitky"][number][] = [];
  for (let i = 0; i < 6000 && s.koniec === null && bitky.length < 4; i++) {
    const p = naTahu(s);
    if (p === null) break;
    const [j, r] = rngInt(rng, 2 ** 31);
    rng = r;
    const cmd: Command = tahBota(data, s, p, j, { povaha: i % 2 === 0 ? "stamgast" : "chamtivy" });
    const { state: po, events } = apply(data, s, cmd, p);
    for (const e of events as readonly Event[]) {
      const stol = po.ciel !== null && po.strany.some((x) => x.length > 0) ? po : s;
      if (e.type === "pitkaRekap") pitky.push({ stol, rekap: e.rekap });
      if (e.type === "bitkaVysledok" && e.rekap !== undefined) bitky.push({ stol, rekap: e.rekap, tuhe: e.damage.tuhe });
    }
    s = po;
  }
  return { bitky, pitky };
}

export function UkazkaRekapitulacie() {
  const { sada } = useSada();
  if (sada === null) return <p className="tlmene">Načítavam sadu…</p>;
  return <Ukazka sada={sada} />;
}

function Ukazka({ sada }: { readonly sada: NonNullable<ReturnType<typeof useSada>["sada"]> }) {
  const data = useHerneData(sada);
  const q = new URLSearchParams(window.location.search);
  const druh = q.get("druh") === "pitka" ? "pitka" : "bitka";
  const seed = Number(q.get("seed") ?? "8");
  const ja = (q.get("ja") === "1" ? 1 : 0) as PlayerId;
  const [kolo, setKolo] = useState(0);
  const najdene = useMemo(() => odohraj(data, seed), [data, seed]);
  const piktogramy: PiktogramyRekapitulacie = {
    ikona: (k) => <IkonaAkcie kluc={k} akcia={sada.akcie.find((a) => a.kluc === k)} />,
    nazov: (k) => sada.akcie.find((a) => a.kluc === k)?.nazov ?? k,
  };
  const menoKarty = (defId: string): string => data.cards.get(defId)?.name ?? defId;
  const mena: readonly [string, string] = ja === 0 ? ["Ty", "Rapavý Fero"] : ["Rapavý Fero", "Ty"];
  const iParam = q.get("i");
  const zavri = (): void => setKolo((k) => k + 1);

  if (druh === "pitka") {
    const pitky = najdene.pitky;
    // Predvolene Pitka, v ktorej niekto dostal kliatbu a dal NA EX — najviac čo ukázať.
    const skore = (r: RekapitulaciaPitky): number => r.zadlzenie.dlhy[0] + r.zadlzenie.dlhy[1] + r.pecen.cirhozy[0] + r.pecen.cirhozy[1] + (r.naex.karty.length > 0 ? 2 : 0);
    const i = iParam !== null ? Number(iParam) : pitky.reduce((b, x, k) => (skore(x.rekap) > skore(pitky[b]!.rekap) ? k : b), 0);
    const x = pitky[i];
    if (x === undefined) return <p className="tlmene">V partii {seed} nie je Pitka č. {i}.</p>;
    const lok = x.stol.ciel?.lokalita ?? null;
    return (
      <>
        <p className="tlmene">Ukážka: Pitka {i} z {pitky.length}, semienko {seed}. Zavretá vrstva sa po kliku na Ďalej znova otvorí.</p>
        <RekapitulaciaPitkyVrstva
          key={kolo}
          r={x.rekap}
          ja={ja}
          mena={mena}
          nadpis={`Pitka ${x.rekap.pitka} / ${x.rekap.pitkyCelkom}${lok === null ? "" : ` · ${menoKarty(lok.defId)}`}`}
          menoKarty={menoKarty}
          piktogramy={piktogramy}
          onKoniec={zavri}
        />
      </>
    );
  }
  const bitky = najdene.bitky;
  const i = iParam !== null ? Number(iParam) : bitky.reduce((b, x, k) => (riadkovRekapitulacieBitky(x.rekap) > riadkovRekapitulacieBitky(bitky[b]!.rekap) ? k : b), 0);
  const x = bitky[i];
  if (x === undefined) return <p className="tlmene">V partii {seed} nie je bitka č. {i}.</p>;
  const linia = evaluateLine(data, lineState(x.stol));
  return (
    <>
      <p className="tlmene">Ukážka: bitka {i} z {bitky.length}, semienko {seed}.</p>
      <PocitadloSLiniou
        key={kolo}
        vrstva={{ p: pocitadloBitky(data, x.stol, linia, x.tuhe), stol: x.stol, linia, rekap: x.rekap }}
        ja={ja}
        mena={mena}
        karta={(k) => <HernaKarta sada={sada} data={data} {...k} />}
        menoKarty={menoKarty}
        piktogramy={piktogramy}
        onKoniec={zavri}
      />
    </>
  );
}
