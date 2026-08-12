// Autoritatívny herný server — zatiaľ len kostra, aby sa dalo overiť, že
// reťaz nástrojov beží. Obsah predpisuje docs/BRIEF.md (míľnik M7).
//
// Server je jediné miesto, ktoré pozná celý stav hry. Klientovi posiela
// VŽDY len odfiltrovaný pohľad — bez súperovej ruky a bez poradia balíčka.

import { createServer } from "node:http";

const PORT = Number(process.env.PORT ?? 8787);

const http = createServer((_req, res) => {
  res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
  res.end("NA EX server — kostra. Implementáciu predpisuje docs/BRIEF.md (M7).\n");
});

http.listen(PORT, () => {
  console.log(`NA EX server počúva na http://localhost:${PORT}`);
});
