// Vstupy do výučby „Prvá hra“: lobby, ponuka pri zakladaní prvej partie a banner na
// Pravidlách (#104, Michal 2026-10-26). Oddelené od výučby pri stole — tá sa testuje bez
// prehliadača a router potrebuje window.

import { useEffect, useRef } from "react";
import { Odkaz } from "../lib/router.tsx";
import { useUcet } from "../lib/ucet.tsx";
import { t, tr } from "../i18n/jazyk.tsx";
import { adresaVyucby, bezPrvejCasti, rozpracovana, useVyucbaUctu, type VyucbaUctu } from "./Vyucba.tsx";

/** Banner hore na Pravidlách pre toho, kto ešte nemá 1. časť výučby (#104) — Pravidlá ostanú príručkou. */
export function VyzvaVyucby() {
  const { ja } = useUcet();
  const { vyucba } = useVyucbaUctu(ja !== null);
  if (!bezPrvejCasti(ja !== null, vyucba)) return null;
  return (
    <aside className="panel vyucba-vyzva" aria-label={t("vstup.aria")}>
      <img className="vyucba-avatar" src="/melichar.jpg" alt="" width={56} height={56} />
      <div>
        <strong>{t("vstup.naucSa")}</strong>
        <span className="tlmene">{t("vstup.pravidlaText")}</span>
      </div>
      <Odkaz href={adresaVyucby(ja !== null)} className="tlacidlo tlacidlo-hlavne" data-vyucba-vstup="pravidla">
        {vyucba !== null && rozpracovana(vyucba) ? t("vstup.pokracovat") : t("vstup.zacat")}
      </Odkaz>
    </aside>
  );
}

/** Čo v lobby povedať o výučbe: kde hráč stojí v častiach (roadmapa #105). */
export function popisVyucbyVLobby(vyucba: VyucbaUctu): string {
  if (vyucba.rozpracovana && vyucba.cast !== null) return t("vstup.rozohrana", { cast: vyucba.cast.cast, nazov: vyucba.cast.nazov });
  if (vyucba.dalsiaCast !== null) {
    const c = vyucba.dalsiaCast;
    return t("vstup.dalsia", { hotova: c.cast - 1, cast: c.cast, nazov: c.nazov, minuty: c.minuty });
  }
  if (vyucba.pripravujeme !== null) return t("vstup.pripravujeme", { hotova: vyucba.pripravujeme.cast - 1, cast: vyucba.pripravujeme.cast, nazov: vyucba.pripravujeme.nazov });
  if (vyucba.stav === "hotova" || vyucba.castiHotove > 0) return t("vstup.hotova");
  return t("vstup.prvaCast");
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
        <h2>{novacik ? t("vstup.naucSa") : t("vstup.prvaHra")}</h2>
        <p className="tlmene">{popisVyucbyVLobby(vyucba)}</p>
        {novacik && (
          <p className="tlmene vyucba-vstup-pravidla">
            {tr("vstup.radsejCitas", { odkaz: <Odkaz href="/pravidla">{t("nav.pravidla")}</Odkaz> })}
          </p>
        )}
      </div>
      <div className="riadok-tlacidiel">
        {pokracuj ? (
          <>
            <button className="tlacidlo-hlavne" onClick={() => zacni(false)} data-vyucba-vstup="pokracovat">
              {vyucba.dalsiaCast !== null ? t("vstup.pokracovatCast", { cast: vyucba.dalsiaCast.cast }) : t("vstup.pokracovat")}
            </button>
            <button onClick={() => zacni(true)}>{t("vstup.zacatOdznova")}</button>
          </>
        ) : (
          <button className="tlacidlo-hlavne" onClick={() => zacni(vyucba.stav !== null)} data-vyucba-vstup="zacat">
            {novacik ? t("vstup.zacat") : t("vstup.znova")}
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
        <h2 id="vyucba-ponuka-nadpis">{t("vstup.najprv")}</h2>
        <p>{t("vstup.najprvText")}</p>
        <div className="riadok-tlacidiel">
          <button ref={hlavne} className="tlacidlo-hlavne" onClick={zacni} data-vyucba-vstup="ponuka">
            {pokracuj ? t("vstup.pokracovat") : t("vstup.naucMa")}
          </button>
          <button onClick={preskoc} data-vyucba-vstup="preskocit">
            {t("vstup.preskocit")}
          </button>
        </div>
        <p className="tlmene vyucba-ponuka-pozn">{t("vstup.kedykolvek")}</p>
      </div>
    </div>
  );
}
