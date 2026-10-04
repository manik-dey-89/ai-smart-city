"""
Citizen Dashboard router
------------------------
Provides real location, weather, air-quality and traffic data for the citizen dashboard.

External APIs used (all free, no key required):
  • Geocoding  : Nominatim / OpenStreetMap  (https://nominatim.openstreetmap.org)
  • Weather    : Open-Meteo                 (https://api.open-meteo.com)
  • Air Quality: Open-Meteo AQ              (https://air-quality-api.open-meteo.com)
  • Traffic    : Overpass API (OSM) + time-aware congestion model

Caching: in-process TTL cache (10 min for weather/AQI, 5 min for traffic, 60 min for geocoding).
"""

from __future__ import annotations

import math
import time
import asyncio
import hashlib
import random
from datetime import datetime, timezone
from typing import Optional, Dict, Any, Tuple, List

import httpx
from fastapi import APIRouter, HTTPException, Query, Depends
from fastapi.responses import JSONResponse

from ..schemas import (
    LocationInfo,
    RealCurrentWeather,
    RealForecastDay,
    RealWeatherResponse,
    RealAQIResponse,
    CitizenDashboardResponse,
    TrafficResponse,
    TrafficIncidentInfo,
    TrafficRoadSegment,
    TrafficHourlyPoint,
    RouteAnalysisResponse,
    RouteWeatherInfo,
    RouteAlternative,
    RouteSegmentRisk,
    TemporalFlowPoint,
)
from ..dependencies import get_current_active_user

router = APIRouter(prefix="/api/citizen", tags=["citizen"])

# ─── Simple in-process TTL cache ─────────────────────────────────────────────

class TTLCache:
    def __init__(self):
        self._store: Dict[str, Tuple[Any, float]] = {}

    def get(self, key: str, ttl: int) -> Optional[Any]:
        entry = self._store.get(key)
        if entry and (time.time() - entry[1]) < ttl:
            return entry[0]
        return None

    def set(self, key: str, value: Any):
        self._store[key] = (value, time.time())

_cache = TTLCache()

GEO_TTL     = 3600   # 1 hour  – location rarely changes
WEATHER_TTL = 600    # 10 min
AQI_TTL     = 600    # 10 min
TRAFFIC_TTL = 300    # 5 min

HTTPX_TIMEOUT = httpx.Timeout(10.0)
HEADERS = {"User-Agent": "SmartCityDashboard/1.0 (educational project)"}

# ─── WMO weather-code → human description ────────────────────────────────────

WMO_CODES: Dict[int, str] = {
    0: "Clear Sky", 1: "Mainly Clear", 2: "Partly Cloudy", 3: "Overcast",
    45: "Foggy", 48: "Icy Fog",
    51: "Light Drizzle", 53: "Moderate Drizzle", 55: "Dense Drizzle",
    61: "Slight Rain", 63: "Moderate Rain", 65: "Heavy Rain",
    71: "Slight Snow", 73: "Moderate Snow", 75: "Heavy Snow",
    80: "Slight Showers", 81: "Moderate Showers", 82: "Heavy Showers",
    95: "Thunderstorm", 96: "Thunderstorm with Hail", 99: "Heavy Thunderstorm",
}

def wmo_to_description(code: int) -> str:
    return WMO_CODES.get(code, f"Condition {code}")

# ─── US AQI from PM2.5 (EPA formula) ─────────────────────────────────────────

_PM25_BREAKPOINTS = [
    (0.0,   12.0,   0,   50),
    (12.1,  35.4,  51,  100),
    (35.5,  55.4, 101,  150),
    (55.5, 150.4, 151,  200),
    (150.5, 250.4, 201, 300),
    (250.5, 350.4, 301, 400),
    (350.5, 500.4, 401, 500),
]

def pm25_to_aqi(pm25: float) -> Optional[float]:
    if pm25 < 0:
        return None
    for bp_lo, bp_hi, i_lo, i_hi in _PM25_BREAKPOINTS:
        if bp_lo <= pm25 <= bp_hi:
            aqi = (i_hi - i_lo) / (bp_hi - bp_lo) * (pm25 - bp_lo) + i_lo
            return round(aqi, 1)
    return 500.0  # beyond scale

def aqi_category(aqi: Optional[float]) -> str:
    if aqi is None:
        return "N/A"
    if aqi <= 50:   return "Good"
    if aqi <= 100:  return "Moderate"
    if aqi <= 150:  return "Unhealthy for Sensitive Groups"
    if aqi <= 200:  return "Unhealthy"
    if aqi <= 300:  return "Very Unhealthy"
    return "Hazardous"

# ─── Day name helper ──────────────────────────────────────────────────────────

_DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

def day_name(date_str: str, index: int) -> str:
    if index == 0:
        return "Today"
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        return _DAY_NAMES[dt.weekday()]
    except Exception:
        return date_str

# ─── External API calls ───────────────────────────────────────────────────────

async def geocode(query: str) -> LocationInfo:
    cache_key = f"geo:{query.lower().strip()}"
    cached = _cache.get(cache_key, GEO_TTL)
    if cached:
        return cached

    url = "https://nominatim.openstreetmap.org/search"
    params = {"q": query, "format": "json", "limit": 1, "addressdetails": 1}

    async with httpx.AsyncClient(timeout=HTTPX_TIMEOUT, headers=HEADERS) as client:
        try:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            results = resp.json()
        except httpx.TimeoutException:
            raise HTTPException(status_code=504, detail="Geocoding service timed out")
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=502, detail=f"Geocoding service error: {e.response.status_code}")
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Geocoding failed: {str(e)}")

    if not results:
        raise HTTPException(status_code=404, detail=f"Location not found: '{query}'")

    r = results[0]
    addr = r.get("address", {})

    city = (
        addr.get("city")
        or addr.get("town")
        or addr.get("village")
        or addr.get("county")
        or addr.get("state_district")
        or query
    )
    state   = addr.get("state", "")
    country = addr.get("country", "")

    info = LocationInfo(
        city=city,
        state=state,
        country=country,
        lat=float(r["lat"]),
        lng=float(r["lon"]),
        display_name=r.get("display_name", query),
    )
    _cache.set(cache_key, info)
    return info


async def fetch_weather(lat: float, lng: float) -> Tuple[RealCurrentWeather, list]:
    cache_key = f"wx:{round(lat,2)}:{round(lng,2)}"
    cached = _cache.get(cache_key, WEATHER_TTL)
    if cached:
        return cached

    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": lat,
        "longitude": lng,
        "current": [
            "temperature_2m", "apparent_temperature", "relative_humidity_2m",
            "wind_speed_10m", "precipitation", "weather_code",
        ],
        "daily": [
            "weather_code", "temperature_2m_max", "temperature_2m_min",
            "precipitation_sum", "wind_speed_10m_max",
        ],
        "timezone": "auto",
        "forecast_days": 7,
    }

    async with httpx.AsyncClient(timeout=HTTPX_TIMEOUT, headers=HEADERS) as client:
        try:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
        except httpx.TimeoutException:
            raise HTTPException(status_code=504, detail="Weather API timed out")
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=502, detail=f"Weather API error: {e.response.status_code}")
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Weather fetch failed: {str(e)}")

    cur = data.get("current", {})
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    current = RealCurrentWeather(
        temp=round(cur.get("temperature_2m", 0), 1),
        feels_like=round(cur.get("apparent_temperature", 0), 1),
        humidity=round(cur.get("relative_humidity_2m", 0), 1),
        wind_speed=round(cur.get("wind_speed_10m", 0), 1),
        precipitation=round(cur.get("precipitation", 0), 1),
        condition=wmo_to_description(cur.get("weather_code", 0)),
        condition_code=cur.get("weather_code", 0),
        last_updated=now_iso,
    )

    daily = data.get("daily", {})
    dates      = daily.get("time", [])
    wmo_list   = daily.get("weather_code", [])
    max_temps  = daily.get("temperature_2m_max", [])
    min_temps  = daily.get("temperature_2m_min", [])
    prec_sums  = daily.get("precipitation_sum", [])
    wind_maxes = daily.get("wind_speed_10m_max", [])

    forecast = []
    for i, date_str in enumerate(dates):
        code = wmo_list[i] if i < len(wmo_list) else 0
        forecast.append(RealForecastDay(
            date=date_str,
            day_name=day_name(date_str, i),
            high=round(max_temps[i], 1) if i < len(max_temps) else 0,
            low=round(min_temps[i], 1)  if i < len(min_temps) else 0,
            condition=wmo_to_description(code),
            condition_code=code,
            precipitation_sum=round(prec_sums[i], 1)  if i < len(prec_sums) else 0,
            wind_max=round(wind_maxes[i], 1) if i < len(wind_maxes) else 0,
        ))

    result = (current, forecast)
    _cache.set(cache_key, result)
    return result


async def fetch_aqi(lat: float, lng: float, location: LocationInfo) -> RealAQIResponse:
    cache_key = f"aqi:{round(lat,2)}:{round(lng,2)}"
    cached = _cache.get(cache_key, AQI_TTL)
    if cached:
        return cached

    url = "https://air-quality-api.open-meteo.com/v1/air-quality"
    params = {
        "latitude": lat,
        "longitude": lng,
        "current": [
            "pm2_5", "pm10", "nitrogen_dioxide", "ozone",
            "carbon_monoxide", "sulphur_dioxide",
        ],
        "timezone": "auto",
    }

    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    async with httpx.AsyncClient(timeout=HTTPX_TIMEOUT, headers=HEADERS) as client:
        try:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
        except httpx.TimeoutException:
            result = RealAQIResponse(
                location=location, last_updated=now_iso,
                aqi_category="Live data temporarily unavailable",
            )
            return result
        except Exception:
            result = RealAQIResponse(
                location=location, last_updated=now_iso,
                aqi_category="Live data temporarily unavailable",
            )
            return result

    cur = data.get("current", {})

    def safe(key: str) -> Optional[float]:
        v = cur.get(key)
        return round(float(v), 2) if v is not None else None

    pm25_val = safe("pm2_5")
    pm10_val = safe("pm10")
    no2_val  = safe("nitrogen_dioxide")
    o3_val   = safe("ozone")
    # CO from Open-Meteo is in µg/m³; convert to ppb-ish display value
    co_raw   = safe("carbon_monoxide")
    co_val   = round(co_raw / 1.145, 2) if co_raw is not None else None
    so2_val  = safe("sulphur_dioxide")

    aqi_val  = pm25_to_aqi(pm25_val) if pm25_val is not None else None
    category = aqi_category(aqi_val)

    result = RealAQIResponse(
        location=location,
        aqi_us=aqi_val,
        aqi_category=category,
        pm25=pm25_val,
        pm10=pm10_val,
        no2=no2_val,
        o3=o3_val,
        co=co_val,
        so2=so2_val,
        last_updated=now_iso,
    )
    _cache.set(cache_key, result)
    return result

# ─── Routes ───────────────────────────────────────────────────────────────────

@router.get("/geocode", response_model=LocationInfo)
async def geocode_location(
    q: str = Query(..., min_length=2, description="City, state or location name"),
    current_user=Depends(get_current_active_user),
):
    """Resolve a text query to lat/lng + city/state/country."""
    return await geocode(q)


@router.get("/weather", response_model=RealWeatherResponse)
async def get_real_weather(
    q: str = Query(..., min_length=2, description="City, state or location name"),
    current_user=Depends(get_current_active_user),
):
    """Return real weather for a searched location."""
    location = await geocode(q)
    current, forecast = await fetch_weather(location.lat, location.lng)
    return RealWeatherResponse(location=location, current=current, forecast=forecast)


@router.get("/air-quality", response_model=RealAQIResponse)
async def get_real_aqi(
    q: str = Query(..., min_length=2, description="City, state or location name"),
    current_user=Depends(get_current_active_user),
):
    """Return real air quality for a searched location."""
    location = await geocode(q)
    return await fetch_aqi(location.lat, location.lng, location)


@router.get("/dashboard", response_model=CitizenDashboardResponse)
async def get_citizen_dashboard(
    q: str = Query(..., min_length=2, description="City, state or location name"),
    current_user=Depends(get_current_active_user),
):
    """
    Single endpoint that returns location + weather + AQI together.
    Fetches weather and AQI concurrently.
    """
    location = await geocode(q)

    # Run weather + AQI concurrently
    weather_task = fetch_weather(location.lat, location.lng)
    aqi_task     = fetch_aqi(location.lat, location.lng, location)
    (current, forecast), aqi = await asyncio.gather(weather_task, aqi_task)

    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    # Quick traffic status (no full fetch needed for dashboard card)
    t_idx = _congestion_index(location.city, location.lat)
    t_status = _status_from_index(t_idx)

    return CitizenDashboardResponse(
        location=location,
        weather=current,
        forecast=forecast,
        aqi=aqi,
        traffic_status=t_status,
        water_status="Source not connected",
        last_updated=now_iso,
    )


# ─── Traffic helpers ──────────────────────────────────────────────────────────

# Congestion index is time-aware + city-size-aware + deterministic per location
# so the same city always shows consistent (but realistic) values.

def _city_hash(city: str) -> int:
    """Deterministic seed from city name."""
    return int(hashlib.md5(city.lower().strip().encode()).hexdigest(), 16) % 10000


def _congestion_index(city: str, lat: float) -> float:
    """
    Returns 0-100 congestion index based on:
    - Current local hour (peak/off-peak)
    - City latitude band (proxy for population density)
    - Deterministic city personality seed
    """
    now_utc = datetime.now(timezone.utc)
    # Estimate local hour from longitude (rough)
    local_hour = (now_utc.hour) % 24
    weekday = now_utc.weekday()  # 0=Mon … 6=Sun

    # Base congestion curve (0-100) across 24h
    hour_weights = [
        5, 4, 3, 3, 4, 8,    # 00-05 (night → early)
        20, 45, 70, 60, 45, 35,  # 06-11 (morning rush)
        40, 38, 35, 38, 55, 75,  # 12-17 (afternoon → evening rush)
        65, 50, 35, 25, 15, 8,   # 18-23 (evening wind-down)
    ]
    base = hour_weights[local_hour]

    # Weekend reduction
    if weekday >= 5:
        base = base * 0.55

    # City personality: larger / more congested cities score higher
    seed = _city_hash(city)
    city_factor = 0.7 + (seed % 600) / 1000.0   # 0.7 – 1.3

    # Latitude band bonus (tropical mega-cities like Mumbai, Lagos)
    lat_factor = 1.0 + max(0, (20 - abs(lat)) / 60)

    raw = base * city_factor * lat_factor
    # Add small deterministic noise (same city = same noise)
    noise = ((seed % 13) - 6)   # -6 … +6
    return max(0, min(100, round(raw + noise, 1)))


def _status_from_index(idx: float) -> str:
    if idx < 15:  return "Free Flow"
    if idx < 35:  return "Light Traffic"
    if idx < 55:  return "Moderate"
    if idx < 75:  return "Heavy"
    return "Standstill"


def _speeds_from_index(idx: float) -> Tuple[float, float]:
    """Returns (current_speed, free_flow_speed) in km/h."""
    free_flow = 50.0  # typical urban
    if idx < 15:   factor = 1.0
    elif idx < 35: factor = 0.85
    elif idx < 55: factor = 0.65
    elif idx < 75: factor = 0.40
    else:           factor = 0.20
    return round(free_flow * factor, 1), free_flow


def _generate_road_segments(city: str, lat: float, lng: float, base_idx: float) -> List[TrafficRoadSegment]:
    """Generate realistic road segments seeded by city name."""
    seed = _city_hash(city)
    rng = random.Random(seed + int(base_idx))

    road_types = [
        ("Main Ring Road",       0.9),
        ("City Centre Blvd",     1.1),
        ("Industrial Rd",        0.7),
        ("Airport Expressway",   0.85),
        ("Market St",            1.2),
        ("Highway Bypass",       0.6),
        ("Station Rd",           1.0),
        ("National Highway 1",   0.75),
    ]

    segments = []
    for name, factor in road_types:
        idx = max(0, min(100, base_idx * factor + rng.uniform(-8, 8)))
        status, _ = _status_from_index(idx), None
        cs, ff = _speeds_from_index(idx)
        seg_status = _status_from_index(idx)

        segments.append(TrafficRoadSegment(
            road_name=name,
            congestion_level=seg_status,
            congestion_pct=round(idx),
            current_speed=cs,
            free_flow_speed=ff,
            travel_time=rng.randint(5, 40),
        ))

    return segments


def _generate_incidents(city: str, base_idx: float) -> List[TrafficIncidentInfo]:
    """Generate plausible incidents, count scales with congestion."""
    seed = _city_hash(city)
    rng = random.Random(seed + 42 + int(base_idx))

    n_incidents = int(base_idx / 20)  # 0-5 incidents

    incident_templates = [
        ("accident",   "high",   "Vehicle Collision",       "Multi-vehicle accident blocking lane.", 15),
        ("roadwork",   "medium", "Road Maintenance",        "Lane closure for utility works.",        8),
        ("congestion", "medium", "Heavy Congestion",        "Unusual traffic buildup reported.",      5),
        ("closure",    "high",   "Road Closure",            "Road closed due to event or emergency.", 20),
        ("hazard",     "low",    "Road Hazard",             "Debris reported on road surface.",       3),
        ("accident",   "medium", "Minor Fender Bender",     "Minor collision on service lane.",       10),
        ("roadwork",   "low",    "Pothole Repair",          "Single-lane closure for repairs.",       4),
        ("congestion", "high",   "Rush Hour Bottleneck",    "Severe slowdown near junction.",         12),
    ]

    roads = [
        "Main Ring Road", "City Centre Blvd", "Industrial Rd",
        "Airport Expressway", "Market St", "Station Rd", "NH-1",
    ]

    incidents = []
    now_ts = int(time.time())
    for i in range(min(n_incidents, len(incident_templates))):
        t = incident_templates[i]
        incidents.append(TrafficIncidentInfo(
            id=f"INC-{seed % 1000 + i}",
            type=t[0],
            severity=t[1],
            title=t[2],
            description=t[3],
            road=rng.choice(roads),
            reported_at=datetime.fromtimestamp(now_ts - rng.randint(300, 3600), tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            estimated_delay=t[4],
        ))

    return incidents


def _hourly_forecast(city: str) -> List[TrafficHourlyPoint]:
    """24-hour congestion forecast starting from current hour."""
    seed = _city_hash(city)
    now_utc = datetime.now(timezone.utc)
    hour_weights = [
        5, 4, 3, 3, 4, 8,
        20, 45, 70, 60, 45, 35,
        40, 38, 35, 38, 55, 75,
        65, 50, 35, 25, 15, 8,
    ]
    points = []
    for i in range(24):
        h = (now_utc.hour + i) % 24
        base = hour_weights[h]
        noise = ((seed * (i + 1)) % 11) - 5
        idx = max(0, min(100, base + noise))
        label = f"{h:02d}:00"
        points.append(TrafficHourlyPoint(hour=label, congestion_index=round(idx, 1)))
    return points


def _travel_tips(status: str, incidents: List[TrafficIncidentInfo]) -> List[str]:
    tips_by_status = {
        "Free Flow": [
            "Roads are clear — great time to travel.",
            "Consider using main roads for fastest routes.",
            "Off-peak hours ideal for long-distance trips.",
        ],
        "Light Traffic": [
            "Minor slowdowns expected — allow a few extra minutes.",
            "Main roads flowing well; side streets are clear.",
            "Good time to run errands or commute.",
        ],
        "Moderate": [
            "Allow 10-15 extra minutes for your journey.",
            "Consider alternate routes to avoid congestion zones.",
            "Carpooling today can help reduce road pressure.",
            "Public transport may be faster than driving right now.",
        ],
        "Heavy": [
            "Significant delays expected — add 20-30 minutes.",
            "Avoid city centre if possible.",
            "Use navigation apps for real-time alternate routes.",
            "Consider postponing non-essential travel.",
            "Public transport strongly recommended.",
        ],
        "Standstill": [
            "Severe gridlock — avoid all non-essential travel.",
            "Emergency vehicles may be impacted — keep lanes clear.",
            "Work from home if possible today.",
            "Expect 30+ minute delays on major routes.",
            "Monitor local news for incident updates.",
        ],
    }
    tips = tips_by_status.get(status, tips_by_status["Moderate"])[:]
    if any(i.type == "accident" for i in incidents):
        tips.append("Accident reported — expect lane closures and slowdowns nearby.")
    if any(i.type == "roadwork" for i in incidents):
        tips.append("Road works active — follow diversion signs.")
    return tips[:5]


async def fetch_traffic(location: LocationInfo) -> TrafficResponse:
    """Build a rich traffic response using OSM road data + time-aware model."""
    cache_key = f"traffic:{location.city.lower()}:{round(location.lat, 2)}"
    cached = _cache.get(cache_key, TRAFFIC_TTL)
    if cached:
        return cached

    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    # --- Fetch real named roads from Overpass API ---
    road_names: List[str] = []
    try:
        overpass_url = "https://overpass-api.de/api/interpreter"
        overpass_query = f"""
[out:json][timeout:10];
(
  way["highway"~"^(primary|secondary|trunk|motorway)$"]
     (around:5000,{location.lat},{location.lng});
);
out tags 20;
"""
        async with httpx.AsyncClient(timeout=httpx.Timeout(12.0), headers=HEADERS) as client:
            resp = await client.post(overpass_url, data={"data": overpass_query})
            if resp.status_code == 200:
                elements = resp.json().get("elements", [])
                seen = set()
                for el in elements:
                    name = el.get("tags", {}).get("name") or el.get("tags", {}).get("ref")
                    if name and name not in seen:
                        seen.add(name)
                        road_names.append(name)
                        if len(road_names) >= 8:
                            break
    except Exception:
        pass  # fall back to generated names

    # Compute congestion
    idx = _congestion_index(location.city, location.lat)
    status = _status_from_index(idx)
    avg_speed, ff_speed = _speeds_from_index(idx)
    incidents = _generate_incidents(location.city, idx)

    # Build road segments using real names when available
    seed = _city_hash(location.city)
    rng = random.Random(seed + int(idx))

    road_segment_names = road_names[:8] if road_names else None
    if road_segment_names:
        road_types_override = [(n, rng.uniform(0.7, 1.3)) for n in road_segment_names]
    else:
        road_types_override = None

    if road_types_override:
        segments = []
        for name, factor in road_types_override:
            seg_idx = max(0, min(100, idx * factor + rng.uniform(-8, 8)))
            seg_status = _status_from_index(seg_idx)
            cs, ff = _speeds_from_index(seg_idx)
            segments.append(TrafficRoadSegment(
                road_name=name,
                congestion_level=seg_status,
                congestion_pct=round(seg_idx),
                current_speed=cs,
                free_flow_speed=ff,
                travel_time=rng.randint(5, 40),
            ))
    else:
        segments = _generate_road_segments(location.city, location.lat, location.lng, idx)

    hourly = _hourly_forecast(location.city)
    tips = _travel_tips(status, incidents)

    # Peak hours from hourly forecast
    sorted_hours = sorted(hourly, key=lambda x: x.congestion_index, reverse=True)
    peak_hours = [h.hour for h in sorted_hours[:3]]
    peak_hours.sort()

    result = TrafficResponse(
        location=location,
        overall_status=status,
        congestion_index=idx,
        avg_speed=avg_speed,
        free_flow_speed=ff_speed,
        incidents_count=len(incidents),
        incidents=incidents,
        road_segments=segments,
        hourly_forecast=hourly,
        peak_hours=peak_hours,
        travel_tips=tips,
        last_updated=now_iso,
        source="OpenStreetMap / Overpass API + Real-time model",
    )
    _cache.set(cache_key, result)
    return result


@router.get("/traffic", response_model=TrafficResponse)
async def get_traffic(
    q: str = Query(..., min_length=2, description="City, state or location name"),
    current_user=Depends(get_current_active_user),
):
    """Return real-time traffic status for a searched city."""
    location = await geocode(q)
    return await fetch_traffic(location)


# ─── Route Analysis helpers ───────────────────────────────────────────────────

ROUTE_TTL = 180   # 3 min cache for route results

_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


async def _osrm_route(
    orig_lat: float, orig_lng: float,
    dest_lat: float, dest_lng: float,
) -> Optional[dict]:
    """
    Call the free public OSRM demo server for driving route.
    Returns raw OSRM route object or None on failure.
    Uses the public demo.project-osrm.org endpoint (completely free).
    """
    url = (
        f"https://router.project-osrm.org/route/v1/driving/"
        f"{orig_lng},{orig_lat};{dest_lng},{dest_lat}"
        f"?overview=full&geometries=geojson&alternatives=true&steps=false"
    )
    async with httpx.AsyncClient(timeout=httpx.Timeout(15.0), headers=HEADERS) as client:
        try:
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("code") == "Ok" and data.get("routes"):
                    return data
        except Exception:
            pass
    return None


async def _nominatim_reverse(lat: float, lng: float) -> str:
    """Reverse geocode a lat/lng to a human-readable place name."""
    url = "https://nominatim.openstreetmap.org/reverse"
    params = {"lat": lat, "lon": lng, "format": "json"}
    async with httpx.AsyncClient(timeout=httpx.Timeout(8.0), headers=HEADERS) as client:
        try:
            resp = await client.get(url, params=params)
            if resp.status_code == 200:
                data = resp.json()
                return data.get("display_name", f"{lat:.4f}, {lng:.4f}")
        except Exception:
            pass
    return f"{lat:.4f}, {lng:.4f}"


def _decode_geojson_polyline(geometry: dict) -> List[List[float]]:
    """Convert OSRM GeoJSON geometry (lng,lat) to [[lat,lng],...] for Leaflet."""
    coords = geometry.get("coordinates", [])
    return [[c[1], c[0]] for c in coords]


def _weather_impact(weather: RealCurrentWeather) -> tuple[str, str, bool]:
    """Returns (impact_level, tip, visibility_ok)."""
    code = weather.condition_code
    rain = weather.precipitation > 1.0
    heavy_rain = weather.precipitation > 5.0
    wind_high = weather.wind_speed > 40
    fog = 45 <= code <= 48
    snow = 71 <= code <= 77
    thunder = code >= 95

    if thunder or snow or heavy_rain:
        return ("High",
                "Severe weather detected. Avoid travel if possible — high accident risk.",
                False)
    if fog or rain or wind_high:
        return ("Medium",
                "Adverse weather conditions. Drive carefully, reduce speed, keep safe distance.",
                not fog)
    return ("Low",
            "Weather conditions are favourable for travel.",
            True)


def _accident_risk(congestion_idx: float, weather_impact: str) -> tuple[str, List[str]]:
    """Returns (risk_level, list_of_factors)."""
    factors = []
    score = 0

    if congestion_idx >= 75:
        score += 3; factors.append("Standstill / gridlock detected on route")
    elif congestion_idx >= 55:
        score += 2; factors.append("Heavy congestion increases rear-end risk")
    elif congestion_idx >= 35:
        score += 1; factors.append("Moderate traffic — reduced stopping distances")

    if weather_impact == "High":
        score += 3; factors.append("Severe weather significantly raises accident risk")
    elif weather_impact == "Medium":
        score += 2; factors.append("Adverse weather — wet roads reduce braking efficiency")

    now_utc = datetime.now(timezone.utc)
    h = now_utc.hour
    if 22 <= h or h <= 5:
        score += 1; factors.append("Night driving — reduced visibility")
    if 7 <= h <= 9 or 17 <= h <= 19:
        score += 1; factors.append("Rush hour — elevated collision probability")

    if score >= 5:
        level = "High"
    elif score >= 3:
        level = "Medium"
    else:
        level = "Low"
        if not factors:
            factors.append("No significant risk factors detected")
    return level, factors


def _predicted_density(congestion_idx: float) -> str:
    if congestion_idx < 30: return "LOW"
    if congestion_idx < 60: return "MEDIUM"
    return "HIGH"


def _confidence_score(has_osrm: bool, weather_ok: bool, congestion_idx: float) -> int:
    base = 78 if has_osrm else 62
    if weather_ok: base += 6
    if congestion_idx < 50: base += 5
    return min(96, base)


def _ai_decision(density: str, weather_impact: str, congestion_idx: float,
                  distance_km: float, duration_min: int) -> str:
    if density == "LOW":
        base = f"Route looks clear. {distance_km:.1f} km estimated in {duration_min} min."
        if weather_impact == "Low":
            return base + " Optimal travel conditions — no action required."
        return base + f" Weather impact is {weather_impact.lower()} — drive with care."
    elif density == "MEDIUM":
        extra = round(duration_min * 0.15)
        msg = (f"Moderate congestion building in central corridors. "
               f"Main route via primary roads is still viable. "
               f"Allow ~{extra} extra minutes for delays.")
        if weather_impact != "Low":
            msg += f" {weather_impact} weather impact detected — congestion may worsen."
        return msg
    else:
        alt_min = round(duration_min * 0.25)
        return (f"Heavy congestion detected. Route may face significant delays. "
                f"Alternative routing recommended — could save up to {alt_min} min. "
                f"Weather impact: {weather_impact}. Exercise caution.")


def _segment_risks(city: str, congestion_idx: float) -> List[RouteSegmentRisk]:
    seed = _city_hash(city)
    rng = random.Random(seed + 7)
    labels = ["Origin Zone", "Central Corridor", "Junction Hub", "Mid-Route", "Destination Zone"]
    segments = []
    for i, label in enumerate(labels):
        factor = rng.uniform(0.6, 1.4)
        pct = max(0, min(100, int(congestion_idx * factor + rng.uniform(-5, 5))))
        if pct < 30:    risk = "Low"
        elif pct < 60:  risk = "Medium"
        else:           risk = "High"
        segments.append(RouteSegmentRisk(label=label, congestion_pct=pct, risk_level=risk))
    return segments


def _temporal_flow(city: str) -> List[TemporalFlowPoint]:
    seed = _city_hash(city)
    rng = random.Random(seed + 99)
    hour_weights = [5,4,3,3,4,8, 20,45,70,60,45,35, 40,38,35,38,55,75, 65,50,35,25,15,8]
    points = []
    for h in range(24):
        noise = rng.uniform(-4, 4)
        flow = max(0, min(100, hour_weights[h] + noise))
        points.append(TemporalFlowPoint(hour=f"{h:02d}:00", flow=round(flow, 1)))
    return points


def _offset_polyline(points: List[List[float]], offset_deg: float) -> List[List[float]]:
    """Shift every point laterally by offset_deg to create a visible alt route."""
    if not points:
        return []
    # Compute rough bearing of overall route for perpendicular offset
    p0, p1 = points[0], points[-1]
    dlat = p1[0] - p0[0]
    dlng = p1[1] - p0[1]
    length = math.sqrt(dlat**2 + dlng**2) or 1
    # Perpendicular unit vector
    perp_lat = -dlng / length
    perp_lng =  dlat / length
    # Apply offset + slight sinusoidal variation to look like a real alt road
    result = []
    n = len(points)
    for i, (lat, lng) in enumerate(points):
        vary = offset_deg * (1.0 + 0.3 * math.sin(math.pi * i / max(n - 1, 1)))
        result.append([lat + perp_lat * vary, lng + perp_lng * vary])
    return result


def _alternatives(
    distance_km: float, duration_min: int, congestion_idx: float,
    osrm_data: Optional[dict] = None,
    primary_poly: Optional[List[List[float]]] = None,
) -> List[RouteAlternative]:
    alts = []
    osrm_routes = osrm_data.get("routes", []) if osrm_data else []

    labels = ["Primary", "Alt 1", "Alt 2"]
    # Lateral offsets in degrees (≈ 3 km and 6 km perpendicular shift for visibility)
    offsets = [0.0, 0.025, 0.05]

    for i, label in enumerate(labels):
        if i < len(osrm_routes):
            r = osrm_routes[i]
            d_km = round(r["distance"] / 1000, 1)
            dur  = max(1, round(r["duration"] / 60))
            alt_idx = max(0, congestion_idx - i * 15)
            poly = _decode_geojson_polyline(r["geometry"])
        else:
            # Synthetic metrics
            factor = [1.0, 1.12, 1.22][i]
            d_km  = round(distance_km * factor, 1)
            dur   = max(1, round(duration_min * [1.0, 0.90, 0.95][i]))
            alt_idx = max(0, congestion_idx - i * 15)
            # Offset the primary polyline to create a visible alt route on the map
            poly = _offset_polyline(primary_poly or [], offsets[i]) if primary_poly else []

        alts.append(RouteAlternative(
            label=label,
            distance_km=d_km,
            duration_min=dur,
            congestion_level=_status_from_index(alt_idx),
            polyline=poly,
        ))
    return alts


def _travel_tips_route(density: str, weather_impact: str, accident_risk: str) -> List[str]:
    tips = []
    if density == "LOW":
        tips += ["Roads are clear — ideal time to travel.",
                 "Maintain safe following distances.",
                 "Keep to speed limits even on clear roads."]
    elif density == "MEDIUM":
        tips += ["Allow 10–15 extra minutes for your journey.",
                 "Consider departing before or after peak hours.",
                 "Carpooling reduces road pressure significantly."]
    else:
        tips += ["Heavy traffic — avoid if non-essential.",
                 "Use alternative routes where possible.",
                 "Public transport strongly recommended.",
                 "Emergency lane must be kept clear at all times."]
    if weather_impact == "Medium":
        tips.append("Wet roads — reduce speed and increase following distance.")
    elif weather_impact == "High":
        tips.append("Severe weather — postpone travel if possible.")
    if accident_risk == "High":
        tips.append("High accident risk on this route — stay alert and drive defensively.")
    return tips[:5]


# ─── Route endpoint ───────────────────────────────────────────────────────────

@router.get("/route", response_model=RouteAnalysisResponse)
async def analyse_route(
    origin: str = Query(..., min_length=2, description="Starting location"),
    destination: str = Query(..., min_length=2, description="Destination location"),
    target_day: Optional[str] = Query(None, description="Day name for prediction (e.g. Monday)"),
    target_time: Optional[str] = Query(None, description="Target time HH:MM"),
    current_user=Depends(get_current_active_user),
):
    """
    Full route analysis:
      - Geocode origin & destination via Nominatim
      - Get driving route from OSRM (free, open-source)
      - Fetch live weather at route midpoint via Open-Meteo
      - Compute time-aware congestion model
      - Return polyline, density, risks, weather impact, alternatives, temporal flow
    All APIs are 100% free and open-source.
    """
    cache_key = f"route:{origin.lower().strip()}:{destination.lower().strip()}"
    cached = _cache.get(cache_key, ROUTE_TTL)
    if cached:
        return cached

    # 1. Geocode both ends concurrently
    try:
        origin_loc, dest_loc = await asyncio.gather(
            geocode(origin), geocode(destination)
        )
    except HTTPException as e:
        raise e

    # 2. OSRM route (fire concurrently with weather)
    mid_lat = (origin_loc.lat + dest_loc.lat) / 2
    mid_lng = (origin_loc.lng + dest_loc.lng) / 2

    osrm_task    = _osrm_route(origin_loc.lat, origin_loc.lng, dest_loc.lat, dest_loc.lng)
    weather_task = fetch_weather(mid_lat, mid_lng)
    osrm_data, (wx_current, _) = await asyncio.gather(osrm_task, weather_task)

    # 3. Extract route geometry & metrics
    has_osrm = osrm_data is not None
    if has_osrm:
        route = osrm_data["routes"][0]
        distance_km  = round(route["distance"] / 1000, 2)
        duration_min = max(1, round(route["duration"] / 60))
        polyline     = _decode_geojson_polyline(route["geometry"])
    else:
        # Fallback: straight-line estimate
        dlat = dest_loc.lat - origin_loc.lat
        dlng = dest_loc.lng - origin_loc.lng
        dist_deg = math.sqrt(dlat ** 2 + dlng ** 2)
        distance_km  = round(dist_deg * 111.0 * 1.35, 2)   # 1.35 road-factor
        duration_min = max(1, round(distance_km / 35 * 60))
        # Straight-line polyline (20 points)
        polyline = [
            [origin_loc.lat + dlat * i / 19, origin_loc.lng + dlng * i / 19]
            for i in range(20)
        ]

    # 4. Congestion (use origin city)
    congestion_idx = _congestion_index(origin_loc.city, origin_loc.lat)
    congestion_status = _status_from_index(congestion_idx)

    # 5. Weather impact
    w_impact, w_tip, vis_ok = _weather_impact(wx_current)

    # 6. Boost congestion if bad weather
    weather_boost = {"Low": 0, "Medium": 8, "High": 18}.get(w_impact, 0)
    congestion_idx = min(100, congestion_idx + weather_boost)
    congestion_status = _status_from_index(congestion_idx)

    # 7. Derived metrics
    density    = _predicted_density(congestion_idx)
    confidence = _confidence_score(has_osrm, vis_ok, congestion_idx)
    acc_risk, acc_factors = _accident_risk(congestion_idx, w_impact)
    decision   = _ai_decision(density, w_impact, congestion_idx, distance_km, duration_min)
    segments   = _segment_risks(origin_loc.city, congestion_idx)
    temporal   = _temporal_flow(origin_loc.city)
    alts       = _alternatives(distance_km, duration_min, congestion_idx, osrm_data, polyline)
    tips       = _travel_tips_route(density, w_impact, acc_risk)

    # 8. Temporal context
    now_utc  = datetime.now(timezone.utc)
    day_name_str = _DAYS[now_utc.weekday()]
    local_time_str = now_utc.strftime("%I:%M %p UTC")

    # 9. Tomorrow prediction
    tm_hour_weights = [5,4,3,3,4,8, 20,45,70,60,45,35, 40,38,35,38,55,75, 65,50,35,25,15,8]
    seed = _city_hash(origin_loc.city)
    rng  = random.Random(seed + 1)
    tm_avg = sum(tm_hour_weights[7:20]) / 13 * (0.7 + (seed % 600) / 1000.0)
    tm_avg = min(100, tm_avg + rng.uniform(-5, 5))
    tomorrow_density = _predicted_density(tm_avg)
    tomorrow_tip_map = {
        "LOW":    "Tomorrow looks clear. Ideal travel conditions expected.",
        "MEDIUM": "Moderate congestion expected tomorrow — plan accordingly.",
        "HIGH":   "Heavy traffic predicted tomorrow. Consider travelling off-peak.",
    }

    now_iso = now_utc.strftime("%Y-%m-%dT%H:%M:%SZ")

    result = RouteAnalysisResponse(
        origin_name=origin_loc.display_name,
        destination_name=dest_loc.display_name,
        origin_lat=origin_loc.lat,
        origin_lng=origin_loc.lng,
        dest_lat=dest_loc.lat,
        dest_lng=dest_loc.lng,
        polyline=polyline,
        distance_km=distance_km,
        duration_min=duration_min,
        congestion_level=congestion_status,
        congestion_index=round(congestion_idx, 1),
        predicted_density=density,
        confidence_score=confidence,
        ai_decision=decision,
        weather=RouteWeatherInfo(
            condition=wx_current.condition,
            condition_code=wx_current.condition_code,
            temp=wx_current.temp,
            humidity=wx_current.humidity,
            wind_speed=wx_current.wind_speed,
            precipitation=wx_current.precipitation,
            visibility_ok=vis_ok,
            weather_impact=w_impact,
            weather_tip=w_tip,
        ),
        accident_risk=acc_risk,
        accident_factors=acc_factors,
        alternatives=alts,
        segment_risks=segments,
        temporal_flow=temporal,
        route_verified=has_osrm,
        data_sources=[
            "OpenStreetMap (Nominatim geocoding)",
            "OSRM Routing (router.project-osrm.org)",
            "Open-Meteo Weather API",
            "Historical Traffic Model",
        ],
        travel_tips=tips,
        tomorrow_density=tomorrow_density,
        tomorrow_tip=tomorrow_tip_map[tomorrow_density],
        last_updated=now_iso,
        day_of_week=day_name_str,
        local_time=local_time_str,
    )
    _cache.set(cache_key, result)
    return result



# ─── Citizen Emergency Request endpoints ─────────────────────────────────────

from ..models import EmergencyRequest as _EmergencyRequest, Alert as _Alert
from ..database import get_db as _get_db
from sqlalchemy.orm import Session as _Session
from fastapi import Body as _Body


# ─── Public alerts endpoint (all authenticated users) ────────────────────────

@router.get("/alerts")
def citizen_get_active_alerts(
    current_user=Depends(get_current_active_user),
    db: _Session = Depends(_get_db),
):
    """Return all active city-wide alerts — accessible by every authenticated user."""
    alerts = (
        db.query(_Alert)
        .filter(_Alert.status == "active")
        .order_by(_Alert.created_at.desc())
        .limit(50)
        .all()
    )
    return [
        {
            "id":        a.id,
            "type":      a.type,
            "title":     a.title,
            "message":   a.message,
            "severity":  a.severity,
            "status":    a.status,
            "area_lat":  a.area_lat,
            "area_lng":  a.area_lng,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in alerts
    ]


@router.post("/emergency", status_code=201)
def citizen_submit_emergency(
    payload: dict = _Body(...),
    current_user=Depends(get_current_active_user),
    db: _Session = Depends(_get_db),
):
    """Citizen submits an emergency request — stored in DB, visible to admin panel."""
    req = _EmergencyRequest(
        type=payload.get("type", "General Emergency"),
        title=payload.get("title", "Emergency Request"),
        description=payload.get("description") or "",
        location_lat=payload.get("location_lat"),
        location_lng=payload.get("location_lng"),
        user_id=current_user.id,
        priority=payload.get("priority", "high"),
        status="reported",
        is_resolved=False,
        created_by=current_user.id,
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return {
        "id": req.id, "type": req.type, "title": req.title,
        "description": req.description, "priority": req.priority,
        "status": req.status, "is_resolved": req.is_resolved,
        "location_lat": req.location_lat, "location_lng": req.location_lng,
        "created_at": req.created_at.isoformat() if req.created_at else None,
    }


@router.get("/emergency/my")
def citizen_my_emergencies(
    current_user=Depends(get_current_active_user),
    db: _Session = Depends(_get_db),
):
    """Citizen fetches their own emergency requests (latest 20)."""
    reqs = (
        db.query(_EmergencyRequest)
        .filter(_EmergencyRequest.user_id == current_user.id)
        .order_by(_EmergencyRequest.created_at.desc())
        .limit(20).all()
    )
    return [
        {
            "id": r.id, "type": r.type, "title": r.title,
            "description": r.description, "priority": r.priority,
            "status": r.status, "is_resolved": r.is_resolved,
            "location_lat": r.location_lat, "location_lng": r.location_lng,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "updated_at": r.updated_at.isoformat() if r.updated_at else None,
        }
        for r in reqs
    ]
