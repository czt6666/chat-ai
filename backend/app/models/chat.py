from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime


class ChatMessage(BaseModel):
    """单条消息"""
    role: str  # "her" | "me"
    content: str


class ParsedScreenshot(BaseModel):
    """截图解析结果"""
    chat_messages: List[ChatMessage] = Field(default_factory=list)
    emotion_analysis: str = ""
    detected_scenes: List[str] = Field(default_factory=list, description="识别到的场景标签列表")
    meta: Dict = Field(default_factory=dict)


class ChatRequest(BaseModel):
    """聊天请求（除截图外的文字备注）"""
    text_note: Optional[str] = Field(default="", description="文字备注，比如'她前面还发了一个表情包'")


class VersionReply(BaseModel):
    conservative: str
    balanced: str
    aggressive: str


class ChatResponse(BaseModel):
    """聊天响应"""
    request_id: str
    parsed: ParsedScreenshot
    matched_scenes: List[Dict] = Field(default_factory=list)
    emotion_tag: str
    window_analysis: str
    reply_strategy: str
    versions: VersionReply
    recommended: str
    why: str
    debug: Dict = Field(default_factory=dict, description="回复生成阶段的调试信息")
    parse_debug: Dict = Field(default_factory=dict, description="截图解析阶段的调试信息：prompt + raw response")
