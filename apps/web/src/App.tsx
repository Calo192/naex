// Lobby a prepínanie na hernú obrazovku.

import { useState } from "react";
import { GameView } from "./GameView.tsx";
import { useServer } from "./useServer.ts";

export function App() {
  const server = useServer();
  const [kodVstup, setKodVstup] = useState("");

  if (server.view !== null && server.session !== null) {
    return (
      <GameView
        view={server.view}
        log={server.log}
        chyba={server.chyba}
        superPripojeny={server.superPripojeny}
        kod={server.session.code}
        cmd={server.cmd}
        opustit={server.opustit}
      />
    );
  }

  // V miestnosti, ale hra ešte nezačala → čakáme na súpera.
  if (server.session !== null) {
    return (
      <main className="lobby">
        <h1>NA EX!</h1>
        <p>
          Kód miestnosti: <strong className="kod-velky">{server.session.code}</strong>
        </p>
        <p>Pošli kód súperovi. Hra začne, keď sa pripojí.</p>
        {!server.pripojene && <p className="chyba">Spojenie so serverom sa obnovuje…</p>}
        {server.chyba !== null && <p className="chyba">{server.chyba}</p>}
        <button onClick={server.opustit}>Zrušiť</button>
      </main>
    );
  }

  return (
    <main className="lobby">
      <h1>NA EX!</h1>
      <p>Kartová hra pre dvoch — pošli kód miestnosti a hráte.</p>
      {!server.pripojene && <p className="chyba">Pripájam sa na server…</p>}
      {server.chyba !== null && <p className="chyba">{server.chyba}</p>}
      <div className="lobby-akcie">
        <button disabled={!server.pripojene} onClick={server.create}>
          Založiť miestnosť
        </button>
        <span> alebo </span>
        <input
          placeholder="KÓD"
          maxLength={4}
          value={kodVstup}
          onChange={(e) => setKodVstup(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === "Enter" && kodVstup.length === 4) server.join(kodVstup);
          }}
        />
        <button disabled={!server.pripojene || kodVstup.length !== 4} onClick={() => server.join(kodVstup)}>
          Pripojiť sa
        </button>
      </div>
    </main>
  );
}
