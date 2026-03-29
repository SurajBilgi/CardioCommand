# CardioCommand — Deployment Guide

## Overview

You will deploy **3 separate services**:

| # | Service | Platform | Time |
|---|---------|----------|------|
| 1 | `backend/` — FastAPI API | **Railway** | ~5 min |
| 2 | `apps/md-dashboard/` — Doctor UI | **Vercel** | ~3 min |
| 3 | `apps/patient-app/` — Patient UI | **Vercel** | ~3 min |

**Do them in this order** — the Vercel deployments need the Railway URL first.

---

## Prerequisites

- Your code must be pushed to a **GitHub repository** (both Vercel and Railway connect via GitHub)
- If you haven't done this yet:
  ```bash
  cd /path/to/cardiocommand
  git init
  git add .
  git commit -m "initial commit"
  # Create a new repo on github.com, then:
  git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
  git push -u origin main
  ```

---

## Part 1 — Deploy Backend on Railway

### Step 1 — Create a Railway account
1. Go to **[railway.app](https://railway.app)**
2. Click **"Login"** → **"Login with GitHub"**
3. Authorize Railway to access your GitHub

### Step 2 — Create a new project
1. Once logged in, click the **"New Project"** button (top right)
2. Click **"Deploy from GitHub repo"**
3. You'll see a list of your GitHub repos — find and click your CardioCommand repo
4. Click **"Deploy Now"**

Railway will start building. It will probably **fail** right now — that's expected. Continue to the next step.

### Step 3 — Set the Root Directory to `backend`
This is the most important step. Railway needs to know the app is inside the `backend/` folder.

1. On the Railway dashboard, click on the **service card** (the box showing your deployment)
2. Click the **"Settings"** tab at the top
3. Scroll down to find **"Source"** section
4. Look for **"Root Directory"** — click the pencil/edit icon next to it
5. Type: `backend`
6. Press **Enter** or click the checkmark to save

### Step 4 — Add environment variables
1. Still in your service, click the **"Variables"** tab at the top
2. Click **"New Variable"** and add each of the following one by one:

| Variable Name | Value |
|--------------|-------|
| `OPENAI_API_KEY` | `sk-proj-deWMzj...` (your full key from `backend/.env`) |
| `VAPI_API_KEY` | `801b5f35-...` (your full key from `backend/.env`) |
| `VAPI_PHONE_NUMBER_ID` | leave blank or add your value |
| `VAPI_VOICE_ID` | `EXAVITQu4vr4xnSDxMaL` |
| `DEMO_MODE` | `true` |
| `LOG_LEVEL` | `info` |

> To add each variable: type the name in the left box, the value in the right box, then click the **"+"** button or press Enter.

### Step 5 — Trigger a redeploy
1. Click the **"Deployments"** tab
2. Click the **three dots (⋯)** next to the latest deployment
3. Click **"Redeploy"**
4. Wait 2–3 minutes for the build to finish (watch the logs)

### Step 6 — Get your public URL
1. Click the **"Settings"** tab
2. Scroll to **"Networking"** section
3. Click **"Generate Domain"** (if no domain exists yet)
4. Copy the URL — it will look like: `https://cardiocommand-production.up.railway.app`

**Save this URL — you need it for the next parts.**

---

## Part 2 — Deploy MD Dashboard on Vercel

### Step 1 — Create a Vercel account
1. Go to **[vercel.com](https://vercel.com)**
2. Click **"Sign Up"** → **"Continue with GitHub"**
3. Authorize Vercel

### Step 2 — Import the project
1. On the Vercel dashboard, click **"Add New…"** → **"Project"**
2. Under **"Import Git Repository"**, find your CardioCommand repo and click **"Import"**

### Step 3 — Configure the project (CRITICAL)
You'll see a **"Configure Project"** screen. Fill it in exactly like this:

| Field | Value |
|-------|-------|
| **Project Name** | `cardiocommand-md-dashboard` (or anything you like) |
| **Root Directory** | Click **"Edit"** → type `apps/md-dashboard` → click **"Continue"** |
| **Framework Preset** | Should auto-detect as **Vite** — leave it |
| **Build Command** | Leave as default (`vite build` or `npm run build`) |
| **Output Directory** | Leave as default (`dist`) |

> ⚠️ Setting **Root Directory** to `apps/md-dashboard` is what fixes the `npm install` error. Without this, Vercel looks for `package.json` in the wrong folder.

### Step 4 — Add environment variables
Still on the **"Configure Project"** screen, scroll down to **"Environment Variables"**.

Add these 4 variables (click **"Add"** after each one):

| Name | Value |
|------|-------|
| `VITE_API_BASE_URL` | `https://YOUR-RAILWAY-URL.up.railway.app` |
| `VITE_WS_BASE_URL` | `wss://YOUR-RAILWAY-URL.up.railway.app` |
| `VITE_VAPI_PUBLIC_KEY` | `efd69062-5a08-4a79-97b3-2087a30537d9` |
| `VITE_DEMO_MODE` | `true` |

> Replace `YOUR-RAILWAY-URL` with the actual URL from Part 1, Step 6.
> Note: `VITE_WS_BASE_URL` uses `wss://` (not `https://`) — same host, different scheme.

### Step 5 — Deploy
1. Click the **"Deploy"** button
2. Wait ~1 minute for the build
3. Vercel will show a **"Congratulations!"** screen with your live URL
4. Your MD Dashboard URL will look like: `https://cardiocommand-md-dashboard.vercel.app`

---

## Part 3 — Deploy Patient App on Vercel

Repeat Part 2 with one difference in Step 2: you need to import the **same GitHub repo again** as a second Vercel project.

### Step 1 — Import again
1. On Vercel dashboard, click **"Add New…"** → **"Project"**
2. Find the same CardioCommand repo and click **"Import"**

### Step 2 — Configure
| Field | Value |
|-------|-------|
| **Project Name** | `cardiocommand-patient-app` |
| **Root Directory** | Click **"Edit"** → type `apps/patient-app` → click **"Continue"** |
| **Framework Preset** | Vite (auto-detected) |

### Step 3 — Add environment variables
Same 4 variables as Part 2:

| Name | Value |
|------|-------|
| `VITE_API_BASE_URL` | `https://YOUR-RAILWAY-URL.up.railway.app` |
| `VITE_WS_BASE_URL` | `wss://YOUR-RAILWAY-URL.up.railway.app` |
| `VITE_VAPI_PUBLIC_KEY` | `efd69062-5a08-4a79-97b3-2087a30537d9` |
| `VITE_DEMO_MODE` | `true` |

### Step 4 — Deploy
Click **"Deploy"** and wait ~1 minute.

---

## Part 4 — Seed Demo Data

The first time Railway starts, the database is empty. Run the seed script to populate it with demo patients.

1. In Railway, click on your service → **"Settings"** tab
2. Scroll to **"Deploy"** section → find **"Start Command"**
3. Or just call this endpoint once after deploy:

```
POST https://YOUR-RAILWAY-URL.up.railway.app/demo/set-scenario
Body: {"patient_id": "john-mercer", "scenario_key": "early_warning"}
```

You can do this from your browser console on the deployed MD Dashboard, or use a tool like [hoppscotch.io](https://hoppscotch.io).

---

## Your Live URLs

| App | URL | Demo Link |
|-----|-----|-----------|
| MD Dashboard | `https://cardiocommand-md-dashboard.vercel.app` | Add `?demo=true` |
| Patient App | `https://cardiocommand-patient-app.vercel.app` | Add `?demo=true` |
| API | `https://YOUR-RAILWAY-URL.up.railway.app` | `/docs` for Swagger |

---

## Troubleshooting

### "npm install exited with 1" on Vercel
**Root Directory is not set.** Go to your Vercel project → **Settings → General → Root Directory** → set to `apps/md-dashboard` or `apps/patient-app` → Save → Redeploy.

### Railway build fails
- Check that **Root Directory** in Railway Settings is exactly `backend` (no slash)
- Check the build logs for the specific error

### Frontend shows mock/demo data, not real data
The `VITE_API_BASE_URL` env var is wrong or missing.
- Go to Vercel project → **Settings → Environment Variables**
- Make sure `VITE_API_BASE_URL` is set to your Railway URL (with `https://`, no trailing slash)
- After changing env vars, you must **redeploy**: Vercel → Deployments → Redeploy

### CORS error in browser console
The backend allows all origins by default (`allow_origins=["*"]`), so this shouldn't happen. If it does, check that your Railway deployment is actually running (not crashed).

### Railway service keeps crashing
Check the logs in Railway → **Deployments** → click the deployment → **View Logs**.
Common causes: missing `OPENAI_API_KEY`, or the FAISS index build failing on first run.
