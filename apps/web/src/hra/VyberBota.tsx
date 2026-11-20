// Výber súpera proti počítaču (Michal 2026-11-06): ponúkne sa až po voľbe hry proti počítaču.
import { useEffect, useRef, type Ref } from "react";
import { Avatar } from "../komponenty.tsx";
import { t, tZoServera } from "../i18n/jazyk.tsx";
import type { BotNaVyber } from "./boti.ts";

/** Dlaždice povah a na konci Náhodný súper; klik = hraj. Bez hookov — test ich volá priamo. */
export function DlazdiceBotov({
  boti,
  vypnute,
  hraj,
  prvy,
}: {
  readonly boti: readonly BotNaVyber[];
  readonly vypnute: boolean;
  readonly hraj: (povaha: string | null) => void;
  readonly prvy: Ref<HTMLButtonElement> | null;
}) {
  return (
    <>
      {boti.map((b, i) => (
        <button key={b.id} ref={i === 0 ? prvy : undefined} type="button" className="bot-volba" disabled={vypnute} onClick={() => hraj(b.id)}>
          <Avatar meno={b.meno} avatar={b.avatar} velkost={40} />
          <span className="bot-volba-text">
            <strong>{b.meno}</strong>
            {b.popis !== null && <span>{tZoServera(`bot.${b.id}`, b.popis)}</span>}
          </span>
        </button>
      ))}
      <button type="button" className="bot-volba bot-nahodny" disabled={vypnute} onClick={() => hraj(null)} data-hrat-bot-start="">
        <span className="bot-nahodny-znak" aria-hidden="true">
          ?
        </span>
        <span className="bot-volba-text">
          <strong>{t("bot.nahodnySuper")}</strong>
          <span>{t("bot.nahodnyPopis")}</span>
        </span>
      </button>
    </>
  );
}

/**
 * Klik na dlaždicu rovno začne partiu (UI inšpekcia W-19); náhodný súper je posledná dlaždica,
 * nie veta pod nimi. Id povahy je zo zoznamu servera, ktorý ho pri založení overí.
 */
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
  const prvy = useRef<HTMLButtonElement>(null);
  useEffect(() => prvy.current?.focus(), []);
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
        <h2 id="vyber-bota-nadpis">{t("bot.nadpis")}</h2>
        <div className="vyber-bota" role="group" aria-label={t("bot.skupina")}>
          <DlazdiceBotov boti={boti} vypnute={vypnute} hraj={hraj} prvy={prvy} />
        </div>
        <div className="riadok-tlacidiel">
          <button type="button" onClick={zavri}>
            {t("bot.spat")}
          </button>
        </div>
      </div>
    </div>
  );
}
