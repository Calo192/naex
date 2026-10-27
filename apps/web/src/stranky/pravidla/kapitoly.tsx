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
          dediny. Kto vyhráva bitky, ten zbiera <P k="spak">špaky</P> — víťazné body — a k nim ďalšie od starších, ktorí sa ho boja.
        </p>
        <p>
          Karty kladiete do spoločnej <P k="linia">línie</P>, pijete <P k="poldeci">poldeci</P>, fajčíte{" "}
          <P k="cigareta">cigarety</P> a robíte dlhy. Všetko má svoju cenu — pečeň, zadĺženie a abstinenčné príznaky ťa dobehnú.
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
      "Okamžitá výhra: vydesíš polovicu starších a udržíš ich do konca ďalšieho kola.",
    ],
    obsah: () => (
      <>
        <div className="karticky">
          <div className="karticka">
            <strong>Špaky.</strong> Hrá sa 3, 5 alebo 7 bitiek o lokality podľa <P k="dlzka-hry">dĺžky hry</P> a potom{" "}
            <P k="finale">finále</P> — posledná bitka bez lokality. Víťaz bitky dostane toľko <P k="spak">špakov</P>, koľko
            Pitiek sa v kole odohralo, a k tomu ti každý starší, ktorý sa ťa bojí, dá 1, 2 alebo 3 špaky podľa zóny. Kto bitku
            prehrá, od starších nedostane nič; pri sekere dostanú obaja.
            Po finále vyhrá, kto má viac špakov.
          </div>
          <div className="karticka karticka-ok">
            <strong>Vyhráš hneď</strong>, ak <P k="vydesenie">vydesíš</P> aspoň polovicu starších v hre a udržíš ich do konca
            nasledujúceho kola. Hra ohlásenie ukáže obom — súper má jedno kolo na odpoveď.
          </div>
          <div className="karticka karticka-zle">
            <strong>O špaky prídeš</strong> pri <P k="exekutor">exekúcii</P> (zhorí polovica tvojich Dlhov a rovnako veľa
            špakov) a za každú nepriznanú Cirhózu na konci hry (5 špakov). Okamžitá prehra nie je — ani exekúcia, ani malý
            balíček ťa o hru nepripravia.
          </div>
        </div>
        <p>
          Všetky zdroje špakov sú v kapitole <a href="#bodovanie">Špaky a finále</a>. Na začiatok stačí vedieť: vyhratá bitka
          dáva špaky za Pitky, vystrašený starší ti k nim dá ďalšie — a súperovi medzitým prejavuje priazeň.
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
      "Bar: poldeci, cigarety, pečeň, zadĺženie, neresti kola a špaky.",
      "Karta má akcie po hranách, tagy a efekt.",
    ],
    obsah: (s) => (
      <>
        <H3 id="co-mas-pred-sebou-bar">Ruka, balíček a bar</H3>
        <p>
          Máš <strong>ruku</strong> (bez limitu), <strong>doberací balíček</strong> a <strong>odhadzovací balíček</strong>. Keď sa
          doberací balíček minie, odhadzovací sa zamieša a stane sa z neho nový doberací balíček. Na bare vidíš svoje <P k="poldeci">poldeci</P> (plné a vypité),{" "}
          <P k="cigareta">cigarety</P>, <P k="pecen">pečeň</P>, zadĺženie, <P k="nerest">neresti</P> kola a svoje{" "}
          <P k="spak">špaky</P>.
        </p>
        <H3 id="co-mas-pred-sebou-karta">Karta</H3>
        <ul>
          <li>
            <strong>Akcie na hranách</strong> — najviac 4 na každej hrane, vo výškach 0 (hore) až 3 (dole). Akcia platí, len keď sa
            stretne s akciou suseda v rovnakej výške.
          </li>
          <li>
            <strong>Tagy</strong> — druh karty (<P k="tag">Občan, Zviera, Starešina, Nástroj</P>…). Samy nič nerobia, odkazujú na
            ne efekty.
          </li>
          <li>
            <strong>Efekt</strong> — text karty. Tučné slovo na začiatku hovorí kedy (Nástup, Pitka, Bitka, Furt…), slová kurzívou
            čo. Presné významy sú v <a href="#slovnik">slovníku</a>.
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
      "Cieľ → šenok → Zhromaždenie a Pitka (1–4×) → bitka → po bitke.",
      "Štart: 4 karty v ruke, prázdny balíček, 2 plné poldeci, 3 cigarety.",
      "Útočník prehral poslednú bitku, obranca ju vyhral.",
      "Po poslednej lokalite finále: bitka bez lokality, vždy 3 Pitky.",
    ],
    obsah: () => (
      <>
        <div className="priebeh">
          <span>1 Cieľ</span>→<span>2 Šenok</span>→<span>3 Zhromaždenie a Pitka 1–4×</span>→<span>4 Bitka</span>→<span>5 Po bitke</span>
        </div>
        <ol className="kroky">
          <li>
            <strong>Cieľ.</strong> <P k="utocnik">Obranca</P> (víťaz poslednej bitky) vyberie lokalitu a natočí ju.
          </li>
          <li>
            <strong>Šenok.</strong> Spolu postavíte ponuku kariet a beriete z nej za cigarety; potom smiete použiť patronát.
          </li>
          <li>
            <strong>Zhromaždenie a Pitka.</strong> Striedavo vykladáte karty do línie, potom sa pije a vyhodnocuje. Opakuje sa
            1- až 4-krát podľa línie.
          </li>
          <li>
            <strong>Bitka.</strong> Viac tuhého poškodenia vyhráva a dostane špaky za odohrané Pitky. Starší, ktorí sa ho
            boja, mu dajú ďalšie; porazený od nich nič. Prebytok posúva starších.
          </li>
          <li>
            <strong>Po bitke.</strong> Karty z línie idú do odhadzovacích balíčkov, každý si dobere 2 karty a doleje sa mu jeden
            vypitý poldeci.
          </li>
        </ol>
        <H3 id="kolo-priprava">Príprava</H3>
        <p>
          Zvoľte <P k="dlzka-hry">dĺžku hry</P> — 3, 5 alebo 7 lokalít; po nich príde <P k="finale">finále</P>. Každý hráč má
          na začiatku v ruke <strong>4 štartovacie karty</strong> — Miňištranta, Milujúcu manželku, Pijana a Dievčinu na vydaj.
          Doberací balíček je prázdny, naplní ho až odhadzovací; dovtedy sa nedá ťahať ani fajčiť. K tomu{" "}
          <strong>2 plné poldeci, 3 cigarety a 0 špakov</strong>. Hra rozdá 8 starších, každému náhodne jeho priazeň; markery
          ležia v strede.
        </p>
        <H3 id="kolo-utocnik">Útočník a obranca</H3>
        <p>
          <strong>Útočník</strong> je ten, kto prehral poslednú bitku: berie zo šenku prvý a v Zhromaždení vykladá prvý.{" "}
          <strong>Obranca</strong> vyberá a natáča cieľ kola a v Pitke začína — útočník má v Pitke posledné slovo. Vo finále
          útočí, kto má viac špakov.
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
      "Obranca vyberie a natočí lokalitu.",
      "Stavba šenku: polovica kariet do šenku, polovica na Smetisko.",
      "Branie striedavo: 1 karta za 1 cigaretu, 2 karty za 3.",
      "Patronát: starší, ktorý ti prejavuje priazeň, ti môže prísť na pomoc.",
    ],
    obsah: () => (
      <>
        <H3 id="ciel">Cieľ kola</H3>
        <p>
          Obranca vyberie lokalitu, o ktorú sa bude biť, a <P k="natocenie">natočí</P> ju. Lokalita leží v strede línie a delí ju
          na dve <P k="strana">strany</P>. Natočenie určuje, ktorá hrana lokality patrí ktorému <P k="kraj">kraju</P> — akcie
          hrany dostane, kto v tom kraji má <a href="#zhromazdenie-prevaha">prevahu</a>. Efekt lokality platí len v kole, keď sa
          o ňu bije (<a href="#lokality">tabuľka lokalít</a>). Vo finále sa cieľ nevyberá — kolo začína rovno šenkom.
        </p>
        <H3 id="senok-stavba">Stavba šenku</H3>
        <p>
          Nevzaté karty zo starého šenku idú naspodok spoločného balíčka. Potom si každý zo spoločného balíčka vezme toľko kariet,
          koľko je v hre nenahradených starších (zaokrúhlené nadol na párne číslo; na začiatku 8). Obaja naraz a tajne dáte <strong>polovicu do šenku</strong> a
          polovicu na <P k="smetisko">Smetisko</P> — naspodok balíčka. Nič si nepodávate; pri 8 kartách 4 + 4 a šenok má 8 kariet.
        </p>
        <H3 id="senok-branie">Branie zo šenku</H3>
        <p>
          Beriete striedavo, začína <strong>útočník</strong>. Na ťahu vezmeš <strong>1 kartu za 1 cigaretu</strong> alebo{" "}
          <strong>2 karty za 3 cigarety</strong>. Šenok sa poldeci neplatí. Kto prestane, druhému ostáva už len jeden ťah; kto
          nemá cigaretu, prestane sám. Potom sa šenok doplní z vrchu spoločného balíčka. Kto má priazeň{" "}
          <strong>Fajčiara</strong>, dostane hneď po braní cigarety navyše (súperovo Obmedzenie ich neuberá).
        </p>
        <H3 id="patronat">Patronát</H3>
        <p>
          Po braní sa najprv útočník, potom obranca rozhodne, či si vezme do ruky staršieho, ktorý mu{" "}
          <P k="priazen">prejavuje priazeň</P> (marker aspoň v žltej zóne na jeho polovici). Každý najviac jedného za kolo.
        </p>
        <ul>
          <li>Kartu staršieho si vezmeš do ruky a v tomto kole ju smieš vyložiť ako každú inú kartu.</li>
          <li>Na jeho miesto dáš lícom dole Občana alebo Zviera z ruky — súper nevie, ktorého. Marker ide do stredu.</li>
          <li>
            Zaplatíš cigarety podľa zóny markera: červená 1, oranžová 2, žltá 3. Súper dostane v tejto
            bitke toľko Pohoršení navyše, o koľko polí marker išiel do stredu (1 / 2 / 3) — tie však nesmú na staršieho,
            ktorého si si vzal.
          </li>
          <li>Treba mať aspoň jeden poldeci. Patronát platí aj vo finále.</li>
        </ul>
        <p className="zvyraznene">
          <strong>Vyhráš bitku</strong> — staršieho si necháš: náhrada sa otočí a hrá ďalej ako starší.{" "}
          <em>Áno, aj koza smie zasadnúť do rady starších.</em> <strong>Prehráš</strong> — starší sa vráti na svoje miesto,
          náhradu si vezmeš späť a <strong>odhodíš jeden poldeci</strong> natrvalo. Patronát vráti marker aj z krajnej pozície
          naraz do stredu — preto je najrýchlejšou odpoveďou na ohlásené vydesenie.
        </p>
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
      "Kartu kladieš na koniec svojej alebo súperovej strany; ostáva tvoja.",
      "Akcia platí, len keď sa na spoji stretne s akciou suseda v rovnakej výške.",
      "Limit vykladania = plné poldeci + 1.",
      "Pas dá cigaretu za každú kartu, ktorú si ešte smel vyložiť a máš ju v ruke.",
    ],
    obsah: (s) => (
      <>
        <H3 id="zhromazdenie-linia">Línia a dve strany</H3>
        <p>
          Karty tvoria <strong>jednu súvislú <P k="linia">líniu</P></strong> bez vetvenia. Lokalita v strede ju delí na tvoju
          a súperovu <P k="strana">stranu</P>. Na ťahu položíš kartu na <strong>koniec svojej alebo súperovej strany</strong>.
          Karta je vždy natočená k tebe a ostáva tvoja — je v tvojej <P k="partia">partii</P> a jej akcie aj efekty sa rátajú
          tebe, nech leží kdekoľvek. Vo finále lokalita nie je: v strede leží prvá vyložená karta a ďalšie sa kladú na jej dve
          strany; kraje ani prevaha tam nie sú.
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
          Zhromaždení kola máš limit o 1 nižší a pri bitke sa vypije. Nástroje limit nemíňajú.
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
          <strong>Občanov, Zvierat a Starešinov</strong> (Nástroje ani Cirhóza sa nerátajú). Pri rovnosti hráč, ktorého karta
          v kraji leží hneď pri lokalite. Jedna podstrčená karta teda neukradne akcie hrany, ale tvorí s nimi spoj: ako prvá
          karta pri lokalite určuje, ktoré akcie hrany sa aktivujú, a tie dostane hráč s prevahou. Kraje majú mená podľa lokality, napríklad
          v Krčme „pri výčape“ a „pri dverách“.
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
      "Počet Pitiek = 1 + menší počet aktivovaných akcií lokality z jej dvoch strán.",
      "Obranca začína, útočník má posledné slovo.",
      "NA EX vyberáte skryto; odkryje sa, keď ste hotoví obaja.",
      "NA EX zruší aktívne a zdvojí neaktívne akcie karty; karta musí mať oboje.",
      "Na každé súperovo NA EX odpovieš jednou kartou — najprv obranca, potom útočník.",
      "Fajčí sa len v Pitke.",
    ],
    obsah: () => (
      <>
        <H3 id="pitka-pocet">Koľko Pitiek</H3>
        <p>
          Po Zhromaždení nasleduje <P k="pitka">Pitka</P>. V bitke je ich <strong>1 + menší z počtov aktivovaných akcií lokality</strong>{" "}
          na jej dvoch stranách (1 až 4). Akciu lokality aktivuje karta, ktorá s ňou tvorí spoj; Odpor na hrane lokality sa ráta,
          akcia hrany zrušená Odporom karty nie. Ak tvoja karta aktivuje 3 akcie lokality a súperova 1, pijú sa{" "}
          <strong>2 Pitky</strong>. Pred každou Pitkou je Zhromaždenie. Počet sa počas kola mení s líniou — začatá Pitka sa vždy
          dopije. Finále má vždy 3 Pitky. Koľko Pitiek sa odohrá, toľko špakov dostane víťaz bitky.
        </p>
        <H3 id="pitka-poradie">Poradie Pitky</H3>
        <p>
          <strong>Začína obranca.</strong> Na svojom ťahu smieš fajčiť, doliať, barterovať a skryto vybrať NA EX. Keď skončíš,
          nedá sa to vrátiť. Potom hrá rovnako útočník. Keď ste hotoví obaja, NA EX sa odkryjú a odpovedáte na ne — najprv
          obranca, útočník má <strong>posledné slovo</strong>. Potom sa Pitka vyhodnotí:
        </p>
        <ol>
          <li>NA EX — odkrytie a odpovede.</li>
          <li>Dlh — za každý celý prah zadĺženia karta Dlh.</li>
          <li>Poškodenie pečene — za každý celý prah Cirhóza.</li>
          <li>Obmedzenie.</li>
          <li>Cigarety — za akcie Cigareta (mínus súperove Obmedzenia).</li>
          <li>
            <P k="vizia">Vízia</P> — za každú aktívnu Víziu pozrieš vrchnú kartu svojho balíčka a vezmeš si ju do ruky, alebo ju
            navždy zahodíš.
          </li>
          <li>Záverečné karty sa otočia lícom hore (kapitola <a href="#pokrocile">Pokročilé ťahy</a>).</li>
        </ol>
        <p className="tlmene">Pitka sama karty nedáva — doberáš si ich fajčením, priznaním kliatby, Víziou a efektmi kariet.</p>
        <H3 id="naex">NA EX</H3>
        <p>
          Na svojom ťahu v Pitke položíš plný poldeci na kartu v línii s tagom <strong>Občan</strong> alebo{" "}
          <strong>Starešina</strong> — svoju aj súperovu. V základe raz za Pitku. Karta musí mať{" "}
          <strong>aspoň jednu aktívnu a aspoň jednu neaktívnu akciu</strong>; inak by <P k="naex">NA EX</P> nič nezmenilo.{" "}
          <strong>NA EX vyberáš skryto</strong> — súper nevie, či si ho dal ani kam, kým nie ste hotoví obaja.
        </p>
        <p className="zvyraznene">
          NA EX karte <strong>zruší aktívne akcie a zdvojí neaktívne</strong>. Akcie sa rátajú majiteľovi karty: na svojej si
          zdvojíš Petelicu alebo zrušíš vlastný Dlh, na súperovej mu zrušíš, čo potreboval, ale jeho neaktívne mu zdvojíš.
          Násobky sa násobia — NA EX vedľa Silnej ženy dá ×4, aj Dlhu a Poškodeniu pečene. Poldeci leží na karte do bitky,
          takže NA EX sa vyhodnotí v každej Pitke kola; pečeň +1 je tvoja (pripíše sa pri odkrytí) a v bitke sa poldeci vypije.
          Pred potvrdením ti hra ukáže bitku pred a po aj kliatby, ktoré z toho budú.
        </p>
        <ul>
          <li>Nedá sa dať na Liberála, na súperovho Anonymného alkoholika ani na kartu, na ktorej už poldeci leží.</li>
          <li>Akcia zrušená Odporom nie je ani aktívna, ani neaktívna — NA EX ju nezdvojí.</li>
          <li>NA EX na kartu pri lokalite mení len akcie karty — akcie hrany lokality ostávajú aktívne.</li>
          <li>
            NA EX na kartu s Posilnením zruší Posilnenie aj ×2, ktoré dávalo partnerovi na spoji — partnerova akcia (aj hrana
            lokality) ostáva aktívna, ale len ×1.
          </li>
          <li>Veterán je výnimka: NA EX mu aktívne akcie zdvojí (nezruší) a neaktívne nechá.</li>
          <li>Súperovu Záverečnú (lícom dole) smie dostať NA EX vždy.</li>
          <li>V Krčme musí dať NA EX každý, kto má plný poldeci a kam ho dať; vo Vínnej pivnici smieš dvakrát za Pitku.</li>
        </ul>
        <H3 id="naex-odkrytie">Odkrytie a Výtržník</H3>
        <p>
          Keď ste hotoví obaja, NA EX sa odkryjú — najprv obrancovo, potom útočníkovo. Až vtedy poldeci ľahne na kartu,
          pripíše sa pečeň a platia efekty ako Svokra či Výpalné.
        </p>
        <p className="zvyraznene">
          <strong>Zrážka:</strong> ak ste obaja vybrali tú istú kartu, je z nej <P k="vytrznik">Výtržník</P>. So susedmi sa
          najprv spáruje ako obvykle, potom sa <strong>všetky jej akcie zmenia na Rany</strong> pre jej majiteľa — aj tie bez
          partnera. Aj jej Posilnenie a Odpor sú už len Rany — suseda nezdvojujú ani nerušia. Každý platí za svoje NA EX (pečeň, poldeci, Svokra, Výpalné). Po bitke Výtržník vytriezvie a karta má
          znova pôvodné akcie.
        </p>
        <H3 id="naex-odpoved">Odpoveď na NA EX</H3>
        <p>
          Po odkrytí smieš za <strong>každé súperovo NA EX vyložiť jednu kartu</strong> z ruky na koniec svojej alebo jeho
          strany — <P k="odpoved">odpoveď</P> limit vykladania nemíňa. Najprv odpovedá <strong>obranca</strong>, potom{" "}
          <strong>útočník</strong>, ktorý má posledné slovo. Najlepšie tak, aby si spároval neaktívne akcie karty s NA EX: tie
          sa stanú aktívnymi a NA EX ich zruší. Odpoveď smie zmeniť prevahu v kraji aj počet Pitiek.
        </p>
        <H3 id="pitka-cigarety">Fajčenie, doliatie a barter</H3>
        <ul>
          <li>
            <P k="fajcenie">Fajčenie</P> — cigareta = karta z balíčka hneď; len na svojom ťahu v Pitke, v Zhromaždení nie.
          </li>
          <li>
            <P k="doliatie">Doliatie</P> — v Pitke za 2 cigarety otočíš vypitý poldeci späť na plný (nie s Vínkom v Dedičstve).
          </li>
          <li>
            <P k="barter">Stokársky barter</P> — v Pitke za 5 cigariet nový plný poldeci.
          </li>
        </ul>
        <p className="tlmene">Na začiatku každého kola sa ti jeden vypitý poldeci doleje sám.</p>
      </>
    ),
  },
  {
    id: "cena-pitia",
    cast: "B",
    nazov: "Cena pitia",
    obrazok: "08-cena-pitia",
    vSkratke: [
      "Pečeň a zadĺženie sa počítajú len v Pitke a potom sa vynulujú.",
      "Za každý celý prah pečene Cirhóza, za každý celý prah zadĺženia Dlh.",
      "Menej nerestí než minulé kolo = Absťák.",
    ],
    obsah: () => (
      <>
        <H3 id="cena-pecen">Pečeň a Cirhóza</H3>
        <p>
          K <P k="pecen">pečeni</P> prispieva každá akcia <strong>Poškodenie pečene</strong>, každá akcia <strong>Poldeci</strong>{" "}
          a každé NA EX. Vyhodnotí sa <strong>len v Pitke</strong>: za každý celý prah (3; Nealko v Dedičstve a Krčma ho zvyšujú) dostaneš
          kartu <P k="cirhoza">Cirhóza</P> — ide do tvojho odhadzovacieho balíčka. Po Pitke sa pečeň vynuluje, zvyšok pod prahom
          sa neprenáša. Poldeci vypitý v Zhromaždení (ďalšia karta v ťahu) pripíše +1 pečene do najbližšej Pitky.
        </p>
        <H3 id="cena-dlh">Zadĺženie a Dlh</H3>
        <p>
          Každá akcia <strong>Dlh</strong> v Pitke zvýši zadĺženie o 1. Každé 2 zadĺženia ti dajú kartu{" "}
          <P k="dlh">Dlh</P> — prizná sa hneď sama a kartu za ňu nedoberáš. Po Pitke sa zadĺženie vynuluje. Dlhy, ktoré dáva
          priamo karta (napríklad Poštárka), idú rovno. Viac Pitiek v bitke teda znamená viac pečene aj Dlhov. Doska ti vopred
          ukazuje, čo karty na stole pripíšu a koľko kliatob z toho bude.
        </p>
        <H3 id="cena-abstak">Neresti a Absťák</H3>
        <p>
          <P k="nerest">Nerest</P> je každý poldeci vypitý v Zhromaždení, každé NA EX, každá vyfajčená cigareta, doliatie a barter
          (za každú cigaretu). Platba za šenok, Dedičstvo a Starostu sa nepočíta. Na konci kola sa neresti porovnajú s minulým
          kolom:
        </p>
        <ul>
          <li>
            <strong>Menej</strong> → <P k="abstak">Absťák</P> rovno priznaný do hracej oblasti; za priznanie si dobereš kartu.
          </li>
          <li>
            <strong>Viac</strong> → jeden Absťák odíde. <strong>Rovnako</strong> → nič. Prvé kolo len nastaví základ.
          </li>
          <li>
            S odhalenou <strong>Milujúcou manželkou</strong> (v línii alebo priznanou) dostaneš Absťák aj pri rovnakom počte; dve
            manželky aj pri o 1 viac nerestiach.
          </li>
        </ul>
        <p>
          Každý Absťák ti v bitke zníži tuhé poškodenie o 1 — trasú sa ti ruky. Autobusár jeden ignoruje. Hra si pamätá, koľko
          Absťákov si <strong>získal za hru</strong> (štatistika). Absťáky, ktoré práve máš, navyše rozhodujú remízu v bitke
          a víťazovi s viac Absťákmi uberajú špaky za bitku.
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
      "Mäkké z Povier najviac do výšky súperových priznaných Dlhov.",
      "Viac tuhého vyhráva: víťaz dostane špaky za odohrané Pitky, lokalita ide na nástenku.",
      "Remízu rozhodne menej Absťákov, potom menej Dlhov, inak sekera.",
      "Prebytok rozdeľuje hráč s vyšším celkovým poškodením.",
    ],
    obsah: () => (
      <>
        <H3 id="bitka-poskodenie">Tuhé a mäkké poškodenie</H3>
        <p>
          <P k="tuhe">Tuhé</P> poškodenie (Rana 1, Pecka 2, Petelica 3) rozhoduje o víťazovi. <P k="makke">Mäkké</P> (Povera) sa
          udeľuje najviac do výšky súperových priznaných Dlhov. Každá tvoja priznaná Cirhóza dá súperovi +1 tuhé.
        </p>
        <ol>
          <li>
            <P k="viera">Viera</P> a Povery sa vyrušia 1 : 1 — tvoja Viera ruší súperove Povery a naopak.
          </li>
          <li>Zvyšné Povery udelia mäkké poškodenie, najviac do výšky súperových priznaných Dlhov.</li>
          <li>
            Zvyšná Viera zníži súperovo tuhé poškodenie, pod 0 neklesne. Veriaci (priazeň) ti pridá Vieru navyše; hodnotu jednej
            Viery mení len Svätý text v Dedičstve.
          </li>
          <li>Každý Absťák ti zníži tuhé o 1.</li>
        </ol>
        <UkazkaBitky />
        <H3 id="bitka-vysledok">Výsledok a sekera</H3>
        <p>
          Vyhráva vyššie <strong>tuhé</strong>. Pri rovnakom tuhom vyhrá, kto má <strong>menej Absťákov</strong>, a keď aj tých
          máte rovnako, kto má <strong>menej priznaných Dlhov</strong>. Ak nerozhodnú ani Dlhy, bitku nevyhrá nikto: špaky kola
          čakajú <P k="sekera">na sekere</P> a vezme si ich navyše víťaz najbližšej bitky; vo finále prepadnú. Útočník pri
          sekere ostáva útočníkom.
        </p>
        <p className="zvyraznene">
          Víťaz dostane toľko <P k="spak">špakov</P>, koľko Pitiek sa v kole naozaj odohralo (finále 3). Ak má viac Absťákov
          ako porazený, dostane o rozdiel menej, ale vždy aspoň 1 špak. Lokalitu si neberie — ide na krčmovú{" "}
          <P k="nastenka">nástenku</P> s jeho menom a špakmi. Prebytok rozdeľuje hráč s vyšším <strong>celkovým</strong>{" "}
          poškodením — aj pri remíze v tuhom.
        </p>
        <H3 id="bitka-kroky">Kroky bitky v poradí</H3>
        <ol className="kroky">
          <li>
            <strong>Efekty na začiatku bitky</strong> — Krčmárka, Dievčina na vydaj; pri bitke o Kar potom každý smie zahodiť
            jednu nepriznanú Cirhózu z ruky.
          </li>
          <li>
            <strong>Exekútor</strong> — najprv Robota, potom kontrola prahu priznaných Dlhov; pri exekúcii zhorí polovica Dlhov
            a rovnako veľa špakov (kapitola <a href="#kliatby">Kliatby a priznanie</a>).
          </li>
          <li>
            <strong>Pohoršenie</strong> — posúva markery starších k súperovi alebo k sebe (kapitola{" "}
            <a href="#starsi">Starší a prebytok</a>).
          </li>
          <li>
            <strong>Poškodenie</strong> — Viera a Povera sa vyrušia, tuhé znižuje Viera a Absťáky, mäkké po strop Dlhov.
          </li>
          <li>
            <strong>Výsledok</strong> — víťaz (pri remíze rozhodnú Absťáky, potom Dlhy), inak sekera.
          </li>
          <li>
            <strong>Špaky za bitku</strong> — víťaz dostane špaky za odohrané Pitky; lokalita ide na nástenku.
          </li>
          <li>
            <strong>Špaky za starších</strong> — víťaz dostane špaky za starších, ktorí sa ho boja (aj Noviny v Dedičstve); porazený
            nič, pri sekere obaja.
          </li>
          <li>
            <strong>Prebytok</strong> — hráč s vyšším celkovým poškodením posunie markery starších; prejaví sa až v ďalšej
            bitke. Po finále a v bitke o Kultúrny dom sa nerozdeľuje — jeho držiteľ dostane toľko špakov, aký je prebytok.
          </li>
          <li>
            <strong>Poldeci</strong> — poldeci z NA EX sa vypijú (s priazňou Alkoholika sa niektoré vrátia plné); aktívna akcia
            Poldeci otočí vypitý späť na plný.
          </li>
          <li>
            <strong>Veštica</strong> — porazený s Vešticou vymení kartu medzi doberacími balíčkami.
          </li>
          <li>
            <strong>Pohreb</strong> — s priznanou Cirhózou; na Cintoríne potom porazený smie dať Nástroj do Dedičstva zadarmo.
          </li>
          <li>
            <strong>Výhra a Prehra</strong> — Živnostník, cigarety za prebytok (súper dostane 1 cigaretu za každého staršieho,
            ktorého marker sa prebytkom posunul), Kmotor (kto má jeho priazeň, tomu zmiznú priznané Dlhy podľa sily) a ostatné
            efekty Výhra a Prehra.
          </li>
          <li>
            <strong>Patronát</strong> — víťaz si staršieho nechá, porazený ho vráti a odhodí poldeci.
          </li>
          <li>
            <strong>Návrat kariet</strong> do odhadzovacieho balíčka hráča, ktorý ich zahral. Nepriznaná Cirhóza z ruky ide tiež
            do odhadzovacieho balíčka.
          </li>
          <li>
            <strong>Absťák</strong> — porovnanie nerestí kola s minulým; potom sa skontroluje vydesenie.
          </li>
          <li>
            <strong>Nové kolo</strong> — každému sa doleje jeden vypitý poldeci a každý si dobere 2 karty.
          </li>
        </ol>
      </>
    ),
  },
  {
    id: "starsi",
    cast: "B",
    nazov: "Starší a prebytok",
    obrazok: "10-starsi-a-prebytok",
    vSkratke: [
      "Marker staršieho posunutý k súperovi = súper má priazeň, starší sa bojí teba (špaky po každej bitke, ktorú vyhráš).",
      "Stupnica má 7 polí: červená, oranžová, žltá, sivý stred, žltá, oranžová, červená.",
      "Prebytok aj Pohoršenie posúvajú marker o pole, bez limitu a aj na krajnú pozíciu.",
      "Krajná červená: starší sa prebudí pre teba; súper ho smie odtlačiť späť.",
    ],
    obsah: () => (
      <>
        <H3 id="starsi-stupnica">Stupnica strachu</H3>
        <p>
          Každý <P k="starsi">starší</P> dostane na začiatku hry náhodne svoju priazeň a vidíš ju pri ňom. Pod ním je stupnica
          strachu so <strong>7 poľami</strong> — červená, oranžová, žltá, sivý stred, žltá, oranžová, červená — a marker
          začína v sivom strede.
        </p>
        <p className="zvyraznene">
          <P k="priazen">Priazeň</P> má ten, ku komu je marker posunutý — to je výhoda počas hry. Starší sa vtedy bojí toho druhého.
          Keď posunieš marker k súperovi, dávaš mu priazeň teraz, ale tebe pribudne vystrašený starší — a za jeho{" "}
          <P k="strach">strach</P> ti po každej bitke, ktorú vyhráš, dá <P k="spak">špaky</P>: žltá 1, oranžová 2, červená 3
          (pri sekere obom, porazenému nič).
        </p>
        <UkazkaStupnice />
        <H3 id="starsi-prebytok">Prebytok a Pohoršenie</H3>
        <p>
          <P k="prebytok">Prebytok</P> je rozdiel v celkovom poškodení. Hráč, ktorý ho rozdeľuje, ním posúva markery starších
          k súperovi — každý bod o jedno pole (zo stredu do žltej 1, na červenú 3), aj na krajnú pozíciu a z nej von. Špaky
          za starších sa rozdávajú ešte pred prebytkom, takže sa prejaví až v ďalšej bitke. Súper za každého staršieho, ktorého
          marker sa posunul, dostane 1 cigaretu.
        </p>
        <p>
          Každé <P k="pohorsenie">Pohoršenie</P> posunie marker o 1 — <strong>k súperovi, alebo k sebe</strong>; vyberáš ty.
          K sebe si priazeň toho staršieho vezmeš (alebo ju súperovi uberieš). Priazeň sa mení <strong>hneď</strong> — platí už
          v poškodení tej istej bitky, takže ju môže rozhodnúť. Ten istý marker smieš posunúť aj viackrát,{" "}
          <strong>bez limitu</strong> a aj na krajnú pozíciu (zo stredu na červenú tri Pohoršenia). Pohoršenie mení aj strach
          hneď — ráta sa už do špakov za starších tej istej bitky. Súperova Policajtka ruší tvoje Pohoršenia v oboch smeroch.
        </p>
        <H3 id="starsi-priazne">Priazne</H3>
        <p>
          Sila priazne je <strong>1 / 2 / 3</strong> podľa zóny (žltá, oranžová, červená). Akú priazeň starší dáva, sa mu rozdá
          náhodne na začiatku hry.
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
            <tr><td>Kmotor</td><td>Po bitke ti zmiznú priznané Dlhy (bez Dlhu nič)</td><td>1 / 2 / 3</td></tr>
            <tr><td>Abstinent</td><td>Pohoršenia navyše v bitke</td><td>+1 / +2 / +3</td></tr>
            <tr><td>Exekútor</td><td>Súperov prah Exekúcie je nižší</td><td>−1 / −2 / −3</td></tr>
            <tr><td>Výpalník — Výpalné</td><td>Za každé súperovo NA EX ti súper dá cigarety</td><td>1 / 2 / 3</td></tr>
            <tr><td>Fajčiar</td><td>Cigarety po braní zo šenku (Obmedzenie ich neuberá)</td><td>+1 / +2 / +3</td></tr>
            <tr><td>Alkoholik — Na zdravie „do dna“</td><td>Poldeci z tvojho NA EX sa po bitke vráti plný (za kolo)</td><td>1 / 2 / 3</td></tr>
            <tr><td>Veriaci</td><td>Viera navyše v bitke</td><td>+1 / +2 / +3</td></tr>
          </tbody>
        </table>
        <H3 id="starsi-vydesenie">Vydesenie, krajná pozícia a prebudenie</H3>
        <ul>
          <li>
            <strong>Krajná pozícia:</strong> na červenú sa marker smie dostať aj viacerými posunmi v jednom kole, prebytkom aj
            Pohoršením. Súper ho z nej smie odtlačiť späť alebo ho <a href="#patronat">patronátom</a> vrátiť naraz do stredu.
          </li>
          <li>
            <P k="prebudenie">Prebudenie:</P> keď vytlačíš marker na krajnú červenú, efekt staršieho začne pôsobiť pre teba (okrem
            Nástupu).
          </li>
          <li>
            <P k="vydesenie">Vydesenie:</P> kto má na krajnej zóne polovicu starších v hre a udrží ich do konca nasledujúceho kola,
            vyhrá. Keď ich čo i len na chvíľu klesne pod polovicu (napr. patronátom), hrozba padá a ráta sa odznova.
          </li>
        </ul>
        <p className="tlmene">
          V hre to vidíš pri každom staršom: komu patrí priazeň a čo dáva, koho sa starší bojí a koľko špakov mu dá po bitke, ak ju
          vyhrá.
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
      "Kliatby: Dlh, Cirhóza, Absťák, Milujúca manželka.",
      "Priznanie vyloží kliatbu natrvalo mimo línie; limit nemíňa.",
      "Za priznanie dobereš kartu — nie za Cirhózu a nie za nový Dlh z prahu.",
      "Priznané Dlhy na prahu Exekútora = zhorí polovica Dlhov a rovnako veľa špakov.",
      "Nepriznaná Cirhóza ťa na konci hry stojí 5 špakov.",
    ],
    obsah: () => (
      <>
        <H3 id="kliatby-priznanie">Priznanie</H3>
        <p>
          <P k="kliatba">Kliatbu</P> môžeš namiesto do línie vyložiť do svojej hracej oblasti — je{" "}
          <P k="priznanie">priznaná</P> a natrvalo mimo balíčka. Priznanie nemíňa limit vykladania ani neodovzdá ťah. Do línie
          z kliatob patrí len Milujúca manželka.
        </p>
        <ul>
          <li>
            <strong>Dlh</strong> — nový Dlh z prahu zadĺženia sa prizná sám a kartu zaň <strong>nedobereš</strong>. Dlh, ktorý
            ti súper podstrčí do balíčka (Vychovávateľka), sa pri dobratí prizná sám a ťaháš ďalšiu kartu. Priznané Dlhy sa
            rátajú k prahu Exekútora a pri remíze v bitke prehrá, kto ich má viac.
          </li>
          <li>
            <strong>Cirhóza</strong> — ide do odhadzovacieho balíčka; do ruky príde, až keď sa doberací balíček minie
            a odhadzovací sa zamieša. Priznáš ju, keď chceš, ale kartu za ňu{" "}
            <strong>nedobereš</strong>. Priznaná dá súperovi v každej bitke +1 tuhé. <strong>Nepriznaná ide po bitke do tvojho odhadzovacieho
            balíčka; na konci hry ti zoberie 5 špakov</strong> (ráta sa ruka aj oba balíčky). Buď ju prizníš hneď, alebo
            riskuješ, že sa ti do konca hry nevráti do ruky.
          </li>
          <li>
            <strong>Absťák</strong> — príde rovno priznaný a za neho si dobereš kartu. Víťazovi s viac Absťákmi uberie špaky za
            bitku a remízu v bitke prehrá, kto ich má viac.
          </li>
          <li>
            <strong>Milujúca manželka</strong> — za priznanie si dobereš kartu; odhalená (v línii či priznaná) ti sťažuje
            Absťák.
          </li>
        </ul>
        <H3 id="kliatby-exekutor">Exekútor a Robota</H3>
        <ol>
          <li>
            <strong>Robota:</strong> v bitke ešte pred kontrolou prahu spáliš za každú aktívnu Robotu 1 priznaný Dlh.
          </li>
          <li>
            Ak priznané Dlhy dosiahnu prah <P k="exekutor">Exekútora</P> (10; so súperovou priazňou Exekútora 9 / 8 / 7,
            na Obecnom úrade o 4 menej), čelíš exekúcii: zhorí ti <strong>polovica priznaných Dlhov</strong> (zaokrúhlené
            nadol) a <strong>rovnako veľa špakov</strong>. Súper ich nedostane a smieš ísť do mínusu. Kto má Záhradkára (v ruke
            či v balíčkoch), smie ho zahodiť namiesto špakov — Dlhy zhoria aj tak.
          </li>
          <li>
            Kto exekúcii nečelí, tomu sa Dlh sám nepáli — pália ho len Robota, Dievčina na vydaj, Niekoho stryná a Veľmi
            smútiaca vdova.
          </li>
        </ol>
        <H3 id="kliatby-pohreb">Pohreb</H3>
        <p>
          Po bitke smieš s priznanou Cirhózou vykonať <P k="pohreb">Pohreb</P>: spáliš ju aj jednu svoju kartu z línie. Keď je
          spálená karta Závislý, vezmeš si jednu kartu zo šenku. Iná liečba Cirhózy nie je.
        </p>
      </>
    ),
  },
  {
    id: "nastroje",
    cast: "C",
    nazov: "Nástroje a Dedičstvo",
    obrazok: "12-nastroje",
    vSkratke: [
      "Nástroj v línii funguje len pri Občanovi alebo Starešinovi.",
      "Jeho akcie dostane majiteľ karty, s ktorou tvorí spoj.",
      "Dedičstvo: efekt Nástroja platí len tam; cena 1, 2, 3… cigarety pre oboch spolu.",
    ],
    obsah: () => (
      <>
        <H3 id="nastroje-linia">Nástroj v línii</H3>
        <p>
          <P k="nastroj">Nástroj</P> nemíňa limit vykladania a NA EX naň dať nemožno. Nástroj nesmie susediť s Nástrojom —
          náradie musí mať kto používať. Spoj s ním vznikne len pri karte s tagom <strong>Občan alebo Starešina</strong>; pri
          lokalite, karte staršieho či inej karte sa neaktivuje nič.
        </p>
        <p className="zvyraznene">
          Akcie Nástroja v línii dostane <strong>majiteľ karty, s ktorou Nástroj tvorí spoj</strong> — nie ten, kto ho vyložil.
          Podstrčený Nástroj teda pracuje pre súpera. Leží medzi kartami dvoch hráčov? Každý dostane akcie svojho spoja. Efekt
          Nástroja v línii neplatí.
        </p>
        <H3 id="nastroje-dedicstvo">Dedičstvo</H3>
        <p>
          Namiesto do línie môžeš Nástroj vyložiť do hracej oblasti ako <P k="dedicstvo">Dedičstvo</P>. Kým tam leží, platí jeho
          efekt (napríklad Nealko: prah Cirhózy o 2 vyšší). <strong>Cena rastie pre oboch hráčov spolu:</strong> prvý Nástroj
          v Dedičstve stojí 1 cigaretu, druhý 2, tretí 3 — kto je rýchlejší, platí menej. Vyloženie do Dedičstva limit nemíňa,
          ale v striedaní je to ťah.
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
      "Podstrčenie: karta na súperovej strane ostáva tvoja.",
      "Posilnenie zdvojí, Odpor zruší, Odpor proti Odporu = Vzbura.",
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
          koniec svojej alebo súperovej strany. Míňa limit a potom už v tom Zhromaždení nevykladáš (pas za ňu cigarety nedá).
          Súper ju nevidí, nesmie za ňu priložiť kartu (ani odpoveďou na NA EX) a NA EX na ňu smie dať len on — vtedy prejde
          vždy. Otočí sa na <strong>konci Pitky</strong>; až vtedy platí jej Nástup a efekty.
        </p>
        <H3 id="pokrocile-podstrcenie">Podstrčenie (sabotér)</H3>
        <p>
          Karta vyložená na súperovu stranu je <P k="podstrcenie">podstrčená</P>: ostáva tvoja, jej akcie aj efekty sa rátajú
          tebe a so súperovými susedmi sa páruje normálne — aktivuje im akcie na spoji, ktoré dostane súper. Pošli mu sabotéra:
          tvoj Odpor mu zruší akciu, ktorú potreboval, a zaberieš mu koniec strany.
        </p>
        <p>
          Akcie hrany lokality podstrčená karta neukradne, ale tvorí s nimi spoj: keď leží pri lokalite ako prvá, určuje, ktoré
          akcie hrany sa aktivujú. Dostane ich hráč s prevahou v kraji.
        </p>
        <p>
          <strong>Kočovník</strong> je výnimka: „Furt: Jeho akcie sa počítajú hráčovi, ktorý má v jeho kraji prevahu.“ Všetky
          jeho akcie — aj Rana, Dlh či Poškodenie pečene — dostane ten, kto v kraji prevláda. Do prevahy sa Kočovník ráta
          svojmu majiteľovi, pri rovnosti rozhoduje karta hneď pri lokalite. Škodlivé akcie sa súperovi dajú podhodiť, ale
          súper to vie ovplyvniť kartami, ktoré do kraja vyloží.
        </p>
        <H3 id="pokrocile-modifikatory">Posilnenie, Odpor a Vzbura</H3>
        <ul>
          <li>
            <strong>Posilnenie</strong> zdvojnásobí akúkoľvek prepojenú akciu — priaznivú aj nepriaznivú.
          </li>
          <li>
            <strong>Odpor</strong> zruší prepojenú akciu.
          </li>
          <li>
            <strong>Odpor proti Odporu = <P k="vzbura">Vzbura</P>:</strong> obe karty vyhodnotia všetky svoje inak neaktívne akcie
            ako aktívne.
          </li>
          <li>Ak Posilnenie ovplyvní Odpor, neprepojené akcie aktivuje iba karta s Odporom.</li>
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
      "V sade je 15 lokalít.",
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
          <tr><td>Kostol</td><td>Zhromaždenie, Pitka</td><td>Nikto nesmie vypiť (v ťahu len jedna karta) ani dať NA EX.</td></tr>
          <tr><td>Benzínka</td><td>Pitka</td><td>Nikto nesmie fajčiť.</td></tr>
          <tr><td>Zastávka</td><td>Zhromaždenie</td><td>Spoločný limit vykladania = súčet vašich limitov. Pas dá cigarety len za tvoj vlastný zvyšok limitu.</td></tr>
          <tr><td>Lesná cesta</td><td>Bitka</td><td>+1 tuhé za každého tvojho Občana, Zviera či Starešinu v súperovom kraji, najviac +2.</td></tr>
          <tr><td>Ihrisko</td><td>Bitka</td><td>V každom kraji +2 tuhé tomu, kto tam má viac svojich Občanov, Zvierat a Starešinov — spolu až +4.</td></tr>
          <tr><td>Zberný dvor</td><td>Pitka</td><td>Raz za Pitku za cigaretu karta z tvojho odhadzovacieho balíčka do ruky.</td></tr>
          <tr><td>Most</td><td>Zhromaždenie, Pitka</td><td>Karty len na vlastnú stranu, aj odpoveď na NA EX.</td></tr>
          <tr><td>Kar</td><td>Bitka</td><td>Každý smie na začiatku bitky zahodiť jednu nepriznanú Cirhózu z ruky.</td></tr>
          <tr><td>Cintorín</td><td>Prehra</td><td>Porazený smie dať Nástroj z ruky do Dedičstva zadarmo (cena Dedičstva aj tak stúpne).</td></tr>
          <tr><td>Obecný úrad</td><td>Bitka</td><td>Prah Exekútora −4; Robota spáli 2 priznané Dlhy.</td></tr>
          <tr><td>Jednota</td><td>Pitka</td><td>Nový poldeci (barter) o 1 cigaretu lacnejší.</td></tr>
          <tr><td>Kultúrny dom</td><td>Bitka</td><td>Prebytok sa nerozdeľuje medzi starších. Kto ho drží, dostane toľko špakov, aký je prebytok.</td></tr>
          <tr><td>Vínna pivnica</td><td>Pitka</td><td>NA EX až dvakrát za Pitku.</td></tr>
          <tr><td>Družstvo</td><td>Zhromaždenie</td><td>Pracujúci nemíňajú limit vykladania.</td></tr>
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
      "Špaky sú víťazné body; po finále vyhrá, kto ich má viac, rovnosť je remíza.",
      "Vyhratá bitka: toľko špakov, koľko sa odohralo Pitiek (aspoň 1).",
      "Po vyhratej bitke: každý starší, ktorý sa ťa bojí, dá 1 / 2 / 3 podľa zóny.",
      "Finále: posledná bitka bez lokality, vždy 3 Pitky, prebytok dá špaky.",
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
            <tr><td>Vyhratá bitka</td><td>toľko, koľko Pitiek sa v kole odohralo (finále 3); ak má víťaz viac Absťákov ako porazený, o rozdiel menej, ale aspoň 1; k tomu špaky zo sekery</td></tr>
            <tr><td>Starší, ktorí sa ťa boja</td><td>po vyhratej bitke (aj finále) za každého: žltá 1, oranžová 2, červená 3; sivý nikomu; porazený nič, pri sekere obaja</td></tr>
            <tr><td>Noviny v Dedičstve</td><td>po vyhratej bitke (pri sekere obom) +1, keď sa ťa bojí viac starších ako súpera</td></tr>
            <tr><td>Prebytok po finále a v bitke o Kultúrny dom</td><td>toľko, aký je prebytok</td></tr>
            <tr><td>Exekútor</td><td>mínus polovica priznaných Dlhov (Záhradkár ich zachráni)</td></tr>
            <tr><td>Nepriznaná Cirhóza</td><td>mínus 5 za kus na konci hry (ruka aj oba balíčky)</td></tr>
          </tbody>
        </table>
        <p className="zvyraznene">
          Príklad: v bitke o Krčmu sa odohrali 2 Pitky a vyhral si — máš 2 špaky. Farár sa ťa bojí v oranžovej a Starosta
          v žltej, takže po bitke dostaneš ďalšie 2 + 1 = 3. Súpera sa bojí Hrobár v žltej, ale bitku prehral — od starších
          nedostane nič. Po bitke je to 5 : 0.
        </p>
        <H3 id="finale">Finále</H3>
        <ul>
          <li>Po poslednej bitke o lokalitu (3 / 5 / 7) sa hrá finále — posledná bitka bez lokality.</li>
          <li>Cieľ sa nevyberá; šenok, branie aj patronát platia ako v každom kole.</li>
          <li>
            <strong>Útočí, kto má viac špakov</strong> (pri rovnosti ten, kto prehral poslednú bitku). Vykladá prvý, takže súper
            vidí, čo vyložil; v Pitke má posledné slovo.
          </li>
          <li>
            Prvá vyložená karta leží v strede ako lokalita, ďalšie sa kladú na jej dve strany a párujú sa s ňou bežne. Kraje ani
            prevaha vo finále nie sú.
          </li>
          <li>Finále má vždy 3 Pitky. Pri sekere vo finále špaky kola aj zo sekery prepadnú.</li>
          <li>
            Po finále sa ešte rozdajú špaky za starších. Prebytok sa nerozdeľuje — jeho držiteľ dostane toľko špakov, aký je
            prebytok. Potom sa odpočíta nepriznaná Cirhóza a vyhrá hráč s viac špakmi.
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
  dlh: "kliatby-exekutor",
  pecen: "cena-pitia",
  zavislost: "cena-abstak",
  priebeh: "kolo",
  lokalita: "ciel-a-senok",
  "starsi-bitka": "patronat",
  vyhodnotenie: "bitka-kroky",
  koniec: "bodovanie",
};
