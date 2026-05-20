from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks
from datetime import datetime
import uuid

from app.services.image_parser import parse_screenshot
from app.services.knowledge_base import knowledge_base
from app.services.reply_generator import generate_reply
from app.services.chat_history import chat_history
from app.utils.storage import StorageManager

router = APIRouter(prefix="/api/girls", tags=["chat"])


@router.post("/{girl_id}/chat")
async def chat_with_girl(
    girl_id: str,
    background_tasks: BackgroundTasks,
    image: UploadFile = File(...),
    text_note: str = Form("")
):
    """
    上传聊天截图，获取3版本回复。
    核心流程：保存截图 → 解析（含场景识别+档案总结） → 加载历史 → 生成回复 → 保存历史
    """
    request_id = f"req_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    # 1. 校验女生存在
    girl_profile = StorageManager.read_json(
        StorageManager.girl_profile_path(girl_id)
    )
    if not girl_profile:
        raise HTTPException(status_code=404, detail=f"女生 {girl_id} 不存在")

    # 2. 保存截图
    screenshot_dir = StorageManager.girl_screenshot_dir(girl_id)
    timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
    ext = image.filename.split(".")[-1] if "." in image.filename else "png"
    screenshot_path = screenshot_dir / f"{timestamp_str}.{ext}"

    content = await image.read()
    with open(screenshot_path, "wb") as f:
        f.write(content)

    # 3. 解析截图（新增：场景识别 + 女生档案总结）
    parsed, parse_debug = await parse_screenshot(str(screenshot_path), text_note)

    # 4. [暂不启用] 更新女生档案（把 AI 总结的女生画像追加到 notes）
    # if parsed.girl_summary:
    #     existing_notes = girl_profile.get("notes", "")
    #     if parsed.girl_summary not in existing_notes:
    #         new_notes = f"{existing_notes}\n\n[AI观察 {datetime.now().strftime('%m-%d')}]\n{parsed.girl_summary}".strip()
    #         girl_profile["notes"] = new_notes
    #         StorageManager.write_json(
    #             StorageManager.girl_profile_path(girl_id),
    #             girl_profile
    #         )

    # 5. 保存"她"的消息到多轮对话历史
    her_messages = [m for m in parsed.chat_messages if m.role == "her"]
    if her_messages:
        for msg in her_messages[-3:]:
            chat_history.append_message(
                girl_id=girl_id,
                role="her",
                content=msg.content,
                msg_type="text",
            )

    # 6. 获取当前 session ID，用于 Claude 多轮上下文
    sessions = chat_history.list_sessions(girl_id)
    session_id = sessions[-1]["session_id"] if sessions else f"session_{girl_id}"

    # 7. 生成回复（通过 session_id 维持 Claude 多轮上下文，不再在 prompt 中拼接历史）
    response, debug_info = await generate_reply(
        parsed=parsed.model_dump(),
        session_id=session_id,
    )
    response.request_id = request_id
    response.debug = debug_info
    response.parse_debug = parse_debug

    # 8. 保存"我"的回复和系统分析到多轮对话历史
    chat_history.append_message(
        girl_id=girl_id,
        role="system",
        content=f"情绪：{response.emotion_tag} | 窗口分析：{response.window_analysis} | 策略：{response.reply_strategy}",
        msg_type="analysis",
        extra={"recommended": response.recommended, "why": response.why}
    )

    for version_name in ["conservative", "balanced", "aggressive"]:
        version_text = getattr(response.versions, version_name, "")
        if version_text and version_text != "...":
            chat_history.append_message(
                girl_id=girl_id,
                role="me",
                content=version_text,
                msg_type="reply_version",
                extra={"version": version_name, "recommended": response.recommended == version_name}
            )

    # 9. 保存历史记录（异步，不阻塞返回）
    background_tasks.add_task(
        _save_history,
        girl_id,
        {
            "timestamp": datetime.now().isoformat(),
            "request_id": request_id,
            "screenshot_path": str(screenshot_path),
            "parsed": parsed.model_dump(),
            "detected_scenes": parsed.detected_scenes,
            "emotion_tag": response.emotion_tag,
            "versions": response.versions.model_dump(),
            "recommended": response.recommended,
        }
    )

    return response.model_dump()


@router.post("/{girl_id}/sessions/new")
async def create_new_session(girl_id: str):
    """为女生新建一个对话session（旧的保留）"""
    girl_profile = StorageManager.read_json(
        StorageManager.girl_profile_path(girl_id)
    )
    if not girl_profile:
        raise HTTPException(status_code=404, detail=f"女生 {girl_id} 不存在")

    session_file = chat_history.create_new_session(girl_id)
    return {
        "girl_id": girl_id,
        "session_id": session_file.stem,
        "message": "新建对话成功",
    }


@router.get("/{girl_id}/history")
async def get_chat_history(girl_id: str, n: int = 20):
    """获取最近N条对话历史"""
    history = chat_history.get_recent_history(girl_id, n=n, include_system=False)
    sessions = chat_history.list_sessions(girl_id)
    return {
        "girl_id": girl_id,
        "current_session": sessions[-1]["session_id"] if sessions else None,
        "sessions_count": len(sessions),
        "messages": history,
    }


def _save_history(girl_id: str, record: dict):
    """保存聊天记录到JSONL"""
    history_path = StorageManager.girl_history_path(girl_id)
    StorageManager.append_jsonl(history_path, record)
