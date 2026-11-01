// Upozornenie pred stolom na telefóne (Michal 2026-11-01): hra nie je pre telefón optimalizovaná
// a časť toho, čo je na počítači, tu chýba. Ukáže sa pri každej partii, kým hráč nezaškrtne
// „Neukazovať znova“ — to si pamätá telefón, nie účet (na počítači upozornenie nepatrí).
// „Rozumiem“ je zároveň gesto, ktoré zapne celú obrazovku — výzva na ňu potom netreba.

import { useState } from "react";
import { Medziobrazovka } from "./Medziobrazovka.tsx";
import "./upozornenie-telefonu.css";

const KLUC_SKRYTE = "naex-telefon-upozornenie-skryte";

/** Čo na telefóne chýba oproti počítaču (mobil-sirka.css skrýva os, toasty stola, tipy a skratky). */
export const CHYBA_NA_TELEFONE: readonly string[] = [
  "časová os kola s fázami,",
  "priebežný účet bitky a oznamy o priazni priamo na stole — povie ich až súhrn bitky a Log,",
  "nápovedy pri prejdení myšou — na telefóne len niektoré, cez ťuk,",
  "klávesové skratky.",
];

export function upozornenieSkryte(): boolean {
  try {
    return localStorage.getItem(KLUC_SKRYTE) === "1";
  } catch {
    return false;
  }
}

function skryUpozornenie(): void {
  try {
    localStorage.setItem(KLUC_SKRYTE, "1");
  } catch {
    // súkromné okno bez úložiska — upozornenie príde znova pri ďalšej partii
  }
}

/** `rozumiem(true)` = hráč zaškrtol „Neukazovať znova“ (už je uložené v telefóne). */
export function UpozornenieTelefonu({ rozumiem }: { readonly rozumiem: (neukazovat: boolean) => void }) {
  const [neukazovat, setNeukazovat] = useState(false);
  const potvrd = (): void => {
    if (neukazovat) skryUpozornenie();
    rozumiem(neukazovat);
  };
  return (
    <Medziobrazovka
      obsah={{
        kluc: "telefon",
        nadnadpis: "Upozornenie",
        nadpis: "Hra na telefóne",
        text: "Hra zatiaľ nie je optimalizovaná pre telefón. Niektoré informácie, ktoré sú na počítači, na telefóne chýbajú:",
      }}
      onRozumiem={potvrd}
      vypinac={false}
      trieda="upozornenie-telefonu"
    >
      <ul className="upozornenie-telefonu-chyba">
        {CHYBA_NA_TELEFONE.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      <p className="upozornenie-telefonu-rada">Pre plný zážitok hraj na počítači.</p>
      <label className="upozornenie-telefonu-volba">
        <input type="checkbox" checked={neukazovat} onChange={(e) => setNeukazovat(e.target.checked)} />
        Neukazovať znova
      </label>
    </Medziobrazovka>
  );
}
