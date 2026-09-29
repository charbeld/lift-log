# Lift Log

iPhone web app (PWA) for the 3-day full-body program (Day A / B / C from
`Improved_3Day_Workout_Program_1.xlsx`).

- Log weight + reps per set, pre-filled from last time, with double-progression suggestions
- Rest timer that starts when you tick a set; lock-screen alert via Web Push
- Program notes and form cues on every exercise, per-exercise and per-workout notes, pinned notes
- Week number from the program start date; history by workout and a week-by-week grid
- Progress: top weight, estimated 1RM, volume per exercise, weekly volume, consistency calendar
- Edit the program: sets, reps, rest, weight jump, swaps from the spreadsheet's swap table
- Works offline; syncs to Supabase (Google sign-in) when online

## Layout

| Path | What |
| --- | --- |
| `docs/` | The app (static, no build step). Served by GitHub Pages from `/docs`. |
| `docs/config.js` | Public config: Supabase URL + anon key, push Worker URL, VAPID public key. |
| `supabase/schema.sql` | Tables + row level security. Run once in the Supabase SQL editor. |
| `worker/` | Cloudflare Worker + Durable Object that sends the rest-over push at the right second. |

## Setup

1. **Supabase**: create a free project, run `supabase/schema.sql` in the SQL editor, copy
   the project URL and anon key into `docs/config.js` and `worker/wrangler.toml`.
2. **Google sign-in**: in Google Cloud Console create an OAuth client (Web application) with
   redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`. In Supabase →
   Authentication → Sign In / Providers → Google, paste the client ID and secret.
   In Authentication → URL Configuration set Site URL to the app URL and add it (plus
   `http://localhost:5178`) to Redirect URLs.
3. **Push Worker**: `cd worker && node gen-vapid.mjs` (once; the public key goes in
   `docs/config.js` and `wrangler.toml`), then
   `npx wrangler login`, `npx wrangler deploy`,
   `npx wrangler secret put VAPID_PRIVATE_JWK < .vapid-private.json`.
   Put the Worker URL in `docs/config.js` → `pushUrl`.
4. **Hosting**: push to GitHub, Settings → Pages → Deploy from branch `main`, folder `/docs`.
5. **iPhone**: open the site in Safari → Share → Add to Home Screen. Open it from the Home
   Screen, sign in, then Settings → Lock-screen alerts → Enable.

Bump `VERSION` in `docs/sw.js` on each deploy so phones pick up the new files.

## Tests

`cd worker && npm i --no-save http_ece && node test/webpush.test.mjs` checks the push payload
encryption against the reference implementation and verifies the VAPID signature.
