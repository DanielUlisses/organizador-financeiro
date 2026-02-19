"""Application configuration"""
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # Database
    database_url: str = "postgresql://postgres:postgres@localhost:5432/organizador_financeiro"
    
    # Server
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    backend_reload: bool = True
    
    # Auth
    auth_secret: str = "your-secret-key-change-in-production-min-32-chars"
    auth_url: str = "http://localhost:8000"
    
    # Environment
    environment: str = "development"

    # Uploads / static user files
    uploads_dir: str = "/app/storage/uploads"
    uploads_public_base_url: str = "/uploads"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()
