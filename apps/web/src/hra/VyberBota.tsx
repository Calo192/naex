// Výber súpera proti počítaču (Michal 2026-11-06): ponúkne sa až po voľbe hry proti počítaču.
import { useEffect, useRef, useState } from "react";
import { Avatar } from "../komponenty.tsx";
import { platnaVolbaBota, type BotNaVyber } from "./boti.ts";

/** Okno sa otvára vždy s Náhodným: kto si nevyberie, hrá proti náhodnému botovi. */
export function VyberBota({
  boti,
  vypnute,
  hraj,
  zavri,
}: {
  readonly boti: readonly BotNaVyber[];
  readonly vypnute: boolean;
  /** null = Náhodný, server losuje. */
  readonly hraj: (povaha: string | null) => void;
  readonly zavri: () => void;
}) {
  const [volba, setVolba] = useState<string | null>(null);
  const zvoleny = platnaVolbaBota(boti, volba);
  const hlavne = useRef<HTMLButtonElement>(null);
  useEffect(() => hlavne.current?.focus(), []);
  const moznosti: readonly (BotNaVyber & { readonly volba: string | null })[] = [
    { id: "nahodny", volba: null, meno: "Náhodný", popis: "Koho dostaneš, uvidíš až pri stole.", avatar: null },
    ...boti.map((b) => ({ ...b, volba: b.id })),
  ];
  return (
    <div
      className="vyber-bota-zaves"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vyber-bota-nadpis"
      onClick={(e) => {
        if (e.target === e.currentTarget) zavri();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") zavri();
      }}
    >
      <div className="vyber-bota-okno panel">
        <h2 id="vyber-bota-nadpis">S kým si sadneš?</h2>
        <div className="vyber-bota" role="radiogroup" aria-label="Súper proti počítaču">
          {moznosti.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={zvoleny === m.volba}
              className={`bot-volba ${zvoleny === m.volba ? "aktivna" : ""}`}
              onClick={() => setVolba(m.volba)}
            >
              <Avatar meno={m.volba === null ? "?" : m.meno} avatar={m.avatar} velkost={40} />
              <span className="bot-volba-text">
                <strong>{m.meno}</strong>
                {m.popis !== null && <span>{m.popis}</span>}
              </span>
            </button>
          ))}
        </div>
        <div className="riadok-tlacidiel">
          <button ref={hlavne} type="button" className="tlacidlo-hlavne" disabled={vypnute} onClick={() => hraj(zvoleny)} data-hrat-bot-start="">
            Hrať
          </button>
          <button type="button" onClick={zavri}>
            Späť
          </button>
        </div>
      </div>
    </div>
  );
}
