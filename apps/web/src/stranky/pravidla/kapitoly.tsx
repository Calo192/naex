// Kapitoly pravidiel v poradí, v akom plynie partia (osnova Navrhára
// docs/napady/pravidla-osnova.html, schválil Michal 2026-10-24). Text píšeme
// podľa toho, čo hra naozaj robí — pravdou je jadro a ťahák
// tools/playtest/tahak.md, nie staré texty (audit rozporov v osnove).

import type { ReactNode } from "react";
import type { Sada } from "@naex/tvorba";
import { IkonaAkcie } from "../../karta/IkonaAkcie.tsx";
import { Odkaz } from "../../lib/router.tsx";
import { UkazkaBitky, UkazkaLimitu, UkazkaSpajania, UkazkaStupnice } from "../Ukazky.tsx";
import { Pojem as P } from "./Pojem.tsx";

export type Cast = "A" | "B" | "C";

export const CASTI: readonly { readonly id: Cast; readonly nazov: string }[] = [
  { id: "A", nazov: "Rýchly štart" },
  { id: "B", nazov: "Kolo krok za krokom" },
  { id: "C", nazov: "Podrobnosti" },
];

export interface Kapitola {
  readonly id: string;
  readonly cast: Cast;
  readonly nazov: string;
  /** Kratší názov do obsahu, keď sa celý nezmestí na riadok. */
  readonly kratky?: string;
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
      <a className="kotva" href={`#${id}`} aria-label="Odkaz na túto časť">
        §
      </a>
    </h3>
  );
}

export const KAPITOLY: readonly Kapitola[] = [
  // ---------------------------------------------------------------- A
  {
    id: "co-je-naex",
    cast: "A",
    nazov: "Čo je NA EX!",
    obrazok: "01-co-je-naex",
    vSkratke: ["Dvaja hráči, dedina a krčma.", "Bijú sa o lokality a desia starších.", "Hra je zámerne prehnaná karikatúra."],
    obsah: () => (
      <>
        <p>
          <strong>NA EX!</strong> je kartová hra pre dvoch hráčov zasadená do drsnej dediny. Každé kolo sa bijete o jednu{" "}
          <P k="lokalita">lokalitu</P> — krčmu, kostol, benzínku — a cestou desíte <P k="starsi">starších</P>, vážené osoby
          dediny. Kto vyhráva bitky, ten zbiera <P k="spak">špaky</P> a k nim ďalšie od starších, ktorí sa ho boja.
        </p>
        <p>
          Karty kladiete do spoločnej <P k="linia">línie</P>, pijete <P k="poldeci">poldeci</P>, fajčíte{" "}
          <P k="cigareta">cigarety</P> a robíte dlhy. Všetko má svoju cenu — pečeň, Dlhy a abstinenčné príznaky ťa dobehnú.
        </p>
        <p className="tlmene upozornenie">
          Hra je fikcia a zámerne zveličená karikatúra. Alkohol, fajčenie, hazard ani dlhy v skutočnom živote nikomu
          neodporúčame.
        </p>
      </>
    ),
  },
  {
    id: "ako-sa-vyhrava",
    cast: "A",
    nazov: "Ako sa vyhráva",
    obrazok: "02-ako-sa-vyhrava",
    vSkratke: [
      "Víťazné body sú špaky: za vyhratú bitku a k nej za starších, ktorí sa ťa boja.",
      "Po finále vyhrá, kto má viac špakov; rovnosť je remíza.",
      "Okamžitá výhra po vyhratej bitke: dosť väzňov podľa ligy (2 / 3 / 4) alebo štyria starší s tvojím červeným strachom.",
    ],
    obsah: () => (
      <>
        <div className="karticky">
          <div className="karticka">
            <strong>Špaky.</strong> Hrá sa 3, 5 alebo 7 bitiek o lokality podľa <P k="dlzka-hry">ligy</P> a potom{" "}
            <P k="finale">finále</P> — posledná bitka o pinnacle lokalitu, ktorú vyberie hráč s viac špakmi — útočí zaostávajúci. Víťaz bitky (aj finále) dostane 1 <P k="spak">špak</P> za každú
            kartu, ktorá pri bitke leží v línii (tvoje aj súperove). Po každej bitke dajú špaky aj <P k="starsi">starší</P>: stupeň 1 / 2 / 2 tomu, kto ho
            drží — víťazovi za strach a obom za <P k="reci">reči</P>.
            Po finále sa ešte <P k="vykupne">vykúpi</P>, čo ti ostalo: každý plný poldeci 1 špak, každých 5 cigariet 1 špak. Potom vyhrá, kto má
            viac špakov.
          </div>
          <div className="karticka karticka-ok">
            <strong>Vyhráš hneď</strong>, keď po vyhratej bitke máš dosť <P k="vazen">väzňov</P> — Tretia liga 2, Druhá 3, Prvá 4 (zajíma
            sa Nakladačkou, <a href="#patronat">Zajatie a presvedčenie</a>) — alebo červený strach u štyroch starších (väzni sa rátajú).
            Po finále väzni špaky nedávajú.
          </div>
          <div className="karticka karticka-zle">
            <strong>O špaky prídeš</strong> pri <P k="exekutor">exekúcii</P> (v každej bitke, keď máš priznané Dlhy: zhorí polovica tvojich Dlhov nahor a rovnako veľa
            špakov) a za každú nepriznanú Cirhózu na konci hry (3 špaky). Okamžitá prehra nie je — ani exekúcia, ani malý
            balíček ťa o hru nepripravia.
          </div>
        </div>
        <p>
          Všetky zdroje špakov sú v kapitole <a href="#bodovanie">Špaky a finále</a>. Na začiatok stačí vedieť: vyhratá bitka
          dáva špak za každú kartu v línii a starší, ktorého si vystrašil, ti dá špaky po každej ďalšej vyhratej bitke — a súperovi medzitým prejavuje priazeň.
        </p>
      </>
    ),
  },
  {
    id: "co-mas-pred-sebou",
    cast: "A",
    nazov: "Čo máš pred sebou",
    obrazok: "03-co-mas-pred-sebou",
    vSkratke: [
      "Ruka, doberací a odhadzovací balíček.",
      "Bar: poldeci, cigarety, pečeň, Dlhy, neresti kola, Chuť a špaky.",
      "Karta má akcie po hranách, tagy a efekt.",
    ],
    obsah: (s) => (
      <>
        <H3 id="co-mas-pred-sebou-bar">Ruka, balíček a bar</H3>
        <p>
          Máš <strong>ruku</strong> (bez limitu), <strong>doberací balíček</strong> a <strong>odhadzovací balíček</strong>. Keď sa
          doberací balíček minie, odhadzovací sa zamieša a stane sa z neho nový doberací balíček. Na bare vidíš svoje <P k="poldeci">poldeci</P> (plné a vypité),{" "}
          <P k="cigareta">cigarety</P>, <P k="pecen">pečeň</P>, <P k="dlh">Dlhy</P>, <P k="nerest">neresti</P> kola, <P k="chut">Chuť</P> a svoje{" "}
          <P k="spak">špaky</P>.
        </p>
        <H3 id="co-mas-pred-sebou-karta">Karta</H3>
        <ul>
          <li>
            <strong>Akcie na hranách</strong> — najviac 4 na každej hrane, vo výškach 0 (hore) až 3 (dole). Akcia platí, len keď sa
            stretne s akciou suseda v rovnakej výške. Nástroj má namiesto nich hornú a dolnú hranu (kapitola{" "}
            <a href="#nastroje">Nástroje a Dedičstvo</a>).
          </li>
          <li>
            <strong>Tagy</strong> — druh karty (<P k="tag">Občan, Zviera, Starešina, Nástroj</P>…). Samy nič nerobia, odkazujú na
            ne efekty.
          </li>
          <li>
            <strong>Efekt</strong> — text karty. Tučné slovo na začiatku hovorí kedy (Nástup, Pitka, Bitka, Furt, Podpora,
            Spoločník…), slová kurzívou čo. <P k="akcia-navyse">Akcie navyše</P> sú v pečati dole v ilustrácii. Presné významy sú
            v <a href="#slovnik">slovníku</a>.
          </li>
          <li>
            <strong>Varianty</strong> — každá karta existuje vo viacerých variantoch: rovnaké akcie, iné výšky.{" "}
            <Odkaz href="/karty">Prezri si karty</Odkaz>.
          </li>
        </ul>
        <H3 id="co-mas-pred-sebou-akcie">Akcie</H3>
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
  },
  {
    id: "kolo",
    cast: "A",
    nazov: "Kolo v piatich krokoch a príprava",
    kratky: "Kolo a príprava",
    obrazok: "04-kolo",
    vSkratke: [
      "Cieľ → šenok → Zhromaždenie a Pitka (1–5×) → bitka → po bitke.",
      "Štart: 4 karty v ruke, prázdny balíček, 2 plné poldeci, 3 cigarety.",
      "Útočník prehral poslednú bitku, obranca ju vyhral.",
      "Lokality idú po úrovniach (Druhá liga 1 · 2 · 2 · 3 · 3), obranca vyberá z lokalít úrovne kola.",
      "Po poslednej lokalite finále na pinnacle lokalite (Poľovnícka chata, Predsedova vila, Herňa).",
    ],
    obsah: () => (
      <>
        <div className="priebeh">
          <span>1 Cieľ</span>→<span>2 Šenok</span>→<span>3 Zhromaždenie a Pitka 1–5×</span>→<span>4 Bitka</span>→<span>5 Po bitke</span>
        </div>
        <ol className="kroky">
          <li>
            <strong>Cieľ.</strong> <P k="utocnik">Obranca</P> (víťaz poslednej bitky) vyberie lokalitu, natočí ju víťaz minulej hádky.
          </li>
          <li>
            <strong>Šenok.</strong> Spolu postavíte ponuku kariet a beriete z nej za cigarety.
          </li>
          <li>
            <strong>Zhromaždenie a Pitka.</strong> Striedavo vykladáte karty do línie, potom sa pije a vyhodnocuje. Opakuje sa
            1- až 5-krát podľa línie (5-krát len na pinnacle vo finále).
          </li>
          <li>
            <strong>Bitka.</strong> Viac tuhého poškodenia vyhráva a dostane špak za každú kartu v línii. Starší bodujú. Víťaz rozdelí
            Nakladačku na svoj strach, víťaz hádky hádku na svoje reči.
          </li>
          <li>
            <strong>Po bitke.</strong> Porazený dostane 1 cigaretu. Súper ti dá 1 cigaretu za každého staršieho s tvojím červeným strachom, aj
            za väzňa, koľko má (<P k="vypalne">výpalné</P>). Po finále ani jedno. Karty z línie idú do odhadzovacích balíčkov. Na začiatku ďalšieho
            kola sa každému doleje jeden vypitý poldeci a každý si <P k="dobratie">dobere</P> do 3 kariet v ruke.
          </li>
        </ol>
        <H3 id="kolo-priprava">Príprava</H3>
        <p>
          Zvoľte <P k="dlzka-hry">ligu</P> — Tretia liga má 3 lokality, Druhá 5, Prvá 7; po nich príde <P k="finale">finále</P>. Každý hráč má
          na začiatku v ruke <strong>4 štartovacie karty</strong> — Miňištranta, Milujúcu manželku, Pijana a Dievčinu na vydaj.
          Doberací balíček je prázdny, naplní ho až odhadzovací; dovtedy sa nedá ťahať ani fajčiť. K tomu{" "}
          <strong>2 plné poldeci, 3 cigarety a 0 špakov</strong>. Hra rozdá 8 starších, každému náhodne jeho priazeň; strach aj
          reči oboch hráčov sú pri nich na nule.
        </p>
        <H3 id="kolo-utocnik">Útočník a obranca</H3>
        <p>
          <strong>Útočník</strong> je ten, kto prehral poslednú bitku: v Zhromaždení vykladá prvý a na odkryté NA EX odpovedá prvý.{" "}
          <strong>Obranca</strong> vyberá cieľ kola (natáča ho víťaz minulej hádky) a zo šenku berie prvý. Pitku hráte obaja naraz; odpovede na NA EX idú lícom dole a otočia sa naraz. Vo finále
          útočí zaostávajúci — kto má menej špakov.
        </p>
      </>
    ),
  },

  // ---------------------------------------------------------------- B
  {
    id: "ciel-a-senok",
    cast: "B",
    nazov: "Cieľ a šenok",
    obrazok: "05-ciel-a-senok",
    vSkratke: [
      "Obranca vyberie lokalitu, víťaz minulej hádky ju natočí.",
      "Stavba šenku: polovica kariet do šenku, polovica naspodok balíčka.",
      "Branie striedavo: 1 karta za 1 cigaretu, 2 karty za 3.",
      "Zajíma sa za 5 bodov a presviedča za 3 — po bitke, pri rozdelení Nakladačky a hádky.",
    ],
    obsah: () => (
      <>
        <H3 id="ciel">Cieľ kola</H3>
        <p>
          Obranca vyberie lokalitu, o ktorú sa bude biť, a víťaz hádky z minulého kola ju <P k="natocenie">natočí</P> (v prvom kole a po remíze v hádke ten, kto vyberá). Lokalita leží v strede línie a delí ju
          na dva <P k="kraj">kraje</P>. Natočenie určuje, ktorá hrana lokality patrí ktorému kraju — akcie
          hrany dostane, kto v tom kraji má <a href="#zhromazdenie-prevaha">prevahu</a>. Efekt lokality platí len v kole, keď sa
          o ňu bije (<a href="#lokality">tabuľka lokalít</a>). Vo finále vyberá obranca — kto vedie — z troch pinnacle lokalít a hrá sa o ňu ako o každú inú.
        </p>
        <H3 id="senok-stavba">Stavba šenku</H3>
        <p>
          Karty šenku ležia v dvoch balíčkoch lícom dole: <P k="naradie">Náradie</P> (Nástroje) a <P k="obcania">Občania</P>{" "}
          (všetky ostatné). Nevzaté karty zo starého šenku idú naspodok svojho balíčka. Potom si každý vezme{" "}
          <strong>2 karty z Náradia a 6 z Občanov</strong>. Obaja naraz a tajne dáte <strong>4 do šenku</strong> v ľubovoľnom mixe
          a zvyšné 4 <strong>naspodok ich balíčka</strong> (súper ich nevidí). Nič si nepodávate; šenok má 8 kariet. Keď niektorý
          balíček nestačí, chýbajúce karty dá druhý.
        </p>
        <H3 id="senok-branie">Branie zo šenku</H3>
        <p>
          Beriete striedavo, začína <strong>obranca</strong> — na svojom prvom ťahu len <strong>1 kartu</strong>, aby nevykradol šenok. Inak na ťahu vezmeš <strong>1 kartu za 1 cigaretu</strong> alebo{" "}
          <strong>2 karty za 3 cigarety</strong>. Šenok sa poldeci neplatí. Kto prestane, druhému ostáva už len jeden ťah; kto
          nemá cigaretu, prestane sám. Potom sa šenok doplní na 8 kariet — najprv z Náradia, kým v ňom nie sú aspoň 2 Nástroje, zvyšok z Občanov. Väzni počet kariet
          stavby nemenia.
        </p>
        <H3 id="patronat">Zajatie a presvedčenie</H3>
        <p>
          Zajíma a presviedča sa <strong>po bitke</strong>, keď sa rozdeľuje Nakladačka
          a hádka (kapitola <a href="#starsi">Starší a Nakladačka</a>). Vo finále ani jedno.
        </p>
        <ul>
          <li>
            <strong>Zajatie</strong> — kto rozdeľuje Nakladačku, zajme za <strong>5 bodov</strong> staršieho, pri ktorom má svoj{" "}
            <strong>strach na červenej už pred touto Nakladačkou</strong> — teda od minulého kola; strach dotiahnutý na červenú v tom
            istom rozdelení nestačí. Na stole sa pri takom staršom ukáže pečiatka <strong>ZAJAŤ</strong>. Smie aj viac naraz
            a nemusí. Starší je jeho <P k="vazen">väzeň</P>: leží medzi jeho priznanými kartami, zo stupnice zmizne a súper mu odovzdá
            toľko špakov, koľko bodov hádky má pri ňom v rečiach, najviac koľko má. Väzeň sa ráta ako červená
            a má <a href="#schopnost-vazna">schopnosť</a>. Väzni na výhru podľa ligy — Tretia 2, Druhá 3, Prvá 4 — končia hru hneď.
          </li>
          <li>
            <strong>Presvedčenie</strong> — kto rozdeľuje hádku, presvedčí za <strong>3 body</strong> ktoréhokoľvek staršieho, keď má pri ňom{" "}
            <strong>reči na celom teplomere</strong> (dotiahnuť ich smie v tom istom
            rozdelení; na stole pečiatka <strong>PRESVEDČIŤ</strong>). Reči, strach oboch aj priazeň ostávajú. <strong>Karta staršieho ide do jeho ruky a natrvalo patrí
            do jeho balíčka</strong> — hrá sa ako Starešina, len akcie; schopnosť väzňa nemá. Kto prvý presvedčí, toho je; zajať
            presvedčeného smú obaja — karta potom zmizne odkiaľkoľvek do pivnice.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "zhromazdenie",
    cast: "B",
    nazov: "Zhromaždenie: kladenie a spoje",
    kratky: "Zhromaždenie a spoje",
    obrazok: "06-zhromazdenie",
    vSkratke: [
      "Kartu kladieš na ktorýkoľvek koniec línie; ostáva tvoja.",
      "Akcia platí, len keď sa na spoji stretne s akciou suseda v rovnakej výške.",
      "Limit vykladania = plné poldeci + 1.",
      "Pas dá cigaretu za každú kartu, ktorú si ešte smel vyložiť a máš ju v ruke.",
      "Konflikt a Podpora sa spustia priložením karty; akcie navyše z pečate a Preškolenie menia akcie kariet.",
    ],
    obsah: (s) => (
      <>
        <H3 id="zhromazdenie-linia">Línia, dva konce a dva kraje</H3>
        <p>
          Karty tvoria <strong>jednu súvislú <P k="linia">líniu</P></strong> bez vetvenia. Lokalita v strede ju delí na dva{" "}
          <P k="kraj">kraje</P>. Na ťahu položíš kartu na <strong>ktorýkoľvek z dvoch <P k="koniec-linie">koncov línie</P></strong> — žiaden nie je tvoj.
          Karta je vždy natočená k tebe a ostáva tvoja — je v tvojej <P k="partia">partii</P> a jej akcie aj efekty sa rátajú
          tebe, nech leží kdekoľvek. Aj vo finále leží v strede lokalita — pinnacle — a karty sa kladú k nej ako v každom kole.
        </p>
        <H3 id="zhromazdenie-spoj">Spoj akcií</H3>
        <p>
          Karty v línii sa dotýkajú hranami. Karta sa páruje <strong>vnútornou hranou</strong> — tou, ktorá je obrátená k lokalite
          — so susedom bližšie k stredu (alebo s lokalitou). Akcia je aktívna, keď sa na <P k="spoj">spoji</P> stretnú dve
          neprázdne akcie v <strong>rovnakej výške</strong>. Akcia bez partnera nerobí nič a každá aktívna akcia sa počíta
          samostatne. Keď kartu ťaháš na stôl, hra ešte pred pustením ukáže, s čím sa spojí.
        </p>
        <UkazkaSpajania sada={s} />
        <H3 id="zhromazdenie-limit">Limit vykladania a pas</H3>
        <p>
          V Zhromaždení vykladáte striedavo, začína útočník. Za jedno Zhromaždenie vyložíš najviac{" "}
          <P k="limit">plné poldeci + 1</P> kariet — aj bez plných poldeci aspoň jednu. Limit sa ráta nanovo na začiatku každého
          Zhromaždenia. NA EX limit nemíňa (dáva sa v Pitke), ale jeho poldeci odíde zo zásoby na kartu — v ďalšom
          Zhromaždení kola máš limit o 1 nižší a pri bitke sa vypije. Podloženie Nástroja ani Dedičstvo limit nemíňajú.
        </p>
        <UkazkaLimitu />
        <p>
          Keď nechceš vykladať, <P k="pas">pasuješ</P>: do Pitky už nevykladáš, súper môže pokračovať sám a ty dostaneš{" "}
          <strong>cigaretu za každú kartu</strong>, ktorú si ešte smel vyložiť — najviac toľko, koľko máš kariet v ruke (s prázdnou
          rukou nič). Keď nemáš inú možnosť, hra pasuje za teba.
        </p>
        <H3 id="zhromazdenie-prevaha">Prevaha v kraji</H3>
        <p>
          Akcie hrany lokality dostane hráč s <P k="prevaha">prevahou</P> v tom <P k="kraj">kraji</P> — kto tam má viac svojich{" "}
          <strong>Občanov, Zvierat a Starešinov</strong> (podložený Nástroj sa neráta). Pri rovnosti hráč, ktorého karta
          v kraji leží hneď pri lokalite. Jedna súperova karta v kraji teda neukradne akcie hrany, ale tvorí s nimi spoj: ako prvá
          karta pri lokalite určuje, ktoré akcie hrany sa aktivujú, a tie dostane hráč s prevahou. Kraje majú mená podľa lokality, napríklad
          v Krčme „pri výčape“ a „pri dverách“.
        </p>
        <H3 id="zhromazdenie-efekty">Konflikt, Podpora a akcie navyše</H3>
        <p>
          Niektoré efekty sa spustia, keď sa karty stretnú <strong>priložením</strong> — kartu položíš na koniec línie k inej.{" "}
          <P k="konflikt">Konflikt</P> sa spustí, keď sa karta stretne so súperovou (prikladáš ty, alebo súper k tvojej),{" "}
          <P k="podpora">Podpora</P>, keď sa stretnú dve tvoje karty. S tagom za dvojbodkou („Podpora: Pamätník“) len pri karte
          s tým tagom, bez tagu pri ktorejkoľvek. Podloženie Nástroja, NA EX, zrážka ani presun karty ich nespustia.{" "}
          <P k="spolocnik">Spoločník</P> s tagom platí, kým máš v partii inú odkrytú kartu s tým tagom, <P k="nepriatel">Nepriateľ</P>,
          kým ju má v partii súper.
        </p>
        <p className="zvyraznene">
          <P k="akcia-navyse">Akcie navyše</P> sú v pečati dole v ilustrácii karty. Sú to aktívne akcie majiteľa karty mimo hrán
          a rátajú sa ako tie isté akcie. Pri Spoločníkovi a Nepriateľovi platia raz, kým platí podmienka; pri Podpore a Konflikte
          za každé stretnutie, do konca kola. Posilnenie, Odpor, NA EX ani podložený Nástroj ich nemenia, Nástroje v Dedičstve (napríklad Valaška) áno.
        </p>
        <p>
          <P k="skolitel">Školiteľ</P> má efekt <P k="preskolenie">Preškolenie</P> X → Y: akcia X inej karty sa ráta ako Y —
          ešte pred spojmi, na oboch hranách aj v akciách navyše. Pri spúšťači Furt preškolí oboch susedov (aj súperove karty),
          kým s ním susedia; pri Podpore tvoju kartu a pri Konflikte súperovu, s ktorou sa stretne, do konca kola. Každá akcia sa
          preškolí len raz a preškolenia sa nereťazia.
        </p>
      </>
    ),
  },
  {
    id: "pitka",
    cast: "B",
    nazov: "Pitka a NA EX",
    obrazok: "07-pitka-a-naex",
    vSkratke: [
      "Počet Pitiek = 1 + menší počet aktivovaných akcií lokality z jej dvoch krajov.",
      "Pitku hráte obaja naraz, každý skončí sám; NA EX sa odkryjú naraz a odpovede na ne idú lícom dole.",
      "NA EX vyberáte skryto; odkryje sa, keď ste hotoví obaja.",
      "NA EX zruší aktívne a zdvojí neaktívne akcie karty; karta musí mať oboje.",
      "Na každé súperovo NA EX odpovieš jednou kartou lícom dole — najprv útočník, potom obranca na druhý kraj línie; otočia sa naraz.",
      "Fajčí sa len v Pitke.",
    ],
    obsah: () => (
      <>
        <H3 id="pitka-pocet">Koľko Pitiek</H3>
        <p>
          Po Zhromaždení nasleduje <P k="pitka">Pitka</P>. V bitke je ich <strong>1 + menší z počtov aktivovaných akcií lokality</strong>{" "}
          v jej dvoch krajoch (1 až 5). Akciu lokality aktivuje karta, ktorá s ňou tvorí spoj; Odpor na hrane lokality sa ráta,
          akcia hrany zrušená Odporom karty nie. Ak sú v jednom kraji aktivované 3 akcie lokality a v druhom 1, pijú sa{" "}
          <strong>2 Pitky</strong> — ráta sa podľa krajov, nie podľa toho, kto kartu zahral; akcia ×2 je stále jedna. Pred každou Pitkou je Zhromaždenie. Počet sa počas kola mení s líniou — začatá Pitka sa vždy
          dopije. Úroveň lokality je počet akcií na jej hrane (1, 2, 3, pinnacle 4), takže kolo má 1 až 5 Pitiek. Počet Pitiek špaky neurčuje — víťaz bitky dostane špak za každú kartu v línii.
        </p>
        <H3 id="pitka-poradie">Poradie Pitky</H3>
        <p>
          <strong>Pitku hráte obaja naraz.</strong> Kým ju neskončíš, smieš fajčiť, doliať, barterovať
          a skryto vybrať NA EX — súperove nákupy vidíš hneď, jeho NA EX nie. Keď skončíš, nedá sa to vrátiť. Keď ste hotoví
          obaja, NA EX sa odkryjú <strong>naraz</strong> a odpovedáte na ne lícom dole — najprv útočník, potom obranca na druhý kraj línie; obe sa otočia naraz. Jediná výnimka
          je <strong>Bzdocha</strong>: jej majiteľ čaká, kým súper skončí, a potom hrá a vidí jeho NA EX. Potom sa Pitka vyhodnotí:
        </p>
        <ol>
          <li>NA EX — odkrytie a odpovede.</li>
          <li>Hazard — za každú akciu jeden Dlh (počítadlo, hneď priznaný).</li>
          <li>Poškodenie pečene — za každý celý prah Cirhóza.</li>
          <li>Obmedzenie.</li>
          <li>Cigarety — za akcie Cigareta (mínus súperove Obmedzenia).</li>
          <li>
            <P k="vizia">Vízia</P> — za každú aktívnu Víziu pozrieš vrchnú kartu svojho balíčka a vezmeš si ju do ruky, alebo ju
            navždy spáliš.
          </li>
          <li>Záverečné karty sa otočia lícom hore (kapitola <a href="#pokrocile">Pokročilé ťahy</a>).</li>
        </ol>
        <p className="tlmene">
          Pitka sama karty nedáva — doberáš si ich fajčením a Víziou. Kartu zo šenku zadarmo ti dá Zastávka po prvej Pitke a Podpora
          Predavačky (Občana) či Živnostníka (Nástroj).
        </p>
        <H3 id="naex">NA EX</H3>
        <p>
          V Pitke, kým ju neskončíš, položíš plný poldeci na kartu v línii s tagom <strong>Občan</strong> alebo{" "}
          <strong>Starešina</strong> — svoju aj súperovu. V základe raz za Pitku. Karta musí mať{" "}
          <strong>aspoň jednu aktívnu a aspoň jednu neaktívnu akciu</strong>; inak by <P k="naex">NA EX</P> nič nezmenilo.{" "}
          <strong>NA EX vyberáš skryto</strong> — súper nevie, či si ho dal ani kam, kým nie ste hotoví obaja.
        </p>
        <p className="zvyraznene">
          NA EX karte <strong>zruší aktívne akcie a zdvojí neaktívne</strong>. Akcie sa rátajú majiteľovi karty: na svojej si
          zdvojíš Petelicu alebo zrušíš vlastný Hazard, na súperovej mu zrušíš, čo potreboval, ale jeho neaktívne mu zdvojíš.
          Násobky sa násobia — NA EX vedľa Silnej ženy dá ×4, aj Hazardu a Poškodeniu pečene. Poldeci leží na karte do bitky,
          takže NA EX sa vyhodnotí v každej Pitke kola; pečeň +1 je tvoja (pripíše sa pri odkrytí) a v bitke sa poldeci vypije.
          Pred potvrdením ti hra ukáže bitku pred a po aj kliatby, ktoré z toho budú.
        </p>
        <ul>
          <li>Nedá sa dať na kartu, na ktorej už poldeci leží, ani na kartu, pod ktorou leží Vínko, Injekcia alebo Vidly.</li>
          <li>Akcia zrušená Odporom nie je ani aktívna, ani neaktívna — NA EX ju nezdvojí.</li>
          <li>Na Kostole len na kartu na konci línie (na ktoromkoľvek z dvoch koncov), najďalej od Kostola.</li>
          <li>NA EX na kartu pri lokalite mení len akcie karty — akcie hrany lokality ostávajú aktívne.</li>
          <li>
            NA EX na kartu s Posilnením zruší Posilnenie aj ×2, ktoré dávalo partnerovi na spoji — partnerova akcia (aj hrana
            lokality) ostáva aktívna, ale len ×1. Rovnako pri každej zrušenej akcii: jej partner na spoji ostáva aktívny ×1.
          </li>
          <li>Veterán je výnimka: NA EX mu aktívne akcie zdvojí (nezruší) a neaktívne nechá.</li>
          <li>Súperovu Záverečnú (lícom dole) smie dostať NA EX vždy.</li>
          <li>
            V Krčme musí dať NA EX každý, kto má plný poldeci a kam ho dať; vo Vínnej pivnici smieš
            dvakrát za Pitku.
          </li>
        </ul>
        <H3 id="naex-odkrytie">Odkrytie a Výtržník</H3>
        <p>
          Keď ste hotoví obaja, NA EX sa odkryjú <strong>naraz</strong> — oba poldeci ľahnú na karty súčasne. Až vtedy sa
          pripíše pečeň (na Kare ju dostane súper) a vyhodnotí sa hrozba schopnosti Vychovávateľky. Potom odpovede.
        </p>
        <p className="zvyraznene">
          <strong>Zrážka:</strong> ak ste obaja vybrali tú istú kartu, je z nej <P k="vytrznik">Výtržník</P>. So susedmi sa
          najprv spáruje ako obvykle, potom sa <strong>všetky jej akcie zmenia na Rany</strong> pre jej majiteľa — aj tie bez
          partnera. Aj jej Posilnenie a Odpor sú už len Rany — suseda nezdvojujú ani nerušia. Rany Výtržníka platia vždy ×1,
          nezdvojí ich ani Silná nezávislá žena. Každý platí za svoje NA EX (pečeň, poldeci). Po bitke Výtržník vytriezvie a karta má znova pôvodné akcie.
        </p>
        <H3 id="naex-odpoved">Odpoveď na NA EX</H3>
        <p>
          Po odkrytí smieš za <strong>každé súperovo NA EX vyložiť jednu kartu</strong> z ruky na ktorýkoľvek koniec
          línie — <strong>lícom dole, zadarmo</strong>; <P k="odpoved">odpoveď</P> limit vykladania nemíňa. Najprv odpovedá{" "}
          <strong>útočník</strong>, potom <strong>obranca</strong> — len na druhý kraj línie (keď útočník neodpovedal, na
          ktorýkoľvek). Súperovu odpoveď nevidíš, kým sa obe <strong>neotočia naraz</strong>; až potom sa vyhodnotí ich Nástup
          a Pitka. Najlepšie tak, aby si spároval neaktívne akcie karty s NA EX: tie sa stanú aktívnymi a NA EX ich zruší.
          Odpoveď smie zmeniť prevahu v kraji aj počet Pitiek.
        </p>
        <H3 id="pitka-cigarety">Fajčenie, doliatie a barter</H3>
        <ul>
          <li>
            <P k="fajcenie">Fajčenie</P> — karta z balíčka hneď; len v Pitke, kým ju neskončíš, v Zhromaždení nie. Prvé fajčenie
            v Pitke stojí 1 cigaretu, druhé 2, tretie 3… a každá Pitka začína znova od 1. Na Benzínke je prvé fajčenie v každej Pitke zadarmo.
          </li>
          <li>
            <P k="doliatie">Doliatie</P> — v Pitke za 2 cigarety otočíš vypitý poldeci späť na plný (nie s Vínkom v Dedičstve).
          </li>
          <li>
            <P k="barter">Stokársky barter</P> — v Pitke za 5 cigariet nový plný poldeci.
          </li>
        </ul>
        <p className="tlmene">
          Na začiatku každého kola sa ti jeden vypitý poldeci doleje sám. Čo ti po finále ostane, sa vykúpi: plný poldeci
          1 špak, každých 5 cigariet 1 špak.
        </p>
        <H3 id="schopnost-vazna">Schopnosť väzňa</H3>
        <p>
          Kto má <P k="vazen">väzňa</P>, smie jeho <strong>schopnosť</strong> použiť <strong>raz za hru, kedy chce</strong> — vo
          svojom ťahu pri braní zo šenku, v Zhromaždení alebo v Pitke (aj vo finále). Nič nestojí. Potom je minutá a väzeň ostáva
          v pivnici (ráta sa ďalej ako vydesený). Karta staršieho v ruke či v línii schopnosť nemá. Schopnosť, ktorá by nič
          neurobila, hra neponúkne.
        </p>
        <ul>
          <li><strong>Poštárka</strong> — Dostaneš 4 cigarety.</li>
          <li><strong>Krčmárka</strong> — Nový plný poldeci.</li>
          <li><strong>Farár</strong> — Odstráň jedno súperovo NA EX z karty. Jeho poldeci ostáva vypitý.</li>
          <li><strong>Starosta</strong> — Do konca kola sú všetky aktívne akcie lokality posilnené (obom, aj akcie Pitky).</li>
          <li><strong>Veterinár</strong> — Odhoď všetky priznané Cirhózy a Cirhózy na ruke.</li>
          <li><strong>Vychovávateľka</strong> — Súper v tomto Zhromaždení hneď pasuje a za pas nedostane cigarety.</li>
          <li><strong>Autobusár</strong> — Zo šenku berieš kariet, koľko chceš, každú za jednu cigaretu; keď skončíš, môže pokračovať súper.</li>
          <li><strong>Hrobár</strong> — Vezmi si do ruky 1 kartu zo súperovho odhadzovacieho balíčka.</li>
        </ul>
      </>
    ),
  },
  {
    id: "cena-pitia",
    cast: "B",
    nazov: "Cena pitia",
    obrazok: "08-cena-pitia",
    vSkratke: [
      "Pečeň sa počíta len v Pitke a potom sa vynuluje.",
      "Za každý celý prah pečene Cirhóza, za každú akciu Hazard Dlh.",
      "Menej nerestí v kole, než je tvoja Chuť = karta Absťák do balíčka.",
    ],
    obsah: () => (
      <>
        <H3 id="cena-pecen">Pečeň a Cirhóza</H3>
        <p>
          K <P k="pecen">pečeni</P> prispieva každá akcia <strong>Poškodenie pečene</strong>, každá akcia <strong>Poldeci</strong>{" "}
          a každé NA EX. Vyhodnotí sa <strong>len v Pitke</strong>: za každý celý prah (3; Nealko v Dedičstve a Krčma ho zvyšujú) dostaneš
          kartu <P k="cirhoza">Cirhóza</P> — ide do tvojho odhadzovacieho balíčka. Po Pitke sa pečeň vynuluje, zvyšok pod prahom
          sa neprenáša. Poldeci vypitý v Zhromaždení (ďalšia karta v ťahu) pripíše +1 pečene do najbližšej Pitky. Milujúca
          manželka v línii ti zníži pečeň v Pitke o 1.
        </p>
        <H3 id="cena-dlh">Hazard a Dlh</H3>
        <p>
          Každá akcia <strong>Hazard</strong> ti v Pitke dá jeden{" "}
          <P k="dlh">Dlh</P> — nie je to karta, ale počítadlo: je hneď priznaný, neťaháš ho a kartu zaň nedoberáš. Rovnako
          je Dlh aj 1 <P k="zadlzenie">zadĺženie</P> z efektu karty. Dlhy, ktoré dáva
          priamo karta (napríklad Dievčina na vydaj), idú rovno. Viac Pitiek v bitke teda znamená viac pečene aj Dlhov. Doska ti vopred
          ukazuje, čo karty na stole pripíšu a koľko kliatob z toho bude.
        </p>
        <p>
          Len s <strong>Výherným automatom</strong> v Dedičstve dostaneš Dlh až za každé 2 zadĺženia. Zvyšok sa po Pitke nemaže — krčmár
          píše čiarky a ostávajú ti na účte do ďalšej Pitky aj kola.
        </p>
        <H3 id="cena-abstak">Neresti, Chuť a Absťák</H3>
        <p>
          <P k="nerest">Nerest</P> je len to, čo vypiješ a vyfajčíš: <strong>Vypiť</strong> v Zhromaždení 1, každé <strong>NA EX 2</strong>{" "}
          (je to väčšia dávka) a každá vyfajčená cigareta 1 (druhé fajčenie v Pitke za 2 cigarety teda 2; fajčenie zadarmo nič).
          Doliatie, barter, šenok, Záverečná, Dedičstvo nerest nie sú.
        </p>
        <p>
          <P k="chut">Chuť</P> je tvoje verejné číslo, na začiatku 0 — kto si zvykne, musí pokračovať. Na konci kola:
        </p>
        <ul>
          <li>
            <strong>Menej nerestí, než je tvoja Chuť</strong> → dostaneš kartu <P k="abstak">Absťák</P> do odhadzovacieho balíčka.
          </li>
          <li>
            Potom <strong>Chuť = väčšie z (Chuť, neresti kola) − 1</strong>. Flám ju zdvihne, každé ďalšie kolo klesne o 1.
          </li>
        </ul>
        <p>
          Súper ti latku neurčuje. Absťák sa <strong>nedá priznať</strong> ani vyložiť; po bitke sa z ruky vráti do odhadzovacieho
          balíčka a ťaháš ho znova. Každý Absťák v tvojom balíčku (ruka, doberací, odhadzovací) ti v bitke uberie{" "}
          <strong>1 tuhé</strong> — trasú sa ti ruky — a pri remíze v tuhom prehráva, kto ich má viac. Spáliť ho smie len Vízia.
          Po finále sa nerieši nič a na konci hry Absťák nestojí nič. Hra si pamätá, koľko Absťákov si <strong>získal za hru</strong>{" "}
          (štatistika).
        </p>
      </>
    ),
  },
  {
    id: "bitka",
    cast: "B",
    nazov: "Bitka",
    obrazok: "09-bitka",
    vSkratke: [
      "Tuhé: Rana 1, Pecka 2, Petelica 3. Viera ho znižuje.",
      "Hádka: Pohoršenie dá 2 mäkké, Povera 1 (Viera ju zruší). Kto má viac mäkkého, vyhral hádku a po bitke ju rozdelí na svoje reči.",
      "Viac tuhého vyhráva: víťaz dostane 1 špak za každú kartu v línii, lokalita ide na nástenku.",
      "Remízu rozhodne menej Absťákov, potom menej Dlhov, inak sekera.",
      "Nakladačka je rozdiel tuhého: víťaz ju rozdelí na svoj strach.",
      "Po bitke dostane porazený 1 cigaretu a súper ti zaplatí výpalné za tvoj červený strach; po finále nie.",
    ],
    obsah: () => (
      <>
        <H3 id="bitka-poskodenie">Hádka a tuhé poškodenie</H3>
        <p>
          <P k="tuhe">Tuhé</P> poškodenie (Rana 1, Pecka 2, Petelica 3) rozhoduje o víťazovi bitky. Každá tvoja priznaná Cirhóza dá súperovi +1 tuhé.{" "}
          <P k="pohorsenie">Pohoršenie</P> a <P k="povera">Povera</P> sú <P k="makke">mäkké</P> poškodenie — tuhé nerobia, hrá sa o ne{" "}
          <P k="hadka">hádka</P>.
        </p>
        <ol>
          <li>
            <P k="viera">Viera</P> a Povery sa vyrušia 1 : 1 na kusy — jedna tvoja Viera zruší jednu súperovu Poveru, aj vylepšenú
            Horoskopom, a naopak. Rovnako to platí aj pre Vieru z Veriaceho a Povery z Ohováračky. Proti Pohoršeniu Viera nepomáha.
          </li>
          <li>
            <strong>Mäkké</strong> = Pohoršenie × 2 + zvyšné Povery × 1 (s Horoskopom × 2). Kto ho má viac, <strong>vyhral hádku</strong> o
            rozdiel; pri rovnosti nikto.
          </li>
          <li>
            Víťaz hádky ju po bitke rozdelí na svoje <P k="reci">reči</P> na teplomeroch súpera — ľubovoľne medzi starších; stupeň stojí do žltej 1, do oranžovej 2,
            do červenej 3 a obsadzuje sa od vrchu súperovho strachu nadol, potom nad neho. Čo nestačí na žiadny stupeň, prepadne. <strong>Priazne sa hádkou nemenia.</strong>{" "}
            Vo finále sa nerozdeľuje — víťaz hádky dostane 1 špak za každý bod.
          </li>
          <li>
            Zvyšná Viera zníži súperovo tuhé poškodenie, pod 0 neklesne. Veriaci (priazeň) ti pridá Vieru navyše — ruší Povery aj tlmí
            tuhé. Hodnotu jednej Viery v tlmení tuhého mení len Svätý text.
          </li>
          <li>Každý Absťák ti zníži tuhé o 1 — Abstinent ti ich v bitke toľko odpustí, aká je jeho sila.</li>
        </ol>
        <UkazkaBitky />
        <H3 id="bitka-vysledok">Výsledok a sekera</H3>
        <p>
          Vyhráva vyššie <strong>tuhé</strong>. Pri rovnakom tuhom vyhrá, kto má <strong>menej Absťákov</strong>, a keď aj tých
          máte rovnako, kto má <strong>menej priznaných Dlhov</strong>. Ak nerozhodnú ani Dlhy, bitku nevyhrá nikto: špaky kola
          čakajú <P k="sekera">na sekere</P> a vezme si ich navyše víťaz najbližšej bitky; vo finále prepadnú. Útočník pri
          sekere ostáva útočníkom, starší bodujú obom len za reči a cigaretu za prehru nedostane nikto.
        </p>
        <p className="zvyraznene">
          Víťaz dostane 1 <P k="spak">špak</P> za každú kartu, ktorá pri bitke leží v línii — v celej línii, aj odkrytá
          Záverečná, aj vo finále; priznané karty, Dedičstvo a karty, ktoré z línie počas kola zmizli, sa nerátajú.
          Absťáky špaky nezrážajú. Lokalitu si neberie — ide na krčmovú{" "}
          <P k="nastenka">nástenku</P> s jeho menom a špakmi. <strong>Nakladačka</strong> je rozdiel tuhého poškodenia — drží ju
          víťaz a rozdelí ju na svoj strach; pri remíze v tuhom Nakladačka nie je, aj keď bitku rozhodnú Absťáky či Dlhy.
        </p>
        <H3 id="bitka-kroky">Kroky bitky v poradí</H3>
        <ol className="kroky">
          <li>
            <strong>Hádka</strong> — Viera ruší Povery, kto má viac mäkkého (Pohoršenie 2, Povera 1), vyhral hádku o rozdiel. Priazne sa nemenia, rozdelí sa až neskôr.
            Noviny v Dedičstve víťaza: porazený v hádke odhodí náhodnú kartu z ruky.
          </li>
          <li>
            <strong>Poškodenie</strong> — k tuhému z línie sa pripočítajú akcie navyše z efektov Bitka (Šofér, Pijan…); tuhé znižuje
            zvyšná Viera a každý Absťák v tvojom balíčku (Abstinent ich odpustí).
          </li>
          <li>
            <strong>Výsledok</strong> — víťaz (pri remíze rozhodnú Absťáky, potom Dlhy), inak sekera.
          </li>
          <li>
            <strong>Špaky za bitku</strong> — víťaz dostane špak za každú kartu v línii (na Kultúrnom dome každý hráč len za svoje, aj víťaz); kto vyhral hádku a prehral bitku, dostane špak za každú svoju kartu; vo finále aj špak za každý bod Nakladačky a víťaz hádky za každý bod hádky; lokalita ide na nástenku.
          </li>
          <li>
            <strong>Starší bodujú</strong> podľa stavu pred zdvihnutím — stupne majú hodnotu 1 / 2 / 2 a dostane ich ten, kto ich drží: obaja za svoje reči, víťaz navyše za svoj strach bez stupňov, ktoré obsadil súper.
            Kto prehral hádku, tomu reči klesnú zospodu o stupeň.
          </li>
          <li>
            <strong>Výhra strachom</strong> — víťaz s červeným strachom aspoň u 4 starších (väzni sa rátajú) vyhráva hneď.
          </li>
          <li>
            <strong>Exekútor</strong> — najprv Robota, potom exekúcia každému s priznaným
            Dlhom: zhorí polovica Dlhov nahor a rovnako veľa špakov; Záhradkár v partii ju obíde (kapitola{" "}
            <a href="#kliatby">Kliatby a priznanie</a>).
          </li>
          <li>
            <strong>Nakladačka a hádka</strong> — víťaz bitky rozdelí Nakladačku na svoj strach a smie <a href="#patronat">zajímať</a>, potom víťaz hádky rozdelí hádku na svoje reči a smie{" "}
            <a href="#patronat">presviedčať</a>. Väzni na výhru podľa ligy končia hru hneď. Vo finále sa nerozdeľuje — body už boli špaky.
          </li>
          <li>
            <strong>Poldeci</strong> — poldeci z NA EX sa vypijú; aktívna akcia
            Poldeci otočí vypitý späť na plný.
          </li>
          <li>
            <strong>Cigarety po bitke</strong> — porazený dostane 1 cigaretu (pri sekere a po finále nikto), Kmotor (kto má jeho priazeň, tomu prejdú 2 / 3 / 4 priznané Dlhy k súperovi), Fajčiar
            (cigarety po bitke) a <P k="vypalne">výpalné</P> (po finále nie), potom Krokodíl.
          </li>
          <li>
            <strong>Návrat kariet</strong> do odhadzovacieho balíčka hráča, ktorý ich zahral; podložený Nástroj tomu, kto ho podložil.
          </li>
          <li>
            <strong>Cintorín</strong> — porazený v bitke o Cintorín si smie vziať do ruky 1 kartu zo svojho odhadzovacieho balíčka, už aj
            z práve odohranej línie.
          </li>
          <li>
            <strong>Kliatby z ruky</strong> — nepriznaná Cirhóza a Absťák idú do odhadzovacieho balíčka.
          </li>
          <li>
            <strong>Chuť a Absťák</strong> — menej nerestí, než je tvoja Chuť, = karta Absťák; potom Chuť klesne o 1 od väčšieho z Chuti a nerestí (po finále už nie).
          </li>
          <li>
            <strong>Nové kolo</strong> — každému sa doleje jeden vypitý poldeci a každý si dobere do 3 kariet v ruke. Kto ich má viac, nedoberá nič a nič neodhadzuje; kliatby v ruke sa rátajú.
          </li>
        </ol>
      </>
    ),
  },
  {
    id: "starsi",
    cast: "B",
    nazov: "Starší a Nakladačka",
    obrazok: "10-starsi-a-prebytok",
    vSkratke: [
      "Každý hráč má pri staršom svoj teplomer 0–3: plná časť je jeho strach, šrafa sú súperove reči.",
      "Priazeň má ten, koho sa starší bojí menej; sila je rozdiel strachov, reči sa nerátajú.",
      "Stupne majú hodnotu 1 / 2 / 2: víťaz bitky dostane strach bez obsadených stupňov, obaja vždy to, čo obsadili rečami.",
      "Strach dvíha víťaz bitky Nakladačkou, reči víťaz hádky. Stupeň stojí 1 / 2 / 3, strach na obsadený o 1 viac.",
      "Za každý tvoj červený strach ti súper po bitke dá cigaretu (výpalné). Staršieho na červenej smieš zajať.",
    ],
    obsah: () => (
      <>
        <H3 id="starsi-stupnica">Strach a reči</H3>
        <p>
          Každý <P k="starsi">starší</P> dostane na začiatku hry náhodne svoju priazeň a vidíš ju pri ňom. Každý hráč má pri každom staršom
          vlastný teplomer so stupňami <strong>0–3</strong>: sivá, žltá, oranžová, červená. Plná časť je <P k="strach">strach</P>, šrafa vo farbe súpera sú jeho{" "}
          <P k="reci">reči</P>. Výška strachu hovorí, aký je starší pre teba: <strong>pokojný</strong> (0), <strong>znepokojený</strong> (1),{" "}
          <strong>vystrašený</strong> (2) alebo <strong>vydesený</strong> (3).
        </p>
        <ul>
          <li>
            <strong>Strach</strong> dvíha víťaz bitky Nakladačkou a neklesá. Do priazne, výhry strachom, zajatia a výpalného sa ráta celý, aj keď naň súper dal reči.
          </li>
          <li>
            <strong>Reči</strong> dvíha víťaz hádky a ležia na teplomere súpera: obsadzuješ od vrchu jeho strachu nadol, potom nad neho, zo sivej zdola nahor.
            Keď súper dvíha strach na obsadený stupeň, platí o 1 viac; keď reči prekoná, posunú sa s ním a spodný stupeň zanikne. Kto prehral hádku, tomu reči po bodovaní klesnú zospodu.
          </li>
        </ul>
        <p className="zvyraznene">
          <P k="priazen">Priazeň</P> má ten, koho sa starší bojí menej: <strong>sila = strach súpera − tvoj strach</strong>. Pri rovnakom strachu ju nemá
          nikto. Keď si dvíhaš strach, zarábaš špaky, ale súperovi dávaš priazeň. <strong>Po bitke</strong> má každý stupeň hodnotu žltá 1, oranžová 2, červená 2 a dostane ho ten, kto ho drží: víťaz bitky za svoj strach bez obsadených stupňov,
          obaja pri každej bitke za stupne, ktoré obsadili rečami. Boduje sa podľa stavu pred zdvihnutím, nový strach boduje až v ďalšej bitke.
        </p>
        <UkazkaStupnice />
        <H3 id="starsi-prebytok">Nakladačka a hádka</H3>
        <p>
          <P k="prebytok">Nakladačka</P> je rozdiel v tuhom poškodení. Krok za krokom:
        </p>
        <ol>
          <li>
            <strong>Drží ju a rozdeľuje víťaz</strong> (vyššie tuhé). Pri remíze v tuhom Nakladačka nie je.
          </li>
          <li>
            Dvíha <strong>svoj strach</strong>, ľubovoľne medzi starších. Stupeň stojí do žltej 1, do oranžovej 2, do červenej 3 — zo sivej na červenú spolu 6.
          </li>
          <li>
            Rozdelí sa, čo sa dá: nesmie ostať zvyšok, ktorý by ešte stačil na ďalší stupeň. <strong>Čo už nikam nestačí, prepadne</strong> a neprenáša sa.
          </li>
          <li>
            Príde to až <strong>po bodovaní starších, výhre strachom a exekúcii</strong>. Za 5 bodov smie víťaz <a href="#patronat">zajať</a> staršieho, pri ktorom má strach na červenej už pred touto Nakladačkou.
          </li>
        </ol>
        <p>
          <strong>Vo finále sa Nakladačka nerozdeľuje — víťaz finále za ňu dostane 1 špak za každý bod.</strong>
        </p>
        <p>
          <P k="hadka">Hádka</P> (kapitola <a href="#bitka">Bitka</a>) ide rovnako, len na <strong>svoje reči na teplomere súpera</strong> a za rovnakú cenu; víťaz hádky s rečami na celom teplomere smie za 3 body{" "}
          <a href="#patronat">presvedčiť</a> staršieho. Priazne hádka nemení.
        </p>
        <H3 id="starsi-vypalne">Výpalné</H3>
        <p>
          Hneď po bitke ti súper dá <strong>1 cigaretu za každého staršieho s tvojím červeným strachom</strong> — aj keď si bitku prehral a aj pri sekere.{" "}
          <P k="vazen">Väzeň</P> sa ráta ako červená, reči nie. Ráta sa strach po Nakladačke tejto bitky a súper dá, koľko má; čo nemá, nedlhuje. Platíte obaja naraz, takže
          prijaté výpalné v tom istom kroku neodovzdáš ďalej. Cigarety máš tak pripravené na šenok. Obmedzenie výpalné neuberá, nie je to nerest a po finále sa neplatí.
        </p>
        <H3 id="starsi-priazne">Priazne</H3>
        <p>
          Sila priazne je <strong>rozdiel strachov</strong> — 1, 2 alebo 3. Akú priazeň starší dáva, sa mu rozdá
          náhodne na začiatku hry; väzeň priazeň nedáva.
        </p>
        <table className="tabulka">
          <thead>
            <tr>
              <th>Priazeň</th>
              <th>Uplatňuje sa pri</th>
              <th>Sila 1 / 2 / 3</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Bitkár</td><td>Tuhé poškodenie v bitke</td><td>+1 / +2 / +3</td></tr>
            <tr><td>Veriaci</td><td>Viera navyše v bitke</td><td>+1 / +2 / +3</td></tr>
            <tr><td>Abstinent</td><td>V bitke sa ti neráta toľko Absťákov (tuhé za ne neklesne, nerátajú sa ani pri remíze)</td><td>1 / 2 / 3</td></tr>
            <tr><td>Advokát</td><td>Exekúcia ti vezme o toľko špakov menej (Dlhy zhoria ako vždy)</td><td>−1 / −2 / −3</td></tr>
            <tr><td>Robota</td><td>Akcie Robota navyše — spália priznaný Dlh, inak dajú špak</td><td>1 / 2 / 3</td></tr>
            <tr><td>Fajčiar</td><td>Cigarety po bitke (Obmedzenie ich neuberá)</td><td>+1 / +2 / +3</td></tr>
            <tr><td>Kmotor</td><td>Po bitke prejdú tvoje priznané Dlhy medzi súperove (bez Dlhu nič)</td><td>2 / 3 / 4</td></tr>
            <tr><td>Ohováračka</td><td>Povery navyše v hádke; ruší ich súperova Viera ako Povery z kariet</td><td>+1 / +2 / +3</td></tr>
          </tbody>
        </table>
        <H3 id="starsi-vydesenie">Zajatie a výhra strachom</H3>
        <ul>
          <li>
            Starší s tvojím červeným strachom sa dá po vyhratej bitke Nakladačkou <a href="#patronat">zajať</a>. Dosť{" "}
            <P k="vazen">väzňov</P> podľa ligy vyhráva hru. Karta staršieho je <strong>boss</strong>: 6 akcií a jedna neresť; v línii má len
            akcie, jeho <a href="#schopnost-vazna">schopnosť</a> má len ten, kto ho drží ako väzňa. Do balíčka hráča sa dostane{" "}
            <a href="#patronat">presvedčením</a>.
          </li>
          <li>
            <strong>Výhra strachom:</strong> kto vyhrá bitku a po bodovaní má červený strach aspoň u 4 starších (väzni sa rátajú), vyhráva hneď. Porazený so štyrmi červenými nevyhráva.
          </li>
        </ul>
        <p className="tlmene">
          V hre to vidíš pri každom staršom: dva teplomery (tvoj a súperov), plná časť je strach a šrafa v súperovej farbe jeho reči; krúžok ukazuje, komu patrí priazeň a akú má silu.
          Nápoveda nad staršom ukáže aj špaky po bitke a riziko zajatia.
        </p>
      </>
    ),
  },

  // ---------------------------------------------------------------- C
  {
    id: "kliatby",
    cast: "C",
    nazov: "Kliatby a priznanie",
    obrazok: "11-kliatby",
    vSkratke: [
      "Kliatby: Dlh, Cirhóza, Absťák. Dlh je počítadlo, nie karta — je hneď priznaný. Absťák sa priznať nedá.",
      "Priznanie vyloží kliatbu natrvalo mimo línie; limit nemíňa.",
      "Priznať sa dá len Cirhóza — kartu za ňu nedobereš.",
      "Za priznané Dlhy príde v každej bitke Exekútor: zhorí polovica Dlhov nahor a rovnako veľa špakov.",
      "Nepriznaná Cirhóza ťa na konci hry stojí 3 špaky.",
    ],
    obsah: () => (
      <>
        <H3 id="kliatby-priznanie">Priznanie</H3>
        <p>
          <P k="kliatba">Kliatbu</P> môžeš namiesto do línie vyložiť do svojej hracej oblasti — je{" "}
          <P k="priznanie">priznaná</P> a natrvalo mimo balíčka. Priznanie nemíňa limit vykladania ani neodovzdá ťah. Kliatba
          do línie nepatrí.
        </p>
        <ul>
          <li>
            <strong>Dlh</strong> — nie je karta, ale počítadlo priznaných Dlhov: nový Dlh (akcia Hazard, efekt karty) je hneď
            priznaný a kartu zaň <strong>nedobereš</strong>; neťahá sa a nedá sa s ním inak manipulovať. Za priznané Dlhy
            príde v každej bitke Exekútor a pri remíze v bitke prehrá, kto ich má viac.
          </li>
          <li>
            <strong>Cirhóza</strong> — ide do odhadzovacieho balíčka; do ruky príde, až keď sa doberací balíček minie
            a odhadzovací sa zamieša. Priznáš ju, keď chceš, ale kartu za ňu{" "}
            <strong>nedobereš</strong>. Priznaná dá súperovi v každej bitke +1 tuhé. <strong>Nepriznaná ide po bitke do tvojho odhadzovacieho
            balíčka; na konci hry ti zoberie 3 špaky</strong> (ráta sa ruka aj oba balíčky). Buď ju prizníš hneď, alebo
            riskuješ, že sa ti do konca hry nevráti do ruky.
          </li>
          <li>
            <strong>Absťák</strong> — karta, ktorá sa <strong>nedá priznať</strong> ani vyložiť (kapitola Cena pitia). Po bitke sa
            z ruky vráti do odhadzovacieho balíčka; každý v tvojom balíčku ti v bitke uberie 1 tuhé a remízu prehrá, kto ich má viac.
            Spáliť ho smie len Vízia.
          </li>
          <li>
            <strong>Milujúca manželka</strong> už kliatba nie je — je to Občan, ktorý sa kladie do línie (a tam ti zníži pečeň
            v Pitke o 1).
          </li>
        </ul>
        <H3 id="kliatby-exekutor">Exekútor a Robota</H3>
        <ol>
          <li>
            <strong>Robota:</strong> po poškodení, tesne pred exekúciou, spáliš za každú aktívnu Robotu 1 priznaný Dlh; za Dlh, ktorý nemá čo spáliť, dostaneš 1 špak. Ide sa po
            hráčoch: obranca Robota a Exekútor, potom útočník.
          </li>
          <li>
            Potom príde <P k="exekutor">Exekútor</P> — <strong>v každej bitke</strong> po poškodení a špakoch za bitku (remíza a Herňa tvoje Dlhy ešte spočítajú), kým máš aspoň jeden priznaný Dlh: zhorí ti{" "}
            <strong>polovica priznaných Dlhov</strong> (zaokrúhlené nahor, aj jediný Dlh) a <strong>rovnako veľa špakov</strong>.
            S priazňou Advokáta ti zhorí o 1 / 2 / 3 špaky menej (Dlhy zhoria ako vždy). Súper ich nedostane a smieš ísť do mínusu.
          </li>
          <li>
            <strong>Záhradkár</strong> v línii v tvojej partii: exekúcia ťa v tom kole obíde — nezhorí nič. Zvyšné Dlhy na konci hry
            nestoja nič.
          </li>
        </ol>
      </>
    ),
  },
  {
    id: "nastroje",
    cast: "C",
    nazov: "Nástroje a Dedičstvo",
    obrazok: "12-nastroje",
    vSkratke: [
      "Nástroj sa do línie nevykladá — podložíš ho pod Občana alebo Starešinu v línii za 1 cigaretu.",
      "Má hornú a dolnú hranu; platí tá, ktorá spod karty pretŕča.",
      "Hrana preškolí akciu karty (X → Y), alebo jej dá Forsáž, NA EX, Výtržníka či Vzburu.",
      "Po bitke sa Nástroj vráti do odhadzovacieho balíčka toho, kto ho podložil.",
      "Dedičstvo: efekt Nástroja platí len tam; cena 1, 2, 3… cigarety pre oboch spolu.",
    ],
    obsah: () => (
      <>
        <H3 id="nastroje-hrany">Dve hrany</H3>
        <p>
          <P k="nastroj">Nástroj</P> nemá akcie po bokoch ako ostatné karty. Má <strong>hornú a dolnú hranu</strong>, obe vo farbe
          karty, a v strede ilustráciu a text Dedičstva. Každá hrana robí jedno z dvoch:
        </p>
        <ul>
          <li>
            <strong>Preškolenie X → Y</strong> — všetky akcie X na karte, pod ktorou Nástroj leží, sa rátajú ako Y (Rana → Pecka:
            dve Rany sú dve Pecky). Platí ešte pred spojmi, takže susedia sa párujú už s preškolenou akciou. Keď karta akciu X nemá,
            Nástroj pod ňou nerobí nič.
          </li>
          <li>
            <strong>Účinok na celú kartu</strong> — <strong>Energeťák</strong> jej dá <P k="forsaz">Forsáž</P> (všetky aktívne akcie
            ×2), <strong>Vínko</strong> <P k="naex">NA EX</P> (bez poldeca — nikto nepije, pečeň ani nerest nie sú),{" "}
            <strong>Injekcia</strong> z nej urobí <P k="vytrznik">Výtržníka</P> a <strong>Vidly</strong> ju obrátia{" "}
            <P k="vzbura">Vzburou</P>. Na druhej hrane majú tieto štyri preškolenie.
          </li>
        </ul>
        <p>Hrany sú posila aj sabotáž — Nástroj smieš podložiť pod svoju aj pod súperovu kartu.</p>
        <H3 id="nastroje-podlozenie">Podloženie</H3>
        <p className="zvyraznene">
          V Zhromaždení <P k="podlozenie">podložíš</P> Nástroj z ruky pod kartu s tagom <strong>Občan alebo Starešina</strong>{" "}
          v línii — svoju alebo súperovu — za <strong>1 cigaretu</strong>. Natočíš ho tak, aby spod karty pretŕčala hrana, ktorú
          chceš; <strong>platí len táto hrana</strong>, druhá je skrytá a natočenie sa už nemení. V striedaní je to ťah, limit
          vykladania nemíňa.
        </p>
        <ul>
          <li>
            Pod jednou kartou leží najviac jeden Nástroj (pod Zámočníka ich smie byť viac). Pod Zviera len vtedy, keď v línii leží
            Kôň. Pod kartu lícom dole nie.
          </li>
          <li>
            Vínko nepodložíš pod kartu, na ktorej leží poldeci, so Vzburou ani pod Výtržníka.
          </li>
          <li>
            Podložený Nástroj <strong>leží do bitky</strong> a vyhodiť sa nedá. <strong>Po bitke sa vráti do odhadzovacieho balíčka
            toho, kto ho podložil</strong> — nie majiteľa karty. Keď karta odíde z línie skôr, Nástroj ide tam hneď.
          </li>
          <li>
            Podloženie nie je priloženie: Konflikt ani Podporu nespustí. Podložený Nástroj sa neráta do prevahy v kraji ani do
            špakov za karty v línii.
          </li>
          <li>Podložený Nástroj a jeho hrana sú verejné.</li>
        </ul>
        <H3 id="nastroje-dedicstvo">Dedičstvo</H3>
        <p>
          Namiesto podloženia môžeš Nástroj vyložiť do hracej oblasti ako <P k="dedicstvo">Dedičstvo</P>. Kým tam leží, platí jeho
          efekt (napríklad Nealko: prah Cirhózy o 2 vyšší). <strong>Cena rastie pre oboch hráčov spolu:</strong> prvý Nástroj
          v Dedičstve stojí 1 cigaretu, druhý 2, tretí 3 — kto je rýchlejší, platí menej. Vyloženie do Dedičstva limit nemíňa,
          ale v striedaní je to ťah. Z Dedičstva sa Nástroj nepodkladá.
        </p>
      </>
    ),
  },
  {
    id: "pokrocile",
    cast: "C",
    nazov: "Pokročilé ťahy",
    obrazok: "13-pokrocile-tahy",
    vSkratke: [
      "Vypiť: každá ďalšia karta v ťahu stojí plný poldeci.",
      "Záverečná: karta lícom dole za 1 cigaretu, otočí sa na konci Pitky.",
      "Podstrčenie: svoju kartu priložíš k súperovej; ostáva tvoja.",
      "Posilnenie zdvojí, Odpor zruší, Odpor proti Odporu = Vzbura, Posilnenie proti Posilneniu = Forsáž.",
    ],
    obsah: () => (
      <>
        <H3 id="pokrocile-vypit">Vypiť a viac kariet naraz</H3>
        <p>
          V Zhromaždení smieš na svojom ťahu vyložiť aj viac kariet. Prvá je zadarmo, <strong>každá ďalšia ťa stojí plný
          poldeci</strong> — <P k="vypit">vypiješ</P> ho: limit hneď klesne o 1, pečeň +1 (vyhodnotí sa v najbližšej Pitke) a ráta
          sa to ako nerest. Dve karty za sebou teda potrebujú limit aspoň 3. Súper medzitým nereaguje. Poradie je{" "}
          <strong>Vypiť, karta, karta</strong> — bez vypitia prvá karta ťah ukončí. V Kostole vypiť nesmie nikto.
        </p>
        <p className="zvyraznene">
          V hre kartu potiahneš na stôl — je to len návrh. Ďalšia karta v tom istom ťahu dostane štítok <strong>−1 poldeci</strong>{" "}
          a pokyn ukáže, koľko ťa ťah stojí. Kartu v návrhu vymeníš tak, že na ňu položíš inú, alebo ju vrátiš do ruky. Celý ťah
          sa vykoná až po <strong>„potvrdiť“</strong> — celý, alebo vôbec.
        </p>
        <H3 id="pokrocile-zaverecna">Záverečná</H3>
        <p>
          V Zhromaždení smieš za 1 cigaretu zahrať kartu <strong>lícom dole</strong> ako <P k="zaverecna">Záverečnú</P> — na
          ktorýkoľvek koniec línie. Míňa limit a potom už v tom Zhromaždení nevykladáš (pas za ňu cigarety nedá).
          Súper ju nevidí, nesmie za ňu priložiť kartu (ani odpoveďou na NA EX) a NA EX na ňu smie dať len on — vtedy prejde
          vždy. Otočí sa na <strong>konci Pitky</strong>; až vtedy platí jej Nástup a efekty.
        </p>
        <H3 id="pokrocile-podstrcenie">Podstrčenie (sabotér)</H3>
        <p>
          Kartu priloženú k súperovej <P k="podstrcenie">podstrčíš</P>: ostáva tvoja, jej akcie aj efekty sa rátajú
          tebe a so súperovými susedmi sa páruje normálne — aktivuje im akcie na spoji, ktoré dostane súper. Pošli mu sabotéra:
          tvoj Odpor mu zruší akciu, ktorú potreboval, a zaberieš koniec línie, kde stavia.
        </p>
        <H3 id="pokrocile-modifikatory">Posilnenie, Odpor, Vzbura a Forsáž</H3>
        <ul>
          <li>
            <strong>Posilnenie</strong> zdvojnásobí akúkoľvek prepojenú akciu — priaznivú aj nepriaznivú.
          </li>
          <li>
            <strong>Odpor</strong> zruší prepojenú akciu.
          </li>
          <li>
            <strong>Odpor proti Odporu = <P k="vzbura">Vzbura</P>:</strong> obe karty sa obrátia — aktívne sú ich nespojené
            akcie, spojené sú neaktívne. Ich Odpor či Posilnenie na druhom spoji pôsobí ďalej.
          </li>
          <li>
            <strong>Posilnenie proti Posilneniu = <P k="forsaz">Forsáž</P>:</strong> obe karty majú všetky svoje aktívne akcie
            posilnené (×2) — aj tie, ktoré sú aktívne po Vzbure, aj zlé ako Hazard. Akcia, ktorú navyše posilní Posilnenie suseda
            z druhého spoja, má ×4.
          </li>
          <li>
            Ak sa Odpor stretne s Posilnením, vznikne Vzbura len pre kartu s Odporom: obráti sa a všetky jej aktívne akcie
            sú posilnené (×2). Posilnenie je zrušené.
          </li>
          <li>Na kartu so Vzburou sa nedá dať NA EX.</li>
          <li>
            Pri lokalite platí Vzbura aj Forsáž len pre jej hranu v tom kraji. Vzburu dajú karte aj Vidly a Forsáž Energeťák
            podložené pod ňu (<a href="#nastroje">Nástroje</a>).
          </li>
          <li>
            NA EX na kartu s Posilnením zruší jej Posilnenie: partnerovi už nič nezdvojí a Forsáž zanikne obom kartám.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "lokality",
    cast: "C",
    nazov: "Lokality",
    obrazok: "14-lokality",
    vSkratke: [
      "Efekt lokality platí len v kole, keď sa o ňu bije.",
      "Po bitke ide lokalita na krčmovú nástenku — nikto ju neovláda.",
      "V sade je 19 lokalít po úrovniach 1, 2, 3 a pinnacle (len finále).",
    ],
    obsah: () => (
      <table className="tabulka">
        <thead>
          <tr>
            <th>Lokalita</th>
            <th>Kedy</th>
            <th>Efekt</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Krčma</td><td>Pitka</td><td>Kto má plný poldeci a kam ho dať, musí dať NA EX. Prah Cirhózy je obom o 2 vyšší.</td></tr>
          <tr><td>Kostol</td><td>Zhromaždenie, Pitka</td><td>Nikto nesmie vypiť (v ťahu len jedna karta). NA EX len na kartu na konci línie (na ktoromkoľvek z dvoch koncov), najďalej od Kostola.</td></tr>
          <tr><td>Benzínka</td><td>Pitka</td><td>Prvé fajčenie každého hráča v každej Pitke je zadarmo, ďalšie stojí 2, potom 3.</td></tr>
          <tr><td>Zastávka</td><td>Pitka</td><td>Po prvej Pitke kola si každý vezme zadarmo 1 kartu zo šenku — najprv útočník, potom obranca (z prázdneho šenku nič).</td></tr>
          <tr><td>Lesná cesta</td><td>Bitka</td><td>Za každé tvoje Zviera v línii, v ktoromkoľvek kraji, 2 tuhé navyše.</td></tr>
          <tr><td>Ihrisko</td><td>Bitka</td><td>V každom kraji +2 tuhé tomu, kto tam má viac svojich Občanov, Zvierat a Starešinov (Dvojčatá za dve) — spolu až +4.</td></tr>
          <tr><td>Zberný dvor</td><td>Pitka</td><td>Na konci Pitky smie každý spáliť 1 kartu z ruky, nie kliatbu.</td></tr>
          <tr><td>Most</td><td>Zhromaždenie, Pitka</td><td>Každý vykladá len na koniec línie po svojej ľavici, aj odpoveď na NA EX.</td></tr>
          <tr><td>Kar</td><td>Pitka</td><td>Poškodenie pečene za NA EX dostane súper hráča, ktorý ho dal.</td></tr>
          <tr><td>Cintorín</td><td>Prehra</td><td>Porazený si smie vziať do ruky 1 kartu zo svojho odhadzovacieho balíčka (pri sekere nikto).</td></tr>
          <tr><td>Obecný úrad</td><td>Pitka</td><td>Cigarety a Dlhy získané v Pitke sa obom rátajú dvakrát: (akcie − Obmedzenie) × 2. Platby a cigarety za pas nie.</td></tr>
          <tr><td>Jednota</td><td>Pitka</td><td>Kto má viac priznaných Dlhov, nesmie v tejto Pitke fajčiť ani dolievať.</td></tr>
          <tr><td>Sklad</td><td>Zhromaždenie</td><td>Nástroj zo šenku smieš vyložiť rovno do Dedičstva za cenu Dedičstva; do šenku príde z Náradia nový Nástroj.</td></tr>
          <tr><td>Poľovnícka chata</td><td>Furt</td><td>Aktívne Rany, Pecky a Petelice z hrán sa rátajú dvakrát (len finále).</td></tr>
          <tr><td>Predsedova vila</td><td>Pitka</td><td>Za každé 2 cigarety, ktoré v Pitke vyfajčíš, zdvihni svoje reči pri jednom staršom o stupeň.</td></tr>
          <tr><td>Herňa</td><td>Bitka</td><td>Víťaz dostane navyše toľko špakov, koľko má porazený priznaných Dlhov (len finále).</td></tr>
          <tr><td>Kultúrny dom</td><td>Bitka</td><td>Každý hráč dostane špaky len za svoje karty v línii, aj víťaz.</td></tr>
          <tr><td>Vínna pivnica</td><td>Pitka</td><td>NA EX až dvakrát za Pitku.</td></tr>
          <tr><td>Družstvo</td><td>Zhromaždenie</td><td>Karty s akciou Robota nemíňajú limit vykladania.</td></tr>
        </tbody>
      </table>
    ),
  },
  {
    id: "bodovanie",
    cast: "C",
    nazov: "Špaky a finále",
    obrazok: "15-bodovanie",
    vSkratke: [
      "Po finále vyhrá, kto má viac špakov; rovnosť je remíza.",
      "Vyhratá bitka: 1 špak za každú kartu v línii (aspoň 1).",
      "Po každej bitke starší: stupne 1 / 2 / 2 dostane, kto ich drží — víťaz strach bez obsadených stupňov, obaja svoje reči.",
      "Finále: bitka o pinnacle lokalitu ako o každú inú; vyberá ju vedúci, útočí zaostávajúci.",
    ],
    obsah: () => (
      <>
        <p>
          <P k="spak">Špaky</P> zbieraš počas celej hry a sú verejné. Smú klesnúť aj do mínusu. Vyhrá, kto ich má po{" "}
          <P k="finale">finále</P> viac; pri rovnosti je remíza. Lokality sa neovládajú — odohrané bitky
          visia na krčmovej <P k="nastenka">nástenke</P> s menom víťaza a jeho špakmi.
        </p>
        <H3 id="spaky-zdroje">Odkiaľ sú špaky</H3>
        <table className="tabulka">
          <thead>
            <tr>
              <th>Odkiaľ</th>
              <th>Koľko</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Vyhratá bitka</td><td>1 za každú kartu v celej línii (aj finále), aspoň 1; k tomu špaky zo sekery</td></tr>
            <tr><td>Bitka o Kultúrny dom</td><td>každý hráč, aj víťaz, len 1 za každú svoju kartu v línii (víťaz aspoň 1)</td></tr>
            <tr><td>Vyhraná hádka pri prehratej bitke alebo sekere</td><td>1 za každú svoju kartu v línii; na Kultúrnom dome nie druhýkrát</td></tr>
            <tr><td>Starší po bitke</td><td>stupne žltá 1, oranžová 2, červená 2 dostane, kto ich drží: víťaz za svoj strach bez stupňov, ktoré obsadil súper, obaja pri každej bitke za svoje reči; kto prehral hádku, tomu reči klesnú zospodu o stupeň</td></tr>
            <tr><td>Finále: Nakladačka a hádka</td><td>víťaz bitky 1 za bod Nakladačky, víťaz hádky 1 za bod hádky</td></tr>
            <tr><td>Krádež pri zajatí</td><td>zlodej dostane a okradnutý stratí toľko špakov, koľko bodov hádky má okradnutý v rečiach pri zajatom staršom, najviac koľko má</td></tr>
            <tr><td>Exekútor</td><td>v každej bitke mínus polovica priznaných Dlhov nahor (s priazňou Advokáta o 1 / 2 / 3 menej)</td></tr>
            <tr><td><P k="vykupne">Výkupné</P> na konci hry</td><td>každý plný poldeci 1, každých celých 5 cigariet 1 (zvyšok prepadne); bez stropu — vypitý poldeci ani poldeci pod NA EX sa nerátajú</td></tr>
            <tr><td>Nepriznaná Cirhóza</td><td>mínus 3 za kus na konci hry (ruka aj oba balíčky)</td></tr>
          </tbody>
        </table>
        <p className="zvyraznene">
          Príklad: v bitke o Krčmu leží v línii 6 kariet (tvoje aj súperove) a vyhral si — máš 6 špakov. Pri Farárovi máš strach na
          oranžovej: +3. Pri Starostovi máš červený strach, ale súper tam má reči na červenej a oranžovej: ty +1, on +4.
          Pri Poštárke nemáš strach a tvoje reči sú na žltej a oranžovej: +3. Súper bitku prehral, jeho strach pri Autobusárovi nedá nič. Je to 13 : 4.
        </p>
        <H3 id="finale">Finále</H3>
        <ul>
          <li>
            Po poslednej bitke o lokalitu (3 / 5 / 7) je finále — posledná bitka o pinnacle lokalitu, ktorá sa hrá ako o každú
            inú: lokalita leží v strede línie, karty sa kladú k nej a platia jej hrany aj efekt.
          </li>
          <li>Pinnacle vyberie hráč s viac špakmi — obranca. Natočí ju víťaz poslednej hádky; šenok a branie platia ako v každom kole. Vo finále sa nezajíma ani nepresviedča, cigareta za prehru ani výpalné sa po ňom neplatia.</li>
          <li>
            <strong>Útočí zaostávajúci — kto má menej špakov</strong> (pri rovnosti ten, kto prehral poslednú bitku; po
            sekere ostáva útočník). Vykladá prvý a na NA EX odpovedá prvý.
          </li>
          <li>
            Kraje a prevaha platia ako inde; Pitiek je 1 až 5 podľa spojov s lokalitou a víťaz dostane 1 špak za každú kartu
            v línii (na Herni navyše za Dlhy porazeného). Pri sekere vo finále špaky kola aj zo sekery prepadnú.
          </li>
          <li>
            Vo finále sa strach ani reči nedvíhajú: víťaz finále dostane 1 špak za každý bod Nakladačky, víťaz hádky 1 špak za každý bod hádky. Starší bodujú ako po každej bitke
            a výhra strachom platí aj tu. Potom sa vykúpia zvyšné plné poldeci a cigarety (poldeci 1 špak, 5 cigariet 1 špak), odpočíta sa
            nepriznaná Cirhóza a vyhrá hráč s viac špakmi.
          </li>
        </ul>
        <div className="riadok-tlacidiel">
          <Odkaz href="/hra" className="tlacidlo tlacidlo-hlavne">
            Si pripravený? Hraj!
          </Odkaz>
          <Odkaz href="/karty" className="tlacidlo">
            Prezri si karty
          </Odkaz>
        </div>
      </>
    ),
  },
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
