from pydantic import BaseModel, Field
from typing import Optional


class UserProfile(BaseModel):
    """用户全局画像"""
    nickname: str = Field(default="你", description="你的昵称")
    age: Optional[int] = Field(default=None, description="年龄")
    occupation: Optional[str] = Field(default=None, description="职业")
    personality: Optional[str] = Field(default=None, description="性格特点")
    chat_style: Optional[str] = Field(default=None, description="平时聊天风格")
    common_phrases: Optional[str] = Field(default=None, description="口头禅，逗号分隔")
    goals: Optional[str] = Field(default=None, description="希望改进的方向")

    class Config:
        json_schema_extra = {
            "example": {
                "nickname": "你",
                "age": 26,
                "occupation": "互联网产品经理",
                "personality": "偏内向，逻辑型，不太会开玩笑",
                "chat_style": "直男风，话少，喜欢用句号",
                "common_phrases": "确实,有道理,哈哈",
                "goals": "学会幽默，敢于推进关系"
            }
        }
