# IdeaLock（基于区块链时间戳的想法保护与证据链平台）

IdeaLock 的目标是为科研与创意场景提供“存在性证明”和“优先权证据链”：
把文件的哈希和时间戳记录下来，在争议发生时能证明“某内容在某时间点已存在且未被篡改”。
它不直接裁定作者或版权归属，而是降低举证成本、强化证据可信度。

---

## 当前推荐实现（OpenTimestamps 版）
本仓库以 **OpenTimestamps + Bitcoin 区块链锚定** 作为主路径：
- **Python Agent**：本地监听、生成 .ots、证据包与记录
- **Electron Desktop**：项目管理、证据查看、导出与验证

入口说明请看：`opentimestamps-client/IDEALOCK_AGENT.md`

---

## 仓库结构（精简后）
- `opentimestamps-client/`：主实现（OpenTimestamps Agent + 证据逻辑）
- `opentimestamps-client/idealock-desktop/`：桌面端 UI
- `legacy/node-agent/`：旧版 Node/EVM 存证 PoC（仅保留参考）
- `demo_docs/`：示例文档
- `releases/`：历史打包与评审包

---

## 快速开始（桌面端）
1. 安装 Python 3.10/3.11 和 Node.js 18+
2. 进入 `opentimestamps-client/` 安装依赖：
   - `pip install -r requirements.txt`
   - 可选（本地加密）：`pip install cryptography`
3. 进入 `opentimestamps-client/idealock-desktop/`：
   - `npm install`
   - `npm start`
4. 在 UI 中选择项目目录 → Init → Start Watching

---

## 快速开始（命令行）
在 `opentimestamps-client/` 目录：
- 初始化：`python idealock_agent.py init --dir "C:\\path\\to\\project"`
- 监听：`python idealock_agent.py watch`
- 单文件存证：`python idealock_agent.py stamp "C:\\path\\to\\file.docx"`
- 本地验证：`python idealock_agent.py verify "C:\\path\\to\\file.docx"`
- 升级 OTS：`python idealock_agent.py upgrade`

---

## 产品思路（核心价值）

1. **存在性证明（Priority of Existence）**
   - 用哈希锁定内容，锚定时间戳。
   - 证明“该内容在某时刻已经存在”，适合学术优先权争议。

2. **内容不可篡改**
   - 哈希唯一且不可逆，修改任何字符都会改变哈希。
   - 可以让证据链可验证、可复核。

3. **隐私可控（不上传原文）**
   - 默认只记录哈希（可选加密密文）。
   - 原文不离开用户本地，避免泄露和合规风险。

---

## 当前产品阶段（已完成）

### ✅ 已实现
- 自动监听保存（watcher）
- 独立 OTS 证据（每次改动生成独立 .ots）
- 证据包导出（PDF / ZIP）
- 证据检索与筛选
- 桌面端 UI（Electron）
- 本地验证（原文件 + .ots）

### 🔎 能证明什么
- 文件内容在某时间点已经存在。
- 文件之后未被篡改（哈希一致即可证明）。

### ⚠️ 不能直接证明什么
- 作者身份、版权归属、贡献比例。
- 需要额外的身份绑定与外部证据链支持。

---

## 技术结构（简化版）
- 本地哈希 + OpenTimestamps 时间戳（Bitcoin 区块链锚定）
- 可选本地加密存证
- UI（Electron）作为用户入口
- 证据导出 PDF/ZIP 用于对外提交

---

## 待完成的工作（成品化关键）
### 1) 证据链补强
- 身份绑定（实名/签名证书/机构背书）
- Git 证据链（commit/tag/远端备份）
- 可选邮件/导师见证/实验记录封存

### 2) 体验与传播
- 更清晰的“证据解释”页面
- 一键验证页面（给第三方）
- Windows 一键安装包（exe）

### 3) 合规与落地
- 司法认可路径梳理
- 证据模板规范化（符合证据提交格式）
- 法律合作方生态（律师/公证/仲裁）

---

## 下一阶段建议（可执行）
1. 增加身份绑定（最低成本：本地签名 + 邮箱验证）
2. 加 Git 证据链（commit/tag + hash）
3. 引入“一键验证页面”（对第三方）
4. 打包 Windows 安装程序

---

> 如果需要，我可以继续补：
> - 法律证据链模板（交给法院/期刊的版本）
> - 产品介绍 PPT
> - 对标竞品表格（差异化说明）
