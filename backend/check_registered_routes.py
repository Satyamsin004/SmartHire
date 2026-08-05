import os
import sys

# Add backend root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.main import app

from fastapi.routing import APIRoute

def get_all_routes(app_obj):
    endpoints = []
    for r in app_obj.routes:
        if isinstance(r, APIRoute):
            methods = ", ".join(sorted(r.methods))
            endpoints.append((r.path, methods))
        elif hasattr(r, "original_router") or type(r).__name__ == "_IncludedRouter":
            prefix = ""
            if hasattr(r, "include_context") and hasattr(r.include_context, "prefix"):
                prefix = r.include_context.prefix or ""
            router = getattr(r, "original_router", None)
            if router and hasattr(router, "routes"):
                for sub_r in router.routes:
                    if isinstance(sub_r, APIRoute):
                        methods = ", ".join(sorted(sub_r.methods))
                        full_path = f"{prefix}{sub_r.path}"
                        endpoints.append((full_path, methods))
    return endpoints

def check_routes():
    print("="*80)
    print("=== FASTAPI ROUTE AUDIT & REGISTRATION INSPECTION ===")
    print("="*80)

    found_aptitude_start = False
    all_endpoints = get_all_routes(app)
    all_endpoints.sort(key=lambda x: x[0])

    for path, methods in all_endpoints:
        print(f"  {methods:<15} {path}")
        if path == "/api/v1/aptitude/start" and "POST" in methods:
            found_aptitude_start = True

    print("\n" + "="*80)
    if found_aptitude_start:
        print("VERIFIED: POST /api/v1/aptitude/start IS PROPERLY REGISTERED ON FASTAPI APP!")
    else:
        print("ERROR: POST /api/v1/aptitude/start WAS NOT FOUND IN FASTAPI ROUTES!")
    print("="*80)

if __name__ == "__main__":
    check_routes()
