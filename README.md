<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run CentralSaathi locally

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/1d981f4b-9dce-4a56-8460-a2ca4d0d1c33

## Run Locally

**Prerequisites:** Python 3.10+ and Node.js/npm


1. Install dependencies:
   `python -m pip install -r requirements.txt`
2. Copy `.env.example` to `.env` and set `GEMINI_API_KEY`, `VITE_GOOGLE_MAPS_API_KEY`, and `GOOGLE_MAPS_API_KEY`. Enable Gemini API, Google Maps JavaScript API, and Routes API in Google Cloud. Restrict the browser key to this site's referrer and the server key to Routes API. Google Maps Platform billing may apply.
   Without `GEMINI_API_KEY`, train times are checked locally against the bundled timetable. Without Google keys, the map uses bundled station coordinates and Google route geometry is unavailable.
   If you run the Django scaffold in `central_saathi_project/`, set `DJANGO_SECRET_KEY` in the process environment before starting it; the Django settings do not load `.env` automatically.
3. Run the app on `http://localhost:3000`:
   `npm run dev`

## Team Member Based File Mapping

Based on the team structure in the provided image, the project files are divided by owner and area.

### 1. Backend Team
Owner(s): Manish, Jayesh

Files:
- `backend/analytics_engine.py`
- `backend/timetable_engine.py`
- `backend/database.py`
- `backend/scrapers.py`
- `backend/railway_scraper.py`
- `backend/railway_analytics.py`
- `app.py`
- `central_saathi.py`

### 2. API Team
Owner(s): Manish

Files:
- `backend/app.py`
- `server.js`
- `app.js`
- `metadata.json`

### 3. Server Team
Owner(s): Jayesh, Arnav

Files:
- `server/live_tracker.py`
- `server/live_trains_engine.py`
- `server/route_engine.py`
- `server/train_tracker.py`
- `server/railway_db.py`
- `Procfile`
- `requirements.txt`

### 4. Data Team
Owner(s): Viraj, Arnav

Files:
- `data/`
- `server/timetable_importer.py`
- `server/timetable_validator.py`
- `backend/railway.db`
- `server/central_saathi.db`
- `server/railway.db`

### 5. Frontend Team
Owner(s): Manish

Files:
- `index.html`
- `public/`
- `app.js`
- `server.js`

### 6. Project Setup / Infra
Owner(s): Shared

Files:
- `package.json`
- `package-lock.json`
- `bun.lock`
- `.env.example`
- `.gitignore`
- `README.md`
- `central_saathi_project/`

This mapping follows the ownership structure shown in the image and helps assign each part of the codebase to the correct team member or team group.
