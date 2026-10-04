from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, Role, UserRole, LoginHistory
from ..schemas import UserResponse, UserCreate, UserUpdate
from ..dependencies import get_current_admin_user, require_permissions
from ..security import get_password_hash, validate_password_strength

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/", response_model=List[UserResponse])
def list_users(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
    current_user: User = Depends(require_permissions(["users:read"])),
    db: Session = Depends(get_db)
):
    """List all users with filtering and pagination."""
    query = db.query(User)
    
    if search:
        query = query.filter(
            (User.username.ilike(f"%{search}%")) |
            (User.email.ilike(f"%{search}%")) |
            (User.full_name.ilike(f"%{search}%"))
        )
    
    if role:
        query = query.join(User.roles).filter(Role.name == role)
    
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    
    users = query.order_by(User.created_at.desc()).offset(skip).limit(limit).all()
    return users


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: str,
    current_user: User = Depends(require_permissions(["users:read"])),
    db: Session = Depends(get_db)
):
    """Get a specific user by ID."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.post("/", response_model=UserResponse)
def create_user(
    user_data: UserCreate,
    current_user: User = Depends(require_permissions(["users:create"])),
    db: Session = Depends(get_db)
):
    """Create a new user (admin only)."""
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
        hashed_password=hashed_password,
        is_verified=True,  # Auto-verify for admin-created users
        created_by=current_user.id
    )
    db_user.roles.append(role)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    return db_user


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: str,
    user_update: UserUpdate,
    current_user: User = Depends(require_permissions(["users:update"])),
    db: Session = Depends(get_db)
):
    """Update a user."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user_update.full_name is not None:
        user.full_name = user_update.full_name
    if user_update.phone is not None:
        user.phone = user_update.phone
    if user_update.email is not None:
        existing_user = db.query(User).filter(
            User.email == user_update.email,
            User.id != user_id
        ).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="Email already registered")
        user.email = user_update.email
    
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}")
def delete_user(
    user_id: str,
    current_user: User = Depends(require_permissions(["users:delete"])),
    db: Session = Depends(get_db)
):
    """Delete a user (soft delete by deactivating)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    user.is_active = False
    db.commit()
    
    return {"message": "User deactivated successfully"}


@router.post("/{user_id}/activate")
def activate_user(
    user_id: str,
    current_user: User = Depends(require_permissions(["users:update"])),
    db: Session = Depends(get_db)
):
    """Activate a deactivated user."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.is_active = True
    user.failed_login_attempts = 0
    user.locked_until = None
    db.commit()
    
    return {"message": "User activated successfully"}


@router.post("/{user_id}/deactivate")
def deactivate_user(
    user_id: str,
    current_user: User = Depends(require_permissions(["users:update"])),
    db: Session = Depends(get_db)
):
    """Deactivate a user."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")
    
    user.is_active = False
    db.commit()
    
    return {"message": "User deactivated successfully"}


@router.post("/{user_id}/roles/{role_name}")
def assign_role(
    user_id: str,
    role_name: str,
    current_user: User = Depends(require_permissions(["users:update"])),
    db: Session = Depends(get_db)
):
    """Assign a role to a user."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    role = db.query(Role).filter(Role.name == role_name).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    # Check if user already has this role
    if role in user.roles:
        raise HTTPException(status_code=400, detail="User already has this role")
    
    user.roles.append(role)
    db.commit()
    
    return {"message": f"Role {role_name} assigned to user successfully"}


@router.delete("/{user_id}/roles/{role_name}")
def remove_role(
    user_id: str,
    role_name: str,
    current_user: User = Depends(require_permissions(["users:update"])),
    db: Session = Depends(get_db)
):
    """Remove a role from a user."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    role = db.query(Role).filter(Role.name == role_name).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    if role not in user.roles:
        raise HTTPException(status_code=400, detail="User does not have this role")
    
    if len(user.roles) == 1:
        raise HTTPException(status_code=400, detail="User must have at least one role")
    
    user.roles.remove(role)
    db.commit()
    
    return {"message": f"Role {role_name} removed from user successfully"}


@router.get("/{user_id}/login-history")
def get_user_login_history(
    user_id: str,
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(require_permissions(["users:read"])),
    db: Session = Depends(get_db)
):
    """Get login history for a user."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    history = db.query(LoginHistory).filter(
        LoginHistory.user_id == user_id
    ).order_by(LoginHistory.login_time.desc()).offset(skip).limit(limit).all()
    
    return [
        {
            "login_time": h.login_time,
            "logout_time": h.logout_time,
            "ip_address": h.ip_address,
            "user_agent": h.user_agent,
            "status": h.status,
            "failure_reason": h.failure_reason
        }
        for h in history
    ]
