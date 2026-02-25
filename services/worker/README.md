# Worker（M3）

## 运行
```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python worker.py
```

## 说明
- 轮询数据库中 `STAMPING` 状态的 commitment
- 生成 `.ots` 证明 + 证据包 ZIP
- 更新状态为 `PROOF_READY`
