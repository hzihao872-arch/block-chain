# API 服务（MVP）

## 运行
```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
set APP_ENV=dev
set DATABASE_URL=sqlite:///./dev.db
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## 健康检查
- GET http://localhost:8000/health

## 说明
- 这是最小可运行骨架，具体业务逻辑后续按 M1-M4 实现。
