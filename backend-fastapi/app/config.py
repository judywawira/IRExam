from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    mongodb_url: str = "mongodb://localhost:27017"
    database_name: str = "irexam"
    jwt_secret: str = "your-secret-key-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expiration_days: int = 7
    upload_dir: str = "uploads"
    max_upload_size: int = 500 * 1024 * 1024  # 500MB

    class Config:
        env_file = ".env"

@lru_cache()
def get_settings():
    return Settings()
