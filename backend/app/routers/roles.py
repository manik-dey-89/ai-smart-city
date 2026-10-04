from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Role, Permission, RolePermission, UserRole
from ..schemas import RoleCreate, RoleResponse, PermissionCreate, PermissionResponse
from ..dependencies import require_permissions, get_current_super_admin, get_current_admin_user
from ..security import get_password_hash, validate_password_strength
from ..models import User

router = APIRouter(prefix="/api/roles", tags=["roles"])


@router.get("/", response_model=List[RoleResponse])
def list_roles(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """List all roles."""
    roles = db.query(Role).all()
    return roles


@router.get("/{role_id}", response_model=RoleResponse)
def get_role(
    role_id: str,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get a specific role by ID."""
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    return role


@router.post("/", response_model=RoleResponse)
def create_role(
    role_data: RoleCreate,
    current_user: User = Depends(require_permissions(["roles:create"])),
    db: Session = Depends(get_db)
):
    """Create a new role."""
    existing_role = db.query(Role).filter(Role.name == role_data.name).first()
    if existing_role:
        raise HTTPException(status_code=400, detail="Role already exists")
    
    role = Role(
        name=role_data.name,
        description=role_data.description,
        created_by=current_user.id
    )
    db.add(role)
    db.commit()
    db.refresh(role)
    
    return role


@router.put("/{role_id}", response_model=RoleResponse)
def update_role(
    role_id: str,
    role_data: RoleCreate,
    current_user: User = Depends(require_permissions(["roles:update"])),
    db: Session = Depends(get_db)
):
    """Update a role."""
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    if role_data.name != role.name:
        existing_role = db.query(Role).filter(Role.name == role_data.name).first()
        if existing_role:
            raise HTTPException(status_code=400, detail="Role name already exists")
    
    role.name = role_data.name
    role.description = role_data.description
    
    db.commit()
    db.refresh(role)
    
    return role


@router.delete("/{role_id}")
def delete_role(
    role_id: str,
    current_user: User = Depends(get_current_super_admin),
    db: Session = Depends(get_db)
):
    """Delete a role (super admin only)."""
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    # Check if role is assigned to any users
    users_with_role = db.query(UserRole).filter(UserRole.role_id == role_id).count()
    if users_with_role > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete role assigned to {users_with_role} users"
        )
    
    db.delete(role)
    db.commit()
    
    return {"message": "Role deleted successfully"}


@router.post("/{role_id}/permissions/{permission_id}")
def assign_permission_to_role(
    role_id: str,
    permission_id: str,
    current_user: User = Depends(require_permissions(["roles:update"])),
    db: Session = Depends(get_db)
):
    """Assign a permission to a role."""
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    permission = db.query(Permission).filter(Permission.id == permission_id).first()
    if not permission:
        raise HTTPException(status_code=404, detail="Permission not found")
    
    # Check if permission already assigned
    existing = db.query(RolePermission).filter(
        RolePermission.role_id == role_id,
        RolePermission.permission_id == permission_id
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Permission already assigned to role")
    
    role_permission = RolePermission(role_id=role_id, permission_id=permission_id)
    db.add(role_permission)
    db.commit()
    
    return {"message": "Permission assigned to role successfully"}


@router.delete("/{role_id}/permissions/{permission_id}")
def remove_permission_from_role(
    role_id: str,
    permission_id: str,
    current_user: User = Depends(require_permissions(["roles:update"])),
    db: Session = Depends(get_db)
):
    """Remove a permission from a role."""
    role_permission = db.query(RolePermission).filter(
        RolePermission.role_id == role_id,
        RolePermission.permission_id == permission_id
    ).first()
    
    if not role_permission:
        raise HTTPException(status_code=404, detail="Permission not assigned to role")
    
    db.delete(role_permission)
    db.commit()
    
    return {"message": "Permission removed from role successfully"}


router_permissions = APIRouter(prefix="/api/permissions", tags=["permissions"])


@router_permissions.get("/", response_model=List[PermissionResponse])
def list_permissions(
    resource: str = None,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """List all permissions — accessible to any admin role."""
    query = db.query(Permission)
    if resource:
        query = query.filter(Permission.resource == resource)
    permissions = query.all()
    return permissions


@router_permissions.get("/{permission_id}", response_model=PermissionResponse)
def get_permission(
    permission_id: str,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get a specific permission by ID."""
    permission = db.query(Permission).filter(Permission.id == permission_id).first()
    if not permission:
        raise HTTPException(status_code=404, detail="Permission not found")
    return permission


@router_permissions.post("/", response_model=PermissionResponse)
def create_permission(
    permission_data: PermissionCreate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Create a new permission."""
    existing_permission = db.query(Permission).filter(
        Permission.name == permission_data.name
    ).first()
    if existing_permission:
        raise HTTPException(status_code=400, detail="Permission already exists")
    
    permission = Permission(
        name=permission_data.name,
        resource=permission_data.resource,
        action=permission_data.action,
        description=permission_data.description,
        created_by=current_user.id
    )
    db.add(permission)
    db.commit()
    db.refresh(permission)
    
    return permission


@router_permissions.delete("/{permission_id}")
def delete_permission(
    permission_id: str,
    current_user: User = Depends(get_current_super_admin),
    db: Session = Depends(get_db)
):
    """Delete a permission (super admin only)."""
    permission = db.query(Permission).filter(Permission.id == permission_id).first()
    if not permission:
        raise HTTPException(status_code=404, detail="Permission not found")
    
    # Check if permission is assigned to any roles
    roles_with_permission = db.query(RolePermission).filter(
        RolePermission.permission_id == permission_id
    ).count()
    
    if roles_with_permission > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete permission assigned to {roles_with_permission} roles"
        )
    
    db.delete(permission)
    db.commit()
    
    return {"message": "Permission deleted successfully"}
