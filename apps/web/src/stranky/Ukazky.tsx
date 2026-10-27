// Interaktívne ukážky k pravidlám — počítajú presne to isté jadro, na
// ktorom beží hra (evaluateLine, computeDamage, battleOutcome).

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CardInstance, GameData, LineEval, PlayerId } from "@naex/core";
import { STUPNICA_HODNOTY, STUPNICA_ZONY, battleOutcome, computeDamage, evaluateLine, loadGameData } from "@naex/core";
import eldersJson from "@naex/core/data/elders.json";
import scorecardsJson from "@naex/core/data/scorecards.json";
import type { KartaNavrh, RozlozenieStrany, Sada, Vzhlad } from "@naex/tvorba";
import { variant, variantyKarty } from "@naex/tvorba";
import { KartaLico, type SlotStav } from "../karta/KartaLico.tsx";
import { vzhladSady } from "../lib/sada.tsx";

export function useHerneData(sada: Sada): GameData {
  return useMemo(() => loadGameData(sada.cardsJson, eldersJson, sada.scorecardsJson ?? scorecardsJson), [sada]);
}

/** Vyhodnotenie zo slotov jadra → stav slotov na karte. */
export function slotyZEval(ev: LineEval, uid: number): { lava: (SlotStav | null)[]; prava: (SlotStav | null)[] } | null {
  const c = ev.cards.get(uid);
  if (c === undefined) return null;
  const m = (s: (typeof c.left)[number]): SlotStav | null => (s === null || s === undefined ? null : { stav: s.stav, nasobok: s.nasobok });
  return { lava: c.left.map(m), prava: c.right.map(m) };
}

function instancia(karta: KartaNavrh, i: number, uid: number): { inst: CardInstance; lava: RozlozenieStrany; prava: RozlozenieStrany } | null {
  const v = variantyKarty(karta);
  const r = variant(v, i);
  if (r === null) return null;
  const idx = ((i % v.pocet) + v.pocet) % v.pocet;
  return {
    inst: { uid, defId: karta.id, leftLayout: Math.floor(idx / v.prava.length), rightLayout: idx % v.prava.length },
    ...r,
  };
}

function VolbaKarty({
  karty,
  id,
  setId,
  v,
  setV,
}: {
  readonly karty: readonly KartaNavrh[];
  readonly id: string;
  readonly setId: (s: string) => void;
  readonly v: number;
  readonly setV: (n: number) => void;
}) {
  const k = karty.find((x) => x.id === id);
  const pocet = k === undefined ? 1 : variantyKarty(k).pocet;
  return (
    <div className="ukazka-volba">
      <select value={id} onChange={(e) => { setId(e.target.value); setV(0); }}>
        {karty.map((x) => (
          <option key={x.id} value={x.id}>
            {x.nazov}
          </option>
        ))}
      </select>
      {pocet > 1 && (
        <span className="glosar-varianty">
          <button className="tlacidlo-male" onClick={() => setV((v - 1 + pocet) % pocet)} aria-label="Predchádzajúci variant">‹</button>
          {v + 1}/{pocet}
          <button className="tlacidlo-male" onClick={() => setV((v + 1) % pocet)} aria-label="Ďalší variant">›</button>
        </span>
      )}
    </div>
  );
}

/** Dve karty vedľa seba: pravá strana prvej sa páruje s ľavou stranou druhej. */
export function UkazkaSpajania({ sada }: { readonly sada: Sada }) {
  const data = useHerneData(sada);
  const vzhlad: Vzhlad = vzhladSady(sada);
  const hracie = useMemo(
    () => sada.karty.filter((k) => !k.tagy.includes("Kliatba") && variantyKarty(k).pocet > 0 && Object.keys({ ...k.lava.akcie, ...k.prava.akcie }).length > 0),
    [sada],
  );
  const [idA, setIdA] = useState(hracie.find((k) => k.id === "pijan")?.id ?? hracie[0]?.id ?? "");
  const [idB, setIdB] = useState(hracie.find((k) => k.id === "zivnostnik")?.id ?? hracie[1]?.id ?? "");
  const [vA, setVA] = useState(0);
  const [vB, setVB] = useState(0);
  // Šírka kariet z miesta v stĺpci textu, nie z okna — inak pretekajú (UI dizajn 2026-10-24).
  const spojRef = useRef<HTMLDivElement>(null);
  const [miesto, setMiesto] = useState(480);
  useLayoutEffect(() => {
    const el = spojRef.current;
    if (el === null) return;
    const ro = new ResizeObserver(() => setMiesto(el.clientWidth));
    ro.observe(el);
    setMiesto(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const sirka = Math.max(120, Math.min(230, (miesto - 16) / 2));
  const kA = hracie.find((k) => k.id === idA);
  const kB = hracie.find((k) => k.id === idB);
  const a = kA === undefined ? null : instancia(kA, vA, 1);
  const b = kB === undefined ? null : instancia(kB, vB, 2);
  if (kA === undefined || kB === undefined || a === null || b === null) return <div className="ukazka-spoj" ref={spojRef} />;

  const ev = evaluateLine(data, {
    lokalita: null,
    lokalitaOtocena: false,
    // Partia hráča 0 vedie od lokality doľava: poradie [B, A] znamená,
    // že pravá strana A sa dotýka ľavej strany B.
    strany: [[{ card: b.inst, playedBy: 0 }, { card: a.inst, playedBy: 0 }], []],
  });
  const sumy = Object.entries(ev.sums[0]).filter(([, n]) => (n ?? 0) > 0);

  return (
    <div className="ukazka">
      <div className="ukazka-hlava">Vyskúšaj si to: vyber dve karty a sleduj, čo sa na spoji aktivuje.</div>
      <div className="ukazka-spoj" ref={spojRef}>
        <div className="ukazka-karta">
          <VolbaKarty karty={hracie} id={idA} setId={setIdA} v={vA} setV={setVA} />
          <KartaLico karta={kA} lava={a.lava} prava={a.prava} vzhlad={vzhlad} sirka={sirka} sloty={slotyZEval(ev, 1)} />
        </div>
        <div className="ukazka-karta">
          <VolbaKarty karty={hracie} id={idB} setId={setIdB} v={vB} setV={setVB} />
          <KartaLico karta={kB} lava={b.lava} prava={b.prava} vzhlad={vzhlad} sirka={sirka} sloty={slotyZEval(ev, 2)} />
        </div>
      </div>
      <div className="ukazka-vysledok" aria-live="polite">
        {sumy.length === 0 ? (
          <span>Na spoji sa nič nestretlo — skús iný variant (šípky) alebo inú kartu.</span>
        ) : (
          <>
            <strong>Aktívne akcie:</strong>{" "}
            {sumy.map(([k, n]) => `${vzhlad.akcie.find((x) => x.kluc === k)?.nazov ?? k} ×${n}`).join(", ")}
          </>
        )}
        {ev.cards.get(1)?.vzbura === true && <strong className="ukazka-vzbura"> · Vzbura!</strong>}
      </div>
    </div>
  );
}

function Pocitadlo({ label, hodnota, nastav, max = 9 }: { readonly label: string; readonly hodnota: number; readonly nastav: (n: number) => void; readonly max?: number }) {
  return (
    <label className="pocitadlo">
      <span>{label}</span>
      <span className="pocitadlo-ovladanie">
        <button className="tlacidlo-male" onClick={() => nastav(Math.max(0, hodnota - 1))} aria-label={`${label} menej`}>−</button>
        <output>{hodnota}</output>
        <button className="tlacidlo-male" onClick={() => nastav(Math.min(max, hodnota + 1))} aria-label={`${label} viac`}>+</button>
      </span>
    </label>
  );
}

interface StranaBitky {
  Rana: number;
  Pecka: number;
  Petelica: number;
  Viera: number;
  Povera: number;
  dlhy: number;
  abstaky: number;
}

const NULA: StranaBitky = { Rana: 0, Pecka: 0, Petelica: 0, Viera: 0, Povera: 0, dlhy: 0, abstaky: 0 };

/** Kalkulačka vyhodnotenia bitky (kroky 3 a 4). */
export function UkazkaBitky() {
  const [s, setS] = useState<[StranaBitky, StranaBitky]>([
    { ...NULA, Rana: 2, Pecka: 1, Povera: 1 },
    { ...NULA, Petelica: 1, Viera: 1, dlhy: 2 },
  ]);
  const nastav = (p: 0 | 1, k: keyof StranaBitky, n: number) =>
    setS((x) => (p === 0 ? [{ ...x[0], [k]: n }, x[1]] : [x[0], { ...x[1], [k]: n }]));
  const strana = (x: StranaBitky) => ({
    sums: { Rana: x.Rana, Pecka: x.Pecka, Petelica: x.Petelica, Viera: x.Viera, Povera: x.Povera },
    cirhozaBonus: 0,
    tuheBonus: 0,
    abstaky: x.abstaky,
    priznaneDlhy: x.dlhy,
    priazenBitkara: 0,
    hodnotaViery: 1,
  });
  const d = computeDamage([strana(s[0]), strana(s[1])]);
  // v6: remízu v tuhom rozhodnú Absťáky, potom priznané Dlhy (PRAVIDLA.md §9.4).
  const o = battleOutcome(d, { abstaky: [s[0].abstaky, s[1].abstaky], dlhy: [s[0].dlhy, s[1].dlhy] });
  const MENA = ["Ty", "Súper"];

  return (
    <div className="ukazka">
      <div className="ukazka-hlava">Kalkulačka bitky — nastav aktívne akcie oboch hráčov.</div>
      <div className="ukazka-bitka-strany">
        {([0, 1] as const).map((p) => (
          <div key={p} className="ukazka-bitka-strana">
            <h4>{MENA[p]}</h4>
            <Pocitadlo label="Rana (1)" hodnota={s[p].Rana} nastav={(n) => nastav(p, "Rana", n)} />
            <Pocitadlo label="Pecka (2)" hodnota={s[p].Pecka} nastav={(n) => nastav(p, "Pecka", n)} />
            <Pocitadlo label="Petelica (3)" hodnota={s[p].Petelica} nastav={(n) => nastav(p, "Petelica", n)} />
            <Pocitadlo label="Viera" hodnota={s[p].Viera} nastav={(n) => nastav(p, "Viera", n)} />
            <Pocitadlo label="Povera" hodnota={s[p].Povera} nastav={(n) => nastav(p, "Povera", n)} />
            <Pocitadlo label="Priznané dlhy" hodnota={s[p].dlhy} nastav={(n) => nastav(p, "dlhy", n)} max={20} />
            <Pocitadlo label="Absťáky" hodnota={s[p].abstaky} nastav={(n) => nastav(p, "abstaky", n)} />
          </div>
        ))}
      </div>
      <div className="ukazka-bitka-vysledok">
        <div>
          <span className="tlmene">Zvyšná Viera / Povera po vyrušení</span>
          <strong>
            {d.zvysnaViera[0]}/{d.zvysnaPovera[0]} : {d.zvysnaViera[1]}/{d.zvysnaPovera[1]}
          </strong>
        </div>
        <div>
          <span className="tlmene">Tuhé poškodenie</span>
          <strong>
            {d.tuhe[0]} : {d.tuhe[1]}
          </strong>
        </div>
        <div>
          <span className="tlmene">Mäkké (strop = súperov priznaný dlh)</span>
          <strong>
            {d.makke[0]} : {d.makke[1]}
          </strong>
        </div>
        <div>
          <span className="tlmene">Celkové</span>
          <strong>
            {d.celkove[0]} : {d.celkove[1]}
          </strong>
        </div>
      </div>
      <div className="ukazka-vysledok" aria-live="polite">
        {o.vitaz === null ? (
          <>
            <strong>Sekera</strong> — tuhé, Absťáky aj priznané Dlhy sú vyrovnané. Bitku nevyhrá nikto a jej špaky vezme víťaz
            najbližšej bitky.
          </>
        ) : (
          <>
            Vyhráva <strong>{MENA[o.vitaz]}</strong>
            {o.rozhodlo === "abstak" ? " — remízu v tuhom rozhodlo menej Absťákov" : o.rozhodlo === "dlhy" ? " — remízu v tuhom rozhodlo menej priznaných Dlhov" : ""}.
          </>
        )}{" "}
        {o.prebytokDrzi === null
          ? "Celkové poškodenie je vyrovnané — prebytok nezíska nikto."
          : `${MENA[o.prebytokDrzi]} rozdelí prebytok ${o.prebytok} medzi starších.`}
      </div>
    </div>
  );
}

// v6: 7 polí, jediné sivé v strede (index 3).
const ZONY = ["Vydesenie", "Strach", "Znepokojenie", "Neutralita", "Znepokojenie", "Strach", "Vydesenie"];
const ZONA_TRIEDA = ["cervena", "oranzova", "zlta", "siva", "zlta", "oranzova", "cervena"];

/** Stupnica strachu: kto má priazeň a koho sa starší bojí. */
export function UkazkaStupnice() {
  const [m, setM] = useState(3);
  const hodnota = STUPNICA_HODNOTY[m] ?? 0;
  const uroven = STUPNICA_ZONY[m] ?? 0;
  const strana = m < 3 ? "tvojej" : m > 3 ? "súperovej" : null;
  return (
    <div className="ukazka">
      <div className="ukazka-hlava">Posúvaj marker po stupnici staršieho.</div>
      <div className="stupnica-velka" role="group" aria-label="Stupnica strachu">
        {ZONY.map((z, i) => (
          <button key={i} className={`stupnica-bod ${ZONA_TRIEDA[i]} ${m === i ? "marker" : ""}`} onClick={() => setM(i)} aria-label={`Pozícia ${i}: ${z}`}>
            <span>{STUPNICA_ZONY[i]}</span>
          </button>
        ))}
      </div>
      <div className="stupnica-popis">
        <span>← tvoja polovica</span>
        <span>súperova polovica →</span>
      </div>
      <div className="ukazka-vysledok" aria-live="polite">
        {strana === null ? (
          <>Marker je v sivej zóne (<strong>Neutralita</strong>) — starší nikomu nedáva priazeň a nikoho sa nebojí.</>
        ) : (
          <>
            Marker leží na {strana} polovici v zóne <strong>{ZONY[m]}</strong>: priazeň s hodnotou <strong>{hodnota}</strong>{" "}
            má {strana === "tvojej" ? "ty" : "súper"}. Starší sa bojí {strana === "tvojej" ? "súpera" : "teba"} na úrovni{" "}
            <strong>{uroven}</strong> — po každej bitke, ktorú {strana === "tvojej" ? "súper vyhrá, mu" : "vyhráš, ti"} dá {uroven}{" "}
            {uroven === 1 ? "špak" : "špaky"}.
            {(m === 0 || m === 6) && " Na krajnej pozícii sa starší prebudí pre vydesujúceho hráča a ráta sa do vydesenia."}
          </>
        )}
      </div>
    </div>
  );
}

/** Limit vykladania = plné poldeci + 1 (pravidlá v4: poldeci s NA EX sa neráta). */
export function UkazkaLimitu() {
  const [plne, setPlne] = useState(2);
  const [vypite, setVypite] = useState(0);
  return (
    <div className="ukazka">
      <div className="ukazka-hlava">Koľko kariet smieš vyložiť v tomto Zhromaždení?</div>
      <div className="limit-ovladanie">
        <Pocitadlo label="Plné poldeci" hodnota={plne} nastav={setPlne} />
        <Pocitadlo label="Vypité poldeci" hodnota={vypite} nastav={setVypite} />
      </div>
      <div className="limit-pohare" aria-hidden="true">
        {Array.from({ length: plne }, (_, i) => <span key={`p${i}`} className="pohar plny" />)}
        {Array.from({ length: vypite }, (_, i) => <span key={`v${i}`} className="pohar vypity" />)}
      </div>
      <div className="ukazka-vysledok" aria-live="polite">
        Limit vykladania = {plne} + 1 = <strong>{plne + 1}</strong> kariet. Vypité poldeci ani poldeci na kartách cez NA EX sa nerátajú.
      </div>
    </div>
  );
}
