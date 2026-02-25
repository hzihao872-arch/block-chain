# API 规格（MVP）

> 所有请求与响应均为 JSON，除文件下载接口外。

## 1. 认证相关

### POST /api/auth/wallet/verify
- 用途：验证钱包签名，绑定钱包地址
- 请求：
```
{
  "wallet_address": "0x...",
  "message": "commitment|client_nonce|timestamp",
  "signature": "0x..."
}
```
- 响应：
```
{
  "ok": true,
  "user_id": "..."
}
```

### POST /api/auth/email/request
- 用途：发送邮箱验证邮件
- 请求：
```
{
  "email": "user@example.com",
  "wallet_address": "0x...",
  "commitment_id": "..."
}
```
- 响应：
```
{
  "ok": true
}
```

### GET /api/auth/email/confirm
- 用途：确认邮箱（magic link）
- 参数：token
- 响应：
```
{
  "ok": true
}
```

## 2. 承诺与盖章

### POST /api/projects
- 用途：创建项目
- 请求：
```
{
  "name": "我的项目",
  "description": ""
}
```
- 响应：
```
{
  "id": "...",
  "name": "我的项目",
  "description": ""
}
```

### GET /api/projects
- 用途：列出项目
- 响应：项目数组

### GET /api/projects/{id}/packages
- 用途：列出项目证据包
- 响应：证据包数组（含 download_url）

### POST /api/projects/{id}/packages
- 用途：上传证据包到项目（服务器保存）
- 请求：`multipart/form-data`
  - package_file (ZIP)
  - commitment_id
  - snapshot_id (可选)
  - snapshot_name (可选)
- 响应：`{ id, download_url }`

### GET /api/projects/{id}/packages/{package_id}
- 用途：下载证据包 ZIP

### POST /api/snapshots
- 用途：创建科研快照（文件夹去重入库）
- 请求：`multipart/form-data`
  - files (多文件)
  - file_meta (JSON 数组，含 path/size/last_modified)
  - snapshot_name (可选)
  - project_id (可选)
- 响应：
```
{
  "snapshot_id": "...",
  "snapshot_name": "统计好了数据",
  "file_count": 12,
  "total_size": 123456,
  "manifest": {...},
  "manifest_canonical": "..."
}
```

### GET /api/snapshots/{id}/manifest
- 用途：获取快照清单
- 响应：manifest JSON

### GET /api/snapshots/{id}/export
- 用途：导出该快照的取证包（包含快照文件）
- 响应：文件流（application/zip）

### POST /api/commitments
- 用途：提交承诺
- 请求：
```
{
  "project_id": "...",
  "snapshot_id": "...",
  "snapshot_name": "统计好了数据",
  "wallet_address": "0x...",
  "commitment_hash": "hex",
  "hash_alg": "sha256",
  "message": "IdeaLock Commitment ...",
  "wallet_signature": "0x..."
}
```
- 响应：
```
{
  "id": "...",
  "status": "EMAIL_PENDING"
}
```

### POST /api/commitments/{id}/stamp
- 用途：触发 OTS 盖章（邮箱验证通过后）
- 响应：
```
{
  "ok": true,
  "status": "STAMPING"
}
```

### GET /api/commitments/{id}/bundle
- 用途：下载证据包（ZIP）
- 响应：文件流（application/zip）

## 3. 验证

### POST /api/verify
- 用途：验证证据包 + 原文
- 请求：`multipart/form-data`
  - bundle (ZIP)
  - unlock_material (JSON)
  - original_file (可选)
  - snapshot_bundle (可选，快照导出 ZIP)
- 响应：
```
{
  "valid": true,
  "details": {
    "commitment_match": true,
    "file_match": true,
    "signature": true,
    "ots": true,
    "ots_complete": false,
    "snapshot_match": true,
    "snapshot_files_match": true,
    "snapshot_commitment_match": true,
    "snapshot_manifest_match": true
  }
}
```
