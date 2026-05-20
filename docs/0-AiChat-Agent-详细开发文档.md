# AiChat Agent 详细开发文档

> 版本：v1.1 | 日期：2026-05-19
> 变更：放弃SQLite，全面采用文件存储（JSON/JSONL/Markdown），支持grep/cat直接查看和修改

---

## 目录

1. [存储架构设计](#一存储架构设计)
2. [开发Phase详细分解](#二开发phase详细分解)
3. [后端架构与接口定义](#三后端架构与接口定义)
4. [前端页面布局](#四前端页面布局)
5. [记忆系统实现细节](#五记忆系统实现细节)
6. [Prompt工程细节](#六prompt工程细节)
7. [部署方案](#七部署方案)

---

## 一、存储架构设计

### 1.1 为什么放弃SQLite？

你提了一个很实际的问题：**SQLite查起来太费劲，想经常看历史数据**。

SQLite的问题是：
- 需要工具（DB Browser/sqlite3命令行）才能查看
- 数据藏在二进制文件里，不方便手动修改
- 向量扩展（sqlite-vec）是C扩展，部署可能踩坑

**新方案：纯文件存储**

| 数据类型 | 格式 | 查看方式 | 修改方式 |
|---------|------|---------|---------|
| 用户画像 | JSON | `cat data/user/profile.json` | 任意文本编辑器 |
| 女生档案 | JSON | `cat data/girls/{id}/profile.json` | 任意文本编辑器 |
| 历史对话 | JSONL | `cat`/`tail`/`grep` | 追加写，不破坏已有数据 |
| 向量索引 | Annoy二进制 | Python脚本导出 | 自动重建 |
| 复盘报告 | Markdown | `cat`/`less` | 任意文本编辑器 |
| 凡哥知识库 | JSON | `cat` | 我帮你维护 |

### 1.2 目录结构

```
ai-chat-agent/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── models/
│   │   ├── routers/
│   │   ├── services/
│   │   ├── prompts/
│   │   └── utils/
│   ├── data/                          # 所有数据存在这里
│   │   ├── user/
│   │   │   └── profile.json
│   │   ├── girls/
│   │   │   ├── girl_001_小雨/
│   │   │   │   ├── profile.json       # 女生档案
│   │   │   │   ├── vectors/           # 向量索引
│   │   │   │   │   └── index.ann
│   │   │   │   ├── history/           # 历史对话，按月分文件
│   │   │   │   │   ├── 2026-04.jsonl
│   │   │   │   │   └── 2026-05.jsonl
│   │   │   │   ├── screenshots/       # 原始截图
│   │   │   │   │   ├── 20260518_213015.png
│   │   │   │   │   └── 20260519_103022.png
│   │   │   │   └── reports/           # 复盘报告
│   │   │   │       └── 20260520_chat_review.md
│   │   │   └── girl_002_安娜/
│   │   │       └── ...
│   │   └── knowledge_base.json        # 凡哥知识库
│   └── requirements.txt
├── frontend/
│   └── src/
└── docker-compose.yml
```

### 1.3 JSON Lines 格式说明

`history/2026-05.jsonl` 的每一行是一条完整JSON：

```json
{"timestamp": "2026-05-18T21:30:15", "type": "screenshot_chat", "extracted_text": "她：今天好累啊 加班到十点", "emotion_tag": "疲惫+求安慰", "my_reply_versions": {"conservative": "辛苦了", "balanced": "这么惨 那我请你喝奶茶回血？", "aggressive": "看来某人需要专属按摩服务了"}, "chosen_version": "balanced", "effect": "她回了一个笑哭表情+好啊", "embedding_id": 15}
```

**查看方式**：
```bash
# 看最近5条
tail -n 5 data/girls/girl_001_小雨/history/2026-05.jsonl

# 搜包含"加班"的记录
grep "加班" data/girls/girl_001_小雨/history/2026-05.jsonl

# 格式化查看最近一条（需要jq）
tail -n 1 data/girls/girl_001_小雨/history/2026-05.jsonl | python -m json.tool
```

### 1.4 向量索引（Annoy）

用 **Annoy**（Spotify开源）做向量检索：
- 纯Python，pip安装即可
- 每个女生一个`.ann`索引文件
- 检索速度：毫秒级
- 支持定期保存和加载

**为什么不用FAISS？** FAISS虽然更快，但需要编译C++，Windows上安装麻烦。Annoy纯Python，部署零成本。

---

## 二、开发Phase详细分解

每个Phase的格式：**目标 → 具体任务（逐条）→ 产出文件 → 验收标准**

---

### Phase 1: 基础架构搭建（Week 1）

#### 目标
搭建可运行的前后端骨架，实现文件上传API，配置好数据目录结构，确保后续开发有坚实基础。

#### 任务列表

- [ ] **1.1 初始化后端项目**
  - 创建FastAPI项目结构（`backend/app/`下各目录）
  - 写`requirements.txt`（fastapi, uvicorn, python-multipart, pillow, annoy, openai, anthropic, pydantic）
  - 写`backend/app/config.py`，从环境变量读取API Keys
  - 写`backend/app/main.py`，注册所有路由，配置CORS

- [ ] **1.2 初始化前端项目**
  - `npm create vite@latest frontend -- --template react-ts`
  - 安装依赖（react-router-dom, axios, tailwindcss, @heroicons/react）
  - 配置TailwindCSS
  - 配置PWA（`vite-plugin-pwa`）
  - 写基础布局组件（Layout, Header, BottomNav）

- [ ] **1.3 设计并实现数据模型**
  - `backend/app/models/user.py`：UserProfile Pydantic模型
  - `backend/app/models/girl.py`：GirlProfile Pydantic模型
  - `backend/app/models/chat.py`：ChatRecord Pydantic模型
  - `backend/app/models/response.py`：ReplyResponse Pydantic模型

- [ ] **1.4 实现文件存储工具类**
  - `backend/app/utils/storage.py`：
    - `ensure_data_dirs()`：创建所有数据目录
    - `read_json(path)` / `write_json(path, data)`：读写JSON
    - `append_jsonl(path, record)`：追加JSONL
    - `read_jsonl(path, limit=None)`：读取JSONL，支持限制条数
    - `list_jsonl(path)`：读取整个jsonl为list
  - 写单元测试验证工具函数

- [ ] **1.5 实现文件上传API**
  - `POST /api/upload`
  - 接收multipart/form-data，保存到指定目录
  - 返回文件访问URL

- [ ] **1.6 创建示例数据**
  - `data/user/profile.json`：放你的初始画像（先用占位数据）
  - `data/girls/girl_001_示例/profile.json`：示例女生档案

#### 产出文件
```
backend/app/main.py
backend/app/config.py
backend/app/models/*.py
backend/app/utils/storage.py
frontend/src/App.tsx
frontend/src/components/Layout.tsx
frontend/vite.config.ts (含PWA配置)
data/user/profile.json
data/girls/girl_001_示例/profile.json
```

#### 验收标准
1. `cd backend && uvicorn app.main:app --reload` 能启动，Swagger文档（`/docs`）可访问
2. `cd frontend && npm run dev` 能启动，手机浏览器访问能看到基础布局
3. 用curl或Postman测试文件上传API，能成功保存文件到data目录
4. `storage.py`的单元测试全部通过

---

### Phase 2: 核心聊天功能（Week 2）

#### 目标
实现"上传截图 → 解析内容 → 检索记忆 → 生成3版本回复 → 展示结果"的完整闭环。

#### 任务列表

- [ ] **2.1 实现截图解析服务**
  - `backend/app/services/image_parser.py`
  - 函数 `parse_screenshot(image_path: str, girl_id: str) -> ParsedScreenshot`
  - 调用GPT-4o-mini（多模态），要求返回结构化JSON：
    ```json
    {
      "extracted_text": "她：今天好累啊\n你：辛苦了早点休息\n她：嗯",
      "her_last_message": "嗯",
      "emotion_tag": "敷衍/冷淡",
      "meta_info": {
        "time_between_replies": "5分钟",
        "message_length_ratio": "1:3",
        "has_emoji": false,
        "screenshot_platform": "微信"
      }
    }
    ```

- [ ] **2.2 实现向量编码服务**
  - `backend/app/utils/embeddings.py`
  - 函数 `encode_text(text: str) -> list[float]`
  - 调用OpenAI `text-embedding-3-small`（1536维）
  - 实现缓存：相同文本不重复调用API

- [ ] **2.3 实现Annoy向量索引**
  - `backend/app/utils/vector_index.py`
  - 类 `GirlVectorIndex`：
    - `__init__(girl_id)`：加载或创建索引
    - `add_item(id, vector, metadata)`：添加向量
    - `search(query_vector, k=5)`：检索最相似的k条
    - `save()`：保存到磁盘
    - `build()`：重建索引树
  - 每个女生独立一个Annoy索引

- [ ] **2.4 实现记忆检索服务**
  - `backend/app/services/memory_engine.py`
  - 函数 `retrieve_memories(girl_id: str, query: str, top_k: int = 5) -> list[MemoryRecord]`
  - 步骤：编码query → 搜索Annoy → 读取对应历史记录 → 格式化返回

- [ ] **2.5 设计核心Prompt**
  - `backend/app/prompts/system_prompt.py`：System Prompt模板
  - `backend/app/prompts/reply_prompt.py`：回复生成Prompt模板
  - 实现Prompt组装函数 `build_reply_prompt(user, girl, current, memories, knowledge)`

- [ ] **2.6 实现回复生成服务**
  - `backend/app/services/reply_generator.py`
  - 函数 `generate_reply(prompt: str) -> ReplyResult`
  - 调用Claude 4 Sonnet，要求JSON Mode输出
  - 处理API错误（超时、格式错误等）

- [ ] **2.7 实现聊天API**
  - `POST /api/girls/{girl_id}/chat`
  - Request：multipart（image必传，可选text备注）
  - Response：
    ```json
    {
      "request_id": "req_001",
      "emotion_tag": "疲惫+求安慰",
      "window_analysis": "...",
      "reply_strategy": "...",
      "versions": {
        "conservative": "辛苦了",
        "balanced": "这么惨 那我请你喝奶茶回血？",
        "aggressive": "看来某人需要专属按摩服务了"
      },
      "recommended": "balanced",
      "related_memories": ["3天前她也说加班累...", "1周前她分享周杰伦..."]
    }
    ```
  - 内部流程：保存截图 → 解析 → 检索记忆 → 组装Prompt → 生成回复 → 存储记录 → 返回结果

- [ ] **2.8 前端：聊天页面**
  - `frontend/src/pages/Chat.tsx`
  - 布局：顶部女生名称 | 中间上传区域+结果展示 | 底部导航
  - 上传组件：支持拍照/相册选择（HTML5 input capture）
  - 结果展示：情绪标签（彩色badge）+ 思路分析（可折叠）+ 三个版本（卡片式）+ 复制按钮
  - 交互：点击版本卡片自动复制到剪贴板

- [ ] **2.9 前端：首页（女生选择）**
  - `frontend/src/pages/Home.tsx`
  - 展示所有女生卡片（头像+名字+关系阶段+最近聊天时间）
  - 点击卡片进入聊天页
  - "+"按钮创建新女生档案

#### 产出文件
```
backend/app/services/image_parser.py
backend/app/services/memory_engine.py
backend/app/services/reply_generator.py
backend/app/utils/embeddings.py
backend/app/utils/vector_index.py
backend/app/prompts/system_prompt.py
backend/app/prompts/reply_prompt.py
backend/app/routers/chat.py
frontend/src/pages/Home.tsx
frontend/src/pages/Chat.tsx
frontend/src/components/UploadArea.tsx
frontend/src/components/ReplyCard.tsx
```

#### 验收标准
1. 手机上传一张微信聊天截图，10秒内返回情绪标签+3个版本回复
2. 3个版本有明显差异（保守平淡/平衡有情绪/激进带推进）
3. 每条记录自动保存到`history/YYYY-MM.jsonl`
4. 连续聊5轮后，第6轮能检索到相关的历史记忆

---

### Phase 3: 记忆系统与档案管理（Week 3）

#### 目标
让Agent真正"记住"东西：自动更新女生档案、自动摘要历史、档案页面可查看编辑。

#### 任务列表

- [ ] **3.1 实现档案自动更新**
  - `backend/app/services/profile_updater.py`
  - 函数 `update_girl_profile_after_chat(girl_id: str, chat_record: ChatRecord)`
  - 触发时机：每次聊天后异步执行
  - 更新逻辑：
    - 关系阶段判断：基于聊天内容，用轻量级规则或LLM调用判断是否需要升级阶段
    - 态度趋势：基于她回复的字数、表情、速度计算趋势分数
    - 事件摘要：用LLM提炼本次聊天的关键事件（1句话）
    - 雷区发现：如果某次回复后她明显冷淡，记录下来
  - 规则：每次更新前备份旧档案到`profile.json.bak`

- [ ] **3.2 实现用户画像页面**
  - `frontend/src/pages/UserProfile.tsx`
  - 表单字段：年龄、职业、MBTI、说话风格、口头禅、改进目标
  - 支持编辑保存
  - API：`GET/PUT /api/user/profile`

- [ ] **3.3 实现女生档案页面**
  - `frontend/src/pages/GirlProfile.tsx`
  - 展示：基础信息、性格标签、关系阶段时间线、兴趣/雷区、最近事件摘要
  - 支持编辑基础信息和标签
  - API：`GET /api/girls/{girl_id}`、`PUT /api/girls/{girl_id}`

- [ ] **3.4 实现女生创建/编辑API**
  - `POST /api/girls`：创建新女生档案
  - `PUT /api/girls/{girl_id}`：更新档案
  - `DELETE /api/girls/{girl_id}`：删除（连同所有历史数据）
  - `GET /api/girls`：列出所有女生

- [ ] **3.5 实现历史记录页面**
  - `frontend/src/pages/History.tsx`
  - 按时间倒序展示所有聊天记录
  - 筛选：按日期、按女生、按情绪标签
  - 每条记录可展开查看详情（截图+解析结果+3版本）
  - API：`GET /api/girls/{girl_id}/history?limit=20&offset=0`

- [ ] **3.6 实现历史数据迁移/重建**
  - `backend/app/utils/rebuild_index.py`
  - 脚本：读取所有历史JSONL，重新生成Annoy索引
  - 用途：索引损坏时恢复、调整embedding维度时重建

#### 产出文件
```
backend/app/services/profile_updater.py
backend/app/routers/girls.py
backend/app/routers/user.py
backend/app/routers/history.py
backend/app/utils/rebuild_index.py
frontend/src/pages/UserProfile.tsx
frontend/src/pages/GirlProfile.tsx
frontend/src/pages/History.tsx
frontend/src/components/GirlCard.tsx
frontend/src/components/EventTimeline.tsx
```

#### 验收标准
1. 连续和同一个女生聊3天后，她的档案里自动出现"关系阶段"变化和"事件摘要"
2. 在历史页面能看到按时间排序的所有记录，筛选功能正常
3. 手动编辑女生档案（比如添加一个雷区），保存后下次生成回复会遵守这个新雷区
4. 运行重建索引脚本，能在1分钟内完成重建

---

### Phase 4: 凡哥知识库与扩展功能（Week 4）

#### 目标
接入凡哥恋爱技巧，实现聊天复盘、女生类型分析、每日一句。

#### 任务列表

- [ ] **4.1 构建凡哥知识库**
  - 你提供素材后，我帮你蒸馏成`data/knowledge_base.json`
  - 结构：按场景分类，每条包含策略、示例、适用阶段
  - `backend/app/services/knowledge_base.py`：
    - `load_knowledge()`：加载知识库
    - `search_knowledge(scene: str, girl_stage: str) -> list[KnowledgeItem]`
    - 实现：关键词匹配 + 轻量级向量检索

- [ ] **4.2 集成知识库到回复流程**
  - 修改`reply_generator.py`，在组装Prompt前检索凡哥知识
  - Prompt中增加`【凡哥策略】`段落

- [ ] **4.3 实现聊天复盘功能**
  - `frontend/src/pages/Analysis.tsx`（复盘Tab）
  - 用户上传完整聊天记录截图（多张）
  - 后端：`POST /api/analysis/chat-review`
    - 解析所有截图，按时间排序
    - 分析：每轮对话谁主动、话题延续性、情绪变化、关键转折点
    - 输出Markdown报告：
      - "聊得好的地方"
      - "聊崩了的地方"
      - "她的态度变化曲线"
      - "下一步建议"
  - 保存报告到`reports/{timestamp}_chat_review.md`

- [ ] **4.4 实现女生类型分析**
  - `frontend/src/pages/Analysis.tsx`（类型分析Tab）
  - 输入方式：文字描述 或 上传朋友圈/抖音主页截图
  - 后端：`POST /api/analysis/girl-type`
    - 解析输入内容
    - 生成类型判断：恋爱脑/事业型/慢热型/猫系/犬系/ etc.
    - 输出：类型标签 + 性格分析 + 针对性策略建议 + 雷区预警
  - 结果可一键保存到女生档案

- [ ] **4.5 实现每日一句**
  - `backend/app/services/daily_tip.py`
  - 从凡哥知识库中随机抽取一条金句/技巧
  - API：`GET /api/daily-tip`
  - 前端：首页顶部展示当日金句卡片
  - 可配置推送（可选，需要浏览器Notification API）

- [ ] **4.6 实现收藏夹**
  - `frontend/src/components/FavoriteButton.tsx`
  - API：`POST /api/girls/{girl_id}/favorites`
  - 存储：在女生档案中增加`favorites`数组
  - 页面：在历史记录中可收藏，在女生档案页可查看收藏列表

#### 产出文件
```
data/knowledge_base.json
backend/app/services/knowledge_base.py
backend/app/services/daily_tip.py
backend/app/routers/analysis.py
frontend/src/pages/Analysis.tsx
frontend/src/components/DailyTipCard.tsx
frontend/src/components/FavoriteButton.tsx
```

#### 验收标准
1. 上传一张"女生说累了"的截图，回复中能看到凡哥策略的引用
2. 上传5张连续聊天记录，复盘报告能在20秒内生成，且分析到位
3. 上传女生朋友圈截图，类型分析结果合理，保存到档案后下次聊天会参考
4. 每日一句功能正常，金句有实用性

---

### Phase 5: 部署与优化（Week 5）

#### 目标
部署到服务器，手机端体验优化，做好分享给兄弟的准备。

#### 任务列表

- [ ] **5.1 Docker化**
  - 写`backend/Dockerfile`（Python slim镜像）
  - 写`frontend/Dockerfile`（Nginx静态文件）
  - 写`docker-compose.yml`：backend + frontend + 共享data卷
  - 配置Nginx反向代理（frontend → /, backend → /api）

- [ ] **5.2 服务器部署**
  - 准备环境变量文件（`.env`）
  - 部署脚本：`deploy.sh`
  - SSL证书（Let's Encrypt + certbot）
  - 域名配置（如果你有域名）

- [ ] **5.3 手机端体验优化**
  - PWA配置：manifest.json、service worker、添加到主屏幕图标
  - 响应式布局：TailwindCSS断点优化（移动端优先）
  - 拍照上传优化：`input type="file" accept="image/*" capture="environment"`
  - 复制按钮优化：移动端复制到剪贴板
  - 加载状态：骨架屏、上传进度条

- [ ] **5.4 性能优化**
  - 图片压缩：上传前用canvas压缩截图（减少传输和API成本）
  - API缓存：相同截图的解析结果缓存5分钟
  - 索引预热：启动时预加载所有女生的Annoy索引到内存
  - 前端懒加载：历史记录分页加载

- [ ] **5.5 多用户隔离（预留）**
  - 虽然当前是你一个人用，但为"分享给兄弟"预留架构
  - 在API路由中增加`X-User-ID` Header（当前固定为"default"）
  - 数据路径从`data/`改为`data/users/{user_id}/`
  - 注册/登录页面（最简单版本：密码保护）

- [ ] **5.6 监控与日志**
  - 后端日志：用Python `logging`，按天轮转
  - API调用统计：记录每个模型的调用次数和费用
  - 错误报警：异常时记录堆栈

#### 产出文件
```
backend/Dockerfile
frontend/Dockerfile
docker-compose.yml
nginx.conf
deploy.sh
frontend/public/manifest.json
frontend/public/sw.js
backend/app/utils/logger.py
backend/app/utils/cost_tracker.py
```

#### 验收标准
1. 手机Safari打开网页，点击"添加到主屏幕"，图标正常，打开体验像原生App
2. 从拍照上传到看到回复，总耗时不超过15秒
3. Docker Compose一键启动，无报错
4. 部署后外网可访问，SSL证书有效

---

## 三、后端架构与接口定义

### 3.1 服务架构图

```
用户请求
   │
   ▼
┌─────────────┐
│   Router    │  ← 路由层：参数校验、权限检查
│   (FastAPI) │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Service   │  ← 业务层： orchestrate 多个工具
│   Layer     │
└──────┬──────┘
       │
   ┌───┴───┐
   ▼       ▼
┌──────┐ ┌────────┐
│Parser│ │ Memory │
│Engine│ │ Engine │
└──┬───┘ └───┬────┘
   │         │
   ▼         ▼
┌──────┐ ┌────────┐
│ LLM  │ │ Vector │
│ APIs │ │ Index  │
└──────┘ └────────┘
   │
   ▼
┌─────────────┐
│   Storage   │  ← 文件系统（JSON/JSONL/Markdown）
│   Layer     │
└─────────────┘
```

### 3.2 接口详细定义

#### 3.2.1 用户画像

**获取用户画像**
```
GET /api/user/profile
```

Response `200`:
```json
{
  "user_id": "default",
  "basic_info": {
    "age": 26,
    "occupation": "互联网产品经理",
    "location": "北京",
    "mbti": "INTJ"
  },
  "personality": {
    "traits": ["逻辑性强", "不太会开玩笑", "偏内向"],
    "chat_style": "直男风，话少，喜欢用句号",
    "common_phrases": ["确实", "有道理", "哈哈"],
    "emoji_habits": "很少用表情"
  },
  "values": {
    "relationship_view": "认真谈恋爱",
    "communication_preference": "直接了当"
  },
  "improvement_goals": ["学会幽默", "敢于推进关系"]
}
```

**更新用户画像**
```
PUT /api/user/profile
Content-Type: application/json
```

Request Body: 同上结构

Response `200`: 更新后的完整profile

---

#### 3.2.2 女生档案管理

**列出所有女生**
```
GET /api/girls
```

Response `200`:
```json
{
  "girls": [
    {
      "girl_id": "girl_001",
      "name": "小雨",
      "current_stage": "暧昧期",
      "last_contact": "2026-05-18T21:30:00",
      "screenshots_count": 23,
      "attitude_trend": "上升"
    }
  ]
}
```

**创建女生档案**
```
POST /api/girls
Content-Type: application/json
```

Request Body:
```json
{
  "name": "小雨",
  "basic_info": {
    "age": 24,
    "occupation": "设计师",
    "source": "探探"
  },
  "personality_analysis": {
    "tags": ["猫系", "慢热"]
  }
}
```

Response `201`: 创建的完整档案（含自动生成的girl_id）

**获取女生档案**
```
GET /api/girls/{girl_id}
```

Response `200`: 完整的GirlProfile

**更新女生档案**
```
PUT /api/girls/{girl_id}
```

Request Body: GirlProfile的部分字段（支持部分更新）

Response `200`: 更新后的完整档案

**删除女生档案**
```
DELETE /api/girls/{girl_id}
```

Response `204`

---

#### 3.2.3 核心聊天

**发送截图获取回复**
```
POST /api/girls/{girl_id}/chat
Content-Type: multipart/form-data
```

Request Body:
```
image: (file) 截图文件，必传
text_note: (string) 文字备注，选传，比如"她前面还发了一个表情包"
```

Response `200`:
```json
{
  "request_id": "req_20260519_001",
  "parsed": {
    "extracted_text": "她：今天好累啊 加班到十点",
    "her_last_message": "今天好累啊 加班到十点",
    "emotion_tag": "疲惫+轻微求安慰",
    "meta_info": {
      "reply_speed": "正常",
      "has_emoji": false,
      "platform": "微信"
    }
  },
  "window_analysis": "她在释放脆弱面，是提供情绪价值的好机会",
  "reply_strategy": "先共情，再轻微调侃，不要给解决方案",
  "versions": {
    "conservative": "辛苦了 早点休息",
    "balanced": "这么惨 那我请你喝奶茶回血？",
    "aggressive": "看来某人需要专属按摩服务了 我手法还不错"
  },
  "recommended": "balanced",
  "recommended_reason": "暧昧期适合用关心+轻微邀约试探，不push",
  "related_memories": [
    {
      "date": "2026-05-15",
      "summary": "她也说过加班累，你回'辛苦了'，她只回'嗯'，效果不好"
    },
    {
      "date": "2026-05-10",
      "summary": "你约她周末看展，她说'看安排'，态度犹豫"
    }
  ],
  "knowledge_refs": [
    {
      "scene": "女生说累了",
      "strategy": "共情+调侃+创造见面机会",
      "source": "凡哥恋爱宝典"
    }
  ],
  "usage": {
    "prompt_tokens": 1523,
    "completion_tokens": 289,
    "model": "claude-sonnet-4-6",
    "cost_cny": 0.12
  }
}
```

**反馈本次效果（用于学习优化）**
```
POST /api/girls/{girl_id}/chat/{request_id}/feedback
Content-Type: application/json
```

Request Body:
```json
{
  "chosen_version": "balanced",
  "effect": "很好",
  "her_response": "她回了一个笑哭表情+好啊",
  "notes": "这个版本刚好，既不舔又有邀约"
}
```

Response `200`

---

#### 3.2.4 历史记录

**获取历史记录**
```
GET /api/girls/{girl_id}/history?limit=20&offset=0&start_date=&end_date=
```

Response `200`:
```json
{
  "total": 156,
  "records": [
    {
      "timestamp": "2026-05-18T21:30:15",
      "type": "screenshot_chat",
      "extracted_text": "她：今天好累啊...",
      "emotion_tag": "疲惫+求安慰",
      "versions": {"conservative": "...", "balanced": "...", "aggressive": "..."},
      "chosen_version": "balanced",
      "effect": "她回了一个笑哭表情+好啊",
      "screenshot_path": "data/girls/girl_001/screenshots/20260518_213015.png"
    }
  ]
}
```

---

#### 3.2.5 分析功能

**聊天复盘**
```
POST /api/analysis/chat-review
Content-Type: multipart/form-data
```

Request Body:
```
images[]: (files) 多张聊天记录截图，按时间顺序上传
girl_id: (string) 女生ID
```

Response `200`:
```json
{
  "report_id": "report_001",
  "summary": "整体聊天节奏不错，但第3轮过于理性",
  "strengths": ["主动开启话题", "懂得关心"],
  "weaknesses": ["她分享情绪时你给了建议而不是共情", "邀约太直接没有铺垫"],
  "attitude_curve": [
    {"round": 1, "score": 6, "label": "平淡"},
    {"round": 2, "score": 8, "label": "升温"},
    {"round": 3, "score": 4, "label": "降温"},
    {"round": 4, "score": 7, "label": "回升"}
  ],
  "recommendations": [
    "下次她说工作烦恼时，先说'确实挺烦的'，再给建议",
    "邀约前加一句'最近发现个地方挺适合你'，降低需求感"
  ],
  "report_path": "data/girls/girl_001/reports/20260520_chat_review.md"
}
```

**女生类型分析**
```
POST /api/analysis/girl-type
Content-Type: multipart/form-data 或 application/json
```

Request Body (二选一):
```json
{
  "girl_id": "girl_001",
  "description": "她平时朋友圈都是工作和健身，很少发感情相关内容，聊天时回复比较慢但字数多",
  "screenshots": []  // 可选，上传朋友圈截图
}
```

Response `200`:
```json
{
  "type_tags": ["事业型", "慢热", "独立"],
  "confidence": 0.85,
  "analysis": "她的社交展示以工作成就为主...",
  "strategy": {
    "dos": ["展示你的上进心和能力", "尊重她的工作节奏"],
    "donts": ["不要查岗", "不要在她忙时轰炸消息"]
  },
  "red_flags": ["前任话题", "催婚", "质疑她的工作能力"]
}
```

---

#### 3.2.6 每日一句

```
GET /api/daily-tip
```

Response `200`:
```json
{
  "date": "2026-05-19",
  "category": "邀约技巧",
  "content": "邀约不要问'周末有空吗'，要说'周末有个展挺适合你的，一起去？'",
  "scene": "暧昧期邀约",
  "source": "凡哥恋爱宝典"
}
```

---

### 3.3 错误码统一规范

| 状态码 | 错误码 | 含义 |
|--------|--------|------|
| 400 | INVALID_IMAGE | 图片格式不支持或损坏 |
| 400 | MISSING_FIELD | 必填字段缺失 |
| 404 | GIRL_NOT_FOUND | 女生ID不存在 |
| 429 | RATE_LIMIT | API调用频率限制（OpenAI/Claude侧） |
| 500 | LLM_ERROR | LLM API调用失败 |
| 500 | PARSE_ERROR | LLM返回格式不符合预期 |

错误响应格式：
```json
{
  "error": {
    "code": "GIRL_NOT_FOUND",
    "message": "女生 girl_999 不存在",
    "detail": null
  }
}
```

---

## 四、前端页面布局

### 4.1 页面路由表

| 路径 | 页面 | 说明 |
|------|------|------|
| `/` | Home | 女生列表首页 |
| `/girls/:girlId/chat` | Chat | 与某个女生的聊天助手 |
| `/girls/:girlId/profile` | GirlProfile | 某个女生的档案 |
| `/girls/:girlId/history` | History | 某个女生的历史记录 |
| `/user/profile` | UserProfile | 我的全局画像 |
| `/analysis` | Analysis | 聊天复盘+类型分析 |
| `/history` | GlobalHistory | 全局历史（所有女生） |

### 4.2 布局结构

#### 全局布局（Layout.tsx）

```
┌─────────────────────────┐
│      Header (固定)       │  ← 页面标题 + 返回按钮
│      高度: 56px          │
├─────────────────────────┤
│                         │
│                         │
│      Main Content       │  ← 页面具体内容，可滚动
│      (flex-1)           │
│                         │
│                         │
├─────────────────────────┤
│    BottomNav (固定)      │  ← 底部Tab导航
│    高度: 64px            │     [首页] [历史] [我]
└─────────────────────────┘
```

#### Home 页面（女生列表）

```
┌─────────────────────────┐
│  💬 AiChat Agent         │
├─────────────────────────┤
│  ┌─────────────────┐    │
│  │  今日金句卡片    │    │  ← DailyTipCard，可左右滑动
│  │  "邀约不要问..."  │    │
│  └─────────────────┘    │
│                         │
│  正在聊天                │
│  ┌─────────────────┐    │
│  │ [头像] 小雨       │    │  ← GirlCard
│  │ 暧昧期 · 昨天     │    │     头像+名字+阶段+最后聊天时间
│  │ 态度: ↑ 上升      │    │
│  └─────────────────┘    │
│  ┌─────────────────┐    │
│  │ [头像] 安娜       │    │
│  │ 熟悉期 · 3天前    │    │
│  └─────────────────┘    │
│                         │
│      [+ 新建档案]        │  ← FloatingActionButton，右下角
│                         │
├─────────────────────────┤
│  [🏠] [📋] [👤]         │
└─────────────────────────┘
```

#### Chat 页面（核心）

```
┌─────────────────────────┐
│  ←  小雨  暧昧期         │
├─────────────────────────┤
│                         │
│  ┌─────────────────┐    │
│  │                 │    │
│  │   UploadArea    │    │  ← 上传区域（无记录时展示）
│  │   📷 点击拍照或   │    │     大按钮，醒目
│  │      选择截图     │    │
│  │                 │    │
│  └─────────────────┘    │
│                         │
│  或者（有记录后）：       │
│                         │
│  ┌─────────────────┐    │
│  │ 😔 疲惫+求安慰    │    │  ← 情绪标签（彩色Badge）
│  └─────────────────┘    │
│  她在释放脆弱面...        │  ← 窗口分析（小字，可折叠）
│                         │
│  💡 回复思路             │  ← 策略说明
│  先共情，再轻微调侃...    │
│                         │
│  ┌─────────────────┐    │
│  │ 🤔 保守版         │    │  ← ReplyCard，左滑查看更多
│  │ 辛苦了 早点休息   │    │     点击选中，自动复制
│  └─────────────────┘    │
│  ┌─────────────────┐    │
│  │ ⭐ 平衡版 (推荐)  │    │  ← 推荐版本高亮（黄色边框）
│  │ 这么惨 那我请你.. │    │
│  └─────────────────┘    │
│  ┌─────────────────┐    │
│  │ 🔥 激进版         │    │
│  │ 看来某人需要...   │    │
│  └─────────────────┘    │
│                         │
│  [📎 相关历史] ▼        │  ← 可展开，展示检索到的历史记忆
│  · 3天前她也说加班...    │
│  · 1周前她分享周杰伦...  │
│                         │
├─────────────────────────┤
│  [🏠] [📋] [👤]         │
└─────────────────────────┘
```

#### GirlProfile 页面

```
┌─────────────────────────┐
│  ←  小雨的档案           │
├─────────────────────────┤
│  [头像占位]              │
│  小雨 · 24岁 · 设计师    │
│  📍北京  📱探探          │
│                         │
│  关系阶段                │
│  ○刚加 → ○熟悉 → ●暧昧   │  ← Timeline组件
│            (5月10日)     │
│  态度趋势: ↑ 上升        │
│                         │
│  性格标签                │
│  [猫系] [慢热] [事业心]   │  ← Tag组件，可编辑
│                         │
│  兴趣                    │
│  🐱猫 ☕咖啡 🎨看展 🎵Jay │
│                         │
│  雷区 ⚠️                 │
│  · 被说教                │
│  · 查岗                  │
│  · 太油腻的撩             │
│                         │
│  最近事件                │
│  · 5/18 约看展她说看安排   │
│  · 5/15 她分享歌你聊得很好 │
│  · 5/10 她提到工作压力大   │
│                         │
│  [编辑档案]              │
├─────────────────────────┤
│  [🏠] [📋] [👤]         │
└─────────────────────────┘
```

#### Analysis 页面（复盘+类型分析）

```
┌─────────────────────────┐
│  📊 智能分析             │
├─────────────────────────┤
│  [聊天复盘] [类型分析]    │  ← Tab切换
│                         │
│  聊天复盘：              │
│  ┌─────────────────┐    │
│  │ 📷 上传聊天记录   │    │  ← 支持多图上传
│  │    (支持多张)    │    │
│  └─────────────────┘    │
│  [开始分析]              │
│                         │
│  （分析结果）            │
│  ┌─────────────────┐    │
│  │ 整体评分: 7/10   │    │
│  │ [评分雷达图]      │    │
│  │ 聊得好的: ...    │    │
│  │ 聊崩的: ...      │    │
│  │ 建议: ...        │    │
│  └─────────────────┘    │
│                         │
│  类型分析：              │
│  [文字描述输入框]         │
│  或 [上传朋友圈截图]       │
│  [分析]                  │
│  → 结果卡片              │
├─────────────────────────┤
│  [🏠] [📋] [👤]         │
└─────────────────────────┘
```

### 4.3 组件清单

| 组件名 | 位置 | 说明 |
|--------|------|------|
| `Layout` | `components/Layout.tsx` | 全局布局（Header + Main + BottomNav） |
| `Header` | `components/Header.tsx` | 顶部栏，支持返回按钮和标题 |
| `BottomNav` | `components/BottomNav.tsx` | 底部Tab导航 |
| `GirlCard` | `components/GirlCard.tsx` | 女生列表卡片 |
| `UploadArea` | `components/UploadArea.tsx` | 截图上传区域，支持拍照和相册 |
| `ReplyCard` | `components/ReplyCard.tsx` | 单条回复版本卡片，点击复制 |
| `EmotionBadge` | `components/EmotionBadge.tsx` | 情绪标签（不同情绪不同颜色） |
| `EventTimeline` | `components/EventTimeline.tsx` | 关系阶段时间线 |
| `TagInput` | `components/TagInput.tsx` | 标签编辑组件（兴趣、雷区等） |
| `DailyTipCard` | `components/DailyTipCard.tsx` | 每日金句卡片 |
| `HistoryItem` | `components/HistoryItem.tsx` | 历史记录单行展示 |
| `FavoriteButton` | `components/FavoriteButton.tsx` | 收藏按钮 |
| `LoadingSkeleton` | `components/LoadingSkeleton.tsx` | 加载骨架屏 |

---

## 五、记忆系统实现细节

### 5.1 类设计

#### 5.1.1 StorageManager（文件存储管理器）

```python
# backend/app/utils/storage.py

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

DATA_DIR = Path(__file__).parent.parent.parent / "data"

class StorageManager:
    """所有文件存储操作的统一入口"""

    @staticmethod
    def ensure_dirs():
        """创建所有必要目录"""
        dirs = [
            DATA_DIR / "user",
            DATA_DIR / "girls",
            DATA_DIR / "knowledge",
        ]
        for d in dirs:
            d.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def read_json(path: Path) -> dict:
        if not path.exists():
            return {}
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    @staticmethod
    def write_json(path: Path, data: dict):
        path.parent.mkdir(parents=True, exist_ok=True)
        # 写入临时文件再重命名，防止写入中断导致文件损坏
        tmp_path = path.with_suffix(".tmp")
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        tmp_path.replace(path)

    @staticmethod
    def append_jsonl(path: Path, record: dict):
        """追加写入JSONL，线程安全（单进程下）"""
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
                    records.append(json.loads(line))
        return records

    @staticmethod
    def read_jsonl_reverse(path: Path, limit: int = 20) -> list[dict]:
        """倒序读取最近N条（高效，不读整个文件）"""
        if not path.exists():
            return []
        # 用deque保持最近limit条
        from collections import deque
        records = deque(maxlen=limit)
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    records.append(json.loads(line))
        return list(records)

    # 路径生成 helper
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
    def girl_history_path(girl_id: str, year_month: str) -> Path:
        return StorageManager.girl_dir(girl_id) / "history" / f"{year_month}.jsonl"

    @staticmethod
    def girl_screenshot_dir(girl_id: str) -> Path:
        return StorageManager.girl_dir(girl_id) / "screenshots"

    @staticmethod
    def girl_vector_path(girl_id: str) -> Path:
        return StorageManager.girl_dir(girl_id) / "vectors" / "index.ann"

    @staticmethod
    def girl_reports_dir(girl_id: str) -> Path:
        return StorageManager.girl_dir(girl_id) / "reports"
```

#### 5.1.2 GirlVectorIndex（Annoy向量索引）

```python
# backend/app/utils/vector_index.py

import os
from pathlib import Path
from typing import Optional
import numpy as np
from annoy import AnnoyIndex

from .storage import StorageManager

EMBEDDING_DIM = 1536  # text-embedding-3-small

class GirlVectorIndex:
    """每个女生一个Annoy索引"""

    def __init__(self, girl_id: str):
        self.girl_id = girl_id
        self.index_path = StorageManager.girl_vector_path(girl_id)
        self.index: Optional[AnnoyIndex] = None
        self.metadata: dict[int, dict] = {}  # id -> memory metadata
        self._next_id = 0
        self._load()

    def _load(self):
        """加载已有索引或创建新索引"""
        self.index_path.parent.mkdir(parents=True, exist_ok=True)
        meta_path = self.index_path.with_suffix(".meta.json")

        if self.index_path.exists():
            self.index = AnnoyIndex(EMBEDDING_DIM, 'angular')
            self.index.load(str(self.index_path))
            if meta_path.exists():
                self.metadata = StorageManager.read_json(meta_path)
                self._next_id = max(self.metadata.keys(), default=-1) + 1
        else:
            self.index = AnnoyIndex(EMBEDDING_DIM, 'angular')
            self._next_id = 0

    def add(self, vector: list[float], meta: dict) -> int:
        """添加一条向量，返回分配的ID"""
        idx = self._next_id
        self.index.add_item(idx, vector)
        self.metadata[idx] = meta
        self._next_id += 1
        return idx

    def search(self, query_vector: list[float], k: int = 5) -> list[dict]:
        """检索最相似的k条，返回metadata列表"""
        if self._next_id == 0:
            return []
        # 如果总数不足k，调整k
        actual_k = min(k, self._next_id)
        ids, distances = self.index.get_nns_by_vector(
            query_vector, actual_k, include_distances=True
        )
        results = []
        for idx, dist in zip(ids, distances):
            meta = self.metadata.get(idx, {})
            meta['_distance'] = float(dist)
            meta['_id'] = idx
            results.append(meta)
        return results

    def build(self, n_trees: int = 10):
        """构建索引树（添加完一批数据后调用）"""
        if self._next_id > 0:
            self.index.build(n_trees)

    def save(self):
        """保存索引和metadata到磁盘"""
        if self._next_id > 0:
            self.index.save(str(self.index_path))
            meta_path = self.index_path.with_suffix(".meta.json")
            StorageManager.write_json(meta_path, self.metadata)

    def rebuild(self, records: list[dict]):
        """完全重建索引（用于数据修复）"""
        self.index = AnnoyIndex(EMBEDDING_DIM, 'angular')
        self.metadata = {}
        self._next_id = 0
        for rec in records:
            if 'embedding' in rec:
                self.add(rec['embedding'], {
                    'timestamp': rec.get('timestamp'),
                    'summary': rec.get('extracted_text', '')[:100]
                })
        self.build()
        self.save()
```

#### 5.1.3 MemoryEngine（记忆检索引擎）

```python
# backend/app/services/memory_engine.py

from datetime import datetime
from typing import Optional

from app.utils.embeddings import encode_text
from app.utils.storage import StorageManager
from app.utils.vector_index import GirlVectorIndex

class MemoryEngine:
    """记忆检索的核心逻辑"""

    def __init__(self, girl_id: str):
        self.girl_id = girl_id
        self.vector_index = GirlVectorIndex(girl_id)

    def retrieve(
        self,
        query: str,
        top_k: int = 5,
        recent_limit: int = 3
    ) -> list[dict]:
        """
        检索相关记忆
        策略：向量检索top_k + 最近recent_limit条（保底）
        """
        # 1. 向量检索
        query_vector = encode_text(query)
        vector_results = self.vector_index.search(query_vector, k=top_k)

        # 2. 读取最近几条历史（短期记忆保底）
        current_ym = datetime.now().strftime("%Y-%m")
        recent_records = StorageManager.read_jsonl_reverse(
            StorageManager.girl_history_path(self.girl_id, current_ym),
            limit=recent_limit
        )
        recent_memories = [
            {
                "source": "recent",
                "timestamp": r.get("timestamp"),
                "summary": r.get("extracted_text", "")[:150],
                "effect": r.get("effect", "")
            }
            for r in recent_records
        ]

        # 3. 合并去重（向量结果可能和最近结果重叠）
        seen_timestamps = set()
        merged = []

        # 优先取向量结果
        for vr in vector_results:
            ts = vr.get('timestamp')
            if ts and ts not in seen_timestamps:
                merged.append({
                    "source": "vector_search",
                    "timestamp": ts,
                    "summary": vr.get('summary', ''),
                    "relevance": 1.0 - vr.get('_distance', 0)  # distance转相似度
                })
                seen_timestamps.add(ts)

        # 补充最近结果
        for rm in recent_memories:
            ts = rm.get('timestamp')
            if ts and ts not in seen_timestamps:
                merged.append(rm)
                seen_timestamps.add(ts)

        return merged[:top_k + recent_limit]

    def store(self, record: dict):
        """存储一条记录到历史并更新向量索引"""
        # 1. 写入JSONL
        current_ym = datetime.now().strftime("%Y-%m")
        history_path = StorageManager.girl_history_path(self.girl_id, current_ym)
        StorageManager.append_jsonl(history_path, record)

        # 2. 更新向量索引
        if 'embedding' in record:
            self.vector_index.add(record['embedding'], {
                'timestamp': record.get('timestamp'),
                'summary': record.get('extracted_text', '')[:200],
                'effect': record.get('effect', '')
            })
            # 每10条构建一次索引（Annoy不支持增量构建，需要rebuild）
            # 实际策略：每添加一条就保存，每天或每N条触发一次完整rebuild
            # 简化方案：启动时rebuild，运行时只add不build， graceful shutdown时build+save
            pass

    def save_index(self):
        """保存向量索引（应在请求结束时调用）"""
        self.vector_index.build()
        self.vector_index.save()
```

### 5.2 Prompt组装流程（代码级）

```python
# backend/app/prompts/reply_prompt.py

from app.utils.storage import StorageManager
from app.services.memory_engine import MemoryEngine
from app.services.knowledge_base import KnowledgeBase

def build_reply_prompt(
    girl_id: str,
    parsed_screenshot: dict,
    user_profile: dict,
    girl_profile: dict
) -> str:
    """组装完整的回复生成Prompt"""

    # 1. 检索记忆
    memory_engine = MemoryEngine(girl_id)
    query = parsed_screenshot.get("her_last_message", "")
    memories = memory_engine.retrieve(query, top_k=5, recent_limit=3)

    # 2. 检索凡哥知识
    kb = KnowledgeBase()
    current_stage = girl_profile.get("relationship", {}).get("current_stage", "熟悉期")
    knowledge = kb.search(
        scene=query,
        girl_stage=current_stage
    )

    # 3. 格式化记忆
    memory_text = ""
    if memories:
        memory_lines = []
        for m in memories:
            ts = m.get("timestamp", "未知时间")
            summary = m.get("summary", "")
            effect = m.get("effect", "")
            source_tag = "【向量匹配】" if m.get("source") == "vector_search" else "【最近对话】"
            line = f"- {source_tag} {ts}: {summary}"
            if effect:
                line += f" （效果：{effect}）"
            memory_lines.append(line)
        memory_text = "\n".join(memory_lines)
    else:
        memory_text = "（暂无相关历史记忆）"

    # 4. 格式化知识库
    knowledge_text = ""
    if knowledge:
        k = knowledge[0]  # 取最相关的一条
        knowledge_text = f"场景：{k['scene']}\n策略：{k['strategy']}\n示例：{k.get('example_good', '')}"
    else:
        knowledge_text = "（暂无匹配的策略）"

    # 5. 组装Prompt
    prompt = f"""【系统角色】
你是一个情感聊天助手，师从"凡哥恋爱宝典"，擅长帮直男用户学会幽默霸道的聊天方式。
你的回复必须有情绪起伏，敢于暧昧推进，不能保守正确。
绝对规则：
- 每个版本回复必须是1-2句话的微信消息
- 不要分点论述，不要用"首先/其次/最后"
- 要像真人打字，可以有断句、"hhh"、"."代替"。"
- 不要解释概念，直接给回复

【用户画像】
年龄：{user_profile.get('basic_info', {}).get('age', '未知')}
职业：{user_profile.get('basic_info', {}).get('occupation', '未知')}
性格：{', '.join(user_profile.get('personality', {}).get('traits', []))}
说话风格：{user_profile.get('personality', {}).get('chat_style', '未知')}
口头禅：{', '.join(user_profile.get('personality', {}).get('common_phrases', []))}

【当前女生档案：{girl_profile.get('name', '未知')}】
关系阶段：{current_stage}
她的性格：{', '.join(girl_profile.get('personality_analysis', {}).get('tags', []))}
她的雷区：{', '.join(girl_profile.get('preferences', {}).get('taboos', []))}
最近事件：{girl_profile.get('chat_history_summary', [{}])[-1].get('event', '无') if girl_profile.get('chat_history_summary') else '无'}

【她刚发的消息】
内容：{parsed_screenshot.get('her_last_message', '')}
情绪判断：{parsed_screenshot.get('emotion_tag', '未知')}
平台：{parsed_screenshot.get('meta_info', {}).get('platform', '微信')}

【相关历史记忆】
{memory_text}

【凡哥策略参考】
{knowledge_text}

【任务】
1. 先分析她这句话背后的情绪和窗口
2. 给出回复思路（1-2句话说明为什么这样回）
3. 生成3个版本：
   - conservative（保守版：安全但平淡）
   - balanced（平衡版：有情绪价值，推荐）
   - aggressive（激进版：带推进和暧昧，有风险但高回报）
4. 推荐一个版本并说明原因

【输出格式】严格JSON，不要markdown代码块：
{{"emotion_tag": "...", "window_analysis": "...", "reply_strategy": "...", "versions": {{"conservative": "...", "balanced": "...", "aggressive": "..."}}, "recommended": "balanced", "recommended_reason": "..."}}
"""

    return prompt
```

### 5.3 完整请求处理流程（代码级）

```python
# backend/app/routers/chat.py 中的核心handler

from fastapi import APIRouter, UploadFile, File, Form
from app.utils.storage import StorageManager
from app.services.image_parser import parse_screenshot
from app.services.memory_engine import MemoryEngine
from app.services.reply_generator import generate_reply
from app.services.profile_updater import update_girl_profile_after_chat
from app.prompts.reply_prompt import build_reply_prompt

router = APIRouter(prefix="/api/girls", tags=["chat"])

@router.post("/{girl_id}/chat")
async def chat_with_girl(
    girl_id: str,
    image: UploadFile = File(...),
    text_note: str = Form("")
):
    # 1. 校验girl_id存在
    girl_profile = StorageManager.read_json(
        StorageManager.girl_profile_path(girl_id)
    )
    if not girl_profile:
        raise HTTPException(404, detail="女生不存在")

    # 2. 保存截图到磁盘
    screenshot_dir = StorageManager.girl_screenshot_dir(girl_id)
    screenshot_dir.mkdir(parents=True, exist_ok=True)
    timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
    screenshot_path = screenshot_dir / f"{timestamp_str}.png"
    with open(screenshot_path, "wb") as f:
        f.write(await image.read())

    # 3. 解析截图（调用GPT-4o-mini）
    parsed = await parse_screenshot(str(screenshot_path), text_note)

    # 4. 加载用户画像
    user_profile = StorageManager.read_json(
        StorageManager.user_profile_path()
    )

    # 5. 检索记忆
    memory_engine = MemoryEngine(girl_id)
    memories = memory_engine.retrieve(
        parsed.get("her_last_message", ""),
        top_k=5
    )

    # 6. 组装Prompt
    prompt = build_reply_prompt(
        girl_id=girl_id,
        parsed_screenshot=parsed,
        user_profile=user_profile,
        girl_profile=girl_profile
    )

    # 7. 生成回复（调用Claude 4）
    reply_result = await generate_reply(prompt)

    # 8. 编码当前记录用于向量存储
    from app.utils.embeddings import encode_text
    embedding = encode_text(parsed.get("her_last_message", ""))

    # 9. 保存到历史记录
    record = {
        "timestamp": datetime.now().isoformat(),
        "type": "screenshot_chat",
        "screenshot_path": str(screenshot_path),
        "extracted_text": parsed.get("extracted_text"),
        "her_last_message": parsed.get("her_last_message"),
        "emotion_tag": parsed.get("emotion_tag"),
        "reply_result": reply_result,
        "embedding": embedding
    }
    memory_engine.store(record)
    memory_engine.save_index()

    # 10. 异步更新女生档案（不阻塞返回）
    # 实际用background tasks
    background_tasks.add_task(
        update_girl_profile_after_chat,
        girl_id, record
    )

    # 11. 组装响应
    return {
        "request_id": f"req_{timestamp_str}",
        "parsed": parsed,
        "window_analysis": reply_result.get("window_analysis"),
        "reply_strategy": reply_result.get("reply_strategy"),
        "versions": reply_result.get("versions"),
        "recommended": reply_result.get("recommended"),
        "recommended_reason": reply_result.get("recommended_reason"),
        "related_memories": memories,
        "knowledge_refs": reply_result.get("knowledge_refs", [])
    }
```

---

## 六、Prompt工程细节

### 6.1 反"人机味"的Prompt技巧

在System Prompt中必须包含以下约束（已验证有效）：

```
绝对规则：
1. 每个版本回复只能是1-2句话，像微信消息那样短
2. 禁止分点论述（不要1. 2. 3.）
3. 禁止用"首先/其次/最后/总的来说"
4. 禁止像客服一样礼貌（不要"呢/哦/呀"结尾）
5. 要像朋友聊天，可以有：
   - 断句（"今天。真的。很累"）
   - 语气词（"hhh", "笑死", "绝了"）
   - 反问（"不然呢？"）
   - 留白（话说到一半，让她接）
6. 敢于冒险：可以轻微暧昧、调侃、甚至故意不正面回答
7. 不要解释你为什么这么回，直接给回复内容
```

### 6.2 长度控制Prompt

```
长度规则：
- 女生发1-5个字 → 你回3-10个字
- 女生发1-2句话 → 你回1-2句话
- 女生发长段（3句以上）→ 你最多回2-3句话
- 推进关系/邀约时 → 可以稍微长一点（但不超过女生字数的1.5倍）
- 绝不发小作文
```

### 6.3 情绪标签定义

Prompt中要求模型输出标准化的情绪标签，方便前端展示不同颜色：

| 情绪标签 | 颜色 | 说明 |
|---------|------|------|
| 疲惫+求安慰 | 🟠 橙色 | 她在释放脆弱面 |
| 测试/刁难 | 🔴 红色 | 她在考验你的框架 |
| 撒娇 | 🩷 粉色 | 她在对你释放好感 |
| 分享日常 | 🟢 绿色 | 普通窗口，维持联系 |
| 冷淡/敷衍 | ⚪ 灰色 | 兴趣降低，需要止损 |
| 生气/抱怨 | 🟣 紫色 | 情绪爆发，需要安抚 |
| 暧昧/窗口 | 🟡 黄色 | 关系推进的最佳时机 |

---

## 七、部署方案

### 7.1 服务器要求

| 项目 | 最低配置 | 推荐配置 |
|------|---------|---------|
| CPU | 1核 | 2核 |
| 内存 | 1GB | 2GB |
| 硬盘 | 20GB SSD | 50GB SSD |
| 带宽 | 3Mbps | 5Mbps |
| 月费 | ~40元 | ~80元 |

推荐：阿里云轻量应用服务器（2核2G5M，约80元/月）或腾讯云轻量（类似价格）

### 7.2 Docker Compose 配置

```yaml
# docker-compose.yml
version: '3.8'

services:
  backend:
    build: ./backend
    container_name: aichat-backend
    restart: unless-stopped
    ports:
      - "8000:8000"
    volumes:
      - ./data:/app/data
      - ./backend/.env:/app/.env:ro
    environment:
      - ENV=production

  frontend:
    build: ./frontend
    container_name: aichat-frontend
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - ./certbot/conf:/etc/letsencrypt:ro
    depends_on:
      - backend
```

### 7.3 Nginx配置

```nginx
# nginx.conf
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # 前端静态文件
    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
    }

    # API反向代理
    location /api/ {
        proxy_pass http://backend:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 60s;
    }
}
```

### 7.4 一键部署脚本

```bash
#!/bin/bash
# deploy.sh

set -e

echo "=== AiChat Agent 部署脚本 ==="

# 拉取最新代码
git pull origin main

# 构建并启动
docker-compose down
docker-compose build
docker-compose up -d

# 健康检查
sleep 5
curl -f http://localhost:8000/api/health || exit 1

echo "=== 部署完成 ==="
echo "访问地址: https://your-domain.com"
```

### 7.5 数据备份策略

因为所有数据都是文件，备份极其简单：

```bash
# 每天凌晨3点备份到另一目录
0 3 * * * tar czf /backup/aichat-$(date +\%Y\%m\%d).tar.gz /opt/aichat/data/

# 保留最近7天备份
find /backup/ -name "aichat-*.tar.gz" -mtime +7 -delete
```

---

## 附录：开发检查清单

开始开发前，请确认以下事项：

- [ ] 你已确认本方案没有大问题
- [ ] 你已提供凡哥视频文字稿/课程资料（或承诺在Phase 4前提供）
- [ ] 你已填写用户画像初始数据
- [ ] 你已准备好服务器（或有购买计划）
- [ ] 你已确认API Key可用（OpenAI + Claude至少一个）
- [ ] 你已确认预算接受（约100元/月）

确认后，我将按Phase顺序逐块开发，每完成一个Phase给你验收。
