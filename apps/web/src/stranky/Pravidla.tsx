// Vzdelávacia časť: pravidlá v2 po kapitolách (docs/naex_pravidla_v2_*.pdf)
// s ilustráciami kapitol a interaktívnymi ukážkami.

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Sada } from "@naex/tvorba";
import { IkonaAkcie } from "../karta/IkonaAkcie.tsx";
import { Odkaz, useTitulok } from "../lib/router.tsx";
import { useSada } from "../lib/sada.tsx";
import { UkazkaBitky, UkazkaLimitu, UkazkaSpajania, UkazkaStupnice } from "./Ukazky.tsx";

interface Kapitola {
  readonly id: string;
  readonly nazov: string;
  /** Kratší názov do obsahu vľavo, keď sa celý nezmestí na riadok. */
  readonly kratky?: string;
  readonly obrazok?: string;
  readonly obsah: (sada: Sada) => ReactNode;
}

/** Slovník pravidiel po témach (Michal 2026-10-19: pojmy musia mať jasný poriadok). */
const SLOVNIK: readonly { readonly tema: string; readonly popis: string; readonly pojmy: readonly (readonly [string, string])[] }[] = [
  {
    tema: "Stôl a línia",
    popis: "Kde karty ležia a s čím sa párujú.",
    pojmy: [
      ["Línia", "Celý rad kariet v kole; lokalita v strede ho delí na dve strany."],
      ["Strana", "Polovica línie od lokality — tvoja a súperova. Kartu vykladáš na koniec ktorejkoľvek z nich."],
      ["Kraj", "Meno polovice línie podľa hrany lokality — každá lokalita má vlastné (Krčma: pri výčape a pri dverách)."],
      [
        "Prevaha",
        "V kraji ju má, kto tam má viac svojich Občanov, Zvierat a Starešinov (Nástroje ani Cirhóza sa nerátajú); pri rovnosti hráč, ktorého karta v tom kraji leží hneď pri lokalite (vyložená ako prvá). Hráč s prevahou dostane akcie hrany lokality v tom kraji.",
      ],
      ["Partia", "Všetky tvoje karty v línii — tie natočené k tebe, nech ležia na ktorejkoľvek strane."],
      ["Vnútorná hrana", "Hrana karty obrátená k lokalite; ňou sa karta páruje so susedom bližšie k stredu."],
      ["Vonkajšia hrana", "Hrana karty odvrátená od lokality; ostáva voľná pre ďalšiu kartu."],
      ["Susedstvo", "Dve karty susedia, ak sú v línii priamo vedľa seba."],
      ["Okolie", "Karty priložené k danej karte (jej susedia, aj lokalita v strede)."],
      ["Akcia", "Symbol na strane karty. Aktívna je, keď sa na spoji stretne s akciou suseda."],
      ["Efekt", "Textové pole karty — čo karta robí navyše."],
      ["Vzbura", "Odpor proti Odporu: obe karty vyhodnotia všetky inak neaktívne akcie ako aktívne."],
      ["Hracia oblasť", "Priestor mimo línie pre priznané kliatby a Nástroje v Dedičstve."],
    ],
  },
  {
    tema: "Kolo a ťahy",
    popis: "Kto čo robí a kedy.",
    pojmy: [
      ["Kolo", "Voľba cieľa, draft (šenok a patronát), potom Zhromaždenie a Pitka (1 až 4-krát podľa lokality) a nakoniec bitka o lokalitu."],
      ["Patronát", "Komu starší prejavuje priazeň, smie si ho po šenku vziať do ruky; kto potom vyhrá bitku, staršieho si nechá."],
      ["Útočník / Obranca", "Útočník prehral poslednú bitku: berie zo šenku prvý a vykladá prvý. Obranca vyberá a natáča cieľ kola."],
      ["Šenok", "Ponuka kariet lícom nahor, ktorú hráči postavia v drafte; vidia ju obaja."],
      ["Vypiť", "Otočiť plný poldeci na vypitý: v Zhromaždení tak zaplatíš každú ďalšiu kartu v tom istom ťahu — limit −1, pečeň +1 (vyhodnotí sa v najbližšej Pitke), ráta sa ako nerest."],
      ["Fajčiť", "Vyfajčiť cigaretu = hneď si dobrať kartu. Na svojom ťahu v Zhromaždení aj v Pitke; ťah to neukončí. Keď nemáš z čoho ťahať (prázdny doberací aj odhadzovací balíček), fajčiť sa nedá."],
      ["Stokársky barter", "Počas Pitky: za 5 cigariet nový plný poldeci (s priazňou Lakomca menej)."],
      ["Doliatie", "Počas Pitky: za 2 cigarety otočíš vypitý poldeci späť na plný (nie s Vínkom v Dedičstve)."],
      ["Náhrada", "Hráč nahradí kartu z množiny určenej efektom."],
    ],
  },
  {
    tema: "Zdroje, kliatby a body",
    popis: "Čo hráč má, čoho sa zbavuje a za čo boduje.",
    pojmy: [
      ["Poldeci", "Pohárik pálenky. Každý plný poldeci zvyšuje limit vykladania o 1, vypitý nie."],
      ["Cigareta", "Mena hry: platí šenok, Dedičstvo, doliatie a barter; vyfajčená cigareta = karta hneď. Na konci hry bod za každé 3."],
      ["Priznanie", "Vyloženie kliatby mimo línie do vlastnej hracej oblasti — natrvalo z balíčka; za priznanú kliatbu (okrem Cirhózy) si hneď dobereš kartu. Dlh sa prizná sám, keď si ho dobereš."],
      ["Tuhé / mäkké poškodenie", "Tuhé (Rana, Pecka, Petelica, Cirhóza) rozhoduje o víťazovi; mäkké (Povera) sa udeľuje do výšky súperovho priznaného dlhu."],
      ["Priazeň", "Výhoda od staršieho, ku ktorému je marker posunutý: sila 1 / 2 / 3 podľa zóny, účinok 2 × sila."],
    ],
  },
];

function Pojmy({ sada }: { readonly sada: Sada }) {
  const spustace = sada.klucoveSlova.filter((k) => k.tucne);
  const slovesa = sada.klucoveSlova.filter((k) => !k.tucne);
  return (
    <div className="pojmy-kapitola">
      <p className="uvod">
        Na kartách sú dva druhy slov s presným významom: <strong>tučné</strong> hovoria, <strong>kedy</strong> efekt platí,
        a <em>kurzívou</em> písané, <strong>čo</strong> efekt robí. Pod nimi je slovník pravidiel podľa tém.
      </p>

      <section className="pojmy-skupina">
        <header>
          <h3>Kedy efekt platí</h3>
          <span>tučné slovo na začiatku efektu karty</span>
        </header>
        <div className="pojmy-mriezka">
          {spustace.map((k) => (
            <div key={k.slovo} className="pojem-karta spustac">
              <strong>{k.slovo}</strong>
              <span>{k.popis}</span>
            </div>
          ))}
        </div>
      </section>

      {slovesa.length > 0 && (
        <section className="pojmy-skupina">
          <header>
            <h3>Čo efekt robí</h3>
            <span>slovo kurzívou v texte efektu</span>
          </header>
          <div className="pojmy-mriezka">
            {slovesa.map((k) => (
              <div key={k.slovo} className="pojem-karta sloveso">
                <em>{k.slovo}</em>
                <span>{k.popis}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {SLOVNIK.map((t) => (
        <section key={t.tema} className="pojmy-skupina">
          <header>
            <h3>{t.tema}</h3>
            <span>{t.popis}</span>
          </header>
          <dl className="pojmy-mriezka">
            {t.pojmy.map(([pojem, vyznam]) => (
              <div key={pojem} className="pojem-karta">
                <dt>{pojem}</dt>
                <dd>{vyznam}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
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
          Efekty využívajú spúšťače (Furt, Nástup, Bitka, Pitka…). Efekt karty pôsobí, kým je karta v línii —
          výnimkou sú prebudený starší a Nástroj, ktorého efekt platí <strong>len v Dedičstve</strong>.
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
          Poldeci určujú, koľko kariet smieš vyložiť počas jedného Zhromaždenia. Na začiatku hry máš <strong>2 plné poldeci</strong>.
          Limit sa počíta nanovo na začiatku každého Zhromaždenia. Ak je limit 0, okamžite prehrávaš bitku. Na začiatku
          každého kola sa ti <strong>jeden vypitý poldeci doleje sám</strong> — kto všetko minie, nezostane s limitom 1 do konca partie.
        </p>
        <UkazkaLimitu />
        <h3>NA EX</h3>
        <p>
          Iba vo fáze NA EX v Pitke, v základe raz za Pitku. Vyberieš kartu v línii s tagom <strong>Občan</strong> alebo{" "}
          <strong>Starešina</strong> — <strong>svoju aj súperovu</strong> — a položíš na ňu plný poldeci. Poldeci ostáva tvoj
          a vypije sa pri bitke; poškodenie pečene dostaneš ty. Do limitu vykladania sa už neráta — NA EX ti limit zníži o 1.
        </p>
        <p className="zvyraznene">
          NA EX zdvojnásobí neaktívne akcie a zároveň zruší aktívne akcie karty. Akcie sa rátajú majiteľovi karty: na svojej
          si zdvojíš Petelicu alebo zrušíš vlastný Dlh či Pečeň, na súperovej mu zrušíš aktívne akcie — ale jeho neaktívne mu
          zdvojíš. Násobky sa násobia: NA EX na kartu vedľa Silnej ženy dá ×4 (aj Dlhu a Poškodeniu pečene) a NA EX leží na karte do
          bitky, takže sa vyhodnotí v každej Pitke kola. Pred potvrdením ti hra ukáže náhľad: bitku pred a po, zmeny oboch
          hráčov a koľko Cirhóz a Dlhov z toho bude a za koľko bodov. NA EX môže zmeniť aj počet Pitiek. Pamätaj: poldeci sa pri bitke vypije, takže
          v ďalšom kole ti chýba (na začiatku kola sa doleje len jeden vypitý). Hra ti pri NA EX ukáže, aký limit budeš mať
          v ďalšom kole. Na Liberála NA EX dať nemožno, ani na kartu, na ktorej už poldeci leží. NA EX na kartu pri lokalite
          mení len akcie tej karty — akcie hrany lokality ostávajú. Veterán je výnimka: NA EX mu aktívne akcie nezruší, ale zdvojí, a neaktívne nechá tak. Dievčina na vydaj ráta aj akcie, ktoré jej zdvojilo NA EX, a jej
          akcie v bitke, v ktorej sa zahodí, ešte platia.
        </p>
        <h3>Odpoveď na NA EX</h3>
        <p>
          Keď súper dá NA EX, môžeš <strong>hneď vyložiť jednu kartu</strong> z ruky na koniec svojej alebo jeho strany —
          limit vykladania to nemíňa. Najlepšie tak, aby si spároval neaktívne akcie jeho karty: tým sa stanú aktívnymi
          a NA EX ich zruší. Keď potom NA EX dáš ty, súper má tiež jednu odpoveď. Odpoveď je bežné vyloženie — smie zmeniť
          prevahu v kraji aj počet Pitiek.
        </p>
        <h3>Viac kariet v jednom ťahu (Vypiť)</h3>
        <p>
          V Zhromaždení môžeš na svojom ťahu vyložiť aj viac kariet. Prvá je zadarmo, <strong>každá ďalšia ťa stojí plný
          poldeci</strong> — vypiješ ho: limit vykladania hneď klesne o 1, pečeň +1 (vyhodnotí sa v najbližšej Pitke) a ráta sa
          to ako nerest. Dve karty za sebou teda potrebujú limit aspoň 3. Súper medzitým nezareaguje. Poradie je{" "}
          <strong>Vypiť, karta, karta</strong> — bez vypitia prvá karta ťah ukončí.
        </p>
        <p className="zvyraznene">
          V hre kartu potiahneš na stôl — je to len návrh. Ďalšia karta v tom istom ťahu dostane výrazný štítok{" "}
          <strong>−1 poldeci</strong> a pokyn ukáže, koľko ťa ťah stojí. Kartu v návrhu vymeníš tak, že na ňu položíš inú, alebo
          ju vrátiš do ruky. Server dostane celý ťah až po <strong>„hotovo“</strong> — vykoná sa celý, alebo vôbec.
        </p>
        <p>
          <strong>Doliatie:</strong> počas Pitky za 2 cigarety otočíš vypitý poldeci späť na plný (Vínko v Dedičstve to
          zakazuje). <strong>Stokársky barter:</strong> za 5 cigariet dostaneš nový plný poldeci navyše.
        </p>
        <p className="zvyraznene">
          Plný poldeci je mena kola: dáva limit vykladania, NA EX a ďalšie karty v ťahu. Jeden sa ti doleje sám na začiatku
          kola, ďalšie dolievaš cigaretami. Šenok sa poldeci neplatí — len cigaretami.
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
          koniec strany. Akcie hrany <strong>lokality</strong> dostane hráč s <strong>prevahou</strong> v tej polovici línie —
          kto tam má viac svojich <strong>Občanov, Zvierat a Starešinov</strong> (Nástroje a Cirhóza sa nerátajú; pri rovnosti hráč, ktorého karta
          v tom kraji leží hneď pri lokalite — vyložená ako prvá). Polovice línie sa volajú
          podľa lokality — <strong>kraje</strong>, napr. v Krčme „pri výčape“ a „pri dverách“. Rovnako akcie <strong>Nástroja</strong> dostane majiteľ karty, s ktorou Nástroj
          tvorí spoj.
        </p>
        <h3>Priznanie</h3>
        <p>
          Kliatbu (Dlh, Cirhóza, Milujúca manželka…) môžeš namiesto do línie vyložiť do svojej hracej oblasti — je{" "}
          <strong>priznaná</strong>. <strong>Za každú priznanú kliatbu si hneď doberieš kartu</strong> (aj za Absťák, ktorý
          prichádza rovno priznaný; za Cirhózu nie). Priznaný Dlh sa ráta k prahu Exekútora, priznaná Cirhóza sa dá liečiť alebo
          pochovať. Nový <strong>Dlh sa hneď prizná</strong> sám a na konci hry uberá body aj priznaný. Nová{" "}
          <strong>Cirhóza ide navrch tvojho doberacieho balíčka</strong> — do ruky príde pri najbližšom ťahaní. Nepriznaná Cirhóza
          uberá body na konci hry.
        </p>
        <p className="zvyraznene">
          Priznaná kliatba je natrvalo mimo balíčka — priznávaním si balíček čistíš a dopĺňaš ruku. Priznanie nemíňa limit
          vykladania ani neodovzdá ťah — priznáš všetko naraz a potom ešte vykladáš alebo pasuješ. Dlhy sa priznávajú samy hneď pri
          dobratí; Cirhózu priznáš, keď chceš, ale kartu za ňu nedobereš.
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
        <p className="zvyraznene">
          Akcie Nástroja v línii dostane <strong>majiteľ karty, s ktorou Nástroj tvorí spoj</strong> — nie ten, kto Nástroj
          vyložil. Podstrčený Nástroj teda pracuje pre súpera a súperov Nástroj vedľa tvojho Občana pre teba. Leží medzi dvoma
          kartami rôznych hráčov? Každý dostane akcie svojho spoja. Efekt Nástroja v línii neplatí.
        </p>
        <p>
          Namiesto do línie môžeš Nástroj vyložiť do hracej oblasti ako <strong>Dedičstvo</strong> — kým tam leží, platí jeho
          pasívny efekt (napr. Nealko: prah Cirhózy o 2 vyšší). <strong>Dedičstvo stojí cigarety a cena rastie pre oboch
          hráčov spolu:</strong> prvý Nástroj v hre stojí 1 cigaretu, druhý 2, tretí 3 a tak ďalej — kto je rýchlejší, platí
          menej. Hra ti ukazuje aktuálnu cenu. Vyloženie do Dedičstva limit vykladania nemíňa, ale v striedaní je to ťah.
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
          Sila je <strong>1 / 2 / 3</strong> podľa zóny (žltá, oranžová, červená) a väčšina priazní pridáva{" "}
          <strong>2 × sila</strong> (Fajčiar, Lakomec, Úžerník a Veriaci len silu).
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
            <tr><td>Úžerník</td><td>Prah Dlhu (2 + sila)</td><td>3 / 4 / 5</td></tr>
            <tr><td>Lakomec</td><td>Stokársky barter (cigariet)</td><td>4 / 3 / 2</td></tr>
            <tr><td>Neprajník</td><td>Povery nad súperove priznané Dlhy</td><td>+2 / +4 / +6</td></tr>
            <tr><td>Bitkár</td><td>Vyhodnotenie bitky</td><td>+2 / +4 / +6 tuhého poškodenia</td></tr>
            <tr><td>Veriaci</td><td>Viera navyše v bitke</td><td>+1 / +2 / +3</td></tr>
            <tr><td>Fajčiar</td><td>Prvá Pitka bitky o lokalitu</td><td>+1 / +2 / +3 cigarety</td></tr>
            <tr><td>Alkoholik</td><td>Prah Cirhózy</td><td>5 / 7 / 9</td></tr>
            <tr><td>Exekútor</td><td>Prah Exekútora</td><td>14 / 18 / 22</td></tr>
          </tbody>
        </table>
        <p>
          <strong>Zamknutá pozícia:</strong> na krajnú pozíciu sa dostaneš len z predposlednej, kde marker bol už na začiatku
          kola — nie viacerými posunmi naraz ani Pohoršením. Z krajnej pozície marker uvoľní len patronát. <strong>Prebudenie:</strong> keď vytlačíš marker na krajnú
          červenú, efekt staršieho začne pôsobiť pre teba (okrem Nástupu).
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
          Akcie <strong>Dlh</strong> v Pitke plnia zadĺženie a za každý celý prah vznikne karta Dlh — <strong>hneď priznaná</strong>,
          kartu za ňu nedoberáš. Každý tvoj Dlh, aj priznaný, uberá na konci hry −1 bod za každú aktívnu podmienku „bankovky“;
          priznaný sa ráta aj k prahu Exekútora. Hra ti cenu Dlhu ukáže vopred (doska, náhľad NA EX). Dlh, ktorý ti súper
          podstrčí do balíčka (Vychovávateľka), sa pri dobratí prizná sám a ťaháš ďalšiu kartu.
        </p>
        <ol>
          <li><strong>Robota:</strong> ešte pred kontrolou prahu spáliš za každú aktívnu Robotu 1 priznaný Dlh.</li>
          <li>Ak priznané Dlhy dosiahnu prah (základ 10), musíš odovzdať Nástroj — inak okamžite prehrávaš.</li>
          <li>Ak Nástroj odovzdáš, polovica Dlhov zhorí (nadol). Inak sa Dlh sám nepáli — pália ho len Robota, Dievčina na vydaj, Niekoho stryná a Veľmi smútiaca vdova.</li>
        </ol>
      </>
    ),
  },
  {
    id: "pecen",
    nazov: "Poškodenie pečene a Cirhóza",
    kratky: "Pečeň a Cirhóza",
    obrazok: "strana-26.jpg",
    obsah: () => (
      <>
        <p>
          K poškodeniu pečene prispieva každá akcia <strong>Poškodenie pečene</strong>, každá akcia <strong>Poldeci</strong> a
          každé <strong>NA EX</strong>. Pečeň sa vyhodnocuje <strong>len počas Pitky</strong> — za každý celý prah získaš kartu
          Cirhózy (ide navrch tvojho doberacieho balíčka). Prah je <strong>3</strong> + priazeň Alkoholika. Doska ti ukazuje,
          koľko pečene pripíšu karty na stole a či z toho bude Cirhóza („po Pitke“). <strong>Po každej Pitke sa pečeň vynuluje</strong> — zvyšok
          pod prahom sa neprenáša. Poldeci vypitý v Zhromaždení (ďalšia karta v ťahu) pripíše +1 pečene dopredu do najbližšej Pitky.
        </p>
        <p>
          Podobne funguje <strong>zadĺženie</strong>: každá akcia <strong>Dlh</strong> v Pitke ho zvýši o 1, pri prahu{" "}
          <strong>2</strong> + sila Úžerníka získaš kartu Dlh — teda dve akcie Dlh v jednej Pitke sú karta Dlh — a po Pitke sa vynuluje. Dlhy, ktoré karta dáva priamo (napr. Poštárka), idú rovno.
          Viac Pitiek v bitke znamená viac pečene aj Dlhov.
        </p>
        <p>Každá tvoja <strong>priznaná</strong> Cirhóza ti v bitke pridáva 1 tuhé poškodenie, akoby ti ho udelil súper. Viera ju znižuje. Nepriznaná uberá na konci hry −2 za každú aktívnu podmienku „pečeň“ — skutočnú cenu určuje rozdanie scorecardov.</p>
        <p>
          <strong>Pohreb:</strong> spáľ priznanú Cirhózu a ľubovoľnú svoju kartu z línie. Keď je spálená karta Závislý, smieš si
          vziať jednu kartu zo šenku.
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
          Počítadlo závislosti sleduje neresti kola. Nerest je: každý poldeci vypitý v Zhromaždení (ďalšia karta v ťahu),
          NA EX (poldeci sa vypije v bitke), každá vyfajčená cigareta, doliatie poldeci (2 cigarety) a stokársky barter (za
          každú cigaretu). Platba za šenok, Dedičstvo a Starostu sa nepočíta.
        </p>
        <ul>
          <li>Na konci kola, po bitke, sa neresti porovnajú s minulým kolom.</li>
          <li>Menej nerestí → <strong>Absťák</strong> rovno do hracej oblasti (priznaný) — za priznanie si dobereš kartu.</li>
          <li>Viac → jeden Absťák odíde. Rovnako → nič. Prvé kolo len nastaví základ.</li>
          <li>
            <strong>Milujúca manželka</strong> (kým je odhalená — v línii alebo priznaná): Absťák dostaneš aj pri rovnakom
            počte nerestí. Manželky sa sčítavajú — pri dvoch aj pri o 1 viac nerestiach.
          </li>
        </ul>
        <p>
          Každý Absťák ti v bitke zníži tuhé poškodenie o 1 — trasú sa ti ruky. Zbavíš sa ho aj NA EX na Lesnej ceste;
          Autobusár jeden ignoruje. Na doske hráča vidíš neresti kola, čiaru minulého kola a čo sa stane na jeho konci.
        </p>
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
          hráč zamieša svojich 7 štartovacích kariet (3 Pijani, 2 Miňištranti, Milujúca manželka, Dievčina na vydaj) do
          doberacieho balíčka a dobere si <strong>5 kariet do ruky</strong>. K tomu <strong>3 cigarety a 2 plné poldeci</strong>.
        </p>
        <p className="zvyraznene">
          <strong>Po každej bitke si dobereš 2 karty.</strong> Limit ruky nie je — kariet môžeš mať, koľko chceš, ale získať ich
          je drahé: draft zo šenku (za cigarety), <strong>fajčenie</strong> (cigareta = karta hneď, na svojom ťahu v Zhromaždení aj
          v Pitke), priznanie kliatby, Vízia a efekty kariet. Akcie Cigareta ti v Pitke dajú cigarety, ktoré sa prenášajú z kola na kolo.
        </p>
        <div className="priebeh">
          <span>Voľba cieľa</span>→<span>Draft</span>→<span>Patronát</span>→<span>Zhromaždenie</span>→<span>Pitka</span>→<span>…</span>→<span>Bitka</span>
        </div>
        <p>
          Cieľ kola vyberá a natáča obranca (víťaz poslednej bitky); útočník (porazený) berie zo šenku prvý. Vo fáze <strong>Zhromaždenie</strong> hráči striedavo vykladajú
          karty — začína útočník; na ťahu môžeš vyložiť aj viac kariet, každú ďalšiu za plný poldeci. Keď obaja odohrajú limit
          alebo pasujú, nasleduje <strong>Pitka</strong>. Kto <strong>pasuje</strong>, do Pitky už nevykladá — súper vykladá sám — a dostane
          <strong>cigaretu za každú kartu</strong>, ktorú ešte smel vyložiť. Ak má bitka ďalšiu Pitku, pred ňou je znova Zhromaždenie. Keď nemáš
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
          Obranca vyberie lokalitu a natočí ju — lokalita leží v strede línie a natočenie určuje, ktoré jej akcie sú obrátené ku
          ktorému kraju (dostane ich hráč s prevahou v kraji — viac svojich Občanov, Zvierat a Starešinov).
          Potom <strong>draft</strong> v dvoch krokoch.
        </p>
        <p>
          <strong>Stavba šenku:</strong> nevzaté karty zo starého šenku idú naspodok spoločného balíčka. Každý si zo
          spoločného balíčka vezme toľko kariet, koľko je nenahradených starších (na začiatku 8). Obaja naraz a tajne dajú{" "}
          <strong>polovicu do šenku</strong> a <strong>polovicu naspodok</strong> balíčka — nič si nepodávate (pri 8 kartách 4 + 4,
          šenok má potom 8 kariet).
        </p>
        <p>
          <strong>Branie:</strong> zo šenku sa berie striedavo, začína <strong>útočník</strong>. Na ťahu vezmeš{" "}
          <strong>1 kartu za 1 cigaretu</strong>, alebo <strong>2 karty za 3 cigarety</strong>. Poldeci sa v šenku neplatí. Beriete,
          kým obaja neprestanete; kto nemá cigaretu, prestane sám, a kto prestane, druhému ostáva už len jedna posledná šanca (jeden ťah).
        </p>
        <p className="zvyraznene">
          <strong>Koľko Pitiek:</strong> 1 + menší z počtov aktivovaných akcií lokality na jej dvoch stranách. Akciu lokality
          aktivuje karta, ktorá s ňou tvorí spoj; Odpor na hrane lokality sa ráta, akcia hrany zrušená Odporom karty nie. Ak tvoja
          karta aktivuje 3 akcie lokality a súperova 1, pijú sa{" "}
          <strong>2 Pitky</strong>; ak niekto pri lokalite nič neaktivuje, len 1. Pred každou Pitkou je Zhromaždenie (limit sa
          ráta nanovo). Počet sa počas kola mení s líniou — začatá Pitka sa vždy dopije.
        </p>
        <h3>Poradie Pitky</h3>
        <p>
          <strong>Začína obranca.</strong> Keď dá „hotovo“ (nedá sa vrátiť), hrá útočník a má <strong>posledné slovo</strong> — na
          jeho NA EX už obranca odpovie len jednou kartou. Po „hotovo“ oboch sa Pitka vyhodnotí:
        </p>
        <ol>
          <li>NA EX (súper smie hneď odpovedať jednou kartou)</li>
          <li>Dlh — za každý celý prah zadĺženia karta Dlh (hneď priznaná)</li>
          <li>Poškodenie pečene a Cirhóza — za každý celý prah Cirhóza</li>
          <li>Obmedzenie</li>
          <li>Cigarety — za akcie Cigareta dostaneš cigarety (mínus súperove Obmedzenia)</li>
          <li>Pitka sama karty nedáva — doberáš si ich fajčením, priznaním kliatby, Poštárkou a Víziou</li>
          <li>
            Vízia — za každú aktívnu Víziu sa pozrieš na vrchnú kartu svojho doberacieho balíčka a rozhodneš: vezmeš si ju do
            ruky, alebo ju <strong>zahodíš</strong> (navždy z hry — kliatba či slabá karta). Pozor, balíček pod 5 kariet = prehra.
          </li>
        </ol>
        <h3>Lokality a ich efekty</h3>
        <p>Efekt lokality platí v kole, keď sa o ňu bije (Michal 2026-10-20).</p>
        <table className="tabulka">
          <thead>
            <tr><th>Lokalita</th><th>Kedy</th><th>Efekt</th></tr>
          </thead>
          <tbody>
            <tr><td>Krčma</td><td>Pitka</td><td>Kto má plný poldeci a kam ho dať, musí dať NA EX. Prah Cirhózy je tu obom o 2 vyšší.</td></tr>
            <tr><td>Kostol</td><td>Zhromaždenie, Pitka</td><td>Nikto nesmie vypiť (v ťahu len jedna karta) ani dať NA EX.</td></tr>
            <tr><td>Benzínka</td><td>Zhromaždenie, Pitka</td><td>Nikto nesmie fajčiť.</td></tr>
            <tr><td>Zastávka</td><td>Zhromaždenie</td><td>Spoločný limit vykladania pre oboch = súčet vašich limitov. Pas dá cigarety len za tvoj vlastný zvyšok limitu.</td></tr>
            <tr><td>Lesná cesta</td><td>Bitka</td><td>+1 tuhé za každého tvojho Občana, Zviera či Starešinu v súperovom kraji, najviac +2.</td></tr>
            <tr><td>Ihrisko</td><td>Bitka</td><td>V každom kraji +2 tuhé tomu, kto tam má viac svojich Občanov, Zvierat a Starešinov — spolu až +4.</td></tr>
            <tr><td>Zberný dvor</td><td>Pitka</td><td>Raz za Pitku za cigaretu karta z tvojho odhadzovacieho balíčka do ruky.</td></tr>
            <tr><td>Most</td><td>Zhromaždenie, Pitka</td><td>Karty len na vlastnú stranu, aj odpoveď na NA EX.</td></tr>
            <tr><td>Cintorín</td><td>Prehra</td><td>Porazený smie dať Nástroj z ruky do Dedičstva zadarmo (cena Dedičstva aj tak stúpne).</td></tr>
            <tr><td>Obecný úrad</td><td>Bitka</td><td>Prah Exekútora −4; Robota spáli 2 priznané Dlhy.</td></tr>
            <tr><td>Jednota</td><td>Pitka</td><td>Nový poldeci (barter) o 1 cigaretu lacnejší.</td></tr>
            <tr><td>Kultúrny dom</td><td>Bitka</td><td>Pohoršenie nemá limit dvoch hraníc zón (na krajnú pozíciu stále nie).</td></tr>
            <tr><td>Vínna pivnica</td><td>Pitka</td><td>NA EX až dvakrát za Pitku.</td></tr>
            <tr><td>Družstvo</td><td>Zhromaždenie</td><td>Pracujúci nemíňajú limit vykladania.</td></tr>
          </tbody>
        </table>
      </>
    ),
  },
  {
    id: "starsi-bitka",
    nazov: "Patronát",
    obrazok: "strana-34.jpg",
    obsah: () => (
      <>
        <p>
          O staršieho sa nebojuje samostatnou bitkou — starší príde na pomoc tomu, koho má rád. Po braní zo šenku sa
          najprv útočník, potom obranca rozhodne, či si vezme do ruky staršieho, ktorý mu <strong>prejavuje priazeň</strong>{" "}
          (marker aspoň v žltej zóne na jeho polovici, na ukazovateli ešte pôvodný starší). Každý najviac jedného za kolo.
        </p>
        <ul>
          <li>Kartu staršieho si vezmeš do ruky — v tomto kole ju smieš vyložiť ako každú inú kartu.</li>
          <li>Na jeho scorecard dáš <strong>lícom dole</strong> Občana alebo Zviera z ruky — súper nevie, ktorého.</li>
          <li>Marker staršieho ide do stredu.</li>
          <li>
            Zaplatíš toľko cigariet, koľko markeru chýbalo do červenej (žltá 2, oranžová 1, červená 0), a súper dostane v tejto
            bitke toľko <strong>Pohoršení navyše</strong>, o koľko marker išiel do stredu (2 / 3 / 4) — strach, ktorý spôsobil,
            mu tak neprepadne (Policajtka ich zruší, Noviny platia).
          </li>
          <li>Treba mať aspoň jeden poldeci — na bolestné.</li>
        </ul>
        <p className="zvyraznene">
          <strong>Vyhráš bitku</strong> — lokalitu aj staršieho: karta staršieho je tvoja, náhrada sa otočí lícom hore a hrá ďalej
          ako každý starší (marker, priazeň aj body). <em>Áno, aj koza smie zasadnúť do rady starších.</em>{" "}
          <strong>Prehráš</strong> — starší sa vráti na scorecard (marker ostane, kde je), náhradu si vezmeš späť do ruky a ako
          bolestné <strong>odhodíš jeden poldeci</strong> (plný či vypitý; nový stojí 5 cigariet).
        </p>
        <p>
          Patronát je aj obrana proti vydeseniu: marker z krajnej pozície uvoľní len on. Pred potvrdením ti hra ukáže body oboch
          hráčov pri výhre a pri prehre.
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
        <li><strong>Efekty bitky</strong> — Krčmárka, Dievčina na vydaj.</li>
        <li><strong>Exekútor</strong> — najprv Robota, potom kontrola prahu priznaných dlhov.</li>
        <li><strong>Pohoršenie</strong> — každé posunie marker staršieho o 1 k súperovi; ten istý marker aj viackrát, no tvoje Pohoršenia ho prenesú najviac cez dve hranice zón (z pravej sivej až do ľavej oranžovej áno) a nikdy nie na krajnú pozíciu. Patrónov súper k nim dostane Pohoršenia z patronátu.</li>
        <li><strong>Poškodenie</strong> — Viera a Povera sa vyrušia, tuhé znižuje Viera a Absťáky, mäkké po strop dlhu.</li>
        <li>
          <strong>Výsledok</strong> — vyhráva vyššie TUHÉ. Pri <strong>rovnakom tuhom nevyhrá nikto</strong>: lokalita ide{" "}
          <strong>na sekeru</strong> a vezme si ju víťaz najbližšej bitky spolu s tou, o ktorú sa bije — aj v poslednej bitke; prepadne len pri
          remíze v poslednej bitke;
          útočník ostáva útočníkom. Prebytok rozdeľuje hráč s vyšším CELKOVÝM — aj pri remíze v tuhom.
        </li>
        <li><strong>Cigarety za prebytok</strong> — hráč, proti ktorému sa prebytok rozdeľoval, dostane 1 cigaretu za každého staršieho, ktorého marker sa posunul (viac posunov toho istého = 1 cigareta).</li>
        <li><strong>Poldeci</strong> — poldeci z NA EX sa vypijú, aktívna akcia Poldeci otočí vypitý späť na plný.</li>
        <li><strong>Veštica</strong> — porazený s Vešticou vymení kartu medzi doberacími balíčkami.</li>
        <li><strong>Pohreb</strong> — s priznanou Cirhózou; za Závislého karta zo šenku.</li>
        <li><strong>Cintorín</strong> — len na Cintoríne: porazený smie po Pohrebe dať Nástroj z ruky do Dedičstva zadarmo.</li>
        <li><strong>Patronát</strong> — víťaz si staršieho nechá, porazený patrón ho vráti na scorecard a odhodí poldeci.</li>
        <li><strong>Návrat kariet</strong> — do odhadzovacieho balíčka hráča, ktorý ich zahral.</li>
        <li><strong>Absťák</strong> — porovnanie nerestí kola s minulým (viď Závislosť).</li>
        <li><strong>Nové kolo</strong> — každému sa doleje jeden vypitý poldeci a každý si dobere 2 karty.</li>
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
          vziať si vydeseného staršieho do ruky — patronát vráti marker do stredu). Hra ohlásenie ukáže obom.
        </p>
        <p>
          Inak po poslednej bitke o lokalitu sa bodujú scorecardy. Každá aktívna podmienka boduje{" "}
          <strong>obom hráčom</strong>, nech je marker staršieho kdekoľvek: za kusy — ovládnuté lokality (2), získaných
          starších (2), zvyšné cigarety (1 za každé 3), mínus za každý Dlh — aj priznaný (−1) a za nepriznané Cirhózy (−2), vždy za každú
          aktívnu podmienku zvlášť. Skutočnú hodnotu lokality či Dlhu teda určuje rozdanie scorecardov (lokalita bežne 12 – 18 b). Znepokojenie (1), Strach (2)
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
  // Ilustrácie všetkých kapitol sa načítajú hneď po otvorení (najprv
  // aktuálna a nasledujúce) — listovanie je potom okamžité.
  const [nacitane, setNacitane] = useState<ReadonlySet<string>>(() => new Set());
  const oznacNacitany = (subor: string): void =>
    setNacitane((s) => (s.has(subor) ? s : new Set(s).add(subor)));
  useEffect(() => {
    const subory = [...KAPITOLY.slice(index), ...KAPITOLY.slice(0, index)].flatMap((k) => (k.obrazok === undefined ? [] : [k.obrazok]));
    const obrazky = subory.map((subor) => {
      const img = new Image();
      img.onload = () => oznacNacitany(subor);
      img.src = `/pravidla/${subor}`;
      return img;
    });
    return () => {
      for (const img of obrazky) img.onload = null;
    };
    // Raz pri otvorení stránky; ďalšie kapitoly sú potom už v cache.
  }, []);
  // Posúva sa len text vpravo — nová kapitola začína zhora.
  const textRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    textRef.current?.scrollTo({ top: 0 });
  }, [index]);
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

  const obrazok = kapitola.obrazok;
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
                {k.kratky ?? k.nazov}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="pravidla-strana">
        <article key={kapitola.id} className={`kapitola ${kapitola.obrazok === undefined ? "bez-obrazka" : ""}`}>
          {obrazok !== undefined && (
            // Kým sa ilustrácia načíta, rám s názvom kapitoly jemne pulzuje
            // a obrázok sa doň potom prelne (Michal 2026-10-19).
            <div className={`kapitola-obrazok-ram ${nacitane.has(obrazok) ? "nacitany" : ""}`}>
              <div className="kapitola-obrazok-nahrada" aria-hidden="true">
                <span>NA EX!</span>
                <strong>{kapitola.nazov}</strong>
              </div>
              <img
                key={obrazok}
                className="kapitola-obrazok"
                src={`/pravidla/${obrazok}`}
                alt=""
                onLoad={() => oznacNacitany(obrazok)}
              />
            </div>
          )}
          <div className="kapitola-pravy" ref={textRef}>
            <div className="kapitola-telo">
              <span className="kapitola-cislo">
                Kapitola {index + 1} / {KAPITOLY.length}
              </span>
              <h2>{kapitola.nazov}</h2>
              {sada === null ? (
                <div className="kostra-textu" aria-label="Načítava sa">
                  {[92, 100, 84, 96, 70, 0, 88, 100, 60].map((w, i) => (
                    <span key={i} style={{ width: `${w}%` }} />
                  ))}
                </div>
              ) : (
                kapitola.obsah(sada)
              )}
            </div>

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
        </article>
      </div>
    </div>
  );
}
