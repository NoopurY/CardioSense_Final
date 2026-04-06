# Frontend

CardioSense frontend and API routes are implemented in this Next.js application.

## Local development

1. Install dependencies: npm install
2. Start dev server: npm run dev
3. Open: http://localhost:3000

## Environment

Required values in .env.local:

- SECRET_KEY
- MONGODB_URI

Optional values:

- MONGODB_DB (defaults to cardiosense)
- CORS_ORIGINS
- ML_SERVICE_URL (defaults to local fallback if not set)

## ML service (optional, recommended)

Run Python ML API on port 8000:

1. `cd ../ml_model`
2. `python -m venv .venv`
3. `.venv\\Scripts\\activate`
4. `pip install -r requirements.txt`
5. `python service.py`

Then set `ML_SERVICE_URL=http://localhost:8000` in `frontend/.env.local`.

`service.py` runs in fallback mode if scientific dependencies/model are unavailable.

## Useful docs

- Next.js docs: https://nextjs.org/docs
