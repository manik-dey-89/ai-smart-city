"""
Seed roles and permissions only (no test users created here).
Passwords for any users created externally must be set via the API or seed.py.
"""
from sqlalchemy.orm import Session
from sqlalchemy import inspect
from app.database import SessionLocal, engine, Base
from app.models import Role, Permission, RolePermission, UserRole, User
from app.security import get_password_hash


def seed_roles_and_permissions():
    auth_tables = [
        Role.__table__, Permission.__table__, RolePermission.__table__,
        UserRole.__table__, User.__table__,
    ]
    inspector = inspect(engine)
    for table in auth_tables:
        if not inspector.has_table(table.name):
            table.create(engine)

    db = SessionLocal()
    try:
        permissions_data = [
            {"name": "users:read",         "resource": "users",        "action": "read"},
            {"name": "users:create",        "resource": "users",        "action": "create"},
            {"name": "users:update",        "resource": "users",        "action": "update"},
            {"name": "users:delete",        "resource": "users",        "action": "delete"},
            {"name": "roles:read",          "resource": "roles",        "action": "read"},
            {"name": "roles:create",        "resource": "roles",        "action": "create"},
            {"name": "roles:update",        "resource": "roles",        "action": "update"},
            {"name": "roles:delete",        "resource": "roles",        "action": "delete"},
            {"name": "permissions:read",    "resource": "permissions",  "action": "read"},
            {"name": "permissions:create",  "resource": "permissions",  "action": "create"},
            {"name": "permissions:delete",  "resource": "permissions",  "action": "delete"},
            {"name": "complaints:read",     "resource": "complaints",   "action": "read"},
            {"name": "complaints:create",   "resource": "complaints",   "action": "create"},
            {"name": "complaints:update",   "resource": "complaints",   "action": "update"},
            {"name": "complaints:delete",   "resource": "complaints",   "action": "delete"},
            {"name": "traffic:read",        "resource": "traffic",      "action": "read"},
            {"name": "traffic:update",      "resource": "traffic",      "action": "update"},
            {"name": "sensors:read",        "resource": "sensors",      "action": "read"},
            {"name": "sensors:create",      "resource": "sensors",      "action": "create"},
            {"name": "sensors:update",      "resource": "sensors",      "action": "update"},
            {"name": "sensors:delete",      "resource": "sensors",      "action": "delete"},
            {"name": "emergency:read",      "resource": "emergency",    "action": "read"},
            {"name": "emergency:update",    "resource": "emergency",    "action": "update"},
            {"name": "emergency:create",    "resource": "emergency",    "action": "create"},
            {"name": "analytics:read",      "resource": "analytics",    "action": "read"},
            {"name": "reports:read",        "resource": "reports",      "action": "read"},
            {"name": "reports:create",      "resource": "reports",      "action": "create"},
            {"name": "ai:read",             "resource": "ai",           "action": "read"},
            {"name": "ai:update",           "resource": "ai",           "action": "update"},
            {"name": "settings:read",       "resource": "settings",     "action": "read"},
            {"name": "settings:update",     "resource": "settings",     "action": "update"},
        ]

        permissions = {}
        for pd in permissions_data:
            existing = db.query(Permission).filter(Permission.name == pd["name"]).first()
            if not existing:
                p = Permission(
                    name=pd["name"], resource=pd["resource"], action=pd["action"],
                    description=f"{pd['action'].title()} {pd['resource']}",
                )
                db.add(p)
                db.commit()
                db.refresh(p)
                permissions[pd["name"]] = p
                print(f"  Created permission: {pd['name']}")
            else:
                permissions[pd["name"]] = existing

        roles_data = [
            {
                "name": "super_admin",
                "description": "Super administrator with full system access",
                "permissions": list(permissions.keys()),
            },
            {
                "name": "city_admin",
                "description": "City administrator with broad access",
                "permissions": [
                    "users:read", "users:create", "users:update",
                    "roles:read", "permissions:read",
                    "complaints:read", "complaints:update",
                    "traffic:read", "traffic:update",
                    "sensors:read", "sensors:update",
                    "emergency:read", "emergency:update",
                    "analytics:read", "reports:read", "reports:create",
                    "ai:read", "settings:read", "settings:update",
                ],
            },
            {
                "name": "traffic_officer",
                "description": "Traffic management officer",
                "permissions": [
                    "traffic:read", "traffic:update",
                    "complaints:read", "complaints:update",
                    "sensors:read", "emergency:read", "emergency:create",
                    "analytics:read",
                ],
            },
            {
                "name": "police_officer",
                "description": "Police officer",
                "permissions": [
                    "emergency:read", "emergency:update", "emergency:create",
                    "complaints:read", "complaints:update",
                    "traffic:read", "sensors:read", "analytics:read",
                ],
            },
            {
                "name": "fire_service",
                "description": "Fire service personnel",
                "permissions": [
                    "emergency:read", "emergency:update", "emergency:create",
                    "complaints:read", "sensors:read", "analytics:read",
                ],
            },
            {
                "name": "ambulance_team",
                "description": "Ambulance/medical team",
                "permissions": [
                    "emergency:read", "emergency:update", "emergency:create",
                    "complaints:read", "sensors:read", "analytics:read",
                ],
            },
            {
                "name": "maintenance_team",
                "description": "Maintenance and infrastructure team",
                "permissions": [
                    "sensors:read", "sensors:update",
                    "complaints:read", "complaints:update",
                    "traffic:read", "analytics:read",
                ],
            },
            {
                "name": "emergency_coordinator",
                "description": "Emergency response coordinator",
                "permissions": [
                    "emergency:read", "emergency:update", "emergency:create",
                    "traffic:read", "traffic:update",
                    "sensors:read", "complaints:read", "complaints:update",
                    "analytics:read", "reports:read",
                ],
            },
            {
                "name": "citizen",
                "description": "Regular citizen with basic access",
                "permissions": ["complaints:create", "emergency:create", "traffic:read", "analytics:read"],
            },
        ]

        for rd in roles_data:
            existing_role = db.query(Role).filter(Role.name == rd["name"]).first()
            if not existing_role:
                role = Role(name=rd["name"], description=rd["description"])
                db.add(role)
                db.commit()
                db.refresh(role)
                for pname in rd["permissions"]:
                    if pname in permissions:
                        db.add(RolePermission(role_id=role.id, permission_id=permissions[pname].id))
                db.commit()
                print(f"  Created role: {rd['name']}")
            else:
                print(f"  Role already exists: {rd['name']}")

        print("Roles and permissions seeded successfully.")

    except Exception as e:
        print(f"Error seeding roles: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    print("Seeding roles and permissions...")
    seed_roles_and_permissions()
