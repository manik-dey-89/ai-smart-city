"""
Map router — real city infrastructure data with parallel Overpass fetching and TTL caching.
"""
import math
import time
import asyncio
from typing import Optional, List, Dict, Tuple, Any

import httpx
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas import MapResponse, MapMarker
from ..dependencies import get_current_active_user
from ..models import Complaint, EmergencyRequest, TrafficIncident

router = APIRouter(prefix="/api/map", tags=["map"])

HEADERS = {"User-Agent": "SmartCityDashboard/1.0 (educational project)"}
OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Simple TTL cache: key → (result, timestamp)
_map_cache: Dict[str, Tuple[Any, float]] = {}
MAP_CACHE_TTL = 600   # 10 minutes — Overpass data doesn't change that fast


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    dl = math.radians(lat2 - lat1)
    dn = math.radians(lng2 - lng1)
    a  = math.sin(dl/2)**2 + math.cos(math.radians(lat1))*math.cos(math.radians(lat2))*math.sin(dn/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))


AMENITY_TO_TYPE: dict = {
    "hospital":          "hospital",
    "clinic":            "clinic",
    "doctors":           "clinic",
    "pharmacy":          "pharmacy",
    "police":            "police",
    "fire_station":      "fire",
    "ambulance_station": "ambulance",
    "fuel":              "fuel",
    "bus_station":       "bus_stop",
    "parking":           "parking",
    "bank":              "bank",
    "atm":               "atm",
    "supermarket":       "supermarket",
    "marketplace":       "market",
    "post_office":       "post_office",
    "school":            "school",
    "college":           "college",
    "university":        "university",
    "library":           "library",
}

# Each group is one Overpass request — kept small for speed
AMENITY_GROUPS = {
    "emergency": [
        ["hospital", "clinic", "pharmacy", "fire_station", "police"],
    ],
    "traffic": [
        ["fuel", "bus_station", "parking"],
    ],
    "sensors": [
        ["bank", "atm", "school", "post_office", "supermarket"],
    ],
}
# "all" = one combined group per category (3 parallel requests max)
AMENITY_GROUPS["all"] = (
    AMENITY_GROUPS["emergency"] +
    AMENITY_GROUPS["traffic"] +
    AMENITY_GROUPS["sensors"]
)


async def _fetch_one_group(amenity_list: list, lat: float, lng: float, radius_m: int) -> List[MapMarker]:
    """Fetch one group of amenities from Overpass. Returns quickly (single HTTP call)."""
    parts = []
    for amenity in amenity_list:
        parts.append(f'node["amenity"="{amenity}"](around:{radius_m},{lat},{lng});')
        parts.append(f'way["amenity"="{amenity}"](around:{radius_m},{lat},{lng});')

    query = f'[out:json][timeout:25];\n(\n  {"  ".join(parts)}\n);\nout center 20;'

    markers: List[MapMarker] = []
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(30.0), headers=HEADERS) as client:
            resp = await client.post(OVERPASS_URL, data={"data": query})
            if resp.status_code != 200:
                return markers
            for el in resp.json().get("elements", []):
                tags    = el.get("tags", {})
                amenity = tags.get("amenity", "")
                name    = tags.get("name") or tags.get("name:en") or amenity.replace("_", " ").title()
                el_lat  = el.get("lat") or el.get("center", {}).get("lat", lat)
                el_lng  = el.get("lon") or el.get("center", {}).get("lon", lng)
                m_type  = AMENITY_TO_TYPE.get(amenity, "place")
                phone   = tags.get("phone") or tags.get("contact:phone") or ""
                dist_km = _haversine_km(lat, lng, el_lat, el_lng)
                status  = f"{round(dist_km, 2)} km away" + (f" · {phone}" if phone else "")
                markers.append(MapMarker(
                    id=f"osm-{el.get('id',0)}-{amenity[:6]}",
                    type=m_type, lat=round(el_lat, 6), lng=round(el_lng, 6),
                    name=name, status=status,
                ))
    except Exception:
        pass
    return markers


async def _fetch_overpass_parallel(lat: float, lng: float, layer: str, radius_m: int) -> List[MapMarker]:
    """Fire all Overpass group requests in parallel — much faster than sequential."""
    cache_key = f"{layer}:{round(lat,3)}:{round(lng,3)}:{radius_m}"
    cached = _map_cache.get(cache_key)
    if cached and (time.time() - cached[1]) < MAP_CACHE_TTL:
        return cached[0]

    groups = AMENITY_GROUPS.get(layer, AMENITY_GROUPS["all"])
    tasks  = [_fetch_one_group(g, lat, lng, radius_m) for g in groups]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    seen: set = set()
    markers: List[MapMarker] = []
    for result in results:
        if isinstance(result, Exception):
            continue
        for m in result:
            key = f"{m.name[:30]}_{round(m.lat,4)}_{round(m.lng,4)}"
            if key not in seen:
                seen.add(key)
                markers.append(m)

    markers.sort(key=lambda m: _haversine_km(lat, lng, m.lat, m.lng))
    _map_cache[cache_key] = (markers, time.time())
    return markers


@router.get("/markers", response_model=MapResponse)
async def get_map_markers(
    layer:  Optional[str]   = Query("all"),
    lat:    Optional[float] = Query(None),
    lng:    Optional[float] = Query(None),
    radius: Optional[int]   = Query(6000),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    center_lat = lat if lat is not None else 22.5726
    center_lng = lng if lng is not None else 88.3639
    r_m = radius or 6000

    # 1. OSM facilities — parallel fetch with cache
    markers: List[MapMarker] = list(
        await _fetch_overpass_parallel(center_lat, center_lng, layer, r_m)
    )

    # 2. DB: active emergency requests with location
    if layer in ("all", "emergency"):
        for r in (
            db.query(EmergencyRequest)
            .filter(EmergencyRequest.is_resolved==False,
                    EmergencyRequest.location_lat.isnot(None))
            .order_by(EmergencyRequest.created_at.desc()).limit(20).all()
        ):
            d = _haversine_km(center_lat, center_lng, r.location_lat, r.location_lng)
            if d <= r_m/1000:
                markers.append(MapMarker(
                    id=f"em-{r.id[:8]}", type="emergency_sos",
                    lat=round(r.location_lat,6), lng=round(r.location_lng,6),
                    name=f"🆘 {r.title}",
                    status=f"{r.priority.upper()} · {r.status.replace('_',' ').title()} · {round(d,2)}km",
                ))

    # 3. DB: complaints with location
    if layer in ("all", "emergency", "sensors", "traffic"):
        crime_kw   = ["theft","robbery","assault","criminal","police","murder"]
        fire_kw    = ["fire","gas leak","explosion"]
        medical_kw = ["medical","accident","ambulance"]
        traffic_kw = ["traffic","road","pothole","signal","parking"]

        for c in (
            db.query(Complaint)
            .filter(Complaint.location_lat.isnot(None),
                    Complaint.status.notin_(["resolved","rejected"]))
            .order_by(Complaint.created_at.desc()).limit(40).all()
        ):
            d = _haversine_km(center_lat, center_lng, c.location_lat, c.location_lng)
            if d > r_m/1000:
                continue
            t = c.type.lower()
            if   any(k in t for k in crime_kw)   and layer in ("all","emergency"): m_type="complaint_crime"
            elif any(k in t for k in fire_kw)    and layer in ("all","emergency"): m_type="complaint_fire"
            elif any(k in t for k in medical_kw) and layer in ("all","emergency"): m_type="complaint_medical"
            elif any(k in t for k in traffic_kw) and layer in ("all","traffic"):   m_type="complaint_traffic"
            elif layer in ("all","sensors"):                                        m_type="complaint_general"
            else: continue
            markers.append(MapMarker(
                id=f"cmp-{c.id[:8]}", type=m_type,
                lat=round(c.location_lat,6), lng=round(c.location_lng,6),
                name=c.title,
                status=f"{c.tracking_id or 'No ID'} · {c.status.replace('_',' ').title()} · {round(d,2)}km",
            ))

    # 4. DB: traffic incidents
    if layer in ("all", "traffic"):
        for t in (
            db.query(TrafficIncident)
            .filter(TrafficIncident.status.notin_(["resolved","cancelled"]),
                    TrafficIncident.location_lat.isnot(None))
            .order_by(TrafficIncident.created_at.desc()).limit(15).all()
        ):
            d = _haversine_km(center_lat, center_lng, t.location_lat, t.location_lng)
            if d <= r_m/1000:
                markers.append(MapMarker(
                    id=f"ti-{t.id[:8]}", type="traffic_incident",
                    lat=round(t.location_lat,6), lng=round(t.location_lng,6),
                    name=t.title,
                    status=f"Severity: {t.severity.title()} · {round(d,2)}km",
                ))

    # Deduplicate
    seen_ids: set = set()
    unique = [m for m in markers if m.id not in seen_ids and not seen_ids.add(m.id)]
    return MapResponse(markers=unique)
