from app.main import app

schema = app.openapi()
print("Direct app.openapi() components:", schema.get("components", {}))
print("Direct app.openapi() security:", schema.get("security", []))
