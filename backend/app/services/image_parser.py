import json
import re
from typing import Optional, Tuple

from app.services.llm_client import llm_client
from app.services.knowledge_base import knowledge_base
from app.models.chat import ParsedScreenshot, ChatMessage


# 截图解析 System Prompt
_PARSE_SYSTEM_PROMPT = """你是一个图片文字提取专家。需要从聊天截图中准确提取对话内容，并严格区分对话双方。

【角色识别 - 这是最重要的规则，必须严格遵守】
1. 聊天界面中，消息气泡分布在屏幕左右两侧，代表两个不同的人
2. 右侧气泡 = "我"（男生，使用者本人）→ role 填 "me"
3. 左侧气泡 = "她"（女生，聊天对象）→ role 填 "her"
4. 判断方法：看气泡的对齐方向、头像位置、消息背景色
   - 我的消息：有背景色，是消息+头像顺序
   - 她的消息：背景色为白色，是头像+消息顺序
5. 系统提示、时间戳、日期分隔线不属于任何一方，跳过

你的任务是：从截图中提取所有文字消息，按时间顺序放入 chat_messages 数组。
- 必须逐条列出，不能遗漏
- 右侧消息 → role: "me"
- 左侧消息 → role: "her"
- 绝对不能搞混
聊天中可能会发送表情包，表情包写"[表情包:{表情包的解释}]"，图片写"[图片:{图片的解释}]"
text_note 是用户手动输入的备注（比如"她前面还发了一个表情包"），可为空。

【识别聊天场景】
根据对话内容，判断当前聊天属于以下哪些场景（可多选）：
{scene_list}

**输出格式**（强制 JSON Schema）：
{
  "chat_messages": [{"role": "her", "content": "..."}, {"role": "me", "content": "..."}],
  "emotion_analysis": "对她的情绪判断",
  "detected_scenes": ["s01", "s02"],
  "meta": {
    "reply_gap": "她回复间隔",
    "message_ratio": "她几句 vs 我几句",
    "overall_tone": "整体氛围"
  }
}
注意：只输出 JSON，不要任何解释"""


async def parse_screenshot(image_path: str, text_note: Optional[str] = "") -> Tuple[ParsedScreenshot, dict]:
    """解析聊天截图，严格区分'她'和'我'的消息
    返回: (解析结果, 调试信息)
    """

    user_prompt = "请提取这张聊天截图中的所有对话文字，并严格按照上述 JSON Schema 输出结果，不要添加任何解释文字。"
    if text_note:
        user_prompt += f"\n额外备注：{text_note}"

    # 动态注入场景列表
    scene_list = knowledge_base.get_scene_summary_for_parser()
    system_prompt = _PARSE_SYSTEM_PROMPT.replace("{scene_list}", scene_list)

    raw_text = ""
    try:
        raw_text = await llm_client.chat_with_image(
            system_prompt=system_prompt,
            user_text=user_prompt,
            image_path=image_path,
            temperature=0.1,
        )
    except Exception as e:
        parsed = _fallback_parse(f"API调用失败: {str(e)}", "")
        debug = _make_parse_debug(system_prompt, user_prompt, "")
        debug["error"] = str(e)
        return parsed, debug

    # 提取JSON
    json_str = _extract_json(raw_text)
    if not json_str:
        parsed = _smart_fallback(raw_text)
        debug = _make_parse_debug(system_prompt, user_prompt, raw_text)
        debug["warning"] = "JSON提取失败，使用降级提取"
        return parsed, debug

    try:
        data = json.loads(json_str)
        parsed = ParsedScreenshot(
            chat_messages=[ChatMessage(**m) for m in data.get("chat_messages", [])],
            emotion_analysis=data.get("emotion_analysis", ""),
            detected_scenes=data.get("detected_scenes", []),
            meta={**(data.get("meta", {})), "raw": raw_text[:800]},
        )
        debug = _make_parse_debug(system_prompt, user_prompt, raw_text)
        return parsed, debug
    except Exception as e:
        parsed = _smart_fallback(raw_text)
        debug = _make_parse_debug(system_prompt, user_prompt, raw_text)
        debug["warning"] = f"JSON解析异常: {str(e)}"
        return parsed, debug


def _make_parse_debug(system_prompt: str, user_prompt: str, raw_response: str) -> dict:
    """构造识图阶段的调试信息"""
    return {
        "system_prompt": system_prompt,
        "user_prompt": user_prompt,
        "raw_response": raw_response[:2000] if raw_response else "",
    }


def _extract_json(text: str) -> Optional[str]:
    """从文本中提取JSON字符串"""
    text = text.strip()
    if text.startswith("{") and text.endswith("}"):
        return text

    pattern = r"```(?:json)?\s*\n?(.*?)\n?```"
    match = re.search(pattern, text, re.DOTALL)
    if match:
        return match.group(1).strip()

    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        return text[start:end+1]

    return None


def _smart_fallback(raw_text: str) -> ParsedScreenshot:
    """智能降级：LLM返回了内容但格式不对时，尽量提取有用信息"""
    messages = []

    for line in raw_text.split("\n"):
        line = line.strip()
        if not line:
            continue
        # 简单启发式：包含"她说"、"她:" 的认为是她的消息
        if any(k in line for k in ["她说", "对方说", "她：", "她:", "her:", "her_messages"]):
            messages.append(ChatMessage(role="her", content=line))
        elif any(k in line for k in ["我说", "自己", "我：", "我:", "my:", "my_messages"]):
            messages.append(ChatMessage(role="me", content=line))

    if not messages:
        messages = [ChatMessage(role="her", content=raw_text[:200])]

    return ParsedScreenshot(
        chat_messages=messages[-6:],
        emotion_analysis="解析格式异常，但已提取内容（请检查上方消息是否准确）",
        detected_scenes=[],
        meta={"warning": "JSON解析失败，使用降级提取", "raw": raw_text[:800]},
    )


def _fallback_parse(error_msg: str, raw_text: str) -> ParsedScreenshot:
    """完全失败时的降级"""
    return ParsedScreenshot(
        chat_messages=[],
        emotion_analysis=f"解析失败: {error_msg}",
        detected_scenes=[],
        meta={"error": error_msg, "raw": raw_text[:500] if raw_text else ""},
    )
