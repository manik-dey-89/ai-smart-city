
from app.database import SessionLocal, engine
from app.models import User, Role, UserRole
from app.security import get_password_hash
from sqlalchemy.orm import Session

def create_test_user():
    db: Session = SessionLocal()
    try:
        # Check if role exists
        role = db.query(Role).filter(Role.name == "citizen").first()
        if not role:
            role = Role(name="citizen", description="Test citizen role")
            db.add(role)
            db.commit()
            db.refresh(role)
        
        # Check if user already exists
        existing_user = db.query(User).filter(User.username == "rupsa").first()
        if existing_user:
            print(f"User 'rupsa' already exists!")
            return
        
        # Create user
        user = User(
            username="rupsa",
            email="rupsa@test.com",
            full_name="Test User",
            hashed_password=get_password_hash("Rupsa@96"),
            is_active=True,
            is_verified=True
        )
        user.roles.append(role)
        db.add(user)
        db.commit()
        db.refresh(user)
        
        print(f"Test user created successfully!")
        print(f"Username: rupsa")
        print(f"Password: Rupsa@96")
        
    except Exception as e:
        print(f"Error creating test user: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    create_test_user()
