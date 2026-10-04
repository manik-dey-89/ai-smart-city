#!/usr/bin/env python3
"""
Database seed script — creates default roles, permissions, and demo users.

Default credentials (change after first login):
  admin    / Admin@1234       role: city_admin
  citizen  / Citizen@1234     role: citizen
  police   / Police@1234      role: police
  fire     / Fire@1234        role: fire_service
  traffic  / Traffic@1234     role: traffic_officer
  emergency/ Emergency@1234   role: emergency

Run:
    python seed.py
"""
import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal, engine
from app.models import (
    Base, User, Role, Permission, RolePermission, UserRole,
    Citizen, Admin, EmergencyTeam,
)
from app.security import get_password_hash

# ── Default credentials ────────────────────────────────────────────────────────
# All passwords meet the policy: 8+ chars, upper, lower, digit, special.
SEED_USERS = [
    {
        "username":  "admin",
        "email":     "admin@smartcity.gov",
        "full_name": "System Administrator",
        "password":  "Admin@1234",
        "role":      "city_admin",
        "profile":   "admin",
    },
    {
        "username":  "citizen",
        "email":     "citizen@smartcity.gov",
        "full_name": "Demo Citizen",
        "password":  "Citizen@1234",
        "role":      "citizen",
        "profile":   "citizen",
    },
    {
        "username":  "police",
        "email":     "police@smartcity.gov",
        "full_name": "Police Officer",
        "password":  "Police@1234",
        "role":      "police",
        "profile":   None,
    },
    {
        "username":  "fire",
        "email":     "fire@smartcity.gov",
        "full_name": "Firefighter",
        "password":  "Fire@1234",
        "role":      "fire_service",
        "profile":   None,
    },
    {
        "username":  "traffic",
        "email":     "traffic@smartcity.gov",
        "full_name": "Traffic Officer",
        "password":  "Traffic@1234",
        "role":      "traffic_officer",
        "profile":   None,
    },
    {
        "username":  "emergency",
        "email":     "emergency@smartcity.gov",
        "full_name": "Emergency Responder",
        "password":  "Emergency@1234",
        "role":      "emergency",
        "profile":   "emergency",
    },
]

# ── Permissions ────────────────────────────────────────────────────────────────
PERMISSIONS = [
    ("dashboard",               "dashboard",     "read"),
    ("map:read",                "map",           "read"),
    ("users:read",              "users",         "read"),
    ("users:create",            "users",         "create"),
    ("users:update",            "users",         "update"),
    ("users:delete",            "users",         "delete"),
    ("roles:read",              "roles",         "read"),
    ("roles:write",             "roles",         "write"),
    ("permissions:read",        "permissions",   "read"),    # needed by /api/permissions/
    ("permissions:create",      "permissions",   "create"),
    ("permissions:delete",      "permissions",   "delete"),
    ("sensors:read",            "sensors",       "read"),
    ("sensors:write",           "sensors",       "write"),
    ("incidents:read",          "incidents",     "read"),
    ("incidents:write",         "incidents",     "write"),
    ("traffic:read",            "traffic",       "read"),
    ("air-quality:read",        "air-quality",   "read"),
    ("water:read",              "water",         "read"),
    ("electricity:read",        "electricity",   "read"),
    ("waste:read",              "waste",         "read"),
    ("complaints:read",         "complaints",    "read"),
    ("complaints:write",        "complaints",    "write"),
    ("emergency:read",          "emergency",     "read"),
    ("emergency:write",         "emergency",     "write"),
    ("weather:read",            "weather",       "read"),
    ("admin:read",              "admin",         "read"),
    ("profile:read",            "profile",       "read"),
    ("alerts:read",             "alerts",        "read"),
    ("alerts:write",            "alerts",        "write"),
]

# ── Role → permission keys ─────────────────────────────────────────────────────
ROLE_PERMS = {
    "city_admin": [p[0] for p in PERMISSIONS],   # all permissions
    "super_admin": [p[0] for p in PERMISSIONS],
    "citizen": [
        "dashboard", "map:read", "complaints:read", "complaints:write",
        "weather:read", "profile:read", "air-quality:read", "traffic:read",
        "water:read", "emergency:read", "emergency:write", "alerts:read",
    ],
    "traffic_officer": [
        "dashboard", "map:read", "traffic:read", "incidents:read",
        "incidents:write", "profile:read", "complaints:read", "complaints:write",
    ],
    "police": [
        "dashboard", "emergency:read", "emergency:write", "map:read",
        "incidents:read", "incidents:write", "profile:read",
        "complaints:read", "complaints:write",
    ],
    "fire_service": [
        "dashboard", "emergency:read", "emergency:write", "map:read",
        "profile:read", "complaints:read", "complaints:write",
    ],
    "emergency": [
        "dashboard", "emergency:read", "emergency:write", "map:read",
        "profile:read", "complaints:read", "complaints:write",
    ],
}


def run():
    # Ensure all tables exist (safe if already present)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # ── Upsert permissions ─────────────────────────────────────────────
        pmap: dict = {}
        for (pname, resource, action) in PERMISSIONS:
            p = db.query(Permission).filter(Permission.name == pname).first()
            if not p:
                p = Permission(name=pname, resource=resource, action=action,
                               description=f"{action.title()} {resource}")
                db.add(p)
                db.commit()
                db.refresh(p)
            pmap[pname] = p

        # ── Upsert roles ───────────────────────────────────────────────────
        rmap: dict = {}
        for rname, pkeys in ROLE_PERMS.items():
            role = db.query(Role).filter(Role.name == rname).first()
            if not role:
                role = Role(name=rname, description=f"{rname} role")
                db.add(role)
                db.commit()
                db.refresh(role)
                for pk in pkeys:
                    if pk in pmap:
                        db.add(RolePermission(
                            role_id=role.id, permission_id=pmap[pk].id
                        ))
                db.commit()
                print(f"  Created role: {rname}")
            rmap[rname] = role

        # ── Upsert seed users ──────────────────────────────────────────────
        for ud in SEED_USERS:
            existing = db.query(User).filter(User.username == ud["username"]).first()
            if existing:
                print(f"  User '{ud['username']}' already exists — skipping.")
                continue

            role = rmap.get(ud["role"])
            if not role:
                role = db.query(Role).filter(Role.name == ud["role"]).first()
            if not role:
                print(f"  WARNING: role '{ud['role']}' not found, skipping user '{ud['username']}'")
                continue

            user = User(
                username=ud["username"],
                email=ud["email"],
                full_name=ud["full_name"],
                hashed_password=get_password_hash(ud["password"]),
                is_active=True,
                is_verified=True,
                failed_login_attempts=0,
            )
            user.roles.append(role)
            db.add(user)
            db.commit()
            db.refresh(user)

            # Create role-specific profile
            if ud["profile"] == "admin":
                db.add(Admin(user_id=user.id))
            elif ud["profile"] == "citizen":
                db.add(Citizen(user_id=user.id))
            elif ud["profile"] == "emergency":
                db.add(EmergencyTeam(user_id=user.id, team_type="emergency"))
            db.commit()

            print(f"  Created user: {ud['username']}  password: {ud['password']}")

        print("\nSeeding complete.")
        print("─" * 50)
        print("Default login credentials:")
        for ud in SEED_USERS:
            print(f"  {ud['username']:<12}  {ud['password']}")
        print("─" * 50)
        print("Change these passwords after first login.")

    except Exception as e:
        print(f"Seed error: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()
