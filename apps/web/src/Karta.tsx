// Karta ako DOM prvok (BRIEF: žiadne plátno — texty efektov sádže prehliadač).
//
// Otočená karta (nohami hore voči partii) sa nekreslí hore nohami — text by
// bol nečitateľný. Namiesto toho sa zobrazujú jej EFEKTÍVNE strany (vymenené
// a s obráteným poradím indexov) + odznak ⟳. Funkčne je to to isté, čo hráč
// vidí na stole z pohľadu partie.

import type { Action, CardLineEval, CardInstance, SlotEval } from "@naex/core";
import { printedSides } from "@naex/core";
import { DATA } from "./data.ts";

const SKRATKY: Record<Action, string> = {
  Rana: "R",
  Pecka: "P₂",
  Petelica: "P₃",
  Povera: "Pv",
  Pohoršenie: "Ph",
  Viera: "Vi",
  Dlh: "D",
  PoškodeniePečene: "Pč",
  Obmedzenie: "Ob",
  Cigaretka: "Ci",
  Vízia: "Vz",
  Poldeci: "Pd",
  Posilnenie: "＋",
  Odpor: "✕",
};

interface SlotView {
  readonly action: Action | null;
  readonly eval_: SlotEval | null;
}

function slotClass(slot: SlotView): string {
  if (slot.action === null) return "slot prazdny";
  const stav = slot.eval_?.stav;
  if (stav === "aktivna") return "slot aktivna";
  if (stav === "zrusena") return "slot zrusena";
  return "slot";
}

function SlotCell({ slot }: { slot: SlotView }) {
  const nasobok = slot.eval_?.nasobok ?? 0;
  return (
    <div className={slotClass(slot)} title={slot.action ?? "prázdny slot"}>
      {slot.action !== null && (
        <>
          {SKRATKY[slot.action]}
          {nasobok > 1 && <sup>×{nasobok}</sup>}
        </>
      )}
    </div>
  );
}

export interface KartaProps {
  readonly card: CardInstance;
  /** Otočená o 180° voči partii, v ktorej leží. */
  readonly rotated?: boolean;
  readonly evalInfo?: CardLineEval | null;
  readonly naexBy?: 0 | 1 | undefined;
  readonly onClick?: (() => void) | undefined;
  readonly selected?: boolean;
  readonly mala?: boolean;
}

export function Karta({ card, rotated = false, evalInfo, naexBy, onClick, selected, mala }: KartaProps) {
  const def = DATA.cards.get(card.defId);
  if (def === undefined) return <div className="karta">?</div>;
  const printed = printedSides(DATA, card);

  // Efektívne strany pre zobrazenie; vyhodnotenie je vo vytlačenom ráme,
  // takže sa mapuje rovnakým obratom: eff ľavá[k] = vytlačená pravá[3-k].
  const slot = (side: "left" | "right", k: number): SlotView => {
    const [pSide, pIdx] = rotated
      ? ([side === "left" ? "right" : "left", 3 - k] as const)
      : ([side, k] as const);
    return {
      action: printed[pSide][pIdx as 0 | 1 | 2 | 3],
      eval_: evalInfo?.[pSide]?.[pIdx] ?? null,
    };
  };

  const classes = ["karta"];
  if (onClick !== undefined) classes.push("klikatelna");
  if (selected === true) classes.push("vybrana");
  if (evalInfo?.vzbura === true) classes.push("vzbura");
  if (mala === true) classes.push("mala");

  return (
    <div className={classes.join(" ")} onClick={onClick}>
      <div className="strana lava">
        {[0, 1, 2, 3].map((k) => (
          <SlotCell key={k} slot={slot("left", k)} />
        ))}
      </div>
      <div className="telo">
        <div className="nazov">
          {def.name}
          {rotated && <span className="otocena" title="otočená o 180° (nohami hore)"> ⟳</span>}
          {naexBy !== undefined && (
            <span className="naex" title={`NA EX — poldeci hráča ${naexBy + 1}`}>
              {" "}🥃
            </span>
          )}
        </div>
        {mala !== true && (
          <>
            <div className="tagy">{def.tags.join(" · ")}</div>
            <div className="efekt">{def.effectText}</div>
          </>
        )}
      </div>
      <div className="strana prava">
        {[0, 1, 2, 3].map((k) => (
          <SlotCell key={k} slot={slot("right", k)} />
        ))}
      </div>
    </div>
  );
}
