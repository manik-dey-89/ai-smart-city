from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import List, Optional

from .database import get_db
from .security import decode_token
from .models import User, Permission

security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_token(credentials.credentials)
    if payload is None:
        raise credentials_exception
    username: str = payload.get("sub")
    if username is None:
        raise credentials_exception
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception
    return user


def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


def get_current_verified_user(current_user: User = Depends(get_current_active_user)) -> User:
    if not current_user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified"
        )
    return current_user


def require_roles(allowed_roles: List[str]):
    """Dependency factory to require specific roles."""
    def role_checker(current_user: User = Depends(get_current_active_user)) -> User:
        user_roles = [role.name for role in current_user.roles]
        if not any(role in allowed_roles for role in user_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {', '.join(allowed_roles)}"
            )
        return current_user
    return role_checker


def require_permissions(required_permissions: List[str]):
    """Dependency factory to require specific permissions."""
    def permission_checker(current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)) -> User:
        # Get all permissions for user's roles
        user_permissions = set()
        for role in current_user.roles:
            for permission in role.permissions:
                user_permissions.add(f"{permission.resource}:{permission.action}")
        
        # Check if user has all required permissions
        for required_perm in required_permissions:
            if required_perm not in user_permissions:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Access denied. Required permission: {required_perm}"
                )
        
        return current_user
    return permission_checker


def get_current_admin_user(current_user: User = Depends(get_current_active_user)) -> User:
    """Check if user has admin role."""
    if not any(role.name in ["super_admin", "city_admin", "admin"] for role in current_user.roles):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )
    return current_user


def get_current_super_admin(current_user: User = Depends(get_current_active_user)) -> User:
    """Check if user has super admin role."""
    if not any(role.name == "super_admin" for role in current_user.roles):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super admin access required",
        )
    return current_user
