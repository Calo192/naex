// Panely hernej plochy: doska hráča (zdroje), odhad/výsledok bitky,
// priebeh kola. Ukazovatele starších sú v Scorecard.tsx.
//
// Zásada: každé číslo, od ktorého závisí rozhodnutie (poldeci, cigarety,
// pečeň, dlhy, poškodenie), je veľké, pomenované a vždy na tom istom mieste.

import type { ReactNode } from "react";
import type {
  ActionSums,
  ClientState,
  DamageResult,
  PlayerId,
  StavZavislosti,
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
              <b>Menej</b> → +1 Absťák (rovno priznaný). <b>Rovnako</b> → nič. <b>Viac</b> → jeden Absťák odíde. Prvé kolo
              len nastaví základ.
            </span>
            <span className="tip-riadok">
              <b>Nerest je:</b> Vypiť poldeci v Zhromaždení, NA EX (poldeci sa vypije v bitke), runda Ešte jednu!, každá
              vyfajčená cigareta, doliatie poldeci (2) a stokársky barter (za každú cigaretu). Platba za šenok, Dedičstvo
              a Starostu sa nepočíta.
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
            {z.lesnaCesta && (
              <span className="tip-riadok">
                <b>Lesná cesta:</b> NA EX v tejto Pitke hneď zahodí jeden Absťák.
              </span>
            )}
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

/** Značka pri mene hráča s nápovedou. */
function Znacka({ trieda, text, tip }: { readonly trieda: string; readonly text: string; readonly tip: TipObsah }) {
  const { tip: okno, ukaz, skry } = useTip();
  return (
    <span className={`znacka ${trieda}`} onMouseEnter={(e) => ukaz(e.currentTarget, tip)} onMouseLeave={skry}>
      {text}
      {okno}
    </span>
  );
}

export interface HracDoskaProps {
  readonly view: ClientState;
  readonly p: PlayerId;
  /** Body zo záverečného bodovania, keby hra skončila teraz. */
  readonly body?: { readonly body: number; readonly neiste: boolean };
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
 * Doska hráča. Obe dosky sú v jednom rade nad stolom — tvoja vľavo, súperova
 * vpravo a zrkadlovo (avatar pri vonkajšom okraji, zdroje smerom k stredu).
 */
export function HracDoska({ view, p, info, prahy, zavislost, menoKarty, popisKarty, body, obchodCigariet }: HracDoskaProps) {
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
  const z = view.zhromazdenieStav;
  const pitka = view.pitkaStav;
  const kto = ja ? "Máš" : "Má";

  const poldeci: ReactNode[] = [];
  for (let i = 0; i < hrac.poldeciPlne; i++) poldeci.push(<IkonaPoldeci key={`p${i}`} plny />);
  for (let i = 0; i < hrac.poldeciVypite; i++) poldeci.push(<IkonaPoldeci key={`v${i}`} plny={false} />);

  const stav =
    view.faza === "zhromazdenie" && z !== null
      ? z.pasoval[p]
        ? { text: "pasoval", trieda: "tlmeny", tip: "V tomto Zhromaždení už nevykladá." }
        : {
            text: `vyloží ešte ${z.zostavaLimit[p]}`,
            trieda: z.zostavaLimit[p] > 0 ? "dobry" : "zly",
            tip: "Koľko kariet ešte smie v tomto Zhromaždení vyložiť (limit vykladania mínus už vyložené).",
          }
      : view.faza === "pitka" && pitka !== null
        ? pitka.naexPouzity[p]
          ? { text: "NA EX použité", trieda: "tlmeny", tip: "NA EX sa smie dať najviac raz za Pitku." }
          : { text: "NA EX k dispozícii", trieda: "dobry", tip: "V tejto Pitke ešte môže dať NA EX — ak má plný poldeci." }
        : view.faza === "draft" && view.draftStav !== null
          ? view.draftStav.krok === "stavba"
            ? view.draftStav.vybral[p]
              ? { text: "vybral do šenku", trieda: "tlmeny", tip: "V tomto kroku stavby šenku už vybral kartu do šenku a kartu naspodok." }
              : { text: "stavia šenok", trieda: "", tip: "Vyberá zo svojho balíčka kartu do šenku a kartu naspodok; zvyšok podá súperovi." }
            : view.draftStav.hotovo[p]
              ? { text: `draftoval (${view.draftStav.noveKarty[p]} kariet)`, trieda: "tlmeny", tip: "Draft má za sebou." }
              : { text: `berie zo šenku (${view.draftStav.noveKarty[p]})`, trieda: "", tip: "Berie striedavo, koľko si môže dovoliť: 1 karta za cigaretu alebo 2 karty za plný poldeci." }
          : null;

  return (
    <section className={`doska ${ja ? "moja" : "superova"} ${naTahu ? "na-tahu" : ""}`} aria-label={`Hráč ${meno}`}>
      <div className="doska-hrac">
        <Avatar meno={meno} avatar={info?.avatar ?? null} velkost={44} />
        <div>
          <strong className="doska-meno">
            {meno} {ja && <span className="tlmene">(ty)</span>}
            {info?.frajerina !== undefined && (
              <span className="doska-frajerina" title={`Frajerina — ${info.titul ?? ""}`}>
                {info.frajerina}
              </span>
            )}
          </strong>
          <span className="doska-znacky">
            {view.utocnik === p ? (
              <Znacka
                trieda="utocnik"
                text="útočník"
                tip={{ nadpis: "Útočník", text: "Útočí v tomto kole. Pri remíze v tuhom poškodení vyhráva útočník." }}
              />
            ) : (
              <Znacka trieda="obranca" text="obranca" tip={{ nadpis: "Obranca", text: "Bráni sa v tomto kole. Zo šenku berie prvý a vykladá prvý." }} />
            )}
            {body !== undefined && (
              <Znacka
                trieda="body"
                text={`★ ${body.body}${body.neiste ? "?" : ""} b.`}
                tip={{
                  nadpis: `Body teraz: ${body.body}${body.neiste ? " (najviac)" : ""}`,
                  text: `Záverečné bodovanie, keby hra skončila teraz. Body dávajú starší, ktorí sa ${ja ? "ťa" : "ho"} boja — podľa aktívnych podmienok na ${ja ? "tvojej" : "jeho"} strane ich scorecardov (panel Starší hore, riadky ★).${body.neiste ? " Súperove skryté Dlhy a Cirhózy v ruke a balíčku ich ešte môžu znížiť." : ""}`,
                }}
              />
            )}
            {naTahu && <Znacka trieda="na-tahu" text="na ťahu" tip={{ nadpis: "Na ťahu", text: `${ja ? "Teraz hráš ty." : `Teraz hrá ${meno}.`}` }} />}
            {stav !== null && <Znacka trieda={stav.trieda} text={stav.text} tip={{ nadpis: stav.text, text: stav.tip }} />}
          </span>
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
                    ? `Limit vykladania: Zastávka — obaja ${limit}`
                    : `Limit vykladania = plné + na stole + 1 = ${limit}`}
                </span>
                <span className="tip-riadok">
                  V ďalšom kole limit {buduci}: poldeci z NA EX sa pri bitke vypijú a na začiatku kola sa{" "}
                  {KONSTANTY.POLDECI_NA_ZACIATKU_KOLA} vypitý doleje sám (bez Poldecka a doliatia cigaretami).
                </span>
                <span className="tip-riadok">
                  V Pitke položíš plný poldeci na Občana alebo Starešinu (NA EX!): zdvojnásobí neaktívne akcie
                  karty a zruší jej aktívne. Plný poldeci platí aj kartu zo šenku. Vypitý doleješ za 2 cigarety, nový
                  získaš barterom (5 cigariet, s priazňou Lakomca menej).
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
                {kto} {hrac.cigarety} fyzických cigariet.
                <span className="tip-riadok">
                  Získavaš ich z aktívnych Cigaretiek v Pitke (mínus súperove Obmedzenia) a prenášajú sa z kola na kolo.
                  Fajčiť smieš na svojom ťahu v Zhromaždení aj v Pitke: cigareta = karta hneď. V Pitke 2 cigarety dolejú
                  vypitý poldeci, 5 (s priazňou Lakomca menej) vymeníš za nový plný (stokársky barter). Na konci hry bod za každé 3, ak to dovolí scorecard.
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
                {hrac.pecen} z {prahy.cirhoza}. Vyhodnocuje sa len v Pitke: pri dosiahnutí prahu vzniká Cirhóza (v bitke pridáva tuhé
                poškodenie) a <b>po každej Pitke sa pečeň vynuluje</b>.
                <span className="tip-riadok">
                  Pribúda akciami Pečeň, Poldecko a NA EX v Pitke; pitie do dna v Zhromaždení ju pripíše dopredu do najbližšej Pitky.
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
                <span className="tip-riadok">Pribúda akciami Hazard v Pitke a <b>po každej Pitke sa vynuluje</b>.</span>
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

// ---- bitka -------------------------------------------------------------------------

const TUHE_AKCIE = ["Rana", "Pecka", "Petelica"] as const;
const SILA: Record<(typeof TUHE_AKCIE)[number], number> = { Rana: 1, Pecka: 2, Petelica: 3 };

function StranaBitky({
  meno,
  tuhe,
  makke,
  celkove,
  sums,
  sada,
  vitaz,
  zarovnanie,
  abstaky,
}: {
  readonly meno: string;
  readonly tuhe: number;
  readonly makke: number;
  readonly celkove: number;
  readonly sums: ActionSums;
  readonly sada: Sada;
  readonly vitaz: boolean;
  readonly zarovnanie: "vlavo" | "vpravo";
  /** O koľko Absťáky znížili tuhé poškodenie. */
  readonly abstaky: number;
}) {
  const nazov = (kluc: string): string => sada.akcie.find((a) => a.kluc === kluc)?.nazov ?? kluc;
  const rozpis: { kluc: string; text: string }[] = [];
  for (const a of TUHE_AKCIE) {
    const n = sums[a] ?? 0;
    if (n > 0) rozpis.push({ kluc: a, text: n === 1 ? `${nazov(a)} ${SILA[a]}` : `${n}× ${nazov(a)} = ${n * SILA[a]}` });
  }
  for (const a of ["Viera", "Povera"] as const) {
    const n = sums[a] ?? 0;
    if (n > 0) rozpis.push({ kluc: a, text: `${nazov(a)} ${n}` });
  }
  return (
    <div className={`bitka-strana ${zarovnanie} ${vitaz ? "vitaz" : ""}`}>
      <span className="bitka-meno">{meno}</span>
      <span className="bitka-tuhe" title="tuhé poškodenie — rozhoduje o víťazovi">
        {tuhe}
      </span>
      <span className="bitka-popis">tuhé poškodenie</span>
      <span className="bitka-doplnok">
        {makke > 0 ? `+${makke} mäkké · ` : ""}celkom {celkove}
      </span>
      {(rozpis.length > 0 || abstaky > 0) && (
        <span className="bitka-rozpis">
          {rozpis.map((r) => (
            <span key={r.kluc} title={sada.akcie.find((a) => a.kluc === r.kluc)?.popis ?? r.kluc}>
              <span className="bitka-ikona">
                <IkonaAkcie kluc={r.kluc} akcia={sada.akcie.find((a) => a.kluc === r.kluc)} />
              </span>
              {r.text}
            </span>
          ))}
          {abstaky > 0 && (
            <span className="bitka-abstak" title="Absťák: každý uberie 1 tuhé poškodenie (trasú sa ruky).">
              <span className="bitka-ikona">
                <IkonaAbstak />
              </span>
              Absťák −{abstaky}
            </span>
          )}
        </span>
      )}
    </div>
  );
}

export interface BitkaPanelProps {
  readonly damage: DamageResult;
  readonly sums: readonly [ActionSums, ActionSums];
  readonly ja: PlayerId;
  readonly utocnik: PlayerId;
  readonly vysledok: boolean;
  readonly mena: readonly [string, string];
  readonly sada: Sada;
  readonly ciel: string;
  readonly oStarsieho: boolean;
  /** O koľko Absťáky znížia tuhé poškodenie [hráč 0, hráč 1]. */
  readonly abstaky: readonly [number, number];
}

export function BitkaPanel({ damage, sums, ja, utocnik, vysledok, mena, sada, ciel, oStarsieho, abstaky }: BitkaPanelProps) {
  const su = (ja === 0 ? 1 : 0) as PlayerId;
  // Remíza v tuhom (Michal 2026-10-19): o lokalitu rozhodne celkové, potom
  // obranca; o staršieho nevyhrá nikto (PRAVIDLA §8.4).
  const { vitaz, prebytok, prebytokDrzi } = battleOutcome(damage, utocnik, oStarsieho);
  const rozdiel = Math.abs(damage.tuhe[ja] - damage.tuhe[su]);
  const vyhravam = vitaz === ja;
  const verdikt =
    vitaz === null
      ? "Remíza — starší ostáva na mieste"
      : rozdiel === 0
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

  return (
    <section className={`bitka-panel ${vitaz === null ? "" : vyhravam ? "vyhravam" : "prehravam"}`} aria-label="Bitka">
      <StranaBitky
        meno={mena[ja]}
        tuhe={damage.tuhe[ja]}
        makke={damage.makke[ja]}
        celkove={damage.celkove[ja]}
        sums={sums[ja]}
        sada={sada}
        vitaz={vitaz === ja}
        zarovnanie="vlavo"
        abstaky={abstaky[ja]}
      />
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
        {!vysledok && <span className="bitka-pozn tlmene">podľa aktuálnej línie; súperove absťáky v ruke nevidno</span>}
      </div>
      <StranaBitky
        meno={mena[su]}
        tuhe={damage.tuhe[su]}
        makke={damage.makke[su]}
        celkove={damage.celkove[su]}
        sums={sums[su]}
        sada={sada}
        vitaz={vitaz === su}
        zarovnanie="vpravo"
        abstaky={abstaky[su]}
      />
    </section>
  );
}

// ---- priebeh kola ------------------------------------------------------------------

export function PriebehKola({ view }: { readonly view: ClientState }) {
  const oStarsieho = view.ciel?.typ === "starsi";
  const kroky: { id: string; nazov: string }[] = [
    { id: "volbaCiela", nazov: "Voľba cieľa" },
    ...(oStarsieho ? [] : [{ id: "draft", nazov: "Draft" }]),
    {
      id: "zhromazdenie",
      nazov: `Zhromaždenie${view.pitkyCelkom > 1 ? ` ${Math.max(1, view.pitkaCislo)}/${view.pitkyCelkom}` : ""}`,
    },
    { id: "pitka", nazov: `Pitka${view.pitkyCelkom > 1 ? ` ${Math.max(1, view.pitkaCislo)}/${view.pitkyCelkom}` : ""}` },
    { id: "bitka", nazov: "Bitka" },
  ];
  const aktualny = kroky.findIndex((k) => k.id === view.faza);
  return (
    <ol className="priebeh-kola" aria-label={`Kolo ${view.kolo}`}>
      <li className="priebeh-kolo" title={`Hrá sa o ${view.lokalitCelkom} lokalít; zostáva ${view.lokalityVHre.length} nevybraných.`}>
        Kolo {view.kolo} · lokalita {Math.min(view.lokalitCelkom, view.ovladnute.length + view.prepadnute.length + 1)}/{view.lokalitCelkom}
      </li>
      {kroky.map((k, i) => (
        <li key={k.id} className={i === aktualny ? "aktualny" : i < aktualny ? "hotovy" : ""}>
          {k.nazov}
        </li>
      ))}
    </ol>
  );
}
