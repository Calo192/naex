// Stav administrácie: celý obsah tvorcu sa načíta raz (/api/admin/obsah)
// a zmeny sa po úspešnom uložení na serveri premietnu aj lokálne.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AkciaDef, BodovaciaKarta, IkonaBodovania, KartaNavrh, Kategoria, KlucoveSlovo, Nastavenia, Vzhlad } from "@naex/tvorba";
import { api } from "../lib/api.ts";

export interface AdminObsah {
  readonly karty: readonly KartaNavrh[];
  readonly nastavenia: Nastavenia;
  readonly akcie: readonly AkciaDef[];
  readonly klucoveSlova: readonly KlucoveSlovo[];
  readonly kategorie: readonly Kategoria[];
  readonly bodovacie: readonly BodovaciaKarta[];
  readonly ikonyBodovania: readonly IkonaBodovania[];
  readonly zverejnenaVerzia: number;
}

interface AdminKontext {
  readonly obsah: AdminObsah | null;
  readonly chyba: string | null;
  readonly vzhlad: Vzhlad | null;
  obnov(): Promise<void>;
  ulozKartu(k: KartaNavrh): Promise<KartaNavrh>;
  zmazKartu(id: string): Promise<void>;
  ulozAkciu(a: Omit<AkciaDef, "poradie"> & { poradie?: number }): Promise<void>;
  zmazAkciu(kluc: string): Promise<void>;
  ulozKlucoveSlova(z: readonly KlucoveSlovo[]): Promise<void>;
  ulozKategorie(z: readonly Kategoria[]): Promise<void>;
  ulozNastavenia(n: Nastavenia): Promise<void>;
  ulozBodovaciu(b: BodovaciaKarta): Promise<void>;
  zmazBodovaciu(id: string): Promise<void>;
  ulozIkonuBodovania(i: IkonaBodovania): Promise<void>;
  zmazIkonuBodovania(id: string): Promise<void>;
  zverejni(): Promise<number>;
}

const Kontext = createContext<AdminKontext | null>(null);

export function AdminProvider({ children }: { readonly children: ReactNode }) {
  const [obsah, setObsah] = useState<AdminObsah | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);

  const obnov = useCallback(async () => {
    try {
      setObsah(await api.get<AdminObsah>("/admin/obsah"));
      setChyba(null);
    } catch (e) {
      setChyba(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void obnov();
  }, [obnov]);

  const zmen = (f: (o: AdminObsah) => AdminObsah) => setObsah((o) => (o === null ? o : f(o)));

  const hodnota = useMemo<AdminKontext>(
    () => ({
      obsah,
      chyba,
      vzhlad: obsah === null ? null : { akcie: obsah.akcie, klucoveSlova: obsah.klucoveSlova, kategorie: obsah.kategorie },
      obnov,
      ulozKartu: async (k) => {
        const ulozena = await api.put<KartaNavrh>(`/admin/karty/${k.id}`, k);
        zmen((o) => ({
          ...o,
          karty: o.karty.some((x) => x.id === k.id) ? o.karty.map((x) => (x.id === k.id ? ulozena : x)) : [...o.karty, ulozena],
        }));
        return ulozena;
      },
      zmazKartu: async (id) => {
        await api.del(`/admin/karty/${id}`);
        zmen((o) => ({ ...o, karty: o.karty.filter((x) => x.id !== id) }));
      },
      ulozAkciu: async (a) => {
        const ulozena = await api.put<AkciaDef>(`/admin/akcie/${encodeURIComponent(a.kluc)}`, a);
        zmen((o) => ({
          ...o,
          akcie: (o.akcie.some((x) => x.kluc === a.kluc) ? o.akcie.map((x) => (x.kluc === a.kluc ? ulozena : x)) : [...o.akcie, ulozena]).sort(
            (x, y) => x.poradie - y.poradie,
          ),
        }));
      },
      zmazAkciu: async (kluc) => {
        await api.del(`/admin/akcie/${encodeURIComponent(kluc)}`);
        zmen((o) => ({ ...o, akcie: o.akcie.filter((x) => x.kluc !== kluc) }));
      },
      ulozKlucoveSlova: async (z) => {
        const nove = await api.put<KlucoveSlovo[]>("/admin/klucove-slova", z);
        zmen((o) => ({ ...o, klucoveSlova: nove }));
      },
      ulozKategorie: async (z) => {
        const nove = await api.put<Kategoria[]>("/admin/kategorie", z);
        zmen((o) => ({ ...o, kategorie: nove }));
      },
      ulozNastavenia: async (n) => {
        const nove = await api.put<Nastavenia>("/admin/nastavenia", n);
        zmen((o) => ({ ...o, nastavenia: nove }));
      },
      ulozBodovaciu: async (b) => {
        const ulozena = await api.put<BodovaciaKarta>(`/admin/bodovacie/${b.id}`, b);
        zmen((o) => ({
          ...o,
          bodovacie: o.bodovacie.some((x) => x.id === b.id) ? o.bodovacie.map((x) => (x.id === b.id ? ulozena : x)) : [...o.bodovacie, ulozena],
        }));
      },
      zmazBodovaciu: async (id) => {
        await api.del(`/admin/bodovacie/${id}`);
        zmen((o) => ({ ...o, bodovacie: o.bodovacie.filter((x) => x.id !== id) }));
      },
      ulozIkonuBodovania: async (i) => {
        const ulozena = await api.put<IkonaBodovania>(`/admin/ikony-bodovania/${i.id}`, i);
        zmen((o) => ({
          ...o,
          ikonyBodovania: o.ikonyBodovania.some((x) => x.id === i.id)
            ? o.ikonyBodovania.map((x) => (x.id === i.id ? ulozena : x))
            : [...o.ikonyBodovania, ulozena],
        }));
      },
      zmazIkonuBodovania: async (id) => {
        await api.del(`/admin/ikony-bodovania/${id}`);
        zmen((o) => ({ ...o, ikonyBodovania: o.ikonyBodovania.filter((x) => x.id !== id) }));
      },
      zverejni: async () => {
        const r = await api.post<{ verzia: number }>("/admin/zverejnit");
        zmen((o) => ({ ...o, zverejnenaVerzia: r.verzia }));
        return r.verzia;
      },
    }),
    [obsah, chyba, obnov],
  );

  return <Kontext.Provider value={hodnota}>{children}</Kontext.Provider>;
}

export function useAdmin(): AdminKontext {
  const k = useContext(Kontext);
  if (k === null) throw new Error("useAdmin mimo AdminProvider");
  return k;
}

/** Krátke náhodné id pre nové záznamy (bodovacie karty, ikony). */
export function noveId(predpona: string): string {
  return `${predpona}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Nahratie obrázka do médií servera. */
export async function nahrajMedia(blob: Blob, druh: "karta" | "ikona" | "kniznica" | "pozadie", nazov: string): Promise<string> {
  const r = await api.post<{ id: string }>(`/admin/media?druh=${druh}&nazov=${encodeURIComponent(nazov)}`, blob, blob.type || "application/octet-stream");
  return r.id;
}
