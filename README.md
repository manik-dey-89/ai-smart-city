<div align="center">

# 🏙️ AI Smart City Dashboard

**A full-stack, role-based smart city management platform**

Real-time monitoring of weather, air quality, traffic, flood levels, emergencies,
complaints, and city-wide alerts — built for citizens, administrators, and emergency responders.

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.2-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)](https://www.python.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://www.docker.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[Live Demo](#) · [API Docs](http://localhost:8000/docs) · [Deploy Guide](DEPLOY.md)

</div>

---

## 📸 Screenshots

| Citizen Dashboard | Emergency Command Center | City Map |
|:-:|:-:|:-:|
| Real-time weather, AQI & traffic | One-tap SOS + nearby services | Two-phase live OSM map |

| Admin Alert Center | Complaint Tracker | Air Quality |
|:-:|:-:|:-:|
| City-wide alert broadcast | Full lifecycle tracking | Live AQI + pollutant breakdown |

---

## ✨ Features

### 🌆 Citizen Panel
| Page | What it does |
|------|-------------|
| **Dashboard** | City search, real-time weather (Open-Meteo), AQI, traffic congestion summary |
| **Live City Map** | Interactive OpenStreetMap with two-phase loading — DB pins appear instantly, Overpass OSM facilities (hospitals, police, fire, pharmacies, banks, schools…) load in the background. Mirror-raced across 3 public Overpass servers |
| **Air Quality** | Live PM2.5, PM10, O₃, NO₂, AQI index and hourly chart via Open-Meteo AQ API |
| **Traffic** | Real-time congestion index, road segments, incident list, hourly forecast |
| **Weather** | 7-day forecast, hourly precipitation/wind, UV index via Open-Meteo |
| **Water / Flood** | Flood sensor readings, water level alerts |
| **Complaints** | Submit, track, and get status updates on city complaints with image support |
| **Emergency SOS** | One-tap emergency categories (Medical, Fire, Police, Flood, Gas Leak…), nearby services via Overpass API with direct fallback, responder ETA |
| **Agriculture** | Crop advisor, market price listings, government scheme browser |
| **Profile** | Account management, password change |

### 🛡️ Admin Panel
| Page | What it does |
|------|-------------|
| **Admin Dashboard** | Stats overview: complaints, emergencies, incidents, users |
| **Complaint Management** | Review, approve, reject, route complaints to departments |
| **Emergency Management** | Monitor all SOS requests, update status, assign responders |
| **Alert Command Center** | Create city-wide alerts (Traffic / Weather / Emergency / Flood / Air Quality / General) with severity levels — broadcast to **all role panels** via live AlertBanner |
| **User Management** | Create/edit/deactivate users, assign roles |
| **Role Management** | Define roles, attach granular permissions (RBAC) |

### 🚔 Officer / Responder Panel
| Role | Dedicated view |
|------|---------------|
| **Police** | Police Command Center — assigned cases, crime reports |
| **Fire Service** | Fire Command Center — assigned incidents, dispatch |
| **Emergency Responder** | Emergency Responder Center — active SOS queue |
| **Traffic Officer** | Officer Complaints — assigned traffic/road cases |

---

## 🏗️ Architecture

```
Browser
  │
  ├── React 18 + TypeScript (Vite)
  │     ├── Tailwind CSS + Framer Motion
  │     ├── React Leaflet (maps)
  │     ├── React Router v6 (SPA routing)
  │     └── JWT + Google OAuth (@react-oauth/google)
  │
  └── nginx  ──/api/*──►  FastAPI (Python 3.11, uvicorn)
                              ├── SQLAlchemy ORM
                              ├── Alembic migrations
                              ├── pydantic-settings config
                              ├── python-jose JWT
                              ├── passlib bcrypt
                              └── httpx (Overpass / Open-Meteo / Nominatim)
                                        │
                              SQLite (dev) │ PostgreSQL (prod)
```

---

## 🧰 Tech Stack

### Frontend
| Library | Version | Purpose |
|---------|---------|---------|
| React | 18.2 | UI framework |
| TypeScript | 5.2 | Type safety |
| Vite | 5.1 | Build tool & dev server |
| Tailwind CSS | 3.4 | Utility-first styling |
| Framer Motion | 11 | Animations & transitions |
| React Leaflet | 4.2 | Interactive maps (OpenStreetMap) |
| React Router | 6.22 | Client-side routing |
| React Icons | 5 | Icon set (Feather icons) |
| Chart.js + react-chartjs-2 | 4.4 | Data visualisation charts |
| @react-oauth/google | 0.12 | Google One-Tap OAuth |
| socket.io-client | 4.7 | Real-time socket support |
| Axios | 1.6 | HTTP client |

### Backend
| Library | Version | Purpose |
|---------|---------|---------|
| FastAPI | 0.109 | REST API framework |
| Uvicorn | 0.27 | ASGI server |
| SQLAlchemy | 2.0 | ORM |
| Alembic | 1.13 | DB migrations |
| Pydantic-settings | 2.1 | Config via environment |
| python-jose | 3.3 | JWT encode / decode |
| passlib[bcrypt] | 1.7 | Password hashing |
| httpx | 0.27 | Async HTTP (Overpass, Open-Meteo) |
| psycopg2-binary | 2.9 | PostgreSQL driver |
| geoalchemy2 | 0.14 | PostGIS geometry types |
| google-auth | 2.29 | Google OAuth token verification |

### External APIs (all free, no key required unless noted)
| API | Used for |
|-----|---------|
| [Open-Meteo](https://open-meteo.com) | Weather + Air Quality |
| [Nominatim / OSM](https://nominatim.openstreetmap.org) | Geocoding + reverse geocoding |
| [Overpass API](https://overpass-api.de) | Nearby POI (hospitals, police, fire…) — 3 mirrors raced |
| [Google OAuth](https://console.cloud.google.com) | Social login (optional) |

---

## 🚀 Quick Start

### Option A — Docker Compose (recommended)

```bash
# 1. Clone
git clone https://github.com/manik-dey-89/ai-smart-city.git
cd ai-smart-city

# 2. Configure backend
cp backend/.env.example backend/.env
# Open backend/.env and set a strong SECRET_KEY:
#   python -c "import secrets; print(secrets.token_hex(32))"

# 3. (Optional) set Google OAuth client ID
#    Set VITE_GOOGLE_CLIENT_ID in frontend/.env.production

# 4. Build & run
docker compose up --build -d

# 5. Seed initial admin + roles
docker compose exec backend python seed_auth.py
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| Swagger docs | http://localhost:8000/docs |
| Health check | http://localhost:8000/api/health |

---

### Option B — Local Development

**Backend**
```bash
cd backend

# Create and activate virtualenv
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS / Linux

# Install dependencies
pip install -r requirements.txt

# Configure
cp .env.example .env
# Edit .env — set SECRET_KEY at minimum

# Run (with live reload)
uvicorn main:app --reload --port 8000
# Swagger: http://localhost:8000/docs
```

**Frontend**
```bash
cd frontend

npm install

# (Optional) add Google OAuth client ID
cp .env.local.example .env.local
# Edit .env.local → VITE_GOOGLE_CLIENT_ID=your-client-id

npm run dev
# App: http://localhost:3000
```

---

## 🔑 Roles & Permissions

| Role | Panel | Key capabilities |
|------|-------|-----------------|
| `citizen` | Citizen Panel | Dashboard, Map, Weather, AQI, Traffic, Water, Complaints, Emergency SOS |
| `city_admin` | Admin Panel | Everything + Alerts, Complaint routing, Emergency management, User & Role CRUD |
| `super_admin` | Admin Panel | Same as city_admin + full system access |
| `police` | Officer Panel | City Map, Traffic, Emergency, Assigned Cases, Police Command Center |
| `fire_service` | Officer Panel | City Map, Traffic, Emergency, Assigned Cases, Fire Command Center |
| `emergency` | Officer Panel | City Map, Traffic, Emergency, Emergency Responder Center |
| `traffic_officer` | Officer Panel | City Map, Traffic, Assigned traffic/road cases |

> Permissions are stored in the DB and enforced server-side via `get_current_admin_user` / `get_current_active_user` dependencies.

---

## 📡 API Overview

All endpoints are prefixed and grouped. Full interactive docs at `/docs`.

| Prefix | Description |
|--------|-------------|
| `POST /api/auth/login` | JWT login, returns access + refresh tokens |
| `POST /api/auth/refresh` | Refresh access token |
| `GET  /api/citizen/dashboard` | Real-time city dashboard data |
| `GET  /api/citizen/weather` | Open-Meteo weather for any location |
| `GET  /api/citizen/aqi` | Open-Meteo air quality |
| `GET  /api/citizen/traffic` | Congestion model + road segments |
| `POST /api/citizen/emergency` | Submit SOS request |
| `GET  /api/citizen/alerts` | Active city-wide alerts (all roles) |
| `GET  /api/map/db-markers` | Instant DB-only map markers (<50 ms) |
| `GET  /api/map/markers` | Full map markers: DB + Overpass OSM |
| `GET  /api/complaints` | List complaints (citizen sees own) |
| `POST /api/complaints` | Submit new complaint |
| `GET  /api/admin/stats` | Admin dashboard statistics |
| `GET  /api/admin/alerts` | Manage city-wide alerts |
| `POST /api/admin/alerts` | Create new city-wide alert |
| `GET  /api/admin/complaints` | All complaints with admin controls |
| `GET  /api/admin/emergencies` | All SOS requests |
| `GET  /api/agriculture/...` | Crops, market listings, schemes |

---

## 📁 Project Structure

```
ai-smart-city/
│
├── backend/
│   ├── app/
│   │   ├── routers/
│   │   │   ├── auth.py          # JWT login, register, refresh, password reset
│   │   │   ├── google_auth.py   # Google OAuth token verification
│   │   │   ├── citizen.py       # Dashboard, weather, AQI, traffic, SOS, alerts
│   │   │   ├── admin.py         # Admin stats, complaints, emergencies, alerts CRUD
│   │   │   ├── map.py           # City map markers (DB + Overpass, mirror-raced)
│   │   │   ├── complaints.py    # Complaint lifecycle
│   │   │   ├── users.py         # User CRUD
│   │   │   ├── roles.py         # Role & permission management
│   │   │   ├── agriculture.py   # Crops, market, schemes
│   │   │   ├── contact.py       # Contact messages
│   │   │   ├── dashboard.py     # Legacy dashboard stats
│   │   │   └── weather.py       # Weather (legacy)
│   │   ├── models.py            # SQLAlchemy ORM models (30+ tables)
│   │   ├── schemas.py           # Pydantic v2 request/response schemas
│   │   ├── dependencies.py      # Auth guards (get_current_user, get_current_admin_user)
│   │   ├── security.py          # JWT encode/decode, password hashing
│   │   └── config.py            # pydantic-settings (reads .env)
│   ├── alembic/                 # DB migration scripts
│   ├── main.py                  # FastAPI app + router registration + CORS
│   ├── seed.py                  # Seed sensor/infrastructure data
│   ├── seed_auth.py             # Seed roles, permissions, admin user
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx           # Citizen dashboard
│   │   │   ├── CityMap.tsx             # Interactive map (two-phase load)
│   │   │   ├── AirQuality.tsx
│   │   │   ├── Traffic.tsx
│   │   │   ├── Weather.tsx
│   │   │   ├── WaterFlood.tsx
│   │   │   ├── Complaints.tsx
│   │   │   ├── Emergency.tsx           # SOS + nearby services
│   │   │   ├── Agriculture.tsx
│   │   │   ├── Admin.tsx               # Admin dashboard
│   │   │   ├── AdminAlerts.tsx         # Alert Command Center
│   │   │   ├── AdminComplaints.tsx
│   │   │   ├── AdminEmergency.tsx
│   │   │   ├── PoliceCommandCenter.tsx
│   │   │   ├── FireCommandCenter.tsx
│   │   │   ├── EmergencyResponderCenter.tsx
│   │   │   ├── OfficerComplaints.tsx
│   │   │   ├── UserManagement.tsx
│   │   │   ├── RoleManagement.tsx
│   │   │   └── Profile.tsx
│   │   ├── components/
│   │   │   ├── Layout.tsx              # Sidebar + role-aware nav
│   │   │   ├── AlertBanner.tsx         # Global city-wide alert ticker
│   │   │   ├── PublicNavbar.tsx
│   │   │   └── PublicFooter.tsx
│   │   ├── contexts/
│   │   │   ├── AuthContext.tsx         # JWT auth state + authFetch helper
│   │   │   └── LocationContext.tsx     # Shared city/GPS location state
│   │   ├── hooks/
│   │   │   ├── useRBAC.ts              # Permission checks (hasPermission, isAdmin)
│   │   │   └── useGoogleAuth.ts        # Google OAuth flow
│   │   └── App.tsx                     # Router + protected route wrappers
│   ├── public/
│   │   ├── illustrations/              # Page hero illustrations
│   │   └── backgrounds/                # Role-specific login backgrounds
│   ├── nginx.conf                      # SPA routing + /api proxy + gzip + security headers
│   ├── Dockerfile                      # Multi-stage: node build → nginx serve
│   └── package.json
│
├── docker-compose.yml                  # postgres + backend + frontend
├── DEPLOY.md                           # Cloud deployment guides
└── README.md
```

---

## ⚙️ Environment Variables

### Backend — `backend/.env`

| Variable | Required | Default | Description |
|----------|:--------:|---------|-------------|
| `DATABASE_URL` | ✅ | `sqlite:///./smartcity.db` | SQLite (dev) or Postgres (prod) |
| `SECRET_KEY` | ✅ | — | JWT signing key — **generate a random one** |
| `ALGORITHM` | | `HS256` | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | | `30` | Access token TTL |
| `REFRESH_TOKEN_EXPIRE_DAYS` | | `7` | Refresh token TTL |
| `BACKEND_CORS_ORIGINS` | ✅ | `["*"]` | Allowed origins e.g. `https://myapp.com` |
| `GOOGLE_CLIENT_ID` | | — | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | | — | Google OAuth client secret |
| `MAX_LOGIN_ATTEMPTS` | | `5` | Brute-force lockout threshold |
| `ACCOUNT_LOCK_MINUTES` | | `30` | Lockout duration |

Generate a strong SECRET_KEY:
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

### Frontend — build-time

| Variable | Required | Description |
|----------|:--------:|-------------|
| `VITE_GOOGLE_CLIENT_ID` | | Google OAuth client ID (same as backend) |

---

## 🚢 Cloud Deployment

See **[DEPLOY.md](DEPLOY.md)** for full guides covering:

- **Docker Compose** on any VPS (DigitalOcean, Hetzner, AWS EC2…)
- **Render.com** — free tier, backend as Web Service + frontend as Static Site
- **Railway** — backend + Postgres plugin + frontend
- **Ubuntu VPS** — nginx + systemd service + Certbot HTTPS

---

## 🔒 Security

- JWT access tokens (short TTL) + refresh tokens (HTTP-only pattern)
- Passwords hashed with bcrypt via passlib
- Brute-force lockout after configurable failed attempts
- Backend runs as non-root `appuser` in Docker
- nginx sets `X-Frame-Options`, `X-Content-Type-Options`, `X-XSS-Protection`, `Referrer-Policy`
- `backend/.env`, `frontend/.env.local` are gitignored — credentials never committed
- Postgres port `5432` only exposed locally in docker-compose — remove `ports:` in production

---

## 🗺️ City Map — How it Works

The map uses a **two-phase loading** strategy for instant responsiveness:

```
User opens map
     │
     ├─ Phase 1 (<50 ms) ──► GET /api/map/db-markers
     │                         Returns complaints, SOS requests,
     │                         traffic incidents from local DB.
     │                         Markers appear on map immediately.
     │
     └─ Phase 2 (1–5 s)  ──► GET /api/map/markers
                               Returns Phase 1 data PLUS
                               OSM facilities from Overpass API.
                               Three mirrors raced in parallel;
                               fastest response wins, others cancelled.
                               Results cached 10 min per ~1 km grid cell.
```

Overpass mirrors raced: `overpass-api.de` · `overpass.kumi.systems` · `maps.mail.ru`

---

## 🌐 Real-Time Alerts

When an admin creates an alert in the **Alert Command Center**:

1. Alert stored in DB with `status = "active"`
2. Every authenticated session polls `GET /api/citizen/alerts` every 60 seconds
3. The **AlertBanner** component (injected globally in `Layout.tsx`) shows a colour-coded ticker bar at the top of every page — for every role
4. Alerts are dismissible per-session; the banner auto-advances through multiple active alerts

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit with a clear message
4. Open a pull request against `main`

---

## 📄 License

MIT © 2025 [Manik Dey](https://github.com/manik-dey-89)
