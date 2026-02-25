# 架构说明（MVP 可落地版）

> 路线：OpenTimestamps + Web 端 + 原文本地保存 + MetaMask 签名 + Gmail SMTP 邮箱验证。
> 验证页不要求离线，允许调用 API。

## 1. 总体架构

```
[Browser: Web App] ---HTTPS---> [API 服务] ---DB---> [SQLite/PostgreSQL]
        |                             |
        |                             +--> [Worker: OTS Stamping]
        |                                           |
        |                                           +--> [OpenTimestamps Calendars]
        |
        +--> [Browser: Verify App] ---HTTPS---> [API 服务]
```

**核心原则**：原文、salt、nonce 全部留在用户本地；服务端只持有承诺与证明。

## 2. 技术栈（MVP）
- 前端：React + Vite + TypeScript
- 后端：FastAPI + SQLAlchemy
- 数据库：本地 SQLite（MVP），可平滑升级 PostgreSQL
- Worker：Python 后台任务（轮询 pending 记录）
- 时间戳：OpenTimestamps Python 客户端

## 3. 组件职责

### 3.1 apps/web（用户端）
- 生成承诺：`H(content + salt + nonce)`（SHA-256）
- 生成本地“解锁材料”文件（salt/nonce）并提示备份
- MetaMask 钱包签名
- 发送承诺与签名到 API
- 下载证据包

### 3.2 apps/verify（第三方验证页）
- 上传原文 + 证据包
- 复算承诺、校验签名
- 调用 API 验证 OTS 证明

### 3.3 services/api（FastAPI）
- 身份验证：钱包签名校验、邮箱验证
- 管理承诺状态
- 触发盖章、提供证据包下载

### 3.4 services/worker（Python）
- 生成 `.ots` 证明
- 失败重试与升级

### 3.5 数据存储
- SQLite/PostgreSQL：用户、项目、承诺、审计日志
- 文件系统：`.ots` 与证据包（不含原文）

## 4. 关键数据流

### 4.1 锁定（Commit）
1) 用户本地生成 `salt/nonce` 与承诺 hash。
2) 用户钱包签名 `commitment`。
3) 前端把承诺与签名发给 API。
4) API 触发邮箱验证。
5) 邮箱确认后进入“可盖章”状态。
6) Worker 生成 OTS 证明并回写。
7) 用户下载证据包。

### 4.2 解锁与验证（Reveal）
1) 用户提供原文与证据包。
2) 验证页复算 hash → 比对承诺。
3) 校验钱包签名与邮箱验证证明。
4) 调用 API 校验 OTS 证明。
5) 输出验证结论。

## 5. 状态机（Commitment）

```
DRAFT -> EMAIL_PENDING -> STAMPING -> PROOF_READY
   \-> FAILED (可重试)
```

## 6. 加密与签名
- Hash：SHA-256
- 签名：EVM 钱包签名（EIP-191 personal_sign）
- 邮箱验证：magic link + 服务端签名 token

## 7. 信任边界
- 浏览器：可信处理原文、salt、nonce
- API 服务：不可信原文，只处理承诺/签名
- OTS 日历：第三方不可信，仅用于时间戳

## 8. 部署形态（MVP）
- 单机 Docker：API + Worker + DB
- SMTP 账号（Gmail）用于发送邮件
- Web/Verify 静态站点部署

## 9. 风险与缓解
- 用户丢失 salt/nonce：提供本地备份文件与提示
- 邮箱无法送达：提供重发与备用邮箱
- OTS 不可用：可重试/排队

