from fastapi import APIRouter, HTTPException
from app.models.user import UserProfile
from app.utils.storage import StorageManager

router = APIRouter(prefix="/api/user", tags=["user"])


@router.get("/profile")
async def get_user_profile():
    """获取用户全局画像"""
    data = StorageManager.read_json(StorageManager.user_profile_path())
    if not data:
        # 返回默认空画像
        return UserProfile().model_dump()
    return data


@router.put("/profile")
async def update_user_profile(profile: UserProfile):
    """更新用户全局画像"""
    StorageManager.write_json(
        StorageManager.user_profile_path(),
        profile.model_dump(exclude_none=True)
    )
    return profile.model_dump()
