# 数据库结构（MVP）

> SQLite 优先，表结构与 PostgreSQL 兼容。

## users
- id (pk)
- wallet_address (unique)
- email (unique)
- email_verified_at (nullable)
- created_at

## projects
- id (pk)
- owner_id (fk -> users.id)
- name
- description
- created_at

## commitments
- id (pk)
- project_id (fk -> projects.id)
- snapshot_id (fk -> snapshots.id)
- snapshot_name (nullable)
- wallet_address
- commitment_hash (unique)
- hash_alg
- message
- wallet_signature
- email_verified_at (nullable)
- status (enum)
- created_at

## timestamp_proofs
- id (pk)
- commitment_id (fk -> commitments.id)
- ots_file_path
- bundle_path
- created_at
- verified_at (nullable)

## evidence_packages
- id (pk)
- project_id (fk -> projects.id)
- commitment_id (fk -> commitments.id)
- snapshot_id (fk -> snapshots.id, nullable)
- snapshot_name (nullable)
- package_path
- created_at

## snapshots
- id (pk)
- project_id (fk -> projects.id)
- name (nullable)
- manifest_path
- file_count
- total_size
- created_at

## audit_logs
- id (pk)
- actor_id (fk -> users.id)
- action
- target_id
- ip
- created_at
