// Výber ilustrácie: nahratie súboru s orezom na štvorec, alebo výber
// z knižnice obrázkov (aj ilustrácie existujúcich kariet). Obrázok sa
// v prehliadači zmenší na 1024 a 512 px a nahrá ako dve médiá.

import { useEffect, useMemo, useRef, useState } from "react";
import type { ObrazokKarty } from "@naex/tvorba";
import { api, mediaUrl } from "../lib/api.ts";
import { nacitajObrazok, stvorec } from "../lib/obrazky.ts";
import { Hlaska, Nacitavanie } from "../komponenty.tsx";
import { nahrajMedia, useAdmin } from "./stav.tsx";

interface MediaZaznam {
  readonly id: string;
  readonly nazov: string;
}

export async function ulozObrazokKarty(img: HTMLImageElement, posun: { x: number; y: number }, nazov: string): Promise<ObrazokKarty> {
  const [plny, nahlad] = await Promise.all([stvorec(img, 1024, posun), stvorec(img, 512, posun, 0.84)]);
  const [p, n] = await Promise.all([nahrajMedia(plny, "karta", nazov), nahrajMedia(nahlad, "karta", `${nazov}@512`)]);
  return { plny: p, nahlad: n };
}

export function VyberObrazka({ nazov, zavri, vyber }: { readonly nazov: string; readonly zavri: () => void; readonly vyber: (o: ObrazokKarty) => void }) {
  const { obsah } = useAdmin();
  const [karta, setKarta] = useState<"subor" | "kniznica">("subor");
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [posun, setPosun] = useState({ x: 0.5, y: 0.5 });
  const [kniznica, setKniznica] = useState<readonly MediaZaznam[] | null>(null);
  const [filtr, setFiltr] = useState("");
  const [caka, setCaka] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);
  const subor = useRef<HTMLInputElement>(null);
  const doKniznice = useRef<HTMLInputElement>(null);

  const nacitajKniznicu = () =>
    void api.get<{ media: MediaZaznam[] }>("/admin/media?druh=kniznica").then((r) => setKniznica(r.media)).catch(() => setKniznica([]));
  useEffect(() => {
    if (karta === "kniznica" && kniznica === null) nacitajKniznicu();
  }, [karta, kniznica]);

  // Ilustrácie existujúcich kariet sú tiež na výber (už štvorcové).
  const kartove = useMemo(
    () => (obsah?.karty ?? []).filter((k) => k.obrazok !== null).map((k) => ({ id: k.obrazok?.plny ?? "", nazov: k.nazov, hotovy: k.obrazok })),
    [obsah],
  );

  const pouzi = async () => {
    if (img === null) return;
    setCaka(true);
    setChyba(null);
    try {
      vyber(await ulozObrazokKarty(img, posun, nazov || "karta"));
      zavri();
    } catch (e) {
      setChyba(e instanceof Error ? e.message : String(e));
    } finally {
      setCaka(false);
    }
  };

  const nahrajDoKniznice = async (subory: FileList) => {
    setCaka(true);
    try {
      for (const f of Array.from(subory)) await nahrajMedia(f, "kniznica", f.name);
      setKniznica(null);
      nacitajKniznicu();
    } catch (e) {
      setChyba(e instanceof Error ? e.message : String(e));
    } finally {
      setCaka(false);
    }
  };

  const sirsi = img !== null && img.naturalWidth > img.naturalHeight;
  const vyssi = img !== null && img.naturalHeight > img.naturalWidth;

  return (
    <div className="modal" onClick={zavri} role="dialog" aria-modal="true" aria-label="Výber ilustrácie">
      <div className="modal-obsah" onClick={(e) => e.stopPropagation()}>
        <button className="modal-zavriet tlacidlo-jemne" onClick={zavri} aria-label="Zavrieť">
          ✕
        </button>
        <h2>Ilustrácia karty</h2>
        <div className="cipy" style={{ marginBottom: 16 }}>
          <button className={karta === "subor" ? "cip aktivny" : "cip"} onClick={() => setKarta("subor")}>
            Nahrať súbor
          </button>
          <button className={karta === "kniznica" ? "cip aktivny" : "cip"} onClick={() => setKarta("kniznica")}>
            Knižnica obrázkov
          </button>
        </div>
        {chyba !== null && <Hlaska>{chyba}</Hlaska>}

        {karta === "subor" ? (
          <div className="vyber-subor">
            <input
              ref={subor}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f !== undefined) void nacitajObrazok(f).then(setImg, (err: unknown) => setChyba(String(err)));
                e.target.value = "";
              }}
            />
            {img === null ? (
              <button className="vyber-drop" onClick={() => subor.current?.click()}>
                Vyber obrázok (JPG, PNG, WEBP)
                <span className="tlmene">Ideálne štvorcový, aspoň 1024 × 1024 px — pre tlač v 300 DPI.</span>
              </button>
            ) : (
              <div className="vyber-orez">
                <div className="vyber-orez-nahlad">
                  <img
                    src={img.src}
                    alt=""
                    style={{ objectPosition: `${posun.x * 100}% ${posun.y * 100}%` }}
                  />
                </div>
                <div>
                  <p className="tlmene">
                    {img.naturalWidth} × {img.naturalHeight} px
                    {Math.min(img.naturalWidth, img.naturalHeight) < 760 && " — pozor, na tlač je to málo (menej než 300 DPI)."}
                  </p>
                  {sirsi && (
                    <label className="pole">
                      <span className="pole-label">Posun výrezu vodorovne</span>
                      <input type="range" min={0} max={1} step={0.01} value={posun.x} onChange={(e) => setPosun({ ...posun, x: Number(e.target.value) })} />
                    </label>
                  )}
                  {vyssi && (
                    <label className="pole">
                      <span className="pole-label">Posun výrezu zvisle</span>
                      <input type="range" min={0} max={1} step={0.01} value={posun.y} onChange={(e) => setPosun({ ...posun, y: Number(e.target.value) })} />
                    </label>
                  )}
                  <div className="riadok-tlacidiel">
                    <button className="tlacidlo-hlavne" onClick={() => void pouzi()} disabled={caka}>
                      {caka ? "Nahrávam…" : "Použiť obrázok"}
                    </button>
                    <button onClick={() => subor.current?.click()}>Iný súbor</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="riadok-tlacidiel" style={{ marginBottom: 12 }}>
              <input type="search" placeholder="Hľadať v názve…" value={filtr} onChange={(e) => setFiltr(e.target.value)} style={{ maxWidth: 260 }} />
              <input ref={doKniznice} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => e.target.files !== null && void nahrajDoKniznice(e.target.files)} />
              <button onClick={() => doKniznice.current?.click()} disabled={caka}>
                {caka ? "Nahrávam…" : "+ Nahrať do knižnice"}
              </button>
            </div>
            {kniznica === null ? (
              <Nacitavanie />
            ) : (
              <div className="kniznica">
                {kartove
                  .filter((m) => m.nazov.toLowerCase().includes(filtr.toLowerCase()))
                  .map((m) => (
                    <button
                      key={`k${m.id}`}
                      className="kniznica-polozka"
                      title={`Ilustrácia karty ${m.nazov}`}
                      onClick={() => {
                        if (m.hotovy !== null) {
                          vyber(m.hotovy);
                          zavri();
                        }
                      }}
                    >
                      <img src={mediaUrl(m.hotovy?.nahlad ?? m.id)} alt="" loading="lazy" />
                      <span>{m.nazov}</span>
                    </button>
                  ))}
                {kniznica
                  .filter((m) => m.nazov.toLowerCase().includes(filtr.toLowerCase()))
                  .map((m) => (
                    <button
                      key={m.id}
                      className="kniznica-polozka"
                      title={m.nazov}
                      onClick={() => {
                        setCaka(true);
                        void nacitajObrazok(mediaUrl(m.id))
                          .then((i) => {
                            setImg(i);
                            setPosun({ x: 0.5, y: 0.5 });
                            setKarta("subor");
                          })
                          .catch((err: unknown) => setChyba(String(err)))
                          .finally(() => setCaka(false));
                      }}
                    >
                      <img src={mediaUrl(m.id)} alt="" loading="lazy" />
                      <span>{m.nazov.replace(/^.*\//, "").slice(0, 40)}</span>
                    </button>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
