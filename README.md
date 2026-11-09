# MyWallet Reports

Analiză vizuală a extrasului de cont (CSV, format Banca Transilvania / ING) — 100% în browser.
Fișierele parsate stau doar în `localStorage`; nu există server sau backend.

```bash
npm install
npm run dev     # http://localhost:5173
npm test        # teste parser + categorisire
```

### Docker

```bash
docker compose up -d --build   # http://localhost:5660
docker compose down
```

Imaginea construiește aplicația cu Node și o servește static cu nginx (vezi `Dockerfile`, `docker/nginx.conf`).

Structură: `src/lib` (parser CSV, categorisire, analiză, stocare), `src/views` (ecranele), `src/components`.
