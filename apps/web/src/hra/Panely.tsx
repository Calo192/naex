// Panely hernej plochy: doska hráča (zdroje), odhad/výsledok bitky,
// priebeh kola. Ukazovatele starších sú v Scorecard.tsx.
//
// Zásada: každé číslo, od ktorého závisí rozhodnutie (poldeci, cigarety,
// pečeň, dlhy, poškodenie), je veľké, pomenované a vždy na tom istom mieste.

import type { ReactNode } from "react";
import type {
  Action,
  ActionSums,
  ClientState,
  DamageResult,
  PlayerId,
  RozpisPoskodenia,
  StavZavislosti,
  ZdrojeAkcii,
} from "@naex/core";
import { KONSTANTY, battleOutcome, textNeresti as neresti, jeCielLokalita, limitBuduceKolo, limitZhromazdenia } from "@naex/core";
import type { Sada } from "@naex/tvorba";
import { IkonaAkcie } from "../karta/IkonaAkcie.tsx";
import { useTip, type TipObsah } from "../karta/Tip.tsx";
import { Avatar } from "../komponenty.tsx";
import type { HracInfo } from "./useHra.ts";

// ---- ikony zdrojov -----------------------------------------------------------

/** Poldeci ako pohárik: plný s jantárovou pálenkou, vypitý prázdny. */
export function IkonaPoldeci({ plny }: { readonly plny: boolean }) {
  return (
    <svg className={`ikona-poldeci ${plny ? "plny" : "vypity"}`} viewBox="0 0 24 32" aria-hidden="true">
      {plny && <path className="palenka" d="M4.1 10h15.8l-1.6 18.6H5.7z" />}
      <path className="pohar" d="M2.5 2.5h19l-2.4 27.5H4.9z" />
      <path className="odlesk" d="M6 6l1.3 20" />
    </svg>
  );
}

export function IkonaCigareta() {
  return (
    <svg className="ikona-cigareta" viewBox="0 0 44 12" aria-hidden="true">
      <rect className="tabak" x="3" y="2.5" width="27" height="7" rx="1" />
      <rect className="filter" x="30" y="2.5" width="11" height="7" rx="1" />
      <rect className="ohen" x="0.5" y="2.5" width="3" height="7" rx="1" />
    </svg>
  );
}

/** Absťák: prázdny pohárik v trasúcej sa ruke. */
export function IkonaAbstak() {
  return (
    <svg className="ikona-abstak" viewBox="0 0 30 30" aria-hidden="true">
      <path className="trasenie" d="M3 9q-2 3 0 6M5.5 7q-2.5 5 0 10M27 9q2 3 0 6M24.5 7q2.5 5 0 10" />
      <path className="pohar" d="M9 4h12l-1.8 21H10.8z" />
      <path className="kvapka" d="M15 13.5c-1.4 2-2 3-2 4a2 2 0 0 0 4 0c0-1-.6-2-2-4z" />
    </svg>
  );
}

// ---- doska hráča --------------------------------------------------------------

/**
 * Neresti kola proti minulému: dieliky po čiaru minulého kola treba
 * zaplniť, aby Absťák nepribudol; dielik za čiarou jeden Absťák zoberie.
 */
function NerestiPruh({ z }: { readonly z: StavZavislosti }) {
  const prve = z.vyhlad === "zaklad";
  const dieliky = prve ? Math.max(z.teraz, 1) : Math.max(z.minule + 1, z.teraz);
  return (
    <span className="neresti-pruh" aria-hidden="true">
      {Array.from({ length: dieliky }, (_, i) => {
        const plny = i < z.teraz;
        const trieda = prve
          ? plny ? "plny" : ""
          : i < z.minule
            ? plny ? "plny" : "chyba"
            : plny ? "plny nad" : "nad";
        return (
          <span key={i} className={trieda}>
            {!prve && i === z.minule && <i className="ciara" />}
          </span>
        );
      })}
    </span>
  );
}

/** Krátky výhľad pod počítadlom a jeho trieda (farba). */
function vyhladAbstaku(z: StavZavislosti, ja: boolean): { text: string; trieda: string } {
  switch (z.vyhlad) {
    case "zaklad":
      return { text: "1. kolo nastaví základ", trieda: "" };
    case "ziska":
      return { text: `hrozí +1 · chýba ${neresti(z.doBezpecia)}`, trieda: "zly" };
    case "zbavi":
      return { text: `${ja ? "zbavíš" : "zbaví"} sa 1 na konci kola`, trieda: "dobry" };
    case "nic":
      return z.doZbavenia > 0
        ? { text: `bez zmeny · ešte ${neresti(z.doZbavenia)} = −1`, trieda: "" }
        : { text: "bez zmeny", trieda: "" };
  }
}

/** Absťák na doske: koľko ich má, čo robia, neresti kola a čo bude na konci kola. */
function ZdrojAbstak({ z, ja }: { readonly z: StavZavislosti; readonly ja: boolean }) {
  const vyhlad = vyhladAbstaku(z, ja);
  const ty = ja ? "ti" : "mu";
  return (
    <Zdroj
      nazov="Absťák"
      trieda={`zdroj-abstak ${z.vyhlad === "ziska" ? "varovanie" : ""} ${z.abstaky > 0 ? "ma-abstak" : ""}`}
      ikona={<IkonaAbstak />}
      hodnota={
        <span className="velke-cislo">
          {z.abstaky}
          {z.ubera > 0 && <small className="abstak-ubera"> −{z.ubera} tuhé</small>}
        </span>
      }
      pod={
        <>
          <span className="neresti-pocet">
            neresti {z.teraz}
            {z.vyhlad !== "zaklad" && <> / minule {z.minule}</>}
          </span>
          <NerestiPruh z={z} />
          <span className={`abstak-vyhlad ${vyhlad.trieda}`}>{vyhlad.text}</span>
        </>
      }
      tip={{
        nadpis: `Absťák — ${ja ? "máš" : "má"} ${z.abstaky}`,
        text: (
          <>
            <span className="tip-stav">
              {z.abstaky === 0
                ? `Teraz ${ty} Absťák v bitke nič neuberá.`
                : `V bitke ${ty} ${z.abstaky === 1 ? "uberie" : "uberú"} ${z.ubera} tuhé poškodenie${z.autobusar ? " (Autobusár 1 ignoruje)" : ""} — trasú sa ${ty} ruky.`}
            </span>
            <span className="tip-riadok">
              <b>Kedy príde a odíde:</b> na konci kola, po bitke, sa porovnajú neresti tohto kola s minulým.{" "}
              <b>Menej</b> → +1 Absťák (rovno priznaný, dobereš si za neho kartu). <b>Rovnako</b> → nič. <b>Viac</b> → jeden
              Absťák odíde. Prvé kolo len nastaví základ.
              {z.manzelky > 0 &&
                ` Milujúca manželka (${z.manzelky}×): Absťák príde aj pri ${z.manzelky === 1 ? "rovnakom počte nerestí" : `o ${z.manzelky - 1} viac nerestiach`} ako minule.`}
            </span>
            <span className="tip-riadok">
              <b>Nerest je:</b> každý vypitý poldeci v Zhromaždení (ďalšia karta v ťahu), NA EX (poldeci sa vypije v bitke),
              každá vyfajčená cigareta, doliatie poldeci (2) a stokársky barter (za každú cigaretu). Platba za šenok,
              Dedičstvo a Starostu sa nepočíta.
            </span>
            <span className="tip-riadok">
              <b>Toto kolo:</b> {neresti(z.teraz)}
              {z.naexNaStole > 0 && ` (z toho ${z.naexNaStole} NA EX na stole)`}
              {z.vyhlad === "zaklad"
                ? ". Je to prvé kolo — určí, koľko nerestí bude treba v druhom."
                : `, minulé kolo ${neresti(z.minule)}. ${
                    z.vyhlad === "ziska"
                      ? `Bez ďalších ${neresti(z.doBezpecia)} ${ja ? "dostaneš" : "dostane"} Absťák.`
                      : z.vyhlad === "zbavi"
                        ? `${ja ? "Zbavíš" : "Zbaví"} sa jedného Absťáku.`
                        : z.doZbavenia > 0
                          ? `Absťák nepribudne; ešte ${neresti(z.doZbavenia)} a jeden odíde.`
                          : "Absťák nepribudne."
                  }`}
            </span>
            <span className="tip-riadok">
              <b>Krčmárka</b> (ak ju máš): bez Absťáku a bez NA EX v kole otočí pri bitke vypitý poldeci na plný.
            </span>
          </>
        ),
      }}
    />
  );
}

/** Pruh z dielikov: koľko zostáva do prahu (pečeň → Cirhóza, Dlhy → Exekútor). */
function Pruh({ hodnota, prah }: { readonly hodnota: number; readonly prah: number }) {
  const dieliky = Math.max(prah, 1);
  const blizko = hodnota >= prah - 1;
  return (
    <span className={`pruh ${blizko ? "blizko" : ""}`} aria-hidden="true">
      {Array.from({ length: dieliky }, (_, i) => (
        <span key={i} className={i < hodnota ? "plny" : ""} />
      ))}
    </span>
  );
}

/** Zdroj na doske; nápoveda sa ukáže pri prejdení myšou (ako tooltipy kariet). */
function Zdroj({
  nazov,
  hodnota,
  ikona,
  pod,
  trieda,
  tip,
}: {
  readonly nazov: string;
  readonly hodnota: ReactNode;
  readonly ikona?: ReactNode;
  readonly pod?: ReactNode;
  readonly trieda?: string;
  readonly tip: TipObsah;
}) {
  const { tip: okno, ukaz, skry } = useTip();
  return (
    <div
      className={`zdroj ${trieda ?? ""}`}
      tabIndex={0}
      onMouseEnter={(e) => ukaz(e.currentTarget, tip)}
      onMouseLeave={skry}
      onFocus={(e) => ukaz(e.currentTarget, tip)}
      onBlur={skry}
    >
      <span className="zdroj-nazov">{nazov}</span>
      <span className="zdroj-hodnota">
        {ikona}
        {hodnota}
      </span>
      {pod !== undefined && <span className="zdroj-pod">{pod}</span>}
      {okno}
    </div>
  );
}

/** Rola hráča v kole pod menom — nenápadný riadok s nápovedou, nie bublina. */
function Rola({ utoci, tip, frajerina }: { readonly utoci: boolean; readonly tip: TipObsah; readonly frajerina: number | undefined }) {
  const { tip: okno, ukaz, skry } = useTip();
  return (
    <span className={`doska-rola ${utoci ? "utocnik" : "obranca"}`} onMouseEnter={(e) => ukaz(e.currentTarget, tip)} onMouseLeave={skry}>
      {utoci ? "⚔ útočník" : "⛨ obranca"}
      {frajerina !== undefined && <span className="doska-frajerina" title="Frajerina">{frajerina}</span>}
      {okno}
    </span>
  );
}

export interface HracDoskaProps {
  readonly view: ClientState;
  readonly p: PlayerId;
  readonly info: HracInfo | null;
  readonly prahy: { readonly cirhoza: number; readonly dlh: number; readonly exekutor: number; readonly priznaneDlhy: number };
  /** Absťáky, neresti kola a výhľad na koniec kola (stavZavislosti). */
  readonly zavislost: StavZavislosti;
  readonly menoKarty: (defId: string) => string;
  readonly popisKarty: (defId: string) => string;
  /** Doliatie a nový poldeci za cigarety — len na tvojej doske (Michal 2026-10-18: nedali sa nájsť). */
  readonly obchodCigariet?:
    | { readonly mozno: boolean; readonly doliat: () => void; readonly novy: () => void; readonly cenaBarteru: number }
    | undefined;
}

/**
 * Doska hráča. Obe dosky sú v jednom rade — tvoja vľavo, súperova vpravo
 * a zrkadlovo: od stredu obrazovky poldeci, cigarety, Absťák… smerom
 * k portrétu na okraji (Michal 2026-10-20). Bez bubliniek so stavom — kto je
 * na ťahu, ukazuje stôl a pokyn, NA EX vidno na poldeci.
 */
export function HracDoska({ view, p, info, prahy, zavislost, menoKarty, popisKarty, obchodCigariet }: HracDoskaProps) {
  const hrac = view.hraci[p];
  const ja = p === view.ja;
  const meno = info?.meno ?? `Hráč ${p + 1}`;
  // Stavbu šenku hrajú obaja naraz — „na ťahu“ je každý, kto ešte nevybral.
  const naTahu =
    view.koniec === null && (view.faza === "draft" && view.draftStav?.krok === "stavba" ? !view.draftStav.vybral[p] : view.naTahu === p);
  const naexNaStole = view.strany[0].concat(view.strany[1]).filter((pl) => pl.naexBy === p).length;
  // Limit, s ktorým hráč vstupuje do Zhromaždenia (so Zastávkou, Vínkom a NA EX na stole).
  const limit = limitZhromazdenia(view, p);
  const buduci = limitBuduceKolo(view, p);
  const kto = ja ? "Máš" : "Má";
  const utoci = view.utocnik === p;

  const poldeci: ReactNode[] = [];
  for (let i = 0; i < hrac.poldeciPlne; i++) poldeci.push(<IkonaPoldeci key={`p${i}`} plny />);
  for (let i = 0; i < hrac.poldeciVypite; i++) poldeci.push(<IkonaPoldeci key={`v${i}`} plny={false} />);

  return (
    <section className={`doska ${ja ? "moja" : "superova"} ${naTahu ? "na-tahu" : ""}`} aria-label={`Hráč ${meno}`}>
      <div className="doska-hrac">
        <Avatar meno={meno} avatar={info?.avatar ?? null} velkost={60} />
        <div>
          <strong className="doska-meno">
            {meno} {ja && <span className="tlmene">(ty)</span>}
          </strong>
          <Rola
            utoci={utoci}
            tip={
              utoci
                ? { nadpis: "Útočník", text: "Prehral poslednú bitku: zo šenku berie prvý a vykladá prvý. Pri remíze v tuhom aj celkovom poškodení prehráva." }
                : { nadpis: "Obranca", text: "Vyhral poslednú bitku: vyberá a natáča cieľ kola, v Pitke začína. Pri remíze v tuhom aj celkovom poškodení vyhráva." }
            }
            frajerina={info?.frajerina}
          />
        </div>
      </div>

      <div className="doska-zdroje">
        <Zdroj
          nazov="Poldeci"
          trieda="zdroj-poldeci"
          hodnota={
            <>
              <span className="poldeci-rad">{poldeci.length > 0 ? poldeci : "—"}</span>
              <span className="velke-cislo">{hrac.poldeciPlne}</span>
            </>
          }
          pod={
            <>
              plné · {hrac.poldeciVypite} vypité{naexNaStole > 0 && ` · ${naexNaStole} na stole`} · <b>limit {limit}</b>
            </>
          }
          tip={{
            nadpis: "Poldeci",
            text: (
              <>
                {kto} {hrac.poldeciPlne} plné a {hrac.poldeciVypite} vypité
                {naexNaStole > 0 ? `, ${naexNaStole} leží na stole cez NA EX` : ""}.
                <span className="tip-stav">
                  {jeCielLokalita(view, "zastavka")
                    ? `Limit vykladania: Zastávka — spoločný pre oboch, ${limit} (súčet limitov oboch hráčov)`
                    : `Limit vykladania = plné + na stole + 1 = ${limit}`}
                </span>
                <span className="tip-riadok">
                  V ďalšom kole limit {buduci}: poldeci z NA EX sa pri bitke vypijú a na začiatku kola sa{" "}
                  {KONSTANTY.POLDECI_NA_ZACIATKU_KOLA} vypitý doleje sám (bez akcie Poldeci a doliatia cigaretami).
                </span>
                <span className="tip-riadok">
                  V Pitke položíš plný poldeci na Občana alebo Starešinu (NA EX!): zdvojnásobí neaktívne akcie
                  karty a zruší jej aktívne. V Zhromaždení ťa plný poldeci stojí každá ďalšia karta v tom istom ťahu.
                  Vypitý doleješ za {KONSTANTY.REFILL_CENA} cigarety (nie s Vínkom v Dedičstve), nový získaš barterom ({KONSTANTY.BARTER_CENA}{" "}
                  cigariet, s priazňou Lakomca menej).
                </span>
              </>
            ),
          }}
        />
        <Zdroj
          nazov="Cigarety"
          trieda="zdroj-cigarety"
          ikona={<IkonaCigareta />}
          hodnota={<span className="velke-cislo">{hrac.cigarety}</span>}
          pod={
            obchodCigariet === undefined ? (
              hrac.cigarety >= KONSTANTY.BARTER_CENA ? "stačí na nový poldeci" : `${KONSTANTY.BARTER_CENA - hrac.cigarety} do nového poldeci`
            ) : (
              <span className="obchod-cigariet">
                <button
                  disabled={!obchodCigariet.mozno || hrac.cigarety < KONSTANTY.REFILL_CENA || hrac.poldeciVypite === 0}
                  title={
                    obchodCigariet.mozno
                      ? `Za ${KONSTANTY.REFILL_CENA} cigarety otočíš vypitý poldeci na plný.`
                      : "Doliať poldeci sa dá v Pitke na tvojom ťahu."
                  }
                  onClick={obchodCigariet.doliat}
                >
                  doliať −{KONSTANTY.REFILL_CENA}
                </button>
                <button
                  disabled={!obchodCigariet.mozno || hrac.cigarety < obchodCigariet.cenaBarteru}
                  title={
                    obchodCigariet.mozno
                      ? `Za ${obchodCigariet.cenaBarteru} cigariet nový plný poldeci navyše (natrvalo o jeden viac).`
                      : "Nový poldeci za cigarety sa kupuje v Pitke na tvojom ťahu."
                  }
                  onClick={obchodCigariet.novy}
                >
                  nový poldeci −{obchodCigariet.cenaBarteru}
                </button>
              </span>
            )
          }
          tip={{
            nadpis: "Cigarety",
            text: (
              <>
                {kto} {hrac.cigarety} {hrac.cigarety === 1 ? "cigaretu" : hrac.cigarety >= 2 && hrac.cigarety <= 4 ? "cigarety" : "cigariet"}.
                <span className="tip-riadok">
                  Získavaš ich z aktívnych akcií Cigareta v Pitke (mínus súperove Obmedzenia) a prenášajú sa z kola na kolo.
                  Platíš nimi šenok (1 karta = {KONSTANTY.CENA_SENKU[1]}, 2 karty = {KONSTANTY.CENA_SENKU[2]}) a Dedičstvo (cena rastie pre oboch).
                  Fajčiť smieš na svojom ťahu v Zhromaždení aj v Pitke: cigareta = karta hneď. V Pitke {KONSTANTY.REFILL_CENA} cigarety dolejú
                  vypitý poldeci, {KONSTANTY.BARTER_CENA} (s priazňou Lakomca menej) vymeníš za nový plný (stokársky barter). Na konci hry bod za každé{" "}
                  {KONSTANTY.CIGARIET_NA_KUS}, ak to dovolí scorecard.
                </span>
              </>
            ),
          }}
        />
        <ZdrojAbstak z={zavislost} ja={ja} />
        <Zdroj
          nazov="Pečeň"
          trieda={`zdroj-pecen ${hrac.pecen >= prahy.cirhoza - 1 ? "varovanie" : ""}`}
          hodnota={
            <span className="velke-cislo">
              {hrac.pecen}
              <small>/{prahy.cirhoza}</small>
            </span>
          }
          pod={<Pruh hodnota={hrac.pecen} prah={prahy.cirhoza} />}
          tip={{
            nadpis: "Poškodenie pečene",
            text: (
              <>
                {hrac.pecen} z {prahy.cirhoza}. Vyhodnocuje sa len v Pitke: pri dosiahnutí prahu vzniká Cirhóza (priznaná dá súperovi v bitke +1 tuhé
                poškodenie) a <b>po každej Pitke sa pečeň vynuluje</b>.
                <span className="tip-riadok">
                  Pribúda akciami Poškodenie pečene a Poldeci a NA EX v Pitke; poldeci vypitý v Zhromaždení ju pripíše dopredu do najbližšej Pitky.
                  Prah = {KONSTANTY.PRAH_CIRHOZY_ZAKLAD} + priazeň Alkoholika.
                </span>
              </>
            ),
          }}
        />
        <Zdroj
          nazov="Zadĺženie"
          trieda={`zdroj-zadlzenie ${hrac.zadlzenie >= prahy.dlh - 1 ? "varovanie" : ""}`}
          hodnota={
            <span className="velke-cislo">
              {hrac.zadlzenie}
              <small>/{prahy.dlh}</small>
            </span>
          }
          pod={<Pruh hodnota={hrac.zadlzenie} prah={prahy.dlh} />}
          tip={{
            nadpis: "Zadĺženie",
            text: (
              <>
                {hrac.zadlzenie} z {prahy.dlh}. Pri dosiahnutí prahu hneď vzniká karta Dlh a ide do odhadzovacieho balíčka.
                <span className="tip-riadok">Pribúda akciami Dlh v Pitke a <b>po každej Pitke sa vynuluje</b>.</span>
              </>
            ),
          }}
        />
        <Zdroj
          nazov="Dlhy"
          trieda={`zdroj-dlhy ${prahy.priznaneDlhy >= prahy.exekutor - 2 ? "varovanie" : ""}`}
          hodnota={
            <span className="velke-cislo">
              {prahy.priznaneDlhy}
              <small>/{prahy.exekutor}</small>
            </span>
          }
          pod="do Exekútora"
          tip={{
            nadpis: "Priznané Dlhy",
            text: (
              <>
                {prahy.priznaneDlhy} z {prahy.exekutor}. Keď ich má hráč v bitke aspoň {prahy.exekutor}, prichádza
                Exekútor: musí odovzdať Nástroj (polovica dlhov potom zhorí), inak prehráva.
                <span className="tip-riadok">Prah = 10 + 2 × priazeň Exekútora. Robota odhodí 1 priznaný Dlh.</span>
              </>
            ),
          }}
        />
        <Zdroj
          nazov="Karty"
          trieda="zdroj-karty"
          hodnota={
            <span className="karty-pocty">
              <span>
                <b>{hrac.rukaPocet}</b> ruka
              </span>
              <span>
                <b>{hrac.doberaciPocet}</b> balíček
              </span>
              <span>
                <b>{hrac.odhadzovaci.length}</b> odhodené
              </span>
            </span>
          }
          tip={{
            nadpis: "Karty",
            text: (
              <>
                V ruke {hrac.rukaPocet}, v doberacom balíčku {hrac.doberaciPocet}, odhodených {hrac.odhadzovaci.length}.
                <span className="tip-stav">Keď doberací balíček klesne pod 5 kariet, hráč prehráva.</span>
              </>
            ),
          }}
        />
      </div>

      {(hrac.priznane.length > 0 || hrac.dedicstvo.length > 0) && (
        <div className="doska-oblast">
          {hrac.priznane.length > 0 && (
            <span className="oblast-skupina">
              <span className="oblast-nazov">priznané</span>
              {hrac.priznane.map((k) => (
                <span key={k.uid} className={`cip kliatba ${k.defId === "abstak" ? "abstak" : ""}`} title={popisKarty(k.defId)}>
                  {menoKarty(k.defId)}
                </span>
              ))}
            </span>
          )}
          {hrac.dedicstvo.length > 0 && (
            <span className="oblast-skupina">
              <span className="oblast-nazov">dedičstvo</span>
              {hrac.dedicstvo.map((k) => (
                <span key={k.uid} className="cip nastroj" title={popisKarty(k.defId)}>
                  {menoKarty(k.defId)}
                </span>
              ))}
            </span>
          )}
        </div>
      )}
    </section>
  );
}

// ---- bitka: aktívne efekty oboch hráčov -------------------------------------------
//
// Michal 2026-10-20: aktívne efekty boli nenápadné a malé. Každá aktívna akcia
// je teraz veľká ikona s hodnotou pod ňou; prírastky a úbytky sú v zátvorke
// a nápoveda vymenuje, ktoré karty a prečo hodnotu dali.

const SILA: Partial<Record<Action, number>> = { Rana: 1, Pecka: 2, Petelica: 3 };
const PORADIE_AKCII: readonly Action[] = [
  "Rana",
  "Pecka",
  "Petelica",
  "Viera",
  "Povera",
  "Vízia",
  "Cigareta",
  "Obmedzenie",
  "Robota",
  "Pohoršenie",
  "Dlh",
  "PoškodeniePečene",
  "Poldeci",
];

/** Zdroje rozpisu poškodenia, ktoré nie sú kartou. */
const ZDROJ_ROZPISU: Readonly<Record<string, string>> = {
  cirhoza: "súperove priznané Cirhózy",
  BITKAR: "priazeň Bitkára",
  Viera: "súperova nezrušená Viera",
  abstak: "Absťáky (trasú sa ruky)",
  pasca: "súperova Pasca (−1 za každé tvoje Zviera v línii)",
};

function znamienko(n: number): string {
  return n > 0 ? `+${n}` : `−${-n}`;
}

/** Dlaždica efektu: ikona, hodnota pod ňou, zmeny v zátvorke, nápoveda pri prejdení myšou. */
function Dlazdica({
  ikona,
  hodnota,
  zmeny,
  tip,
  trieda,
}: {
  readonly ikona: ReactNode;
  readonly hodnota: ReactNode;
  readonly zmeny: readonly number[];
  readonly tip: TipObsah;
  readonly trieda?: string;
}) {
  const { tip: okno, ukaz, skry } = useTip();
  const viditelne = zmeny.filter((z) => z !== 0);
  return (
    <span
      className={`efekt ${trieda ?? ""}`}
      tabIndex={0}
      onMouseEnter={(e) => ukaz(e.currentTarget, tip)}
      onMouseLeave={skry}
      onFocus={(e) => ukaz(e.currentTarget, tip)}
      onBlur={skry}
    >
      <span className="efekt-ikona">{ikona}</span>
      <span className="efekt-hodnota">
        {hodnota}
        {viditelne.length > 0 && <small className="efekt-zmeny">({viditelne.map(znamienko).join(" ")})</small>}
      </span>
      {okno}
    </span>
  );
}

function StranaBitky({
  meno,
  tuhe,
  makke,
  celkove,
  sums,
  zdroje,
  rozpis,
  sada,
  vitaz,
  zarovnanie,
  menoKarty,
}: {
  readonly meno: string;
  readonly tuhe: number;
  readonly makke: number;
  readonly celkove: number;
  readonly sums: ActionSums;
  readonly zdroje: ZdrojeAkcii;
  readonly rozpis: RozpisPoskodenia;
  readonly sada: Sada;
  readonly vitaz: boolean;
  readonly zarovnanie: "vlavo" | "vpravo";
  readonly menoKarty: (defId: string) => string;
}) {
  const akcia = (kluc: string) => sada.akcie.find((a) => a.kluc === kluc);
  const nazov = (kluc: string): string => akcia(kluc)?.nazov ?? kluc;
  const zdroj = (z: string): string => ZDROJ_ROZPISU[z] ?? menoKarty(z);
  const dovod = (d: string): string =>
    d === "Posilnenie"
      ? "zdvojená Posilnením"
      : d === "NA EX"
        ? "zdvojená cez NA EX"
        : d === "Vzbura"
          ? "aktivovaná Vzburou"
          : d.startsWith("karta:")
            ? `efekt karty ${menoKarty(d.slice(6))}`
            : d;

  const dlazdice: ReactNode[] = [];
  for (const a of PORADIE_AKCII) {
    const hodnota = sums[a] ?? 0;
    const ignorovana = a === "Povera" ? rozpis.poveraIgnorovana : 0;
    const zoznam = zdroje[a] ?? [];
    if (hodnota === 0 && ignorovana === 0 && zoznam.length === 0) continue;
    // Zdvojenia (Posilnenie, NA EX, efekty kariet) — o koľko je súčet vyšší než počet aktívnych slotov;
    // záporné položky sú zrážky súperových efektov (Presbiter).
    const kladne = zoznam.filter((z) => z.hodnota > 0);
    const navyse = kladne.reduce((s, z) => s + z.hodnota, 0) - kladne.length;
    const zrazkaEfektom = zoznam.filter((z) => z.hodnota < 0).reduce((s, z) => s + z.hodnota, 0);
    const zrusene = a === "Viera" ? rozpis.zrusenaViera : a === "Povera" ? rozpis.zrusenaPovera : 0;
    const riadky: ReactNode[] = zoznam.map((z, i) => (
      <span key={i} className="tip-riadok">
        {z.hodnota < 0 ? `súperov ${menoKarty(z.defId)}` : menoKarty(z.defId)}
        {z.vStrede ? " (karta v strede)" : ""}: <b>{znamienko(z.hodnota)}</b>
        {z.dovody.length > 0 ? ` — ${z.dovody.map(dovod).join(", ")}` : ""}
      </span>
    ));
    const sila = SILA[a];
    const stav: string[] = [];
    if (sila !== undefined) stav.push(`${hodnota} × ${sila} = ${hodnota * sila} tuhého poškodenia`);
    if (a === "Viera") {
      stav.push(`hodnota jednej Viery ${rozpis.hodnotaViery}`);
      if (zrusene > 0) stav.push(`${zrusene} zrušila súperova Povera`);
    }
    if (a === "Povera") {
      if (ignorovana > 0) stav.push(`${ignorovana} ignoruje súperov Farár`);
      if (zrusene > 0) stav.push(`${zrusene} zrušila súperova Viera`);
      stav.push(Number.isFinite(rozpis.makkeStrop) ? `mäkké poškodenie najviac ${rozpis.makkeStrop} (súperove priznané Dlhy)` : "mäkké poškodenie bez stropu");
    }
    dlazdice.push(
      <Dlazdica
        key={a}
        trieda={sila !== undefined ? "tuha" : ""}
        ikona={<IkonaAkcie kluc={a} akcia={akcia(a)} />}
        hodnota={hodnota}
        zmeny={[navyse, zrazkaEfektom, -zrusene, -ignorovana]}
        tip={{
          nadpis: `${nazov(a)} ${hodnota}${navyse > 0 ? ` (z toho ${znamienko(navyse)} zdvojením)` : ""}`,
          text: (
            <>
              {akcia(a)?.popis ?? ""}
              {stav.length > 0 && <span className="tip-stav">{stav.join(" · ")}</span>}
              {riadky}
            </>
          ),
        }}
      />,
    );
  }

  const bonus = rozpis.bonusy.reduce((s, z) => s + z.hodnota, 0);
  const zrazka = rozpis.zrazky.reduce((s, z) => s + z.hodnota, 0);
  const tipTuhe: TipObsah = {
    nadpis: `Tuhé poškodenie ${tuhe}`,
    text: (
      <>
        Rozhoduje o víťazovi bitky. Rana 1, Pecka 2, Petelica 3.
        <span className="tip-riadok">
          z akcií: <b>{rozpis.zAkcii}</b>
        </span>
        {rozpis.bonusy.map((z) => (
          <span key={`b${z.zdroj}`} className="tip-riadok">
            {zdroj(z.zdroj)}: <b>{znamienko(z.hodnota)}</b>
          </span>
        ))}
        {rozpis.zrazky.map((z) => (
          <span key={`z${z.zdroj}`} className="tip-riadok">
            {zdroj(z.zdroj)}: <b>{znamienko(-z.hodnota)}</b>
          </span>
        ))}
        <span className="tip-stav">
          {makke > 0 ? `+ ${makke} mäkké (Povera) = celkom ${celkove}` : `celkom ${celkove}`} — celkové rozhodne pri rovnosti v tuhom.
        </span>
      </>
    ),
  };

  return (
    <div className={`bitka-strana ${zarovnanie} ${vitaz ? "vitaz" : ""}`}>
      <div className="bitka-suhrn">
        <span className="bitka-meno">{meno}</span>
        <Dlazdica
          trieda="efekt-tuhe"
          ikona={<span className="bitka-tuhe">{tuhe}</span>}
          hodnota={<span className="bitka-popis">tuhé</span>}
          zmeny={[bonus, -zrazka]}
          tip={tipTuhe}
        />
        <span className="bitka-doplnok">{makke > 0 ? `+${makke} mäkké · ` : ""}celkom {celkove}</span>
      </div>
      <div className="efekty">{dlazdice.length > 0 ? dlazdice : <span className="efekty-ziadne">žiadne aktívne akcie</span>}</div>
    </div>
  );
}

export interface BitkaPanelProps {
  readonly damage: DamageResult;
  readonly sums: readonly [ActionSums, ActionSums];
  readonly zdroje: readonly [ZdrojeAkcii, ZdrojeAkcii];
  readonly rozpis: readonly [RozpisPoskodenia, RozpisPoskodenia];
  readonly ja: PlayerId;
  readonly utocnik: PlayerId;
  readonly vysledok: boolean;
  readonly mena: readonly [string, string];
  readonly sada: Sada;
  readonly ciel: string;
  readonly menoKarty: (defId: string) => string;
}

export function BitkaPanel({ damage, sums, zdroje, rozpis, ja, utocnik, vysledok, mena, sada, ciel, menoKarty }: BitkaPanelProps) {
  const su = (ja === 0 ? 1 : 0) as PlayerId;
  // Remíza v tuhom (Michal 2026-10-19): rozhodne celkové, potom obranca (PRAVIDLA §8.4).
  const { vitaz, prebytok, prebytokDrzi } = battleOutcome(damage, utocnik);
  const rozdiel = Math.abs(damage.tuhe[ja] - damage.tuhe[su]);
  const vyhravam = vitaz === ja;
  const verdikt =
    rozdiel === 0
      ? damage.celkove[ja] === damage.celkove[su]
        ? vyhravam
          ? "Remíza — vyhrávaš ako obranca"
          : "Remíza — vyhráva obranca"
        : vyhravam
          ? "Remíza v tuhom — vyhrávaš na celkové"
          : "Remíza v tuhom — súper vyhráva na celkové"
      : vysledok
        ? vyhravam
          ? "Vyhral si bitku"
          : "Prehral si bitku"
        : vyhravam
          ? `Vyhrávaš o ${rozdiel}`
          : `Prehrávaš o ${rozdiel}`;

  const strana = (p: PlayerId, zarovnanie: "vlavo" | "vpravo") => (
    <StranaBitky
      meno={mena[p]}
      tuhe={damage.tuhe[p]}
      makke={damage.makke[p]}
      celkove={damage.celkove[p]}
      sums={sums[p]}
      zdroje={zdroje[p]}
      rozpis={rozpis[p]}
      sada={sada}
      vitaz={vitaz === p}
      zarovnanie={zarovnanie}
      menoKarty={menoKarty}
    />
  );

  return (
    <section className={`bitka-panel ${vitaz === null ? "" : vyhravam ? "vyhravam" : "prehravam"}`} aria-label="Bitka">
      {strana(ja, "vlavo")}
      <div className="bitka-stred">
        <span className="bitka-nadpis">
          {vysledok ? "Výsledok bitky" : "Odhad bitky"} · {ciel}
        </span>
        <span className="bitka-verdikt">{verdikt}</span>
        <span className="bitka-pozn">
          {prebytokDrzi === null
            ? "prebytok: nikto"
            : `prebytok ${prebytok} → ${prebytokDrzi === ja ? "tebe" : mena[su]}`}
        </span>
        {!vysledok && <span className="bitka-pozn tlmene">podľa aktuálnej línie; súperove Absťáky v ruke nevidno</span>}
      </div>
      {strana(su, "vpravo")}
    </section>
  );
}

// ---- priebeh kola: časová os hore ---------------------------------------------------
//
// Michal 2026-10-20: úzka časová os je ako ruka stálou súčasťou obrazovky.
// Ukazuje celé kolo — pri viacerých Pitkách každé Zhromaždenie a Pitku zvlášť —
// a pri prejdení myšou, čo sa v danej časti robí.

interface KrokKola {
  readonly id: string;
  readonly nazov: string;
  readonly tip: TipObsah;
}

function KrokOsi({ krok, trieda }: { readonly krok: KrokKola; readonly trieda: string }) {
  const { tip: okno, ukaz, skry } = useTip();
  return (
    <li
      className={trieda}
      tabIndex={0}
      onMouseEnter={(e) => ukaz(e.currentTarget, krok.tip)}
      onMouseLeave={skry}
      onFocus={(e) => ukaz(e.currentTarget, krok.tip)}
      onBlur={skry}
    >
      {krok.nazov}
      {okno}
    </li>
  );
}

export function PriebehKola({ view }: { readonly view: ClientState }) {
  const pitiek = Math.max(1, view.pitkyCelkom);
  const viac = pitiek > 1;
  const pocetPozn =
    "Pitiek je 1 + menší z počtov aktivovaných akcií karty v strede na jej dvoch stranách — počet sa mení, keď hráči vykladajú karty k lokalite.";
  const kroky: KrokKola[] = [
    {
      id: "volbaCiela",
      nazov: "Voľba cieľa",
      tip: {
        nadpis: "Voľba cieľa",
        text: (
          <>
            Obranca (víťaz poslednej bitky) vyberie lokalitu a natočí ju.
            <span className="tip-riadok">Natočenie určuje, ktoré akcie lokality sú obrátené ku ktorej strane.</span>
          </>
        ),
      },
    },
    {
      id: "draft",
      nazov: "Draft",
      tip: {
        nadpis: "Draft — šenok a patronát",
        text: (
          <>
            <b>Stavba šenku:</b> obaja naraz dajú z balíčka stavby polovicu kariet do šenku a polovicu naspodok spoločného
            balíčka — bez podávania.
            <span className="tip-riadok">
              <b>Branie:</b> striedavo, začína útočník — 1 karta za {KONSTANTY.CENA_SENKU[1]} cigaretu, 2 karty za {KONSTANTY.CENA_SENKU[2]}{" "}
              cigarety. Bez cigariet sa nedá brať. Kto prestane, súperovi nechá už len jeden posledný ťah.
            </span>
            <span className="tip-riadok">
              <b>Patronát:</b> komu starší prejavuje priazeň (aspoň žltá), smie si ho vziať do ruky — najprv útočník, potom obranca.
              Na scorecard dá lícom dole Občana či Zviera z ruky, marker ide do stredu. Platí cigarety do červenej, súper dostane
              v bitke Pohoršenia (o koľko marker išiel do stredu). Výhra = starší je jeho; prehra = odhodí poldeci.
            </span>
          </>
        ),
      },
    },
  ];
  for (let i = 1; i <= pitiek; i++) {
    const cislo = viac ? ` ${i}` : "";
    kroky.push(
      {
        id: `zhromazdenie-${i}`,
        nazov: `Zhromaždenie${cislo}`,
        tip: {
          nadpis: `Zhromaždenie${viac ? ` ${i} z ${pitiek}` : ""}`,
          text: (
            <>
              Striedavo vykladáte karty z ruky na hociktorú stranu línie, začína útočník. Limit vykladania = plné poldeci + poldeci na
              stole + 1; každá ďalšia karta v tom istom ťahu stojí plný poldeci.
              <span className="tip-riadok">
                Kedykoľvek na ťahu: priznať kliatbu (za Cirhózu sa nedoberá; Dlh sa prizná sám pri dobratí), Nástroj do Dedičstva (za cigarety, cena rastie), fajčiť
                (cigareta = karta). Kto pasuje, do Pitky už nevykladá a dostane cigaretu za každú kartu, ktorú ešte smel
                vyložiť. Končí, keď obaja vyčerpajú limit alebo pasujú.
              </span>
              {viac && <span className="tip-stav">{pocetPozn}</span>}
            </>
          ),
        },
      },
      {
        id: `pitka-${i}`,
        nazov: `Pitka${cislo}`,
        tip: {
          nadpis: `Pitka${viac ? ` ${i} z ${pitiek}` : ""}`,
          text: (
            <>
              Začína obranca. NA EX! — plný poldeci na Občana či Starešinu v línii: zruší jeho aktívne akcie a zdvojí neaktívne; súper
              smie hneď odpovedať jednou kartou. Fajčiť, doliať poldeci ({KONSTANTY.REFILL_CENA} cig.), nový poldeci (barter).
              <span className="tip-riadok">
                Potom sa pripíšu akcie: Dlh (zadĺženie), Poškodenie pečene a Poldeci (Cirhóza), Obmedzenie, Cigarety a Vízia. Pečeň aj
                zadĺženie sa po Pitke vynulujú.
              </span>
              {viac && <span className="tip-stav">{pocetPozn}</span>}
            </>
          ),
        },
      },
    );
  }
  kroky.push({
    id: "bitka",
    nazov: "Bitka",
    tip: {
      nadpis: "Bitka o lokalitu",
      text: (
        <>
          Rozhoduje tuhé poškodenie (Rana 1, Pecka 2, Petelica 3; mínus súperova Viera a vlastné Absťáky), pri rovnosti celkové, potom
          vyhráva obranca. Víťaz ovládne lokalitu (a staršieho, ak ho má v patronáte), prebytok posúva markery starších.
          <span className="tip-riadok">
            Potom Exekútor, Pohoršenie, Liečba… a každý si dobere {KONSTANTY.KARTY_PO_BITKE} karty. Porazený je v ďalšom kole
            útočník.
          </span>
        </>
      ),
    },
  });

  const aktualneId =
    view.faza === "zhromazdenie"
      ? `zhromazdenie-${Math.min(pitiek, view.pitkaCislo + 1)}`
      : view.faza === "pitka"
        ? `pitka-${Math.max(1, view.pitkaCislo)}`
        : view.faza;
  const aktualny = kroky.findIndex((k) => k.id === aktualneId);
  return (
    <ol className="priebeh-kola" aria-label={`Kolo ${view.kolo}`}>
      <li className="priebeh-kolo" title={`Hrá sa o ${view.lokalitCelkom} lokalít; zostáva ${view.lokalityVHre.length} nevybraných.`}>
        Kolo {view.kolo} · lokalita {Math.min(view.lokalitCelkom, view.ovladnute.length + view.prepadnute.length + 1)}/{view.lokalitCelkom}
      </li>
      {kroky.map((k, i) => (
        <KrokOsi key={k.id} krok={k} trieda={i === aktualny ? "aktualny" : i < aktualny ? "hotovy" : ""} />
      ))}
    </ol>
  );
}
