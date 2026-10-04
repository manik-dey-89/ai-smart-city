"""
Admin router — all core admin panel endpoints.
Prefix: /api/admin

All endpoints require:
  - Valid JWT authentication
  - Admin-level role (city_admin, super_admin, or admin)

Route groups:
  GET  /api/admin/stats
  GET  /api/admin/complaints
  GET  /api/admin/complaints/{id}
  PUT  /api/admin/complaints/{id}         — general update (status/priority/notes)
  POST /api/admin/complaints/{id}/approve — approve + auto-route
  POST /api/admin/complaints/{id}/reject  — reject with reason
  POST /api/admin/complaints/{id}/route   — manually override routing
  GET  /api/admin/incidents / POST / PUT
  GET  /api/admin/emergencies / PUT
  GET  /api/admin/alerts / POST / PUT
"""
from typing import List, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    User, Complaint, ComplaintImage, ComplaintHistory,
    Incident, Alert, EmergencyRequest,
)
from ..schemas import (
    ComplaintAdminResponse, ComplaintAdminUpdate, ComplaintHistoryEntry,
    IncidentCreate, IncidentUpdate, IncidentResponse,
    AlertCreate, AlertUpdate, AlertResponse,
    EmergencyRequestAdminResponse, EmergencyRequestUpdate,
    AdminDashboardStats,
)
from ..dependencies import get_current_admin_user
from ..routers.complaints import _get_route_for_type, _add_history

router = APIRouter(prefix="/api/admin", tags=["admin"])

# ─── Guard: admin only ────────────────────────────────────────────────────────
# All routes use Depends(get_current_admin_user) which checks for
# city_admin or super_admin role and returns 403 if not matched.


# ─── STATS ───────────────────────────────────────────────────────────────────

@router.get("/stats", response_model=AdminDashboardStats)
def get_admin_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Real DB stats for the admin dashboard overview."""
    total_users   = db.query(User).count()
    active_users  = db.query(User).filter(User.is_active == True).count()

    total_complaints   = db.query(Complaint).count()
    pending_complaints = db.query(Complaint).filter(
        Complaint.status.in_(["active", "submitted", "under_review"])
    ).count()

    active_alerts = db.query(Alert).filter(Alert.status == "active").count()

    # Active emergencies: unresolved emergency requests
    active_emergencies = db.query(EmergencyRequest).filter(
        EmergencyRequest.is_resolved == False
    ).count()

    total_incidents = db.query(Incident).count()

    # Recent 5 of each
    recent_complaints_raw = (
        db.query(Complaint)
        .order_by(Complaint.created_at.desc())
        .limit(5)
        .all()
    )
    recent_incidents_raw = (
        db.query(Incident)
        .order_by(Incident.created_at.desc())
        .limit(5)
        .all()
    )
    recent_alerts_raw = (
        db.query(Alert)
        .order_by(Alert.created_at.desc())
        .limit(5)
        .all()
    )

    def complaint_summary(c: Complaint) -> dict:
        reporter = db.query(User).filter(User.id == c.user_id).first() if c.user_id else None
        return {
            "id": c.id, "type": c.type, "title": c.title,
            "priority": c.priority, "status": c.status,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "reporter": reporter.username if reporter else "Unknown",
        }

    def incident_summary(i: Incident) -> dict:
        return {
            "id": i.id, "type": i.type, "title": i.title,
            "severity": i.severity, "status": i.status,
            "created_at": i.created_at.isoformat() if i.created_at else None,
        }

    def alert_summary(a: Alert) -> dict:
        return {
            "id": a.id, "type": a.type, "title": a.title,
            "severity": a.severity, "status": a.status,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }

    return AdminDashboardStats(
        total_users=total_users,
        active_users=active_users,
        total_complaints=total_complaints,
        pending_complaints=pending_complaints,
        active_alerts=active_alerts,
        active_emergencies=active_emergencies,
        total_incidents=total_incidents,
        recent_complaints=[complaint_summary(c) for c in recent_complaints_raw],
        recent_incidents=[incident_summary(i) for i in recent_incidents_raw],
        recent_alerts=[alert_summary(a) for a in recent_alerts_raw],
    )


# ─── COMPLAINTS ───────────────────────────────────────────────────────────────

VALID_STATUSES  = {"submitted","under_review","assigned","in_progress","resolved","rejected","active","approved"}
VALID_PRIORITIES = {"low","medium","high"}

# Role-label map for display
ROUTE_LABELS = {
    "police":          "Police Department",
    "traffic_officer": "Traffic Management",
    "fire_service":    "Fire Service",
    "emergency":       "Emergency Response",
    "municipal":       "Municipal / Civic Dept",
}


def _build_admin_response(c: Complaint, db: Session) -> ComplaintAdminResponse:
    reporter = db.query(User).filter(User.id == c.user_id).first() if c.user_id else None
    images = [
        {"image_url": img.image_url, "thumbnail_url": img.thumbnail_url,
         "file_name": img.file_name}
        for img in db.query(ComplaintImage).filter(ComplaintImage.complaint_id == c.id).all()
    ]
    history_entries = [
        ComplaintHistoryEntry(
            id=h.id, action=h.action,
            old_status=h.old_status, new_status=h.new_status,
            note=h.note, actor_username=h.actor_username,
            created_at=h.created_at,
        )
        for h in db.query(ComplaintHistory)
                   .filter(ComplaintHistory.complaint_id == c.id)
                   .order_by(ComplaintHistory.created_at)
                   .all()
    ]
    return ComplaintAdminResponse(
        id=c.id, type=c.type, title=c.title, description=c.description,
        priority=c.priority, status=c.status,
        location_lat=c.location_lat, location_lng=c.location_lng,
        location_address=c.location_address,
        tracking_id=c.tracking_id, routed_to=c.routed_to,
        admin_notes=c.admin_notes, evidence_note=c.evidence_note,
        user_id=c.user_id, assigned_to=c.assigned_to,
        created_at=c.created_at, updated_at=c.updated_at,
        reporter_username=reporter.username if reporter else None,
        reporter_email=reporter.email if reporter else None,
        reporter_full_name=reporter.full_name if reporter else None,
        images=images,
        history=history_entries,
    )


@router.get("/complaints", response_model=List[ComplaintAdminResponse])
def admin_list_complaints(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
    search: Optional[str] = Query(None),
    complaint_type: Optional[str] = Query(None),
    complaint_status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    routed_to: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    q = db.query(Complaint)
    if search:
        q = q.filter(
            Complaint.title.ilike(f"%{search}%") |
            Complaint.description.ilike(f"%{search}%") |
            Complaint.tracking_id.ilike(f"%{search}%")
        )
    if complaint_type:
        q = q.filter(Complaint.type.ilike(f"%{complaint_type}%"))
    if complaint_status:
        q = q.filter(Complaint.status == complaint_status)
    if priority:
        q = q.filter(Complaint.priority == priority)
    if routed_to:
        q = q.filter(Complaint.routed_to == routed_to)

    complaints = q.order_by(Complaint.created_at.desc()).offset(skip).limit(limit).all()
    return [_build_admin_response(c, db) for c in complaints]


@router.get("/complaints/{complaint_id}", response_model=ComplaintAdminResponse)
def admin_get_complaint(
    complaint_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    c = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Complaint not found")
    return _build_admin_response(c, db)


@router.put("/complaints/{complaint_id}", response_model=ComplaintAdminResponse)
def admin_update_complaint(
    complaint_id: str,
    update: ComplaintAdminUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """General admin update: status, priority, notes, assignment."""
    c = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Complaint not found")

    old_status = c.status

    if update.status is not None:
        if update.status not in VALID_STATUSES:
            raise HTTPException(status_code=400,
                                detail=f"Invalid status. Use: {', '.join(sorted(VALID_STATUSES))}")
        c.status = update.status

    if update.priority is not None:
        if update.priority not in VALID_PRIORITIES:
            raise HTTPException(status_code=400, detail="Invalid priority")
        c.priority = update.priority

    if update.assigned_to is not None:
        if update.assigned_to:
            assignee = db.query(User).filter(User.id == update.assigned_to).first()
            if not assignee:
                raise HTTPException(status_code=404, detail="Assignee user not found")
        c.assigned_to = update.assigned_to or None

    if update.admin_notes is not None:
        existing = c.admin_notes or ""
        ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M")
        c.admin_notes = f"{existing}\n[{ts}] {current_user.username}: {update.admin_notes}".strip()

    if update.routed_to is not None:
        c.routed_to = update.routed_to

    db.commit()

    if update.status and update.status != old_status:
        _add_history(db, c.id, "status_change", old_status, update.status,
                     update.admin_notes or f"Status changed by admin {current_user.username}.",
                     current_user)
        db.commit()

    db.refresh(c)
    return _build_admin_response(c, db)


@router.post("/complaints/{complaint_id}/approve", response_model=ComplaintAdminResponse)
def admin_approve_complaint(
    complaint_id: str,
    payload: dict = {},
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Approve a complaint:
    1. Set status → 'assigned'
    2. Auto-detect officer role from complaint type
    3. Set routed_to
    4. Add history entry
    """
    c = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Complaint not found")
    if c.status in {"resolved", "rejected"}:
        raise HTTPException(status_code=400,
                            detail=f"Cannot approve a '{c.status}' complaint")

    old_status = c.status
    routed_role = payload.get("routed_to") or _get_route_for_type(c.type)
    note = payload.get("note") or f"Approved by {current_user.username}. Auto-routed to {ROUTE_LABELS.get(routed_role, routed_role)}."

    c.status = "assigned"
    c.routed_to = routed_role

    admin_note_text = f"[{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')}] {current_user.username}: {note}"
    c.admin_notes = (c.admin_notes or "") + "\n" + admin_note_text
    c.admin_notes = c.admin_notes.strip()

    db.commit()
    _add_history(db, c.id, "approved", old_status, "assigned", note, current_user)
    db.commit()
    db.refresh(c)
    return _build_admin_response(c, db)


@router.post("/complaints/{complaint_id}/reject", response_model=ComplaintAdminResponse)
def admin_reject_complaint(
    complaint_id: str,
    payload: dict = {},
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Reject complaint with reason."""
    c = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Complaint not found")
    if c.status in {"resolved", "rejected"}:
        raise HTTPException(status_code=400,
                            detail=f"Complaint already '{c.status}'")

    old_status = c.status
    reason = payload.get("reason") or "Complaint does not meet verification criteria."

    c.status = "rejected"
    note_text = f"[{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')}] {current_user.username}: REJECTED — {reason}"
    c.admin_notes = ((c.admin_notes or "") + "\n" + note_text).strip()

    db.commit()
    _add_history(db, c.id, "rejected", old_status, "rejected", reason, current_user)
    db.commit()
    db.refresh(c)
    return _build_admin_response(c, db)


@router.post("/complaints/{complaint_id}/route", response_model=ComplaintAdminResponse)
def admin_route_complaint(
    complaint_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Manually override routing target."""
    c = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Complaint not found")

    new_route = payload.get("routed_to")
    if not new_route:
        raise HTTPException(status_code=400, detail="routed_to is required")

    old_route = c.routed_to
    c.routed_to = new_route
    note = (payload.get("note") or
            f"Re-routed from '{old_route}' to '{new_route}' by {current_user.username}.")
    note_text = f"[{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')}] {current_user.username}: {note}"
    c.admin_notes = ((c.admin_notes or "") + "\n" + note_text).strip()

    db.commit()
    _add_history(db, c.id, "rerouted", c.status, c.status, note, current_user)
    db.commit()
    db.refresh(c)
    return _build_admin_response(c, db)


# ─── INCIDENTS ────────────────────────────────────────────────────────────────

@router.get("/incidents", response_model=List[IncidentResponse])
def admin_list_incidents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
    incident_type: Optional[str] = Query(None),
    incident_status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    q = db.query(Incident)
    if incident_type:
        q = q.filter(Incident.type == incident_type)
    if incident_status:
        q = q.filter(Incident.status == incident_status)

    incidents = q.order_by(Incident.created_at.desc()).offset(skip).limit(limit).all()

    result = []
    for inc in incidents:
        creator = db.query(User).filter(User.id == inc.created_by).first() if inc.created_by else None
        result.append(IncidentResponse(
            id=inc.id, type=inc.type, title=inc.title, description=inc.description,
            severity=inc.severity, status=inc.status,
            location_lat=inc.location_lat, location_lng=inc.location_lng,
            created_by=inc.created_by,
            creator_username=creator.username if creator else None,
            created_at=inc.created_at, updated_at=inc.updated_at,
        ))
    return result


@router.post("/incidents", response_model=IncidentResponse, status_code=status.HTTP_201_CREATED)
def admin_create_incident(
    payload: IncidentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    inc = Incident(
        type=payload.type,
        title=payload.title,
        description=payload.description,
        severity=payload.severity or "medium",
        location_lat=payload.location_lat,
        location_lng=payload.location_lng,
        created_by=current_user.id,
        status="active",
    )
    db.add(inc)
    db.commit()
    db.refresh(inc)
    return IncidentResponse(
        id=inc.id, type=inc.type, title=inc.title, description=inc.description,
        severity=inc.severity, status=inc.status,
        location_lat=inc.location_lat, location_lng=inc.location_lng,
        created_by=inc.created_by,
        creator_username=current_user.username,
        created_at=inc.created_at, updated_at=inc.updated_at,
    )


@router.put("/incidents/{incident_id}", response_model=IncidentResponse)
def admin_update_incident(
    incident_id: str,
    update: IncidentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    valid_statuses = {"reported", "verified", "assigned", "in_progress", "resolved", "cancelled", "active"}
    valid_severities = {"low", "medium", "high", "critical"}

    inc = db.query(Incident).filter(Incident.id == incident_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")

    if update.status is not None:
        if update.status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status")
        inc.status = update.status
    if update.severity is not None:
        if update.severity not in valid_severities:
            raise HTTPException(status_code=400, detail="Invalid severity")
        inc.severity = update.severity
    if update.description is not None:
        inc.description = update.description

    db.commit()
    db.refresh(inc)
    creator = db.query(User).filter(User.id == inc.created_by).first() if inc.created_by else None
    return IncidentResponse(
        id=inc.id, type=inc.type, title=inc.title, description=inc.description,
        severity=inc.severity, status=inc.status,
        location_lat=inc.location_lat, location_lng=inc.location_lng,
        created_by=inc.created_by,
        creator_username=creator.username if creator else None,
        created_at=inc.created_at, updated_at=inc.updated_at,
    )


# ─── EMERGENCY REQUESTS ───────────────────────────────────────────────────────

@router.get("/emergencies", response_model=List[EmergencyRequestAdminResponse])
def admin_list_emergencies(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
    em_status: Optional[str] = Query(None),
    em_type: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    q = db.query(EmergencyRequest)
    if em_status:
        q = q.filter(EmergencyRequest.status == em_status)
    if em_type:
        q = q.filter(EmergencyRequest.type == em_type)

    reqs = q.order_by(EmergencyRequest.created_at.desc()).offset(skip).limit(limit).all()

    result = []
    for r in reqs:
        reporter = db.query(User).filter(User.id == r.user_id).first() if r.user_id else None
        result.append(EmergencyRequestAdminResponse(
            id=r.id, type=r.type, title=r.title, description=r.description,
            priority=r.priority, status=r.status, is_resolved=r.is_resolved,
            location_lat=r.location_lat, location_lng=r.location_lng,
            user_id=r.user_id,
            reporter_username=reporter.username if reporter else None,
            reporter_email=reporter.email if reporter else None,
            created_at=r.created_at, updated_at=r.updated_at,
        ))
    return result


@router.put("/emergencies/{emergency_id}", response_model=EmergencyRequestAdminResponse)
def admin_update_emergency(
    emergency_id: str,
    update: EmergencyRequestUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    valid_statuses = {"reported", "verified", "assigned", "in_progress", "resolved", "cancelled", "active"}

    r = db.query(EmergencyRequest).filter(EmergencyRequest.id == emergency_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Emergency request not found")

    if update.status is not None:
        if update.status not in valid_statuses:
            raise HTTPException(status_code=400, detail="Invalid status")
        r.status = update.status
    if update.priority is not None:
        r.priority = update.priority
    if update.is_resolved is not None:
        r.is_resolved = update.is_resolved
        if update.is_resolved:
            r.status = "resolved"

    db.commit()
    db.refresh(r)
    reporter = db.query(User).filter(User.id == r.user_id).first() if r.user_id else None
    return EmergencyRequestAdminResponse(
        id=r.id, type=r.type, title=r.title, description=r.description,
        priority=r.priority, status=r.status, is_resolved=r.is_resolved,
        location_lat=r.location_lat, location_lng=r.location_lng,
        user_id=r.user_id,
        reporter_username=reporter.username if reporter else None,
        reporter_email=reporter.email if reporter else None,
        created_at=r.created_at, updated_at=r.updated_at,
    )


# ─── ALERTS ───────────────────────────────────────────────────────────────────

@router.get("/alerts", response_model=List[AlertResponse])
def admin_list_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
    alert_status: Optional[str] = Query(None),
    alert_type: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
):
    q = db.query(Alert)
    if alert_status:
        q = q.filter(Alert.status == alert_status)
    if alert_type:
        q = q.filter(Alert.type == alert_type)

    alerts = q.order_by(Alert.created_at.desc()).offset(skip).limit(limit).all()
    return [AlertResponse(
        id=a.id, type=a.type, title=a.title, message=a.message,
        severity=a.severity, status=a.status,
        area_lat=a.area_lat, area_lng=a.area_lng,
        created_at=a.created_at, updated_at=a.updated_at,
        created_by=a.created_by,
    ) for a in alerts]


@router.post("/alerts", response_model=AlertResponse, status_code=status.HTTP_201_CREATED)
def admin_create_alert(
    payload: AlertCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    valid_types = {"TRAFFIC", "WEATHER", "EMERGENCY", "FLOOD", "AIR_QUALITY", "GENERAL"}
    valid_severities = {"low", "medium", "high", "critical"}

    if payload.type.upper() not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid type. Use: {', '.join(sorted(valid_types))}")
    if payload.severity and payload.severity.lower() not in valid_severities:
        raise HTTPException(status_code=400, detail="Invalid severity")

    alert = Alert(
        type=payload.type.upper(),
        title=payload.title,
        message=payload.message,
        severity=(payload.severity or "medium").lower(),
        area_lat=payload.area_lat,
        area_lng=payload.area_lng,
        status="active",
        created_by=current_user.id,
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return AlertResponse(
        id=alert.id, type=alert.type, title=alert.title, message=alert.message,
        severity=alert.severity, status=alert.status,
        area_lat=alert.area_lat, area_lng=alert.area_lng,
        created_at=alert.created_at, updated_at=alert.updated_at,
        created_by=alert.created_by,
    )


@router.put("/alerts/{alert_id}", response_model=AlertResponse)
def admin_update_alert(
    alert_id: str,
    update: AlertUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    a = db.query(Alert).filter(Alert.id == alert_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Alert not found")

    if update.title is not None:
        a.title = update.title
    if update.message is not None:
        a.message = update.message
    if update.severity is not None:
        a.severity = update.severity.lower()
    if update.status is not None:
        a.status = update.status

    db.commit()
    db.refresh(a)
    return AlertResponse(
        id=a.id, type=a.type, title=a.title, message=a.message,
        severity=a.severity, status=a.status,
        area_lat=a.area_lat, area_lng=a.area_lng,
        created_at=a.created_at, updated_at=a.updated_at,
        created_by=a.created_by,
    )


@router.post("/alerts/{alert_id}/activate", response_model=AlertResponse)
def admin_activate_alert(
    alert_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    a = db.query(Alert).filter(Alert.id == alert_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Alert not found")
    a.status = "active"
    db.commit()
    db.refresh(a)
    return AlertResponse(
        id=a.id, type=a.type, title=a.title, message=a.message,
        severity=a.severity, status=a.status,
        area_lat=a.area_lat, area_lng=a.area_lng,
        created_at=a.created_at, updated_at=a.updated_at,
        created_by=a.created_by,
    )


@router.post("/alerts/{alert_id}/deactivate", response_model=AlertResponse)
def admin_deactivate_alert(
    alert_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    a = db.query(Alert).filter(Alert.id == alert_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Alert not found")
    a.status = "inactive"
    db.commit()
    db.refresh(a)
    return AlertResponse(
        id=a.id, type=a.type, title=a.title, message=a.message,
        severity=a.severity, status=a.status,
        area_lat=a.area_lat, area_lng=a.area_lng,
        created_at=a.created_at, updated_at=a.updated_at,
        created_by=a.created_by,
    )
