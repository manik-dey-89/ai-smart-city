from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Any
from datetime import datetime
from uuid import UUID


# Base schema mixins
class BaseSchema(BaseModel):
    id: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    status: str
    created_by: Optional[str] = None

    class Config:
        from_attributes = True


# Auth schemas
class UserBase(BaseModel):
    username: str
    email: EmailStr
    full_name: Optional[str] = None
    phone: Optional[str] = None


class UserCreate(UserBase):
    password: str
    role_name: Optional[str] = "citizen"


class UserLogin(BaseModel):
    username: str
    password: str


# Simplified role response for UserResponse (no nested permissions to avoid circular issues)
class RoleSimpleResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None

    class Config:
        from_attributes = True


class UserResponse(UserBase):
    id: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    status: str
    is_active: bool
    is_verified: bool
    roles: List[RoleSimpleResponse] = []

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str


class TokenRefresh(BaseModel):
    refresh_token: str


class TokenData(BaseModel):
    username: Optional[str] = None


class PasswordChange(BaseModel):
    old_password: str
    new_password: str


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str


class EmailVerificationRequest(BaseModel):
    email: EmailStr


class EmailVerificationConfirm(BaseModel):
    token: str


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None


# Role & Permission schemas
class RoleBase(BaseModel):
    name: str
    description: Optional[str] = None


class RoleCreate(RoleBase):
    pass


class PermissionSimpleResponse(BaseModel):
    id: str
    name: str
    resource: str
    action: str
    description: Optional[str] = None

    class Config:
        from_attributes = True


class RoleResponse(RoleBase, BaseSchema):
    permissions: List[PermissionSimpleResponse] = []


class PermissionBase(BaseModel):
    name: str
    resource: str
    action: str
    description: Optional[str] = None


class PermissionCreate(PermissionBase):
    pass


class PermissionResponse(PermissionBase, BaseSchema):
    pass


# Profile schemas
class CitizenBase(BaseModel):
    address: Optional[str] = None
    date_of_birth: Optional[datetime] = None


class CitizenCreate(CitizenBase):
    pass


class CitizenResponse(CitizenBase, BaseSchema):
    user_id: UUID

    class Config:
        from_attributes = True


class AdminBase(BaseModel):
    employee_id: Optional[str] = None
    position: Optional[str] = None


class AdminCreate(AdminBase):
    department_id: Optional[UUID] = None


class AdminResponse(AdminBase, BaseSchema):
    user_id: UUID
    department_id: Optional[UUID]

    class Config:
        from_attributes = True


class EmergencyTeamBase(BaseModel):
    team_type: str
    badge_number: Optional[str] = None


class EmergencyTeamCreate(EmergencyTeamBase):
    department_id: Optional[UUID] = None
    station_id: Optional[UUID] = None


class EmergencyTeamResponse(EmergencyTeamBase, BaseSchema):
    user_id: UUID
    department_id: Optional[UUID]
    station_id: Optional[UUID]

    class Config:
        from_attributes = True


# Department & Station schemas
class DepartmentBase(BaseModel):
    name: str
    description: Optional[str] = None


class DepartmentCreate(DepartmentBase):
    head_id: Optional[UUID] = None


class DepartmentResponse(DepartmentBase, BaseSchema):
    head_id: Optional[UUID]

    class Config:
        from_attributes = True


class EmergencyStationBase(BaseModel):
    type: str
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    capacity: Optional[int] = None


class EmergencyStationCreate(EmergencyStationBase):
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None


class EmergencyStationResponse(EmergencyStationBase, BaseSchema):
    class Config:
        from_attributes = True


# Complaint schemas
class ComplaintBase(BaseModel):
    type: str
    title: str
    description: str
    priority: Optional[str] = "medium"


class ComplaintCreate(ComplaintBase):
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    location_address: Optional[str] = None
    evidence_note: Optional[str] = None


class ComplaintResponse(ComplaintBase, BaseSchema):
    user_id: Optional[str] = None
    assigned_to: Optional[str] = None
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    location_address: Optional[str] = None
    tracking_id: Optional[str] = None
    routed_to: Optional[str] = None
    evidence_note: Optional[str] = None
    images: List[Any] = []
    history: List[Any] = []        # ComplaintHistoryEntry dicts for full-page view

    class Config:
        from_attributes = True


class ComplaintHistoryEntry(BaseModel):
    id: str
    action: str
    old_status: Optional[str] = None
    new_status: Optional[str] = None
    note: Optional[str] = None
    actor_username: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ComplaintTrackResponse(BaseModel):
    """Public tracking response — no sensitive reporter PII."""
    tracking_id: str
    title: str
    type: str
    priority: str
    status: str
    location_address: Optional[str] = None
    routed_to: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    history: List[ComplaintHistoryEntry] = []
    images_count: int = 0


# Dashboard stats
class DashboardStats(BaseModel):
    total_alerts: int
    active_emergencies: int
    traffic_incidents: int
    aqi_status: str
    weather: dict


# Weather schemas
class CurrentWeather(BaseModel):
    temp: float
    humidity: float
    wind_speed: float
    condition: str
    feels_like: Optional[float] = None


class ForecastDay(BaseModel):
    date: str
    day_name: str
    high: float
    low: float
    condition: str
    icon: str


class WeatherResponse(BaseModel):
    current: CurrentWeather
    forecast: List[ForecastDay]


# Map schemas
class MapMarker(BaseModel):
    id: str
    type: str
    lat: float
    lng: float
    name: str
    status: Optional[str] = None
    fill_percentage: Optional[float] = None


class MapResponse(BaseModel):
    markers: List[MapMarker]


# ─── Location / City Search ───────────────────────────────────────────────────

class LocationInfo(BaseModel):
    city: str
    state: str
    country: str
    lat: float
    lng: float
    display_name: str


# ─── Real Weather (Open-Meteo) ────────────────────────────────────────────────

class RealCurrentWeather(BaseModel):
    temp: float
    feels_like: float
    humidity: float
    wind_speed: float
    precipitation: float
    condition: str          # derived from WMO weather-code
    condition_code: int
    last_updated: str       # ISO datetime string


class RealForecastDay(BaseModel):
    date: str
    day_name: str
    high: float
    low: float
    condition: str
    condition_code: int
    precipitation_sum: float
    wind_max: float


class RealWeatherResponse(BaseModel):
    location: LocationInfo
    current: RealCurrentWeather
    forecast: List[RealForecastDay]
    source: str = "Open-Meteo (open-meteo.com)"


# ─── Real Air Quality (Open-Meteo AQ) ────────────────────────────────────────

class RealAQIResponse(BaseModel):
    location: LocationInfo
    aqi_us: Optional[float] = None           # US AQI
    aqi_category: str = "N/A"
    pm25: Optional[float] = None
    pm10: Optional[float] = None
    no2: Optional[float] = None
    o3: Optional[float] = None
    co: Optional[float] = None
    so2: Optional[float] = None
    last_updated: str
    source: str = "Open-Meteo Air Quality (open-meteo.com)"


# ─── Combined citizen dashboard payload ──────────────────────────────────────

class CitizenDashboardResponse(BaseModel):
    location: LocationInfo
    weather: RealCurrentWeather
    forecast: List[RealForecastDay]
    aqi: RealAQIResponse
    traffic_status: str = "Source not connected"
    water_status: str = "Source not connected"
    last_updated: str
    weather_source: str = "Open-Meteo (open-meteo.com)"
    aqi_source: str = "Open-Meteo Air Quality (open-meteo.com)"


# ─── Admin Panel Schemas ──────────────────────────────────────────────────────

class ComplaintAdminUpdate(BaseModel):
    """Admin-only complaint update: can change status, priority, assign, add notes"""
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_to: Optional[str] = None
    admin_notes: Optional[str] = None
    routed_to: Optional[str] = None


class ComplaintAdminResponse(BaseModel):
    """Full complaint response for admin, includes reporter info"""
    id: str
    type: str
    title: str
    description: str
    priority: str
    status: str
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    location_address: Optional[str] = None
    tracking_id: Optional[str] = None
    routed_to: Optional[str] = None
    admin_notes: Optional[str] = None
    evidence_note: Optional[str] = None
    user_id: Optional[str] = None
    assigned_to: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    reporter_username: Optional[str] = None
    reporter_email: Optional[str] = None
    reporter_full_name: Optional[str] = None
    images: List[Any] = []
    history: List[ComplaintHistoryEntry] = []

    class Config:
        from_attributes = True


class IncidentCreate(BaseModel):
    type: str
    title: str
    description: Optional[str] = None
    severity: Optional[str] = "medium"   # low, medium, high, critical
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None


class IncidentUpdate(BaseModel):
    status: Optional[str] = None         # reported, verified, assigned, in_progress, resolved, cancelled
    severity: Optional[str] = None
    description: Optional[str] = None


class IncidentResponse(BaseModel):
    id: str
    type: str
    title: str
    description: Optional[str] = None
    severity: str
    status: str
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    created_by: Optional[str] = None
    creator_username: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AlertCreate(BaseModel):
    type: str         # TRAFFIC, WEATHER, EMERGENCY, FLOOD, AIR_QUALITY, GENERAL
    title: str
    message: str
    severity: Optional[str] = "medium"   # low, medium, high, critical
    area_lat: Optional[float] = None
    area_lng: Optional[float] = None


class AlertUpdate(BaseModel):
    title: Optional[str] = None
    message: Optional[str] = None
    severity: Optional[str] = None
    status: Optional[str] = None         # active, inactive


class AlertResponse(BaseModel):
    id: str
    type: str
    title: str
    message: str
    severity: str
    status: str
    area_lat: Optional[float] = None
    area_lng: Optional[float] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    created_by: Optional[str] = None

    class Config:
        from_attributes = True


class EmergencyRequestAdminResponse(BaseModel):
    id: str
    type: str
    title: str
    description: Optional[str] = None
    priority: str
    status: str
    is_resolved: bool
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    user_id: Optional[str] = None
    reporter_username: Optional[str] = None
    reporter_email: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class EmergencyRequestUpdate(BaseModel):
    status: Optional[str] = None         # reported, verified, assigned, in_progress, resolved, cancelled
    priority: Optional[str] = None
    is_resolved: Optional[bool] = None


class OfficerComplaintUpdate(BaseModel):
    """Officer-side update: can change status and add remarks only."""
    status: Optional[str] = None     # in_progress, resolved
    remarks: Optional[str] = None    # officer action note (stored in admin_notes)


class AdminDashboardStats(BaseModel):
    """Real stats from DB for the admin overview page"""
    total_users: int
    active_users: int
    total_complaints: int
    pending_complaints: int
    active_alerts: int
    active_emergencies: int
    total_incidents: int
    recent_complaints: List[Any] = []
    recent_incidents: List[Any] = []
    recent_alerts: List[Any] = []


# ─── Traffic schemas ──────────────────────────────────────────────────────────

class TrafficIncidentInfo(BaseModel):
    id: str
    type: str           # accident, roadwork, closure, congestion, hazard
    severity: str       # low, medium, high, critical
    title: str
    description: str
    road: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    reported_at: str
    estimated_delay: Optional[int] = None   # minutes


class TrafficRoadSegment(BaseModel):
    road_name: str
    congestion_level: str   # free, light, moderate, heavy, standstill
    congestion_pct: int     # 0-100
    current_speed: Optional[float] = None   # km/h
    free_flow_speed: Optional[float] = None
    travel_time: Optional[int] = None       # seconds


class TrafficHourlyPoint(BaseModel):
    hour: str
    congestion_index: float  # 0-100


class TrafficResponse(BaseModel):
    location: LocationInfo
    overall_status: str          # Free Flow / Light / Moderate / Heavy / Standstill
    congestion_index: float      # 0-100
    avg_speed: Optional[float] = None          # km/h
    free_flow_speed: Optional[float] = None
    incidents_count: int
    incidents: List[TrafficIncidentInfo] = []
    road_segments: List[TrafficRoadSegment] = []
    hourly_forecast: List[TrafficHourlyPoint] = []
    peak_hours: List[str] = []
    travel_tips: List[str] = []
    last_updated: str
    source: str = "OpenStreetMap / Overpass API"


# ─── Route Analysis schemas ───────────────────────────────────────────────────

class RouteWaypoint(BaseModel):
    lat: float
    lng: float


class RouteWeatherInfo(BaseModel):
    condition: str
    condition_code: int
    temp: float
    humidity: float
    wind_speed: float
    precipitation: float
    visibility_ok: bool          # simple flag
    weather_impact: str          # Low / Medium / High
    weather_tip: str


class RouteSegmentRisk(BaseModel):
    label: str           # e.g. "Central Corridor"
    congestion_pct: int
    risk_level: str      # Low / Medium / High


class RouteAlternative(BaseModel):
    label: str           # Primary / Alt 1 / Alt 2
    distance_km: float
    duration_min: int
    congestion_level: str
    polyline: List[List[float]] = []   # [[lat,lng],...] for map display


class TemporalFlowPoint(BaseModel):
    hour: str
    flow: float   # 0-100


class RouteAnalysisResponse(BaseModel):
    # Input echo
    origin_name: str
    destination_name: str
    origin_lat: float
    origin_lng: float
    dest_lat: float
    dest_lng: float

    # Route geometry (list of [lat, lng] pairs for Leaflet polyline)
    polyline: List[List[float]]

    # Core metrics
    distance_km: float
    duration_min: int
    congestion_level: str        # Free Flow / Light / Moderate / Heavy / Standstill
    congestion_index: float      # 0-100
    predicted_density: str       # LOW / MEDIUM / HIGH
    confidence_score: int        # 0-100 %
    ai_decision: str             # human-readable AI rationale

    # Weather
    weather: RouteWeatherInfo

    # Accident risk
    accident_risk: str           # Low / Medium / High
    accident_factors: List[str]

    # Alternatives
    alternatives: List[RouteAlternative]

    # Segment risks
    segment_risks: List[RouteSegmentRisk]

    # 24-h temporal flow
    temporal_flow: List[TemporalFlowPoint]

    # Validation / data sources
    route_verified: bool
    data_sources: List[str]

    # Travel tips
    travel_tips: List[str]

    # Future prediction (tomorrow)
    tomorrow_density: str
    tomorrow_tip: str

    # Timestamp
    last_updated: str
    day_of_week: str
    local_time: str


# ─── Contact Message schemas ──────────────────────────────────────────────────

class ContactMessageCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    email: EmailStr
    subject: str = Field(..., min_length=3, max_length=255)
    message: str = Field(..., min_length=10, max_length=5000)


class ContactMessageResponse(BaseModel):
    id: str
    name: str
    email: str
    subject: str
    message: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Agriculture schemas ──────────────────────────────────────────────────────

class AgriCropCreate(BaseModel):
    crop_name: str = Field(..., min_length=2, max_length=120)
    variety: Optional[str] = None
    area_hectares: Optional[float] = None
    sowing_date: Optional[str] = None          # ISO date string
    expected_harvest: Optional[str] = None
    growth_stage: Optional[str] = "Sowing"
    soil_type: Optional[str] = None
    irrigation_type: Optional[str] = None
    notes: Optional[str] = None


class AgriCropResponse(BaseModel):
    id: str
    farmer_id: str
    crop_name: str
    variety: Optional[str] = None
    area_hectares: Optional[float] = None
    sowing_date: Optional[datetime] = None
    expected_harvest: Optional[datetime] = None
    growth_stage: Optional[str] = None
    status: str
    soil_type: Optional[str] = None
    irrigation_type: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AgriMarketListingCreate(BaseModel):
    crop_name: str = Field(..., min_length=2)
    variety: Optional[str] = None
    quantity_kg: float = Field(..., gt=0)
    price_per_kg: float = Field(..., gt=0)
    unit: Optional[str] = "kg"
    location: Optional[str] = None
    description: Optional[str] = None
    is_organic: Optional[bool] = False


class AgriMarketListingResponse(BaseModel):
    id: str
    farmer_id: str
    crop_name: str
    variety: Optional[str] = None
    quantity_kg: float
    price_per_kg: float
    unit: str
    location: Optional[str] = None
    description: Optional[str] = None
    is_organic: bool
    status: str
    created_at: datetime
    farmer_username: Optional[str] = None
    farmer_full_name: Optional[str] = None

    class Config:
        from_attributes = True


class AgriSchemeResponse(BaseModel):
    id: str
    title: str
    description: str
    category: Optional[str] = None
    eligibility: Optional[str] = None
    benefits: Optional[str] = None
    apply_url: Optional[str] = None
    deadline: Optional[datetime] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class AgriQueryCreate(BaseModel):
    title: str = Field(..., min_length=5)
    description: str = Field(..., min_length=10)
    category: Optional[str] = "Other"


class AgriQueryResponse(BaseModel):
    id: str
    farmer_id: str
    title: str
    description: str
    category: Optional[str] = None
    is_answered: bool
    answer: Optional[str] = None
    answered_at: Optional[datetime] = None
    created_at: datetime
    farmer_username: Optional[str] = None

    class Config:
        from_attributes = True
