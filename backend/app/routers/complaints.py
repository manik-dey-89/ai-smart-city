"""
Complaints router — Citizen + Officer endpoints.

Citizen endpoints (any authenticated active user):
  POST /api/complaints                     — create with tracking ID
  GET  /api/complaints                     — own complaints list
  GET  /api/complaints/{id}                — own complaint detail
  POST /api/complaints/{id}/images         — upload evidence image (base64)
  GET  /api/complaints/track/{tracking_id} — public case status by tracking ID

Officer endpoints (roles: police, traffic_officer, fire_service, emergency):
  GET  /api/complaints/officer/cases       — cases routed to officer's role
  PUT  /api/complaints/officer/{id}        — update status + add remarks
"""
import os
import uuid
import base64
import random
import string
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Complaint, ComplaintImage, ComplaintHistory, User
from ..schemas import (
    ComplaintCreate, ComplaintResponse, ComplaintTrackResponse,
    ComplaintHistoryEntry, OfficerComplaintUpdate,
)
from ..dependencies import get_current_active_user

router = APIRouter(prefix="/api/complaints", tags=["complaints"])

# ─── Routing map: complaint type keyword → officer role ──────────────────────
TYPE_ROUTING: dict[str, str] = {
    # Criminal / law enforcement
    "theft":             "police",
    "murder":            "police",
    "assault":           "police",
    "robbery":           "police",
    "crime":             "police",
    "criminal":          "police",
    "harassment":        "police",
    "vandalism":         "police",
    "illegal":           "police",
    # Accidents / traffic
    "accident":          "traffic_officer",
    "traffic":           "traffic_officer",
    "road damage":       "traffic_officer",
    "pothole":           "traffic_officer",
    "road":              "traffic_officer",
    "signal":            "traffic_officer",
    "illegal parking":   "traffic_officer",
    "street light":      "traffic_officer",
    # Waste / sanitation
    "garbage":           "municipal",
    "waste":             "municipal",
    "dumping":           "municipal",
    "sanitation":        "municipal",
    # Water / drainage
    "waterlogging":      "municipal",
    "flood":             "municipal",
    "drainage":          "municipal",
    "water leak":        "municipal",
    "sewage":            "municipal",
    # Emergency / fire
    "fire":              "fire_service",
    "explosion":         "fire_service",
    "gas leak":          "fire_service",
    # Medical
    "medical":           "emergency",
    "ambulance":         "emergency",
    # Noise / other
    "noise":             "municipal",
    "encroachment":      "municipal",
}


def _get_route_for_type(complaint_type: str) -> str:
    """Determine officer role from complaint type string."""
    t = complaint_type.lower().strip()
    for keyword, role in TYPE_ROUTING.items():
        if keyword in t:
            return role
    return "municipal"   # default department


def _generate_tracking_id(db: Session) -> str:
    """Generate a unique CMP-YYYY-NNNN tracking ID."""
    year = datetime.now(timezone.utc).year
    for _ in range(20):
        suffix = "".join(random.choices(string.digits, k=6))
        tid = f"CMP-{year}-{suffix}"
        existing = db.query(Complaint).filter(Complaint.tracking_id == tid).first()
        if not existing:
            return tid
    # Ultra-rare fallback
    return f"CMP-{year}-{uuid.uuid4().hex[:8].upper()}"


def _add_history(
    db: Session,
    complaint_id: str,
    action: str,
    old_status: Optional[str],
    new_status: Optional[str],
    note: Optional[str],
    actor: Optional[User],
):
    entry = ComplaintHistory(
        complaint_id=complaint_id,
        action=action,
        old_status=old_status,
        new_status=new_status,
        note=note,
        actor_id=actor.id if actor else None,
        actor_username=actor.username if actor else "system",
    )
    db.add(entry)


def _build_response(c: Complaint, db: Session) -> ComplaintResponse:
    images = [
        {"image_url": img.image_url, "thumbnail_url": img.thumbnail_url,
         "file_name": img.file_name}
        for img in c.images
    ]
    # Build history entries for officer/citizen full-page view
    from ..schemas import ComplaintHistoryEntry as CHE
    history_entries = [
        {"id": h.id, "action": h.action,
         "old_status": h.old_status, "new_status": h.new_status,
         "note": h.note, "actor_username": h.actor_username,
         "created_at": h.created_at}
        for h in sorted(c.history, key=lambda x: x.created_at)
    ] if hasattr(c, 'history') else []
    return ComplaintResponse(
        id=c.id, type=c.type, title=c.title, description=c.description,
        priority=c.priority, status=c.status,
        location_lat=c.location_lat, location_lng=c.location_lng,
        location_address=c.location_address,
        tracking_id=c.tracking_id, routed_to=c.routed_to,
        evidence_note=c.evidence_note,
        user_id=c.user_id, assigned_to=c.assigned_to,
        created_at=c.created_at, updated_at=c.updated_at,
        created_by=c.created_by, images=images,
    )


# ─── OFFICER ROLE CHECK ───────────────────────────────────────────────────────

OFFICER_ROLES = {"police", "traffic_officer", "fire_service", "emergency", "municipal",
                 "city_admin", "super_admin", "admin"}


def _get_officer_user(
    current_user: User = Depends(get_current_active_user),
) -> User:
    role = current_user.roles[0].name if current_user.roles else ""
    if role not in OFFICER_ROLES:
        raise HTTPException(status_code=403, detail="Officer access required")
    return current_user


# ─── CITIZEN: CREATE ──────────────────────────────────────────────────────────

@router.post("", response_model=ComplaintResponse, status_code=status.HTTP_201_CREATED)
def create_complaint(
    payload: ComplaintCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Create complaint with auto-generated tracking ID and routing hint."""
    tracking_id = _generate_tracking_id(db)

    complaint = Complaint(
        type=payload.type,
        title=payload.title,
        description=payload.description,
        priority=payload.priority or "medium",
        location_lat=payload.location_lat,
        location_lng=payload.location_lng,
        location_address=payload.location_address,
        evidence_note=payload.evidence_note,
        user_id=current_user.id,
        created_by=current_user.id,
        status="submitted",
        tracking_id=tracking_id,
    )
    db.add(complaint)
    db.commit()
    db.refresh(complaint)

    _add_history(db, complaint.id, "submitted", None, "submitted",
                 f"Complaint submitted by {current_user.username}.", current_user)
    db.commit()

    return _build_response(complaint, db)


# ─── CITIZEN: LIST OWN ────────────────────────────────────────────────────────

@router.get("/my", response_model=List[ComplaintResponse])
def list_my_complaints(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    """Return complaints belonging to the authenticated citizen ONLY."""
    complaints = (
        db.query(Complaint)
        .filter(Complaint.user_id == current_user.id)
        .order_by(Complaint.created_at.desc())
        .offset(skip).limit(limit).all()
    )
    return [_build_response(c, db) for c in complaints]


# keep old GET "" alias for backward compat
@router.get("", response_model=List[ComplaintResponse])
def list_my_complaints_v1(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    return list_my_complaints(db=db, current_user=current_user, skip=skip, limit=limit)


# ─── CITIZEN: TRACK BY TRACKING ID ───────────────────────────────────────────

@router.get("/track/{tracking_id}", response_model=ComplaintTrackResponse)
def track_complaint(
    tracking_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Public case status lookup by tracking ID — no PII exposed."""
    c = db.query(Complaint).filter(Complaint.tracking_id == tracking_id.upper()).first()
    if not c:
        raise HTTPException(status_code=404,
                            detail=f"No case found with tracking ID '{tracking_id.upper()}'")

    history_entries = [
        ComplaintHistoryEntry(
            id=h.id, action=h.action,
            old_status=h.old_status, new_status=h.new_status,
            note=h.note, actor_username=h.actor_username,
            created_at=h.created_at,
        )
        for h in c.history
    ]

    return ComplaintTrackResponse(
        tracking_id=c.tracking_id or "",
        title=c.title,
        type=c.type,
        priority=c.priority,
        status=c.status,
        location_address=c.location_address,
        routed_to=c.routed_to,
        created_at=c.created_at,
        updated_at=c.updated_at,
        history=history_entries,
        images_count=len(c.images),
    )


# ─── CITIZEN: GET OWN DETAIL ──────────────────────────────────────────────────

@router.get("/{complaint_id}", response_model=ComplaintResponse)
def get_complaint(
    complaint_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    c = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Complaint not found")
    if str(c.user_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Access denied")
    return _build_response(c, db)


# ─── CITIZEN: UPLOAD EVIDENCE IMAGE (base64) ─────────────────────────────────

@router.post("/{complaint_id}/images", status_code=status.HTTP_201_CREATED)
def upload_evidence(
    complaint_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Accept base64-encoded image data and store as data-URL.
    payload: { "data": "data:image/jpeg;base64,...", "file_name": "photo.jpg" }
    Max 3 images per complaint.
    """
    c = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Complaint not found")
    if str(c.user_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Access denied")

    existing = db.query(ComplaintImage).filter(
        ComplaintImage.complaint_id == complaint_id
    ).count()
    if existing >= 5:
        raise HTTPException(status_code=400, detail="Maximum 5 images per complaint")

    data_url = payload.get("data", "")
    file_name = payload.get("file_name", "evidence")
    file_type = payload.get("file_type", "image/jpeg")

    if not data_url.startswith("data:"):
        raise HTTPException(status_code=400, detail="Invalid image data")

    img = ComplaintImage(
        complaint_id=complaint_id,
        image_url=data_url,
        file_name=file_name,
        file_type=file_type,
        created_by=current_user.id,
    )
    db.add(img)
    db.commit()
    return {"message": "Image uploaded", "file_name": file_name}


# ─── OFFICER: LIST ROUTED CASES ──────────────────────────────────────────────

@router.get("/officer/cases", response_model=List[ComplaintResponse])
def officer_list_cases(
    db: Session = Depends(get_db),
    current_user: User = Depends(_get_officer_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    """Cases routed to the officer's role."""
    role = current_user.roles[0].name if current_user.roles else ""

    # Admins see everything; officers see only their routed cases
    if role in {"city_admin", "super_admin", "admin"}:
        q = db.query(Complaint).filter(
            Complaint.status.in_(["assigned", "in_progress", "resolved"])
        )
    else:
        q = db.query(Complaint).filter(
            Complaint.routed_to == role,
            Complaint.status.in_(["assigned", "in_progress", "resolved"])
        )

    cases = q.order_by(Complaint.created_at.desc()).offset(skip).limit(limit).all()
    return [_build_response(c, db) for c in cases]


# ─── OFFICER: GET SINGLE CASE ─────────────────────────────────────────────────

@router.get("/officer/case/{complaint_id}", response_model=ComplaintResponse)
def officer_get_case(
    complaint_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(_get_officer_user),
):
    """
    Officers fetch a single case by ID.
    - Admins can access any case.
    - Officers can access any case routed to their role OR any case
      regardless of status (so they can view full details from the /case/:id page).
    """
    c = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Case not found")

    role = current_user.roles[0].name if current_user.roles else ""

    # Admins see everything
    if role not in {"city_admin", "super_admin", "admin"}:
        # Officers can only see cases routed to their department
        if c.routed_to != role:
            raise HTTPException(
                status_code=403,
                detail="This case is not routed to your department"
            )

    return _build_response(c, db)


# ─── OFFICER: UPDATE STATUS / REMARKS ────────────────────────────────────────

@router.put("/officer/{complaint_id}", response_model=ComplaintResponse)
def officer_update_case(
    complaint_id: str,
    update: OfficerComplaintUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_get_officer_user),
):
    """Officer updates case status and adds remarks."""
    c = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Case not found")

    role = current_user.roles[0].name if current_user.roles else ""
    if role not in {"city_admin", "super_admin", "admin"} and c.routed_to != role:
        raise HTTPException(status_code=403, detail="This case is not routed to your department")

    valid_officer_statuses = {"in_progress", "resolved", "assigned"}
    old_status = c.status

    if update.status is not None:
        if update.status not in valid_officer_statuses:
            raise HTTPException(status_code=400,
                                detail=f"Officers can only set: {', '.join(sorted(valid_officer_statuses))}")
        c.status = update.status

    if update.remarks:
        existing = c.admin_notes or ""
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M")
        c.admin_notes = f"{existing}\n[{timestamp}] {current_user.username}: {update.remarks}".strip()

    db.commit()

    if update.status and update.status != old_status:
        _add_history(
            db, c.id, "status_change", old_status, update.status,
            f"Officer {current_user.username}: {update.remarks or 'Status updated.'}",
            current_user,
        )
        db.commit()

    db.refresh(c)
    return _build_response(c, db)
