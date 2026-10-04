"""
Google OAuth router
--------------------
POST /api/auth/google

Receives a Google ID token (credential) from the frontend,
verifies it with Google's public keys, then either:
  - logs in the existing user matched by email, or
  - creates a new citizen account from their Google profile.

Returns the same Token schema used by the standard login endpoint
so the frontend auth flow is identical.

Requires GOOGLE_CLIENT_ID to be set in .env.
GOOGLE_CLIENT_SECRET is not needed here (we only verify the ID token,
not exchange an auth code).
"""
from __future__ import annotations

import re
import secrets
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from ..config import settings
from ..database import get_db
from ..models import User, Role, Citizen, RefreshToken
from ..schemas import Token
from ..security import create_access_token, create_refresh_token

router = APIRouter(prefix="/api/auth", tags=["auth"])

# ─── Schema ───────────────────────────────────────────────────────────────────

from pydantic import BaseModel

class GoogleTokenRequest(BaseModel):
    credential: str   # The ID token string returned by Google


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _safe_username(email: str, db: Session) -> str:
    """
    Derive a unique username from the email local-part.
    Appends a short random suffix if the name is already taken.
    """
    base = re.sub(r"[^a-z0-9_]", "_", email.split("@")[0].lower())[:20]
    username = base
    for _ in range(20):          # up to 20 attempts
        if not db.query(User).filter(User.username == username).first():
            return username
        username = f"{base}_{secrets.token_hex(3)}"
    # Fallback — extremely unlikely to reach here
    return f"user_{secrets.token_hex(6)}"


def _get_or_create_citizen_role(db: Session) -> Role:
    role = db.query(Role).filter(Role.name == "citizen").first()
    if not role:
        role = Role(name="citizen", description="Standard citizen user")
        db.add(role)
        db.commit()
        db.refresh(role)
    return role


def _issue_tokens(user: User, db: Session) -> dict:
    """Create access + refresh tokens and persist the refresh token."""
    role_name = user.roles[0].name if user.roles else "citizen"

    access_token  = create_access_token(data={"sub": user.username, "role": role_name})
    refresh_token = create_refresh_token(data={"sub": user.username})

    db.add(RefreshToken(
        user_id=user.id,
        token=refresh_token,
        expires_at=datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    ))
    db.commit()

    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}


# ─── Route ────────────────────────────────────────────────────────────────────

@router.post("/google", response_model=Token)
def google_login(
    payload: GoogleTokenRequest,
    db: Session = Depends(get_db),
):
    """
    Verify a Google ID token and return a SmartCity JWT pair.
    Works for both sign-in (existing user) and sign-up (new user).
    """

    # ── Guard: Google OAuth not configured ───────────────────────────────────
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=(
                "Google sign-in is not configured. "
                "Set GOOGLE_CLIENT_ID in the backend .env file."
            ),
        )

    # ── Verify the ID token with Google ──────────────────────────────────────
    try:
        id_info = id_token.verify_oauth2_token(
            payload.credential,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
            clock_skew_in_seconds=10,   # tolerate minor clock drift
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Google token: {exc}",
        )

    google_email: str = id_info.get("email", "").lower().strip()
    google_name: str  = id_info.get("name",  "")
    email_verified: bool = id_info.get("email_verified", False)

    if not google_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google token did not include an email address.",
        )
    if not email_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google account email is not verified.",
        )

    # ── Find existing user by email ───────────────────────────────────────────
    user: Optional[User] = db.query(User).filter(User.email == google_email).first()

    if user:
        # Existing user — just check they are active
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is deactivated.",
            )
        # Mark as verified if not already (covers accounts created before Google sign-in)
        if not user.is_verified:
            user.is_verified = True
        user.last_login = datetime.utcnow()
        db.commit()
        return _issue_tokens(user, db)

    # ── New user — create a citizen account ───────────────────────────────────
    citizen_role = _get_or_create_citizen_role(db)
    username     = _safe_username(google_email, db)

    new_user = User(
        username=username,
        email=google_email,
        full_name=google_name or username,
        # Google-authenticated users have no local password.
        # Store a cryptographically random hash that can never be guessed
        # or matched, so the normal password login path is blocked.
        hashed_password=f"google_oauth::{secrets.token_hex(32)}",
        is_active=True,
        is_verified=True,   # Google already verified the email
        last_login=datetime.utcnow(),
    )
    new_user.roles.append(citizen_role)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Create citizen profile
    db.add(Citizen(user_id=new_user.id))
    db.commit()

    return _issue_tokens(new_user, db)
