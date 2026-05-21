from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, Literal

from app.services.llm_client import llm_client

router = APIRouter(prefix="/api/debug", tags=["debug"])


class DebugLLMRequest(BaseModel):
    system_prompt: str = Field(default="", description="System prompt")
    user_prompt: str = Field(..., description="User prompt")
    provider: Literal["anthropic", "openai"] = Field(default="anthropic", description="LLM provider")
    model: Optional[str] = Field(default=None, description="Model name, default from env")
    temperature: float = Field(default=0.7, ge=0, le=2)
    max_tokens: int = Field(default=2048, ge=1, le=8192)


class DebugLLMResponse(BaseModel):
    content: str
    provider: str
    model: str
    temperature: float
    max_tokens: int
    system_prompt: str
    user_prompt: str
    elapsed_ms: int


@router.post("/llm", response_model=DebugLLMResponse)
async def debug_llm(req: DebugLLMRequest):
    """直接调用LLM，用于调试prompt"""
    import time

    start = time.time()

    try:
        if req.provider == "anthropic":
            raw = await llm_client.generate_with_claude(
                system_prompt=req.system_prompt,
                user_prompt=req.user_prompt,
                model=req.model,
                temperature=req.temperature,
                max_tokens=req.max_tokens,
            )
        else:
            raw = await llm_client.chat_text_only(
                system_prompt=req.system_prompt,
                user_text=req.user_prompt,
                model=req.model,
                temperature=req.temperature,
                max_tokens=req.max_tokens,
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM调用失败: {str(e)}")

    elapsed_ms = int((time.time() - start) * 1000)

    return DebugLLMResponse(
        content=raw,
        provider=req.provider,
        model=req.model or ("default"),
        temperature=req.temperature,
        max_tokens=req.max_tokens,
        system_prompt=req.system_prompt,
        user_prompt=req.user_prompt,
        elapsed_ms=elapsed_ms,
    )
