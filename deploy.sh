#!/usr/bin/env bash
set -e

# ==================== 配置 ====================
SERVER="root@39.106.77.104"
REMOTE_DIR="/www/wwwroot/czt666.cn/Projects/AiChat"
SERVICE_NAME="aichat-backend"
# ==============================================

echo "=== 1. 构建前端 ==="
cd frontend
pnpm install
pnpm build
cd ..

echo "=== 2. 同步代码到服务器 ==="
ssh "${SERVER}" "mkdir -p ${REMOTE_DIR}"

echo "  同步后端..."
tar czf /tmp/aichat_backend.tar.gz backend/
scp /tmp/aichat_backend.tar.gz "${SERVER}:${REMOTE_DIR}/"
ssh "${SERVER}" "cd ${REMOTE_DIR} && tar xzf aichat_backend.tar.gz && rm -f aichat_backend.tar.gz"

echo "  同步前端..."
tar czf /tmp/aichat_frontend.tar.gz -C frontend/dist .
scp /tmp/aichat_frontend.tar.gz "${SERVER}:${REMOTE_DIR}/"
ssh "${SERVER}" "cd ${REMOTE_DIR} && mkdir -p frontend && tar xzf aichat_frontend.tar.gz -C frontend && rm -f aichat_frontend.tar.gz"

echo "  同步数据..."
tar czf /tmp/aichat_data.tar.gz data/
scp /tmp/aichat_data.tar.gz "${SERVER}:${REMOTE_DIR}/"
ssh "${SERVER}" "cd ${REMOTE_DIR} && tar xzf aichat_data.tar.gz && rm -f aichat_data.tar.gz"

echo "=== 3. 远程安装依赖 ==="
ssh "${SERVER}" bash -s << REMOTE_EOF
set -e
REMOTE_DIR="${REMOTE_DIR}"

echo "=== 安装 Python 依赖 ==="
cd "\${REMOTE_DIR}/backend"
python3.9 -m pip install --upgrade pip -i https://pypi.org/simple
python3.9 -m pip install -r requirements.txt -i https://pypi.org/simple

echo ""
echo "=== 部署完成 ==="
echo "请手动启动后端服务："
echo "  cd \${REMOTE_DIR}/backend && python3.9 -m uvicorn app.main:app --host 127.0.0.1 --port 3615"
REMOTE_EOF

