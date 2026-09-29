# NO QUIT AI — Cloud Player (Cloudflare Worker)

Worker: `noquitai` · D1: `noquitai-db` · R2: `noquitai-files` · AI: `@cf/meta/llama-3-8b-instruct`

## Commands
```bash
cd cloud-player
npm install
npm run dev        # local
npm run db:init    # create D1 tables (once)
npm run deploy     # deploy to Cloudflare
```

Build command: `npm run build` · Output directory: `dist`

Before first deploy, replace `database_id` in `wrangler.toml` with the real ID from
`wrangler d1 create noquitai-db`, and create the bucket with `wrangler r2 bucket create noquitai-files`.

## Routes
- `GET /` — dark player page (upload, list, play, share)
- `POST /api/chat` — `{ "message": "..." }`
- `POST /api/upload` — multipart `file`
- `GET /api/files` — list files
- `GET /video/:key` — stream (supports Range)
