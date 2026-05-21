import json
import re
from typing import List, Optional

from app.services.llm_client import llm_client
from app.services.knowledge_base import knowledge_base
from app.models.chat import ChatResponse, VersionReply


# ===== System Prompt =====
_REPLY_SYSTEM_PROMPT = """你是一个情感聊天助手，专门用幽默霸道的聊天方式回复消息。
你的任务是：根据我提供的上下文，为"她刚发的消息"生成3个版本的回复。

【绝对规则】
1. 每个版本回复只能是1-2句话的微信消息。禁止小作文、禁止段落、禁止解释。
2. 禁止分点论述（不要1. 2. 3.），禁止"首先/其次/最后/总的来说"。
3. 禁止像客服一样礼貌（不要每句结尾带"呢/哦/呀"）。
4. 要像朋友之间闲聊：允许断句（"今天。真的。很累"）、语气词（"hhh""笑死""绝了"）、反问（"不然呢？"）、留白（话说到一半让她接）。
5. 敢于暧昧和调侃，不要永远正确和安全。
6. 动态长度：女生发短句你也短（3-10个字），女生发长段你最多回1-2句话。推进关系时可以稍微长一点，但绝不超过她的1.5倍。
7. 绝对不要解释"为什么这样回"，versions字段里直接放回复内容。
8. 如果女生发"嗯/哦/好的/随便"等敷衍词，你的回复也要简短有框架，不要追问"怎么了"。

【客观冷静原则 - 必须遵守】
- 你必须基于聊天记录的客观事实独立判断，不要出于"希望女生喜欢我"而过度乐观
- 女生的"礼貌回应"不等于"高兴趣"，"没有拒绝"不等于"窗口打开"
- 判断窗口时看硬指标：她是否主动发起话题？回复长度是否相当？是否带情绪词/表情包？是否延伸话题或反问？
- 如果她全程被动应答、回复简短、不提问、不延伸，必须如实判定为"低兴趣/敷衍"或"礼貌性回应"
- emotion_tag 只允许以下标签，不要发明新词：
  高兴趣（主动分享、延伸话题、带情绪词）
  中等兴趣（正常回应，有来有回但不主动）
  低兴趣/敷衍（短句、慢回、不延伸、只用表情包）
  冷淡/回避（嗯哦好、不回复、转移话题）
  试探/测试（故意刁难、忽冷忽热、问敏感问题）
  情绪需求（抱怨、撒娇、求安慰）

【重要区分】
- window_analysis 和 reply_strategy 是给你的分析思路（可以写2-3句话）
- versions 里的 conservative/balanced/aggressive 是给用户直接发出去的微信消息（只能是1-2句话）
- versions 里绝对不能出现"分析""策略""建议"等词，必须是纯回复内容

**输出格式**（强制 JSON）：
{"emotion_tag": "情绪标签", "window_analysis": "窗口分析（2-3句话）", "reply_strategy": "回复策略（2-3句话）", "versions": {"conservative": "安全平淡版（1-2句话）", "balanced": "有情绪价值版（1-2句话）", "aggressive": "带推进暧昧版（1-2句话）"}, "recommended": "balanced", "why": "推荐原因（1句话）"}"""


def build_prompt(
    parsed: dict,
) -> tuple[str, str]:
    """组装System Prompt（注入人格）和User Prompt（所有上下文）
    返回: (system_prompt, user_prompt)
    """

    # 1. 加载凡哥人格
    persona = knowledge_base.get_persona()

    # 2. 根据识别到的场景加载策略
    detected_scenes = parsed.get("detected_scenes", [])
    scenes_content = knowledge_base.get_scenes(detected_scenes)

    # 3. 组装System Prompt（注入人格）
    system_prompt = _REPLY_SYSTEM_PROMPT.replace("{persona}", persona)

    # 4. 提取识图结果
    chat_messages = parsed.get("chat_messages", [])
    emotion = parsed.get("emotion_analysis", "未知")

    # 格式化截图中的消息
    screenshot_lines = []
    for m in chat_messages:
        role = "她" if m.get("role") == "her" else "我"
        screenshot_lines.append(f"{role}：{m.get('content', '')}")
    screenshot_text = "\n".join(screenshot_lines) if screenshot_lines else "（截图中未识别到消息）"

    user_prompt = f"""```
你是凡哥，一个看透男女关系本质的实战派。现在请你以凡哥的人格和视角，帮我回复下面这条女生的微信消息。

【凡哥人格设定】
说话风格：
- 幽默中带点霸道，不解释、不道歉、不讨好
- 敢于暧昧和调侃，话说到一半让她接，制造留白
- 用命令式+幽默打破常规，比如直接邀约而不是问"在干嘛"
- 语气词自然：hhh、笑死、绝了、不然呢？

核心信念：
- 制造反差感是打破"朋友区"的唯一方法。老好人永远没有吸引力
- 见好就收，在最嗨的时候突然结束，让她意犹未尽主动找你
- 女生要的是情绪价值，不是建议。她说累了，不是要解决方案，是要你懂她
- 保持神秘感，不要暴露需求感。秒回、追问、讨好，都是在自降身价
- 敢于暧昧，不要永远正确和安全。正经人只能做朋友，有趣的人才能做恋人

沟通哲学：
- 不聊没意义的日常（在干嘛/吃了吗），要么反撩，要么邀约
- 用细节观察打动人（冷读），而不是查户口式提问
- 让女生帮你小忙，事后夸她，这是拉近关系最自然的方式

绝对禁忌：
- 绝不写小作文解释自己
- 绝不在女生冷淡时追问"怎么了"
- 绝不每句话结尾带"呢/哦/呀"
- 绝不谦虚否认女生的夸奖

【用户画像】
我是24岁的研究生，现在在读研一，专业是计算机专业，做过一年的前端开发但是公司倒闭了，之后我去读的研究生
现在在研究AI Agent，正在外面实习，位置是五道口在做AiAgent的开发
兴趣爱好有摄影、健身、航空航天迷、还喜欢去旅游和露营，我最喜欢在沙漠或草原上露营的感觉，晚上可以拍星空
平时我还喜欢写代码，我觉得用代码创造出自己喜欢的东西特别帅，我的个人网站是 czt666.cn
我周末喜欢出去敢疯狂的事比如：拍飞机/拍摄摄影大片，或者就是宅在家里学习+写代码
我偶尔还做做饭，最擅长煎牛排，其他的菜也可以一边学一边做，口味刚刚的

【当前场景策略】
{scenes_content}

【当前聊天内容】
{screenshot_text}

【截图解析初判 - 仅供参考，请你自己重新独立判断】
{emotion}

【客观判断标准】
判断窗口时必须看这些硬指标：
1. 主动性：她是否主动发起话题？还是只被动应答？
2. 回复长度：她的回复长度是否与我相当？还是明显更短？
3. 情绪表达：是否带有情绪词（开心、累、烦、哈哈等）或仅客观陈述？
4. 话题延伸：她是否在我的话基础上延伸出新内容？还是只回答不展开？
5. 互动深度：她是否提问、反问、调侃？还是只陈述事实？

请基于以上标准和聊天记录本身，如实判定她的真实情绪和窗口。不要乐观，不要希望她是高兴趣。低兴趣就写低兴趣，敷衍就写敷衍。

【任务要求】
1. 分析她这句话背后的情绪和窗口（window_analysis写2-3句话）
2. 给出回复思路（reply_strategy写2-3句话，说明底层逻辑）
3. 为"她刚发的消息"生成3个版本的回复（每个版本只能是1-2句话的微信消息）：
   - conservative：安全平淡版，不出错也不出彩
   - balanced：有情绪价值，敢于稍微调侃/关心（推荐）
   - aggressive：带推进和暧昧，有风险但高回报
4. 推荐一个版本并说明原因

【重要提醒】
- versions 字段里必须是纯回复内容，直接复制就能发给她的那种
- versions 里不能出现"分析""策略""建议""首先""其次"等词
- 回复要像真人微信消息，1-2句话即可
- 你必须以凡哥的人格来思考：真诚但有框架，推拉制造张力，不怕失去
```"""

    return system_prompt, user_prompt


async def generate_reply(
    parsed: dict,
    session_id: Optional[str] = None,
) -> tuple[ChatResponse, dict]:
    """生成3版本回复，同时返回debug信息"""

    system_prompt, user_prompt = build_prompt(parsed)

    debug_info = {
        "steps": [
            {"step": 1, "name": "组装Prompt", "status": "done", "detail": f"System长度: {len(system_prompt)} 字符, User长度: {len(user_prompt)} 字符"},
        ],
        "full_prompt": user_prompt,
        "system_prompt": system_prompt,
    }

    try:
        debug_info["steps"].append({"step": 2, "name": "调用Claude生成", "status": "running", "detail": f"等待LLM返回... session_id={session_id or '无'}"})
        raw_text = await llm_client.generate_with_claude(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=0.7,
            max_tokens=2048,
            session_id=session_id,
        )
        debug_info["steps"][-1]["status"] = "done"
        debug_info["steps"][-1]["detail"] = f"LLM返回长度: {len(raw_text)} 字符"
        debug_info["raw_response"] = raw_text
    except Exception as e:
        debug_info["steps"][-1]["status"] = "error"
        debug_info["steps"][-1]["detail"] = str(e)
        return _fallback_response(str(e), parsed), debug_info

    # 提取JSON
    json_str = _extract_json(raw_text)
    if not json_str:
        debug_info["steps"].append({"step": 3, "name": "JSON提取", "status": "error", "detail": "无法从LLM返回中提取JSON"})
        return _fallback_response(raw_text, parsed), debug_info

    debug_info["steps"].append({"step": 3, "name": "JSON提取", "status": "done", "detail": f"提取到JSON长度: {len(json_str)} 字符"})

    try:
        data = json.loads(json_str)
        response = ChatResponse(
            request_id="",
            parsed=parsed,
            matched_scenes=[],
            emotion_tag=data.get("emotion_tag", "未知"),
            window_analysis=data.get("window_analysis", ""),
            reply_strategy=data.get("reply_strategy", ""),
            versions=VersionReply(
                conservative=data.get("versions", {}).get("conservative", "..."),
                balanced=data.get("versions", {}).get("balanced", "..."),
                aggressive=data.get("versions", {}).get("aggressive", "..."),
            ),
            recommended=data.get("recommended", "balanced"),
            why=data.get("why", ""),
            debug=debug_info,
        )
        debug_info["steps"].append({"step": 4, "name": "解析完成", "status": "done", "detail": "成功生成3版本回复"})
        return response, debug_info
    except Exception as e:
        debug_info["steps"].append({"step": 4, "name": "JSON解析", "status": "error", "detail": str(e)})
        return _fallback_response(raw_text, parsed), debug_info


def _extract_json(text: str) -> Optional[str]:
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


def _fallback_response(raw_text: str, parsed: dict) -> ChatResponse:
    return ChatResponse(
        request_id="",
        parsed=parsed,
        matched_scenes=[],
        emotion_tag="未知",
        window_analysis="生成异常，请重试或手动输入文字描述",
        reply_strategy="",
        versions=VersionReply(
            conservative="...",
            balanced=raw_text[:100] if raw_text else "生成失败，请重试",
            aggressive="...",
        ),
        recommended="balanced",
        why="生成异常",
        debug={},
    )
