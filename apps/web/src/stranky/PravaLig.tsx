// Ligy (Michal 2026-10-28): čo odomyká Tretiu, Druhú a Prvú ligu — výhry,
// achievement alebo rank, stačí ktorékoľvek. Mení admin
// aj subadmin; prepínač „všetci smú všetky ligy“ pravidlá vypne bez nasadenia.
// Správcovia a AI playtesteri smú vždy všetko. Server ligu overí sám.

import { useEffect, useState } from "react";
import type { DlzkaHry } from "@naex/core";
import { ALL_DLZKY, DLZKY_HRY, NAZOV_DLZKY, NAZOV_DLZKY_GENITIV } from "@naex/core";
import { api } from "../lib/api.ts";
import { NAZOV_UROVNE, RANKY_HRACOV, type Rola } from "../lib/ucet.tsx";
import { Hlaska } from "../komponenty.tsx";
import { tvar } from "./Statistiky.tsx";

interface PravidloLigy {
  readonly podmienka: { readonly liga: DlzkaHry; readonly vyhier: number } | null;
  readonly achievement: { readonly id: string; readonly rank: number } | null;
  readonly ranky: readonly Rola[];
}

interface NastavenieLig {
  readonly vsetkym: boolean;
  readonly ajProtiPocitacu: boolean;
  readonly ligy: Readonly<Record<DlzkaHry, PravidloLigy>>;
  /** Achievementy na výber; null = vypnuté. */
  readonly achievementy?: readonly { readonly id: string; readonly nazov: string; readonly rankov: number }[] | null;
}

/** Rozpísané hodnoty formulára jednej ligy (číslo ako text, kým ho admin píše). */
type Rozpis = Readonly<Record<DlzkaHry, { readonly vyhier: string; readonly liga: DlzkaHry }>>;

const rozpis = (n: NastavenieLig): Rozpis =>
  Object.fromEntries(
    ALL_DLZKY.map((l) => {
      const p = n.ligy[l].podmienka;
      // Bez podmienky ponúkni ligu o stupeň nižšie — admin len dopíše počet výhier.
      const nizsia = ALL_DLZKY[Math.max(0, ALL_DLZKY.indexOf(l) - 1)] ?? l;
      return [l, { vyhier: String(p?.vyhier ?? 0), liga: p?.liga ?? nizsia }];
    }),
  ) as Rozpis;

export function PravaLig() {
  const [n, setN] = useState<NastavenieLig | null>(null);
  const [form, setForm] = useState<Rozpis | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);
  const [ulozene, setUlozene] = useState(false);

  const nacitaj = () =>
    void api
      .get<NastavenieLig>("/admin/ligy")
      .then((r) => {
        setN(r);
        setForm(rozpis(r));
      })
      .catch((e: unknown) => setChyba(e instanceof Error ? e.message : String(e)));
  useEffect(nacitaj, []);

  const uloz = async (telo: object) => {
    setChyba(null);
    setUlozene(false);
    try {
      await api.put("/admin/ligy", telo);
      setUlozene(true);
      nacitaj();
    } catch (e) {
      setChyba(e instanceof Error ? e.message : String(e));
    }
  };

  if (n === null || form === null) return chyba !== null ? <Hlaska>{chyba}</Hlaska> : null;
  const ulozLigu = (l: DlzkaHry, zmena: Partial<PravidloLigy>) => void uloz({ ligy: { [l]: { ...n.ligy[l], ...zmena } } });
  const prepniRank = (l: DlzkaHry, rank: Rola, ma: boolean) => {
    const ranky = n.ligy[l].ranky.filter((r) => r !== rank);
    ulozLigu(l, { ranky: ma ? [...ranky, rank] : ranky });
  };

  return (
    <details className="ranky-prava prava-lig">
      <summary>
        <strong>Ligy</strong> <span className="tlmene">— kto smie hrať Tretiu, Druhú a Prvú ligu</span>
      </summary>
      {chyba !== null && <Hlaska>{chyba}</Hlaska>}
      <p className="tlmene">
        Ligu odomkne počet výhier proti človeku v inej lige (rátajú sa aj partie, ktoré súper vzdal alebo prehral kontumačne; s počítačom nie), achievement
        alebo rank — stačí ktorékoľvek. Bez výhier aj achievementu je liga otvorená každému. Odomknutie sa nevracia — ani keď podmienku neskôr sprísniš.
        Admin, subadmin a účty AI smú vždy všetko.
      </p>
      <div className="prava-lig-prepinace">
        <label>
          <input type="checkbox" checked={n.vsetkym} onChange={() => void uloz({ vsetkym: !n.vsetkym })} /> Všetci smú hrať všetky ligy
          <span className="tlmene"> (pravidlá nižšie sa nevynucujú, len sa zapisuje, čo kto splnil)</span>
        </label>
        <label>
          <input type="checkbox" checked={n.ajProtiPocitacu} onChange={() => void uloz({ ajProtiPocitacu: !n.ajProtiPocitacu })} /> Obmedzenie platí aj
          pre partie proti počítaču
        </label>
        {ulozene && <span className="tlmene">uložené</span>}
      </div>
      <div className="tabulka-obal">
        <table className="tabulka ranky-matica prava-lig-tabulka">
          <thead>
            <tr>
              <th>Liga</th>
              <th>Odomkne výhra proti človeku</th>
              <th>alebo achievement</th>
              {RANKY_HRACOV.map((r) => (
                <th key={r}>{NAZOV_UROVNE[r]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ALL_DLZKY.map((l) => {
              const f = form[l];
              const pravidlo = n.ligy[l];
              const otvorena = pravidlo.podmienka === null && pravidlo.achievement === null;
              const ach = n.achievementy?.find((a) => a.id === pravidlo.achievement?.id);
              const zmenene = f.vyhier !== String(n.ligy[l].podmienka?.vyhier ?? 0) || (n.ligy[l].podmienka !== null && f.liga !== n.ligy[l].podmienka?.liga);
              return (
                <tr key={l} className={n.vsetkym ? "prava-lig-neplati" : undefined}>
                  <td>
                    <strong>{NAZOV_DLZKY[l]}</strong> <span className="tlmene">· {DLZKY_HRY[l]} {tvar(DLZKY_HRY[l], "lokalita", "lokality", "lokalít")}</span>
                  </td>
                  <td>
                    <form
                      className="prava-lig-podmienka"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const vyhier = Number(f.vyhier);
                        ulozLigu(l, { podmienka: { liga: f.liga, vyhier } });
                      }}
                    >
                      <input
                        type="number"
                        min={0}
                        max={999}
                        value={f.vyhier}
                        onChange={(e) => setForm({ ...form, [l]: { ...f, vyhier: e.target.value } })}
                        aria-label={`${NAZOV_DLZKY[l]}: počet výhier`}
                      />
                      <span>{Number(f.vyhier) === 1 ? "výhra" : Number(f.vyhier) >= 2 && Number(f.vyhier) <= 4 ? "výhry" : "výhier"}</span>
                      <select
                        value={f.liga}
                        onChange={(e) => setForm({ ...form, [l]: { ...f, liga: e.target.value as DlzkaHry } })}
                        aria-label={`${NAZOV_DLZKY[l]}: v ktorej lige`}
                      >
                        {ALL_DLZKY.filter((x) => x !== l).map((x) => (
                          <option key={x} value={x}>
                            {NAZOV_DLZKY_GENITIV[x]}
                          </option>
                        ))}
                      </select>
                      {zmenene && <button type="submit">uložiť</button>}
                      {Number(f.vyhier) === 0 && <span className="tlmene">{otvorena ? "= otvorená každému" : "= bez výhier"}</span>}
                    </form>
                  </td>
                  <td>
                    {n.achievementy == null ? (
                      <span className="tlmene">achievementy sú vypnuté</span>
                    ) : (
                      <div className="prava-lig-podmienka">
                        <select
                          value={pravidlo.achievement?.id ?? ""}
                          onChange={(e) => ulozLigu(l, { achievement: e.target.value === "" ? null : { id: e.target.value, rank: 1 } })}
                          aria-label={`${NAZOV_DLZKY[l]}: achievement`}
                        >
                          <option value="">— žiadny —</option>
                          {n.achievementy.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.nazov}
                            </option>
                          ))}
                        </select>
                        {ach !== undefined && ach.rankov > 1 && pravidlo.achievement !== null && (
                          <select
                            value={pravidlo.achievement.rank}
                            onChange={(e) => ulozLigu(l, { achievement: { id: ach.id, rank: Number(e.target.value) } })}
                            aria-label={`${NAZOV_DLZKY[l]}: rank achievementu`}
                          >
                            {Array.from({ length: ach.rankov }, (_, i) => i + 1).map((r) => (
                              <option key={r} value={r}>
                                {"★".repeat(r)}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    )}
                  </td>
                  {RANKY_HRACOV.map((r) => {
                    const ma = n.ligy[l].ranky.includes(r);
                    return (
                      <td key={r}>
                        <input
                          type="checkbox"
                          checked={ma || otvorena}
                          disabled={otvorena}
                          onChange={() => prepniRank(l, r, !ma)}
                          aria-label={`${NAZOV_UROVNE[r]} smie ${NAZOV_DLZKY[l]} vždy`}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="tlmene">Zaškrtnutý rank smie ligu hrať aj bez výhier a achievementu.</p>
    </details>
  );
}
