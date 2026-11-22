FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.lock pyproject.toml alembic.ini ./
RUN pip install --no-cache-dir -r requirements.lock
COPY backend ./backend
RUN pip install --no-cache-dir --no-deps . && useradd --uid 10001 --create-home rad && mkdir -p /app/.local && chown -R rad:rad /app/.local
USER rad
EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --no-access-log --no-proxy-headers"]
