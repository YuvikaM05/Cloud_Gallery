import os

# Must be set BEFORE the app is imported. No real database is needed for these tests.
os.environ.setdefault("MONGODB_URI", "mongodb://localhost:27017")
os.environ.setdefault("DATABASE_NAME", "cloudgallery_test")
os.environ.setdefault("JWT_SECRET", "test-secret")
