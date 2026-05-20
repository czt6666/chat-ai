import re
from pathlib import Path
from typing import List, Dict

from app.config import BASE_DIR

# data 目录在项目根目录下（backend 的父目录）
_DATA_DIR = BASE_DIR.parent / "data"
_SCENE_FILE = _DATA_DIR / "凡哥_场景归纳.txt"
_PERSONA_FILE = _DATA_DIR / "凡哥_人格总结.txt"


def _parse_scenes(text: str) -> Dict[str, Dict[str, str]]:
    """解析凡哥场景归纳文件"""
    scenes = {}
    # 按 --- 分割场景块
    blocks = re.split(r'\n---\s*\n', text)
    for block in blocks:
        block = block.strip()
        if not block:
            continue

        scene = {}
        lines = block.split("\n")
        current_key = None
        current_value = []

        for line in lines:
            line = line.rstrip()
            if not line:
                continue

            # 检测新 key：包含中文冒号，且不是列表项开头
            is_list_item = line.startswith("- ") or (len(line) > 2 and line[0].isdigit() and line[1] == ".")
            if "：" in line and not is_list_item:
                parts = line.split("：", 1)
                key = parts[0].strip()
                val = parts[1].strip() if len(parts) > 1 else ""

                if current_key:
                    scene[current_key] = "\n".join(current_value).strip()

                current_key = key
                current_value = [val] if val else []
            else:
                if current_key:
                    current_value.append(line.strip())

        if current_key:
            scene[current_key] = "\n".join(current_value).strip()

        if "场景ID" in scene:
            scenes[scene["场景ID"]] = scene

    return scenes


class KnowledgeBase:
    """凡哥知识库：从 data/ 目录加载人格 + 场景策略"""

    def __init__(self):
        self._persona = self._load_persona()
        self._scenes = self._load_scenes()

    def _load_persona(self) -> str:
        if _PERSONA_FILE.exists():
            return _PERSONA_FILE.read_text(encoding="utf-8")
        return ""

    def _load_scenes(self) -> Dict[str, Dict[str, str]]:
        if _SCENE_FILE.exists():
            return _parse_scenes(_SCENE_FILE.read_text(encoding="utf-8"))
        return {}

    def get_persona(self) -> str:
        """加载凡哥恋爱大师人格描述"""
        return self._persona

    def get_scene_summary_for_parser(self) -> str:
        """为识图 System Prompt 生成场景列表（ID + 名称 + 描述 + 触发条件）"""
        lines = []
        for sid, scene in self._scenes.items():
            name = scene.get("场景名称", "")
            desc = scene.get("一句话描述", "")
            triggers = scene.get("触发条件", "")
            lines.append(f"- {sid}：{name}（{desc}）")
            if triggers:
                lines.append(f"  触发：{triggers.replace(chr(10), ' / ')}")
        return "\n".join(lines) if lines else "（暂无场景数据）"

    def get_scene_detail(self, scene_tag: str) -> str:
        """为回复 User Prompt 生成单个场景的完整策略"""
        scene = self._scenes.get(scene_tag)
        if not scene:
            return ""
        parts = [
            f"【场景：{scene.get('场景名称', '')}】",
            f"触发：{scene.get('触发条件', '')}",
            f"策略：{scene.get('策略', '')}",
            f"话术：{scene.get('话术', '')}",
            f"逻辑：{scene.get('逻辑', '')}",
            f"禁忌：{scene.get('禁忌', '')}",
        ]
        return "\n".join(parts)

    def get_scenes(self, scene_tags: List[str]) -> str:
        """根据场景标签列表，加载对应的详细策略文本"""
        parts = []
        for tag in scene_tags:
            detail = self.get_scene_detail(tag)
            if detail:
                parts.append(detail)
        return "\n\n".join(parts) if parts else "（暂无匹配的策略）"

    def list_all_scenes(self) -> List[Dict[str, str]]:
        """列出所有可用场景"""
        result = []
        for sid, scene in self._scenes.items():
            result.append({"tag": sid, "name": scene.get("场景名称", sid)})
        return result


knowledge_base = KnowledgeBase()
