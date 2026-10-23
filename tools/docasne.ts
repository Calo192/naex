// Dočasné priečinky nástrojov a profily headless Chromu (Leader 2026-10-23): disk C
// sa dvakrát zaplnil na 0 GB zvyškami v %TEMP% — nástroj zabitý uprostred (TaskStop,
// timeout, ENOSPC) po sebe neupratal a každý Chrome k tomu nechal scoped_dir*. Preto:
//   1. pri štarte nástroja (aj testov) sa zmažú naše zvyšky staršie ako 2 h,
//   2. priečinok sa zmaže v finally, pri výnimke, Ctrl+C aj zatvorení konzoly,
//   3. Chrome dostane TEMP/TMP do vlastného priečinka, takže jeho scoped_dir* zmiznú s ním.
// Zabitie natvrdo (taskkill /F) nič neodchytí — to dorieši bod 1 pri ďalšom štarte.
// Michal 2026-10-23: všetko dočasné patrí na disk projektu, nie na C — základ je
// NAEX_TMP, inak <koreň repa>/../naex-tmp (F:\Projects\naex-tmp); nastavDocasneEnv()
// presmeruje naň aj TEMP/TMP procesu a jeho detí (testy, servery, Chrome).
//
//   node --experimental-strip-types --no-warnings tools/docasne.ts [--vek <minúty>]   upratanie hneď

import { spawn, spawnSync, type ChildProcess, type SpawnOptions } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const VEK_STARYCH_MS = 2 * 60 * 60 * 1000;

const KOREN_REPA = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Základ dočasných priečinkov projektu (vytvorí ho, ak chýba). */
export function zakladDocasnych(): string {
  const env = process.env.NAEX_TMP;
  // Pokazená hodnota (napr. „F:\Projects\naex-tmp“ v JSON bez zdvojených lomiek → \n) sa ignoruje.
  const z = env !== undefined && isAbsolute(env) && !/[\u0000-\u001f]/.test(env) ? env : resolve(KOREN_REPA, "..", "naex-tmp");
  mkdirSync(z, { recursive: true });
  return z;
}

/** TEMP, TMP a NAEX_TMP tohto procesu (a tým aj detí a os.tmpdir()) na základ projektu. */
export function nastavDocasneEnv(): string {
  const z = zakladDocasnych();
  process.env.NAEX_TMP = z;
  process.env.TEMP = z;
  process.env.TMP = z;
  process.env.TMPDIR = z;
  return z;
}

/** Kde upratovať: základ projektu a starý systémový %TEMP% (C:), kde ostali zvyšky. */
function korene(): string[] {
  const systemovy = process.platform === "win32" && process.env.LOCALAPPDATA !== undefined ? join(process.env.LOCALAPPDATA, "Temp") : tmpdir();
  return [...new Set([zakladDocasnych(), systemovy, tmpdir()].map((k) => resolve(k).toLowerCase()))];
}

/** Je priečinok v %TEMP% náš zvyšok (nástroje, testy, skripty sessions, Chrome, nasadenie)? */
function nasZvysok(cesta: string, meno: string): boolean {
  if (/^(naex-|sonda-|foto-)/.test(meno)) return true;
  // z-* má aj iný softvér — mažeme len profil Chromu (skripty sessions v scratchpade).
  if (/^z-/.test(meno)) return existsSync(join(cesta, "Local State")) || existsSync(join(cesta, "Default"));
  // Chrome si pri každom spustení zakladá scoped_dir*; po zabití ostanú navždy.
  if (/^scoped_dir/.test(meno)) return true;
  // deploy/nahraj.sh pred opravou: mktemp -d s archívom naex.tgz.
  if (/^tmp\./.test(meno)) {
    const obsah = readdirSync(cesta);
    return obsah.length === 1 && obsah[0] === "naex.tgz";
  }
  return false;
}

/** Bežiaci Chrome drží súbor lockfile v profile — taký profil sa nemaže. */
function profilBezi(cesta: string): boolean {
  for (const p of [join(cesta, "lockfile"), join(cesta, "profil", "lockfile")]) {
    if (!existsSync(p)) continue;
    try {
      rmSync(p);
    } catch {
      return true;
    }
  }
  return false;
}

/**
 * Zabitý Chrome drží súbory profilu ešte chvíľu (EPERM/EBUSY) a maxRetries v rmSync
 * to v Node 24 neopakuje — preto vlastné opakovanie, synchrónne (beží aj v udalosti exit).
 */
export function zmazPriecinok(cesta: string, pokusy = 1): boolean {
  for (let i = 0; i < pokusy; i++) {
    try {
      rmSync(cesta, { recursive: true, force: true });
      return true;
    } catch {
      if (i + 1 < pokusy) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
    }
  }
  return false;
}

/**
 * Zmaže naše zvyšky staršie ako `vekMs` v `koren`, bez neho v základe projektu
 * aj v systémovom %TEMP%; vráti počet zmazaných a uvoľnené MB.
 */
export function upratStare(vekMs = VEK_STARYCH_MS, koren?: string): { readonly zmazane: number; readonly mb: number } {
  if (koren === undefined) {
    let zmazane = 0;
    let mb = 0;
    for (const k of korene()) {
      const r = upratStare(vekMs, k);
      zmazane += r.zmazane;
      mb += r.mb;
    }
    return { zmazane, mb };
  }
  let zmazane = 0;
  let bajty = 0;
  let mena: string[];
  try {
    mena = readdirSync(koren);
  } catch {
    return { zmazane, mb: 0 };
  }
  const hranica = Date.now() - vekMs;
  for (const meno of mena) {
    const cesta = join(koren, meno);
    try {
      const st = statSync(cesta);
      if (!st.isDirectory() || st.mtimeMs > hranica || !nasZvysok(cesta, meno) || profilBezi(cesta)) continue;
      const velkost = velkostPriecinka(cesta);
      if (zmazPriecinok(cesta)) {
        zmazane++;
        bajty += velkost;
      }
    } catch {
      // medzitým zmizol alebo nie je prístupný
    }
  }
  return { zmazane, mb: Math.round(bajty / 1048576) };
}

function velkostPriecinka(cesta: string): number {
  let s = 0;
  try {
    for (const e of readdirSync(cesta, { withFileTypes: true, recursive: true })) {
      if (e.isFile()) s += statSync(join(e.parentPath, e.name)).size;
    }
  } catch {
    // stačí odhad
  }
  return s;
}

// Upratovanie pri skončení procesu — jeden zoznam pre všetky priečinky a prehliadače.
const priUkonceni = new Set<() => void>();
let signalyNastavene = false;
function nastavSignaly(): void {
  if (signalyNastavene) return;
  signalyNastavene = true;
  process.on("exit", () => {
    for (const f of [...priUkonceni]) f();
  });
  // Bez vlastnej obsluhy Node pri Ctrl+C / zatvorení konzoly skončí bez udalosti exit.
  for (const s of ["SIGINT", "SIGTERM", "SIGHUP", "SIGBREAK"] as const) {
    process.once(s, () => process.exit(130));
  }
}

let stareUpratane = false;

/**
 * Dočasný priečinok v základe projektu (predpona má začínať „naex-“). Zmaže sa zavolaním `zmaz`,
 * inak sám pri skončení procesu; pri prvom použití sa upracú staré zvyšky.
 */
export function docasnyPriecinok(predpona: string): { readonly cesta: string; readonly zmaz: () => void } {
  if (!stareUpratane) {
    stareUpratane = true;
    upratStare();
  }
  nastavSignaly();
  const cesta = mkdtempSync(join(zakladDocasnych(), predpona));
  const zmaz = (): void => {
    priUkonceni.delete(zmaz);
    zmazPriecinok(cesta, 20);
  };
  priUkonceni.add(zmaz);
  return { cesta, zmaz };
}

/** Chrome spúšťa podprocesy — zastaviť treba celý strom. */
export function zabiStrom(pid: number | undefined): void {
  if (pid === undefined) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
  else {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // už nebeží
    }
  }
}

export interface HeadlessChrome {
  readonly proc: ChildProcess;
  readonly profil: string;
  /** Zastaví prehliadač aj s podprocesmi a zmaže profil (bezpečné volať viackrát). */
  readonly zastav: () => void;
}

/**
 * Headless Chrome s profilom v dočasnom priečinku. `args` bez --user-data-dir.
 * Profil aj Chromove dočasné súbory (TEMP/TMP) ležia v jednom priečinku, ktorý
 * `zastav` zmaže — zavolaj ho vo finally; pri výnimke či Ctrl+C sa zavolá sám.
 */
export function spustiChrome(chrome: string, args: readonly string[], predpona = "naex-chrome-", moznosti: SpawnOptions = {}): HeadlessChrome {
  const dir = docasnyPriecinok(predpona);
  const profil = join(dir.cesta, "profil");
  const tmp = join(dir.cesta, "tmp");
  mkdirSync(tmp, { recursive: true });
  const proc = spawn(chrome, [`--user-data-dir=${profil}`, ...args], {
    stdio: "ignore",
    ...moznosti,
    env: { ...process.env, ...moznosti.env, TEMP: tmp, TMP: tmp },
  });
  let zastaveny = false;
  const zastav = (): void => {
    priUkonceni.delete(zastav);
    if (!zastaveny) {
      zastaveny = true;
      zabiStrom(proc.pid);
    }
    dir.zmaz();
  };
  // Pred zmazaním priečinka (exit volá v poradí pridania) — inak sú súbory zamknuté.
  priUkonceni.delete(dir.zmaz);
  priUkonceni.add(zastav);
  return { proc, profil, zastav };
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const i = process.argv.indexOf("--vek");
  const vek = i > 0 ? Number(process.argv[i + 1]) * 60_000 : VEK_STARYCH_MS;
  const { zmazane, mb } = upratStare(vek);
  console.log(`Upratané v ${korene().join(", ")}: ${zmazane} priečinkov, ${mb} MB.`);
}
