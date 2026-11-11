// Kapitoly pravidiel v poradí, v akom plynie partia (osnova Navrhára
// docs/napady/pravidla-osnova.html, schválil Michal 2026-10-24). Text píšeme
// podľa toho, čo hra naozaj robí — pravdou je jadro a ťahák
// tools/playtest/tahak.md, nie staré texty (audit rozporov v osnove).

import type { ReactNode } from "react";
import type { Sada } from "@naex/tvorba";
import { IkonaAkcie } from "../../karta/IkonaAkcie.tsx";
import { Odkaz } from "../../lib/router.tsx";
import { UkazkaBitky, UkazkaLimitu, UkazkaSpajania, UkazkaStupnice } from "../Ukazky.tsx";
import { t } from "../../i18n/jazyk.tsx";
import { maPole, poliaKapitoly, textPravidiel, tp } from "./texty.tsx";

export type Cast = "A" | "B" | "C";

const cast = (id: Cast): { readonly id: Cast; readonly nazov: string } => ({
  id,
  get nazov() {
    return textPravidiel(`casti.${id}`);
  },
});

/** Názvy častí a kapitol sú gettery — čítajú sa v jazyku hráča pri vykreslení. */
export const CASTI: readonly { readonly id: Cast; readonly nazov: string }[] = [cast("A"), cast("B"), cast("C")];

export interface Kapitola {
  readonly id: string;
  readonly cast: Cast;
  readonly nazov: string;
  /** Kratší názov do obsahu, keď sa celý nezmestí na riadok. */
  readonly kratky?: string | undefined;
  /** Ilustrácia (bez prípony) v pravidla-obrazky/ — kým chýba, ukáže sa zástupný pás. */
  readonly obrazok: string;
  /** „V skratke“ — vecne v bodoch (Michal 2026-10-24). */
  readonly vSkratke: readonly string[];
  readonly obsah: (sada: Sada) => ReactNode;
}

/** Podkapitola s kotvou (#id) — obsah stránky ju nájde a vyhľadávanie do nej skočí. */
function H3({ id, children }: { readonly id: string; readonly children: ReactNode }) {
  return (
    <h3 id={id}>
      {children}
      <a className="kotva" href={`#${id}`} aria-label={t("pravidla.odkazNaCast")}>
        §
      </a>
    </h3>
  );
}

/** Kapitola s názvom, kratším názvom a bodmi V skratke z textov pravidiel (texty.tsx). */
function kapitola(k: Pick<Kapitola, "id" | "cast" | "obrazok" | "obsah">): Kapitola {
  return {
    ...k,
    get nazov() {
      return textPravidiel(`${k.id}.nazov`);
    },
    get kratky() {
      return maPole(k.id, "kratky") ? textPravidiel(`${k.id}.kratky`) : undefined;
    },
    get vSkratke() {
      return poliaKapitoly(k.id, "skratka.").map((p) => textPravidiel(`${k.id}.${p}`));
    },
  };
}

export const KAPITOLY: readonly Kapitola[] = [
  // ---------------------------------------------------------------- A
  // Rýchly štart len zo 13 slov jadra (Michal 2026-11-10, docs/napady/prvy-dojem-navstevnika.html, časť 9):
  // špak, bitka, lokalita, akcia a údery, ponuka, cigareta, Zhromaždenie, línia, poldeci, spoj, Pitka, NA EX,
  // starší a strach. Podrobnosti, ktoré tu boli (príprava, útočník, liga, väzni, exekútor, karta, akcie),
  // sú v častiach B a C pod tými istými kotvami.
  kapitola({
    id: "co-je-naex",
    cast: "A",
    obrazok: "01-co-je-naex",
    obsah: () => (
      <>
        <p>{tp("co-je-naex.p1")}</p>
        <p>{tp("co-je-naex.p2")}</p>
        <p className="tlmene upozornenie">{tp("co-je-naex.p3")}</p>
      </>
    ),
  }),
  kapitola({
    id: "ako-sa-vyhrava",
    cast: "A",
    obrazok: "02-ako-sa-vyhrava",
    obsah: () => (
      <>
        <div className="karticky">
          <div className="karticka">{tp("ako-sa-vyhrava.p1")}</div>
          <div className="karticka karticka-ok">{tp("ako-sa-vyhrava.p2")}</div>
        </div>
        <p>{tp("ako-sa-vyhrava.p3")}</p>
      </>
    ),
  }),
  kapitola({
    id: "co-mas-pred-sebou",
    cast: "A",
    obrazok: "03-co-mas-pred-sebou",
    obsah: () => (
      <>
        <H3 id="co-mas-pred-sebou-bar">{tp("co-mas-pred-sebou.h.co-mas-pred-sebou-bar")}</H3>
        <p>{tp("co-mas-pred-sebou.p1")}</p>
        <H3 id="co-mas-pred-sebou-spoj">{tp("co-mas-pred-sebou.h.co-mas-pred-sebou-spoj")}</H3>
        <p>{tp("co-mas-pred-sebou.p2")}</p>
      </>
    ),
  }),
  kapitola({
    id: "kolo",
    cast: "A",
    obrazok: "04-kolo",
    obsah: () => (
      <>
        <div className="priebeh">
          <span>{tp("kolo.p1")}</span>→<span>{tp("kolo.p2")}</span>→<span>{tp("kolo.p3")}</span>→<span>{tp("kolo.p4")}</span>→<span>{tp("kolo.p5")}</span>
        </div>
        <ol className="kroky">
          <li>{tp("kolo.p6")}</li>
          <li>{tp("kolo.p7")}</li>
          <li>{tp("kolo.p8")}</li>
          <li>{tp("kolo.p9")}</li>
          <li>{tp("kolo.p10")}</li>
        </ol>
        <p>{tp("kolo.p11")}</p>
      </>
    ),
  }),

  // ---------------------------------------------------------------- B
  kapitola({
    id: "ciel-a-senok",
    cast: "B",
    obrazok: "05-ciel-a-senok",
    obsah: () => (
      <>
        <H3 id="kolo-kroky">{tp("ciel-a-senok.h.kolo-kroky")}</H3>
        <div className="priebeh">
          <span>{tp("ciel-a-senok.p1")}</span>→<span>{tp("ciel-a-senok.p2")}</span>→<span>{tp("ciel-a-senok.p3")}</span>→<span>{tp("ciel-a-senok.p4")}</span>→<span>{tp("ciel-a-senok.p5")}</span>
        </div>
        <ol className="kroky">
          <li>{tp("ciel-a-senok.p6")}</li>
          <li>{tp("ciel-a-senok.p7")}</li>
          <li>{tp("ciel-a-senok.p8")}</li>
          <li>{tp("ciel-a-senok.p9")}</li>
          <li>{tp("ciel-a-senok.p10")}</li>
        </ol>
        <H3 id="kolo-priprava">{tp("ciel-a-senok.h.kolo-priprava")}</H3>
        <p>{tp("ciel-a-senok.p11")}</p>
        <H3 id="kolo-utocnik">{tp("ciel-a-senok.h.kolo-utocnik")}</H3>
        <p>{tp("ciel-a-senok.p12")}</p>
        <H3 id="ciel">{tp("ciel-a-senok.h.ciel")}</H3>
        <p>{tp("ciel-a-senok.p13")}</p>
        <H3 id="senok-stavba">{tp("ciel-a-senok.h.senok-stavba")}</H3>
        <p>{tp("ciel-a-senok.p14")}</p>
        <H3 id="senok-branie">{tp("ciel-a-senok.h.senok-branie")}</H3>
        <p>{tp("ciel-a-senok.p15")}</p>
        <H3 id="patronat">{tp("ciel-a-senok.h.patronat")}</H3>
        <p>{tp("ciel-a-senok.p16")}</p>
        <ul>
          <li>{tp("ciel-a-senok.p17")}</li>
          <li>{tp("ciel-a-senok.p18")}</li>
        </ul>
      </>
    ),
  }),
  kapitola({
    id: "zhromazdenie",
    cast: "B",
    obrazok: "06-zhromazdenie",
    obsah: (s) => (
      <>
        <H3 id="zhromazdenie-linia">{tp("zhromazdenie.h.zhromazdenie-linia")}</H3>
        <p>{tp("zhromazdenie.p1")}</p>
        <H3 id="zhromazdenie-spoj">{tp("zhromazdenie.h.zhromazdenie-spoj")}</H3>
        <p>{tp("zhromazdenie.p2")}</p>
        <UkazkaSpajania sada={s} />
        <H3 id="zhromazdenie-limit">{tp("zhromazdenie.h.zhromazdenie-limit")}</H3>
        <p>{tp("zhromazdenie.p3")}</p>
        <UkazkaLimitu />
        <p>{tp("zhromazdenie.p4")}</p>
        <H3 id="zhromazdenie-prevaha">{tp("zhromazdenie.h.zhromazdenie-prevaha")}</H3>
        <p>{tp("zhromazdenie.p5")}</p>
        <H3 id="zhromazdenie-efekty">{tp("zhromazdenie.h.zhromazdenie-efekty")}</H3>
        <p>{tp("zhromazdenie.p6")}</p>
        <p className="zvyraznene">{tp("zhromazdenie.p7")}</p>
        <p>{tp("zhromazdenie.p8")}</p>
        <H3 id="ruka-a-balicky">{tp("zhromazdenie.h.ruka-a-balicky")}</H3>
        <p>{tp("zhromazdenie.p9")}</p>
        <H3 id="co-mas-pred-sebou-karta">{tp("zhromazdenie.h.co-mas-pred-sebou-karta")}</H3>
        <ul>
          <li>{tp("zhromazdenie.p10")}</li>
          <li>{tp("zhromazdenie.p11")}</li>
          <li>{tp("zhromazdenie.p12")}</li>
          <li>{tp("zhromazdenie.p13")}</li>
        </ul>
        <H3 id="co-mas-pred-sebou-akcie">{tp("zhromazdenie.h.co-mas-pred-sebou-akcie")}</H3>
        <ul className="legenda legenda-pravidla">
          {s.akcie.map((a) => (
            <li key={a.kluc}>
              <span className="legenda-ikona">
                <IkonaAkcie kluc={a.kluc} akcia={a} />
              </span>
              <div>
                <strong>{a.nazov}</strong>
                <span>{a.popis}</span>
              </div>
            </li>
          ))}
        </ul>
      </>
    ),
  }),
  kapitola({
    id: "pitka",
    cast: "B",
    obrazok: "07-pitka-a-naex",
    obsah: () => (
      <>
        <H3 id="pitka-pocet">{tp("pitka.h.pitka-pocet")}</H3>
        <p>{tp("pitka.p1")}</p>
        <H3 id="pitka-poradie">{tp("pitka.h.pitka-poradie")}</H3>
        <p>{tp("pitka.p2")}</p>
        <ol>
          <li>{tp("pitka.p3")}</li>
          <li>{tp("pitka.p4")}</li>
          <li>{tp("pitka.p5")}</li>
          <li>{tp("pitka.p6")}</li>
          <li>{tp("pitka.p7")}</li>
          <li>{tp("pitka.p8")}</li>
          <li>{tp("pitka.p9")}</li>
        </ol>
        <p className="tlmene">{tp("pitka.p10")}</p>
        <H3 id="naex">{tp("pitka.h.naex")}</H3>
        <p>{tp("pitka.p11")}</p>
        <p className="zvyraznene">{tp("pitka.p12")}</p>
        <ul>
          <li>{tp("pitka.p13")}</li>
          <li>{tp("pitka.p14")}</li>
          <li>{tp("pitka.p15")}</li>
          <li>{tp("pitka.p16")}</li>
          <li>{tp("pitka.p17")}</li>
          <li>{tp("pitka.p18")}</li>
          <li>{tp("pitka.p19")}</li>
          <li>{tp("pitka.p20")}</li>
          <li>{tp("pitka.p21")}</li>
          <li>{tp("pitka.p22")}</li>
          <li>{tp("pitka.p23")}</li>
        </ul>
        <H3 id="naex-odkrytie">{tp("pitka.h.naex-odkrytie")}</H3>
        <p>{tp("pitka.p24")}</p>
        <p className="zvyraznene">{tp("pitka.p25")}</p>
        <H3 id="naex-odpoved">{tp("pitka.h.naex-odpoved")}</H3>
        <p>{tp("pitka.p26")}</p>
        <H3 id="pitka-cigarety">{tp("pitka.h.pitka-cigarety")}</H3>
        <ul>
          <li>{tp("pitka.p27")}</li>
          <li>{tp("pitka.p28")}</li>
          <li>{tp("pitka.p29")}</li>
        </ul>
        <p className="tlmene">{tp("pitka.p30")}</p>
        <H3 id="schopnost-vazna">{tp("pitka.h.schopnost-vazna")}</H3>
        <p>{tp("pitka.p31")}</p>
        <ul>
          <li>{tp("pitka.p32")}</li>
          <li>{tp("pitka.p33")}</li>
          <li>{tp("pitka.p34")}</li>
          <li>{tp("pitka.p35")}</li>
          <li>{tp("pitka.p36")}</li>
          <li>{tp("pitka.p37")}</li>
          <li>{tp("pitka.p38")}</li>
          <li>{tp("pitka.p39")}</li>
        </ul>
      </>
    ),
  }),
  kapitola({
    id: "cena-pitia",
    cast: "B",
    obrazok: "08-cena-pitia",
    obsah: () => (
      <>
        <H3 id="cena-pecen">{tp("cena-pitia.h.cena-pecen")}</H3>
        <p>{tp("cena-pitia.p1")}</p>
        <H3 id="cena-dlh">{tp("cena-pitia.h.cena-dlh")}</H3>
        <p>{tp("cena-pitia.p2")}</p>
        <p>{tp("cena-pitia.p3")}</p>
        <H3 id="cena-abstak">{tp("cena-pitia.h.cena-abstak")}</H3>
        <p>{tp("cena-pitia.p4")}</p>
        <p>{tp("cena-pitia.p5")}</p>
        <ul>
          <li>{tp("cena-pitia.p6")}</li>
          <li>{tp("cena-pitia.p7")}</li>
        </ul>
        <p>{tp("cena-pitia.p8")}</p>
      </>
    ),
  }),
  kapitola({
    id: "bitka",
    cast: "B",
    obrazok: "09-bitka",
    obsah: () => (
      <>
        <H3 id="bitka-poskodenie">{tp("bitka.h.bitka-poskodenie")}</H3>
        <p>{tp("bitka.p1")}</p>
        <ol>
          <li>{tp("bitka.p2")}</li>
          <li>{tp("bitka.p3")}</li>
          <li>{tp("bitka.p4")}</li>
          <li>{tp("bitka.p5")}</li>
          <li>{tp("bitka.p6")}</li>
        </ol>
        <UkazkaBitky />
        <H3 id="bitka-vysledok">{tp("bitka.h.bitka-vysledok")}</H3>
        <p>{tp("bitka.p7")}</p>
        <p className="zvyraznene">{tp("bitka.p8")}</p>
        <H3 id="bitka-kroky">{tp("bitka.h.bitka-kroky")}</H3>
        <ol className="kroky">
          <li>{tp("bitka.p9")}</li>
          <li>{tp("bitka.p10")}</li>
          <li>{tp("bitka.p11")}</li>
          <li>{tp("bitka.p12")}</li>
          <li>{tp("bitka.p13")}</li>
          <li>{tp("bitka.p14")}</li>
          <li>{tp("bitka.p15")}</li>
          <li>{tp("bitka.p16")}</li>
          <li>{tp("bitka.p17")}</li>
          <li>{tp("bitka.p18")}</li>
          <li>{tp("bitka.p19")}</li>
          <li>{tp("bitka.p20")}</li>
          <li>{tp("bitka.p21")}</li>
          <li>{tp("bitka.p22")}</li>
          <li>{tp("bitka.p23")}</li>
        </ol>
      </>
    ),
  }),
  kapitola({
    id: "starsi",
    cast: "B",
    obrazok: "10-starsi-a-prebytok",
    obsah: () => (
      <>
        <H3 id="starsi-stupnica">{tp("starsi.h.starsi-stupnica")}</H3>
        <p>{tp("starsi.p1")}</p>
        <ul>
          <li>{tp("starsi.p2")}</li>
          <li>{tp("starsi.p3")}</li>
        </ul>
        <p className="zvyraznene">{tp("starsi.p4")}</p>
        <UkazkaStupnice />
        <H3 id="starsi-prebytok">{tp("starsi.h.starsi-prebytok")}</H3>
        <p>{tp("starsi.p5")}</p>
        <ol>
          <li>{tp("starsi.p6")}</li>
          <li>{tp("starsi.p7")}</li>
          <li>{tp("starsi.p8")}</li>
          <li>{tp("starsi.p9")}</li>
        </ol>
        <p>{tp("starsi.p10")}</p>
        <p>{tp("starsi.p11")}</p>
        <H3 id="starsi-vypalne">{tp("starsi.h.starsi-vypalne")}</H3>
        <p>{tp("starsi.p12")}</p>
        <H3 id="starsi-priazne">{tp("starsi.h.starsi-priazne")}</H3>
        <p>{tp("starsi.p13")}</p>
        <table className="tabulka">
          <thead>
            <tr>
              <th>{tp("starsi.p14")}</th>
              <th>{tp("starsi.p15")}</th>
              <th>{tp("starsi.p16")}</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>{tp("starsi.p17")}</td><td>{tp("starsi.p18")}</td><td>+1 / +2 / +3</td></tr>
            <tr><td>{tp("starsi.p19")}</td><td>{tp("starsi.p20")}</td><td>+1 / +2 / +3</td></tr>
            <tr><td>{tp("starsi.p21")}</td><td>{tp("starsi.p22")}</td><td>1 / 2 / 3</td></tr>
            <tr><td>{tp("starsi.p23")}</td><td>{tp("starsi.p24")}</td><td>−1 / −2 / −3</td></tr>
            <tr><td>{tp("starsi.p25")}</td><td>{tp("starsi.p26")}</td><td>1 / 2 / 3</td></tr>
            <tr><td>{tp("starsi.p27")}</td><td>{tp("starsi.p28")}</td><td>+1 / +2 / +3</td></tr>
            <tr><td>{tp("starsi.p29")}</td><td>{tp("starsi.p30")}</td><td>2 / 3 / 4</td></tr>
            <tr><td>{tp("starsi.p31")}</td><td>{tp("starsi.p32")}</td><td>+1 / +2 / +3</td></tr>
          </tbody>
        </table>
        <H3 id="starsi-vydesenie">{tp("starsi.h.starsi-vydesenie")}</H3>
        <ul>
          <li>{tp("starsi.p33")}</li>
          <li>{tp("starsi.p34")}</li>
        </ul>
        <p className="tlmene">{tp("starsi.p35")}</p>
      </>
    ),
  }),

  // ---------------------------------------------------------------- C
  kapitola({
    id: "kliatby",
    cast: "C",
    obrazok: "11-kliatby",
    obsah: () => (
      <>
        <H3 id="kliatby-priznanie">{tp("kliatby.h.kliatby-priznanie")}</H3>
        <p>{tp("kliatby.p1")}</p>
        <ul>
          <li>{tp("kliatby.p2")}</li>
          <li>{tp("kliatby.p3")}</li>
          <li>{tp("kliatby.p4")}</li>
          <li>{tp("kliatby.p5")}</li>
        </ul>
        <H3 id="kliatby-exekutor">{tp("kliatby.h.kliatby-exekutor")}</H3>
        <ol>
          <li>{tp("kliatby.p6")}</li>
          <li>{tp("kliatby.p7")}</li>
          <li>{tp("kliatby.p8")}</li>
        </ol>
      </>
    ),
  }),
  kapitola({
    id: "nastroje",
    cast: "C",
    obrazok: "12-nastroje",
    obsah: () => (
      <>
        <H3 id="nastroje-hrany">{tp("nastroje.h.nastroje-hrany")}</H3>
        <p>{tp("nastroje.p1")}</p>
        <ul>
          <li>{tp("nastroje.p2")}</li>
          <li>{tp("nastroje.p3")}</li>
          <li>{tp("nastroje.p4")}</li>
        </ul>
        <p>{tp("nastroje.p5")}</p>
        <H3 id="nastroje-podlozenie">{tp("nastroje.h.nastroje-podlozenie")}</H3>
        <p className="zvyraznene">{tp("nastroje.p6")}</p>
        <ul>
          <li>{tp("nastroje.p7")}</li>
          <li>{tp("nastroje.p8")}</li>
          <li>{tp("nastroje.p9")}</li>
          <li>{tp("nastroje.p10")}</li>
          <li>{tp("nastroje.p11")}</li>
          <li>{tp("nastroje.p12")}</li>
        </ul>
        <H3 id="nastroje-dedicstvo">{tp("nastroje.h.nastroje-dedicstvo")}</H3>
        <p>{tp("nastroje.p13")}</p>
      </>
    ),
  }),
  kapitola({
    id: "pokrocile",
    cast: "C",
    obrazok: "13-pokrocile-tahy",
    obsah: () => (
      <>
        <H3 id="pokrocile-vypit">{tp("pokrocile.h.pokrocile-vypit")}</H3>
        <p>{tp("pokrocile.p1")}</p>
        <p className="zvyraznene">{tp("pokrocile.p2")}</p>
        <H3 id="pokrocile-zaverecna">{tp("pokrocile.h.pokrocile-zaverecna")}</H3>
        <p>{tp("pokrocile.p3")}</p>
        <H3 id="pokrocile-podstrcenie">{tp("pokrocile.h.pokrocile-podstrcenie")}</H3>
        <p>{tp("pokrocile.p4")}</p>
        <H3 id="pokrocile-modifikatory">{tp("pokrocile.h.pokrocile-modifikatory")}</H3>
        <ul>
          <li>{tp("pokrocile.p5")}</li>
          <li>{tp("pokrocile.p6")}</li>
          <li>{tp("pokrocile.p7")}</li>
          <li>{tp("pokrocile.p8")}</li>
          <li>{tp("pokrocile.p9")}</li>
          <li>{tp("pokrocile.p10")}</li>
          <li>{tp("pokrocile.p11")}</li>
          <li>{tp("pokrocile.p12")}</li>
        </ul>
      </>
    ),
  }),
  kapitola({
    id: "lokality",
    cast: "C",
    obrazok: "14-lokality",
    obsah: () => (
      <table className="tabulka">
        <thead>
          <tr>
            <th>{tp("lokality.p1")}</th>
            <th>{tp("lokality.p2")}</th>
            <th>{tp("lokality.p3")}</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>{tp("lokality.p4")}</td><td>{tp("lokality.p5")}</td><td>{tp("lokality.p6")}</td></tr>
          <tr><td>{tp("lokality.p7")}</td><td>{tp("lokality.p8")}</td><td>{tp("lokality.p9")}</td></tr>
          <tr><td>{tp("lokality.p10")}</td><td>{tp("lokality.p11")}</td><td>{tp("lokality.p12")}</td></tr>
          <tr><td>{tp("lokality.p13")}</td><td>{tp("lokality.p14")}</td><td>{tp("lokality.p15")}</td></tr>
          <tr><td>{tp("lokality.p16")}</td><td>{tp("lokality.p17")}</td><td>{tp("lokality.p18")}</td></tr>
          <tr><td>{tp("lokality.p19")}</td><td>{tp("lokality.p20")}</td><td>{tp("lokality.p21")}</td></tr>
          <tr><td>{tp("lokality.p22")}</td><td>{tp("lokality.p23")}</td><td>{tp("lokality.p24")}</td></tr>
          <tr><td>{tp("lokality.p25")}</td><td>{tp("lokality.p26")}</td><td>{tp("lokality.p27")}</td></tr>
          <tr><td>{tp("lokality.p28")}</td><td>{tp("lokality.p29")}</td><td>{tp("lokality.p30")}</td></tr>
          <tr><td>{tp("lokality.p31")}</td><td>{tp("lokality.p32")}</td><td>{tp("lokality.p33")}</td></tr>
          <tr><td>{tp("lokality.p34")}</td><td>{tp("lokality.p35")}</td><td>{tp("lokality.p36")}</td></tr>
          <tr><td>{tp("lokality.p37")}</td><td>{tp("lokality.p38")}</td><td>{tp("lokality.p39")}</td></tr>
          <tr><td>{tp("lokality.p40")}</td><td>{tp("lokality.p41")}</td><td>{tp("lokality.p42")}</td></tr>
          <tr><td>{tp("lokality.p43")}</td><td>{tp("lokality.p44")}</td><td>{tp("lokality.p45")}</td></tr>
          <tr><td>{tp("lokality.p46")}</td><td>{tp("lokality.p47")}</td><td>{tp("lokality.p48")}</td></tr>
          <tr><td>{tp("lokality.p49")}</td><td>{tp("lokality.p50")}</td><td>{tp("lokality.p51")}</td></tr>
          <tr><td>{tp("lokality.p52")}</td><td>{tp("lokality.p53")}</td><td>{tp("lokality.p54")}</td></tr>
          <tr><td>{tp("lokality.p55")}</td><td>{tp("lokality.p56")}</td><td>{tp("lokality.p57")}</td></tr>
          <tr><td>{tp("lokality.p58")}</td><td>{tp("lokality.p59")}</td><td>{tp("lokality.p60")}</td></tr>
        </tbody>
      </table>
    ),
  }),
  kapitola({
    id: "bodovanie",
    cast: "C",
    obrazok: "15-bodovanie",
    obsah: () => (
      <>
        <p>{tp("bodovanie.p1")}</p>
        <H3 id="spaky-zdroje">{tp("bodovanie.h.spaky-zdroje")}</H3>
        <table className="tabulka">
          <thead>
            <tr>
              <th>{tp("bodovanie.p2")}</th>
              <th>{tp("bodovanie.p3")}</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>{tp("bodovanie.p4")}</td><td>{tp("bodovanie.p5")}</td></tr>
            <tr><td>{tp("bodovanie.p6")}</td><td>{tp("bodovanie.p7")}</td></tr>
            <tr><td>{tp("bodovanie.p8")}</td><td>{tp("bodovanie.p9")}</td></tr>
            <tr><td>{tp("bodovanie.p10")}</td><td>{tp("bodovanie.p11")}</td></tr>
            <tr><td>{tp("bodovanie.p12")}</td><td>{tp("bodovanie.p13")}</td></tr>
            <tr><td>{tp("bodovanie.p14")}</td><td>{tp("bodovanie.p15")}</td></tr>
            <tr><td>{tp("bodovanie.p16")}</td><td>{tp("bodovanie.p17")}</td></tr>
            <tr><td>{tp("bodovanie.p18")}</td><td>{tp("bodovanie.p19")}</td></tr>
            <tr><td>{tp("bodovanie.p20")}</td><td>{tp("bodovanie.p21")}</td></tr>
          </tbody>
        </table>
        <p className="zvyraznene">{tp("bodovanie.p22")}</p>
        <H3 id="finale">{tp("bodovanie.h.finale")}</H3>
        <ul>
          <li>{tp("bodovanie.p23")}</li>
          <li>{tp("bodovanie.p24")}</li>
          <li>{tp("bodovanie.p25")}</li>
          <li>{tp("bodovanie.p26")}</li>
          <li>{tp("bodovanie.p27")}</li>
        </ul>
        <H3 id="ako-sa-vyhrava-podrobne">{tp("bodovanie.h.ako-sa-vyhrava-podrobne")}</H3>
        <div className="karticky">
          <div className="karticka">{tp("bodovanie.p28")}</div>
          <div className="karticka karticka-ok">{tp("bodovanie.p29")}</div>
          <div className="karticka karticka-zle">{tp("bodovanie.p30")}</div>
        </div>
        <div className="riadok-tlacidiel">
          <Odkaz href="/hra" className="tlacidlo tlacidlo-hlavne">{tp("bodovanie.p31")}</Odkaz>
          <Odkaz href="/karty" className="tlacidlo">{tp("bodovanie.p32")}</Odkaz>
        </div>
      </>
    ),
  }),
];

/** Staré kotvy kapitol (pred osnovou 2026-10-24) → nové, nech staré odkazy nevedú do prázdna. */
export const STARE_KOTVY: Readonly<Record<string, string>> = {
  koncept: "co-je-naex",
  pojmy: "slovnik",
  karty: "co-mas-pred-sebou",
  akcie: "co-mas-pred-sebou-akcie",
  aktivacia: "zhromazdenie-spoj",
  poskodenie: "bitka-poskodenie",
  poldeci: "naex",
  vykladanie: "zhromazdenie",
  dedicstvo: "nastroje",
  "nastroje-linia": "nastroje-podlozenie",
  dlh: "kliatby-exekutor",
  pecen: "cena-pitia",
  zavislost: "cena-abstak",
  priebeh: "kolo",
  lokalita: "ciel-a-senok",
  "starsi-bitka": "patronat",
  vyhodnotenie: "bitka-kroky",
  koniec: "bodovanie",
};
