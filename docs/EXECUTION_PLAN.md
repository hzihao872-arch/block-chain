# 执行计划（MVP）

> 目标：在有限资源下交付可演示、可验证的完整闭环。

## M0 — 基础搭建
- 建立环境配置 `.env.example`
- 规范目录结构与文档
- 验收：能启动 API/Worker/Web 的空壳服务

## M1 — 承诺生成 + 钱包签名
- 前端生成 `commitment`
- MetaMask 签名并提交 API
- 验收：API 记录承诺，状态为 EMAIL_PENDING

## M2 — 邮箱验证
- Gmail SMTP 发送 magic link
- 完成邮箱验证后状态流转
- 验收：状态进入 STAMPING

## M3 — OTS 盖章 + 证据包
- Worker 生成 `.ots` 证明
- 生成 ZIP 证据包
- 验收：用户能下载证据包并看到 manifest.json
 - 说明：证据包包含 proof.ots + manifest.json + README.txt

## M4 — 第三方验证页
- 上传原文 + 证据包
- 校验签名 + OTS 证明
- 验收：显示有效/无效结果

## 需要你配合的事项
- 提供 Gmail 应用专用密码（只放本地 .env，不要发送给我）
- 安装浏览器 MetaMask 插件
- 测试邮箱收发
