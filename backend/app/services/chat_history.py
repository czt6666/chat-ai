import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional

from app.config import DATA_DIR


class ChatHistoryManager:
    """多轮对话历史管理：每个女生一个session，支持新建session但不删除旧的"""

    def __init__(self):
        self._sessions_dir = DATA_DIR / "girls"

    def _girl_sessions_dir(self, girl_id: str) -> Path:
        return self._sessions_dir / girl_id / "sessions"

    def _get_current_session_file(self, girl_id: str) -> Path:
        """获取当前女生的当前session文件（最新的那个）"""
        sessions_dir = self._girl_sessions_dir(girl_id)
        if not sessions_dir.exists():
            sessions_dir.mkdir(parents=True, exist_ok=True)

        # 找最新的 session 文件
        session_files = sorted(sessions_dir.glob("*.jsonl"))
        if session_files:
            return session_files[-1]

        # 没有就新建一个
        return self.create_new_session(girl_id)

    def create_new_session(self, girl_id: str) -> Path:
        """为女生新建一个session，旧的保留"""
        sessions_dir = self._girl_sessions_dir(girl_id)
        sessions_dir.mkdir(parents=True, exist_ok=True)

        session_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        session_file = sessions_dir / f"{session_id}.jsonl"

        # 写入session元信息
        self._append_to_file(session_file, {
            "timestamp": datetime.now().isoformat(),
            "role": "system",
            "type": "session_start",
            "content": f"新建对话 session: {session_id}",
            "session_id": session_id,
        })

        return session_file

    def _append_to_file(self, file_path: Path, record: dict):
        """追加一条记录到JSONL文件"""
        with open(file_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")

    def append_message(
        self,
        girl_id: str,
        role: str,  # "her" | "me" | "system"
        content: str,
        msg_type: str = "text",  # "text" | "image" | "analysis" | "reply_version"
        extra: Optional[dict] = None,
    ):
        """追加一条消息到当前session"""
        session_file = self._get_current_session_file(girl_id)

        record = {
            "timestamp": datetime.now().isoformat(),
            "role": role,
            "type": msg_type,
            "content": content,
        }
        if extra:
            record["extra"] = extra

        self._append_to_file(session_file, record)

    def get_recent_history(
        self,
        girl_id: str,
        n: int = 10,
        include_system: bool = False,
    ) -> List[dict]:
        """获取最近N条对话记录"""
        session_file = self._get_current_session_file(girl_id)

        if not session_file.exists():
            return []

        messages = []
        with open(session_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    record = json.loads(line)
                    # 默认过滤掉 system 的 session_start 记录
                    if record.get("type") == "session_start" and not include_system:
                        continue
                    messages.append(record)
                except json.JSONDecodeError:
                    continue

        return messages[-n:] if len(messages) > n else messages

    def list_sessions(self, girl_id: str) -> List[dict]:
        """列出女生的所有session"""
        sessions_dir = self._girl_sessions_dir(girl_id)
        if not sessions_dir.exists():
            return []

        sessions = []
        for f in sorted(sessions_dir.glob("*.jsonl")):
            sessions.append({
                "session_id": f.stem,
                "file": str(f),
                "created": datetime.fromtimestamp(f.stat().st_ctime).isoformat(),
            })
        return sessions

    def get_session_messages(self, girl_id: str, session_id: str) -> List[dict]:
        """获取指定session的所有消息"""
        session_file = self._girl_sessions_dir(girl_id) / f"{session_id}.jsonl"

        if not session_file.exists():
            return []

        messages = []
        with open(session_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    messages.append(json.loads(line))
                except json.JSONDecodeError:
                    continue

        return messages


chat_history = ChatHistoryManager()
