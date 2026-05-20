import json
import os
from pathlib import Path
from datetime import datetime
from typing import Any, Optional

from app.config import DATA_DIR


class StorageManager:
    """纯文件存储管理器。所有数据都是JSON/JSONL，支持cat/grep直接查看。"""

    @staticmethod
    def ensure_dirs():
        """创建所有必要目录"""
        dirs = [
            DATA_DIR / "user",
            DATA_DIR / "girls",
        ]
        for d in dirs:
            d.mkdir(parents=True, exist_ok=True)

    # ---------- JSON ----------

    @staticmethod
    def read_json(path: Path) -> Optional[dict]:
        if not path.exists():
            return None
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    @staticmethod
    def write_json(path: Path, data: dict):
        """原子写入：先写临时文件再重命名，防止写入中断导致文件损坏"""
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp_path = path.with_suffix(".tmp")
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")
        tmp_path.replace(path)

    # ---------- JSONL ----------

    @staticmethod
    def append_jsonl(path: Path, record: dict):
        """追加写入JSONL（线程安全在单进程下）"""
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")

    @staticmethod
    def read_jsonl(path: Path, limit: Optional[int] = None) -> list[dict]:
        """读取JSONL，支持限制条数"""
        if not path.exists():
            return []
        records = []
        with open(path, "r", encoding="utf-8") as f:
            for i, line in enumerate(f):
                if limit and i >= limit:
                    break
                line = line.strip()
                if line:
                    try:
                        records.append(json.loads(line))
                    except json.JSONDecodeError:
                        continue
        return records

    @staticmethod
    def read_jsonl_reverse(path: Path, limit: int = 20) -> list[dict]:
        """倒序读取最近N条"""
        if not path.exists():
            return []
        from collections import deque
        records = deque(maxlen=limit)
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        records.append(json.loads(line))
                    except json.JSONDecodeError:
                        continue
        return list(records)

    # ---------- 路径生成器 ----------

    @staticmethod
    def user_profile_path() -> Path:
        return DATA_DIR / "user" / "profile.json"

    @staticmethod
    def girl_dir(girl_id: str) -> Path:
        return DATA_DIR / "girls" / girl_id

    @staticmethod
    def girl_profile_path(girl_id: str) -> Path:
        return StorageManager.girl_dir(girl_id) / "profile.json"

    @staticmethod
    def girl_history_path(girl_id: str) -> Path:
        return StorageManager.girl_dir(girl_id) / "history.jsonl"

    @staticmethod
    def girl_screenshot_dir(girl_id: str) -> Path:
        d = StorageManager.girl_dir(girl_id) / "screenshots"
        d.mkdir(parents=True, exist_ok=True)
        return d

    # ---------- Girl ID 生成 ----------

    @staticmethod
    def generate_girl_id(name: str) -> str:
        """生成女生ID：girl_序号_名字拼音/中文"""
        girls_dir = DATA_DIR / "girls"
        existing = [d.name for d in girls_dir.iterdir() if d.is_dir() and d.name.startswith("girl_")]
        max_idx = 0
        for d in existing:
            try:
                idx = int(d.split("_")[1])
                max_idx = max(max_idx, idx)
            except (IndexError, ValueError):
                continue
        return f"girl_{max_idx + 1:03d}_{name}"

    @staticmethod
    def list_girls() -> list[dict]:
        """列出所有女生档案"""
        girls_dir = DATA_DIR / "girls"
        if not girls_dir.exists():
            return []
        girls = []
        for d in sorted(girls_dir.iterdir()):
            if d.is_dir():
                profile = StorageManager.read_json(d / "profile.json")
                if profile:
                    girls.append(profile)
        return girls
