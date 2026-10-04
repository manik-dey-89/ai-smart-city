"""
Agriculture router — AgriHub-style smart farming portal.
All endpoints require authentication. Public market listings are readable by all.

Routes:
  Crops (farmer's own):
    POST   /api/agri/crops            — add crop
    GET    /api/agri/crops            — my crops
    PUT    /api/agri/crops/{id}       — update
    DELETE /api/agri/crops/{id}       — delete

  Market:
    POST   /api/agri/market           — create listing
    GET    /api/agri/market           — browse all active listings
    GET    /api/agri/market/my        — my listings
    DELETE /api/agri/market/{id}      — remove listing

  Government Schemes:
    GET    /api/agri/schemes          — browse schemes

  Expert Q&A:
    POST   /api/agri/queries          — post question
    GET    /api/agri/queries          — browse all questions
    GET    /api/agri/queries/my       — my questions

  Market Prices (live via Agmarknet / fallback static data):
    GET    /api/agri/prices           — current mandi prices

  Crop Recommendation (rule-based, no ML key needed):
    POST   /api/agri/recommend        — recommend crops based on soil/state/season
"""

from datetime import datetime, timezone
from typing import List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import AgriCrop, AgriMarketListing, AgriScheme, AgriQuery, User
from ..schemas import (
    AgriCropCreate, AgriCropResponse,
    AgriMarketListingCreate, AgriMarketListingResponse,
    AgriSchemeResponse,
    AgriQueryCreate, AgriQueryResponse,
)
from ..dependencies import get_current_active_user

router = APIRouter(prefix="/api/agri", tags=["agriculture"])

HEADERS = {"User-Agent": "SmartCityAgriHub/1.0"}

# ─── Static mandi price data (free, no external key needed) ──────────────────
# Source: representative Indian mandi prices (Agmarknet does not have open API)
MANDI_PRICES = [
    {"crop":"Rice (Paddy)", "variety":"Common", "min":1200,"max":2000,"modal":1600,"unit":"Quintal","market":"Kolkata","state":"West Bengal"},
    {"crop":"Wheat",        "variety":"Desi",   "min":1950,"max":2300,"modal":2100,"unit":"Quintal","market":"Delhi",  "state":"Delhi"},
    {"crop":"Maize",        "variety":"Yellow", "min":1200,"max":1800,"modal":1500,"unit":"Quintal","market":"Pune",   "state":"Maharashtra"},
    {"crop":"Potato",       "variety":"Jyoti",  "min":600, "max":1400,"modal":900, "unit":"Quintal","market":"Agra",   "state":"Uttar Pradesh"},
    {"crop":"Tomato",       "variety":"Hybrid", "min":400, "max":2000,"modal":1000,"unit":"Quintal","market":"Nashik", "state":"Maharashtra"},
    {"crop":"Onion",        "variety":"Red",    "min":500, "max":2500,"modal":1400,"unit":"Quintal","market":"Lasalgaon","state":"Maharashtra"},
    {"crop":"Soybean",      "variety":"Yellow", "min":3800,"max":4600,"modal":4200,"unit":"Quintal","market":"Indore", "state":"Madhya Pradesh"},
    {"crop":"Mustard",      "variety":"Yellow", "min":4500,"max":5200,"modal":4800,"unit":"Quintal","market":"Jaipur", "state":"Rajasthan"},
    {"crop":"Sugarcane",    "variety":"CO-86032","min":285,"max":315, "modal":295, "unit":"Quintal","market":"Lucknow","state":"Uttar Pradesh"},
    {"crop":"Cotton",       "variety":"Long Staple","min":6000,"max":7500,"modal":6800,"unit":"Quintal","market":"Rajkot","state":"Gujarat"},
    {"crop":"Groundnut",    "variety":"Bold",   "min":4500,"max":6000,"modal":5200,"unit":"Quintal","market":"Junagadh","state":"Gujarat"},
    {"crop":"Turmeric",     "variety":"Nizam",  "min":6000,"max":9000,"modal":7500,"unit":"Quintal","market":"Nizamabad","state":"Telangana"},
    {"crop":"Chilli",       "variety":"Teja",   "min":8000,"max":18000,"modal":12000,"unit":"Quintal","market":"Guntur","state":"Andhra Pradesh"},
    {"crop":"Banana",       "variety":"Robusta","min":700, "max":1800,"modal":1200,"unit":"Quintal","market":"Erode", "state":"Tamil Nadu"},
    {"crop":"Mango",        "variety":"Alphonso","min":2000,"max":8000,"modal":4500,"unit":"Quintal","market":"Valsad","state":"Gujarat"},
]

# ─── Crop recommendation rules ─────────────────────────────────────────────────
def _recommend_crops(soil: str, state: str, season: str, rainfall: str) -> List[dict]:
    soil    = (soil    or "").lower()
    state   = (state   or "").lower()
    season  = (season  or "").lower()
    rainfall= (rainfall or "").lower()

    recs = []

    # Season-based base recommendations
    if season in ("kharif", "monsoon", "summer"):
        recs += [
            {"crop":"Rice",     "suitability":"High",   "reason":"Kharif staple, requires high water"},
            {"crop":"Maize",    "suitability":"High",   "reason":"Warm season crop, good Kharif choice"},
            {"crop":"Soybean",  "suitability":"Medium", "reason":"Good in monsoon with well-drained soil"},
            {"crop":"Cotton",   "suitability":"Medium", "reason":"Suitable in warm climate with black soil"},
            {"crop":"Groundnut","suitability":"High",   "reason":"Kharif oilseed, grows well in sandy loam"},
        ]
    elif season in ("rabi", "winter"):
        recs += [
            {"crop":"Wheat",    "suitability":"High",   "reason":"Primary Rabi cereal crop"},
            {"crop":"Mustard",  "suitability":"High",   "reason":"Rabi oilseed, cold tolerant"},
            {"crop":"Potato",   "suitability":"High",   "reason":"Winter vegetable, high yield"},
            {"crop":"Chickpea", "suitability":"Medium", "reason":"Rabi pulse, drought tolerant"},
            {"crop":"Barley",   "suitability":"Medium", "reason":"Winter cereal, low water requirement"},
        ]
    else:  # Zaid / summer / general
        recs += [
            {"crop":"Watermelon","suitability":"High",  "reason":"Summer fruit, short duration"},
            {"crop":"Cucumber", "suitability":"High",   "reason":"Warm season vegetable"},
            {"crop":"Muskmelon","suitability":"Medium", "reason":"Summer crop, sandy soil preferred"},
            {"crop":"Fodder Crops","suitability":"Medium","reason":"Year-round, supports livestock"},
        ]

    # Soil-type adjustments
    if "black" in soil or "cotton" in soil:
        recs.append({"crop":"Cotton",    "suitability":"High","reason":"Black cotton soil is ideal"})
        recs.append({"crop":"Sorghum",   "suitability":"High","reason":"Deep black soil retention"})
    elif "red" in soil or "laterite" in soil:
        recs.append({"crop":"Groundnut", "suitability":"High","reason":"Well-drained red soil suits groundnut"})
        recs.append({"crop":"Millets",   "suitability":"High","reason":"Drought hardy, suits red laterite"})
    elif "alluvial" in soil:
        recs.append({"crop":"Sugarcane", "suitability":"High","reason":"Alluvial soil is nutrient rich"})
        recs.append({"crop":"Rice",      "suitability":"High","reason":"Water-retentive alluvial plain"})
    elif "sandy" in soil or "loam" in soil:
        recs.append({"crop":"Carrot",    "suitability":"High","reason":"Root vegetables thrive in sandy loam"})
        recs.append({"crop":"Watermelon","suitability":"High","reason":"Sandy loam drains well for melons"})

    # Rainfall adjustments
    if "high" in rainfall or "heavy" in rainfall:
        recs.append({"crop":"Jute",      "suitability":"High","reason":"High rainfall essential for jute"})
        recs.append({"crop":"Tea",       "suitability":"High","reason":"High humidity, good for tea"})
    elif "low" in rainfall or "dry" in rainfall or "arid" in rainfall:
        recs.append({"crop":"Pearl Millet","suitability":"High","reason":"Drought tolerant, low rainfall"})
        recs.append({"crop":"Bajra",     "suitability":"High","reason":"Arid conditions specialist"})

    # Deduplicate by crop name
    seen, unique = set(), []
    for r in recs:
        if r["crop"] not in seen:
            seen.add(r["crop"])
            unique.append(r)
    return unique[:8]


# ─── CROPS ────────────────────────────────────────────────────────────────────

@router.post("/crops", status_code=201)
def add_crop(
    payload: AgriCropCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    from datetime import datetime
    sowing   = None
    harvest  = None
    try:
        if payload.sowing_date:
            sowing = datetime.fromisoformat(payload.sowing_date.replace("Z",""))
        if payload.expected_harvest:
            harvest = datetime.fromisoformat(payload.expected_harvest.replace("Z",""))
    except Exception:
        pass

    crop = AgriCrop(
        farmer_id=current_user.id,
        crop_name=payload.crop_name,
        variety=payload.variety,
        area_hectares=payload.area_hectares,
        sowing_date=sowing,
        expected_harvest=harvest,
        growth_stage=payload.growth_stage or "Sowing",
        soil_type=payload.soil_type,
        irrigation_type=payload.irrigation_type,
        notes=payload.notes,
        status="active",
        created_by=current_user.id,
    )
    db.add(crop)
    db.commit()
    db.refresh(crop)
    return _crop_resp(crop)


@router.get("/crops")
def my_crops(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    crops = db.query(AgriCrop).filter(AgriCrop.farmer_id == current_user.id)\
              .order_by(AgriCrop.created_at.desc()).all()
    return [_crop_resp(c) for c in crops]


@router.put("/crops/{crop_id}")
def update_crop(
    crop_id: str,
    payload: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    crop = db.query(AgriCrop).filter(AgriCrop.id == crop_id, AgriCrop.farmer_id == current_user.id).first()
    if not crop:
        raise HTTPException(status_code=404, detail="Crop not found")
    for field in ["crop_name","variety","area_hectares","growth_stage","status","notes","soil_type","irrigation_type"]:
        if field in payload:
            setattr(crop, field, payload[field])
    db.commit(); db.refresh(crop)
    return _crop_resp(crop)


@router.delete("/crops/{crop_id}")
def delete_crop(
    crop_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    crop = db.query(AgriCrop).filter(AgriCrop.id == crop_id, AgriCrop.farmer_id == current_user.id).first()
    if not crop:
        raise HTTPException(status_code=404, detail="Crop not found")
    db.delete(crop); db.commit()
    return {"message": "Crop deleted"}


def _crop_resp(c: AgriCrop) -> dict:
    return {
        "id": c.id, "farmer_id": c.farmer_id, "crop_name": c.crop_name,
        "variety": c.variety, "area_hectares": c.area_hectares,
        "sowing_date": c.sowing_date.isoformat() if c.sowing_date else None,
        "expected_harvest": c.expected_harvest.isoformat() if c.expected_harvest else None,
        "growth_stage": c.growth_stage, "status": c.status,
        "soil_type": c.soil_type, "irrigation_type": c.irrigation_type,
        "notes": c.notes,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


# ─── MARKET ───────────────────────────────────────────────────────────────────

@router.post("/market", status_code=201)
def create_listing(
    payload: AgriMarketListingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    listing = AgriMarketListing(
        farmer_id=current_user.id,
        crop_name=payload.crop_name,
        variety=payload.variety,
        quantity_kg=payload.quantity_kg,
        price_per_kg=payload.price_per_kg,
        unit=payload.unit or "kg",
        location=payload.location,
        description=payload.description,
        is_organic=payload.is_organic or False,
        status="active",
        created_by=current_user.id,
    )
    db.add(listing); db.commit(); db.refresh(listing)
    return _listing_resp(listing, current_user)


@router.get("/market")
def browse_market(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    crop: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    q = db.query(AgriMarketListing).filter(AgriMarketListing.status == "active")
    if crop:
        q = q.filter(AgriMarketListing.crop_name.ilike(f"%{crop}%"))
    listings = q.order_by(AgriMarketListing.created_at.desc()).offset(skip).limit(limit).all()
    result = []
    for l in listings:
        farmer = db.query(User).filter(User.id == l.farmer_id).first()
        result.append(_listing_resp(l, farmer))
    return result


@router.get("/market/my")
def my_listings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    listings = db.query(AgriMarketListing).filter(AgriMarketListing.farmer_id == current_user.id)\
                 .order_by(AgriMarketListing.created_at.desc()).all()
    return [_listing_resp(l, current_user) for l in listings]


@router.delete("/market/{listing_id}")
def delete_listing(
    listing_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    l = db.query(AgriMarketListing).filter(AgriMarketListing.id == listing_id, AgriMarketListing.farmer_id == current_user.id).first()
    if not l:
        raise HTTPException(status_code=404, detail="Listing not found")
    db.delete(l); db.commit()
    return {"message": "Listing removed"}


def _listing_resp(l: AgriMarketListing, farmer) -> dict:
    fname = getattr(farmer, "full_name", None) or getattr(farmer, "username", "Unknown")
    funame = getattr(farmer, "username", "Unknown")
    return {
        "id": l.id, "farmer_id": l.farmer_id,
        "crop_name": l.crop_name, "variety": l.variety,
        "quantity_kg": l.quantity_kg, "price_per_kg": l.price_per_kg,
        "unit": l.unit, "location": l.location,
        "description": l.description, "is_organic": l.is_organic,
        "status": l.status,
        "created_at": l.created_at.isoformat() if l.created_at else None,
        "farmer_username": funame, "farmer_full_name": fname,
    }


# ─── GOVERNMENT SCHEMES ───────────────────────────────────────────────────────

@router.get("/schemes")
def get_schemes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    category: Optional[str] = Query(None),
):
    q = db.query(AgriScheme).filter(AgriScheme.is_active == True)
    if category:
        q = q.filter(AgriScheme.category == category)
    schemes = q.order_by(AgriScheme.created_at.desc()).all()

    # Seed default schemes if empty
    if not schemes:
        _seed_schemes(db)
        schemes = db.query(AgriScheme).filter(AgriScheme.is_active == True).all()

    return [
        {
            "id": s.id, "title": s.title, "description": s.description,
            "category": s.category, "eligibility": s.eligibility,
            "benefits": s.benefits, "apply_url": s.apply_url,
            "deadline": s.deadline.isoformat() if s.deadline else None,
            "is_active": s.is_active,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
        for s in schemes
    ]


def _seed_schemes(db: Session):
    default_schemes = [
        {
            "title": "PM-KISAN (Pradhan Mantri Kisan Samman Nidhi)",
            "description": "Direct income support of ₹6,000 per year to small and marginal farmer families.",
            "category": "Subsidy",
            "eligibility": "Small and marginal farmers with cultivable land up to 2 hectares.",
            "benefits": "₹2,000 every 4 months directly to farmer's bank account. Annual total: ₹6,000.",
            "apply_url": "https://pmkisan.gov.in/",
        },
        {
            "title": "Pradhan Mantri Fasal Bima Yojana (PMFBY)",
            "description": "Crop insurance scheme that provides comprehensive insurance coverage against crop loss.",
            "category": "Insurance",
            "eligibility": "All farmers growing notified crops in notified areas. Priority to loanee farmers.",
            "benefits": "Insurance coverage for crop loss due to natural calamities, pests and diseases.",
            "apply_url": "https://pmfby.gov.in/",
        },
        {
            "title": "Kisan Credit Card (KCC)",
            "description": "Short-term formal credit at concessional interest rates for farmers.",
            "category": "Loan",
            "eligibility": "Farmers, tenant farmers, sharecroppers, and self-help groups.",
            "benefits": "Credit up to ₹3 lakh at 4% interest (after subvention). Covers crop, post-harvest and maintenance needs.",
            "apply_url": "https://www.nabard.org/content.aspx?id=572",
        },
        {
            "title": "National Agriculture Market (eNAM)",
            "description": "Online trading platform for agricultural commodities across India.",
            "category": "Market",
            "eligibility": "Any farmer registered on eNAM platform with produce to sell.",
            "benefits": "Better price discovery, reduced transaction costs, pan-India market access.",
            "apply_url": "https://enam.gov.in/web/",
        },
        {
            "title": "Soil Health Card Scheme",
            "description": "Provides soil health cards to farmers with crop-wise nutrient recommendations.",
            "category": "Advisory",
            "eligibility": "All farmers. Soil samples collected and tested by government laboratories.",
            "benefits": "Free soil testing, crop-wise fertilizer recommendations, improved soil health.",
            "apply_url": "https://soilhealth.dac.gov.in/",
        },
        {
            "title": "Rashtriya Krishi Vikas Yojana (RKVY)",
            "description": "Scheme to achieve 4% annual growth in agricultural sector.",
            "category": "Subsidy",
            "eligibility": "State governments, farmers, cooperatives, FPOs.",
            "benefits": "Financial assistance for agricultural development projects, infrastructure, mechanization.",
            "apply_url": "https://rkvy.nic.in/",
        },
    ]
    for s in default_schemes:
        db.add(AgriScheme(
            title=s["title"], description=s["description"],
            category=s["category"], eligibility=s["eligibility"],
            benefits=s["benefits"], apply_url=s.get("apply_url"),
            is_active=True,
        ))
    db.commit()


# ─── EXPERT Q&A ───────────────────────────────────────────────────────────────

@router.post("/queries", status_code=201)
def post_query(
    payload: AgriQueryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    q = AgriQuery(
        farmer_id=current_user.id,
        title=payload.title,
        description=payload.description,
        category=payload.category or "Other",
        is_answered=False,
        created_by=current_user.id,
    )
    db.add(q); db.commit(); db.refresh(q)
    return _query_resp(q, current_user)


@router.get("/queries")
def browse_queries(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    category: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    q_query = db.query(AgriQuery)
    if category:
        q_query = q_query.filter(AgriQuery.category == category)
    queries = q_query.order_by(AgriQuery.created_at.desc()).offset(skip).limit(limit).all()
    result = []
    for q in queries:
        farmer = db.query(User).filter(User.id == q.farmer_id).first()
        result.append(_query_resp(q, farmer))
    return result


@router.get("/queries/my")
def my_queries(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    queries = db.query(AgriQuery).filter(AgriQuery.farmer_id == current_user.id)\
                .order_by(AgriQuery.created_at.desc()).all()
    return [_query_resp(q, current_user) for q in queries]


def _query_resp(q: AgriQuery, farmer) -> dict:
    funame = getattr(farmer, "username", "Unknown")
    return {
        "id": q.id, "farmer_id": q.farmer_id,
        "title": q.title, "description": q.description,
        "category": q.category, "is_answered": q.is_answered,
        "answer": q.answer,
        "answered_at": q.answered_at.isoformat() if q.answered_at else None,
        "created_at": q.created_at.isoformat() if q.created_at else None,
        "farmer_username": funame,
    }


# ─── MARKET PRICES ────────────────────────────────────────────────────────────

@router.get("/prices")
def get_prices(
    current_user: User = Depends(get_current_active_user),
    crop: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
):
    prices = MANDI_PRICES
    if crop:
        prices = [p for p in prices if crop.lower() in p["crop"].lower()]
    if state:
        prices = [p for p in prices if state.lower() in p["state"].lower()]
    return {
        "prices": prices,
        "source": "Indicative mandi prices — reference data",
        "note": "Prices are approximate. Verify with local mandi for exact rates.",
        "last_updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }


# ─── CROP RECOMMENDATION ──────────────────────────────────────────────────────

@router.post("/recommend")
def recommend_crops(
    payload: dict = Body(...),
    current_user: User = Depends(get_current_active_user),
):
    soil     = payload.get("soil_type", "")
    state    = payload.get("state", "")
    season   = payload.get("season", "")
    rainfall = payload.get("rainfall", "")
    recommendations = _recommend_crops(soil, state, season, rainfall)
    return {
        "recommendations": recommendations,
        "inputs": {"soil_type": soil, "state": state, "season": season, "rainfall": rainfall},
        "note": "Rule-based recommendations — consult local agricultural officer for personalized advice.",
    }
