import shutil
from fastapi import APIRouter, HTTPException
from typing import List

from app.models.girl import GirlProfile, GirlCreate, GirlUpdate
from app.utils.storage import StorageManager

router = APIRouter(prefix="/api/girls", tags=["girls"])


@router.get("")
async def list_girls():
    """列出所有女生档案"""
    girls = StorageManager.list_girls()
    return {"girls": girls, "total": len(girls)}


@router.post("")
async def create_girl(data: GirlCreate):
    """创建新女生档案"""
    girl_id = StorageManager.generate_girl_id(data.name)

    profile = GirlProfile(
        girl_id=girl_id,
        name=data.name,
        age=data.age,
        occupation=data.occupation,
        source=data.source,
        stage=data.stage,
        tags=data.tags,
        likes=data.likes,
        taboos=data.taboos,
        notes=data.notes,
    )

    StorageManager.write_json(
        StorageManager.girl_profile_path(girl_id),
        profile.model_dump()
    )

    return profile.model_dump()


@router.get("/{girl_id}")
async def get_girl(girl_id: str):
    """获取女生档案"""
    data = StorageManager.read_json(
        StorageManager.girl_profile_path(girl_id)
    )
    if not data:
        raise HTTPException(status_code=404, detail=f"女生 {girl_id} 不存在")
    return data


@router.put("/{girl_id}")
async def update_girl(girl_id: str, data: GirlUpdate):
    """更新女生档案（部分更新）"""
    path = StorageManager.girl_profile_path(girl_id)
    existing = StorageManager.read_json(path)
    if not existing:
        raise HTTPException(status_code=404, detail=f"女生 {girl_id} 不存在")

    # 只更新提供的字段
    update_data = data.model_dump(exclude_unset=True)
    existing.update(update_data)

    StorageManager.write_json(path, existing)
    return existing


@router.delete("/{girl_id}")
async def delete_girl(girl_id: str):
    """删除女生及其所有数据"""
    girl_dir = StorageManager.girl_dir(girl_id)
    if not girl_dir.exists():
        raise HTTPException(status_code=404, detail=f"女生 {girl_id} 不存在")

    shutil.rmtree(girl_dir)
    return {"message": f"女生 {girl_id} 已删除"}
