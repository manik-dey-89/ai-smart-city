from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine, Base
from app.routers import auth, dashboard, users, roles, weather, map
from app.routers import citizen
from app.routers import complaints as complaints_router
from app.routers import google_auth
from app.routers import admin as admin_router
from app.routers import contact as contact_router
from app.routers import agriculture as agri_router

# Import all models so SQLAlchemy knows about every table before create_all
from app.models import (
    User, Role, Permission, RolePermission, UserRole,
    RefreshToken, LoginHistory, PasswordReset, EmailVerification,
    Citizen, Department, Admin, EmergencyStation, EmergencyTeam,
    TrafficSensor, AirQualitySensor, WaterSensor, ElectricitySensor,
    SmartBin, WeatherStation, Road, TrafficIncident, CrimeReport,
    Complaint, ComplaintImage, ComplaintHistory, EmergencyRequest,
    Ambulance, FireTruck, PoliceUnit,
    Hospital, Shelter, Notification, Alert, Analytics,
    SystemLog, Setting, Incident, ContactMessage,
    AgriCrop, AgriMarketListing, AgriScheme, AgriQuery,
)

# Create every table that doesn't already exist (safe to run every startup)
Base.metadata.create_all(bind=engine)

app = FastAPI(title="AI Smart City Dashboard API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(google_auth.router)
app.include_router(dashboard.router)
app.include_router(users.router)
app.include_router(roles.router)
app.include_router(roles.router_permissions)
app.include_router(weather.router)
app.include_router(map.router)
app.include_router(citizen.router)
app.include_router(complaints_router.router)
app.include_router(admin_router.router)
app.include_router(contact_router.router)
app.include_router(agri_router.router)


@app.get("/")
def root():
    return {"message": "AI Smart City Dashboard API"}


@app.get("/api/health")
def health_check():
    return {"status": "healthy"}
