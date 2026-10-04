import uuid
from sqlalchemy import (
    Column, String, Boolean, DateTime, Float, ForeignKey, Text, Integer
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from .database import Base


def new_uuid():
    return str(uuid.uuid4())


class BaseMixin:
    id = Column(String(36), primary_key=True, default=new_uuid)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, onupdate=func.now())
    created_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    status = Column(String, default="active", nullable=False)


class Role(Base, BaseMixin):
    __tablename__ = "roles"

    name = Column(String, unique=True, index=True, nullable=False)
    description = Column(Text)

    permissions = relationship("Permission", secondary="role_permissions", back_populates="roles")
    users = relationship("User", secondary="user_roles", back_populates="roles")


class Permission(Base, BaseMixin):
    __tablename__ = "permissions"

    name = Column(String, unique=True, index=True, nullable=False)
    description = Column(Text)
    resource = Column(String, nullable=False)
    action = Column(String, nullable=False)

    roles = relationship("Role", secondary="role_permissions", back_populates="permissions")


class RolePermission(Base):
    __tablename__ = "role_permissions"

    role_id = Column(String(36), ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True)
    permission_id = Column(String(36), ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True)


class UserRole(Base):
    __tablename__ = "user_roles"

    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    role_id = Column(String(36), ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True)


class RefreshToken(Base, BaseMixin):
    __tablename__ = "refresh_tokens"

    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token = Column(String, unique=True, index=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    revoked_at = Column(DateTime, nullable=True)
    is_revoked = Column(Boolean, default=False, nullable=False)

    user = relationship("User", back_populates="refresh_tokens", foreign_keys=[user_id])


class LoginHistory(Base, BaseMixin):
    __tablename__ = "login_history"

    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    ip_address = Column(String)
    user_agent = Column(Text)
    login_time = Column(DateTime, server_default=func.now(), nullable=False)
    logout_time = Column(DateTime, nullable=True)
    status = Column(String, default="success")
    failure_reason = Column(String, nullable=True)

    user = relationship("User", back_populates="login_history", foreign_keys=[user_id])


class PasswordReset(Base, BaseMixin):
    __tablename__ = "password_resets"

    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token = Column(String, unique=True, index=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)
    is_used = Column(Boolean, default=False, nullable=False)


class EmailVerification(Base, BaseMixin):
    __tablename__ = "email_verifications"

    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token = Column(String, unique=True, index=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    verified_at = Column(DateTime, nullable=True)
    is_verified = Column(Boolean, default=False, nullable=False)


class User(Base, BaseMixin):
    __tablename__ = "users"

    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String)
    phone = Column(String)
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    failed_login_attempts = Column(Integer, default=0, nullable=False)
    locked_until = Column(DateTime, nullable=True)
    last_login = Column(DateTime, nullable=True)
    password_changed_at = Column(DateTime, nullable=True)

    roles = relationship("Role", secondary="user_roles", back_populates="users")
    citizen_profile = relationship("Citizen", back_populates="user", uselist=False,
                                   cascade="all, delete-orphan", foreign_keys="Citizen.user_id")
    admin_profile = relationship("Admin", back_populates="user", uselist=False,
                                 cascade="all, delete-orphan", foreign_keys="Admin.user_id")
    emergency_profile = relationship("EmergencyTeam", back_populates="user", uselist=False,
                                     cascade="all, delete-orphan", foreign_keys="EmergencyTeam.user_id")
    complaints = relationship("Complaint", back_populates="user", foreign_keys="Complaint.user_id")
    emergency_requests = relationship("EmergencyRequest", back_populates="user",
                                      foreign_keys="EmergencyRequest.user_id")
    notifications = relationship("Notification", back_populates="user", foreign_keys="Notification.user_id")
    created_incidents = relationship("Incident", foreign_keys="Incident.created_by", back_populates="creator")
    system_logs = relationship("SystemLog", back_populates="user", foreign_keys="SystemLog.user_id")
    refresh_tokens = relationship("RefreshToken", back_populates="user",
                                  cascade="all, delete-orphan", foreign_keys="RefreshToken.user_id")
    login_history = relationship("LoginHistory", back_populates="user",
                                 cascade="all, delete-orphan", foreign_keys="LoginHistory.user_id")


class Citizen(Base, BaseMixin):
    __tablename__ = "citizens"

    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    address = Column(Text)
    date_of_birth = Column(DateTime)

    user = relationship("User", back_populates="citizen_profile", foreign_keys=[user_id])


class Department(Base, BaseMixin):
    __tablename__ = "departments"

    name = Column(String, unique=True, index=True, nullable=False)
    description = Column(Text)
    head_id = Column(String(36), ForeignKey("users.id"), nullable=True)

    admins = relationship("Admin", back_populates="department")
    emergency_teams = relationship("EmergencyTeam", back_populates="department")


class Admin(Base, BaseMixin):
    __tablename__ = "admins"

    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    department_id = Column(String(36), ForeignKey("departments.id"))
    employee_id = Column(String, unique=True, index=True)
    position = Column(String)

    user = relationship("User", back_populates="admin_profile", foreign_keys=[user_id])
    department = relationship("Department", back_populates="admins")


class EmergencyStation(Base, BaseMixin):
    __tablename__ = "emergency_stations"

    type = Column(String, nullable=False)
    name = Column(String, nullable=False)
    # Store as lat/lng floats instead of Geometry
    location_lat = Column(Float)
    location_lng = Column(Float)
    address = Column(Text)
    phone = Column(String)
    capacity = Column(Integer)

    teams = relationship("EmergencyTeam", back_populates="station")
    ambulances = relationship("Ambulance", back_populates="station")
    fire_trucks = relationship("FireTruck", back_populates="station")
    police_units = relationship("PoliceUnit", back_populates="station")


class EmergencyTeam(Base, BaseMixin):
    __tablename__ = "emergency_teams"

    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    department_id = Column(String(36), ForeignKey("departments.id"))
    team_type = Column(String, nullable=False)
    badge_number = Column(String, unique=True, index=True)
    station_id = Column(String(36), ForeignKey("emergency_stations.id"))

    user = relationship("User", back_populates="emergency_profile", foreign_keys=[user_id])
    department = relationship("Department", back_populates="emergency_teams")
    station = relationship("EmergencyStation", back_populates="teams")


class TrafficSensor(Base, BaseMixin):
    __tablename__ = "traffic_sensors"

    name = Column(String, nullable=False)
    location_lat = Column(Float)
    location_lng = Column(Float)
    road_id = Column(String(36), ForeignKey("roads.id"))
    sensor_type = Column(String)
    sensor_metadata = Column(Text)

    road = relationship("Road", back_populates="traffic_sensors")


class AirQualitySensor(Base, BaseMixin):
    __tablename__ = "air_quality_sensors"

    name = Column(String, nullable=False)
    location_lat = Column(Float)
    location_lng = Column(Float)
    sensor_metadata = Column(Text)


class WaterSensor(Base, BaseMixin):
    __tablename__ = "water_sensors"

    name = Column(String, nullable=False)
    location_lat = Column(Float)
    location_lng = Column(Float)
    sensor_type = Column(String)
    sensor_metadata = Column(Text)


class ElectricitySensor(Base, BaseMixin):
    __tablename__ = "electricity_sensors"

    name = Column(String, nullable=False)
    location_lat = Column(Float)
    location_lng = Column(Float)
    transformer_id = Column(String)
    sensor_metadata = Column(Text)


class SmartBin(Base, BaseMixin):
    __tablename__ = "smart_bins"

    name = Column(String, nullable=False)
    location_lat = Column(Float)
    location_lng = Column(Float)
    fill_percentage = Column(Float, default=0.0)
    bin_type = Column(String, default="general")
    last_collected = Column(DateTime)
    sensor_metadata = Column(Text)


class WeatherStation(Base, BaseMixin):
    __tablename__ = "weather_stations"

    name = Column(String, nullable=False)
    location_lat = Column(Float)
    location_lng = Column(Float)
    sensor_metadata = Column(Text)


class Road(Base, BaseMixin):
    __tablename__ = "roads"

    name = Column(String, nullable=False)
    road_type = Column(String)
    speed_limit = Column(Integer)
    lanes = Column(Integer, default=2)

    traffic_sensors = relationship("TrafficSensor", back_populates="road")
    traffic_incidents = relationship("TrafficIncident", back_populates="road")


class TrafficIncident(Base, BaseMixin):
    __tablename__ = "traffic_incidents"

    type = Column(String, nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text)
    location_lat = Column(Float)
    location_lng = Column(Float)
    road_id = Column(String(36), ForeignKey("roads.id"))
    severity = Column(String, default="medium")
    reported_by = Column(String(36), ForeignKey("users.id"))

    road = relationship("Road", back_populates="traffic_incidents")


class CrimeReport(Base, BaseMixin):
    __tablename__ = "crime_reports"

    type = Column(String, nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text)
    location_lat = Column(Float)
    location_lng = Column(Float)
    severity = Column(String, default="medium")
    reported_by = Column(String(36), ForeignKey("users.id"))


class Complaint(Base, BaseMixin):
    __tablename__ = "complaints"

    type = Column(String, nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    location_lat = Column(Float)
    location_lng = Column(Float)
    location_address = Column(Text)           # human-readable address from map picker
    priority = Column(String, default="medium")
    user_id = Column(String(36), ForeignKey("users.id"))
    assigned_to = Column(String(36), ForeignKey("users.id"))
    tracking_id = Column(String(20), unique=True, index=True)   # e.g. CMP-2024-XXXX
    routed_to = Column(String(50))             # role name e.g. "police", "traffic_officer"
    admin_notes = Column(Text)                 # internal admin notes
    evidence_note = Column(Text)               # optional citizen evidence description

    user = relationship("User", foreign_keys=[user_id], back_populates="complaints")
    images = relationship("ComplaintImage", back_populates="complaint", cascade="all, delete-orphan")
    history = relationship("ComplaintHistory", back_populates="complaint",
                           cascade="all, delete-orphan", order_by="ComplaintHistory.created_at")


class ComplaintImage(Base, BaseMixin):
    __tablename__ = "complaint_images"

    complaint_id = Column(String(36), ForeignKey("complaints.id", ondelete="CASCADE"), nullable=False)
    image_url = Column(String, nullable=False)
    thumbnail_url = Column(String)
    file_name = Column(String)
    file_type = Column(String)

    complaint = relationship("Complaint", back_populates="images")


class ComplaintHistory(Base):
    """Immutable audit trail — one row per status transition or admin action."""
    __tablename__ = "complaint_history"

    id = Column(String(36), primary_key=True, default=new_uuid)
    complaint_id = Column(String(36), ForeignKey("complaints.id", ondelete="CASCADE"), nullable=False, index=True)
    action = Column(String, nullable=False)       # e.g. "submitted", "approved", "routed", "status_change"
    old_status = Column(String)
    new_status = Column(String)
    note = Column(Text)
    actor_id = Column(String(36), ForeignKey("users.id"))
    actor_username = Column(String)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    complaint = relationship("Complaint", back_populates="history")


class EmergencyRequest(Base, BaseMixin):
    __tablename__ = "emergency_requests"

    type = Column(String, nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text)
    location_lat = Column(Float)
    location_lng = Column(Float)
    user_id = Column(String(36), ForeignKey("users.id"))
    priority = Column(String, default="high")
    is_resolved = Column(Boolean, default=False)

    user = relationship("User", back_populates="emergency_requests", foreign_keys=[user_id])


class Ambulance(Base, BaseMixin):
    __tablename__ = "ambulances"

    name = Column(String, nullable=False)
    station_id = Column(String(36), ForeignKey("emergency_stations.id"))
    location_lat = Column(Float)
    location_lng = Column(Float)
    is_available = Column(Boolean, default=True)
    driver_id = Column(String(36), ForeignKey("users.id"))

    station = relationship("EmergencyStation", back_populates="ambulances")


class FireTruck(Base, BaseMixin):
    __tablename__ = "fire_trucks"

    name = Column(String, nullable=False)
    station_id = Column(String(36), ForeignKey("emergency_stations.id"))
    location_lat = Column(Float)
    location_lng = Column(Float)
    is_available = Column(Boolean, default=True)
    driver_id = Column(String(36), ForeignKey("users.id"))

    station = relationship("EmergencyStation", back_populates="fire_trucks")


class PoliceUnit(Base, BaseMixin):
    __tablename__ = "police_units"

    name = Column(String, nullable=False)
    station_id = Column(String(36), ForeignKey("emergency_stations.id"))
    location_lat = Column(Float)
    location_lng = Column(Float)
    is_available = Column(Boolean, default=True)
    officer_id = Column(String(36), ForeignKey("users.id"))

    station = relationship("EmergencyStation", back_populates="police_units")


class Hospital(Base, BaseMixin):
    __tablename__ = "hospitals"

    name = Column(String, nullable=False)
    location_lat = Column(Float)
    location_lng = Column(Float)
    address = Column(Text)
    phone = Column(String)
    available_beds = Column(Integer, default=0)
    total_beds = Column(Integer, default=0)
    emergency_services = Column(Boolean, default=True)


class Shelter(Base, BaseMixin):
    __tablename__ = "shelters"

    name = Column(String, nullable=False)
    location_lat = Column(Float)
    location_lng = Column(Float)
    address = Column(Text)
    phone = Column(String)
    capacity = Column(Integer, default=0)
    current_occupancy = Column(Integer, default=0)


class Notification(Base, BaseMixin):
    __tablename__ = "notifications"

    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type = Column(String, nullable=False)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)

    user = relationship("User", back_populates="notifications", foreign_keys=[user_id])


class Alert(Base, BaseMixin):
    __tablename__ = "alerts"

    type = Column(String, nullable=False)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    severity = Column(String, default="medium")
    status = Column(String, default="active")          # active | inactive
    area_lat = Column(Float)
    area_lng = Column(Float)
    created_by = Column(String, nullable=True)         # user id of creator


class Analytics(Base, BaseMixin):
    __tablename__ = "analytics"

    metric_name = Column(String, nullable=False, index=True)
    metric_value = Column(Float, nullable=False)
    category = Column(String, index=True)
    analytics_metadata = Column(Text)


class SystemLog(Base, BaseMixin):
    __tablename__ = "system_logs"

    level = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    source = Column(String)
    user_id = Column(String(36), ForeignKey("users.id"))
    log_metadata = Column(Text)

    user = relationship("User", back_populates="system_logs", foreign_keys=[user_id])


class Setting(Base, BaseMixin):
    __tablename__ = "settings"

    key = Column(String, unique=True, index=True, nullable=False)
    value = Column(Text, nullable=False)
    description = Column(Text)
    is_public = Column(Boolean, default=False)


class ContactMessage(Base):
    """Stores contact form submissions from the public landing page."""
    __tablename__ = "contact_messages"

    id = Column(String(36), primary_key=True, default=new_uuid)
    name = Column(String(120), nullable=False)
    email = Column(String(255), nullable=False, index=True)
    subject = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    status = Column(String(20), default="unread", nullable=False)   # unread / read / replied
    ip_address = Column(String(45))
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    read_at = Column(DateTime, nullable=True)


class Incident(Base, BaseMixin):
    __tablename__ = "incidents"

    type = Column(String, nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text)
    location_lat = Column(Float)
    location_lng = Column(Float)
    severity = Column(String, default="medium")
    created_by = Column(String(36), ForeignKey("users.id"))

    creator = relationship("User", foreign_keys=[created_by], back_populates="created_incidents")


# ─── Agriculture Module ───────────────────────────────────────────────────────

class AgriCrop(Base, BaseMixin):
    """Crop management for farmers — tracks crops, growth stages, harvest."""
    __tablename__ = "agri_crops"

    farmer_id      = Column(String(36), ForeignKey("users.id"), nullable=False)
    crop_name      = Column(String(120), nullable=False)
    variety        = Column(String(120))
    area_hectares  = Column(Float)
    sowing_date    = Column(DateTime)
    expected_harvest = Column(DateTime)
    growth_stage   = Column(String(80))    # Sowing/Germination/Vegetative/Flowering/Harvesting
    status         = Column(String(40), default="active")  # active/harvested/failed
    notes          = Column(Text)
    soil_type      = Column(String(80))
    irrigation_type = Column(String(80))

    farmer = relationship("User", foreign_keys=[farmer_id])
    market_listings = relationship("AgriMarketListing", back_populates="crop", cascade="all, delete-orphan")


class AgriMarketListing(Base, BaseMixin):
    """Marketplace — farmers list crops for sale, buyers browse."""
    __tablename__ = "agri_market_listings"

    farmer_id    = Column(String(36), ForeignKey("users.id"), nullable=False)
    crop_id      = Column(String(36), ForeignKey("agri_crops.id"), nullable=True)
    crop_name    = Column(String(120), nullable=False)
    variety      = Column(String(120))
    quantity_kg  = Column(Float, nullable=False)
    price_per_kg = Column(Float, nullable=False)
    unit         = Column(String(20), default="kg")
    location     = Column(String(255))
    description  = Column(Text)
    available_from = Column(DateTime)
    is_organic   = Column(Boolean, default=False)
    images       = Column(Text)   # JSON list of image URLs

    farmer = relationship("User", foreign_keys=[farmer_id])
    crop   = relationship("AgriCrop", back_populates="market_listings")


class AgriScheme(Base, BaseMixin):
    """Government schemes for farmers — admin-managed."""
    __tablename__ = "agri_schemes"

    title        = Column(String(255), nullable=False)
    description  = Column(Text, nullable=False)
    category     = Column(String(80))   # Subsidy/Insurance/Loan/Training/Other
    eligibility  = Column(Text)
    benefits     = Column(Text)
    apply_url    = Column(String(512))
    deadline     = Column(DateTime)
    is_active    = Column(Boolean, default=True)
    posted_by    = Column(String(36), ForeignKey("users.id"))


class AgriQuery(Base, BaseMixin):
    """Farmer questions → expert answers."""
    __tablename__ = "agri_queries"

    farmer_id    = Column(String(36), ForeignKey("users.id"), nullable=False)
    title        = Column(String(255), nullable=False)
    description  = Column(Text, nullable=False)
    category     = Column(String(80))   # Pest/Disease/Soil/Weather/Market/Other
    is_answered  = Column(Boolean, default=False)
    answer       = Column(Text)
    answered_by  = Column(String(36), ForeignKey("users.id"))
    answered_at  = Column(DateTime)

    farmer     = relationship("User", foreign_keys=[farmer_id])
    answerer   = relationship("User", foreign_keys=[answered_by])
