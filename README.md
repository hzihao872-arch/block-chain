# IdeaLock 2.0 (Web3 Idea Vault)

面向“想法优先权/创意保护”的 Web3 证据链产品。
核心流程：本地生成承诺（hash + salt + nonce）→ 链上/OTS 时间戳 → 需要时解锁揭示 → 第三方独立验证。

## 目录结构
- apps/web: 用户端 Web3 网站（提交承诺、锁定/解锁）
- apps/verify: 第三方独立验证页面（免登录）
- services/api: 业务 API（项目/证据/证明管理）
- services/worker: 后台作业（时间戳升级、证据包生成）
- contracts: commit-reveal/registry 合约
- packages/crypto: 哈希/加密/commit-reveal 实现
- packages/timestamp: OTS/链上时间戳适配层
- packages/identity: 钱包签名/邮箱验证/DID
- packages/evidence: 证据包（PDF/ZIP）生成
- packages/sdk: 对外 SDK（可选）
- infra: 部署与迁移
- docs: PRD/ARCH/威胁模型
- legal/templates: 证据模板与说明

## 目标
- 证明“内容在某时间点已存在且未被篡改”
- 提供可公开验证的证据链
- 通过身份绑定提高可采信度

## M0 快速开始（本地空壳）

### 1) API
```bash
cd services/api
python -m venv .venv
.venv\\Scripts\\activate
pip install -r requirements.txt
set APP_ENV=dev
set SERVER_SIGNING_SECRET=change_me
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2) Web
```bash
cd apps/web
npm install
npm run dev
```

### 3) Verify
```bash
cd apps/verify
npm install
npm run dev
```
