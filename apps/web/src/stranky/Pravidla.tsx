// Vzdelávacia časť: pravidlá v2 po kapitolách (docs/naex_pravidla_v2_*.pdf)
// s ilustráciami kapitol a interaktívnymi ukážkami.

import { useEffect, useState, type ReactNode } from "react";
import type { Sada } from "@naex/tvorba";
import { IkonaAkcie } from "../karta/IkonaAkcie.tsx";
import { useTip } from "../karta/Tip.tsx";
import { Odkaz, useTitulok } from "../lib/router.tsx";
import { useSada } from "../lib/sada.tsx";
import { Nacitavanie } from "../komponenty.tsx";
import { UkazkaBitky, UkazkaLimitu, UkazkaSpajania, UkazkaStupnice } from "./Ukazky.tsx";

interface Kapitola {
  readonly id: string;
  readonly nazov: string;
  readonly obrazok?: string;
  readonly obsah: (sada: Sada) => ReactNode;
}

function Pojmy({ sada }: { readonly sada: Sada }) {
  const { tip, ukaz, skry } = useTip();
  const POJMY: readonly [string, string][] = [
    ["Akcia", "Symbol na strane karty."],
    ["Efekt", "Textové pole na karte."],
    ["Línia", "Celý rad kariet v kole; lokalita v strede ho delí na dve strany."],
    ["Strana", "Polovica línie od lokality — tvoja a súperova. Kartu vykladáš na koniec ktorejkoľvek z nich."],
    ["Partia", "Všetky tvoje karty v línii — tie natočené k tebe, nech ležia na ktorejkoľvek strane."],
    ["Vnútorná hrana", "Hrana karty v línii obrátená k lokalite; ňou sa karta páruje so susedom bližšie k stredu."],
    ["Vonkajšia hrana", "Hrana karty v línii odvrátená od lokality; ostáva voľná pre ďalšiu kartu."],
    ["Vypiť", "Otočiť plný poldeci na vypitý: zahráš ďalšiu kartu hneď, ale limit −1 a pečeň +1 (vyhodnotí sa v najbližšej Pitke)."],
    ["Šenok", "Ponuka kariet lícom nahor zo spoločného balíčka; vidia ju obaja hráči."],
    ["Poldeci", "Fyzický pohár. Plný poldeci umožňuje vyložiť kartu, vypitý nie."],
    ["Okolie", "Karty priložené k danej karte."],
    ["Susedstvo", "Dve karty susedia, ak sú priamo vedľa seba."],
    ["Podpora", "Karta je podporená, ak sú v jej okolí presne 2 karty."],
    ["Priazeň", "Výhoda od staršieho, ku ktorému je marker posunutý: sila 1 / 2 / 3 podľa zóny, účinok 2 × sila."],
    ["Priznanie", "Vyloženie kliatby mimo línie do vlastnej hracej oblasti — natrvalo z balíčka."],
    ["Náhrada", "Hráč nahradí kartu z množiny určenej efektom."],
    ["Kolo", "Cyklus Zhromaždení a Pitiek zakončený bitkou o lokalitu alebo o staršieho."],
    ["Útočník / Obranca", "Útočník prehral poslednú bitku: vyberá cieľ kola a berie zo šenku prvý; obranca vykladá prvý."],
    ["Fajčiť", "Vyfajčiť cigaretu = hneď si dobrať kartu. Na svojom ťahu v Zhromaždení aj v Pitke; ťah to neukončí."],
    ["Hracia oblasť", "Priestor mimo línie pre priznané karty a Nástroje v Dedičstve."],
    ["Tuhé / mäkké poškodenie", "Tuhé (Rana, Pecka, Petelica, Cirhóza) rozhoduje o víťazovi; mäkké (Povera) sa udeľuje do výšky súperovho priznaného dlhu."],
    ["Vzbura", "Odpor proti Odporu: obe karty vyhodnotia všetky inak neaktívne akcie ako aktívne."],
    ["Stokársky barter", "Počas Pitky: za 5 cigariet/cigaretiek nový plný poldeci."],
  ];
  return (
    <>
      <p>
        Pojmy, ktoré sa na kartách píšu <strong>tučne</strong> alebo <em>kurzívou</em>, majú presný význam. Prejdi myšou
        ponad pojem.
      </p>
      <div className="pojmy">
        {sada.klucoveSlova.map((k) => (
          <span
            key={k.slovo}
            className={`pojem ${k.tucne ? "pojem-tucny" : ""} ${k.kurziva ? "pojem-kurziva" : ""}`}
            tabIndex={0}
            onMouseEnter={(e) => ukaz(e.currentTarget, { nadpis: k.slovo, text: k.popis })}
            onMouseLeave={skry}
            onFocus={(e) => ukaz(e.currentTarget, { nadpis: k.slovo, text: k.popis })}
            onBlur={skry}
          >
            {k.slovo}
          </span>
        ))}
      </div>
      <dl className="slovnik">
        {POJMY.map(([p, v]) => (
          <div key={p}>
            <dt>{p}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      {tip}
    </>
  );
}

const KAPITOLY: readonly Kapitola[] = [
  {
    id: "koncept",
    nazov: "Koncept a cieľ hry",
    obrazok: "strana-01.jpg",
    obsah: () => (
      <>
        <p className="uvod">
          <strong>NA EX!</strong> je kompetitívna kartová hra pre dvoch hráčov zasadená do drsného, primitívneho dedinského
          prostredia. Hráči si budujú balíčky, bijú sa o lokality, desia starších a nastoľujú svoju dominanciu.
        </p>
        <p>Vyhráva hráč, ktorý získa najviac bodov — kontrolovaním lokalít, šikanovaním starších a tým, že neprehliada vlastné problémy.</p>
        <div className="karticky">
          <div className="karticka karticka-ok">
            <strong>Vyhráš</strong>, ak vydesíš aspoň polovicu starších v hre a udržíš ich do konca nasledujúceho kola.
          </div>
          <div className="karticka karticka-zle">
            <strong>Okamžite prehráš</strong>, ak nedokážeš čeliť exekúcii alebo tvoj balíček klesne pod 5 kariet.
          </div>
          <div className="karticka">
            Inak hra končí <strong>po poslednej bitke o lokalitu</strong> (5, 7 alebo 11 podľa dĺžky hry) a rozhodnú body.
          </div>
        </div>
        <p className="tlmene upozornenie">
          Hra je fikcia a zámerne zveličená karikatúra. Alkohol, fajčenie, hazard ani dlhy v skutočnom živote nikomu
          neodporúčame.
        </p>
      </>
    ),
  },
  { id: "pojmy", nazov: "Kľúčové pojmy", obsah: (s) => <Pojmy sada={s} /> },
  {
    id: "karty",
    nazov: "Komponenty a karty",
    obrazok: "strana-06.jpg",
    obsah: () => (
      <>
        <p>
          Hra obsahuje hráčske karty, karty lokalít, karty starších s ukazovateľmi, cigarety, poldeci (poháre do 50 ml)
          a počítadlo závislosti pre každého hráča.
        </p>
        <h3>Skladba karty</h3>
        <ul>
          <li><strong>Názov</strong> a <strong>ilustrácia</strong>.</li>
          <li><strong>Tagy</strong> — klasifikácia karty (Občan, Chlap, Lokalita…). Samy nemajú pravidlá, odkazujú na ne efekty.</li>
          <li><strong>Akcie po stranách</strong> — najviac 4 na každej strane. Každá má index 0 (hore) až 3 (dole).</li>
          <li><strong>Efekt</strong> — text, ktorý hovorí, čo karta robí a kedy (Nástup, Bitka, Pitka…).</li>
        </ul>
        <h3>Balíčky</h3>
        <p>
          Hráčsky balíček, spoločný doberací balíček (ťahá sa naslepo), <strong>šenok</strong> (ponuka lícom nahor),
          a balíčky Cirhózy, Dlhu a Abstinencie. Keď sa ti minie balíček, zamiešaš odhadzovací a pokračuješ.
        </p>
        <p>
          Každá karta existuje v <strong>niekoľkých variantoch</strong> — rovnaké akcie, iné pozície.{" "}
          <Odkaz href="/karty">Pozri si glosár kariet</Odkaz>.
        </p>
      </>
    ),
  },
  {
    id: "akcie",
    nazov: "Akcie",
    obrazok: "strana-08.jpg",
    obsah: (s) => (
      <>
        <p>Prehľad všetkých akcií, ktoré sa môžu objaviť na stranách kariet.</p>
        <ul className="legenda">
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
    id: "aktivacia",
    nazov: "Efekty a aktivácia akcií",
    obrazok: "strana-10.jpg",
    obsah: (s) => (
      <>
        <p>
          Karty v línii sa dotýkajú stranami: <strong>pravá strana karty sa páruje s ľavou stranou nasledujúcej</strong>.
          Akcia je aktívna, ak sa na spoji stretnú dve neprázdne akcie na <strong>rovnakom indexe</strong>. Každá aktívna
          akcia sa počíta samostatne.
        </p>
        <UkazkaSpajania sada={s} />
        <h3>Posilnenie, Odpor a Vzbura</h3>
        <ul>
          <li><strong>Posilnenie</strong> zdvojnásobí akúkoľvek prepojenú akciu — priaznivú aj nepriaznivú.</li>
          <li><strong>Odpor</strong> zruší prepojenú akciu.</li>
          <li>
            <strong>Odpor proti Odporu = Vzbura:</strong> obe karty vyhodnotia všetky svoje inak neaktívne akcie ako aktívne.
          </li>
          <li>Ak Posilnenie ovplyvní Odpor, neprepojené akcie aktivuje iba karta s Odporom.</li>
        </ul>
        <p>
          Efekty využívajú spúšťače (Furt, Nástup, Bitka, Pitka, Podpora…). Efekt karty pôsobí, kým je karta v línii —
          výnimkou sú prebudený starší a Nástroj v Dedičstve.
        </p>
      </>
    ),
  },
  {
    id: "poskodenie",
    nazov: "Poškodenie",
    obrazok: "strana-12.jpg",
    obsah: () => (
      <>
        <p>
          <strong>Tuhé</strong> poškodenie (Rana 1, Pecka 2, Petelica 3, Cirhóza) rozhoduje o víťazovi kola a znižuje ho Viera.{" "}
          <strong>Mäkké</strong> (Povera) sa udeľuje najviac do výšky súperovho priznaného dlhu. Pohoršenie poškodenie
          neudeľuje — iba posúva marker.
        </p>
        <ol>
          <li>Viera a Povery sa navzájom vyrušia 1 : 1 — tvoja Viera ruší súperove Povery a naopak.</li>
          <li>Zvyšné Povery udelia mäkké poškodenie, najviac do výšky súperovho priznaného dlhu.</li>
          <li>Zvyšná Viera zníži súperovo tuhé poškodenie (základ 1, upraviteľné priazňou). Pod 0 neklesne.</li>
        </ol>
        <UkazkaBitky />
      </>
    ),
  },
  {
    id: "poldeci",
    nazov: "Poldeci a NA EX",
    obrazok: "strana-14.jpg",
    obsah: () => (
      <>
        <p>
          Poldeci určujú, koľko kariet smieš vyložiť počas jedného Zhromaždenia. Limit sa počíta nanovo na začiatku každého
          Zhromaždenia. Ak je limit 0, okamžite prehrávaš bitku. Na začiatku každého kola sa ti{" "}
          <strong>jeden vypitý poldeci doleje sám</strong> — kto všetko minie, nezostane s limitom 1 do konca partie.
        </p>
        <UkazkaLimitu />
        <h3>NA EX</h3>
        <p>
          Iba vo fáze NA EX v Pitke, v základe raz za Pitku. Vyberieš kartu v línii s tagom <strong>Občan</strong> alebo{" "}
          <strong>Starešina</strong> — <strong>svoju aj súperovu</strong> — a položíš na ňu plný poldeci. Poldeci ostáva tvoj
          a vypije sa pri bitke; poškodenie pečene dostaneš ty.
        </p>
        <p className="zvyraznene">
          NA EX zdvojnásobí neaktívne akcie a zároveň zruší aktívne akcie karty. Akcie sa rátajú majiteľovi karty: na svojej
          si zdvojíš Petelicu alebo zrušíš vlastný Dlh či Pečeň, na súperovej mu zrušíš aktívne akcie — ale jeho neaktívne mu
          zdvojíš. Pred potvrdením ti hra ukáže náhľad bitky. Pamätaj: poldeci sa pri bitke vypije, takže
          v ďalšom kole ti chýba (na začiatku kola sa doleje len jeden vypitý). Hra ti pri NA EX ukáže, aký limit budeš mať
          v ďalšom kole. Na Liberála NA EX dať nemožno.
        </p>
        <h3>Odpoveď na NA EX</h3>
        <p>
          Keď súper dá NA EX, môžeš <strong>hneď vyložiť jednu kartu</strong> z ruky na koniec svojej alebo jeho strany —
          limit vykladania to nemíňa. Najlepšie tak, aby si spároval neaktívne akcie jeho karty: tým sa stanú aktívnymi
          a NA EX ich zruší. Keď potom NA EX dáš ty, súper má tiež jednu odpoveď.
        </p>
        <h3>Vypiť do dna</h3>
        <p>
          V Zhromaždení, keď si na ťahu, môžeš <strong>vypiť</strong> — otočíš plný poldeci na vypitý. Tvoje ďalšie
          vyloženie neukončí ťah: zahráš <strong>dve karty za sebou</strong> a súper medzitým nezareaguje. Zaplatíš za to
          limitom (hneď klesne o 1), pečeňou (+1) a ráta sa to ako nerest. Piť môžeš opakovane, kým máš plné poldeci.
        </p>
        <p>
          <strong>2 kusovky za poldeci:</strong> za 2 fyzické cigarety otočíš vypitý poldeci späť na plný.{" "}
          <strong>Stokársky barter:</strong> za 5 cigariet/cigaretiek dostaneš nový plný poldeci navyše.
        </p>
        <p className="zvyraznene">
          Plný poldeci je teraz hlavná mena kola: dáva limit vykladania, NA EX, pitie do dna aj kartu zo šenku. Jeden sa ti
          doleje sám na začiatku kola, ďalšie dolievaš cigaretami z Cigaretiek. Pri karte zo šenku aj pri Vypiť hra ukáže,
          aký limit ti ostane.
        </p>
      </>
    ),
  },
  {
    id: "vykladanie",
    nazov: "Vykladanie a priznanie",
    obrazok: "strana-16.jpg",
    obsah: () => (
      <>
        <p>
          Karty tvoria <strong>jednu súvislú líniu</strong> — vetvenie nie je povolené. Lokalita v strede ju delí na dve{" "}
          <strong>strany</strong>: tvoju a súperovu. Prvá karta sa spája s lokalitou, každá ďalšia musí vytvoriť aspoň jedno
          spojenie.
        </p>
        <p>
          Každú kartu môžeš vyložiť na koniec <strong>svojej aj súperovej strany</strong>. Karta je vždy natočená k tebe —
          pre súpera leží nohami hore, ty ju vidíš vzpriamenú.
        </p>
        <p className="zvyraznene">
          Karta sa páruje <strong>vnútornou hranou</strong> — tou, ktorá je obrátená k lokalite — so susedom bližšie k stredu
          (alebo s lokalitou). <strong>Vonkajšia hrana</strong> ostáva voľná pre ďalšiu kartu. Na tvojej strane je vnútorná
          tvoja pravá hrana, na súperovej tvoja ľavá. Pri lokalite hra ukazuje, ktorá jej hrana je obrátená k tebe a ktorá
          k súperovi, a keď kartu ťaháš na stôl, ešte pred pustením vidíš, s čím sa spojí a čo to zmení.
        </p>
        <p className="zvyraznene">
          Karta patrí tomu, ku komu je natočená — je v jeho <strong>partii</strong>. Tvoja partia sú všetky tvoje karty, nech
          ležia na ktorejkoľvek strane; ich akcie aj efekty sa rátajú tebe.
        </p>
        <p>
          Podstrčená karta sa so súperovými susedmi páruje normálne: aktivuje im akcie na spoji (tie dostane súper) a svoje
          akcie boduje pre teba. Pošli mu <strong>sabotéra</strong> — tvoj Odpor mu zruší akciu, ktorú potreboval, a zaberieš mu
          koniec strany. Akciu <strong>lokality</strong> na spoji dostane majiteľ karty, ktorá ju aktivuje — podstrčená karta pri
          lokalite si vezme jej súperovu stranu. Kočovník na súperovu stranu limit vykladania nemíňa.
        </p>
        <h3>Priznanie</h3>
        <p>
          Kliatbu môžeš namiesto do línie vyložiť do svojej hracej oblasti — je <strong>priznaná</strong>. Priznaný Dlh: hneď
          si doberieš kartu, ale ráta sa k prahu Exekútora. Priznaná Cirhóza sa dá liečiť alebo pochovať. Nepriznané kliatby
          uberajú body na konci hry. Nová kliatba ide do tvojho <strong>odhadzovacieho balíčka</strong> — do ruky príde, až
          keď si ju dobereš; Vízia ju pri ťahaní môže zahodiť.
        </p>
        <p className="zvyraznene">
          Priznaná kliatba je natrvalo mimo balíčka — priznávaním si balíček čistíš. Priznanie nemíňa limit vykladania ani
          neodovzdá ťah — priznáš všetko naraz a potom ešte vykladáš alebo pasuješ. Cirhózu sa oplatí priznať takmer vždy; pri Dlhu zváž Exekútora.
        </p>
      </>
    ),
  },
  {
    id: "dedicstvo",
    nazov: "Dedičstvo — Nástroje",
    obrazok: "strana-18.jpg",
    obsah: () => (
      <>
        <p>
          Nástroje sa nepočítajú do limitu vykladania a nedajú sa posilniť cez NA EX. <strong>Nástroj nesmie susediť s
          Nástrojom</strong> — náradie musí mať kto používať.
        </p>
        <p className="zvyraznene">
          Nástroj funguje len na strane, kde ho podporuje <strong>Občan alebo Starešina</strong>. Pri lokalite, karte
          staršieho alebo karte bez týchto tagov spoj nevznikne — neaktivuje sa nič, ani akcia Nástroja, ani akcia suseda.
        </p>
        <p>
          Namiesto do línie môžeš Nástroj vyložiť do hracej oblasti ako <strong>Dedičstvo</strong> — kým tam leží, platí jeho
          pasívny efekt. <strong>Vyloženie do Dedičstva stojí 2 cigarety.</strong> Efekt Dedičstva funguje ako malá priazeň
          (napr. Nealko: prah Cirhózy o 2 vyšší). Z Dedičstva ho môžeš neskôr zahrať do línie; efekt Dedičstva tým prestane platiť.
        </p>
      </>
    ),
  },
  {
    id: "starsi",
    nazov: "Starší",
    obrazok: "strana-20.jpg",
    obsah: () => (
      <>
        <p>
          Starší sú vážené osoby dediny (karty s tagom Starešina). Každý leží na scorecarde, ktorý dostane na začiatku
          hry náhodne. Scorecard určuje priazeň staršieho, nesie stupnicu strachu (sila priazne 3‑2‑1‑0‑0‑0‑1‑2‑3) a po stranách
          4 + 4 bodovacie podmienky. Podmienku aktivuje akcia karty staršieho, ktorá k nej prilieha — na ktorejkoľvek
          strane. Aktívna podmienka boduje <strong>obom hráčom</strong>.
        </p>
        <p className="zvyraznene">
          ♥ <strong>Priazeň</strong> má ten, ku komu je marker posunutý — výhoda počas hry. Starší sa vtedy bojí toho
          druhého, od ktorého je marker odtlačený. Strach o bodoch tohto staršieho nerozhoduje — ráta sa do podmienok{" "}
          <strong>Znepokojenie, Strach a Vydesenie</strong> na všetkých scorecardoch: keď posunieš marker k súperovi, dávaš mu
          priazeň teraz, ale tebe pribudne vystrašený starší.
        </p>
        <p>
          Priazeň je hlavná protiváha pre toho, kto prehráva — víťaz bitky mu prebytkom posúva markery na jeho polovicu.
          Sila je <strong>1 / 2 / 3</strong> podľa zóny (žltá, oranžová, červená) a každá priazeň pridáva{" "}
          <strong>2 × sila</strong>.
        </p>
        <p>
          V hre to vidíš pri každom staršom: riadok ♥ ukazuje, komu patrí priazeň a čo dáva, riadok ★ koľko bodov by scorecard
          dal tebe a súperovi, keby hra skončila teraz. Číslo pri každej aktívnej podmienke sú tvoje body z nej a tlačidlo{" "}
          „rozpis bodov" ukáže tabuľku všetkých podmienok.
        </p>
        <UkazkaStupnice />
        <h3>Priazne</h3>
        <table className="tabulka">
          <thead>
            <tr><th>Priazeň</th><th>Uplatňuje sa pri</th><th>Sila 1 / 2 / 3</th></tr>
          </thead>
          <tbody>
            <tr><td>Zberateľ</td><td>Limit ruky na konci kola</td><td>8 / 10 / 12</td></tr>
            <tr><td>Lakomec</td><td>Stokársky barter (cigariet)</td><td>4 / 3 / 2</td></tr>
            <tr><td>Neprajník</td><td>Povery nad súperove priznané Dlhy</td><td>+2 / +4 / +6</td></tr>
            <tr><td>Bitkár</td><td>Vyhodnotenie bitky</td><td>+2 / +4 / +6 tuhého poškodenia</td></tr>
            <tr><td>Veriaci</td><td>Hodnota Viery</td><td>3 / 5 / 7</td></tr>
            <tr><td>Fajčiar</td><td>Prvá Pitka bitky o lokalitu</td><td>+2 / +4 / +6 cigariet</td></tr>
            <tr><td>Alkoholik</td><td>Prah Cirhózy</td><td>5 / 7 / 9</td></tr>
            <tr><td>Exekútor</td><td>Prah Exekútora</td><td>14 / 18 / 22</td></tr>
          </tbody>
        </table>
        <p>
          <strong>Zamknutá pozícia:</strong> na krajnú pozíciu sa dostaneš len z predposlednej, kde marker bol už na začiatku
          kola — nie viacerými posunmi naraz ani Pohoršením. <strong>Prebudenie:</strong> keď vytlačíš marker na krajnú
          červenú, efekt staršieho začne pôsobiť pre teba (okrem Nástupu a Podpory).
        </p>
      </>
    ),
  },
  {
    id: "dlh",
    nazov: "Dlh a Exekútor",
    obrazok: "strana-24.jpg",
    obsah: () => (
      <>
        <p>
          Každá aktivovaná akcia <strong>Hazard</strong> vytvorí kartu Dlhu. Nepriznaný Dlh uberá na konci hry −1 bod;
          priznaný sa ráta k prahu Exekútora.
        </p>
        <ol>
          <li><strong>Robota:</strong> ešte pred kontrolou prahu odhodíš za každú aktívnu Robotu 1 priznaný Dlh.</li>
          <li>Ak priznané Dlhy dosiahnu prah (základ 10), musíš odovzdať Nástroj — inak okamžite prehrávaš.</li>
          <li>Ak Nástroj odovzdáš, polovica Dlhov zhorí (nadol). Kto exekúcii nečelí, spáli 1 priznaný Dlh.</li>
        </ol>
      </>
    ),
  },
  {
    id: "pecen",
    nazov: "Poškodenie pečene a Cirhóza",
    obrazok: "strana-26.jpg",
    obsah: () => (
      <>
        <p>
          K poškodeniu pečene prispieva každá akcia <strong>Pečeň</strong>, každé <strong>Poldecko</strong> a každé{" "}
          <strong>NA EX</strong>. Pečeň sa vyhodnocuje <strong>len počas Pitky</strong> — keď dosiahneš prah, hneď získaš kartu
          Cirhózy. Prah je <strong>3</strong> + priazeň Alkoholika. <strong>Po každej Pitke sa pečeň vynuluje</strong> — zvyšok
          pod prahom sa neprenáša. Pitie do dna v Zhromaždení pripíše +1 pečene dopredu do najbližšej Pitky.
        </p>
        <p>
          Podobne funguje <strong>zadĺženie</strong>: každá akcia <strong>Hazard</strong> v Pitke ho zvýši o 1, pri prahu{" "}
          <strong>1</strong> získaš kartu Dlhu — teda každý aktívny Hazard je Dlh — a po Pitke sa vynuluje. Dlhy, ktoré karta dáva priamo (napr. Liečba), idú rovno.
        </p>
        <p>Každá Cirhóza ti v bitke pridáva 1 tuhé poškodenie, akoby ti ho udelil súper. Viera ju znižuje.</p>
        <p>
          <strong>Liečba:</strong> spáľ priznanú Cirhózu a svojho Závislého z línie, získaj 1 Dlh a vyber si kartu zo šenku.{" "}
          <strong>Pohreb:</strong> spáľ priznanú Cirhózu a ľubovoľnú svoju kartu z línie.
        </p>
      </>
    ),
  },
  {
    id: "zavislost",
    nazov: "Závislosť a absťák",
    obrazok: "strana-28.jpg",
    obsah: () => (
      <>
        <p>
          Počítadlo závislosti sleduje neresti kola: fyzické cigarety, Cigaretky, poldeci cez NA EX, vypité poldeci (Vypiť) a
          akcie Poldecko.
        </p>
        <ul>
          <li>Menej nerestí než minulé kolo → <strong>Absťák</strong> rovno do hracej oblasti (priznaný).</li>
          <li>Viac → jeden Absťák odhoď späť. Rovnako → nič. Prvé kolo len nastaví základ.</li>
        </ul>
        <p>Každý Absťák ti v bitke zníži tuhé poškodenie o 1 — trasú sa ti ruky.</p>
      </>
    ),
  },
  {
    id: "priebeh",
    nazov: "Príprava a priebeh hry",
    obrazok: "strana-30.jpg",
    obsah: () => (
      <>
        <p>
          Zvoľte dĺžku hry — vyberte 5 lokalít (krátka hra), 7 (stredná) alebo 11 (dlhá). Rozmiestnite 8 starších, markery do stredu. Každý
          hráč zamieša svojich 10 štartovacích kariet (Pijan, Miňištrant, Milujúca manželka, Dievčina na vydaj) do
          doberacieho balíčka a dobere si <strong>5 kariet do ruky</strong>. K tomu 1 cigareta a 2 plné poldeci.
        </p>
        <p className="zvyraznene">
          Na začiatku každého ďalšieho kola si doplníš ruku na 5 kariet. Ďalšie karty získaš draftom zo šenku (za poldeci)
          a <strong>fajčením</strong>: aktívne Cigaretky ti v Pitke dajú cigarety, ktoré sa prenášajú z kola na kolo, a každá
          vyfajčená cigareta je karta hneď — na svojom ťahu v Zhromaždení aj v Pitke. Na konci kola smieš mať v ruke najviac{" "}
          <strong>6 kariet</strong> (+ priazeň Zberateľa) — nadbytok odhodíš do odhadzovacieho balíčka podľa svojho výberu.
        </p>
        <div className="priebeh">
          <span>Voľba cieľa</span>→<span>Draft</span>→<span>Zhromaždenie</span>→<span>Pitka</span>→<span>…</span>→<span>Bitka</span>
        </div>
        <p>
          Útočník (porazený z minulej bitky) vyberá cieľ kola. Vo fáze <strong>Zhromaždenie</strong> hráči striedavo vykladajú
          karty — začína obranca. Keď obaja odohrajú limit alebo pasujú, nasleduje <strong>Pitka</strong>. Keď nemáš
          inú možnosť (nič sa nedá vyložiť, v Pitke nemáš čo urobiť), hra za teba pasuje sama.
        </p>
      </>
    ),
  },
  {
    id: "lokalita",
    nazov: "Bitka o lokalitu",
    obrazok: "strana-32.jpg",
    obsah: () => (
      <>
        <p>
          Útočník vyberie lokalitu a natočí ju — lokalita leží medzi partiami a natočenie určuje, ktorá strana pripadne komu.
          Potom <strong>draft</strong> v dvoch krokoch.
        </p>
        <p>
          <strong>Stavba šenku:</strong> nevzaté karty zo starého šenku idú naspodok spoločného balíčka. Každý si zo
          spoločného balíčka vezme toľko kariet, koľko je nenahradených starších (na začiatku 8). Obaja naraz a tajne dajú
          jednu kartu <strong>do šenku</strong> a jednu <strong>naspodok</strong> balíčka, zvyšok si vymenia — a tak dokola,
          kým sa balíčky neminú.
        </p>
        <p>
          <strong>Branie:</strong> zo šenku sa berie striedavo, začína <strong>útočník</strong>, a každý vezme, koľko si môže
          dovoliť: <strong>1 kartu za cigaretu</strong>, alebo <strong>2 karty za plný poldeci</strong> (druhú hneď v tom istom
          ťahu; poldeci sa otočí na vypitý, takže v tomto kole vyložíš o kartu menej). Nič nie je zadarmo. Kto prestane, druhý
          berie ďalej sám.
        </p>
        <p className="zvyraznene">
          Počet Pitiek = počet <strong>aktivovaných akcií na karte lokality</strong>, aspoň 1. Keď sa pri lokalite aktivujú ďalšie
          akcie, Pitiek pribudne. V bitke o staršieho je vždy jedna.
        </p>
        <h3>Poradie Pitky</h3>
        <ol>
          <li>NA EX (súper smie hneď odpovedať jednou kartou)</li>
          <li>Hazard</li>
          <li>Poškodenie pečene a Cirhóza</li>
          <li>Obmedzenie</li>
          <li>Cigaretky — dostaneš fyzické cigarety (mínus súperove Obmedzenia)</li>
          <li>Ťahanie kariet z efektov (napr. Kostol); inak si karty doberáš fajčením</li>
          <li>Vízia — preosieje karty dobraté v tejto Pitke</li>
        </ol>
      </>
    ),
  },
  {
    id: "starsi-bitka",
    nazov: "Bitka o staršieho",
    obrazok: "strana-34.jpg",
    obsah: () => (
      <>
        <p>Prebieha ako bitka o lokalitu, ale:</p>
        <ul>
          <li>vždy práve na jednu pitku, bez draftu,</li>
          <li>dá sa vyvolať, len ak je marker aspoň v oranžovej zóne (Strach) a na ukazovateli leží pôvodný starší,</li>
          <li>v strede línie leží <strong>karta staršieho</strong> ako lokalita — útočník ju natočí a strany sa cez ňu spájajú.</li>
        </ul>
        <p>
          Víťaz si vezme kartu staršieho do balíčka a na jeho miesto položí vlastného Občana alebo Zviera; marker nastaví do
          sivej zóny. <em>Áno, aj koza smie zasadnúť do rady starších.</em> Náhrada hrá ďalej ako každý starší — marker,
          priazeň aj body. Pred bitkou ti hra ukáže, ako sa zmenia body oboch hráčov.
        </p>
      </>
    ),
  },
  {
    id: "vyhodnotenie",
    nazov: "Vyhodnotenie bitky",
    obrazok: "strana-36.jpg",
    obsah: () => (
      <ol className="kroky">
        <li><strong>Efekty bitky</strong> — Krčmárka, Dievčina na vydaj, Benzínka.</li>
        <li><strong>Exekútor</strong> — najprv Robota, potom kontrola prahu priznaných dlhov.</li>
        <li><strong>Pohoršenie</strong> — každé posunie marker staršieho o 1 k súperovi (nie dvakrát ten istý, nie na krajnú pozíciu).</li>
        <li><strong>Poškodenie</strong> — Viera a Povera sa vyrušia, tuhé znižuje Viera a Absťáky, mäkké po strop dlhu.</li>
        <li><strong>Výsledok</strong> — vyhráva vyššie TUHÉ (pri remíze útočník); prebytok rozdeľuje hráč s vyšším CELKOVÝM.</li>
        <li><strong>Cigarety za prebytok</strong> — hráč, proti ktorému sa prebytok rozdeľoval, dostane 1 cigaretu za každého staršieho, ktorého marker sa posunul (viac posunov toho istého = 1 cigareta).</li>
        <li><strong>Poldeci</strong> — poldeci z NA EX sa vypijú, Poldecko otočí vypitý späť na plný.</li>
        <li><strong>Veštica</strong> — porazený s Vešticou vymení kartu medzi doberacími balíčkami.</li>
        <li><strong>Liečba alebo Pohreb</strong> — s priznanou Cirhózou.</li>
        <li><strong>Limit ruky</strong> — nadbytok nad 6 (+ Zberateľ) odhodíš.</li>
        <li><strong>Návrat kariet</strong> — do odhadzovacieho balíčka hráča, ktorý ich zahral.</li>
      </ol>
    ),
  },
  {
    id: "koniec",
    nazov: "Koniec hry",
    obrazok: "strana-38.jpg",
    obsah: () => (
      <>
        <p>
          Hra sa končí okamžite, keď niekto nečelí exekúcii alebo mu balíček klesne pod 5 kariet (prehráva). Kto vydesí
          polovicu starších, vyhrá, ak ich udrží do konca nasledujúceho kola — súper má jedno kolo na odpoveď (napríklad
          vyhrať bitku o vydeseného staršieho a vrátiť ho do sivej). Hra ohlásenie ukáže obom.
        </p>
        <p>
          Inak po poslednej bitke o lokalitu sa bodujú scorecardy. Každá aktívna podmienka boduje{" "}
          <strong>obom hráčom</strong>, nech je marker staršieho kdekoľvek: za kusy — ovládnuté lokality (2), získaných
          starších (2), zvyšné cigarety (1 za každé 3), mínus za nepriznané Dlhy (−1) a Cirhózy (−2). Znepokojenie (1), Strach (2)
          a Vydesenie (3) dávajú body za každého staršieho v hre (aj toho na tomto scorecarde), ktorý sa ťa bojí aspoň na
          tú úroveň; pri jednom staršom sa ráta len najvyššia splnená. Príklad: Farár má aktívne Znepokojenie a Strach,
          jeden starší sa ťa bojí na úrovni 1, druhý na 2 a sám Farár na 3 — z Farára máš 1 + 2 + 2 = 5 bodov.
          Mimo scorecardov sa nič neboduje.
        </p>
        <div className="riadok-tlacidiel">
          <Odkaz href="/hra" className="tlacidlo tlacidlo-hlavne">Si pripravený? Hraj!</Odkaz>
          <Odkaz href="/karty" className="tlacidlo">Prezri si karty</Odkaz>
        </div>
      </>
    ),
  },
];

/** Kapitola z adresy (#id); neznáma alebo prázdna = prvá. */
function indexZAdresy(): number {
  const i = KAPITOLY.findIndex((k) => `#${k.id}` === location.hash);
  return i === -1 ? 0 : i;
}

// Každá kapitola je samostatná strana: veľká ilustrácia, text a obsah.
// Kratšia kapitola nevypĺňa zvyšok strany ďalšou — listuje sa ako v knihe.
export function Pravidla() {
  const { sada } = useSada();
  const [index, setIndex] = useState(indexZAdresy);
  const kapitola = KAPITOLY[index] ?? KAPITOLY[0]!;
  useTitulok(`Pravidlá — ${kapitola.nazov}`);

  useEffect(() => {
    const f = () => setIndex(indexZAdresy());
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);

  const otvor = (i: number): void => {
    const k = KAPITOLY[i];
    if (k === undefined) return;
    history.pushState(null, "", `#${k.id}`);
    setIndex(i);
    window.scrollTo({ top: 0 });
  };

  // Šípky listujú, kým sa nepíše do poľa.
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "ArrowRight") otvor(index + 1);
      if (e.key === "ArrowLeft") otvor(index - 1);
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  });

  if (sada === null) return <Nacitavanie />;

  const predosla = KAPITOLY[index - 1];
  const dalsia = KAPITOLY[index + 1];
  const klikObsah = (i: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    otvor(i);
  };

  return (
    <div className="pravidla">
      <nav className="pravidla-obsah" aria-label="Kapitoly">
        <h2>Pravidlá</h2>
        <ol>
          {KAPITOLY.map((k, i) => (
            <li key={k.id}>
              <a
                href={`#${k.id}`}
                className={i === index ? "aktivna" : undefined}
                aria-current={i === index ? "page" : undefined}
                onClick={klikObsah(i)}
              >
                {k.nazov}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="pravidla-strana">
        <article key={kapitola.id} className={`kapitola ${kapitola.obrazok === undefined ? "bez-obrazka" : ""}`}>
          {kapitola.obrazok !== undefined && (
            <img className="kapitola-obrazok" src={`/pravidla/${kapitola.obrazok}`} alt="" />
          )}
          <div className="kapitola-telo">
            <span className="kapitola-cislo">
              Kapitola {index + 1} / {KAPITOLY.length}
            </span>
            <h2>{kapitola.nazov}</h2>
            {kapitola.obsah(sada)}
          </div>
        </article>

        <nav className="listovanie" aria-label="Listovanie kapitol">
          {predosla !== undefined ? (
            <a href={`#${predosla.id}`} className="listovanie-spat" onClick={klikObsah(index - 1)}>
              <span className="listovanie-smer">← predošlá</span>
              {predosla.nazov}
            </a>
          ) : (
            <span />
          )}
          {dalsia !== undefined && (
            <a href={`#${dalsia.id}`} className="listovanie-dalej" onClick={klikObsah(index + 1)}>
              <span className="listovanie-smer">ďalšia →</span>
              {dalsia.nazov}
            </a>
          )}
        </nav>
      </div>
      {/* Ďalšia ilustrácia sa načíta vopred, listovanie je potom okamžité. */}
      {dalsia?.obrazok !== undefined && <link rel="prefetch" href={`/pravidla/${dalsia.obrazok}`} />}
    </div>
  );
}
