# Your own Casey server

A self-built 900words does not need this. With your own AI key, Casey's logic
runs inside the app. A Casey server is the other way round: the same logic
runs on a Cloudflare Worker, which holds your AI key as a secret, and the app
asks it for every clue and guess. It is how the App Store version works.

It is useful when you play on several devices and would rather keep your key
in one place. It is still for your own use: see
[CURRICULUM-LICENSE.md](../CURRICULUM-LICENSE.md).

## What it costs

- **Cloudflare Workers Paid** (about $5 a month). The free plan allows 10 ms of
  CPU per request, and Casey's clues measure 38 to 99 ms. On the free plan
  Cloudflare stops the Worker mid-request, and the app reports a dropped
  connection.
- Your AI service's own charges, as with your own key.

## Deploy it

You need Node.js 22 or newer, this repository with `npm ci` done, and a
Cloudflare account.

1. Sign in:

   ```bash
   cd proxy
   npx wrangler login
   ```

2. In `proxy/wrangler.toml`, set `name` to a Worker name of your own.
   `ALLOWED_ORIGIN` lists who may use the Worker: the iPhone app
   (`capacitor://localhost`) and `npm run dev` and `npm run preview`
   (`http://localhost:5173`, `http://localhost:4173`). Add the address of any
   other place you serve the app from.
3. Create the storage the Worker uses to count requests, and add the id it
   prints to `wrangler.toml` as a `[[kv_namespaces]]` block with
   `binding = "QUOTA"`:

   ```bash
   npx wrangler kv namespace create QUOTA
   ```

   Without it the Worker still runs, with no limit on requests.
   `DAILY_CAP` (per device, default 1000) and `GLOBAL_DAILY_CAP` (in total,
   default 25000) set the limits. Set a spending limit at your AI service
   too.
4. Deploy, then give the Worker your AI key:

   ```bash
   npx wrangler deploy
   npx wrangler secret put OLLAMA_API_KEY
   ```

   Wrangler asks for the key; it is never written to a file. `deploy` prints
   the Worker's address, such as `https://my-casey-worker.you.workers.dev`.

The Worker uses Ollama Cloud's `gpt-oss:120b`, as the App Store version does.
To use another OpenAI-compatible service, change `MODEL_ALIASES` in
`wrangler.toml`; `proxy/README.md` describes its fields, including the name of
the secret that holds that service's key.

## Point the app at it

Either in the app, under **Settings → Casey's AI → Your own Casey server**:
enter the Worker's address followed by `/v1`, then tap **Test connection**.

Or when you build, so the app starts with it:

```bash
SELF_HOSTED_CASEY_URL=https://my-casey-worker.you.workers.dev/v1 npm run build
```

`npm run ios` takes the same variable. The app refuses 900words' own server.

## Good to know

- `npx wrangler deploy --dry-run --outdir=out` builds the Worker without
  publishing it.
- Requests carry a random installation ID, for the per-device limit. It is not
  an account.
- Anonymous usage counters go to your Worker unless a player turns them off in
  Settings; it stores them in the `STATS` Analytics Engine dataset.
  Optional data sharing needs a `DATA_SHARING` KV namespace, and is off without
  one.
- Cloudflare's dashboard shows one log line per decision under
  **Workers → your Worker → Logs**.
