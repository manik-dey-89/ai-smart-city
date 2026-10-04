"""
Contact router — public endpoint for landing page contact form.
POST /api/contact  — anyone can submit (no auth required)
GET  /api/contact  — admin only, list all messages
PUT  /api/contact/{id}/read — admin only, mark as read
"""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ContactMessage
from ..schemas import ContactMessageCreate, ContactMessageResponse
from ..dependencies import get_current_admin_user

router = APIRouter(prefix="/api/contact", tags=["contact"])


@router.post("", response_model=ContactMessageResponse, status_code=201)
def submit_contact(
    payload: ContactMessageCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    """Public endpoint — no authentication required."""
    ip = request.client.host if request.client else None

    # Simple rate-limit: max 3 messages per email per day
    from sqlalchemy import func as sqlfunc
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    count = db.query(ContactMessage).filter(
        ContactMessage.email == payload.email,
        ContactMessage.created_at >= today_start,
    ).count()
    if count >= 5:
        raise HTTPException(
            status_code=429,
            detail="Too many messages from this email today. Please try again tomorrow.",
        )

    msg = ContactMessage(
        name=payload.name.strip(),
        email=payload.email.lower().strip(),
        subject=payload.subject.strip(),
        message=payload.message.strip(),
        status="unread",
        ip_address=ip,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


@router.get("", response_model=List[ContactMessageResponse])
def list_messages(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_admin_user),
    status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    """Admin-only: list all contact messages."""
    q = db.query(ContactMessage)
    if status:
        q = q.filter(ContactMessage.status == status)
    return q.order_by(ContactMessage.created_at.desc()).offset(skip).limit(limit).all()


@router.put("/{message_id}/read", response_model=ContactMessageResponse)
def mark_read(
    message_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_admin_user),
):
    """Admin-only: mark message as read."""
    msg = db.query(ContactMessage).filter(ContactMessage.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    msg.status = "read"
    msg.read_at = datetime.utcnow()
    db.commit()
    db.refresh(msg)
    return msg
