# SmartCity Dashboard — Deployment Guide

> **Project root:** `d:\AI Smart City Dashboard\AI Smart City Dashboard`
> **Frontend:** Vite + React + Tailwind CSS → served by nginx
> **Backend:** FastAPI + SQLAlchemy (SQLite default, Postgres recommended for production)

---

## 1. Prerequisites

| Tool | Min version | Notes |
|------|------------|-------|
| Node.js | 18+ | For local frontend build |
| Python | 3.11+ | For local backend run |
| Docker | 24+ | For containerised deploy |
| Docker Compose | v2 | Bundled with Docker Desktop |

---

## 2. Environment Setup

### 2a. Backend environment (`backend/.env`)

Copy the example and fill in real values:

```bash
cp backend/.env.example backend/.env   # if example exists, otherwise create it
```

Required variables:

```env
# Database (use Postgres in production; SQLite works for dev/demo)
DATABASE_URL=postgresql://user:password@host:5432/smartcity
# or for SQLite:
# DATABASE_URL=sqlite:///./smartcity.db

# JWT — generate with: python -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY=your-random-32-byte-hex-secret

# CORS — comma-separated list of your frontend's public URLs
BACKEND_CORS_ORIGINS=https://your-frontend-domain.com,http://localhost:3000

# Google OAuth (optional — remove if not using Google sign-in)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### 2b. Frontend environment (`frontend/.env.production`)

```env
# Your deployed backend URL (documentation only — app uses relative /api path via nginx)
VITE_API_BASE_URL=https://your-backend-url.onrender.com

# Your Google OAuth client ID (REQUIRED if Google sign-in is enabled)
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

---

## 3. Option A — Docker Compose (Recommended)

The simplest full-stack deploy. Runs frontend (nginx), backend (uvicorn), and optionally Postgres.

```bash
# From the project root:
cd "AI Smart City Dashboard"

# Optional: pass Google Client ID as a build arg
export VITE_GOOGLE_CLIENT_ID=your-google-client-id

# Build and start all services
docker compose up --build -d

# Tail logs
docker compose logs -f

# Stop all services
docker compose down
```

Services after startup:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- Health check: http://localhost:8000/api/health

To update after code changes:

```bash
docker compose build && docker compose up -d --no-deps backend frontend
```

---

## 4. Option B — Render.com

### Backend (Web Service)

1. Create a new **Web Service** → connect your GitHub repo.
2. Set **Root Directory** to `backend`.
3. **Build command:** `pip install -r requirements.txt`
4. **Start command:** `bash start.sh`
   - `start.sh` runs `seed.py` (idempotent — skips existing users) then launches uvicorn.
   - This is how default users are created on the free plan (no Shell access needed).
5. Add environment variables (from section 2a) in the Render dashboard.
6. Note the deployed URL (e.g. `https://smartcity-api.onrender.com`).

> **Default credentials created automatically on first deploy:**
>
> | Username | Password | Role |
> |----------|----------|------|
> | `admin` | `Admin@1234` | Admin panel |
> | `citizen` | `Citizen@1234` | Citizen panel |
> | `police` | `Police@1234` | Police panel |
> | `fire` | `Fire@1234` | Fire service panel |
> | `traffic` | `Traffic@1234` | Traffic officer |
> | `emergency` | `Emergency@1234` | Emergency responder |
>
> Change these passwords after first login.

### Frontend (Static Site)

1. Create a new **Static Site** → connect your GitHub repo.
2. Set **Root Directory** to `frontend`.
3. **Build command:** `npm ci && npm run build`
4. **Publish directory:** `dist`
5. Add environment variables:
   - `VITE_API_BASE_URL` = `https://your-backend.onrender.com` (**bare origin — no `/api` suffix**)
   - `VITE_GOOGLE_CLIENT_ID` = your Google OAuth client ID (optional)
6. Add a redirect rule: source `/*`, destination `/index.html`, type **Rewrite**.

### Update CORS

After deploying, update `BACKEND_CORS_ORIGINS` in the backend service to include the Render frontend URL.

---

## 5. Option C — Railway

### Backend

1. Deploy from GitHub, set service root to `backend/`.
2. Railway auto-detects Python; set start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
3. Add all env vars from section 2a.
4. Add a Postgres plugin and copy the `DATABASE_URL` into your env vars.

### Frontend

1. Deploy from GitHub, set service root to `frontend/`.
2. **Build command:** `npm ci && npm run build`
3. **Output directory:** `dist`
4. Add `VITE_GOOGLE_CLIENT_ID`.
5. Add a custom domain or use the Railway-assigned URL.

---

## 6. Option D — VPS / Ubuntu with nginx + systemd

### Backend (systemd service)

```bash
# On the server:
git clone <your-repo> /opt/smartcity
cd /opt/smartcity/backend
python3.11 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env   # fill in real values
```

Create `/etc/systemd/system/smartcity-backend.service`:

```ini
[Unit]
Description=SmartCity Backend
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/opt/smartcity/backend
EnvironmentFile=/opt/smartcity/backend/.env
ExecStart=/opt/smartcity/backend/.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable --now smartcity-backend
```

### Frontend (nginx)

```bash
cd /opt/smartcity/frontend
npm ci
VITE_GOOGLE_CLIENT_ID=xxx npm run build
cp -r dist/* /var/www/smartcity/
```

Create `/etc/nginx/sites-available/smartcity`:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/smartcity;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/smartcity /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

For HTTPS, use Certbot:

```bash
certbot --nginx -d your-domain.com
```

---

## 7. Database

### SQLite (default — dev/demo only)

- No setup required — the file `backend/smartcity.db` is created automatically on first startup.
- For Docker, the file is persisted via the volume in `docker-compose.yml`:
  ```yaml
  - ./backend/smartcity.db:/app/smartcity.db
  ```

### Postgres (recommended for production)

- Set `DATABASE_URL=postgresql://user:pass@host:5432/dbname` in your env.
- Tables are created automatically via `Base.metadata.create_all` on startup — no manual migration needed for initial deploy.
- For schema changes in future releases, run Alembic migrations:
  ```bash
  cd backend
  alembic upgrade head
  ```

---

## 8. Post-Deploy Checklist

- [ ] Update `BACKEND_CORS_ORIGINS` to include the exact frontend production URL (no trailing slash).
- [ ] Set a strong random `SECRET_KEY` (never use the default).
- [ ] Set `VITE_GOOGLE_CLIENT_ID` if Google OAuth sign-in is enabled.
- [ ] Add the frontend production URL to the **Authorised JavaScript origins** in Google Cloud Console.
- [ ] Test login (email/password).
- [ ] Test Google sign-in.
- [ ] Test the City Map (tiles load, markers appear).
- [ ] Test the Emergency SOS flow (submits, appears in admin panel).
- [ ] Verify `https://your-domain.com/api/health` returns `{"status":"healthy"}`.

---

## 9. Environment Variable Reference

| Variable | Service | Required | Description |
|----------|---------|----------|-------------|
| `DATABASE_URL` | backend | ✅ | SQLite or Postgres connection string |
| `SECRET_KEY` | backend | ✅ | JWT signing key — min 32 random chars |
| `ALGORITHM` | backend | no | JWT algorithm, default `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | backend | no | Default `30` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | backend | no | Default `7` |
| `BACKEND_CORS_ORIGINS` | backend | ✅ | Comma-separated allowed origins |
| `GOOGLE_CLIENT_ID` | backend | no | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | backend | no | Google OAuth client secret |
| `VITE_API_BASE_URL` | frontend (build) | no | Deployed backend URL (docs only) |
| `VITE_GOOGLE_CLIENT_ID` | frontend (build) | ✅* | Google OAuth client ID for frontend |

*Required if Google sign-in is enabled.
