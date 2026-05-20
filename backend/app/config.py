import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"

env = os.getenv("APP_ENV", "development")
env_file = BASE_DIR / f".env.{env}"
if env_file.exists():
    load_dotenv(env_file)
elif (BASE_DIR / ".env").exists():
    load_dotenv(BASE_DIR / ".env")

class Settings:
    APP_NAME: str = os.getenv("APP_NAME", "AiChat Agent")
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"
    CORS_ORIGINS: list[str] = [x.strip() for x in os.getenv("CORS_ORIGINS", "*").split(",")]

    # OpenAI兼容 (云物)
    OPENAI_BASE_URL: str = os.getenv("OPENAI_BASE_URL", "https://yunwu.ai/v1")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o")

    # Anthropic兼容 (云物)
    ANTHROPIC_BASE_URL: str = os.getenv("ANTHROPIC_BASE_URL", "https://yunwu.ai")
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    ANTHROPIC_MODEL: str = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6")

settings = Settings()
