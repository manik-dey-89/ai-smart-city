"""
Map router — real city infrastructure data.

Strategy
--------
* /api/map/db-markers  — instant, DB-only (no Overpass).  Returns in <50 ms.
* /api/map/markers     — full response: DB data + Overpass OSM facilities.

Overpass improvements
---------------------
* Race 3 public mirrors — use whichever replies first (asyncio.wait FIRST_COMPLETED).
* Per-mirror connect timeout 8 s, read timeout 20 s.
* Cache grid coarsened to 2 decimal places (~1 km) so nearby searches reuse cache.
* In-progress lock prevents duplicate parallel Overpass fetches for the same cell.
* Empty results are never cached (Overpass may have been temporarily unavailable).
"""
import math
import time
import asyncio
from typing import Optional, List, Dict, Tuple, Any, Set

import httpx
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas import MapResponse, MapMarker
from ..dependencies import get_current_active_user
from ..models import Complaint, EmergencyRequest, TrafficIncident

router = APIRouter(prefix="/api/map", tags=["map"])

HEADERS = {"User-Agent": "SmartCityDashboard/1.0 (educational project)"}

# Public Overpass mirrors — raced in parallel; fastest wins
OVERPASS_MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]

# TTL cache: cache_key → (markers, timestamp)
_map_cache: Dict[str, Tuple[Any, float]] = {}
MAP_CACHE_TTL = 600   # 10 min

# In-progress lock: prevent duplicate Overpass fetches for the same cache key
_in_progress: Set[str] = set()


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    dl = math.radians(lat2 - lat1)
    dn = math.radians(lng2 - lng1)
    a  = (math.sin(dl / 2) ** 2
          + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dn / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


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

# Amenity groups — one Overpass request per group
AMENITY_GROUPS: Dict[str, List[List[str]]] = {
    "emergency": [["hospital", "clinic", "pharmacy", "fire_station", "police"]],
    "traffic":   [["fuel", "bus_station", "parking"]],
    "sensors":   [["bank", "atm", "school", "post_office", "supermarket"]],
}
AMENITY_GROUPS["all"] = (
    AMENITY_GROUPS["emergency"]
    + AMENITY_GROUPS["traffic"]
    + AMENITY_GROUPS["sensors"]
)


# ─── Overpass helpers ─────────────────────────────────────────────────────────

async def _query_one_mirror(url: str, query: str) -> List[MapMarker]:
    """POST a single Overpass query to one mirror. Returns [] on any error."""
    markers: List[MapMarker] = []
    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(connect=8.0, read=20.0, write=5.0, pool=5.0),
            headers=HEADERS,
        ) as client:
            resp = await client.post(url, data={"data": query})
            if resp.status_code != 200:
                return markers
            for el in resp.json().get("elements", []):
                tags    = el.get("tags", {})
                amenity = tags.get("amenity", "")
                if not amenity:
                    continue
                name   = (tags.get("name") or tags.get("name:en")
                          or amenity.replace("_", " ").title())
                el_lat = el.get("lat") or el.get("center", {}).get("lat")
                el_lng = el.get("lon") or el.get("center", {}).get("lon")
                if el_lat is None or el_lng is None:
                    continue
                m_type = AMENITY_TO_TYPE.get(amenity, "place")
                phone  = tags.get("phone") or tags.get("contact:phone") or ""
                markers.append(MapMarker(
                    id=f"osm-{el.get('id', 0)}-{amenity[:6]}",
                    type=m_type,
                    lat=round(el_lat, 6),
                    lng=round(el_lng, 6),
                    name=name,
                    status=phone,   # phone stored in status; distance added by caller
                ))
    except Exception:
        pass
    return markers


async def _fetch_one_group(
    amenity_list: List[str], lat: float, lng: float, radius_m: int
) -> List[MapMarker]:
    """
    Build the Overpass query for one amenity group then race all mirrors.
    Returns as soon as the first mirror responds with data (or [] if all fail/timeout).
    """
    parts: List[str] = []
    for amenity in amenity_list:
        parts.append(f'node["amenity"="{amenity}"](around:{radius_m},{lat},{lng});')
        parts.append(f'way["amenity"="{amenity}"](around:{radius_m},{lat},{lng});')
    query = f'[out:json][timeout:18];\n(\n  {"  ".join(parts)}\n);\nout center 25;'

    # Create one task per mirror
    tasks = {
        asyncio.ensure_future(_query_one_mirror(mirror, query)): mirror
        for mirror in OVERPASS_MIRRORS
    }

    results: List[MapMarker] = []
    pending = set(tasks.keys())

    while pending:
        done, pending = await asyncio.wait(pending, return_when=asyncio.FIRST_COMPLETED)
        for fut in done:
            try:
                data = fut.result()
                if data:                    # first non-empty response wins
                    results = data
                    # Cancel remaining mirror requests — we have what we need
                    for p in pending:
                        p.cancel()
                    pending = set()
                    break
            except Exception:
                pass

    # Attach distance to status field
    for m in results:
        phone = m.status or ""
        dist_km = _haversine_km(lat, lng, m.lat, m.lng)
        m.status = f"{round(dist_km, 2)} km away" + (f" · {phone}" if phone else "")

    return results


async def _fetch_overpass_parallel(
    lat: float, lng: float, layer: str, radius_m: int
) -> List[MapMarker]:
    """
    Fetch all amenity groups for the given layer in parallel (asyncio.gather).
    Uses a 2-decimal cache grid (~1 km cells) and an in-progress lock to
    prevent duplicate fetches for the same cell.
    """
    # Coarse grid — 2 decimal places ≈ 1 km precision
    cache_key = f"{layer}:{round(lat, 2)}:{round(lng, 2)}:{radius_m}"

    cached = _map_cache.get(cache_key)
    if cached and (time.time() - cached[1]) < MAP_CACHE_TTL:
        return cached[0]

    # If another request is already fetching this exact cell, wait briefly
    # and return from cache once it populates.
    if cache_key in _in_progress:
        for _ in range(30):                 # wait up to 3 s in 100 ms steps
            await asyncio.sleep(0.1)
            cached = _map_cache.get(cache_key)
            if cached:
                return cached[0]
        return []                           # give up — caller gets [] this time

    _in_progress.add(cache_key)
    try:
        groups = AMENITY_GROUPS.get(layer, AMENITY_GROUPS["all"])
        tasks  = [_fetch_one_group(g, lat, lng, radius_m) for g in groups]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        seen: set = set()
        markers: List[MapMarker] = []
        for result in results:
            if isinstance(result, Exception):
                continue
            for m in result:
                key = f"{m.name[:30]}_{round(m.lat, 4)}_{round(m.lng, 4)}"
                if key not in seen:
                    seen.add(key)
                    markers.append(m)

        markers.sort(key=lambda m: _haversine_km(lat, lng, m.lat, m.lng))

        # Never cache empty — Overpass may have been temporarily unavailable
        if markers:
            _map_cache[cache_key] = (markers, time.time())
        return markers
    finally:
        _in_progress.discard(cache_key)


# ─── DB helpers (instant, no external calls) ─────────────────────────────────

def _db_markers(
    center_lat: float, center_lng: float, layer: str, r_m: int, db: Session
) -> List[MapMarker]:
    """Return complaint + emergency + traffic markers from the local DB."""
    markers: List[MapMarker] = []

    # Active emergency SOS requests
    if layer in ("all", "emergency"):
        for r in (
            db.query(EmergencyRequest)
            .filter(
                EmergencyRequest.is_resolved == False,
                EmergencyRequest.location_lat.isnot(None),
            )
            .order_by(EmergencyRequest.created_at.desc())
            .limit(20)
            .all()
        ):
            d = _haversine_km(center_lat, center_lng, r.location_lat, r.location_lng)
            if d <= r_m / 1000:
                markers.append(MapMarker(
                    id=f"em-{r.id[:8]}",
                    type="emergency_sos",
                    lat=round(r.location_lat, 6),
                    lng=round(r.location_lng, 6),
                    name=f"🆘 {r.title}",
                    status=(
                        f"{r.priority.upper()} · "
                        f"{r.status.replace('_', ' ').title()} · "
                        f"{round(d, 2)} km"
                    ),
                ))

    # Complaints
    if layer in ("all", "emergency", "sensors", "traffic"):
        crime_kw   = ["theft", "robbery", "assault", "criminal", "police", "murder"]
        fire_kw    = ["fire", "gas leak", "explosion"]
        medical_kw = ["medical", "accident", "ambulance"]
        traffic_kw = ["traffic", "road", "pothole", "signal", "parking"]

        for c in (
            db.query(Complaint)
            .filter(
                Complaint.location_lat.isnot(None),
                Complaint.status.notin_(["resolved", "rejected"]),
            )
            .order_by(Complaint.created_at.desc())
            .limit(40)
            .all()
        ):
            d = _haversine_km(center_lat, center_lng, c.location_lat, c.location_lng)
            if d > r_m / 1000:
                continue
            t = c.type.lower()
            if   any(k in t for k in crime_kw)   and layer in ("all", "emergency"): m_type = "complaint_crime"
            elif any(k in t for k in fire_kw)    and layer in ("all", "emergency"): m_type = "complaint_fire"
            elif any(k in t for k in medical_kw) and layer in ("all", "emergency"): m_type = "complaint_medical"
            elif any(k in t for k in traffic_kw) and layer in ("all", "traffic"):   m_type = "complaint_traffic"
            elif layer in ("all", "sensors"):                                        m_type = "complaint_general"
            else:
                continue
            markers.append(MapMarker(
                id=f"cmp-{c.id[:8]}",
                type=m_type,
                lat=round(c.location_lat, 6),
                lng=round(c.location_lng, 6),
                name=c.title,
                status=(
                    f"{c.tracking_id or 'No ID'} · "
                    f"{c.status.replace('_', ' ').title()} · "
                    f"{round(d, 2)} km"
                ),
            ))

    # Traffic incidents
    if layer in ("all", "traffic"):
        for t in (
            db.query(TrafficIncident)
            .filter(
                TrafficIncident.status.notin_(["resolved", "cancelled"]),
                TrafficIncident.location_lat.isnot(None),
            )
            .order_by(TrafficIncident.created_at.desc())
            .limit(15)
            .all()
        ):
            d = _haversine_km(center_lat, center_lng, t.location_lat, t.location_lng)
            if d <= r_m / 1000:
                markers.append(MapMarker(
                    id=f"ti-{t.id[:8]}",
                    type="traffic_incident",
                    lat=round(t.location_lat, 6),
                    lng=round(t.location_lng, 6),
                    name=t.title,
                    status=f"Severity: {t.severity.title()} · {round(d, 2)} km",
                ))

    return markers


def _dedup(markers: List[MapMarker]) -> List[MapMarker]:
    seen: set = set()
    out: List[MapMarker] = []
    for m in markers:
        if m.id not in seen:
            seen.add(m.id)
            out.append(m)
    return out


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/db-markers", response_model=MapResponse)
def get_db_markers(
    layer:  Optional[str]   = Query("all"),
    lat:    Optional[float] = Query(None),
    lng:    Optional[float] = Query(None),
    radius: Optional[int]   = Query(6000),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """
    Instant DB-only endpoint — returns complaint / emergency / traffic markers
    with no Overpass call. Used by the frontend for the first paint (<50 ms).
    """
    center_lat = lat if lat is not None else 22.5726
    center_lng = lng if lng is not None else 88.3639
    r_m = radius or 6000
    markers = _db_markers(center_lat, center_lng, layer, r_m, db)
    return MapResponse(markers=_dedup(markers))


@router.get("/markers", response_model=MapResponse)
async def get_map_markers(
    layer:  Optional[str]   = Query("all"),
    lat:    Optional[float] = Query(None),
    lng:    Optional[float] = Query(None),
    radius: Optional[int]   = Query(6000),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """
    Full markers endpoint: OSM facilities (via Overpass, cached) + DB data.
    The frontend calls this after painting DB markers for the full picture.
    """
    center_lat = lat if lat is not None else 22.5726
    center_lng = lng if lng is not None else 88.3639
    r_m = radius or 6000

    # 1. OSM facilities via Overpass (cached, mirror-raced)
    osm_markers: List[MapMarker] = list(
        await _fetch_overpass_parallel(center_lat, center_lng, layer, r_m)
    )

    # 2. DB markers
    db_markers = _db_markers(center_lat, center_lng, layer, r_m, db)

    return MapResponse(markers=_dedup(osm_markers + db_markers))
