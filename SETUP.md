# CareNest: setup

Steps to get CareNest running. Secrets go in `.env.local` (on your laptop) and in Vercel's settings. Never in chat or GitHub.

## 1. Supabase (database, login, photos)
1. supabase.com > New project `carenest`, region Mumbai (ap-south-1).
2. SQL Editor > New query > paste all of `supabase/migrations/0001_init.sql` > Run.
3. Project Settings > API: copy the Project URL, the `anon` key and the `service_role` key into `.env.local`.

## 2. Google login
1. Google Cloud Console > APIs & Services > Credentials > Create OAuth client ID > Web application.
2. Authorised redirect URI: the callback URL shown in Supabase > Authentication > Providers > Google.
3. Paste the Client ID and Client Secret into that Supabase Google provider page and turn it on.
4. Supabase > Authentication > URL Configuration: Site URL `http://localhost:3000` for now (later `https://carenestapp.vercel.app`), and add both to Redirect URLs as `.../auth/callback`.

## 3. Gemini
aistudio.google.com > Get API key > create one > `GEMINI_API_KEY` in `.env.local`. On the free tier Google may use what is sent to improve its products; use a key with billing on before real families test.

## 4. WhatsApp (Meta)
1. Meta app > WhatsApp > API Setup: generate a token > `WHATSAPP_TOKEN`. (The test token lasts 24 hours.)
2. App settings > Basic > App secret > `WHATSAPP_APP_SECRET`.
3. Make up a long random `WHATSAPP_VERIFY_TOKEN`.
4. After the app is live: WhatsApp > Configuration > Webhook: URL `https://carenestapp.vercel.app/api/whatsapp`, verify token = the one above, subscribe to `messages`.
5. Add the parent's and the child's numbers to the test number's recipient list (5 numbers max).

## 5. Run locally
```bash
cp .env.example .env.local
npm install
npm run dev
```
Open http://localhost:3000. WhatsApp can't reach your laptop, so the bot is tested once the app is on Vercel.

## 6. Scheduler (after it is live on Vercel)
1. Make up a long random `CRON_SECRET` and add it to Vercel.
2. Supabase > SQL Editor: paste `supabase/schedule.sql`, replace `REPLACE_WITH_CRON_SECRET` with it, and run. Don't commit the real secret.

## Checks
```bash
npm test
npm run lint
npm run build
```
