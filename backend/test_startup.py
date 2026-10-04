from main import app
from fastapi.routing import APIRoute

paths = []
for route in app.routes:
    if isinstance(route, APIRoute):
        paths.append(route.path)

print("Registered API routes:")
for p in sorted(set(paths)):
    print(f"  {p}")

assert any('auth/google' in p for p in paths), "Google route not found!"
assert any('auth/login'  in p for p in paths), "Login route not found!"
assert any('citizen/dashboard' in p for p in paths), "Citizen dashboard not found!"
assert any('complaints' in p for p in paths), "Complaints route not found!"
assert any('health' in p for p in paths), "Health check not found!"
print("\nAll assertions passed - Backend startup OK")
