# M3 操作步骤（盖章 + 证据包）

1) 确保 API 正在运行
2) 确保邮箱验证已完成（commitment 状态为 STAMPING）
3) 启动 worker：

```bat
cd /d "C:\Users\HANWANG\Desktop\区块链项目\services\worker"
python -m venv .venv
.venv\Scripts\activate.bat
python -m pip install -r requirements.txt
python worker.py
```

4) 观察 worker 输出 "Stamped commitment ..."
5) 下载证据包：
   - http://localhost:8000/api/commitments/{commitment_id}/bundle

证据包包含：
- manifest.json
- proof.ots
- README.txt
