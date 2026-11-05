# Deploy DirhamWise — 100% free, from your phone only

You do **not** need a laptop. Everything below happens in your phone's
browser. Total time: ~15 minutes. Total cost: **$0**.

The stack after deploy:

| Piece | Free service | What it does |
|---|---|---|
| App hosting | **Vercel** (Hobby plan) | Runs the Next.js app + API, free HTTPS + CDN |
| Database | **Neon** (Free plan) | Free Postgres for accounts, cloud backups & rate history |
| Code hosting | **GitHub** (free) | Vercel deploys from your repo |
| Live AED→INR | Free public APIs (no key) | exchangerate-api + currency-api fallback |

---

## Step 0 — Download the project zip

Get `dirhamwise-source.zip` (from this chat's download area) and unzip it.
On Android the Files app unzips with a long-press → *Extract*. On iPhone,
use the Files app → tap the zip. Remember the extracted folder name.

## Step 1 — GitHub: create your repo (5 min)

1. Open **github.com** in Chrome/Safari and sign up / sign in.
2. Tap **+** (top right) → **New repository**.
3. Name: `dirhamwise` · Visibility: **Private** (recommended) · tap **Create repository**.

## Step 2 — Upload the code from your phone (5 min)

The easiest phone-friendly way is **GitHub Codespaces** (free 120 core-hours
per month — this upload takes 2 minutes):

1. On your repo page, tap the green **Code** button → **Codespaces** tab →
   **Create codespace on main**.
2. In the editor's file sidebar, tap **…** (or right-click the folder name) →
   **Upload…** and pick **all files/folders inside the extracted project**
   (the folder that contains `package.json`).
3. In the bottom terminal type:
   ```
   git add -A && git commit -m "DirhamWise initial" && git push
   ```
   (If it asks to publish/sign in, approve — it's GitHub's own OAuth.)
4. You can stop/close the codespace now. Your code is on GitHub.

> Alternative without Codespaces: repo page → **Add file → Upload files** and
> upload the extracted files. Works too, but folder-structured uploads from
> mobile can be fiddly — Codespaces is more reliable.

## Step 3 — Neon: free database (3 min)

1. Open **neon.tech** → **Sign up** (Google login works) → skip the wizard.
2. Create a **Project** (any name). Region: pick the one closest to you.
3. On the dashboard open **Connection Details** and copy **both** strings:
   - **Pooled connection** → this is `DATABASE_URL`
   - Toggle to **Direct connection** → this is `DIRECT_URL`
4. Save both in your notes app. They look like
   `postgresql://user:pass@ep-xxx-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require`.

## Step 4 — Vercel: deploy (5 min)

1. Open **vercel.com** → **Sign up with GitHub** (same account).
2. Tap **Add New… → Project** → **Import** your `dirhamwise` repo.
3. Before pressing Deploy, open **Environment Variables** and add:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | Neon **pooled** string from Step 3 |
   | `DIRECT_URL` | Neon **direct** string from Step 3 |
   | `JWT_SECRET` | any long random text (e.g. 40+ characters) |

4. Tap **Deploy** and wait ~2 minutes. Done — you get a free URL like
   `https://dirhamwise.vercel.app` with HTTPS.

Vercel automatically runs the database migration during the build
(see `vercel.json`), so the tables create themselves. No terminal needed.

## Step 5 — First run

1. Open your Vercel URL on your phone.
2. Complete onboarding, log a test expense.
3. **More → Account & Cloud Sync → Create account** with any email +
   password (min 6 chars). Your ledger is now backed up to *your* Neon DB.
4. Install the app:
   - **Android (Chrome):** ⋮ menu → **Add to Home screen** → *Install*.
   - **iPhone (Safari):** Share → **Add to Home Screen**.
   It runs full-screen, offline-first, like a native app.

## Update the app later

Edit code → push to `main` (GitHub mobile app or Codespaces). Vercel
redeploys automatically on every push.

## Honest limits of the free tier

| Limit | Impact |
|---|---|
| Vercel Hobby: non-commercial use | Fine for personal/family use |
| Neon free: 0.5 GB storage | ~100,000+ user backups; years of usage |
| Neon "scale to zero" | First page load after inactivity takes ~1 s extra |
| Login has no rate limiting / no email verification | Keep the repo private and your URL personal |
| Live AED→INR updates daily (free APIs) | The card refreshes every 5 min, data changes daily |

## Troubleshooting

- **500 on app after deploy** → check Vercel → Deployments → Build Logs; 9/10
  it's a wrong `DATABASE_URL` (must be the **pooled** string with `?sslmode=require`).
- **"Could not reach the cloud"** in the app → Neon DB paused or `DIRECT_URL`
  missing — recheck both env vars, then redeploy.
- **Migration errors** → `prisma migrate deploy` needs `DIRECT_URL` set (the
  direct, non-pooled Neon string).
