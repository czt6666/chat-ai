import base64
from typing import Optional

from openai import AsyncOpenAI
from anthropic import AsyncAnthropic

from app.config import settings


class LLMClient:
    """统一LLM客户端：OpenAI兼容(截图解析) + Anthropic兼容(回复生成)"""

    def __init__(self):
        self.openai = AsyncOpenAI(
            base_url=settings.OPENAI_BASE_URL,
            api_key=settings.OPENAI_API_KEY,
        )
        self.anthropic = AsyncAnthropic(
            base_url=settings.ANTHROPIC_BASE_URL,
            api_key=settings.ANTHROPIC_API_KEY,
        )

    # ---------- OpenAI 多模态 ----------

    async def chat_with_image(
        self,
        system_prompt: str,
        user_text: str,
        image_path: str,
        model: Optional[str] = None,
        temperature: float = 0.3,
    ) -> str:
        """发送图片+文字给多模态模型，返回文本"""
        model = model or settings.OPENAI_MODEL

        with open(image_path, "rb") as f:
            image_bytes = f.read()
        b64_image = base64.b64encode(image_bytes).decode("utf-8")

        # 根据文件扩展名判断mime类型
        ext = image_path.split(".")[-1].lower()
        mime = "image/png" if ext == "png" else "image/jpeg"

        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": user_text},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{mime};base64,{b64_image}"
                        },
                    },
                ],
            }
        ]

        response = await self.openai.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=2048,
        )
        return response.choices[0].message.content

    async def chat_text_only(
        self,
        system_prompt: str,
        user_text: str,
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> str:
        """纯文本对话（备用）"""
        model = model or settings.OPENAI_MODEL
        response = await self.openai.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_text},
            ],
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return response.choices[0].message.content

    # ---------- Anthropic 回复生成 ----------

    async def generate_with_claude(
        self,
        system_prompt: str,
        user_prompt: str,
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        session_id: Optional[str] = None,
    ) -> str:
        """用Claude生成高质量回复"""
        model = model or settings.ANTHROPIC_MODEL

        kwargs = {
            "model": model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "system": system_prompt,
            "messages": [
                {"role": "user", "content": user_prompt}
            ],
        }
        if session_id:
            kwargs["extra_body"] = {"session_id": session_id}

        response = await self.anthropic.messages.create(**kwargs)
        return response.content[0].text


llm_client = LLMClient()
