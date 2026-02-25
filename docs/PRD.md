# PRD — IdeaLock 2.0（高校科研优先权）

> 版本：MVP 可交付版（单人/小团队可落地）。
> 路线：OpenTimestamps（比特币锚定）+ 钱包签名（MetaMask）+ Gmail SMTP 邮箱验证 + 原文仅本地保存 + Web 端交付。

## 1. 目标与边界

### 1.1 产品目标
- 让科研人员在不公开内容的前提下，生成“存在性与优先权”证据。
- 证据可被第三方独立验证（无需依赖平台解释）。
- 最低成本可部署、可演示、可交付。

### 1.2 非目标（MVP）
- 不裁定作者身份/版权归属。
- 不提供司法背书或政府批准。
- 不保管用户原文、salt、nonce。
- 不提供桌面端/移动端。

### 1.3 验收标准
- 用户 3 分钟内完成：生成承诺 → 钱包签名 → 邮箱验证 → 时间戳出证。
- 第三方在验证页上传“原文 + 证据包”可得到明确验证结果。
- 证据包包含：承诺、签名、邮箱验证证明、OTS 证明与验证说明。

## 2. 目标用户与场景

### 2.1 目标用户
- 高校科研人员、研究生、实验室负责人。

### 2.2 关键场景
- 想法/实验记录未公开，担心优先权争议。
- 论文/实验阶段性成果需证明“在某时间点已存在”。
- 与导师、期刊沟通时提供证据包。

## 3. MVP 核心流程

### 3.1 锁定（Commit）
1) 用户选择文件或输入文本（本地处理）。
2) 客户端生成：`commit = H(content + salt + nonce)`。
3) 使用 MetaMask 对 `commit + metadata` 进行签名。
4) 邮箱验证（Gmail SMTP magic link）。
5) 服务端提交 OTS 时间戳，生成 `.ots` 证明文件。
6) 用户下载证据包（ZIP，不含原文）。

### 3.2 揭示与验证（Reveal & Verify）
1) 用户向第三方提供“原文 + 证据包”。
2) 验证页复算承诺，核验签名与 OTS 证明。
3) 输出验证结论与证据摘要。

## 4. 功能范围

### 4.1 用户侧
- 项目创建与管理（最小字段）。
- 文件/文本承诺生成（本地哈希）。
- 钱包签名（MetaMask）。
- 邮箱验证（magic link）。
- 证据包下载（ZIP）。
- 独立验证页（免登录，在线验证）。

### 4.2 管理侧（最低限度）
- 查看证据记录列表。
- 基本审计日志（谁、何时、提交了什么承诺）。

## 5. 约束与假设
- 仅一名开发者 + 一名学生协作。
- 不引入高成本合规/KYC/公证。
- SMTP 使用 Gmail（应用专用密码）。
- 验证页不需要离线模式。

## 6. 数据模型（MVP）

### 6.1 User
- id, wallet_address, email, email_verified_at, created_at

### 6.2 Project
- id, owner_id, name, description, created_at

### 6.3 Commitment
- id, project_id, commitment_hash, hash_alg, wallet_signature, email_verified_at, status, created_at

### 6.4 TimestampProof
- id, commitment_id, ots_file_path, btc_txid (若可获得), created_at, verified_at

### 6.5 AuditLog
- id, actor_id, action, target_id, created_at, ip

> 注意：不存储原文、salt、nonce。用户需自行保存原文及“解锁材料”。

## 7. 证据包（ZIP）内容
- `manifest.json`：承诺、算法、签名、邮箱验证证明、时间戳信息。
- `proof.ots`：OTS 证明文件。
- `README.txt`：验证步骤说明。

## 8. API 范围（MVP）
- POST `/api/auth/wallet/verify`：校验钱包签名
- POST `/api/auth/email/request`：发送验证邮件
- GET  `/api/auth/email/confirm`：完成邮箱验证
- POST `/api/commitments`：提交承诺
- POST `/api/commitments/{id}/stamp`：触发 OTS 时间戳
- GET  `/api/commitments/{id}/bundle`：下载证据包
- POST `/api/verify`：在线验证（验证页调用）

## 9. 里程碑
- M1：前端生成承诺 + 钱包签名 + 提交 API
- M2：邮箱验证 + 承诺状态流转
- M3：OTS 时间戳服务 + 证据包
- M4：第三方验证页

## 10. 交付形式
- 可运行的 Web 产品（本地或单机部署）。
- 完整的验证闭环演示。
