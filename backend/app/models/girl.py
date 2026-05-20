from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class GirlProfile(BaseModel):
    """女生档案"""
    girl_id: str = Field(..., description="唯一ID")
    name: str = Field(..., description="名字")
    age: Optional[int] = Field(default=None)
    occupation: Optional[str] = Field(default=None)
    source: Optional[str] = Field(default=None, description="认识渠道：探探/微信/抖音等")
    stage: str = Field(default="刚加", description="关系阶段：刚加/熟悉/暧昧/即将确定关系")
    tags: List[str] = Field(default_factory=list, description="性格标签")
    likes: List[str] = Field(default_factory=list, description="兴趣爱好")
    taboos: List[str] = Field(default_factory=list, description="雷区")
    notes: str = Field(default="", description="关键记忆/备注，手动维护的精华")
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())

    class Config:
        json_schema_extra = {
            "example": {
                "girl_id": "girl_001",
                "name": "小雨",
                "age": 24,
                "occupation": "设计师",
                "source": "探探",
                "stage": "暧昧期",
                "tags": ["猫系", "慢热", "事业心强"],
                "likes": ["猫", "咖啡", "看展"],
                "taboos": ["被说教", "查岗", "太油腻"],
                "notes": "5/18约看展她说看安排，态度犹豫。不喜欢太正式的邀约。",
                "created_at": "2026-05-19T10:00:00"
            }
        }


class GirlCreate(BaseModel):
    """创建女生请求"""
    name: str
    age: Optional[int] = None
    occupation: Optional[str] = None
    source: Optional[str] = None
    stage: str = "刚加"
    tags: List[str] = []
    likes: List[str] = []
    taboos: List[str] = []
    notes: str = ""
    init_description: Optional[str] = Field(default=None, description="主页文字描述或截图解析结果")
    init_image: Optional[str] = Field(default=None, description="主页截图路径（如果有）")


class GirlUpdate(BaseModel):
    """更新女生请求（全部可选）"""
    name: Optional[str] = None
    age: Optional[int] = None
    occupation: Optional[str] = None
    source: Optional[str] = None
    stage: Optional[str] = None
    tags: Optional[List[str]] = None
    likes: Optional[List[str]] = None
    taboos: Optional[List[str]] = None
    notes: Optional[str] = None
