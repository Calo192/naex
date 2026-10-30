// Vstupy do výučby „Prvá hra“: lobby, ponuka pri zakladaní prvej partie a banner na
// Pravidlách (#104, Michal 2026-10-26). Oddelené od výučby pri stole — tá sa testuje bez
// prehliadača a router potrebuje window.

import { useEffect, useRef } from "react";
import { Odkaz } from "../lib/router.tsx";
import { useUcet } from "../lib/ucet.tsx";
import { adresaVyucby, bezPrvejCasti, rozpracovana, useVyucbaUctu, type VyucbaUctu } from "./Vyucba.tsx";

/** Banner hore na Pravidlách pre toho, kto ešte nemá 1. časť výučby (#104) — Pravidlá ostanú príručkou. */
export function VyzvaVyucby() {
  const { ja } = useUcet();
  const { vyucba } = useVyucbaUctu(ja !== null);
  if (!bezPrvejCasti(ja !== null, vyucba)) return null;
  return (
    <aside className="panel vyucba-vyzva" aria-label="Výučba">
      <img className="vyucba-avatar" src="/melichar.jpg" alt="" width={56} height={56} />
      <div>
        <strong>Nauč sa hrať s Majstrom Melicharom — tri časti, spolu asi 35 minút</strong>
        <span className="tlmene">Zahráš si prvé kolo proti Štamgastovi a Melichar ti pri stole povie, čo a prečo. Pravidlá tu počkajú, keď si budeš chcieť niečo dohľadať.</span>
      </div>
      <Odkaz href={adresaVyucby(ja !== null)} className="tlacidlo tlacidlo-hlavne" data-vyucba-vstup="pravidla">
        {vyucba !== null && rozpracovana(vyucba) ? "Pokračovať vo výučbe" : "Začať výučbu"}
      </Odkaz>
    </aside>
  );
}

/** Čo v lobby povedať o výučbe: kde hráč stojí v častiach (roadmapa #105). */
export function popisVyucbyVLobby(vyucba: VyucbaUctu): string {
  if (vyucba.rozpracovana && vyucba.cast !== null) return `Majster Melichar ťa čaká pri stole — rozohranú máš ${vyucba.cast.cast}. časť (${vyucba.cast.nazov}).`;
  if (vyucba.dalsiaCast !== null) {
    const c = vyucba.dalsiaCast;
    return `${c.cast - 1}. časť máš za sebou. ${c.cast}. časť: ${c.nazov}, asi ${c.minuty} minút — začne tam, kde si skončil.`;
  }
  if (vyucba.pripravujeme !== null) return `${vyucba.pripravujeme.cast - 1}. časť máš za sebou. ${vyucba.pripravujeme.cast}. časť (${vyucba.pripravujeme.nazov}) pripravujeme.`;
  if (vyucba.stav === "hotova" || vyucba.castiHotove > 0) return "Výučbu máš za sebou. Ak si chceš pravidlá zopakovať, zahraj si ju znova.";
  return "1. časť: majster Melichar ťa prevedie prvým kolom proti Štamgastovi — Voľba cieľa, Draft, Zhromaždenie, Pitka, Bitka a starší. NA EX! príde v 2. časti. Do štatistík sa neráta.";
}

/**
 * Vstup do výučby v lobby (/hra): „Prvá hra — nauč sa hrať“ alebo „Pokračovať vo výučbe“
 * (rozohraná časť, alebo ďalšia časť od jej začiatku). Nováčikovi bez 1. časti je to
 * najväčšia výzva stránky (#104), Pravidlá len odkaz.
 */
export function VyucbaVLobby({ vyucba, zacni }: { readonly vyucba: VyucbaUctu; readonly zacni: (odznova: boolean) => void }) {
  const pokracuj = rozpracovana(vyucba);
  const novacik = bezPrvejCasti(true, vyucba);
  return (
    <section className={`panel vyucba-vstup${novacik ? " vyzva" : ""}`}>
      <img className="vyucba-avatar" src="/melichar.jpg" alt="" width={novacik ? 88 : 64} height={novacik ? 88 : 64} />
      <div>
        <h2>{novacik ? "Nauč sa hrať s Majstrom Melicharom — tri časti, spolu asi 35 minút" : "Prvá hra — nauč sa hrať"}</h2>
        <p className="tlmene">{popisVyucbyVLobby(vyucba)}</p>
        {novacik && (
          <p className="tlmene vyucba-vstup-pravidla">
            Radšej čítaš? <Odkaz href="/pravidla">Pravidlá</Odkaz> sú tu ako príručka.
          </p>
        )}
      </div>
      <div className="riadok-tlacidiel">
        {pokracuj ? (
          <>
            <button className="tlacidlo-hlavne" onClick={() => zacni(false)} data-vyucba-vstup="pokracovat">
              Pokračovať vo výučbe{vyucba.dalsiaCast !== null ? ` (${vyucba.dalsiaCast.cast}. časť)` : ""}
            </button>
            <button onClick={() => zacni(true)}>Začať odznova</button>
          </>
        ) : (
          <button className="tlacidlo-hlavne" onClick={() => zacni(vyucba.stav !== null)} data-vyucba-vstup="zacat">
            {novacik ? "Začať výučbu" : "Zahrať výučbu znova"}
          </button>
        )}
      </div>
    </section>
  );
}

/**
 * Ponuka „Najprv výučba?“ (#104): návštevník bez 1. časti zakladá prvú partiu — výučba, alebo
 * preskočiť a hra sa založí. Preskočenie si zapíše server, druhýkrát sa už nepýta.
 */
export function PonukaVyucby({ vyucba, zacni, preskoc }: { readonly vyucba: VyucbaUctu; readonly zacni: () => void; readonly preskoc: () => void }) {
  const hlavne = useRef<HTMLButtonElement>(null);
  useEffect(() => hlavne.current?.focus(), []);
  const pokracuj = rozpracovana(vyucba);
  return (
    <div className="vyucba-ponuka-zaves" role="dialog" aria-modal="true" aria-labelledby="vyucba-ponuka-nadpis">
      <div className="vyucba-ponuka panel">
        <img className="vyucba-avatar" src="/melichar.jpg" alt="" width={96} height={96} />
        <h2 id="vyucba-ponuka-nadpis">Najprv výučba?</h2>
        <p>
          Som majster Melichar. Za tri krátke časti ťa naučím hrať NA EX! — každá trvá asi desať minút a dá sa prerušiť. Zahráš si so
          Štamgastom a ja ti poviem, čo a prečo.
        </p>
        <div className="riadok-tlacidiel">
          <button ref={hlavne} className="tlacidlo-hlavne" onClick={zacni} data-vyucba-vstup="ponuka">
            {pokracuj ? "Pokračovať vo výučbe" : "Nauč ma hrať"}
          </button>
          <button onClick={preskoc} data-vyucba-vstup="preskocit">
            Preskočiť, poznám pravidlá
          </button>
        </div>
        <p className="tlmene vyucba-ponuka-pozn">Výučbu nájdeš kedykoľvek hore na stránke Hrať.</p>
      </div>
    </div>
  );
}
