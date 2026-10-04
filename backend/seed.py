#!/usr/bin/env python3
"""
Database seed script.
---
Passwords for seeded accounts are generated randomly at first run and
written to .env.seed (gitignored). They are NEVER printed to stdout.
If you need to reset a password, delete the user from the DB and re-run.
"""
import sys
import os
import secrets
import string

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal, engine
from app.models import User, Role, Permission, RolePermission, UserRole, Citizen, Admin
from app.security import get_password_hash

SEED_FILE = os.path.join(os.path.dirname(__file__), ".env.seed")


def _generate_password(length: int = 20) -> str:
    """Generate a cryptographically secure random password."""
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    # Guarantee at least one of each required character class
    pwd = [
        secrets.choice(string.ascii_uppercase),
        secrets.choice(string.ascii_lowercase),
        secrets.choice(string.digits),
        secrets.choice("!@#$%^&*"),
    ]
    pwd += [secrets.choice(alphabet) for _ in range(length - 4)]
    secrets.SystemRandom().shuffle(pwd)
    return "".join(pwd)


def _load_seed_passwords() -> dict:
    """Load previously generated passwords from .env.seed."""
    passwords = {}
    if os.path.exists(SEED_FILE):
        with open(SEED_FILE) as f:
            for line in f:
                line = line.strip()
                if "=" in line and not line.startswith("#"):
                    key, _, val = line.partition("=")
                    passwords[key.strip()] = val.strip()
    return passwords


def _save_seed_passwords(passwords: dict):
    """Persist seed passwords to .env.seed (owner-read-only)."""
    lines = [
        "# Auto-generated seed passwords — DO NOT commit this file\n",
        "# Add .env.seed to .gitignore\n",
        "\n",
    ]
    for key, val in passwords.items():
        lines.append(f"{key}={val}\n")
    with open(SEED_FILE, "w") as f:
        f.writelines(lines)
    # Restrict to owner read/write on POSIX systems
    try:
        os.chmod(SEED_FILE, 0o600)
    except AttributeError:
        pass  # Windows — skip chmod


def init_db():
    from sqlalchemy import inspect as sa_inspect
    auth_tables = [
        User.__table__, Role.__table__, Permission.__table__,
        RolePermission.__table__, UserRole.__table__,
    ]
    inspector = sa_inspect(engine)
    for table in auth_tables:
        if not inspector.has_table(table.name):
            table.create(engine)

    db = SessionLocal()
    try:
        if db.query(Role).count() > 0:
            print("Database already initialised — skipping seed.")
            return

        # ── Load or generate passwords ──────────────────────────────────────
        existing_pwds = _load_seed_passwords()
        seed_users = ["admin", "traffic", "police", "fire", "emergency", "citizen"]
        passwords: dict = {}
        changed = False
        for u in seed_users:
            key = f"SEED_PASSWORD_{u.upper()}"
            if key in existing_pwds:
                passwords[u] = existing_pwds[key]
            else:
                passwords[u] = _generate_password()
                changed = True
        if changed:
            _save_seed_passwords({
                f"SEED_PASSWORD_{u.upper()}": passwords[u] for u in seed_users
            })

        # ── Roles ────────────────────────────────────────────────────────────
        citizen_role        = Role(name="citizen",         description="Standard citizen user")
        admin_role          = Role(name="city_admin",      description="Administrator with full access")
        traffic_officer_role= Role(name="traffic_officer", description="Traffic officer")
        police_role         = Role(name="police",          description="Police department")
        fire_service_role   = Role(name="fire_service",    description="Fire service department")
        emergency_role      = Role(name="emergency",       description="Emergency responder")

        db.add_all([citizen_role, admin_role, traffic_officer_role,
                    police_role, fire_service_role, emergency_role])
        db.commit()

        # ── Permissions ──────────────────────────────────────────────────────
        perms_data = [
            ("dashboard:read",   "dashboard",   "read"),
            ("users:read",       "users",       "read"),
            ("users:create",     "users",       "create"),
            ("users:update",     "users",       "update"),
            ("users:delete",     "users",       "delete"),
            ("roles:read",       "roles",       "read"),
            ("roles:write",      "roles",       "write"),
            ("sensors:read",     "sensors",     "read"),
            ("sensors:write",    "sensors",     "write"),
            ("incidents:read",   "incidents",   "read"),
            ("incidents:write",  "incidents",   "write"),
            ("traffic:read",     "traffic",     "read"),
            ("map:read",         "map",         "read"),
            ("air-quality:read", "air-quality", "read"),
            ("water:read",       "water",       "read"),
            ("electricity:read", "electricity", "read"),
            ("waste:read",       "waste",       "read"),
            ("complaints:read",  "complaints",  "read"),
            ("complaints:write", "complaints",  "write"),
            ("emergency:read",   "emergency",   "read"),
            ("emergency:write",  "emergency",   "write"),
            ("weather:read",     "weather",     "read"),
            ("admin:read",       "admin",       "read"),
            ("profile:read",     "profile",     "read"),
        ]
        permissions = []
        for name, resource, action in perms_data:
            p = Permission(name=name, resource=resource, action=action,
                           description=f"{action.title()} {resource}")
            db.add(p)
            permissions.append(p)
        db.commit()

        pmap = {p.name: p for p in permissions}

        # ── Assign permissions ───────────────────────────────────────────────
        admin_role.permissions.extend(permissions)

        citizen_role.permissions.extend([
            pmap[k] for k in [
                "dashboard:read", "map:read", "complaints:read",
                "complaints:write", "weather:read", "profile:read",
                "air-quality:read", "traffic:read", "water:read",
                "emergency:read",
            ]
        ])
        traffic_officer_role.permissions.extend([
            pmap[k] for k in ["dashboard:read", "traffic:read", "map:read",
                               "incidents:read", "incidents:write", "profile:read"]
        ])
        police_role.permissions.extend([
            pmap[k] for k in ["dashboard:read", "emergency:read", "emergency:write",
                               "map:read", "incidents:read", "incidents:write", "profile:read"]
        ])
        fire_service_role.permissions.extend([
            pmap[k] for k in ["dashboard:read", "emergency:read", "emergency:write",
                               "map:read", "profile:read"]
        ])
        emergency_role.permissions.extend([
            pmap[k] for k in ["dashboard:read", "emergency:read", "emergency:write",
                               "map:read", "profile:read"]
        ])
        db.commit()

        # ── Seed users ───────────────────────────────────────────────────────
        def make_user(username, email, full_name, role_obj, extra_model=None):
            u = User(
                username=username,
                email=email,
                full_name=full_name,
                hashed_password=get_password_hash(passwords[username]),
                is_active=True,
                is_verified=True,
            )
            u.roles.append(role_obj)
            db.add(u)
            db.commit()
            db.refresh(u)
            if extra_model:
                db.add(extra_model(user_id=u.id))
                db.commit()
            return u

        make_user("admin",     "admin@smartcity.gov",     "System Administrator", admin_role,           Admin)
        make_user("traffic",   "traffic@smartcity.gov",   "Traffic Officer",      traffic_officer_role)
        make_user("police",    "police@smartcity.gov",    "Police Officer",       police_role)
        make_user("fire",      "fire@smartcity.gov",      "Firefighter",          fire_service_role)
        make_user("emergency", "emergency@smartcity.gov", "Emergency Responder",  emergency_role)
        make_user("citizen",   "citizen@smartcity.gov",   "Demo Citizen",         citizen_role,         Citizen)

        print("Database seeded successfully.")
        print(f"Seed passwords saved to: {SEED_FILE}")
        print("Keep that file secure and out of version control.")

    except Exception as e:
        print(f"Seed error: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    init_db()
