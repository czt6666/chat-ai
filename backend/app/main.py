from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.utils.storage import StorageManager
from app.routers import user, girls, chat, debug

# 读取根目录 VERSION 文件
BASE_DIR = Path(__file__).parent.parent
VERSION = "0.1.0"
version_file = BASE_DIR.parent / "VERSION"
if version_file.exists():
    VERSION = version_file.read_text(encoding="utf-8").strip()

app = FastAPI(
    title=settings.APP_NAME,
    description="AiChat Agent - 用AI辅助回复女生消息",
    version=VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(user.router)
app.include_router(girls.router)
app.include_router(chat.router)
app.include_router(debug.router)


@app.on_event("startup")
async def startup_event():
    """启动时确保数据目录存在"""
    StorageManager.ensure_dirs()
    print(f"✅ {settings.APP_NAME} 启动成功")
    print(f"📂 数据目录: {StorageManager.user_profile_path().parent.parent}")


@app.get("/api/health")
async def health_check():
    """健康检查"""
    return {"status": "ok", "app": settings.APP_NAME}


@app.get("/api/version")
async def get_version():
    """获取当前版本号"""
    return {"version": VERSION, "app": settings.APP_NAME}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=3615, reload=True)
