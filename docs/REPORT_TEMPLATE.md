# 科研存证证据报告模板（双语） / Research Evidence Report Template (Bilingual)

> 目标：用于“学术争议证明”的固定格式证据报告。  
> Goal: A fixed-format evidence report for academic priority/priority disputes.
>
> 建议输出格式：PDF/A-2b 或 PDF/A-3b（用于长期可读和可验证归档）。  
> Recommended output: PDF/A-2b or PDF/A-3b for long-term archival.
>
> 参考标准（待核验，用户提供）：GB/T 43580-2023、SF/T 0076-2020、区块链司法存证技术要求等。  
> References (to be verified, provided by user): GB/T 43580-2023, SF/T 0076-2020, etc.

---

## 0. 报告元信息 / Document Metadata (Required)
- 报告编号 / Certificate ID: `{{certificate_id}}`
- 报告版本 / Report Version: `{{report_version}}`
- 生成时间（含时区）/ Generated At (with TZ): `{{generated_at}}`
- 报告用途 / Purpose: 学术争议证明 / Academic Priority Evidence
- 系统版本 / System Version: `{{system_version}}`
- 报告语言 / Language: 中文 + English
- 机密级别 / Confidentiality: `{{confidentiality_level}}`
- 二维码（验证入口）/ QR Code (Verification URL): `{{verify_qr}}`
- 验证链接 / Verification URL: `{{verify_url}}`

---

## 1. 研究声明 / Research Claim (Required)
- 标题 / Title: `{{claim_title}}`
- 研究领域 / Field: `{{claim_field}}`
- 关键词 / Keywords: `{{keywords}}`
- 研究阶段 / Stage: 构想/实验中/初步结果/投稿中 / `{{stage}}`
- 核心创新点摘要 / Core Claim Summary:  
  `{{claim_summary}}`

---

## 2. 署名与归属 / Attribution (Required)
- 研究者 / Author(s):
  - 姓名 / Name: `{{author_name}}`
  - 单位 / Affiliation: `{{author_affiliation}}`
  - 邮箱 / Email: `{{author_email}}`
  - ORCID (可选 / optional): `{{author_orcid}}`
- 共同作者 / Co-authors (optional): `{{co_authors}}`
- 见证人 / Witness (optional, configurable):
  - 姓名 / Name: `{{witness_name}}`
  - 单位 / Affiliation: `{{witness_affiliation}}`
  - 签名 / Signature: `{{witness_signature}}`
  - 日期 / Date: `{{witness_date}}`

---

## 3. 时间线 / Timeline (Required)
| 事件 / Event | 时间 / Time | 操作者 / Actor | 关联证据 / Evidence |
|---|---|---|---|
| 构想形成 / Idea formed | `{{t0}}` | `{{actor0}}` | `{{evidence0}}` |
| 实验执行 / Experiment run | `{{t1}}` | `{{actor1}}` | `{{evidence1}}` |
| 数据产出 / Data produced | `{{t2}}` | `{{actor2}}` | `{{evidence2}}` |
| 存证提交 / Evidence submitted | `{{t3}}` | `{{actor3}}` | `{{evidence3}}` |
| 时间戳生成 / Timestamp issued | `{{t4}}` | `{{actor4}}` | `{{evidence4}}` |

---

## 4. 证据清单 / Evidence Manifest (Required)
- 证据总数 / Total files: `{{file_count}}`
- 总大小 / Total size: `{{total_size}}`
- 原始数据位置 / Source data location: `{{source_data_location}}`

| 文件名 / File | 类型 / Type | 大小 / Size | 哈希 / Hash | 创建时间 / Created |
|---|---|---|---|---|
| `{{file_1}}` | `{{type_1}}` | `{{size_1}}` | `{{hash_1}}` | `{{created_1}}` |
| ... | ... | ... | ... | ... |

---

## 5. 完整性与哈希 / Integrity & Hash (Required)
- Commitment Hash: `{{commitment_hash}}`
- 哈希算法 / Hash Algorithm: `{{hash_alg}}` (e.g., SHA-256 / SM3)
- Salt / Nonce（可选，见解锁材料 / optional, in unlock material）: `{{salt_nonce_policy}}`
- 钱包签名 / Wallet Signature: `{{wallet_signature}}`
- 钱包地址 / Wallet Address: `{{wallet_address}}`

---

## 6. 时间戳与区块链锚点 / Timestamp & Blockchain Anchor (Required)
- 可信时间戳 / Trusted Timestamp: `{{trusted_timestamp}}`
- 时间戳来源 / Timestamp Authority: `{{tsa_source}}`
- 区块链 / Blockchain Network: `{{chain_name}}`
- Chain ID: `{{chain_id}}`
- 交易哈希 / Tx Hash: `{{tx_hash}}`
- 区块高度 / Block Height: `{{block_height}}`
- OTS 证明文件 / OTS Proof: `{{ots_proof_id_or_hash}}`

---

## 7. 身份与签名 / Identity & Signatures (Required)
- 邮箱验证 / Email Verified: `{{email_verified_at}}`
- 身份验证方式 / Identity Method: `{{identity_method}}` (e.g., Email + Wallet)
- 平台签名 / Platform Signature (optional): `{{platform_signature}}`
- 证书签发者 / Issuer: `{{issuer_name}}`
- 证书编号 / Issuer Cert ID: `{{issuer_cert_id}}`

---

## 8. 验证说明 / Verification Guide (Required)
1. 打开验证链接 / Open verification URL: `{{verify_url}}`
2. 上传证据包 / Upload evidence bundle: `{{bundle_name}}`
3. 选择解锁材料 / Provide unlock material: `{{unlock_material_name}}`
4. 系统校验哈希与时间戳 / Validate hash & timestamp
5. 校验区块链锚点 / Validate blockchain anchor

---

## 9. 审计与日志摘要 / Audit & Logs (Recommended)
- 操作日志摘要 / Log Summary: `{{log_summary}}`
- 操作人 / Actor: `{{log_actor}}`
- IP / Device (optional): `{{log_ip_device}}`
- 日志校验 / Log Hash: `{{log_hash}}`

---

## 10. 附录 / Appendices (Optional)
### A) ALCOA+ 完整性检查表 / ALCOA+ Checklist
Attributable / Legible / Contemporaneous / Original / Accurate / Complete / Consistent / Enduring / Available  
`{{alcoa_checklist}}`

### B) 附件（可嵌入 PDF/A-3）/ Embedded Artifacts (PDF/A-3)
- 原文件摘要 / Source file summary: `{{embedded_summary}}`
- 元数据 / Metadata XML: `{{embedded_metadata}}`

---

## 免责声明 / Disclaimer
本报告用于学术争议证明场景，仅证明某数据在特定时间点存在并未被篡改，不等同于专利或著作权的法律确权文件。  
This report proves the existence and integrity of data at a given time; it does not itself establish legal ownership.

