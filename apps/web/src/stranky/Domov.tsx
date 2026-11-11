// Úvodná stránka — vejár kariet a rozcestník na tri časti webu.

import type { CSSProperties } from "react";
import { variant, variantyKarty } from "@naex/tvorba";
import { KartaLico } from "../karta/KartaLico.tsx";
import { IkonaPoldeci } from "../hra/Panely.tsx";
import { Odkaz, useTitulok } from "../lib/router.tsx";
import { useSada, vzhladSady } from "../lib/sada.tsx";
import { useUcet } from "../lib/ucet.tsx";
import { VolbaZrejucej } from "../VolbaZrejucej.tsx";
import { HlavaStranky } from "../HlavaStranky.tsx";
import { adresaVyucby, bezPrvejCasti, napisVyucby, rozpracovana, useVyucbaUctu } from "../hra/Vyucba.tsx";
// Len časti scenára (Vite JSON: pomenovaný import, kroky do balíka titulky nejdú).
import { casti as CASTI_VYUCBY } from "@naex/core/data/vyucba/prva-hra.json";
import { dlzkaVyucby } from "./dlzkaVyucby.ts";
import { t, tr } from "../i18n/jazyk.tsx";

const VEJAR = ["pijan", "farar", "krcma"];

export function Domov() {
  useTitulok("");
  const { sada } = useSada();
  const { ja } = useUcet();
  const { vyucba } = useVyucbaUctu(ja !== null);
  // Nováčikovi bez 1. časti výučby je výučba hlavná výzva a Pravidlá druhoradé (#104, Michal 2026-10-26).
  // Prihlásený, kým sa stav výučby nenačíta, vidí bežnú titulku — nech tlačidlá neskáču.
  const novacik = bezPrvejCasti(ja !== null, vyucba);
  const karty = sada === null ? [] : VEJAR.map((id) => sada.karty.find((k) => k.id === id)).filter((k) => k !== undefined);

  return (
    <>
      <HlavaStranky
        nadpis={
          <>
            {tr("domov.nadpis", { naex: <em>Na ex!</em> })}
          </>
        }
        uvod={t("domov.uvod")}
      />
      <section className="hero">
        <div>
          <p className="hero-text">
            {t("domov.hero")}
          </p>
          {novacik ? (
            <div className="riadok-tlacidiel hero-novacik">
              <Odkaz href={adresaVyucby(ja !== null)} className="tlacidlo tlacidlo-hlavne tlacidlo-velke" data-vyucba-vstup="titulka">
                <img src="/melichar.jpg" alt="" width={40} height={40} />
                <span>
                  {napisVyucby(vyucba)}
                  <small>{t("domov.priStole", { dlzka: dlzkaVyucby(CASTI_VYUCBY) })}</small>
                </span>
              </Odkaz>
              <Odkaz href="/hra" className="tlacidlo">
                {ja === null ? t("domov.prihlasSaAHraj") : t("domov.hratTeraz")}
              </Odkaz>
              <Odkaz href="/pravidla" className="hero-pravidla">
                {t("domov.pravidlaNaCitanie")}
              </Odkaz>
            </div>
          ) : (
            <div className="riadok-tlacidiel">
              <Odkaz href="/hra" className="tlacidlo tlacidlo-hlavne">
                {ja === null ? t("domov.prihlasSaAHraj") : t("domov.hratTeraz")}
              </Odkaz>
              {/* Pokusná verzia pre hráčov s oprávnením (Michal 2026-11-02). */}
              <VolbaZrejucej tvar="tlacidlo" />
              {/* Výučba pri stole (Michal 2026-10-23) — /hra?vyucba=1 ju rovno spustí. */}
              {vyucba !== null && vyucba.dostupna && (
                <Odkaz href="/hra?vyucba=1" className="tlacidlo" data-vyucba-vstup="titulka">
                  {rozpracovana(vyucba) ? t("vstup.pokracovat") : t("vstup.prvaHra")}
                </Odkaz>
              )}
              <Odkaz href="/pravidla" className="tlacidlo">
                {t("domov.naucitSa")}
              </Odkaz>
            </div>
          )}
        </div>
        <div className="hero-vejar" aria-hidden="true">
          {sada !== null &&
            karty.map((k, i) => {
              const v = variant(variantyKarty(k), 0);
              if (v === null) return null;
              return (
                <div key={k.id} className="vejar-pozicia" style={{ "--i": i - 1 } as CSSProperties}>
                  <KartaLico karta={k} lava={v.lava} prava={v.prava} vzhlad={vzhladSady(sada)} sirka={250} bezPopisov />
                </div>
              );
            })}
        </div>
      </section>

      <section className="tri-casti">
        <Odkaz href="/pravidla" className="cast">
          <span className="cast-znak" aria-hidden="true">📖</span>
          <h2>{t("domov.naucSaHrat")}</h2>
          <p>{t("domov.naucSaHratText")}</p>
        </Odkaz>
        <Odkaz href="/karty" className="cast">
          <span className="cast-znak" aria-hidden="true">🃏</span>
          <h2>{t("domov.glosar")}</h2>
          <p>{t("domov.glosarText")}</p>
        </Odkaz>
        <Odkaz href="/hra" className="cast">
          <span className="cast-znak" aria-hidden="true">
            <IkonaPoldeci />
          </span>
          <h2>{t("domov.hrajProti")}</h2>
          <p>{t("domov.hrajProtiText")}</p>
        </Odkaz>
      </section>
    </>
  );
}
