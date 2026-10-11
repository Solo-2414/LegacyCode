# Deploying TechIs QuizApp for $0

| Piece | Service | Cost | Card needed? |
|---|---|---|---|
| Frontend (Next.js) | **Vercel** (Hobby plan) | Free | No |
| Backend (Express + Socket.IO) | **Render** (Free web service) | Free | No |
| Database (PostgreSQL) | **Supabase** (Free plan) | Free | No |
| Keep-alive pinger | **UptimeRobot** (Free plan) | Free | No |

No custom domain is needed. The website sends its sign-in token to the API directly, so the two can live on
their default `*.vercel.app` and `*.onrender.com` addresses.

## 1. Put the code on GitHub
Commit everything and push. Both apps are in one repo; each service below points at its own folder.

## 2. Create the session secret
Generate one random secret. You will paste the SAME value into Render and Vercel:

    node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"

## 3. Database (Supabase)
1. In your Supabase project click **Connect** and copy the **Session pooler** connection string.
   Replace `[YOUR-PASSWORD]` with your database password.
2. On your computer, in `tech-is-quiz-app-backend`, create a `.env` file with `DATABASE_URL=<that string>`, then:

       pnpm install
       pnpm migrate:postgres

3. Create the super admin (one time):

       SUPERADMIN_EMAIL=you@example.com SUPERADMIN_NAME="Your Name" SUPERADMIN_PASSWORD='a-long-password-12+' pnpm seed:superadmin

   (PowerShell: set each variable first, for example `$env:SUPERADMIN_PASSWORD="..."`.)

## 4. Backend (Render), deploy this first
1. render.com -> New -> **Web Service** -> connect the GitHub repo.
2. Settings:
   - **Root Directory**: `tech-is-quiz-app-backend`
   - **Runtime**: Node
   - **Build Command**: `pnpm install --frozen-lockfile`
   - **Start Command**: `pnpm start`
   - **Instance Type**: Free
   - **Health Check Path**: `/health`
3. Environment variables:
   - `DATABASE_URL` = the Supabase string
   - `AUTH_SECRET` = the secret from step 2
   - `FRONTEND_URL` = a placeholder for now (you set the real value in step 6)
   - `NODE_VERSION` = `22`
4. Deploy. When it finishes, open `https://<your-service>.onrender.com/health`.
   You should see `{"status":"ok","database":"ok"}`.

## 5. Frontend (Vercel)
1. vercel.com -> Add New -> Project -> import the repo -> **Root Directory**: `tech-is-quiz-app-frontend`.
2. Environment Variables:
   - `NEXT_PUBLIC_API_URL` = `https://<your-service>.onrender.com` (no trailing slash)
   - `AUTH_SECRET` = the same secret as the backend
3. Deploy and note the production URL, for example `https://techis-quiz.vercel.app`.
   (`NEXT_PUBLIC_API_URL` is baked in at build time, so redeploy if you ever change it.)

## 6. Connect them
Back in Render, set `FRONTEND_URL` to your exact Vercel production URL (no trailing slash), then redeploy.
Players must use that same URL.

## 7. Keep it awake (important on free tiers)
Render's free service goes to sleep after 15 minutes without traffic, and Supabase's free project pauses after
a week without activity. One free monitor fixes both, because `/health` also touches the database:
1. uptimerobot.com -> create a free account -> **Add New Monitor**
2. Type: HTTP(s). URL: `https://<your-service>.onrender.com/health`. Interval: the shortest the free plan offers (about 5 minutes).

## 8. Test checklist
- [ ] Sign in as the super admin, then create a host account and a few player accounts
- [ ] Host: create a quiz, open a room, copy the player link
- [ ] Two phones on mobile data (not your Wi-Fi) join, answer, and see the leaderboard
- [ ] Tap "Sound on" and confirm the sounds play
- [ ] Check `/health` still says ok the next morning (proves the keep-alive works)

## 9. Free-tier limits you must plan around
- **Render may restart a free service at any time.** Live game rooms are held in memory, so a restart ends a game
  in progress. This is why the room-persistence work is the next priority.
- **Bandwidth is capped at about 5 GB a month on Render's free tier** (reduced in April 2026). Each answer currently
  sends the whole room state to every player, so a 100-player game could use a lot. Trimming that is part of the next work.
- **First request after a sleep or restart can take a minute** while the server wakes up. Open the site a few minutes
  before the event starts.
- **Never push or redeploy while a game is running.**
- **Backup plan for the event day:** the backend also runs on any laptop (`pnpm start`), so you can host from one if
  the free tier misbehaves.

Limits and prices change, so confirm them on each service's current pricing page before the event.
