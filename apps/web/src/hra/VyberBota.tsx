// Výber súpera proti počítaču (Michal 2026-11-06): ponúkne sa až po voľbe hry proti počítaču.
import { useEffect, useRef, useState } from "react";
import { Avatar } from "../komponenty.tsx";
import { platnaVolbaBota, prepniVolbuBota, type BotNaVyber } from "./boti.ts";

/** Na výber sú len boti; kto nikoho neoznačí, hrá proti náhodnému. Okno sa otvára vždy bez označenia. */
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
        <div className="vyber-bota" role="group" aria-label="Súper proti počítaču">
          {boti.map((b) => (
            <button
              key={b.id}
              type="button"
              aria-pressed={zvoleny === b.id}
              className={`bot-volba ${zvoleny === b.id ? "aktivna" : ""}`}
              onClick={() => setVolba(prepniVolbuBota(zvoleny, b.id))}
            >
              <Avatar meno={b.meno} avatar={b.avatar} velkost={40} />
              <span className="bot-volba-text">
                <strong>{b.meno}</strong>
                {b.popis !== null && <span>{b.popis}</span>}
              </span>
            </button>
          ))}
        </div>
        <p className="tlmene vyber-bota-pozn">Ak nikoho neoznačíš, dostaneš náhodného súpera.</p>
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
