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
    ["Partia", "Súvislá kombinácia kariet, ktorú hráč vytvorí počas jedného kola."],
    ["Šenok", "Ponuka kariet lícom nahor zo spoločného balíčka; vidia ju obaja hráči."],
    ["Poldeci", "Fyzický pohár. Plný poldeci umožňuje vyložiť kartu, vypitý nie."],
    ["Okolie", "Karty priložené k danej karte."],
    ["Susedstvo", "Dve karty susedia, ak sú priamo vedľa seba."],
    ["Podpora", "Karta je podporená, ak sú v jej okolí presne 2 karty."],
    ["Priazeň", "Hodnota pridaná k efektom podľa pozície markera na ukazovateli staršieho."],
    ["Priznanie", "Vyloženie karty mimo partie do vlastnej hracej oblasti."],
    ["Náhrada", "Hráč nahradí kartu z množiny určenej efektom."],
    ["Kolo", "Cyklus Zhromaždení a Pitiek zakončený bitkou o lokalitu alebo o staršieho."],
    ["Útočník / Obranca", "Útočník prehral poslednú bitku a vyberá cieľ kola; obranca vykladá a draftuje prvý."],
    ["Hracia oblasť", "Priestor mimo partie pre priznané karty a Nástroje v Dedičstve."],
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
            <strong>Okamžite vyhráš</strong>, ak vydesíš aspoň polovicu starších v hre.
          </div>
          <div className="karticka karticka-zle">
            <strong>Okamžite prehráš</strong>, ak nedokážeš čeliť exekúcii alebo tvoj balíček klesne pod 5 kariet.
          </div>
          <div className="karticka">
            Inak hra končí <strong>po poslednej bitke o lokalitu</strong> a rozhodnú body.
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
          Efekty využívajú spúšťače (Furt, Nástup, Bitka, Pitka, Podpora…). Efekt karty pôsobí, kým je karta v partii —
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
          Zhromaždenia. Ak je limit 0, okamžite prehrávaš bitku.
        </p>
        <UkazkaLimitu />
        <h3>NA EX</h3>
        <p>
          Iba vo fáze NA EX v Pitke, v základe raz za Pitku. Vyberieš kartu s tagom <strong>Občan</strong> alebo{" "}
          <strong>Starešina</strong> — vlastnú (posilníš ju) alebo súperovu (zneguješ ju) — a položíš na ňu plný poldeci.
          Poldeci ostáva tvoj a vypije sa pri bitke.
        </p>
        <p className="zvyraznene">NA EX zdvojnásobí neaktívne akcie a zároveň zruší aktívne akcie karty, na ktorej leží.</p>
        <p>
          <strong>2 kusovky za poldeci:</strong> za 2 fyzické cigarety otočíš vypitý poldeci späť na plný.{" "}
          <strong>Stokársky barter:</strong> za 5 cigariet/cigaretiek dostaneš nový plný poldeci navyše.
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
          Partia je <strong>jedna súvislá línia</strong> — vetvenie nie je povolené. Prvá karta sa spája s lokalitou, každá
          ďalšia musí vytvoriť aspoň jedno spojenie.
        </p>
        <p>
          Kartu môžeš (ak to efekt dovolí) vyložiť aj do <strong>súperovej partie — nohami hore</strong>. Otočením sa ľavá a
          pravá strana vymenia a poradie indexov sa obráti. Akcie a efekty pôsobia v partii, kde karta leží — podhoď
          súperovi Dlh či Poškodenie pečene.
        </p>
        <h3>Priznanie</h3>
        <p>
          Kliatbu môžeš namiesto do partie vyložiť do svojej hracej oblasti — je <strong>priznaná</strong>. Priznaný Dlh: hneď
          si doberieš kartu, ale ráta sa k prahu Exekútora. Priznaná Cirhóza sa dá liečiť alebo pochovať. Nepriznané kliatby
          uberajú body na konci hry.
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
        <p>
          Namiesto do partie môžeš Nástroj vyložiť do hracej oblasti ako <strong>Dedičstvo</strong> — kým tam leží, platí jeho
          pasívny efekt. Z Dedičstva ho môžeš neskôr zahrať do partie; efekt Dedičstva tým prestane platiť.
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
          Starší sú vážené osoby dediny (karty s tagom Starešina). Pod každým je ukazovateľ so stupnicou strachu
          (2‑2‑1‑0‑0‑0‑1‑2‑2) a 8 bočnými bodovacími pozíciami, ktoré aktivujú neprázdne akcie staršieho.
        </p>
        <UkazkaStupnice />
        <h3>Priazne</h3>
        <table className="tabulka">
          <thead>
            <tr><th>Priazeň</th><th>Uplatňuje sa pri</th><th>Vplyv</th></tr>
          </thead>
          <tbody>
            <tr><td>Očumovateľ</td><td>Preskúmanie</td><td>zvýšené o priazeň</td></tr>
            <tr><td>Lakomec</td><td>Trocha</td><td>zvýšené o priazeň</td></tr>
            <tr><td>Neprajník</td><td>Zopár</td><td>zvýšené o priazeň</td></tr>
            <tr><td>Bitkár</td><td>Vyhodnotenie bitky</td><td>tuhé poškodenie navyše</td></tr>
            <tr><td>Veriaci</td><td>Hodnota Viery</td><td>1 + priazeň</td></tr>
            <tr><td>Fajčiar</td><td>Prvé zhromaždenie v lokalite</td><td>cigaretky navyše</td></tr>
            <tr><td>Alkoholik</td><td>Prah Cirhózy</td><td>2 + priazeň</td></tr>
            <tr><td>Exekútor</td><td>Prah Exekútora</td><td>10 + 2 × priazeň</td></tr>
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
          <strong>NA EX</strong>. Prah sa vyhodnocuje počas Pitky — keď ho dosiahneš, hneď získaš kartu Cirhózy.
        </p>
        <p>Každá Cirhóza ti v bitke pridáva 1 tuhé poškodenie, akoby ti ho udelil súper. Viera ju znižuje.</p>
        <p>
          <strong>Liečba:</strong> spáľ priznanú Cirhózu a Závislého zo svojej partie, získaj 1 Dlh a vyber si kartu zo šenku.{" "}
          <strong>Pohreb:</strong> spáľ priznanú Cirhózu a ľubovoľnú kartu zo svojej partie.
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
          Počítadlo závislosti sleduje neresti kola: fyzické cigarety, Cigaretky, poldeci cez NA EX a akcie Poldecko.
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
          Vyberte 3 lokality (krátka hra), 6 (stredná) alebo 9 (dlhá). Rozmiestnite 8 starších, markery do stredu. Každý
          hráč dostane 10 štartovacích kariet (Pijan, Miňištrant, Milujúca manželka, Dievčina na vydaj), 1 cigaretu
          a 2 plné poldeci.
        </p>
        <div className="priebeh">
          <span>Voľba cieľa</span>→<span>Draft</span>→<span>Zhromaždenie</span>→<span>Pitka</span>→<span>…</span>→<span>Bitka</span>
        </div>
        <p>
          Útočník (porazený z minulej bitky) vyberá cieľ kola. Vo fáze <strong>Zhromaždenie</strong> hráči striedavo vykladajú
          karty — začína obranca. Keď obaja odohrajú limit alebo pasujú, nasleduje <strong>Pitka</strong>.
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
          Potom <strong>cigaretový draft</strong>: každý si vezme 0 – 3 cigarety a za zvyšok si doberie karty zo šenku.
        </p>
        <p className="zvyraznene">Počet pitiek = 1 + |rozdiel nových kariet oboch hráčov| (1 až 4).</p>
        <h3>Poradie Pitky</h3>
        <ol>
          <li>NA EX</li>
          <li>Hazard</li>
          <li>Poškodenie pečene a Cirhóza</li>
          <li>Obmedzenie</li>
          <li>Cigaretky (a fyzické cigarety)</li>
          <li>Ťahanie kariet</li>
          <li>Vízia</li>
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
          <li>dá sa vyvolať, len ak je marker aspoň v oranžovej zóne (Strach).</li>
        </ul>
        <p>
          Víťaz si vezme kartu staršieho do balíčka a na jeho miesto položí vlastného Občana alebo Zviera; marker nastaví do
          sivej zóny. <em>Áno, aj koza smie zasadnúť do rady starších.</em>
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
        <li><strong>Exekútor</strong> — najprv Robota, potom kontrola prahu priznaných dlhov.</li>
        <li><strong>Pohoršenie</strong> — každé posunie marker staršieho o 1 k súperovi (nie dvakrát ten istý, nie na krajnú pozíciu).</li>
        <li><strong>Poškodenie</strong> — Viera a Povera sa vyrušia, tuhé znižuje Viera a Absťáky, mäkké po strop dlhu.</li>
        <li><strong>Výsledok</strong> — vyhráva vyššie TUHÉ (pri remíze útočník); prebytok rozdeľuje hráč s vyšším CELKOVÝM.</li>
        <li><strong>Poldeci</strong> — poldeci z NA EX sa vypijú, Poldecko otočí vypitý späť na plný.</li>
        <li><strong>Liečba alebo Pohreb</strong> — s priznanou Cirhózou.</li>
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
        <p>Hra sa končí okamžite, keď niekto vydesí polovicu starších (vyhráva), nečelí exekúcii alebo mu balíček klesne pod 5 kariet (prehráva).</p>
        <p>
          Inak po poslednej bitke o lokalitu: body za strach starších (bočné pozície), ovládnuté lokality, starších v balíčku a
          zvyšné cigarety; mínusové body za nepriznané Dlhy a Cirhózy.
        </p>
        <div className="riadok-tlacidiel">
          <Odkaz href="/hra" className="tlacidlo tlacidlo-hlavne">Si pripravený? Hraj!</Odkaz>
          <Odkaz href="/karty" className="tlacidlo">Prezri si karty</Odkaz>
        </div>
      </>
    ),
  },
];

export function Pravidla() {
  useTitulok("Pravidlá");
  const { sada } = useSada();
  const [aktivna, setAktivna] = useState(KAPITOLY[0]?.id ?? "");

  useEffect(() => {
    if (sada === null) return;
    const obs = new IntersectionObserver(
      (zaznamy) => {
        const viditelna = zaznamy.filter((z) => z.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (viditelna !== undefined) setAktivna(viditelna.target.id);
      },
      { rootMargin: "-80px 0px -65% 0px" },
    );
    for (const k of KAPITOLY) {
      const el = document.getElementById(k.id);
      if (el !== null) obs.observe(el);
    }
    if (location.hash !== "") document.getElementById(location.hash.slice(1))?.scrollIntoView();
    return () => obs.disconnect();
  }, [sada]);

  if (sada === null) return <Nacitavanie />;

  return (
    <div className="pravidla">
      <nav className="pravidla-obsah" aria-label="Kapitoly">
        <h2>Pravidlá</h2>
        <ol>
          {KAPITOLY.map((k) => (
            <li key={k.id}>
              <a href={`#${k.id}`} className={aktivna === k.id ? "aktivna" : undefined}>
                {k.nazov}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      <div className="pravidla-text">
        {KAPITOLY.map((k, i) => (
          <section key={k.id} id={k.id} className="kapitola">
            {k.obrazok !== undefined && (
              <img className="kapitola-obrazok" src={`/pravidla/${k.obrazok}`} alt="" loading={i < 2 ? "eager" : "lazy"} />
            )}
            <div className="kapitola-telo">
              <span className="kapitola-cislo">Kapitola {i + 1}</span>
              <h2>{k.nazov}</h2>
              {k.obsah(sada)}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
