from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import Optional

from ..database import get_db
from ..models import (
    User, Role, Citizen, Admin, EmergencyTeam, RefreshToken,
    LoginHistory, PasswordReset, EmailVerification
)
from ..schemas import (
    UserCreate, UserLogin, UserResponse, Token, TokenRefresh,
    PasswordChange, PasswordResetRequest, PasswordResetConfirm,
    EmailVerificationRequest, EmailVerificationConfirm, UserUpdate
)
from ..security import (
    verify_password, get_password_hash, create_access_token,
    create_refresh_token, decode_token, validate_password_strength,
    generate_reset_token, generate_verification_token
)
from ..config import settings
from ..dependencies import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


def log_login_attempt(
    db: Session,
    user: User,
    ip_address: str,
    user_agent: str,
    status: str,
    failure_reason: Optional[str] = None
):
    """Log login attempt to history."""
    login_history = LoginHistory(
        user_id=user.id,
        ip_address=ip_address,
        user_agent=user_agent,
        status=status,
        failure_reason=failure_reason
    )
    db.add(login_history)
    db.commit()


def check_account_lock(user: User) -> None:
    """Check if account is locked and raise exception if so."""
    if user.locked_until and user.locked_until > datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=f"Account is locked. Try again after {user.locked_until}"
        )


@router.post("/register", response_model=UserResponse)
def register(
    user_data: UserCreate,
    request: Request,
    db: Session = Depends(get_db)
):
    # Validate password strength
    is_valid, message = validate_password_strength(user_data.password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
    
    # Check if user exists
    db_user = db.query(User).filter(User.username == user_data.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    db_user = db.query(User).filter(User.email == user_data.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Get or create role
    role_name = user_data.role_name or "citizen"
    role = db.query(Role).filter(Role.name == role_name).first()
    if not role:
        role = Role(name=role_name, description=f"Default {role_name} role")
        db.add(role)
        db.commit()
        db.refresh(role)
    
    # Create user
    hashed_password = get_password_hash(user_data.password)
    db_user = User(
        username=user_data.username,
        email=user_data.email,
        full_name=user_data.full_name,
        phone=user_data.phone,
        hashed_password=hashed_password
    )
    db_user.roles.append(role)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    # Create profile based on role
    if role_name == "citizen":
        profile = Citizen(user_id=db_user.id)
    elif role_name == "admin":
        profile = Admin(user_id=db_user.id)
    elif role_name == "emergency":
        profile = EmergencyTeam(user_id=db_user.id, team_type="emergency")
    else:
        profile = Citizen(user_id=db_user.id)
    
    db.add(profile)
    db.commit()
    
    # Create email verification token (mock implementation)
    verification_token = generate_verification_token()
    email_verification = EmailVerification(
        user_id=db_user.id,
        token=verification_token,
        expires_at=datetime.utcnow() + timedelta(hours=24)
    )
    db.add(email_verification)
    db.commit()
    
    # In production, send email with verification link
    # For now, we'll auto-verify for testing
    db_user.is_verified = True
    db.commit()
    
    return db_user


@router.post("/login", response_model=Token)
def login(
    user_credentials: UserLogin,
    request: Request,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.username == user_credentials.username).first()
    
    ip_address = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")
    
    if not user:
        # Log failed attempt for non-existent user
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Check if account is locked
    check_account_lock(user)
    
    # Check if user is active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated"
        )
    
    # Verify password
    if not verify_password(user_credentials.password, user.hashed_password):
        # Increment failed attempts
        user.failed_login_attempts += 1
        
        # Lock account if max attempts reached
        if user.failed_login_attempts >= settings.MAX_LOGIN_ATTEMPTS:
            user.locked_until = datetime.utcnow() + timedelta(minutes=settings.ACCOUNT_LOCK_MINUTES)
            db.commit()
            log_login_attempt(db, user, ip_address, user_agent, "failed", "Account locked due to too many failed attempts")
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail=f"Account locked for {settings.ACCOUNT_LOCK_MINUTES} minutes due to too many failed attempts"
            )
        
        db.commit()
        log_login_attempt(db, user, ip_address, user_agent, "failed", "Incorrect password")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Reset failed attempts on successful login
    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login = datetime.utcnow()
    db.commit()
    
    # Log successful login
    log_login_attempt(db, user, ip_address, user_agent, "success")
    
    # Create tokens
    role_name = user.roles[0].name if user.roles else "citizen"
    access_token = create_access_token(
        data={"sub": user.username, "role": role_name}
    )
    refresh_token_str = create_refresh_token(
        data={"sub": user.username}
    )
    
    # Store refresh token in database
    refresh_token = RefreshToken(
        user_id=user.id,
        token=refresh_token_str,
        expires_at=datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    )
    db.add(refresh_token)
    db.commit()
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token_str,
        "token_type": "bearer"
    }


@router.post("/refresh", response_model=Token)
def refresh_token(
    token_data: TokenRefresh,
    db: Session = Depends(get_db)
):
    payload = decode_token(token_data.refresh_token)
    
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    username = payload.get("sub")
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    # Check if refresh token exists and is not revoked
    refresh_token = db.query(RefreshToken).filter(
        RefreshToken.token == token_data.refresh_token,
        RefreshToken.is_revoked == False
    ).first()
    
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or revoked refresh token"
        )
    
    if refresh_token.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token expired"
        )
    
    user = db.query(User).filter(User.username == username).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )
    
    # Create new tokens
    role_name = user.roles[0].name if user.roles else "citizen"
    access_token = create_access_token(
        data={"sub": user.username, "role": role_name}
    )
    new_refresh_token_str = create_refresh_token(
        data={"sub": user.username}
    )
    
    # Revoke old refresh token and create new one (token rotation)
    refresh_token.is_revoked = True
    refresh_token.revoked_at = datetime.utcnow()
    
    new_refresh_token = RefreshToken(
        user_id=user.id,
        token=new_refresh_token_str,
        expires_at=datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    )
    db.add(new_refresh_token)
    db.commit()
    
    return {
        "access_token": access_token,
        "refresh_token": new_refresh_token_str,
        "token_type": "bearer"
    }


@router.post("/logout")
def logout(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Revoke all refresh tokens for this user
    db.query(RefreshToken).filter(
        RefreshToken.user_id == current_user.id,
        RefreshToken.is_revoked == False
    ).update({
        "is_revoked": True,
        "revoked_at": datetime.utcnow()
    })
    
    # Log logout in login history
    ip_address = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")
    
    # Update the most recent successful login to include logout time
    recent_login = db.query(LoginHistory).filter(
        LoginHistory.user_id == current_user.id,
        LoginHistory.status == "success"
    ).order_by(LoginHistory.login_time.desc()).first()
    
    if recent_login and not recent_login.logout_time:
        recent_login.logout_time = datetime.utcnow()
    
    db.commit()
    
    return {"message": "Successfully logged out"}


@router.get("/me", response_model=UserResponse)
def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    return current_user


@router.put("/me", response_model=UserResponse)
def update_profile(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if user_update.full_name is not None:
        current_user.full_name = user_update.full_name
    if user_update.phone is not None:
        current_user.phone = user_update.phone
    if user_update.email is not None:
        # Check if email is already taken by another user
        existing_user = db.query(User).filter(
            User.email == user_update.email,
            User.id != current_user.id
        ).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="Email already registered")
        current_user.email = user_update.email
        current_user.is_verified = False  # Require re-verification on email change
    
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/change-password")
def change_password(
    password_data: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Verify old password
    if not verify_password(password_data.old_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect old password"
        )
    
    # Validate new password strength
    is_valid, message = validate_password_strength(password_data.new_password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
    
    # Update password
    current_user.hashed_password = get_password_hash(password_data.new_password)
    current_user.password_changed_at = datetime.utcnow()
    
    # Revoke all refresh tokens (force re-login)
    db.query(RefreshToken).filter(
        RefreshToken.user_id == current_user.id,
        RefreshToken.is_revoked == False
    ).update({
        "is_revoked": True,
        "revoked_at": datetime.utcnow()
    })
    
    db.commit()
    
    return {"message": "Password changed successfully"}


@router.post("/forgot-password")
def forgot_password(
    request_data: PasswordResetRequest,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.email == request_data.email).first()
    
    # Always return success to prevent email enumeration
    if not user:
        return {"message": "If the email exists, a reset link has been sent"}
    
    # Check for existing valid reset token
    existing_reset = db.query(PasswordReset).filter(
        PasswordReset.user_id == user.id,
        PasswordReset.is_used == False,
        PasswordReset.expires_at > datetime.utcnow()
    ).first()
    
    if existing_reset:
        return {"message": "If the email exists, a reset link has been sent"}
    
    # Create new reset token
    reset_token = generate_reset_token()
    password_reset = PasswordReset(
        user_id=user.id,
        token=reset_token,
        expires_at=datetime.utcnow() + timedelta(hours=1)
    )
    db.add(password_reset)
    db.commit()
    
    # In production, send email with reset link
    # For now, return the token for testing
    return {
        "message": "If the email exists, a reset link has been sent",
        "token": reset_token  # Remove this in production
    }


@router.post("/reset-password")
def reset_password(
    reset_data: PasswordResetConfirm,
    db: Session = Depends(get_db)
):
    # Validate new password strength
    is_valid, message = validate_password_strength(reset_data.new_password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
    
    # Find valid reset token
    password_reset = db.query(PasswordReset).filter(
        PasswordReset.token == reset_data.token,
        PasswordReset.is_used == False,
        PasswordReset.expires_at > datetime.utcnow()
    ).first()
    
    if not password_reset:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )
    
    # Update user password
    user = db.query(User).filter(User.id == password_reset.user_id).first()
    if not user:
        raise HTTPException(status_code=400, detail="User not found")
    
    user.hashed_password = get_password_hash(reset_data.new_password)
    user.password_changed_at = datetime.utcnow()
    user.failed_login_attempts = 0
    user.locked_until = None
    
    # Mark reset token as used
    password_reset.is_used = True
    password_reset.used_at = datetime.utcnow()
    
    # Revoke all refresh tokens
    db.query(RefreshToken).filter(
        RefreshToken.user_id == user.id,
        RefreshToken.is_revoked == False
    ).update({
        "is_revoked": True,
        "revoked_at": datetime.utcnow()
    })
    
    db.commit()
    
    return {"message": "Password reset successfully"}


@router.post("/verify-email/request")
def request_email_verification(
    request_data: EmailVerificationRequest,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.email == request_data.email).first()
    
    if not user:
        return {"message": "If the email exists, a verification link has been sent"}
    
    if user.is_verified:
        return {"message": "Email is already verified"}
    
    # Check for existing valid verification token
    existing_verification = db.query(EmailVerification).filter(
        EmailVerification.user_id == user.id,
        EmailVerification.is_verified == False,
        EmailVerification.expires_at > datetime.utcnow()
    ).first()
    
    if existing_verification:
        return {"message": "If the email exists, a verification link has been sent"}
    
    # Create new verification token
    verification_token = generate_verification_token()
    email_verification = EmailVerification(
        user_id=user.id,
        token=verification_token,
        expires_at=datetime.utcnow() + timedelta(hours=24)
    )
    db.add(email_verification)
    db.commit()
    
    # In production, send email with verification link
    return {
        "message": "If the email exists, a verification link has been sent",
        "token": verification_token  # Remove this in production
    }


@router.post("/verify-email/confirm")
def confirm_email_verification(
    confirm_data: EmailVerificationConfirm,
    db: Session = Depends(get_db)
):
    # Find valid verification token
    email_verification = db.query(EmailVerification).filter(
        EmailVerification.token == confirm_data.token,
        EmailVerification.is_verified == False,
        EmailVerification.expires_at > datetime.utcnow()
    ).first()
    
    if not email_verification:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token"
        )
    
    # Mark user as verified
    user = db.query(User).filter(User.id == email_verification.user_id).first()
    if not user:
        raise HTTPException(status_code=400, detail="User not found")
    
    user.is_verified = True
    email_verification.is_verified = True
    email_verification.verified_at = datetime.utcnow()
    
    db.commit()
    
    return {"message": "Email verified successfully"}
