# 🏙️ AI Smart City Dashboard

A full-stack, role-based smart city management platform built with **React + TypeScript** (frontend) and **FastAPI + SQLAlchemy** (backend).

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## ✨ Features

| Module | Description |
|--------|-------------|
| **Dashboard** | Real-time weather, AQI, traffic overview for any city |
| **City Map** | Live OpenStreetMap with hospitals, police, fire, pharmacies |
| **Air Quality** | Real AQI data via Open-Meteo Air Quality API |
| **Traffic** | Congestion index, road segments, incidents |
| **Weather** | 7-day forecast, hourly data via Open-Meteo |
| **Water / Flood** | Flood sensor readings and alerts |
| **Complaints** | Citizen complaint submission, tracking, and admin routing |
| **Emergency SOS** | One-tap SOS, nearby services (Overpass API), responder dashboard |
| **Alerts** | Admin creates city-wide alerts; visible on all role panels |
| **Agriculture** | Crop advisor, market listings, government schemes |
| **Role Management** | Fine-grained RBAC: citizen, admin, police, fire, emergency |
| **User Management** | Admin user CRUD, role assignment |

---

## 🧑‍💻 Tech Stack

**Frontend**
- React 18 + TypeScript
- Vite, Tailwind CSS, Framer Motion
- React Leaflet (maps), React Router v6
- JWT auth + Google OAuth

**Backend**
- FastAPI (Python 3.11)
- SQLAlchemy ORM + Alembic migrations
- SQLite (dev/demo) or PostgreSQL (production)
- Pydantic v2, python-jose, passlib

**Infrastructure**
- Docker + Docker Compose
- nginx (SPA routing + API proxy + gzip)
- GitHub Actions ready

---

## 🚀 Quick Start (Docker)

```bash
# 1. Clone the repo
git clone https://github.com/manik-dey-89/ai-smart-city.git
cd ai-smart-city

# 2. Create backend env file
cp backend/.env.example backend/.env
# Edit backend/.env — set a strong SECRET_KEY at minimum

# 3. Build and start all services
docker compose up --build -d

# 4. Open in browser
#   Frontend: http://localhost:3000
#   API docs: http://localhost:8000/docs
#   Health:   http://localhost:8000/api/health
```

To seed an initial admin user:
```bash
docker compose exec backend python seed_auth.py
```

---

## 💻 Local Development (without Docker)

### Backend

```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env   # edit SECRET_KEY etc.

uvicorn main:app --reload --port 8000
# API docs: http://localhost:8000/docs
```

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local  # add VITE_GOOGLE_CLIENT_ID if using Google OAuth

npm run dev
# App: http://localhost:3000
```

---

## 🔑 Default Roles

| Role | Access |
|------|--------|
| `citizen` | Dashboard, Map, Weather, AQI, Traffic, Water, Complaints, Emergency |
| `city_admin` / `admin` | All citizen views + Admin panel, Alerts, User/Role management |
| `police` | Dashboard, Map, Traffic, Emergency, Assigned Cases |
| `fire_service` | Dashboard, Map, Traffic, Emergency, Assigned Cases |
| `emergency` | Dashboard, Map, Traffic, Emergency, Assigned Cases |

---

## 🌍 Deploy to the Cloud

See **[DEPLOY.md](DEPLOY.md)** for step-by-step guides for:
- Docker Compose (any VPS)
- Render.com (free tier)
- Railway
- Ubuntu VPS with nginx + systemd

---

## ⚙️ Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | ✅ | `sqlite:///./smartcity.db` | SQLite or Postgres connection string |
| `SECRET_KEY` | ✅ | — | JWT signing key — generate with `python -c "import secrets; print(secrets.token_hex(32))"` |
| `BACKEND_CORS_ORIGINS` | ✅ | `["*"]` | Comma-separated allowed origins, e.g. `https://myapp.com` |
| `GOOGLE_CLIENT_ID` | optional | — | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | optional | — | Google OAuth Client Secret |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | optional | `30` | JWT access token TTL |
| `REFRESH_TOKEN_EXPIRE_DAYS` | optional | `7` | JWT refresh token TTL |

### Frontend (build-time)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_GOOGLE_CLIENT_ID` | optional | Same Google OAuth Client ID as backend |

---

## 📁 Project Structure

```
ai-smart-city/
├── backend/
│   ├── app/
│   │   ├── routers/        # FastAPI route handlers
│   │   ├── models.py       # SQLAlchemy ORM models
│   │   ├── schemas.py      # Pydantic request/response schemas
│   │   ├── dependencies.py # Auth dependencies (JWT, RBAC)
│   │   ├── security.py     # Password hashing, token logic
│   │   └── config.py       # Settings via pydantic-settings
│   ├── alembic/            # DB migrations
│   ├── main.py             # App entry point
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/          # Route-level page components
│   │   ├── components/     # Shared UI components (Layout, AlertBanner)
│   │   ├── contexts/       # AuthContext, LocationContext
│   │   ├── hooks/          # useRBAC, useGoogleAuth
│   │   └── App.tsx         # Router setup
│   ├── public/             # Static assets (illustrations, backgrounds)
│   ├── nginx.conf          # Production nginx config
│   └── Dockerfile
├── docker-compose.yml      # Full-stack orchestration
├── DEPLOY.md               # Detailed deployment guide
└── README.md
```

---

## 🔒 Security Notes

- `SECRET_KEY` in `docker-compose.yml` is a placeholder — **always override it** in production via `backend/.env` or environment variables.
- `backend/.env` and `frontend/.env.local` are gitignored — never commit real credentials.
- The backend Dockerfile runs as a non-root user (`appuser`).
- nginx sends `X-Frame-Options`, `X-Content-Type-Options`, and `X-XSS-Protection` headers on every response.
- `5432` (Postgres) is exposed in docker-compose for local tooling — remove the `ports:` mapping in production.

---

## 📄 License

MIT © 2025 Manik Dey
